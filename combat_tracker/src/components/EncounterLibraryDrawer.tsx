import React, { useState } from 'react';
import { useCombat } from '../context/CombatContext';
import {
  X,
  Download,
  Upload,
  BookmarkPlus,
  Trash2,
  Play,
  BookOpen,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export const EncounterLibraryDrawer: React.FC = () => {
  const {
    activeModal,
    closeModal,
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    exportToJsonFile,
    importFromJsonFile,
    clearEncounter,
    encounter,
  } = useCombat();

  const [presetName, setPresetName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (activeModal !== 'library') return null;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName('');
    showFeedback('Encounter saved to library!');
  };

  const handleExport = async () => {
    const success = await exportToJsonFile();
    if (success) {
      showFeedback('Exported JSON successfully!');
    }
  };

  const handleImport = async () => {
    const success = await importFromJsonFile();
    if (success) {
      showFeedback('Encounter imported successfully!');
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                Encounter Library
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Presets, file backups, and templates
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Feedback banner */}
          {feedbackMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Section 1: JSON File Management */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              File Backup & Sharing
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all active:scale-98"
              >
                <Download className="w-4 h-4 text-amber-500" />
                <span>Export JSON</span>
              </button>
              <button
                onClick={handleImport}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all active:scale-98"
              >
                <Upload className="w-4 h-4 text-indigo-500" />
                <span>Import JSON</span>
              </button>
            </div>
          </div>

          {/* Section 2: Save Current Encounter as Preset */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Save Active Arena as Preset
            </span>
            <form onSubmit={handleSaveCurrent} className="flex gap-2">
              <input
                type="text"
                placeholder="Preset Name (e.g. Wolf Pack Ambush)"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <button
                type="submit"
                disabled={!presetName.trim() || encounter.combatants.length === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition-all shadow-sm"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Save</span>
              </button>
            </form>
          </div>

          {/* Section 3: Saved Presets */}
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Saved Presets ({presets.length})
            </span>

            {presets.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs">
                No custom presets saved yet. Save your current combatants above to reuse them anytime!
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {preset.name}
                      </h4>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {preset.combatants.length} combatants
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          loadPreset(preset.id);
                          closeModal();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all"
                        title="Load into arena"
                      >
                        <Play className="w-3 h-3" />
                        <span>Load</span>
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-zinc-400 hover:text-rose-500 transition-colors"
                        title="Delete preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Clear All */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
          <button
            onClick={() => {
              if (window.confirm('Clear all combatants from the arena?')) {
                clearEncounter();
                closeModal();
              }
            }}
            disabled={encounter.combatants.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 disabled:opacity-40 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Clear Arena (Wipe Combatants)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
