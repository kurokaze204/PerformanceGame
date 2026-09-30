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
const riskRollSource=readFileSync(new URL('../src/components/RiskRollTrack.tsx',import.meta.url),'utf8');
assert.ok(riskRollSource.includes("n>=2&&n<=3&&spof"),'SPOF risk track must show two resignation outcomes in addition to retirement');
const firstLessonSource=readFileSync(new URL('../src/components/NewbieTransferUnlockOverlay.tsx',import.meta.url),'utf8');
assert.ok(firstLessonSource.includes('Your best source sets the depth; additional independent sources add breadth; consultants can fill specific gaps.'),'first Newbie Event lesson must explain the shared knowledge composition rule');

assert.ok(appBoardSource.includes("actionType:'FINISH_INVESTING'"),'Invest completion must use the dedicated per-company FINISH_INVESTING action');
assert.ok(appBoardSource.includes("actionType:'FINISH_RISK'"),'Knowledge Risk completion must use the dedicated per-company FINISH_RISK action');
assert.equal(appBoardSource.includes("onAdvanceToNextRound={advancePhase}"),false,'Knowledge Risk must not call the legacy global advance-phase path');

const disruptionCardSource=readFileSync(new URL('../src/components/DisruptionCardV1.tsx',import.meta.url),'utf8');
assert.ok(disruptionCardSource.includes('staticVertical?:boolean'),'Disruption mini card must support the fixed vertical Invest layout');
assert.ok(disruptionCardSource.includes("min-h-[44px]"),'Vertical Disruption domain rows must reserve space for long labels such as Human Resources');
assert.ok(disruptionCardSource.includes("w-[132px] min-h-[176px]"),'Invest Disruption card must retain the same vertical proportions as the board card');
assert.ok(disruptionCardSource.includes("[overflow-wrap:normal]"),'Disruption domain names must not split inside words');
assert.ok(appBoardSource.includes("companyRoundPhase!=='investment'"),'Board-level Disruption card must be suppressed during Invest to avoid duplication');

