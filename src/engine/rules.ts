import {
  Company,
  Site,
  Expert,
  KnowledgeDomain,
  SimulationConfig,
  ActiveEvent,
  ActiveEventAllocation,
  EventCard,
  GameSession,
  CoPMembership,
  ActionPayload,
  DomainScoreMap
} from '../types/game.ts';
import { AUSTRALIAN_CITIES, DEFAULT_CONFIG } from './config.ts';
import { EVENT_CARDS_DECK, FINAL_DISRUPTION_CARDS, getRandomEventCard } from './cards.ts';

/**
 * Recalculate SPOF flags for all experts in a company
 */
export function recalculateCompanySPOF(company: Company, config: SimulationConfig = DEFAULT_CONFIG): void {
  for (const expert of company.experts) {
    if (expert.isVacant) {
      expert.isSPOF = false;
      expert.spofDomains = [];
      continue;
    }

    if (expert.location === 'HQ') {
      // HQ experts are at enterprise level, not at a local operating site
      expert.isSPOF = false;
      expert.spofDomains = [];
      continue;
    }

    const site = company.sites.find((s) => s.id === expert.location);
    if (!site || site.isClosed) {
      expert.isSPOF = false;
      expert.spofDomains = [];
      continue;
    }

    const spofDomains: KnowledgeDomain[] = [];

    for (const d of expert.domains) {
      const domain = d.domain;
      const expertScore = d.score;
      const team = site.teamCapability[domain] || 0;
      const localCodified = site.codifiedKnowledge[domain] || 0;
      const intranet = company.intranet[domain] || 0;

      // Absorptive capacity limit
      const usableIntranet = Math.min(intranet, team + config.absorptive_capacity_bonus);

      // Organisational capability at this site
      const orgCap = Math.max(team, localCodified, usableIntranet);

      const gap = expertScore - orgCap;
      if (gap >= config.spof_gap) {
        spofDomains.push(domain);
      }
    }

    expert.isSPOF = spofDomains.length > 0;
    expert.spofDomains = spofDomains;
  }
}

/**
 * Calculate Usable Intranet for a specific site & domain
 */
export function calculateUsableIntranet(
  company: Company,
  site: Site,
  domain: KnowledgeDomain,
  config: SimulationConfig = DEFAULT_CONFIG
): { usable: number; intranet: number; team: number; maxPotential: number; bottleneck: boolean } {
  const intranet = company.intranet[domain] || 0;
  const team = site.teamCapability[domain] || 0;
  const maxPotential = team + config.absorptive_capacity_bonus;
  const usable = Math.min(intranet, maxPotential);
  const bottleneck = intranet > maxPotential;

  return { usable, intranet, team, maxPotential, bottleneck };
}

/**
 * Calculate Likelihood and Available Knowledge for an active event domain
 */
