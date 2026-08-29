import type { ActiveEvent, Company, KnowledgeDomain, SimulationConfig, Site } from '../types/game.ts';
import type { ActiveEventAllocationV2, ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { V2_BALANCE, asCompanyV2, asSessionV2 } from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from './config.ts';
import {
  calculateUsableIntranetV2,
  evaluateEventDomainKnowledgeV2,
  recalculateCompanySPOFV2,
  resolveSingleEventV2,
  validateEventAllocationV2,
} from './coreV2.ts';
import { copMembershipActiveV4, recordPublicationEvidenceV4 } from './investmentActionsV4.ts';
import { expertCurveModifier } from './learningCurveBalanceV1.ts';

export interface ExplicitSourceValues {
  team: number;
  localCodified: number;
  usableIntranet: number;
  selectedTeam: number;
  selectedLocalCodified: number;
  selectedUsableIntranet: number;
  selectedBaseKnowledge: number;
}

function activeSites(company: CompanyV2): Site[] { return company.sites.filter((site) => !site.isClosed); }
function recalcCompanyTurnover(company: CompanyV2): void { company.turnover = Math.round(company.sites.reduce((sum, site) => sum + (site.isClosed ? 0 : site.turnover), 0)); }
function applySiteDelta(company: CompanyV2, site: Site, delta: number): void { site.turnover = Math.max(0, Math.round(site.turnover + delta)); recalcCompanyTurnover(company); }
function applyCompanyDelta(company: CompanyV2, delta: number): void {
  const sites = activeSites(company); if (!sites.length || delta === 0) return;
  const total = sites.reduce((sum, site) => sum + site.turnover, 0); let remaining = Math.round(delta);
  sites.forEach((site, index) => { const share = index === sites.length - 1 ? remaining : Math.round(delta * (total > 0 ? site.turnover / total : 1 / sites.length)); site.turnover = Math.max(0, site.turnover + share); remaining -= share; });
  recalcCompanyTurnover(company);
}

export function explicitSourceValuesV2(companyInput: Company,eventInput: ActiveEvent,domain: KnowledgeDomain,config: SimulationConfig = DEFAULT_CONFIG): ExplicitSourceValues {
  const company = asCompanyV2(companyInput); const event = eventInput as ActiveEventV2; const allocation: ActiveEventAllocationV2 = event.allocations[domain] || {};
  let team = 0, localCodified = 0, usableIntranet = 0;
  if (event.card.scope === 'local') {
    const site = company.sites.find((candidate) => candidate.id === event.targetSiteId && !candidate.isClosed);
    if (site) { team = site.teamCapability[domain] || 0; localCodified = site.codifiedKnowledge[domain] || 0; usableIntranet = calculateUsableIntranetV2(company, site, domain, config); }
  } else {
    for (const site of activeSites(company)) { team = Math.max(team, site.teamCapability[domain] || 0); localCodified = Math.max(localCodified, site.codifiedKnowledge[domain] || 0); usableIntranet = Math.max(usableIntranet, calculateUsableIntranetV2(company, site, domain, config)); }
  }
  const selectedTeam = allocation.useTeamCapability ? team : 0;
  const selectedLocalCodified = allocation.useLocalCodified ? localCodified : 0;
  const selectedUsableIntranet = allocation.useCorporateIntranet ? usableIntranet : 0;
  return { team, localCodified, usableIntranet, selectedTeam, selectedLocalCodified, selectedUsableIntranet, selectedBaseKnowledge: Math.max(selectedTeam, selectedLocalCodified, selectedUsableIntranet) };
}

function winChance(eventDie: number, targetThreshold: number, totalKnowledge: number): number { let wins = 0; for (let roll = 1; roll <= eventDie; roll++) if (roll + totalKnowledge >= targetThreshold) wins += 1; return Math.round((wins / eventDie) * 100); }

export function evaluateEventDomainKnowledgeExplicitV2(sessionInput: GameSessionV2,companyInput: Company,eventInput: ActiveEvent,domain: KnowledgeDomain,config: SimulationConfig = DEFAULT_CONFIG,ignoreConsultant = false) {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput); const event = eventInput as ActiveEventV2;
  const base = evaluateEventDomainKnowledgeV2(session, company, event, domain, config, true); const sources = explicitSourceValuesV2(company, event, domain, config);
  if (session.experienceMode === 'newbie') { sources.localCodified = 0; sources.selectedLocalCodified = 0; sources.selectedBaseKnowledge = Math.max(sources.selectedTeam, sources.selectedUsableIntranet); }
  const difficulty = event.card.domains.find((requirement) => requirement.domain === domain)?.difficulty ?? base.difficulty; const allocation = event.allocations[domain] || {};
  const copBonus = allocation.useCoPSupport && copMembershipActiveV4(session, company.id, domain) ? config.cop_support_bonus : 0;
  const expertModifier = allocation.expertId ? expertCurveModifier(session.experienceMode, session.round, event.card) : 0;
  const expertBonus = Math.max(0, base.expertBonus + expertModifier);
  const withoutConsultant = sources.selectedBaseKnowledge + expertBonus + copBonus + base.automationBonus;
  const consultantPoints = ignoreConsultant ? 0 : Math.max(0, Math.min(V2_BALANCE.consultantMaxPointsPerDomain, allocation.consultantPoints || 0));
  const totalKnowledge = withoutConsultant + consultantPoints; const targetThreshold = difficulty + config.resolution_offset; const winChancePercent = winChance(config.event_die, targetThreshold, totalKnowledge);
  const likelihood = winChancePercent >= 90 ? 'Very High' : winChancePercent >= 70 ? 'High' : winChancePercent >= 40 ? 'Moderate' : winChancePercent >= 20 ? 'Low' : 'Very Low'; const usefulGap = Math.max(0, targetThreshold - withoutConsultant);
  return { ...base, expertBonus, expertCurveModifier: expertModifier, team: sources.selectedTeam, localCodified: sources.selectedLocalCodified, usableIntranet: sources.selectedUsableIntranet, baseKnowledge: sources.selectedBaseKnowledge, copBonus, consultantPoints, usefulConsultantGap: Math.min(V2_BALANCE.consultantMaxPointsPerDomain, usefulGap), totalKnowledge, difficulty, targetThreshold, requiredDie: targetThreshold - totalKnowledge, winChancePercent, likelihood, availableSources: sources };
}

