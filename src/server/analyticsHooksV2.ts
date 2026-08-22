import { ActiveEventV2, BusinessStrategy, CompanyV2, GameSessionV2, KnowledgeStrategy } from '../types/gameV2.ts';
import { KnowledgeDomain } from '../types/game.ts';
import { evaluateEventDomainKnowledgeV2 } from '../engine/coreV2.ts';
import {
  initialiseAnalyticsRun,
  recordCompanyMetric,
  recordEventReveal,
  recordEventResolution,
  recordStrategyResponse,
  saveSessionV2,
} from './dbV2.ts';

function combinedProbability(session: GameSessionV2, company: CompanyV2, event: ActiveEventV2, baseline = false): { percent: number; domains: any[] } {
  const original = event.allocations;
  if (baseline) {
    const empty: any = {};
    event.card.domains.forEach((r) => { empty[r.domain] = {}; });
    event.allocations = empty;
  }
  try {
    const domains = event.card.domains.map((r) => {
      const e = evaluateEventDomainKnowledgeV2(session, company, event, r.domain as KnowledgeDomain, session.config);
      return {
        domain: r.domain,
        difficulty: r.difficulty,
        baseKnowledge: e.baseKnowledge,
        usableIntranet: e.usableIntranet,
        team: e.team,
        localCodified: e.localCodified,
        automationBonus: e.automationBonus,
        expertBonus: e.expertBonus,
        copBonus: e.copBonus,
        consultantPoints: e.consultantPoints,
        totalKnowledge: e.totalKnowledge,
        probabilityPercent: e.winChancePercent,
      };
    });
    const probability = domains.reduce((p, d) => p * (d.probabilityPercent / 100), 1);
    return { percent: Math.round(probability * 100), domains };
  } finally {
    event.allocations = original;
  }
}

export async function captureSessionStart(session: GameSessionV2): Promise<void> {
  await initialiseAnalyticsRun(session);
  for (const company of session.companies) {
    await captureRoundReveals(session, company);
  }
}

export async function captureRoundReveals(session: GameSessionV2, company: CompanyV2): Promise<void> {
  for (const event of session.activeEvents[company.id] || []) {
    const reveal = combinedProbability(session, company, event, true);
    event.revealProbabilityPercent = reveal.percent;
    event.turnoverBefore ??= company.turnover;
    event.siteTurnoverBefore ??= event.targetSiteId ? company.sites.find((s) => s.id === event.targetSiteId)?.turnover ?? null : null;
    await recordEventReveal(session, company, event, reveal.percent, reveal.domains);
  }
  await saveSessionV2(session);
}

export function committedProbability(session: GameSessionV2, company: CompanyV2, event: ActiveEventV2): number {
  return combinedProbability(session, company, event, false).percent;
}

export async function captureResolvedEvent(session: GameSessionV2, company: CompanyV2, event: ActiveEventV2, probabilityPercent: number, result: any): Promise<void> {
  event.committedProbabilityPercent = probabilityPercent;
  event.netFinancialImpact = Number(result.turnoverChange || 0) - Number(result.interventionCost || 0);
  company.expectedSuccesses = Math.round((company.expectedSuccesses + probabilityPercent / 100) * 1000) / 1000;
  if (result.success) company.actualSuccesses += 1;
  company.cumulativeConsultantSpend += Number(event.consultantSpend || 0);
  await saveSessionV2(session);
  await recordEventResolution(session, company, event, probabilityPercent, result);
  await recordCompanyMetric(session, company, 'EVENT_RESOLVED');
}

export async function captureKnowledgeAction(session: GameSessionV2, company: CompanyV2, result: any, actionType: string): Promise<void> {
  const cost = Number(result?.costTurnover || 0);
  if (cost > 0) company.cumulativeKnowledgeSpend += cost;
  await saveSessionV2(session);
  await recordCompanyMetric(session, company, `ACTION_${actionType}`);
}

export async function captureStateMetric(session: GameSessionV2, trigger: string): Promise<void> {
  for (const company of session.companies) await recordCompanyMetric(session, company, trigger);
}

export async function setStrategyResponse(
  session: GameSessionV2,
  company: CompanyV2,
  stage: 'initial' | 'final',
  businessStrategy: BusinessStrategy,
  knowledgeStrategy: KnowledgeStrategy,
): Promise<void> {
  if (stage === 'initial') {
    company.businessStrategyInitial = businessStrategy;
    company.knowledgeStrategyInitial = knowledgeStrategy;
  } else {
    company.businessStrategyFinal = businessStrategy;
    company.knowledgeStrategyFinal = knowledgeStrategy;
  }
  await saveSessionV2(session);
  await recordStrategyResponse(session, company, stage);
}