export function evaluateEventDomainKnowledge(
  session: GameSession,
  company: Company,
  activeEvent: ActiveEvent,
  domain: KnowledgeDomain,
  config: SimulationConfig = DEFAULT_CONFIG
): {
  baseKnowledge: number;
  usableIntranet: number;
  team: number;
  localCodified: number;
  expertBonus: number;
  copBonus: number;
  automationBonus: number;
  totalKnowledge: number;
  difficulty: number;
  targetThreshold: number;
  likelihood: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High';
  winChancePercent: number;
  explanation: string;
} {
  const card = activeEvent.card;
  const domainReq = card.domains.find((d) => d.domain === domain);
  const difficulty = domainReq ? domainReq.difficulty : 4;
  const allocation = activeEvent.allocations[domain] || {};

  let team = 0;
  let localCodified = 0;
  let usableIntranet = 0;
  let baseKnowledge = 0;

  if (card.scope === 'local' && activeEvent.targetSiteId) {
    const site = company.sites.find((s) => s.id === activeEvent.targetSiteId);
    if (site) {
      team = site.teamCapability[domain] || 0;
      localCodified = site.codifiedKnowledge[domain] || 0;
      usableIntranet = Math.min(company.intranet[domain] || 0, team + config.absorptive_capacity_bonus);
      baseKnowledge = Math.max(team, localCodified, usableIntranet);
    }
  } else {
    // Enterprise Scope: best effective capability across non-closed sites and HQ
    let bestCap = company.intranet[domain] || 0;
    for (const s of company.sites) {
      if (!s.isClosed) {
        const u = Math.min(company.intranet[domain] || 0, s.teamCapability[domain] + config.absorptive_capacity_bonus);
        const siteMax = Math.max(s.teamCapability[domain], s.codifiedKnowledge[domain], u);
        if (siteMax > bestCap) bestCap = siteMax;
      }
    }
    baseKnowledge = bestCap;
    usableIntranet = company.intranet[domain] || 0;
  }

  // Modifiers
  let expertBonus = 0;
  let copBonus = 0;
  let automationBonus = 0;

  // Expert assigned?
  if (allocation.expertId) {
    const expert = company.experts.find((e) => e.id === allocation.expertId);
    if (expert && expert.domains.some((d) => d.domain === domain)) {
      expertBonus = config.expert_support_bonus;
    }
  }

  // CoP Support assigned?
  if (allocation.useCoPSupport) {
    // Check if domain CoP is active in session (>=2 companies participating)
    const activeParticipants = session.copMemberships.filter((m) => m.domain === domain);
    const companyIds = new Set(activeParticipants.map((m) => m.companyId));
    if (companyIds.size >= 2) {
      copBonus = config.cop_support_bonus;
    }
  }

  // Automation active for this domain?
  if (company.automatedDomains.includes(domain)) {
    automationBonus = config.automation_bonus;
  }

  const totalKnowledge = baseKnowledge + expertBonus + copBonus + automationBonus;
  const targetThreshold = difficulty + config.resolution_offset; // Need d12 + totalKnowledge >= targetThreshold
  const requiredDie = targetThreshold - totalKnowledge;

  // d12 outcomes: 1 to 12
  let winRolls = 0;
  for (let roll = 1; roll <= config.event_die; roll++) {
    if (roll + totalKnowledge >= targetThreshold) {
      winRolls++;
    }
  }
  const winChancePercent = Math.round((winRolls / config.event_die) * 100);

  let likelihood: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High' = 'Moderate';
  if (winChancePercent >= 90) likelihood = 'Very High';
  else if (winChancePercent >= 70) likelihood = 'High';
  else if (winChancePercent >= 40) likelihood = 'Moderate';
  else if (winChancePercent >= 20) likelihood = 'Low';
  else likelihood = 'Very Low';

  // Build causal explanation
  const whyParts: string[] = [];
  if (card.scope === 'local') {
    whyParts.push(`Base capability: ${baseKnowledge} (Team: ${team}, Codified: ${localCodified}, Usable Intranet: ${usableIntranet}).`);
    if ((company.intranet[domain] || 0) > usableIntranet) {
      whyParts.push(`Note: Intranet has level ${company.intranet[domain]}, but local team absorptive limit caps it at ${usableIntranet}.`);
    }
  } else {
    whyParts.push(`Enterprise organizational knowledge base: ${baseKnowledge}.`);
  }

  if (expertBonus > 0) whyParts.push(`+${expertBonus} Deep Expert deployed.`);
  if (copBonus > 0) whyParts.push(`+${copBonus} Community of Practice external support.`);
  if (automationBonus > 0) whyParts.push(`+${automationBonus} Automated Enterprise System.`);

  whyParts.push(`Required d${config.event_die} roll: ${Math.max(1, requiredDie)}+ (Difficulty ${difficulty}).`);

  return {
    baseKnowledge,
    usableIntranet,
    team,
    localCodified,
    expertBonus,
    copBonus,
    automationBonus,
    totalKnowledge,
    difficulty,
    targetThreshold,
    likelihood,
    winChancePercent,
    explanation: whyParts.join(' ')
  };
}

/**
 * Resolve an active event with deterministic dice roll & causality logging
 */
export function resolveActiveEvent(
  session: GameSession,
  company: Company,
  activeEvent: ActiveEvent,
  config: SimulationConfig = DEFAULT_CONFIG
): {
  success: boolean;
  domainResults: ActiveEvent['domainResults'];
  turnoverChange: number;
} {
  const domainResults: NonNullable<ActiveEvent['domainResults']> = [];
  let allDomainsSucceeded = true;

  for (const domainReq of activeEvent.card.domains) {
    const domain = domainReq.domain;
    const evalResult = evaluateEventDomainKnowledge(session, company, activeEvent, domain, config);

    // Roll d12
    const dieRoll = Math.floor(Math.random() * config.event_die) + 1;
    const achievedTotal = dieRoll + evalResult.totalKnowledge;
    const domainSuccess = achievedTotal >= evalResult.targetThreshold;

    if (!domainSuccess) {
      allDomainsSucceeded = false;
    }

    domainResults.push({
      domain,
      baseKnowledge: evalResult.baseKnowledge,
      usableIntranet: evalResult.usableIntranet,
      team: evalResult.team,
      localCodified: evalResult.localCodified,
      expertBonus: evalResult.expertBonus,
      copBonus: evalResult.copBonus,
      automationBonus: evalResult.automationBonus,
      totalKnowledge: evalResult.totalKnowledge,
      difficulty: domainReq.difficulty,
      dieRoll,
      requiredTotal: evalResult.targetThreshold,
      achievedTotal,
      domainSuccess,
      explanation: `${evalResult.explanation} [Roll: ${dieRoll} + ${evalResult.totalKnowledge} = ${achievedTotal} vs Target ${evalResult.targetThreshold}]`
    });
  }

  let turnoverChange = 0;
  if (activeEvent.card.type === 'problem') {
    // Problem failure reduces turnover
    if (!allDomainsSucceeded) {
      turnoverChange = -activeEvent.card.impact;
    }
  } else {
    // Opportunity success increases turnover
    if (allDomainsSucceeded) {
      turnoverChange = activeEvent.card.impact;
    }
  }

  return {
    success: allDomainsSucceeded,
    domainResults,
    turnoverChange
  };
}

/**
 * Generate a new Company starting state
 */