const appBoardCurrent=readFileSync(new URL('../src/AppBoardV6.tsx',import.meta.url),'utf8');
assert.ok(appBoardCurrent.includes("data?.session||pendingSession.current||session"),'Event acknowledgement must prefer the authoritative acknowledged session before selecting the next card');
const investPanelSource=readFileSync(new URL('../src/components/ActionsPanelV5.tsx',import.meta.url),'utf8');
assert.ok(investPanelSource.includes('<InvestmentRiverView'),'Invest must render the persistent Knowledge River');
assert.ok(investPanelSource.includes("'aar':['LESSONS_LEARNED',{siteId,expertId,domain,eventInstanceId:selectedAarEvent?.instanceId}]"),'AAR must submit one expert facilitator');
assert.ok(investPanelSource.includes("previewSiteDelta={selectedId==='aar'&&selectedAarEvent?1:0}"),'AAR must preview site learning only while an unused completed challenge is selected');
assert.ok(investPanelSource.includes("previewExpertDelta={selectedId==='aar'&&selectedAarEvent&&selectedExpertSkill!=null?1:0}"),'AAR must preview facilitator learning only for an unused challenge and a facilitator who holds the selected domain');
assert.ok(investPanelSource.includes('const expertChoices=activeExperts;'),'AAR facilitator choices must include all employed experts');
assert.ok(investPanelSource.includes("const aarEligibleEvents=resolvedEvents.filter(e=>!e.experientialLearningAwarded);"),'AAR chooser must exclude completed challenges that already produced Lessons Learned');
assert.ok(investPanelSource.includes("No unused completed challenge"),'AAR controls must visibly explain when no eligible challenge remains');
assert.ok(investPanelSource.includes("previewHQDelta={selectedId==='aar'&&selectedAarEvent?1:0}"),'AAR must preview corporate learning only while an unused completed challenge is selected');
const investmentRiverSource=readFileSync(new URL('../src/components/InvestmentRiverView.tsx',import.meta.url),'utf8');
assert.ok(investmentRiverSource.includes('{abbrev(site.id)}'),'Invest River site labels must use three-letter site abbreviations');
assert.ok(investmentRiverSource.includes('{firstName(mark.expert.name)} · {loc}'),'Invest River expert labels must show first name and city abbreviation');
assert.ok(investmentRiverSource.includes('fontSize="13"'),'Invest River labels must remain readable at the central workspace size');
assert.ok(investPanelSource.includes('Choose an investment'),'Invest must keep investment choices beside the River');
assert.ok(investPanelSource.includes('data-investment-arrow'),'Choose an investment panel must retain its bottom pointer');
assert.ok(investPanelSource.includes('data-knowledge-transfer-controls'),'Knowledge Transfer controls must use the dedicated vertical hierarchy');
assert.ok(investPanelSource.includes('<DisruptionMiniCard company={company} staticVertical/>'),'Invest footer must contain the fixed vertical Disruption goal card');
assert.ok(investPanelSource.includes('bottom-[72px]'),'Invest workspace must clear the phase track');
assert.ok(investPanelSource.includes("left-1/2")&&investPanelSource.includes("max-w-[min(100%,calc((100dvh-var(--tpg-header-height,88px)-24px)*4/3))]"),'Invest workspace must align to and cover the centred map width');
assert.equal(investPanelSource.includes("min-[1280px]:right-[360px]"),false,'Invest workspace must not reserve a dead gap for right-hand slide-ins');
assert.ok(investPanelSource.includes('min-h-[384px]'),'River and investment chooser must be twenty percent taller than the previous 320px workspace');
assert.ok(investPanelSource.includes('data-investment-controls'),'Non-transfer investment controls must use the cleaned stacked layout');
assert.ok(investPanelSource.includes('name="investment-budget"'),'Invest payment box must offer Local and SIF budget choices');
assert.ok(investPanelSource.includes('Continue: SIF')&&investPanelSource.includes('Continue: {localBudgetLabel}'),'Invest payment box must show the resulting budget/turnover impact');
assert.ok(investPanelSource.includes('const blockingWarning=invalidRiver'),'Invalid investment choices must replace the payment box with a blocking warning');
assert.ok(investPanelSource.includes('grid-cols-[minmax(0,700px)_minmax(150px,1fr)]'),'AAR Recent Challenge control must reserve wider space beside the site information box');
assert.ok(investPanelSource.includes('{selectedSite?.name||\'—\'}'),'AAR Site must render as information rather than a disabled dropdown');
assert.ok(investPanelSource.includes("'Expert name'"),'Expert selection must have its own labelled row');
assert.ok(investPanelSource.includes('grid-cols-[minmax(0,1fr)_300px]'),'River and investment choices must share a stable top-row layout');
assert.equal(investPanelSource.includes('overflow-y-auto'),false,'Core Invest workspace must not introduce internal scrollbars');
assert.ok(investPanelSource.includes("showSiteLabels={selectedId==='knowledge-transfer'}"),'Knowledge Transfer must label all site values on the River');
assert.ok(investPanelSource.includes('· available {riverSiteKnowledgeScore(s,domain,session.experienceMode)}'),'Teaching-site choices must show available knowledge');
assert.ok(investPanelSource.includes(' · team {s.teamCapability[domain]||0}'),'Receiving-site choices must show current team capability');
assert.ok(investPanelSource.includes("selectedId==='knowledge-transfer'?<div data-knowledge-transfer-controls className=\"space-y-2\">"),'Knowledge Transfer must use its dedicated stacked control layout');
assert.ok(investPanelSource.indexOf('>Domain<select')<investPanelSource.indexOf('>Teaching site<select'),'Knowledge Transfer must place Domain above Teaching Site');
assert.ok(investPanelSource.includes('grid grid-cols-2 gap-2'),'Teaching and Receiving Site controls must share the full row');
assert.ok(investPanelSource.includes("selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Team ${riverTargetBefore} → ${Math.max(riverTargetBefore,riverTargetAfter)}`:'Choose a receiving site'"),'Knowledge Transfer outcome must describe only the receiving-site change');
assert.equal(investPanelSource.includes('embedded/>'),false,'Disruption card must not remain embedded in the investment chooser');
const facilitatorSource=readFileSync(new URL('../src/components/FacilitatorControlRoomV2.tsx',import.meta.url),'utf8');
assert.ok(facilitatorSource.includes('Finish round now'),'Facilitator control room must allow a company round to be finished early');
assert.ok(facilitatorSource.includes("'remove-company'"),'Facilitator control room must allow an empty company to be removed');
assert.ok(facilitatorSource.includes('autopilot will keep this company moving'),'Facilitator control room must explain empty-company autopilot');
assert.ok(facilitatorSource.includes('team.length>0'),'Company removal must be disabled while players are still assigned');

