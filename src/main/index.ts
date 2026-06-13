import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { initDatabase } from './db';
import { ensureAnonymousSupabaseSession } from './supabase';
import './ipc'; // Load IPC handlers

let mainWindow: BrowserWindow | null = null;

const isProd = !process.env.VITE_DEV_SERVER_URL;
const ICON_PATH = isProd
  ? path.join(process.resourcesPath, 'Logos', 'polynovea-content-studio.ico')
  : path.resolve(__dirname, '../../Logos/polynovea-content-studio.ico');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    backgroundColor: '#0A0A0A'
  });

  // Load app via Vite dev URL or local file based on environment
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize Database inside AppData
  initDatabase();

  // Bootstrap the anonymous app session in the background so the user never has
  // to manually connect infrastructure-level services from Settings.
  ensureAnonymousSupabaseSession().catch((error) => {
    console.error('[Supabase Bootstrap] Failed to create anonymous session:', error);
  });
  
  createWindow();

  // Silently check GitHub Releases for a newer build and install it on quit.
  // Skipped in dev since unpackaged builds have no update feed to compare against.
  if (isProd) {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('[AutoUpdater] Update check failed:', error);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
