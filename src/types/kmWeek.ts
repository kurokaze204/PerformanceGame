import type { KnowledgeDomain } from './game.ts';

export type KMWeekStage = 'guided' | 'free' | 'shock' | 'complete';
export type KMWeekPhase = 'challenge' | 'invest';
export type KMWeekResolutionMethod = 'local' | 'expert' | 'risk';
export type KMWeekInvestment = 'TRAIN_EXPERT' | 'LOCAL_TRAINING' | 'KNOWLEDGE_TRANSFER' | 'AFTER_ACTION_REVIEW';
export type KMWeekGoalId = 'local-heroes' | 'deep-bench' | 'broad-base' | 'balanced-network';

export interface KMWeekChallenge {
  id: string;
  title: string;
  story: string;
  siteId: string;
  domain: KnowledgeDomain;
  difficulty: number;
  impact: number;
  status: 'open' | 'success' | 'failure';
  resolution?: KMWeekResolutionMethod;
  expertId?: string;
  dieRoll?: number;
  turnoverChange?: number;
  travelCost?: number;
  guided?: boolean;
}

export interface KMWeekInvestmentRecord {
  roundLabel: string;
  type: KMWeekInvestment;
  domain: KnowledgeDomain;
  expertId?: string;
  siteId?: string;
  sourceSiteId?: string;
  targetSiteId?: string;
  before: number;
  after: number;
  meaningfulFlow?: boolean;
  challengeId?: string;
  expertBefore?: number;
  expertAfter?: number;
}

export interface KMWeekTurnoverPoint {
  label: string;
  turnover: number;
  /** Actual Challenge outcome, so the AAR can show red/green dots even when travel costs exceed a win. */
  challengeResult?: 'success' | 'failure';
}

export interface KMWeekScore {
  business: number;
  expertise: number;
  localCapability: number;
  knowledgeFlow: number;
  resilience: number;
  goal: number;
  /** Final turnover placement points, awarded once all companies finish. */
  turnover: number;
  total: number;
}

export interface KMWeekShockCheck {
  id: string;
  siteId: string;
  domain: KnowledgeDomain;
  difficulty: number;
  localKnowledge: number;
  passed: boolean;
  resolution?: 'ready' | 'risk' | 'accept';
  dieRoll?: number;
  recovered?: boolean;
}

export interface KMWeekExpertRetirement {
  expertId: string;
  domain: KnowledgeDomain;
  retiredName: string;
  retiredScore: number;
  retiredAtRound: number;
  replacementRound: number;
  replacementName: string;
  replacementScore?: number;
  status: 'retired' | 'replaced';
}

export interface KMWeekCompanyState {
  stage: KMWeekStage;
  phase: KMWeekPhase;
  guidedTurn: number;
  freeRound: number;
  challenges: KMWeekChallenge[];
  usedExpertIds: string[];
  trainingCommitments?: Record<string, number>;
  freeSuccesses: number;
  businessDifficultySolved?: number;
  localSuccesses: number;
  expertSuccesses: number;
  riskSuccesses: number;
  knowledgeTransfers: number;
  meaningfulTransfers: number;
  investmentHistory: KMWeekInvestmentRecord[];
  turnoverHistory: KMWeekTurnoverPoint[];
  shockChecks: KMWeekShockCheck[];
  shockResolved: boolean;
  /** Turnover before the Site Audits; the UI applies the result when the fine orb arrives. */
  auditTurnoverBefore?: number;
  /** Recorded fines, including zero for a clean audit result. */
  auditFineTotal?: number;
  expertRetirement?: KMWeekExpertRetirement;
  score: KMWeekScore;
  lastMessage?: string;
}

export interface KMWeekGoal {
  id: KMWeekGoalId;
  title: string;
  description: string;
  points: number;
}
