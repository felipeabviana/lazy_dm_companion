export interface CustomCounter {
  id: string;
  name: string;
  value: number;
  max?: number;
  /**
   * Optional periodic replenishment: every N rounds this combatant's turn comes
   * around, `replenishAmount` is added back to `value` (capped at `max` when
   * one is set). Counted from `replenishNextRound`, which is stamped when the
   * counter is created or its settings are edited.
   */
  replenishEveryRounds?: number;
  /** How much to add back on each replenishment. Positive; defaults to 1. */
  replenishAmount?: number;
  /** The round on which the next replenishment fires (inclusive). */
  replenishNextRound?: number;
}

export interface Condition {
  id: string;
  name: string;
  color: string; // tailwind color token or hex
  durationRounds?: number; // undefined means indefinite
  appliedAtRound: number;
}

export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  currentHp: number;
  maxHp: number;
  customCounters: CustomCounter[];
  isNpc: boolean;
  conditions: Condition[];
  notes?: string;
}

export interface Encounter {
  id: string;
  name: string;
  round: number;
  activeCombatantId: string | null;
  combatants: Combatant[];
  historyLog: string[];
  updatedAt: string;
}

export interface EncounterPreset {
  id: string;
  name: string;
  description?: string;
  combatants: Omit<Combatant, 'id'>[];
  createdAt: string;
}
