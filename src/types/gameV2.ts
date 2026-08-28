import {
  ActiveEvent,
  ActiveEventAllocation,
  Company,
  EventType,
  Expert,
  GameSession,
  KnowledgeDomain,
} from './game.ts';

export type BusinessStrategy =
  | 'short_term_profit'
  | 'growth'
  | 'downside_protection'
  | 'balanced'
  | 'adaptive';

export type KnowledgeStrategy =
  | 'rely_on_people'
  | 'build_team_capability'
  | 'capture_knowledge'
  | 'build_networks'
  | 'automate_critical_knowledge'
  | 'buy_expertise'
  | 'no_particular_strategy';

export interface ActiveEventAllocationV2 extends ActiveEventAllocation {
  useTeamCapability?: boolean;
  useLocalCodified?: boolean;
  useCorporateIntranet?: boolean;
  acceptRisk?: boolean;
  consultantPoints?: number;
  consultantCost?: number;
  expertTravelCost?: number;
}

export interface ActiveEventV2 extends ActiveEvent {
  allocations: Record<KnowledgeDomain, ActiveEventAllocationV2>;
  resolvedAt?: string;
  consultantSpend?: number;
  revealProbabilityPercent?: number;
  committedProbabilityPercent?: number;
  turnoverBefore?: number;
  siteTurnoverBefore?: number | null;
  netFinancialImpact?: number;
  reputationUsed?: boolean;
}

export interface ExpertV2 extends Expert {
  replacementDueRound?: number | null;
}

export interface CompanyV2 extends Company {
  experts: ExpertV2[];
  consultantEngagements: number;
  eventTypePlan: EventType[];
  eventsDrawnCount: number;
  problemEventsDrawn: number;
  opportunityEventsDrawn: number;
  horizonScanAvailableRound: number | null;
  reputationPoints: number;
  reputationPointsStarted: number;

  // AAR / benchmarking state
  businessStrategyInitial: BusinessStrategy | null;
  knowledgeStrategyInitial: KnowledgeStrategy | null;
  businessStrategyFinal: BusinessStrategy | null;
  knowledgeStrategyFinal: KnowledgeStrategy | null;
  expectedSuccesses: number;
  actualSuccesses: number;
  cumulativeKnowledgeSpend: number;
  cumulativeConsultantSpend: number;

  // Cost attribution for the round-by-round charts. Site totals include direct
  // local spend plus that site's allocated share of corporate spend.
  cumulativeCorporateKnowledgeSpend: number;
  cumulativeSiteKnowledgeSpend: Record<string, number>;
}

export interface RiskSummaryV2 {
  expertChecks?: {
    expertId: string;
    expertName: string;
    domains: KnowledgeDomain[];
    wasSPOF: boolean;
    roll: number;
    threshold: number;
    departed: boolean;
    location: string;
  }[];
  siteChecks?: {
    siteId: string;
    siteName: string;
    domain: KnowledgeDomain | null;
    previousScore: number | null;
    newScore: number | null;
    knowledgeLost: boolean;
    roll?: number;
    threshold?: number;
  }[];
  departedExperts: {
    expertId: string;
    expertName: string;
    domains: KnowledgeDomain[];
    wasSPOF: boolean;
    roll: number;
  }[];
  workforceAttrition: {
    siteName: string;
    domain: KnowledgeDomain;
    previousScore: number;
    newScore: number;
  }[];
  closedSites: string[];
}

export interface GameSessionV2 extends Omit<GameSession, 'companies' | 'activeEvents'> {
  companies: CompanyV2[];
  activeEvents: Record<string, ActiveEventV2[]>;
  timerStartedAt: string | null;
  timerEndsAt: string | null;
  timerPausedSecondsRemaining: number | null;
  riskResults: Record<string, RiskSummaryV2> | null;
  rulesVersion: string;
  deckVersion: string;
  balanceVersion: string;
}

export interface V2BalanceConfig {
  consultantBaseRate: number;
  consultantEscalation: number;
  consultantMaxPointsPerDomain: number;
  expertTravelCostDieMultiplier: number;
  lateBalanceElapsedMinutes: number;
  lateBalanceMaxTypeGap: number;
  timerDurationSeconds: number;
  startingReputationPoints: number;
}

export const V2_BALANCE: V2BalanceConfig = {
  consultantBaseRate: 15,
  consultantEscalation: 1.35,
  consultantMaxPointsPerDomain: 3,
  expertTravelCostDieMultiplier: 10,
  lateBalanceElapsedMinutes: 40,
  lateBalanceMaxTypeGap: 2,
  timerDurationSeconds: 50 * 60,
  startingReputationPoints: 2,
};

export const V2_VERSION = {
  rules: '2.2.0-alpha.1',
  deck: '1.2.0',
  balance: '2.1.0-alpha.2',
};

export function asCompanyV2(company: Company): CompanyV2 {
  const c = company as CompanyV2;
  c.consultantEngagements ??= 0;
  c.eventTypePlan ??= [];
  c.eventsDrawnCount ??= 0;
  c.problemEventsDrawn ??= 0;
  c.opportunityEventsDrawn ??= 0;
  c.horizonScanAvailableRound ??= null;
  c.reputationPointsStarted = Math.min(c.reputationPointsStarted ?? V2_BALANCE.startingReputationPoints, V2_BALANCE.startingReputationPoints);
  c.reputationPoints = Math.min(c.reputationPoints ?? c.reputationPointsStarted, V2_BALANCE.startingReputationPoints);
  c.businessStrategyInitial ??= null;
  c.knowledgeStrategyInitial ??= null;
  c.businessStrategyFinal ??= null;
  c.knowledgeStrategyFinal ??= null;
  c.expectedSuccesses ??= 0;
  c.actualSuccesses ??= 0;
  c.cumulativeKnowledgeSpend ??= 0;
  c.cumulativeConsultantSpend ??= 0;
  c.cumulativeCorporateKnowledgeSpend ??= 0;
  c.cumulativeSiteKnowledgeSpend ??= {};
  for (const site of c.sites || []) c.cumulativeSiteKnowledgeSpend[site.id] ??= 0;
  return c;
}

export function asSessionV2(session: GameSession): GameSessionV2 {
  const s = session as GameSessionV2;
  s.companies = s.companies.map(asCompanyV2);
  s.timerStartedAt ??= null;
  s.timerEndsAt ??= null;
  s.timerPausedSecondsRemaining ??= null;
  s.riskResults ??= null;
  s.rulesVersion ??= V2_VERSION.rules;
  s.deckVersion ??= V2_VERSION.deck;
  s.balanceVersion ??= V2_VERSION.balance;
  return s;
}