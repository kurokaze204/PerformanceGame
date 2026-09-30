import type { CompanyV2 } from '../types/gameV2.ts';

export const STRATEGIC_INVESTMENT_RATE_V1 = 0.05;
export const INITIAL_STRATEGIC_INVESTMENT_FUND_V1 = 25;
export const SITE_KM_ACTIVITY_LIMIT_V1 = 3;
export const EXPERT_RELOCATION_COST_V1 = 20;
const KNOWLEDGE_DOMAINS = ['engineering','hr','marketing','operations','finance'] as const;

const roundMoney = (value:number) => Math.round(value * 10) / 10;

export function strategicInvestmentContributionV1(company:CompanyV2):number {
  return roundMoney(Math.max(0, company.turnover) * STRATEGIC_INVESTMENT_RATE_V1);
}

export function siteKnowledgePointsV1(company:CompanyV2, siteId:string):number {
  const site=company.sites.find(candidate=>candidate.id===siteId&&!candidate.isClosed);
  if(!site)return 0;
  const localKnowledge=KNOWLEDGE_DOMAINS.reduce((sum,domain)=>sum+Math.max(site.teamCapability[domain]||0,site.codifiedKnowledge[domain]||0),0);
  const localExperts=company.experts
    .filter(expert=>!expert.isVacant&&expert.location===site.id)
    .reduce((sum,expert)=>sum+expert.domains.reduce((expertSum,skill)=>expertSum+Math.max(0,skill.score||0),0),0);
  return localKnowledge+localExperts;
}

export function siteTurnoverGrowthPercentV1(company:CompanyV2, siteId:string):number {
  return siteKnowledgePointsV1(company,siteId)/6;
}

export function applyKnowledgeTurnoverGrowthV1(company:CompanyV2):{siteId:string;knowledgePoints:number;growthPercent:number;before:number;after:number}[] {
  const changes=company.sites.filter(site=>!site.isClosed).map(site=>{
    const before=site.turnover;
    const knowledgePoints=siteKnowledgePointsV1(company,site.id);
    const growthPercent=knowledgePoints/6;
    const after=roundMoney(before*(1+growthPercent/100));
    site.turnover=Math.max(0,after);
    return{siteId:site.id,knowledgePoints,growthPercent:roundMoney(growthPercent),before,after:site.turnover};
  });
  company.turnover=roundMoney(company.sites.reduce((sum,site)=>sum+(site.isClosed?0:site.turnover),0));
  return changes;
}

export function siteKmActivitiesUsedThisRoundV1(company:CompanyV2, round:number, siteId:string):number {
  if (company.siteKmActivityUse?.round !== round) return 0;
  return Math.max(0, Number(company.siteKmActivityUse.counts?.[siteId] || 0));
}

export function siteKmActivitiesRemainingV1(company:CompanyV2, round:number, siteId:string):number {
  return Math.max(0, SITE_KM_ACTIVITY_LIMIT_V1 - siteKmActivitiesUsedThisRoundV1(company, round, siteId));
}

export function siteCanTakeKmActivityV1(company:CompanyV2, round:number, siteId:string):boolean {
  return siteKmActivitiesUsedThisRoundV1(company, round, siteId) < SITE_KM_ACTIVITY_LIMIT_V1;
}

export function recordSiteKmActivityV1(company:CompanyV2, round:number, siteId:string):number {
  if (company.siteKmActivityUse?.round !== round) company.siteKmActivityUse = { round, counts: {} };
  const next = siteKmActivitiesUsedThisRoundV1(company, round, siteId) + 1;
  company.siteKmActivityUse.counts[siteId] = next;
  return next;
}

export function roundInvestmentMoneyV1(value:number):number {
  return roundMoney(value);
}
