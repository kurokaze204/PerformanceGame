import type { GameSessionV2 } from '../types/gameV2.ts';
import { executeInvestmentActionV4 } from './investmentActionsV4.ts';
import { executeRiverKnowledgeSharing } from './riverKnowledgeV1.ts';

const cloneSession=(session:GameSessionV2):GameSessionV2=>{
  if(typeof structuredClone==='function')return structuredClone(session);
  return JSON.parse(JSON.stringify(session)) as GameSessionV2;
};

export function previewInvestmentActionV1(session:GameSessionV2,companyId:string,actionType:string,params:any={}){
  const next=cloneSession(session);
  const company=next.companies.find(candidate=>candidate.id===companyId);
  if(!company)return{success:false,session:next,message:'Company not found.'};
  const result=actionType==='SITE_KNOWLEDGE_SHARING'
    ? executeRiverKnowledgeSharing(next,company,{...params,type:actionType})
    : executeInvestmentActionV4(next,company,{...params,type:actionType} as any);
  return{success:result?.success===true,session:next,message:result?.message};
}
