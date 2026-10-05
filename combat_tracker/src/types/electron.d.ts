import { Encounter } from './combat';

export interface ElectronAPI {
  saveEncounterFile: (content: string, defaultName?: string) => Promise<boolean>;
  loadEncounterFile: () => Promise<string | null>;
  createViewOnly: () => Promise<boolean>;
  sendState: (state: Encounter) => void;
  onStateUpdate: (callback: (state: Encounter) => void) => () => void;
  requestState: () => Promise<Encounter | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
