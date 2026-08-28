import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Building2, GraduationCap, Handshake, Network, Radar, Sparkles, Users, BriefcaseBusiness, Bot } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { INVESTMENT_COSTS_V4, copPeerKnowledgeScoreV4, expertTravelCostV4 } from '../engine/investmentActionsV4.ts';
import { formatCurrency } from '../utils/format.ts';

interface Props { session: GameSessionV2; company: CompanyV2; onPerformAction: (type:string, params:any)=>void; onNextPhase:()=>void; }
type InterventionId='transfer'|'corporate-training'|'codify-site'|'train-expert'|'update-intranet'|'aar'|'join-cop'|'horizon-scan'|'automate';
type AnchorId='existing'|'expert'|'network'|'favour'|'external'|'risk';
type Intervention={id:InterventionId; title:string; description:string; anchor:AnchorId; icon:React.ElementType; actionType:string};
const DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];
const ANCHORS:{id:AnchorId;title:string;description:string;disabled?:boolean;icon:React.ElementType}[]=[
 {id:'existing',title:'Use what we already know',description:'Boost accessible team, codified and embedded knowledge.',icon:Building2},
 {id:'expert',title:'Ask one of our experts to help',description:'Boost scarce expertise and make more of it reusable.',icon:Users},
 {id:'network',title:'Ask our network for help',description:'Boost access to knowledge beyond the organisation.',icon:Handshake},
 {id:'favour',title:'Call in a favour',description:'Challenge-response mechanism only.',disabled:true,icon:Sparkles},
 {id:'external',title:'Engage external expertise',description:'Non-preferred challenge-response mechanism only.',disabled:true,icon:BriefcaseBusiness},
 {id:'risk',title:'Accept the risk',description:'Boost foresight so risk can be handled more deliberately.',icon:Radar},
];
const INTERVENTIONS:Intervention[]=[
 {id:'transfer',title:'Knowledge Transfer',description:'Expert transfers domain expertise to a local team (+1 Team Capability).',anchor:'existing',icon:Users,actionType:'KNOWLEDGE_TRANSFER'},
 {id:'corporate-training',title:'Corporate Training',description:'Raise Team Capability at every site that can benefit (+1).',anchor:'existing',icon:Building2,actionType:'CORPORATE_TRAINING'},
 {id:'codify-site',title:'Codify Site Knowledge',description:'Turn local know-how into reusable documentation (+1 Local Codified).',anchor:'existing',icon:BookOpen,actionType:'CODIFY_SITE'},
 {id:'train-expert',title:'Train Expert',description:'Deepen one expert domain by +1.',anchor:'expert',icon:GraduationCap,actionType:'TRAIN_EXPERT'},
 {id:'update-intranet',title:'Update Corporate Intranet',description:'Publish stronger organisational knowledge into the corporate knowledge base.',anchor:'expert',icon:Building2,actionType:'UPDATE_INTRANET'},
 {id:'join-cop',title:'Join Community of Practice',description:'Connect an expert to external peers and gain +2 network support for two future rounds.',anchor:'network',icon:Network,actionType:'JOIN_COP'},
 {id:'aar',title:'Lessons Learned / AAR',description:'Turn a resolved challenge into +1 local team or codified capability.',anchor:'existing',icon:Sparkles,actionType:'LESSONS_LEARNED'},
 {id:'horizon-scan',title:'Horizon Scan',description:'Scout a domain so a matching event next round can be redrawn.',anchor:'risk',icon:Radar,actionType:'HORIZON_SCAN'},
 {id:'automate',title:'Automation',description:'Embed critical domain knowledge in systems (+2 on future challenges).',anchor:'existing',icon:Bot,actionType:'AUTOMATE'},
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

 const needsSite=['transfer','codify-site','aar'].includes(selectedId);
 const needsExpert=['transfer','train-expert','join-cop'].includes(selectedId);
 const relevantDomains=useMemo(()=>{
   if(selectedId==='aar'&&selectedSite){
     const events=(session.activeEvents[company.id]||[]).filter(e=>e.isResolved&&(e.card.scope==='enterprise'||e.targetSiteId===selectedSite.id));
     const found=new Set<KnowledgeDomain>(); events.forEach(e=>e.card.domains.forEach(r=>found.add(r.domain)));
     return DOMAINS.filter(d=>found.has(d));
   }
   if(selectedId==='train-expert'&&selectedExpert){
     return selectedExpert.domains.map(d=>d.domain);
   }
   if((selectedId==='transfer'||selectedId==='join-cop')&&selectedExpert){
     const held=new Set(selectedExpert.domains.map(d=>d.domain));
     return DOMAINS.filter(d=>held.has(d));
   }
   return DOMAINS;
 },[selectedId,selectedSite,selectedExpert,session.activeEvents,company.id]);
 useEffect(()=>{if(relevantDomains.length&&!relevantDomains.includes(domain))setDomain(relevantDomains[0])},[relevantDomains,domain]);

 const peerScore=copPeerKnowledgeScoreV4(session,company,domain);
 const selectedExpertSkill=selectedExpert?.domains.find(x=>x.domain===domain)?.score;
 const travelCost=selectedId==='transfer'&&selectedExpert&&selectedSite?expertTravelCostV4(selectedExpert.location,selectedSite.id):0;
 const baseCost=INVESTMENT_COSTS_V4[selected.actionType]||0;
 const totalCost=baseCost+travelCost;
 const bestSiteTeam=Math.max(0,...activeSites.map(s=>s.teamCapability[domain]||0));
 const bestSiteDocs=Math.max(0,...activeSites.map(s=>s.codifiedKnowledge[domain]||0));
 const bestExpert=Math.max(0,...company.experts.filter(e=>!e.isVacant).flatMap(e=>e.domains.filter(d=>d.domain===domain).map(d=>d.score)));

 const expected=useMemo(()=>{
   if(selectedId==='transfer'){const b=selectedSite?.teamCapability[domain]??0;return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Team ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='corporate-training')return `${activeSites.filter(s=>s.teamCapability[domain]<company.intranet[domain]).length} site(s) can gain +1 Team Capability`;
   if(selectedId==='codify-site'){const b=selectedSite?.codifiedKnowledge[domain]??0;return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Docs ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='train-expert')return selectedExpertSkill!=null?`${selectedExpert?.name} ${DOMAIN_INFO[domain].label} ${selectedExpertSkill} → ${Math.min(8,selectedExpertSkill+1)}`:'Choose a domain held by the expert';
   if(selectedId==='update-intranet')return `${DOMAIN_INFO[domain].label} Corporate ${company.intranet[domain]} → higher if source knowledge exists`;
   if(selectedId==='aar'){const b=learningTarget==='team'?(selectedSite?.teamCapability[domain]??0):(selectedSite?.codifiedKnowledge[domain]??0);return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} ${learningTarget==='team'?'Team':'Docs'} ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='join-cop')return `Network support +${session.config.cop_support_bonus} for Rounds ${session.round+1}–${Math.min(session.config.rounds,session.round+2)}`;
   if(selectedId==='automate')return company.automatedDomains.includes(domain)?`${DOMAIN_INFO[domain].label} is already automated`:`Add +${session.config.automation_bonus} embedded knowledge to future ${DOMAIN_INFO[domain].label} challenges`;
   return `Arm ${DOMAIN_INFO[domain].label} Horizon Scan for round ${session.round+1}`;
 },[selectedId,selectedSite,selectedExpert,selectedExpertSkill,domain,learningTarget,activeSites,company.intranet,company.automatedDomains,session.round,session.config]);

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
    'automate':['AUTOMATE',{domain}],
   }; const [type,params]=map[selectedId]; onPerformAction(type,params);
 };
 const anchorTitle=(id:AnchorId)=>ANCHORS.find(a=>a.id===id)!.title;
 const actionTotal=session.config.actions_per_round;
 const expertLocation=selectedExpert?(selectedExpert.location==='HQ'?'Corporate HQ':activeSites.find(s=>s.id===selectedExpert.location)?.name||selectedExpert.location):'';

 return <div className="fixed left-3 right-3 top-[94px] bottom-3 z-[90] rounded-3xl border border-slate-700 bg-[#080b12]/[0.985] shadow-2xl p-3 overflow-hidden flex flex-col">
   <div className="flex items-center justify-between gap-4 shrink-0"><div><div className="text-[10px] uppercase tracking-[0.18em] text-indigo-300 font-black">Invest</div><h2 className="text-xl font-black text-white">Build capability for the next round</h2></div><div className="flex items-center gap-4"><div className="flex items-center gap-2" aria-label={`${company.actionsRemaining} of ${actionTotal} actions left`}><span className="text-[10px] uppercase text-slate-500 font-black mr-1">Actions</span>{Array.from({length:actionTotal},(_,i)=>{const available=i<company.actionsRemaining;return <div key={i} className={`w-9 h-9 rounded-full border-2 grid place-items-center text-sm font-black ${available?'border-amber-300 bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40':'border-slate-700 bg-slate-950 text-slate-600'}`}>{i+1}</div>})}</div><button onClick={onNextPhase} className="rounded-xl border border-indigo-500 bg-indigo-950 px-4 py-2 font-black text-indigo-100 flex items-center gap-2">Finish investing <ArrowRight className="w-4 h-4"/></button></div></div>
   <div className="mt-3 grid grid-cols-[230px_minmax(0,1fr)_320px] gap-3 min-h-0 flex-1">
     <div className="space-y-1.5 min-h-0"><div className="text-[9px] uppercase tracking-wider text-slate-500 font-black">Knowledge capabilities</div>{ANCHORS.map(a=>{const Icon=a.icon;const active=selected.anchor===a.id;return <div key={a.id} className={`rounded-lg border px-2.5 py-2 ${a.disabled?'border-slate-800 bg-slate-950/60 opacity-45':active?'border-violet-300 bg-violet-950/80 shadow-lg shadow-violet-950/40':'border-slate-700 bg-slate-900'}`}><div className="flex items-center gap-2"><Icon className="w-4 h-4"/><b className="text-xs">{a.title}</b></div><div className="text-[9px] text-slate-500 mt-0.5">{a.description}</div></div>})}</div>
     <div className="min-h-0"><div className="text-[9px] uppercase tracking-wider text-emerald-400 font-black mb-1.5">Knowledge-building interventions — yellow arrows show which capability each intervention boosts</div><div className="grid grid-cols-3 gap-2">{INTERVENTIONS.map(item=>{const Icon=item.icon;const active=item.id===selectedId;const cost=INVESTMENT_COSTS_V4[item.actionType]||0;return <button key={item.id} onClick={()=>setSelectedId(item.id)} className={`rounded-xl border-2 px-3 py-2 text-left min-h-[92px] ${active?'border-white bg-emerald-800':'border-emerald-800 bg-emerald-950/75 hover:border-emerald-500'}`}><div className="flex items-start gap-2"><Icon className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5"/><div className="min-w-0"><div className="flex justify-between gap-2"><b className="text-sm text-white">{item.title}</b><span className="text-[10px] font-black text-amber-300 whitespace-nowrap">{formatCurrency(cost)}</span></div><div className="text-[10px] text-emerald-100/70 leading-snug">{item.description}</div></div></div><div className="mt-1.5 flex items-center gap-1 text-amber-300 text-[10px] font-black"><ArrowLeft className="w-4 h-4 stroke-[3]"/> boosts: {anchorTitle(item.anchor)}</div></button>})}</div></div>
     <div className="rounded-2xl border border-slate-600 bg-slate-900 p-3 min-h-0 overflow-auto"><div className="text-[9px] uppercase tracking-wider text-indigo-300 font-black">Investment action</div><h3 className="text-lg font-black text-white">{selected.title}</h3><div className="mt-2 space-y-2">{needsSite&&<label className="block text-[9px] uppercase text-slate-500 font-black">Site<select value={siteId} onChange={e=>setSiteId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case">{activeSites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}{needsExpert&&<label className="block text-[9px] uppercase text-slate-500 font-black">Expert<select value={expertId} onChange={e=>setExpertId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case">{activeExperts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}{needsExpert&&selectedExpert&&<div className="rounded-xl border border-violet-700 bg-violet-950/35 p-2"><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-black text-white">{selectedExpert.name}</div><div className="text-[10px] text-violet-200/70">{expertLocation}</div></div>{selectedExpert.isSPOF&&<span className="rounded-full border border-rose-700 bg-rose-950 px-2 py-0.5 text-[9px] font-black text-rose-200">SPOF</span>}</div><div className="grid grid-cols-2 gap-1 mt-2">{selectedExpert.domains.map(skill=><div key={skill.domain} className={`rounded-lg border px-2 py-1.5 ${skill.domain===domain?'border-amber-300 bg-amber-950/40':'border-violet-900 bg-slate-950/70'}`}><div className="text-[9px] text-slate-400">{DOMAIN_INFO[skill.domain].label}</div><div className="text-lg font-black text-white">{skill.score}</div></div>)}</div></div>}<label className="block text-[9px] uppercase text-slate-500 font-black">Domain<select value={domain} onChange={e=>setDomain(e.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case">{relevantDomains.map(d=><option key={d} value={d}>{DOMAIN_INFO[d].label}</option>)}</select></label>{selectedId==='aar'&&<label className="block text-[9px] uppercase text-slate-500 font-black">Capture as<select value={learningTarget} onChange={e=>setLearningTarget(e.target.value as 'team'|'codified')} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-white normal-case"><option value="team">Team Capability</option><option value="codified">Local Codified Knowledge</option></select></label>}</div>
       <div className="mt-3 rounded-xl bg-slate-950 border border-slate-700 p-2"><div className="text-[9px] uppercase text-slate-500 font-black">Expected effect</div><div className="text-xs text-slate-200 mt-1">{expected}</div></div>
       <div className="mt-2 rounded-xl border border-indigo-800 bg-indigo-950/30 p-2"><div className="text-[9px] uppercase text-indigo-300 font-black">Knowledge snapshot</div>{needsSite&&selectedSite&&<div className="grid grid-cols-3 gap-1 mt-1 text-center"><Metric label="Team" value={selectedSite.teamCapability[domain]}/><Metric label="Local docs" value={selectedSite.codifiedKnowledge[domain]}/><Metric label="Corporate" value={company.intranet[domain]}/></div>}{needsExpert&&selectedExpert&&<div className="mt-1 text-[10px] text-slate-300"><b className="text-white">{selectedExpert.name}</b> · {DOMAIN_INFO[domain].label} <b>{selectedExpertSkill??'—'}</b> · {expertLocation}{selectedExpert.isSPOF&&<span className="text-rose-300 font-black"> · SPOF</span>}</div>}{selectedId==='corporate-training'&&<div className="mt-1 text-[10px] text-slate-300 leading-relaxed">{activeSites.map(s=>`${s.name} ${s.teamCapability[domain]}`).join(' · ')} · Corporate {company.intranet[domain]}</div>}{selectedId==='update-intranet'&&<div className="grid grid-cols-3 gap-1 mt-1 text-center"><Metric label="Corporate" value={company.intranet[domain]}/><Metric label="Best local" value={Math.max(bestSiteTeam,bestSiteDocs)}/><Metric label="Best expert" value={bestExpert}/></div>}{selectedId==='join-cop'&&<div className="grid grid-cols-3 gap-1 mt-1 text-center"><Metric label="Our expert" value={selectedExpertSkill??0}/><Metric label="Our corporate" value={company.intranet[domain]}/><Metric label="CoP network" value={peerScore}/></div>}{selectedId==='horizon-scan'&&<div className="grid grid-cols-3 gap-1 mt-1 text-center"><Metric label="Best team" value={bestSiteTeam}/><Metric label="Best docs" value={bestSiteDocs}/><Metric label="Corporate" value={company.intranet[domain]}/></div>}{selectedId==='automate'&&<div className="mt-1 text-[10px] text-slate-300">Current Corporate {company.intranet[domain]} · Best local {Math.max(bestSiteTeam,bestSiteDocs)} · Automation bonus <b className="text-white">+{session.config.automation_bonus}</b> · {company.automatedDomains.includes(domain)?'Already automated':'Not automated'}</div>}</div>
       <div className="mt-2 rounded-xl border border-amber-800/70 bg-amber-950/30 p-2"><div className="flex justify-between text-xs"><span className="text-amber-200">Investment cost</span><b className="text-white">{formatCurrency(totalCost)}</b></div><div className="text-[10px] text-slate-400 mt-0.5">Base {formatCurrency(baseCost)}{travelCost>0?` + expert travel ${formatCurrency(travelCost)}`:''} · 1 Action</div></div>
       <button onClick={commit} disabled={company.actionsRemaining<=0||(needsExpert&&!selectedExpert)||(needsSite&&!selectedSite)||(selectedId==='aar'&&relevantDomains.length===0)||(selectedId==='automate'&&company.automatedDomains.includes(domain))} className="mt-3 w-full rounded-xl bg-amber-400 text-slate-950 py-2.5 font-black disabled:bg-slate-800 disabled:text-slate-600">RUN · 1 ACTION · {formatCurrency(totalCost)}</button>{selectedId==='aar'&&relevantDomains.length===0&&<div className="text-[10px] text-rose-300 mt-1">No resolved challenge at this site is available for Lessons Learned.</div>}
     </div>
   </div>
 </div>;
};

const Metric:React.FC<{label:string;value:number|string}>=({label,value})=><div className="rounded-lg border border-indigo-900 bg-slate-950 p-1.5"><div className="text-[8px] uppercase text-slate-500 font-black">{label}</div><div className="text-lg font-black text-white">{value}</div></div>;
