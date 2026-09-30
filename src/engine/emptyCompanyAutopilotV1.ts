import type { KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { resolveSingleEventExplicitV2 } from './challengeResponseV2.ts';
import { executeInvestmentActionV4, copMembershipActiveV4 } from './investmentActionsV4.ts';
import { COP_JOIN_COST_V5 } from './copNetworkV5.ts';
import { interventionUnlocked } from './experienceModeV3.ts';
import { executeRiskPhaseV4 } from './riskPhaseV4.ts';

type CompanyRoundPhase='events'|'investment'|'risk'|'waiting';
const DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];

const roundPhase=(company:CompanyV2,fallback:CompanyRoundPhase='events'):CompanyRoundPhase =>
  ((company as any).roundPhase as CompanyRoundPhase|undefined)||fallback;
const setRoundPhase=(company:CompanyV2,phase:CompanyRoundPhase)=>{(company as any).roundPhase=phase;};

export function companyPlayerCountV1(session:GameSessionV2,companyId:string):number{
  return (session.participants||[]).filter(participant=>participant.role==='participant'&&participant.companyId===companyId).length;
}

export function companyAutopilotActiveV1(session:GameSessionV2,companyId:string):boolean{
  if(session.isFinalDisruptionActive||companyPlayerCountV1(session,companyId)>0)return false;
  if(session.round>1)return true;
  return session.companies.some(company=>company.id!==companyId&&companyPlayerCountV1(session,company.id)>0&&roundPhase(company)==='waiting');
}

function unansweredIncomingCopRequests(session:GameSessionV2,companyId:string){
  return (session.copMessages||[]).filter(message=>
    message.kind==='request'&&
    message.toCompanyId===companyId&&
    !(session.copMessages||[]).some(reply=>reply.kind==='response'&&reply.replyToId===message.id)
  );
}

export function acceptPendingCopRequestsForAutopilotV1(session:GameSessionV2,company:CompanyV2):number{
  if(!companyAutopilotActiveV1(session,company.id))return 0;
  const requests=unansweredIncomingCopRequests(session,company.id);
  for(const request of requests){
    const from=session.companies.find(candidate=>candidate.id===request.fromCompanyId);
    const label=request.domain?request.domain:'general business';
    session.copMessages.push({
      id:`cop-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}-auto-response`,
      fromCompanyId:company.id,
      toCompanyId:request.fromCompanyId,
      domain:request.domain,
      message:`Yes — we are willing to join the ${label} Community of Practice and share what we know. We will register our membership at our next Invest opportunity.`,
      round:session.round,
      createdAt:new Date().toISOString(),
      kind:'response',
      response:'accepted',
      replyToId:request.id,
    });
    void from;
  }
  return requests.length;
}

function acceptedCopRequestsForCompany(session:GameSessionV2,companyId:string){
  return (session.copMessages||[])
    .filter(request=>request.kind==='request'&&request.toCompanyId===companyId)
    .filter(request=>(session.copMessages||[]).some(reply=>
      reply.kind==='response'&&reply.replyToId===request.id&&reply.fromCompanyId===companyId&&reply.response==='accepted'
    ));
}

function strongestExpert(company:CompanyV2,domain:KnowledgeDomain){
  return company.experts
    .filter(expert=>!expert.isVacant&&expert.domains.some(skill=>skill.domain===domain))
    .sort((a,b)=>(b.domains.find(skill=>skill.domain===domain)?.score||0)-(a.domains.find(skill=>skill.domain===domain)?.score||0))[0];
}

function resolveRemainingEvents(session:GameSessionV2,company:CompanyV2){
  const priorPhase=session.phase;
  session.phase='respond';
  try{
    for(const event of session.activeEvents[company.id]||[]){
      if(event.isResolved)continue;
      if((event as any).uiResolutionData){
        event.isResolved=true;
        delete (event as any).uiResolutionData;
        continue;
      }
      for(const requirement of event.card.domains){
        const domain=requirement.domain;
        const expert=strongestExpert(company,domain);
        event.allocations[domain]={
          ...(event.allocations[domain]||{}),
          useTeamCapability:true,
          useLocalCodified:session.experienceMode==='expert',
          useCorporateIntranet:true,
          expertId:expert?.id,
          useCoPSupport:copMembershipActiveV4(session,company.id,domain),
          consultantPoints:0,
        };
      }
      try{resolveSingleEventExplicitV2(session,company,event);}
      catch{
        // A facilitator/autopilot recovery path must never leave an empty company
        // blocking the room. If a legacy Event cannot be scored, retire it.
        event.isResolved=true;
        event.resolvedAt=new Date().toISOString();
      }
    }
    delete (company as any).uiOpenEventInstanceId;
  }finally{session.phase=priorPhase;}
}

function targetSite(company:CompanyV2){
  const disruptionSite=company.disruptionCard&&company.sites.find(site=>site.id===company.disruptionCard!.siteId&&!site.isClosed);
  return disruptionSite||company.sites.filter(site=>!site.isClosed).sort((a,b)=>a.turnover-b.turnover)[0];
}

