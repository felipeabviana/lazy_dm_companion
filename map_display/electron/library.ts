import { app, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type {
  AddImageResult,
  LibrarySettings,
  LibrarySnapshot,
  MapEntryMeta,
  MapPan,
} from '../src/types/map';

// ─── On-disk map library ──────────────────────────────────────────────────────
//
// Everything lives under the Electron userData directory:
//
//   <userData>/library/index.json       settings + per-map metadata (small JSON)
//   <userData>/library/<id>/image.png   original image bytes
//   <userData>/library/<id>/thumb.png   small panel preview
//   <userData>/library/<id>/fog.png     saved fog mask (optional)
//
// Only the small JSON crosses the IPC boundary; images are pulled on demand as
// data URLs. Storing the bytes on disk rather than in localStorage is what lets
// this survive restarts without hitting the ~5 MB per-origin quota.

const LIBRARY_DIR = () => path.join(app.getPath('userData'), 'library');
const INDEX_FILE = () => path.join(LIBRARY_DIR(), 'index.json');
const mapDir = (id: string) => path.join(LIBRARY_DIR(), id);

// Only allow ids we generated, so a corrupt index can't escape the library dir
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Image extensions we accept, probed from magic bytes rather than trusting the
// filename
const EXTENSIONS = ['png', 'jpg', 'gif', 'webp', 'bmp'] as const;

/** Derive the extension from the file's magic bytes. */
function detectExt(bytes: Buffer): 'png' | 'jpg' | 'gif' | 'webp' | 'bmp' | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (bytes.length > 6 && bytes.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'gif';
  }
  if (
    bytes.length > 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  if (bytes.length > 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'bmp';
  }
  return null;
}

const mimeFor = (ext: string) => (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
const toDataUrl = (bytes: Buffer, ext: string) => `data:${mimeFor(ext)};base64,${bytes.toString('base64')}`;

// ─── Index read/write ─────────────────────────────────────────────────────────

interface IndexShape {
  settings: LibrarySettings;
  maps: MapEntryMeta[];
}

async function readIndex(): Promise<IndexShape> {
  try {
    const raw = await fs.readFile(INDEX_FILE(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<IndexShape>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      // Drop entries with a malformed id so a bad file can't escape the dir
      maps: (parsed.maps ?? []).filter((m) => m && typeof m.id === 'string' && SAFE_ID.test(m.id)),
    };
  } catch {
    // Missing or unreadable index - start fresh rather than crash the app
    return { settings: { ...DEFAULT_SETTINGS }, maps: [] };
  }
}

async function writeIndex(index: IndexShape): Promise<void> {
  await fs.mkdir(LIBRARY_DIR(), { recursive: true });
  // Write to a temp file then rename, so an interrupted write can't truncate it
  const tmp = `${INDEX_FILE()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf8');
  await fs.rename(tmp, INDEX_FILE());
}

const DEFAULT_SETTINGS: LibrarySettings = {
  currentMapId: null,
  playerViewDiagonal: '',
  gridSize: '1',
};

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadSnapshot(): Promise<LibrarySnapshot> {
  const { settings, maps } = await readIndex();
  // Newest first, matching the panel order
  maps.sort((a, b) => b.addedAt - a.addedAt);
  return { maps, settings };
}

/** Build a small PNG preview so the panel never decodes full-size maps. */
function makeThumb(bytes: Buffer, ext: string): string {
  try {
    const img = nativeImage.createFromBuffer(bytes);
    if (img.isEmpty()) return '';
    const { width } = img.getSize();
    const targetW = Math.min(240, width);
    const thumb = targetW < width ? img.resize({ width: targetW, quality: 'good' }) : img;
    return thumb.toPNG().toString('base64');
  } catch {
    void ext;
    // A preview is a nicety - never fail an import over it
    return '';
  }
}

export async function addImage(sourcePath: string): Promise<AddImageResult | null> {
  const bytes = await fs.readFile(sourcePath);
  const ext = detectExt(bytes);
  if (!ext) return null;

  const probe = nativeImage.createFromBuffer(bytes);
  const size = probe.isEmpty() ? { width: 0, height: 0 } : probe.getSize();

  const id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = mapDir(id);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(path.join(dir, `image.${ext}`), bytes);

  const thumbBase64 = makeThumb(bytes, ext);
  if (thumbBase64) {
    await fs.writeFile(path.join(dir, 'thumb.png'), Buffer.from(thumbBase64, 'base64'));
  }

  const index = await readIndex();
  const entry: MapEntryMeta = {
    id,
    name: path.basename(sourcePath).replace(/\.[^.]+$/, ''),
    width: size.width,
    height: size.height,
    zoom: 1,
    pan: { x: 0, y: 0 },
    hasFog: false,
    addedAt: Date.now(),
  };
  index.maps.push(entry);
  index.settings = { ...index.settings, currentMapId: id };
  await writeIndex(index);

  return {
    entry,
    dataUrl: toDataUrl(bytes, ext),
    thumbDataUrl: thumbBase64 ? `data:image/png;base64,${thumbBase64}` : '',
  };
}

/** Read one of a map's assets, trying each known extension. */
async function findAsset(id: string, base: string): Promise<{ bytes: Buffer; ext: string } | null> {
  if (!SAFE_ID.test(id)) return null;
  for (const ext of EXTENSIONS) {
    try {
      return { bytes: await fs.readFile(path.join(mapDir(id), `${base}.${ext}`)), ext };
    } catch {
      // not this extension - try the next
    }
  }
  return null;
}

export async function loadImageDataUrl(id: string): Promise<string | null> {
  const found = await findAsset(id, 'image');
  return found ? toDataUrl(found.bytes, found.ext) : null;
}

export async function loadThumbDataUrl(id: string): Promise<string | null> {
  const found = await findAsset(id, 'thumb');
  return found ? toDataUrl(found.bytes, 'png') : null;
}

/**
 * Fog masks round-trip perfectly as PNG: the canvas holds a *binary* mask
 * (opaque where fog exists, transparent where revealed), and PNG is lossless.
 */
export async function loadFogDataUrl(id: string): Promise<string | null> {
  const found = await findAsset(id, 'fog');
  return found ? toDataUrl(found.bytes, 'png') : null;
}

export async function saveFog(id: string, dataUrl: string): Promise<boolean> {
  if (!SAFE_ID.test(id)) return false;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return false;
  try {
    await fs.mkdir(mapDir(id), { recursive: true });
    await fs.writeFile(path.join(mapDir(id), 'fog.png'), Buffer.from(dataUrl.slice(comma + 1), 'base64'));
    const index = await readIndex();
    const map = index.maps.find((m) => m.id === id);
    if (map && !map.hasFog) {
      map.hasFog = true;
      await writeIndex(index);
    }
    return true;
  } catch (err) {
    console.error('Failed to save fog mask:', err);
    return false;
  }
}

export async function saveMapViewState(id: string, zoom: number, pan: MapPan): Promise<boolean> {
  if (!SAFE_ID.test(id)) return false;
  const index = await readIndex();
  const map = index.maps.find((m) => m.id === id);
  if (!map) return false;
  map.zoom = zoom;
  map.pan = { x: pan.x, y: pan.y };
  await writeIndex(index);
  return true;
}

export async function renameMap(id: string, name: string): Promise<boolean> {
  if (!SAFE_ID.test(id)) return false;
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return false;
  const index = await readIndex();
  const map = index.maps.find((m) => m.id === id);
  if (!map) return false;
  map.name = trimmed;
  await writeIndex(index);
  return true;
}

/** Drop a map's metadata and its folder from disk. */
export async function deleteMap(id: string): Promise<boolean> {
  if (!SAFE_ID.test(id)) return false;
  const index = await readIndex();
  const before = index.maps.length;
  index.maps = index.maps.filter((m) => m.id !== id);
  if (index.maps.length === before) return false;
  if (index.settings.currentMapId === id) index.settings.currentMapId = null;
  await writeIndex(index);
  await fs.rm(mapDir(id), { recursive: true, force: true });
  return true;
}

export async function saveSettings(patch: Partial<LibrarySettings>): Promise<boolean> {
  const index = await readIndex();
  index.settings = { ...index.settings, ...patch };
  await writeIndex(index);
  return true;
}
