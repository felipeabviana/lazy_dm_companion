import { contextBridge, ipcRenderer } from 'electron';
import type {
  AddImageResult,
  LibrarySettings,
  LibrarySnapshot,
  MapPan,
  MapState,
} from '../src/types/map';

contextBridge.exposeInMainWorld('electronAPI', {
  // Opens the file dialog, copies the chosen image(s) into the on-disk library,
  // and returns the first import (with data URL + thumbnail). Additional files
  // selected at the same time are added to the library but not returned.
  openImage: (): Promise<AddImageResult | null> => {
    return ipcRenderer.invoke('dialog:openImage');
  },
  createViewOnly: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:createViewOnly');
  },
  // Called by the main window to broadcast current state to all view-only windows
  sendState: (state: MapState): void => {
    ipcRenderer.send('state:update', state);
  },
  // Called by view-only windows to receive state updates pushed from main
  onStateUpdate: (callback: (state: MapState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: MapState) => callback(state);
    ipcRenderer.on('state:pushed', handler);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('state:pushed', handler);
  },
  // Called by a newly opened view-only window to request the latest state immediately
  requestState: (): Promise<MapState | null> => {
    return ipcRenderer.invoke('state:request');
  },

  // ─── Fog of war ────────────────────────────────────────────────────────────

  // Main window → view windows: a brush segment was painted (coordinates in
  // image natural pixels); mode is 'add' (paint fog back) or 'remove' (erase fog)
  sendFogStroke: (mode: 'add' | 'remove', x0: number, y0: number, x1: number, y1: number, radius: number): void => {
    ipcRenderer.send('fog:stroke', mode, x0, y0, x1, y1, radius);
  },
  // Main window → view windows: a new image was loaded, fog is fully reset
  sendFogReset: (): void => {
    ipcRenderer.send('fog:reset');
  },
  // Main window → view windows: full fog snapshot (data URL of the fog canvas)
  sendFogSync: (dataUrl: string): void => {
    ipcRenderer.send('fog:sync', dataUrl);
  },
  // View windows subscribe to fog updates pushed from the main window
  onFogStroke: (callback: (mode: 'add' | 'remove', x0: number, y0: number, x1: number, y1: number, radius: number) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, mode: 'add' | 'remove', x0: number, y0: number, x1: number, y1: number, radius: number) =>
      callback(mode, x0, y0, x1, y1, radius);
    ipcRenderer.on('fog:stroke', handler);
    return () => ipcRenderer.removeListener('fog:stroke', handler);
  },
  onFogReset: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('fog:reset', handler);
    return () => ipcRenderer.removeListener('fog:reset', handler);
  },
  onFogSync: (callback: (dataUrl: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, dataUrl: string) => callback(dataUrl);
    ipcRenderer.on('fog:sync', handler);
    return () => ipcRenderer.removeListener('fog:sync', handler);
  },
  // View window requests the current fog snapshot on mount
  requestFog: (): Promise<string | null> => {
    return ipcRenderer.invoke('fog:request');
  },

  // ─── Viewport (player view frame) ──────────────────────────────────────────

  // Player window → main window: reports its viewport size (on mount/resize)
  sendViewportSize: (width: number, height: number): void => {
    ipcRenderer.send('viewport:size', width, height);
  },
  // Main window subscribes to viewport size reports from the player window
  onViewportSize: (callback: (width: number, height: number) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, width: number, height: number) => callback(width, height);
    ipcRenderer.on('viewport:pushed', handler);
    return () => ipcRenderer.removeListener('viewport:pushed', handler);
  },
  // Main window → player window: sets the panned view offset (image coords)
  sendViewportPan: (x: number, y: number): void => {
    ipcRenderer.send('viewport:pan', x, y);
  },
  // Player window subscribes to pan updates from the main window
  onViewportPan: (callback: (x: number, y: number) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, x: number, y: number) => callback(x, y);
    ipcRenderer.on('viewport:pan', handler);
    return () => ipcRenderer.removeListener('viewport:pan', handler);
  },

  // ─── Map library (on disk, under userData) ──────────────────────────────────

  loadLibrary: (): Promise<LibrarySnapshot> => {
    return ipcRenderer.invoke('library:load');
  },
  loadLibraryImage: (id: string): Promise<string | null> => {
    return ipcRenderer.invoke('library:loadImage', id);
  },
  loadLibraryThumb: (id: string): Promise<string | null> => {
    return ipcRenderer.invoke('library:loadThumb', id);
  },
  loadLibraryFog: (id: string): Promise<string | null> => {
    return ipcRenderer.invoke('library:loadFog', id);
  },
  saveLibraryFog: (id: string, dataUrl: string): Promise<boolean> => {
    return ipcRenderer.invoke('library:saveFog', id, dataUrl);
  },
  saveLibraryViewState: (id: string, zoom: number, pan: MapPan): Promise<boolean> => {
    return ipcRenderer.invoke('library:saveViewState', id, zoom, pan);
  },
  renameLibraryMap: (id: string, name: string): Promise<boolean> => {
    return ipcRenderer.invoke('library:rename', id, name);
  },
  removeLibraryMap: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('library:remove', id);
  },
  saveLibrarySettings: (patch: Partial<LibrarySettings>): Promise<boolean> => {
    return ipcRenderer.invoke('library:saveSettings', patch);
  },
  revealLibraryFolder: (): Promise<boolean> => {
    return ipcRenderer.invoke('library:revealFolder');
  },

  // ─── Full screen ───────────────────────────────────────────────────────────

  // Toggle full screen on this window (same behaviour as F11)
  toggleFullScreen: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:toggleFullScreen');
  },
  isFullScreen: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:isFullScreen');
  },
  // Fires when full screen changes (button click or F11)
  onFullScreenChanged: (callback: (isFullScreen: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, isFullScreen: boolean) => callback(isFullScreen);
    ipcRenderer.on('window:fullScreenChanged', handler);
    return () => ipcRenderer.removeListener('window:fullScreenChanged', handler);
  },
});
