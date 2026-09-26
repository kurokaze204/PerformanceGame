import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Building2, GraduationCap, Network, Radar, Sparkles, Users, Bot, ArrowRightLeft } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { INVESTMENT_COSTS_V4, copPeerKnowledgeScoreV4, expertTravelCostV4 } from '../engine/investmentActionsV4.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { interventionUnlocked } from '../engine/experienceModeV3.ts';
import { localCodifiedVisible } from '../engine/learningCurveBalanceV1.ts';
import { riverSiteKnowledgeScore, riverTransferTarget } from '../engine/riverKnowledgeV1.ts';
import { formatCurrency } from '../utils/format.ts';
import { InvestmentRiverView } from './InvestmentRiverView.tsx';
import { DisruptionMiniCard } from './DisruptionCardV1.tsx';

interface Props { session: GameSessionV2; company: CompanyV2; onPerformAction: (type:string, params:any)=>void; onNextPhase:()=>void; }
type InterventionId='knowledge-transfer'|'local-training'|'corporate-training'|'codify-site'|'train-expert'|'update-intranet'|'aar'|'join-cop'|'horizon-scan'|'automate';
type AnchorId='existing'|'expert'|'network'|'favour'|'external'|'risk';
type Intervention={id:InterventionId; title:string; description:string; anchor:AnchorId; icon:React.ElementType; actionType:string};
const DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];
const INTERVENTIONS:Intervention[]=[
 {id:'knowledge-transfer',title:'Knowledge Transfer',description:'Move proven know-how directly from one site to another.',anchor:'existing',icon:ArrowRightLeft,actionType:'SITE_KNOWLEDGE_SHARING'},
 {id:'local-training',title:'Local Training',description:'An expert coaches one local team, increasing Team Capability by +1.',anchor:'existing',icon:Users,actionType:'KNOWLEDGE_TRANSFER'},
 {id:'corporate-training',title:'Corporate Training',description:'Raise Team Capability at every site that can benefit (+1).',anchor:'existing',icon:Building2,actionType:'CORPORATE_TRAINING'},
 {id:'codify-site',title:'Codify Site Knowledge',description:'Turn local know-how into reusable documentation (+1 Local Codified).',anchor:'existing',icon:BookOpen,actionType:'CODIFY_SITE'},
 {id:'train-expert',title:'Train Expert',description:'Deepen one expert domain by +1.',anchor:'expert',icon:GraduationCap,actionType:'TRAIN_EXPERT'},
 {id:'update-intranet',title:'Update Corporate Intranet',description:'Publish stronger organisational knowledge into the corporate knowledge base.',anchor:'existing',icon:Building2,actionType:'UPDATE_INTRANET'},
 {id:'join-cop',title:'Join Community of Practice',description:'Connect an expert to external peers and gain network support for two future rounds.',anchor:'network',icon:Network,actionType:'JOIN_COP'},
 {id:'aar',title:'Lessons Learned / AAR',description:'Turn one completed challenge into +1 local capability.',anchor:'existing',icon:Sparkles,actionType:'LESSONS_LEARNED'},
 {id:'horizon-scan',title:'Horizon Scan',description:'Scout a domain so matching Events can be anticipated next round.',anchor:'risk',icon:Radar,actionType:'HORIZON_SCAN'},
 {id:'automate',title:'Automation',description:'Embed critical domain knowledge in systems (+2 on future challenges).',anchor:'existing',icon:Bot,actionType:'AUTOMATE'},
];
function costFor(actionType:string){return INVESTMENT_COSTS_V4[actionType]||0;}

