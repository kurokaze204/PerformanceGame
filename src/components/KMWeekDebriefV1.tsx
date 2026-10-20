import React,{useEffect,useId,useMemo,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{ArrowRight,Brain,CircleDollarSign,FileDown,Medal,ShieldCheck,Target,Trophy,Users,Workflow,X}from'lucide-react';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import type{KMWeekScore,KMWeekTurnoverPoint}from'../types/kmWeek.ts';
import{formatCurrency}from'../utils/format.ts';
import{KM_WEEK_DOMAINS,KM_WEEK_GOALS,KM_WEEK_SHOCK_GAP_COST,KM_WEEK_SITE_IDS,calculateKMWeekScoreV1,kmWeekGoalV1}from'../engine/kmWeekV1.ts';
import{InvestmentRiverView}from'./InvestmentRiverView.tsx';

type Props={session:GameSessionV2;company:CompanyV2;allowIncomplete?:boolean;onBack?:()=>void};

const COMPANY_COLORS=['#facc15','#38bdf8','#a78bfa','#34d399','#fb7185','#fb923c','#22d3ee','#c084fc'];
type ScoreKey=Exclude<keyof KMWeekScore,'total'>;
type ScoreItem={key:ScoreKey;label:string;value:number;max:number;icon:React.ReactNode};
type CategoryLeader={value:number;ties:number};

/** Show the controller and all colleagues for this company, not the person viewing the page. */
export function kmWeekCompanyPlayerLabel(session:GameSessionV2,company:CompanyV2):string{
 const members=session.participants.filter(player=>player.role!=='facilitator'&&player.companyId===company.id&&player.name.trim());
 if(!members.length)return'CEO: Unassigned';
 const ceo=members.find(player=>player.id===company.controllerParticipantId)||members.find(player=>player.role==='controller')||members[0];
 const others=members.filter(player=>player.id!==ceo.id).map(player=>player.name.trim());
 return`CEO: ${ceo.name.trim()}${others.length?` (${others.join(', ')})`:''}`;
}

const scoreItems=(company:CompanyV2,session:GameSessionV2):ScoreItem[]=>{
 const score=calculateKMWeekScoreV1(session,company);
 return [
  {key:'business',label:'Business Performance',value:score.business,max:12,icon:<CircleDollarSign className="h-3.5 w-3.5"/>},
  {key:'expertise',label:'Expertise',value:score.expertise,max:6,icon:<Brain className="h-3.5 w-3.5"/>},
  {key:'localCapability',label:'Local capability',value:score.localCapability,max:9,icon:<Users className="h-3.5 w-3.5"/>},
  {key:'knowledgeFlow',label:'Knowledge Flow',value:score.knowledgeFlow,max:6,icon:<Workflow className="h-3.5 w-3.5"/>},
  {key:'resilience',label:'Squeaky clean',value:score.resilience,max:15,icon:<ShieldCheck className="h-3.5 w-3.5"/>},
  {key:'goal',label:session.kmWeekGoalId?KM_WEEK_GOALS[session.kmWeekGoalId].title:'KM Week goal',value:score.goal,max:5,icon:<Target className="h-3.5 w-3.5"/>},
  {key:'turnover',label:'Final turnover',value:score.turnover,max:7,icon:<Trophy className="h-3.5 w-3.5"/>},
 ];
};

function beforeCompany(company:CompanyV2):CompanyV2{
 const snapshot=company.initialRiverSnapshot;
 return snapshot?{...company,sites:snapshot.sites,experts:snapshot.experts}:company;
}

/** Shared knowledge axis for every company's before AND after River.
 *  Include experts as well as local sites so high-performing companies
 *  do not distort the comparison by acquiring their own smaller scale.
 */
export function kmWeekDebriefRiverKnowledgeMax(companies:CompanyV2[]):number{
 const levels=[6];
 const domains=['operations','hr','marketing'];
 for(const company of companies){
  for(const snapshot of [beforeCompany(company),company]){
   for(const site of snapshot.sites.filter(site=>!site.isClosed)){
    for(const domain of domains)levels.push(site.teamCapability[domain as keyof typeof site.teamCapability]||0);
   }
   for(const expert of snapshot.experts.filter(expert=>!expert.isVacant)){
    for(const skill of expert.domains.filter(skill=>domains.includes(skill.domain)))levels.push(skill.score);
   }
  }
 }
 return Math.max(...levels);
}


/** The displayed formula always uses the same inputs and rules as the score engine. */
const scoreMath=(item:ScoreItem,company:CompanyV2,session:GameSessionV2):string=>{
 const state=company.kmWeek;
 const localLevels=KM_WEEK_SITE_IDS.reduce((total,id)=>{
  const site=company.sites.find(site=>site.id===id);
  return total+KM_WEEK_DOMAINS.reduce((sum,domain)=>sum+(site?.teamCapability[domain]||0),0);
 },0);
 switch(item.key){
  case'business':{
   const won=state?.businessDifficultySolved??(state?.freeSuccesses||0)*3;
   return 'Add the difficulty of every successful free-play Challenge (guided rounds do not count).\nScore = min(12, round('+won+' ÷ 54 × 12)) = '+item.value+'/12. The complete six-round set has 54 difficulty points.';
  }
  case'expertise':{
   const levels=company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain))).map(expert=>expert.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.score||0);
   return 'Each active specialist earns 1 point per knowledge level above 3. Current levels: '+(levels.join(', ')||'none')+'.\nScore = min(6, sum of max(0, expert level − 3)) = '+item.value+'/6.';
  }
  case'localCapability':
   return 'Add knowledge across Operations, HR and Marketing for the three local sites: '+localLevels+' levels.\nScore = min(9, floor('+localLevels+' ÷ 2)) = '+item.value+'/9. Two local knowledge levels earn one point.';
  case'knowledgeFlow':{
   const levels=state?.knowledgeTransfers||0;
   const bonuses=state?.meaningfulTransfers||0;
   return 'Only free-play Knowledge Transfers score. Earn 1 point per knowledge level gained by the receiving site, plus 1 bonus when a transfer raises that site/domain from below level 2 to at least 2.\nScore = min(6, '+levels+' transferred levels + '+bonuses+' threshold bonuses) = '+item.value+'/6.';
  }
  case'resilience':{
   const checks=state?.shockChecks||[];
   const passed=checks.filter(check=>check.passed).length;
   const bonus=checks.length===5&&passed===5?10:0;
   return 'Five final Site Audits each award 1 point if the local team meets its knowledge requirement. Clear all five for another 10 points.\nScore = '+passed+' passed audits + '+bonus+' perfect-audit bonus = '+item.value+'/15.';
  }
  case'goal':{
   const goal=kmWeekGoalV1(session);
   let progress='';
   if(goal.id==='local-heroes')progress='Local-only free-play Challenge wins: '+(state?.localSuccesses||0)+'; need at least 2.';
   else if(goal.id==='deep-bench')progress='Each of the three active specialists must have knowledge level 6 or higher.';
   else if(goal.id==='broad-base')progress='Current scoring checks Local capability ≥ 4 (at least 8 combined local knowledge levels); current combined levels: '+localLevels+'.';
   else{
    const totals=KM_WEEK_SITE_IDS.map(id=>{
     const site=company.sites.find(site=>site.id===id);
     return KM_WEEK_DOMAINS.reduce((sum,domain)=>sum+(site?.teamCapability[domain]||0),0);
    });
    progress='Knowledge totals by site: '+totals.join(', ')+'. Each must be at least 3 and at least one must be 4 or more.';
   }
   return goal.title+': '+goal.description+'\n'+progress+'\nScore = 5 points if the condition is met; otherwise 0. Current: '+item.value+'/5.';
  }
  case'turnover':{
   const ids=new Set(session.participants.filter(p=>p.role!=='facilitator'&&p.companyId).map(p=>p.companyId));
   const competitors=ids.size?session.companies.filter(c=>ids.has(c.id)):session.companies;
   const finished=competitors.length>0&&competitors.every(c=>c.kmWeek?.stage==='complete');
   const ahead=competitors.filter(c=>c.turnover>company.turnover).length;
   return 'Rank companies by final turnover (after Challenge outcomes, investment costs, travel and audit fines). 1st = 7 points, 2nd = 4, 3rd = 2; lower places = 0. Ties share a place and the next rank is skipped.\n'+(finished?'Companies with higher turnover: '+ahead+'. Score = '+item.value+'/7.':'Ranking points are pending until every participating company finishes.');
  }
 }
};

