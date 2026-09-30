import type { CompanyV2 } from '../types/gameV2.ts';

export const STRATEGIC_INVESTMENT_RATE_V1 = 0.05;
export const SITE_KM_ACTIVITY_LIMIT_V1 = 3;

const roundMoney = (value:number) => Math.round(value * 10) / 10;

export function strategicInvestmentContributionV1(company:CompanyV2):number {
  return roundMoney(Math.max(0, company.turnover) * STRATEGIC_INVESTMENT_RATE_V1);
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
