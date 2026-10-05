export interface CustomCounter {
  id: string;
  name: string;
  value: number;
  max?: number;
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
