import React,{useEffect,useMemo,useState}from'react';
import{ArrowRight,Brain,Building2,CheckCircle2,CircleDollarSign,Crown,Dices,GraduationCap,Info,LogOut,MapPin,Medal,ShieldCheck,Sparkles,Target,Users,Workflow}from'lucide-react';
import type{KnowledgeDomain,Participant}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import type{KMWeekChallenge,KMWeekInvestment}from'../types/kmWeek.ts';
import{KM_WEEK_DOMAINS,KM_WEEK_GOALS,KM_WEEK_SITE_IDS}from'../engine/kmWeekV1.ts';
import{InvestmentRiverView}from'./InvestmentRiverView.tsx';
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
}

type ResponseMethod='local'|'expert'|'risk';
type PendingResponse={challengeId:string;method:ResponseMethod;expertId?:string;label:string}|null;

const SITE_ABBR:Record<string,string>={melbourne:'MEL',brisbane:'BNE',perth:'PER'};
const money=(value:number)=>formatCurrency(value);
const domainLabel=(domain:KnowledgeDomain)=>DOMAIN_INFO[domain].label;
const siteName=(company:CompanyV2,id:string)=>company.sites.find(site=>site.id===id)?.name||id;
const specialistFor=(company:CompanyV2,domain:KnowledgeDomain)=>company.experts.find(expert=>!expert.isVacant&&expert.domains.some(skill=>skill.domain===domain));
const specialistScore=(company:CompanyV2,domain:KnowledgeDomain)=>specialistFor(company,domain)?.domains.find(skill=>skill.domain===domain)?.score||0;

const KnowledgePips:React.FC<{value:number;domain:KnowledgeDomain;compact?:boolean}>=({value,domain,compact=false})=><div className="flex gap-1" aria-label={`Knowledge ${value} of 5`}>{Array.from({length:5},(_,index)=><span key={index} title={`${index+1}`} className={`${compact?'h-2.5 w-2.5':'h-4 w-4'} rounded-full border shadow-inner ${index<value?'border-white/45':'border-slate-700 bg-slate-950'}`} style={index<value?{backgroundColor:DOMAIN_INFO[domain].color}:{}}/>)}</div>;

const Card:React.FC<{children:React.ReactNode;className?:string}>=({children,className=''})=><section className={`rounded-[20px] border-2 border-slate-700 bg-[#111827] shadow-[0_10px_26px_rgba(0,0,0,.30)] ${className}`}>{children}</section>;

function phaseTitle(company:CompanyV2){
 const state=company.kmWeek;
 if(!state)return'PREPARING';
 if(state.stage==='guided')return`GUIDED ${state.guidedTurn}/3`;
 if(state.stage==='free')return`ROUND ${state.freeRound}/3`;
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
 if(turn===1)return{title:'1. Solve the business problem',text:'Brisbane needs Operations 4. Priya has Operations 4. Select Priya below, then commit your response.',invest:'After the Challenge, you will deepen Priya’s expertise.'};
 if(turn===2)return{title:'2. Solve it again',text:'Another Operations problem has appeared in Brisbane. Use Priya again, then commit your response.',invest:'Afterwards you will use Local Training so Brisbane learns from her.'};
 return{title:'3. The problem moves',text:'A similar Operations issue has appeared in Perth. Use Priya, then commit your response.',invest:'Afterwards you will move Brisbane knowledge to Perth.'};
}

const ToolTip:React.FC<{text:string}>=({text})=><span className="group relative inline-flex"><Info className="h-3.5 w-3.5 cursor-help text-slate-500"/><span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[300] mt-2 hidden w-64 rounded-xl border border-slate-600 bg-slate-950 p-3 text-[11px] font-semibold normal-case leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">{text}</span></span>;

const ScoreCell:React.FC<{label:string;value:number;max:string;icon:React.ReactNode;tip:string}>=({label,value,max,icon,tip})=><div className="relative flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-300">{icon}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1 text-[10px] font-black text-slate-400">{label}<ToolTip text={tip}/></span><span className="text-lg font-black leading-none tabular-nums text-white">{value}<span className="ml-1 text-[9px] text-slate-600">/{max}</span></span></span></div>;

