import type { KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, ExperienceMode, GameSessionV2 } from '../types/gameV2.ts';
import { INVESTMENT_COSTS_V4 } from './investmentActionsV4.ts';
import { recalculateCompanySPOFV2 } from './coreV2.ts';

export function riverSiteKnowledgeScore(site:CompanyV2['sites'][number],domain:KnowledgeDomain,mode:ExperienceMode='expert'):number{
  // Newbie deliberately collapses local knowledge into Team Capability so players
  // do not have to reason about a second hidden local codification metric.
  return mode==='newbie'
    ? (site.teamCapability[domain]||0)
    : Math.max(site.teamCapability[domain]||0,site.codifiedKnowledge[domain]||0);
}

export function riverTransferTarget(sourceScore:number):number{
  return Math.max(0,Math.min(6,Math.round(sourceScore*0.8)));
}

export function executeRiverKnowledgeSharing(session:GameSessionV2,company:CompanyV2,payload:any){
  if(session.phase!=='investment')return{success:false,message:'Knowledge Sharing can only be used during the Invest phase.',session};
  if(company.actionsRemaining<=0)return{success:false,message:'No knowledge actions remaining this round.',session};
  const sourceSiteId=String(payload?.sourceSiteId||'');
  const siteId=String(payload?.siteId||'');
  const domain=payload?.domain as KnowledgeDomain|undefined;
  if(!sourceSiteId||!siteId||!domain)return{success:false,message:'Choose a teaching site, receiving site and domain.',session};
  if(sourceSiteId===siteId)return{success:false,message:'Choose two different sites for Knowledge Sharing.',session};
  const source=company.sites.find(s=>s.id===sourceSiteId&&!s.isClosed);
  const target=company.sites.find(s=>s.id===siteId&&!s.isClosed);
  if(!source||!target)return{success:false,message:'Both sites must be active.',session};
  const sourceScore=riverSiteKnowledgeScore(source,domain,session.experienceMode);
  const targetScore=riverTransferTarget(sourceScore);
  const before=target.teamCapability[domain]||0;
  if(targetScore<=before)return{success:false,message:`${target.name} already has Team Capability ${before}; ${source.name} cannot lift it further through this sharing action.`,session};
  target.teamCapability[domain]=targetScore;
  const cost=INVESTMENT_COSTS_V4.KNOWLEDGE_TRANSFER;
  target.turnover=Math.max(0,target.turnover-cost);
  company.turnover=Math.round(company.sites.reduce((sum,s)=>sum+(s.isClosed?0:s.turnover),0));
  company.actionsRemaining-=1;
  recalculateCompanySPOFV2(company,session.config);
  return{
    success:true,
    session,
    message:`${source.name} shared ${domain} practice with ${target.name}. ${target.name} Team Capability increased ${before} → ${targetScore}, approximately 80% of ${source.name}'s locally available ${session.experienceMode==='newbie'?'Team Capability':'knowledge score'} ${sourceScore}. Cost $${cost}k.`,
    costTurnover:cost,
    investmentAttribution:{siteId:target.id,siteCost:cost,corporateCost:0},
    riverTransfer:{sourceSiteId:source.id,targetSiteId:target.id,domain,sourceScore,targetScore,before},
  };
}
