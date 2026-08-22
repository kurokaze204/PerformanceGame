import {
  ActionPayload,
  ActiveEvent,
  Company,
  DomainScoreMap,
  EventCard,
  EventType,
  GameSession,
  KnowledgeDomain,
  SimulationConfig,
  Site,
} from '../types/game.ts';
import {
  ActiveEventV2,
  CompanyV2,
  GameSessionV2,
  RiskSummaryV2,
  V2_BALANCE,
  asCompanyV2,
  asSessionV2,
} from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from './config.ts';
import { EVENT_CARDS_DECK } from './cards.ts';
import { createInitialCompany as createLegacyInitialCompany } from './rules.ts';

export const CORE_V2_VERSION = '0.2.0';
const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

function d(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function emptyScores(value = 0): DomainScoreMap {
  return { engineering: value, hr: value, marketing: value, operations: value, finance: value };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildEventTypePlan(config: SimulationConfig = DEFAULT_CONFIG): EventType[] {
  const total = config.rounds * config.events_per_round;
  const problems = Math.floor(total / 2);
  const opportunities = total - problems;
  return shuffle([
    ...Array(problems).fill('problem' as EventType),
    ...Array(opportunities).fill('opportunity' as EventType),
  ]);
}

export function createInitialCompanyV2(name: string, id: string, config: SimulationConfig = DEFAULT_CONFIG): CompanyV2 {
  const company = asCompanyV2(createLegacyInitialCompany(name, id, config));
  company.consultantEngagements = 0;
  company.eventTypePlan = buildEventTypePlan(config);
  company.eventsDrawnCount = 0;
  company.problemEventsDrawn = 0;
  company.opportunityEventsDrawn = 0;
  company.horizonScanAvailableRound = null;
  company.experts.forEach((e) => { e.replacementDueRound = null; });
  recalculateCompanySPOFV2(company, config);
  return company;
}

export function currentConsultantRate(company: CompanyV2): number {
  return Math.round(V2_BALANCE.consultantBaseRate * Math.pow(V2_BALANCE.consultantEscalation, company.consultantEngagements));
}

export function sessionElapsedMinutes(session: GameSessionV2): number {
  if (session.timerStartedAt) {
    const elapsedMs = Date.now() - new Date(session.timerStartedAt).getTime();
    return Math.max(0, elapsedMs / 60000);
  }
  if (session.timerPausedSecondsRemaining != null) {
    return (V2_BALANCE.timerDurationSeconds - session.timerPausedSecondsRemaining) / 60;
  }
  return 0;
}

function chooseEventType(session: GameSessionV2, company: CompanyV2): EventType {
  const late = sessionElapsedMinutes(session) >= V2_BALANCE.lateBalanceElapsedMinutes;
  const gap = company.problemEventsDrawn - company.opportunityEventsDrawn;
  if (late && Math.abs(gap) >= V2_BALANCE.lateBalanceMaxTypeGap) {
    return gap > 0 ? 'opportunity' : 'problem';
  }
  return company.eventTypePlan[company.eventsDrawnCount] || (company.problemEventsDrawn <= company.opportunityEventsDrawn ? 'problem' : 'opportunity');
}

function chooseCard(type: EventType, excludedIds: Set<string>): EventCard {
  let pool = EVENT_CARDS_DECK.filter((c) => c.type === type && !excludedIds.has(c.id));
  if (pool.length === 0) pool = EVENT_CARDS_DECK.filter((c) => c.type === type);
  return pool[Math.floor(Math.random() * pool.length)];
}

function targetSiteForCard(company: CompanyV2, card: EventCard): Site | undefined {
  if (card.scope !== 'local') return undefined;
  const active = company.sites.filter((s) => !s.isClosed);
  if (active.length === 0) return undefined;
  const needsEngineering = card.domains.some((x) => x.domain === 'engineering');
  if (card.rdSiteOnly || needsEngineering) {
    return active.find((s) => s.isRDSite) || active[0];
  }
  return active[Math.floor(Math.random() * active.length)];
}

export function drawRoundEventsV2(sessionInput: GameSession, companyInput: Company): ActiveEventV2[] {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const excluded = new Set<string>();
  const events: ActiveEventV2[] = [];

  for (let i = 0; i < session.config.events_per_round; i++) {
    const type = chooseEventType(session, company);
    const card = chooseCard(type, excluded);
    excluded.add(card.id);
    const target = targetSiteForCard(company, card);
    const allocations: ActiveEventV2['allocations'] = {} as ActiveEventV2['allocations'];
    card.domains.forEach((r) => { allocations[r.domain] = {}; });
    events.push({
      instanceId: `evt-${session.round}-${company.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      card,
      targetSiteId: target?.id,
      allocations,
      isResolved: false,
    });
    company.eventsDrawnCount += 1;
    if (type === 'problem') company.problemEventsDrawn += 1;
    else company.opportunityEventsDrawn += 1;
  }

  return events;
}

export function calculateUsableIntranetV2(company: Company, site: Site, domain: KnowledgeDomain, config: SimulationConfig = DEFAULT_CONFIG): number {
  return Math.min(company.intranet[domain] || 0, (site.teamCapability[domain] || 0) + config.absorptive_capacity_bonus);
}

export function recalculateCompanySPOFV2(companyInput: Company, config: SimulationConfig = DEFAULT_CONFIG): void {
  const company = asCompanyV2(companyInput);
  for (const expert of company.experts) {
    if (expert.isVacant) {
      expert.isSPOF = false;
      expert.spofDomains = [];
      continue;
    }
    const spof: KnowledgeDomain[] = [];
    for (const expertise of expert.domains) {
      let orgCap = 0;
      if (expert.location === 'HQ') {
        orgCap = company.intranet[expertise.domain] || 0;
      } else {
        const site = company.sites.find((s) => s.id === expert.location && !s.isClosed);
        if (!site) continue;
        orgCap = Math.max(
          site.teamCapability[expertise.domain] || 0,
          site.codifiedKnowledge[expertise.domain] || 0,
          calculateUsableIntranetV2(company, site, expertise.domain, config),
        );
      }
      if (expertise.score - orgCap >= config.spof_gap) spof.push(expertise.domain);
    }
    expert.spofDomains = spof;
    expert.isSPOF = spof.length > 0;
  }
}

function enterpriseBaseKnowledge(company: CompanyV2, domain: KnowledgeDomain, config: SimulationConfig): number {
  let best = 0;
  for (const site of company.sites) {
    if (site.isClosed) continue;
    best = Math.max(
      best,
      site.teamCapability[domain] || 0,
      site.codifiedKnowledge[domain] || 0,
      calculateUsableIntranetV2(company, site, domain, config),
    );
  }
  return best;
}

function expertAlreadyReserved(session: GameSessionV2, company: CompanyV2, expertId: string, eventId: string): boolean {
  return (session.activeEvents[company.id] || []).some((event) =>
    !event.isResolved && event.instanceId !== eventId &&
    Object.values(event.allocations).some((a) => a?.expertId === expertId),
  );
}

export function evaluateEventDomainKnowledgeV2(
  sessionInput: GameSession,
  companyInput: Company,
  eventInput: ActiveEvent,
  domain: KnowledgeDomain,
  config: SimulationConfig = DEFAULT_CONFIG,
  ignoreConsultant = false,
) {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  const req = event.card.domains.find((r) => r.domain === domain);
  const difficulty = req?.difficulty ?? 4;
  const allocation = event.allocations[domain] || {};
  let team = 0;
  let localCodified = 0;
  let usableIntranet = 0;
  let baseKnowledge = 0;

  if (event.card.scope === 'local') {
    const site = company.sites.find((s) => s.id === event.targetSiteId && !s.isClosed);
    if (site) {
      team = site.teamCapability[domain] || 0;
      localCodified = site.codifiedKnowledge[domain] || 0;
      usableIntranet = calculateUsableIntranetV2(company, site, domain, config);
      baseKnowledge = Math.max(team, localCodified, usableIntranet);
    }
  } else {
    baseKnowledge = enterpriseBaseKnowledge(company, domain, config);
    usableIntranet = company.intranet[domain] || 0;
  }

  let expertBonus = 0;
  let copBonus = 0;
  let automationBonus = company.automatedDomains.includes(domain) ? config.automation_bonus : 0;
  let consultantPoints = ignoreConsultant ? 0 : Math.max(0, Math.min(V2_BALANCE.consultantMaxPointsPerDomain, allocation.consultantPoints || 0));

  if (allocation.expertId) {
    const expert = company.experts.find((e) => e.id === allocation.expertId && !e.isVacant);
    const hasDomain = expert?.domains.some((x) => x.domain === domain);
    if (expert && hasDomain && !expertAlreadyReserved(session, company, expert.id, event.instanceId)) expertBonus = config.expert_support_bonus;
  }

  if (allocation.useCoPSupport) {
    const current = session.copMemberships.filter((m) => m.domain === domain && m.activeRound === session.round);
    if (new Set(current.map((m) => m.companyId)).size >= 2) copBonus = config.cop_support_bonus;
  }

  const withoutConsultant = baseKnowledge + expertBonus + copBonus + automationBonus;
  const usefulGap = Math.max(0, difficulty - withoutConsultant);
  consultantPoints = Math.min(consultantPoints, usefulGap);
  const totalKnowledge = withoutConsultant + consultantPoints;
  const targetThreshold = difficulty + config.resolution_offset;
  const requiredDie = targetThreshold - totalKnowledge;
  let winRolls = 0;
  for (let roll = 1; roll <= config.event_die; roll++) if (roll + totalKnowledge >= targetThreshold) winRolls++;
  const winChancePercent = Math.round((winRolls / config.event_die) * 100);
  const likelihood = winChancePercent >= 90 ? 'Very High' : winChancePercent >= 70 ? 'High' : winChancePercent >= 40 ? 'Moderate' : winChancePercent >= 20 ? 'Low' : 'Very Low';

  return {
    baseKnowledge, usableIntranet, team, localCodified, expertBonus, copBonus, automationBonus,
    consultantPoints, usefulConsultantGap: Math.min(V2_BALANCE.consultantMaxPointsPerDomain, usefulGap),
    totalKnowledge, difficulty, targetThreshold, requiredDie, winChancePercent, likelihood,
  };
}

export function validateEventAllocationV2(
  sessionInput: GameSession,
  companyInput: Company,
  eventInput: ActiveEvent,
  domain: KnowledgeDomain,
  allocation: { expertId?: string; useCoPSupport?: boolean; consultantPoints?: number },
): { ok: boolean; message?: string } {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  if (session.phase !== 'respond' && session.phase !== 'events') return { ok: false, message: 'Resources can only be planned during the Events/Respond phases.' };
  if (event.isResolved) return { ok: false, message: 'This event is already resolved.' };
  if (!event.card.domains.some((r) => r.domain === domain)) return { ok: false, message: 'Domain is not required by this event.' };

  if (allocation.expertId) {
    const expert = company.experts.find((e) => e.id === allocation.expertId && !e.isVacant);
    if (!expert) return { ok: false, message: 'Expert not found.' };
    if (!expert.domains.some((x) => x.domain === domain)) return { ok: false, message: 'Expert does not have this domain.' };
    if (!['Available', 'HQ Assignment', 'Supporting Event'].includes(expert.state)) return { ok: false, message: `Expert is currently ${expert.state}.` };
    if (expertAlreadyReserved(session, company, expert.id, event.instanceId)) return { ok: false, message: 'Expert is already committed to another event this round.' };
  }

  if (allocation.useCoPSupport) {
    const current = session.copMemberships.filter((m) => m.domain === domain && m.activeRound === session.round);
    if (new Set(current.map((m) => m.companyId)).size < 2) return { ok: false, message: 'The Community of Practice is not active this round.' };
  }

  if (allocation.consultantPoints != null) {
    const points = Math.floor(allocation.consultantPoints);
    if (points < 0 || points > V2_BALANCE.consultantMaxPointsPerDomain) return { ok: false, message: 'Consultant support is limited to 3 knowledge points per domain.' };
    const prior = { ...event.allocations[domain], consultantPoints: 0 };
    const old = event.allocations[domain];
    event.allocations[domain] = prior;
    const evalNoConsultant = evaluateEventDomainKnowledgeV2(session, company, event, domain, session.config, true);
    event.allocations[domain] = old;
    if (points > evalNoConsultant.usefulConsultantGap) return { ok: false, message: `Only ${evalNoConsultant.usefulConsultantGap} consultant point(s) can usefully close this knowledge gap.` };
  }
  return { ok: true };
}

function recalcCompanyTurnover(company: CompanyV2): void {
  company.turnover = Math.round(company.sites.reduce((sum, s) => sum + (s.isClosed ? 0 : s.turnover), 0));
}

function applySiteDelta(company: CompanyV2, site: Site, delta: number): void {
  site.turnover = Math.max(0, Math.round(site.turnover + delta));
  recalcCompanyTurnover(company);
}

function applyCompanyDelta(company: CompanyV2, delta: number): void {
  const active = company.sites.filter((s) => !s.isClosed);
  if (!active.length || delta === 0) return;
  const total = active.reduce((sum, s) => sum + s.turnover, 0);
  let remaining = Math.round(delta);
  active.forEach((site, idx) => {
    const share = idx === active.length - 1 ? remaining : Math.round(delta * (total > 0 ? site.turnover / total : 1 / active.length));
    site.turnover = Math.max(0, site.turnover + share);
    remaining -= share;
  });
  recalcCompanyTurnover(company);
}

export function resolveSingleEventV2(sessionInput: GameSession, companyInput: Company, eventInput: ActiveEvent) {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  if (session.phase !== 'respond') throw new Error('Events can only be resolved during Respond phase.');
  if (event.isResolved) throw new Error('Event already resolved.');

  const domainResults: any[] = [];
  let allSucceeded = true;
  let interventionCost = 0;
  const consultantDetails: any[] = [];
  const chargedTravellers = new Set<string>();

  for (const req of event.card.domains) {
    const allocation = event.allocations[req.domain] || {};
    const evaluation = evaluateEventDomainKnowledgeV2(session, company, event, req.domain, session.config);

    if (allocation.expertId) {
      const expert = company.experts.find((e) => e.id === allocation.expertId && !e.isVacant);
      if (expert) {
        if (event.card.scope === 'local' && event.targetSiteId && expert.location !== event.targetSiteId && !chargedTravellers.has(expert.id)) {
          const travelCost = d(session.config.cost_die) * V2_BALANCE.expertTravelCostDieMultiplier;
          interventionCost += travelCost;
          allocation.expertTravelCost = travelCost;
          chargedTravellers.add(expert.id);
        }
        expert.state = 'Supporting Event';
      }
    }

    if (evaluation.consultantPoints > 0) {
      const rate = currentConsultantRate(company);
      const cost = rate * evaluation.consultantPoints;
      allocation.consultantCost = cost;
      interventionCost += cost;
      consultantDetails.push({ domain: req.domain, points: evaluation.consultantPoints, rate, cost, engagementNumber: company.consultantEngagements + 1 });
      company.consultantEngagements += 1;
    }

    const dieRoll = d(session.config.event_die);
    const achievedTotal = dieRoll + evaluation.totalKnowledge;
    const domainSuccess = achievedTotal >= evaluation.targetThreshold;
    if (!domainSuccess) allSucceeded = false;
    domainResults.push({
      domain: req.domain,
      baseKnowledge: evaluation.baseKnowledge,
      usableIntranet: evaluation.usableIntranet,
      team: evaluation.team,
      localCodified: evaluation.localCodified,
      expertBonus: evaluation.expertBonus,
      copBonus: evaluation.copBonus,
      automationBonus: evaluation.automationBonus,
      consultantBonus: evaluation.consultantPoints,
      totalKnowledge: evaluation.totalKnowledge,
      difficulty: req.difficulty,
      dieRoll,
      requiredTotal: evaluation.targetThreshold,
      achievedTotal,
      domainSuccess,
      explanation: `Knowledge ${evaluation.totalKnowledge}; rolled ${dieRoll}; needed ${evaluation.targetThreshold}.`,
    });
  }

  if (interventionCost > 0) {
    if (event.card.scope === 'local' && event.targetSiteId) {
      const target = company.sites.find((s) => s.id === event.targetSiteId);
      if (target) applySiteDelta(company, target, -interventionCost);
    } else applyCompanyDelta(company, -interventionCost);
  }

  let turnoverChange = 0;
  if (event.card.type === 'problem' && !allSucceeded) turnoverChange = -event.card.impact;
  if (event.card.type === 'opportunity' && allSucceeded) turnoverChange = event.card.impact;

  if (turnoverChange !== 0) {
    if (event.card.scope === 'local' && event.targetSiteId) {
      const target = company.sites.find((s) => s.id === event.targetSiteId);
      if (target) applySiteDelta(company, target, turnoverChange);
    } else applyCompanyDelta(company, turnoverChange);
  }

  closeFailedSites(company, session.round);
  event.isResolved = true;
  event.success = allSucceeded;
  event.domainResults = domainResults;
  event.turnoverChangeApplied = turnoverChange;
  event.consultantSpend = consultantDetails.reduce((sum, x) => sum + x.cost, 0);
  event.resolvedAt = new Date().toISOString();
  recalculateCompanySPOFV2(company, session.config);

  return { success: allSucceeded, turnoverChange, interventionCost, consultantDetails, domainResults };
}

function closeFailedSites(company: CompanyV2, round: number): string[] {
  const closed: string[] = [];
  for (const site of company.sites) {
    if (!site.isClosed && site.turnover <= 0) {
      site.isClosed = true;
      site.turnover = 0;
      closed.push(site.name);
      company.experts.filter((e) => e.location === site.id && !e.isVacant).forEach((e) => {
        e.isVacant = true;
        e.replacementDueRound = round + 1;
      });
    }
  }
  recalcCompanyTurnover(company);
  return closed;
}

function spendCompanyCost(company: CompanyV2, amount: number): void {
  applyCompanyDelta(company, -amount);
}

function expertCanDoKnowledgeWork(expert: CompanyV2['experts'][number]): boolean {
  return !expert.isVacant && (expert.state === 'Available' || expert.state === 'HQ Assignment');
}

export function executeKnowledgeActionV2(sessionInput: GameSession, companyInput: Company, payload: ActionPayload) {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  if (session.phase !== 'investment') return { success: false, message: 'Knowledge actions can only be used during the Invest phase.' };
  if (company.actionsRemaining <= 0) return { success: false, message: 'No knowledge actions remaining this round.' };
  const { type, siteId, expertId, domain, targetLocation, learningTarget } = payload;

  const consume = () => { company.actionsRemaining -= 1; recalculateCompanySPOFV2(company, session.config); };
  const findSite = () => company.sites.find((s) => s.id === siteId && !s.isClosed);
  const findExpert = () => company.experts.find((e) => e.id === expertId && !e.isVacant);

  if (type === 'KNOWLEDGE_TRANSFER') {
    if (!siteId || !expertId || !domain) return { success: false, message: 'Choose a site, expert and domain.' };
    const site = findSite(); const expert = findExpert();
    if (!site || !expert) return { success: false, message: 'Site or expert not found.' };
    if (!expertCanDoKnowledgeWork(expert) || expert.location !== site.id) return { success: false, message: 'The expert must be available and physically at the site.' };
    const skill = expert.domains.find((x) => x.domain === domain);
    if (!skill) return { success: false, message: 'That expert does not have this domain.' };
    if (site.teamCapability[domain] >= skill.score) return { success: false, message: 'Team capability is already at the expert ceiling.' };
    site.teamCapability[domain] += 1; expert.state = 'Knowledge Transfer'; consume();
    return { success: true, message: `${site.name} ${domain} Team Capability increased to ${site.teamCapability[domain]}.` };
  }

  if (type === 'TRAIN_EXPERT') {
    if (!expertId || !domain) return { success: false, message: 'Choose an expert and domain.' };
    const expert = findExpert(); if (!expert || !expertCanDoKnowledgeWork(expert)) return { success: false, message: 'Expert is unavailable.' };
    const skill = expert.domains.find((x) => x.domain === domain); if (!skill) return { success: false, message: 'Domain not held by expert.' };
    const cost = (d(session.config.cost_die) + d(session.config.cost_die)) * 10;
    spendCompanyCost(company, cost); skill.score = Math.min(8, skill.score + 1); expert.state = 'Training'; consume();
    return { success: true, message: `${expert.name} increased ${domain} expertise to ${skill.score}. Cost $${cost}k.`, costTurnover: cost };
  }

  if (type === 'CORPORATE_TRAINING') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    let changed = 0;
    company.sites.forEach((site) => { if (!site.isClosed && site.teamCapability[domain] < company.intranet[domain]) { site.teamCapability[domain] += 1; changed++; } });
    if (!changed) return { success: false, message: 'No site can currently benefit from this Corporate Training.' };
    consume(); return { success: true, message: `${domain} Team Capability increased at ${changed} site(s).` };
  }

  if (type === 'CODIFY_SITE') {
    if (!siteId || !domain) return { success: false, message: 'Choose a site and domain.' };
    const site = findSite(); if (!site) return { success: false, message: 'Site not found.' };
    if (site.codifiedKnowledge[domain] >= site.teamCapability[domain]) return { success: false, message: 'Local knowledge is already codified to Team Capability.' };
    site.codifiedKnowledge[domain] += 1; consume(); return { success: true, message: `${site.name} ${domain} Local Codified Knowledge increased to ${site.codifiedKnowledge[domain]}.` };
  }

  if (type === 'CODIFY_EXPERT') {
    if (!siteId || !expertId || !domain) return { success: false, message: 'Choose a site, expert and domain.' };
    const site = findSite(); const expert = findExpert();
    if (!site || !expert || !expertCanDoKnowledgeWork(expert) || expert.location !== site.id) return { success: false, message: 'Expert must be available at the selected site.' };
    const skill = expert.domains.find((x) => x.domain === domain); if (!skill) return { success: false, message: 'Expert does not have this domain.' };
    if (site.codifiedKnowledge[domain] >= skill.score) return { success: false, message: 'Local documentation is already at this expert’s level.' };
    site.codifiedKnowledge[domain] += 1; expert.state = 'Expertise Capture'; consume();
    return { success: true, message: `${expert.name} codified ${domain}; local documentation is now ${site.codifiedKnowledge[domain]}.` };
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
    company.intranet[domain] += growth; company.intranetRoundGrowth[domain] += growth; consume();
    return { success: true, message: `${domain} Corporate Intranet increased +${growth} to ${company.intranet[domain]}.` };
  }

  if (type === 'EXPERTISE_CAPTURE') {
    if (!expertId || !domain) return { success: false, message: 'Choose an expert and domain.' };
    const expert = findExpert(); if (!expert || !expertCanDoKnowledgeWork(expert)) return { success: false, message: 'Expert is unavailable.' };
    const skill = expert.domains.find((x) => x.domain === domain); if (!skill) return { success: false, message: 'Expert does not have this domain.' };
    if (company.intranet[domain] >= skill.score) return { success: false, message: 'Corporate knowledge is already at or above this expert’s capability.' };
    const remaining = session.config.max_intranet_domain_growth_per_round - company.intranetRoundGrowth[domain];
    if (remaining <= 0) return { success: false, message: 'This Intranet domain has reached its growth limit for the round.' };
    const growth = Math.min(2, remaining, skill.score - company.intranet[domain]);
    const cost = d(session.config.cost_die) * 10; spendCompanyCost(company, cost);
    company.intranet[domain] += growth; company.intranetRoundGrowth[domain] += growth; expert.state = 'Expertise Capture'; consume();
    return { success: true, message: `Captured ${expert.name}’s ${domain} expertise (+${growth}). Cost $${cost}k.`, costTurnover: cost };
  }

  if (type === 'LESSONS_LEARNED') {
    if (!siteId || !domain || !learningTarget) return { success: false, message: 'Choose site, domain and learning target.' };
    const site = findSite(); if (!site) return { success: false, message: 'Site not found.' };
    const relevant = (session.activeEvents[company.id] || []).some((e) => e.isResolved && e.card.domains.some((r) => r.domain === domain) && (e.card.scope === 'enterprise' || e.targetSiteId === site.id));
    if (!relevant) return { success: false, message: 'Lessons Learned requires a relevant event from this round.' };
    if (learningTarget === 'team') site.teamCapability[domain] = Math.min(6, site.teamCapability[domain] + 1);
    else site.codifiedKnowledge[domain] = Math.min(6, site.codifiedKnowledge[domain] + 1);
    consume(); return { success: true, message: `Lessons Learned increased ${site.name} ${domain} ${learningTarget === 'team' ? 'Team Capability' : 'Codified Knowledge'} +1.` };
  }

  if (type === 'JOIN_COP') {
    if (!expertId || !domain) return { success: false, message: 'Choose an expert and domain.' };
    const expert = findExpert(); if (!expert || !expertCanDoKnowledgeWork(expert) || !expert.domains.some((x) => x.domain === domain)) return { success: false, message: 'Eligible available expert required.' };
    const cost = d(session.config.cost_die) * 10; spendCompanyCost(company, cost);
    const existing = session.copMemberships.find((m) => m.companyId === company.id && m.domain === domain);
    if (existing) { existing.expertId = expert.id; existing.activeRound = session.round; }
    else session.copMemberships.push({ companyId: company.id, domain, expertId: expert.id, activeRound: session.round });
    expert.state = 'CoP Participant'; consume();
    return { success: true, message: `${expert.name} committed to the ${domain} CoP for this round. Cost $${cost}k.`, costTurnover: cost };
  }

  if (type === 'LEAVE_COP') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    session.copMemberships = session.copMemberships.filter((m) => !(m.companyId === company.id && m.domain === domain));
    consume(); return { success: true, message: `Left the ${domain} Community of Practice.` };
  }

  if (type === 'CAPTURE_COP_LEARNING') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    const active = session.copMemberships.filter((m) => m.domain === domain && m.activeRound === session.round);
    if (!active.some((m) => m.companyId === company.id) || new Set(active.map((m) => m.companyId)).size < 2) return { success: false, message: 'An active multi-company CoP is required.' };
    if (learningTarget === 'codified' && siteId) {
      const site = findSite(); if (!site) return { success: false, message: 'Site not found.' };
      site.codifiedKnowledge[domain] = Math.min(6, site.codifiedKnowledge[domain] + 1);
    } else {
      if (company.intranetRoundGrowth[domain] >= session.config.max_intranet_domain_growth_per_round) return { success: false, message: 'Intranet growth limit reached.' };
      company.intranet[domain] = Math.min(6, company.intranet[domain] + 1); company.intranetRoundGrowth[domain] += 1;
    }
    consume(); return { success: true, message: `Captured ${domain} learning from the active Community of Practice.` };
  }

  if (type === 'HORIZON_SCAN') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    company.horizonScanDomain = domain; company.horizonScanAvailableRound = session.round + 1; company.horizonScanUsedThisRound = false; consume();
    return { success: true, message: `${domain} Horizon Scan armed for next round.` };
  }

  if (type === 'AUTOMATE') {
    if (!domain) return { success: false, message: 'Choose a domain.' };
    if (company.automatedDomains.includes(domain)) return { success: false, message: 'This domain is already automated.' };
    let cost = 0; company.sites.filter((s) => !s.isClosed).forEach((site) => { const c = d(session.config.cost_die) * 10; cost += c; site.turnover = Math.max(0, site.turnover - c); });
    company.automatedDomains.push(domain); recalcCompanyTurnover(company); closeFailedSites(company, session.round); consume();
    return { success: true, message: `${domain} automated company-wide. Cost $${cost}k.`, costTurnover: cost };
  }

  if (type === 'KNOWLEDGE_AUDIT') {
    if (!siteId || !findSite()) return { success: false, message: 'Choose an active site.' };
    company.auditedSiteId = siteId; consume(); return { success: true, message: `Knowledge risks at ${findSite()!.name} revealed.` };
  }

  if (type === 'MOVE_EXPERT') {
    if (!expertId || !targetLocation) return { success: false, message: 'Choose an expert and destination.' };
    const expert = findExpert(); if (!expert || !expertCanDoKnowledgeWork(expert)) return { success: false, message: 'Expert is unavailable.' };
    if (targetLocation !== 'HQ' && !company.sites.some((s) => s.id === targetLocation && !s.isClosed)) return { success: false, message: 'Destination is unavailable.' };
    expert.location = targetLocation; expert.homeLocation = targetLocation; expert.state = targetLocation === 'HQ' ? 'HQ Assignment' : 'Available'; consume();
    return { success: true, message: `${expert.name} permanently relocated to ${targetLocation === 'HQ' ? 'Corporate HQ' : targetLocation}.` };
  }

  return { success: false, message: 'Unknown action.' };
}

export function executeRiskPhaseV2(sessionInput: GameSession, companyInput: Company): RiskSummaryV2 {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput);
  const departedExperts: RiskSummaryV2['departedExperts'] = [];
  const workforceAttrition: RiskSummaryV2['workforceAttrition'] = [];

  recalculateCompanySPOFV2(company, session.config);
  for (const expert of company.experts) {
    if (expert.isVacant) continue;
    const roll = d(session.config.event_die);
    const threshold = expert.isSPOF ? session.config.spof_leave_threshold : session.config.normal_leave_threshold;
    if (roll <= threshold) {
      departedExperts.push({ expertId: expert.id, expertName: expert.name, domains: expert.domains.map((x) => x.domain), wasSPOF: expert.isSPOF, roll });
      expert.isVacant = true; expert.replacementDueRound = session.round + 1; expert.state = 'Available';
    }
  }

  const candidates = company.sites.filter((s) => !s.isClosed).flatMap((site) => DOMAINS.filter((domain) => site.teamCapability[domain] > site.codifiedKnowledge[domain] && site.teamCapability[domain] > 1).map((domain) => ({ site, domain })));
  if (candidates.length) {
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const previousScore = picked.site.teamCapability[picked.domain];
    picked.site.teamCapability[picked.domain] -= 1;
    workforceAttrition.push({ siteName: picked.site.name, domain: picked.domain, previousScore, newScore: picked.site.teamCapability[picked.domain] });
  }

  const closedSites = closeFailedSites(company, session.round);
  recalculateCompanySPOFV2(company, session.config);
  return { departedExperts, workforceAttrition, closedSites };
}

export function prepareNextRoundV2(sessionInput: GameSession): void {
  const session = asSessionV2(sessionInput);
  for (const company of session.companies) {
    company.experts.forEach((expert) => {
      if (expert.isVacant && expert.replacementDueRound != null && expert.replacementDueRound <= session.round) {
        expert.isVacant = false; expert.replacementDueRound = null; expert.name = `${expert.name.split(' ')[0]} ${expert.name.split(' ')[1] || 'Morgan'} (Replacement)`;
        expert.domains.forEach((x) => { x.score = 4; }); expert.state = expert.location === 'HQ' ? 'HQ Assignment' : 'Available';
      } else if (!expert.isVacant) expert.state = expert.location === 'HQ' ? 'HQ Assignment' : 'Available';
    });
    company.actionsRemaining = session.config.actions_per_round;
    company.intranetRoundGrowth = emptyScores(0);
    company.auditedSiteId = null;
    if (company.horizonScanAvailableRound != null && session.round > company.horizonScanAvailableRound) {
      company.horizonScanDomain = null; company.horizonScanAvailableRound = null; company.horizonScanUsedThisRound = false;
    }
    recalculateCompanySPOFV2(company, session.config);
  }
}

export function canUseHorizonRedrawV2(sessionInput: GameSession, companyInput: Company, event: ActiveEvent): boolean {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput);
  return !!company.horizonScanDomain && company.horizonScanAvailableRound === session.round && !company.horizonScanUsedThisRound && event.card.domains.some((r) => r.domain === company.horizonScanDomain);
}

export function redrawEventSameTypeV2(sessionInput: GameSession, companyInput: Company, eventInput: ActiveEvent): ActiveEventV2 {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput); const event = eventInput as ActiveEventV2;
  if (!canUseHorizonRedrawV2(session, company, event)) throw new Error('Horizon Scan cannot redraw this event.');
  const pool = EVENT_CARDS_DECK.filter((c) => c.type === event.card.type && c.id !== event.card.id);
  const card = pool[Math.floor(Math.random() * pool.length)];
  const allocations: ActiveEventV2['allocations'] = {} as ActiveEventV2['allocations']; card.domains.forEach((r) => { allocations[r.domain] = {}; });
  company.horizonScanUsedThisRound = true;
  return { instanceId: `evt-redraw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, card, targetSiteId: targetSiteForCard(company, card)?.id, allocations, isResolved: false };
}

export function applyExperientialLearningV2(sessionInput: GameSession, companyInput: Company, eventInput: ActiveEvent, domain: KnowledgeDomain, target: 'team' | 'expert', targetId?: string) {
  const session = asSessionV2(sessionInput); const company = asCompanyV2(companyInput); const event = eventInput as ActiveEventV2;
  if (!event.isResolved || !event.success || event.card.type !== 'opportunity') return { success: false, message: 'Learning is only available from a successfully resolved opportunity.' };
  if (event.experientialLearningAwarded) return { success: false, message: 'Learning already claimed for this opportunity.' };
  if (!event.card.domains.some((r) => r.domain === domain)) return { success: false, message: 'Choose a domain involved in the opportunity.' };

  if (target === 'expert') {
    const expert = company.experts.find((e) => e.id === targetId && !e.isVacant);
    if (!expert || !expert.domains.some((x) => x.domain === domain)) return { success: false, message: 'Expert must already hold this domain.' };
    const participated = Object.values(event.allocations).some((a) => a?.expertId === expert.id);
    if (!participated) return { success: false, message: 'Expert must have participated in this opportunity to learn from it.' };
    const skill = expert.domains.find((x) => x.domain === domain)!; skill.score = Math.min(8, skill.score + 1);
  } else {
    const siteId = targetId || event.targetSiteId;
    const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
    if (!site) return { success: false, message: 'Choose an active site that participated in the opportunity.' };
    if (event.card.scope === 'local' && event.targetSiteId !== site.id) return { success: false, message: 'Local opportunity learning belongs to the affected site.' };
    site.teamCapability[domain] = Math.min(6, site.teamCapability[domain] + 1);
  }
  event.experientialLearningAwarded = true; recalculateCompanySPOFV2(company, session.config);
  return { success: true, message: `Experiential learning increased ${domain} ${target} capability by 1.` };
}
