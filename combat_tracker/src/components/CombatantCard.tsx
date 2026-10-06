import React, { useState, useEffect } from 'react';
import { Combatant } from '../types/combat';
import { useCombat } from '../context/CombatContext';
import {
  Heart,
  Plus,
  Minus,
  Sparkles,
  Tag,
  Trash2,
  Skull,
  User,
} from 'lucide-react';

interface CombatantCardProps {
  combatant: Combatant;
  isActive: boolean;
}

export const CombatantCard: React.FC<CombatantCardProps> = ({ combatant, isActive }) => {
  const {
    adjustHp,
    adjustCustomCounter,
    removeCustomCounter,
    removeCondition,
    removeCombatant,
    openModal,
    updateCombatant,
  } = useCombat();

  const [editingInit, setEditingInit] = useState(false);
  const [initValue, setInitValue] = useState(String(combatant.initiative));
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(combatant.name);
  const [editingHp, setEditingHp] = useState(false);
  const [hpValue, setHpValue] = useState(combatant.maxHp > 0 ? String(combatant.currentHp) : '');
  const [editingMaxHp, setEditingMaxHp] = useState(false);
  const [maxHpValue, setMaxHpValue] = useState(combatant.maxHp > 0 ? String(combatant.maxHp) : '');

  // maxHp of 0 means "HP not set yet": show "-" and hide the bar/stappers rather
  // than pretending the creature has a pool of 1.
  const hasKnownHp = combatant.maxHp > 0;

  useEffect(() => {
    setInitValue(String(combatant.initiative));
  }, [combatant.initiative]);

  useEffect(() => {
    setNameValue(combatant.name);
  }, [combatant.name]);

  useEffect(() => {
    setHpValue(hasKnownHp ? String(combatant.currentHp) : '');
  }, [combatant.currentHp, hasKnownHp]);

  useEffect(() => {
    setMaxHpValue(hasKnownHp ? String(combatant.maxHp) : '');
  }, [combatant.maxHp, hasKnownHp]);

  // HP percentage calculation
  const hpPercent = hasKnownHp
    ? Math.max(0, Math.min(100, Math.round((combatant.currentHp / combatant.maxHp) * 100)))
    : 0;

  // Determine health status color
  const getHealthColor = () => {
    if (combatant.currentHp <= 0) return 'bg-zinc-600 dark:bg-zinc-700';
    if (hpPercent <= 25) return 'bg-rose-500';
    if (hpPercent <= 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // Unknown HP must not read as "Down", otherwise every fresh combatant looks dead.
  const isDeadOrUnconscious = hasKnownHp && combatant.currentHp <= 0;

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
        isActive
          ? 'bg-amber-500/[0.04] dark:bg-amber-400/[0.03] border-amber-500 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
      }`}
    >
      {/* Top Banner for Active Turn */}
      {isActive && (
        <div className="bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest px-4 py-0.5 text-center flex items-center justify-center gap-1.5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Active Turn</span>
        </div>
      )}

      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Row 1: Header (Initiative, Name, HP Bar, Steppers, Menu) */}
        <div className="flex items-center gap-3">
          {/* Initiative Score Badge (click to edit) */}
          <div
            className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 shadow-sm shrink-0 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
            title="Click to edit initiative"
            onClick={() => {
              setInitValue(String(combatant.initiative));
              setEditingInit(true);
            }}
          >
            <span className="text-[9px] uppercase font-bold tracking-tight text-zinc-400 dark:text-zinc-500 leading-none">
              Init
            </span>
            {editingInit ? (
              <input
                type="number"
                autoFocus
                value={initValue}
                onChange={(e) => setInitValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => {
                  const val = parseInt(initValue, 10);
                  if (!isNaN(val)) {
                    updateCombatant(combatant.id, { initiative: val });
                  }
                  setEditingInit(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingInit(false);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-8 text-center text-lg font-black leading-none mt-0.5 bg-transparent border-b border-amber-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <span className="text-lg font-black leading-none mt-0.5">
                {combatant.initiative}
              </span>
            )}
          </div>

          {/* Name + HP Section */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {editingName ? (
                <input
                  type="text"
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onFocus={(e) => {
                    const len = e.target.value.length;
                    e.target.setSelectionRange(len, len);
                  }}
                  onBlur={() => {
                    if (nameValue.trim()) {
                      updateCombatant(combatant.id, { name: nameValue.trim() });
                    }
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      setNameValue(combatant.name);
                      setEditingName(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-base font-bold bg-transparent border-b border-amber-500 outline-none min-w-0 flex-1 ${
                    isDeadOrUnconscious ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'
                  }`}
                />
              ) : (
                <h3
                  className={`text-base font-bold truncate cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors ${
                    isDeadOrUnconscious ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'
                  }`}
                  title="Click to edit name"
                  onClick={() => {
                    setNameValue(combatant.name);
                    setEditingName(true);
                  }}
                >
                  {combatant.name}
                </h3>
              )}
              {isDeadOrUnconscious && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                  <Skull className="w-3 h-3" />
                  <span>Down</span>
                </span>
              )}
              <button
                onClick={() => updateCombatant(combatant.id, { isNpc: !combatant.isNpc })}
                className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                title="Click to toggle PC/NPC"
              >
                {combatant.isNpc ? (
                  <>
                    <Skull className="w-3 h-3 text-rose-500" />
                    <span>Enemy</span>
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3 text-emerald-500" />
                    <span>Ally</span>
                  </>
                )}
              </button>
              <button
                onClick={() => openModal('add_counter', combatant)}
                className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0"
                title="Add counter"
              >
                <Tag className="w-3 h-3" />
              </button>
              <button
                onClick={() => openModal('add_condition', combatant)}
                className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0"
                title="Add condition"
              >
                <Sparkles className="w-3 h-3" />
              </button>
            </div>

            {/* HP Bar + Numbers + Steppers */}
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              {editingHp ? (
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={hpValue}
                  onChange={(e) => setHpValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    const trimmed = hpValue.trim();
                    if (trimmed === '') {
                      setEditingHp(false);
                      return;
                    }
                    const parsed = parseInt(trimmed, 10);
                    if (isNaN(parsed)) {
                      setEditingHp(false);
                      return;
                    }
                    if (hasKnownHp) {
                      if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
                        const newHp = Math.max(
                          0,
                          Math.min(combatant.maxHp, combatant.currentHp + parsed)
                        );
                        updateCombatant(combatant.id, { currentHp: newHp });
                      } else {
                        const clamped = Math.max(0, Math.min(combatant.maxHp, parsed));
                        updateCombatant(combatant.id, { currentHp: clamped });
                      }
                    } else {
                      // HP was unknown ("-"); adopt the typed value as the pool so
                      // the number is actually visible instead of hidden behind "-".
                      const adopted = Math.max(0, parsed);
                      updateCombatant(combatant.id, { currentHp: adopted, maxHp: adopted });
                    }
                    setEditingHp(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      setHpValue(hasKnownHp ? String(combatant.currentHp) : '');
                      setEditingHp(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 text-center text-xs font-black text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-amber-500 outline-none shrink-0"
                />
              ) : (
                <span
                  className={`text-xs font-black shrink-0 cursor-pointer transition-colors ${
                    hasKnownHp
                      ? 'text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                  title={hasKnownHp ? 'Click to set HP' : 'Click to set HP'}
                  onClick={() => {
                    setHpValue(hasKnownHp ? String(combatant.currentHp) : '');
                    setEditingHp(true);
                  }}
                >
                  {hasKnownHp ? combatant.currentHp : '-'}
                </span>
              )}
              {hasKnownHp && (
                <div className="flex-1 bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getHealthColor()}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              )}
              {editingMaxHp ? (
                <input
                  type="number"
                  autoFocus
                  value={maxHpValue}
                  onChange={(e) => setMaxHpValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    const val = parseInt(maxHpValue, 10);
                    if (!isNaN(val) && val > 0) {
                      // One update call, not two: setting a max on a "-"
                      // combatant also seeds the current pool, otherwise it would
                      // read 0/max and appear Down.
                      const updates: Partial<Combatant> = { maxHp: val };
                      if (!hasKnownHp || combatant.currentHp > val) {
                        updates.currentHp = val;
                      }
                      updateCombatant(combatant.id, updates);
                    }
                    setEditingMaxHp(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') {
                      setMaxHpValue(hasKnownHp ? String(combatant.maxHp) : '');
                      setEditingMaxHp(false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 text-center text-[10px] font-normal text-zinc-400 dark:text-zinc-500 bg-transparent border-b border-amber-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shrink-0"
                />
              ) : (
                <span
                  className={`text-[10px] font-normal shrink-0 cursor-pointer transition-colors ${
                    hasKnownHp
                      ? 'text-zinc-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 underline decoration-dotted underline-offset-2'
                  }`}
                  title="Click to set max HP"
                  onClick={() => {
                    setMaxHpValue(hasKnownHp ? String(combatant.maxHp) : '');
                    setEditingMaxHp(true);
                  }}
                >
                  {hasKnownHp ? `/${combatant.maxHp}` : '-'}
                </span>
              )}
              {/* Steppers need a known ceiling, so they stay hidden while HP is "-" */}
              {hasKnownHp && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => adjustHp(combatant.id, -5)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[10px] font-bold transition-all active:scale-95"
                    title="Subtract 5 HP"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => adjustHp(combatant.id, -1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all active:scale-95"
                    title="Subtract 1 HP"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => adjustHp(combatant.id, 1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all active:scale-95"
                    title="Add 1 HP"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => adjustHp(combatant.id, 5)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[10px] font-bold transition-all active:scale-95"
                    title="Add 5 HP"
                  >
                    +5
                  </button>
                </div>
              )}
            </div>

            {combatant.notes && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                {combatant.notes}
              </span>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={() => removeCombatant(combatant.id)}
            className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors shrink-0"
            title="Remove combatant"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: Custom Counters (only show if any exist) */}
        {combatant.customCounters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {combatant.customCounters.map((counter) => (
              <div
                key={counter.id}
                className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-2.5 py-1 text-xs font-semibold shadow-sm group"
              >
                <span className="text-zinc-600 dark:text-zinc-300">{counter.name}:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {counter.value}
                  {counter.max !== undefined && (
                    <span className="text-[10px] text-zinc-400 font-normal">/{counter.max}</span>
                  )}
                </span>

                {/* Counter Steppers */}
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => adjustCustomCounter(combatant.id, counter.id, -1)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    title="Decrement counter"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => adjustCustomCounter(combatant.id, counter.id, 1)}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    title="Increment counter"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => removeCustomCounter(combatant.id, counter.id)}
                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-zinc-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete counter"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Row 3: Conditions & Status Badges (only show if any exist) */}
        {combatant.conditions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
            {combatant.conditions.map((cond) => (
              <div
                key={cond.id}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-xs ${
                  cond.color || 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}
              >
                <span>{cond.name}</span>
                {cond.durationRounds !== undefined && (
                  <span className="text-[10px] opacity-80 font-normal">
                    ({cond.durationRounds}r)
                  </span>
                )}
                <button
                  onClick={() => removeCondition(combatant.id, cond.id)}
                  className="ml-0.5 hover:opacity-75 transition-opacity"
                  title="Remove condition"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
