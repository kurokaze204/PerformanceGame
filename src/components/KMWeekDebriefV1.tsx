import React,{useMemo,useState}from'react';
import{ArrowRight,Brain,CircleDollarSign,Medal,ShieldCheck,Target,Users,Workflow,X}from'lucide-react';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import{formatCurrency}from'../utils/format.ts';
import{KM_WEEK_SHOCK_GAP_COST}from'../engine/kmWeekV1.ts';
import{InvestmentRiverView}from'./InvestmentRiverView.tsx';

type Props={session:GameSessionV2;company:CompanyV2};

const COMPANY_COLORS=['#facc15','#38bdf8','#a78bfa','#34d399','#fb7185','#fb923c','#22d3ee','#c084fc'];

const scoreItems=(company:CompanyV2)=>[
 {label:'Business Performance',value:company.kmWeek?.score.business||0,max:12,icon:<CircleDollarSign className="h-3.5 w-3.5"/>},
 {label:'Expertise',value:company.kmWeek?.score.expertise||0,max:6,icon:<Brain className="h-3.5 w-3.5"/>},
 {label:'Local capability',value:company.kmWeek?.score.localCapability||0,max:9,icon:<Users className="h-3.5 w-3.5"/>},
 {label:'Knowledge Flow',value:company.kmWeek?.score.knowledgeFlow||0,max:6,icon:<Workflow className="h-3.5 w-3.5"/>},
 {label:'Squeaky clean',value:company.kmWeek?.score.resilience||0,max:15,icon:<ShieldCheck className="h-3.5 w-3.5"/>},
 {label:'KM Week goal',value:company.kmWeek?.score.goal||0,max:5,icon:<Target className="h-3.5 w-3.5"/>},
];

function beforeCompany(company:CompanyV2):CompanyV2{
 const snapshot=company.initialRiverSnapshot;
 return snapshot?{...company,sites:snapshot.sites,experts:snapshot.experts}:company;
}

const MiniScorePad:React.FC<{company:CompanyV2;color:string}>=({company,color})=><section className="rounded-2xl border-2 bg-slate-950/75 p-3" style={{borderColor:color}}>
 <div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-300"/><div className="text-xs font-black text-white">Score Pad</div><div className="ml-auto text-2xl font-black text-white">{company.kmWeek?.score.total||0}</div></div>
 <div className="mt-2 grid grid-cols-2 gap-1.5">{scoreItems(company).map(item=><div key={item.label} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5"><span className="text-slate-500">{item.icon}</span><span className="min-w-0 flex-1 truncate text-[9px] font-black text-slate-500">{item.label}</span><b className="text-sm text-white">{item.value}<span className="ml-0.5 text-[8px] text-slate-600">/{item.max}</span></b></div>)}</div>
</section>;

const SiteAuditSummary:React.FC<{company:CompanyV2}>=({company})=>{
 const checks=company.kmWeek?.shockChecks||[];
 if(!checks.length)return null;
 const cleared=checks.filter(check=>check.passed).length;
 const findings=checks.length-cleared;
 const totalFine=company.kmWeek?.auditFineTotal??checks.filter(check=>!check.passed).reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge)*KM_WEEK_SHOCK_GAP_COST,0);
 const before=company.kmWeek?.auditTurnoverBefore??company.turnover+totalFine;
 return <section className={'mt-3 rounded-2xl border-2 p-3 '+(findings?'border-rose-700 bg-rose-950/20':'border-emerald-700 bg-emerald-950/20')}>
  <div className={'text-[9px] font-black uppercase tracking-[.16em] '+(findings?'text-rose-300':'text-emerald-300')}>Site Audits result</div>
  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
   <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Audits cleared</div><div className="text-lg font-black text-white">{cleared}/{checks.length}</div></div>
   <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Findings</div><div className={'text-lg font-black '+(findings?'text-rose-200':'text-emerald-200')}>{findings}</div></div>
   <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Fines</div><div className={'text-lg font-black '+(totalFine?'text-rose-200':'text-emerald-200')}>{totalFine?'−'+formatCurrency(totalFine):formatCurrency(0)}</div></div>
   <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Turnover effect</div><div className="text-sm font-black text-white">{formatCurrency(before)} → {formatCurrency(company.turnover)}</div></div>
  </div>
  <p className="mt-2 text-[10px] text-slate-300">{findings?<>The findings attracted fines of {formatCurrency(totalFine)}.</>:<>All five Site Audits cleared — a 10-point Squeaky clean bonus.</>}</p>
 </section>;
};

