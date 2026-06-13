import { ipcMain, safeStorage, BrowserWindow, app, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { runPythonEngine, getPythonExecutablePath, getEngineScriptPath } from './engine';
import { renderReel, type RenderReelParams } from './motionRenderer';
import { ensureAnonymousSupabaseSession, getSupabaseStatus } from './supabase';
import { buildBlogHtmlTemplate } from '../shared/designSystem';
import { logEvent, flushPendingOnStartup } from './telemetry';
import { signIn, signOut, refreshSession, getStoredUser, createSupportTicket } from './crm-auth';
import {
  projectsApi,
  revisionsApi,
  plansApi,
  slidesApi,
  outputsApi,
  artifactsApi,
  settingsApi
} from './db';

// Drain any unsynced events from the previous session
flushPendingOnStartup();

// Helper to get output root directory.
// On this machine all Windows user-profile env vars (USERPROFILE, APPDATA, os.homedir,
// app.getPath('documents')) resolve to C:\Users\Default inside the Electron process,
// making those paths unwritable (EPERM). app.getPath('userData') is the one confirmed-
// writable location (the SQLite DB already lives there), so we use it as the root.
function getOutputRootDir(): string {
  const customDir = settingsApi.get('OUTPUT_DIR');
  if (customDir) return customDir;
  return path.join(app.getPath('userData'), 'PolyNovea Content');
}


// =========================================================
// Settings & Credentials IPC (OS-backed encryption)
// =========================================================

ipcMain.handle('settings:save-credential', async (_, key: string, value: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    // Flag this as an internal-tool compromise fallback
    console.warn('[SECURITY WARNING] OS encryption not available. Storing plain-text credential.');
    settingsApi.save(key, value);
    return true;
  }
  try {
    const encryptedBase64 = safeStorage.encryptString(value).toString('base64');
    settingsApi.save(key, encryptedBase64);
    return true;
  } catch (err) {
    console.error(`Failed to encrypt settings key: ${key}`, err);
    return false;
  }
});

ipcMain.handle('settings:get-credential', async (_, key: string) => {
  const value = settingsApi.get(key);
  if (!value) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  try {
    const buffer = Buffer.from(value, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (err) {
    console.error(`Failed to decrypt settings key: ${key}. Returning empty string.`, err);
    return '';
  }
});

ipcMain.handle('settings:save-value', async (_, key: string, value: string) => {
  settingsApi.save(key, value);
  return true;
});

ipcMain.handle('settings:get-value', async (_, key: string) => {
  return settingsApi.get(key) || '';
});

ipcMain.handle('settings:list', async () => {
  return settingsApi.list();
});

ipcMain.handle('supabase:authenticate-anonymous', async () => {
  const { session } = await ensureAnonymousSupabaseSession();
  return {
    authenticated: true,
    userId: session.user.id,
    isAnonymous: session.user.is_anonymous ?? session.user.app_metadata?.provider === 'anonymous'
  };
});

ipcMain.handle('supabase:get-status', async () => {
  return getSupabaseStatus();
});

// =========================================================
// Projects Database IPC
// =========================================================

ipcMain.handle(
  'projects:create',
  async (
    _,
    name: string,
    mode: string,
    defaultLang?: string,
    defaultLangStyle?: string,
    palettePreset?: string,
    fontPairingPreset?: string,
    headingFont?: string,
    bodyFont?: string,
    layoutDirection?: string,
    styleStrength?: string,
    artDirectionNotes?: string,
    customPaletteJson?: string
  ) => {
    const projectId = uuidv4();
    return projectsApi.create(
      projectId,
      name,
      mode,
      defaultLang,
      defaultLangStyle,
      palettePreset,
      fontPairingPreset,
      headingFont,
      bodyFont,
      layoutDirection,
      styleStrength,
      artDirectionNotes,
      customPaletteJson
    );
  }
);

ipcMain.handle('projects:list', async () => {
  return projectsApi.list();
});

ipcMain.handle('projects:get', async (_, id: string) => {
  return projectsApi.get(id);
});

ipcMain.handle('projects:delete', async (_, id: string) => {
  projectsApi.delete(id);
  return true;
});

// =========================================================
// Revisions Database IPC
// =========================================================

ipcMain.handle(
  'revisions:create',
  async (
    _,
    projectId: string,
    inputDirection: string,
    inputContext?: string,
    languageOverrides?: string,
    styleOverrides?: string
  ) => {
    const revisionId = uuidv4();
    return revisionsApi.create(
      revisionId,
      projectId,
      inputDirection,
      inputContext,
      languageOverrides,
      styleOverrides
    );
  }
);

ipcMain.handle('revisions:list', async (_, projectId: string) => {
  return revisionsApi.listForProject(projectId);
});

ipcMain.handle('revisions:get', async (_, id: string) => {
  return revisionsApi.get(id);
});

ipcMain.handle('revisions:update-status', async (_, id: string, status: string, errorMessage?: string) => {
  revisionsApi.updateStatus(id, status, errorMessage);
  return true;
});

// =========================================================
// Plans IPC
// =========================================================

ipcMain.handle('plans:save', async (_, revisionId: string, rawMarkdown: string) => {
  const planId = uuidv4();
  return plansApi.save(planId, revisionId, rawMarkdown);
});

ipcMain.handle('plans:approve', async (_, revisionId: string) => {
  plansApi.approve(revisionId);
  return true;
});

ipcMain.handle('plans:get', async (_, revisionId: string) => {
  return plansApi.getForRevision(revisionId);
});

// =========================================================
// Slides IPC
// =========================================================

ipcMain.handle('slides:save', async (_, revisionId: string, slidesList: any[]) => {
  slidesApi.saveMany(revisionId, slidesList);
  return true;
});

ipcMain.handle('slides:get', async (_, revisionId: string) => {
  return slidesApi.getForRevision(revisionId);
});

// =========================================================
// Outputs & Artifacts IPC
// =========================================================

function compileMarkdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  
  // Headers
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  
  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote><p>$1</p></blockquote>');
  
  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Lists
  html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');
  
  // Wrap list items
  html = html.replace(/(<li>.*<\/li>)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  
  // Split by double newlines for paragraphs
  const lines = html.split(/\n\s*\n/);
  const processed = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || 
        trimmed.startsWith('<pre') || 
        trimmed.startsWith('<blockquote') || 
        trimmed.startsWith('<ul') || 
        trimmed.startsWith('<ol') || 
        trimmed.startsWith('<li')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  });
  
  return processed.filter(Boolean).join('\n');
}

