import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Combatant, Condition, CustomCounter, Encounter, EncounterPreset } from '../types/combat';

interface CombatContextType {
  encounter: Encounter;
  presets: EncounterPreset[];
  activeCombatant: Combatant | null;
  isDarkMode: boolean;
  activeModal: 'add_combatant' | 'add_condition' | 'add_counter' | 'library' | null;
  modalTarget: Combatant | null;
  
  // Turn navigation
  nextTurn: () => void;
  prevTurn: () => void;
  setRound: (round: number) => void;
  setEncounterName: (name: string) => void;
  sortInitiative: () => void;
  resetEncounter: () => void;
  clearEncounter: () => void;
  startNewEncounter: () => void;

  // Combatant CRUD
  addCombatant: (combatant: Omit<Combatant, 'id'>) => void;
  addCombatantsBatch: (base: Omit<Combatant, 'id'>, count: number) => void;
  updateCombatant: (id: string, updates: Partial<Combatant>) => void;
  removeCombatant: (id: string) => void;
  duplicateCombatant: (id: string) => void;
  moveCombatant: (fromIndex: number, toIndex: number) => void;

  // HP & Damage/Healing
  adjustHp: (id: string, delta: number) => void;


  // Custom Counters
  addCustomCounter: (combatantId: string, counter: Omit<CustomCounter, 'id' | 'replenishNextRound'>) => void;
  adjustCustomCounter: (combatantId: string, counterId: string, delta: number) => void;
  removeCustomCounter: (combatantId: string, counterId: string) => void;

  // Conditions
  addCondition: (combatantId: string, condition: Omit<Condition, 'id' | 'appliedAtRound'>) => void;
  removeCondition: (combatantId: string, conditionId: string) => void;

