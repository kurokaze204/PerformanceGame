import type { EventType, GamePhase, GameSession, Participant } from '../types/game.ts';
import type { ExperienceMode, GameEndMode, GameSessionV2 } from '../types/gameV2.ts';
import { asSessionV2 } from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import { FINAL_DISRUPTION_CARDS } from '../engine/cards.ts';
import { createInitialCompanyV2, drawRoundEventsV2 } from '../engine/coreV2.ts';
import { interventionUnlocked } from '../engine/experienceModeV3.ts';
import { isInvestmentActionV4 } from '../engine/investmentActionsV4.ts';
import { saveParticipant, saveSessionV2 } from './dbV2.ts';
import {
  advancePhaseV2 as legacyAdvancePhaseV2,
  applyLearningV2,
  broadcastV2,
  deleteSessionAndSelectNextV2,
  facilitatorUpdateV2,
  getGameEventLogs,
  getSessionOrThrow,
  getSessionV2,
  initializeDefaultSessionV2 as legacyInitializeDefaultSessionV2,
  knowledgeActionV2 as legacyKnowledgeActionV2,
  listSessionsV2,
  redrawEventV2,
  registerSSEClientV2,
  resetAllV2,
  resolveEventV2,
  resolveFinalDisruptionV2,
  setEventAllocationV2,
} from './gameServiceV2.ts';

export {
  applyLearningV2,
  deleteSessionAndSelectNextV2,
  facilitatorUpdateV2,
  getGameEventLogs,
  getSessionV2,
  listSessionsV2,
  redrawEventV2,
  registerSSEClientV2,
  resetAllV2,
  resolveEventV2,
  resolveFinalDisruptionV2,
  setEventAllocationV2,
};

export interface CreateGameOptions {
  experienceMode?: ExperienceMode;
  gameDurationMinutes?: number;
  maxPlayersPerCompany?: number;
  actionsPerRound?: number;
  gameEndMode?: GameEndMode;
  finalRoundCount?: number;
}

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function setNextPair(session:GameSessionV2){for(const company of session.companies){const pair:EventType[]=Math.random()<0.5?['problem','opportunity']:['opportunity','problem'];company.eventTypePlan[company.eventsDrawnCount]=pair[0];company.eventTypePlan[company.eventsDrawnCount+1]=pair[1]}}
function remainingSeconds(session:GameSessionV2){if(session.timerEndsAt)return Math.max(0,Math.ceil((new Date(session.timerEndsAt).getTime()-Date.now())/1000));return session.timerPausedSecondsRemaining??session.gameDurationMinutes*60}
function timerHasRun(session:GameSessionV2){const full=session.gameDurationMinutes*60;return Boolean(session.timerStartedAt||session.timerEndsAt||(session.timerPausedSecondsRemaining!=null&&session.timerPausedSecondsRemaining<full))}
export function finalChallengeDue(session:GameSessionV2){
 if(session.experienceMode==='expert'&&session.gameEndMode==='rounds')return session.round>=session.finalRoundCount;
 return timerHasRun(session)&&remainingSeconds(session)<=session.finalWindowMinutes*60;
}
async function startFinal(session:GameSessionV2){const reason=session.experienceMode==='expert'&&session.gameEndMode==='rounds'?'round-limit':'final-window';session.isFinalDisruptionActive=true;session.finalDisruptionCard=FINAL_DISRUPTION_CARDS[0];session.finalDisruptionResolved=false;session.phase='respond';await saveSessionV2(session);broadcastV2(session,'FINAL_DISRUPTION_STARTED',{reason,round:session.round});return{success:true,session}}

