import type { GamePhase, KnowledgeDomain } from '../types/game.ts';
import type { ActiveEventAllocationV2, GameSessionV2 } from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import { PROGRAMMED_FAILURE_TAG, applyProgressionToCurrentEvents, capProgressedEventImpact, diversifyInitialKnowledge, progressEventCard } from '../engine/eventProgressionV5.ts';
import { recalculateCompanySPOFV2 } from '../engine/coreV2.ts';
import { executeRiverKnowledgeSharing } from '../engine/riverKnowledgeV1.ts';
import { saveSessionV2 } from './dbV2.ts';
import type { CreateGameOptions } from './gameServiceV4.ts';
import { broadcastV2 } from './gameServiceV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  createNewSessionV2 as baseCreateNewSessionV2,
  getSessionV2 as baseGetSessionV2,
  initializeDefaultSessionV2 as baseInitializeDefaultSessionV2,
  knowledgeActionV2 as baseKnowledgeActionV2,
  redrawEventV2 as baseRedrawEventV2,
  setEventAllocationV2 as baseSetEventAllocationV2,
} from './gameServiceV4.ts';

export * from './gameServiceV4.ts';

function ensureProgressionConfig(session:GameSessionV2):void {
  session.config.event_value_growth_factor ??= DEFAULT_CONFIG.event_value_growth_factor;
  session.config.event_difficulty_growth_per_move ??= DEFAULT_CONFIG.event_difficulty_growth_per_move;
  session.config.event_initial_impact_multiplier ??= DEFAULT_CONFIG.event_initial_impact_multiplier;
  session.config.event_impact_cap_ratio ??= DEFAULT_CONFIG.event_impact_cap_ratio;
  session.config.event_difficulty_cap ??= DEFAULT_CONFIG.event_difficulty_cap;
  session.config.event_expert_moves_per_pressure_step ??= DEFAULT_CONFIG.event_expert_moves_per_pressure_step;
}

function applyFreshGameModel(session:GameSessionV2):void {
  ensureProgressionConfig(session);
  for(const company of session.companies){
    diversifyInitialKnowledge(company);
    recalculateCompanySPOFV2(company,session.config);
    applyProgressionToCurrentEvents(session,company);
  }
}

function looksLikeUnstartedGame(session:GameSessionV2):boolean {
  return session.round===1 && session.companies.every(company=>{
    const events=session.activeEvents[company.id]||[];
    return events.length>0&&events.every(event=>!event.isResolved&&!/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):/.test(event.card.title));
  });
}

function isProgrammedFailure(event:any):boolean {
  return Boolean(event?.card?.tags?.includes(PROGRAMMED_FAILURE_TAG));
}

function tutorialAllocationAllowed(allocation:ActiveEventAllocationV2):boolean {
  return !allocation.expertId
    && !allocation.useCoPSupport
    && !allocation.useCorporateIntranet
    && Math.max(0,allocation.consultantPoints||0)===0;
}

export async function createNewSessionV2(sessionId:string,title:string,companyNames:string[]=['Apex Technologies'],options:CreateGameOptions={}):Promise<GameSessionV2>{
  const session=await baseCreateNewSessionV2(sessionId,title,companyNames,options);
  applyFreshGameModel(session);
  await saveSessionV2(session);
  broadcastV2(session,'SESSION_PROGRESSIVE_BALANCE_APPLIED',{valueGrowthFactor:session.config.event_value_growth_factor,difficultyGrowthPerMove:session.config.event_difficulty_growth_per_move,impactCapRatio:session.config.event_impact_cap_ratio,expertMovesPerPressureStep:session.config.event_expert_moves_per_pressure_step});
  return session;
}