const investDockSource=readFileSync(new URL('../src/components/InvestmentDecisionDockV1.tsx',import.meta.url),'utf8');
for(const label of ['Sites','Experts','HQ','Score'])assert.ok(investDockSource.includes(`'${label}'`),`Invest must preserve the ${label} reference control`);

const finalDisruptionSource=readFileSync(new URL('../src/components/FinalDisruptionModalV2.tsx',import.meta.url),'utf8');
assert.ok(finalDisruptionSource.includes('TRY YOUR LUCK WITHOUT EXTERNAL HELP'),'Final Disruption must clearly label an under-strength no-consultant attempt');
assert.ok(finalDisruptionSource.includes('Chance without external help'),'Final Disruption must show the gap-based chance');
assert.ok(finalDisruptionSource.includes('aria-pressed={useConsultant}'),'Emergency Consultant control must expose a visible selected state');
assert.ok(finalDisruptionSource.includes('bg-[#0b0d12]'),'Disruption domain cards must use a distinct neutral surface from the consultant and resolve controls');

const eventDeckSource=readFileSync(new URL('../src/components/EventDeckV1.tsx',import.meta.url),'utf8');
assert.ok(eventDeckSource.includes("const lastSharedOpenIdRef=useRef('')"),'Event deck must remember the last shared-open Event id');
assert.ok(eventDeckSource.includes("if(lastSharedOpenIdRef.current===nextSharedId)return"),'Closing an Event must not reopen the same shared Event');
assert.equal(eventDeckSource.includes("},[shared?.event.instanceId,cardOpen,activeIndex]);"),false,'Shared Event synchronisation must not re-fire merely because the local card was closed');
assert.ok(eventDeckSource.includes("item.event.instanceId===sharedId&&!item.event.isResolved"),'resolved Events must be ignored by shared-open synchronisation');

const eventPlaytestSource=readFileSync(new URL('../src/components/EventDecisionCardPlaytestV1.tsx',import.meta.url),'utf8');
const finishLessonStart=eventPlaytestSource.indexOf('const finishLesson=async()=>');
const finishLessonEnd=eventPlaytestSource.indexOf('if(pendingContinue)',finishLessonStart);
const finishLessonSource=eventPlaytestSource.slice(finishLessonStart,finishLessonEnd);
assert.equal(finishLessonSource.includes('setPendingContinue(null)'),false,'Newbie transfer lesson must remain visible until Event acknowledgement succeeds');

const appBoardEventSource=readFileSync(new URL('../src/AppBoardV6.tsx',import.meta.url),'utf8');
assert.ok(appBoardEventSource.includes("activeEventIndex=chosen>=0?chosen:-1"),'board must not fall back to a resolved Event when no unresolved Event exists');
assert.ok(appBoardEventSource.includes("if(!event||event.isResolved)return;setBoardTool(null)"),'opening a resolved Event must be ignored');

console.log('Mode-aware UI render smoke tests passed.');
