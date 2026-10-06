import React,{useEffect,useMemo,useRef,useState}from'react';
import{ArrowRight,Brain,Building2,CheckCircle2,CircleDollarSign,Crown,Dices,GraduationCap,Info,LogOut,MapPin,Medal,ShieldCheck,Sparkles,Target,Users,Workflow}from'lucide-react';
import type{KnowledgeDomain,Participant}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import type{KMWeekChallenge,KMWeekInvestment}from'../types/kmWeek.ts';
import{KM_WEEK_DOMAINS,KM_WEEK_GOALS,KM_WEEK_SHOCK_CUTOFF,KM_WEEK_SHOCK_FAILURE_COST,KM_WEEK_SHOCK_SPECS,KM_WEEK_SHOCK_WINDOW_SECONDS,KM_WEEK_SITE_IDS,kmWeekRiskOddsV1}from'../engine/kmWeekV1.ts';
import{InvestmentRiverView}from'./InvestmentRiverView.tsx';
import type{RiverGhostPreview}from'./InvestmentRiverView.tsx';
import{KMWeekDebriefV1}from'./KMWeekDebriefV1.tsx';
import{formatCurrency}from'../utils/format.ts';

interface Props{
 session:GameSessionV2;
 company:CompanyV2;
 participant:Participant|null;
 readOnly:boolean;
 controllerName?:string;
 onSessionUpdate:(session:GameSessionV2)=>void;
 onToast:(message:string,durationMs?:number)=>void;
 onLeave:()=>void;
 onTransferCeo?:(participantId:string)=>void;
 onPresentationHoldChange?:(hold:boolean)=>void;
}

type ResponseMethod='local'|'expert'|'risk';
type ResponseSelectionState='none'|'depth'|'breadth';
type PendingResponse={challengeId:string;method?:ResponseMethod;expertId?:string;localSelection:ResponseSelectionState;expertSelection:ResponseSelectionState;label:string}|null;

const SITE_ABBR:Record<string,string>={melbourne:'MEL',brisbane:'BNE',perth:'PER'};
const money=(value:number)=>formatCurrency(value);
const domainLabel=(domain:KnowledgeDomain)=>DOMAIN_INFO[domain].label;
const siteName=(company:CompanyV2,id:string)=>company.sites.find(site=>site.id===id)?.name||id;
const challengeDisplayTitle=(company:CompanyV2,challenge:KMWeekChallenge)=>{const site=siteName(company,challenge.siteId);return challenge.title.toLowerCase().startsWith(site.toLowerCase())?challenge.title:site+' '+challenge.title};
const specialistFor=(company:CompanyV2,domain:KnowledgeDomain)=>company.experts.find(expert=>!expert.isVacant&&expert.domains.some(skill=>skill.domain===domain));
const specialistScore=(company:CompanyV2,domain:KnowledgeDomain)=>specialistFor(company,domain)?.domains.find(skill=>skill.domain===domain)?.score||0;

const KnowledgePips:React.FC<{value:number;domain:KnowledgeDomain;compact?:boolean}>=({value,domain,compact=false})=><div className={compact?'flex gap-1 min-[700px]:gap-0.5 xl:gap-1':'flex gap-1'} aria-label={`Knowledge ${value} of 5`}>{Array.from({length:5},(_,index)=><span key={index} title={`${index+1}`} className={`${compact?'h-2.5 w-2.5 min-[700px]:h-2 min-[700px]:w-2 xl:h-2.5 xl:w-2.5':'h-4 w-4'} rounded-full border shadow-inner ${index<value?'border-white/45':'border-slate-700 bg-slate-950'}`} style={index<value?{backgroundColor:DOMAIN_INFO[domain].color}:{}}/>)}</div>;

const Card:React.FC<{children:React.ReactNode;className?:string}>=({children,className=''})=><section className={`rounded-[20px] border-2 border-slate-700 bg-[#111827] shadow-[0_10px_26px_rgba(0,0,0,.30)] ${className}`}>{children}</section>;

function phaseTitle(company:CompanyV2){
 const state=company.kmWeek;
 if(!state)return'PREPARING';
 if(state.stage==='guided')return`GUIDED ${state.guidedTurn}/3`;
 if(state.stage==='free')return`ROUND ${state.freeRound}`;
 if(state.stage==='shock')return'BUSINESS SHOCK';
 return'COMPLETE';
}

function currentPhaseLabel(company:CompanyV2){
 const state=company.kmWeek;
 if(!state)return'Preparing';
 if(state.stage==='shock')return'Business Shock';
 if(state.stage==='complete')return'Score & Debrief';
 return state.phase==='challenge'?'Challenge':'Invest';
}

function currentGuidedCopy(company:CompanyV2){
 const turn=company.kmWeek?.guidedTurn||1;
 if(turn===1)return{title:'1. Solve the business problem',text:'Brisbane needs Operations 4. Build the response yourself: select Priya for depth, then select the Local Team if you want its knowledge to contribute breadth.',invest:'After the Challenge, you will deepen Priya’s expertise.'};
 if(turn===2)return{title:'2. Who should handle this one?',text:'This problem only needs Operations 1 — exactly what the Brisbane team already knows. You can use the Local Team, or still send Priya if you want to.',invest:'Now use Local Training. Brisbane is the obvious target, but you can send Priya to another site; training away from her current site adds $2k travel.'};
 return{title:'3. The problem moves',text:'A similar Operations issue has appeared in Perth. Use Priya, then commit your response.',invest:'Now try Knowledge Transfer. Choose a domain and two sites where the source knows more than the destination. Brisbane Operations → Perth is the suggested example, but any valid transfer will work.'};
}

function scoreBriefSuggestion(goalId:string){
 if(goalId==='deep-bench')return 'Your Goal rewards expert depth. If an expert is still below Knowledge 5, Train Expert is the shortest route toward those 5 Goal points.';
 if(goalId==='local-heroes')return 'Your Goal rewards solving Challenges locally. Local Training or Knowledge Transfer can strengthen a site so you rely less on travelling experts.';
 if(goalId==='broad-base')return 'Your Goal rewards breadth. Look for a site/domain sitting below Knowledge 2 and use Local Training or Knowledge Transfer to lift it.';
 return 'Your Goal rewards a balanced network. Look for your weakest site and use Local Training or Knowledge Transfer to strengthen it.';
}

const ToolTip:React.FC<{text:React.ReactNode;onHoverChange?:(active:boolean)=>void;large?:boolean}>=({text,onHoverChange,large=false})=><span role="button" aria-label="More information" className={`group relative inline-grid shrink-0 cursor-help place-items-center ${large?'h-7 w-7 rounded-full border border-slate-700 bg-slate-900 text-slate-400':'inline-flex text-slate-500'}`} onMouseEnter={()=>onHoverChange?.(true)} onMouseLeave={()=>onHoverChange?.(false)} onFocus={()=>onHoverChange?.(true)} onBlur={()=>onHoverChange?.(false)} tabIndex={0}><Info className={large?'h-3.5 w-3.5':'h-3.5 w-3.5'}/><span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[300] mt-2 hidden w-64 rounded-xl border border-slate-600 bg-slate-950 p-3 text-[11px] font-semibold normal-case leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">{text}</span></span>;

type ScoreGhostKind='expertise'|'local'|'flow'|'resilience';
const ScoreCell:React.FC<{label:string;value:number;max:string;icon:React.ReactNode;tip:React.ReactNode;ghost?:ScoreGhostKind;onGhost?:(ghost:ScoreGhostKind|null)=>void}>=({label,value,max,icon,tip,ghost,onGhost})=><div className="relative flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-300">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-black text-slate-400">{label}</span><span className="text-lg font-black leading-none tabular-nums text-white">{value}<span className="ml-1 text-[9px] text-slate-600">/{max}</span></span></span><ToolTip large text={tip} onHoverChange={ghost&&onGhost?(active)=>onGhost(active?ghost:null):undefined}/></div>;

