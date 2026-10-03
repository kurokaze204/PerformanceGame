import type { KnowledgeDomain } from './game.ts';

export type KMWeekStage = 'guided' | 'free' | 'shock' | 'complete';
export type KMWeekPhase = 'challenge' | 'invest';
export type KMWeekResolutionMethod = 'local' | 'expert' | 'risk';
export type KMWeekInvestment = 'TRAIN_EXPERT' | 'LOCAL_TRAINING' | 'KNOWLEDGE_TRANSFER';
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
}

export interface KMWeekScore {
  business: number;
  expertise: number;
  localCapability: number;
  knowledgeFlow: number;
  resilience: number;
  goal: number;
  total: number;
}

export interface KMWeekShockCheck {
  id: string;
  siteId: string;
  domain: KnowledgeDomain;
  difficulty: number;
  passed: boolean;
}

export interface KMWeekCompanyState {
  stage: KMWeekStage;
  phase: KMWeekPhase;
  guidedTurn: number;
  freeRound: number;
  challenges: KMWeekChallenge[];
  usedExpertIds: string[];
  freeSuccesses: number;
  localSuccesses: number;
  expertSuccesses: number;
  riskSuccesses: number;
  knowledgeTransfers: number;
  meaningfulTransfers: number;
  investmentHistory: KMWeekInvestmentRecord[];
  shockChecks: KMWeekShockCheck[];
  shockResolved: boolean;
  score: KMWeekScore;
  lastMessage?: string;
}

export interface KMWeekGoal {
  id: KMWeekGoalId;
  title: string;
  description: string;
  points: number;
}