export function createInitialCompany(
  name: string,
  id: string = `comp-${Math.random().toString(36).substring(2, 7)}`,
  config: SimulationConfig = DEFAULT_CONFIG
): Company {
  const startingTurnover = config.starting_turnover;
  // Distribute turnover randomly across 6 sites, ensuring each >= 30
  const siteCount = AUSTRALIAN_CITIES.length;
  let remainingTurnover = startingTurnover - siteCount * config.minimum_site_turnover;

  const siteTurnovers: number[] = Array(siteCount).fill(config.minimum_site_turnover);
  for (let i = 0; i < siteCount - 1; i++) {
    const add = Math.floor(Math.random() * (remainingTurnover / 2));
    siteTurnovers[i] += add;
    remainingTurnover -= add;
  }
  siteTurnovers[siteCount - 1] += remainingTurnover;

  // Designate random R&D site (e.g. Melbourne or Sydney)
  const rdSiteIndex = Math.floor(Math.random() * siteCount);

  const sites: Site[] = AUSTRALIAN_CITIES.map((city, idx) => {
    const teamCapability: DomainScoreMap = {
      engineering: Math.floor(Math.random() * (config.site_knowledge_max - config.site_knowledge_min + 1)) + config.site_knowledge_min,
      hr: Math.floor(Math.random() * (config.site_knowledge_max - config.site_knowledge_min + 1)) + config.site_knowledge_min,
      marketing: Math.floor(Math.random() * (config.site_knowledge_max - config.site_knowledge_min + 1)) + config.site_knowledge_min,
      operations: Math.floor(Math.random() * (config.site_knowledge_max - config.site_knowledge_min + 1)) + config.site_knowledge_min,
      finance: Math.floor(Math.random() * (config.site_knowledge_max - config.site_knowledge_min + 1)) + config.site_knowledge_min,
    };

    // If R&D site, boost engineering slightly
    if (idx === rdSiteIndex) {
      teamCapability.engineering = Math.max(teamCapability.engineering, 3);
    }

    const codifiedKnowledge: DomainScoreMap = {
      engineering: Math.max(1, Math.min(teamCapability.engineering, Math.floor(Math.random() * 2) + 1)),
      hr: Math.max(1, Math.min(teamCapability.hr, Math.floor(Math.random() * 2) + 1)),
      marketing: Math.max(1, Math.min(teamCapability.marketing, Math.floor(Math.random() * 2) + 1)),
      operations: Math.max(1, Math.min(teamCapability.operations, Math.floor(Math.random() * 2) + 1)),
      finance: Math.max(1, Math.min(teamCapability.finance, Math.floor(Math.random() * 2) + 1)),
    };

    return {
      id: city.id,
      name: city.name,
      turnover: siteTurnovers[idx],
      isRDSite: idx === rdSiteIndex,
      isClosed: false,
      teamCapability,
      codifiedKnowledge,
      coordinates: city.coordinates,
    };
  });

  // Generate 3 Deep Experts: two with 1 domain, one with 2 domains. Scores 4 to 6.
  const domainsList: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];
  // Shuffle domains to ensure varied coverage
  const shuffledDomains = [...domainsList].sort(() => Math.random() - 0.5);

  const expertNames = [
    ['Frank Smith', 'Alex Chen', 'Liam O’Connor', 'Hedy Lamarr', 'Gustave Eiffel', 'Kyle Zandvoort'],
    ['Sarah Guppy', 'Marcus Sterling', 'Priya Patel', 'Stephanie Kwolek', 'Chloe Bennett', 'Nikolaus Otto'],
    ['Mary Jackson', 'Daniel Brooks', 'Tabitha Babbitt', 'Benjamin Hayes', 'Henrietta Vansittart', 'Matti Makkonen'],
  ];

  const expertPoolName = (idx: number) => expertNames[idx % 3][Math.floor(Math.random() * 6)];

  const experts: Expert[] = [
    // Expert 1: Single domain (e.g. Engineering)
    {
      id: `exp-${id}-1`,
      name: expertPoolName(0),
      domains: [{ domain: shuffledDomains[0], score: Math.floor(Math.random() * 3) + 4 }], // 4-6
      location: sites[rdSiteIndex].id, // often at R&D or major site
      homeLocation: sites[rdSiteIndex].id,
      state: 'Available',
      isSPOF: false,
      spofDomains: [],
    },
    // Expert 2: Dual domain (e.g. Operations + Finance)
    {
      id: `exp-${id}-2`,
      name: expertPoolName(1),
      domains: [
        { domain: shuffledDomains[1], score: Math.floor(Math.random() * 3) + 4 },
        { domain: shuffledDomains[2], score: Math.floor(Math.random() * 3) + 4 },
      ],
      location: sites[(rdSiteIndex + 1) % siteCount].id,
      homeLocation: sites[(rdSiteIndex + 1) % siteCount].id,
      state: 'Available',
      isSPOF: false,
      spofDomains: [],
    },
    // Expert 3: Single domain (e.g. HR or Marketing)
    {
      id: `exp-${id}-3`,
      name: expertPoolName(2),
      domains: [{ domain: shuffledDomains[3], score: Math.floor(Math.random() * 3) + 4 }],
      location: sites[(rdSiteIndex + 2) % siteCount].id,
      homeLocation: sites[(rdSiteIndex + 2) % siteCount].id,
      state: 'Available',
      isSPOF: false,
      spofDomains: [],
    },
  ];

  const company: Company = {
    id,
    name,
    turnover: startingTurnover,
    startingTurnover,
    intranet: {
      engineering: config.starting_intranet_score,
      hr: config.starting_intranet_score,
      marketing: config.starting_intranet_score,
      operations: config.starting_intranet_score,
      finance: config.starting_intranet_score,
    },
    intranetRoundGrowth: {
      engineering: 0,
      hr: 0,
      marketing: 0,
      operations: 0,
      finance: 0,
    },
    automatedDomains: [],
    horizonScanDomain: null,
    horizonScanUsedThisRound: false,
    actionsRemaining: config.actions_per_round,
    sites,
    experts,
    auditedSiteId: null,
  };

  recalculateCompanySPOF(company, config);
  return company;
}

