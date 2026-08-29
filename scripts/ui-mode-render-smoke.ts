import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import { ActionsPanelV5 } from '../src/components/ActionsPanelV5.tsx';
import { EventDecisionCardV4 } from '../src/components/EventDecisionCardV4.tsx';
import type { ActiveEventV2, GameSessionV2 } from '../src/types/gameV2.ts';

(globalThis as any).localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{},clear:()=>{}};

function session(mode:'newbie'|'expert'):GameSessionV2{
 const config={...DEFAULT_CONFIG,actions_per_round:mode==='newbie'?5:3};
 const company=createInitialCompanyV2('UI Test Co','ui-test-co',config);
 const event:ActiveEventV2={
  instanceId:'ui-event-1',card:{id:'UI-1',type:'problem',scope:'local',title:'UI knowledge test',description:'Synthetic render test',domains:[{domain:'operations',difficulty:4}],impact:20,tags:[]},targetSiteId:company.sites[0].id,allocations:{operations:{}},isResolved:false,
 } as ActiveEventV2;
 return {
  id:'UITEST',title:'UI Test',round:2,phase:'respond',isPaused:false,isFinalDisruptionActive:false,companies:[company],activeEvents:{[company.id]:[event]},copMemberships:[],config,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),timerStartedAt:null,timerEndsAt:null,timerPausedSecondsRemaining:3600,riskResults:null,rulesVersion:'test',deckVersion:'test',balanceVersion:'test',experienceMode:mode,gameDurationMinutes:60,finalWindowMinutes:10,minutesPerMove:8,maxPlayersPerCompany:1,participants:[],
 } as GameSessionV2;
}
for(const mode of ['newbie','expert'] as const){
 const s=session(mode),c=s.companies[0],event=s.activeEvents[c.id][0];
 const actions=renderToStaticMarkup(React.createElement(ActionsPanelV5,{session:s,company:c,onPerformAction:()=>{},onNextPhase:()=>{}}));
 const challenge=renderToStaticMarkup(React.createElement(EventDecisionCardV4,{session:s,company:c,event,cardNumber:1,onSetAllocation:()=>{},onResolveEvent:async()=>({}),onAcknowledgeResolution:()=>{}}));
 if(mode==='newbie'){
  assert.equal(actions.includes('Local Codified'),false,'Newbie Invest UI must not expose Local Codified Knowledge');
  assert.equal(actions.includes('Local docs'),false,'Newbie Invest snapshot must not expose Local docs');
  assert.equal(actions.includes('Codify Site Knowledge'),false,'Newbie intervention menu must not expose site codification');
  assert.equal(challenge.includes('Local Codified'),false,'Newbie Challenge UI must not expose Local Codified Knowledge');
  assert.ok(actions.includes('Actions'),'Newbie Invest UI should still show Actions');
 }else{
  assert.ok(actions.includes('Codify Site Knowledge'),'Expert Invest UI should retain site codification as a distinct intervention');
  assert.ok(challenge.includes('Local Codified'),'Expert Challenge UI should retain Local Codified Knowledge');
 }
}
console.log('Mode-aware UI render smoke tests passed.');
