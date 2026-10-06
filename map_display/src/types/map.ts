export interface MapState {
  /** Data URL of the selected image, or null when no image is loaded */
  imageUrl: string | null;
  /** Zoom factor applied to the image (1 = 100%) */
  zoom: number;
}

/**
 * Pan offset of the top-left corner of the player viewport, in image-natural
 * coordinates. Persisted per map so reopening restores the framed area.
 */
export interface MapPan {
  x: number;
  y: number;
}

/**
 * Library entry metadata. The heavy payloads (image bytes, fog PNG) live on disk
 * under the Electron userData directory - deliberately NOT in localStorage,
 * because base64 images plus a full-resolution fog mask blow past the ~5 MB
 * per-origin quota after only a couple of maps.
 */
export interface MapEntryMeta {
  id: string;
  name: string;
  /** Image natural dimensions in pixels */
  width: number;
  height: number;
  /** Persisted zoom factor */
  zoom: number;
  /** Persisted player-viewport pan offset in image coordinates */
  pan: MapPan;
  /** Whether a fog mask has been saved for this map */
  hasFog: boolean;
  /** Epoch ms when the map was added to the library */
  addedAt: number;
}

/** App-level settings that are not per-map. */
export interface LibrarySettings {
  /** Map currently loaded in the main window, or null when none */
  currentMapId: string | null;
  /** Diagonal of the player's physical screen ('' = no frame/grid) */
  playerViewDiagonal: string;
  /** Grid cell size in the same unit as the diagonal */
  gridSize: string;
}

/** The library plus settings, as returned on startup. */
export interface LibrarySnapshot {
  maps: MapEntryMeta[];
  settings: LibrarySettings;
}

/** Result of adding an image from the file dialog. */
export interface AddImageResult {
  entry: MapEntryMeta;
  /** Full image as a data URL, ready to display */
  dataUrl: string;
  /** Small preview for the left panel */
  thumbDataUrl: string;
}