/**
 * Execute Knowledge Action on Company state
 */
export function executeKnowledgeAction(
  session: GameSession,
  company: Company,
  payload: ActionPayload,
  config: SimulationConfig = DEFAULT_CONFIG
): { success: boolean; message: string; costTurnover?: number; eventLogTitle: string; eventLogDesc: string } {
  if (company.actionsRemaining <= 0) {
    return { success: false, message: 'No knowledge actions remaining this round.', eventLogTitle: 'Action Failed', eventLogDesc: 'Attempted action with 0 actions remaining.' };
  }

  const { type, siteId, expertId, domain, targetLocation, learningTarget } = payload;

  switch (type) {
    case 'KNOWLEDGE_TRANSFER': {
      if (!siteId || !expertId || !domain) {
        return { success: false, message: 'Site, expert and domain required for Knowledge Transfer.', eventLogTitle: 'Transfer Failed', eventLogDesc: 'Missing parameters.' };
      }
      const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
      const expert = company.experts.find((e) => e.id === expertId && !e.isVacant);
      if (!site || !expert) return { success: false, message: 'Invalid site or expert.', eventLogTitle: 'Transfer Failed', eventLogDesc: 'Site or expert not found.' };

      if (expert.location !== siteId) {
        return { success: false, message: 'Expert must be physically located at the site to transfer knowledge.', eventLogTitle: 'Transfer Failed', eventLogDesc: `${expert.name} is not located at ${site.name}.` };
      }
      if (expert.state !== 'Available') {
        return { success: false, message: `Expert is currently ${expert.state}.`, eventLogTitle: 'Transfer Failed', eventLogDesc: `${expert.name} is not available.` };
      }
      const domainObj = expert.domains.find((d) => d.domain === domain);
      if (!domainObj) {
        return { success: false, message: 'Expert does not possess this knowledge domain.', eventLogTitle: 'Transfer Failed', eventLogDesc: `${expert.name} does not know ${domain}.` };
      }
      if (site.teamCapability[domain] >= domainObj.score) {
        return { success: false, message: `Team capability (${site.teamCapability[domain]}) is already at or above expert level (${domainObj.score}).`, eventLogTitle: 'Transfer Failed', eventLogDesc: 'Knowledge ceiling reached.' };
      }

      site.teamCapability[domain] += 1;
      expert.state = 'Knowledge Transfer';
      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `${expert.name} transferred ${domain} knowledge to ${site.name} team (now Level ${site.teamCapability[domain]}).`,
        eventLogTitle: 'Knowledge Transfer Completed',
        eventLogDesc: `${expert.name} increased ${site.name} ${domain} team capability to ${site.teamCapability[domain]}.`
      };
    }

    case 'TRAIN_EXPERT': {
      if (!expertId || !domain) {
        return { success: false, message: 'Expert and domain required for Training.', eventLogTitle: 'Training Failed', eventLogDesc: 'Missing parameters.' };
      }
      const expert = company.experts.find((e) => e.id === expertId && !e.isVacant);
      if (!expert) return { success: false, message: 'Expert not found.', eventLogTitle: 'Training Failed', eventLogDesc: 'Expert not found.' };
      const domainObj = expert.domains.find((d) => d.domain === domain);
      if (!domainObj) return { success: false, message: 'Expert does not possess this domain.', eventLogTitle: 'Training Failed', eventLogDesc: 'Domain mismatch.' };

      // Cost 2d6 * 10 turnover ($20k-$120k)
      const cost = ((Math.floor(Math.random() * config.cost_die) + 1) + (Math.floor(Math.random() * config.cost_die) + 1)) * 10;
      if (company.turnover < cost) {
        return { success: false, message: `Insufficient turnover ($${company.turnover}k) for training cost ($${cost}k).`, eventLogTitle: 'Training Failed', eventLogDesc: 'Insufficient funds.' };
      }

      domainObj.score = Math.min(8, domainObj.score + 1);
      company.turnover -= cost;
      company.actionsRemaining -= 1;
      expert.state = 'Training';
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        costTurnover: cost,
        message: `${expert.name} underwent advanced training in ${domain} (now Level ${domainObj.score}) for $${cost}k turnover.`,
        eventLogTitle: 'Expert Trained',
        eventLogDesc: `${expert.name} ${domain} increased to ${domainObj.score} (Cost: $${cost}k).`
      };
    }

    case 'CORPORATE_TRAINING': {
      if (!domain) return { success: false, message: 'Domain required for Corporate Training.', eventLogTitle: 'Corporate Training Failed', eventLogDesc: 'Missing domain.' };
      const intranetLevel = company.intranet[domain];
      let trainedCount = 0;

      for (const site of company.sites) {
        if (!site.isClosed && site.teamCapability[domain] < intranetLevel) {
          site.teamCapability[domain] += 1;
          trainedCount++;
        }
      }

      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `Corporate Training delivered across ${trainedCount} eligible sites in ${domain} (up to Intranet Level ${intranetLevel}).`,
        eventLogTitle: 'Corporate Training Deployed',
        eventLogDesc: `Corporate Training in ${domain} raised team capability across ${trainedCount} sites.`
      };
    }

    case 'CODIFY_SITE': {
      if (!siteId || !domain) return { success: false, message: 'Site and domain required.', eventLogTitle: 'Codification Failed', eventLogDesc: 'Missing parameters.' };
      const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
      if (!site) return { success: false, message: 'Site not found.', eventLogTitle: 'Codification Failed', eventLogDesc: 'Site not found.' };

      if (site.codifiedKnowledge[domain] >= site.teamCapability[domain]) {
        return { success: false, message: `Local documentation is already at Team Capability level (${site.teamCapability[domain]}).`, eventLogTitle: 'Codification Failed', eventLogDesc: 'Cannot codify beyond team knowledge.' };
      }

      site.codifiedKnowledge[domain] += 1;
      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `Codified local ${domain} operating procedures at ${site.name} (now Level ${site.codifiedKnowledge[domain]}).`,
        eventLogTitle: 'Site Knowledge Codified',
        eventLogDesc: `${site.name} local codified ${domain} increased to ${site.codifiedKnowledge[domain]}.`
      };
    }

    case 'CODIFY_EXPERT': {
      if (!siteId || !expertId || !domain) return { success: false, message: 'Site, expert and domain required.', eventLogTitle: 'Codification Failed', eventLogDesc: 'Missing parameters.' };
      const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
      const expert = company.experts.find((e) => e.id === expertId && !e.isVacant);
      if (!site || !expert) return { success: false, message: 'Site or expert not found.', eventLogTitle: 'Codification Failed', eventLogDesc: 'Invalid targets.' };

      if (expert.location !== siteId) {
        return { success: false, message: 'Expert must be physically located at the site to codify expert knowledge locally.', eventLogTitle: 'Codification Failed', eventLogDesc: 'Expert not at site.' };
      }
      const domainObj = expert.domains.find((d) => d.domain === domain);
      if (!domainObj) return { success: false, message: 'Expert does not possess this domain.', eventLogTitle: 'Codification Failed', eventLogDesc: 'Domain mismatch.' };

      if (site.codifiedKnowledge[domain] >= domainObj.score) {
        return { success: false, message: `Local codified knowledge is already at expert level (${domainObj.score}).`, eventLogTitle: 'Codification Failed', eventLogDesc: 'Ceiling reached.' };
      }

      site.codifiedKnowledge[domain] += 1;
      expert.state = 'Knowledge Transfer';
      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `${expert.name} documented expert methods for ${domain} at ${site.name} (now Level ${site.codifiedKnowledge[domain]}).`,
        eventLogTitle: 'Expert Knowledge Codified Locally',
        eventLogDesc: `${expert.name} codified ${domain} at ${site.name} to Level ${site.codifiedKnowledge[domain]}.`
      };
    }

    case 'UPDATE_INTRANET': {
      if (!domain) return { success: false, message: 'Domain required.', eventLogTitle: 'Intranet Update Failed', eventLogDesc: 'Missing domain.' };
      if (company.intranetRoundGrowth[domain] >= config.max_intranet_domain_growth_per_round) {
        return { success: false, message: `Intranet ${domain} has already reached the max growth limit (+${config.max_intranet_domain_growth_per_round}) this round.`, eventLogTitle: 'Intranet Limit Reached', eventLogDesc: 'Max round growth reached.' };
      }

      // Check highest source in company
      let highestSource = 0;
      for (const s of company.sites) {
        if (!s.isClosed) {
          if (s.teamCapability[domain] > highestSource) highestSource = s.teamCapability[domain];
          if (s.codifiedKnowledge[domain] > highestSource) highestSource = s.codifiedKnowledge[domain];
        }
      }
      for (const e of company.experts) {
        if (!e.isVacant) {
          const d = e.domains.find((dm) => dm.domain === domain);
          if (d && d.score > highestSource) highestSource = d.score;
        }
      }

      if (company.intranet[domain] >= highestSource) {
        return { success: false, message: `Corporate Intranet (${company.intranet[domain]}) cannot exceed the highest existing knowledge source in the company (${highestSource}).`, eventLogTitle: 'Intranet Update Failed', eventLogDesc: 'Intranet cannot exceed company knowledge.' };
      }

      // HQ expert boost
      const hasHQExpert = company.experts.some((e) => !e.isVacant && e.location === 'HQ' && e.domains.some((d) => d.domain === domain));
      const increment = hasHQExpert ? Math.min(config.hq_expert_intranet_increment, highestSource - company.intranet[domain]) : 1;
      const allowedGrowth = Math.min(increment, config.max_intranet_domain_growth_per_round - company.intranetRoundGrowth[domain]);

      company.intranet[domain] += allowedGrowth;
      company.intranetRoundGrowth[domain] += allowedGrowth;
      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `Corporate Intranet updated for ${domain} (+${allowedGrowth} -> Level ${company.intranet[domain]})${hasHQExpert ? ' (boosted by HQ expert)' : ''}.`,
        eventLogTitle: 'Corporate Intranet Updated',
        eventLogDesc: `Intranet ${domain} increased to ${company.intranet[domain]}.`
      };
    }

    case 'EXPERTISE_CAPTURE': {
      if (!expertId || !domain) return { success: false, message: 'Expert and domain required.', eventLogTitle: 'Capture Failed', eventLogDesc: 'Missing parameters.' };
      const expert = company.experts.find((e) => e.id === expertId && !e.isVacant);
      if (!expert) return { success: false, message: 'Expert not found.', eventLogTitle: 'Capture Failed', eventLogDesc: 'Expert not found.' };

      const domainObj = expert.domains.find((d) => d.domain === domain);
      if (!domainObj) return { success: false, message: 'Expert does not possess this domain.', eventLogTitle: 'Capture Failed', eventLogDesc: 'Domain mismatch.' };

      if (company.intranetRoundGrowth[domain] >= config.max_intranet_domain_growth_per_round) {
        return { success: false, message: `Intranet growth limit reached for ${domain} this round.`, eventLogTitle: 'Capture Failed', eventLogDesc: 'Max round growth.' };
      }

      // Cost 1d6 * 10 ($10k-$60k)
      const cost = (Math.floor(Math.random() * config.cost_die) + 1) * 10;
      if (company.turnover < cost) {
        return { success: false, message: `Insufficient turnover ($${company.turnover}k) for capture cost ($${cost}k).`, eventLogTitle: 'Capture Failed', eventLogDesc: 'Insufficient funds.' };
      }

      const potential = Math.min(2, domainObj.score - company.intranet[domain]);
      const growth = Math.max(1, Math.min(potential, config.max_intranet_domain_growth_per_round - company.intranetRoundGrowth[domain]));

      company.intranet[domain] += growth;
      company.intranetRoundGrowth[domain] += growth;
      company.turnover -= cost;
      expert.state = 'Expertise Capture';
      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        costTurnover: cost,
        message: `Structured expertise capture conducted with ${expert.name}. Intranet ${domain} increased +${growth} (now Level ${company.intranet[domain]}) for $${cost}k turnover.`,
        eventLogTitle: 'Expertise Capture Completed',
        eventLogDesc: `Captured ${expert.name}'s ${domain} knowledge into Corporate Intranet (+${growth}, Cost $${cost}k).`
      };
    }

    case 'LESSONS_LEARNED': {
      if (!siteId || !domain || !learningTarget) return { success: false, message: 'Site, domain, and learning target required.', eventLogTitle: 'AAR Failed', eventLogDesc: 'Missing parameters.' };
      const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
      if (!site) return { success: false, message: 'Site not found.', eventLogTitle: 'AAR Failed', eventLogDesc: 'Site not found.' };

      if (learningTarget === 'team') {
        site.teamCapability[domain] = Math.min(6, site.teamCapability[domain] + 1);
      } else {
        site.codifiedKnowledge[domain] = Math.min(6, site.codifiedKnowledge[domain] + 1);
      }

      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `After Action Review conducted at ${site.name}. Increased ${domain} ${learningTarget === 'team' ? 'Team Capability' : 'Codified Knowledge'} +1.`,
        eventLogTitle: 'After Action Review Recorded',
        eventLogDesc: `AAR at ${site.name} increased ${domain} ${learningTarget}.`
      };
    }

    case 'JOIN_COP': {
      if (!expertId || !domain) return { success: false, message: 'Expert and domain required.', eventLogTitle: 'CoP Join Failed', eventLogDesc: 'Missing parameters.' };
      const expert = company.experts.find((e) => e.id === expertId && !e.isVacant);
      if (!expert) return { success: false, message: 'Expert not found.', eventLogTitle: 'CoP Join Failed', eventLogDesc: 'Expert not found.' };

      // Cost 1d6 * 10 ($10k-$60k)
      const cost = (Math.floor(Math.random() * config.cost_die) + 1) * 10;
      if (company.turnover < cost) {
        return { success: false, message: `Insufficient turnover ($${company.turnover}k) for CoP participation fee ($${cost}k).`, eventLogTitle: 'CoP Join Failed', eventLogDesc: 'Insufficient funds.' };
      }

      // Check if already in CoP for this domain
      const existing = session.copMemberships.find((m) => m.companyId === company.id && m.domain === domain);
      if (existing) {
        existing.expertId = expertId;
        existing.activeRound = session.round;
      } else {
        session.copMemberships.push({
          companyId: company.id,
          domain,
          expertId,
          activeRound: session.round
        });
      }

      company.turnover -= cost;
      expert.state = 'CoP Participant';
      company.actionsRemaining -= 1;

      return {
        success: true,
        costTurnover: cost,
        message: `${company.name} assigned ${expert.name} to the Industry Community of Practice for ${domain} (Fee: $${cost}k).`,
        eventLogTitle: 'Community of Practice Joined',
        eventLogDesc: `${expert.name} enrolled in ${domain} CoP (Fee: $${cost}k).`
      };
    }

    case 'CAPTURE_COP_LEARNING': {
      if (!domain || !learningTarget) return { success: false, message: 'Domain and target required.', eventLogTitle: 'CoP Capture Failed', eventLogDesc: 'Missing parameters.' };

      // Check if other companies have higher domain scores in this CoP
      const activeMembers = session.copMemberships.filter((m) => m.domain === domain && m.companyId !== company.id);
      if (activeMembers.length === 0) {
        return { success: false, message: 'No other companies are currently active in this Community of Practice.', eventLogTitle: 'CoP Capture Failed', eventLogDesc: 'No partner companies in CoP.' };
      }

      if (learningTarget === 'team' && siteId) {
        const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
        if (site) site.codifiedKnowledge[domain] = Math.min(6, site.codifiedKnowledge[domain] + 1);
      } else {
        company.intranet[domain] = Math.min(6, company.intranet[domain] + 1);
      }

      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      return {
        success: true,
        message: `Captured relational knowledge from external CoP peers into corporate ${domain} knowledge base (+1).`,
        eventLogTitle: 'CoP Relational Knowledge Captured',
        eventLogDesc: `Captured external CoP peer insights into ${domain}.`
      };
    }

    case 'HORIZON_SCAN': {
      if (!domain) return { success: false, message: 'Domain required for Horizon Scanning.', eventLogTitle: 'Horizon Scan Failed', eventLogDesc: 'Missing domain.' };
      company.horizonScanDomain = domain;
      company.horizonScanUsedThisRound = false;
      company.actionsRemaining -= 1;

      return {
        success: true,
        message: `Horizon scanning activated for ${domain}. Early warning system ready to anticipate upcoming events next round.`,
        eventLogTitle: 'Horizon Scanning Activated',
        eventLogDesc: `Scouting early risk and opportunity vectors in ${domain}.`
      };
    }

    case 'AUTOMATE': {
      if (!domain) return { success: false, message: 'Domain required for Automation.', eventLogTitle: 'Automation Failed', eventLogDesc: 'Missing domain.' };
      if (company.automatedDomains.includes(domain)) {
        return { success: false, message: `${domain} is already automated across the company.`, eventLogTitle: 'Automation Failed', eventLogDesc: 'Already automated.' };
      }

      // Cost 1d6 * 10 ($10k-$60k) from EVERY active site
      const activeSites = company.sites.filter((s) => !s.isClosed);
      let totalCost = 0;
      for (const site of activeSites) {
        const roll = (Math.floor(Math.random() * config.cost_die) + 1) * 10;
        totalCost += roll;
        site.turnover = Math.max(0, site.turnover - roll);
      }

      company.turnover = company.sites.reduce((sum, s) => sum + s.turnover, 0);
      company.automatedDomains.push(domain);
      company.actionsRemaining -= 1;

      return {
        success: true,
        costTurnover: totalCost,
        message: `Automated ${domain} infrastructure across all ${activeSites.length} operating sites (Capital investment: $${totalCost}k). All future events gain +${config.automation_bonus} support.`,
        eventLogTitle: 'Domain Automated Company-Wide',
        eventLogDesc: `Embedded automated systems for ${domain} across all sites (Cost: $${totalCost}k).`
      };
    }

    case 'KNOWLEDGE_AUDIT': {
      if (!siteId) return { success: false, message: 'Site required for Knowledge Audit.', eventLogTitle: 'Audit Failed', eventLogDesc: 'Missing site.' };
      const site = company.sites.find((s) => s.id === siteId && !s.isClosed);
      if (!site) return { success: false, message: 'Site not found.', eventLogTitle: 'Audit Failed', eventLogDesc: 'Site not found.' };

      company.auditedSiteId = siteId;
      company.actionsRemaining -= 1;

      return {
        success: true,
        message: `Comprehensive Knowledge Audit executed at ${site.name}. Vulnerabilities, SPOF exposure, and absorptive bottlenecks surfaced.`,
        eventLogTitle: 'Knowledge Audit Conducted',
        eventLogDesc: `Diagnostic audit performed on ${site.name}.`
      };
    }

    case 'MOVE_EXPERT': {
      if (!expertId || !targetLocation) return { success: false, message: 'Expert and target location required.', eventLogTitle: 'Relocation Failed', eventLogDesc: 'Missing parameters.' };
      const expert = company.experts.find((e) => e.id === expertId && !e.isVacant);
      if (!expert) return { success: false, message: 'Expert not found.', eventLogTitle: 'Relocation Failed', eventLogDesc: 'Expert not found.' };

      expert.location = targetLocation;
      expert.homeLocation = targetLocation;
      expert.state = targetLocation === 'HQ' ? 'HQ Assignment' : 'Available';
      company.actionsRemaining -= 1;
      recalculateCompanySPOF(company, config);

      const destName = targetLocation === 'HQ' ? 'Corporate Headquarters' : company.sites.find((s) => s.id === targetLocation)?.name || targetLocation;

      return {
        success: true,
        message: `${expert.name} permanently relocated to ${destName}.`,
        eventLogTitle: 'Expert Relocated',
        eventLogDesc: `${expert.name} moved to ${destName}.`
      };
    }

    default:
      return { success: false, message: 'Unknown action type.', eventLogTitle: 'Action Failed', eventLogDesc: 'Invalid action.' };
  }
}