export async function initializeDefaultSessionV2():Promise<GameSessionV2>{
  const session=await baseInitializeDefaultSessionV2();
  ensureProgressionConfig(session);
  if(looksLikeUnstartedGame(session)){
    applyFreshGameModel(session);
    await saveSessionV2(session);
  }
  return session;
}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
  if(payload?.type!=='SITE_KNOWLEDGE_SHARING')return baseKnowledgeActionV2(sessionId,companyId,payload);
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  if(!session)return{success:false,message:'Session not found.'};
  const company=session.companies.find(c=>c.id===companyId);
  if(!company)return{success:false,message:'Company not found.',session};
  const result=executeRiverKnowledgeSharing(session,company,payload);
  if(!result.success)return result;
  await saveSessionV2(session);
  broadcastV2(session,'RIVER_KNOWLEDGE_SHARED',{companyId,sourceSiteId:payload.sourceSiteId,targetSiteId:payload.siteId,domain:payload.domain});
  return result;
}

export async function setEventAllocationV2(sessionId:string,companyId:string,eventInstanceId:string,domain:KnowledgeDomain,allocation:ActiveEventAllocationV2){
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  const company=session?.companies.find(c=>c.id===companyId);
  const event=company?(session?.activeEvents[company.id]||[]).find(item=>item.instanceId===eventInstanceId):undefined;
  if(event&&isProgrammedFailure(event)&&!tutorialAllocationAllowed(allocation)){
    return {
      success:false,
      message:'Opening learning challenge: only knowledge already held at this site can be used. Experts, the Corporate Intranet, networks, favours and consultants are deliberately unavailable so you can see the cost of knowledge being trapped elsewhere.',
      session,
    };
  }
  return baseSetEventAllocationV2(sessionId,companyId,eventInstanceId,domain,allocation);
}

export async function redrawEventV2(sessionId:string,companyId:string,eventInstanceId:string){
  const session=await baseGetSessionV2(sessionId.toUpperCase());
  const companyBefore=session?.companies.find(c=>c.id===companyId);
  const eventBefore=companyBefore?(session?.activeEvents[companyBefore.id]||[]).find(event=>event.instanceId===eventInstanceId):undefined;
  if(eventBefore&&isProgrammedFailure(eventBefore)){
    return {success:false,message:'The opening learning challenge cannot be redrawn.',session};
  }

  const result=await baseRedrawEventV2(sessionId,companyId,eventInstanceId);
  if(!result.success)return result;
  ensureProgressionConfig(result.session);
  const company=result.session.companies.find(c=>c.id===companyId);
  const events=company?(result.session.activeEvents[company.id]||[]):[];
  const eventIndex=events.findIndex(event=>event.instanceId===eventInstanceId);
  if(company&&eventIndex>=0){
    const firstMove=Math.max(1,company.eventsDrawnCount-events.length+1);
    const event=events[eventIndex];
    event.card=progressEventCard(event.card,firstMove+eventIndex,result.session.config,result.session.experienceMode);
    event.card=capProgressedEventImpact(event.card,company,event.targetSiteId,result.session.config);
    const allocations:Partial<Record<KnowledgeDomain,any>>={};
    event.card.domains.forEach(req=>{allocations[req.domain]=event.allocations?.[req.domain]||{}});
    event.allocations=allocations as any;
    await saveSessionV2(result.session);
    broadcastV2(result.session,'HORIZON_SCAN_REDRAW_ESCALATED',{companyId,eventInstanceId});
  }
  return result;
}

export async function advancePhaseV2(sessionId:string,requested?:GamePhase){
  const result=await baseAdvancePhaseV2(sessionId,requested);
  if(result.success&&result.session.phase==='respond'&&!result.session.isFinalDisruptionActive){
    ensureProgressionConfig(result.session);
    for(const company of result.session.companies){
      const events=result.session.activeEvents[company.id]||[];
      if(events.length&&events.every(event=>!event.isResolved)) applyProgressionToCurrentEvents(result.session,company);
    }
    await saveSessionV2(result.session);
    broadcastV2(result.session,'ROUND_EVENTS_ESCALATED',{round:result.session.round});
  }
  return result;
}
