import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

// In dev the app runs from node_modules/electron's electron.exe, whose embedded
// icon is the Electron logo - the packaged icon (scripts/patch-icon.cjs) only
// touches the built exe. Point BrowserWindow at build/icon.ico so dev matches
// production. In a packaged app this resolves inside app.asar, where the icon
// isn't shipped, so leave it unset and let the exe icon apply.
const unpackedIcon = path.join(process.env.APP_ROOT, 'build', 'icon.ico');
const windowIcon = !app.isPackaged && existsSync(unpackedIcon) ? unpackedIcon : undefined;

let win: BrowserWindow | null = null;
const viewWindows: Set<BrowserWindow> = new Set();

// Holds the latest encounter state so new view windows can get it immediately
let latestState: unknown = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');

  win = new BrowserWindow({
    title: 'DM Tabletop Companion',
    width: 1200,
    height: 850,
    minWidth: 860,
    minHeight: 620,
    icon: windowIcon,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// ─── IPC: View-only window ────────────────────────────────────────────────────

ipcMain.handle('window:createViewOnly', async () => {
  const preloadPath = path.join(__dirname, 'preload.js');

  const viewWin = new BrowserWindow({
    title: 'Tracker – View Only',
    width: 420,
    height: 800,
    minWidth: 300,
    minHeight: 400,
    icon: windowIcon,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  viewWindows.add(viewWin);
  viewWin.on('closed', () => viewWindows.delete(viewWin));

  // Load the same index.html but with ?mode=view so React renders view-only UI
  if (VITE_DEV_SERVER_URL) {
    viewWin.loadURL(VITE_DEV_SERVER_URL + '?mode=view');
  } else {
    viewWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { mode: 'view' } });
  }

  return true;
});

// ─── IPC: State synchronisation ───────────────────────────────────────────────

// Main window sends updated state here
ipcMain.on('state:update', (_event, state: unknown) => {
  latestState = state;
  // Forward to every open view-only window
  for (const vw of viewWindows) {
    if (!vw.isDestroyed()) {
      vw.webContents.send('state:pushed', state);
    }
  }
});

// View-only windows request the latest state on mount
ipcMain.handle('state:request', async () => {
  return latestState;
});

// ─── IPC: File dialogs ────────────────────────────────────────────────────────

ipcMain.handle('dialog:saveFile', async (_event, content: string, defaultName = 'encounter.json') => {
  if (!win) return false;
  const result = await dialog.showSaveDialog(win, {
    title: 'Export Encounter Preset',
    defaultPath: defaultName,
    filters: [{ name: 'JSON File', extensions: ['json'] }],
  });

  if (!result.canceled && result.filePath) {
    try {
      await fs.writeFile(result.filePath, content, 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to save encounter file:', err);
      return false;
    }
  }
  return false;
});

ipcMain.handle('dialog:openFile', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: 'Import Encounter Preset',
    properties: ['openFile'],
    filters: [{ name: 'JSON File', extensions: ['json'] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const content = await fs.readFile(result.filePaths[0], 'utf-8');
      return content;
    } catch (err) {
      console.error('Failed to read encounter file:', err);
      return null;
    }
  }
  return null;
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
