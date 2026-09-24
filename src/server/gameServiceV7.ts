import type { KnowledgeDomain, Participant } from '../types/game.ts';
import type { GameSessionV2, PopulationMode } from '../types/gameV2.ts';
import { createInitialCompanyV2, drawRoundEventsV2, recalculateCompanySPOFV2 } from '../engine/coreV2.ts';
import { diversifyInitialKnowledge } from '../engine/eventProgressionV5.ts';
import { applyInterfaceSimplificationV1 } from '../engine/interfaceSimplificationV1.ts';
import { dealCompanyDisruptionsV1, evaluateFinalDisruptionV1, type FinalDisruptionSelectionsV1 } from '../engine/disruptionPlusV1.ts';
import { recordCompanyMetric, saveSessionV2 } from './dbV2.ts';
import { broadcastV2 } from './gameServiceV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  createNewSessionV2 as baseCreateNewSessionV2,
  getSessionV2 as baseGetSessionV2,
  joinSessionV2 as baseJoinSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
} from './gameServiceV6.ts';
import type { CreateGameOptions as BaseCreateGameOptions } from './gameServiceV4.ts';

export * from './gameServiceV6.ts';

export interface CreateGameOptions extends BaseCreateGameOptions {
  populationMode?: PopulationMode;
}

const COMPANY_NAMES = [
  'Apex Technologies','Vanguard Systems','Horizon BioTech','Stratos Engineering',
  'Northstar Manufacturing','Southern Cross Industries','Meridian Group','Summit Systems',
];
const REPLACEMENT_NAMES = [
  'Alex Morgan','Priya Shah','Daniel Chen','Mia Thompson','Jordan Lee','Samira Patel','Liam Brooks','Nina Alvarez',
  'Marcus Reed','Sophie Nguyen','Ethan Walsh','Grace Kim','Owen Clarke','Aisha Rahman','Noah Bennett','Chloe Martin',
  'Lucas Ferreira','Emily Zhao','Jack Wilson','Hannah Singh','Leo Martinez','Zoe Campbell','Arjun Mehta','Isla Roberts',
  'Ben Carter','Amelia Scott','Kai Johnson','Ruby Evans','Thomas Green','Layla Hassan','Max Turner','Ella Foster',
];

function nextReplacementName(session:GameSessionV2,company:GameSessionV2['companies'][number]):string{
  const used=new Set<string>([...company.retiredExpertNames,...company.experts.map(e=>e.name),...company.experts.map(e=>e.replacementName||'').filter(Boolean)]);
  const available=REPLACEMENT_NAMES.find(name=>!used.has(name));
  if(available)return available;
  let n=1;while(used.has(`New Expert ${n}`))n+=1;return `New Expert ${n}`;
}

function assignReplacementNames(session:GameSessionV2):boolean{
  let changed=false;
  const risk=session.riskResults||{};
  for(const company of session.companies){
    company.retiredExpertNames??=[];
    const summary=risk[company.id];
    for(const departure of summary?.departedExperts||[]){
      const expert=company.experts.find(e=>e.id===departure.expertId);
      if(!expert)continue;
      if(!company.retiredExpertNames.includes(departure.expertName))company.retiredExpertNames.push(departure.expertName);
      if(!expert.replacementName)expert.replacementName=nextReplacementName(session,company);
      departure.replacementName=expert.replacementName||undefined;
      changed=true;
    }
  }
  return changed;
}

export async function createNewSessionV2(sessionId:string,title:string,companyNames:string[]=['Apex Technologies'],options:CreateGameOptions={}):Promise<GameSessionV2>{
  const populationMode:PopulationMode=options.populationMode==='expand'?'expand':'balanced';
  const initialNames=populationMode==='expand'?[companyNames[0]||COMPANY_NAMES[0]]:companyNames;
  const session=await baseCreateNewSessionV2(sessionId,title,initialNames,options);
  session.populationMode=populationMode;
  await saveSessionV2(session);
  return session;
}

async function addExpansionCompany(session:GameSessionV2){
  const index=session.companies.length;
  const name=COMPANY_NAMES[index]||`Company ${index+1}`;
  const company=createInitialCompanyV2(name,`comp-${index+1}-${session.id.toLowerCase()}`,session.config);
  diversifyInitialKnowledge(company);
  recalculateCompanySPOFV2(company,session.config);
  session.companies.push(company);
  dealCompanyDisruptionsV1(session);
  session.activeEvents[company.id]=drawRoundEventsV2(session,company);
  applyInterfaceSimplificationV1(session);
  await saveSessionV2(session);
  broadcastV2(session,'COMPANY_ADDED_FOR_PLAYERS',{companyId:company.id,companyName:company.name});
  return company;
}

export async function joinSessionV2(sessionId:string,name:string,companyId?:string,role:Participant['role']='participant'){
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session)throw new Error('Session not found.');
  if(role!=='participant'||companyId||session.populationMode!=='expand')return baseJoinSessionV2(sessionId,name,companyId,role);
  const counts=new Map(session.companies.map(c=>[c.id,0]));
  for(const p of session.participants.filter(p=>p.role==='participant'))counts.set(p.companyId,(counts.get(p.companyId)||0)+1);
  let target=session.companies.find(c=>(counts.get(c.id)||0)<session.maxPlayersPerCompany);
  if(!target)target=await addExpansionCompany(session);
  return baseJoinSessionV2(sessionId,name,target.id,role);
}