export function validateEventAllocationExplicitV2(sessionInput: GameSessionV2,companyInput: Company,eventInput: ActiveEvent,domain: KnowledgeDomain,allocation: ActiveEventAllocationV2): { ok: boolean; message?: string } {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput); const event = eventInput as ActiveEventV2;
  if (session.experienceMode === 'newbie' && allocation.useLocalCodified) allocation = { ...allocation, useLocalCodified: false };
  const old = event.allocations[domain]; const v4CopAllowed = !!allocation.useCoPSupport && copMembershipActiveV4(session, company.id, domain);
  event.allocations[domain] = { ...allocation, consultantPoints: 0, useCoPSupport: v4CopAllowed ? false : allocation.useCoPSupport };
  const baseValidation = validateEventAllocationV2(session, company, event, domain, event.allocations[domain]); event.allocations[domain] = old; if (!baseValidation.ok) return baseValidation;
  if (allocation.useCoPSupport && !v4CopAllowed) return { ok: false, message: 'No active Community of Practice is available for this domain.' };
  if (allocation.consultantPoints != null) { const points = Math.floor(allocation.consultantPoints); if (points < 0 || points > V2_BALANCE.consultantMaxPointsPerDomain) return { ok: false, message: 'Consultant support is limited to 3 knowledge points per domain.' }; }
  return { ok: true };
}

