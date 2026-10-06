import {
  AddImageResult,
  LibrarySettings,
  LibrarySnapshot,
  MapPan,
  MapState,
} from './map';

export type BrushMode = 'add' | 'remove';

export interface ElectronAPI {
  openImage: () => Promise<AddImageResult | null>;
  createViewOnly: () => Promise<boolean>;
  sendState: (state: MapState) => void;
  onStateUpdate: (callback: (state: MapState) => void) => () => void;
  requestState: () => Promise<MapState | null>;

  // Fog of war
  sendFogStroke: (mode: BrushMode, x0: number, y0: number, x1: number, y1: number, radius: number) => void;
  sendFogReset: () => void;
  sendFogSync: (dataUrl: string) => void;
  onFogStroke: (callback: (mode: BrushMode, x0: number, y0: number, x1: number, y1: number, radius: number) => void) => () => void;
  onFogReset: (callback: () => void) => () => void;
  onFogSync: (callback: (dataUrl: string) => void) => () => void;
  requestFog: () => Promise<string | null>;

  // Viewport (player view frame)
  sendViewportSize: (width: number, height: number) => void;
  onViewportSize: (callback: (width: number, height: number) => void) => () => void;
  sendViewportPan: (x: number, y: number) => void;
  onViewportPan: (callback: (x: number, y: number) => void) => () => void;

  // Full screen
  toggleFullScreen: () => Promise<boolean>;
  isFullScreen: () => Promise<boolean>;
  onFullScreenChanged: (callback: (isFullScreen: boolean) => void) => () => void;

  // ─── Map library (persisted to disk under userData) ─────────────────────────
  loadLibrary: () => Promise<LibrarySnapshot>;
  loadLibraryImage: (id: string) => Promise<string | null>;
  loadLibraryThumb: (id: string) => Promise<string | null>;
  loadLibraryFog: (id: string) => Promise<string | null>;
  saveLibraryFog: (id: string, dataUrl: string) => Promise<boolean>;
  saveLibraryViewState: (id: string, zoom: number, pan: MapPan) => Promise<boolean>;
  renameLibraryMap: (id: string, name: string) => Promise<boolean>;
  removeLibraryMap: (id: string) => Promise<boolean>;
  saveLibrarySettings: (patch: Partial<LibrarySettings>) => Promise<boolean>;
  revealLibraryFolder: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