function orderedDomains(company:CompanyV2,site:NonNullable<ReturnType<typeof targetSite>>):KnowledgeDomain[]{
  const disruption=company.disruptionCard?.domains.map(item=>item.domain)||[];
  const ordered=[...disruption,...DOMAINS.filter(domain=>!disruption.includes(domain))];
  return ordered.sort((a,b)=>{
    const aGap=(company.disruptionCard?.domains.find(item=>item.domain===a)?.difficulty||0)-(site.teamCapability[a]||0);
    const bGap=(company.disruptionCard?.domains.find(item=>item.domain===b)?.difficulty||0)-(site.teamCapability[b]||0);
    return bGap-aGap;
  });
}

function makeSimpleInvestments(session:GameSessionV2,company:CompanyV2){
  const site=targetSite(company);
  if(!site)return;
  const priorPhase=session.phase;
  session.phase='investment';
  try{
    // A CoP invitation is a social commitment. Honour accepted invitations before
    // spending Actions on routine KM work so an empty company becomes a useful
    // reciprocal member at the first legal Invest opportunity.
    if(interventionUnlocked(session.experienceMode,session.round,'JOIN_COP')){
      for(const request of acceptedCopRequestsForCompany(session,company.id)){
        if(company.actionsRemaining<=0)break;
        const requestDomain=request.domain;
        const alreadyJoined=session.experienceMode==='newbie'
          ? session.copMemberships.some(membership=>membership.companyId===company.id&&membership.activeRound>=session.round&&(membership.scope==='general'||membership.domain==='general'))
          : requestDomain
            ? session.copMemberships.some(membership=>membership.companyId===company.id&&membership.activeRound>=session.round&&membership.domain===requestDomain)
            : false;
        if(alreadyJoined)continue;
        const representative=session.experienceMode==='expert'&&requestDomain
          ? strongestExpert(company,requestDomain)
          : company.experts.find(expert=>!expert.isVacant);
        if(!representative)continue;
        const result=executeInvestmentActionV4(session,company,{
          type:'JOIN_COP',
          companyId:company.id,
          expertId:representative.id,
          domain:requestDomain,
          useSIF:company.strategicInvestmentFund>=COP_JOIN_COST_V5,
        } as any);
        if(session.experienceMode==='newbie'&&result.success)break;
      }
    }

    let safety=0;
    while(company.actionsRemaining>0&&safety++<12){
      let acted=false;
      for(const domain of orderedDomains(company,site)){
        const expert=strongestExpert(company,domain);
        const expertScore=expert?.domains.find(skill=>skill.domain===domain)?.score||0;
        if(expert&&site.teamCapability[domain]<expertScore&&interventionUnlocked(session.experienceMode,session.round,'KNOWLEDGE_TRANSFER')){
          const useSIF=company.strategicInvestmentFund>=20;
          const result=executeInvestmentActionV4(session,company,{type:'KNOWLEDGE_TRANSFER',companyId:company.id,siteId:site.id,expertId:expert.id,domain,useSIF} as any);
          if(result.success){acted=true;break;}
        }
        if(site.codifiedKnowledge[domain]<site.teamCapability[domain]&&interventionUnlocked(session.experienceMode,session.round,'CODIFY_SITE')){
          const result=executeInvestmentActionV4(session,company,{type:'CODIFY_SITE',companyId:company.id,siteId:site.id,domain,useSIF:company.strategicInvestmentFund>=2.5} as any);
          if(result.success){acted=true;break;}
        }
      }
      if(!acted)break;
    }
  }finally{session.phase=priorPhase;}
}

export interface AutopilotRoundResultV1{
  companyId:string;
  companyName:string;
  eventsResolved:number;
  actionsUsed:number;
  riskApplied:boolean;
  copRequestsAccepted?:number;
}

export function autoplayCompanyToWaitingV1(session:GameSessionV2,company:CompanyV2):AutopilotRoundResultV1{
  const beforeEvents=(session.activeEvents[company.id]||[]).filter(event=>event.isResolved).length;
  const beforeActions=company.actionsRemaining;
  const phase=roundPhase(company);
  const copRequestsAccepted=acceptPendingCopRequestsForAutopilotV1(session,company);

  if(phase==='waiting')return{companyId:company.id,companyName:company.name,eventsResolved:0,actionsUsed:0,riskApplied:false,copRequestsAccepted};

  if(phase==='events')resolveRemainingEvents(session,company);
  if(phase==='events'||phase==='investment')makeSimpleInvestments(session,company);

  let riskApplied=false;
  if(phase!=='risk'){
    session.riskResults??={};
    session.riskResults[company.id]=executeRiskPhaseV4(session,company);
    riskApplied=true;
  }
  setRoundPhase(company,'waiting');

  const afterEvents=(session.activeEvents[company.id]||[]).filter(event=>event.isResolved).length;
  return{
    companyId:company.id,
    companyName:company.name,
    eventsResolved:Math.max(0,afterEvents-beforeEvents),
    actionsUsed:Math.max(0,beforeActions-company.actionsRemaining),
    riskApplied,
    copRequestsAccepted,
  };
}

export function autoplayEligibleEmptyCompaniesV1(session:GameSessionV2):AutopilotRoundResultV1[]{
  const results:AutopilotRoundResultV1[]=[];
  for(const company of session.companies){
    if(!companyAutopilotActiveV1(session,company.id))continue;
    const result=autoplayCompanyToWaitingV1(session,company);
    if(roundPhase(company)!=='waiting'||result.copRequestsAccepted||result.eventsResolved||result.actionsUsed||result.riskApplied)results.push(result);
  }
  return results;
}
