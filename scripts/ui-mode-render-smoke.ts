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
assert.ok(appBoardSource.includes('ACTIVE_GAME_KEEPALIVE_MS=14*60*1000'),'An open game must send a keepalive after 14 minutes without server activity');
assert.ok(appBoardSource.includes('/keepalive')&&appBoardSource.includes("keepalive:true"),'Browser keepalive must use the active session endpoint and survive page lifecycle transitions');
assert.ok(appBoardSource.includes('Date.now()-lastServerActivity.current<ACTIVE_GAME_KEEPALIVE_MS'),'Normal game activity must postpone the keepalive rather than producing unnecessary pings');
const joinModalSource=readFileSync(new URL('../src/components/SessionJoinModalV2.tsx',import.meta.url),'utf8');
assert.ok(joinModalSource.includes('await Promise.resolve(onJoinSession('),'game creation must await the actual join before leaving the setup state');
assert.ok(joinModalSource.includes("const[namePromptOpen,setNamePromptOpen]=useState(false)"),'Solo setup must keep an explicit missing-name prompt state');
assert.ok(joinModalSource.includes("if(!hasName){setNamePromptOpen(true);return}")&&joinModalSource.includes("disabled={creating}"),'Start Solo Game must remain clickable without a name and open the name prompt instead of silently disabling');
assert.ok(joinModalSource.includes('What should we call you?')&&joinModalSource.includes('Enter your name so the game can identify you.'),'Missing-name prompt must clearly tell the player what is required');
assert.ok(joinModalSource.includes('autoFocus value={playerName}')&&joinModalSource.includes('START GAME'),'Missing-name prompt must let the player enter their name and continue directly');
assert.ok(joinModalSource.includes("km_week:{title:'KM Week'"),'Setup must offer KM Week beside Newbie and Expert');
assert.ok(joinModalSource.includes('grid grid-cols-3 gap-2'),'Game mode selector must present three peer choices');
assert.ok(joinModalSource.includes('role="tabpanel"'),'Selected game mode must open a connected description panel below the buttons');
assert.ok(joinModalSource.includes("next==='km_week'?30"),'Solo KM Week must default to the 30-minute format');
assert.ok(joinModalSource.includes("if(next==='km_week')setDuration(30)"),'Multiplayer KM Week must default to the 30-minute format');

const chartsSource=readFileSync(new URL('../src/components/CompanyChartsOverlay.tsx',import.meta.url),'utf8');
assert.ok(chartsSource.includes("top-[var(--tpg-header-height)]"),'Charts overlay must start below the persistent game header');
assert.ok(chartsSource.includes('aria-label="Close charts"'),'Charts overlay must retain an explicit close control');

const riskSource=readFileSync(new URL('../src/components/AttritionModal.tsx',import.meta.url),'utf8');
assert.ok(riskSource.includes('title="Single Point of Failure"'),'Knowledge Risk expert checks must visibly mark SPOF experts');
const riskRollSource=readFileSync(new URL('../src/components/RiskRollTrack.tsx',import.meta.url),'utf8');
assert.ok(riskRollSource.includes("n>=2&&n<=3&&spof"),'SPOF risk track must show two resignation outcomes in addition to retirement');
const firstLessonSource=readFileSync(new URL('../src/components/NewbieTransferUnlockOverlay.tsx',import.meta.url),'utf8');
assert.ok(firstLessonSource.includes('The problem was access, not absence.'),'opening diagnostic debrief must land the knowledge-location lesson concisely');
assert.ok(firstLessonSource.includes('Knowledge Transfer')&&firstLessonSource.includes('Corporate Intranet'),'opening diagnostic debrief must point to the two later investment responses without a text wall');

