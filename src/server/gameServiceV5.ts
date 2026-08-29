import type { GamePhase } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import { applyProgressionToCurrentEvents, diversifyInitialKnowledge } from '../engine/eventProgressionV5.ts';
import { recalculateCompanySPOFV2 } from '../engine/coreV2.ts';
import { saveSessionV2 } from './dbV2.ts';
import {
  advancePhaseV2 as baseAdvancePhaseV2,
  broadcastV2,
  createNewSessionV2 as baseCreateNewSessionV2,
  initializeDefaultSessionV2 as baseInitializeDefaultSessionV2,
} from './gameServiceV2.ts';

export * from './gameServiceV2.ts';

function ensureProgressionConfig(session:GameSessionV2):void {
  session.config.event_value_growth_factor ??= DEFAULT_CONFIG.event_value_growth_factor;
  session.config.event_difficulty_growth_per_move ??= DEFAULT_CONFIG.event_difficulty_growth_per_move;
  session.config.event_initial_impact_multiplier ??= DEFAULT_CONFIG.event_initial_impact_multiplier;
}

function applyFreshGameModel(session:GameSessionV2):void {
  ensureProgressionConfig(session);
  for(const company of session.companies){
    diversifyInitialKnowledge(company);
    recalculateCompanySPOFV2(company,session.config);
    applyProgressionToCurrentEvents(session,company);
  }
}

export async function createNewSessionV2(sessionId:string,title:string,companyNames:string[]=['Apex Technologies']):Promise<GameSessionV2>{
  const session=await baseCreateNewSessionV2(sessionId,title,companyNames);
  applyFreshGameModel(session);
  await saveSessionV2(session);
  broadcastV2(session,'SESSION_PROGRESSIVE_BALANCE_APPLIED',{valueGrowthFactor:session.config.event_value_growth_factor,difficultyGrowthPerMove:session.config.event_difficulty_growth_per_move});
  return session;
}

export async function initializeDefaultSessionV2():Promise<GameSessionV2>{
  const session=await baseInitializeDefaultSessionV2();
  ensureProgressionConfig(session);
  return session;
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