ipcMain.handle('outputs:save', async (_, revisionId: string, htmlFilePath?: string, blogTextContent?: string) => {
  const outputId = uuidv4();
  return outputsApi.save(outputId, revisionId, htmlFilePath, blogTextContent);
});

ipcMain.handle('outputs:save-blog-draft', async (_, projectId: string, revisionId: string, markdownContent: string) => {
  const revisionDir = path.join(getOutputRootDir(), 'projects', projectId, 'revisions', revisionId);
  if (!fs.existsSync(revisionDir)) {
    fs.mkdirSync(revisionDir, { recursive: true });
  }
  
  const blogFilePath = path.join(revisionDir, 'blog.md');
  const htmlFilePath = path.join(revisionDir, 'blog.html');
  
  // Write markdown to blog.md
  fs.writeFileSync(blogFilePath, markdownContent, 'utf-8');
  
  // Compile to html and wrap in premiumTemplate
  const htmlBody = compileMarkdownToHtml(markdownContent);
  const project = projectsApi.get(projectId);
  const revision = revisionsApi.get(revisionId);
  let styleOverrides: any = {};
  try {
    styleOverrides = revision?.style_overrides ? JSON.parse(revision.style_overrides) : {};
  } catch {}

  const htmlTemplate = buildBlogHtmlTemplate({
    palettePreset: styleOverrides.palette_preset || project?.palette_preset || 'brand_dark',
    headingFont: styleOverrides.heading_font || project?.heading_font || 'Clash Display',
    bodyFont: styleOverrides.body_font || project?.body_font || 'Inter',
    customPalette:
      styleOverrides.custom_palette ||
      (project?.custom_palette_json ? JSON.parse(project.custom_palette_json) : null)
  });
  const htmlContent = htmlTemplate.replace('{blog_content}', htmlBody);
  fs.writeFileSync(htmlFilePath, htmlContent, 'utf-8');
  
  // Save/Update database output row
  const outputId = uuidv4();
  return outputsApi.save(outputId, revisionId, htmlFilePath, markdownContent);
});

ipcMain.handle('outputs:get', async (_, revisionId: string) => {
  return outputsApi.getForRevision(revisionId);
});

ipcMain.handle('artifacts:save', async (_, revisionId: string, type: string, filePath: string, slideNumber?: number) => {
  const artifactId = uuidv4();
  return artifactsApi.save(artifactId, revisionId, type, filePath, slideNumber);
});

ipcMain.handle('artifacts:list', async (_, revisionId: string) => {
  return artifactsApi.listForRevision(revisionId);
});

// =========================================================
// Engine Sidecar Runner IPC
// =========================================================

ipcMain.handle('engine:run', async (event, params: any) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error('No window sender found.');
  return runPythonEngine(params, window);
});

// =========================================================
// AI Motion Reel Renderer IPC
// =========================================================

ipcMain.handle('motion:render', async (event, params: RenderReelParams) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error('No window sender found.');
  try {
    return await renderReel(params, window);
  } catch (err) {
    console.error(`Failed to render reel for revision ${params.revisionId}:`, err);
    throw err;
  }
});

// Utility IPC handlers for file and directory management
ipcMain.handle('settings:get-default-output-dir', async () => {
  return getOutputRootDir();
});

ipcMain.handle('projects:get-revision-dir', async (_, projectId: string, revisionId: string) => {
  return path.join(getOutputRootDir(), 'projects', projectId, 'revisions', revisionId);
});