assert.ok(appBoardSource.includes("actionType:'FINISH_INVESTING'"),'Invest completion must use the dedicated per-company FINISH_INVESTING action');
const kmWeekBoardSource=readFileSync(new URL('../src/components/KMWeekBoardV1.tsx',import.meta.url),'utf8');
const globalCssSource=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');
const riverSource=readFileSync(new URL('../src/components/InvestmentRiverView.tsx',import.meta.url),'utf8');
const kmWeekDebriefSource=readFileSync(new URL('../src/components/KMWeekDebriefV1.tsx',import.meta.url),'utf8');
assert.ok(kmWeekDebriefSource.includes('Before free play')&&kmWeekDebriefSource.includes('selectedDomain="operations"'),'KM Week AAR Before River must use each company’s post-guided snapshot and a valid KM Week domain');
const eventV4Source=readFileSync(new URL('../src/components/EventDecisionCardV4.tsx',import.meta.url),'utf8');
const eventProgressionSource=readFileSync(new URL('../src/engine/eventProgressionV5.ts',import.meta.url),'utf8');
assert.ok(appBoardSource.includes("session.experienceMode==='km_week'")&&appBoardSource.includes('<KMWeekBoardV1'),'KM Week sessions must use their dedicated play surface');
assert.ok(kmWeekBoardSource.includes("return`GUIDED ${state.guidedTurn}/3`")&&kmWeekBoardSource.includes("return`ROUND ${state.freeRound}`"),'KM Week board must expose the three guided moves and the open-ended time-boxed free-play round number');
assert.ok(kmWeekBoardSource.includes('<InvestmentRiverView company={riverFrozenCompany||company} mode="km_week"'),'KM Week must keep the Knowledge River central while supporting animation sequencing');
assert.ok(kmWeekBoardSource.includes("min-[700px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"),'Tablet-width KM Week must use the desktop-style River/controls two-column layout instead of stacking vertically');
assert.ok(kmWeekBoardSource.includes("min-[700px]:min-h-[210px]")&&kmWeekBoardSource.includes("min-[700px]:p-2 xl:p-3"),'Tablet-width KM Week must compact the River and site cards so the controls remain visible beside them');
assert.ok(kmWeekBoardSource.includes("min-[700px]:w-10")&&kmWeekBoardSource.includes("min-[700px]:h-2 min-[700px]:w-2"),'Tablet site cards must shrink domain labels and knowledge pips enough to remain three-across in portrait');
assert.ok(kmWeekBoardSource.includes("min-[700px]:flex-1")&&kmWeekBoardSource.includes("min-[700px]:h-full min-[700px]:min-h-0 min-[700px]:overflow-y-auto"),'Tablet right-side Challenge/Invest panel must fill the available column and scroll internally');
assert.ok(kmWeekBoardSource.includes("min-[700px]:overflow-y-auto"),'The tablet Challenge/Invest panel must scroll internally rather than pushing below the River');
assert.ok(kmWeekBoardSource.includes('Train Expert')&&kmWeekBoardSource.includes('Local Training')&&kmWeekBoardSource.includes('Knowledge Transfer'),'KM Week must limit strategic investment to the agreed three interventions');
assert.ok(kmWeekBoardSource.includes('Training site')&&kmWeekBoardSource.includes("' · +$2k travel'"),'KM Week Local Training must let the player choose another site and show the fixed travel fee');
assert.ok(kmWeekBoardSource.includes('Travel $2k · total $12k')&&kmWeekBoardSource.includes('No travel · total $10k'),'KM Week Local Training preview must make travel and total cost explicit');
assert.ok(kmWeekBoardSource.includes('Business Shock · final three minutes')&&kmWeekBoardSource.includes('The experts cannot be everywhere at once.'),'KM Week must end with a clearly explained local-capability resilience test');
assert.equal(eventV4Source.includes('2-domain lesson'),false,'Newbie and Expert Challenge cards must not label business events as lessons');
assert.equal(eventV4Source.includes('Diagnostic complete'),false,'Newbie and Expert Challenge cards must not describe business events as diagnostics');
assert.equal(eventProgressionSource.includes("card.title=\`\${tier}:"),false,'Challenge titles must not expose simulation pressure tiers');
assert.equal(eventProgressionSource.includes('This is move \${moveNumber}'),false,'Challenge descriptions must not expose move numbers or simulation mechanics');
assert.ok(kmWeekBoardSource.includes('Business Performance')&&kmWeekBoardSource.includes('Knowledge Flow')&&kmWeekBoardSource.includes('Resilience'),'KM Week must show the board-game score pad');
assert.ok(kmWeekBoardSource.includes('Depth')&&kmWeekBoardSource.includes('Breadth')&&kmWeekBoardSource.includes('Flow'),'KM Week debrief must name the River concepts after players experience them');
assert.ok(kmWeekBoardSource.includes('COMMIT RESPONSE'),'KM Week Challenge choices must require an explicit commit');
assert.ok(kmWeekBoardSource.includes('Current phase'),'KM Week board must make the current phase explicit');
assert.ok(kmWeekBoardSource.includes("overtime?'OVERTIME'")&&kmWeekBoardSource.includes('KM Week is time-boxed, not hard-stopped'),'KM Week must make clear that 0:00 does not lock the player out');
assert.ok(kmWeekBoardSource.includes("actionError&&<div")&&kmWeekBoardSource.includes('COMMIT RESPONSE'),'Challenge action failures must be explained inline instead of flashing Working and appearing to do nothing');
assert.ok(kmWeekBoardSource.includes('<KMWeekDebriefV1 session={session} company={company}/>'),'Completed KM Week games must move into the AAR-lite dashboard');
assert.ok(kmWeekDebriefSource.includes('AAR-lite · Discuss together')&&kmWeekDebriefSource.includes('Before')&&kmWeekDebriefSource.includes('After'),'KM Week AAR-lite must compare each company score and before/after Rivers');
assert.ok(kmWeekDebriefSource.includes('TurnoverGraph')&&kmWeekDebriefSource.includes('COMPANY_COLORS'),'KM Week AAR-lite must graph all company turnover using the same company colours as the comparison cards');
assert.ok(kmWeekDebriefSource.includes('AFTER ACTION REVIEW QUESTIONS')&&kmWeekDebriefSource.includes('What did you plan?')&&kmWeekDebriefSource.includes('What actually happened?')&&kmWeekDebriefSource.includes('Why do you think it was different?')&&kmWeekDebriefSource.includes('What can you alter next time so it works better?'),'KM Week AAR-lite must expose the four Newbie AAR questions in a slide-in panel');
assert.ok(kmWeekDebriefSource.includes('kmw-aar-slide-in')&&globalCssSource.includes('@keyframes kmw-aar-slide-in'),'The AAR questions panel must visibly slide in from the right');
assert.ok(riverSource.includes('compact?:boolean'),'Knowledge River must support compact side-by-side AAR comparisons');
assert.ok(riverSource.includes('data-kmw-score-ghost="expertise"')&&riverSource.includes('data-kmw-score-ghost="local"')&&riverSource.includes('data-kmw-score-ghost="flow"'),'Knowledge River must support glowing blue ghost previews for expertise, local training and knowledge transfer');
assert.ok(kmWeekBoardSource.includes('ghost="expertise"')&&kmWeekBoardSource.includes('ghost="local"')&&kmWeekBoardSource.includes('ghost="flow"')&&kmWeekBoardSource.includes('ghost="resilience"'),'Score Pad tooltips must drive River previews for the actionable knowledge scores and resilience');
assert.ok(kmWeekBoardSource.includes('Company expert'),'KM Week must use the business-facing Company expert label');
assert.ok(kmWeekBoardSource.includes('Score pad')&&kmWeekBoardSource.includes('ToolTip'),'KM Week score categories must explain how points are earned');
assert.ok(kmWeekBoardSource.includes('<ToolTip large text={tip}')&&kmWeekBoardSource.includes("large?'h-7 w-7 rounded-full"),'Score Pad help controls must use the same 28px circular target size as the score topic icons');
assert.ok(kmWeekBoardSource.includes('<span className="min-w-0 flex-1">')&&kmWeekBoardSource.includes('<ToolTip large text={tip}'),'Score Pad help controls must sit at the right-hand end of each score box');
assert.ok(kmWeekBoardSource.includes('tabIndex={0}')&&kmWeekBoardSource.includes('role="button" aria-label="More information"'),'Tooltip controls must be focusable/tappable on iPad rather than hover-only');
assert.ok(kmWeekBoardSource.includes('CLICK HERE TO START'),'KM Week must stage each Challenge behind an explicit facedown event card');
assert.ok(kmWeekBoardSource.includes('border-dashed border-violet-500/70'),'KM Week Challenge start area must read as an active play zone rather than furniture');
assert.ok(kmWeekBoardSource.includes('bg-black/20'),'Opening a Challenge must dim the rest of the board by 20 percent');
assert.ok(kmWeekBoardSource.includes('kmw-card-reveal'),'Opening a Challenge must animate the event card into the decision view');
assert.ok(kmWeekBoardSource.includes('CEO briefing · Before Challenge')&&kmWeekBoardSource.includes('Before your first investment'),'The first guided round must explain Challenge and Invest before play');
assert.ok(kmWeekBoardSource.includes('The next three investments are guided.')&&kmWeekBoardSource.includes('Train Expert')&&kmWeekBoardSource.includes('Local Training')&&kmWeekBoardSource.includes('Knowledge Transfer'),'Before the first Invest, KM Week must explain the three-step guided investment sequence');
assert.ok(kmWeekBoardSource.includes('After the third guided investment, the board opens up')&&kmWeekBoardSource.includes('SHOW ME THE FIRST INVESTMENT'),'The opening Invest popup must tell the player when guidance ends and provide a clear continuation action');
assert.ok(kmWeekBoardSource.includes("guidedTargetInvestment!=='TRAIN_EXPERT'")&&kmWeekBoardSource.includes("guidedTargetInvestment!=='LOCAL_TRAINING'")&&kmWeekBoardSource.includes("guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'"),'Guided Invest must show all three strategy choices and grey out the two not being taught');
assert.equal(kmWeekBoardSource.includes('disabled={guided} className="mt-1 w-full rounded-lg'),false,'Guided selectors must remain explorable while the tutorial constrains the intended move');
assert.ok(kmWeekBoardSource.includes('localDisabled={false}')&&kmWeekBoardSource.includes("onLocalClick={()=>cycleKnowledgeSource('local')}"),'The Local Team selector must remain available even when its knowledge is zero so players can commit a real shortfall');
assert.ok(kmWeekBoardSource.includes("toggleKMWeekSourceV1(localState,expertState,source,localScore,activeExpertScore)"),'Selecting a lower-scoring source must preserve the stronger Depth source');
assert.ok(kmWeekBoardSource.includes("const[challengeDrafts,setChallengeDrafts]=useState<Record<string,Exclude<PendingResponse,null>>>({})"),'KM Week must keep a separate uncommitted response draft for each Challenge');
assert.ok(kmWeekBoardSource.includes('data-kmw-knowledge-bars')&&kmWeekBoardSource.includes('Required')&&kmWeekBoardSource.includes('Local team'),'KM Week Challenge detail must visualise required, local and expert knowledge');
assert.ok(kmWeekBoardSource.includes('Selected knowledge')&&kmWeekBoardSource.includes('text-[34px]'),'KM Week Challenge header must keep the large selected-knowledge / requirement score');
assert.ok(kmWeekBoardSource.includes("const selectedDepth=localSelection==='depth'?localScore:expertSelection==='depth'?activeExpertScore:0")&&kmWeekBoardSource.includes("const selectedBreadth=(localSelection==='breadth'&&localScore>0?1:0)+(expertSelection==='breadth'&&activeExpertScore>0?1:0)"),'KM Week selected knowledge must be composed from explicit depth and breadth sources');
assert.ok(kmWeekBoardSource.includes('const slots=Math.max(5,requirement,local,expert)')&&kmWeekBoardSource.includes('gridTemplateColumns'),'Challenge knowledge bars must expand for requirements above Knowledge 5');
assert.ok(kmWeekBoardSource.includes("localState=next.local;expertState=next.expert;"),'The first click on a response source must visibly select it as Depth');
assert.ok(kmWeekBoardSource.includes("includeLocalBreadth:committed.localSelection==='breadth'")&&kmWeekBoardSource.includes("includeExpertBreadth:committed.expertSelection==='breadth'"),'Commit Response must send both explicit breadth roles to the server');
assert.ok(kmWeekBoardSource.includes('deterministicSelected')&&kmWeekBoardSource.includes('knowledgeShortfall')&&kmWeekBoardSource.includes('KNOWLEDGE SHORTFALL'),'Free play must allow a selected deterministic response to be committed even when it is short of the requirement, with a visible warning');
assert.ok(kmWeekBoardSource.includes('riskOdds.chancePercent')&&kmWeekBoardSource.includes('need {riskOdds.requiredRoll'),'Take the Risk must show its live d6 probability and required roll before commit');
assert.ok(riverSource.includes('data-kmw-shock-cutoff')&&riverSource.includes('strokeDasharray="10 8"'),'Business Shock must draw a yellow dotted cut-off line across the Knowledge River');
assert.ok(kmWeekBoardSource.includes('Critical local capability · requires Knowledge')&&kmWeekBoardSource.includes('REVEAL WHAT THE COMPANY CAN HANDLE'),'KM Week Business Shock must show every local requirement before resolution');
assert.ok(kmWeekBoardSource.includes('BUSINESS SHOCK RESULT')&&kmWeekBoardSource.includes('Knowledge missing')&&kmWeekBoardSource.includes('Emergency support')&&kmWeekBoardSource.includes('CONTINUE TO DEBRIEF'),'Business Shock must keep a clear financial result on screen until the player continues');
assert.ok(kmWeekDebriefSource.includes('ShockSummary')&&kmWeekDebriefSource.includes('Business Shock result'),'The debrief must retain the Business Shock result instead of dropping it after Continue');
assert.ok(kmWeekBoardSource.includes('Score briefing · Round 4 Invest')&&kmWeekBoardSource.includes('Only the total score matters'),'The first free-play Invest must explain the scorecard and multiple paths to success');
assert.ok(kmWeekBoardSource.includes('Your Goal card')&&kmWeekBoardSource.includes('One idea for this Invest'),'The Round 4 score briefing must explain the Goal card and give a light-touch next-step suggestion');
assert.ok(kmWeekBoardSource.includes("state?.stage!=='free'||state.phase!=='invest'||state.freeRound!==1"),'The score briefing must trigger at the first free-play Invest round only');
assert.ok(kmWeekBoardSource.includes('animateKnowledgeSpark')&&riverSource.includes('data-river-target'),'KM Week investments must send a visual knowledge spark toward the River');
assert.ok(globalCssSource.includes('.kmw-knowledge-spark')&&globalCssSource.includes('transition-duration: 1.2s'),'KM Week River changes must use the glowing spark and 1.2 second movement');
assert.ok(kmWeekBoardSource.includes("const firstGuidedRound=state.stage==='guided'&&state.guidedTurn===1")&&kmWeekBoardSource.includes('const travelDuration=firstGuidedRound?1400:1000'),'The first guided River cue must remain deliberately slower than later rounds');
assert.ok(kmWeekBoardSource.includes('const animationPromise=animateKnowledgeSpark')&&kmWeekBoardSource.includes('setRiverFrozenCompany(optimisticCompany)'),'River movement must chain directly after the knowledge orb without waiting for the server round-trip');
assert.ok(kmWeekBoardSource.includes('window.setTimeout(resolve,1300)'),'The Invest screen must remain visible until the River transition has fully completed');
assert.ok(kmWeekBoardSource.includes('onPresentationHoldChange?.(true)')&&kmWeekBoardSource.includes('onPresentationHoldChange?.(false)'),'KM Week must hold and release presentation state around the knowledge movement sequence');
assert.ok(appBoardSource.includes('const setKMWeekPresentationHold=(hold:boolean)=>')&&appBoardSource.includes('if(deferUpdates.current){pendingSession.current=d.session;return}'),'AppBoard must defer incoming session broadcasts while KM Week is presenting the River change');
assert.ok(appBoardSource.includes('onPresentationHoldChange={setKMWeekPresentationHold}'),'KM Week board must be wired to the AppBoard presentation hold');
assert.ok(kmWeekBoardSource.includes('If you solve it')&&kmWeekBoardSource.includes('If you fail'),'KM Week Challenge cards must show the business win and loss before a decision');
assert.ok(appBoardSource.includes("actionType:'FINISH_RISK'"),'Knowledge Risk completion must use the dedicated per-company FINISH_RISK action');
assert.equal(appBoardSource.includes("onAdvanceToNextRound={advancePhase}"),false,'Knowledge Risk must not call the legacy global advance-phase path');

