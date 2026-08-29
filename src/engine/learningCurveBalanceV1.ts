import type { ExperienceMode } from '../types/gameV2.ts';
import type { EventCard } from '../types/game.ts';

export interface LearningCurveProfile {
  defaultActionsPerRound: number;
  showLocalCodifiedKnowledge: boolean;
  expertEarlyBonus: number;
  expertMiddlePenalty: number;
  expertLateSpecialistBonus: number;
  expertEarlyThroughRound: number;
  expertMiddleThroughRound: number;
  specialistThreshold: number;
}

export const LEARNING_CURVE_PROFILES: Record<ExperienceMode, LearningCurveProfile> = {
  newbie: {
    defaultActionsPerRound: 5,
    showLocalCodifiedKnowledge: false,
    expertEarlyBonus: 2,
    expertMiddlePenalty: 1,
    expertLateSpecialistBonus: 2,
    expertEarlyThroughRound: 2,
    expertMiddleThroughRound: 4,
    specialistThreshold: 4,
  },
  expert: {
    defaultActionsPerRound: 3,
    showLocalCodifiedKnowledge: true,
    expertEarlyBonus: 3,
    expertMiddlePenalty: 2,
    expertLateSpecialistBonus: 4,
    expertEarlyThroughRound: 2,
    expertMiddleThroughRound: 6,
    specialistThreshold: 4,
  },
};

export function defaultActionsForMode(mode: ExperienceMode): number {
  return LEARNING_CURVE_PROFILES[mode].defaultActionsPerRound;
}

export function localCodifiedVisible(mode: ExperienceMode): boolean {
  return LEARNING_CURVE_PROFILES[mode].showLocalCodifiedKnowledge;
}

export function inferredSpecialisation(card: EventCard): number {
  const tags = card.tags || [];
  // Late escalation alone is not enough to justify an Expert. The challenge must
  // genuinely be specialist/novel (or unusually multi-domain) so the late-game
  // Expert return remains a selective troubleshooting move rather than a generic buff.
  if (tags.includes('specialist') || tags.includes('specialised') || tags.includes('novel')) return 5;
  if (card.domains.length >= 3) return 4;
  if (tags.includes('critical') || tags.includes('safety')) return 3;
  if (card.domains.length === 2) return 3;
  return 2;
}

/**
 * Relative modifier applied on top of the normal Expert support calculation.
 * Positive early: Experts are the obvious high-confidence answer.
 * Negative middle: organisational capability should replace routine dependence.
 * Positive late only for genuinely specialist/novel challenges: Experts return as master troubleshooters.
 */
export function expertCurveModifier(mode: ExperienceMode, round: number, card: EventCard): number {
  const p = LEARNING_CURVE_PROFILES[mode];
  if (round <= p.expertEarlyThroughRound) return p.expertEarlyBonus;
  if (round <= p.expertMiddleThroughRound) return -p.expertMiddlePenalty;
  return inferredSpecialisation(card) >= p.specialistThreshold ? p.expertLateSpecialistBonus : -1;
}

export function expertCurveLabel(mode: ExperienceMode, round: number, card: EventCard): 'hero'|'bottleneck'|'troubleshooter'|'routine-late' {
  const p = LEARNING_CURVE_PROFILES[mode];
  if (round <= p.expertEarlyThroughRound) return 'hero';
  if (round <= p.expertMiddleThroughRound) return 'bottleneck';
  return inferredSpecialisation(card) >= p.specialistThreshold ? 'troubleshooter' : 'routine-late';
}
