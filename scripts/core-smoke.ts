import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import {
  buildEventTypePlan,
  createInitialCompanyV2,
  currentConsultantRate,
  drawRoundEventsV2,
  executeKnowledgeActionV2,
  prepareNextRoundV2,
  resolveSingleEventV2,
  validateEventAllocationV2,
} from '../src/engine/coreV2.ts';
import {
  evaluateEventDomainKnowledgeExplicitV2,
  resolveSingleEventExplicitV2,
} from '../src/engine/challengeResponseV2.ts';
import { executeInvestmentActionV4, expertTravelCostV4, INVESTMENT_COSTS_V4 } from '../src/engine/investmentActionsV4.ts';
import { INITIAL_STRATEGIC_INVESTMENT_FUND_V1, SITE_KM_ACTIVITY_LIMIT_V1, STRATEGIC_INVESTMENT_RATE_V1, siteKnowledgePointsV1, siteTurnoverGrowthPercentV1 } from '../src/engine/investmentCapacityV1.ts';
import { COP_GENERAL_DOMAIN_V5, companyHasCopMembershipV5, reciprocalCopPeersV5 } from '../src/engine/copNetworkV5.ts';
import { asSessionV2 } from '../src/types/gameV2.ts';
import type { ActiveEvent, EventCard, GameSession } from '../src/types/game.ts';