const disruptionCardSource=readFileSync(new URL('../src/components/DisruptionCardV1.tsx',import.meta.url),'utf8');
assert.ok(disruptionCardSource.includes('staticVertical?:boolean'),'Disruption mini card must support the fixed vertical Invest layout');
assert.ok(disruptionCardSource.includes("min-h-[44px]"),'Vertical Disruption domain rows must reserve space for long labels such as Human Resources');
assert.ok(disruptionCardSource.includes("w-[132px] min-h-[176px]"),'Invest Disruption card must retain the same vertical proportions as the board card');
assert.ok(disruptionCardSource.includes("[overflow-wrap:normal]"),'Disruption domain names must not split inside words');
assert.ok(disruptionCardSource.includes('tpg-disruption-deal')&&disruptionCardSource.includes('w-[280px]')&&disruptionCardSource.includes('xl:w-[360px]'),'Newbie Disruption setup must use the smaller iPad card while restoring desktop dimensions at XL');
assert.ok(disruptionCardSource.includes('tpg-disruption-deal')&&disruptionCardSource.includes('touch-pan-y overflow-y-auto overscroll-contain'),'The Disruption box itself must own vertical touch scrolling on iPad');
assert.ok(disruptionCardSource.includes("mt-2 flex min-h-[170px]")&&disruptionCardSource.includes("xl:min-h-[300px]"),'Disruption setup must use a compact tablet layout while retaining the full desktop size');
assert.ok(disruptionCardSource.includes("h-[180px] w-[130px]")&&disruptionCardSource.includes("xl:h-[260px] xl:w-[186px]"),'The dealt Disruption card must shrink on iPad and return to desktop proportions at XL');
assert.ok(appBoardSource.includes("companyRoundPhase==='events'"),'Board-level Event/Disruption UI must render only for the current company Events phase');

