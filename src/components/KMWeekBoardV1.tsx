import React,{useEffect,useMemo,useRef,useState}from'react';
import{ArrowRight,BarChart3,BookOpenCheck,Brain,Building2,CheckCircle2,CircleDollarSign,Crown,Dices,GraduationCap,Info,LogOut,MapPin,Medal,ShieldCheck,Sparkles,Target,Users,Workflow,X}from'lucide-react';
import type{KnowledgeDomain,Participant}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import type{KMWeekChallenge,KMWeekInvestment}from'../types/kmWeek.ts';
import{KM_WEEK_AAR_COST,KM_WEEK_AAR_UNLOCK_ROUND,KM_WEEK_DOMAINS,KM_WEEK_GOALS,KM_WEEK_MAX_EXPERT_KNOWLEDGE,KM_WEEK_SHOCK_CUTOFF,KM_WEEK_SHOCK_GAP_COST,KM_WEEK_SHOCK_SPECS,KM_WEEK_SHOCK_WINDOW_SECONDS,KM_WEEK_SITE_IDS,kmWeekAARCandidatesV1,kmWeekRiskOddsV1}from'../engine/kmWeekV1.ts';
import{toggleKMWeekSourceV1}from'../engine/kmWeekSelectionV1.ts';
import{kmWeekCoachV1}from'../engine/kmWeekCoachV1.ts';
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


type PerformanceHistoryPoint={label:string;turnover:number;knowledge:number};

function totalKnowledge(company:CompanyV2){
 const local=KM_WEEK_SITE_IDS.reduce((sum,siteId)=>{
  const site=company.sites.find(item=>item.id===siteId);
  return sum+(site?KM_WEEK_DOMAINS.reduce((siteSum,domain)=>siteSum+(site.teamCapability[domain]||0),0):0);
 },0);
 const expert=company.experts.filter(item=>!item.isVacant).reduce((sum,item)=>sum+item.domains.filter(skill=>KM_WEEK_DOMAINS.includes(skill.domain)).reduce((skillSum,skill)=>skillSum+skill.score,0),0);
 return local+expert;
}

function companyPerformanceHistory(company:CompanyV2):PerformanceHistoryPoint[]{
 const state=company.kmWeek;
 if(!state)return[{label:'Start',turnover:company.startingTurnover||company.turnover,knowledge:totalKnowledge(company)}];
 const investmentDeltas=state.investmentHistory.map(item=>Math.max(0,item.after-item.before)+Math.max(0,(item.expertAfter??0)-(item.expertBefore??0)));
 const startKnowledge=Math.max(0,totalKnowledge(company)-investmentDeltas.reduce((sum,delta)=>sum+delta,0));
 const investments=(state.turnoverHistory||[]).filter(point=>/ I$/.test(point.label));
 const points:PerformanceHistoryPoint[]=[{label:'Start',turnover:company.startingTurnover||875,knowledge:startKnowledge}];
 let knowledge=startKnowledge;
 investments.forEach((point,index)=>{
  knowledge+=investmentDeltas[index]||0;
  points.push({label:`Month ${index+1}`,turnover:point.turnover,knowledge});
 });
 const shockPoints=(state.turnoverHistory||[]).filter(point=>point.label.startsWith('SITE AUDITS ')||point.label.startsWith('SHOCK '));
 if(shockPoints.length){
  points.push({label:'Site Audits',turnover:shockPoints[shockPoints.length-1].turnover,knowledge:totalKnowledge(company)});
 }
 return points;
}

type RiverTurnoverEvent={kind:'win'|'loss';amount:number;challenge:number};
type RiverTurnoverPoint={key:string;turnover:number;events:RiverTurnoverEvent[];retiredName?:string};

/** The turnover log is kept across all rounds, unlike the active Challenge
 * cards. Use each recorded Challenge delta to reconstruct win/loss markers. */
function riverTurnoverSeries(company:CompanyV2):RiverTurnoverPoint[]{
 const state=company.kmWeek;
 const history=state?.turnoverHistory||[];
 const first=history[0]?.turnover??company.startingTurnover??company.turnover;
 const turns=new Map<string,RiverTurnoverPoint>();
 turns.set('START',{key:'START',turnover:first,events:[]});
 let previous=first;
 for(const entry of history){
  const match=/^([GR])(\d+)\s+(C\d*|I)$/.exec(entry.label);
  const key=entry.label.startsWith('SITE AUDITS ')?'AUDITS':match?`${match[1]}${match[2]}`:null;
  if(!key){previous=entry.turnover;continue;}
  const item=turns.get(key)||{key,turnover:previous,events:[]};
  if(match&&match[3].startsWith('C')){
   item.events.push({kind:entry.turnover>=previous?'win':'loss',amount:entry.turnover-previous,challenge:match[3]==='C'?1:Number(match[3].slice(1))});
  }
  item.turnover=entry.turnover;
  turns.set(key,item);
  previous=entry.turnover;
 }
 const retirement=state?.expertRetirement;
 if(retirement){
  const key=`R${retirement.retiredAtRound}`;
  const item=turns.get(key);
  if(item)item.retiredName=retirement.retiredName;
 }
 return Array.from(turns.values());
}

const TurnoverRiverChart:React.FC<{session:GameSessionV2;currentCompanyId:string}>=({session,currentCompanyId})=>{
 const companies=session.companies.filter(item=>item.kmWeek);
 const series=companies.map(item=>({company:item,points:riverTurnoverSeries(item)}));
 const allKeys:string[]=Array.from(new Set<string>(series.flatMap(item=>item.points.map(point=>point.key))));
 const order=(key:string)=>key==='START'?0:key==='AUDITS'?1000:key.startsWith('G')?Number(key.slice(1)):100+Number(key.slice(1));
 const keys=allKeys.sort((a,b)=>order(a)-order(b));
 const W=760,H=282,left=61,right=18,top=24,bottom=48,innerH=H-top-bottom,innerW=W-left-right;
 const amounts=series.flatMap(item=>item.points.map(point=>point.turnover));
 const minRaw=Math.min(...amounts,0),maxRaw=Math.max(...amounts,1);
 const padding=Math.max(20,(maxRaw-minRaw)*.12);
 const minValue=Math.max(0,Math.min(...amounts)-padding);
 const maxValue=Math.max(...amounts)+padding;
 const x=(key:string)=>left+Math.max(0,keys.indexOf(key))*innerW/Math.max(1,keys.length-1);
 const y=(amount:number)=>top+innerH-(amount-minValue)/Math.max(1,maxValue-minValue)*innerH;
 const ticks=Array.from({length:5},(_,i)=>minValue+(maxValue-minValue)*i/4);
 return <div data-kmw-river-turnover-chart role="dialog" aria-modal="true" aria-label="Turnover by round" className="flex h-full w-full flex-col overflow-hidden rounded-2xl border-[3px] border-emerald-400 bg-[#071827] p-2 shadow-[0_20px_55px_rgba(0,0,0,.8)] sm:p-3">
  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
   <div><div className="text-[10px] font-black uppercase tracking-[.15em] text-emerald-300">Turnover</div><h3 className="text-[15px] font-black text-white">Business results by round</h3></div>
   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-200">
    <span className="text-yellow-300">━ Your company</span><span className="text-emerald-400">━ Others</span>
    <span className="text-green-400">↑ Win</span><span className="text-red-800">↓ Loss</span><span className="text-amber-300">● Expert retired <span className="text-red-500">✕</span></span>
   </div>
  </div>
  <div className="mt-1 min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
   <svg viewBox={`0 0 ${W} ${H}`} className="h-full min-h-[190px] w-full min-w-[570px]" role="img" aria-label="Current company turnover shown in bold yellow, other companies in green; arrows mark Challenge results and a crossed expert symbol marks retirement">
    {ticks.map((amount,i)=><g key={'tick'+i}><line x1={left} x2={W-right} y1={y(amount)} y2={y(amount)} stroke="#233847" strokeDasharray="3 5"/><text x={left-7} y={y(amount)+4} textAnchor="end" fontSize="12" fill="#cbd5e1" fontWeight="800">{money(Math.round(amount))}</text></g>)}
    {keys.map(key=><g key={key}><text x={x(key)} y={H-23} textAnchor="middle" fontSize="14" fill="#cbd5e1" fontWeight="800">{key==='START'?'Start':key==='AUDITS'?'Audits':key.startsWith('G')?'G'+key.slice(1):'R'+key.slice(1)}</text></g>)}
    {series.filter(item=>item.company.id!==currentCompanyId).map((item,index)=>{
     const color=index%2===0?'#22c55e':'#34d399';
     const path=item.points.map((point,i)=>(i?'L':'M')+` ${x(point.key)} ${y(point.turnover)}`).join(' ');
     return <g key={item.company.id} opacity=".65">
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={index%3===1?'6 3':undefined}/>
      {item.points.map(point=><circle key={point.key} cx={x(point.key)} cy={y(point.turnover)} r="2.5" fill={color}><title>{item.company.name}: {point.key} — {money(point.turnover)}</title></circle>)}
     </g>;
    })}
    {series.filter(item=>item.company.id===currentCompanyId).map(item=><g key={item.company.id}>
     <path d={item.points.map((point,i)=>(i?'L':'M')+` ${x(point.key)} ${y(point.turnover)}`).join(' ')} fill="none" stroke="#facc15" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
     {item.points.map(point=><g key={point.key}>
      <circle cx={x(point.key)} cy={y(point.turnover)} r="5" fill="#facc15" stroke="#111827" strokeWidth="2"><title>{item.company.name}: {point.key} — {money(point.turnover)}</title></circle>
      {point.events.map((event,i)=>{
       const iconX=x(point.key)+(i-(point.events.length-1)/2)*22;
       const iconY=event.kind==='win'?Math.max(14,y(point.turnover)-24):Math.min(H-bottom-12,y(point.turnover)+26);
       return <g data-kmw-turnover-event={event.kind} key={i} transform={`translate(${iconX} ${iconY})`}>
        <path d="M0 -10 L-8 -2 H-4 V10 H4 V-2 H8 Z" transform={event.kind==='loss'?'rotate(180)':undefined} fill={event.kind==='win'?'#22c55e':'#7f1d1d'} stroke={event.kind==='win'?'#14532d':'#fca5a5'} strokeWidth="1.3"/>
        <title>{point.key} Challenge {event.challenge}: {event.kind==='win'?'won':'lost'} ({event.amount>=0?'+':''}{money(event.amount)})</title>
       </g>;
      })}
      {point.retiredName&&<g data-kmw-turnover-retirement transform={`translate(${x(point.key)} ${y(point.turnover)>70?y(point.turnover)-51:y(point.turnover)+51})`}>
       <circle r="13" fill="#facc15" stroke="#713f12" strokeWidth="2"/>
       <circle cx="0" cy="-4" r="3.6" fill="#422006"/>
       <path d="M-7 7 Q-7 0 0 0 Q7 0 7 7" fill="#422006"/>
       <path d="M-14 -14 L14 14 M14 -14 L-14 14" stroke="#dc2626" strokeWidth="3.4" strokeLinecap="round"/>
       <title>{point.retiredName} retired during {point.key}</title>
      </g>}
     </g>)}
    </g>)}
   </svg>
  </div>
  <div className="shrink-0 text-center text-[10px] font-bold text-slate-400">Use the green Turnover button again, or press Esc, to return to the River.</div>
 </div>;
};

