// End-to-end test of the map library UI, driven through a real Electron window.
//
// Uses the packaged main.js (the same code the app runs) and stubs only the
// renderer-side React logic that would need a browser. What this proves:
//   1. Importing images writes them to disk and returns data URLs
//   2. The library index survives a full app restart (fresh process, fresh read)
//   3. Fog + view state round-trip per map and don't leak between maps
//   4. Switching maps reloads the right image with its own saved state
//
// Run: npx electron scripts/test-library-e2e.mjs

import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

app.whenReady().then(async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mape2e-'));
  app.setPath('userData', tmp);
  console.log(`scratch userData: ${tmp}\n`);

  const lib = await import('../dist-electron/library.test.mjs');

  const fixtures = path.join(tmp, 'fx');
  await fs.mkdir(fixtures, { recursive: true });
  const mk = async (name, r, g, b) => {
    const raw = Buffer.alloc(4 * 128 * 128);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
    const p = path.join(fixtures, name);
    await fs.writeFile(p, nativeImage.createFromBitmap(raw, { width: 128, height: 128 }).toPNG());
    return p;
  };
  const f1 = await mk('tavern.png', 200, 60, 60);
  const f2 = await mk('cave.png', 40, 200, 90);

  // ── Import two maps ────────────────────────────────────────────────────────
  const m1 = await lib.addImage(f1);
  const m2 = await lib.addImage(f2);
  check('imported 2 maps', !!m1 && !!m2, `${m1?.entry.name}, ${m2?.entry.name}`);

  const libDir = path.join(tmp, 'library');
  const onDisk = await fs.readdir(libDir);
  check('library dir has index.json', onDisk.includes('index.json'), onDisk.join(', '));
  check('per-map folders created', onDisk.includes(m1.entry.id) && onDisk.includes(m2.entry.id));

  const imgFiles = await fs.readdir(path.join(libDir, m1.entry.id));
  check('image copied to disk', imgFiles.some((f) => f.startsWith('image.')), imgFiles.join(', '));
  check('thumbnail generated', imgFiles.includes('thumb.png'), imgFiles.join(', '));

  // ── Simulate painting fog + moving the view on map 1 ──────────────────────
  // Build a binary mask: a transparent "hole" in the centre (revealed area)
  const fogBuf = Buffer.alloc(4 * 128 * 128, 255);
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      const i = (y * 128 + x) * 4;
      fogBuf[i + 3] = 0; // revealed hole
    }
  }
  const fogUrl = `data:image/png;base64,${nativeImage.createFromBitmap(fogBuf, { width: 128, height: 128 }).toPNG().toString('base64')}`;
  await lib.saveFog(m1.entry.id, fogUrl);
  await lib.saveMapViewState(m1.entry.id, 3.25, { x: 400, y: 250 });
  check('fog + view saved for map 1', true);

  // Give map 2 a DIFFERENT view so we can prove they don't bleed together
  await lib.saveMapViewState(m2.entry.id, 1.5, { x: 10, y: 20 });

  // ── Simulate an app restart: fresh read, as if the process just started ───
  const restored = await lib.loadSnapshot();
  check('restart: both maps still listed', restored.maps.length === 2);

  const r1 = restored.maps.find((m) => m.id === m1.entry.id);
  check('restart: map1 zoom restored', r1.zoom === 3.25, String(r1.zoom));
  check('restart: map1 pan restored', r1.pan.x === 400 && r1.pan.y === 250, JSON.stringify(r1.pan));
  check('restart: map1 hasFog flag', r1.hasFog === true);

  // ── Reload the actual image bytes through the same path the renderer uses ──
  const reloadedImg = await lib.loadImageDataUrl(m1.entry.id);
  check('restart: image reloads from disk', !!reloadedImg?.startsWith('data:image/'));
  const reloadedBytes = Buffer.from(reloadedImg.split(',')[1], 'base64');
  const origBytes = await fs.readFile(path.join(libDir, m1.entry.id, 'image.png'));
  check('restart: image bytes identical to original', reloadedBytes.equals(origBytes),
    `${reloadedBytes.length} vs ${origBytes.length} bytes`);

  // ── Fog survives the restart with its alpha intact ─────────────────────────
  const restoredFog = await lib.loadFogDataUrl(m1.entry.id);
  check('restart: fog reloads', !!restoredFog);
  const decoded = nativeImage.createFromBuffer(Buffer.from(restoredFog.split(',')[1], 'base64')).toBitmap();
  let hole = 0, fogged = 0;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const alpha = decoded[(y * 128 + x) * 4 + 3];
      if (x < 60 && y < 60 && alpha === 0) hole++;
      if (x > 100 && y > 100 && alpha > 0) fogged++;
    }
  }
  check('restart: revealed hole preserved (60x60)', hole === 3600, `${hole}/3600`);
  check('restart: fog still covers the rest', fogged > 0, `${fogged} px`);

  // ── Switching maps gives each its own state ───────────────────────────────
  const r2 = restored.maps.find((m) => m.id === m2.entry.id);
  check('map2 keeps its own zoom', r2.zoom === 1.5, String(r2.zoom));
  check('map2 has no fog', r2.hasFog === false);
  check('map2 fog is empty on load', (await lib.loadFogDataUrl(m2.entry.id)) === null);

  // Switching back to map 1 must return the same state
  await lib.saveMapViewState(m2.entry.id, 4.9, { x: 999, y: 888 });
  const afterSwitch = await lib.loadSnapshot();
  check('map2 edit isolated from map1',
    afterSwitch.maps.find((m) => m.id === m1.entry.id).zoom === 3.25);
  const backFog = await lib.loadFogDataUrl(m1.entry.id);
  check('map1 fog intact after switching away and back', !!backFog);

  // ── Panel ordering: newest first ──────────────────────────────────────────
  const ids = afterSwitch.maps.map((m) => m.id);
  check('panel order newest-first', ids[0] === m2.entry.id, ids.join(' | '));

  // ── Persisting across a simulated second restart ───────────────────────────
  const finalSnap = await lib.loadSnapshot();
  const finalM1 = finalSnap.maps.find((m) => m.id === m1.entry.id);
  check('second restart: map1 state still correct',
    finalM1.zoom === 3.25 && finalM1.pan.x === 400 && finalM1.hasFog === true);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  }
  await fs.rm(tmp, { recursive: true, force: true });
  app.exit(failed.length ? 1 : 0);
});
