import type { EventType, GamePhase } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { FINAL_DISRUPTION_CARDS } from '../engine/cards.ts';
import { interventionUnlocked } from '../engine/experienceModeV3.ts';
import { isInvestmentActionV4 } from '../engine/investmentActionsV4.ts';
import { saveSessionV2 } from './dbV2.ts';
import { advancePhaseV2 as legacyAdvancePhaseV2, broadcastV2, getSessionOrThrow } from './gameServiceV2.ts';
import { knowledgeActionV2 as v3KnowledgeActionV2 } from './gameServiceV3.ts';

export * from './gameServiceV3.ts';

function setNextPair(session:GameSessionV2){
 for(const company of session.companies){
  const pair:EventType[]=Math.random()<0.5?['problem','opportunity']:['opportunity','problem'];
  company.eventTypePlan[company.eventsDrawnCount]=pair[0];
  company.eventTypePlan[company.eventsDrawnCount+1]=pair[1];
 }
}
function remainingSeconds(session:GameSessionV2){if(session.timerEndsAt)return Math.max(0,Math.ceil((new Date(session.timerEndsAt).getTime()-Date.now())/1000));return session.timerPausedSecondsRemaining??session.gameDurationMinutes*60}
function timerHasRun(session:GameSessionV2){const full=session.gameDurationMinutes*60;return Boolean(session.timerStartedAt||session.timerEndsAt||(session.timerPausedSecondsRemaining!=null&&session.timerPausedSecondsRemaining<full))}
function estimatedNormalRounds(session:GameSessionV2){const playable=Math.max(session.minutesPerMove*2,session.gameDurationMinutes-session.finalWindowMinutes);return Math.max(1,Math.floor(Math.max(2,Math.floor(playable/session.minutesPerMove))/2))}
function finalDue(session:GameSessionV2){return timerHasRun(session)?remainingSeconds(session)<=session.finalWindowMinutes*60:session.round>=estimatedNormalRounds(session)}
async function startFinal(session:GameSessionV2){session.isFinalDisruptionActive=true;session.finalDisruptionCard=FINAL_DISRUPTION_CARDS[0];session.finalDisruptionResolved=false;session.phase='respond';await saveSessionV2(session);broadcastV2(session,'FINAL_DISRUPTION_STARTED',{reason:'final-window',round:session.round});return{success:true,session}}

export async function advancePhaseV2(sessionId:string,requested?:GamePhase){
 const session=await getSessionOrThrow(sessionId);
 const leavingRisk=session.phase==='risk'&&(!requested||requested==='respond');
 if(leavingRisk&&finalDue(session))return startFinal(session);
 if(leavingRisk){setNextPair(session);await saveSessionV2(session)}
 return legacyAdvancePhaseV2(sessionId,requested);
}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){
 const session=await getSessionOrThrow(sessionId);
 if(isInvestmentActionV4(payload?.type)&&!interventionUnlocked(session.experienceMode,session.round,payload.type))return{success:false,message:'This knowledge capability has not been introduced yet in Newbie mode.',session};
 return v3KnowledgeActionV2(sessionId,companyId,payload);
}
