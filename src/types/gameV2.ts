import {
  ActiveEvent,
  ActiveEventAllocation,
  Company,
  EventType,
  Expert,
  GameSession,
  KnowledgeDomain,
} from './game.ts';

export interface ActiveEventAllocationV2 extends ActiveEventAllocation {
  consultantPoints?: number;
  consultantCost?: number;
  expertTravelCost?: number;
}

export interface ActiveEventV2 extends ActiveEvent {
  allocations: Record<KnowledgeDomain, ActiveEventAllocationV2>;
  resolvedAt?: string;
  consultantSpend?: number;
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
}

export interface RiskSummaryV2 {
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
}

export interface V2BalanceConfig {
  consultantBaseRate: number;
  consultantEscalation: number;
  consultantMaxPointsPerDomain: number;
  expertTravelCostDieMultiplier: number;
  lateBalanceElapsedMinutes: number;
  lateBalanceMaxTypeGap: number;
  timerDurationSeconds: number;
}

export const V2_BALANCE: V2BalanceConfig = {
  consultantBaseRate: 15,
  consultantEscalation: 1.35,
  consultantMaxPointsPerDomain: 3,
  expertTravelCostDieMultiplier: 10,
  lateBalanceElapsedMinutes: 40,
  lateBalanceMaxTypeGap: 2,
  timerDurationSeconds: 50 * 60,
};

export function asCompanyV2(company: Company): CompanyV2 {
  const c = company as CompanyV2;
  c.consultantEngagements ??= 0;
  c.eventTypePlan ??= [];
  c.eventsDrawnCount ??= 0;
  c.problemEventsDrawn ??= 0;
  c.opportunityEventsDrawn ??= 0;
  c.horizonScanAvailableRound ??= null;
  return c;
}

export function asSessionV2(session: GameSession): GameSessionV2 {
  const s = session as GameSessionV2;
  s.companies = s.companies.map(asCompanyV2);
  s.timerStartedAt ??= null;
  s.timerEndsAt ??= null;
  s.timerPausedSecondsRemaining ??= null;
  s.riskResults ??= null;
  return s;
}
