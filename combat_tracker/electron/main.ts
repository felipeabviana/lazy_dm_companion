import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, renameSync, cpSync, readdirSync } from 'node:fs';
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

// ─── One-time userData migration ──────────────────────────────────────────────
//
// The package was renamed from "dm-tabletop-companion" to "combat-tracker", and
// Electron derives the userData directory from that name. Left alone, every
// saved encounter, preset and theme preference would be stranded in the old
// folder. Move the profile across on first run instead.
//
// The interesting part is localStorage, which Chromium stores as a LevelDB
// directory ("Local Storage"); the rest are disposable caches.

const LEGACY_USER_DATA = path.join(app.getPath('appData'), 'dm-tabletop-companion');

function migrateLegacyUserData(): void {
  const target = app.getPath('userData');
  // Nothing to do if the name never changed, or the old profile is gone
  if (target === LEGACY_USER_DATA) return;
  if (!existsSync(LEGACY_USER_DATA)) return;
  // A non-empty target means this already ran (or the user has a fresh profile);
  // overwriting real data here would be destructive
  try {
    if (existsSync(target) && readdirSync(target).length > 0) return;

    if (!existsSync(target)) {
      // No target yet: move the whole profile, which is instant and exact
      mkdirSync(path.dirname(target), { recursive: true });
      renameSync(LEGACY_USER_DATA, target);
      console.log(`Migrated user data: ${LEGACY_USER_DATA} -> ${target}`);
      return;
    }

    // Target exists but is empty: copy only what holds user data
    for (const entry of readdirSync(LEGACY_USER_DATA)) {
      // Caches are rebuilt on demand and would only waste space
      if (['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Network'].includes(entry)) {
        continue;
      }
      cpSync(path.join(LEGACY_USER_DATA, entry), path.join(target, entry), { recursive: true });
    }
    console.log(`Copied user data: ${LEGACY_USER_DATA} -> ${target}`);
  } catch (err) {
    // Never block startup on a migration problem; the app just starts empty
    console.error('userData migration failed:', err);
  }
}

migrateLegacyUserData();

let win: BrowserWindow | null = null;
const viewWindows: Set<BrowserWindow> = new Set();

// Holds the latest encounter state so new view windows can get it immediately
let latestState: unknown = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');

  win = new BrowserWindow({
    title: 'Combat Tracker',
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
    title: 'Combat Tracker – Player View',
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

  // The player window is a read-only display: drop the menu entirely so no
  // File/Edit bar can appear (autoHideMenuBar alone still reveals it on Alt).
  viewWin.setMenu(null);

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