function makeSession(mode:'newbie'|'expert'='newbie') {
  const company = createInitialCompanyV2('Smoke Co', 'smoke-co', DEFAULT_CONFIG);
  const session = asSessionV2({
    id: 'SMOKE',
    title: 'Smoke Test',
    round: 1,
    phase: 'events',
    isPaused: false,
    isFinalDisruptionActive: false,
    companies: [company],
    activeEvents: { [company.id]: [] },
    copMemberships: [],
    config: { ...DEFAULT_CONFIG },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as GameSession);
  session.experienceMode=mode;
  return { session, company };
}


assert.equal(DEFAULT_CONFIG.spof_gap,4,'SPOF must require a four-point depth gap');
assert.equal(DEFAULT_CONFIG.normal_leave_threshold,1,'ordinary experts only retire on roll 1');
assert.equal(DEFAULT_CONFIG.spof_leave_threshold,3,'SPOF experts leave on rolls 1-3: retire on 1, resign on 2-3');
assert.deepEqual({
  KNOWLEDGE_TRANSFER:INVESTMENT_COSTS_V4.KNOWLEDGE_TRANSFER,
  SITE_KNOWLEDGE_SHARING:INVESTMENT_COSTS_V4.SITE_KNOWLEDGE_SHARING,
  CORPORATE_TRAINING:INVESTMENT_COSTS_V4.CORPORATE_TRAINING,
  CODIFY_SITE:INVESTMENT_COSTS_V4.CODIFY_SITE,
  TRAIN_EXPERT:INVESTMENT_COSTS_V4.TRAIN_EXPERT,
  UPDATE_INTRANET:INVESTMENT_COSTS_V4.UPDATE_INTRANET,
  LESSONS_LEARNED:INVESTMENT_COSTS_V4.LESSONS_LEARNED,
  JOIN_COP:INVESTMENT_COSTS_V4.JOIN_COP,
  HORIZON_SCAN:INVESTMENT_COSTS_V4.HORIZON_SCAN,
  AUTOMATE:INVESTMENT_COSTS_V4.AUTOMATE,
},{
  KNOWLEDGE_TRANSFER:18,
  SITE_KNOWLEDGE_SHARING:5,
  CORPORATE_TRAINING:60,
  CODIFY_SITE:2.5,
  TRAIN_EXPERT:20,
  UPDATE_INTRANET:30,
  LESSONS_LEARNED:8,
  JOIN_COP:5,
  HORIZON_SCAN:40,
  AUTOMATE:80,
},'investment costs must match the rebalanced economy');
assert.equal(expertTravelCostV4('melbourne','melbourne'),0,'same-city expert use should not add travel cost');
for(const from of ['melbourne','sydney','brisbane','adelaide','perth','darwin']){
  for(const to of ['melbourne','sydney','brisbane','adelaide','perth','darwin']){
    const travel=expertTravelCostV4(from,to);
    if(from===to)assert.equal(travel,0,'same-city expert travel must remain free');
    else{
      assert.ok(travel>=0.4&&travel<=1.6,'expert travel must stay between $0.4k and $1.6k');
      assert.equal(Math.round(travel*10),travel*10,'expert travel must use one-decimal $k increments');
    }
  }
}

// SIF starts at a fixed $25k without reducing turnover.
{
  const { company }=makeSession();
  const before=company.turnover;
  assert.equal(company.strategicInvestmentFund,INITIAL_STRATEGIC_INVESTMENT_FUND_V1);
  assert.equal(company.strategicInvestmentFund,25);
  assert.equal(company.turnover,before,'creating the SIF must not transfer money out of site turnover');
}

// Round-start site growth is driven by local knowledge plus experts, then the 3% SIF budget is added from the new turnover.
{
  const { session,company }=makeSession('expert');
  const site=company.sites[0];
  const domains=['engineering','hr','marketing','operations','finance'] as const;
  for(const domain of domains){site.teamCapability[domain]=2;site.codifiedKnowledge[domain]=1;}
  company.experts.forEach((expert,index)=>{expert.location=index===0?site.id:'HQ';expert.homeLocation=expert.location;});
  const localExpertPoints=company.experts[0].domains.reduce((sum,skill)=>sum+skill.score,0);
  assert.equal(siteKnowledgePointsV1(company,site.id),10+localExpertPoints);
  assert.equal(siteTurnoverGrowthPercentV1(company,site.id),(10+localExpertPoints)/6);
  const beforeSite=site.turnover;
  const beforeCompany=company.turnover;
  company.strategicInvestmentFund=25;
  session.round=2;
  prepareNextRoundV2(session);
  assert.ok(site.turnover>beforeSite,'site turnover must grow at the start of a round');
  assert.ok(company.turnover>beforeCompany,'company turnover must reflect knowledge-driven site growth');
  assert.equal(STRATEGIC_INVESTMENT_RATE_V1,0.03,'round SIF contribution must be 3% of turnover');
  assert.equal(company.strategicInvestmentFund,Math.round((25+company.turnover*STRATEGIC_INVESTMENT_RATE_V1)*10)/10,'SIF budget must be calculated after turnover growth');
}

// SIF can fund a local investment and each site can absorb at most three local KM activities per round.
{
  const { session, company }=makeSession('expert');
  session.phase='investment';
  company.actionsRemaining=6;
  const site=company.sites.find(candidate=>!candidate.isClosed)!;
  const domains=['engineering','hr','marketing','operations'] as const;
  for(const domain of domains){site.teamCapability[domain]=6;site.codifiedKnowledge[domain]=0;}
  const beforeTurnover=site.turnover;
  const beforeSif=company.strategicInvestmentFund;
  const first=executeInvestmentActionV4(session,company,{type:'CODIFY_SITE',companyId:company.id,siteId:site.id,domain:domains[0],useSIF:true});
  assert.equal(first.success,true);
  assert.equal(site.turnover,beforeTurnover,'SIF-funded local work must not reduce site turnover');
  assert.equal(company.strategicInvestmentFund,Math.round((beforeSif-2.5)*10)/10);
  for(const domain of domains.slice(1,3)){
    const result=executeInvestmentActionV4(session,company,{type:'CODIFY_SITE',companyId:company.id,siteId:site.id,domain,useSIF:true});
    assert.equal(result.success,true);
  }
  const fourth=executeInvestmentActionV4(session,company,{type:'CODIFY_SITE',companyId:company.id,siteId:site.id,domain:domains[3],useSIF:true});
  assert.equal(fourth.success,false);
  assert.match(String(fourth.message),/too busy for more KM work/i);
  assert.equal(SITE_KM_ACTIVITY_LIMIT_V1,3);
}

// 1. Planned game has an equal event mix.
{
  const plan = buildEventTypePlan(DEFAULT_CONFIG);
  assert.equal(plan.length, 10);
  assert.equal(plan.filter((x) => x === 'problem').length, 5);
  assert.equal(plan.filter((x) => x === 'opportunity').length, 5);
}

// 2. Consultant dependence gets progressively more expensive.
{
  const { company } = makeSession();
  assert.equal(currentConsultantRate(company), 15);
  company.consultantEngagements = 1;
  assert.equal(currentConsultantRate(company), 20);
  company.consultantEngagements = 2;
  assert.equal(currentConsultantRate(company), 27);
}

// 3. Ten ordinary draws remain 5/5 when played to completion.
{
  const { session, company } = makeSession();
  for (let round = 1; round <= 5; round++) {
    session.round = round;
    drawRoundEventsV2(session, company);
  }
  assert.equal(company.problemEventsDrawn, 5);
  assert.equal(company.opportunityEventsDrawn, 5);
}

// 4. The same expert cannot be reserved for two separate events.
{
  const { session, company } = makeSession();
  const expert = company.experts[0];
  const domain = expert.domains[0].domain;
  const card: EventCard = {
    id: 'TEST-ONE', type: 'problem', scope: 'enterprise', title: 'Test', description: 'Test',
    domains: [{ domain, difficulty: 5 }], impact: 100, tags: ['test'],
  };
  const a: ActiveEvent = { instanceId: 'A', card, allocations: { [domain]: { expertId: expert.id } } as any, isResolved: false };
  const b: ActiveEvent = { instanceId: 'B', card: { ...card, id: 'TEST-TWO' }, allocations: { [domain]: {} } as any, isResolved: false };
  session.activeEvents[company.id] = [a as any, b as any];
  session.phase = 'respond';
  const check = validateEventAllocationV2(session, company, b, domain, { expertId: expert.id });
  assert.equal(check.ok, false);
}

// 5. Enterprise event impacts really change company/site turnover.
{
  const { session, company } = makeSession();
  session.phase = 'respond';
  const before = company.turnover;
  const card: EventCard = {
    id: 'TEST-ENTERPRISE-LOSS', type: 'problem', scope: 'enterprise', title: 'Certain loss', description: 'Smoke test',
    domains: [{ domain: 'finance', difficulty: 99 }], impact: 120, tags: ['test'],
  };
  const event: ActiveEvent = { instanceId: 'LOSS', card, allocations: { finance: {} } as any, isResolved: false };
  const result = resolveSingleEventV2(session, company, event);
  assert.equal(result.success, false);
  assert.equal(company.turnover, before - 120);
  assert.equal(company.turnover, company.sites.reduce((sum, s) => sum + s.turnover, 0));
}

// 6. Knowledge actions are illegal outside Investment phase.
{
  const { session, company } = makeSession();
  session.phase = 'respond';
  const result = executeKnowledgeActionV2(session, company, { type: 'HORIZON_SCAN', companyId: company.id, domain: 'finance' });
  assert.equal(result.success, false);
}

// 7. Expert mode retains explicit Team / Local Codified / Intranet source selection.
{
  const { session, company } = makeSession('expert');
  session.phase = 'respond';
  const site = company.sites.find((candidate) => !candidate.isClosed)!;
  site.teamCapability.finance = 4;
  site.codifiedKnowledge.finance = 3;
  company.intranet.finance = 5;
  const card: EventCard = {
    id: 'TEST-EXPLICIT-SOURCES', type: 'problem', scope: 'local', title: 'Explicit source test', description: 'Smoke test',
    domains: [{ domain: 'finance', difficulty: 6 }], impact: 100, tags: ['test'],
  };
  const event: ActiveEvent = {
    instanceId: 'EXPLICIT',
    card,
    targetSiteId: site.id,
    allocations: { finance: {} } as any,
    isResolved: false,
  };

  const none = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(none.baseKnowledge, 0);
  assert.equal(none.team, 0);
  assert.equal(none.localCodified, 0);
  assert.equal(none.usableIntranet, 0);

  (event.allocations.finance as any).useTeamCapability = true;
  const teamOnly = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(teamOnly.baseKnowledge, 4);
  assert.equal(teamOnly.team, 4);
  assert.equal(teamOnly.localCodified, 0);

  (event.allocations.finance as any).useTeamCapability = false;
  (event.allocations.finance as any).useLocalCodified = true;
  const docsOnly = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(docsOnly.baseKnowledge, 3);
  assert.equal(docsOnly.localCodified, 3);

  (event.allocations.finance as any).useLocalCodified = false;
  (event.allocations.finance as any).useCorporateIntranet = true;
  const intranetOnly = evaluateEventDomainKnowledgeExplicitV2(session, company, event, 'finance', session.config);
  assert.equal(intranetOnly.baseKnowledge, Math.min(company.intranet.finance, site.teamCapability.finance + session.config.absorptive_capacity_bonus));
}

// 8. Expert explicit-source resolution records deliberately selected Local Codified knowledge.
{
  const { session, company } = makeSession('expert');
  session.phase = 'respond';
  const site = company.sites.find((candidate) => !candidate.isClosed)!;
  site.teamCapability.finance = 5;
  site.codifiedKnowledge.finance = 4;
  company.intranet.finance = 5;
  const card: EventCard = {
    id: 'TEST-EXPLICIT-RESOLVE', type: 'problem', scope: 'local', title: 'Certain explicit loss', description: 'Smoke test',
    domains: [{ domain: 'finance', difficulty: 99 }], impact: 10, tags: ['test'],
  };
  const event: ActiveEvent = {
    instanceId: 'EXPLICIT-RESOLVE', card, targetSiteId: site.id,
    allocations: { finance: { useLocalCodified: true } } as any, isResolved: false,
  };
  const result = resolveSingleEventExplicitV2(session, company, event);
  assert.equal(result.success, false);
  assert.equal(result.domainResults[0].baseKnowledge, 4);
  assert.equal(result.domainResults[0].team, 0);
  assert.equal(result.domainResults[0].localCodified, 4);
  assert.equal(result.domainResults[0].difficulty, 99);
}

// 9. Newbie mode deliberately ignores Local Codified Knowledge as a selectable challenge source.
{
  const { session, company } = makeSession('newbie');
  session.phase='respond';
  const site=company.sites.find(candidate=>!candidate.isClosed)!;
  site.teamCapability.finance=2; site.codifiedKnowledge.finance=6;
  const card:EventCard={id:'NEWBIE-NO-DOCS',type:'problem',scope:'local',title:'Simplified Newbie source model',description:'Smoke test',domains:[{domain:'finance',difficulty:6}],impact:10,tags:['test']};
  const event:ActiveEvent={instanceId:'NEWBIE-NO-DOCS',card,targetSiteId:site.id,allocations:{finance:{useLocalCodified:true}} as any,isResolved:false};
  const value=evaluateEventDomainKnowledgeExplicitV2(session,company,event,'finance',session.config);
  assert.equal(value.localCodified,0);
  assert.equal(value.baseKnowledge,0);
}


// 10. Knowledge combines as depth plus breadth, and an expert unlocks the full Intranet.
{
  const { session, company } = makeSession('expert');
  session.phase='respond';
  const site=company.sites.find(candidate=>!candidate.isClosed)!;
  const expert=company.experts.find(candidate=>!candidate.isVacant)!;
  const domain=expert.domains[0].domain;
  site.teamCapability[domain]=4;
  site.codifiedKnowledge[domain]=2;
  company.intranet[domain]=7;
  expert.domains.find(skill=>skill.domain===domain)!.score=6;
  const card:EventCard={id:'DEPTH-BREADTH',type:'problem',scope:'local',title:'Depth breadth',description:'Smoke test',domains:[{domain,difficulty:10}],impact:10,tags:['test']};
  const event:ActiveEvent={instanceId:'DEPTH-BREADTH',card,targetSiteId:site.id,allocations:{[domain]:{useTeamCapability:true,useCorporateIntranet:true}} as any,isResolved:false};
  const noExpert=evaluateEventDomainKnowledgeExplicitV2(session,company,event,domain,session.config);
  assert.equal(noExpert.usableIntranet,6,'without an expert, Intranet use must remain limited by absorptive capacity');
  assert.equal(noExpert.depthKnowledge,6);
  assert.equal(noExpert.breadthBonus,1);
  assert.equal(noExpert.totalKnowledge,7);

  (event.allocations as any)[domain].expertId=expert.id;
  const withExpert=evaluateEventDomainKnowledgeExplicitV2(session,company,event,domain,session.config);
  assert.equal(withExpert.usableIntranet,7,'a relevant expert acts as translator and unlocks the full Intranet');
  assert.equal(withExpert.depthKnowledge,7);
  assert.equal(withExpert.breadthBonus,2);
  assert.equal(withExpert.totalKnowledge,9,'best source sets depth; site and expert each add breadth');
}

// 11. AAR creates local, expert and corporate knowledge together without arbitrary score ceilings.
{
  const { session, company } = makeSession('newbie');
  session.phase='investment';
  company.actionsRemaining=5;
  const site=company.sites.find(candidate=>!candidate.isClosed)!;
  const expert=company.experts.find(candidate=>!candidate.isVacant)!;
  const domain=expert.domains[0].domain;
  site.teamCapability[domain]=8;
  expert.domains.find(skill=>skill.domain===domain)!.score=8;
  company.intranet[domain]=8;
  const event:ActiveEvent={instanceId:'AAR-LEARNING',card:{id:'AAR-LEARNING',type:'problem',scope:'local',title:'AAR learning',description:'Smoke test',domains:[{domain,difficulty:5}],impact:10,tags:['test']},targetSiteId:site.id,allocations:{[domain]:{}} as any,isResolved:true,success:true};
  session.activeEvents[company.id]=[event as any];
  const otherSite=company.sites.find(candidate=>!candidate.isClosed&&candidate.id!==site.id)!;
  expert.location=otherSite.id;
  expert.homeLocation=otherSite.id;
  const expectedTravel=expertTravelCostV4(expert.location,site.id);
  const result:any=executeInvestmentActionV4(session,company,{type:'LESSONS_LEARNED',companyId:company.id,siteId:site.id,expertId:expert.id,domain,eventInstanceId:event.instanceId});
  assert.equal(result.success,true);
  assert.equal(site.teamCapability[domain],9);
  assert.equal(expert.domains.find(skill=>skill.domain===domain)!.score,9);
  assert.equal(company.intranet[domain],9);
  assert.equal(result.travelCost,expectedTravel,'AAR must charge facilitator travel to the AAR site');
  assert.equal(result.costTurnover,Math.round((8+expectedTravel)*10)/10,'AAR total must be $8k plus facilitator travel');
  assert.equal(event.experientialLearningAwarded,true);
  const repeat=executeInvestmentActionV4(session,company,{type:'LESSONS_LEARNED',companyId:company.id,siteId:site.id,expertId:expert.id,domain,eventInstanceId:event.instanceId});
  assert.equal(repeat.success,false,'the same completed challenge cannot generate a second AAR');
}

// 12. Any employed expert may facilitate an AAR, but non-domain facilitators do not gain personal expertise.
{
  const { session, company } = makeSession('expert');
  session.phase='investment';
  company.actionsRemaining=5;
  const site=company.sites.find(candidate=>!candidate.isClosed)!;
  const domain=company.experts.find(candidate=>!candidate.isVacant)!.domains[0].domain;
  const facilitator=company.experts.find(candidate=>!candidate.isVacant&&!candidate.domains.some(skill=>skill.domain===domain))!;
  assert.ok(facilitator,'smoke company must include a non-domain facilitator');
  const beforeFacilitatorScores=facilitator.domains.map(skill=>skill.score);
  const teamBefore=site.teamCapability[domain];
  const intranetBefore=company.intranet[domain];
  const event:ActiveEvent={instanceId:'AAR-NON-DOMAIN',card:{id:'AAR-NON-DOMAIN',type:'problem',scope:'local',title:'Cross-domain facilitator',description:'Smoke test',domains:[{domain,difficulty:5}],impact:10,tags:['test']},targetSiteId:site.id,allocations:{[domain]:{}} as any,isResolved:true,success:true};
  session.activeEvents[company.id]=[event as any];
  const result:any=executeInvestmentActionV4(session,company,{type:'LESSONS_LEARNED',companyId:company.id,siteId:site.id,expertId:facilitator.id,domain,eventInstanceId:event.instanceId});
  assert.equal(result.success,true);
  assert.equal(site.teamCapability[domain],teamBefore+1);
  assert.equal(company.intranet[domain],intranetBefore+1);
  assert.deepEqual(facilitator.domains.map(skill=>skill.score),beforeFacilitatorScores,'non-domain facilitator expertise must not increase');
  assert.equal(result.aarLearning?.expertDelta,0);
}

// 13. CoP support is reciprocal: Newbie membership is general; Expert membership is domain-specific.
{
  const a=createInitialCompanyV2('Alpha','cop-alpha',DEFAULT_CONFIG);
  const b=createInitialCompanyV2('Beta','cop-beta',DEFAULT_CONFIG);
  const session=asSessionV2({
    id:'COP-SMOKE',title:'CoP smoke',round:2,phase:'investment',isPaused:false,isFinalDisruptionActive:false,
    companies:[a,b],activeEvents:{[a.id]:[],[b.id]:[]},copMemberships:[],config:{...DEFAULT_CONFIG},
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
  } as GameSession);
  session.experienceMode='newbie';
  a.actionsRemaining=5;b.actionsRemaining=5;
  const aExpert=a.experts.find(expert=>!expert.isVacant)!;
  const bExpert=b.experts.find(expert=>!expert.isVacant)!;
  const aJoin=executeInvestmentActionV4(session,a,{type:'JOIN_COP',companyId:a.id,expertId:aExpert.id,domain:aExpert.domains[0].domain});
  assert.equal(aJoin.success,true);
  assert.equal(a.actionsRemaining,4,'joining a CoP costs one Action');
  assert.equal(session.copMemberships[0].domain,COP_GENERAL_DOMAIN_V5);
  assert.equal(companyHasCopMembershipV5(session,a.id,'operations'),true,'Newbie CoP must cover every Newbie domain');
  assert.equal(reciprocalCopPeersV5(session,a.id,'operations').length,0,'one company alone must not activate CoP support');
  const bJoin=executeInvestmentActionV4(session,b,{type:'JOIN_COP',companyId:b.id,expertId:bExpert.id,domain:bExpert.domains[0].domain});
  assert.equal(bJoin.success,true);
  assert.equal(reciprocalCopPeersV5(session,a.id,'operations').length,1,'two joined companies activate the Newbie general CoP');

  session.experienceMode='expert';
  session.round=3;
  session.copMemberships=[];
  a.actionsRemaining=5;b.actionsRemaining=5;
  const sharedDomain=aExpert.domains.find(skill=>bExpert.domains.some(other=>other.domain===skill.domain))?.domain;
  if(sharedDomain){
    assert.equal(executeInvestmentActionV4(session,a,{type:'JOIN_COP',companyId:a.id,expertId:aExpert.id,domain:sharedDomain}).success,true);
    assert.equal(executeInvestmentActionV4(session,b,{type:'JOIN_COP',companyId:b.id,expertId:bExpert.id,domain:sharedDomain}).success,true);
    assert.equal(reciprocalCopPeersV5(session,a.id,sharedDomain).length,1);
    const otherDomain=(['engineering','hr','marketing','operations','finance'] as const).find(domain=>domain!==sharedDomain)!;
    assert.equal(reciprocalCopPeersV5(session,a.id,otherDomain).length,0,'Expert CoP must not spill into unregistered domains');
  }
}

// Empty companies intentionally have no automation in the CEO model. They neither
// advance themselves nor block staffed companies, so there is no autopilot engine
// to test or maintain.

console.log('Core V2 smoke tests passed.');