const tabletCssSource=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');
const boardShellSource=readFileSync(new URL('../src/components/BoardShell.tsx',import.meta.url),'utf8');
const strategyPromptSource=readFileSync(new URL('../src/components/StrategyPromptV2.tsx',import.meta.url),'utf8');
assert.ok(boardShellSource.includes('tpg-board-overlay-scroll')&&boardShellSource.includes('pointer-events-auto overflow-y-scroll')&&boardShellSource.includes('pb-24'),'Board overlays must receive iPad touch gestures, scroll internally, and keep bottom clearance above the phase bar');
assert.ok(boardShellSource.includes("overlay?'tpg-board-has-overlay':''")&&boardShellSource.includes('tpg-board-frame')&&boardShellSource.includes('tpg-board-stage'),'BoardShell must expose a pinned-overlay state so the Phase bar does not move with iPad scrolling');
assert.ok(boardShellSource.includes('max-w-full xl:max-w-[min(100%,calc((100dvh-var(--tpg-header-height,88px)-24px)*4/3))]'),'Tablet board shell must use the full available width and only restore the height-derived desktop cap at XL');
assert.ok(tabletCssSource.includes('.tpg-board-shell')&&tabletCssSource.includes('max-width: none !important')&&tabletCssSource.includes('padding-left: .25rem !important'),'Tablet gameplay must remove the narrow 4:3 width cap and minimise side padding');
assert.ok(strategyPromptSource.includes('overflow-y-auto overscroll-contain touch-pan-y')&&strategyPromptSource.includes('items-start justify-center'),'Strategy setup must scroll inside the viewport on iPad instead of relying on page scrolling');
assert.ok(strategyPromptSource.includes('!h-12 !text-base')&&strategyPromptSource.includes('xl:!h-14 xl:!text-lg'),'Strategy controls must compact on tablet while keeping desktop sizing at XL');
assert.ok(appBoardSource.includes('tpg-game-root')&&appBoardSource.includes('tpg-game-main'),'Active Newbie/Expert gameplay must expose dedicated tablet scroll containers');
assert.ok(tabletCssSource.includes('.tpg-game-root')&&tabletCssSource.includes('position: fixed')&&tabletCssSource.includes('height: 100dvh')&&tabletCssSource.includes('overflow: hidden'),'iPad gameplay must pin the application to the viewport so Safari cannot scroll the whole document');
assert.ok(tabletCssSource.includes('.tpg-game-main')&&tabletCssSource.includes('flex: 1 1 auto')&&tabletCssSource.includes('-webkit-overflow-scrolling: touch'),'The normal iPad board surface must remain the internal vertical scroller');
assert.ok(tabletCssSource.includes('.tpg-board-has-overlay')&&tabletCssSource.includes('height: 100%')&&tabletCssSource.includes('.tpg-disruption-deal')&&tabletCssSource.includes('max-height: calc(100% - 8px)'),'When a Newbie overlay is open, the purple board must stay fixed while its overlay/Disruption content scrolls inside it');
const appBoardCurrent=readFileSync(new URL('../src/AppBoardV6.tsx',import.meta.url),'utf8');
assert.ok(appBoardCurrent.includes("data?.session||pendingSession.current||session"),'Event acknowledgement must prefer the authoritative acknowledged session before selecting the next card');
assert.equal(appBoardCurrent.includes('advanceToInvestment'),false,'Completing one company Events must not call the legacy global Invest transition');
assert.ok(appBoardCurrent.includes("else if(startStage==='learn'&&companyRoundPhase==='investment')"),'Newbie Invest teaching overlay must follow the current company phase only');
assert.ok(appBoardCurrent.includes("const deckVisible=companyRoundPhase==='events'"),'Event deck visibility must follow the current company phase only');
assert.ok(appBoardCurrent.includes("const displayPhase=companyRoundPhase==='events'?'respond':companyRoundPhase==='investment'?'investment':'risk'"),'Phase bar must be company-specific in multiplayer');
assert.ok(appBoardCurrent.includes("toast(d.message||'Action completed.',30000)"),'successful investment action notices must remain visible for 30 seconds');
assert.ok(appBoardCurrent.includes('dismissNotification();const companyId=company.id'),'starting the next investment action must dismiss the previous action notice');
assert.ok(appBoardCurrent.includes('aria-label="Close notification"'),'action notices must provide an explicit close button');
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
assert.ok(investPanelSource.includes("interventionIds:['aar','knowledge-transfer']"),'AAR and Knowledge Transfer must share one investment strategy group');
assert.ok(investPanelSource.includes("interventionIds:['train-expert','local-training']"),'Expert development and Local Training must share one investment strategy group');
assert.ok(investPanelSource.includes("interventionIds:['update-intranet','corporate-training']"),'Corporate Intranet and Corporate Training must share one investment strategy group');
assert.ok(investPanelSource.includes("'update-intranet':['UPDATE_INTRANET',{siteId,domain}]"),'Corporate Intranet update must submit an explicit source site and domain');
assert.ok(investPanelSource.includes("const needsIntranetSourceSite=selectedId==='update-intranet';"),'Corporate Intranet must expose a source-site selector');
assert.ok(investPanelSource.includes("One Intranet update per round."),'Corporate Intranet controls must state the once-per-round limit');
assert.ok(investPanelSource.includes("intranetUpdatedThisRound=Object.values(company.intranetRoundGrowth)"),'Corporate Intranet UI must enforce the once-per-round limit');
assert.ok(investPanelSource.includes("riverSiteKnowledgeScore(selectedSite,domain,session.experienceMode)"),'Corporate Intranet preview must use the selected site knowledge visible for the current mode');
assert.equal(investPanelSource.includes('higher if stronger source knowledge exists'),false,'Corporate Intranet preview must not use the old hidden-source rule');