export function resolveSingleEventExplicitV2(sessionInput: GameSessionV2, companyInput: Company, eventInput: ActiveEvent) {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput); const event = eventInput as ActiveEventV2;
  const originalDifficulties = new Map<KnowledgeDomain, number>(); const penalties = new Map<KnowledgeDomain, number>(); const expertModifiers = new Map<KnowledgeDomain, number>(); const sourceSnapshots = new Map<KnowledgeDomain, ExplicitSourceValues>(); const plannedTravelByExpert = new Map<string, number>(); const temporaryCopMemberships: any[] = [];
  for (const requirement of event.card.domains) {
    const domain = requirement.domain; const allocation = event.allocations[domain] || {};
    if (session.experienceMode === 'newbie') allocation.useLocalCodified = false;
    if (allocation.expertId && !plannedTravelByExpert.has(allocation.expertId)) plannedTravelByExpert.set(allocation.expertId, Math.max(0, allocation.expertTravelCost || 0));
    if (allocation.useCoPSupport && copMembershipActiveV4(session, company.id, domain)) { const ownCurrent = { companyId: company.id, domain, expertId: 'cop-network', activeRound: session.round }; const externalCurrent = { companyId: `external-network-${company.id}`, domain, expertId: 'external-peer', activeRound: session.round }; session.copMemberships.push(ownCurrent, externalCurrent); temporaryCopMemberships.push(ownCurrent, externalCurrent); }
    originalDifficulties.set(domain, requirement.difficulty);
    const automatic = evaluateEventDomainKnowledgeV2(session, company, event, domain, session.config, true).baseKnowledge; const sources = explicitSourceValuesV2(company, event, domain, session.config);
    if (session.experienceMode === 'newbie') { sources.localCodified = 0; sources.selectedLocalCodified = 0; sources.selectedBaseKnowledge = Math.max(sources.selectedTeam, sources.selectedUsableIntranet); }
    sourceSnapshots.set(domain, sources); const penalty = Math.max(0, automatic - sources.selectedBaseKnowledge); penalties.set(domain, penalty);
    const expertModifier = allocation.expertId ? expertCurveModifier(session.experienceMode, session.round, event.card) : 0; expertModifiers.set(domain, expertModifier);
    requirement.difficulty += penalty - expertModifier;
  }
  try {
    const result = resolveSingleEventV2(session, company, event);
    const plannedTravel = [...plannedTravelByExpert.values()].reduce((sum, cost) => sum + cost, 0); const consultantSpend = (result.consultantDetails || []).reduce((sum: number, item: any) => sum + (item.cost || 0), 0); const rolledTravel = Math.max(0, result.interventionCost - consultantSpend); const travelCorrection = plannedTravel - rolledTravel;
    if (travelCorrection !== 0) { if (event.card.scope === 'local' && event.targetSiteId) { const target = company.sites.find((site) => site.id === event.targetSiteId && !site.isClosed); if (target) applySiteDelta(company, target, -travelCorrection); } else applyCompanyDelta(company, -travelCorrection); result.interventionCost += travelCorrection; }
    for (const requirement of event.card.domains) { const allocation = event.allocations[requirement.domain]; if (allocation?.expertId) allocation.expertTravelCost = plannedTravelByExpert.get(allocation.expertId) || 0; }
    const normalized = result.domainResults.map((domainResult: any) => { const domain = domainResult.domain as KnowledgeDomain; const penalty = penalties.get(domain) || 0; const modifier = expertModifiers.get(domain) || 0; const sources = sourceSnapshots.get(domain)!; const originalDifficulty = originalDifficulties.get(domain) ?? domainResult.difficulty; const totalKnowledge = Math.max(0, domainResult.totalKnowledge - penalty + modifier); const requiredTotal = originalDifficulty + session.config.resolution_offset; const achievedTotal = domainResult.dieRoll + totalKnowledge; return { ...domainResult, baseKnowledge: sources.selectedBaseKnowledge, usableIntranet: sources.selectedUsableIntranet, team: sources.selectedTeam, localCodified: sources.selectedLocalCodified, expertCurveModifier: modifier, totalKnowledge, difficulty: originalDifficulty, requiredTotal, achievedTotal, explanation: `Selected knowledge ${totalKnowledge}; rolled ${domainResult.dieRoll}; needed ${requiredTotal}.` }; });
    event.domainResults = normalized;
    result.domainResults = normalized;
    const highValueEvidence = event.card.tags?.some((tag) => ['critical','safety','site-threatening','specialist','novel'].includes(tag)) ? 2 : 1;
    for (const requirement of event.card.domains) recordPublicationEvidenceV4(company, requirement.domain, highValueEvidence);
    recalculateCompanySPOFV2(company, session.config);
    return result;
  } finally { if (temporaryCopMemberships.length) session.copMemberships = session.copMemberships.filter((m) => !temporaryCopMemberships.includes(m)); for (const requirement of event.card.domains) { const original = originalDifficulties.get(requirement.domain); if (original != null) requirement.difficulty = original; } }
}
