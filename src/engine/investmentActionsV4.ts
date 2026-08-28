import type { ActionPayload, KnowledgeDomain, Site } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { AUSTRALIAN_CITIES, HQ_COORDINATES } from './config.ts';
import { recalculateCompanySPOFV2 } from './coreV2.ts';

export const INVESTMENT_COSTS_V4: Record<string, number> = {
  KNOWLEDGE_TRANSFER: 18,
  CORPORATE_TRAINING: 95,
  CODIFY_SITE: 20,
  TRAIN_EXPERT: 20,
  UPDATE_INTRANET: 35,
  LESSONS_LEARNED: 15,
  JOIN_COP: 25,
  HORIZON_SCAN: 80,
  AUTOMATE: 150,
};

const DOMAIN_ORDER: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];
const cityPoint = (id: string) => id === 'HQ' ? HQ_COORDINATES : AUSTRALIAN_CITIES.find((city) => city.id === id)?.coordinates;
const cityDistances = AUSTRALIAN_CITIES.flatMap((a, i) => AUSTRALIAN_CITIES.slice(i + 1).map((b) => Math.hypot(a.coordinates.x - b.coordinates.x, a.coordinates.y - b.coordinates.y)));
const minCityDistance = Math.min(...cityDistances);
const maxCityDistance = Math.max(...cityDistances);

export function expertTravelCostV4(from: string, target?: string): number {
  if (!target || from === target) return 0;
  const a = cityPoint(from); const b = cityPoint(target);
  if (!a || !b) return 0;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  const scaled = Math.max(0, Math.min(1, (distance - minCityDistance) / Math.max(0.001, maxCityDistance - minCityDistance)));
  return Math.round((25 + scaled * 50) / 5) * 5;
}

function companyBestKnowledge(company: CompanyV2, domain: KnowledgeDomain): number {
  const siteBest = Math.max(0, ...company.sites.filter((s) => !s.isClosed).map((s) => Math.max(s.teamCapability[domain] || 0, s.codifiedKnowledge[domain] || 0)));
  const expertBest = Math.max(0, ...company.experts.filter((e) => !e.isVacant).flatMap((e) => e.domains.filter((d) => d.domain === domain).map((d) => d.score)));
  return Math.max(company.intranet[domain] || 0, siteBest, expertBest);
}

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = ((value << 5) - value + text.charCodeAt(i)) | 0;
  return Math.abs(value);
}

export function copPeerKnowledgeScoreV4(session: GameSessionV2, company: CompanyV2, domain: KnowledgeDomain): number {
  const own = companyBestKnowledge(company, domain);
  const others = session.companies.filter((c) => c.id !== company.id);
  if (others.length) return Math.max(0, ...others.map((c) => companyBestKnowledge(c, domain)));
  // Solo games simulate a wider professional community. Three of the five domains
  // expose knowledge materially above the player's current organisation so the
  // value of external networks is visible even without another player company.
  const strong = (hash(`${session.id}:${domain}`) % 5) < 3;
  return strong ? Math.min(8, own + 2) : own;
}

export function copMembershipActiveV4(session: GameSessionV2, companyId: string, domain: KnowledgeDomain): boolean {
  return session.copMemberships.some((m) => m.companyId === companyId && m.domain === domain && m.activeRound >= session.round);
}

function recalcTurnover(company: CompanyV2) {
  company.turnover = Math.round(company.sites.reduce((sum, site) => sum + (site.isClosed ? 0 : site.turnover), 0));
}

function spendCompany(company: CompanyV2, amount: number) {
  const active = company.sites.filter((s) => !s.isClosed);
  if (!active.length || amount <= 0) return;
  const total = active.reduce((sum, s) => sum + s.turnover, 0);
  let remaining = Math.round(amount);
  active.forEach((site, index) => {
    const share = index === active.length - 1 ? remaining : Math.round(amount * (total > 0 ? site.turnover / total : 1 / active.length));
    site.turnover = Math.max(0, site.turnover - share);
    remaining -= share;
  });
  recalcTurnover(company);
}