/** Portal the formula outside scroll containers, so it cannot obscure its score box. */
const ScoreFormulaTip:React.FC<{title:string;description:string;children:React.ReactNode;className?:string}>=({title,description,children,className=''})=>{
 const[open,setOpen]=useState(false);
 const[position,setPosition]=useState<{top:number;left:number;width:number}|null>(null);
 const anchorRef=useRef<HTMLDivElement>(null);
 const tooltipId=useId();
 useEffect(()=>{
  if(!open)return;
  const place=()=>{
   const anchor=anchorRef.current;
   if(!anchor)return;
   const rect=anchor.getBoundingClientRect();
   const card=anchor.closest('[data-kmw-final-scorepad]')?.getBoundingClientRect();
   const width=Math.min(330,window.innerWidth-24);
   // Prefer the right of the whole Score Pad, keeping both score columns readable.
   let left=Math.max(rect.right,card?.right||rect.right)+12;
   let top=rect.top;
   if(left+width+12>window.innerWidth){
    if(rect.left-width-12>=12)left=rect.left-width-12;
    else{
     left=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));
     // A small screen has no space beside the card: show below or above it.
     top=window.innerHeight-rect.bottom>=180?rect.bottom+8:rect.top-220;
    }
   }
   setPosition({left,top:Math.max(12,Math.min(top,window.innerHeight-180)),width});
  };
  place();
  window.addEventListener('resize',place);
  window.addEventListener('scroll',place,true);
  // Tap outside to dismiss on touch devices without affecting hover behaviour.
  const dismissOutside=(event:PointerEvent)=>{
   if(event.pointerType==='touch'&&!anchorRef.current?.contains(event.target as Node))setOpen(false);
  };
  document.addEventListener('pointerdown',dismissOutside);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',dismissOutside)};
 },[open]);
 return <>
  <div ref={anchorRef} tabIndex={0} aria-describedby={open?tooltipId:undefined} aria-label={title+' scoring formula'} data-kmw-score-math-anchor={title} className={'relative min-w-0 cursor-help focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 '+className}
   onMouseEnter={()=>{if(window.matchMedia('(hover: hover)').matches)setOpen(true)}}
   onMouseLeave={()=>{if(window.matchMedia('(hover: hover)').matches)setOpen(false)}}
   onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}
   onClick={()=>{if(window.matchMedia('(hover: none)').matches)setOpen(true)}}
   onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}}>
   {children}
  </div>
  {open&&position&&createPortal(<div id={tooltipId} role="tooltip" data-kmw-score-math={title} className="pointer-events-none fixed z-[260] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-xl border-2 border-sky-400 bg-[#091827] p-3 text-left text-[10pt] font-normal leading-snug text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,.8)] print:hidden" style={position}>
   <div className="mb-1 font-black text-sky-300">{title} — scoring maths</div>
   <div className="whitespace-pre-line">{description}</div>
  </div>,document.body)}
 </>;
};