const PhaseStep:React.FC<{label:string;active:boolean;done:boolean;number:string}>=({label,active,done,number})=><div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] ${active?'border-amber-300 bg-amber-950/40 text-amber-100':done?'border-emerald-800 bg-emerald-950/25 text-emerald-300':'border-slate-800 bg-slate-950/60 text-slate-600'}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${active?'border-amber-300':done?'border-emerald-600':'border-slate-700'}`}>{done?<CheckCircle2 className="h-3 w-3"/>:number}</span>{label}</div>;

const ChallengeToken:React.FC<{challenge:KMWeekChallenge;company:CompanyV2;selected:boolean;onClick:()=>void}>=({challenge,company,selected,onClick})=>{
 const site=company.sites.find(item=>item.id===challenge.siteId);
 const local=site?.teamCapability[challenge.domain]||0;
 const done=challenge.status!=='open';
 return <button type="button" onClick={onClick} className={`min-w-0 rounded-xl border-2 p-2 text-left transition ${selected?'border-violet-300 bg-violet-950/35':done?(challenge.status==='success'?'border-emerald-800 bg-emerald-950/20':'border-rose-900 bg-rose-950/20'):'border-slate-700 bg-slate-950/70 hover:border-violet-600'}`}>
  <div className="flex items-center justify-between gap-2"><span className="truncate text-[9px] font-black uppercase tracking-[.12em] text-emerald-300">{site?.name} · {domainLabel(challenge.domain)}</span>{done&&<span className={`text-[9px] font-black ${challenge.status==='success'?'text-emerald-300':'text-rose-300'}`}>{challenge.status==='success'?'SOLVED':'MISSED'}</span>}</div>
  <div className="mt-1 truncate text-xs font-black text-white">{challenge.title}</div>
  <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-500"><span>Needs <b className="text-white">{challenge.difficulty}</b></span><span>Local <b className={local>=challenge.difficulty?'text-emerald-300':'text-amber-300'}>{local}</b></span></div>
 </button>;
};

const ResponseButton:React.FC<{selected:boolean;disabled?:boolean;children:React.ReactNode;onClick:()=>void}>=({selected,disabled,children,onClick})=><button type="button" disabled={disabled} onClick={onClick} className={`relative w-full rounded-xl border-2 px-3 py-2.5 text-left text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${selected?'border-amber-300 bg-amber-950/45 text-amber-100':'border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500'}`}>{children}<span className={`absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border-2 ${selected?'border-amber-300 bg-amber-400 text-slate-950':'border-slate-600 bg-slate-900'}`}>{selected?'✓':''}</span></button>;

export const KMWeekBoardV1:React.FC<Props>=({session,company,participant,readOnly,controllerName,onSessionUpdate,onToast,onLeave,onTransferCeo})=>{
 const state=company.kmWeek;
 const[busy,setBusy]=useState(false);
 const[selectedDomain,setSelectedDomain]=useState<KnowledgeDomain>('operations');
 const[selectedChallengeId,setSelectedChallengeId]=useState('');
 const[pendingResponse,setPendingResponse]=useState<PendingResponse>(null);
 const[challengeFocusOpen,setChallengeFocusOpen]=useState(false);
 const[firstInvestBriefDismissed,setFirstInvestBriefDismissed]=useState(false);
 const[investment,setInvestment]=useState<KMWeekInvestment>('TRAIN_EXPERT');
 const[expertId,setExpertId]=useState('');
 const[sourceSiteId,setSourceSiteId]=useState('brisbane');
 const[targetSiteId,setTargetSiteId]=useState('perth');
 const[now,setNow]=useState(Date.now());

 const members=session.participants.filter(item=>item.role!=='facilitator'&&item.companyId===company.id);
 const goal=KM_WEEK_GOALS[session.kmWeekGoalId||'local-heroes'];
 const sites=KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)).filter((site):site is CompanyV2['sites'][number]=>Boolean(site));
 const experts=company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain)));
 const specialist=expertId?experts.find(item=>item.id===expertId):specialistFor(company,selectedDomain);
 const specialistDomain=specialist?.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
 const localTrainingSite=specialist?company.sites.find(site=>site.id===specialist.location&&!site.isClosed):undefined;
 const standings=useMemo(()=>session.companies.map(item=>({id:item.id,name:item.name,score:item.kmWeek?.score.total||0,complete:item.kmWeek?.stage==='complete'})).sort((a,b)=>b.score-a.score),[session.companies,session.updatedAt]);

 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);

 useEffect(()=>{
  if(!state)return;
  const open=state.challenges.find(challenge=>challenge.status==='open');
  const selected=state.challenges.find(challenge=>challenge.id===selectedChallengeId&&challenge.status==='open');
  if(!selected)setSelectedChallengeId(open?.id||state.challenges[0]?.id||'');
  if(!open||pendingResponse&&!state.challenges.some(challenge=>challenge.id===pendingResponse.challengeId&&challenge.status==='open'))setPendingResponse(null);
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,state?.challenges.map(challenge=>`${challenge.id}:${challenge.status}`).join('|')]);

 useEffect(()=>{
  const challengePhase=state?.phase==='challenge'&&(state?.stage==='guided'||state?.stage==='free');
  setChallengeFocusOpen(!challengePhase);
  setPendingResponse(null);
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);

 useEffect(()=>{
  if(state?.stage==='guided'&&state.phase==='invest'&&state.guidedTurn===1)setFirstInvestBriefDismissed(false);
 },[state?.stage,state?.phase,state?.guidedTurn]);

 useEffect(()=>{
  if(!state)return;
  if(state.stage==='guided'&&state.phase==='invest'){
    if(state.guidedTurn===1){setInvestment('TRAIN_EXPERT');setSelectedDomain('operations');setExpertId(specialistFor(company,'operations')?.id||'');}
    else if(state.guidedTurn===2){setInvestment('LOCAL_TRAINING');setSelectedDomain('operations');setExpertId(specialistFor(company,'operations')?.id||'');}
    else{setInvestment('KNOWLEDGE_TRANSFER');setSelectedDomain('operations');setSourceSiteId('brisbane');setTargetSiteId('perth');}
  }else if(state.stage==='free'&&state.phase==='invest'){
    setInvestment('TRAIN_EXPERT');
    const first=experts[0];setExpertId(first?.id||'');setSelectedDomain(first?.domains[0]?.domain||'operations');
  }
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,company.id]);

 if(!state)return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Preparing KM Week board…</div>;

 const remaining=session.timerEndsAt?Math.max(0,Math.ceil((new Date(session.timerEndsAt).getTime()-now)/1000)):session.timerPausedSecondsRemaining??1800;
 const mm=Math.floor(remaining/60),ss=String(remaining%60).padStart(2,'0');
 const guided=state.stage==='guided';
 const guidedCopy=currentGuidedCopy(company);
 const activeChallenge=state.challenges.find(challenge=>challenge.id===selectedChallengeId)||state.challenges.find(challenge=>challenge.status==='open')||state.challenges[0];
 const localSite=activeChallenge?company.sites.find(item=>item.id===activeChallenge.siteId):undefined;
 const localScore=activeChallenge&&localSite?localSite.teamCapability[activeChallenge.domain]||0:0;
 const activeExpert=activeChallenge?specialistFor(company,activeChallenge.domain):undefined;
 const activeExpertScore=activeChallenge&&activeExpert?activeExpert.domains.find(skill=>skill.domain===activeChallenge.domain)?.score||0:0;
 const expertUsed=Boolean(activeExpert&&state.usedExpertIds.includes(activeExpert.id));

 const post=async(payload:any,beforeApply?:()=>Promise<void>)=>{
  if(readOnly){onToast(`Read only · ${controllerName||'Your CEO'} controls this company.`);return false}
  if(busy)return false;
  setBusy(true);
  try{
   const response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,participantId:participant?.id,actionType:payload.type,params:payload})});
   const data=await response.json();
   if(!response.ok||data?.success===false){onToast(data?.message||data?.error||'That move is not available.');return false}
   if(data.session){if(beforeApply)await beforeApply();onSessionUpdate(data.session);}
   if(data.message)onToast(data.message,4500);
   return true;
  }catch{onToast('Could not complete that move.');return false}
  finally{setBusy(false)}
 };

 const animateKnowledgeSpark=async(startX:number,startY:number,targetKey:string)=>{
  const target=document.querySelector(`[data-river-target="${targetKey}"]`) as SVGGraphicsElement|null;
  if(!target)return;
  const rect=target.getBoundingClientRect();
  const endX=rect.left+rect.width/2,endY=rect.top+rect.height/2;
  const dx=endX-startX,dy=endY-startY;
  const swing=Math.min(120,Math.max(55,Math.abs(dx)*0.16));
  const spark=document.createElement('div');
  spark.className='kmw-knowledge-spark';
  spark.style.left=`${startX-9}px`;
  spark.style.top=`${startY-9}px`;
  document.body.appendChild(spark);
  const animation=spark.animate([
   {transform:'translate(0px,0px) scale(.8)',opacity:0},
   {transform:`translate(${dx*.12}px,${dy*.15}px) scale(1.15)`,opacity:1,offset:.14},
   {transform:`translate(${dx*.38+swing}px,${dy*.34}px) scale(1)`,opacity:1,offset:.42},
   {transform:`translate(${dx*.70-swing*.55}px,${dy*.72}px) scale(.95)`,opacity:1,offset:.72},
   {transform:`translate(${dx}px,${dy}px) scale(.45)`,opacity:0}
  ],{duration:850,easing:'cubic-bezier(.35,.02,.25,1)',fill:'forwards'});
  try{await animation.finished}catch{}
  spark.remove();
  await new Promise(resolve=>setTimeout(resolve,70));
 };

 const commitResponse=async()=>{
  if(!pendingResponse)return;
  const ok=await post({type:'KM_WEEK_RESOLVE',challengeId:pendingResponse.challengeId,method:pendingResponse.method,expertId:pendingResponse.expertId});
  if(ok)setPendingResponse(null);
 };

 const guidedTargetInvestment:KMWeekInvestment|undefined=guided?(state.guidedTurn===1?'TRAIN_EXPERT':state.guidedTurn===2?'LOCAL_TRAINING':'KNOWLEDGE_TRANSFER'):undefined;
 const source=company.sites.find(site=>site.id===sourceSiteId);
 const target=company.sites.find(site=>site.id===targetSiteId);
 const investmentPreview=investment==='TRAIN_EXPERT'
   ?specialist?`${specialist.name}: ${specialistScore(company,specialistDomain)} → ${Math.min(5,specialistScore(company,specialistDomain)+1)}`:'Choose a company expert'
   :investment==='LOCAL_TRAINING'
    ?specialist&&localTrainingSite?`${localTrainingSite.name} ${domainLabel(specialistDomain)}: ${localTrainingSite.teamCapability[specialistDomain]||0} → ${Math.min(5,(localTrainingSite.teamCapability[specialistDomain]||0)+1)}`:'Choose a company expert'
    :source&&target?`${source.name} ${domainLabel(selectedDomain)} ${source.teamCapability[selectedDomain]||0} → ${target.name} ${target.teamCapability[selectedDomain]||0}`:'Choose two sites';

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
  await post(payload,()=>animateKnowledgeSpark(startX,startY,targetKey));
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
    <div className="flex h-12 min-w-[92px] flex-col justify-center rounded-xl border-2 border-violet-800 bg-violet-950/25 px-3"><div className="text-[8px] font-black uppercase text-violet-400">Game time</div><div className="text-base font-black leading-none tabular-nums text-violet-100">{mm}:{ss}</div></div>
    {!readOnly&&members.length>1&&onTransferCeo&&<select defaultValue="" onChange={event=>{const id=event.target.value;event.currentTarget.value='';if(id)onTransferCeo(id)}} className="h-12 rounded-xl border-2 border-amber-800 bg-slate-950 px-2 text-[10px] font-black text-amber-100"><option value="">Pass CEO…</option>{members.filter(member=>member.id!==participant?.id).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>}
    <button onClick={onLeave} className="h-12 min-w-[92px] rounded-xl border-2 border-rose-800 bg-rose-950/30 px-3 text-xs font-black text-rose-200 hover:border-rose-500"><LogOut className="mr-1 inline h-4 w-4"/>Leave</button>
   </div>
  </header>

  {challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')&&<div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 top-[66px] z-40 bg-black/20"/>}

  <main className="mx-auto max-w-[1500px] p-3 xl:flex xl:h-[calc(100vh-66px)] xl:flex-col xl:overflow-hidden">
   <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
    <div className="rounded-xl border-2 border-indigo-700 bg-indigo-950/45 px-3 py-1.5 text-[10px] font-black text-indigo-100">{phaseTitle(company)}</div>
    <PhaseStep number="1" label="Challenge" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'} done={challengeStepDone}/>
    <PhaseStep number="2" label="Invest" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'} done={investStepDone}/>
    <PhaseStep number="3" label="Business Shock" active={state.stage==='shock'} done={shockDone}/>
    <PhaseStep number="4" label="Score" active={state.stage==='complete'} done={false}/>
    <div className="ml-auto rounded-xl border border-amber-800 bg-amber-950/20 px-3 py-1.5 text-xs font-black text-amber-100"><span className="mr-2 text-[9px] uppercase text-amber-500">Current phase</span>{currentPhaseLabel(company)}</div>
   </div>

   <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_410px]">
    <div className="space-y-3 xl:flex xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-3">
     <Card className="p-3 xl:min-h-0 xl:flex-1">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Knowledge River</div><h2 className="text-lg font-black text-white">Where is the capability now?</h2></div><div className="flex gap-1">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className={`rounded-full border-2 px-2.5 py-1 text-[9px] font-black ${selectedDomain===domain?'border-amber-300 bg-amber-950/40 text-amber-100':'border-slate-700 bg-slate-950 text-slate-400'}`}>{domainLabel(domain)}</button>)}</div></div>
      <div className="h-[360px] xl:h-[calc(100%-42px)] xl:min-h-[285px]"><InvestmentRiverView company={company} mode="km_week" selectedDomain={selectedDomain} highlightDomain/></div>
     </Card>

     <div className="grid shrink-0 gap-2 md:grid-cols-3">
      {sites.map((site,index)=><Card key={site.id} className={`relative overflow-hidden p-3 ${index===0?'rotate-[-.2deg]':index===2?'rotate-[.2deg]':''}`}>
       <div className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[8px] font-black text-slate-500">{SITE_ABBR[site.id]}</div>
       <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-300"/><h3 className="text-sm font-black text-white">{site.name}</h3></div>
       <div className="mt-2 space-y-1.5">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-left"><span className="w-16 truncate text-[9px] font-black text-slate-400">{domainLabel(domain)}</span><KnowledgePips value={site.teamCapability[domain]||0} domain={domain} compact/><b className="ml-auto text-xs text-white">{site.teamCapability[domain]||0}</b></button>)}</div>
       <div className="mt-2 border-t border-slate-800 pt-1.5 text-[9px] font-bold text-slate-500">Expert here: <span className="text-amber-200">{experts.filter(expert=>expert.location===site.id).map(expert=>expert.name.split(' ')[0]).join(', ')||'—'}</span></div>
      </Card>)}
     </div>
    </div>

    <aside className="space-y-2 xl:flex xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-2">
     {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&!challengeFocusOpen?<div className="flex min-h-[360px] shrink-0 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-violet-500/70 bg-violet-950/10 p-5 xl:min-h-0 xl:flex-1">
      {state.stage==='guided'&&state.guidedTurn===1&&<div className="mb-4 max-w-[350px] rounded-2xl border border-amber-700/70 bg-amber-950/20 p-3 text-left shadow-lg"><div className="text-[9px] font-black uppercase tracking-[.16em] text-amber-300">CEO briefing · Before Challenge</div><p className="mt-2 text-[11px] leading-relaxed text-slate-200">Welcome! You are the new CEO of <b className="text-white">{company.name}</b>. It’s a business with promise but also some challenges to overcome. There are islands of excellence and a few experts you can rely on to meet the challenges, but your role is to build up knowledge so every site performs well. Business goes on while you make improvements, so you will have to use the expertise you have to solve daily events. In fact, here comes one right now. <b className="text-amber-200">Click the card below to see what it is.</b></p></div>}
      <button type="button" onClick={()=>setChallengeFocusOpen(true)} className="group kmw-start-card relative flex h-[230px] w-[168px] flex-col items-center justify-center overflow-hidden rounded-[18px] border-[3px] border-violet-300 bg-[linear-gradient(145deg,#28184d,#111827)] px-5 text-center shadow-[0_18px_35px_rgba(0,0,0,.42)] transition hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(124,58,237,.25)] focus:outline-none focus:ring-4 focus:ring-violet-400/40" aria-label="Open the next Challenge">
       <div className="absolute inset-2 rounded-[13px] border border-violet-400/35"/>
       <div className="text-[9px] font-black uppercase tracking-[.24em] text-violet-300">The Performance Gap</div>
       <div className="mt-5 text-2xl font-black tracking-[.08em] text-white">CHALLENGE</div>
       <div className="mt-5 rounded-full border-2 border-amber-300 bg-amber-950/45 px-4 py-2 text-xs font-black text-amber-100">CLICK HERE TO START</div>
       <div className="mt-3 text-[9px] font-bold text-slate-500">{phaseTitle(company)}</div>
      </button>
     </div>:<div className={`${challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')?'relative z-[60] kmw-card-reveal':''}`}>
     <Card className={`border-violet-700 bg-[linear-gradient(145deg,#1b1731,#101827)] p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto ${challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')?'ring-4 ring-violet-400/20 shadow-[0_20px_60px_rgba(0,0,0,.55)]':''}`}>
      <div className="flex items-center justify-between gap-2"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">Your move</div><h2 className="text-xl font-black text-white">{currentPhaseLabel(company)}</h2></div><div className="rounded-lg border border-violet-700 bg-violet-950/30 px-2 py-1 text-[9px] font-black uppercase text-violet-200">{phaseTitle(company)}</div></div>

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&<>
       <div className="mt-2 rounded-xl border-2 border-amber-700 bg-amber-950/20 p-2.5">
        {guided?<><div className="text-[9px] font-black uppercase tracking-[.14em] text-amber-300">What to do now</div><div className="mt-1 text-sm font-black text-white">{guidedCopy.title}</div><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{guidedCopy.text}</p></>:<><div className="text-[9px] font-black uppercase tracking-[.14em] text-amber-300">Challenge phase</div><p className="mt-1 text-[11px] leading-relaxed text-slate-300">Resolve both Challenges. Select a Challenge, choose how you will respond, then press <b className="text-white">COMMIT RESPONSE</b>.</p></>}
       </div>

       <div className={`mt-2 grid gap-2 ${state.challenges.length>1?'grid-cols-2':'grid-cols-1'}`}>{state.challenges.map(challenge=><ChallengeToken key={challenge.id} challenge={challenge} company={company} selected={challenge.id===activeChallenge?.id} onClick={()=>{setSelectedChallengeId(challenge.id);setPendingResponse(null)}}/>)}</div>

       {activeChallenge&&activeChallenge.status==='open'&&<div className="mt-2 rounded-xl border border-slate-700 bg-black/20 p-2.5">
        <div className="flex items-start justify-between gap-2"><div><div className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">{siteName(company,activeChallenge.siteId)} · {domainLabel(activeChallenge.domain)}</div><div className="mt-0.5 text-sm font-black text-white">{activeChallenge.title}</div></div><div className="text-right text-[9px] font-bold text-slate-500">Needs <b className="text-base text-white">{activeChallenge.difficulty}</b><br/>Local <b className={`text-base ${localScore>=activeChallenge.difficulty?'text-emerald-300':'text-amber-300'}`}>{localScore}</b></div></div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{activeChallenge.story}</p>
        <div className="mt-2 space-y-1.5">
         {!guided&&<ResponseButton selected={pendingResponse?.challengeId===activeChallenge.id&&pendingResponse.method==='local'} disabled={localScore<activeChallenge.difficulty} onClick={()=>setPendingResponse({challengeId:activeChallenge.id,method:'local',label:`Use ${siteName(company,activeChallenge.siteId)} local team`})}>USE LOCAL TEAM <span className="ml-1 text-slate-500">Knowledge {localScore}</span></ResponseButton>}
         {activeExpert&&<ResponseButton selected={pendingResponse?.challengeId===activeChallenge.id&&pendingResponse.method==='expert'} disabled={activeExpertScore<activeChallenge.difficulty||expertUsed} onClick={()=>setPendingResponse({challengeId:activeChallenge.id,method:'expert',expertId:activeExpert.id,label:`Send ${activeExpert.name}`})}>SEND {activeExpert.name.toUpperCase()} <span className="ml-1 text-slate-500">Knowledge {activeExpertScore}{expertUsed?' · already used':''}</span></ResponseButton>}
         {!guided&&<ResponseButton selected={pendingResponse?.challengeId===activeChallenge.id&&pendingResponse.method==='risk'} onClick={()=>setPendingResponse({challengeId:activeChallenge.id,method:'risk',label:'Take the risk'})}><Dices className="mr-1 inline h-4 w-4"/>TAKE THE RISK <span className="ml-1 text-slate-500">Roll d6</span></ResponseButton>}
        </div>
        <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[10px] text-slate-500">{pendingResponse?.challengeId===activeChallenge.id?<><span className="font-black text-amber-300">Selected:</span> {pendingResponse.label}</>:<>Select a response above. Nothing happens until you commit.</>}</div>
        <button type="button" onClick={()=>void commitResponse()} disabled={!pendingResponse||pendingResponse.challengeId!==activeChallenge.id||busy||readOnly} className="mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-600">{busy?'COMMITTING…':'COMMIT RESPONSE'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>}

       {challengeDone&&<div className="mt-3 rounded-xl border-2 border-emerald-700 bg-emerald-950/25 p-3 text-xs font-black text-emerald-200">Challenges complete. Moving to Invest…</div>}
      </>}

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'&&<>
       {state.stage==='guided'&&state.guidedTurn===1&&!firstInvestBriefDismissed?<div className="mt-3 rounded-2xl border-2 border-amber-600 bg-[linear-gradient(145deg,#2a1a0d,#141522)] p-4 shadow-xl"><div className="text-[9px] font-black uppercase tracking-[.16em] text-amber-300">CEO briefing · Before Invest</div><p className="mt-2 text-[11px] leading-relaxed text-slate-200">OK, you managed to deal with today’s emergencies. Now it’s time to start building our company capability. Over time we want to avoid relying on individual experts, but right now it looks like they are a big part of the solution. Follow the instructions here to start us on the track to recovery.</p><button type="button" onClick={()=>setFirstInvestBriefDismissed(true)} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">CONTINUE TO INVEST <ArrowRight className="ml-1 inline h-4 w-4"/></button></div>:<>
       <div className="mt-2 rounded-xl border-2 border-amber-700 bg-amber-950/20 p-2.5"><div className="text-[9px] font-black uppercase tracking-[.14em] text-amber-300">What to do now</div><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{guided?<><span>{guidedCopy.invest}</span><br/><span className="font-black text-amber-200">Guided move: choose {guidedTargetInvestment==='TRAIN_EXPERT'?'Train Expert':guidedTargetInvestment==='LOCAL_TRAINING'?'Local Training':'Knowledge Transfer'}.</span></>:'Choose exactly one investment. Check the preview, then press COMMIT INVESTMENT. The next round starts immediately.'}</p></div>
       <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button disabled={guided&&guidedTargetInvestment!=='TRAIN_EXPERT'} onClick={()=>setInvestment('TRAIN_EXPERT')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='TRAIN_EXPERT'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='TRAIN_EXPERT'?'border-amber-300 bg-amber-950/40':'border-slate-700 bg-slate-950'}`}><GraduationCap className="h-4 w-4 text-amber-300"/><div className="mt-1 text-[10px] font-black text-white">Train Expert</div><div className="text-[9px] text-slate-500">+$1 depth · $15k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='LOCAL_TRAINING'} onClick={()=>setInvestment('LOCAL_TRAINING')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='LOCAL_TRAINING'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='LOCAL_TRAINING'?'border-sky-300 bg-sky-950/40':'border-slate-700 bg-slate-950'}`}><Users className="h-4 w-4 text-sky-300"/><div className="mt-1 text-[10px] font-black text-white">Local Training</div><div className="text-[9px] text-slate-500">+$1 local · $10k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'} onClick={()=>setInvestment('KNOWLEDGE_TRANSFER')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='KNOWLEDGE_TRANSFER'?'border-emerald-300 bg-emerald-950/40':'border-slate-700 bg-slate-950'}`}><Workflow className="h-4 w-4 text-emerald-300"/><div className="mt-1 text-[10px] font-black text-white">Knowledge Transfer</div><div className="text-[9px] text-slate-500">Move know-how · $8k</div></button>
       </div>
       <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/75 p-2.5">
        {investment!=='KNOWLEDGE_TRANSFER'?<div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black uppercase text-slate-500">Company expert<select value={specialist?.id||''} onChange={event=>{const next=experts.find(item=>item.id===event.target.value);setExpertId(event.target.value);if(next)setSelectedDomain(next.domains[0].domain)}} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{experts.map(expert=><option key={expert.id} value={expert.id}>{expert.name} · {domainLabel(expert.domains[0].domain)} {expert.domains[0].score}</option>)}</select></label><div><div className="text-[9px] font-black uppercase text-slate-500">{investment==='LOCAL_TRAINING'?'Current site':'Knowledge domain'}</div><div className="mt-1 rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs font-black text-white">{investment==='LOCAL_TRAINING'?localTrainingSite?.name||'—':domainLabel(specialistDomain)}</div></div></div>:<div className="grid grid-cols-3 gap-2"><label className="text-[9px] font-black uppercase text-slate-500">Domain<select value={selectedDomain} onChange={event=>setSelectedDomain(event.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{KM_WEEK_DOMAINS.map(domain=><option key={domain} value={domain}>{domainLabel(domain)}</option>)}</select></label><label className="text-[9px] font-black uppercase text-slate-500">From<select value={sourceSiteId} onChange={event=>setSourceSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label><label className="text-[9px] font-black uppercase text-slate-500">To<select value={targetSiteId} onChange={event=>setTargetSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label></div>}
        <div className="mt-2 rounded-lg border border-amber-800 bg-amber-950/15 px-2 py-1.5 text-[10px]"><span className="font-black text-amber-300">Preview:</span> <span className="text-slate-200">{investmentPreview}</span></div>
        <button onClick={event=>void invest(event)} disabled={busy||readOnly} className="mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:bg-slate-800 disabled:text-slate-600">{busy?'COMMITTING…':guided?'COMMIT GUIDED INVESTMENT':'COMMIT INVESTMENT & START NEXT ROUND'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>
       </>}
      </>}

      {state.stage==='shock'&&<div className="mt-3 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-4 border-rose-300 bg-rose-950"><ShieldCheck className="h-7 w-7 text-rose-200"/></div><div className="mt-2 text-[9px] font-black uppercase tracking-[.20em] text-rose-300">Business Shock</div><h3 className="mt-1 text-xl font-black text-white">Your company experts are unavailable.</h3><p className="mt-2 text-xs leading-relaxed text-slate-300">Five issues hit at once. There are no interventions now. This checks the local capability you actually built.</p><button onClick={()=>void post({type:'KM_WEEK_RESOLVE_SHOCK'})} disabled={busy||readOnly} className="mt-4 h-11 w-full rounded-xl border-2 border-white bg-white text-sm font-black text-rose-950 disabled:opacity-40">{busy?'CHECKING…':'COMMIT BUSINESS SHOCK'}</button></div>}

      {state.stage==='complete'&&<div className="mt-3 text-center"><Sparkles className="mx-auto h-10 w-10 text-emerald-300"/><h3 className="mt-2 text-2xl font-black text-white">{state.score.total} points</h3><p className="mt-1 text-xs text-slate-400">The score is useful. The shape of your River is the real result.</p><div className="mt-2 flex justify-center gap-2 text-[10px] font-black uppercase tracking-[.12em]"><span className="rounded-full border border-amber-700 bg-amber-950/30 px-2 py-1 text-amber-200">Depth</span><span className="rounded-full border border-sky-700 bg-sky-950/30 px-2 py-1 text-sky-200">Breadth</span><span className="rounded-full border border-emerald-700 bg-emerald-950/30 px-2 py-1 text-emerald-200">Flow</span></div><div className="mt-3 grid grid-cols-5 gap-1">{state.shockChecks.map(check=><div key={check.id} className={`rounded-lg border p-2 ${check.passed?'border-emerald-700 bg-emerald-950/25':'border-rose-800 bg-rose-950/25'}`}><div className="text-[8px] font-black text-slate-500">{SITE_ABBR[check.siteId]}</div><div className={`text-[9px] font-black ${check.passed?'text-emerald-300':'text-rose-300'}`}>{check.passed?'READY':'GAP'}</div></div>)}</div><div className="mt-3 rounded-xl border border-violet-700 bg-violet-950/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">The strategy you just played</div><div className="mt-2 text-[11px] font-black text-white">Expert Education → Experts → Local Training → Site Users → Knowledge Transfer</div><p className="mt-2 text-[10px] text-slate-500">Newbie mode opens the rest of the knowledge system.</p></div></div>}
     </Card>
     </div>}

     <Card className="shrink-0 p-2.5">
      <div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-300"/><h2 className="text-sm font-black text-white">Score pad</h2><span className="ml-auto rounded-lg border border-amber-700 bg-amber-950/30 px-2 py-0.5 text-sm font-black text-amber-200">{state.score.total}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
       <ScoreCell label="Business Performance" value={state.score.business} max="12" icon={<CircleDollarSign className="h-3.5 w-3.5"/>} tip="2 points for each successful free-play Challenge. Improve this by solving business problems successfully."/>
       <ScoreCell label="Expertise" value={state.score.expertise} max="6" icon={<Brain className="h-3.5 w-3.5"/>} tip="Rewards deep expert capability. Each expert scores 1 point per knowledge level above 3. Use Train Expert to improve it."/>
       <ScoreCell label="Local capability" value={state.score.localCapability} max="9" icon={<Users className="h-3.5 w-3.5"/>} tip="1 point for every site/domain combination that reaches Knowledge 2 or higher. Improve it with Local Training and Knowledge Transfer."/>
       <ScoreCell label="Knowledge Flow" value={state.score.knowledgeFlow} max="6" icon={<Workflow className="h-3.5 w-3.5"/>} tip="Rewards useful knowledge movement. Transfers score, with an extra point when a transfer lifts a site across the useful Knowledge 2 threshold."/>
       <ScoreCell label="Resilience" value={state.score.resilience} max="5" icon={<ShieldCheck className="h-3.5 w-3.5"/>} tip="Scored in the final Business Shock: 1 point for each test your sites can handle without company experts."/>
       <ScoreCell label="KM Week goal" value={state.score.goal} max="5" icon={<Target className="h-3.5 w-3.5"/>} tip={`Complete the shared goal “${goal.title}” for 5 points. ${goal.description}`}/>
      </div>
     </Card>

     <div className="grid shrink-0 grid-cols-2 gap-2">
      <Card className="rotate-[.2deg] border-amber-700 bg-[linear-gradient(150deg,#34220d,#17130d)] p-2.5">
       <div className="flex items-center gap-1.5"><Target className="h-4 w-4 text-amber-300"/><div className="text-[8px] font-black uppercase tracking-[.14em] text-amber-300">Goal · 5 pts</div></div><h3 className="mt-1 text-sm font-black text-white">{goal.title}</h3><p className="mt-1 text-[9px] leading-snug text-amber-100/70">{goal.description}</p><div className={`mt-1.5 text-[9px] font-black ${state.score.goal?'text-emerald-300':'text-amber-300'}`}>{state.score.goal?'ACHIEVED · +5':'IN PLAY'}</div>
      </Card>
      <Card className="p-2.5">
       <div className="flex items-center gap-1.5"><Brain className="h-4 w-4 text-sky-300"/><div className="text-[8px] font-black uppercase tracking-[.14em] text-sky-300">Company experts</div><ToolTip text="Experts hold deep knowledge. Sending an expert can solve a Challenge, but it does not automatically increase the local team’s knowledge. That only happens through an investment such as Local Training."/></div>
       <div className="mt-1.5 space-y-1">{experts.map(expert=>{const skill=expert.domains[0];return <button key={expert.id} onClick={()=>{setExpertId(expert.id);setSelectedDomain(skill.domain)}} className="flex w-full items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-1.5 py-1 text-left"><span className="grid h-6 w-6 place-items-center rounded-full border-2 border-amber-300 bg-amber-950 text-[9px] font-black text-amber-100">{expert.name[0]}</span><span className="min-w-0 flex-1 truncate text-[9px] font-black text-white">{expert.name.split(' ')[0]} <span className="font-bold text-slate-600">· {SITE_ABBR[expert.location]||expert.location}</span></span><b className="text-xs text-amber-200">{skill.score}</b></button>})}</div>
      </Card>
     </div>

     {standings.length>1&&<Card className="shrink-0 p-2.5"><div className="text-[8px] font-black uppercase tracking-[.14em] text-violet-300">Workshop standings</div><div className="mt-1 grid grid-cols-2 gap-1">{standings.map((entry,index)=><div key={entry.id} className={`flex items-center rounded-lg border px-2 py-1 text-[9px] ${entry.id===company.id?'border-violet-500 bg-violet-950/25':'border-slate-800 bg-slate-950'}`}><span className="w-4 font-black text-slate-500">{index+1}</span><span className="min-w-0 flex-1 truncate font-bold text-slate-300">{entry.name}</span><b className="text-white">{entry.score}</b></div>)}</div></Card>}
    </aside>
   </div>
  </main>
 </div>;
};