assert.ok(investPanelSource.includes("interventionIds:['horizon-scan','join-cop']"),'Horizon Scan and Community of Practice must share one investment strategy group');
assert.ok(investPanelSource.includes('data-investment-strategy={strategy.id}'),'Investment strategy groups must be visibly grouped and colour coded');
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
assert.ok(investPanelSource.includes('const blockingWarning=invalidRiver'),'Invalid non-budget investment choices must still block Run');
assert.ok(investPanelSource.includes('const sifWarning=sifInsufficient'),'Insufficient SIF must be tracked separately from other blocking warnings');
assert.ok(investPanelSource.includes('runDisabled=Boolean(blockingWarning||sifWarning)'),'Insufficient SIF must block Run without replacing the budget selector');
assert.ok(investPanelSource.includes('{sifWarning&&<div'),'Insufficient SIF warning must render above the payment panel');
assert.ok(investPanelSource.includes('grid-cols-[minmax(0,700px)_minmax(150px,1fr)]'),'AAR Recent Challenge control must reserve wider space beside the site information box');
assert.ok(investPanelSource.includes('{selectedSite?.name||\'—\'}'),'AAR Site must render as information rather than a disabled dropdown');
assert.ok(investPanelSource.includes("'Expert name'"),'Expert selection must have its own labelled row');
const nonTransferControls=investPanelSource.slice(investPanelSource.indexOf('data-investment-controls'),investPanelSource.indexOf('<div className="min-w-[250px] flex-1',investPanelSource.indexOf('data-investment-controls')));
assert.ok(nonTransferControls.indexOf("'Expert name'")<nonTransferControls.indexOf('>Domain<select'),'Expert-dependent investments must ask for Expert before Domain');
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
const boardToolTabsSource=readFileSync(new URL('../src/components/BoardToolTabsV1.tsx',import.meta.url),'utf8');
assert.equal(boardToolTabsSource.includes('<span>River</span>'),false,'Legacy River button must not appear in the board tools');
assert.equal(boardToolTabsSource.includes('RiverDiagramOverlay'),false,'Legacy River overlay must not be wired into board tools');
assert.equal(boardToolTabsSource.includes('PROGRAMMED_FAILURE_TAG'),false,'Board tools must not resurrect River based on transfer unlock state');

