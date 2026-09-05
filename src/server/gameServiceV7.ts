import type { Participant } from '../types/game.ts';
import type { GameSessionV2, PopulationMode } from '../types/gameV2.ts';
import { createInitialCompanyV2, drawRoundEventsV2, recalculateCompanySPOFV2 } from '../engine/coreV2.ts';
import { diversifyInitialKnowledge } from '../engine/eventProgressionV5.ts';
import { applyInterfaceSimplificationV1 } from '../engine/interfaceSimplificationV1.ts';
import { saveSessionV2 } from './dbV2.ts';
import { broadcastV2 } from './gameServiceV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  createNewSessionV2 as baseCreateNewSessionV2,
  getSessionV2 as baseGetSessionV2,
  joinSessionV2 as baseJoinSessionV2,
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