const TurnoverKnowledgeModal:React.FC<{open:boolean;session:GameSessionV2;currentCompanyId:string;onClose:()=>void}>=({open,session,currentCompanyId,onClose})=>{
 if(!open)return null;
 const companies=session.companies.filter(item=>item.kmWeek);
 const histories=companies.map(company=>companyPerformanceHistory(company));
 const turnoverValues=histories.flatMap(history=>history.map(point=>point.turnover));
 const knowledgeValues=histories.flatMap(history=>history.map(point=>point.knowledge));
 const turnoverMinRaw=Math.min(...turnoverValues),turnoverMaxRaw=Math.max(...turnoverValues);
 const turnoverPad=Math.max(20,(turnoverMaxRaw-turnoverMinRaw)*.12);
 const turnoverMin=Math.max(0,turnoverMinRaw-turnoverPad),turnoverMax=turnoverMaxRaw+turnoverPad;
 const knowledgeMinRaw=Math.min(...knowledgeValues),knowledgeMaxRaw=Math.max(...knowledgeValues);
 const knowledgePad=Math.max(1,(knowledgeMaxRaw-knowledgeMinRaw)*.15);
 const knowledgeMin=Math.max(0,Math.floor(knowledgeMinRaw-knowledgePad)),knowledgeMax=Math.ceil(knowledgeMaxRaw+knowledgePad);
 const W=1040,H=390,left=74,right=72,top=30,bottom=52,innerW=W-left-right,innerH=H-top-bottom;
 const maxPoints=Math.max(2,...histories.map(history=>history.length));
 const x=(index:number)=>left+(index*innerW/Math.max(1,maxPoints-1));
 const yTurnover=(value:number)=>top+innerH-((value-turnoverMin)/Math.max(1,turnoverMax-turnoverMin))*innerH;
 const yKnowledge=(value:number)=>top+innerH-((value-knowledgeMin)/Math.max(1,knowledgeMax-knowledgeMin))*innerH;
 const turnoverTicks=Array.from({length:5},(_,i)=>turnoverMin+((turnoverMax-turnoverMin)*i/4));
 const knowledgeTicks=Array.from({length:5},(_,i)=>knowledgeMin+((knowledgeMax-knowledgeMin)*i/4));
 const labels=Array.from({length:maxPoints},(_,i)=>{
  const found=histories.find(history=>history[i])?.[i];
  return found?.label||`Month ${i}`;
 });
 const palette=['#f59e0b','#38bdf8','#a78bfa','#34d399','#fb7185','#60a5fa','#f472b6','#a3e635'];
 return <div className="fixed inset-0 z-[210] grid place-items-center bg-black/65 p-4" onPointerDown={onClose}>
  <section role="dialog" aria-modal="true" aria-label="Turnover and knowledge over time" onPointerDown={event=>event.stopPropagation()} className="w-[min(1120px,96vw)] rounded-[24px] border-2 border-emerald-700 bg-[#0b1220] p-4 shadow-[0_28px_90px_rgba(0,0,0,.78)]">
   <div className="flex items-start gap-3">
    <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Company performance over time</div><h2 className="mt-1 text-xl font-black text-white">Turnover and total knowledge by month</h2><p className="mt-1 text-[11px] text-slate-400">Solid line = turnover (left axis). Dashed line = total local + expert knowledge (right axis).</p></div>
    <button type="button" onClick={onClose} aria-label="Close turnover chart" className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white"><X className="h-5 w-5"/></button>
   </div>
   <div className="mt-3 flex flex-wrap gap-2">
    {companies.map((item,index)=>{
     const current=item.id===currentCompanyId;
     return <div key={item.id} className={'flex items-center gap-2 rounded-lg border px-2 py-1 text-[10px] font-black '+(current?'border-amber-300 bg-amber-950/25 text-white':'border-slate-700 bg-slate-950/60 text-slate-400')}>
      <span className="h-2.5 w-5 rounded-full" style={{backgroundColor:palette[index%palette.length]}}/>{item.name}{current&&<span className="text-amber-300">YOU</span>}
     </div>;
    })}
   </div>
   <div className="mt-3 overflow-x-auto">
    <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[760px] w-full" role="img" aria-label="Monthly turnover and total knowledge for all companies">
     {turnoverTicks.map((value,index)=><g key={'t'+index}><line x1={left} x2={W-right} y1={yTurnover(value)} y2={yTurnover(value)} stroke="#233047"/><text x={left-10} y={yTurnover(value)+4} textAnchor="end" fill="#94a3b8" fontSize="11" fontWeight="700">{money(Math.round(value))}</text></g>)}
     {knowledgeTicks.map((value,index)=><text key={'k'+index} x={W-right+10} y={yKnowledge(value)+4} textAnchor="start" fill="#c4b5fd" fontSize="11" fontWeight="800">{Math.round(value)}</text>)}
     <text x="18" y={top+innerH/2} transform={`rotate(-90 18 ${top+innerH/2})`} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="900">TURNOVER</text>
     <text x={W-18} y={top+innerH/2} transform={`rotate(90 ${W-18} ${top+innerH/2})`} textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="900">TOTAL KNOWLEDGE</text>
     {labels.map((label,index)=><g key={'x'+index}><line x1={x(index)} x2={x(index)} y1={top} y2={top+innerH} stroke="#172033"/><text x={x(index)} y={H-18} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">{label}</text></g>)}
     {companies.map((item,index)=>{
      const history=histories[index];
      const current=item.id===currentCompanyId;
      const color=palette[index%palette.length];
      const turnoverPath=history.map((point,i)=>(i?'L':'M')+' '+x(i)+' '+yTurnover(point.turnover)).join(' ');
      const knowledgePath=history.map((point,i)=>(i?'L':'M')+' '+x(i)+' '+yKnowledge(point.knowledge)).join(' ');
      return <g key={item.id} opacity={current?1:.5}>
       <path d={turnoverPath} fill="none" stroke={color} strokeWidth={current?5:2.5} strokeLinecap="round" strokeLinejoin="round"/>
       <path d={knowledgePath} fill="none" stroke={color} strokeWidth={current?4:2} strokeDasharray="9 7" strokeLinecap="round" strokeLinejoin="round"/>
       {history.map((point,i)=><g key={i}>
        <circle cx={x(i)} cy={yTurnover(point.turnover)} r={current?5:3.5} fill={color} stroke="#020617" strokeWidth="2"><title>{item.name} · {point.label} · Turnover {money(point.turnover)}</title></circle>
        <circle cx={x(i)} cy={yKnowledge(point.knowledge)} r={current?4.5:3} fill="#0b1220" stroke={color} strokeWidth={current?3:2}><title>{item.name} · {point.label} · Total knowledge {point.knowledge}</title></circle>
       </g>)}
      </g>;
     })}
    </svg>
   </div>
  </section>
 </div>;
};

const KnowledgePips:React.FC<{value:number;domain:KnowledgeDomain;compact?:boolean}>=({value,domain,compact=false})=><div className={compact?'flex gap-1 min-[700px]:gap-0.5 xl:gap-1':'flex gap-1'} aria-label={`Knowledge ${value} of 5`}>{Array.from({length:5},(_,index)=><span key={index} title={`${index+1}`} className={`${compact?'h-2.5 w-2.5 min-[700px]:h-2 min-[700px]:w-2 xl:h-2.5 xl:w-2.5':'h-4 w-4'} rounded-full border shadow-inner ${index<value?'border-white/45':'border-slate-700 bg-slate-950'}`} style={index<value?{backgroundColor:DOMAIN_INFO[domain].color}:{}}/>)}</div>;

const Card:React.FC<{children:React.ReactNode;className?:string}>=({children,className=''})=><section className={`rounded-[20px] border-2 border-slate-700 bg-[#111827] shadow-[0_10px_26px_rgba(0,0,0,.30)] ${className}`}>{children}</section>;

function phaseTitle(company:CompanyV2){
 const state=company.kmWeek;
 if(!state)return'PREPARING';
 if(state.stage==='guided')return`GUIDED ${state.guidedTurn}/3`;
 if(state.stage==='free')return`ROUND ${state.freeRound}`;
 if(state.stage==='shock')return'SITE AUDITS';
 return'COMPLETE';
}

function currentPhaseLabel(company:CompanyV2){
 const state=company.kmWeek;
 if(!state)return'Preparing';
 if(state.stage==='shock')return'Site Audits';
 if(state.stage==='complete')return'Score & Debrief';
 return state.phase==='challenge'?'Challenge':'Invest';
}

function currentGuidedCopy(company:CompanyV2){
 const turn=company.kmWeek?.guidedTurn||1;
 if(turn===1)return{title:'1. Solve the business problem',text:'Brisbane needs Operations 4. Build the response yourself: select Priya for depth, then select the Local Team if you want its knowledge to contribute breadth.',invest:'After the Challenge, you will deepen Priya’s expertise.'};
 if(turn===2)return{title:'2. Who should handle this one?',text:'Melbourne needs Human Resources 1 — the local team already knows how to solve this. Marcus is available if extra help is needed.',invest:'Now use Local Training. Priya can strengthen an Operations team at another site; travel to teach adds $2k.'};
 return{title:'3. Another problem, another expert',text:'Priya is busy training staff, but Marketing specialist Mary is available for Perth’s distributor problem. You can call on a different expert while Priya teaches.',invest:'Now try Knowledge Transfer. Choose a domain and two sites where the source knows more than the destination. Brisbane Operations → Perth is the suggested example, but any valid transfer will work.'};
}

const ToolTip:React.FC<{text:React.ReactNode;onHoverChange?:(active:boolean)=>void;large?:boolean}>=({text,onHoverChange,large=false})=><span role="button" aria-label="More information" className={`group relative inline-grid shrink-0 cursor-help place-items-center ${large?'h-7 w-7 rounded-full border border-slate-700 bg-slate-900 text-slate-400':'inline-flex text-slate-500'}`} onMouseEnter={()=>onHoverChange?.(true)} onMouseLeave={()=>onHoverChange?.(false)} onFocus={()=>onHoverChange?.(true)} onBlur={()=>onHoverChange?.(false)} tabIndex={0}><Info className={large?'h-3.5 w-3.5':'h-3.5 w-3.5'}/><span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[300] mt-2 hidden w-64 rounded-xl border border-slate-600 bg-slate-950 p-3 text-[11px] font-semibold normal-case leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">{text}</span></span>;

const KM_WEEK_INTERVENTION_HELP:Record<KMWeekInvestment,{title:string;description:string}>={
 TRAIN_EXPERT:{
  title:'Train Expert',
  description:'Experts are usually leaders in their field. Occasionally they learn on the job or through lessons learned, but more often they go and get external training to lift their skill and bring it back into the company.',
 },
 LOCAL_TRAINING:{
  title:'Local Training',
  description:"This uses your expert to train a single site. It is effective, but slow and most importantly, it ties them up so they can't help with challenges next round. Powerful, but use with caution as bad timing can be costly.",
 },
 KNOWLEDGE_TRANSFER:{
  title:'Knowledge Transfer',
  description:"Often we have the know-how in the company but it isn't evenly spread. Performance is lumpy depending on where issues happen, and a powerful and relatively cheap way to resolve this is by having higher-performing site managers visit another site for a few days to review their practices, plug gaps and introduce tighter processes. Choose a domain, choose the teaching site (from the top of the River) and the learning site (from the bottom). The bigger the gap, the greater the impact will be.",
 },
 AFTER_ACTION_REVIEW:{
  title:'After Action Review',
  description:'Originating in the military and emergency services, Lessons Management programs seek to maximise learning from both real events and exercises. Using an After Action Review, you pull the team together and, guided by the four key questions, you review what was planned, what happened, why and what can be done better next time. This can benefit all involved, unveiling root causes as well as practice and doctrine improvements. Having junior team members take part makes a big difference, and if the event was a failure, the learning can be even greater again.',
 },
};

type ScoreGhostKind='expertise'|'local'|'flow'|'resilience';
const ScoreCell:React.FC<{label:string;value:number;max:string;icon:React.ReactNode;tip:React.ReactNode;ghost?:ScoreGhostKind;onGhost?:(ghost:ScoreGhostKind|null)=>void}>=({label,value,max,icon,tip,ghost,onGhost})=><div className="relative flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-300">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-black text-slate-400">{label}</span><span className="text-lg font-black leading-none tabular-nums text-white">{value}<span className="ml-1 text-[9px] text-slate-600">/{max}</span></span></span><ToolTip large text={tip} onHoverChange={ghost&&onGhost?(active)=>onGhost(active?ghost:null):undefined}/></div>;

const PhaseStep:React.FC<{label:string;active:boolean;done:boolean;number:string}>=({label,active,done,number})=><div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] ${active?'border-amber-300 bg-amber-950/40 text-amber-100':done?'border-emerald-800 bg-emerald-950/25 text-emerald-300':'border-slate-800 bg-slate-950/60 text-slate-600'}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${active?'border-amber-300':done?'border-emerald-600':'border-slate-700'}`}>{done?<CheckCircle2 className="h-3 w-3"/>:number}</span>{label}</div>;

const ChallengeToken:React.FC<{challenge:KMWeekChallenge;company:CompanyV2;selected:boolean;draft?:Exclude<PendingResponse,null>;onClick:()=>void}>=({challenge,company,selected,draft,onClick})=>{
 const site=company.sites.find(item=>item.id===challenge.siteId);
 const local=site?.teamCapability[challenge.domain]||0;
 const done=challenge.status!=='open';
 const shell='min-w-0 rounded-xl border-2 p-2 text-left transition ';
 const stateClass=selected?'border-violet-300 bg-violet-950/35':done?(challenge.status==='success'?'border-emerald-800 bg-emerald-950/20':'border-rose-900 bg-rose-950/20'):'border-slate-700 bg-slate-950/70 hover:border-violet-600';
 return <button type="button" data-kmw-free-challenge-card={challenge.id} onClick={onClick} className={shell+stateClass}>
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
 requirement:number;
 local:number;
 expert:number;
 domain:KnowledgeDomain;
 siteLabel:string;
 requirementMet:boolean;
 guideStep?:number;
 expertName?:string;
 expertLocation?:string;
 travelCost?:number;
 localSelection:ResponseSelectionState;
 expertSelection:ResponseSelectionState;
 localDisabled?:boolean;
 expertDisabled?:boolean;
 expertTraining?:boolean;
 attention?:boolean;
 onLocalClick:()=>void;
 onExpertClick?:()=>void;
}>=({requirement,local,expert,domain,siteLabel,requirementMet,guideStep=0,expertName,expertLocation,travelCost=0,localSelection,expertSelection,localDisabled=false,expertDisabled=false,expertTraining=false,attention=false,onLocalClick,onExpertClick})=>{
 const slots=Math.max(5,requirement,local,expert);
 const SegmentBar:React.FC<{value:number;filled:number;tone:'requirement'|'local'|'expert'}>=({value,filled,tone})=><div className="grid gap-1" style={{gridTemplateColumns:`repeat(${slots},minmax(0,1fr))`}} aria-label={tone+' knowledge '+value+' of '+slots}>
  {Array.from({length:slots},(_,index)=>{
   const available=index<value;
   const applied=index<filled;
   const colour=tone==='requirement'?(requirementMet?'border-emerald-200 bg-emerald-400':'border-rose-300 bg-rose-500'):tone==='local'?'border-sky-300 bg-sky-400':'border-amber-300 bg-amber-400';
   const idle=tone==='requirement'?(requirementMet?'border-emerald-400/80 bg-emerald-950/30':'border-rose-400/90 bg-rose-950/30'):tone==='local'?'border-sky-500/85 bg-sky-950/25':'border-amber-500/85 bg-amber-950/20';
   return <span key={index}
    className={'h-4 rounded-md border-2 transition-all duration-200 '+(available?(applied?colour:idle):'border-slate-800 bg-slate-950')}
    style={tone==='requirement'&&available&&applied?{backgroundColor:requirementMet?'#34d399':'#f43f5e',borderColor:requirementMet?'#a7f3d0':'#fda4af'}:undefined}
   />;
  })}
 </div>;
 const Selector:React.FC<{state:ResponseSelectionState;disabled?:boolean;anchor?:string}>=({state,disabled=false,anchor})=>{
  const tone=disabled?'border-slate-800 bg-slate-950':state==='depth'?'border-amber-200 bg-amber-400 text-slate-950':state==='breadth'?'border-sky-300 bg-slate-900':'border-slate-500 bg-slate-900';
  return <span data-kmw-tour={anchor} aria-label={state==='depth'?'Selected as depth':state==='breadth'?'Selected as breadth':'Not selected'} className={'relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border-2 '+tone+(attention&&!disabled?' kmw-attention-circle':'')}>{state==='depth'?'✓':state==='breadth'?<span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/2 bg-sky-400"/>:''}</span>;
 };
 const localFilled=localSelection==='depth'?local:localSelection==='breadth'?Math.min(local,1):0;
 const expertFilled=expertSelection==='depth'?expert:expertSelection==='breadth'?Math.min(expert,1):0;
 return <div className="mt-2 space-y-1.5" data-kmw-knowledge-bars>
  <div data-kmw-tour="required" className={'grid w-full grid-cols-[100px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 '+(requirementMet?'border-emerald-400/80 bg-emerald-950/20': 'border-rose-900/70 bg-rose-950/10')+(guideStep===1?' kmw-tour-highlight':'')+(requirementMet?' kmw-tour-required-success':'')}>
   <span><span className="block text-[13px] font-black text-white">Required</span><span className={'block text-[12px] font-bold '+(requirementMet?'text-emerald-300':'text-rose-300')}>{domainLabel(domain)} {requirement}</span></span>
   <SegmentBar value={requirement} filled={requirement} tone="requirement"/>
   <b className={'text-center text-sm font-black '+(requirementMet?'text-emerald-300':'text-rose-300')}>{requirement}</b>
  </div>
  <button type="button" disabled={localDisabled} onClick={onLocalClick} className={'grid w-full grid-cols-[100px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition disabled:opacity-35 '+(localSelection!=='none'?'border-sky-500 bg-sky-950/20':'border-slate-700 bg-slate-950/70 hover:border-sky-700')+(attention&&!localDisabled?' kmw-attention-button':'')+(guideStep===2||guideStep===4?' kmw-tour-highlight':'')}>
   <span><span className="block text-[13px] font-black text-white">{siteLabel} team</span><span className="block text-[12px] font-bold text-sky-300">{domainLabel(domain)} {local}</span></span>
   <SegmentBar value={local} filled={localFilled} tone="local"/>
   <Selector state={localSelection} disabled={localDisabled} anchor={guideStep===4?'breadth':'local'}/>
  </button>
  {expertName&&<button type="button" disabled={expertDisabled} onClick={onExpertClick} className={'grid w-full grid-cols-[100px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition '+(expertTraining?'disabled:opacity-90 ':'disabled:opacity-35 disabled:grayscale ')+(expertSelection!=='none'?'border-amber-400 bg-amber-950/20':'border-slate-700 bg-slate-950/70 hover:border-amber-700')+(attention&&!expertDisabled?' kmw-attention-button':'')+(guideStep===3?' kmw-tour-highlight':'')}>
   <span className="min-w-0"><span className="block truncate text-[13px] font-black text-white">{expertName.split(' ')[0]}{expertLocation?' · '+(SITE_ABBR[expertLocation]||expertLocation):''}</span><span className="block text-[12px] font-bold text-amber-300">{domainLabel(domain)} {expert}{expertTraining?'':expertDisabled?' · used':travelCost?' · $'+travelCost+'k travel':''}</span>{expertTraining&&<span className="mt-1 block text-[11px] font-black text-rose-400">Busy training staff</span>}</span>
   <SegmentBar value={expert} filled={expertFilled} tone="expert"/>
   <Selector state={expertSelection} disabled={expertDisabled} anchor="expert"/>
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
 const[guideStep,setGuideStep]=useState(0);
 const[riverIntroStep,setRiverIntroStep]=useState(1);
 const[riverIntroArrows,setRiverIntroArrows]=useState<{fromX:number;fromY:number;toX:number;toY:number;underY?:number}[]>([]);
 const[guideAnchor,setGuideAnchor]=useState<{left:number;top:number;targetX:number;targetY:number;panelWidth:number;startY:number}|null>(null);
 const[firstInvestBriefDismissed,setFirstInvestBriefDismissed]=useState(false);
 const[scoreBriefOpen,setScoreBriefOpen]=useState(false);
 const[freeChallengeIntroDismissed,setFreeChallengeIntroDismissed]=useState(false);
 const[freeChallengeIntroPlacement,setFreeChallengeIntroPlacement]=useState<{left:number;top:number;width:number;arrows:{fromX:number;fromY:number;toX:number;toY:number}[]}|null>(null);
 const[coachDismissedKey,setCoachDismissedKey]=useState('');
 const[scorePadOpen,setScorePadOpen]=useState(false);
 const[sitePanelsOpen,setSitePanelsOpen]=useState(false);
 const[turnoverChartOpen,setTurnoverChartOpen]=useState(false);
 const[riverTurnoverOpen,setRiverTurnoverOpen]=useState(false);
 const[riverTurnoverRect,setRiverTurnoverRect]=useState<{left:number;top:number;width:number;height:number}|null>(null);
 const[expertChangeDismissedKey,setExpertChangeDismissedKey]=useState('');
 const[challengeAttention,setChallengeAttention]=useState(false);
 const[riskResult,setRiskResult]=useState<{roll:number;won:boolean;requiredRoll:number;performanceGap:number}|null>(null);
 const[riskRollPending,setRiskRollPending]=useState<{requiredRoll:number;performanceGap:number}|null>(null);
 const riskContinueRef=useRef<(()=>void)|null>(null);
 const[challengeOutcome,setChallengeOutcome]=useState<{won:boolean;change:number;travelCost:number;left:number;top:number;fading:boolean}|null>(null);
 const[scoreGhost,setScoreGhost]=useState<ScoreGhostKind|null>(null);
 const[riverFrozenCompany,setRiverFrozenCompany]=useState<CompanyV2|null>(null);
 const[investment,setInvestment]=useState<KMWeekInvestment>('TRAIN_EXPERT');
 const[infoInvestment,setInfoInvestment]=useState<KMWeekInvestment|null>(null);
 const[aarChallengeId,setAARChallengeId]=useState('');
 const[aarIntroDismissed,setAARIntroDismissed]=useState(false);
 const[aarIntroArrow,setAARIntroArrow]=useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
 const[expertId,setExpertId]=useState('');
 const[sourceSiteId,setSourceSiteId]=useState('brisbane');
 const[targetSiteId,setTargetSiteId]=useState('perth');
 const[trainingSiteId,setTrainingSiteId]=useState('brisbane');
 const[now,setNow]=useState(Date.now());
 const challengeDraftsRef=useRef(challengeDrafts);
 const freeChallengeIntroKey=`tpg:kmw-free-challenge-intro:${session.id}:${company.id}`;
 const firstFreeChallengeIntroPending=Boolean(state?.stage==='free'&&state.freeRound===1&&state.phase==='challenge'&&!readOnly&&!freeChallengeIntroDismissed&&localStorage.getItem(freeChallengeIntroKey)!=='seen');
 const showFreeChallengeIntro=firstFreeChallengeIntroPending&&!busy&&!riskResult&&!riskRollPending&&!challengeOutcome&&!scoreBriefOpen;
 const dismissFreeChallengeIntro=()=>{
  localStorage.setItem(freeChallengeIntroKey,'seen');
  setFreeChallengeIntroDismissed(true);
 };
 const riverIntroActive=Boolean(state?.stage==='guided'&&state.guidedTurn===1&&state.phase==='challenge'&&!challengeFocusOpen);
 const riverIntroUnlocked=riverIntroActive&&riverIntroStep===9;
 const advanceRiverIntro=()=>{
  if(riverIntroActive&&riverIntroStep<9)setRiverIntroStep(step=>Math.min(9,step+1));
 };
 const beginFirstChallenge=()=>{
  if(riverIntroActive&&!riverIntroUnlocked)return;
  setChallengeFocusOpen(true);
  if(state?.stage==='guided'&&state.guidedTurn===1)setGuideStep(1);
 };

 const members=session.participants.filter(item=>item.role!=='facilitator'&&item.companyId===company.id);
 const goalId=session.kmWeekGoalId||'local-heroes';
 const goal=KM_WEEK_GOALS[goalId];
 const coaching=kmWeekCoachV1(company);
 const sites=KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)).filter((site):site is CompanyV2['sites'][number]=>Boolean(site));
 const experts=company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain)));
 const specialist=expertId?experts.find(item=>item.id===expertId):specialistFor(company,selectedDomain);
 const specialistDomain=specialist?.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
 const localTrainingSite=company.sites.find(site=>site.id===trainingSiteId&&!site.isClosed);
 const aarCandidates=kmWeekAARCandidatesV1(company);
 const aarChallenge=aarCandidates.find(challenge=>challenge.id===aarChallengeId)||aarCandidates[0];
 const aarSite=aarChallenge?company.sites.find(site=>site.id===aarChallenge.siteId):undefined;
 const aarExpert=aarChallenge?specialistFor(company,aarChallenge.domain):undefined;
 const aarUplift=aarChallenge?.status==='failure'?2:1;
 const aarSiteBefore=aarSite&&aarChallenge?aarSite.teamCapability[aarChallenge.domain]||0:0;
 const aarExpertBefore=aarExpert&&aarChallenge?specialistScore(company,aarChallenge.domain):0;
 const aarSiteDelta=aarChallenge?Math.min(5,aarSiteBefore+aarUplift)-aarSiteBefore:0;
 const aarExpertDelta=aarChallenge?Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,aarExpertBefore+aarUplift)-aarExpertBefore:0;
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
  const openTwoCardBriefing=state?.stage==='free'&&state.freeRound===1&&state.phase==='challenge'&&!readOnly&&localStorage.getItem(`tpg:kmw-free-challenge-intro:${session.id}:${company.id}`)!=='seen';
  setChallengeFocusOpen(!challengePhase||openTwoCardBriefing);
  setGuideStep(0);
  setChallengeDrafts({});
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);

 useEffect(()=>{
  if(state?.stage==='guided'&&state.phase==='invest'&&state.guidedTurn===1)setFirstInvestBriefDismissed(false);
 },[state?.stage,state?.phase,state?.guidedTurn]);

 useEffect(()=>{
  if(state?.stage!=='free'||state.phase!=='invest'||state.freeRound!==1||riskRollPending||riskResult||busy||riverFrozenCompany)return;
  const key=`tpg:kmw-score-brief:${session.id}:${company.id}`;
  if(localStorage.getItem(key)!=='seen')setScoreBriefOpen(true);
 },[state?.stage,state?.phase,state?.freeRound,session.id,company.id,riskRollPending,riskResult,busy,riverFrozenCompany]);

 useEffect(()=>{setInfoInvestment(null)},[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);

 useEffect(()=>{
  if(!state)return;
  if(state.stage==='guided'&&state.phase==='invest'){
    if(state.guidedTurn===1){setInvestment('TRAIN_EXPERT');setSelectedDomain('operations');setExpertId(specialistFor(company,'operations')?.id||'');}
    else if(state.guidedTurn===2){const expert=specialistFor(company,'operations');setInvestment('LOCAL_TRAINING');setSelectedDomain('operations');setExpertId(expert?.id||'');setTrainingSiteId(expert?.location&&expert.location!=='HQ'?expert.location:'brisbane');}
    else{setInvestment('KNOWLEDGE_TRANSFER');setSelectedDomain('operations');setSourceSiteId('brisbane');setTargetSiteId('perth');}
  }else if(state.stage==='free'&&state.phase==='invest'){
    setInvestment('TRAIN_EXPERT');
    const domain=coaching?.domain||'operations';const first=specialistFor(company,domain)||experts[0];setExpertId(first?.id||'');setSelectedDomain(domain);
  }
 },[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,company.id]);

 useEffect(()=>{challengeDraftsRef.current=challengeDrafts},[challengeDrafts]);

 useEffect(()=>{
  if(!challengeFocusOpen||state?.phase!=='challenge'||(state?.stage!=='guided'&&state?.stage!=='free')||(state.stage==='guided'&&state.guidedTurn===1&&guideStep>0)){
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
 },[challengeFocusOpen,state?.stage,state?.phase,state?.guidedTurn,state?.freeRound,selectedChallengeId,guideStep]);

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

 useEffect(()=>{
  if(!guideStep||!challengeFocusOpen||state?.stage!=='guided'||state.guidedTurn!==1||state.phase!=='challenge'){
   setGuideAnchor(null);
   return;
  }
  const targetKey=guideStep===1?'required':guideStep===2?'local':guideStep===3?'expert':guideStep===4?'breadth':'commit';
  let frame=0;
  const position=()=>{
   const target=document.querySelector('[data-kmw-tour="'+targetKey+'"]');
   const river=document.querySelector('[data-kmw-tour-river]');
   if(!target||!river)return;
   const rect=target.getBoundingClientRect();
   const riverRect=river.getBoundingClientRect();

   // Park the entire lesson over the River, never over the response controls.
   // Leave a gutter so even the card's shadow cannot obscure the first column.
   const panelWidth=Math.min(350,Math.max(180,riverRect.width-28),window.innerWidth-24);
   const left=Math.max(12,Math.min(riverRect.right-panelWidth-16,window.innerWidth-panelWidth-12));
   const panelHeight=document.querySelector('[data-kmw-tour-panel]')?.getBoundingClientRect().height||270;
   const maxTop=Math.max(65,window.innerHeight-panelHeight-12);
   const preferredTop=riverRect.top+Math.min(70,Math.max(18,(riverRect.height-panelHeight)/2));
   const top=Math.max(65,Math.min(maxTop,preferredTop));

   // End at the outside left edge of the Required row / Commit button.
   // Never draw the arrowhead across those controls' labels.
   const leftEdgeTarget=guideStep===1||guideStep===5;
   const targetX=leftEdgeTarget?rect.left-7:rect.left+rect.width/2;
   const targetY=rect.top+rect.height/2;
   setGuideAnchor(current=>{
    const next={left,top,targetX,targetY,panelWidth,startY:top+Math.min(130,panelHeight/2)};
    return current&&Object.keys(next).every(key=>current[key as keyof typeof next]===next[key as keyof typeof next])?current:next;
   });
  };
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(position);
  frame=requestAnimationFrame(position);
  // The coach mounts after the first measurement; measure and observe it once
  // mounted so long copy and smaller screens cannot push it outside the viewport.
  const panelFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const panel=document.querySelector('[data-kmw-tour-panel]');
   if(panel)observer?.observe(panel);
   position();
  }));
  window.addEventListener('resize',position);
  window.addEventListener('scroll',position,true);
  return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(panelFrame);observer?.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true)};
 },[guideStep,challengeFocusOpen,state?.stage,state?.guidedTurn,state?.phase]);

 useEffect(()=>{setScorePadOpen(false)},[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);
 useEffect(()=>{
  if(!riverIntroActive){setRiverIntroArrows([]);return;}
  const arrowTargets:Record<number,string[]>={
   2:['water'],3:['domain-operations','domain-hr','domain-marketing'],
   4:['site'],5:['expert'],6:['water'],7:['water'],9:['challenge-card'],
  };
  const update=()=>{
   const briefing=document.querySelector('[data-kmw-river-brief]');
   if(!briefing)return;
   const box=briefing.getBoundingClientRect();
   const targetNames=arrowTargets[riverIntroStep]||[];
   const fromRight=riverIntroStep===9;
   const fromX=fromRight?box.right+3:box.left-3;
   const fromY=box.top+Math.min(box.height*.52,135);
   const arrows=targetNames.flatMap((name,index)=>{
    const target=document.querySelector('[data-kmw-river-intro="'+name+'"]');
    if(!target)return [];
    const rect=target.getBoundingClientRect();
    const domainStep=riverIntroStep===3;
    // Three separate exits underneath the CEO briefing and three rising
    // arrowheads beneath the actual domain labels. The staggered lower
    // arcs keep the lines from cutting through the names or the River.
    const startX=domainStep?box.left+box.width*(index+1)/(targetNames.length+1):fromX;
    const startY=domainStep?box.bottom+3:fromY;
    const toX=name==='challenge-card'?rect.left+4:rect.left+rect.width/2;
    const toY=domainStep?rect.bottom+8:rect.top+rect.height/2;
    const roomBelow=Math.max(0,window.innerHeight-toY-14);
    const underY=domainStep&&roomBelow>=20?toY+Math.min(roomBelow,96-index*21):undefined;
    return[{fromX:startX,fromY:startY,toX,toY,underY}];
   });
   setRiverIntroArrows(old=>old.length===arrows.length&&old.every((a,i)=>Object.keys(a).every(key=>a[key as keyof typeof a]===arrows[i][key as keyof typeof a]))?old:arrows);
  };
  const frame=requestAnimationFrame(update);
  window.addEventListener('resize',update);
  window.addEventListener('scroll',update,true);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)};
 },[riverIntroActive,riverIntroStep]);

 useEffect(()=>{
  if(!showFreeChallengeIntro||!challengeFocusOpen){setFreeChallengeIntroPlacement(null);return;}
  // Anchor above the Score Pad on the River side while leaving the two
  // Challenge cards visible. Re-measure on resize, scroll and text wrapping.
  const update=()=>{
   const scoreButton=document.querySelector('[data-kmw-scorepad-button]');
   const popup=document.querySelector('[data-kmw-free-challenge-intro]');
   const cards=Array.from(document.querySelectorAll('[data-kmw-free-challenge-card]')).slice(0,2);
   if(!scoreButton||!popup||cards.length!==2)return;
   const anchorRect=scoreButton.getBoundingClientRect();
   const panelHeight=popup.getBoundingClientRect().height;
   const width=Math.min(430,window.innerWidth-24);
   const left=Math.max(12,Math.min(window.innerWidth-width-12,anchorRect.right-width));
   // On smaller screens, keep the entire message visible rather than clip
   // it above the browser viewport.
   const top=Math.max(72,Math.min(anchorRect.top-panelHeight-12,window.innerHeight-panelHeight-12));
   const fromX=left+width+4;
   const fromY=top+Math.min(panelHeight-25,Math.max(75,panelHeight*.66));
   const arrows=cards.map(card=>{
    const rect=card.getBoundingClientRect();
    return{fromX,fromY,toX:rect.left+rect.width/2,toY:rect.bottom-3};
   });
   setFreeChallengeIntroPlacement(previous=>{
    const next={left,top,width,arrows};
    return previous&&previous.left===left&&previous.top===top&&previous.width===width&&previous.arrows.length===arrows.length&&arrows.every((arrow,index)=>Object.keys(arrow).every(k=>arrow[k as keyof typeof arrow]===previous.arrows[index][k as keyof typeof arrow]))?previous:next;
   });
  };
  const frame=requestAnimationFrame(update);
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);
  const popup=document.querySelector('[data-kmw-free-challenge-intro]');
  if(popup)observer?.observe(popup);
  window.addEventListener('resize',update);
  window.addEventListener('scroll',update,true);
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)};
 },[showFreeChallengeIntro,challengeFocusOpen]);

 useEffect(()=>{
  if(!riverTurnoverOpen){setRiverTurnoverRect(null);return;}
  const update=()=>{
   const zone=document.querySelector('[data-kmw-river-chart-area]')?.getBoundingClientRect();
   if(!zone)return;
   const next={left:Math.max(0,zone.left),top:Math.max(0,zone.top),width:Math.min(zone.width,window.innerWidth),height:Math.min(zone.height,window.innerHeight-Math.max(0,zone.top))};
   setRiverTurnoverRect(previous=>previous&&previous.left===next.left&&previous.top===next.top&&previous.width===next.width&&previous.height===next.height?previous:next);
  };
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setRiverTurnoverOpen(false)}};
  const frame=requestAnimationFrame(update);
  const zone=document.querySelector('[data-kmw-river-chart-area]');
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);
  if(zone)observer?.observe(zone);
  window.addEventListener('resize',update);
  window.addEventListener('scroll',update,true);
  document.addEventListener('keydown',escape);
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);document.removeEventListener('keydown',escape)};
 },[riverTurnoverOpen]);
 useEffect(()=>{
  if(state?.stage==='guided'||state?.stage==='complete'||(state?.stage==='free'&&state.freeRound<2))setRiverTurnoverOpen(false);
 },[state?.stage,state?.freeRound]);

 useEffect(()=>{
  const popupAvailable=Boolean(state?.stage==='free'&&state.phase==='invest'&&company.round>=KM_WEEK_AAR_UNLOCK_ROUND&&!aarIntroDismissed&&!readOnly&&localStorage.getItem(`tpg:kmw-aar-intro:${session.id}:${company.id}`)!=='seen');
  if(!popupAvailable){setAARIntroArrow(null);return;}
  const reposition=()=>{
   const panel=document.querySelector('[data-kmw-aar-intro]')?.getBoundingClientRect();
   const button=document.querySelector('[data-kmw-aar-button]')?.getBoundingClientRect();
   if(!panel||!button)return;
   setAARIntroArrow(current=>{
    const next={x1:panel.right-25,y1:panel.bottom-12,x2:button.left+button.width*.5,y2:button.top+4};
    return current&&Object.keys(next).every(key=>next[key as keyof typeof next]===current[key as keyof typeof next])?current:next;
   });
  };
  const frame=requestAnimationFrame(reposition);
  window.addEventListener('resize',reposition);
  window.addEventListener('scroll',reposition,true);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true)};
 },[state?.stage,state?.phase,state?.freeRound,aarIntroDismissed,session.id,company.id,readOnly]);
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
 const riskKnowledge=(expertSelection==='depth'?activeExpertScore:localSelection==='depth'?localScore:0)+(localSelection==='breadth'&&localScore>0?1:0)+(expertSelection==='breadth'&&activeExpertScore>0?1:0);
 const riskOdds=activeChallenge?kmWeekRiskOddsV1(riskKnowledge,activeChallenge.difficulty):{performanceGap:0,requiredRoll:7,successfulFaces:0,chancePercent:0};
 const selectedDepth=localSelection==='depth'?localScore:expertSelection==='depth'?activeExpertScore:0;
 const selectedBreadth=(localSelection==='breadth'&&localScore>0?1:0)+(expertSelection==='breadth'&&activeExpertScore>0?1:0);
 const selectedKnowledge=riskSelected?riskKnowledge:selectedDepth+selectedBreadth;
 const successChance=activeChallenge
  ?selectedKnowledge>=activeChallenge.difficulty?100
   :riskSelected?riskOdds.chancePercent
   :guided&&state.guidedTurn===1&&selectedKnowledge>0?kmWeekRiskOddsV1(selectedKnowledge,activeChallenge.difficulty).chancePercent
   :0
  :0;
 const firstGuidedTour=state.stage==='guided'&&state.guidedTurn===1&&state.phase==='challenge'&&challengeFocusOpen&&activeChallenge?.status==='open'&&guideStep>0;
 const expertTraining=Boolean(activeExpert&&state.trainingCommitments?.[activeExpert.id]===company.round);
 const expertUsed=Boolean(activeExpert&&state.usedExpertIds.includes(activeExpert.id));
 const deterministicSelected=Boolean(activePending?.method&&(activePending.method==='local'||activePending.method==='expert'));
 const knowledgeShortfall=activeChallenge&&!riskSelected?Math.max(0,activeChallenge.difficulty-selectedKnowledge):0;
 const responseReady=Boolean(riskSelected||(deterministicSelected&&(!guided||knowledgeShortfall===0)));
 const activeExpertTravelCost=activeChallenge&&activeExpert&&activeExpert.location!==activeChallenge.siteId?2:0;
 const expertChange=state.expertRetirement;
 const expertChangeKind=state.stage==='free'&&state.phase==='invest'&&expertChange
  ?expertChange.status==='retired'&&state.freeRound===expertChange.retiredAtRound?'retired'
   :expertChange.status==='replaced'&&state.freeRound===expertChange.replacementRound?'replaced'
   :null
  :null;
 const expertChangeKey=expertChangeKind&&expertChange?`${expertChangeKind}:${expertChange.expertId}:${state.freeRound}`:'';
 const showExpertChangePopup=Boolean(expertChangeKind&&expertChangeKey!==expertChangeDismissedKey&&!riskRollPending&&!riskResult);
 // Expert retirement/replacement popups already supply their own reflection question.
 const expertChangeQuestionCoversRound=Boolean(expertChange&&state.stage==='free'&&state.phase==='invest'&&(
   state.freeRound===expertChange.retiredAtRound||state.freeRound===expertChange.replacementRound
 ));
 // Questions are specific to the River after each of the first six full-play
 // rounds. They are presented once per round, after any score, dice, or expert
 // change popup, and only after Challenge/Turnover animations have finished.
 const coachPopupKey=`tpg:kmw-coach:${session.id}:${company.id}:free-${state.freeRound}`;
 const firstScoreBriefPending=state.stage==='free'&&state.freeRound===1&&localStorage.getItem(`tpg:kmw-score-brief:${session.id}:${company.id}`)!=='seen';
 const showCoachPopup=Boolean(state.stage==='free'&&state.phase==='invest'&&coaching&&
  !readOnly&&!busy&&!riskResult&&!riskRollPending&&!challengeOutcome&&!riverFrozenCompany&&
  !scoreBriefOpen&&!firstScoreBriefPending&&!showExpertChangePopup&&!expertChangeQuestionCoversRound&&
  coachDismissedKey!==coachPopupKey&&localStorage.getItem(coachPopupKey)!=='seen');
 const aarIntroKey=`tpg:kmw-aar-intro:${session.id}:${company.id}`;
 const showAARIntro=Boolean(aarCandidates.length&&state.stage==='free'&&state.phase==='invest'&&!readOnly&&!busy&&
  !scoreBriefOpen&&!showCoachPopup&&!showExpertChangePopup&&!riverFrozenCompany&&!aarIntroDismissed&&
  localStorage.getItem(aarIntroKey)!=='seen');
 const dismissAARIntro=()=>{
  localStorage.setItem(aarIntroKey,'seen');
  setAARIntroDismissed(true);
 };
 const dismissCoach=()=>{
  localStorage.setItem(coachPopupKey,'seen');
  setCoachDismissedKey(coachPopupKey);
 };

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

 const presentChallengeOutcome=async(nextCompany:CompanyV2,resolved:KMWeekChallenge)=>{
  // Show the server-confirmed result while the previous turnover is still on
  // screen. The parent session is applied only after the globe lands.
  const change=nextCompany.turnover-company.turnover;
  const won=resolved.status==='success';
  const origin=document.querySelector('[data-kmw-outcome-origin]')?.getBoundingClientRect();
  const turnover=document.querySelector('[data-kmw-turnover-target]')?.getBoundingClientRect();
  const panelWidth=238;
  const left=Math.max(12,Math.min(window.innerWidth-panelWidth-12,(origin?.left||window.innerWidth*.5)+(origin?.width||0)/2-panelWidth/2));
  const top=Math.max(80,Math.min(window.innerHeight-132,(origin?.top||window.innerHeight*.5)+(origin?.height||0)/2-44));
  setChallengeOutcome({won,change,travelCost:resolved.travelCost||0,left,top,fading:false});
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  await new Promise<void>(resolve=>window.setTimeout(resolve,650));

  if(turnover){
   const startX=left+panelWidth/2,startY=top+42;
   const endX=turnover.left+turnover.width/2,endY=turnover.top+turnover.height/2;
   const dx=endX-startX,dy=endY-startY;
   const rise=Math.min(100,Math.max(36,Math.abs(dy)*.14));
   const globe=document.createElement('div');
   globe.className='kmw-knowledge-spark'+(won?' kmw-turnover-globe-win':' kmw-turnover-globe-loss');
   globe.style.left=`${startX-9}px`;
   globe.style.top=`${startY-9}px`;
   document.body.appendChild(globe);
   setChallengeOutcome(current=>current?{...current,fading:true}:null);
   try{
    const motion=globe.animate([
     {transform:'translate(0px,0px) scale(.7)',opacity:0},
     {transform:`translate(${dx*.08}px,${-rise}px) scale(1.16)`,opacity:1,offset:.13},
     {transform:`translate(${dx*.55}px,${dy*.43-rise}px) scale(1.1)`,opacity:1,offset:.53},
     {transform:`translate(${dx}px,${dy}px) scale(.82)`,opacity:1}
    ],{duration:1050,easing:'cubic-bezier(.24,.65,.28,1)',fill:'forwards'});
    await motion.finished;
   }catch{}finally{globe.remove();}
  }else{
   setChallengeOutcome(current=>current?{...current,fading:true}:null);
   await new Promise<void>(resolve=>window.setTimeout(resolve,700));
  }
  setChallengeOutcome(null);
 };

 const cycleKnowledgeSource=(source:'local'|'expert')=>{
  if(!activeChallenge)return;
  setChallengeAttention(false);
  const current=pendingResponse?.challengeId===activeChallenge.id?pendingResponse:null;
  let localState:ResponseSelectionState=current?.localSelection||'none';
  let expertState:ResponseSelectionState=current?.expertSelection||'none';
  if(source==='expert'&&(expertUsed||expertTraining||activeExpertScore<=0))return;
  // On the breadth-explanation card, a second tap on the selected expert
  // acknowledges the explanation; don't accidentally deselect the Depth source.
  if(guideStep===4&&source==='expert'&&expertState==='depth'){
   setGuideStep(5);
   return;
  }
  const next=toggleKMWeekSourceV1(localState,expertState,source,localScore,activeExpertScore);
  localState=next.local;expertState=next.expert;
  if(guideStep===2&&source==='local'&&localState!=='none')setGuideStep(3);
  if(guideStep===3&&source==='expert'&&expertState==='depth')setGuideStep(4);
  if(guideStep===4&&source==='expert'&&expertState==='depth')setGuideStep(5);
  const method:ResponseMethod|undefined=current?.method==='risk'?'risk':localState==='depth'?'local':expertState==='depth'?'expert':undefined;
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
  if(!pendingResponse||!pendingResponse.method||busy||readOnly)return;
  if(guideStep===5)setGuideStep(0);
  const committed=pendingResponse;
  const payload={type:'KM_WEEK_RESOLVE',challengeId:committed.challengeId,method:committed.method,expertId:committed.expertId,includeLocalBreadth:committed.localSelection==='breadth',includeExpertBreadth:committed.expertSelection==='breadth',useLocalRisk:committed.method==='risk'&&committed.localSelection!=='none',useExpertRisk:committed.method==='risk'&&committed.expertSelection==='depth'};

  // Defer incoming session broadcasts until the result has been shown and the
  // turnover globe has reached the header.
  onPresentationHoldChange?.(true);
  if(committed.method==='risk'){
   const odds=kmWeekRiskOddsV1(riskKnowledge,activeChallenge?.difficulty||0);
   setScoreBriefOpen(false);
   setRiskRollPending({requiredRoll:odds.requiredRoll,performanceGap:odds.performanceGap});
  }
  try{
   const ok=await post(payload,async nextSession=>{
    const nextCompany=nextSession.companies.find(item=>item.id===company.id);
    const resolved=nextCompany?.kmWeek?.challenges.find(item=>item.id===committed.challengeId);
    if(!nextCompany||!resolved)return;

    // On a risk response the player sees the authoritative die roll before
    // the same win/loss → globe → turnover sequence as every other response.
    if(committed.method==='risk'&&resolved.dieRoll!==undefined){
     const odds=kmWeekRiskOddsV1(riskKnowledge,resolved.difficulty);
     await new Promise<void>(resolve=>{
      riskContinueRef.current=resolve;
      setRiskResult({roll:resolved.dieRoll!,won:resolved.status==='success',requiredRoll:odds.requiredRoll,performanceGap:odds.performanceGap});
      setRiskRollPending(null);
     });
    }
    await presentChallengeOutcome(nextCompany,resolved);
   });
   if(ok){
    setChallengeDrafts(current=>{
     const next={...current};
     delete next[committed.challengeId];
     if(committed.expertId&&committed.expertSelection!=='none'){
      for(const [challengeId,draft] of Object.entries(next) as [string,Exclude<PendingResponse,null>][]){
       if(draft.expertId!==committed.expertId||draft.expertSelection==='none')continue;
       const localSelection=draft.localSelection;
       next[challengeId]={
        ...draft,
        method:draft.method==='risk'?'risk':localSelection!=='none'?'local':undefined,
        localSelection:localSelection!=='none'?'depth':'none',
        expertId:undefined,
        expertSelection:'none',
        label:localSelection==='depth'?'Local depth':localSelection==='breadth'?'Local breadth · choose a new Depth source':'Expert already committed · choose another response',
       };
      }
     }
     return next;
    });
   }
  }finally{
   setRiskRollPending(null);
   riskContinueRef.current=null;
   setChallengeOutcome(null);
   onPresentationHoldChange?.(false);
  }
 };

 const completeSiteAudits=async()=>{
  if(busy||readOnly||!state.shockResolved)return;
  // Keep the pre-audit turnover in the header until the fine reaches it.
  onPresentationHoldChange?.(true);
  try{
   await post({type:'KM_WEEK_COMPLETE_SHOCK'},async()=>{
    const origin=document.querySelector('[data-kmw-audit-fine]')?.getBoundingClientRect();
    const target=document.querySelector('[data-kmw-turnover-target]')?.getBoundingClientRect();
    if(!origin||!target)return;
    const startX=origin.left+origin.width/2,startY=origin.top+origin.height/2;
    const dx=target.left+target.width/2-startX,dy=target.top+target.height/2-startY;
    const globe=document.createElement('div');
    globe.className='kmw-knowledge-spark '+(auditFine>0?'kmw-turnover-globe-loss':'kmw-turnover-globe-win');
    globe.style.left=`${startX-9}px`;
    globe.style.top=`${startY-9}px`;
    document.body.appendChild(globe);
    try{
     const path=globe.animate([
      {transform:'translate(0,0) scale(.65)',opacity:0},
      {transform:`translate(${dx*.12}px,-55px) scale(1.2)`,opacity:1,offset:.16},
      {transform:`translate(${dx*.55}px,${dy*.43-80}px) scale(1.08)`,opacity:1,offset:.58},
      {transform:`translate(${dx}px,${dy}px) scale(.85)`,opacity:1}
     ],{duration:1350,easing:'cubic-bezier(.25,.62,.3,1)',fill:'forwards'});
     await path.finished;
    }catch{}finally{globe.remove();}
    // The incoming completed session, including turnover, applies only now.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   });
  }finally{onPresentationHoldChange?.(false)}
 };

 const guidedTargetInvestment:KMWeekInvestment|undefined=guided?(state.guidedTurn===1?'TRAIN_EXPERT':state.guidedTurn===2?'LOCAL_TRAINING':'KNOWLEDGE_TRANSFER'):undefined;
 const source=company.sites.find(site=>site.id===sourceSiteId);
 const target=company.sites.find(site=>site.id===targetSiteId);
 const investmentPreview=investment==='AFTER_ACTION_REVIEW'
   ?aarChallenge&&aarSite&&aarExpert?`${aarChallenge.status==='success'?'SUCCESS':'FAILURE'}: ${aarSite.name} ${domainLabel(aarChallenge.domain)} ${aarSiteBefore} → ${aarSiteBefore+aarSiteDelta}; ${aarExpert.name.split(' ')[0]} ${aarExpertBefore} → ${aarExpertBefore+aarExpertDelta} · $50k`:'Choose a qualifying Challenge'
   :investment==='TRAIN_EXPERT'
   ?specialist?`${specialist.name}: ${specialistScore(company,specialistDomain)} → ${Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,specialistScore(company,specialistDomain)+1)}`:'Choose a company expert'
   :investment==='LOCAL_TRAINING'
    ?specialist&&localTrainingSite?`${localTrainingSite.name} ${domainLabel(specialistDomain)}: ${localTrainingSite.teamCapability[specialistDomain]||0} → ${Math.min(5,specialistScore(company,specialistDomain),(localTrainingSite.teamCapability[specialistDomain]||0)+2)} · ${localTrainingTravelCost?`Travel $2k · total $12k`:'No travel · total $10k'}`:'Choose an expert and training site'
    :source&&target?(()=>{
      const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;
      const uplift=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
      return uplift?`${source.name} ${domainLabel(selectedDomain)} ${from} → ${target.name} ${to} → ${Math.min(from,to+uplift)} (+${uplift})`:`${source.name} must know more than ${target.name}`;
    })():'Choose two sites';

 const previewForIntervention=(kind:KMWeekInvestment):RiverGhostPreview|undefined=>{
  if(kind==='TRAIN_EXPERT'&&specialist){
   const score=specialistScore(company,specialistDomain);
   return score<KM_WEEK_MAX_EXPERT_KNOWLEDGE?{kind:'expert',domain:specialistDomain,expertId:specialist.id,delta:1}:undefined;
  }
  if(kind==='LOCAL_TRAINING'&&specialist&&localTrainingSite){
   const score=localTrainingSite.teamCapability[specialistDomain]||0;
   const ceiling=specialistScore(company,specialistDomain);
   const delta=Math.max(0,Math.min(5,score+2,ceiling)-score);
   return delta?{kind:'site',domain:specialistDomain,siteId:localTrainingSite.id,delta}:undefined;
  }
  if(kind==='KNOWLEDGE_TRANSFER'&&source&&target){
   const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;
   const delta=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
   return delta&&to<5?{kind:'transfer',domain:selectedDomain,sourceSiteId:source.id,targetSiteId:target.id,delta}:undefined;
  }
  if(kind==='AFTER_ACTION_REVIEW'&&aarChallenge&&aarSite&&aarExpert){
   return{kind:'aar',domain:aarChallenge.domain,siteId:aarSite.id,expertId:aarExpert.id,siteDelta:aarSiteDelta,expertDelta:aarExpertDelta};
  }
  return undefined;
 };
 // The information icon temporarily overrides the selected investment's River
 // preview, without changing the investment or its form settings.
 const scoreGhostPreview:RiverGhostPreview|undefined=infoInvestment
  ?previewForIntervention(infoInvestment)
  :investment==='AFTER_ACTION_REVIEW'&&state.phase==='invest'
   ?previewForIntervention('AFTER_ACTION_REVIEW')
   :scoreGhost==='expertise'?previewForIntervention('TRAIN_EXPERT')
   :scoreGhost==='local'?previewForIntervention('LOCAL_TRAINING')
   :scoreGhost==='flow'?previewForIntervention('KNOWLEDGE_TRANSFER')
   :scoreGhost==='resilience'?{kind:'threshold',value:KM_WEEK_SHOCK_CUTOFF,label:`AUDIT TARGET · ${KM_WEEK_SHOCK_CUTOFF}`}
   :undefined;
 const infoPreviewText=infoInvestment==='AFTER_ACTION_REVIEW'
  ?aarChallenge&&aarSite&&aarExpert?`${aarSite.name}: ${aarSiteBefore} → ${aarSiteBefore+aarSiteDelta}; ${aarExpert.name.split(' ')[0]}: ${aarExpertBefore} → ${aarExpertBefore+aarExpertDelta} (${aarChallenge.status==='failure'?'learning from failure':'learning from success'})`:'No eligible event in this round.'
  :infoInvestment==='TRAIN_EXPERT'
   ?specialist?`${specialist.name}: ${specialistScore(company,specialistDomain)} → ${Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,specialistScore(company,specialistDomain)+1)} (${domainLabel(specialistDomain)})`:'Choose an expert to preview.'
   :infoInvestment==='LOCAL_TRAINING'
    ?specialist&&localTrainingSite?`${localTrainingSite.name}: ${localTrainingSite.teamCapability[specialistDomain]||0} → ${Math.max(localTrainingSite.teamCapability[specialistDomain]||0,Math.min(5,(localTrainingSite.teamCapability[specialistDomain]||0)+2,specialistScore(company,specialistDomain)))} (${domainLabel(specialistDomain)})`:'Choose an expert and a training site.'
    :infoInvestment==='KNOWLEDGE_TRANSFER'
     ?source&&target?(()=>{const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;return from>to?`${source.name} (${from}) → ${target.name} (${to} → ${Math.min(5,to+Math.max(1,Math.ceil((from-to)/2)))})`:'Choose a teaching site with more knowledge than the learning site.'})():'Choose two sites.'
     :'';
 const infoPreviewDomain=infoInvestment==='AFTER_ACTION_REVIEW'?aarChallenge?.domain:infoInvestment==='KNOWLEDGE_TRANSFER'?selectedDomain:infoInvestment?specialistDomain:undefined;

 const invest=async(event:React.MouseEvent<HTMLButtonElement>)=>{
  let payload:any,targetKey='';
  if(investment==='AFTER_ACTION_REVIEW'){
    if(!aarChallenge||!aarExpert)return;
    payload={type:'KM_WEEK_INVEST',investment,challengeId:aarChallenge.id};
    targetKey=`expert:${aarExpert.id}:${aarChallenge.domain}`;
  }else if(investment==='TRAIN_EXPERT'){
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

  // Build the River-only result locally so the capability change can begin
  // the instant the orb lands, even if the server round-trip is still finishing.
  const optimisticCompany=structuredClone(company);
  if(investment==='AFTER_ACTION_REVIEW'){
   const site=optimisticCompany.sites.find(item=>item.id===aarChallenge?.siteId);
   const expert=optimisticCompany.experts.find(item=>item.id===aarExpert?.id);
   const skill=expert?.domains.find(item=>item.domain===aarChallenge?.domain);
   if(site&&skill&&aarChallenge){
    site.teamCapability[aarChallenge.domain]=Math.min(5,(site.teamCapability[aarChallenge.domain]||0)+aarUplift);
    skill.score=Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,skill.score+aarUplift);
   }
  }else if(investment==='TRAIN_EXPERT'){
   const expert=optimisticCompany.experts.find(item=>item.id===payload.expertId);
   const skill=expert?.domains.find(item=>item.domain===payload.domain);
   if(skill)skill.score=Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,skill.score+1);
  }else if(investment==='LOCAL_TRAINING'){
   const expert=optimisticCompany.experts.find(item=>item.id===payload.expertId);
   const site=optimisticCompany.sites.find(item=>item.id===payload.siteId);
   const skill=expert?.domains.find(item=>item.domain===payload.domain);
   if(expert&&site&&skill){
    const before=site.teamCapability[payload.domain]||0;
    site.teamCapability[payload.domain]=Math.min(5,before+2,skill.score);
    expert.location=site.id;
   }
  }else{
   const sourceSite=optimisticCompany.sites.find(item=>item.id===payload.sourceSiteId);
   const targetSite=optimisticCompany.sites.find(item=>item.id===payload.targetSiteId);
   if(sourceSite&&targetSite){
    const from=sourceSite.teamCapability[payload.domain]||0;
    const to=targetSite.teamCapability[payload.domain]||0;
    const uplift=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
    if(uplift)targetSite.teamCapability[payload.domain]=Math.min(5,from,to+uplift);
   }
  }

  setRiverFrozenCompany(structuredClone(company));
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));

  // Start the request and orb together. The server may finish at any point,
  // but the main board remains held until the orb and River sequence completes.
  let releasePresentation:()=>void=()=>{};
  const presentationDone=new Promise<void>(resolve=>{releasePresentation=resolve});
  const postPromise=post(payload,async()=>{await presentationDone});
  const animationPromise=animateKnowledgeSpark(startX,startY,targetKey);

  await animationPromise;

  // Orb arrival hands straight into the River transition with no network wait.
  setRiverFrozenCompany(optimisticCompany);
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  await new Promise<void>(resolve=>window.setTimeout(resolve,1300));

  releasePresentation();
  const ok=await postPromise;
  if(!ok)setRiverFrozenCompany(structuredClone(company));
  onPresentationHoldChange?.(false);
  setRiverFrozenCompany(null);
 };

 const challengeDone=state.challenges.length>0&&state.challenges.every(challenge=>challenge.status!=='open');
 const shockDone=state.stage==='complete';
  const auditFine=state.auditFineTotal??state.shockChecks.filter(check=>!check.passed).reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge)*KM_WEEK_SHOCK_GAP_COST,0);
  const shownTurnover=state.stage==='shock'&&state.shockResolved?(state.auditTurnoverBefore??company.turnover+auditFine):company.turnover;
 const challengeStepDone=state.stage==='guided'||state.stage==='free'?state.phase==='invest':state.stage==='shock'||shockDone;
 const investStepDone=state.stage==='shock'||shockDone;
 const turnoverToggleAvailable=(state.stage==='free'&&state.freeRound>=2)||state.stage==='shock';


 return <div className="min-h-screen bg-[#071019] text-slate-100 xl:h-screen xl:overflow-hidden">
  <header className="relative z-[100] border-b-2 border-amber-950/60 bg-[#09131f]/98 px-3 py-2 shadow-xl min-[700px]:h-[66px]">
   <div className="mx-auto flex h-full w-full items-center gap-2">
    <div className="mr-auto min-w-0"><div className="text-[8px] font-black uppercase tracking-[.22em] text-emerald-300">The Performance Gap · KM Week</div><div className="flex min-w-0 items-center gap-2"><Building2 className="h-5 w-5 shrink-0 text-amber-300"/><h1 className="truncate text-lg font-black text-white">{company.name}</h1><span className="hidden rounded-md border border-slate-700 px-1.5 py-0.5 text-[9px] font-black text-slate-500 sm:inline">{session.id}</span>{readOnly?<span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400 lg:inline">Watching · CEO {controllerName}</span>:<span className="hidden rounded-full border border-amber-600 bg-amber-950/50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200 lg:inline"><Crown className="mr-1 inline h-3 w-3"/>CEO · You</span>}</div></div>
    <button type="button" data-kmw-turnover-target onClick={()=>setTurnoverChartOpen(true)} aria-haspopup="dialog" className="flex h-12 min-w-[112px] flex-col justify-center rounded-xl border-2 border-emerald-800 bg-emerald-950/25 px-3 text-left transition hover:border-emerald-500 hover:bg-emerald-950/40"><div className="text-[8px] font-black uppercase text-emerald-400">Turnover</div><div className="text-base font-black leading-none text-emerald-200">{money(shownTurnover)}</div></button>
    <div className="flex h-12 min-w-[82px] flex-col justify-center rounded-xl border-2 border-amber-700 bg-amber-950/25 px-3"><div className="text-[8px] font-black uppercase text-amber-400">Score</div><div className="text-base font-black leading-none text-amber-200">{state.score.total}</div></div>
    <div title={overtime?'KM Week is time-boxed, not hard-stopped. Finish the game at your own pace.':undefined} className="flex h-12 min-w-[92px] flex-col justify-center rounded-xl border-2 border-violet-800 bg-violet-950/25 px-3"><div className="text-[8px] font-black uppercase text-violet-400">Game time</div><div className={`font-black leading-none tabular-nums ${overtime?'text-xs text-amber-200':'text-base text-violet-100'}`}>{overtime?'OVERTIME':`${mm}:${ss}`}</div></div>
    {!readOnly&&members.length>1&&onTransferCeo&&<select defaultValue="" onChange={event=>{const id=event.target.value;event.currentTarget.value='';if(id)onTransferCeo(id)}} className="h-12 rounded-xl border-2 border-amber-800 bg-slate-950 px-2 text-[10px] font-black text-amber-100"><option value="">Pass CEO…</option>{members.filter(member=>member.id!==participant?.id).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>}
    <button onClick={onLeave} className="h-12 min-w-[92px] rounded-xl border-2 border-rose-800 bg-rose-950/30 px-3 text-xs font-black text-rose-200 hover:border-rose-500"><LogOut className="mr-1 inline h-4 w-4"/>Leave</button>
   </div>
  </header>

  {firstGuidedTour&&guideAnchor&&activeChallenge&&<>
   <svg className="pointer-events-none fixed inset-0 z-[150]" style={{width:'100vw',height:'100vh'}} aria-hidden="true">
    <defs><marker id="kmw-tour-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#38bdf8" strokeWidth="1.5"/></marker></defs>
    <path d={`M ${guideAnchor.left+guideAnchor.panelWidth+6} ${guideAnchor.startY} C ${guideAnchor.left+guideAnchor.panelWidth+65} ${guideAnchor.startY}, ${guideAnchor.targetX-66} ${guideAnchor.targetY}, ${guideAnchor.targetX} ${guideAnchor.targetY}`} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" markerEnd="url(#kmw-tour-arrowhead)"/>
   </svg>
   <section data-kmw-tour-panel role="status" aria-live="polite" aria-label="Guided challenge walkthrough" className="fixed z-[160] rounded-[22px] border-[3px] border-sky-400 bg-[#071526] p-4 text-left text-white shadow-[0_14px_55px_rgba(8,145,178,.4)]" style={{left:guideAnchor.left,top:guideAnchor.top,width:guideAnchor.panelWidth,maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100vh - 96px)',overflowY:'auto'}}>
    <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wide text-sky-200">{guideStep} of 5</span><span className="flex gap-1">{[1,2,3,4,5].map(i=><span key={i} className={'h-2 w-2 rounded-full '+(i===guideStep?'bg-sky-300':i<guideStep?'bg-sky-600':'bg-slate-600')}/>)}</span></div>
    <h3 className="text-lg font-black text-white">{guideStep===1?'The business problem':guideStep===2?'Start with the local team':guideStep===3?'Bring in our expert':guideStep===4?'The team still contributes':'Solve the problem'}</h3>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">{guideStep===1?<>A surprise business problem has happened in {siteName(company,activeChallenge.siteId)}. Solving it requires significant {domainLabel(activeChallenge.domain)} expertise.</>:guideStep===2?<>Your {siteName(company,activeChallenge.siteId)} team is usually pretty good, but doesn’t have enough knowledge to handle this problem alone. Click their circle to involve them and watch the chance of success increase.</>:guideStep===3?<>Thankfully {activeExpert?.name.split(' ')[0]||'our specialist'} is our company expert in {domainLabel(activeChallenge.domain)}. Based in {activeExpert?siteName(company,activeExpert.location):'another city'}, we can fly them in for a small travel and accommodation cost. Select their circle. Their expertise will guarantee success.</>:guideStep===4?<>Notice how {siteName(company,activeChallenge.siteId)} has moved into a supporting role. We call this <b className="text-sky-300">knowledge breadth</b>. Each additional supporting source contributes one point alongside the expert’s depth.</>:<>Now click <b className="text-amber-300">Commit Response</b> to solve the problem.</>}</p>
    {(guideStep===1||guideStep===4)&&<button type="button" onClick={()=>setGuideStep(guideStep===1?2:5)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-sky-400 px-3 py-2 text-sm font-black text-slate-950">NEXT <ArrowRight className="h-4 w-4"/></button>}
    {(guideStep===2||guideStep===3||guideStep===5)&&<p className="mt-3 text-xs font-bold text-sky-300">Select the highlighted {guideStep===5?'Commit Response button':'circle'} to continue.</p>}
   </section>
  </>}

  {challengeOutcome&&<div data-kmw-challenge-outcome aria-live="polite" className={'pointer-events-none fixed z-[200] w-[238px] rounded-2xl border-[3px] px-4 py-3 text-center shadow-[0_15px_50px_rgba(0,0,0,.7)] transition-opacity duration-[900ms] '+(challengeOutcome.won?'border-emerald-300 bg-emerald-950 text-emerald-100':'border-rose-300 bg-rose-950 text-rose-100')+(challengeOutcome.fading?' opacity-0':' opacity-100')} style={{left:challengeOutcome.left,top:challengeOutcome.top}}>
   <div className="text-xs font-black uppercase tracking-[.17em]">{challengeOutcome.won?'SUCCESS':'FAILURE'}</div>
   <div className={'mt-1 text-2xl font-black tabular-nums '+(challengeOutcome.won?'text-emerald-300':'text-rose-300')}>{challengeOutcome.change>=0?'+':'−'}{money(Math.abs(challengeOutcome.change))}</div>
   <div className="text-[10px] font-bold text-slate-300">Turnover {challengeOutcome.change>=0?'gain':'loss'}{challengeOutcome.travelCost?' · includes travel':''}</div>
  </div>}
  {riverTurnoverOpen&&<>
   <div aria-hidden="true" data-kmw-turnover-shade className="fixed inset-0 z-[200] bg-black/75"/>
   {riverTurnoverRect&&<div className="fixed z-[220]" style={riverTurnoverRect}>
    <TurnoverRiverChart session={session} currentCompanyId={company.id}/>
   </div>}
  </>}
  <TurnoverKnowledgeModal open={turnoverChartOpen} session={session} currentCompanyId={company.id} onClose={()=>setTurnoverChartOpen(false)}/>

  {showExpertChangePopup&&expertChange&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[180] bg-black/70"/>
   <div role="dialog" aria-modal="true" aria-label={expertChangeKind==='retired'?'Expert retirement':'New expert hired'} className="fixed left-1/2 top-1/2 z-[195] w-[min(500px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-5 shadow-[0_28px_90px_rgba(0,0,0,.78)]">
    <button type="button" onClick={()=>setExpertChangeDismissedKey(expertChangeKey)} aria-label="Close expert change message" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500 hover:text-white"><X className="h-4 w-4"/></button>
    {expertChangeKind==='retired'?<>
     <div className="text-[9px] font-black uppercase tracking-[.18em] text-rose-300">Knowledge risk just became real</div>
     <h2 className="mt-2 pr-10 text-2xl font-black text-white">{expertChange.retiredName} has retired.</h2>
     <p className="mt-2 text-sm leading-relaxed text-slate-200">Your highest-scoring expert was <b className="text-amber-200">{domainLabel(expertChange.domain)} Knowledge {expertChange.retiredScore}</b>. That expertise has now left the company.</p>
     <div className="mt-4 rounded-xl border-2 border-violet-700 bg-violet-950/25 p-3">
      <div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">Your question</div>
      <div className="mt-1 text-base font-black text-white">What are you going to do to rebuild this capability?</div>
     </div>
    </>:<>
     <div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Replacement expert hired</div>
     <h2 className="mt-2 pr-10 text-2xl font-black text-white">{expertChange.replacementName} has joined the company.</h2>
     <p className="mt-2 text-sm leading-relaxed text-slate-200">Your new <b className="text-amber-200">{domainLabel(expertChange.domain)}</b> expert starts at <b className="text-amber-200">Knowledge {expertChange.replacementScore}</b>.</p>
     <div className="mt-4 rounded-xl border-2 border-violet-700 bg-violet-950/25 p-3">
      <div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">Your question</div>
      <div className="mt-1 text-base font-black text-white">What are you planning to do to protect the organisation from this happening again?</div>
     </div>
    </>}
    <button type="button" onClick={()=>setExpertChangeDismissedKey(expertChangeKey)} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">CONTINUE TO INVEST <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </div>
  </>}

  {state.stage==='guided'&&state.phase==='invest'&&state.guidedTurn===1&&!firstInvestBriefDismissed&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[120] bg-black/75"/>
   <div className="fixed left-1/2 top-1/2 z-[145] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.72)]">
    <div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">Before your first investment</div>
    <h2 className="mt-2 text-xl font-black text-white">Let me guide you through your three investment choices.</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">Each round I will suggest one investment choice with the best settings. Feel free to retarget if you want to try a slightly different strategy.</p>
    <p className="mt-2 text-xs text-slate-400">After these guided moves, you'll choose your own investments.</p>
    <button type="button" onClick={()=>setFirstInvestBriefDismissed(true)} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">SHOW ME THE FIRST INVESTMENT <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </div>
  </>}

  {(riskRollPending||riskResult)&&<div className="fixed inset-0 z-[205] grid place-items-center bg-black/70 p-4">
   {riskResult?<div role="dialog" aria-modal="true" aria-label="Risk response result" className={`w-[min(360px,calc(100vw-32px))] rounded-[24px] border-4 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.75)] ${riskResult.won?'border-emerald-300 bg-emerald-950':'border-rose-300 bg-rose-950'}`}>
    <Dices className={`mx-auto h-10 w-10 ${riskResult.won?'text-emerald-200':'text-rose-200'}`}/>
    <div className="mt-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-300">You took the chance</div>
    <div className="mt-3 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-left text-xs text-slate-200">
     <div className="flex items-center justify-between"><span>Performance gap</span><b className="text-white">{riskResult.performanceGap}</b></div>
     <div className="mt-1 flex items-center justify-between"><span>Roll needed</span><b className="text-white">{riskResult.requiredRoll}+</b></div>
     <div className="mt-1 flex items-center justify-between"><span>Dice roll</span><b className="text-xl text-white">{riskResult.roll}</b></div>
    </div>
    <div className={`mt-3 text-xl font-black ${riskResult.won?'text-emerald-200':'text-rose-200'}`}>{riskResult.won?'SUCCESS':'FAILURE'}</div>
    <button type="button" onClick={()=>{setRiskResult(null);riskContinueRef.current?.();riskContinueRef.current=null}} className={`mt-4 h-11 w-full rounded-xl border-2 text-sm font-black ${riskResult.won?'border-emerald-200 bg-emerald-300 text-emerald-950':'border-rose-200 bg-rose-300 text-rose-950'}`}>CONTINUE</button>
   </div>:<div role="dialog" aria-modal="true" aria-label="Rolling risk response" className="w-[min(360px,calc(100vw-32px))] rounded-[24px] border-4 border-violet-300 bg-violet-950 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.75)]">
    <Dices className="mx-auto h-12 w-12 animate-spin text-violet-200"/>
    <div className="mt-3 text-[10px] font-black uppercase tracking-[.18em] text-violet-200">You took the chance</div>
    <div className="mt-2 text-xl font-black text-white">ROLLING…</div>
    <div className="mt-3 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-left text-xs text-slate-200">
     <div className="flex items-center justify-between"><span>Performance gap</span><b className="text-white">{riskRollPending?.performanceGap}</b></div>
     <div className="mt-1 flex items-center justify-between"><span>Roll needed</span><b className="text-white">{riskRollPending?.requiredRoll}+</b></div>
    </div>
   </div>}
  </div>}

  {showFreeChallengeIntro&&challengeFocusOpen&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[118] bg-black/35"/>
   {freeChallengeIntroPlacement?.arrows.length===2&&<svg className="pointer-events-none fixed inset-0 z-[140] h-screen w-screen" aria-hidden="true">
    <defs><marker id="kmw-free-challenge-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#7dd3fc" strokeWidth="1.8"/></marker></defs>
    {freeChallengeIntroPlacement.arrows.map((arrow,index)=><path key={index} d={`M ${arrow.fromX} ${arrow.fromY} C ${arrow.fromX+55} ${arrow.fromY}, ${arrow.toX-35} ${arrow.toY+45}, ${arrow.toX} ${arrow.toY}`} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" markerEnd="url(#kmw-free-challenge-arrow)"/>)}
   </svg>}
   <section data-kmw-free-challenge-intro role="dialog" aria-modal="true" aria-label="Two challenges per round" className="fixed z-[160] max-h-[calc(100dvh-88px)] overflow-y-auto overscroll-contain rounded-[22px] border-[3px] border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-4 text-left text-white shadow-[0_24px_80px_rgba(0,0,0,.8)]" style={{left:freeChallengeIntroPlacement?.left??12,top:freeChallengeIntroPlacement?.top??72,width:freeChallengeIntroPlacement?.width??'min(430px,calc(100vw - 24px))'}}>
    <div className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300">Your first independent round</div>
    <p className="mt-3 text-[14px] leading-relaxed text-slate-100">OK, you've got the hang of it now, from here on it's up to you. Please note, each round will now have two challenges at a time. You can draft a response and flip between them to plan before committing. Remember, sometimes things aren't certain. If you can't 100% nail a task, then do your best to minimise the risk.</p>
    <button type="button" onClick={dismissFreeChallengeIntro} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">GOT IT — SHOW ME BOTH CHALLENGES <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </section>
  </>}

  {showAARIntro&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[117] bg-black/60"/>
   {aarIntroArrow&&<svg className="pointer-events-none fixed inset-0 z-[148] h-screen w-screen" aria-hidden="true">
    <defs><marker id="kmw-aar-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0 L7 4 L0 8" fill="none" stroke="#38bdf8" strokeWidth="1.6"/></marker></defs>
    <path d={`M ${aarIntroArrow.x1} ${aarIntroArrow.y1} C ${aarIntroArrow.x1+35} ${aarIntroArrow.y1+56}, ${aarIntroArrow.x2-70} ${aarIntroArrow.y2-36}, ${aarIntroArrow.x2} ${aarIntroArrow.y2}`} stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" fill="none" markerEnd="url(#kmw-aar-arrow)"/>
   </svg>}
   <section data-kmw-aar-intro role="dialog" aria-modal="true" aria-label="After Action Review introduction" className="fixed left-[30%] top-[26%] z-[165] w-[min(420px,calc(100vw-24px))] max-h-[calc(100dvh-100px)] -translate-x-1/2 overflow-y-auto rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#30210b,#101827)] p-5 text-left shadow-[0_25px_65px_rgba(0,0,0,.8)] max-[699px]:left-1/2 max-[699px]:top-[10%]">
    <div className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300">A new investment choice</div>
    <h3 className="mt-2 text-xl font-black text-white">Learn from a tough Challenge</h3>
    <p className="mt-3 text-sm leading-relaxed text-slate-200">The last challenge was pretty tricky and is a good candidate for an After Action Review. Getting everyone involved will cost around <b className="text-amber-200">$50k</b> in travel and lost worktime, but the insights will benefit both the expert who is facilitating <b>and</b> the site where the challenge happened. This option only appears on tough events, so use it wisely. Remember, your people learn more from failure than success.</p>
    <button type="button" onClick={dismissAARIntro} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">GOT IT — SHOW ME THE REVIEW <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </section>
  </>}

  {showCoachPopup&&coaching&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[118] bg-black/65"/>
   <section role="dialog" aria-modal="true" aria-label="Knowledge investment coaching question" data-kmw-coaching-popup className="fixed left-1/2 top-1/2 z-[145] max-h-[calc(100dvh-90px)] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[22px] border-2 border-sky-300 bg-[linear-gradient(145deg,#10253a,#111827)] p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,.75)] min-[700px]:left-[61%] min-[700px]:w-[calc(39%-16px)] min-[700px]:translate-x-0">
    <div className="text-[10px] font-black uppercase tracking-[.15em] text-sky-300">A question before you invest · Round {state.freeRound} of 6</div>
    <p className="mt-3 text-[17px] font-semibold leading-relaxed text-white">{coaching.text}</p>
    <button type="button" onClick={dismissCoach} className="mt-4 h-11 w-full rounded-xl border-2 border-sky-200 bg-sky-400 text-sm font-black text-slate-950">CONTINUE TO INVEST <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </section>
  </>}

  {scoreBriefOpen&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[120] bg-black/70"/>
   <div className="fixed left-1/2 top-1/2 z-[145] max-h-[calc(100dvh-90px)] w-[min(430px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-4 shadow-[0_24px_80px_rgba(0,0,0,.72)] min-[700px]:left-[61%] min-[700px]:w-[calc(39%-16px)] min-[700px]:translate-x-0 xl:p-5">
    <div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">Score briefing · First full round</div>
    <h2 className="mt-2 text-2xl font-black text-white">Nice work — you’re up to {state.score.total} points.</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">Your Score Pad tracks <b className="text-amber-200">business results, expertise, local capability, knowledge flow and Squeaky clean audit results</b>. Different investments strengthen different parts of your score.</p>
     <p className="mt-2 text-sm leading-relaxed text-slate-200"><b className="text-amber-200">Site Audits are coming.</b> Auditors will check five local capabilities. Experts can't step in. Weak sites risk costly fines of <b>$40k per missing knowledge level found</b>. Clear all five audits for <b>10 bonus points</b> on top of the five audit points.</p>
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/75 p-3">
     <div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">Your Goal card</div>
     <div className="mt-1 text-base font-black text-white">{goal.title} · 5 points</div>
     <p className="mt-1 text-xs leading-relaxed text-slate-400">{goal.description}</p>
     
    </div>
    
    <button type="button" onClick={()=>{localStorage.setItem(`tpg:kmw-score-brief:${session.id}:${company.id}`,'seen');setScoreBriefOpen(false);setScorePadOpen(false)}} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">GOT IT — LET ME INVEST <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </div>
  </>}

  {riverIntroActive&&<>
   {riverIntroStep===1&&<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[135] bg-black/75"/>}
   {riverIntroStep<9&&<button type="button" aria-label="Next River introduction step" className="fixed inset-0 z-[160] cursor-pointer bg-transparent" onClick={advanceRiverIntro}/>}
   {riverIntroArrows.length>0&&<svg className="pointer-events-none fixed inset-0 z-[180] h-screen w-screen" aria-hidden="true">
    <defs><marker id="kmw-river-intro-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" stroke="#7dd3fc" fill="none" strokeWidth="1.8"/></marker></defs>
    {riverIntroArrows.map((arrow,index)=>{
     const risingDomainArrow=riverIntroStep===3&&arrow.underY!==undefined;
     // Sweep below the labels, then approach each domain vertically upwards.
     // Other tutorial stages keep the existing direct curved arrows.
     const path=risingDomainArrow
      ?`M ${arrow.fromX} ${arrow.fromY} C ${arrow.fromX} ${arrow.fromY+54}, ${arrow.fromX-14} ${arrow.underY}, ${arrow.fromX-76} ${arrow.underY} C ${arrow.toX+95} ${arrow.underY}, ${arrow.toX} ${arrow.toY+Math.min(46,(arrow.underY!-arrow.toY)*.65)}, ${arrow.toX} ${arrow.toY}`
      :`M ${arrow.fromX} ${arrow.fromY} C ${arrow.fromX+(riverIntroUnlocked?48:-46)} ${arrow.fromY}, ${arrow.toX+(riverIntroUnlocked?-60:38)} ${arrow.toY}, ${arrow.toX} ${arrow.toY}`;
     return <path key={index} d={path} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" markerEnd="url(#kmw-river-intro-arrow)"/>;
    })}
   </svg>}
   <section role="dialog" aria-modal={riverIntroStep<9} aria-label="CEO briefing: the Knowledge River" data-kmw-river-brief onClick={advanceRiverIntro} className={'fixed top-1/2 z-[190] max-h-[calc(100dvh-80px)] w-[min(380px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,.75)] min-[700px]:w-[min(400px,calc(38vw-24px))] '+(riverIntroUnlocked?'left-1/2 min-[700px]:left-[30%]':'left-1/2 min-[700px]:left-[80%]')}>
    <div className="flex items-center justify-between gap-2"><div className="text-[11px] font-black uppercase tracking-[.14em] text-amber-300">CEO briefing · Knowledge River</div><div className="text-xs font-black text-sky-300">{riverIntroStep}/9</div></div>
    <p className="mt-3 text-[15px] leading-relaxed text-white">
     {riverIntroStep===1?<>Welcome, CEO of <b>{company.name}</b>. Your company has pockets of expertise, but not every site has the knowledge it needs. Solve today's business problems while building capability across the company.</>:
      riverIntroStep===2?<>Knowledge and expertise are intangible assets. Being able to visualise them and how they contribute to your capability is important. We do that with the <b>River Diagram</b>.</>:
      riverIntroStep===3?<>These are the critical knowledge domains of your company.</>:
      riverIntroStep===4?<>These show how each site rates itself in that domain. The higher the number, the greater the team's capability. Even when someone is on holiday, the local team can deliver to this level.</>:
      riverIntroStep===5?<>Across your company you have several experts. They know much more than those around them, but are a limited resource and also a knowledge-loss risk.</>:
      riverIntroStep===6?<>The River itself represents what the company as a whole knows.</>:
      riverIntroStep===7?<>The south bank is the least we know as a company. The north bank is the most we know. Anything beyond it must come from elsewhere — training, consultants, vendors and other sources.</>:
      riverIntroStep===8?<>Each turn you will put this knowledge to work solving problems at your sites, followed by an Invest phase where you can improve the level and distribution of expertise across the company.</>:
      <>Each Challenge requires a particular level of knowledge in one domain. <b>Click the Challenge card below to get started.</b></>}
    </p>
    {riverIntroStep<9&&<button type="button" onClick={event=>{event.stopPropagation();advanceRiverIntro()}} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">NEXT <ArrowRight className="ml-1 inline h-4 w-4"/></button>}
    {riverIntroUnlocked&&<p className="mt-3 text-xs font-bold text-sky-200">Select the highlighted Challenge card to continue.</p>}
   </section>
  </>}

  {challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')&&<div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 top-[66px] z-40 bg-black/20"/>}

  {state.stage==='complete'?<KMWeekDebriefV1 session={session} company={company}/>:<main className="mx-auto w-full p-3 min-[700px]:flex min-[700px]:h-[calc(100dvh-66px)] min-[700px]:flex-col min-[700px]:overflow-hidden">
   <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
    <div className="rounded-xl border-2 border-indigo-700 bg-indigo-950/45 px-3 py-1.5 text-[10px] font-black text-indigo-100">{phaseTitle(company)}</div>
    <PhaseStep number="1" label="Challenge" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'} done={challengeStepDone}/>
    <PhaseStep number="2" label="Invest" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'} done={investStepDone}/>
    <PhaseStep number="3" label="Site Audits" active={state.stage==='shock'} done={shockDone}/>
    <PhaseStep number="4" label="Score" active={state.stage==='complete'} done={false}/>
    
   </div>

   {finalShockWindow&&<div className="mb-2 shrink-0 rounded-xl border-2 border-rose-500 bg-rose-950/35 px-3 py-2 text-[10px] font-bold leading-relaxed text-rose-100"><b className="text-rose-300">FINAL 3 MINUTES.</b> Finish this round. After your next investment, Site Audits begin. Auditors assess local teams, not company experts.</div>}

   <div className="grid gap-3 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div className="space-y-3 min-[700px]:flex min-[700px]:min-h-0 min-[700px]:flex-col min-[700px]:space-y-0 min-[700px]:gap-2 xl:gap-3">
     <Card className="relative p-3 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:p-2 xl:p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
       <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Knowledge River</div><h2 className="text-lg font-black text-white min-[700px]:text-sm lg:text-base xl:text-lg">Where is the capability now?</h2></div>
       {turnoverToggleAvailable&&<div className={riverTurnoverOpen?'relative z-[240]':''}>
        <button type="button" data-kmw-turnover-toggle aria-pressed={riverTurnoverOpen} onClick={()=>{setRiverTurnoverOpen(open=>!open);setScorePadOpen(false)}} className={'flex h-10 items-center gap-2 rounded-xl border-2 px-3 text-xs font-black shadow-lg transition '+(riverTurnoverOpen?'border-emerald-200 bg-emerald-500 text-slate-950 ring-4 ring-emerald-300/50':'border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-500')}>
         <BarChart3 className="h-4 w-4"/>Turnover
        </button>
       </div>}
       <div data-kmw-scorepad>
        <button type="button" data-kmw-scorepad-button aria-expanded={scorePadOpen} onClick={()=>setScorePadOpen(open=>!open)} className={`flex min-w-[176px] items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 text-left text-xs font-black shadow-lg transition ${scorePadOpen?'border-amber-300 bg-amber-400 text-slate-950':'border-amber-700 bg-amber-950/35 text-amber-100 hover:border-amber-400'}`}>
         <span className="flex items-center gap-2"><Medal className="h-4 w-4"/>SCORE PAD</span><span className={`rounded-lg border px-2 py-0.5 text-sm ${scorePadOpen?'border-slate-900/30 bg-slate-950/10':'border-amber-700 bg-slate-950/40'}`}>{state.score.total}</span>
        </button>
       </div>
      </div>
      <div data-kmw-tour-river data-kmw-river-chart-area className={'relative top-8 h-[360px] min-[700px]:h-[calc(100%-76px)] min-[700px]:min-h-[210px] xl:h-[calc(100%-78px)] xl:min-h-[285px]'+(riverIntroActive&&riverIntroStep>=2&&riverIntroStep<=8?' z-[145] rounded-2xl':'')} style={riverIntroActive&&riverIntroStep>=2&&riverIntroStep<=8?{boxShadow:'0 0 0 160vmax rgba(0,0,0,.74)'}:undefined}>
       <InvestmentRiverView company={riverFrozenCompany||company} mode="km_week" selectedDomain={state.phase==='invest'&&infoPreviewDomain?infoPreviewDomain:state.phase==='invest'&&investment==='AFTER_ACTION_REVIEW'&&aarChallenge?aarChallenge.domain:selectedDomain} highlightDomain guidedSiteId={firstGuidedTour?activeChallenge?.siteId:undefined} ghostPreview={scoreGhostPreview} thresholdLine={state.stage==='shock'||state.stage==='complete'?{value:KM_WEEK_SHOCK_CUTOFF,label:`SHOCK CUT-OFF · ${KM_WEEK_SHOCK_CUTOFF}`}:undefined}/>
       <button type="button" data-kmw-site-panels-toggle aria-expanded={sitePanelsOpen} aria-label={sitePanelsOpen?'Hide site details':'Show site details'} title={sitePanelsOpen?'Hide site details':'Show site details'} onClick={()=>setSitePanelsOpen(open=>!open)} className={'absolute bottom-2 left-2 z-20 grid h-11 w-11 place-items-center rounded-xl border-2 shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 '+(sitePanelsOpen?'border-emerald-300 bg-emerald-600 text-white':'border-slate-500 bg-slate-900/95 text-emerald-300 hover:border-emerald-300 hover:bg-slate-800')}>
        <Building2 className="h-5 w-5"/>
       </button>
      </div>
      {scorePadOpen&&<div data-kmw-scorepad className={`absolute left-2 right-2 top-[54px] z-[90] h-fit overflow-visible rounded-[18px] border-2 border-amber-700 bg-[#101827]/[.98] p-3 shadow-[0_20px_60px_rgba(0,0,0,.7)] min-[700px]:left-auto min-[700px]:w-2/3 ${scoreBriefOpen?'z-[135] ring-4 ring-amber-300/80 shadow-[0_0_40px_rgba(250,204,21,.45)]':''}`}>
       <div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-300"/><h2 className="text-sm font-black text-white">Score pad</h2><span className="ml-auto rounded-lg border border-amber-700 bg-amber-950/30 px-2 py-0.5 text-sm font-black text-amber-200">{state.score.total}</span></div>
       <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ScoreCell label="Business Performance" value={state.score.business} max="12" icon={<CircleDollarSign className="h-3.5 w-3.5"/>} tip="Weighted by Challenge difficulty. Harder problems contribute more Business Performance points; solving the full six-round challenge set is worth 12."/>
        <ScoreCell label="Expertise" value={state.score.expertise} max="6" icon={<Brain className="h-3.5 w-3.5"/>} tip="Rewards deep expert capability. Each expert scores 1 point per knowledge level above 3. Use Train Expert to improve it. Hover here to preview the next +1 on the River." ghost="expertise" onGhost={setScoreGhost}/>
        <ScoreCell label="Local capability" value={state.score.localCapability} max="9" icon={<Users className="h-3.5 w-3.5"/>} tip="Scores the strength of the whole local River: 1 point for every 2 local knowledge levels across the nine site/domain positions, up to 9 points. Improve it with Local Training or Knowledge Transfer." ghost="local" onGhost={setScoreGhost}/>
        <ScoreCell label="Knowledge Flow" value={state.score.knowledgeFlow} max="6" icon={<Workflow className="h-3.5 w-3.5"/>} tip="Rewards knowledge actually moved. A transfer now moves half the gap to the stronger source (rounded up), and each level moved scores here, with a bonus when the target crosses Knowledge 2." ghost="flow" onGhost={setScoreGhost}/>
        <ScoreCell label="Squeaky clean" value={state.score.resilience} max="15" icon={<ShieldCheck className="h-3.5 w-3.5"/>} tip="Site Audits: 1 point for each audit cleared, plus 10 extra if all five are clear. A knowledge shortfall risks a non-conformance finding, and company experts cannot answer for the site. Hover to see the highest audit target." ghost="resilience" onGhost={setScoreGhost}/>
        <ScoreCell label={goal.title} value={state.score.goal} max="5" icon={<Target className="h-3.5 w-3.5"/>} tip={<span className="block text-left"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-amber-300">Goal · 5 pts</span><span className="mt-1 block text-sm font-black text-white">{goal.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-slate-300">{goal.description}</span><span className={`mt-2 block rounded-lg border px-2 py-1 text-[9px] font-black ${state.score.goal?'border-emerald-700 bg-emerald-950/30 text-emerald-300':'border-amber-800 bg-amber-950/25 text-amber-300'}`}>{state.score.goal?'ACHIEVED · +5':'IN PLAY'}</span></span>}/>
       </div>
       {standings.length>1&&<div className="mt-2 border-t border-slate-800 pt-2"><div className="text-[8px] font-black uppercase tracking-[.14em] text-violet-300">Workshop standings</div><div className="mt-1 grid grid-cols-2 gap-1">{standings.map((entry,index)=><div key={entry.id} className={`flex items-center rounded-lg border px-2 py-1 text-[9px] ${entry.id===company.id?'border-violet-500 bg-violet-950/25':'border-slate-800 bg-slate-950'}`}><span className="w-4 font-black text-slate-500">{index+1}</span><span className="min-w-0 flex-1 truncate font-bold text-slate-300">{entry.name}</span><b className="text-white">{entry.score}</b></div>)}</div></div>}
      </div>}
     </Card>

     {sitePanelsOpen&&<div data-kmw-site-panels className="grid shrink-0 gap-2 md:grid-cols-3 min-[700px]:gap-1.5 xl:gap-2">
      {sites.map((site,index)=><Card key={site.id} className={`relative overflow-hidden p-3 min-[700px]:p-2 xl:p-3 ${index===0?'rotate-[-.2deg]':index===2?'rotate-[.2deg]':''}`}>
       <div className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[8px] font-black text-slate-500">{SITE_ABBR[site.id]}</div>
       <div className="flex items-center gap-2 min-[700px]:gap-1.5"><MapPin className="h-4 w-4 text-emerald-300 min-[700px]:h-3.5 min-[700px]:w-3.5"/><h3 className="text-sm font-black text-white min-[700px]:text-xs xl:text-sm">{site.name}</h3></div>
       <div className="mt-2 space-y-1.5 min-[700px]:mt-1.5 min-[700px]:space-y-1 xl:mt-2 xl:space-y-1.5">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-left min-[700px]:gap-1 min-[700px]:px-1.5 min-[700px]:py-0.5 xl:gap-2 xl:px-2 xl:py-1"><span className="w-16 truncate text-[9px] font-black text-slate-400 min-[700px]:w-10 min-[700px]:text-[8px] xl:w-16 xl:text-[9px]">{domainLabel(domain)}</span><KnowledgePips value={site.teamCapability[domain]||0} domain={domain} compact/><b className="ml-auto text-xs text-white">{site.teamCapability[domain]||0}</b></button>)}</div>
       <div className="mt-2 border-t border-slate-800 pt-1.5 text-[9px] font-bold text-slate-500 min-[700px]:mt-1 min-[700px]:pt-1 min-[700px]:text-[8px] xl:mt-2 xl:pt-1.5 xl:text-[9px]">Expert here: <span className="text-amber-200">{experts.filter(expert=>expert.location===site.id).map(expert=>expert.name.split(' ')[0]).join(', ')||'—'}</span></div>
      </Card>)}
     </div>}
    </div>

    <aside className="kmw-controls min-w-0 space-y-2 min-[700px]:flex min-[700px]:min-h-0 min-[700px]:flex-col min-[700px]:space-y-0 min-[700px]:gap-2">
     {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&!challengeFocusOpen?<div className={`relative ${riverIntroActive&&riverIntroStep<9?'opacity-50 grayscale-[.25]':''} overflow-y-auto overscroll-contain touch-pan-y flex min-h-[360px] shrink-0 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-violet-500/70 bg-violet-950/10 p-5 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:p-3 xl:p-5`}>
      <button type="button" data-kmw-river-intro="challenge-card" disabled={riverIntroActive&&!riverIntroUnlocked} onClick={beginFirstChallenge} className="group kmw-start-card disabled:cursor-not-allowed disabled:hover:translate-y-0 relative flex h-[230px] w-[168px] flex-col items-center justify-center overflow-hidden rounded-[18px] border-[3px] border-violet-300 bg-[linear-gradient(145deg,#28184d,#111827)] px-5 text-center shadow-[0_18px_35px_rgba(0,0,0,.42)] transition hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(124,58,237,.25)] focus:outline-none focus:ring-4 focus:ring-violet-400/40" aria-label="Open the next Challenge">
       <div className="absolute inset-2 rounded-[13px] border border-violet-400/35"/>
       <div className="text-[9px] font-black uppercase tracking-[.24em] text-violet-300">The Performance Gap</div>
       <div className="mt-5 text-2xl font-black tracking-[.08em] text-white">CHALLENGE</div>
       <div className="mt-5 rounded-full border-2 border-amber-300 bg-amber-950/45 px-4 py-2 text-xs font-black text-amber-100">CLICK HERE TO START</div>
       <div className="mt-3 text-[9px] font-bold text-slate-500">{phaseTitle(company)}</div>
      </button>
     </div>:<div className={`min-[700px]:min-h-0 min-[700px]:flex-1 ${challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')?'relative z-[60] kmw-card-reveal':''}`}>
     <Card className={`border-violet-700 bg-[linear-gradient(145deg,#1b1731,#101827)] p-3 min-[700px]:h-full min-[700px]:min-h-0 min-[700px]:overflow-y-auto overscroll-contain touch-pan-y ${challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')?'ring-4 ring-violet-400/20 shadow-[0_20px_60px_rgba(0,0,0,.55)]':''}`}>
      <div className="flex items-center justify-between gap-2"><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">Your move</div><h2 className="text-xl font-black text-white">{currentPhaseLabel(company)}</h2></div><div className="rounded-lg border border-violet-700 bg-violet-950/30 px-2 py-1 text-[9px] font-black uppercase text-violet-200">{phaseTitle(company)}</div></div>

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&<>
       {!guided&&<>
        
        <div className={'mt-2 grid gap-2 '+(state.challenges.length>1?'grid-cols-2':'grid-cols-1')}>{state.challenges.map(challenge=><ChallengeToken key={challenge.id} challenge={challenge} company={company} selected={challenge.id===activeChallenge?.id} draft={challengeDrafts[challenge.id]} onClick={()=>setSelectedChallengeId(challenge.id)}/>)}</div>
       </>}

       {activeChallenge&&activeChallenge.status==='open'&&<div className="mt-2 rounded-xl border border-slate-700 bg-black/20 p-2.5">
        <div className="flex items-start justify-between gap-3">
         <div className="min-w-0">
          {guided&&<div className="text-[12px] font-black uppercase tracking-[.14em] text-amber-300">{guidedCopy.title}</div>}
          <div className={(guided?'mt-0.5 ':'')+'text-[20px] leading-tight font-black text-white'}>{challengeDisplayTitle(company,activeChallenge)}</div>
          {guided&&<div className="mt-1 text-[13px] font-bold text-slate-400">Needs: <b className="text-white">{domainLabel(activeChallenge.domain)} {activeChallenge.difficulty}</b> · Local knowledge: <b className={localScore>=activeChallenge.difficulty?'text-emerald-300':'text-sky-300'}>{localScore}</b></div>}
         </div>
         <div className="shrink-0 text-right"><div className="text-[13px] font-black uppercase tracking-[.12em] text-slate-500">Selected knowledge</div><div className={'mt-0.5 text-[34px] font-black leading-none tracking-[-.05em] tabular-nums '+(selectedKnowledge>=activeChallenge.difficulty?'text-emerald-300':'text-white')}>{selectedKnowledge}<span className="text-[20px] text-slate-500">/{activeChallenge.difficulty}</span></div></div>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{activeChallenge.story}</p>
        <ChallengeKnowledgeBars
         requirement={activeChallenge.difficulty}
         domain={activeChallenge.domain}
         siteLabel={siteName(company,activeChallenge.siteId)}
         requirementMet={selectedKnowledge>=activeChallenge.difficulty}
         guideStep={firstGuidedTour?guideStep:0}
         local={localScore}
         expert={activeExpertScore}
         expertName={activeExpert?.name}
         expertLocation={activeExpert?.location}
         travelCost={activeExpertTravelCost}
         localSelection={localSelection}
         expertSelection={expertSelection}
         localDisabled={false}
         expertDisabled={expertUsed||expertTraining||activeExpertScore<=0}
         expertTraining={expertTraining}
         attention={challengeAttention}
         onLocalClick={()=>cycleKnowledgeSource('local')}
         onExpertClick={()=>cycleKnowledgeSource('expert')}
        />
        <div data-kmw-tour="chance" className={'mt-2 flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 '+(selectedKnowledge>=activeChallenge.difficulty?'border-emerald-400 bg-emerald-950/30':'border-sky-500 bg-sky-950/30')+(firstGuidedTour&&guideStep===2?' kmw-tour-chance':'')}>
         <div className="flex items-center gap-2"><Target className="h-5 w-5 text-sky-300"/><div><div className="text-[13px] font-black text-white">Chance of success</div></div></div>
         <b className={'text-2xl font-black tabular-nums '+(selectedKnowledge>=activeChallenge.difficulty?'text-emerald-300':'text-sky-300')}>{successChance}%</b>
        </div>
        {!guided&&deterministicSelected&&knowledgeShortfall>0&&<div className="mt-1.5 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-1.5 text-[10px] font-black text-rose-200">KNOWLEDGE SHORTFALL {knowledgeShortfall} · If you commit this response, the Challenge will fail.</div>}
        {(!guided||state.guidedTurn===3)&&<div className="mt-1.5"><ResponseButton selectionState={riskSelected?'depth':'none'} onClick={()=>{setChallengeAttention(false);setPendingResponse({challengeId:activeChallenge.id,method:riskSelected?(expertSelection==='depth'?'expert':localSelection==='depth'?'local':undefined):'risk',expertId:activePending?.expertId,localSelection,expertSelection,label:'Take the risk'})}}><Dices className="mr-1 inline h-4 w-4"/>TAKE THE RISK <span className="ml-1 text-slate-500">· roll {riskOdds.requiredRoll<=1?'1+':riskOdds.requiredRoll>6?'impossible':riskOdds.requiredRoll+'+'}</span></ResponseButton></div>}
        <div data-kmw-outcome-origin className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-2 py-1.5">
         <div><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">If you solve it</div><div className="text-sm font-black text-emerald-300">+{money(activeChallenge.impact)} turnover</div></div>
         <div><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">If you fail</div><div className="text-sm font-black text-rose-300">-{money(activeChallenge.impact)} turnover</div></div>
        </div>
        {actionError&&<div className="mt-1.5 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-2 text-[10px] font-black text-rose-200">{actionError}</div>}
        <button type="button" onClick={()=>void commitResponse()} disabled={!responseReady||busy||readOnly} data-kmw-tour="commit" className={'mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-600'+(firstGuidedTour&&guideStep===5?' kmw-tour-highlight':'')}>{busy?'COMMITTING…':'COMMIT RESPONSE'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>}

       {challengeDone&&<div className="mt-3 rounded-xl border-2 border-emerald-700 bg-emerald-950/25 p-3 text-xs font-black text-emerald-200">Challenges complete. Moving to Invest…</div>}
      </>}

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'&&<>
       {guided&&<div className="mt-2 rounded-xl border border-amber-800 bg-amber-950/15 px-2.5 py-2 text-[11px] leading-snug text-slate-200"><span className="font-black text-amber-300">This investment: </span>{guidedCopy.invest}</div>}
       <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button disabled={guided&&guidedTargetInvestment!=='TRAIN_EXPERT'} onClick={()=>setInvestment('TRAIN_EXPERT')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='TRAIN_EXPERT'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='TRAIN_EXPERT'?'border-amber-300 bg-amber-950/40':'border-slate-700 bg-slate-950'}`}><GraduationCap className="h-4 w-4 text-amber-300"/><div className="mt-1 text-[10px] font-black text-white">Train Expert</div><div className="text-[9px] text-slate-500">+1 depth · $15k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='LOCAL_TRAINING'} onClick={()=>setInvestment('LOCAL_TRAINING')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='LOCAL_TRAINING'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='LOCAL_TRAINING'?'border-sky-300 bg-sky-950/40':'border-slate-700 bg-slate-950'}`}><Users className="h-4 w-4 text-sky-300"/><div className="mt-1 text-[10px] font-black text-white">Local Training</div><div className="text-[9px] text-slate-500">+2 local · $10k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'} onClick={()=>setInvestment('KNOWLEDGE_TRANSFER')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='KNOWLEDGE_TRANSFER'?'border-emerald-300 bg-emerald-950/40':'border-slate-700 bg-slate-950'}`}><Workflow className="h-4 w-4 text-emerald-300"/><div className="mt-1 text-[10px] font-black text-white">Knowledge Transfer</div><div className="text-[9px] text-slate-500">Move half the gap · $8k</div></button>
       </div>
       {aarCandidates.length>0&&<button type="button" data-kmw-aar-button onClick={()=>{setInvestment('AFTER_ACTION_REVIEW');if(aarChallenge)setSelectedDomain(aarChallenge.domain)}} className={'mt-2 flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition '+(investment==='AFTER_ACTION_REVIEW'?'border-amber-300 bg-amber-950/35':'border-slate-700 bg-slate-950 hover:border-amber-500')}>
        <BookOpenCheck className="h-5 w-5 shrink-0 text-amber-300"/>
        <span className="flex-1"><span className="block text-xs font-black text-white">After Action Review</span><span className="block text-[10px] text-slate-400">Learn from tough Challenges · $50k</span></span>
        <ArrowRight className="h-4 w-4 text-amber-300"/>
       </button>}
       <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/75 p-2.5">
        {investment==='AFTER_ACTION_REVIEW'?<label className="block text-[10px] font-black uppercase text-slate-400">Challenge to review
          <select data-kmw-aar-select value={aarChallenge?.id||''} onChange={event=>{const chosen=aarCandidates.find(item=>item.id===event.target.value);setAARChallengeId(event.target.value);if(chosen)setSelectedDomain(chosen.domain)}} className="mt-1 block w-full rounded-lg border border-amber-700 bg-[#071019] px-2 py-2.5 text-xs font-bold normal-case text-white">
           {aarCandidates.map(item=><option key={item.id} value={item.id}>{item.status==='success'?'SUCCESS: ':'FAILURE: '}{siteName(company,item.siteId)} — {item.title} · {domainLabel(item.domain)} {item.difficulty}</option>)}
          </select>
          <span className="mt-2 block text-xs normal-case font-semibold text-slate-300">Facilitator: <b className="text-amber-200">{aarExpert?.name||'Company expert'}</b> · Site: <b className="text-white">{aarSite?.name||'—'}</b> · Both gain up to +{aarUplift}</span>
         </label>:investment!=='KNOWLEDGE_TRANSFER'?<div className="grid grid-cols-2 items-start gap-2"><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">Company expert<select value={specialist?.id||''} onChange={event=>{const next=experts.find(item=>item.id===event.target.value);setExpertId(event.target.value);if(next)setSelectedDomain(next.domains[0].domain)}} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{experts.map(expert=><option key={expert.id} value={expert.id}>{expert.name} ({SITE_ABBR[expert.location]||expert.location}) · {domainLabel(expert.domains[0].domain)} {expert.domains[0].score}</option>)}</select></label><div>{investment==='LOCAL_TRAINING'?<label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">Training site<select value={trainingSiteId} onChange={event=>setTrainingSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · Team {site.teamCapability[specialistDomain]||0}{specialist?.location===site.id?' · expert here':' · +$2k travel'}</option>)}</select></label>:<div><div className="text-[9px] font-black uppercase text-slate-500">Knowledge domain</div><div className="mt-1 rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs font-black text-white">{domainLabel(specialistDomain)}</div></div>}</div></div>:<div className="grid grid-cols-3 gap-2"><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">Domain<select value={selectedDomain} onChange={event=>setSelectedDomain(event.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{KM_WEEK_DOMAINS.map(domain=><option key={domain} value={domain}>{domainLabel(domain)}</option>)}</select></label><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">From<select value={sourceSiteId} onChange={event=>setSourceSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">To<select value={targetSiteId} onChange={event=>setTargetSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label></div>}
        <div className="mt-2 rounded-lg border border-amber-800 bg-amber-950/15 px-2 py-1.5 text-[10px]"><span className="font-black text-amber-300">Preview:</span> <span className="text-slate-200">{investmentPreview}</span>{investment==='LOCAL_TRAINING'&&<div className="mt-1 font-bold text-red-300">Training commitment — unavailable next round</div>}</div>
        {actionError&&<div className="mt-2 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-2 text-[10px] font-black text-rose-200">{actionError}</div>}
        <button onClick={event=>void invest(event)} disabled={busy||readOnly} className="mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:bg-slate-800 disabled:text-slate-600">{busy?'COMMITTING…':guided?'COMMIT GUIDED INVESTMENT':finalShockWindow?'COMMIT FINAL INVESTMENT & FACE SITE AUDITS':'COMMIT INVESTMENT & START NEXT ROUND'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>
      </>}

      {state.stage==='shock'&&<div className="mt-2">
       <div className="rounded-2xl border-2 border-rose-700 bg-[linear-gradient(145deg,#32121d,#171827)] p-3 text-left">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 border-rose-300 bg-rose-950"><ShieldCheck className="h-5 w-5 text-rose-200"/></div><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-rose-300">Site Audits · final three minutes</div><h3 className="mt-0.5 text-lg font-black text-white">Can your sites prove compliance?</h3></div></div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-200">Auditors are inspecting five local capabilities. Each missing knowledge level increases the chance of a non-conformance being found. Company experts cannot stand in for the local teams.</p>
        <div className="mt-2 rounded-xl border border-amber-700/70 bg-amber-950/25 p-2 text-[10px] leading-relaxed text-amber-100"><b className="text-amber-300">At stake:</b> $40k fine per missing level if auditors find a non-conformance. Clear all five audits to earn <b>10 bonus Squeaky clean points</b>.</div>
       </div>

       <div className="mt-3 space-y-1.5">
        {!state.shockResolved?KM_WEEK_SHOCK_SPECS.map(check=>{
         const site=company.sites.find(item=>item.id===check.siteId);
         return <div key={check.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-2 text-left">
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] font-black text-white">{site?.name||check.siteId} · {domainLabel(check.domain)}</div><div className="text-[9px] text-slate-400">Site Knowledge {site?.teamCapability[check.domain]||0} · audit standard {check.difficulty} · <span className="text-amber-300">{100-kmWeekRiskOddsV1(site?.teamCapability[check.domain]||0,check.difficulty).chancePercent}% chance of a finding</span></div></div><div className="rounded-full border border-slate-600 px-2 py-1 text-[8px] font-black text-slate-300">AWAITING AUDIT</div></div>
         </div>;
        }):state.shockChecks.map(check=>{
         const site=company.sites.find(item=>item.id===check.siteId);
         const gap=Math.max(0,check.difficulty-check.localKnowledge);
         return <div key={check.id} className={'rounded-xl border p-2 text-left '+(check.passed?'border-emerald-700 bg-emerald-950/25':'border-rose-700 bg-rose-950/30')}>
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] font-black text-white">{site?.name||check.siteId} · {domainLabel(check.domain)}</div><div className="text-[9px] text-slate-300">Site Knowledge {check.localKnowledge} · standard {check.difficulty}{check.dieRoll!==undefined?` · audit roll ${check.dieRoll}`:''}</div></div><div className={'rounded-full border px-2 py-1 text-[9px] font-black '+(check.passed?'border-emerald-500 text-emerald-300':'border-rose-500 text-rose-200')}>{check.passed?'CLEARED':'NON-CONFORMANCE'}</div></div>
          {!check.passed&&<div className="mt-2 rounded-lg border border-rose-800 bg-slate-950/70 px-2 py-1.5 text-[9px] font-black text-rose-200">Knowledge shortfall {gap} · fine −{money(gap*KM_WEEK_SHOCK_GAP_COST)}</div>}
         </div>;
        })}
       </div>

       {!state.shockResolved?<button onClick={()=>void post({type:'KM_WEEK_RESOLVE_SHOCK'})} disabled={busy||readOnly} className="mt-3 h-11 w-full rounded-xl border-2 border-white bg-white text-sm font-black text-rose-950 disabled:opacity-40">{busy?'AUDITING…':'RUN THE SITE AUDITS'}</button>:<>
        {(()=>{
         const findings=state.shockChecks.filter(check=>!check.passed).length;
         const cleared=state.shockChecks.length-findings;
         const before=state.auditTurnoverBefore??company.turnover+auditFine;
         return <div className={'mt-3 rounded-2xl border-2 p-3 text-left '+(findings?'border-rose-500 bg-rose-950/30':'border-emerald-500 bg-emerald-950/25')}>
          <div className={'text-[9px] font-black uppercase tracking-[.16em] '+(findings?'text-rose-300':'text-emerald-300')}>SITE AUDITS RESULT</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Audits cleared</div><div className="text-xl font-black text-white">{cleared}/{state.shockChecks.length}</div></div>
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Findings</div><div className={'text-xl font-black '+(findings?'text-rose-200':'text-emerald-200')}>{findings}</div></div>
           <div data-kmw-audit-fine className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Fines</div><div className={'text-xl font-black '+(auditFine?'text-rose-200':'text-emerald-200')}>{auditFine?'−'+money(auditFine):money(0)}</div></div>
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Turnover after fines</div><div className="text-sm font-black text-white">{money(before)} → {money(company.turnover)}</div></div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-300">{findings?<>Auditors identified <b className="text-rose-200">{findings} non-conformance{findings===1?'':'s'}</b>. The fines will reduce turnover and remain visible in the debrief graph.</>:<>Every audit was cleared. No fines, and <b className="text-emerald-300">10 extra Squeaky clean points</b>!</>}</p>
         </div>;
        })()}
        <button onClick={()=>void completeSiteAudits()} disabled={busy||readOnly} className="mt-3 h-11 w-full rounded-xl border-2 border-emerald-300 bg-emerald-400 text-sm font-black text-emerald-950 disabled:opacity-40">{busy?'FINISHING…':'CONTINUE TO DEBRIEF'}</button>
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