/**
 * Execute Phase 5: Knowledge Risk & Attrition checks
 */
export function executePhase5Attrition(
  session: GameSession,
  company: Company,
  config: SimulationConfig = DEFAULT_CONFIG
): {
  departedExperts: { expertName: string; domains: KnowledgeDomain[]; wasSPOF: boolean; roll: number }[];
  workforceAttrition: { siteName: string; domain: KnowledgeDomain; previousScore: number; newScore: number }[];
  closedSites: string[];
} {
  const departedExperts: { expertName: string; domains: KnowledgeDomain[]; wasSPOF: boolean; roll: number }[] = [];
  const workforceAttrition: { siteName: string; domain: KnowledgeDomain; previousScore: number; newScore: number }[] = [];
  const closedSites: string[] = [];

  // 1. Check each expert for attrition
  for (const expert of company.experts) {
    if (expert.isVacant) {
      // Arrive replacement expert if vacant from previous round!
      expert.isVacant = false;
      expert.name = `Dr. ${expert.name.split(' ')[1] || 'Morgan'} (Replacement)`;
      expert.state = 'Available';
      for (const d of expert.domains) {
        d.score = 4;
      }
      continue;
    }

    const d12 = Math.floor(Math.random() * config.event_die) + 1;
    const leaveThreshold = expert.isSPOF ? config.spof_leave_threshold : config.normal_leave_threshold;

    if (d12 <= leaveThreshold) {
      departedExperts.push({
        expertName: expert.name,
        domains: expert.domains.map((d) => d.domain),
        wasSPOF: expert.isSPOF,
        roll: d12,
      });

      expert.isVacant = true;
      expert.state = 'Available';
    } else {
      // Reset expert temporary activity state
      expert.state = expert.location === 'HQ' ? 'HQ Assignment' : 'Available';
    }
  }

  // 2. Workforce attrition check (1 random site with high uncodified capability)
  const activeSites = company.sites.filter((s) => !s.isClosed);
  if (activeSites.length > 0) {
    const randomSite = activeSites[Math.floor(Math.random() * activeSites.length)];
    const domains: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];

    if (randomSite.teamCapability[randomDomain] > randomSite.codifiedKnowledge[randomDomain] && randomSite.teamCapability[randomDomain] > 1) {
      const prev = randomSite.teamCapability[randomDomain];
      randomSite.teamCapability[randomDomain] -= 1;
      workforceAttrition.push({
        siteName: randomSite.name,
        domain: randomDomain,
        previousScore: prev,
        newScore: randomSite.teamCapability[randomDomain],
      });
    }
  }

  // 3. Site closure check if turnover <= 0
  for (const site of company.sites) {
    if (!site.isClosed && site.turnover <= 0) {
      site.isClosed = true;
      site.turnover = 0;
      closedSites.push(site.name);

      // Lost resident experts
      for (const exp of company.experts) {
        if (exp.location === site.id) {
          exp.isVacant = true;
        }
      }
    }
  }

  // Recalculate company total turnover
  company.turnover = company.sites.reduce((sum, s) => sum + s.turnover, 0);

  // Reset round-level trackers
  company.actionsRemaining = config.actions_per_round;
  company.intranetRoundGrowth = {
    engineering: 0,
    hr: 0,
    marketing: 0,
    operations: 0,
    finance: 0,
  };
  company.horizonScanUsedThisRound = false;

  recalculateCompanySPOF(company, config);

  return {
    departedExperts,
    workforceAttrition,
    closedSites,
  };
}

