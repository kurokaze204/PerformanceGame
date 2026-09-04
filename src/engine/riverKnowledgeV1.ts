import type { KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, ExperienceMode, GameSessionV2 } from '../types/gameV2.ts';
import { INVESTMENT_COSTS_V4, recordPublicationEvidenceV4 } from './investmentActionsV4.ts';
import { recalculateCompanySPOFV2 } from './coreV2.ts';

export function riverSiteKnowledgeScore(site:CompanyV2['sites'][number],domain:KnowledgeDomain,mode:ExperienceMode='expert'):number{
  // Newbie deliberately collapses local knowledge into Team Capability so players
  // do not have to reason about a second hidden local codification metric.
  return mode==='newbie'
    ? (site.teamCapability[domain]||0)
    : Math.max(site.teamCapability[domain]||0,site.codifiedKnowledge[domain]||0);
}

export function riverTransferTarget(sourceScore:number,currentScore=0):number{
  const source=Math.max(0,Math.min(6,sourceScore));
  const current=Math.max(0,Math.min(6,currentScore));
  if(source<=current)return current;
  return Math.max(0,Math.min(6,current+Math.ceil((source-current)*0.5)));
}

export function executeRiverKnowledgeSharing(session:GameSessionV2,company:CompanyV2,payload:any){
  if(session.phase!=='investment')return{success:false,message:'Knowledge Transfer can only be used during the Invest phase.',session};
  if(company.actionsRemaining<=0)return{success:false,message:'No knowledge actions remaining this round.',session};
  const sourceSiteId=String(payload?.sourceSiteId||'');
  const siteId=String(payload?.siteId||'');
  const domain=payload?.domain as KnowledgeDomain|undefined;
  if(!sourceSiteId||!siteId||!domain)return{success:false,message:'Choose a teaching site, receiving site and domain.',session};
  if(sourceSiteId===siteId)return{success:false,message:'Choose two different sites for Knowledge Transfer.',session};
  const source=company.sites.find(s=>s.id===sourceSiteId&&!s.isClosed);
  const target=company.sites.find(s=>s.id===siteId&&!s.isClosed);
  if(!source||!target)return{success:false,message:'Both sites must be active.',session};
  const sourceScore=riverSiteKnowledgeScore(source,domain,session.experienceMode);
  const before=target.teamCapability[domain]||0;
  const targetScore=riverTransferTarget(sourceScore,before);
  if(targetScore<=before)return{success:false,message:`${target.name} already has Team Capability ${before}; ${source.name} cannot lift it further through Knowledge Transfer.`,session};
  target.teamCapability[domain]=targetScore;
  recordPublicationEvidenceV4(company,domain,1);
  const cost=INVESTMENT_COSTS_V4.SITE_KNOWLEDGE_SHARING;
  target.turnover=Math.max(0,target.turnover-cost);
  company.turnover=Math.round(company.sites.reduce((sum,s)=>sum+(s.isClosed?0:s.turnover),0));
  company.actionsRemaining-=1;
  recalculateCompanySPOFV2(company,session.config);
  return{
    success:true,
    session,
    message:`${source.name} transferred ${domain} practice to ${target.name}. ${target.name} Team Capability increased ${before} → ${targetScore}, closing half the gap toward ${source.name}'s locally available ${session.experienceMode==='newbie'?'Team Capability':'knowledge score'} ${sourceScore}, rounded up. Cost $${cost}k.`,
    costTurnover:cost,
    investmentAttribution:{siteId:target.id,siteCost:cost,corporateCost:0},
    riverTransfer:{sourceSiteId:source.id,targetSiteId:target.id,domain,sourceScore,targetScore,before},
  };
}