const TurnoverGraph:React.FC<{companies:CompanyV2[];colors:string[]}>=({companies,colors})=>{
 const histories=companies.map(company=>{
  const recorded=company.kmWeek?.turnoverHistory||[];
  return recorded.length>1?recorded:[
   {label:'START',turnover:company.startingTurnover||company.turnover},
   {label:'END',turnover:company.turnover},
  ];
 });
 const all=histories.flatMap(history=>history.map(point=>point.turnover));
 const rawMin=Math.min(...all),rawMax=Math.max(...all);
 const padding=Math.max(20,(rawMax-rawMin)*.12);
 const min=Math.max(0,rawMin-padding),max=rawMax+padding,span=Math.max(1,max-min);
 const W=1080,H=245,left=70,right=30,top=24,bottom=42,innerW=W-left-right,innerH=H-top-bottom;
 const y=(value:number)=>top+innerH-((value-min)/span)*innerH;
 const x=(index:number,count:number)=>left+(count<=1?innerW/2:index*innerW/(count-1));
 const ticks=Array.from({length:4},(_,i)=>min+(span*i/3));
 const longest=histories.reduce((a,b)=>a.length>=b.length?a:b,[] as {label:string;turnover:number}[]);
 return <section className="rounded-2xl border-2 border-slate-700 bg-slate-950/80 p-4">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-300">Turnover</div><h3 className="text-lg font-black text-white">How the business moved while you built capability</h3></div><div className="flex flex-wrap gap-3">{companies.map((company,index)=><span key={company.id} className="flex items-center gap-1.5 text-[10px] font-black text-slate-300"><span className="h-2.5 w-5 rounded-full" style={{backgroundColor:colors[index]}}/>{company.name}</span>)}</div></div>
  <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Turnover graph for all companies">
   {ticks.map((value,index)=><g key={index}><line x1={left} x2={W-right} y1={y(value)} y2={y(value)} stroke="#243047"/><text x={left-10} y={y(value)+4} textAnchor="end" fill="#64748b" fontSize="11" fontWeight="700">{formatCurrency(Math.round(value))}</text></g>)}
   {longest.map((point,index)=>{const px=x(index,longest.length);return <g key={index}><line x1={px} x2={px} y1={top} y2={top+innerH} stroke="#172033"/><text x={px} y={H-14} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="700">{point.label}</text></g>})}
   {companies.map((company,index)=>{const history=histories[index];const points=history.map((point,i)=>`${x(i,history.length)},${y(point.turnover)}`).join(' ');return <g key={company.id}><polyline points={points} fill="none" stroke={colors[index]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>{history.map((point,i)=><circle key={i} cx={x(i,history.length)} cy={y(point.turnover)} r="4.5" fill={colors[index]} stroke="#020617" strokeWidth="2"/>)}</g>})}
  </svg>
 </section>;
};

const AARQuestions:React.FC<{open:boolean;onClose:()=>void}>=({open,onClose})=>!open?null:<>
 <button type="button" aria-label="Close After Action Review Questions" onClick={onClose} className="fixed inset-x-0 bottom-0 top-[66px] z-[180] bg-black/55"/>
 <aside className="kmw-aar-slide-in fixed bottom-0 right-0 top-[66px] z-[190] w-[min(440px,94vw)] border-l-2 border-violet-500 bg-[#0b1220] p-5 shadow-2xl">
  <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">After Action Review</div><h2 className="mt-1 text-2xl font-black text-white">Four questions. Keep it simple.</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300" aria-label="Close questions"><X className="h-5 w-5"/></button></div>
  <p className="mt-3 text-xs leading-relaxed text-slate-400">Use the scorecards, turnover graph and before/after Rivers as evidence. The point is learning, not defending the score.</p>
  <div className="mt-5 space-y-3">
   {[
    ['1','What did you plan?','What were you trying to build or protect?'],
    ['2','What actually happened?','What do the score, turnover and River changes show?'],
    ['3','Why do you think it was different?','Which assumptions, choices or conditions explain the gap?'],
    ['4','What can you alter next time so it works better?','Choose one change you would test next time.'],
   ].map(([n,q,cue])=><section key={n} className="rounded-2xl border border-slate-700 bg-slate-950/75 p-4"><div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">Question {n}</div><div className="mt-1 text-base font-black text-white">{q}</div><div className="mt-1 text-[11px] leading-relaxed text-slate-500">{cue}</div></section>)}
  </div>
 </aside>
</>;

export const KMWeekDebriefV1:React.FC<Props>=({session,company})=>{
 const[questionsOpen,setQuestionsOpen]=useState(false);
 const participating=useMemo(()=>{
  const ids=new Set(session.participants.filter(p=>p.role!=='facilitator'&&p.companyId).map(p=>p.companyId));
  return ids.size?session.companies.filter(candidate=>ids.has(candidate.id)):session.companies;
 },[session.companies,session.participants]);
 const allComplete=participating.length>0&&participating.every(candidate=>candidate.kmWeek?.stage==='complete');
 const companies=allComplete?participating:[company];
 const colors=companies.map((_,index)=>COMPANY_COLORS[index%COMPANY_COLORS.length]);
 return <main className="mx-auto h-[calc(100vh-66px)] max-w-[1500px] overflow-auto p-3 text-slate-100">
  <section className="rounded-2xl border-2 border-violet-700 bg-[linear-gradient(145deg,#19152d,#101827)] p-4">
   <div className="flex flex-wrap items-center gap-4"><div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">AAR-lite · Discuss together</div><h2 className="mt-1 text-2xl font-black text-white">The score is finished. The learning starts here.</h2><p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-300">Compare your approaches, total scores, turnover and the shape of each Knowledge River. What worked? What didn’t? Where did you remain dependent on individuals? What changed when knowledge spread across the company?</p>{!allComplete&&participating.length>1&&<p className="mt-2 text-[10px] font-black text-amber-300">Other companies will appear here when they finish, so nobody sees another team’s strategy while they are still playing.</p>}</div><button type="button" onClick={()=>setQuestionsOpen(true)} className="h-12 rounded-xl border-2 border-amber-200 bg-amber-400 px-4 text-xs font-black text-slate-950 shadow-lg">AFTER ACTION REVIEW QUESTIONS <ArrowRight className="ml-1 inline h-4 w-4"/></button></div>
  </section>

  <div className="mt-3 space-y-3">
   {companies.map((item,index)=>{
    const color=colors[index];
    const before=beforeCompany(item);
    return <section key={item.id} className="rounded-2xl border-2 bg-[#0b1420] p-3" style={{borderColor:color}}>
     <div className="mb-2 flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{backgroundColor:color}}/><h3 className="text-lg font-black text-white">{item.name}</h3>{item.id===company.id&&<span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">Your company</span>}</div>
     <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
      <MiniScorePad company={item} color={color}/>
      <div className="min-w-0 rounded-2xl border-2 bg-slate-950/50 p-2" style={{borderColor:color}}><div className="mb-1 text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Before free play</div><div className="h-[190px]"><InvestmentRiverView company={before} mode="km_week" selectedDomain="operations" compact/></div></div>
      <div className="min-w-0 rounded-2xl border-2 bg-slate-950/50 p-2" style={{borderColor:color}}><div className="mb-1 text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">After free play</div><div className="h-[190px]"><InvestmentRiverView company={item} mode="km_week" selectedDomain="operations" compact/></div></div>
     </div>
     <SiteAuditSummary company={item}/>
    </section>
   })}
  </div>

  <div className="mt-3"><TurnoverGraph companies={companies} colors={colors}/></div>
  <AARQuestions open={questionsOpen} onClose={()=>setQuestionsOpen(false)}/>
 </main>;
};