/**
 * Draw 2 Events for a company for the upcoming round
 */
export function drawRoundEvents(
  company: Company,
  config: SimulationConfig = DEFAULT_CONFIG
): ActiveEvent[] {
  const events: ActiveEvent[] = [];
  const activeSites = company.sites.filter((s) => !s.isClosed);

  for (let i = 0; i < config.events_per_round; i++) {
    // 70% Local, 30% Enterprise
    const scope = Math.random() < 0.7 ? 'local' : 'enterprise';
    const type = Math.random() < 0.6 ? 'problem' : 'opportunity';

    const card = getRandomEventCard(scope, type);
    let targetSiteId: string | undefined = undefined;

    if (scope === 'local' && activeSites.length > 0) {
      if (card.rdSiteOnly) {
        const rdSite = activeSites.find((s) => s.isRDSite);
        targetSiteId = rdSite ? rdSite.id : activeSites[0].id;
      } else {
        targetSiteId = activeSites[Math.floor(Math.random() * activeSites.length)].id;
      }
    }

    const allocations: Record<KnowledgeDomain, ActiveEventAllocation> = {} as any;
    for (const d of card.domains) {
      allocations[d.domain] = {};
    }

    events.push({
      instanceId: `evt-inst-${Math.random().toString(36).substring(2, 8)}`,
      card,
      targetSiteId,
      allocations,
      isResolved: false,
    });
  }

  return events;
}
