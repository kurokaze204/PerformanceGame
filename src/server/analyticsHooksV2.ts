import { ActiveEventV2, BusinessStrategy, CompanyV2, GameSessionV2, KnowledgeStrategy } from '../types/gameV2.ts';
import { KnowledgeDomain } from '../types/game.ts';
import { evaluateEventDomainKnowledgeExplicitV2 } from '../engine/challengeResponseV2.ts';
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
      const e = evaluateEventDomainKnowledgeExplicitV2(session, company, event, r.domain as KnowledgeDomain, session.config);
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

function addCorporateSpend(company: CompanyV2, amount: number) {
  if (amount <= 0) return;
  company.cumulativeCorporateKnowledgeSpend += amount;
  const active = company.sites.filter((site) => !site.isClosed);
  if (!active.length) return;
  const totalTurnover = active.reduce((sum, site) => sum + site.turnover, 0);
  let remaining = amount;
  active.forEach((site, index) => {
    const share = index === active.length - 1
      ? remaining
      : Math.round(amount * (totalTurnover > 0 ? site.turnover / totalTurnover : 1 / active.length));
    company.cumulativeSiteKnowledgeSpend[site.id] = (company.cumulativeSiteKnowledgeSpend[site.id] || 0) + share;
    remaining -= share;
  });
}

function addSiteSpend(company: CompanyV2, siteId: string, amount: number) {
  if (amount <= 0) return;
  company.cumulativeSiteKnowledgeSpend[siteId] = (company.cumulativeSiteKnowledgeSpend[siteId] || 0) + amount;
}

export async function captureSessionStart(session: GameSessionV2): Promise<void> {
  await initialiseAnalyticsRun(session);
  for (const company of session.companies) await captureRoundReveals(session, company);
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

  const interventionCost = Number(result.interventionCost || 0);
  if (interventionCost > 0) {
    company.cumulativeKnowledgeSpend += interventionCost;
    if (event.card.scope === 'local' && event.targetSiteId) addSiteSpend(company, event.targetSiteId, interventionCost);
    else addCorporateSpend(company, interventionCost);
  }

  await saveSessionV2(session);
  await recordEventResolution(session, company, event, probabilityPercent, result);
  await recordCompanyMetric(session, company, 'EVENT_RESOLVED');
}

export async function captureKnowledgeAction(session: GameSessionV2, company: CompanyV2, result: any, actionType: string): Promise<void> {
  const cost = Number(result?.costTurnover || 0);
  if (cost > 0) {
    company.cumulativeKnowledgeSpend += cost;
    const directSiteId = result?.investmentAttribution?.siteId as string | undefined;
    const corporateCost = Number(result?.investmentAttribution?.corporateCost || 0);
    const directCost = Number(result?.investmentAttribution?.siteCost || 0);
    if (directSiteId && directCost > 0) addSiteSpend(company, directSiteId, directCost);
    if (corporateCost > 0) addCorporateSpend(company, corporateCost);
    if (!directSiteId && corporateCost <= 0) addCorporateSpend(company, cost);
  }
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
    company.businessStrategyFinal = company.businessStrategyInitial || businessStrategy;
    company.knowledgeStrategyFinal = knowledgeStrategy;
  }
  await saveSessionV2(session);
  await recordStrategyResponse(session, company, stage);
}