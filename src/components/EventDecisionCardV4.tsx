import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, BriefcaseBusiness, Building2, Check, Handshake, ShieldQuestion, Sparkles, Users } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ActiveEventAllocationV2, ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { currentConsultantRate } from '../engine/coreV2.ts';
import { evaluateEventDomainKnowledgeExplicitV2 } from '../engine/challengeResponseV2.ts';
import { formatCurrency } from '../utils/format.ts';

type DecisionMode='existing'|'expert'|'network'|'reputation'|'consultant'|'risk';
type Resolution={complete:boolean;overallSuccess?:boolean;domains:{domain:KnowledgeDomain;value:number;target:number;success?:boolean}[];data?:any;reputation?:boolean};
type Connector={x1:number;y1:number;x2:number;y2:number}|null;
interface Props{session:GameSessionV2;company:CompanyV2;event:ActiveEventV2;cardNumber:number;onSetAllocation:(eventId:string,domain:KnowledgeDomain,allocation:any)=>Promise<void>|void;onResolveEvent:(eventId:string)=>Promise<any>;onAcknowledgeResolution:(data:any)=>Promise<void>|void;onRedrawEvent?:(eventId:string)=>Promise<void>|void;canHorizonRedraw?:boolean;}
const MODES:{id:DecisionMode;label:string;sub:string;icon:React.ElementType}[]=[
 {id:'existing',label:'Use what we already know',sub:'Choose internal knowledge deliberately',icon:Building2},
 {id:'expert',label:'Ask one of our experts to help',sub:'Deploy scarce deep expertise',icon:Users},
 {id:'network',label:'Ask our network for help',sub:'Draw on an active Community of Practice',icon:Handshake},
 {id:'reputation',label:'Call in a favour',sub:'Spend reputation to guarantee the challenge',icon:Sparkles},
 {id:'consultant',label:'Engage external expertise',sub:'Non-preferred: buy temporary capability',icon:BriefcaseBusiness},
 {id:'risk',label:'Accept the risk',sub:'Proceed without adding temporary knowledge',icon:ShieldQuestion},
];
const randomPercent=()=>1+Math.floor(Math.random()*100);
const enginePercent=(dieRoll:number,sides:number)=>Math.max(1,Math.min(100,101-Math.ceil((Math.max(1,dieRoll)/Math.max(1,sides))*100)));
const FAVOUR_LIMIT=2;