ipcMain.handle('outputs:read-file', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  } catch (err) {
    console.error(`Failed to read file at ${filePath}:`, err);
    return '';
  }
});

ipcMain.handle('outputs:read-image-base64', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
    return '';
  } catch (err) {
    console.error(`Failed to read image at ${filePath}:`, err);
    return '';
  }
});

ipcMain.handle('outputs:read-file-base64', async (_, filePath: string, mimeType: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
    return '';
  } catch (err) {
    console.error(`Failed to read file at ${filePath}:`, err);
    return '';
  }
});

ipcMain.handle('outputs:file-exists', async (_, filePath: string) => {
  return fs.existsSync(filePath);
});


ipcMain.handle('outputs:open-folder', async (_, folderPath: string) => {
  try {
    if (fs.existsSync(folderPath)) {
      await shell.openPath(folderPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to open folder at ${folderPath}:`, err);
    return false;
  }
});

ipcMain.handle('outputs:list-slides', async (_, slidesDirPath: string) => {
  try {
    if (fs.existsSync(slidesDirPath)) {
      const files = fs.readdirSync(slidesDirPath);
      // Filter for slide PNGs (e.g. slide-01.png) and sort them alphabetically
      return files
        .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
        .sort();
    }
    return [];
  } catch (err) {
    console.error(`Failed to list slides in ${slidesDirPath}:`, err);
    return [];
  }
});

// Diagnostics and repair IPC handlers
ipcMain.handle('engine:run-diagnostics', async () => {
  const pythonExe = getPythonExecutablePath();
  const scriptPath = getEngineScriptPath();
  
  const results = {
    pythonAvailable: false,
    engineAvailable: false,
    playwrightAvailable: false,
    chromiumAvailable: false,
    error: ''
  };

  // 1. Check Python
  try {
    const { execSync } = require('child_process');
    execSync(`"${pythonExe}" --version`);
    results.pythonAvailable = true;
  } catch (err: any) {
    results.error = `Python not detected at ${pythonExe}. Error: ${err.message}`;
    return results;
  }

  // 2. Check engine script
  if (fs.existsSync(scriptPath)) {
    results.engineAvailable = true;
  } else {
    results.error = `run_engine.py script not found at ${scriptPath}`;
    return results;
  }

  // 3. Check Playwright & Chromium
  try {
    const { execSync } = require('child_process');
    const testCmd = `"${pythonExe}" -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); p.chromium.launch().close(); p.stop(); print('OK')"`;
    const output = execSync(testCmd, {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(app.getPath('userData'), 'playwright-browsers') }
    }).toString().trim();
    
    if (output.includes('OK')) {
      results.playwrightAvailable = true;
      results.chromiumAvailable = true;
    }
  } catch (err: any) {
    results.error = `Playwright/Chromium rendering engine check failed: ${err.message}`;
  }

  return results;
});

ipcMain.handle('engine:repair-chromium', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error('No window sender found.');
  
  const pythonExe = getPythonExecutablePath();
  const { spawn } = require('child_process');
  
  return new Promise<boolean>((resolve) => {
    const child = spawn(pythonExe, ['-m', 'playwright', 'install', 'chromium'], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(app.getPath('userData'), 'playwright-browsers') }
    });
    
    child.stdout.on('data', (data) => {
      window.webContents.send('engine-progress', {
        action: 'repair',
        status: 'installing',
        message: data.toString()
      });
    });
    
    child.stderr.on('data', (data) => {
      console.warn('[Playwright Install Stderr]:', data.toString());
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
});

// =========================================================
// CRM Auth & Support Tickets IPC
// =========================================================

ipcMain.handle('crm:sign-in', async (_, email: string, password: string) => {
  const user = await signIn(email, password);
  return user;
});

ipcMain.handle('crm:sign-out', async () => {
  signOut();
  return true;
});

ipcMain.handle('crm:get-session', async () => {
  // Try refreshing first; fall back to stored if refresh fails
  const refreshed = await refreshSession();
  if (refreshed) return refreshed;
  return getStoredUser();
});

ipcMain.handle('crm:create-support-ticket', async (
  _,
  title: string,
  description: string,
  requestType: 'technical_support' | 'platform_feature',
  priority: 'low' | 'medium' | 'high' | 'urgent'
) => {
  const user = getStoredUser();
  if (!user) throw new Error('Not authenticated. Please log in first.');
  await createSupportTicket(user, title, description, requestType, priority);
  return true;
});

// =========================================================
// Telemetry IPC
// =========================================================

ipcMain.handle('telemetry:log', async (_, eventName: string, payload: Record<string, any>) => {
  const crmUser = getStoredUser();
  logEvent({
    event_name: eventName,
    project_id: payload?.project_id,
    revision_id: payload?.revision_id,
    mode: payload?.mode,
    payload: {
      ...payload,
      crm_user_id: crmUser?.id ?? null
    }
  });
  return true;
});
