import React,{useEffect,useMemo,useState}from'react';
import{ArrowRight,Brain,Building2,CircleDollarSign,Crown,Dices,GraduationCap,LogOut,MapPin,Medal,RefreshCw,ShieldCheck,Sparkles,Target,Users,Workflow}from'lucide-react';
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

const SITE_ABBR:Record<string,string>={melbourne:'MEL',brisbane:'BNE',perth:'PER'};
const money=(value:number)=>formatCurrency(value);
const domainLabel=(domain:KnowledgeDomain)=>DOMAIN_INFO[domain].label;
const siteName=(company:CompanyV2,id:string)=>company.sites.find(site=>site.id===id)?.name||id;
const specialistFor=(company:CompanyV2,domain:KnowledgeDomain)=>company.experts.find(expert=>!expert.isVacant&&expert.domains.some(skill=>skill.domain===domain));
const specialistScore=(company:CompanyV2,domain:KnowledgeDomain)=>specialistFor(company,domain)?.domains.find(skill=>skill.domain===domain)?.score||0;

const KnowledgePips:React.FC<{value:number;domain:KnowledgeDomain;compact?:boolean}>=({value,domain,compact=false})=><div className="flex gap-1" aria-label={`Knowledge ${value} of 5`}>{Array.from({length:5},(_,index)=><span key={index} title={`${index+1}`} className={`${compact?'h-3 w-3':'h-4 w-4'} rounded-full border shadow-inner ${index<value?'border-white/45':'border-slate-700 bg-slate-950'}`} style={index<value?{backgroundColor:DOMAIN_INFO[domain].color}:{}}/>)}</div>;

function phaseTitle(company:CompanyV2){
 const state=company.kmWeek;
 if(!state)return'Preparing board';
 if(state.stage==='guided')return`Guided game · Move ${state.guidedTurn}/3`;
 if(state.stage==='free')return`Free play · Round ${state.freeRound}/3`;
 if(state.stage==='shock')return'Business Shock';
 return'Game complete';
}

function currentGuidedCopy(company:CompanyV2){
 const turn=company.kmWeek?.guidedTurn||1;
 if(turn===1)return{title:'Send the specialist',text:'Brisbane needs Operations 4. Priya has Operations 4. Send Priya to Brisbane to handle the Challenge.',invest:'Then train Priya to deepen the expertise.'};
 if(turn===2)return{title:'Build local capability',text:'Use Priya again to contain the Brisbane problem.',invest:'Then use Local Training so the Brisbane team learns from her.'};
 return{title:'Move the knowledge',text:'The same kind of problem has appeared in Perth. Use Priya to handle it.',invest:'Then transfer Brisbane Operations knowledge to Perth.'};
}

const Card:React.FC<{children:React.ReactNode,className?:string}>=({children,className=''})=><section className={`rounded-[22px] border-2 border-slate-700 bg-[#111827] shadow-[0_12px_30px_rgba(0,0,0,.32)] ${className}`}>{children}</section>;

const ScoreRow:React.FC<{label:string;value:number;max?:string;icon:React.ReactNode}>=({label,value,max,icon})=><div className="flex items-center gap-2 border-b border-slate-800 py-2 last:border-b-0"><span className="grid h-7 w-7 place-items-center rounded-full border border-slate-700 bg-slate-950 text-slate-300">{icon}</span><span className="min-w-0 flex-1 text-xs font-black text-slate-300">{label}</span><span className="text-lg font-black tabular-nums text-white">{value}</span>{max&&<span className="text-[10px] font-bold text-slate-600">/{max}</span>}</div>;