export const EventDecisionCardV4:React.FC<Props>=({session,company,event,cardNumber,onSetAllocation,onResolveEvent,onAcknowledgeResolution,onRedrawEvent,canHorizonRedraw=false})=>{
 const [domain,setDomain]=useState<KnowledgeDomain>(event.card.domains[0].domain);
 const [mode,setMode]=useState<DecisionMode>('existing');
 const [busy,setBusy]=useState(false);
 const [resolution,setResolution]=useState<Resolution|null>(null);
 const [connector,setConnector]=useState<Connector>(null);
 const timer=useRef<number|null>(null);
 const containerRef=useRef<HTMLDivElement|null>(null);
 const detailRef=useRef<HTMLElement|null>(null);
 const modeRefs=useRef<Partial<Record<DecisionMode,HTMLButtonElement|null>>>({});
 const card=event.card;
 const targetSite=event.targetSiteId?company.sites.find(s=>s.id===event.targetSiteId):undefined;
 const fallbackDomain=card.domains[0]?.domain;
 const activeDomain=card.domains.some(r=>r.domain===domain)?domain:fallbackDomain;
 const favoursRemaining=Math.max(0,Math.min(FAVOUR_LIMIT,company.reputationPoints));

 useEffect(()=>{if(fallbackDomain)setDomain(fallbackDomain);setMode('existing');setBusy(false);setResolution(null);if(timer.current)window.clearInterval(timer.current)},[event.instanceId,fallbackDomain]);
 const evals=useMemo(()=>card.domains.map(r=>({domain:r.domain,value:evaluateEventDomainKnowledgeExplicitV2(session,company,event,r.domain,session.config)})),[card.domains,company,event,session]);
 const evaluationEntry=evals.find(x=>x.domain===activeDomain)??evals[0];
 const evaluation=evaluationEntry?.value;
 const allocation:ActiveEventAllocationV2=(activeDomain?event.allocations[activeDomain]:undefined)||{};
 const cardChance=Math.round(evals.reduce((p,x)=>p*(x.value.winChancePercent/100),1)*100);
 const consultantRate=currentConsultantRate(company);
 const allocations=Object.values(event.allocations) as ActiveEventAllocationV2[];
 const hasExisting=allocations.some(x=>x.useTeamCapability||x.useLocalCodified||x.useCorporateIntranet);
 const hasExpert=allocations.some(x=>!!x.expertId); const hasNetwork=allocations.some(x=>!!x.useCoPSupport); const hasConsultant=allocations.some(x=>(x.consultantPoints||0)>0); const acceptRisk=allocations.some(x=>!!x.acceptRisk);
 const selected:Record<DecisionMode,boolean>={existing:hasExisting,expert:hasExpert,network:hasNetwork,reputation:false,consultant:hasConsultant,risk:acceptRisk};
 const consultantCost=useMemo(()=>{let offset=0,total=0;for(const r of card.domains){const p=event.allocations[r.domain]?.consultantPoints||0;if(!p)continue;total+=Math.round(consultantRate*Math.pow(1.35,offset))*p;offset++;}return total},[card.domains,event.allocations,consultantRate]);
 const committedTravel=allocations.reduce((s,x)=>s+(x.expertTravelCost||0),0); const committedConsultant=event.consultantSpend||allocations.reduce((s,x)=>s+(x.consultantCost||0),0);
 const interventionCost=event.isResolved?committedTravel+committedConsultant:consultantCost;
 const travelPending=card.scope==='local'&&allocations.some(x=>x.expertId&&company.experts.find(e=>e.id===x.expertId)?.location!==event.targetSiteId);
 const riskBase=card.scope==='local'&&targetSite?targetSite.turnover:company.turnover; const riskPercent=riskBase>0?Math.round((card.impact/riskBase)*100):100;
 const eligibleExperts=activeDomain?company.experts.filter(e=>!e.isVacant&&['Available','HQ Assignment','Supporting Event'].includes(e.state)&&e.domains.some(x=>x.domain===activeDomain)):[];
 const networkAvailable=activeDomain?new Set(session.copMemberships.filter(m=>m.domain===activeDomain&&m.activeRound===session.round).map(m=>m.companyId)).size>=2:false;

 useLayoutEffect(()=>{
  const update=()=>{
   const container=containerRef.current; const details=detailRef.current; const selectedButton=modeRefs.current[mode];
   if(!container||!details||!selectedButton||window.innerWidth<1024){setConnector(null);return;}
   const c=container.getBoundingClientRect(); const d=details.getBoundingClientRect(); const b=selectedButton.getBoundingClientRect();
   setConnector({x1:b.left-c.left,y1:b.top-c.top+b.height/2,x2:d.right-c.left,y2:d.top-c.top+d.height/2});
  };
  update();
  const raf=window.requestAnimationFrame(update);
  window.addEventListener('resize',update);
  return()=>{window.cancelAnimationFrame(raf);window.removeEventListener('resize',update)};
 },[mode,event.instanceId,activeDomain]);

 const clearRisk=async()=>{if(!acceptRisk)return;await Promise.all(card.domains.map(r=>onSetAllocation(event.instanceId,r.domain,{acceptRisk:false})))};
 const setCurrent=async(change:Partial<ActiveEventAllocationV2>)=>{if(!activeDomain)return;await clearRisk();await onSetAllocation(event.instanceId,activeDomain,{...change,acceptRisk:false})};
 const chooseMode=async(next:DecisionMode)=>{if(next==='reputation'&&favoursRemaining<=0)return;setMode(next);if(next!=='risk')await clearRisk();if(next==='risk')await Promise.all(card.domains.map((r,i)=>onSetAllocation(event.instanceId,r.domain,{useTeamCapability:false,useLocalCodified:false,useCorporateIntranet:false,expertId:'',useCoPSupport:false,consultantPoints:0,acceptRisk:i===0})))};
 const useReputation=async()=>{
  if(favoursRemaining<=0||busy)return;
  setBusy(true);
  try{
   const res=await fetch(`/api/sessions/${session.id}/events/reputation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,eventInstanceId:event.instanceId})});
   const data=await res.json();
   if(!res.ok||data.success===false)throw new Error(data.message||data.error||'Could not use Reputation.');
   setResolution({complete:true,overallSuccess:true,reputation:true,data,domains:card.domains.map(r=>({domain:r.domain,value:1,target:100,success:true}))});
  }catch(error:any){setBusy(false);window.alert(error.message||'Could not use Reputation.');}
 };
 const resolve=async()=>{if(busy)return;setBusy(true);setResolution({complete:false,domains:evals.map(x=>({domain:x.domain,value:randomPercent(),target:x.value.winChancePercent}))});timer.current=window.setInterval(()=>setResolution(cur=>cur?{...cur,domains:cur.domains.map(x=>({...x,value:randomPercent()}))}:cur),70);try{const [data]=await Promise.all([onResolveEvent(event.instanceId),new Promise(r=>window.setTimeout(r,1250))]);if(timer.current)window.clearInterval(timer.current);const results=data?.result?.domainResults||[];const sides=session.config.event_die||12;setResolution({complete:true,overallSuccess:Boolean(data?.eventSuccess??data?.result?.success),data,domains:evals.map(x=>{const result=results.find((r:any)=>r.domain===x.domain);return{domain:x.domain,target:x.value.winChancePercent,value:result?enginePercent(Number(result.dieRoll),sides):randomPercent(),success:result?Boolean(result.domainSuccess):undefined}})});}catch(error:any){if(timer.current)window.clearInterval(timer.current);setResolution(null);setBusy(false);window.alert(error.message||'Challenge could not be resolved.')}};

 if(resolution)return <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className={`w-full rounded-2xl border-2 p-4 shadow-2xl ${resolution.complete?(resolution.overallSuccess?'border-emerald-500 bg-emerald-950/95':'border-rose-500 bg-rose-950/95'):'border-indigo-500 bg-slate-950/95'}`}><div className="flex justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Challenge resolved</div><div className="font-black text-white text-lg">{card.title}</div></div>{resolution.complete&&<div className={`text-2xl font-black ${resolution.overallSuccess?'text-emerald-300':'text-rose-300'}`}>{resolution.overallSuccess?'SUCCESS':'FAIL'}</div>}</div>{resolution.reputation?<div className="mt-3 rounded-xl border border-violet-400/70 bg-violet-950/70 p-4"><div className="font-black text-violet-200">Guaranteed by reputation</div><div className="text-sm text-violet-100/80 mt-1">You called in a favour, so the challenge succeeded without a knowledge test. No knowledge capability was created by this intervention.</div></div>:<div className={`grid gap-2 mt-3 ${resolution.domains.length>1?'grid-cols-2':'grid-cols-1'}`}>{resolution.domains.map(x=><div key={x.domain} className="rounded-xl border border-slate-700 bg-slate-950/80 p-3"><div className="flex justify-between"><b>{DOMAIN_INFO[x.domain].label}</b>{resolution.complete&&<b className={x.success?'text-emerald-300':'text-rose-300'}>{x.success?'SUCCESS':'FAIL'}</b>}</div><div className="grid grid-cols-2 gap-2 mt-2"><div className="rounded-lg bg-slate-900 p-2 text-center"><div className="text-[9px] uppercase text-slate-500 font-black">Target</div><div className="text-xl font-black">&lt; {x.target}%</div></div><div className="rounded-lg bg-slate-900 border border-indigo-700 p-2 text-center"><div className="text-[9px] uppercase text-indigo-300 font-black">Roll</div><div className="text-2xl font-black tabular-nums">{String(x.value).padStart(2,'0')}%</div></div></div></div>)}</div>}{resolution.complete&&<button onClick={()=>onAcknowledgeResolution(resolution.data)} className="mt-3 w-full rounded-xl bg-white text-slate-950 py-3 font-black">CONTINUE</button>}</motion.div>;

 if(!activeDomain||!evaluation)return null;
 return <motion.div ref={containerRef} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="relative w-full grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
  {connector&&<svg className="hidden lg:block absolute inset-0 z-[1] pointer-events-none overflow-visible" width="100%" height="100%" aria-hidden="true"><path d={`M ${connector.x1} ${connector.y1} C ${connector.x1-55} ${connector.y1}, ${connector.x2+55} ${connector.y2}, ${connector.x2} ${connector.y2}`} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round"/><circle cx={connector.x1} cy={connector.y1} r="4" fill="#c4b5fd"/><circle cx={connector.x2} cy={connector.y2} r="4" fill="#c4b5fd"/></svg>}
  <div className="relative z-[2] space-y-2">
   <section className={`rounded-2xl overflow-hidden border-2 shadow-2xl ${card.type==='problem'?'border-rose-700/80':'border-emerald-700/80'} bg-slate-950`}>
    <div className={`px-4 py-3 ${card.type==='problem'?'bg-gradient-to-r from-rose-950 to-slate-950':'bg-gradient-to-r from-emerald-950 to-slate-950'}`}><div className="flex justify-between gap-3"><div className="min-w-0"><div className="text-[9px] uppercase tracking-wider font-black text-white/60">Card {cardNumber} · {card.type} · {card.scope==='local'?targetSite?.name:'Whole company'}</div><h2 className="text-xl font-black text-white mt-1">{card.title}</h2><p className="text-xs text-slate-300 mt-1">{card.description}</p></div><div className="text-right shrink-0"><div className="text-[9px] uppercase text-slate-500 font-black">{card.type==='problem'?'Loss if failed':'Gain if successful'}</div><div className="text-xl font-black">{card.type==='problem'?'−':'+'}{formatCurrency(card.impact)}</div><div className="text-[9px] text-slate-400">{riskPercent}% of turnover</div></div></div></div>
    <div className="p-3 border-t border-slate-800"><div className="flex items-end justify-between gap-3"><div className="min-w-0 flex-1"><div className="text-[9px] uppercase tracking-wider text-slate-500 font-black">Knowledge needed</div><div className="grid grid-cols-2 gap-2 mt-1">{card.domains.map(r=>{const e=evals.find(x=>x.domain===r.domain)!.value;return <button key={r.domain} onClick={()=>{setDomain(r.domain);setMode('existing')}} className={`rounded-lg border px-2 py-1.5 text-left ${activeDomain===r.domain?'border-white bg-white/10':'border-slate-700 bg-slate-900'}`}><b className="text-xs">{DOMAIN_INFO[r.domain].label}</b><div className="text-[9px] text-slate-400">Challenge {r.difficulty} · Knowledge {e.totalKnowledge} · {e.winChancePercent}%</div></button>})}</div></div><div className="grid grid-cols-2 gap-4 text-right shrink-0"><div><div className="text-[9px] uppercase text-slate-500 font-black">Intervention cost</div><div className="text-lg font-black">{formatCurrency(interventionCost)}</div><div className="text-[9px] text-amber-400">{travelPending&&!event.isResolved?'+ expert travel roll':''}</div></div><div><div className="text-[9px] uppercase text-slate-500 font-black">Current chance</div><div className="text-2xl font-black text-indigo-300">{cardChance}%</div></div></div></div></div>
   </section>
   {canHorizonRedraw&&<button onClick={()=>onRedrawEvent?.(event.instanceId)} className="w-full rounded-lg bg-amber-400 text-slate-950 py-2 text-xs font-black">HORIZON SCAN: DRAW ANOTHER</button>}
   <section ref={detailRef} className="relative z-[3] rounded-xl border-2 border-violet-400 bg-violet-950/90 p-3 min-h-[100px] shadow-xl shadow-violet-950/40">
    {mode==='existing'&&<><div className="font-black text-sm text-violet-100">Use what we already know — {DOMAIN_INFO[activeDomain].label}</div><div className="grid grid-cols-3 gap-2 mt-2"><Source label="Team Capability" value={evaluation.availableSources.team} selected={!!allocation.useTeamCapability} onClick={()=>setCurrent({useTeamCapability:!allocation.useTeamCapability})}/><Source label="Local Codified" value={evaluation.availableSources.localCodified} selected={!!allocation.useLocalCodified} onClick={()=>setCurrent({useLocalCodified:!allocation.useLocalCodified})}/><Source label="Corporate Intranet" value={evaluation.availableSources.usableIntranet} selected={!!allocation.useCorporateIntranet} onClick={()=>setCurrent({useCorporateIntranet:!allocation.useCorporateIntranet})}/></div></>}
    {mode==='expert'&&<><div className="font-black text-sm text-violet-100">Ask one of our experts — {DOMAIN_INFO[activeDomain].label}</div><div className="grid grid-cols-2 gap-2 mt-2">{eligibleExperts.map(e=><button key={e.id} onClick={()=>setCurrent({expertId:allocation.expertId===e.id?'':e.id})} className={`rounded-lg border p-2 text-left ${allocation.expertId===e.id?'bg-amber-400 text-slate-950 border-amber-200':'bg-slate-950/80 border-violet-700'}`}><b className="text-xs">{e.name}</b><div className="text-[9px]">{DOMAIN_INFO[activeDomain].label} {e.domains.find(x=>x.domain===activeDomain)?.score}</div></button>)}</div></>}
    {mode==='network'&&<><div className="font-black text-sm text-violet-100">Ask our network — {DOMAIN_INFO[activeDomain].label}</div>{networkAvailable?<button onClick={()=>setCurrent({useCoPSupport:!allocation.useCoPSupport})} className="mt-2 rounded-lg bg-amber-400 text-slate-950 px-3 py-2 text-xs font-black">{allocation.useCoPSupport?'NETWORK SELECTED · REMOVE':'USE ACTIVE COMMUNITY OF PRACTICE (+2)'}</button>:<div className="text-xs text-violet-200/70 mt-2">No active multi-company Community of Practice.</div>}</>}
    {mode==='reputation'&&<div className="flex justify-between items-center gap-4"><div><b className="text-sm text-violet-100">Call in a favour</b><div className={`text-3xl leading-none font-black mt-1 ${favoursRemaining>0?'text-amber-300':'text-rose-300'}`}>{favoursRemaining}/{FAVOUR_LIMIT}</div><div className="text-xs text-violet-200/70 mt-1">Favours remaining. Guarantees this challenge without creating knowledge capability.</div></div><button onClick={useReputation} disabled={favoursRemaining<=0||busy} className="rounded-lg bg-amber-400 text-slate-950 px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">{favoursRemaining<=0?'NO FAVOURS LEFT':busy?'USING…':'USE 1 FAVOUR'}</button></div>}
    {mode==='consultant'&&<><div className="font-black text-sm text-violet-100">External expertise — {DOMAIN_INFO[activeDomain].label} <span className="text-amber-400 text-[10px]">NON-PREFERRED</span></div><div className="flex gap-2 mt-2">{[1,2,3].map(p=><button key={p} disabled={p>evaluation.usefulConsultantGap&&allocation.consultantPoints!==p} onClick={()=>setCurrent({consultantPoints:allocation.consultantPoints===p?0:p})} className={`rounded-lg border px-3 py-2 font-black text-xs ${allocation.consultantPoints===p?'bg-amber-400 text-slate-950 border-amber-200':'bg-slate-950/80 border-violet-700 disabled:opacity-30'}`}>+{p}<span className="block text-[9px]">from ${consultantRate*p}k</span></button>)}</div></>}
    {mode==='risk'&&<div><b className="text-sm text-violet-100">Accept the risk</b><div className="text-xs text-violet-200/70 mt-1">Proceed at {cardChance}% with {card.type==='problem'?'−':'+'}{formatCurrency(card.impact)} exposure.</div></div>}
   </section>
  </div>
  <aside className="relative z-[2] space-y-1.5"><div className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Knowledge Suite</div>{MODES.map(m=>{const Icon=m.icon;const reputationEmpty=m.id==='reputation'&&favoursRemaining<=0;return <button ref={node=>{modeRefs.current[m.id]=node}} key={m.id} onClick={()=>chooseMode(m.id)} disabled={reputationEmpty} className={`relative w-full rounded-lg border px-3 py-2 text-left ${mode===m.id?'border-violet-300 bg-violet-950/90 shadow-lg shadow-violet-950/40':'border-slate-700 bg-slate-900/95'} ${m.id==='consultant'?'opacity-80':''} ${reputationEmpty?'opacity-40 cursor-not-allowed':''}`}><div className="flex gap-2 items-center"><Icon className="w-4 h-4 text-indigo-300"/><div className="min-w-0"><div className="flex items-center gap-2"><b className="text-xs text-white">{m.label}</b>{m.id==='reputation'&&<span className={`text-lg leading-none font-black ${favoursRemaining>0?'text-amber-300':'text-rose-300'}`}>{favoursRemaining}/{FAVOUR_LIMIT}</span>}</div><div className="text-[9px] text-slate-400">{reputationEmpty?'No favours remaining':m.sub}</div></div></div>{selected[m.id]&&<Check className="absolute right-2 top-2 w-4 h-4 text-emerald-300"/>}</button>})}<button onClick={resolve} disabled={busy} className="w-full rounded-xl bg-indigo-500 text-white py-3 text-lg font-black disabled:opacity-50">GO</button></aside>
 </motion.div>;
};
const Source:React.FC<{label:string;value:number;selected:boolean;onClick:()=>void}>=({label,value,selected,onClick})=><button onClick={onClick} className={`rounded-lg border p-2 text-left ${selected?'border-emerald-300 bg-emerald-950/80':'border-violet-700 bg-slate-950/80'}`}><div className="text-[9px] text-violet-200/70">{label}</div><div className="text-lg font-black">{value}</div></button>;
