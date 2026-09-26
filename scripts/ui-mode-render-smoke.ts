import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
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
const appBoardSource=readFileSync(new URL('../src/AppBoardV6.tsx',import.meta.url),'utf8');
assert.equal(appBoardSource.includes("fetch('/api/sessions/default')"),false,'fresh startup must not replace the setup form with a default-session bootstrap');
const joinModalSource=readFileSync(new URL('../src/components/SessionJoinModalV2.tsx',import.meta.url),'utf8');
assert.ok(joinModalSource.includes('await Promise.resolve(onJoinSession('),'game creation must await the actual join before leaving the setup state');

const chartsSource=readFileSync(new URL('../src/components/CompanyChartsOverlay.tsx',import.meta.url),'utf8');
assert.ok(chartsSource.includes("top-[var(--tpg-header-height)]"),'Charts overlay must start below the persistent game header');
assert.ok(chartsSource.includes('aria-label="Close charts"'),'Charts overlay must retain an explicit close control');

const riskSource=readFileSync(new URL('../src/components/AttritionModal.tsx',import.meta.url),'utf8');
assert.ok(riskSource.includes('title="Single Point of Failure"'),'Knowledge Risk expert checks must visibly mark SPOF experts');

assert.ok(appBoardSource.includes("actionType:'FINISH_INVESTING'"),'Invest completion must use the dedicated per-company FINISH_INVESTING action');
assert.ok(appBoardSource.includes("actionType:'FINISH_RISK'"),'Knowledge Risk completion must use the dedicated per-company FINISH_RISK action');
assert.equal(appBoardSource.includes("onAdvanceToNextRound={advancePhase}"),false,'Knowledge Risk must not call the legacy global advance-phase path');

const disruptionCardSource=readFileSync(new URL('../src/components/DisruptionCardV1.tsx',import.meta.url),'utf8');
assert.ok(disruptionCardSource.includes('wide?:boolean'),'Disruption mini card must support the wide Invest layout');
assert.ok(disruptionCardSource.includes("min-h-[54px]"),'Wide Disruption domain rows must reserve space for long labels such as Human Resources');
assert.ok(disruptionCardSource.includes("w-[240px]"),'Wide Disruption card must reserve enough width for full domain names');
assert.ok(disruptionCardSource.includes("[overflow-wrap:normal]"),'Disruption domain names must not split inside words');
assert.ok(appBoardSource.includes("companyRoundPhase!=='investment'"),'Board-level Disruption card must be suppressed during Invest to avoid duplication');

const appBoardCurrent=readFileSync(new URL('../src/AppBoardV6.tsx',import.meta.url),'utf8');
assert.ok(appBoardCurrent.includes("data?.session||pendingSession.current||session"),'Event acknowledgement must prefer the authoritative acknowledged session before selecting the next card');
const investPanelSource=readFileSync(new URL('../src/components/ActionsPanelV5.tsx',import.meta.url),'utf8');
assert.ok(investPanelSource.includes('<InvestmentRiverView'),'Invest must render the persistent Knowledge River');
assert.ok(investPanelSource.includes('Choose an investment'),'Invest must keep investment choices beside the River');
assert.ok(investPanelSource.includes('<DisruptionMiniCard company={company} wide/>'),'Invest footer must contain the wide Disruption goal card');
assert.ok(investPanelSource.includes('bottom-[72px]'),'Invest workspace must clear the phase track');
assert.ok(investPanelSource.includes('grid-cols-[minmax(0,1fr)_300px]'),'River and investment choices must share a stable top-row layout');
assert.equal(investPanelSource.includes('overflow-y-auto'),false,'Core Invest workspace must not introduce internal scrollbars');
assert.ok(investPanelSource.includes("showSiteLabels={selectedId==='knowledge-transfer'}"),'Knowledge Transfer must label all site values on the River');
assert.ok(investPanelSource.includes('· available {riverSiteKnowledgeScore(s,domain,session.experienceMode)}'),'Teaching-site choices must show available knowledge');
assert.ok(investPanelSource.includes(' · team {s.teamCapability[domain]||0}'),'Receiving-site choices must show current team capability');
assert.ok(investPanelSource.includes("selectedId==='knowledge-transfer'?<div className=\"space-y-2\">"),'Knowledge Transfer must use its dedicated stacked control layout');
assert.ok(investPanelSource.indexOf('>Domain<select')<investPanelSource.indexOf('>Teaching site<select'),'Knowledge Transfer must place Domain above Teaching Site');
assert.ok(investPanelSource.includes('grid grid-cols-2 gap-2'),'Teaching and Receiving Site controls must share the full row');
assert.ok(investPanelSource.includes("selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Team ${riverTargetBefore} → ${Math.max(riverTargetBefore,riverTargetAfter)}`:'Choose a receiving site'"),'Knowledge Transfer outcome must describe only the receiving-site change');
assert.equal(investPanelSource.includes('embedded/>'),false,'Disruption card must not remain embedded in the investment chooser');
const investDockSource=readFileSync(new URL('../src/components/InvestmentDecisionDockV1.tsx',import.meta.url),'utf8');
for(const label of ['Sites','Experts','HQ','Score'])assert.ok(investDockSource.includes(`'${label}'`),`Invest must preserve the ${label} reference control`);

const eventDeckSource=readFileSync(new URL('../src/components/EventDeckV1.tsx',import.meta.url),'utf8');
assert.ok(eventDeckSource.includes("const lastSharedOpenIdRef=useRef('')"),'Event deck must remember the last shared-open Event id');
assert.ok(eventDeckSource.includes("if(lastSharedOpenIdRef.current===nextSharedId)return"),'Closing an Event must not reopen the same shared Event');
assert.equal(eventDeckSource.includes("},[shared?.event.instanceId,cardOpen,activeIndex]);"),false,'Shared Event synchronisation must not re-fire merely because the local card was closed');

console.log('Mode-aware UI render smoke tests passed.');
