# Lazy DM Companion

Two desktop apps for running tabletop RPG sessions, built with Electron, React and TypeScript.

## DM Tabletop Companion

`combat_tracker/` — a combat and initiative tracker.

Track an encounter's combatants with their initiative order and health pools. A round counter advances as you move between turns, and each combatant card handles damage and healing via steppers, plus conditions with round-based durations that expire on the combatant's turn.

Encounters auto-save to disk, so closing and reopening the app never loses a session. Presets can be saved as reusable encounters and exported to or imported from JSON files. A separate read-only window can be opened for the player screen, which mirrors the tracker without the editing controls.

System-agnostic by design: nothing assumes a specific ruleset. A combatant needs only a name, initiative, health, and any custom counters you want to track.

## Map Display

`map_display/` — a battle map display with a separate player view.

Load a map image, paint fog of war onto it with an adjustable brush, and reveal areas as the party explores. A draggable frame overlays the map showing exactly what the player window is currently looking at, with an optional grid scaled to a real physical diagonal for measuring distances on a virtual tabletop. Zoom and pan are shared with the player window.

Opened maps are kept in a library on the left, and each one remembers its own fog pattern, zoom and position. Switching between maps restores that map's state, and everything survives a restart.

## Download (Windows)

Latest release: https://github.com/felipeabviana/lazy_dm_companion/releases/latest

Grab the installers from the [releases page](https://github.com/felipeabviana/lazy_dm_companion/releases). Each app ships as a Windows installer and a portable `.exe` that runs without installing.

## Development

Two independent npm projects with no workspace tooling at the root — `cd` into the one you want and install there.

```bash
cd combat_tracker   # or map_display
npm install
npm run dev         # Vite dev server + Electron
npm run build       # typecheck + production bundle
npm run dist:win    # build + package Windows installer and portable .exe
npm run dist:mac    # build + package macOS .dmg (arm64 and x64), run on a Mac
```

The macOS build is unsigned. Your own local build opens normally, but a `.dmg` downloaded from elsewhere is blocked by Gatekeeper: run `xattr -cr "/Applications/<App Name>.app"` once, or allow it under System Settings > Privacy & Security.

## License

MIT — see [LICENSE](LICENSE).
