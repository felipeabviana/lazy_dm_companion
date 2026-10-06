// Round-trip test for the map library: add images, save fog + view state,
// then reload from disk in a fresh read to prove persistence works.
//
// Run with: npx electron scripts/test-library.mjs
import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

app.whenReady().then(async () => {
  // Point userData at a scratch dir so the real library is untouched.
  // The library reads app.getPath('userData') lazily inside each function, so
  // setting it here (before any call) is enough.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'maplib-test-'));
  app.setPath('userData', tmp);
  console.log(`scratch userData: ${tmp}\n`);

  // library.test.mjs is library.ts bundled by esbuild (built just before this
  // script runs), so it can be imported directly for testing.
  const lib = await import('../dist-electron/library.test.mjs').catch((err) => {
    console.error('could not load library module:', err.message);
    app.exit(1);
  });

  const fixtures = path.join(tmp, 'fixtures');
  await fs.mkdir(fixtures, { recursive: true });

  // Build two small PNGs
  const { createCanvas } = { createCanvas: null };
  void createCanvas;
  const mkPng = async (name, r, g, b) => {
    // Minimal valid PNG via nativeImage round-trip
    const { nativeImage } = await import('electron');
    const raw = Buffer.alloc(4 * 64 * 64);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
    const img = nativeImage.createFromBitmap(raw, { width: 64, height: 64 });
    const p = path.join(fixtures, name);
    await fs.writeFile(p, img.toPNG());
    return p;
  };

  const fileA = await mkPng('alpha.png', 40, 80, 160);
  const fileB = await mkPng('beta.png', 30, 110, 60);

  // ── Add ────────────────────────────────────────────────────────────────────
  const a = await lib.addImage(fileA);
  check('addImage A returns entry', !!a, a ? `id=${a.entry.id}` : 'null');
  check('A gets dimensions', a?.entry.width === 64 && a?.entry.height === 64, `${a?.entry.width}x${a?.entry.height}`);
  check('A name derived from filename', a?.entry.name === 'alpha', a?.entry.name);
  check('A has data URL', !!a?.dataUrl?.startsWith('data:image/png;base64,'));
  check('A has thumbnail', !!a?.thumbDataUrl?.startsWith('data:image/png;base64,'));
  check('A defaults zoom=1', a?.entry.zoom === 1);
  check('A defaults hasFog=false', a?.entry.hasFog === false);

  const b = await lib.addImage(fileB);
  check('addImage B returns entry', !!b, b ? `id=${b.entry.id}` : 'null');
  check('ids are unique', a.entry.id !== b.entry.id);

  // ── Reject non-images ──────────────────────────────────────────────────────
  const bad = path.join(fixtures, 'notanimage.txt');
  await fs.writeFile(bad, 'definitely not an image');
  const badResult = await lib.addImage(bad);
  check('rejects non-image file', badResult === null);

  // ── Snapshot ordering (newest first) ───────────────────────────────────────
  const snap = await lib.loadSnapshot();
  check('snapshot has both maps', snap.maps.length === 2, `got ${snap.maps.length}`);
  check('snapshot newest-first', snap.maps[0].id === b.entry.id);
  check('settings.currentMapId = last added', snap.settings.currentMapId === b.entry.id);

  // ── Fog round-trip ─────────────────────────────────────────────────────────
  // Build a fake "fog" PNG: opaque left half, transparent right half
  const { nativeImage } = await import('electron');
  const fogBuf = Buffer.alloc(4 * 64 * 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const opaque = x < 32;
      fogBuf[i] = 9; fogBuf[i + 1] = 9; fogBuf[i + 2] = 11;
      fogBuf[i + 3] = opaque ? 255 : 0;
    }
  }
  const fogUrl = `data:image/png;base64,${nativeImage.createFromBitmap(fogBuf, { width: 64, height: 64 }).toPNG().toString('base64')}`;
  const saved = await lib.saveFog(a.entry.id, fogUrl);
  check('saveFog succeeds', saved === true);

  const fogBack = await lib.loadFogDataUrl(a.entry.id);
  check('loadFog returns a data URL', !!fogBack?.startsWith('data:image/png;base64,'));

  // Verify the mask's alpha channel survived (binary mask: opaque/empty)
  const fogImg = nativeImage.createFromBuffer(Buffer.from(fogBack.split(',')[1], 'base64'));
  const decoded = fogImg.toBitmap();
  let opaqueLeft = 0, transparentRight = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const alpha = decoded[(y * 64 + x) * 4 + 3];
      if (x < 32 && alpha > 0) opaqueLeft++;
      if (x >= 32 && alpha === 0) transparentRight++;
    }
  }
  check('fog left half stayed opaque', opaqueLeft === 64 * 32, `${opaqueLeft}/2048`);
  check('fog right half stayed transparent', transparentRight === 64 * 32, `${transparentRight}/2048`);

  const snap2 = await lib.loadSnapshot();
  check('hasFog flag now true', snap2.maps.find((m) => m.id === a.entry.id)?.hasFog === true);

  // ── View state ─────────────────────────────────────────────────────────────
  await lib.saveMapViewState(a.entry.id, 2.5, { x: 123, y: 456 });
  const snap3 = await lib.loadSnapshot();
  const aMeta = snap3.maps.find((m) => m.id === a.entry.id);
  check('zoom persisted', aMeta.zoom === 2.5, String(aMeta.zoom));
  check('pan persisted', aMeta.pan.x === 123 && aMeta.pan.y === 456, JSON.stringify(aMeta.pan));
  check("other map's zoom untouched", snap3.maps.find((m) => m.id === b.entry.id).zoom === 1);

  // ── Image + thumb reload ───────────────────────────────────────────────────
  const imgBack = await lib.loadImageDataUrl(a.entry.id);
  check('image reloads as data URL', !!imgBack?.startsWith('data:image/'));
  const thumbBack = await lib.loadThumbDataUrl(a.entry.id);
  check('thumbnail reloads', !!thumbBack?.startsWith('data:image/png;base64,'));

  // ── Rename ─────────────────────────────────────────────────────────────────
  await lib.renameMap(a.entry.id, 'Cave of Doom');
  const snap4 = await lib.loadSnapshot();
  check('rename applied', snap4.maps.find((m) => m.id === a.entry.id).name === 'Cave of Doom');
  check('rename rejects blank', (await lib.renameMap(a.entry.id, '   ')) === false);
  check('rename preserves other maps', snap4.maps.find((m) => m.id === b.entry.id).name === 'beta');

  // ── Settings ───────────────────────────────────────────────────────────────
  await lib.saveSettings({ playerViewDiagonal: '24', gridSize: '5' });
  const snap5 = await lib.loadSnapshot();
  check('settings persisted', snap5.settings.playerViewDiagonal === '24' && snap5.settings.gridSize === '5');
  check('settings patch keeps currentMapId', snap5.settings.currentMapId === b.entry.id);

  // ── Path traversal guards ──────────────────────────────────────────────────
  check('rejects traversal id on loadImage', (await lib.loadImageDataUrl('../../evil')) === null);
  check('rejects traversal id on saveFog', (await lib.saveFog('../evil', fogUrl)) === false);
  check('rejects traversal id on delete', (await lib.deleteMap('../../evil')) === false);

  // ── Delete removes files from disk ─────────────────────────────────────────
  const aDir = path.join(tmp, 'library', a.entry.id);
  const fogExisted = await fs.access(path.join(aDir, 'fog.png')).then(() => true).catch(() => false);
  check('fog.png exists before delete', fogExisted);
  const removed = await lib.deleteMap(a.entry.id);
  check('deleteMap succeeds', removed === true);
  const dirGone = await fs.access(aDir).then(() => false).catch(() => true);
  check('map folder removed from disk', dirGone);
  const fogGone = await lib.loadFogDataUrl(a.entry.id);
  check('fog unreadable after delete', fogGone === null);
  const snap6 = await lib.loadSnapshot();
  check('index no longer lists deleted map', !snap6.maps.some((m) => m.id === a.entry.id));
  check('currentMapId not clobbered for other map', snap6.settings.currentMapId === b.entry.id);

  // ── Corrupt index recovery ─────────────────────────────────────────────────
  await fs.writeFile(path.join(tmp, 'library', 'index.json'), '{ this is not json');
  const snap7 = await lib.loadSnapshot();
  check('recovers from corrupt index', Array.isArray(snap7.maps) && snap7.maps.length === 0, `maps=${snap7.maps.length}`);
  check('corrupt index falls back to defaults', snap7.settings.currentMapId === null);

  // ── Summary ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  }
  await fs.rm(tmp, { recursive: true, force: true });
  app.exit(failed.length ? 1 : 0);
});