function expertAvailable(expert: CompanyV2['experts'][number]) {
  return !expert.isVacant && (expert.state === 'Available' || expert.state === 'HQ Assignment');
}

export function isInvestmentActionV4(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(INVESTMENT_COSTS_V4, type);
}

export function executeInvestmentActionV4(session: GameSessionV2, company: CompanyV2, payload: ActionPayload) {
  if (session.phase !== 'investment') return { success: false, message: 'Knowledge actions can only be used during the Invest phase.' };
  if (company.actionsRemaining <= 0) return { success: false, message: 'No knowledge actions remaining this round.' };
  const { type, siteId, expertId, domain, learningTarget } = payload;
  const baseCost = INVESTMENT_COSTS_V4[type] ?? 0;
  const findSite = () => company.sites.find((s) => s.id === siteId && !s.isClosed);
  const findExpert = () => company.experts.find((e) => e.id === expertId && !e.isVacant);
  const consume = (totalCost: number) => { spendCompany(company, totalCost); company.actionsRemaining -= 1; recalculateCompanySPOFV2(company, session.config); };

  if (type === 'KNOWLEDGE_TRANSFER') {
    if (!siteId || !expertId || !domain) return { success: false, message: 'Choose a site, expert and domain.' };
    const site = findSite(); const expert = findExpert();
    if (!site || !expert || !expertAvailable(expert)) return { success: false, message: 'Choose an available expert and active site.' };
    const skill = expert.domains.find((x) => x.domain === domain);
    if (!skill) return { success: false, message: 'That expert does not have this domain.' };
    if (site.teamCapability[domain] >= skill.score) return { success: false, message: 'Team capability is already at the expert ceiling.' };
    const travelCost = expertTravelCostV4(expert.location, site.id);
    site.teamCapability[domain] = Math.min(6, site.teamCapability[domain] + 1);
    expert.state = 'Knowledge Transfer';
    consume(baseCost + travelCost);
    return { success: true, message: `${site.name} ${domain} Team Capability increased to ${site.teamCapability[domain]}. Cost $${baseCost + travelCost}k${travelCost ? ` including $${travelCost}k travel` : ''}.`, costTurnover: baseCost + travelCost, travelCost };
  }

  if (type === 'TRAIN_EXPERT') {
    if (!expertId || !domain) return { success: false, message: 'Choose an expert and domain.' };
    const expert = findExpert(); if (!expert || !expertAvailable(expert)) return { success: false, message: 'Expert is unavailable.' };
    const skill = expert.domains.find((x) => x.domain === domain); if (!skill) return { success: false, message: 'Domain not held by expert.' };
    if (skill.score >= 8) return { success: false, message: 'This expert is already at the maximum score.' };
    skill.score += 1; expert.state = 'Training'; consume(baseCost);
    return { success: true, message: `${expert.name} increased ${domain} expertise to ${skill.score}. Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'CORPORATE_TRAINING') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    let changed = 0;
    company.sites.forEach((site) => { if (!site.isClosed && site.teamCapability[domain] < company.intranet[domain]) { site.teamCapability[domain] += 1; changed++; } });
    if (!changed) return { success: false, message: 'No site can currently benefit from this Corporate Training.' };
    consume(baseCost);
    return { success: true, message: `${domain} Team Capability increased at ${changed} site(s). Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'CODIFY_SITE') {
    if (!siteId || !domain) return { success: false, message: 'Choose a site and domain.' };
    const site = findSite(); if (!site) return { success: false, message: 'Site not found.' };
    if (site.codifiedKnowledge[domain] >= site.teamCapability[domain]) return { success: false, message: 'Local knowledge is already codified to Team Capability.' };
    site.codifiedKnowledge[domain] += 1; consume(baseCost);
    return { success: true, message: `${site.name} ${domain} Local Codified Knowledge increased to ${site.codifiedKnowledge[domain]}. Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'UPDATE_INTRANET') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    const remaining = session.config.max_intranet_domain_growth_per_round - company.intranetRoundGrowth[domain];
    if (remaining <= 0) return { success: false, message: 'This Intranet domain has reached its growth limit for the round.' };
    const hqSkills = company.experts.flatMap((e) => !e.isVacant && e.location === 'HQ' ? e.domains.filter((x) => x.domain === domain).map((x) => x.score) : []);
    const highestSite = Math.max(...company.sites.filter((s) => !s.isClosed).map((s) => Math.max(s.teamCapability[domain], s.codifiedKnowledge[domain])), 0);
    const sourceCeiling = Math.max(highestSite, ...hqSkills, 0);
    if (company.intranet[domain] >= sourceCeiling) return { success: false, message: 'No deeper organisational knowledge is currently available to publish.' };
    const increment = hqSkills.length ? session.config.hq_expert_intranet_increment : session.config.normal_intranet_increment;
    const growth = Math.min(increment, remaining, sourceCeiling - company.intranet[domain]);
    company.intranet[domain] += growth; company.intranetRoundGrowth[domain] += growth; consume(baseCost);
    return { success: true, message: `${domain} Corporate Intranet increased +${growth} to ${company.intranet[domain]}. Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'LESSONS_LEARNED') {
    if (!siteId || !domain || !learningTarget) return { success: false, message: 'Choose site, domain and learning target.' };
    const site = findSite(); if (!site) return { success: false, message: 'Site not found.' };
    const relevant = (session.activeEvents[company.id] || []).some((e) => e.isResolved && e.card.domains.some((r) => r.domain === domain) && (e.card.scope === 'enterprise' || e.targetSiteId === site.id));
    if (!relevant) return { success: false, message: 'Lessons Learned requires a relevant event from this round.' };
    if (learningTarget === 'team') site.teamCapability[domain] = Math.min(6, site.teamCapability[domain] + 1);
    else site.codifiedKnowledge[domain] = Math.min(6, site.codifiedKnowledge[domain] + 1);
    consume(baseCost);
    return { success: true, message: `Lessons Learned increased ${site.name} ${domain} ${learningTarget === 'team' ? 'Team Capability' : 'Codified Knowledge'} +1. Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'JOIN_COP') {
    if (!expertId || !domain) return { success: false, message: 'Choose an expert and domain.' };
    const expert = findExpert(); if (!expert || !expertAvailable(expert) || !expert.domains.some((x) => x.domain === domain)) return { success: false, message: 'Eligible available expert required.' };
    const existing = session.copMemberships.find((m) => m.companyId === company.id && m.domain === domain);
    // activeRound is treated as the last active round. Joining during Invest gives
    // access for the next two challenge rounds, without taking the expert out of play.
    const activeThrough = session.round + 2;
    if (existing) { existing.expertId = expert.id; existing.activeRound = activeThrough; }
    else session.copMemberships.push({ companyId: company.id, domain, expertId: expert.id, activeRound: activeThrough });
    consume(baseCost);
    return { success: true, message: `${expert.name} joined the ${domain} CoP. Network support is available for the next two rounds. Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'HORIZON_SCAN') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    company.horizonScanDomain = domain; company.horizonScanAvailableRound = session.round + 1; company.horizonScanUsedThisRound = false; consume(baseCost);
    return { success: true, message: `${domain} Horizon Scan armed for next round. Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  if (type === 'AUTOMATE') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    if (company.automatedDomains.includes(domain)) return { success: false, message: 'This domain is already automated.' };
    company.automatedDomains.push(domain); consume(baseCost);
    return { success: true, message: `${domain} automated company-wide (+${session.config.automation_bonus} future challenge knowledge). Cost $${baseCost}k.`, costTurnover: baseCost };
  }

  return { success: false, message: 'Unknown V4 investment action.' };
}