const facilitatorSource=readFileSync(new URL('../src/components/FacilitatorControlRoomV2.tsx',import.meta.url),'utf8');
assert.ok(facilitatorSource.includes('facilitator/remove-company'),'Facilitator control room must allow an empty company to be removed');
assert.ok(facilitatorSource.includes('team.length>0'),'Company removal must be disabled while players are still assigned');
assert.ok(facilitatorSource.includes("facilitator/remove-player"),'Facilitator must be able to remove duplicate or abandoned player records');
assert.ok(facilitatorSource.includes('Remove duplicate or abandoned player'),'Player removal control must explain its purpose');
assert.ok(facilitatorSource.includes("facilitator/assign-ceo"),'Facilitator must be able to assign the company CEO');
assert.ok(facilitatorSource.includes('One CEO writes'),'Facilitator UI must explain the single-writer company rule');
assert.ok(facilitatorSource.includes('Companies are independent'),'Facilitator UI must explain asynchronous company progression');
assert.equal(facilitatorSource.toLowerCase().includes('autopilot'),false,'Retired autopilot UI must not return');
assert.equal(facilitatorSource.includes('Finish round now'),false,'Facilitator must not force company progression');
assert.equal(facilitatorSource.includes('fac-view-'),false,'Returning from facilitator mode must not manufacture a fake player identity');

