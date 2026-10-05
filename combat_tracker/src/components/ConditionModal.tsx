import React, { useState } from 'react';
import { useCombat } from '../context/CombatContext';
import { X, Clock } from 'lucide-react';

const PRESET_CONDITIONS = [
  { name: 'Concentrating', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { name: 'Poisoned', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { name: 'Stunned', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' },
  { name: 'Prone', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { name: 'Blinded', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { name: 'Frightened', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' },
  { name: 'Paralyzed', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
  { name: 'Restrained', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' },
  { name: 'Charmed', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30' },
  { name: 'Blessed', color: 'bg-amber-400/10 text-amber-500 dark:text-amber-300 border-amber-400/30' },
  { name: 'Bleeding', color: 'bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/30' },
  { name: 'Incapacitated', color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30' },
];

export const ConditionModal: React.FC = () => {
  const { activeModal, modalTarget, closeModal, addCondition } = useCombat();

  const [customName, setCustomName] = useState('');
  const [durationRounds, setDurationRounds] = useState<number | undefined>(undefined);
  const selectedColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';

  if (activeModal !== 'add_condition' || !modalTarget) return null;

  const handleApplyPreset = (preset: { name: string; color: string }) => {
    addCondition(modalTarget.id, {
      name: preset.name,
      color: preset.color,
      durationRounds,
    });
    closeModal();
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    addCondition(modalTarget.id, {
      name: customName.trim(),
      color: selectedColor,
      durationRounds,
    });
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
              Apply Condition
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Target: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{modalTarget.name}</span>
            </p>
          </div>
          <button
            onClick={closeModal}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Duration Selector */}
          <div className="bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Round Duration (Optional Countdown)</span>
            </label>
            <div className="flex items-center gap-1.5">
              {[
                { label: 'Indefinite', val: undefined },
                { label: '1 Round', val: 1 },
                { label: '2 Rounds', val: 2 },
                { label: '3 Rounds', val: 3 },
                { label: '5 Rounds', val: 5 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setDurationRounds(opt.val)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    durationRounds === opt.val
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Standard Conditions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_CONDITIONS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-all active:scale-95 hover:brightness-110 shadow-xs ${preset.color}`}
                >
                  + {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Condition */}
          <form onSubmit={handleApplyCustom} className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
            <input
              type="text"
              placeholder="Or type custom condition..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!customName.trim()}
              className="px-4 py-2 rounded-xl font-bold text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
