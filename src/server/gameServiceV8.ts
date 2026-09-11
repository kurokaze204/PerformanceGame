import type { KnowledgeDomain } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { executeRiskPhaseV4 } from '../engine/riskPhaseV4.ts';
import { isInvestmentActionV4 } from '../engine/investmentActionsV4.ts';
import { applyInterfaceSimplificationV1 } from '../engine/interfaceSimplificationV1.ts';
import { saveSessionV2 } from './dbV2.ts';
import { broadcastV2 } from './gameServiceV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  getSessionV2 as baseGetSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
} from './gameServiceV7.ts';

export * from './gameServiceV7.ts';

type CompanyRoundPhase = 'events' | 'investment' | 'risk' | 'waiting';

const REPLACEMENT_NAMES = [
  'Alex Morgan','Priya Shah','Daniel Chen','Mia Thompson','Jordan Lee','Samira Patel','Liam Brooks','Nina Alvarez',
  'Marcus Reed','Sophie Nguyen','Ethan Walsh','Grace Kim','Owen Clarke','Aisha Rahman','Noah Bennett','Chloe Martin',
  'Lucas Ferreira','Emily Zhao','Jack Wilson','Hannah Singh','Leo Martinez','Zoe Campbell','Arjun Mehta','Isla Roberts',
  'Ben Carter','Amelia Scott','Kai Johnson','Ruby Evans','Thomas Green','Layla Hassan','Max Turner','Ella Foster',
];

const roundPhase = (company:GameSessionV2['companies'][number], fallback:CompanyRoundPhase='events'):CompanyRoundPhase =>
  ((company as any).roundPhase as CompanyRoundPhase | undefined) || fallback;
const setRoundPhase = (company:GameSessionV2['companies'][number], phase:CompanyRoundPhase) => { (company as any).roundPhase = phase; };

function fallbackFromSession(session:GameSessionV2):CompanyRoundPhase {
  if(session.phase==='investment')return 'investment';
  if(session.phase==='risk')return 'risk';
  return 'events';
}

function ensureRoundPhases(session:GameSessionV2):boolean {
  let changed=false;
  const fallback=fallbackFromSession(session);
  for(const company of session.companies){
    if(!(company as any).roundPhase){setRoundPhase(company,fallback);changed=true;}
  }
  return changed;
}

function nextReplacementName(company:GameSessionV2['companies'][number]):string {
  company.retiredExpertNames??=[];
  const used=new Set<string>([
    ...company.retiredExpertNames,
    ...company.experts.map(expert=>expert.name),
    ...company.experts.map(expert=>expert.replacementName||'').filter(Boolean),
  ]);
  const available=REPLACEMENT_NAMES.find(name=>!used.has(name));
  if(available)return available;
  let n=1;while(used.has(`New Expert ${n}`))n+=1;return `New Expert ${n}`;
}

function nameRiskReplacements(session:GameSessionV2, company:GameSessionV2['companies'][number]){
  const summary=session.riskResults?.[company.id];
  if(!summary)return;
  company.retiredExpertNames??=[];
  for(const departure of summary.departedExperts||[]){
    const expert=company.experts.find(candidate=>candidate.id===departure.expertId);
    if(!expert)continue;
    if(!company.retiredExpertNames.includes(departure.expertName))company.retiredExpertNames.push(departure.expertName);
    if(!expert.replacementName)expert.replacementName=nextReplacementName(company);
    departure.replacementName=expert.replacementName||undefined;
  }
}

const phaseQueues=new Map<string,Promise<any>>();
function serialisePhaseChange<T>(sessionId:string, work:()=>Promise<T>):Promise<T>{
  const key=sessionId.toUpperCase();
  const prior=phaseQueues.get(key)||Promise.resolve();
  const run=prior.then(work,work);
  phaseQueues.set(key,run.finally(()=>{if(phaseQueues.get(key)===run)phaseQueues.delete(key);}));
  return run;
}

export async function getSessionV2(sessionId:string):Promise<GameSessionV2|null>{
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(session&&ensureRoundPhases(session))await saveSessionV2(session);
  return session;
}

export async function advancePhaseV2(sessionId:string,requested?:any){
  const result:any=await baseAdvancePhaseV2(sessionId,requested);
  if(!result?.success||!result.session)return result;
  if(result.session.phase==='investment'){
    for(const company of result.session.companies)setRoundPhase(company,'investment');
    await saveSessionV2(result.session);
    broadcastV2(result.session,'COMPANIES_ENTERED_INVESTMENT',{round:result.session.round});
  }else if(result.session.phase==='respond'&&!result.session.isFinalDisruptionActive){
    for(const company of result.session.companies)setRoundPhase(company,'events');
    await saveSessionV2(result.session);
  }
  return result;
}

