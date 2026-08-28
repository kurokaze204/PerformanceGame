import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Building2, GraduationCap, Handshake, Network, Radar, Sparkles, Users, BriefcaseBusiness } from 'lucide-react';
import type { Company, GameSession, KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';

interface Props { session: GameSession; company: Company; onPerformAction: (type:string, params:any)=>void; onNextPhase:()=>void; }
type InterventionId='transfer'|'corporate-training'|'codify-site'|'train-expert'|'update-intranet'|'aar'|'join-cop'|'horizon-scan';
type AnchorId='existing'|'expert'|'network'|'favour'|'external'|'risk';
type Intervention={id:InterventionId; title:string; description:string; anchor:AnchorId; icon:React.ElementType};
const DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];
const ANCHORS:{id:AnchorId;title:string;description:string;disabled?:boolean;icon:React.ElementType}[]=[
 {id:'existing',title:'Use what we already know',description:'Build internal team and codified capability.',icon:Building2},
 {id:'expert',title:'Ask one of our experts to help',description:'Develop and capture scarce expertise.',icon:Users},
 {id:'network',title:'Ask our network for help',description:'Build relationships that make network help possible.',icon:Handshake},
 {id:'favour',title:'Call in a favour',description:'Challenge-response mechanism only.',disabled:true,icon:Sparkles},
 {id:'external',title:'Engage external expertise',description:'Non-preferred challenge-response mechanism only.',disabled:true,icon:BriefcaseBusiness},
 {id:'risk',title:'Accept the risk',description:'Learn from outcomes and anticipate disruption.',icon:Radar},
];
const INTERVENTIONS:Intervention[]=[
 {id:'transfer',title:'Knowledge Transfer',description:'Expert transfers domain expertise to a local team (+1 Team Capability).',anchor:'existing',icon:Users},
 {id:'corporate-training',title:'Corporate Training',description:'Raise Team Capability at all sites (+1) up to Corporate Intranet.',anchor:'existing',icon:Building2},
 {id:'codify-site',title:'Codify Site Knowledge',description:'Document local operating knowledge (+1 Local Codified).',anchor:'existing',icon:BookOpen},
 {id:'train-expert',title:'Train Expert',description:'Advance one expert domain score by +1.',anchor:'expert',icon:GraduationCap},
 {id:'update-intranet',title:'Update Corporate Intranet',description:'Capture strong organisational knowledge into corporate knowledge.',anchor:'expert',icon:Building2},
 {id:'join-cop',title:'Join Community of Practice',description:'Commit an expert to a domain Community of Practice.',anchor:'network',icon:Network},
 {id:'aar',title:'Lessons Learned / AAR',description:'Convert a relevant resolved challenge into local team or codified capability.',anchor:'risk',icon:Sparkles},
 {id:'horizon-scan',title:'Horizon Scan',description:'Scout a domain so a matching event next round can be redrawn.',anchor:'risk',icon:Radar},
];

