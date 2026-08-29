import type { ExperienceMode } from '../types/gameV2.ts';

export type CapabilityGroup = 'internal' | 'expert' | 'network' | 'foresight';

export function capabilityUnlocked(mode: ExperienceMode, round: number, group: CapabilityGroup) {
  if (mode === 'expert') return true;
  if (group === 'internal' || group === 'expert') return round >= 1;
  if (group === 'network') return round >= 2;
  return round >= 3;
}

export function interventionUnlocked(mode: ExperienceMode, round: number, actionType: string) {
  // Local Codified Knowledge is intentionally removed from the Newbie decision model.
  // The deeper tacit/codified distinction remains available in Expert mode.
  if (mode === 'newbie' && actionType === 'CODIFY_SITE') return false;

  // UPDATE_INTRANET is additionally gated in the Invest UI by completion of the
  // programmed opening knowledge-isolation lesson. Keeping it mechanically valid
  // in Round 1 lets the lesson explicitly open the intervention at the end of the
  // first Challenge sequence rather than waiting for an arbitrary round boundary.
  if (mode === 'expert') return true;
  if (['KNOWLEDGE_TRANSFER','CORPORATE_TRAINING','TRAIN_EXPERT','UPDATE_INTRANET','LESSONS_LEARNED'].includes(actionType)) return round >= 1;
  if (actionType === 'JOIN_COP') return round >= 2;
  if (['HORIZON_SCAN','AUTOMATE'].includes(actionType)) return round >= 3;
  return true;
}

export function chartsUnlocked(mode: ExperienceMode, round: number) {
  return mode === 'expert' || round >= 3;
}