export async function advancePhaseV2(sessionId:string,requested?:any){
  const before=await baseGetSessionV2(sessionId.toUpperCase());
  const pendingNames=new Map<string,string>();
  if(before?.phase==='risk')for(const company of before.companies)for(const expert of company.experts)if(expert.replacementName)pendingNames.set(expert.id,expert.replacementName);
  const result=await baseAdvancePhaseV2(sessionId,requested);
  if(!result?.success||!result.session)return result;
  let changed=false;
  if(result.session.phase==='risk')changed=assignReplacementNames(result.session)||changed;
  if(pendingNames.size){
    for(const company of result.session.companies){
      for(const expert of company.experts){
        const replacement=pendingNames.get(expert.id);
        if(replacement&&!expert.isVacant){expert.name=replacement;expert.replacementName=null;changed=true;}
      }
    }
  }
  if(changed){applyInterfaceSimplificationV1(result.session);await saveSessionV2(result.session);broadcastV2(result.session,'REPLACEMENT_EXPERT_NAMES_UPDATED');}
  return result;
}

function applyFinalCompanyLoss(company:GameSessionV2['companies'][number],amount:number,round:number){
  const active=company.sites.filter(site=>!site.isClosed);
  const total=active.reduce((sum,site)=>sum+site.turnover,0);
  let remaining=Math.max(0,Math.round(amount));
  active.forEach((site,index)=>{
    const share=index===active.length-1?remaining:Math.round(amount*(total>0?site.turnover/total:1/Math.max(1,active.length)));
    site.turnover=Math.max(0,site.turnover-share);
    remaining-=share;
    if(site.turnover<=0){
      site.isClosed=true;
      company.experts.filter(expert=>expert.location===site.id&&!expert.isVacant).forEach(expert=>{expert.isVacant=true;expert.replacementDueRound=round+1;});
    }
  });
  company.turnover=Math.round(company.sites.reduce((sum,site)=>sum+(site.isClosed?0:site.turnover),0));
}

async function resolveManualFinalDisruption(sessionId:string,companyId:string,selections:FinalDisruptionSelectionsV1,useConsultant=false){
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session||!session.isFinalDisruptionActive)return{success:false,message:'The final disruption is not active.',session};
  const company=session.companies.find(item=>item.id===companyId);
  if(!company?.disruptionCard)return{success:false,message:'Company disruption card not found.',session};
  const existing=((session as any).finalDisruptionResults||[]) as any[];
  if(existing.some(result=>result.companyId===company.id))return{success:false,message:'This company has already resolved the final disruption.',session};

  const evaluation=evaluateFinalDisruptionV1(session,company,selections);
  if(!evaluation)return{success:false,message:'Could not score the disruption.',session};
  const turnoverBefore=company.turnover;
  const consultantCost=useConsultant&&evaluation.gap>0?evaluation.consultantCost:0;
  const consultantPercent=useConsultant&&evaluation.gap>0?evaluation.consultantPercent:0;

  if(consultantCost>0){
    applyFinalCompanyLoss(company,consultantCost,session.round);
    company.cumulativeConsultantSpend=(company.cumulativeConsultantSpend||0)+consultantCost;
    await saveSessionV2(session);
    await recordCompanyMetric(session,company,'FINAL_CONSULTANT');
  }
  const turnoverAfterConsultant=company.turnover;

  const domainResults=evaluation.domainResults.map(domainResult=>{
    const consultantPoints=useConsultant?domainResult.gap:0;
    const totalKnowledge=domainResult.totalKnowledge+consultantPoints;
    const domainSuccess=totalKnowledge>=domainResult.difficulty;
    return{
      ...domainResult,
      consultantPoints,
      totalKnowledge,
      requiredTotal:domainResult.difficulty,
      achievedTotal:totalKnowledge,
      domainSuccess,
      explanation:`Knowledge ${domainResult.totalKnowledge}${consultantPoints?` + consultant ${consultantPoints}`:''}; needed ${domainResult.difficulty}.`,
    };
  });
  const allSucceeded=domainResults.every(result=>result.domainSuccess);
  const disruptionLoss=allSucceeded?0:company.disruptionCard.impact;
  if(disruptionLoss>0)applyFinalCompanyLoss(company,disruptionLoss,session.round);
  recalculateCompanySPOFV2(company,session.config);

  const result={
    companyId:company.id,
    companyName:company.name,
    disruptionCardId:company.disruptionCard.id,
    disruptionTitle:company.disruptionCard.title,
    siteId:company.disruptionCard.siteId,
    siteName:company.disruptionCard.siteName,
    turnoverBefore,
    turnoverAfterConsultant,
    finalTurnover:company.turnover,
    success:allSucceeded,
    turnoverChange:-disruptionLoss,
    interventionCost:consultantCost,
    consultantCost,
    consultantPercent,
    consultantDetails:consultantCost?[{cost:consultantCost,percent:consultantPercent,gap:evaluation.gap,required:evaluation.required}]:[],
    domainResults,
  };
  const next=[...existing.filter(item=>item.companyId!==company.id),result];
  (session as any).finalDisruptionResults=next;
  session.finalDisruptionResolved=session.companies.every(item=>next.some(resultItem=>resultItem.companyId===item.id));
  applyInterfaceSimplificationV1(session);
  await saveSessionV2(session);
  await recordCompanyMetric(session,company,'FINAL_DISRUPTION');
  broadcastV2(session,'FINAL_DISRUPTION_COMPANY_RESOLVED',{companyId:company.id,result,allCompaniesResolved:session.finalDisruptionResolved});
  return{success:true,message:allSucceeded?'Disruption survived.':'Disruption resolved.',session,results:next,result};
}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  if(payload?.type==='FINAL_DISRUPTION_RESOLVE')return resolveManualFinalDisruption(sessionId,companyId,payload?.selections||{},Boolean(payload?.useConsultant));
  return baseKnowledgeActionV2(sessionId,companyId,payload);
}
