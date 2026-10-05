# Project Guidelines: DM Tabletop Companion

## Architecture & Principles
- **System-Agnostic Design**: Never assume specific D&D or Pathfinder rules unless configured as user presets. Combatants only require Name, Initiative, Current HP, Max HP, and arbitrary Custom Counters.
- **Mouse & Touch First**: Prioritize large, explicit click targets, +/- steppers, and clear action modals over keyboard shortcuts (though shortcuts can be added as non-intrusive bonuses).
- **Modern Minimalist Visuals**: Default to clean zinc/slate neutral dark mode with support for light mode. Use high-contrast color badges for conditions.
- **Persistence**: All active combat state must seamlessly auto-persist so refreshing or reopening never loses a session.
- **IPC Safety**: Use Electron `contextBridge` in preload scripts with strictly typed IPC channels. Never expose raw `ipcRenderer` or Node built-in modules directly to the renderer process.
