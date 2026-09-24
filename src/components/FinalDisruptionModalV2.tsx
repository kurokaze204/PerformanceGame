import React,{useMemo,useState}from'react';
import{BookOpen,BriefcaseBusiness,CheckCircle2,XCircle}from'lucide-react';
import type{KnowledgeDomain}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import{evaluateFinalDisruptionV1,type FinalDisruptionSelectionsV1}from'../engine/disruptionPlusV1.ts';
import{formatCurrency}from'../utils/format.ts';

interface Props{session:GameSessionV2;company:CompanyV2;onResolveFinalDisruption:()=>Promise<void>|void;onOpenAAR:()=>void;}

const ScoreChip:React.FC<{label:string;value:number;muted?:boolean}>=({label,value,muted})=><div className={'rounded-lg border px-2 py-1.5 text-center '+(muted?'border-slate-800 bg-slate-950/50 text-slate-600':'border-slate-700 bg-slate-950 text-slate-200')}><div className="text-[8px] uppercase font-black tracking-wide">{label}</div><div className="text-lg font-black">{value}</div></div>;

export const FinalDisruptionModalV2:React.FC<Props>=({session,company,onOpenAAR})=>{
 const card=company.disruptionCard;
 const stored=((session as any).finalDisruptionResults||[]) as any[];
 const companyResult=stored.find(result=>result.companyId===company.id);
 const[selections,setSelections]=useState<FinalDisruptionSelectionsV1>({});
 const[useConsultant,setUseConsultant]=useState(false);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState('');
 const evaluation=useMemo(()=>evaluateFinalDisruptionV1(session,company,selections),[session,company,selections]);
 if(!card||!evaluation)return null;
 const resolved=Boolean(companyResult);
 const expertsFor=(domain:KnowledgeDomain)=>company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>skill.domain===domain));
 const chooseExpert=(domain:KnowledgeDomain,expertId:string)=>setSelections(current=>({...current,[domain]:{expertId:expertId||undefined}}));
 const resolve=async()=>{
  if(busy||resolved)return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/sessions/'+session.id+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,actionType:'FINAL_DISRUPTION_RESOLVE',params:{selections,useConsultant}})});
   const data=await response.json();
   if(!response.ok||data.success===false){setMessage(data.message||data.error||'Could not resolve the Disruption.');setBusy(false);return}
   setMessage('Disruption resolved.');setBusy(false);
  }catch(error:any){setMessage(error.message||'Could not resolve the Disruption.');setBusy(false)}
 };
 return <div className="fixed inset-x-3 top-[94px] bottom-3 z-[170] rounded-3xl border-2 border-amber-500 bg-[#090b10]/[0.99] shadow-2xl p-4 overflow-auto text-slate-200" role="dialog" aria-modal="true">
  <div className="mx-auto max-w-[1040px]">
   <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
    <div><div className="text-[10px] uppercase tracking-[.18em] text-amber-300 font-black">Final round</div><h2 className="text-2xl font-black text-white">Disruption</h2></div>
    <div className="text-right"><div className="text-[9px] uppercase text-slate-500 font-black">Current turnover</div><div className="text-xl font-black text-emerald-300">{formatCurrency(company.turnover)}</div></div>
   </div>
   {!resolved?<div className="mt-4 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
    <section className="rounded-[20px] border-[5px] border-amber-300 bg-[#171109] p-5 shadow-xl">
     <div className="text-[11px] font-black tracking-[.18em] text-amber-200">DISRUPTION</div>
     <h3 className="mt-2 text-xl font-black leading-tight text-white">{card.title}</h3>
     <div className="mt-4 rounded-xl border border-amber-800 bg-black/25 p-3"><div className="text-[9px] uppercase tracking-wider text-amber-400 font-black">Site</div><div className="text-lg font-black text-white">{card.siteName}</div></div>
     <div className="mt-3 space-y-2">{card.domains.map(req=><div key={req.domain} className="flex items-center justify-between rounded-xl border border-amber-900/70 bg-black/20 px-3 py-2"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{backgroundColor:DOMAIN_INFO[req.domain].color}}/><b className="text-sm text-white">{DOMAIN_INFO[req.domain].label}</b></div><b className="text-2xl text-amber-100">{req.difficulty}</b></div>)}</div>
     <div className="mt-4 border-t border-amber-900 pt-3 text-center"><div className="text-[9px] uppercase text-slate-500 font-black">Loss if you cannot respond</div><div className="text-2xl font-black text-rose-300">−{formatCurrency(card.impact)}</div></div>
    </section>
    <section className="space-y-3">
     <div className="grid md:grid-cols-2 gap-3">{evaluation.domainResults.map(result=>{
      const experts=expertsFor(result.domain);
      const selected=selections[result.domain]?.expertId||'';
      const enough=result.totalKnowledge>=result.difficulty;
      return <div key={result.domain} className={'rounded-2xl border-2 p-4 '+(enough?'border-emerald-700 bg-emerald-950/20':'border-slate-700 bg-slate-900')}>
       <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{backgroundColor:DOMAIN_INFO[result.domain].color}}/><b className="text-base text-white">{DOMAIN_INFO[result.domain].label}</b></div><div className={'text-3xl font-black '+(enough?'text-emerald-300':'text-white')}>{result.totalKnowledge}<span className="text-slate-600">/</span>{result.difficulty}</div></div>
       <div className={'mt-3 grid gap-1.5 '+(session.experienceMode==='expert'?'grid-cols-5':'grid-cols-4')}><ScoreChip label="Local" value={result.local}/><ScoreChip label="Corporate" value={result.corporate}/>{session.experienceMode==='expert'&&<ScoreChip label="Codified" value={result.localCodified}/>}<ScoreChip label="Expert" value={result.expertScore}/><ScoreChip label="CoP" value={result.copScore} muted={!result.copScore}/></div>
       <label className="mt-3 block text-[9px] uppercase tracking-wide text-slate-500 font-black">Expert<select value={selected} onChange={event=>chooseExpert(result.domain,event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm normal-case text-white"><option value="">No expert</option>{experts.map(expert=>{const score=expert.domains.find(skill=>skill.domain===result.domain)?.score||0;return <option key={expert.id} value={expert.id}>{expert.name} · +{score}</option>})}</select></label>
       {result.copScore>0&&<div className="mt-2 text-[10px] text-emerald-300">CoP access: +{result.copScore}{result.copSourceCompanyName?' from '+result.copSourceCompanyName:''}</div>}
      </div>})}</div>
     <button type="button" onClick={()=>setUseConsultant(value=>!value)} disabled={evaluation.gap===0} className={'w-full rounded-2xl border-2 p-4 text-left disabled:opacity-40 '+(useConsultant?'border-amber-300 bg-amber-950/35':'border-slate-700 bg-slate-900')}>
      <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><BriefcaseBusiness className="h-6 w-6 text-amber-300"/><div><div className="text-sm font-black text-white">Emergency Consultant</div><div className="text-[11px] text-slate-400">{evaluation.gap===0?'No knowledge gap to fill.':'Fills every remaining knowledge gap.'}</div></div></div><div className="text-right"><div className="text-2xl font-black text-amber-200">{formatCurrency(evaluation.consultantCost)}</div><div className="text-[10px] text-slate-400">{evaluation.consultantPercent.toFixed(0)}% of company turnover</div></div></div>
     </button>
     <button onClick={resolve} disabled={busy} className="w-full rounded-2xl bg-white py-4 text-base font-black text-slate-950 disabled:opacity-50">{busy?'RESOLVING…':useConsultant?'HIRE CONSULTANT & RESOLVE':'RESOLVE DISRUPTION'}</button>
     {message&&<div className="text-center text-xs font-bold text-amber-200">{message}</div>}
    </section>
   </div>:<div className="mt-8 mx-auto max-w-2xl">
    <div className={'rounded-3xl border-2 p-6 text-center '+(companyResult.success?'border-emerald-600 bg-emerald-950/25':'border-rose-600 bg-rose-950/25')}>
     {companyResult.success?<CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300"/>:<XCircle className="mx-auto h-12 w-12 text-rose-300"/>}
     <div className="mt-2 text-[11px] uppercase tracking-[.18em] font-black text-slate-400">{companyResult.success?'Disruption survived':'Disruption failed'}</div>
     <div className="mt-1 text-4xl font-black text-white">{formatCurrency(companyResult.finalTurnover)}</div>
     <div className="mt-1 text-xs text-slate-400">Final turnover</div>
     {companyResult.consultantCost>0&&<div className="mt-4 rounded-xl border border-amber-700 bg-amber-950/30 p-3"><div className="text-[10px] uppercase font-black text-amber-400">Emergency consultant</div><div className="text-2xl font-black text-amber-100">−{formatCurrency(companyResult.consultantCost)}</div></div>}
     <div className="mt-4 grid grid-cols-2 gap-2">{(companyResult.domainResults||[]).map((result:any)=><div key={result.domain} className={'rounded-xl border p-3 '+(result.domainSuccess?'border-emerald-800':'border-rose-800')}><div className="text-xs font-black text-white">{DOMAIN_INFO[result.domain as KnowledgeDomain]?.label||result.domain}</div><div className="mt-1 text-xl font-black text-white">{result.totalKnowledge}/{result.requiredTotal}</div></div>)}</div>
    </div>
    <button onClick={onOpenAAR} disabled={!session.finalDisruptionResolved} className="mt-4 w-full rounded-xl border border-indigo-500 bg-indigo-600 px-4 py-3.5 font-black text-white flex items-center justify-center gap-2 disabled:opacity-40"><BookOpen className="h-4 w-4"/>{session.finalDisruptionResolved?'START AFTER ACTION REVIEW':'WAITING FOR OTHER COMPANIES'}</button>
   </div>}
  </div>
 </div>;
};