export const ActionsPanelV4:React.FC<Props>=({session,company,onPerformAction,onNextPhase})=>{
 const [selectedId,setSelectedId]=useState<InterventionId>('transfer');
 const [siteId,setSiteId]=useState(company.sites.find(s=>!s.isClosed)?.id||'');
 const [expertId,setExpertId]=useState(company.experts.find(e=>!e.isVacant)?.id||'');
 const [domain,setDomain]=useState<KnowledgeDomain>('engineering');
 const [learningTarget,setLearningTarget]=useState<'team'|'codified'>('team');
 const activeSites=company.sites.filter(s=>!s.isClosed);
 const activeExperts=company.experts.filter(e=>!e.isVacant&&(e.state==='Available'||e.state==='HQ Assignment'));
 const selected=INTERVENTIONS.find(i=>i.id===selectedId)!;
 const selectedSite=activeSites.find(s=>s.id===siteId)||activeSites[0];
 const selectedExpert=activeExperts.find(e=>e.id===expertId)||activeExperts[0];
 useEffect(()=>{if(selectedSite&&selectedSite.id!==siteId)setSiteId(selectedSite.id)},[selectedSite?.id]);
 useEffect(()=>{if(selectedExpert&&selectedExpert.id!==expertId)setExpertId(selectedExpert.id)},[selectedExpert?.id]);

 const relevantDomains=useMemo(()=>{
   if(selectedId!=='aar'||!selectedSite) return DOMAINS;
   const events=(session.activeEvents[company.id]||[]).filter(e=>e.isResolved&&(e.card.scope==='enterprise'||e.targetSiteId===selectedSite.id));
   const found=new Set<KnowledgeDomain>(); events.forEach(e=>e.card.domains.forEach(r=>found.add(r.domain)));
   return DOMAINS.filter(d=>found.has(d));
 },[selectedId,selectedSite,session.activeEvents,company.id]);
 useEffect(()=>{if(selectedId==='aar'&&relevantDomains.length&&!relevantDomains.includes(domain))setDomain(relevantDomains[0])},[selectedId,relevantDomains,domain]);

 const expected=useMemo(()=>{
   if(selectedId==='transfer'){const b=selectedSite?.teamCapability[domain]??0;return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Team ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='corporate-training')return `${activeSites.filter(s=>s.teamCapability[domain]<company.intranet[domain]).length} site(s) can gain +1 Team Capability`;
   if(selectedId==='codify-site'){const b=selectedSite?.codifiedKnowledge[domain]??0;return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Docs ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='train-expert'){const s=selectedExpert?.domains.find(x=>x.domain===domain);return s?`${selectedExpert?.name} ${DOMAIN_INFO[domain].label} ${s.score} → ${Math.min(8,s.score+1)}`:'Choose a domain held by the expert';}
   if(selectedId==='update-intranet')return `${DOMAIN_INFO[domain].label} Corporate Intranet ${company.intranet[domain]} → higher if source knowledge exists`;
   if(selectedId==='aar'){const b=learningTarget==='team'?(selectedSite?.teamCapability[domain]??0):(selectedSite?.codifiedKnowledge[domain]??0);return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} ${learningTarget==='team'?'Team':'Docs'} ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='join-cop')return `Commit ${selectedExpert?.name||'an expert'} to the ${DOMAIN_INFO[domain].label} CoP`;
   return `Arm ${DOMAIN_INFO[domain].label} Horizon Scan for round ${session.round+1}`;
 },[selectedId,selectedSite,selectedExpert,domain,learningTarget,activeSites,company.intranet,session.round]);

 const commit=()=>{
   const map:Record<InterventionId,[string,any]>={
    'transfer':['KNOWLEDGE_TRANSFER',{siteId,expertId,domain}],
    'corporate-training':['CORPORATE_TRAINING',{domain}],
    'codify-site':['CODIFY_SITE',{siteId,domain}],
    'train-expert':['TRAIN_EXPERT',{expertId,domain}],
    'update-intranet':['UPDATE_INTRANET',{domain}],
    'aar':['LESSONS_LEARNED',{siteId,domain,learningTarget}],
    'join-cop':['JOIN_COP',{expertId,domain}],
    'horizon-scan':['HORIZON_SCAN',{domain}],
   }; const [type,params]=map[selectedId]; onPerformAction(type,params);
 };
 const needsSite=['transfer','codify-site','aar'].includes(selectedId);
 const needsExpert=['transfer','train-expert','join-cop'].includes(selectedId);
 const anchorTitle=(id:AnchorId)=>ANCHORS.find(a=>a.id===id)!.title;

 return <div className="fixed left-3 right-3 top-[94px] bottom-3 z-[90] rounded-3xl border border-slate-700 bg-[#080b12]/[0.985] shadow-2xl p-3 overflow-hidden flex flex-col">
   <div className="flex items-center justify-between gap-4 shrink-0"><div><div className="text-[10px] uppercase tracking-[0.18em] text-indigo-300 font-black">Invest</div><h2 className="text-xl font-black text-white">Build capability for the next round</h2></div><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"><b className="text-white">{company.actionsRemaining}</b> / {session.config.actions_per_round} actions left</div><button onClick={onNextPhase} className="rounded-xl border border-indigo-500 bg-indigo-950 px-4 py-2 font-black text-indigo-100 flex items-center gap-2">Finish investing <ArrowRight className="w-4 h-4"/></button></div></div>
   <div className="mt-3 grid grid-cols-[230px_minmax(0,1fr)_300px] gap-3 min-h-0 flex-1">
     <div className="space-y-1.5 min-h-0"><div className="text-[9px] uppercase tracking-wider text-slate-500 font-black">Knowledge capabilities</div>{ANCHORS.map(a=>{const Icon=a.icon;const active=selected.anchor===a.id;return <div key={a.id} className={`rounded-lg border px-2.5 py-2 ${a.disabled?'border-slate-800 bg-slate-950/60 opacity-45':active?'border-indigo-400 bg-indigo-950/70':'border-slate-700 bg-slate-900'}`}><div className="flex items-center gap-2"><Icon className="w-4 h-4"/><b className="text-xs">{a.title}</b></div><div className="text-[9px] text-slate-500 mt-0.5">{a.description}</div></div>})}</div>
     <div className="min-h-0"><div className="text-[9px] uppercase tracking-wider text-emerald-400 font-black mb-1.5">Knowledge-building interventions — yellow arrows show what capability each intervention creates</div><div className="grid grid-cols-2 gap-2">{INTERVENTIONS.map(item=>{const Icon=item.icon;const active=item.id===selectedId;return <button key={item.id} onClick={()=>setSelectedId(item.id)} className={`rounded-xl border-2 px-3 py-2 text-left min-h-[88px] ${active?'border-white bg-emerald-800':'border-emerald-800 bg-emerald-950/75 hover:border-emerald-500'}`}><div className="flex items-start gap-2"><Icon className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5"/><div className="min-w-0"><b className="text-sm text-white">{item.title}</b><div className="text-[10px] text-emerald-100/70 leading-snug">{item.description}</div></div></div><div className="mt-1.5 flex items-center gap-1 text-amber-300 text-[10px] font-black"><ArrowLeft className="w-4 h-4 stroke-[3]"/> creates: {anchorTitle(item.anchor)}</div></button>})}</div></div>
     <div className="rounded-2xl border border-slate-600 bg-slate-900 p-3 min-h-0"><div className="text-[9px] uppercase tracking-wider text-indigo-300 font-black">Investment action</div><h3 className="text-lg font-black text-white">{selected.title}</h3><div className="mt-2 space-y-2">{needsSite&&<label className="block text-[9px] uppercase text-slate-500 font-black">Site<select value={siteId} onChange={e=>setSiteId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case">{activeSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}{needsExpert&&<label className="block text-[9px] uppercase text-slate-500 font-black">Expert<select value={expertId} onChange={e=>setExpertId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case">{activeExperts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}<label className="block text-[9px] uppercase text-slate-500 font-black">Domain<select value={domain} onChange={e=>setDomain(e.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case">{relevantDomains.map(d=><option key={d} value={d}>{DOMAIN_INFO[d].label}</option>)}</select></label>{selectedId==='aar'&&<label className="block text-[9px] uppercase text-slate-500 font-black">Capture as<select value={learningTarget} onChange={e=>setLearningTarget(e.target.value as 'team'|'codified')} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case"><option value="team">Team Capability</option><option value="codified">Local Codified Knowledge</option></select></label>}</div><div className="mt-3 rounded-xl bg-slate-950 border border-slate-700 p-2"><div className="text-[9px] uppercase text-slate-500 font-black">Expected effect</div><div className="text-xs text-slate-200 mt-1">{expected}</div></div><div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">Cost</span><b>1 Action{selectedId==='train-expert'||selectedId==='join-cop'?' + turnover':''}</b></div><button onClick={commit} disabled={company.actionsRemaining<=0||(needsExpert&&!selectedExpert)||(needsSite&&!selectedSite)||(selectedId==='aar'&&relevantDomains.length===0)} className="mt-3 w-full rounded-xl bg-amber-400 text-slate-950 py-2.5 font-black disabled:bg-slate-800 disabled:text-slate-600">RUN · 1 ACTION</button>{selectedId==='aar'&&relevantDomains.length===0&&<div className="text-[10px] text-rose-300 mt-1">No resolved challenge at this site is available for Lessons Learned.</div>}</div>
   </div>
 </div>;
};