export const ActionsPanelV5:React.FC<Props>=({session,company,onPerformAction,onNextPhase})=>{
 const showLocalCodified=localCodifiedVisible(session.experienceMode);
 const resolvedEvents=(session.activeEvents[company.id]||[]).filter(e=>e.isResolved);
 const tutorialEvent=resolvedEvents.find(e=>e.card.tags?.includes(PROGRAMMED_FAILURE_TAG));
 const tutorialComplete=Boolean(tutorialEvent&&tutorialEvent.success===false);
 const lessonKey=`tpg_intranet_unlock_${session.id}_${company.id}`;
 const [showIntranetLesson,setShowIntranetLesson]=useState(()=>tutorialComplete&&!localStorage.getItem(lessonKey));
 const transferUnlocked=session.experienceMode==='expert'||session.round>1||tutorialComplete;
 const visibleInterventions=INTERVENTIONS.filter(item=>interventionUnlocked(session.experienceMode,session.round,item.actionType)
   &&(item.actionType!=='UPDATE_INTRANET'||transferUnlocked)
   &&(item.actionType!=='SITE_KNOWLEDGE_SHARING'||transferUnlocked));
 const [selectedId,setSelectedId]=useState<InterventionId>(visibleInterventions[0]?.id||'local-training');
 const activeSites=company.sites.filter(s=>!s.isClosed);
 const activeExperts=company.experts.filter(e=>!e.isVacant);
 const [siteId,setSiteId]=useState(activeSites[0]?.id||'');
 const [sourceSiteId,setSourceSiteId]=useState(activeSites[1]?.id||activeSites[0]?.id||'');
 const [expertId,setExpertId]=useState(activeExperts[0]?.id||'');
 const [domain,setDomain]=useState<KnowledgeDomain>('engineering');
 const [learningTarget,setLearningTarget]=useState<'team'|'codified'>('team');
 const [aarEventId,setAarEventId]=useState(resolvedEvents[0]?.instanceId||'');
 const selected=visibleInterventions.find(i=>i.id===selectedId)||visibleInterventions[0];
 const selectedAarEvent=resolvedEvents.find(e=>e.instanceId===aarEventId)||resolvedEvents[0];
 const selectedSite=activeSites.find(s=>s.id===siteId)||activeSites[0];
 const sourceSite=activeSites.find(s=>s.id===sourceSiteId)||activeSites.find(s=>s.id!==selectedSite?.id)||activeSites[0];
 const selectedExpert=activeExperts.find(e=>e.id===expertId)||activeExperts[0];
 useEffect(()=>{if(tutorialComplete&&!localStorage.getItem(lessonKey))setShowIntranetLesson(true)},[tutorialComplete,lessonKey]);
 useEffect(()=>{if(!visibleInterventions.some(i=>i.id===selectedId)&&visibleInterventions[0])setSelectedId(visibleInterventions[0].id)},[session.round,session.experienceMode,selectedId,tutorialComplete]);
 useEffect(()=>{if(selectedSite&&selectedSite.id!==siteId)setSiteId(selectedSite.id)},[selectedSite?.id]);
 useEffect(()=>{if(sourceSite&&sourceSite.id!==sourceSiteId)setSourceSiteId(sourceSite.id)},[sourceSite?.id]);
 useEffect(()=>{if(selectedExpert&&selectedExpert.id!==expertId)setExpertId(selectedExpert.id)},[selectedExpert?.id]);
 useEffect(()=>{if(resolvedEvents.length&&!resolvedEvents.some(e=>e.instanceId===aarEventId))setAarEventId(resolvedEvents[0].instanceId)},[aarEventId,resolvedEvents]);
 useEffect(()=>{if(selectedId==='aar'&&selectedAarEvent?.card.scope==='local'&&selectedAarEvent.targetSiteId)setSiteId(selectedAarEvent.targetSiteId)},[selectedId,selectedAarEvent?.instanceId]);
 useEffect(()=>{if(!showLocalCodified&&learningTarget!=='team')setLearningTarget('team')},[showLocalCodified,learningTarget]);
 if(!selected)return null;
 const tutorialDomain=tutorialEvent?.card.domains[0]?.domain;
 const tutorialSourceId=tutorialEvent?.card.tags?.find(tag=>tag.startsWith('tutorial-source:'))?.slice('tutorial-source:'.length);
 const tutorialTargetId=tutorialEvent?.card.tags?.find(tag=>tag.startsWith('tutorial-target:'))?.slice('tutorial-target:'.length);
 const tutorialSource=company.sites.find(site=>site.id===tutorialSourceId);
 const tutorialTarget=company.sites.find(site=>site.id===tutorialTargetId);
 const tutorialSourceScore=tutorialDomain&&tutorialSource?riverSiteKnowledgeScore(tutorialSource,tutorialDomain,session.experienceMode):0;
 const tutorialTargetScore=tutorialDomain&&tutorialTarget?riverSiteKnowledgeScore(tutorialTarget,tutorialDomain,session.experienceMode):0;
 const needsTargetSite=['knowledge-transfer','local-training','codify-site','aar'].includes(selectedId);
 const needsSourceSite=selectedId==='knowledge-transfer';
 const needsExpert=['local-training','train-expert','join-cop'].includes(selectedId);
 const relevantDomains=useMemo(()=>{
   if(selectedId==='aar')return selectedAarEvent?.card.domains.map(r=>r.domain)||[];
   if(selectedId==='train-expert'&&selectedExpert)return selectedExpert.domains.map(d=>d.domain);
   if((selectedId==='local-training'||selectedId==='join-cop')&&selectedExpert){const held=new Set(selectedExpert.domains.map(d=>d.domain));return DOMAINS.filter(d=>held.has(d));}
   return session.experienceMode==='newbie'?DOMAINS.filter(d=>d!=='finance'):DOMAINS;
 },[selectedId,selectedAarEvent,selectedExpert,session.experienceMode]);
 useEffect(()=>{if(relevantDomains.length&&!relevantDomains.includes(domain))setDomain(relevantDomains[0])},[relevantDomains,domain]);
 const peerScore=copPeerKnowledgeScoreV4(session,company,domain);
 const selectedExpertSkill=selectedExpert?.domains.find(x=>x.domain===domain)?.score;
 const travelCost=selectedId==='local-training'&&selectedExpert&&selectedSite?expertTravelCostV4(selectedExpert.location,selectedSite.id):0;
 const baseCost=costFor(selected.actionType);
 const totalCost=baseCost+travelCost;
 const bestSiteTeam=Math.max(0,...activeSites.map(s=>s.teamCapability[domain]||0));
 const bestSiteDocs=Math.max(0,...activeSites.map(s=>s.codifiedKnowledge[domain]||0));
 const bestLocal=showLocalCodified?Math.max(bestSiteTeam,bestSiteDocs):bestSiteTeam;
 const bestExpert=Math.max(0,...company.experts.filter(e=>!e.isVacant).flatMap(e=>e.domains.filter(d=>d.domain===domain).map(d=>d.score)));
 const investmentSite=needsTargetSite?selectedSite:(selectedId==='train-expert'&&selectedExpert?.location!=='HQ'?activeSites.find(s=>s.id===selectedExpert.location):undefined);
 const siteTurnoverAfter=investmentSite?Math.max(0,investmentSite.turnover-totalCost):null;
 const riverSourceScore=sourceSite?riverSiteKnowledgeScore(sourceSite,domain,session.experienceMode):0;
 const riverTargetBefore=selectedSite?.teamCapability[domain]||0;
 const riverTargetAfter=riverTransferTarget(riverSourceScore);
 const expected=useMemo(()=>{
   if(selectedId==='knowledge-transfer')return sourceSite&&selectedSite?`${sourceSite.name} ${DOMAIN_INFO[domain].label} ${riverSourceScore} → ${selectedSite.name} Team ${riverTargetBefore} → ${Math.max(riverTargetBefore,riverTargetAfter)}`:'Choose source and receiving sites';
   if(selectedId==='local-training'){const b=selectedSite?.teamCapability[domain]??0;return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Team ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='corporate-training')return `${activeSites.filter(s=>s.teamCapability[domain]<company.intranet[domain]).length} site(s) can gain +1 Team Capability`;
   if(selectedId==='codify-site'){const b=selectedSite?.codifiedKnowledge[domain]??0;return selectedSite?`${selectedSite.name} ${DOMAIN_INFO[domain].label} Docs ${b} → ${Math.min(6,b+1)}`:'Choose a site';}
   if(selectedId==='train-expert')return selectedExpertSkill!=null?`${selectedExpert?.name} ${DOMAIN_INFO[domain].label} ${selectedExpertSkill} → ${Math.min(8,selectedExpertSkill+1)}`:'Choose a domain held by the expert';
   if(selectedId==='update-intranet')return `${DOMAIN_INFO[domain].label} Corporate ${company.intranet[domain]} → higher if stronger source knowledge exists`;
   if(selectedId==='aar'){const target=showLocalCodified?learningTarget:'team';const b=target==='team'?(selectedSite?.teamCapability[domain]??0):(selectedSite?.codifiedKnowledge[domain]??0);return selectedAarEvent&&selectedSite?`AAR on “${selectedAarEvent.card.title}” → ${selectedSite.name} ${target==='team'?'Team Capability':'Docs'} ${b} → ${Math.min(6,b+1)}`:'Choose a completed challenge';}
   if(selectedId==='join-cop')return `Network support +${session.config.cop_support_bonus} for the next two rounds`;
   if(selectedId==='automate')return company.automatedDomains.includes(domain)?`${DOMAIN_INFO[domain].label} is already automated`:`Add +${session.config.automation_bonus} embedded knowledge to future ${DOMAIN_INFO[domain].label} challenges`;
   return `Arm ${DOMAIN_INFO[domain].label} Horizon Scan for round ${session.round+1}`;
 },[selectedId,selectedSite,sourceSite,selectedExpert,selectedExpertSkill,selectedAarEvent,domain,learningTarget,activeSites,company.intranet,company.automatedDomains,session.round,session.config,showLocalCodified,riverSourceScore,riverTargetBefore,riverTargetAfter]);
 const commit=()=>{
   const aarTarget=showLocalCodified?learningTarget:'team';
   const map:Record<InterventionId,[string,any]>={
    'knowledge-transfer':['SITE_KNOWLEDGE_SHARING',{sourceSiteId,siteId,domain}],
    'local-training':['KNOWLEDGE_TRANSFER',{siteId,expertId,domain}],
    'corporate-training':['CORPORATE_TRAINING',{domain}],
    'codify-site':['CODIFY_SITE',{siteId,domain}],
    'train-expert':['TRAIN_EXPERT',{expertId,domain}],
    'update-intranet':['UPDATE_INTRANET',{domain}],
    'aar':['LESSONS_LEARNED',{siteId,domain,learningTarget:aarTarget,eventInstanceId:selectedAarEvent?.instanceId}],
    'join-cop':['JOIN_COP',{expertId,domain}],
    'horizon-scan':['HORIZON_SCAN',{domain}],
    'automate':['AUTOMATE',{domain}],
   };
   const [type,params]=map[selectedId];onPerformAction(type,params);
 };
 const openTransfer=(id:'knowledge-transfer'|'update-intranet')=>{localStorage.setItem(lessonKey,'1');setShowIntranetLesson(false);setSelectedId(id);if(tutorialDomain)setDomain(tutorialDomain);if(tutorialSource)setSourceSiteId(tutorialSource.id);if(tutorialTarget)setSiteId(tutorialTarget.id)};
 const actionTotal=session.config.actions_per_round;
 const expertLocation=selectedExpert?(selectedExpert.location==='HQ'?'Corporate HQ':activeSites.find(s=>s.id===selectedExpert.location)?.name||selectedExpert.location):'';
 const aarSiteLocked=selectedId==='aar'&&selectedAarEvent?.card.scope==='local';
 const invalidRiver=selectedId==='knowledge-transfer'&&(!sourceSite||!selectedSite||sourceSite.id===selectedSite.id||riverTargetAfter<=riverTargetBefore);
 const riverTargetSiteId=needsTargetSite?selectedSite?.id:undefined;
 const riverSourceSiteId=needsSourceSite?sourceSite?.id:undefined;
 const riverExpertId=needsExpert?selectedExpert?.id:undefined;
 const riverHighlightHQ=selectedId==='update-intranet'||selectedId==='corporate-training';
 const riverHighlightAllSites=selectedId==='corporate-training';

 return <>
 {showIntranetLesson&&<div className="fixed inset-0 z-[150] bg-black/70 grid place-items-center p-6" role="dialog" aria-modal="true" aria-labelledby="intranet-unlock-title"><div className="w-full max-w-3xl rounded-3xl border-2 border-indigo-400 bg-slate-950 p-7 shadow-2xl"><div className="text-xs uppercase tracking-[0.2em] text-indigo-300 font-black">A knowledge gap is not always a knowledge shortage</div><h2 id="intranet-unlock-title" className="mt-2 text-3xl font-black text-white">The company knew. {tutorialTarget?.name||'This site'} didn’t.</h2><p className="mt-4 text-base leading-relaxed text-slate-300">{tutorialTarget?.name||'The affected site'} could reach about <b className="text-white">{tutorialTargetScore}</b> in {tutorialDomain?DOMAIN_INFO[tutorialDomain].label:'the required domain'}, while {tutorialSource?.name||'another site'} already held capability around <b className="text-white">{tutorialSourceScore}</b>. The knowledge existed inside the organisation; it was stranded in another place when the decision had to be made.</p><p className="mt-3 text-base leading-relaxed text-slate-300">You now have two different ways to move that knowledge around the company.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><button onClick={()=>openTransfer('knowledge-transfer')} className="rounded-2xl border-2 border-emerald-500 bg-emerald-950/60 p-5 text-left hover:border-emerald-300"><div className="flex items-center gap-3"><ArrowRightLeft className="h-6 w-6 text-emerald-300"/><b className="text-xl text-white">Knowledge Transfer</b></div><p className="mt-2 text-sm leading-relaxed text-slate-300">Move practice directly from the site that knows to the site that needs it. Fast and targeted, but it builds capability locally.</p></button><button onClick={()=>openTransfer('update-intranet')} className="rounded-2xl border-2 border-indigo-500 bg-indigo-950/60 p-5 text-left hover:border-indigo-300"><div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-indigo-300"/><b className="text-xl text-white">Corporate Intranet</b></div><p className="mt-2 text-sm leading-relaxed text-slate-300">Publish knowledge so it can be reached across the organisation. Broader access, but teams still need enough capability to understand and apply it.</p></button></div></div></div>}
 <div className="fixed left-3 right-3 min-[1280px]:right-[360px] top-[94px] bottom-[72px] z-[90] rounded-3xl border border-slate-700 bg-[#080b12]/[0.985] shadow-2xl p-4 overflow-hidden flex flex-col" role="region" aria-label="Investment actions">
   <div className="flex items-center justify-between gap-4 shrink-0"><div><div className="text-xs uppercase tracking-[0.18em] text-indigo-300 font-black">Invest</div><h2 className="text-2xl font-black text-white">Build capability for the next round</h2></div><div className="flex items-center gap-4"><div className="flex items-center gap-2" aria-label={`${company.actionsRemaining} of ${actionTotal} actions left`}><span className="text-xs uppercase text-slate-500 font-black mr-1">Actions</span>{Array.from({length:actionTotal},(_,i)=>{const available=i<company.actionsRemaining;return <div key={i} aria-hidden="true" className={`w-10 h-10 rounded-full border-2 grid place-items-center text-sm font-black ${available?'border-amber-300 bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40':'border-slate-700 bg-slate-950 text-slate-600'}`}>{i+1}</div>})}</div><button onClick={onNextPhase} className="rounded-xl border border-indigo-500 bg-indigo-950 px-4 py-3 font-black text-indigo-100 flex items-center gap-2">Finish investing <ArrowRight className="w-4 h-4"/></button></div></div>
   <div className="mt-3 flex min-h-0 flex-col gap-3">
     <div className="grid grid-cols-[minmax(0,1fr)_300px] items-stretch gap-3">
       <div className="min-h-[320px] min-w-0">
         <InvestmentRiverView company={company} mode={session.experienceMode} selectedDomain={domain} selectedSiteId={riverTargetSiteId} sourceSiteId={riverSourceSiteId} selectedExpertId={riverExpertId} highlightHQ={riverHighlightHQ} highlightAllSites={riverHighlightAllSites} highlightDomain showSiteLabels={selectedId==='knowledge-transfer'}/>
       </div>
       <aside className="w-[300px] shrink-0 rounded-2xl border border-slate-700 bg-slate-950/95 p-3">
         <div className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">Choose an investment</div>
         <div className="space-y-1.5">{visibleInterventions.map(item=>{const Icon=item.icon;const active=item.id===selectedId;const cost=costFor(item.actionType);return <button key={item.id} onClick={()=>setSelectedId(item.id)} className={`w-full rounded-xl border-2 px-3 py-1.5 text-left transition ${active?'border-amber-300 bg-amber-950/35':'border-slate-700 bg-slate-900 hover:border-emerald-500'}`}><div className="flex items-center gap-2"><Icon className={`h-4 w-4 shrink-0 ${active?'text-amber-300':'text-emerald-300'}`}/><b className="min-w-0 flex-1 text-[13px] leading-tight text-white">{item.title}</b><span className="text-[11px] font-black text-amber-300">{formatCurrency(cost)}</span></div></button>})}</div>
       </aside>
     </div>
     <div className="flex shrink-0 items-start gap-3">
       <div className="w-[218px] shrink-0"><DisruptionMiniCard company={company} wide/></div>
       <section className="min-w-0 flex-1 rounded-2xl border border-slate-600 bg-slate-900/95 p-3">
         <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-indigo-300">Selected investment</div><h3 className="text-lg font-black text-white">{selected.title}</h3></div><div className="text-sm font-black text-amber-300">{formatCurrency(totalCost)} · 1 Action</div></div>
         <div className="mt-2 flex items-end gap-3">
          <div className="grid min-w-0 flex-[1.2] grid-cols-3 gap-2">
           {selectedId==='aar'&&<label className="block text-[10px] uppercase text-slate-500 font-black">Recent challenge<select value={selectedAarEvent?.instanceId||''} onChange={e=>setAarEventId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white normal-case">{resolvedEvents.map(e=><option key={e.instanceId} value={e.instanceId}>{e.success===false?'FAIL':'SUCCESS'} · {e.card.title}</option>)}</select></label>}
           {needsSourceSite&&<label className="block text-[10px] uppercase text-slate-500 font-black">Teaching site<select value={sourceSiteId} onChange={e=>setSourceSiteId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white normal-case">{activeSites.map(s=><option key={s.id} value={s.id}>{s.name} · available {riverSiteKnowledgeScore(s,domain,session.experienceMode)}</option>)}</select></label>}
           {needsTargetSite&&<label className="block text-[10px] uppercase text-slate-500 font-black">{needsSourceSite?'Receiving site':'Site'}<select value={siteId} disabled={aarSiteLocked} onChange={e=>setSiteId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white normal-case disabled:opacity-60">{activeSites.map(s=><option key={s.id} value={s.id}>{s.name}{selectedId==='knowledge-transfer'?' · team '+(s.teamCapability[domain]||0):''}</option>)}</select></label>}
           {needsExpert&&<label className="block text-[10px] uppercase text-slate-500 font-black">Expert<select value={expertId} onChange={e=>setExpertId(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white normal-case">{activeExperts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
           <label className="block text-[10px] uppercase text-slate-500 font-black">Domain<select value={domain} onChange={e=>setDomain(e.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white normal-case">{relevantDomains.map(d=><option key={d} value={d}>{DOMAIN_INFO[d].label}</option>)}</select></label>
           {selectedId==='aar'&&showLocalCodified&&<label className="block text-[10px] uppercase text-slate-500 font-black">Capture as<select value={learningTarget} onChange={e=>setLearningTarget(e.target.value as 'team'|'codified')} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white normal-case"><option value="team">Team Capability</option><option value="codified">Local Codified Knowledge</option></select></label>}
          </div>
          <div className="min-w-[250px] flex-1 rounded-xl border border-slate-700 bg-slate-950/75 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">What changes</div><div className="mt-1 text-sm font-bold leading-snug text-slate-200">{expected}</div>{needsExpert&&selectedExpert&&<div className="mt-1 text-xs text-slate-500">{selectedExpert.name} · {expertLocation}{selectedExpert.isSPOF&&<span className="ml-1 font-black text-rose-300">SPOF</span>}</div>}{selectedId==='update-intranet'&&<div className="mt-1 text-xs text-slate-500">Corporate {company.intranet[domain]} · best local {bestLocal} · best expert {bestExpert}</div>}{selectedId==='join-cop'&&<div className="mt-1 text-xs text-slate-500">Our expert {selectedExpertSkill??0} · network {peerScore}</div>}</div>
          <div className="w-[210px] shrink-0"><button onClick={commit} disabled={company.actionsRemaining<=0||(needsExpert&&!selectedExpert)||(needsTargetSite&&!selectedSite)||invalidRiver||(selectedId==='aar'&&!selectedAarEvent)||(selectedId==='aar'&&relevantDomains.length===0)||(selectedId==='automate'&&company.automatedDomains.includes(domain))} className="w-full rounded-xl bg-amber-400 px-3 py-3 font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-600">RUN · {formatCurrency(totalCost)}</button>{invalidRiver&&<div className="mt-1 text-[11px] font-bold text-rose-300">Choose a stronger teaching site and a different receiving site.</div>}{investmentSite&&<div className="mt-1 text-[10px] text-slate-500">{investmentSite.name}: {formatCurrency(investmentSite.turnover)} → {formatCurrency(siteTurnoverAfter??investmentSite.turnover)}</div>}</div>
         </div>
       </section>
     </div>
   </div>
 </div>
 </>;
};