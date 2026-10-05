import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveEncounterFile: (content: string, defaultName?: string): Promise<boolean> => {
    return ipcRenderer.invoke('dialog:saveFile', content, defaultName);
  },
  loadEncounterFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:openFile');
  },
  createViewOnly: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:createViewOnly');
  },
  // Called by the main window to broadcast current state to all view-only windows
  sendState: (state: unknown): void => {
    ipcRenderer.send('state:update', state);
  },
  // Called by view-only windows to receive state updates pushed from main
  onStateUpdate: (callback: (state: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on('state:pushed', handler);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('state:pushed', handler);
  },
  // Called by a newly opened view-only window to request the latest state immediately
  requestState: (): Promise<unknown> => {
    return ipcRenderer.invoke('state:request');
  },
});
