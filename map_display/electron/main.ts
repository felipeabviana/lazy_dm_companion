import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as library from './library.js';
import type { LibrarySettings, MapPan } from '../src/types/map';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─ dist
// │  └─ index.html
// └─ dist-electron
//    ├─ main.js
//    └─ preload.js
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

// Holds the latest map state so new view windows can get it immediately
let latestState: unknown = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');

  win = new BrowserWindow({
    title: 'Map Display',
    width: 1200,
    height: 850,
    minWidth: 860,
    icon: windowIcon,
    minHeight: 620,
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
  const preloadPath = path.join(__dirname, 'preload.cjs');

  const viewWin = new BrowserWindow({
    title: 'Map — Player View',
    width: 1024,
    height: 768,
    minWidth: 480,
    icon: windowIcon,
    minHeight: 360,
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

  // Notify the player view when full screen state changes (button or F11)
  const pushFullScreen = () => {
    if (!viewWin.isDestroyed()) {
      viewWin.webContents.send('window:fullScreenChanged', viewWin.isFullScreen());
    }
  };
  viewWin.on('enter-full-screen', pushFullScreen);
  viewWin.on('leave-full-screen', pushFullScreen);

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

// ─── IPC: Fog of war ──────────────────────────────────────────────────────────

// Latest fog snapshot (data URL of the main window's fog canvas)
let latestFog: string | null = null;

// Main window painted a brush segment — forward to every view-only window
ipcMain.on('fog:stroke', (_event, mode: 'add' | 'remove', x0: number, y0: number, x1: number, y1: number, radius: number) => {
  for (const vw of viewWindows) {
    if (!vw.isDestroyed()) {
      vw.webContents.send('fog:stroke', mode, x0, y0, x1, y1, radius);
    }
  }
});

// Main window loaded a new image — fog is fully reset
ipcMain.on('fog:reset', () => {
  latestFog = null;
  for (const vw of viewWindows) {
    if (!vw.isDestroyed()) {
      vw.webContents.send('fog:reset');
    }
  }
});

// Main window sent a full fog snapshot — store and forward it
ipcMain.on('fog:sync', (_event, dataUrl: string) => {
  latestFog = dataUrl;
  for (const vw of viewWindows) {
    if (!vw.isDestroyed()) {
      vw.webContents.send('fog:sync', dataUrl);
    }
  }
});

// View-only windows request the latest fog snapshot on mount
ipcMain.handle('fog:request', async () => {
  return latestFog;
});

// ─── IPC: Viewport (player view frame) ────────────────────────────────────────

// Player window reports its viewport size — forward it to the main window
ipcMain.on('viewport:size', (_event, width: number, height: number) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('viewport:pushed', width, height);
  }
});

// Main window sets the player view pan — forward to every view-only window
ipcMain.on('viewport:pan', (_event, x: number, y: number) => {
  for (const vw of viewWindows) {
    if (!vw.isDestroyed()) {
      vw.webContents.send('viewport:pan', x, y);
    }
  }
});

// ─── IPC: Full screen ─────────────────────────────────────────────────────────

// Toggle full screen on the window that made the request (same behaviour as F11)
ipcMain.handle('window:toggleFullScreen', async (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || target.isDestroyed()) return false;
  target.setFullScreen(!target.isFullScreen());
  return target.isFullScreen();
});

// Report full screen changes so the UI stays in sync (e.g. when F11 is used)
ipcMain.handle('window:isFullScreen', async (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  return target ? target.isFullScreen() : false;
});

// ─── IPC: File dialogs ────────────────────────────────────────────────────────

// Import copies the file into the on-disk library AND returns the data URL, so
// adding a map is a single round trip.
ipcMain.handle('dialog:openImage', async () => {
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Map Image',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  try {
    const added: NonNullable<Awaited<ReturnType<typeof library.addImage>>>[] = [];
    for (const filePath of result.filePaths) {
      const entry = await library.addImage(filePath);
      if (entry) added.push(entry);
    }
    if (added.length === 0) return null;
    // Multiple files selected: return the first, the rest land in the library
    return added[0];
  } catch (err) {
    console.error('Failed to import image:', err);
    return null;
  }
});

// ─── IPC: Map library (on-disk) ───────────────────────────────────────────────

ipcMain.handle('library:load', async () => library.loadSnapshot());

ipcMain.handle('library:loadImage', async (_e, id: string) => library.loadImageDataUrl(id));

ipcMain.handle('library:loadThumb', async (_e, id: string) => library.loadThumbDataUrl(id));

ipcMain.handle('library:loadFog', async (_e, id: string) => library.loadFogDataUrl(id));

ipcMain.handle('library:saveFog', async (_e, id: string, dataUrl: string) => library.saveFog(id, dataUrl));

ipcMain.handle('library:saveViewState', async (_e, id: string, zoom: number, pan: MapPan) =>
  library.saveMapViewState(id, zoom, pan),
);

ipcMain.handle('library:rename', async (_e, id: string, name: string) => library.renameMap(id, name));

ipcMain.handle('library:remove', async (_e, id: string) => library.deleteMap(id));

ipcMain.handle('library:saveSettings', async (_e, patch: Partial<LibrarySettings>) =>
  library.saveSettings(patch),
);

ipcMain.handle('library:revealFolder', async () => {
  try {
    await fs.mkdir(path.join(app.getPath('userData'), 'library'), { recursive: true });
    shell.openPath(path.join(app.getPath('userData'), 'library'));
    return true;
  } catch (err) {
    console.error('Failed to reveal library folder:', err);
    return false;
  }
});

// ─── App lifecycle ─────────────────────────────────────────────────────────────

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