async function finishInvesting(sessionId:string,companyId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureRoundPhases(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(roundPhase(company,fallbackFromSession(session))!=='investment')return{success:false,message:'This company has already finished investing.',session};

    session.riskResults??={};
    session.riskResults[company.id]=executeRiskPhaseV4(session,company);
    nameRiskReplacements(session,company);
    setRoundPhase(company,'risk');
    applyInterfaceSimplificationV1(session);
    await saveSessionV2(session);
    broadcastV2(session,'COMPANY_ENTERED_KNOWLEDGE_RISK',{companyId:company.id,round:session.round});
    return{success:true,message:'Investment complete. Continue to your Knowledge Risk checks.',session};
  });
}

async function finishRisk(sessionId:string,companyId:string){
  return serialisePhaseChange(sessionId,async()=>{
    const session=await baseGetSessionV2(sessionId.toUpperCase());
    if(!session)return{success:false,message:'Session not found.'};
    ensureRoundPhases(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    if(!company)return{success:false,message:'Company not found.',session};
    if(roundPhase(company,fallbackFromSession(session))==='waiting')return{success:true,message:'Waiting for the other companies to finish Knowledge Risk.',session};
    if(roundPhase(company,fallbackFromSession(session))!=='risk')return{success:false,message:'Finish investing before completing Knowledge Risk.',session};

    setRoundPhase(company,'waiting');
    const allWaiting=session.companies.every(candidate=>roundPhase(candidate,fallbackFromSession(session))==='waiting');
    if(!allWaiting){
      await saveSessionV2(session);
      broadcastV2(session,'COMPANY_WAITING_FOR_NEXT_ROUND',{companyId:company.id,round:session.round});
      const waiting=session.companies.filter(candidate=>roundPhase(candidate,fallbackFromSession(session))==='waiting').length;
      return{success:true,message:`Knowledge Risk complete. Waiting for the other companies (${waiting}/${session.companies.length} finished).`,session};
    }

    // The legacy round transition is still authoritative for replacements,
    // delayed Events, timer/final-challenge checks and round reset. Risk has
    // already been resolved per company, so put the shared phase at the barrier
    // only when everyone is ready, then run that transition once.
    session.phase='risk';
    await saveSessionV2(session);
    const advanced:any=await baseAdvancePhaseV2(session.id,'respond');
    if(!advanced?.success||!advanced.session)return advanced;
    if(!advanced.session.isFinalDisruptionActive){
      for(const nextCompany of advanced.session.companies)setRoundPhase(nextCompany,'events');
      await saveSessionV2(advanced.session);
      broadcastV2(advanced.session,'ALL_COMPANIES_STARTED_NEXT_ROUND',{round:advanced.session.round});
    }
    return{...advanced,message:advanced.session.isFinalDisruptionActive?'All companies finished Knowledge Risk. Final disruption begins.':'All companies finished Knowledge Risk. The next Event round has begun.'};
  });
}

async function setReplacementLocation(sessionId:string,companyId:string,payload:any){
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session)return{success:false,message:'Session not found.'};
  ensureRoundPhases(session);
  const company=session.companies.find(candidate=>candidate.id===companyId);
  if(!company)return{success:false,message:'Company not found.',session};
  if(roundPhase(company,fallbackFromSession(session))!=='risk')return{success:false,message:'Replacement location is chosen during Knowledge Risk.',session};
  const expert=company.experts.find(candidate=>candidate.id===payload?.expertId);
  if(!expert||!expert.isVacant||expert.replacementDueRound==null)return{success:false,message:'No replacement is due for that expert.',session};
  const site=company.sites.find(candidate=>candidate.id===payload?.siteId&&!candidate.isClosed);
  if(!site)return{success:false,message:'Choose an active city office.',session};
  expert.location=site.id;expert.homeLocation=site.id;
  await saveSessionV2(session);
  broadcastV2(session,'REPLACEMENT_LOCATION_UPDATED',{companyId,expertId:expert.id,siteId:site.id});
  return{success:true,message:'Replacement base updated.',session,expertId:expert.id,siteId:site.id};
}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  if(payload?.type==='FINISH_INVESTING')return finishInvesting(sessionId,companyId);
  if(payload?.type==='FINISH_RISK')return finishRisk(sessionId,companyId);
  if(payload?.type==='SET_REPLACEMENT_LOCATION')return setReplacementLocation(sessionId,companyId,payload);

  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(session){
    ensureRoundPhases(session);
    const company=session.companies.find(candidate=>candidate.id===companyId);
    const investmentAction=isInvestmentActionV4(String(payload?.type||''))||payload?.type==='SITE_KNOWLEDGE_SHARING';
    if(company&&investmentAction&&roundPhase(company,fallbackFromSession(session))!=='investment'){
      return{success:false,message:'This company has already finished its Invest phase.',session};
    }
  }
  return baseKnowledgeActionV2(sessionId,companyId,payload);
}
