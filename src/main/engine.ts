import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { app, BrowserWindow } from 'electron';
import { ensureAnonymousSupabaseSession } from './supabase';

// Helper to check if running in packaged production environment
const isProd = !process.env.VITE_DEV_SERVER_URL;

// Path to project root
const ROOT_PATH = path.resolve(__dirname, '../../');

// Local .env (gitignored) carries optional credentials such as
// AZURE_BLOB_CONNECTION_STRING; not bundled into packaged builds.
dotenv.config({ path: path.join(ROOT_PATH, '.env') });

// Resolve the Python interpreter executable path
export function getPythonExecutablePath(): string {
  if (isProd) {
    // Packaged path: resources/bin/python/python.exe on Windows
    const execName = process.platform === 'win32' ? 'python.exe' : 'python';
    return path.join(process.resourcesPath, 'bin', 'python', execName);
  }
  // Dev path: uses system python
  return process.platform === 'win32' ? 'python' : 'python3';
}

// Resolve the path to run_engine.py script
export function getEngineScriptPath(): string {
  if (isProd) {
    return path.join(process.resourcesPath, 'engine', 'run_engine.py');
  }
  return path.join(ROOT_PATH, 'engine', 'run_engine.py');
}

function scrubSecrets(input: string, apiKeys: Record<string, string>): string {
  let output = input;
  for (const val of Object.values(apiKeys)) {
    if (val && val.length > 5) {
      const escapedVal = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedVal, 'g');
      output = output.replace(regex, '[REDACTED]');
    }
  }
  return output;
}

interface RunEngineParams {
  action: 'plan' | 'generate' | 'export' | 'correct';
  mode: string;
  projectDir: string;
  revisionId: string;
  inputDirection: string;
  inputContext?: string;
  planContent?: string;
  htmlRules?: string;
  languageOverrides?: any;
  styleOverrides?: any;
  exportPdf?: boolean;
  slideNumber?: number;
  correctionInstruction?: string;
}

export function runPythonEngine(
  params: RunEngineParams,
  window: BrowserWindow
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExecutablePath();
    const scriptPath = getEngineScriptPath();
    
    const revisionDir = PathResolve(params.projectDir);
    if (!fs.existsSync(revisionDir)) {
      fs.mkdirSync(revisionDir, { recursive: true });
    }
    
    // Setup log directories
    const logsDir = path.join(revisionDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const stdoutLogPath = path.join(logsDir, 'stdout.jsonl');
    const stderrLogPath = path.join(logsDir, 'stderr.log');
    
    const stdoutWriteStream = fs.createWriteStream(stdoutLogPath, { flags: 'a' });
    const stderrWriteStream = fs.createWriteStream(stderrLogPath, { flags: 'a' });

    const blobConnectionString = process.env.AZURE_BLOB_CONNECTION_STRING || '';
    const apiKeys: Record<string, string> = {};
    
    const paramsJsonContent = {
      input_direction: params.inputDirection,
      input_context: params.inputContext || '',
      plan_content: params.planContent || '',
      html_rules: params.htmlRules || '',
      pdf_name: `Polynovea_${params.mode}_post.pdf`,
      language_overrides: params.languageOverrides || {},
      style_overrides: params.styleOverrides || {},
      export_pdf: params.exportPdf !== false,
      slide_number: params.slideNumber,
      correction_instruction: params.correctionInstruction || ''
    };

    
    const paramsFilePath = path.join(revisionDir, 'params.json');
    fs.writeFileSync(paramsFilePath, JSON.stringify(paramsJsonContent, null, 2), 'utf-8');

    // CLI Spawn Arguments
    const spawnArgs = [
      scriptPath,
      '--action', params.action,
      '--mode', params.mode,
      '--project-dir', revisionDir,
      '--revision-id', params.revisionId,
      '--params-file', paramsFilePath
    ];
    
    console.log(`[EngineRunner] Spawning: ${pythonExe} ${spawnArgs.join(' ')}`);

    ensureAnonymousSupabaseSession()
      .then(({ config, session }) => {
        // Scrub connection string from any logged output
        if (blobConnectionString) apiKeys['AZURE_BLOB'] = blobConnectionString;

        const child = spawn(pythonExe, spawnArgs, {
          env: {
            ...process.env,
            PLAYWRIGHT_BROWSERS_PATH: path.join(appDataPath(), 'playwright-browsers'),
            SUPABASE_URL: config.url,
            SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
            SUPABASE_ACCESS_TOKEN: session.access_token,
            ...(blobConnectionString ? { AZURE_BLOB_CONNECTION_STRING: blobConnectionString } : {})
          }
        });

        let buffer = '';

        child.stdout.on('data', (data) => {
          const dataStr = scrubSecrets(data.toString(), apiKeys);
          stdoutWriteStream.write(dataStr);

          buffer += dataStr;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const payload = JSON.parse(line);
              window.webContents.send('engine-progress', {
                revisionId: params.revisionId,
                action: params.action,
                ...payload
              });
            } catch {
              console.warn('[EngineRunner Stdout Raw]:', line);
            }
          }
        });

        child.stderr.on('data', (data) => {
          const errorStr = scrubSecrets(data.toString(), apiKeys);
          stderrWriteStream.write(errorStr);
          console.error('[EngineRunner Stderr]:', errorStr);
        });

        child.on('close', (code) => {
          stdoutWriteStream.end();
          stderrWriteStream.end();

          if (code === 0) {
            console.log('[EngineRunner] Spawn closed with code 0.');
            resolve();
          } else {
            console.error(`[EngineRunner] Spawn closed with error code ${code}`);
            const lastErrors = fs.existsSync(stderrLogPath)
              ? fs.readFileSync(stderrLogPath, 'utf-8').trim().split('\n').slice(-5).join('\n')
              : '';
            const scrubbedErrors = scrubSecrets(lastErrors, apiKeys);
            reject(
              new Error(`Sidecar process failed (Exit code: ${code}). Stderr:\n${scrubbedErrors}`)
            );
          }
        });

        child.on('error', (err) => {
          stdoutWriteStream.end();
          stderrWriteStream.end();
          reject(err);
        });
      })
      .catch((error) => {
        stdoutWriteStream.end();
        stderrWriteStream.end();
        reject(error);
      });
  });
}

// Helper to resolve absolute or OS paths safely
function PathResolve(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(ROOT_PATH, p);
}

// Helper to retrieve app standard AppData folder path
function appDataPath(): string {
  try {
    return app.getPath('userData');
  } catch (e) {
    // Fallback if app module is not ready yet
    return path.join(process.env.APPDATA || '', 'PolyNovea Content');
  }
}
