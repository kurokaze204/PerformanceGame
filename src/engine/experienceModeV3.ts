import type { ExperienceMode } from '../types/gameV2.ts';

export type CapabilityGroup = 'internal' | 'expert' | 'network' | 'foresight';

export function capabilityUnlocked(mode: ExperienceMode, round: number, group: CapabilityGroup) {
  if (mode === 'expert') return true;
  if (group === 'internal' || group === 'expert') return round >= 1;
  if (group === 'network') return round >= 2;
  return round >= 3;
}

export function interventionUnlocked(mode: ExperienceMode, round: number, actionType: string) {
  // Deliberate instructional sequence: Corporate Intranet publishing is withheld
  // during the opening round in every mode. The first local challenge demonstrates
  // the cost of knowledge being stranded at another site before this intervention
  // becomes available from Round 2 onward.
  if (actionType === 'UPDATE_INTRANET') return round >= 2;

  if (mode === 'expert') return true;
  if (['KNOWLEDGE_TRANSFER','CORPORATE_TRAINING','CODIFY_SITE','TRAIN_EXPERT','LESSONS_LEARNED'].includes(actionType)) return round >= 1;
  if (actionType === 'JOIN_COP') return round >= 2;
  if (['HORIZON_SCAN','AUTOMATE'].includes(actionType)) return round >= 3;
  return true;
}

export function chartsUnlocked(mode: ExperienceMode, round: number) {
  return mode === 'expert' || round >= 3;
}