const serviceV4Source=readFileSync(new URL('../src/server/gameServiceV4.ts',import.meta.url),'utf8');
assert.ok(serviceV4Source.includes("PARTICIPANT_REJOINED"),'Exact-name re-entry must resume an existing participant rather than create another record');
assert.ok(serviceV4Source.includes("p.name.trim().toLocaleLowerCase()===cleanName.toLocaleLowerCase()"),'Participant rejoin matching must normalise exact player names');
assert.ok(serviceV4Source.includes("participantCountBefore===0&&!session.timerStartedAt&&!session.timerEndsAt"),'Game timer must auto-start when the first real player joins');
assert.equal(serviceV4Source.includes('autopilotEnabled'),false,'Participant allocation must not resurrect autopilot');

assert.equal(boardToolTabsSource.includes('InvestmentDecisionDockV1'),false,'Legacy shared-phase Invest dock must be removed from board tools');

const serviceV9Source=readFileSync(new URL('../src/server/gameServiceV9.ts',import.meta.url),'utf8');
assert.ok(serviceV9Source.includes("company.round+=1"),'finishing Knowledge Risk must advance one company round');
assert.ok(serviceV9Source.includes("company.roundPhase='events'"),'a company must return to Events independently');
assert.equal(serviceV9Source.includes("'waiting' |"),false,'waiting must not be a valid company round phase');
assert.ok(serviceV9Source.includes('syncSessionSummary(session)'), 'session phase/round must be a compatibility summary');
assert.equal(serviceV9Source.toLowerCase().includes('autoplaycompanytowaiting'),false,'autopilot round orchestration must not survive in the active service');

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
assert.ok(appBoardEventSource.includes("sessionStorage.getItem('tpg_facilitator_game_view')!=='1'"),'Facilitator game-view mode must remain facilitator identity without reopening the control room');
assert.ok(appBoardEventSource.includes("activeEventIndex=chosen>=0?chosen:-1"),'board must not fall back to a resolved Event when no unresolved Event exists');
assert.ok(appBoardEventSource.includes("actionType:'OPEN_EVENT_CARD'"),'CEO opening an Event must claim it on the server for all company members');
assert.ok(appBoardEventSource.includes("participantId:participant?.id"),'player writes must carry the participant identity for CEO authorization');
assert.ok(appBoardEventSource.includes("Read only ·"),'followers must have a visible read-only company mode');
assert.ok(appBoardEventSource.includes('company.controllerParticipantId===participant.id'),'write controls must derive from the authoritative company CEO');
assert.equal(appBoardEventSource.includes('/advance-phase'),false,'player UI must not expose global phase advancement');