const MiniScorePad:React.FC<{company:CompanyV2;color:string;session:GameSessionV2;allComplete:boolean;leaders:Partial<Record<ScoreKey,CategoryLeader>>}>=({company,color,session,allComplete,leaders})=>{
 const score=calculateKMWeekScoreV1(session,company);
 return <section data-kmw-final-scorepad className="min-w-0 rounded-2xl border-2 bg-slate-950/75 p-3" style={{borderColor:color}}>
  <div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-300"/><div className="text-xs font-black text-white">Score Pad</div><div className="ml-auto"><ScoreFormulaTip title="Total score" description={"Sum of all seven categories (maximum 60):\n"+score.business+" Business + "+score.expertise+" Expertise + "+score.localCapability+" Local + "+score.knowledgeFlow+" Flow + "+score.resilience+" Audits + "+score.goal+" Goal + "+score.turnover+" Turnover = "+score.total+" points."}><div className="text-2xl font-black text-white">{score.total}</div></ScoreFormulaTip></div></div>
  <div className="mt-2 grid grid-cols-2 gap-1.5">{scoreItems(company,session).map(item=>{
   const finalTurnover=item.key==='turnover';
   const leader=leaders[item.key];
   const rank=leader&&leader.value>0&&item.value===leader.value?(leader.ties>1?'joint-first':'first'):'other';
   const rankStyle=rank==='first'?'border-emerald-400 bg-emerald-800/80':rank==='joint-first'?'border-orange-400 bg-orange-800/80':'border-slate-800 bg-slate-900/80';
   return <ScoreFormulaTip key={item.key} title={item.label} description={scoreMath(item,company,session)} className={finalTurnover?'col-span-2':''}><div data-kmw-category={item.key} data-kmw-category-rank={rank} className={'flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 '+rankStyle}>
    <span className={rank==='other'?'shrink-0 text-slate-400':'shrink-0 text-white'}>{item.icon}</span>
    <span className={'min-w-0 flex-1 break-words text-[10px] font-black leading-tight '+(rank==='other'?'text-slate-200':'text-white')}>{item.label}{finalTurnover&&<span className={'ml-1 text-[9px] font-semibold '+(rank==='other'?'text-slate-400':'text-white/90')}>1st 7 · 2nd 4 · 3rd 2</span>}</span>
    <b className="shrink-0 text-sm text-white">{finalTurnover&&!allComplete?'Pending':item.value}<span className="ml-0.5 text-[9px] text-slate-300">{finalTurnover&&!allComplete?'':'/'+item.max}</span></b>
   </div></ScoreFormulaTip>;
  })}</div>
 </section>;
};

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
 const histories=companies.map((company):KMWeekTurnoverPoint[]=>{
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
  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-bold text-slate-300">
   <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-400"/>Challenge won</span>
   <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-600"/>Challenge lost</span>
   <span>Other dots show investments and audits</span>
  </div>
  <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Turnover graph for all companies">
   {ticks.map((value,index)=><g key={index}><line x1={left} x2={W-right} y1={y(value)} y2={y(value)} stroke="#243047"/><text x={left-10} y={y(value)+4} textAnchor="end" fill="#64748b" fontSize="11" fontWeight="700">{formatCurrency(Math.round(value))}</text></g>)}
   {longest.map((point,index)=>{const px=x(index,longest.length);return <g key={index}><line x1={px} x2={px} y1={top} y2={top+innerH} stroke="#172033"/><text x={px} y={H-14} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="700">{point.label}</text></g>})}
   {companies.map((company,index)=>{
     const history=histories[index];
     const points=history.map((point,i)=>`${x(i,history.length)},${y(point.turnover)}`).join(' ');
     return <g key={company.id}>
      <polyline points={points} fill="none" stroke={colors[index]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
      {history.map((point,i)=>{
       const isChallenge=/^(G\d+ C|R\d+ C\d+)$/.test(point.label);
       // Use recorded results; wins can still incur travel fees, so a negative
       // net turnover movement is not necessarily a failed Challenge.
       const result=isChallenge?(point.challengeResult??(i>0&&point.turnover>=history[i-1].turnover?'success':'failure')):null;
       const fill=result==='success'?'#34d399':result==='failure'?'#dc2626':colors[index];
       return <circle key={i} data-kmw-aar-challenge-result={result||undefined} cx={x(i,history.length)} cy={y(point.turnover)} r={result?6.5:4.5} fill={fill} stroke={result?'#f8fafc':'#020617'} strokeWidth={result?2.2:2}>
        <title>{company.name} · {point.label} · {result==='success'?'Challenge won':result==='failure'?'Challenge lost':'Turnover'} · {formatCurrency(point.turnover)}</title>
       </circle>;
      })}
     </g>;
    })}
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

export const KMWeekDebriefV1:React.FC<Props>=({session,company,allowIncomplete=false,onBack})=>{
 const[questionsOpen,setQuestionsOpen]=useState(false);
 const participating=useMemo(()=>{
  const ids=new Set(session.participants.filter(p=>p.role!=='facilitator'&&p.companyId).map(p=>p.companyId));
  return ids.size?session.companies.filter(candidate=>ids.has(candidate.id)):session.companies;
 },[session.companies,session.participants]);
 const allComplete=participating.length>0&&participating.every(candidate=>candidate.kmWeek?.stage==='complete');
 const comparisonVisible=allComplete||allowIncomplete;
 const companies=(comparisonVisible?participating:[company]).slice().sort((a,b)=>
  calculateKMWeekScoreV1(session,b).total-calculateKMWeekScoreV1(session,a).total||
  b.turnover-a.turnover||a.name.localeCompare(b.name)
 );
 const colors=companies.map((_,index)=>COMPANY_COLORS[index%COMPANY_COLORS.length]);
 const riverKnowledgeMax=kmWeekDebriefRiverKnowledgeMax(companies);
 // Comparisons are only meaningful once every participating company is finished.
 const scoreKeys:ScoreKey[]=['business','expertise','localCapability','knowledgeFlow','resilience','goal','turnover'];
 const completeScores=allComplete&&companies.length>1?companies.map(item=>calculateKMWeekScoreV1(session,item)):[];
 const leaders:Partial<Record<ScoreKey,CategoryLeader>>={};
 if(completeScores.length>1)for(const key of scoreKeys){
  const value=Math.max(...completeScores.map(score=>score[key]));
  leaders[key]={value,ties:completeScores.filter(score=>score[key]===value).length};
 }
 return <main data-kmw-debrief className="mx-auto h-[calc(100vh-66px)] max-w-[1700px] overflow-auto p-3 text-slate-100">
  <section className="rounded-2xl border-2 border-violet-700 bg-[linear-gradient(145deg,#19152d,#101827)] p-4">
   <div className="flex flex-wrap items-center gap-4"><div className="min-w-0 flex-1"><h2 className="text-2xl font-black text-white">After Action Review - Discuss Together</h2><p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-300">Compare your approaches, total scores, turnover and the shape of each Knowledge River. What worked? What didn’t? Where did you remain dependent on individuals? What changed when knowledge spread across the company?</p>{!allComplete&&participating.length>1&&<p className="mt-2 text-[10px] font-black text-amber-300">Other companies will appear here when they finish, or when the workshop clock ends.</p>}{allowIncomplete&&!allComplete&&<p data-kmw-incomplete-notice className="mt-2 text-sm font-bold text-amber-200">Workshop time has ended. All companies are shown, including unfinished rounds. Scores are provisional; final turnover rankings remain pending until everyone completes Site Audits.</p>}{completeScores.length>1&&<p data-kmw-score-legend className="mt-2 text-[11px] font-bold text-slate-200"><span className="text-emerald-300">■ Green: highest category score</span><span className="ml-4 text-orange-300">■ Orange: joint highest</span></p>}</div><div data-kmw-pdf-hide className="flex flex-wrap items-center gap-2">{onBack&&<button type="button" onClick={onBack} className="h-12 rounded-xl border-2 border-sky-300 px-4 text-xs font-black text-sky-100">BACK TO GAME</button>}<button type="button" onClick={()=>window.print()} title="Select Save as PDF in your browser's print dialog" className="flex h-12 items-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-700 px-4 text-xs font-black text-white shadow-lg hover:bg-emerald-600"><FileDown className="h-4 w-4"/> EXPORT PDF</button><button type="button" onClick={()=>setQuestionsOpen(true)} className="h-12 rounded-xl border-2 border-amber-200 bg-amber-400 px-4 text-xs font-black text-slate-950 shadow-lg">AFTER ACTION REVIEW QUESTIONS <ArrowRight className="ml-1 inline h-4 w-4"/></button></div></div>
  </section>

  <div data-kmw-pdf-chart className="mt-3"><TurnoverGraph companies={companies} colors={colors}/></div>
  <div className="mt-3 space-y-3">
   <p data-kmw-shared-river-scale className="text-xs font-bold text-slate-300">All before-and-after Knowledge Rivers use one shared vertical scale across these companies.</p>
   {companies.map((item,index)=>{
    const color=colors[index];
    const before=beforeCompany(item);
    return <section key={item.id} data-kmw-pdf-company className="rounded-2xl border-2 bg-[#0b1420] p-3" style={{borderColor:color}}>
     <div className="mb-1 flex flex-wrap items-center gap-2"><span className="h-3 w-3 rounded-full" style={{backgroundColor:color}}/><span className="text-xs font-black text-amber-300">#{index+1}</span><h3 className="text-lg font-black text-white">{item.name}</h3>{item.id===company.id&&<span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400">Your company</span>}</div>
     <p data-kmw-company-players className="mb-3 text-sm font-semibold text-emerald-100">{kmWeekCompanyPlayerLabel(session,item)}{item.kmWeek?.stage!=='complete'&&<span data-kmw-unfinished className="ml-3 rounded-lg border border-amber-500 bg-amber-950/40 px-2 py-0.5 text-amber-200">Unfinished · {item.kmWeek?.phase==='invest'?'Invest':'Challenge'}</span>}</p>
     <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)]">
      <MiniScorePad company={item} color={color} session={session} allComplete={allComplete} leaders={leaders}/>
      <div className="min-w-0 rounded-2xl border-2 bg-slate-950/50 p-2" style={{borderColor:color}}><div className="mb-1 text-[9px] font-black uppercase tracking-[.14em] text-slate-500">At start of game</div><div className="h-[190px]"><InvestmentRiverView company={before} mode="km_week" selectedDomain="operations" maxKnowledgeLevel={riverKnowledgeMax} compact/></div></div>
      <div className="min-w-0 rounded-2xl border-2 bg-slate-950/50 p-2" style={{borderColor:color}}><div className="mb-1 text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">At end of game</div><div className="h-[190px]"><InvestmentRiverView company={item} mode="km_week" selectedDomain="operations" maxKnowledgeLevel={riverKnowledgeMax} compact/></div></div>
     </div>
     <SiteAuditSummary company={item}/>
    </section>
   })}
  </div>

  <AARQuestions open={questionsOpen} onClose={()=>setQuestionsOpen(false)}/>
 </main>;
};