const PhaseStep:React.FC<{label:string;active:boolean;done:boolean;number:string}>=({label,active,done,number})=><div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] ${active?'border-amber-300 bg-amber-950/40 text-amber-100':done?'border-emerald-800 bg-emerald-950/25 text-emerald-300':'border-slate-800 bg-slate-950/60 text-slate-600'}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${active?'border-amber-300':done?'border-emerald-600':'border-slate-700'}`}>{done?<CheckCircle2 className="h-3 w-3"/>:number}</span>{label}</div>;

const ChallengeToken:React.FC<{challenge:KMWeekChallenge;company:CompanyV2;selected:boolean;draft?:Exclude<PendingResponse,null>;onClick:()=>void}>=({challenge,company,selected,draft,onClick})=>{
 const site=company.sites.find(item=>item.id===challenge.siteId);
 const local=site?.teamCapability[challenge.domain]||0;
 const done=challenge.status!=='open';
 const shell='min-w-0 rounded-xl border-2 p-2 text-left transition ';
 const stateClass=selected?'border-violet-300 bg-violet-950/35':done?(challenge.status==='success'?'border-emerald-800 bg-emerald-950/20':'border-rose-900 bg-rose-950/20'):'border-slate-700 bg-slate-950/70 hover:border-violet-600';
 return <button type="button" onClick={onClick} className={shell+stateClass}>
  <div className="flex items-center justify-between gap-2"><div className="truncate text-xs font-black text-white">{challengeDisplayTitle(company,challenge)}</div>{done&&<span className={'shrink-0 text-[9px] font-black '+(challenge.status==='success'?'text-emerald-300':'text-rose-300')}>{challenge.status==='success'?'SOLVED':'MISSED'}</span>}</div>
  <div className="mt-1 text-[10px] font-bold text-slate-500">Needs: <b className="text-white">{domainLabel(challenge.domain)} {challenge.difficulty}</b> · Local knowledge: <b className={local>=challenge.difficulty?'text-emerald-300':'text-amber-300'}>{local}</b>{done&&challenge.dieRoll!==undefined&&<span className={'ml-2 font-black '+(challenge.status==='success'?'text-emerald-300':'text-rose-300')}>ROLL {challenge.dieRoll}</span>}{done&&challenge.travelCost&&<span className="ml-2 font-black text-amber-300">Travel -{money(challenge.travelCost)}</span>}</div>
  {!done&&draft&&<div className="mt-1 truncate rounded-md border border-sky-900/70 bg-sky-950/25 px-1.5 py-1 text-[8px] font-black uppercase tracking-[.08em] text-sky-300">Draft · {draft.label}</div>}
 </button>;
};

const ResponseButton:React.FC<{selectionState:ResponseSelectionState;disabled?:boolean;attention?:boolean;children:React.ReactNode;onClick:()=>void}>=({selectionState,disabled,attention=false,children,onClick})=>{
 const depth=selectionState==='depth',breadth=selectionState==='breadth';
 return <button type="button" disabled={disabled} onClick={onClick} className={`relative w-full rounded-xl border-2 px-3 py-2.5 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${depth?'border-amber-300 bg-amber-950/45 text-amber-100':'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'} ${attention&&!disabled?'kmw-attention-button':''}`}>
  {children}
  <span aria-label={depth?'Depth selected':breadth?'Breadth selected':'Unselected'} title={depth?'Depth selected':breadth?'Breadth selected':'Unselected'} className={`absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center overflow-hidden rounded-full border-2 ${depth?'border-amber-300 bg-amber-400 text-slate-950':breadth?'border-sky-400 bg-slate-900':'border-slate-600 bg-slate-900'} ${attention&&!disabled?'kmw-attention-circle':''}`}>
   {depth?'✓':breadth?<span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/2 bg-sky-400"/>:''}
  </span>
 </button>;
};

const ChallengeKnowledgeBars:React.FC<{
 local:number;
 expert:number;
 expertName?:string;
 expertLocation?:string;
 travelCost?:number;
 localSelection:ResponseSelectionState;
 expertSelection:ResponseSelectionState;
 localDisabled?:boolean;
 expertDisabled?:boolean;
 attention?:boolean;
 onLocalClick:()=>void;
 onExpertClick?:()=>void;
}>=({local,expert,expertName,expertLocation,travelCost=0,localSelection,expertSelection,localDisabled=false,expertDisabled=false,attention=false,onLocalClick,onExpertClick})=>{
 const SegmentBar:React.FC<{value:number;filled:number;tone:'local'|'expert'}>=({value,filled,tone})=><div className="grid grid-cols-5 gap-1" aria-label={tone+' knowledge '+value+' of 5'}>
  {Array.from({length:5},(_,index)=>{
   const available=index<value;
   const applied=index<filled;
   const colour=tone==='local'?'border-sky-300 bg-sky-400':'border-amber-300 bg-amber-400';
   const idle=tone==='local'?'border-sky-500/85 bg-sky-950/25':'border-amber-500/85 bg-amber-950/20';
   return <span key={index} className={'h-4 rounded-md border-2 transition-all duration-200 '+(available?(applied?colour:idle):'border-slate-800 bg-slate-950')}/>;
  })}
 </div>;
 const Selector:React.FC<{state:ResponseSelectionState;disabled?:boolean}>=({state,disabled=false})=>{
  const tone=disabled?'border-slate-800 bg-slate-950':state==='depth'?'border-amber-200 bg-amber-400 text-slate-950':state==='breadth'?'border-sky-300 bg-slate-900':'border-slate-500 bg-slate-900';
  return <span aria-label={state==='depth'?'Selected as depth':state==='breadth'?'Selected as breadth':'Not selected'} className={'relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border-2 '+tone+(attention&&!disabled?' kmw-attention-circle':'')}>{state==='depth'?'✓':state==='breadth'?<span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/2 bg-sky-400"/>:''}</span>;
 };
 const localFilled=localSelection==='depth'?local:localSelection==='breadth'?Math.min(local,1):0;
 const expertFilled=expertSelection==='depth'?expert:expertSelection==='breadth'?Math.min(expert,1):0;
 return <div className="mt-2 space-y-1.5" data-kmw-knowledge-bars>
  <button type="button" disabled={localDisabled} onClick={onLocalClick} className={'grid w-full grid-cols-[88px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition disabled:opacity-35 '+(localSelection!=='none'?'border-sky-500 bg-sky-950/20':'border-slate-700 bg-slate-950/70 hover:border-sky-700')+(attention&&!localDisabled?' kmw-attention-button':'')}>
   <span><span className="block text-[10px] font-black text-white">Local team</span><span className="block text-[9px] font-bold text-sky-300">Knowledge {local}</span></span>
   <SegmentBar value={local} filled={localFilled} tone="local"/>
   <Selector state={localSelection} disabled={localDisabled}/>
  </button>
  {expertName&&<button type="button" disabled={expertDisabled} onClick={onExpertClick} className={'grid w-full grid-cols-[88px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition disabled:opacity-35 '+(expertSelection!=='none'?'border-amber-400 bg-amber-950/20':'border-slate-700 bg-slate-950/70 hover:border-amber-700')+(attention&&!expertDisabled?' kmw-attention-button':'')}>
   <span className="min-w-0"><span className="block truncate text-[10px] font-black text-white">{expertName.split(' ')[0]}{expertLocation?' · '+(SITE_ABBR[expertLocation]||expertLocation):''}</span><span className="block text-[9px] font-bold text-amber-300">Knowledge {expert}{expertDisabled?' · used':travelCost?' · $'+travelCost+'k travel':''}</span></span>
   <SegmentBar value={expert} filled={expertFilled} tone="expert"/>
   <Selector state={expertSelection} disabled={expertDisabled}/>
  </button>}
 </div>;
};

export const KMWeekBoardV1:React.FC<Props>=({session,company,participant,readOnly,controllerName,onSessionUpdate,onToast,onLeave,onTransferCeo,onPresentationHoldChange})=>{
 const state=company.kmWeek;
 const[busy,setBusy]=useState(false);
 const[actionError,setActionError]=useState('');
 const[selectedDomain,setSelectedDomain]=useState<KnowledgeDomain>('operations');
 const[selectedChallengeId,setSelectedChallengeId]=useState('');
 const[challengeDrafts,setChallengeDrafts]=useState<Record<string,Exclude<PendingResponse,null>>>({});
 const[challengeFocusOpen,setChallengeFocusOpen]=useState(false);
 const[firstInvestBriefDismissed,setFirstInvestBriefDismissed]=useState(false);
 const[scoreBriefOpen,setScoreBriefOpen]=useState(false);
 const[scorePadOpen,setScorePadOpen]=useState(false);
 const[challengeAttention,setChallengeAttention]=useState(false);
 const[riskResult,setRiskResult]=useState<{roll:number;won:boolean;requiredRoll:number;performanceGap:number}|null>(null);
 const[scoreGhost,setScoreGhost]=useState<ScoreGhostKind|null>(null);
 const[riverFrozenCompany,setRiverFrozenCompany]=useState<CompanyV2|null>(null);
 const[investment,setInvestment]=useState<KMWeekInvestment>('TRAIN_EXPERT');
 const[expertId,setExpertId]=useState('');
 const[sourceSiteId,setSourceSiteId]=useState('brisbane');
 const[targetSiteId,setTargetSiteId]=useState('perth');
 const[trainingSiteId,setTrainingSiteId]=useState('brisbane');
 const[now,setNow]=useState(Date.now());
 const challengeDraftsRef=useRef(challengeDrafts);

 const members=session.participants.filter(item=>item.role!=='facilitator'&&item.companyId===company.id);
 const goalId=session.kmWeekGoalId||'local-heroes';
 const goal=KM_WEEK_GOALS[goalId];
 const scoreSuggestion=scoreBriefSuggestion(goalId);
 const sites=KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)).filter((site):site is CompanyV2['sites'][number]=>Boolean(site));
 const experts=company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain)));
 const specialist=expertId?experts.find(item=>item.id===expertId):specialistFor(company,selectedDomain);
 const specialistDomain=specialist?.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
 const localTrainingSite=company.sites.find(site=>site.id===trainingSiteId&&!site.isClosed);
 const localTrainingTravelCost=specialist&&localTrainingSite&&specialist.location!==localTrainingSite.id?2:0;
 const standings=useMemo(()=>session.companies.map(item=>({id:item.id,name:item.name,score:item.kmWeek?.score.total||0,complete:item.kmWeek?.stage==='complete'})).sort((a,b)=>b.score-a.score),[session.companies,session.updatedAt]);

 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);

 useEffect(()=>{
  if(!state)return;
  const open=state.challenges.find(challenge=>challenge.status==='open');
  const selected=state.challenges.find(challenge=>challenge.id===selectedChallengeId&&challenge.status==='open');
  if(!selected)setSelectedChallengeId(open?.id||state.challenges[0]?.id||'');
  const openIds=new Set(state.challenges.filter(challenge=>challenge.status==='open').map(challenge=>challenge.id));
  setChallengeDrafts(current=>{
   const next=Object.fromEntries(Object.entries(current).filter(([challengeId])=>openIds.has(challengeId)));
   return Object.keys(next).length===Object.keys(current).length?current:next;
  });
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,state?.challenges.map(challenge=>`${challenge.id}:${challenge.status}`).join('|')]);

 useEffect(()=>{
  const challengePhase=state?.phase==='challenge'&&(state?.stage==='guided'||state?.stage==='free');
  setChallengeFocusOpen(!challengePhase);
  setChallengeDrafts({});
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);

 useEffect(()=>{
  if(state?.stage==='guided'&&state.phase==='invest'&&state.guidedTurn===1)setFirstInvestBriefDismissed(false);
 },[state?.stage,state?.phase,state?.guidedTurn]);

 useEffect(()=>{
  if(state?.stage!=='free'||state.phase!=='invest'||state.freeRound!==1)return;
  const key=`tpg:kmw-score-brief:${session.id}:${company.id}`;
  if(localStorage.getItem(key)!=='seen')setScoreBriefOpen(true);
 },[state?.stage,state?.phase,state?.freeRound,session.id,company.id]);

 useEffect(()=>{
  if(!state)return;
  if(state.stage==='guided'&&state.phase==='invest'){
    if(state.guidedTurn===1){setInvestment('TRAIN_EXPERT');setSelectedDomain('operations');setExpertId(specialistFor(company,'operations')?.id||'');}
    else if(state.guidedTurn===2){const expert=specialistFor(company,'operations');setInvestment('LOCAL_TRAINING');setSelectedDomain('operations');setExpertId(expert?.id||'');setTrainingSiteId(expert?.location&&expert.location!=='HQ'?expert.location:'brisbane');}
    else{setInvestment('KNOWLEDGE_TRANSFER');setSelectedDomain('operations');setSourceSiteId('brisbane');setTargetSiteId('perth');}
  }else if(state.stage==='free'&&state.phase==='invest'){
    setInvestment('TRAIN_EXPERT');
    const first=experts[0];setExpertId(first?.id||'');setSelectedDomain(first?.domains[0]?.domain||'operations');
  }
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,company.id]);

 useEffect(()=>{challengeDraftsRef.current=challengeDrafts},[challengeDrafts]);

 useEffect(()=>{
  if(!challengeFocusOpen||state?.phase!=='challenge'||(state?.stage!=='guided'&&state?.stage!=='free')){
   setChallengeAttention(false);
   return;
  }
  const challengeId=selectedChallengeId||state.challenges.find(challenge=>challenge.status==='open')?.id;
  if(!challengeId)return;
  setChallengeAttention(false);
  let pulseTimer:number|undefined;
  const attentionTimer=window.setTimeout(()=>{
   const draft=challengeDraftsRef.current[challengeId];
   const hasSelection=Boolean(draft&&(draft.localSelection!=='none'||draft.expertSelection!=='none'||draft.method==='risk'));
   if(!hasSelection){
    setChallengeAttention(true);
    pulseTimer=window.setTimeout(()=>setChallengeAttention(false),4400);
   }
  },8000);
  return()=>{window.clearTimeout(attentionTimer);if(pulseTimer!==undefined)window.clearTimeout(pulseTimer)};
 },[challengeFocusOpen,state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,selectedChallengeId]);

 useEffect(()=>{
  if(!scorePadOpen)return;
  const closeOnOutside=(event:PointerEvent)=>{
   const target=event.target as Element|null;
   if(target?.closest('[data-kmw-scorepad]'))return;
   setScorePadOpen(false);
  };
  document.addEventListener('pointerdown',closeOnOutside,true);
  return()=>document.removeEventListener('pointerdown',closeOnOutside,true);
 },[scorePadOpen]);

 useEffect(()=>{setScorePadOpen(false)},[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);
 useEffect(()=>{if(scoreBriefOpen)setScorePadOpen(true)},[scoreBriefOpen]);

 if(!state)return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Preparing KM Week board…</div>;

 const remaining=session.timerEndsAt?Math.max(0,Math.ceil((new Date(session.timerEndsAt).getTime()-now)/1000)):session.timerPausedSecondsRemaining??1800;
 const mm=Math.floor(remaining/60),ss=String(remaining%60).padStart(2,'0');
 const overtime=remaining<=0;
 const finalShockWindow=state.stage==='free'&&remaining<=KM_WEEK_SHOCK_WINDOW_SECONDS;
 const guided=state.stage==='guided';
 const guidedCopy=currentGuidedCopy(company);
 const activeChallenge=state.challenges.find(challenge=>challenge.id===selectedChallengeId)||state.challenges.find(challenge=>challenge.status==='open')||state.challenges[0];
 const pendingResponse:PendingResponse=activeChallenge?challengeDrafts[activeChallenge.id]||null:null;
 const setPendingResponse=(next:PendingResponse)=>{
  setChallengeDrafts(current=>{
   const challengeId=next?.challengeId||activeChallenge?.id;
   if(!challengeId)return current;
   if(!next){
    if(!current[challengeId])return current;
    const copy={...current};delete copy[challengeId];return copy;
   }
   return{...current,[next.challengeId]:next};
  });
 };
 const localSite=activeChallenge?company.sites.find(item=>item.id===activeChallenge.siteId):undefined;
 const localScore=activeChallenge&&localSite?localSite.teamCapability[activeChallenge.domain]||0:0;
 const activeExpert=activeChallenge?specialistFor(company,activeChallenge.domain):undefined;
 const activeExpertScore=activeChallenge&&activeExpert?activeExpert.domains.find(skill=>skill.domain===activeChallenge.domain)?.score||0:0;
 const activePending=pendingResponse?.challengeId===activeChallenge?.id?pendingResponse:null;
 const localSelection:ResponseSelectionState=activePending?.localSelection||'none';
 const expertSelection:ResponseSelectionState=activePending?.expertSelection||'none';
 const riskSelected=activePending?.method==='risk';
 const riskKnowledge=localSelection!=='none'?localScore:0;
 const riskOdds=activeChallenge?kmWeekRiskOddsV1(riskKnowledge,activeChallenge.difficulty):{performanceGap:0,requiredRoll:7,successfulFaces:0,chancePercent:0};
 const selectedDepth=localSelection==='depth'?localScore:expertSelection==='depth'?activeExpertScore:0;
 const selectedBreadth=(localSelection==='breadth'&&localScore>0?1:0)+(expertSelection==='breadth'&&activeExpertScore>0?1:0);
 const selectedKnowledge=riskSelected?riskKnowledge:selectedDepth+selectedBreadth;
 const expertUsed=Boolean(activeExpert&&state.usedExpertIds.includes(activeExpert.id));
 const confidentResponseReady=Boolean(activePending?.method&&(activePending.method==='local'||activePending.method==='expert')&&selectedKnowledge>=activeChallenge!.difficulty);
 const responseReady=Boolean(riskSelected||confidentResponseReady);
 const activeExpertTravelCost=activeChallenge&&activeExpert&&activeExpert.location!==activeChallenge.siteId?2:0;

 const post=async(payload:any,beforeApply?:(nextSession:GameSessionV2)=>Promise<void>)=>{
  if(readOnly){onToast(`Read only · ${controllerName||'Your CEO'} controls this company.`);return false}
  if(busy)return false;
  setBusy(true);
  setActionError('');
  try{
   const response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,participantId:participant?.id,actionType:payload.type,params:payload})});
   const data=await response.json();
   if(!response.ok||data?.success===false){
    let message=data?.message||data?.error||'That move is not available.';
    if(response.status===404&&/session not found/i.test(message)){
     try{
      const healthResponse=await fetch('/api/health',{cache:'no-store'});
      const health=await healthResponse.json();
      message=health?.sessionStore==='memory'
       ?'This game session was lost because this Render service is using temporary in-memory storage. Add DATABASE_URL to this Render service so games survive restarts and spin-downs.'
       :'This game session no longer exists in persistent storage. Reload the game list or start a new test session.';
     }catch{
      message='This game session is no longer available on the server. Reload or start a new test session.';
     }
    }
    setActionError(message);onToast(message);return false
   }
   if(data.session){if(beforeApply)await beforeApply(data.session);onSessionUpdate(data.session);}
   if(data.message)onToast(data.message,4500);
   return true;
  }catch{setActionError('Could not complete that move.');onToast('Could not complete that move.');return false}
  finally{setBusy(false)}
 };

 const animateKnowledgeSpark=async(startX:number,startY:number,targetKey:string)=>{
  const target=document.querySelector(`[data-river-target="${targetKey}"]`) as SVGGraphicsElement|null;
  if(!target)return;
  const rect=target.getBoundingClientRect();
  const endX=rect.left+rect.width/2,endY=rect.top+rect.height/2;
  const dx=endX-startX,dy=endY-startY;
  const rise=Math.min(165,Math.max(85,Math.abs(dx)*0.18));
  const loop=Math.min(75,Math.max(42,Math.abs(dx)*0.075));
  const spark=document.createElement('div');
  spark.className='kmw-knowledge-spark';
  spark.style.left=`${startX-9}px`;
  spark.style.top=`${startY-9}px`;
  document.body.appendChild(spark);
  const firstGuidedRound=state.stage==='guided'&&state.guidedTurn===1;
  const travelDuration=firstGuidedRound?1400:1000;
  const travel=spark.animate([
   {transform:'translate(0px,0px) scale(.8)',opacity:0},
   {transform:`translate(${dx*.10}px,${-rise*.58}px) scale(1.18)`,opacity:1,offset:.10},
   {transform:`translate(${dx*.34}px,${-rise}px) scale(1.12)`,opacity:1,offset:.26},
   {transform:`translate(${dx*.62}px,${-rise*.72+dy*.18}px) scale(1.02)`,opacity:1,offset:.43},
   {transform:`translate(${dx*.84}px,${dy*.40}px) scale(.98)`,opacity:1,offset:.60},
   {transform:`translate(${dx-loop}px,${dy*.82}px) scale(.96)`,opacity:1,offset:.74},
   {transform:`translate(${dx-loop*.55}px,${dy+loop*.45}px) scale(.92)`,opacity:1,offset:.84},
   {transform:`translate(${dx+loop*.60}px,${dy+loop*.32}px) scale(.86)`,opacity:1,offset:.92},
   {transform:`translate(${dx}px,${dy}px) scale(.82)`,opacity:1}
  ],{duration:travelDuration,easing:'cubic-bezier(.33,.02,.22,1)',fill:'forwards'});
  try{await travel.finished}catch{}
  const fade=spark.animate([
   {transform:`translate(${dx}px,${dy}px) scale(.82)`,opacity:1},
   {transform:`translate(${dx}px,${dy}px) scale(.55)`,opacity:0}
  ],{duration:300,easing:'ease-out',fill:'forwards'});
  try{await fade.finished}catch{}
  spark.remove();
  // Let the browser paint one completely orb-free frame before applying the
  // new session state. Only then can the River begin its 1.2s transition.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 };

 const cycleKnowledgeSource=(source:'local'|'expert')=>{
  if(!activeChallenge)return;
  setChallengeAttention(false);
  const current=pendingResponse?.challengeId===activeChallenge.id?pendingResponse:null;
  let localState:ResponseSelectionState=current?.localSelection||'none';
  let expertState:ResponseSelectionState=current?.method==='risk'?'none':current?.expertSelection||'none';
  if(source==='local'&&current?.method==='risk'){
   localState=localState==='none'?'depth':'none';
   setPendingResponse({
    challengeId:activeChallenge.id,
    method:'risk',
    expertId:undefined,
    localSelection:localState,
    expertSelection:'none',
    label:`Take the risk${localState!=='none'?' + Local Team':''}`,
   });
   return;
  }
  const sourceState=source==='local'?localState:expertState;
  const sourceScore=source==='local'?localScore:activeExpertScore;
  const otherState=source==='local'?expertState:localState;
  const otherScore=source==='local'?activeExpertScore:localScore;

  let nextState:ResponseSelectionState;
  if(sourceState==='breadth')nextState='depth';
  else if(sourceState==='depth')nextState='none';
  else if(otherState!=='depth')nextState='depth';
  else nextState=sourceScore>=otherScore?'depth':'breadth';

  if(source==='local'){
   localState=nextState;
   if(nextState==='depth'&&expertState==='depth')expertState='breadth';
  }else{
   expertState=nextState;
   if(nextState==='depth'&&localState==='depth')localState='breadth';
  }

  const method:ResponseMethod|undefined=localState==='depth'?'local':expertState==='depth'?'expert':undefined;
  const parts:string[]=[];
  if(localState!=='none')parts.push(`Local ${localState}`);
  if(expertState!=='none'&&activeExpert)parts.push(`${activeExpert.name} ${expertState}`);
  setPendingResponse({
   challengeId:activeChallenge.id,
   method,
   expertId:expertState!=='none'?activeExpert?.id:undefined,
   localSelection:localState,
   expertSelection:expertState,
   label:parts.length?parts.join(' + '):'No knowledge source selected',
  });
 };

 const commitResponse=async()=>{
  if(!pendingResponse)return;
  if(!pendingResponse.method)return;
  const committed=pendingResponse;
  const payload={type:'KM_WEEK_RESOLVE',challengeId:committed.challengeId,method:committed.method,expertId:committed.expertId,includeLocalBreadth:committed.localSelection==='breadth',includeExpertBreadth:committed.expertSelection==='breadth',useLocalRisk:committed.method==='risk'&&committed.localSelection!=='none'};
  const beforeApply=committed.method==='risk'?async(nextSession:GameSessionV2)=>{
   const nextCompany=nextSession.companies.find(item=>item.id===company.id);
   const resolved=nextCompany?.kmWeek?.challenges.find(item=>item.id===committed.challengeId);
   if(resolved?.dieRoll!==undefined){
    const resolvedSite=nextCompany?.sites.find(item=>item.id===resolved.siteId);
    const selectedLocal=committed.localSelection!=='none'?(resolvedSite?.teamCapability[resolved.domain]||0):0;
    const odds=kmWeekRiskOddsV1(selectedLocal,resolved.difficulty);
    setRiskResult({roll:resolved.dieRoll,won:resolved.status==='success',requiredRoll:odds.requiredRoll,performanceGap:odds.performanceGap});
   }
  }:undefined;
  const ok=await post(payload,beforeApply);
  if(ok){
   setChallengeDrafts(current=>{
    const next={...current};
    delete next[committed.challengeId];
    if(committed.expertId&&committed.expertSelection!=='none'){
     for(const [challengeId,draft] of Object.entries(next)){
      if(draft.expertId!==committed.expertId||draft.expertSelection==='none')continue;
      const localSelection=draft.localSelection;
      next[challengeId]={
       ...draft,
       method:localSelection==='depth'?'local':undefined,
       expertId:undefined,
       expertSelection:'none',
       label:localSelection==='depth'?'Local depth':localSelection==='breadth'?'Local breadth · choose a new Depth source':'Expert already committed · choose another response',
      };
     }
    }
    return next;
   });
  }
 };

 const guidedTargetInvestment:KMWeekInvestment|undefined=guided?(state.guidedTurn===1?'TRAIN_EXPERT':state.guidedTurn===2?'LOCAL_TRAINING':'KNOWLEDGE_TRANSFER'):undefined;
 const source=company.sites.find(site=>site.id===sourceSiteId);
 const target=company.sites.find(site=>site.id===targetSiteId);
 const investmentPreview=investment==='TRAIN_EXPERT'
   ?specialist?`${specialist.name}: ${specialistScore(company,specialistDomain)} → ${Math.min(5,specialistScore(company,specialistDomain)+1)}`:'Choose a company expert'
   :investment==='LOCAL_TRAINING'
    ?specialist&&localTrainingSite?`${localTrainingSite.name} ${domainLabel(specialistDomain)}: ${localTrainingSite.teamCapability[specialistDomain]||0} → ${Math.min(5,(localTrainingSite.teamCapability[specialistDomain]||0)+1)} · ${localTrainingTravelCost?`Travel $2k · total $12k`:'No travel · total $10k'}`:'Choose an expert and training site'
    :source&&target?(()=>{
      const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;
      const uplift=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
      return uplift?`${source.name} ${domainLabel(selectedDomain)} ${from} → ${target.name} ${to} → ${Math.min(from,to+uplift)} (+${uplift})`:`${source.name} must know more than ${target.name}`;
    })():'Choose two sites';

 const scoreGhostPreview:RiverGhostPreview|undefined=(()=>{
  if(scoreGhost==='expertise'&&specialist){
   const score=specialistScore(company,specialistDomain);
   return score<5?{kind:'expert',domain:specialistDomain,expertId:specialist.id,delta:1}:undefined;
  }
  if(scoreGhost==='local'&&specialist&&localTrainingSite){
   const current=localTrainingSite.teamCapability[specialistDomain]||0;
   const ceiling=specialistScore(company,specialistDomain);
   return current<ceiling&&current<5?{kind:'site',domain:specialistDomain,siteId:localTrainingSite.id,delta:1}:undefined;
  }
  if(scoreGhost==='flow'&&source&&target){
   const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;
   const uplift=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
   return uplift&&to<5?{kind:'transfer',domain:selectedDomain,sourceSiteId:source.id,targetSiteId:target.id,delta:uplift}:undefined;
  }
  if(scoreGhost==='resilience')return{kind:'threshold',value:KM_WEEK_SHOCK_CUTOFF,label:`SHOCK READY · ${KM_WEEK_SHOCK_CUTOFF}`};
  return undefined;
 })();

 const invest=async(event:React.MouseEvent<HTMLButtonElement>)=>{
  let payload:any,targetKey='';
  if(investment==='TRAIN_EXPERT'){
    const expert=specialist||experts[0];if(!expert)return;
    const domain=expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
    payload={type:'KM_WEEK_INVEST',investment,expertId:expert.id,domain};
    targetKey=`expert:${expert.id}:${domain}`;
  }else if(investment==='LOCAL_TRAINING'){
    const expert=specialist||experts[0];if(!expert||!localTrainingSite)return;
    const domain=expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
    payload={type:'KM_WEEK_INVEST',investment,expertId:expert.id,siteId:localTrainingSite.id,domain};
    targetKey=`site:${localTrainingSite.id}:${domain}`;
  }else{
    payload={type:'KM_WEEK_INVEST',investment,domain:selectedDomain,sourceSiteId,targetSiteId};
    targetKey=`site:${targetSiteId}:${selectedDomain}`;
  }
  const startX=event.clientX,startY=event.clientY;
  onPresentationHoldChange?.(true);
  setRiverFrozenCompany(structuredClone(company));
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  // Start the knowledge movement immediately; do not wait for the round-trip
  // to the server before giving the player visual feedback.
  const animationPromise=animateKnowledgeSpark(startX,startY,targetKey);
  const ok=await post(payload,async nextSession=>{
   await animationPromise;

   // Keep the Invest screen frozen while only the River receives the new
   // company state. This gives the player time to watch the capability change
   // before the next Challenge appears.
   const nextCompany=nextSession.companies.find(item=>item.id===company.id);
   if(nextCompany){
    setRiverFrozenCompany(structuredClone(nextCompany));
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    await new Promise<void>(resolve=>window.setTimeout(resolve,1300));
   }

   onPresentationHoldChange?.(false);
  });
  if(!ok){
   try{await animationPromise}catch{}
   onPresentationHoldChange?.(false);
  }
  setRiverFrozenCompany(null);
 };

 const challengeDone=state.challenges.length>0&&state.challenges.every(challenge=>challenge.status!=='open');
 const shockDone=state.stage==='complete';
 const challengeStepDone=state.stage==='guided'||state.stage==='free'?state.phase==='invest':state.stage==='shock'||shockDone;
 const investStepDone=state.stage==='shock'||shockDone;

 return <div className="min-h-screen bg-[#071019] text-slate-100 xl:h-screen xl:overflow-hidden">
  <header className="relative z-[100] border-b-2 border-amber-950/60 bg-[#09131f]/98 px-3 py-2 shadow-xl xl:h-[66px]">
   <div className="mx-auto flex h-full max-w-[1500px] items-center gap-2">
    <div className="mr-auto min-w-0"><div className="text-[8px] font-black uppercase tracking-[.22em] text-emerald-300">The Performance Gap · KM Week</div><div className="flex min-w-0 items-center gap-2"><Building2 className="h-5 w-5 shrink-0 text-amber-300"/><h1 className="truncate text-lg font-black text-white">{company.name}</h1><span className="hidden rounded-md border border-slate-700 px-1.5 py-0.5 text-[9px] font-black text-slate-500 sm:inline">{session.id}</span>{readOnly?<span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400 lg:inline">Watching · CEO {controllerName}</span>:<span className="hidden rounded-full border border-amber-600 bg-amber-950/50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200 lg:inline"><Crown className="mr-1 inline h-3 w-3"/>CEO · You</span>}</div></div>
    <div className="flex h-12 min-w-[112px] flex-col justify-center rounded-xl border-2 border-emerald-800 bg-emerald-950/25 px-3"><div className="text-[8px] font-black uppercase text-emerald-400">Turnover</div><div className="text-base font-black leading-none text-emerald-200">{money(company.turnover)}</div></div>
    <div className="flex h-12 min-w-[82px] flex-col justify-center rounded-xl border-2 border-amber-700 bg-amber-950/25 px-3"><div className="text-[8px] font-black uppercase text-amber-400">Score</div><div className="text-base font-black leading-none text-amber-200">{state.score.total}</div></div>
    <div title={overtime?'KM Week is time-boxed, not hard-stopped. Finish the game at your own pace.':undefined} className="flex h-12 min-w-[92px] flex-col justify-center rounded-xl border-2 border-violet-800 bg-violet-950/25 px-3"><div className="text-[8px] font-black uppercase text-violet-400">Game time</div><div className={`font-black leading-none tabular-nums ${overtime?'text-xs text-amber-200':'text-base text-violet-100'}`}>{overtime?'OVERTIME':`${mm}:${ss}`}</div></div>
    {!readOnly&&members.length>1&&onTransferCeo&&<select defaultValue="" onChange={event=>{const id=event.target.value;event.currentTarget.value='';if(id)onTransferCeo(id)}} className="h-12 rounded-xl border-2 border-amber-800 bg-slate-950 px-2 text-[10px] font-black text-amber-100"><option value="">Pass CEO…</option>{members.filter(member=>member.id!==participant?.id).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>}
    <button onClick={onLeave} className="h-12 min-w-[92px] rounded-xl border-2 border-rose-800 bg-rose-950/30 px-3 text-xs font-black text-rose-200 hover:border-rose-500"><LogOut className="mr-1 inline h-4 w-4"/>Leave</button>
   </div>
  </header>

  {state.stage==='guided'&&state.phase==='invest'&&state.guidedTurn===1&&!firstInvestBriefDismissed&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[120] bg-black/75"/>
   <div className="fixed left-1/2 top-1/2 z-[145] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.72)]">
    <div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">Before your first investment</div>
    <h2 className="mt-2 text-2xl font-black text-white">The next three investments are guided.</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">For the next three rounds you will solve a Challenge, make one guided investment, then watch the Knowledge River change.</p>
    <div className="mt-4 grid gap-2">
     <div className="flex items-center gap-3 rounded-xl border border-amber-800 bg-amber-950/25 px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-500 bg-amber-950 text-xs font-black text-amber-200">1</span><div><b className="text-sm text-white">Train Expert</b><div className="text-[11px] text-slate-400">Build deeper expertise.</div></div></div>
     <div className="flex items-center gap-3 rounded-xl border border-sky-800 bg-sky-950/20 px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-500 bg-sky-950 text-xs font-black text-sky-200">2</span><div><b className="text-sm text-white">Local Training</b><div className="text-[11px] text-slate-400">Build capability at a site.</div></div></div>
     <div className="flex items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/20 px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-emerald-500 bg-emerald-950 text-xs font-black text-emerald-200">3</span><div><b className="text-sm text-white">Knowledge Transfer</b><div className="text-[11px] text-slate-400">Spread capability between sites.</div></div></div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-slate-400">After the third guided investment, the board opens up and the investment choice is yours.</p>
    <button type="button" onClick={()=>setFirstInvestBriefDismissed(true)} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">SHOW ME THE FIRST INVESTMENT <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </div>
  </>}

  {riskResult&&<div className="fixed inset-0 z-[175] grid place-items-center bg-black/55 p-4">
   <div role="dialog" aria-modal="true" aria-label="Risk response result" className={`w-[min(360px,calc(100vw-32px))] rounded-[24px] border-4 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.75)] ${riskResult.won?'border-emerald-300 bg-emerald-950':'border-rose-300 bg-rose-950'}`}>
    <Dices className={`mx-auto h-10 w-10 ${riskResult.won?'text-emerald-200':'text-rose-200'}`}/>
    <div className="mt-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-300">You took the chance</div>
    <div className="mt-3 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-left text-xs text-slate-200">
     <div className="flex items-center justify-between"><span>Performance gap</span><b className="text-white">{riskResult.performanceGap}</b></div>
     <div className="mt-1 flex items-center justify-between"><span>Roll needed</span><b className="text-white">{riskResult.requiredRoll}+</b></div>
     <div className="mt-1 flex items-center justify-between"><span>Dice roll</span><b className="text-xl text-white">{riskResult.roll}</b></div>
    </div>
    <div className={`mt-3 text-xl font-black ${riskResult.won?'text-emerald-200':'text-rose-200'}`}>{riskResult.won?'SUCCESS':'FAILURE'}</div>
    <button type="button" onClick={()=>setRiskResult(null)} className={`mt-4 h-11 w-full rounded-xl border-2 text-sm font-black ${riskResult.won?'border-emerald-200 bg-emerald-300 text-emerald-950':'border-rose-200 bg-rose-300 text-rose-950'}`}>CONTINUE</button>
   </div>
  </div>}

  {scoreBriefOpen&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[120] bg-black/70"/>
   <div className="fixed left-1/2 top-1/2 z-[145] w-[min(430px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.72)] xl:left-[38%]">
    <div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">Score briefing · Round 4 Invest</div>
    <h2 className="mt-2 text-2xl font-black text-white">Nice work — you’re up to {state.score.total} points.</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">Your Score Pad is already showing the effect of the choices you have made. <b className="text-amber-200">Only the total score matters</b>, so there is no single “right” way to build the company. You can earn points through business performance, deeper expertise, stronger local capability, knowledge flow, resilience and the Goal card.</p>
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/75 p-3">
     <div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">Your Goal card</div>
     <div className="mt-1 text-base font-black text-white">{goal.title} · 5 points</div>
     <p className="mt-1 text-xs leading-relaxed text-slate-400">{goal.description}</p>
     <p className="mt-2 text-xs leading-relaxed text-emerald-200"><b>One idea for this Invest:</b> {scoreSuggestion}</p>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-slate-400">That is only a suggestion. From here, choose the investment that fits the company you want to build.</p>
    <button type="button" onClick={()=>{localStorage.setItem(`tpg:kmw-score-brief:${session.id}:${company.id}`,'seen');setScoreBriefOpen(false)}} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">GOT IT — LET ME INVEST <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </div>
  </>}

  {challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')&&<div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 top-[66px] z-40 bg-black/20"/>}

  {state.stage==='complete'?<KMWeekDebriefV1 session={session} company={company}/>:<main className="mx-auto max-w-[1500px] p-3 min-[700px]:flex min-[700px]:h-[calc(100dvh-66px)] min-[700px]:flex-col min-[700px]:overflow-hidden">
   <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
    <div className="rounded-xl border-2 border-indigo-700 bg-indigo-950/45 px-3 py-1.5 text-[10px] font-black text-indigo-100">{phaseTitle(company)}</div>
    <PhaseStep number="1" label="Challenge" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'} done={challengeStepDone}/>
    <PhaseStep number="2" label="Invest" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'} done={investStepDone}/>
    <PhaseStep number="3" label="Business Shock" active={state.stage==='shock'} done={shockDone}/>
    <PhaseStep number="4" label="Score" active={state.stage==='complete'} done={false}/>
    <div className="ml-auto rounded-xl border border-amber-800 bg-amber-950/20 px-3 py-1.5 text-xs font-black text-amber-100"><span className="mr-2 text-[9px] uppercase text-amber-500">Current phase</span>{currentPhaseLabel(company)}</div>
   </div>

   {finalShockWindow&&<div className="mb-2 shrink-0 rounded-xl border-2 border-rose-500 bg-rose-950/35 px-3 py-2 text-[10px] font-bold leading-relaxed text-rose-100"><b className="text-rose-300">FINAL 3 MINUTES.</b> Finish this round. After your next investment, the Business Shock begins and company experts become unavailable.</div>}

   <div className="grid gap-3 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:grid-cols-[minmax(0,1fr)_310px] lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_410px]">
    <div className="space-y-3 min-[700px]:flex min-[700px]:min-h-0 min-[700px]:flex-col min-[700px]:space-y-0 min-[700px]:gap-2 xl:gap-3">
     <Card className="relative p-3 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:p-2 xl:p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
       <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Knowledge River</div><h2 className="text-lg font-black text-white min-[700px]:text-sm lg:text-base xl:text-lg">Where is the capability now?</h2></div>
       <div data-kmw-scorepad>
        <button type="button" aria-expanded={scorePadOpen} onClick={()=>setScorePadOpen(open=>!open)} className={`flex min-w-[176px] items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 text-left text-xs font-black shadow-lg transition ${scorePadOpen?'border-amber-300 bg-amber-400 text-slate-950':'border-amber-700 bg-amber-950/35 text-amber-100 hover:border-amber-400'}`}>
         <span className="flex items-center gap-2"><Medal className="h-4 w-4"/>SCORE PAD</span><span className={`rounded-lg border px-2 py-0.5 text-sm ${scorePadOpen?'border-slate-900/30 bg-slate-950/10':'border-amber-700 bg-slate-950/40'}`}>{state.score.total}</span>
        </button>
       </div>
      </div>
      <div className="relative top-8 h-[360px] min-[700px]:h-[calc(100%-76px)] min-[700px]:min-h-[210px] xl:h-[calc(100%-78px)] xl:min-h-[285px]"><InvestmentRiverView company={riverFrozenCompany||company} mode="km_week" selectedDomain={selectedDomain} highlightDomain ghostPreview={scoreGhostPreview} thresholdLine={state.stage==='shock'||state.stage==='complete'?{value:KM_WEEK_SHOCK_CUTOFF,label:`SHOCK CUT-OFF · ${KM_WEEK_SHOCK_CUTOFF}`}:undefined}/></div>
      {scorePadOpen&&<div data-kmw-scorepad className={`absolute left-2 right-2 top-[54px] z-[90] h-fit overflow-visible rounded-[18px] border-2 border-amber-700 bg-[#101827]/[.98] p-3 shadow-[0_20px_60px_rgba(0,0,0,.7)] min-[700px]:left-auto min-[700px]:w-2/3 ${scoreBriefOpen?'z-[135] ring-4 ring-amber-300/80 shadow-[0_0_40px_rgba(250,204,21,.45)]':''}`}>
       <div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-300"/><h2 className="text-sm font-black text-white">Score pad</h2><span className="ml-auto rounded-lg border border-amber-700 bg-amber-950/30 px-2 py-0.5 text-sm font-black text-amber-200">{state.score.total}</span></div>
       <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ScoreCell label="Business Performance" value={state.score.business} max="12" icon={<CircleDollarSign className="h-3.5 w-3.5"/>} tip="2 points for each successful free-play Challenge. Improve this by solving business problems successfully."/>
        <ScoreCell label="Expertise" value={state.score.expertise} max="6" icon={<Brain className="h-3.5 w-3.5"/>} tip="Rewards deep expert capability. Each expert scores 1 point per knowledge level above 3. Use Train Expert to improve it. Hover here to preview the next +1 on the River." ghost="expertise" onGhost={setScoreGhost}/>
        <ScoreCell label="Local capability" value={state.score.localCapability} max="9" icon={<Users className="h-3.5 w-3.5"/>} tip="Scores the strength of the whole local River: 1 point for every 2 local knowledge levels across the nine site/domain positions, up to 9 points. Improve it with Local Training or Knowledge Transfer." ghost="local" onGhost={setScoreGhost}/>
        <ScoreCell label="Knowledge Flow" value={state.score.knowledgeFlow} max="6" icon={<Workflow className="h-3.5 w-3.5"/>} tip="Rewards knowledge actually moved. A transfer now moves half the gap to the stronger source (rounded up), and each level moved scores here, with a bonus when the target crosses Knowledge 2." ghost="flow" onGhost={setScoreGhost}/>
        <ScoreCell label="Resilience" value={state.score.resilience} max="5" icon={<ShieldCheck className="h-3.5 w-3.5"/>} tip="Scored in the final Business Shock: 1 point for each test your sites can handle without company experts. Hover here to see the main resilience cut-off on the River." ghost="resilience" onGhost={setScoreGhost}/>
        <ScoreCell label="KM Week goal" value={state.score.goal} max="5" icon={<Target className="h-3.5 w-3.5"/>} tip={<span className="block text-left"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-amber-300">Goal · 5 pts</span><span className="mt-1 block text-sm font-black text-white">{goal.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-slate-300">{goal.description}</span><span className={`mt-2 block rounded-lg border px-2 py-1 text-[9px] font-black ${state.score.goal?'border-emerald-700 bg-emerald-950/30 text-emerald-300':'border-amber-800 bg-amber-950/25 text-amber-300'}`}>{state.score.goal?'ACHIEVED · +5':'IN PLAY'}</span></span>}/>
       </div>
       {standings.length>1&&<div className="mt-2 border-t border-slate-800 pt-2"><div className="text-[8px] font-black uppercase tracking-[.14em] text-violet-300">Workshop standings</div><div className="mt-1 grid grid-cols-2 gap-1">{standings.map((entry,index)=><div key={entry.id} className={`flex items-center rounded-lg border px-2 py-1 text-[9px] ${entry.id===company.id?'border-violet-500 bg-violet-950/25':'border-slate-800 bg-slate-950'}`}><span className="w-4 font-black text-slate-500">{index+1}</span><span className="min-w-0 flex-1 truncate font-bold text-slate-300">{entry.name}</span><b className="text-white">{entry.score}</b></div>)}</div></div>}
      </div>}
     </Card>

     <div className="grid shrink-0 gap-2 md:grid-cols-3 min-[700px]:gap-1.5 xl:gap-2">
      {sites.map((site,index)=><Card key={site.id} className={`relative overflow-hidden p-3 min-[700px]:p-2 xl:p-3 ${index===0?'rotate-[-.2deg]':index===2?'rotate-[.2deg]':''}`}>
       <div className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[8px] font-black text-slate-500">{SITE_ABBR[site.id]}</div>
       <div className="flex items-center gap-2 min-[700px]:gap-1.5"><MapPin className="h-4 w-4 text-emerald-300 min-[700px]:h-3.5 min-[700px]:w-3.5"/><h3 className="text-sm font-black text-white min-[700px]:text-xs xl:text-sm">{site.name}</h3></div>
       <div className="mt-2 space-y-1.5 min-[700px]:mt-1.5 min-[700px]:space-y-1 xl:mt-2 xl:space-y-1.5">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-left min-[700px]:gap-1 min-[700px]:px-1.5 min-[700px]:py-0.5 xl:gap-2 xl:px-2 xl:py-1"><span className="w-16 truncate text-[9px] font-black text-slate-400 min-[700px]:w-10 min-[700px]:text-[8px] xl:w-16 xl:text-[9px]">{domainLabel(domain)}</span><KnowledgePips value={site.teamCapability[domain]||0} domain={domain} compact/><b className="ml-auto text-xs text-white">{site.teamCapability[domain]||0}</b></button>)}</div>
       <div className="mt-2 border-t border-slate-800 pt-1.5 text-[9px] font-bold text-slate-500 min-[700px]:mt-1 min-[700px]:pt-1 min-[700px]:text-[8px] xl:mt-2 xl:pt-1.5 xl:text-[9px]">Expert here: <span className="text-amber-200">{experts.filter(expert=>expert.location===site.id).map(expert=>expert.name.split(' ')[0]).join(', ')||'—'}</span></div>
      </Card>)}
     </div>
    </div>

    <aside className="space-y-2 min-[700px]:flex min-[700px]:min-h-0 min-[700px]:flex-col min-[700px]:space-y-0 min-[700px]:gap-2">
     {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&!challengeFocusOpen?<div className="flex min-h-[360px] shrink-0 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-violet-500/70 bg-violet-950/10 p-5 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:p-3 xl:p-5">
      {state.stage==='guided'&&state.guidedTurn===1&&<div className="mb-4 max-w-[350px] rounded-2xl border border-amber-700/70 bg-amber-950/20 p-3 text-left shadow-lg"><div className="text-[13px] font-black uppercase tracking-[.16em] text-amber-300">CEO briefing · Before Challenge</div><p className="mt-2 text-[16px] leading-relaxed text-slate-200">Welcome! You are the new CEO of <b className="text-white">{company.name}</b>. It’s a business with promise but also some challenges to overcome. There are islands of excellence and a few experts you can rely on to meet the challenges, but your role is to build up knowledge so every site performs well. Business goes on while you make improvements, so you will have to use the expertise you have to solve daily events. In fact, here comes one right now. <b className="text-amber-200">Click the card below to see what it is.</b></p></div>}
      <button type="button" onClick={()=>setChallengeFocusOpen(true)} className="group kmw-start-card relative flex h-[230px] w-[168px] flex-col items-center justify-center overflow-hidden rounded-[18px] border-[3px] border-violet-300 bg-[linear-gradient(145deg,#28184d,#111827)] px-5 text-center shadow-[0_18px_35px_rgba(0,0,0,.42)] transition hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(124,58,237,.25)] focus:outline-none focus:ring-4 focus:ring-violet-400/40" aria-label="Open the next Challenge">
       <div className="absolute inset-2 rounded-[13px] border border-violet-400/35"/>
       <div className="text-[9px] font-black uppercase tracking-[.24em] text-violet-300">The Performance Gap</div>
       <div className="mt-5 text-2xl font-black tracking-[.08em] text-white">CHALLENGE</div>
       <div className="mt-5 rounded-full border-2 border-amber-300 bg-amber-950/45 px-4 py-2 text-xs font-black text-amber-100">CLICK HERE TO START</div>
       <div className="mt-3 text-[9px] font-bold text-slate-500">{phaseTitle(company)}</div>
      </button>
     </div>:<div className={`min-[700px]:min-h-0 min-[700px]:flex-1 ${challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')?'relative z-[60] kmw-card-reveal':''}`}>
     <Card className={`border-violet-700 bg-[linear-gradient(145deg,#1b1731,#101827)] p-3 min-[700px]:h-full min-[700px]:min-h-0 min-[700px]:overflow-y-auto ${challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')?'ring-4 ring-violet-400/20 shadow-[0_20px_60px_rgba(0,0,0,.55)]':''}`}>
      <div className="flex items-center justify-between gap-2"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">Your move</div><h2 className="text-xl font-black text-white">{currentPhaseLabel(company)}</h2></div><div className="rounded-lg border border-violet-700 bg-violet-950/30 px-2 py-1 text-[9px] font-black uppercase text-violet-200">{phaseTitle(company)}</div></div>

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&<>
       {!guided&&<>
        <div className="mt-2 rounded-xl border border-amber-800 bg-amber-950/15 px-2.5 py-2 text-[10px] text-slate-300">Resolve both Challenges. Pick one, choose the knowledge you will use, then commit the response.</div>
        <div className={'mt-2 grid gap-2 '+(state.challenges.length>1?'grid-cols-2':'grid-cols-1')}>{state.challenges.map(challenge=><ChallengeToken key={challenge.id} challenge={challenge} company={company} selected={challenge.id===activeChallenge?.id} draft={challengeDrafts[challenge.id]} onClick={()=>setSelectedChallengeId(challenge.id)}/>)}</div>
       </>}

       {activeChallenge&&activeChallenge.status==='open'&&<div className="mt-2 rounded-xl border border-slate-700 bg-black/20 p-2.5">
        <div className="flex items-start justify-between gap-3">
         <div className="min-w-0">
          {guided&&<div className="text-[9px] font-black uppercase tracking-[.14em] text-amber-300">{guidedCopy.title}</div>}
          <div className={(guided?'mt-0.5 ':'')+'text-sm font-black text-white'}>{challengeDisplayTitle(company,activeChallenge)}</div>
          <div className="mt-1 text-[10px] font-bold text-slate-400">Needs: <b className="text-white">{domainLabel(activeChallenge.domain)} {activeChallenge.difficulty}</b> · Local knowledge: <b className={localScore>=activeChallenge.difficulty?'text-emerald-300':'text-sky-300'}>{localScore}</b></div>
         </div>
         <div className="shrink-0 text-right"><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">Selected knowledge</div><div className={'mt-0.5 text-[34px] font-black leading-none tracking-[-.05em] tabular-nums '+(selectedKnowledge>=activeChallenge.difficulty?'text-emerald-300':'text-white')}>{selectedKnowledge}<span className="text-[20px] text-slate-500">/{activeChallenge.difficulty}</span></div>{pendingResponse?.challengeId===activeChallenge.id&&pendingResponse.method==='risk'&&<div className="mt-1 text-[10px] font-black text-amber-300">RISK {riskOdds.chancePercent}% · {riskOdds.requiredRoll<=1?'ANY ROLL':riskOdds.requiredRoll>6?'NO WINNING ROLL':'NEED '+riskOdds.requiredRoll+'+'}</div>}</div>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{activeChallenge.story}</p>
        <ChallengeKnowledgeBars
         local={localScore}
         expert={activeExpertScore}
         expertName={activeExpert?.name}
         expertLocation={activeExpert?.location}
         travelCost={activeExpertTravelCost}
         localSelection={localSelection}
         expertSelection={expertSelection}
         localDisabled={localScore<=0}
         expertDisabled={expertUsed||activeExpertScore<=0}
         attention={challengeAttention}
         onLocalClick={()=>cycleKnowledgeSource('local')}
         onExpertClick={()=>cycleKnowledgeSource('expert')}
        />
        {!guided&&<div className="mt-1.5"><ResponseButton selectionState={riskSelected?'depth':'none'} onClick={()=>{setChallengeAttention(false);const riskLocalSelection:ResponseSelectionState=localSelection==='none'?'none':'depth';setPendingResponse({challengeId:activeChallenge.id,method:'risk',expertId:undefined,localSelection:riskLocalSelection,expertSelection:'none',label:'Take the risk'+(riskLocalSelection!=='none'?' + Local Team':'')+' · '+riskOdds.chancePercent+'%'})}}><Dices className="mr-1 inline h-4 w-4"/>TAKE THE RISK <span className="ml-1 text-slate-500">{riskOdds.chancePercent}% · gap {riskOdds.performanceGap} · need {riskOdds.requiredRoll<=1?'1+':riskOdds.requiredRoll>6?'impossible':riskOdds.requiredRoll+'+ on d6'}</span></ResponseButton></div>}
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-2 py-1.5">
         <div><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">If you solve it</div><div className="text-sm font-black text-emerald-300">+{money(activeChallenge.impact)} turnover</div></div>
         <div><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">If you fail</div><div className="text-sm font-black text-rose-300">-{money(activeChallenge.impact)} turnover</div></div>
        </div>
        {actionError&&<div className="mt-1.5 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-2 text-[10px] font-black text-rose-200">{actionError}</div>}
        <button type="button" onClick={()=>void commitResponse()} disabled={!responseReady||busy||readOnly} className="mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-600">{busy?'COMMITTING…':'COMMIT RESPONSE'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>}

       {challengeDone&&<div className="mt-3 rounded-xl border-2 border-emerald-700 bg-emerald-950/25 p-3 text-xs font-black text-emerald-200">Challenges complete. Moving to Invest…</div>}
      </>}

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'&&<>
       <div className="mt-2 rounded-xl border-2 border-amber-700 bg-amber-950/20 p-2.5"><div className="text-[9px] font-black uppercase tracking-[.14em] text-amber-300">What to do now</div><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{guided?<><span>{guidedCopy.invest}</span><br/><span className="font-black text-amber-200">Guided move: choose {guidedTargetInvestment==='TRAIN_EXPERT'?'Train Expert':guidedTargetInvestment==='LOCAL_TRAINING'?'Local Training':'Knowledge Transfer'}.</span></>:'Choose exactly one investment. Check the preview, then press COMMIT INVESTMENT. The next round starts immediately.'}</p></div>
       <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button disabled={guided&&guidedTargetInvestment!=='TRAIN_EXPERT'} onClick={()=>setInvestment('TRAIN_EXPERT')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='TRAIN_EXPERT'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='TRAIN_EXPERT'?'border-amber-300 bg-amber-950/40':'border-slate-700 bg-slate-950'}`}><GraduationCap className="h-4 w-4 text-amber-300"/><div className="mt-1 text-[10px] font-black text-white">Train Expert</div><div className="text-[9px] text-slate-500">+1 depth · $15k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='LOCAL_TRAINING'} onClick={()=>setInvestment('LOCAL_TRAINING')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='LOCAL_TRAINING'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='LOCAL_TRAINING'?'border-sky-300 bg-sky-950/40':'border-slate-700 bg-slate-950'}`}><Users className="h-4 w-4 text-sky-300"/><div className="mt-1 text-[10px] font-black text-white">Local Training</div><div className="text-[9px] text-slate-500">+1 local · $10k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'} onClick={()=>setInvestment('KNOWLEDGE_TRANSFER')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='KNOWLEDGE_TRANSFER'?'border-emerald-300 bg-emerald-950/40':'border-slate-700 bg-slate-950'}`}><Workflow className="h-4 w-4 text-emerald-300"/><div className="mt-1 text-[10px] font-black text-white">Knowledge Transfer</div><div className="text-[9px] text-slate-500">Move half the gap · $8k</div></button>
       </div>
       <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/75 p-2.5">
        {investment!=='KNOWLEDGE_TRANSFER'?<div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black uppercase text-slate-500">Company expert<select value={specialist?.id||''} onChange={event=>{const next=experts.find(item=>item.id===event.target.value);setExpertId(event.target.value);if(next)setSelectedDomain(next.domains[0].domain)}} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{experts.map(expert=><option key={expert.id} value={expert.id}>{expert.name} ({SITE_ABBR[expert.location]||expert.location}) · {domainLabel(expert.domains[0].domain)} {expert.domains[0].score}</option>)}</select></label><div>{investment==='LOCAL_TRAINING'?<label className="text-[9px] font-black uppercase text-slate-500">Training site<select value={trainingSiteId} onChange={event=>setTrainingSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · Team {site.teamCapability[specialistDomain]||0}{specialist?.location===site.id?' · expert here':' · +$2k travel'}</option>)}</select></label>:<div><div className="text-[9px] font-black uppercase text-slate-500">Knowledge domain</div><div className="mt-1 rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs font-black text-white">{domainLabel(specialistDomain)}</div></div>}</div></div>:<div className="grid grid-cols-3 gap-2"><label className="text-[9px] font-black uppercase text-slate-500">Domain<select value={selectedDomain} onChange={event=>setSelectedDomain(event.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{KM_WEEK_DOMAINS.map(domain=><option key={domain} value={domain}>{domainLabel(domain)}</option>)}</select></label><label className="text-[9px] font-black uppercase text-slate-500">From<select value={sourceSiteId} onChange={event=>setSourceSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label><label className="text-[9px] font-black uppercase text-slate-500">To<select value={targetSiteId} onChange={event=>setTargetSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label></div>}
        <div className="mt-2 rounded-lg border border-amber-800 bg-amber-950/15 px-2 py-1.5 text-[10px]"><span className="font-black text-amber-300">Preview:</span> <span className="text-slate-200">{investmentPreview}</span></div>
        {actionError&&<div className="mt-2 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-2 text-[10px] font-black text-rose-200">{actionError}</div>}
        <button onClick={event=>void invest(event)} disabled={busy||readOnly} className="mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:bg-slate-800 disabled:text-slate-600">{busy?'COMMITTING…':guided?'COMMIT GUIDED INVESTMENT':finalShockWindow?'COMMIT FINAL INVESTMENT & FACE BUSINESS SHOCK':'COMMIT INVESTMENT & START NEXT ROUND'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>
      </>}

      {state.stage==='shock'&&<div className="mt-2">
       <div className="rounded-2xl border-2 border-rose-700 bg-[linear-gradient(145deg,#32121d,#171827)] p-3 text-left">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 border-rose-300 bg-rose-950"><ShieldCheck className="h-5 w-5 text-rose-200"/></div><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-rose-300">Business Shock · final three minutes</div><h3 className="mt-0.5 text-lg font-black text-white">The experts cannot be everywhere at once.</h3></div></div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-200">Five critical issues hit across the company at the same time. Your specialists are already committed elsewhere, so each site has to act using the knowledge that has actually been built locally.</p>
        <div className="mt-2 rounded-xl border border-amber-700/70 bg-amber-950/25 p-2 text-[10px] leading-relaxed text-amber-100"><b className="text-amber-300">The consequence:</b> if a site has one or more local capability gaps, the company has to bring in emergency external support at <b>${KM_WEEK_SHOCK_FAILURE_COST}k for that site</b>. That cost comes straight off turnover and will appear in the final graph.</div>
       </div>

       <div className="mt-3 space-y-1.5">
        {!state.shockResolved?KM_WEEK_SHOCK_SPECS.map(check=>{
         const site=company.sites.find(item=>item.id===check.siteId);
         return <div key={check.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-2 text-left">
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] font-black text-white">{site?.name||check.siteId} · {domainLabel(check.domain)}</div><div className="text-[9px] text-slate-500">Critical local capability · requires Knowledge {check.difficulty}</div></div><div className="rounded-full border border-slate-600 px-2 py-1 text-[8px] font-black text-slate-400">ABOUT TO BE TESTED</div></div>
         </div>;
        }):state.shockChecks.map(check=>{
         const site=company.sites.find(item=>item.id===check.siteId);
         return <div key={check.id} className={'rounded-xl border p-2 text-left '+(check.passed?'border-emerald-700 bg-emerald-950/25':'border-rose-700 bg-rose-950/30')}>
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] font-black text-white">{site?.name||check.siteId} · {domainLabel(check.domain)}</div><div className="text-[9px] text-slate-400">Local Knowledge {check.localKnowledge} · required {check.difficulty}</div></div><div className={'rounded-full border px-2 py-1 text-[9px] font-black '+(check.passed?'border-emerald-500 text-emerald-300':'border-rose-500 text-rose-200')}>{check.passed?'HELD LOCALLY':'CAPABILITY GAP'}</div></div>
          {!check.passed&&<div className="mt-2 rounded-lg border border-rose-800 bg-slate-950/70 px-2 py-1.5 text-[9px] font-black text-rose-200">This capability gap means the site needs emergency external support.</div>}
         </div>;
        })}
       </div>

       {!state.shockResolved?<button onClick={()=>void post({type:'KM_WEEK_RESOLVE_SHOCK'})} disabled={busy||readOnly} className="mt-3 h-11 w-full rounded-xl border-2 border-white bg-white text-sm font-black text-rose-950 disabled:opacity-40">{busy?'REVEALING…':'REVEAL WHAT THE COMPANY CAN HANDLE'}</button>:<>
        {(()=>{
         const gaps=state.shockChecks.filter(check=>!check.passed).length;
         const ready=state.shockChecks.length-gaps;
         const failedSites=new Set(state.shockChecks.filter(check=>!check.passed).map(check=>check.siteId));
         const cost=failedSites.size*KM_WEEK_SHOCK_FAILURE_COST;
         return <div className={'mt-3 rounded-xl border-2 p-3 text-left '+(gaps?'border-rose-700 bg-rose-950/25':'border-emerald-700 bg-emerald-950/25')}><div className={'text-[9px] font-black uppercase tracking-[.14em] '+(gaps?'text-rose-300':'text-emerald-300')}>{gaps?'The cost of knowledge gaps':'The payoff from distributed knowledge'}</div><div className="mt-1 text-sm font-black text-white">{ready}/{state.shockChecks.length} critical capabilities held locally.</div><p className="mt-1 text-[10px] leading-relaxed text-slate-300">{gaps?<>{gaps} capability gap{gaps===1?'':'s'} across {failedSites.size} site{failedSites.size===1?'':'s'} forced emergency external support at <b className="text-rose-200">{money(KM_WEEK_SHOCK_FAILURE_COST)} per affected site</b>, taking <b className="text-rose-200">-{money(cost)}</b> from turnover. The organisation could keep operating, but it paid for knowledge that had not been transferred in time.</>:<>Every tested capability was available where the work happened. The company absorbed the shock without emergency external support.</>}</p></div>;
        })()}
        <button onClick={()=>void post({type:'KM_WEEK_COMPLETE_SHOCK'})} disabled={busy||readOnly} className="mt-3 h-11 w-full rounded-xl border-2 border-emerald-300 bg-emerald-400 text-sm font-black text-emerald-950 disabled:opacity-40">{busy?'FINISHING…':'CONTINUE TO SCORE & DEBRIEF'}</button>
       </>}
      </div>}

      {state.stage==='complete'&&<div className="mt-3 text-center"><Sparkles className="mx-auto h-10 w-10 text-emerald-300"/><h3 className="mt-2 text-2xl font-black text-white">{state.score.total} points</h3><p className="mt-1 text-xs text-slate-400">The score is useful. The shape of your River is the real result.</p><div className="mt-2 flex justify-center gap-2 text-[10px] font-black uppercase tracking-[.12em]"><span className="rounded-full border border-amber-700 bg-amber-950/30 px-2 py-1 text-amber-200">Depth</span><span className="rounded-full border border-sky-700 bg-sky-950/30 px-2 py-1 text-sky-200">Breadth</span><span className="rounded-full border border-emerald-700 bg-emerald-950/30 px-2 py-1 text-emerald-200">Flow</span></div><div className="mt-3 grid grid-cols-5 gap-1">{state.shockChecks.map(check=><div key={check.id} className={`rounded-lg border p-2 ${check.passed?'border-emerald-700 bg-emerald-950/25':'border-rose-800 bg-rose-950/25'}`}><div className="text-[8px] font-black text-slate-500">{SITE_ABBR[check.siteId]}</div><div className={`text-[9px] font-black ${check.passed?'text-emerald-300':'text-rose-300'}`}>{check.passed?'READY':'GAP'}</div></div>)}</div><div className="mt-3 rounded-xl border border-violet-700 bg-violet-950/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">The strategy you just played</div><div className="mt-2 text-[11px] font-black text-white">Expert Education → Experts → Local Training → Site Users → Knowledge Transfer</div><p className="mt-2 text-[10px] text-slate-500">Newbie mode opens the rest of the knowledge system.</p></div></div>}
     </Card>
     </div>}

    </aside>
   </div>
  </main>}
 </div>;
};
