import os from 'os';
import path from 'path';
import { BrowserWindow } from 'electron';
import { ZodError } from 'zod';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { reelScriptSchema, type ReelScript } from '../shared/reelSchema';

const isProd = !process.env.VITE_DEV_SERVER_URL;
const ROOT_PATH = path.resolve(__dirname, '../../');

export interface RenderReelParams {
  reelScript: ReelScript;
  outputPath: string;
  revisionId: string;
}

function getMotionBundlePath(): string {
  if (isProd) {
    return path.join(process.resourcesPath, 'motion-bundle');
  }
  return path.join(ROOT_PATH, 'dist', 'motion-bundle');
}

// In production, @remotion/renderer resolves its compositor/ffmpeg binaries via
// require('@remotion/compositor-<platform>').dir, which reports a path inside
// app.asar. That path can't be spawned as a process (it doesn't exist on disk —
// only app.asar.unpacked does), so we point Remotion at the unpacked location
// explicitly. Not needed in dev, where the package resolves from node_modules directly.
function getBinariesDirectory(): string | undefined {
  if (!isProd) {
    return undefined;
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(`Unsupported platform for packaged reel rendering: ${process.platform} ${process.arch}`);
  }
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@remotion', 'compositor-win32-x64-msvc');
}

export async function renderReel(params: RenderReelParams, window: BrowserWindow): Promise<void> {
  let reelScript: ReelScript;
  try {
    reelScript = reelScriptSchema.parse(params.reelScript);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
      throw new Error(`Reel script failed validation: ${issues}`);
    }
    throw error;
  }

  const serveUrl = getMotionBundlePath();
  const binariesDirectory = getBinariesDirectory();

  await ensureBrowser();

  const composition = await selectComposition({
    serveUrl,
    id: 'SceneRenderer',
    inputProps: { reelScript },
    binariesDirectory,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: params.outputPath,
    inputProps: { reelScript },
    binariesDirectory,
    concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
    onProgress: ({ progress }) => {
      window.webContents.send('motion-progress', {
        revisionId: params.revisionId,
        status: 'rendering',
        progress,
      });
    },
  });

  window.webContents.send('motion-progress', {
    revisionId: params.revisionId,
    status: 'completed',
    progress: 1,
  });
}