  // Presets & File Management
  savePreset: (name: string, description?: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  exportToJsonFile: () => Promise<boolean>;
  importFromJsonFile: () => Promise<boolean>;

  // UI state
  isConfirmModalOpen: boolean;
  setConfirmModalOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  openModal: (modal: 'add_combatant' | 'add_condition' | 'add_counter' | 'library', target?: Combatant | null) => void;
  closeModal: () => void;
}

const STORAGE_KEY_ENCOUNTER = 'dm_companion_active_encounter';
const STORAGE_KEY_PRESETS = 'dm_companion_presets';
const STORAGE_KEY_THEME = 'dm_companion_theme';

const initialEncounter: Encounter = {
  id: 'default',
  name: 'Ambush at the Crossroads',
  round: 1,
  activeCombatantId: 'c1',
  combatants: [
    {
      id: 'c1',
      name: 'Valeros (Fighter)',
      initiative: 18,
      currentHp: 28,
      maxHp: 32,
      customCounters: [
        { id: 'cnt1', name: 'Second Wind', value: 1, max: 1 },
        { id: 'cnt2', name: 'Action Surge', value: 1, max: 1 }
      ],
      isNpc: false,
      conditions: [],
      notes: 'Frontline tank'
    },
    {
      id: 'c2',
      name: 'Goblin Archer 1',
      initiative: 15,
      currentHp: 7,
      maxHp: 7,
      customCounters: [
        { id: 'cnt3', name: 'Arrows', value: 18, max: 20 }
      ],
      isNpc: true,
      conditions: [],
      notes: 'Taking cover behind fallen tree'
    },
    {
      id: 'c3',
      name: 'Goblin Archer 2',
      initiative: 12,
      currentHp: 7,
      maxHp: 7,
      customCounters: [],
      isNpc: true,
      conditions: [],
      notes: ''
    }
  ],
  historyLog: ['Encounter created.'],
  updatedAt: new Date().toISOString(),
};

const CombatContext = createContext<CombatContextType | undefined>(undefined);

export const CombatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [encounter, setEncounter] = useState<Encounter>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ENCOUNTER);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading encounter from localStorage:', e);
    }
    return initialEncounter;
  });

  const [presets, setPresets] = useState<EncounterPreset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRESETS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading presets from localStorage:', e);
    }
    return [];
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved !== null) return saved === 'dark';
    return true;
  });

  const [activeModal, setActiveModal] = useState<'add_combatant' | 'add_condition' | 'add_counter' | 'library' | null>(null);
  const [modalTarget, setModalTarget] = useState<Combatant | null>(null);
  const [isConfirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  // Sync encounter to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ENCOUNTER, JSON.stringify(encounter));
    } catch (e) {
      console.error('Failed to save encounter to localStorage', e);
    }
  }, [encounter]);

  // Broadcast state to any open view-only windows (Electron only)
  useEffect(() => {
    window.electronAPI?.sendState(encounter);
  }, [encounter]);


  // Sync presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save presets to localStorage', e);
    }
  }, [presets]);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(STORAGE_KEY_THEME, 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const openModal = (modal: 'add_combatant' | 'add_condition' | 'add_counter' | 'library', target: Combatant | null = null) => {
    setModalTarget(target);
    setActiveModal(modal);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalTarget(null);
  };

  const activeCombatant = encounter.combatants.find(c => c.id === encounter.activeCombatantId) ?? null;

  // Turn management
  const nextTurn = useCallback(() => {
    setEncounter(prev => {
      if (prev.combatants.length === 0) return prev;

      const currentIndex = prev.combatants.findIndex(c => c.id === prev.activeCombatantId);
      const nextIndex = currentIndex + 1 >= prev.combatants.length ? 0 : currentIndex + 1;
      const nextRound = nextIndex === 0 ? prev.round + 1 : prev.round;
      const nextCombatant = prev.combatants[nextIndex];

      // Check the new active combatant for condition countdown
      const logEntries: string[] = [];

      const updatedCombatants = prev.combatants.map((c) => {
        if (c.id !== nextCombatant.id) return c;

        // Periodic counter replenishment: fires when the combatant's turn
        // begins on (or past) the scheduled round. Catch-up handles an app that
        // was closed across several cycles - each missed one still applies, so
        // the value lands where it would have if the DM had been present.
        const withReplenishedCounters = c.customCounters.reduce((counters, cnt) => {
          const every = cnt.replenishEveryRounds;
          // Counters with no schedule still have to be carried over, otherwise
          // they'd be dropped from the list entirely
          if (!every || every < 1) return [...counters, cnt];
          let next = cnt.replenishNextRound;
          // Counters saved before this feature have no schedule; anchor them to
          // the current round so they don't fire retroactively on first use
          if (next === undefined) next = nextRound;

          if (nextRound < next) return [...counters, cnt];

          const amount = cnt.replenishAmount && cnt.replenishAmount > 0 ? cnt.replenishAmount : 1;
          let value = cnt.value + amount;
          if (cnt.max !== undefined) value = Math.min(cnt.max, value);
          value = Math.max(0, value);

          logEntries.push(
            `Round ${nextRound}: ${c.name}'s "${cnt.name}" replenished +${amount} (${cnt.value} → ${value}).`
          );

          // Advance the schedule past this round, preserving any leftover
          // remainder rather than drifting the phase
          const missed = nextRound - next;
          const advanced = next + every * (Math.floor(missed / every) + 1);

          return [...counters, { ...cnt, value, replenishNextRound: advanced }];
          // Seed with [] — seeding with c.customCounters would append to the
          // existing list and duplicate every entry
        }, [] as CustomCounter[]);

        // Decrement round-duration conditions on combatant's turn start
        const remainingConditions: Condition[] = [];
        c.conditions.forEach(cond => {
          if (cond.durationRounds !== undefined) {
            const updatedDuration = cond.durationRounds - 1;
            if (updatedDuration <= 0) {
              logEntries.push(`Round ${nextRound}: Condition "${cond.name}" expired on ${c.name}.`);
            } else {
              remainingConditions.push({ ...cond, durationRounds: updatedDuration });
            }
          } else {
            remainingConditions.push(cond);
          }
        });
        return { ...c, conditions: remainingConditions, customCounters: withReplenishedCounters };
      });

      return {
        ...prev,
        round: nextRound,
        activeCombatantId: nextCombatant.id,
        combatants: updatedCombatants,
        historyLog: logEntries.length > 0 ? [...prev.historyLog, ...logEntries] : prev.historyLog,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const prevTurn = useCallback(() => {
    setEncounter(prev => {
      if (prev.combatants.length === 0) return prev;

      const currentIndex = prev.combatants.findIndex(c => c.id === prev.activeCombatantId);
      const prevIndex = currentIndex - 1 < 0 ? prev.combatants.length - 1 : currentIndex - 1;
      const prevRound = prevIndex === prev.combatants.length - 1 && currentIndex === 0
        ? Math.max(1, prev.round - 1)
        : prev.round;
      const prevCombatant = prev.combatants[prevIndex];

      return {
        ...prev,
        round: prevRound,
        activeCombatantId: prevCombatant.id,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const setRound = (round: number) => {
    setEncounter(prev => ({ ...prev, round: Math.max(1, round) }));
  };

  const setEncounterName = (name: string) => {
    setEncounter(prev => ({ ...prev, name }));
  };

  const sortInitiative = () => {
    setEncounter(prev => {
      const sorted = [...prev.combatants].sort((a, b) => b.initiative - a.initiative);

      return {
        ...prev,
        combatants: sorted,
        historyLog: [...prev.historyLog, 'Initiative order re-sorted.'],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const resetEncounter = () => {
    setEncounter(prev => ({
      ...prev,
      round: 1,
      activeCombatantId: prev.combatants[0]?.id ?? null,
      historyLog: [...prev.historyLog, 'Encounter reset to Round 1.'],
      updatedAt: new Date().toISOString(),
    }));
  };

  const clearEncounter = () => {
    setEncounter(prev => ({
      ...prev,
      round: 1,
      activeCombatantId: null,
      combatants: [],
      historyLog: ['All combatants cleared.'],
      updatedAt: new Date().toISOString(),
    }));
  };

  const startNewEncounter = () => {
    setEncounter({
      id: 'enc_' + Date.now(),
      name: 'New Encounter',
      round: 1,
      activeCombatantId: null,
      combatants: [],
      historyLog: ['Started a new encounter.'],
      updatedAt: new Date().toISOString(),
    });
  };

  // Combatant CRUD
  const addCombatant = (data: Omit<Combatant, 'id'>) => {
    const newCombatant: Combatant = {
      ...data,
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    };

    setEncounter(prev => {
      // Insert in sorted order
      const newCombatants = [...prev.combatants, newCombatant].sort((a, b) => b.initiative - a.initiative);
      return {
        ...prev,
        combatants: newCombatants,
        historyLog: [...prev.historyLog, `Added ${newCombatant.name} (Init: ${newCombatant.initiative}).`],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const addCombatantsBatch = (base: Omit<Combatant, 'id'>, count: number) => {
    if (count <= 1) {
      addCombatant(base);
      return;
    }

    const newCombatants: Combatant[] = [];
    for (let i = 1; i <= count; i++) {
      newCombatants.push({
        ...base,
        id: 'c_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 6),
        name: `${base.name} ${i}`,
      });
    }

    setEncounter(prev => {
      const combined = [...prev.combatants, ...newCombatants].sort((a, b) => b.initiative - a.initiative);
      return {
        ...prev,
        combatants: combined,
        historyLog: [...prev.historyLog, `Added ${count}x ${base.name}.`],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const updateCombatant = (id: string, updates: Partial<Combatant>) => {
    setEncounter(prev => ({
      ...prev,
      combatants: prev.combatants.map(c => c.id === id ? { ...c, ...updates } : c),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeCombatant = (id: string) => {
    setEncounter(prev => {
      const target = prev.combatants.find(c => c.id === id);
      const remaining = prev.combatants.filter(c => c.id !== id);

      let newActiveId = prev.activeCombatantId;
      if (prev.activeCombatantId === id) {
        const oldIndex = prev.combatants.findIndex(c => c.id === id);
        const newIndex = Math.min(oldIndex, remaining.length - 1);
        newActiveId = remaining[newIndex]?.id ?? null;
      }

      return {
        ...prev,
        combatants: remaining,
        activeCombatantId: newActiveId,
        historyLog: target ? [...prev.historyLog, `Removed ${target.name}.`] : prev.historyLog,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const duplicateCombatant = (id: string) => {
    const existing = encounter.combatants.find(c => c.id === id);
    if (!existing) return;

    const copy: Omit<Combatant, 'id'> = {
      ...existing,
      name: `${existing.name} (Copy)`,
      customCounters: existing.customCounters.map(cnt => ({ ...cnt, id: 'cnt_' + Math.random().toString(36).substring(2, 6) })),
      conditions: [...existing.conditions],
    };
    addCombatant(copy);
  };

  const moveCombatant = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setEncounter(prev => {
      const updated = [...prev.combatants];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      return {
        ...prev,
        combatants: updated,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // HP operations
  const adjustHp = (id: string, delta: number) => {
    setEncounter(prev => ({
      ...prev,
      combatants: prev.combatants.map(c => {
        if (c.id !== id) return c;
        const newHp = Math.max(0, Math.min(c.maxHp, c.currentHp + delta));
        return { ...c, currentHp: newHp };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Custom Counters
  const addCustomCounter = (
    combatantId: string,
    counter: Omit<CustomCounter, 'id' | 'replenishNextRound'>,
  ) => {
    setEncounter(prev => {
      // Stamp the first replenishment relative to the current round so it fires
      // after a full cycle rather than immediately
      const every = counter.replenishEveryRounds;
      const newCounter: CustomCounter = {
        ...counter,
        id: 'cnt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        replenishNextRound: every && every >= 1 ? prev.round + every : undefined,
      };

      return {
        ...prev,
        combatants: prev.combatants.map(c => {
          if (c.id !== combatantId) return c;
          return { ...c, customCounters: [...c.customCounters, newCounter] };
        }),
        historyLog: [...prev.historyLog, `Counter "${newCounter.name}" added to ${prev.combatants.find(c => c.id === combatantId)?.name}.`],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const adjustCustomCounter = (combatantId: string, counterId: string, delta: number) => {
    setEncounter(prev => ({
      ...prev,
      combatants: prev.combatants.map(c => {
        if (c.id !== combatantId) return c;
        return {
          ...c,
          customCounters: c.customCounters.map(cnt => {
            if (cnt.id !== counterId) return cnt;
            let val = cnt.value + delta;
            if (cnt.max !== undefined) {
              val = Math.min(cnt.max, Math.max(0, val));
            } else {
              val = Math.max(0, val);
            }
            return { ...cnt, value: val };
          }),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeCustomCounter = (combatantId: string, counterId: string) => {
    setEncounter(prev => ({
      ...prev,
      combatants: prev.combatants.map(c => {
        if (c.id !== combatantId) return c;
        return {
          ...c,
          customCounters: c.customCounters.filter(cnt => cnt.id !== counterId),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Conditions
  const addCondition = (combatantId: string, cond: Omit<Condition, 'id' | 'appliedAtRound'>) => {
    setEncounter(prev => {
      const newCondition: Condition = {
        ...cond,
        id: 'cond_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        appliedAtRound: prev.round,
      };

      return {
        ...prev,
        combatants: prev.combatants.map(c => {
          if (c.id !== combatantId) return c;
          return { ...c, conditions: [...c.conditions, newCondition] };
        }),
        historyLog: [...prev.historyLog, `Condition "${cond.name}" added to ${prev.combatants.find(c => c.id === combatantId)?.name}.`],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const removeCondition = (combatantId: string, conditionId: string) => {
    setEncounter(prev => ({
      ...prev,
      combatants: prev.combatants.map(c => {
        if (c.id !== combatantId) return c;
        return {
          ...c,
          conditions: c.conditions.filter(cond => cond.id !== conditionId),
        };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Presets & File Management
  const savePreset = (name: string, description?: string) => {
    const newPreset: EncounterPreset = {
      id: 'preset_' + Date.now(),
      name,
      description,
      combatants: encounter.combatants.map(({ id: _, ...rest }) => rest),
      createdAt: new Date().toISOString(),
    };
    setPresets(prev => [newPreset, ...prev]);
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const instantiated: Combatant[] = preset.combatants.map((c, i) => ({
      ...c,
      id: 'c_' + Date.now() + '_' + i,
      customCounters: c.customCounters.map(cnt => ({ ...cnt, id: 'cnt_' + Math.random().toString(36).substring(2, 6) })),
      conditions: [],
    }));

    setEncounter({
      id: 'enc_' + Date.now(),
      name: preset.name,
      round: 1,
      activeCombatantId: instantiated[0]?.id ?? null,
      combatants: instantiated,
      historyLog: [`Loaded preset: "${preset.name}".`],
      updatedAt: new Date().toISOString(),
    });
  };

  const deletePreset = (presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  };

  const exportToJsonFile = async (): Promise<boolean> => {
    const jsonString = JSON.stringify(encounter, null, 2);
    const sanitizedName = encounter.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '.json';

    if (window.electronAPI?.saveEncounterFile) {
      return await window.electronAPI.saveEncounterFile(jsonString, sanitizedName);
    } else {
      // Browser fallback (download link)
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sanitizedName;
      a.click();
      URL.revokeObjectURL(url);
      return true;
    }
  };

  const importFromJsonFile = async (): Promise<boolean> => {
    try {
      let content: string | null = null;
      if (window.electronAPI?.loadEncounterFile) {
        content = await window.electronAPI.loadEncounterFile();
      } else {
        // Browser fallback using input element
        content = await new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.readAsText(file);
          };
          input.click();
        });
      }

      if (!content) return false;
      const parsed = JSON.parse(content);
      if (parsed.combatants && Array.isArray(parsed.combatants)) {
        setEncounter({
          ...parsed,
          id: 'enc_' + Date.now(),
          updatedAt: new Date().toISOString(),
          historyLog: [...(parsed.historyLog || []), 'Encounter imported from file.'],
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to import JSON encounter:', e);
      return false;
    }
  };

  return (
    <CombatContext.Provider
      value={{
        encounter,
        presets,
        activeCombatant,
        isDarkMode,
        activeModal,
        modalTarget,
        nextTurn,
        prevTurn,
        setRound,
        setEncounterName,
        sortInitiative,
        resetEncounter,
        clearEncounter,
        startNewEncounter,
        addCombatant,
        addCombatantsBatch,
        updateCombatant,
        removeCombatant,
        duplicateCombatant,
        moveCombatant,
        adjustHp,
        addCustomCounter,
        adjustCustomCounter,
        removeCustomCounter,
        addCondition,
        removeCondition,
        savePreset,
        loadPreset,
        deletePreset,
        exportToJsonFile,
        importFromJsonFile,
        isConfirmModalOpen,
        setConfirmModalOpen,
        toggleDarkMode,
        openModal,
        closeModal,
      }}
    >
      {children}
    </CombatContext.Provider>
  );
};

export const useCombat = (): CombatContextType => {
  const context = useContext(CombatContext);
  if (!context) {
    throw new Error('useCombat must be used within a CombatProvider');
  }
  return context;
};