// Player-legibility audit: important mechanics must be visible without adding permanent instruction walls.
const eventDecisionSource=readFileSync(new URL('../src/components/EventDecisionCardV4.tsx',import.meta.url),'utf8');
assert.ok(eventPlaytestSource.includes('diagnostic={Boolean(isOpeningDiagnostic)}'),'opening challenge must be explicitly marked as diagnostic in both modes');
assert.ok(eventDecisionSource.includes('The site could not contain the issue with the capability immediately available there.'),'diagnostic challenge must frame the knowledge-access gap in player language');
assert.ok(eventDecisionSource.includes('D {e.depthKnowledge} · B +{e.breadthBonus}'),'ordinary Event scoring must expose compact depth/breadth values');
assert.ok(eventDecisionSource.includes('A relevant expert unlocks the full score.'),'Corporate Intranet must reveal when absorptive capacity limits usable knowledge');
assert.ok(eventDecisionSource.includes('Each consultant engagement increases the future rate by 35%.'),'consultant UI must reveal escalating future rates');

assert.ok(finalDisruptionSource.includes('label="Auto"'),'Final Disruption must visibly include Automation in its score');
assert.ok(appBoardEventSource.includes('Knowledge dividend'),'turnover UI must identify knowledge-driven round growth');
assert.ok(appBoardEventSource.includes('3% of current company turnover is added to the SIF'),'SIF tooltip must state the replenishment rule');
assert.ok(investPanelSource.includes('Horizon Scan scope')&&investPanelSource.includes('All upcoming Events'),'Newbie Horizon Scan must not ask the player for a meaningless domain');
const expertModalSource=readFileSync(new URL('../src/components/ExpertModal.tsx',import.meta.url),'utf8');
assert.ok(expertModalSource.includes('SPOF gap ≥ ${config.spof_gap}'),'SPOF tooltip must use the configured threshold rather than a stale hard-coded value');
assert.ok(riskSource.includes('Team Capability above 1 can lose one point'),'Newbie Knowledge Risk must explain its visible workforce-risk rule');

// Round 1 teaching controls must be hidden rather than greyed out.
assert.equal(eventPlaytestSource.includes('ROUND_ONE_DISABLED_LABELS'),false,'retired greyed-out Round 1 strategy buttons must not return');
assert.ok(eventPlaytestSource.includes("isOpeningDiagnostic?['existing']"),'first teaching challenge must expose only existing knowledge');
assert.ok(eventPlaytestSource.includes("isAssemblyLesson?['existing','expert']"),'second teaching challenge must expose only existing knowledge and experts');
assert.ok(eventDecisionSource.includes('visibleModes.map'),'Event strategy rail must render only currently available strategies');
assert.ok(eventPlaytestSource.includes('teamOnlyExisting={Boolean(isAssemblyLesson)}'),'second teaching challenge must focus existing knowledge on Team Capability');
assert.ok(eventDecisionSource.includes('Multiple requirements')&&eventDecisionSource.includes('teachingHint'),'second teaching challenge must have a compact multiple-requirement teaching cue');
assert.ok(appBoardEventSource.includes('const winnerId=String(d.winnerEventInstanceId||event.instanceId)'),'board must display the authoritative Round 1 teaching card even when another card was clicked');

{
 const s=session('expert'),c=s.companies[0],event=s.activeEvents[c.id][0];
 const staged=renderToStaticMarkup(React.createElement(EventDecisionCardV4,{session:s,company:c,event,cardNumber:1,availableModes:['existing','expert'],teamOnlyExisting:true,teachingHint:'test hint',onSetAllocation:()=>{},onResolveEvent:async()=>({}),onAcknowledgeResolution:()=>{}}));
 assert.ok(staged.includes('Use what we already know'),'second lesson must retain existing knowledge');
 assert.ok(staged.includes('Ask one of our experts to help'),'second lesson must expose experts');
 assert.equal(staged.includes('Ask our network for help'),false,'unavailable network strategy must be hidden, not greyed out');
 assert.equal(staged.includes('Call in a favour'),false,'unavailable favour strategy must be hidden, not greyed out');
 assert.equal(staged.includes('Engage external expertise'),false,'unavailable consultant strategy must be hidden, not greyed out');
 assert.equal(staged.includes('Accept the risk'),false,'unavailable risk strategy must be hidden, not greyed out');
 assert.equal(staged.includes('Corporate Intranet'),false,'second teaching challenge existing-knowledge picker must focus on Team Capability');
 assert.equal(staged.includes('Local Codified'),false,'second teaching challenge must not distract Expert players with codified knowledge');
}

console.log('Mode-aware UI render smoke tests passed.');