const ChallengeCard:React.FC<{
 challenge:KMWeekChallenge;company:CompanyV2;guided:boolean;usedExpertIds:string[];busy:boolean;readOnly:boolean;
 onResolve:(challenge:KMWeekChallenge,method:'local'|'expert'|'risk',expertId?:string)=>void;
}>=({challenge,company,guided,usedExpertIds,busy,readOnly,onResolve})=>{
 const site=company.sites.find(item=>item.id===challenge.siteId);
 const local=site?.teamCapability[challenge.domain]||0;
 const expert=specialistFor(company,challenge.domain);
 const expertScore=expert?.domains.find(skill=>skill.domain===challenge.domain)?.score||0;
 const expertUsed=Boolean(expert&&usedExpertIds.includes(expert.id));
 const done=challenge.status!=='open';
 return <div className={`relative overflow-hidden rounded-[18px] border-[3px] p-4 shadow-[0_8px_20px_rgba(0,0,0,.35)] ${done?(challenge.status==='success'?'border-emerald-500 bg-emerald-950/30':'border-rose-500 bg-rose-950/30'):'border-violet-300 bg-[linear-gradient(145deg,#21153b,#0d1321)]'}`}>
   <div className="absolute right-3 top-3 rounded-md border border-white/15 bg-black/25 px-2 py-1 text-[9px] font-black uppercase tracking-[.18em] text-violet-100">Challenge</div>
   <div className="pr-20 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">{site?.name} · {domainLabel(challenge.domain)}</div>
   <h3 className="mt-1 text-xl font-black leading-tight text-white">{challenge.title}</h3>
   <p className="mt-2 min-h-[38px] text-xs leading-relaxed text-slate-300">{challenge.story}</p>
   <div className="mt-3 grid grid-cols-2 gap-2">
    <div className="rounded-xl border border-slate-700 bg-black/25 p-2"><div className="text-[9px] font-black uppercase text-slate-500">Needs</div><div className="mt-1 flex items-center justify-between"><KnowledgePips value={challenge.difficulty} domain={challenge.domain} compact/><b className="text-lg text-white">{challenge.difficulty}</b></div></div>
    <div className="rounded-xl border border-slate-700 bg-black/25 p-2"><div className="text-[9px] font-black uppercase text-slate-500">Local team</div><div className="mt-1 flex items-center justify-between"><KnowledgePips value={local} domain={challenge.domain} compact/><b className={`text-lg ${local>=challenge.difficulty?'text-emerald-300':'text-amber-300'}`}>{local}</b></div></div>
   </div>
   {!done&&<div className="mt-3 space-y-2">
    {!guided&&local>=challenge.difficulty&&<button disabled={busy||readOnly} onClick={()=>onResolve(challenge,'local')} className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-950/50 px-3 py-2.5 text-left text-xs font-black text-emerald-100 disabled:opacity-40">USE LOCAL TEAM <span className="float-right">Knowledge {local}</span></button>}
    {expert&&expertScore>=challenge.difficulty&&!expertUsed&&<button disabled={busy||readOnly} onClick={()=>onResolve(challenge,'expert',expert.id)} className="w-full rounded-xl border-2 border-amber-400 bg-amber-950/45 px-3 py-2.5 text-left text-xs font-black text-amber-100 disabled:opacity-40">SEND {expert.name.toUpperCase()} <span className="float-right">Knowledge {expertScore}</span></button>}
    {!guided&&<button disabled={busy||readOnly} onClick={()=>onResolve(challenge,'risk')} className="w-full rounded-xl border-2 border-slate-600 bg-slate-950 px-3 py-2.5 text-left text-xs font-black text-slate-200 disabled:opacity-40"><Dices className="mr-1 inline h-4 w-4"/> TAKE THE RISK <span className="float-right">Roll d6</span></button>}
    {expertUsed&&<div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-[10px] font-bold text-slate-500">{expert?.name} has already handled a Challenge this round.</div>}
   </div>}
   {done&&<div className={`mt-3 rounded-xl px-3 py-2 text-xs font-black ${challenge.status==='success'?'bg-emerald-500/15 text-emerald-200':'bg-rose-500/15 text-rose-200'}`}>{challenge.status==='success'?'SOLVED':'MISSED'} · {challenge.resolution==='expert'?'Expert':challenge.resolution==='local'?'Local team':`Risk roll ${challenge.dieRoll}`} · {challenge.turnoverChange&&challenge.turnoverChange>0?'+':''}{money(challenge.turnoverChange||0)}</div>}
  </div>;
};

export const KMWeekBoardV1:React.FC<Props>=({session,company,participant,readOnly,controllerName,onSessionUpdate,onToast,onLeave,onTransferCeo})=>{
 const state=company.kmWeek;
 const[busy,setBusy]=useState(false);
 const[selectedDomain,setSelectedDomain]=useState<KnowledgeDomain>('operations');
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
 const post=async(payload:any)=>{
  if(readOnly){onToast(`Read only · ${controllerName||'Your CEO'} controls this company.`);return}
  if(busy)return;
  setBusy(true);
  try{
   const response=await fetch(`/api/sessions/${session.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,participantId:participant?.id,actionType:payload.type,params:payload})});
   const data=await response.json();
   if(!response.ok||data?.success===false){onToast(data?.message||data?.error||'That move is not available.');return}
   if(data.session)onSessionUpdate(data.session);
   if(data.message)onToast(data.message,5000);
  }catch{onToast('Could not complete that move.')}
  finally{setBusy(false)}
 };
 const resolve=(challenge:KMWeekChallenge,method:'local'|'expert'|'risk',chosenExpertId?:string)=>post({type:'KM_WEEK_RESOLVE',challengeId:challenge.id,method,expertId:chosenExpertId});
 const invest=()=>{
  if(investment==='TRAIN_EXPERT'){
    const expert=specialist||experts[0];if(!expert)return;
    const domain=expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
    void post({type:'KM_WEEK_INVEST',investment,expertId:expert.id,domain});
  }else if(investment==='LOCAL_TRAINING'){
    const expert=specialist||experts[0];if(!expert||!localTrainingSite)return;
    const domain=expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
    void post({type:'KM_WEEK_INVEST',investment,expertId:expert.id,siteId:localTrainingSite.id,domain});
  }else void post({type:'KM_WEEK_INVEST',investment,domain:selectedDomain,sourceSiteId,targetSiteId});
 };
 const permittedInvestments:KMWeekInvestment[]=guided?(state.guidedTurn===1?['TRAIN_EXPERT']:state.guidedTurn===2?['LOCAL_TRAINING']:['KNOWLEDGE_TRANSFER']):['TRAIN_EXPERT','LOCAL_TRAINING','KNOWLEDGE_TRANSFER'];
 const source=company.sites.find(site=>site.id===sourceSiteId);
 const target=company.sites.find(site=>site.id===targetSiteId);
 const investmentPreview=investment==='TRAIN_EXPERT'
   ?specialist?`${specialist.name}: ${specialistScore(company,specialistDomain)} → ${Math.min(5,specialistScore(company,specialistDomain)+1)}`:'Choose a specialist'
   :investment==='LOCAL_TRAINING'
    ?specialist&&localTrainingSite?`${localTrainingSite.name} ${domainLabel(specialistDomain)}: ${localTrainingSite.teamCapability[specialistDomain]||0} → ${Math.min(5,(localTrainingSite.teamCapability[specialistDomain]||0)+1)}`:'Choose a specialist'
    :source&&target?`${source.name} ${domainLabel(selectedDomain)} ${source.teamCapability[selectedDomain]||0} → ${target.name} ${target.teamCapability[selectedDomain]||0}`:'Choose two sites';

 return <div className="min-h-screen bg-[#071019] text-slate-100">
  <header className="sticky top-0 z-[100] border-b-2 border-amber-950/60 bg-[#09131f]/95 px-3 py-2 shadow-xl backdrop-blur">
   <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2">
    <div className="mr-auto min-w-[260px]"><div className="text-[9px] font-black uppercase tracking-[.22em] text-emerald-300">The Performance Gap · KM Week</div><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-amber-300"/><h1 className="text-xl font-black text-white">{company.name}</h1><span className="rounded-md border border-slate-700 px-1.5 py-0.5 text-[9px] font-black text-slate-500">{session.id}</span>{readOnly?<span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">Watching · CEO {controllerName}</span>:<span className="rounded-full border border-amber-600 bg-amber-950/50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200"><Crown className="mr-1 inline h-3 w-3"/>CEO · You</span>}</div></div>
    <div className="rounded-xl border-2 border-emerald-800 bg-emerald-950/25 px-3 py-1.5"><div className="text-[9px] font-black uppercase text-emerald-400">Turnover</div><div className="text-lg font-black text-emerald-200">{money(company.turnover)}</div></div>
    <div className="rounded-xl border-2 border-amber-700 bg-amber-950/25 px-3 py-1.5"><div className="text-[9px] font-black uppercase text-amber-400">Score</div><div className="text-lg font-black text-amber-200">{state.score.total}</div></div>
    <div className="rounded-xl border-2 border-violet-800 bg-violet-950/25 px-3 py-1.5"><div className="text-[9px] font-black uppercase text-violet-400">Game time</div><div className="text-lg font-black tabular-nums text-violet-100">{mm}:{ss}</div></div>
    {!readOnly&&members.length>1&&onTransferCeo&&<select defaultValue="" onChange={event=>{const id=event.target.value;event.currentTarget.value='';if(id)onTransferCeo(id)}} className="h-11 rounded-xl border-2 border-amber-800 bg-slate-950 px-2 text-[10px] font-black text-amber-100"><option value="">Pass CEO…</option>{members.filter(member=>member.id!==participant?.id).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>}
    <button onClick={onLeave} className="h-11 rounded-xl border-2 border-rose-800 bg-rose-950/30 px-3 text-xs font-black text-rose-200"><LogOut className="mr-1 inline h-4 w-4"/>Leave</button>
   </div>
  </header>

  <main className="mx-auto max-w-[1500px] p-3 lg:p-4">
   <div className="mb-3 flex flex-wrap items-center gap-2">
    <div className="rounded-full border-2 border-indigo-700 bg-indigo-950/45 px-4 py-1.5 text-xs font-black text-indigo-100">{phaseTitle(company)}</div>
    {state.lastMessage&&<div className="min-w-0 flex-1 text-xs font-bold text-slate-400">{state.lastMessage}</div>}
   </div>

   <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="space-y-3">
     <Card className="p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Your knowledge board</div><h2 className="text-xl font-black text-white">Build the River</h2></div><div className="flex gap-1">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className={`rounded-full border-2 px-3 py-1 text-[10px] font-black ${selectedDomain===domain?'border-amber-300 bg-amber-950/40 text-amber-100':'border-slate-700 bg-slate-950 text-slate-400'}`}>{domainLabel(domain)}</button>)}</div></div>
      <div className="min-h-[330px]"><InvestmentRiverView company={company} mode="km_week" selectedDomain={selectedDomain} highlightDomain/></div>
     </Card>

     <div className="grid gap-3 md:grid-cols-3">
      {sites.map((site,index)=><Card key={site.id} className={`relative overflow-hidden p-3 ${index===0?'rotate-[-.35deg]':index===2?'rotate-[.35deg]':''}`}>
       <div className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] font-black text-slate-500">{SITE_ABBR[site.id]}</div>
       <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-300"/><h3 className="font-black text-white">{site.name}</h3></div>
       <div className="mt-3 space-y-2">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-left"><span className="w-20 truncate text-[10px] font-black text-slate-400">{domainLabel(domain)}</span><KnowledgePips value={site.teamCapability[domain]||0} domain={domain} compact/><b className="ml-auto text-sm text-white">{site.teamCapability[domain]||0}</b></button>)}</div>
       <div className="mt-3 border-t border-slate-800 pt-2 text-[10px] font-bold text-slate-500">Specialists here: <span className="text-amber-200">{experts.filter(expert=>expert.location===site.id).map(expert=>expert.name.split(' ')[0]).join(', ')||'—'}</span></div>
      </Card>)}
     </div>

     {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&<Card className="border-violet-800 bg-[#0d1320] p-4">
      {guided&&<div className="mb-3 rounded-2xl border-2 border-amber-500 bg-amber-950/25 p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">Guided move {state.guidedTurn} of 3</span><span className="rounded-full border border-amber-700 bg-black/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.14em] text-amber-200">Read to your team</span></div><div className="mt-1 font-black text-white">{guidedCopy.title}</div><p className="mt-1 text-xs text-slate-300">{guidedCopy.text}</p><p className="mt-2 text-[11px] font-bold text-amber-200">{guidedCopy.invest}</p></div>}
      <div className="grid gap-3 md:grid-cols-2">{state.challenges.map(challenge=><ChallengeCard key={challenge.id} challenge={challenge} company={company} guided={guided} usedExpertIds={state.usedExpertIds} busy={busy} readOnly={readOnly} onResolve={resolve}/>)}</div>
     </Card>}

     {(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'&&<Card className="border-amber-700 bg-[linear-gradient(180deg,#17130c,#101621)] p-4">
      <div className="flex items-center justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">{guided?'Guided investment':'One investment this round'}</div><h2 className="text-xl font-black text-white">Choose how the organisation learns</h2></div><div className="rounded-xl border border-amber-800 bg-black/20 px-3 py-2 text-xs font-black text-amber-100">{investmentPreview}</div></div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
       {permittedInvestments.includes('TRAIN_EXPERT')&&<button onClick={()=>setInvestment('TRAIN_EXPERT')} className={`rounded-2xl border-[3px] p-4 text-left shadow-lg ${investment==='TRAIN_EXPERT'?'border-amber-300 bg-amber-950/45':'border-slate-700 bg-slate-950'}`}><GraduationCap className="h-6 w-6 text-amber-300"/><div className="mt-2 font-black text-white">Train Expert</div><div className="mt-1 text-[11px] text-slate-400">Deepen one specialist by +1.</div><div className="mt-2 text-xs font-black text-amber-200">$15k</div></button>}
       {permittedInvestments.includes('LOCAL_TRAINING')&&<button onClick={()=>setInvestment('LOCAL_TRAINING')} className={`rounded-2xl border-[3px] p-4 text-left shadow-lg ${investment==='LOCAL_TRAINING'?'border-sky-300 bg-sky-950/45':'border-slate-700 bg-slate-950'}`}><Users className="h-6 w-6 text-sky-300"/><div className="mt-2 font-black text-white">Local Training</div><div className="mt-1 text-[11px] text-slate-400">The specialist teaches the team where they are.</div><div className="mt-2 text-xs font-black text-sky-200">$10k</div></button>}
       {permittedInvestments.includes('KNOWLEDGE_TRANSFER')&&<button onClick={()=>setInvestment('KNOWLEDGE_TRANSFER')} className={`rounded-2xl border-[3px] p-4 text-left shadow-lg ${investment==='KNOWLEDGE_TRANSFER'?'border-emerald-300 bg-emerald-950/45':'border-slate-700 bg-slate-950'}`}><Workflow className="h-6 w-6 text-emerald-300"/><div className="mt-2 font-black text-white">Knowledge Transfer</div><div className="mt-1 text-[11px] text-slate-400">Copy useful know-how from one site to another.</div><div className="mt-2 text-xs font-black text-emerald-200">$8k</div></button>}
      </div>
      <div className="mt-3 rounded-2xl border-2 border-slate-700 bg-slate-950/75 p-3">
       {investment!=='KNOWLEDGE_TRANSFER'?<div className="grid gap-2 md:grid-cols-2"><label className="text-[10px] font-black uppercase text-slate-500">Specialist<select value={specialist?.id||''} onChange={event=>{const next=experts.find(item=>item.id===event.target.value);setExpertId(event.target.value);if(next)setSelectedDomain(next.domains[0].domain)}} disabled={guided} className="mt-1 w-full rounded-xl border-2 border-slate-700 bg-[#071019] px-3 py-2 text-sm normal-case text-white disabled:opacity-70">{experts.map(expert=><option key={expert.id} value={expert.id}>{expert.name} · {domainLabel(expert.domains[0].domain)} {expert.domains[0].score}</option>)}</select></label><div><div className="text-[10px] font-black uppercase text-slate-500">{investment==='LOCAL_TRAINING'?'Current location':'Knowledge domain'}</div><div className="mt-1 rounded-xl border-2 border-slate-700 bg-[#071019] px-3 py-2 text-sm font-black text-white">{investment==='LOCAL_TRAINING'?localTrainingSite?.name||'—':domainLabel(specialistDomain)}</div></div></div>:<div className="grid gap-2 md:grid-cols-3"><label className="text-[10px] font-black uppercase text-slate-500">Domain<select value={selectedDomain} onChange={event=>setSelectedDomain(event.target.value as KnowledgeDomain)} disabled={guided} className="mt-1 w-full rounded-xl border-2 border-slate-700 bg-[#071019] px-3 py-2 text-sm normal-case text-white">{KM_WEEK_DOMAINS.map(domain=><option key={domain} value={domain}>{domainLabel(domain)}</option>)}</select></label><label className="text-[10px] font-black uppercase text-slate-500">Teaching site<select value={sourceSiteId} onChange={event=>setSourceSiteId(event.target.value)} disabled={guided} className="mt-1 w-full rounded-xl border-2 border-slate-700 bg-[#071019] px-3 py-2 text-sm normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label><label className="text-[10px] font-black uppercase text-slate-500">Receiving site<select value={targetSiteId} onChange={event=>setTargetSiteId(event.target.value)} disabled={guided} className="mt-1 w-full rounded-xl border-2 border-slate-700 bg-[#071019] px-3 py-2 text-sm normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label></div>}
       <button onClick={invest} disabled={busy||readOnly} className="mt-3 w-full rounded-xl border-2 border-amber-200 bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg disabled:bg-slate-800 disabled:text-slate-600">{busy?'MOVING…':guided?'MAKE GUIDED INVESTMENT':'MAKE INVESTMENT & START NEXT ROUND'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
      </div>
     </Card>}

     {state.stage==='shock'&&<Card className="overflow-hidden border-rose-700">
      <div className="bg-[linear-gradient(135deg,#4c0519,#170b13)] p-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-4 border-rose-300 bg-rose-950 shadow-xl"><ShieldCheck className="h-8 w-8 text-rose-200"/></div><div className="mt-3 text-[10px] font-black uppercase tracking-[.24em] text-rose-300">Business Shock</div><h2 className="mt-1 text-3xl font-black text-white">Your specialists are unavailable.</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-rose-100/80">Five issues hit at once. There are no interventions now. The organisation has to perform using the local capability you actually built.</p><button onClick={()=>void post({type:'KM_WEEK_RESOLVE_SHOCK'})} disabled={busy||readOnly} className="mt-5 rounded-xl border-2 border-white bg-white px-8 py-3 text-sm font-black text-rose-950 disabled:opacity-40">{busy?'CHECKING…':'TURN OVER THE SHOCK CARD'}</button></div>
     </Card>}

     {state.stage==='complete'&&<Card className="border-emerald-700 p-5">
      <div className="text-center"><div className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">This is what you built</div><h2 className="mt-1 text-3xl font-black text-white">{state.score.total} points</h2><p className="mt-2 text-sm text-slate-400">The score is useful. The shape of your River is the real result.</p>{session.soloMode&&<div className="mx-auto mt-2 inline-block rounded-full border border-emerald-800 bg-emerald-950/25 px-3 py-1 text-[10px] font-black text-emerald-200">{state.score.total>=32?'Exceptional knowledge system':state.score.total>=25?'Strong knowledge system':state.score.total>=18?'Developing knowledge system':'Fragile knowledge system'}</div>}</div>
      <div className="mt-4 grid gap-2 md:grid-cols-3"><div className="rounded-xl border border-amber-800 bg-amber-950/20 p-3"><div className="text-[9px] font-black uppercase text-amber-300">Depth</div><p className="mt-1 text-xs text-slate-300">How much knowledge sits in a particular expert or place.</p></div><div className="rounded-xl border border-sky-800 bg-sky-950/20 p-3"><div className="text-[9px] font-black uppercase text-sky-300">Breadth</div><p className="mt-1 text-xs text-slate-300">How widely useful capability exists across the organisation.</p></div><div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-3"><div className="text-[9px] font-black uppercase text-emerald-300">Flow</div><p className="mt-1 text-xs text-slate-300">Whether knowledge can move from where it exists to where it is needed.</p></div></div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">{state.shockChecks.map(check=><div key={check.id} className={`rounded-xl border-2 p-3 text-center ${check.passed?'border-emerald-600 bg-emerald-950/30':'border-rose-800 bg-rose-950/25'}`}><div className="text-[9px] font-black uppercase text-slate-500">{SITE_ABBR[check.siteId]} · {domainLabel(check.domain)}</div><div className={`mt-1 text-lg font-black ${check.passed?'text-emerald-300':'text-rose-300'}`}>{check.passed?'READY':'GAP'}</div><div className="text-[10px] text-slate-500">Needed {check.difficulty}</div></div>)}</div>
      <div className="mt-5 rounded-2xl border-2 border-violet-700 bg-violet-950/25 p-4"><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">The strategy you just played</div><div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm font-black"><span className="rounded-xl bg-amber-950 px-3 py-2 text-amber-200">Expert Education</span><ArrowRight className="h-4 w-4 text-slate-600"/><span className="rounded-xl bg-amber-950 px-3 py-2 text-amber-200">Experts</span><ArrowRight className="h-4 w-4 text-slate-600"/><span className="rounded-xl bg-sky-950 px-3 py-2 text-sky-200">Local Training</span><ArrowRight className="h-4 w-4 text-slate-600"/><span className="rounded-xl bg-sky-950 px-3 py-2 text-sky-200">Site Users</span><ArrowRight className="h-4 w-4 text-slate-600"/><span className="rounded-xl bg-emerald-950 px-3 py-2 text-emerald-200">Knowledge Transfer</span></div><p className="mt-3 text-center text-xs text-slate-400">Newbie mode opens the rest of the knowledge system and lets these strategies interact.</p></div>
     </Card>}
    </div>

    <aside className="space-y-3">
     <Card className="rotate-[.4deg] border-amber-700 bg-[linear-gradient(150deg,#34220d,#17130d)] p-4">
      <div className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-300"/><div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">KM Week Goal · 5 points</div></div>
      <h2 className="mt-2 text-xl font-black text-white">{goal.title}</h2><p className="mt-2 text-xs leading-relaxed text-amber-100/75">{goal.description}</p>
      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-black ${state.score.goal?'border-emerald-500 bg-emerald-950/30 text-emerald-200':'border-amber-800 bg-black/20 text-amber-200'}`}>{state.score.goal?'GOAL ACHIEVED · +5':'IN PLAY · 5 POINTS'}</div>
     </Card>

     <Card className="p-4">
      <div className="flex items-center gap-2"><Medal className="h-5 w-5 text-amber-300"/><h2 className="font-black text-white">Score pad</h2><span className="ml-auto rounded-lg border border-amber-700 bg-amber-950/30 px-2 py-1 text-lg font-black text-amber-200">{state.score.total}</span></div>
      <div className="mt-2"><ScoreRow label="Business Performance" value={state.score.business} max="12" icon={<CircleDollarSign className="h-4 w-4"/>}/><ScoreRow label="Expertise" value={state.score.expertise} max="6" icon={<Brain className="h-4 w-4"/>}/><ScoreRow label="Local Capability" value={state.score.localCapability} max="9" icon={<Users className="h-4 w-4"/>}/><ScoreRow label="Knowledge Flow" value={state.score.knowledgeFlow} max="6" icon={<Workflow className="h-4 w-4"/>}/><ScoreRow label="Resilience" value={state.score.resilience} max="5" icon={<ShieldCheck className="h-4 w-4"/>}/><ScoreRow label="KM Week Goal" value={state.score.goal} max="5" icon={<Target className="h-4 w-4"/>}/></div>
     </Card>

     <Card className="p-4">
      <div className="text-[9px] font-black uppercase tracking-[.18em] text-sky-300">Specialist pawns</div>
      <div className="mt-2 space-y-2">{experts.map(expert=>{const skill=expert.domains[0];return <button key={expert.id} onClick={()=>{setExpertId(expert.id);setSelectedDomain(skill.domain)}} className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-700 bg-slate-950 p-2 text-left hover:border-slate-500"><span className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-amber-300 bg-amber-950 text-sm font-black text-amber-100 shadow-lg">{expert.name[0]}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{expert.name}</b><span className="text-[10px] text-slate-500">{domainLabel(skill.domain)} · {siteName(company,expert.location)}</span></span><span className="text-lg font-black text-amber-200">{skill.score}</span></button>})}</div>
     </Card>

     {standings.length>1&&<Card className="p-4"><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">Workshop standings</div><div className="mt-2 space-y-1">{standings.map((entry,index)=><div key={entry.id} className={`flex items-center rounded-lg border px-2 py-1.5 text-xs ${entry.id===company.id?'border-violet-500 bg-violet-950/25':'border-slate-800 bg-slate-950'}`}><span className="w-6 font-black text-slate-500">{index+1}</span><span className="min-w-0 flex-1 truncate font-bold text-slate-300">{entry.name}</span><b className="text-white">{entry.score}</b>{entry.complete&&<Sparkles className="ml-1 h-3 w-3 text-emerald-300"/>}</div>)}</div></Card>}
    </aside>
   </div>
  </main>
 </div>;
};
