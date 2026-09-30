import type { ActiveEvent, Company, KnowledgeDomain, SimulationConfig, Site } from '../types/game.ts';
import type { ActiveEventAllocationV2, ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { V2_BALANCE, asCompanyV2, asSessionV2 } from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from './config.ts';
import {
  calculateUsableIntranetV2,
  currentConsultantRate,
  recalculateCompanySPOFV2,
  validateEventAllocationV2,
} from './coreV2.ts';
import { copMembershipActiveV4, expertTravelCostV4, recordPublicationEvidenceV4 } from './investmentActionsV4.ts';
import { copSupportBonusV5 } from './copNetworkV5.ts';
import { roundInvestmentMoneyV1 } from './investmentCapacityV1.ts';
import { composeKnowledgeSources } from './knowledgeCompositionV1.ts';

export interface ExplicitSourceValues {
  team: number;
  localCodified: number;
  usableIntranet: number;
  selectedTeam: number;
  selectedLocalCodified: number;
  selectedUsableIntranet: number;
  selectedSiteKnowledge: number;
  selectedBaseKnowledge: number;
  expertTranslator: boolean;
}

function activeSites(company: CompanyV2): Site[] { return company.sites.filter((site) => !site.isClosed); }
function recalcCompanyTurnover(company: CompanyV2): void { company.turnover = roundInvestmentMoneyV1(company.sites.reduce((sum, site) => sum + (site.isClosed ? 0 : site.turnover), 0)); }
function applySiteDelta(company: CompanyV2, site: Site, delta: number): void { site.turnover = Math.max(0, roundInvestmentMoneyV1(site.turnover + delta)); recalcCompanyTurnover(company); }
function applyCompanyDelta(company: CompanyV2, delta: number): void {
  const sites = activeSites(company); if (!sites.length || delta === 0) return;
  const total = sites.reduce((sum, site) => sum + site.turnover, 0); let remaining = Math.round(delta);
  sites.forEach((site, index) => {
    const share = index === sites.length - 1 ? remaining : Math.round(delta * (total > 0 ? site.turnover / total : 1 / sites.length));
    site.turnover = Math.max(0, site.turnover + share);
    remaining -= share;
  });
  recalcCompanyTurnover(company);
}

function closeFailedSites(company:CompanyV2,round:number):string[]{
  const closed:string[]=[];
  for(const site of company.sites){
    if(site.isClosed||site.turnover>0)continue;
    site.isClosed=true;site.turnover=0;closed.push(site.name);
    company.experts.filter(expert=>expert.location===site.id&&!expert.isVacant).forEach(expert=>{
      expert.isVacant=true;
      expert.replacementDueRound=round+1;
    });
  }
  recalcCompanyTurnover(company);
  return closed;
}

function selectedExpert(company:CompanyV2,event:ActiveEventV2,domain:KnowledgeDomain){
  const expertId=event.allocations[domain]?.expertId;
  if(!expertId)return undefined;
  return company.experts.find(expert=>!expert.isVacant&&expert.id===expertId&&expert.domains.some(skill=>skill.domain===domain));
}

export function explicitSourceValuesV2(companyInput: Company,eventInput: ActiveEvent,domain: KnowledgeDomain,config: SimulationConfig = DEFAULT_CONFIG): ExplicitSourceValues {
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  const allocation: ActiveEventAllocationV2 = event.allocations[domain] || {};
  const expertTranslator=Boolean(selectedExpert(company,event,domain));
  let team = 0, localCodified = 0, usableIntranet = 0;

  if (event.card.scope === 'local') {
    const site = company.sites.find((candidate) => candidate.id === event.targetSiteId && !candidate.isClosed);
    if (site) {
      team = site.teamCapability[domain] || 0;
      localCodified = site.codifiedKnowledge[domain] || 0;
      usableIntranet = calculateUsableIntranetV2(company, site, domain, config, expertTranslator);
    }
  } else {
    for (const site of activeSites(company)) {
      team = Math.max(team, site.teamCapability[domain] || 0);
      localCodified = Math.max(localCodified, site.codifiedKnowledge[domain] || 0);
      usableIntranet = expertTranslator
        ? Math.max(usableIntranet, company.intranet[domain] || 0)
        : Math.max(usableIntranet, calculateUsableIntranetV2(company, site, domain, config));
    }
  }

  const selectedTeam = allocation.useTeamCapability ? team : 0;
  const selectedLocalCodified = allocation.useLocalCodified ? localCodified : 0;
  const selectedUsableIntranet = allocation.useCorporateIntranet ? usableIntranet : 0;
  const selectedSiteKnowledge = Math.max(selectedTeam, selectedLocalCodified);
  return {
    team,
    localCodified,
    usableIntranet,
    selectedTeam,
    selectedLocalCodified,
    selectedUsableIntranet,
    selectedSiteKnowledge,
    selectedBaseKnowledge: Math.max(selectedSiteKnowledge, selectedUsableIntranet),
    expertTranslator,
  };
}

function winChance(eventDie: number, targetThreshold: number, totalKnowledge: number): number {
  let wins = 0;
  for (let roll = 1; roll <= eventDie; roll++) if (roll + totalKnowledge >= targetThreshold) wins += 1;
  return Math.round((wins / eventDie) * 100);
}

export function evaluateEventDomainKnowledgeExplicitV2(
  sessionInput: GameSessionV2,
  companyInput: Company,
  eventInput: ActiveEvent,
  domain: KnowledgeDomain,
  config: SimulationConfig = DEFAULT_CONFIG,
  ignoreConsultant = false,
) {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  const allocation = event.allocations[domain] || {};
  const sources = explicitSourceValuesV2(company, event, domain, config);

  if (session.experienceMode === 'newbie') {
    sources.localCodified = 0;
    sources.selectedLocalCodified = 0;
    sources.selectedSiteKnowledge = sources.selectedTeam;
    sources.selectedBaseKnowledge = Math.max(sources.selectedTeam, sources.selectedUsableIntranet);
  }

  const expert=selectedExpert(company,event,domain);
  const expertScore=expert?.domains.find(skill=>skill.domain===domain)?.score||0;
  const composed=composeKnowledgeSources([
    sources.selectedSiteKnowledge,
    sources.selectedUsableIntranet,
    expertScore,
  ]);
  const copBonus=allocation.useCoPSupport&&copMembershipActiveV4(session,company.id,domain)
    ? copSupportBonusV5(session,company,domain,composed.depth)
    : 0;
  const automationBonus=company.automatedDomains.includes(domain)?config.automation_bonus:0;
  const withoutConsultant=composed.total+copBonus+automationBonus;
  const difficulty=event.card.domains.find(requirement=>requirement.domain===domain)?.difficulty??4;
  const targetThreshold=difficulty+config.resolution_offset;
  const usefulGap=Math.max(0,targetThreshold-withoutConsultant);
  const requestedConsultant=ignoreConsultant?0:Math.max(0,Math.min(V2_BALANCE.consultantMaxPointsPerDomain,allocation.consultantPoints||0));
  const consultantPoints=Math.min(requestedConsultant,usefulGap);
  const totalKnowledge=withoutConsultant+consultantPoints;
  const winChancePercent=winChance(config.event_die,targetThreshold,totalKnowledge);
  const likelihood=winChancePercent>=90?'Very High':winChancePercent>=70?'High':winChancePercent>=40?'Moderate':winChancePercent>=20?'Low':'Very Low';

  return {
    baseKnowledge:composed.total,
    depthKnowledge:composed.depth,
    breadthBonus:composed.breadth,
    sourceCount:composed.sourceCount,
    siteKnowledge:sources.selectedSiteKnowledge,
    team:sources.selectedTeam,
    localCodified:sources.selectedLocalCodified,
    usableIntranet:sources.selectedUsableIntranet,
    expertBonus:expertScore,
    expertScore,
    expertTranslator:sources.expertTranslator,
    copBonus,
    automationBonus,
    consultantPoints,
    usefulConsultantGap:Math.min(V2_BALANCE.consultantMaxPointsPerDomain,usefulGap),
    totalKnowledge,
    difficulty,
    targetThreshold,
    requiredDie:targetThreshold-totalKnowledge,
    winChancePercent,
    likelihood,
    availableSources:sources,
  };
}

export function validateEventAllocationExplicitV2(
  sessionInput: GameSessionV2,
  companyInput: Company,
  eventInput: ActiveEvent,
  domain: KnowledgeDomain,
  allocation: ActiveEventAllocationV2,
): { ok: boolean; message?: string } {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  if (session.experienceMode === 'newbie' && allocation.useLocalCodified) allocation = { ...allocation, useLocalCodified: false };

  const old = event.allocations[domain];
  const v4CopAllowed = !!allocation.useCoPSupport && copMembershipActiveV4(session, company.id, domain);
  event.allocations[domain] = { ...allocation, consultantPoints: 0, useCoPSupport: v4CopAllowed ? false : allocation.useCoPSupport };
  const baseValidation = validateEventAllocationV2(session, company, event, domain, event.allocations[domain]);
  event.allocations[domain] = old;
  if (!baseValidation.ok) return baseValidation;
  if (allocation.useCoPSupport && !v4CopAllowed) return { ok: false, message: 'No active Community of Practice is available for this domain.' };
  if (allocation.consultantPoints != null) {
    const points = Math.floor(allocation.consultantPoints);
    if (points < 0 || points > V2_BALANCE.consultantMaxPointsPerDomain) return { ok: false, message: 'Consultant support is limited to 3 knowledge points per domain.' };
  }
  return { ok: true };
}

export function resolveSingleEventExplicitV2(sessionInput: GameSessionV2, companyInput: Company, eventInput: ActiveEvent) {
  const session = asSessionV2(sessionInput);
  const company = asCompanyV2(companyInput);
  const event = eventInput as ActiveEventV2;
  if(session.phase!=='respond')throw new Error('Events can only be resolved during Respond phase.');
  if(event.isResolved)throw new Error('Event already resolved.');

  const domainResults:any[]=[];
  const consultantDetails:any[]=[];
  const chargedTravellers=new Set<string>();
  let allSucceeded=true;
  let interventionCost=0;

  for(const requirement of event.card.domains){
    const domain=requirement.domain;
    const allocation=event.allocations[domain]||{};
    if(session.experienceMode==='newbie')allocation.useLocalCodified=false;
    const evaluation=evaluateEventDomainKnowledgeExplicitV2(session,company,event,domain,session.config);

    if(allocation.expertId){
      const expert=selectedExpert(company,event,domain);
      if(expert){
        if(event.card.scope==='local'&&event.targetSiteId&&expert.location!==event.targetSiteId&&!chargedTravellers.has(expert.id)){
          const travelCost=expertTravelCostV4(expert.location,event.targetSiteId);
          interventionCost+=travelCost;
          allocation.expertTravelCost=travelCost;
          chargedTravellers.add(expert.id);
        }
        expert.state='Supporting Event';
      }
    }

    if(evaluation.consultantPoints>0){
      const rate=currentConsultantRate(company);
      const cost=rate*evaluation.consultantPoints;
      allocation.consultantCost=cost;
      interventionCost+=cost;
      consultantDetails.push({domain,points:evaluation.consultantPoints,rate,cost,engagementNumber:company.consultantEngagements+1});
      company.consultantEngagements+=1;
    }

    const dieRoll=Math.floor(Math.random()*session.config.event_die)+1;
    const achievedTotal=dieRoll+evaluation.totalKnowledge;
    const domainSuccess=achievedTotal>=evaluation.targetThreshold;
    if(!domainSuccess)allSucceeded=false;
    domainResults.push({
      domain,
      baseKnowledge:evaluation.baseKnowledge,
      depthKnowledge:evaluation.depthKnowledge,
      breadthBonus:evaluation.breadthBonus,
      siteKnowledge:evaluation.siteKnowledge,
      usableIntranet:evaluation.usableIntranet,
      team:evaluation.team,
      localCodified:evaluation.localCodified,
      expertBonus:evaluation.expertScore,
      expertScore:evaluation.expertScore,
      copBonus:evaluation.copBonus,
      automationBonus:evaluation.automationBonus,
      consultantBonus:evaluation.consultantPoints,
      totalKnowledge:evaluation.totalKnowledge,
      difficulty:requirement.difficulty,
      dieRoll,
      requiredTotal:evaluation.targetThreshold,
      achievedTotal,
      domainSuccess,
      explanation:`Depth ${evaluation.depthKnowledge} + breadth ${evaluation.breadthBonus} + CoP ${evaluation.copBonus} + automation ${evaluation.automationBonus} + consultant ${evaluation.consultantPoints}; rolled ${dieRoll}; needed ${evaluation.targetThreshold}.`,
    });
  }

  if(interventionCost>0){
    if(event.card.scope==='local'&&event.targetSiteId){
      const target=company.sites.find(site=>site.id===event.targetSiteId&&!site.isClosed);
      if(target)applySiteDelta(company,target,-interventionCost);
    }else applyCompanyDelta(company,-interventionCost);
  }

  let turnoverChange=0;
  if(event.card.type==='problem'&&!allSucceeded)turnoverChange=-event.card.impact;
  if(event.card.type==='opportunity'&&allSucceeded)turnoverChange=event.card.impact;
  if(turnoverChange!==0){
    if(event.card.scope==='local'&&event.targetSiteId){
      const target=company.sites.find(site=>site.id===event.targetSiteId&&!site.isClosed);
      if(target)applySiteDelta(company,target,turnoverChange);
    }else applyCompanyDelta(company,turnoverChange);
  }

  closeFailedSites(company,session.round);
  event.isResolved=true;
  event.success=allSucceeded;
  event.domainResults=domainResults;
  event.turnoverChangeApplied=turnoverChange;
  event.consultantSpend=consultantDetails.reduce((sum,item)=>sum+item.cost,0);
  event.resolvedAt=new Date().toISOString();

  const highValueEvidence=event.card.tags?.some(tag=>['critical','safety','site-threatening','specialist','novel'].includes(tag))?2:1;
  for(const requirement of event.card.domains)recordPublicationEvidenceV4(company,requirement.domain,highValueEvidence);
  recalculateCompanySPOFV2(company,session.config);

  return{success:allSucceeded,turnoverChange,interventionCost,consultantDetails,domainResults};
}