export async function createNewSessionV2(sessionId:string,title:string,companyNames:string[]=['Apex Technologies'],options:CreateGameOptions={}):Promise<GameSessionV2>{
 const id=sessionId.toUpperCase();
 const config={...DEFAULT_CONFIG,rounds:99,events_per_round:2,actions_per_round:clamp(Number(options.actionsPerRound??DEFAULT_CONFIG.actions_per_round),1,10)};
 const companies=companyNames.map((name,idx)=>createInitialCompanyV2(name,`comp-${idx+1}-${id.toLowerCase()}`,config));
 const session=asSessionV2({id,title,round:1,phase:'respond',isPaused:false,isFinalDisruptionActive:false,companies,activeEvents:{},copMemberships:[],config,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as GameSession);
 session.experienceMode=options.experienceMode==='expert'?'expert':'newbie';
 session.gameDurationMinutes=clamp(Number(options.gameDurationMinutes||60),20,240);
 session.finalWindowMinutes=10;session.minutesPerMove=8;session.maxPlayersPerCompany=clamp(Number(options.maxPlayersPerCompany||6),1,20);session.participants=[];
 session.gameEndMode=session.experienceMode==='expert'&&options.gameEndMode==='rounds'?'rounds':'time';
 session.finalRoundCount=clamp(Number(options.finalRoundCount||30),1,200);
 session.timerStartedAt=null;session.timerEndsAt=null;session.timerPausedSecondsRemaining=session.gameDurationMinutes*60;session.riskResults=null;
 setNextPair(session);for(const company of session.companies)session.activeEvents[company.id]=drawRoundEventsV2(session,company);
 await saveSessionV2(session);return session;
}

export async function initializeDefaultSessionV2():Promise<GameSessionV2>{return asSessionV2(await legacyInitializeDefaultSessionV2())}

function autoCompany(session:GameSessionV2){const counts=new Map(session.companies.map(c=>[c.id,0]));for(const p of session.participants.filter(p=>p.role==='participant'))counts.set(p.companyId,(counts.get(p.companyId)||0)+1);return[...session.companies].filter(c=>(counts.get(c.id)||0)<session.maxPlayersPerCompany).sort((a,b)=>(counts.get(a.id)||0)-(counts.get(b.id)||0))[0]}

export async function joinSessionV2(sessionId:string,name:string,companyId?:string,role:Participant['role']='participant'){
 const session=await getSessionOrThrow(sessionId);const requested=session.companies.find(c=>c.id===companyId);const target=role==='facilitator'?(requested||session.companies[0]):(requested||autoCompany(session));
 if(!target)throw new Error('All companies have reached the player limit. Ask the facilitator to increase the team size or move a player.');
 const count=session.participants.filter(p=>p.role==='participant'&&p.companyId===target.id).length;if(role==='participant'&&count>=session.maxPlayersPerCompany)throw new Error(`${target.name} is full (${session.maxPlayersPerCompany} players).`);
 const participant:Participant={id:`part-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,sessionId:session.id,name:name||'Player',companyId:target.id,role,lastSeen:new Date().toISOString()};session.participants.push(participant);await saveParticipant(participant);await saveSessionV2(session);broadcastV2(session,'PARTICIPANT_JOINED',{participant});return{session,participant};
}

export async function moveParticipantV3(sessionId:string,participantId:string,companyId:string){const session=await getSessionOrThrow(sessionId);const participant=session.participants.find(p=>p.id===participantId);const target=session.companies.find(c=>c.id===companyId);if(!participant||!target)throw new Error('Player or company not found.');const targetCount=session.participants.filter(p=>p.role==='participant'&&p.companyId===companyId&&p.id!==participantId).length;if(participant.role==='participant'&&targetCount>=session.maxPlayersPerCompany)throw new Error(`${target.name} is already at the player limit.`);participant.companyId=target.id;participant.lastSeen=new Date().toISOString();await saveParticipant(participant);await saveSessionV2(session);broadcastV2(session,'PARTICIPANT_MOVED',{participantId,companyId});return session}

export async function updateGameSettingsV3(sessionId:string,updates:{gameDurationMinutes?:number;maxPlayersPerCompany?:number;gameEndMode?:GameEndMode;finalRoundCount?:number}){const session=await getSessionOrThrow(sessionId);if(updates.maxPlayersPerCompany!=null)session.maxPlayersPerCompany=clamp(Number(updates.maxPlayersPerCompany),1,20);if(session.experienceMode==='expert'&&updates.gameEndMode)session.gameEndMode=updates.gameEndMode==='rounds'?'rounds':'time';else if(session.experienceMode!=='expert')session.gameEndMode='time';if(updates.finalRoundCount!=null)session.finalRoundCount=clamp(Number(updates.finalRoundCount),1,200);if(updates.gameDurationMinutes!=null){const oldFull=session.gameDurationMinutes*60;const elapsed=session.timerEndsAt?Math.max(0,oldFull-remainingSeconds(session)):Math.max(0,oldFull-(session.timerPausedSecondsRemaining??oldFull));session.gameDurationMinutes=clamp(Number(updates.gameDurationMinutes),20,240);const next=Math.max(0,session.gameDurationMinutes*60-elapsed);if(session.timerEndsAt)session.timerEndsAt=new Date(Date.now()+next*1000).toISOString();else session.timerPausedSecondsRemaining=next}await saveSessionV2(session);broadcastV2(session,'GAME_SETTINGS_UPDATED');return session}

export async function advancePhaseV2(sessionId:string,requested?:GamePhase){const session=await getSessionOrThrow(sessionId);const leavingRisk=session.phase==='risk'&&(!requested||requested==='respond');if(leavingRisk&&finalChallengeDue(session))return startFinal(session);if(leavingRisk){setNextPair(session);await saveSessionV2(session)}return legacyAdvancePhaseV2(sessionId,requested)}

export async function knowledgeActionV2(sessionId:string,companyId:string,payload:any){const session=await getSessionOrThrow(sessionId);if(isInvestmentActionV4(payload?.type)&&!interventionUnlocked(session.experienceMode,session.round,payload.type))return{success:false,message:'This knowledge capability has not been introduced yet in Newbie mode.',session};return legacyKnowledgeActionV2(sessionId,companyId,payload)}

export async function timerStartV2(sessionId:string){const session=await getSessionOrThrow(sessionId);const remaining=session.timerPausedSecondsRemaining??session.gameDurationMinutes*60;session.timerStartedAt=session.timerStartedAt||new Date().toISOString();session.timerEndsAt=new Date(Date.now()+remaining*1000).toISOString();session.timerPausedSecondsRemaining=null;await saveSessionV2(session);broadcastV2(session,'TIMER_STARTED');return session}
export async function timerPauseV2(sessionId:string){const session=await getSessionOrThrow(sessionId);session.timerPausedSecondsRemaining=remainingSeconds(session);session.timerEndsAt=null;await saveSessionV2(session);broadcastV2(session,'TIMER_PAUSED');return session}
export async function timerResetV2(sessionId:string){const session=await getSessionOrThrow(sessionId);session.timerStartedAt=null;session.timerEndsAt=null;session.timerPausedSecondsRemaining=session.gameDurationMinutes*60;await saveSessionV2(session);broadcastV2(session,'TIMER_RESET');return session}
