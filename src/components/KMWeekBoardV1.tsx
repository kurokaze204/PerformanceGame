import React,{useEffect,useMemo,useRef,useState}from'react';
import{ArrowRight,Brain,Building2,CheckCircle2,CircleDollarSign,Crown,Dices,GraduationCap,Info,LogOut,MapPin,Medal,ShieldCheck,Sparkles,Target,Users,Workflow,X}from'lucide-react';
import type{KnowledgeDomain,Participant}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import type{KMWeekChallenge,KMWeekInvestment}from'../types/kmWeek.ts';
import{KM_WEEK_DOMAINS,KM_WEEK_GOALS,KM_WEEK_MAX_EXPERT_KNOWLEDGE,KM_WEEK_SHOCK_CUTOFF,KM_WEEK_SHOCK_GAP_COST,KM_WEEK_SHOCK_SPECS,KM_WEEK_SHOCK_WINDOW_SECONDS,KM_WEEK_SITE_IDS,kmWeekRiskOddsV1}from'../engine/kmWeekV1.ts';
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
 const investmentDeltas=state.investmentHistory.map(item=>Math.max(0,item.after-item.before));
 const startKnowledge=Math.max(0,totalKnowledge(company)-investmentDeltas.reduce((sum,delta)=>sum+delta,0));
 const investments=(state.turnoverHistory||[]).filter(point=>/ I$/.test(point.label));
 const points:PerformanceHistoryPoint[]=[{label:'Start',turnover:company.startingTurnover||875,knowledge:startKnowledge}];
 let knowledge=startKnowledge;
 investments.forEach((point,index)=>{
  knowledge+=investmentDeltas[index]||0;
  points.push({label:`Month ${index+1}`,turnover:point.turnover,knowledge});
 });
 const shockPoints=(state.turnoverHistory||[]).filter(point=>point.label.startsWith('SHOCK '));
 if(shockPoints.length){
  points.push({label:'Shock',turnover:shockPoints[shockPoints.length-1].turnover,knowledge:totalKnowledge(company)});
 }
 return points;
}

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
 if(turn===1)return{title:'1. Solve the business problem',text:'Brisbane needs Operations 4. Build the response yourself: select Priya for depth, then select the Local Team if you want its knowledge to contribute breadth.',invest:'After the Challenge, you will deepen Priya’s expertise.'};
 if(turn===2)return{title:'2. Who should handle this one?',text:'This problem only needs Operations 1 — exactly what the Brisbane team already knows. You can use the Local Team, or still send Priya if you want to.',invest:'Now use Local Training. Brisbane is the obvious target, but you can send Priya to another site; training away from her current site adds $2k travel.'};
 return{title:'3. The problem moves',text:'Priya is busy training staff. How well can Perth handle this problem without her? Use the local team and take a risk.',invest:'Now try Knowledge Transfer. Choose a domain and two sites where the source knows more than the destination. Brisbane Operations → Perth is the suggested example, but any valid transfer will work.'};
}

function scoreBriefSuggestion(goalId:string){
 if(goalId==='deep-bench')return 'Your Goal rewards expert depth. If an expert is still below Knowledge 6, Train Expert is the shortest route toward those 5 Goal points.';
 if(goalId==='local-heroes')return 'Your Goal rewards solving Challenges locally. Local Training or Knowledge Transfer can strengthen a site so you rely less on travelling experts.';
 if(goalId==='broad-base')return 'Your Goal rewards breadth. Look for a site/domain sitting below Knowledge 2 and use Local Training or Knowledge Transfer to lift it.';
 return 'Your Goal rewards a balanced network. Look for your weakest site and use Local Training or Knowledge Transfer to strengthen it.';
}

const ToolTip:React.FC<{text:React.ReactNode;onHoverChange?:(active:boolean)=>void;large?:boolean}>=({text,onHoverChange,large=false})=><span role="button" aria-label="More information" className={`group relative inline-grid shrink-0 cursor-help place-items-center ${large?'h-7 w-7 rounded-full border border-slate-700 bg-slate-900 text-slate-400':'inline-flex text-slate-500'}`} onMouseEnter={()=>onHoverChange?.(true)} onMouseLeave={()=>onHoverChange?.(false)} onFocus={()=>onHoverChange?.(true)} onBlur={()=>onHoverChange?.(false)} tabIndex={0}><Info className={large?'h-3.5 w-3.5':'h-3.5 w-3.5'}/><span role="tooltip" className="pointer-events-none absolute right-0 top-full z-[300] mt-2 hidden w-64 rounded-xl border border-slate-600 bg-slate-950 p-3 text-[11px] font-semibold normal-case leading-relaxed text-slate-200 shadow-2xl group-hover:block group-focus-within:block">{text}</span></span>;

type ScoreGhostKind='expertise'|'local'|'flow'|'resilience';
const ScoreCell:React.FC<{label:string;value:number;max:string;icon:React.ReactNode;tip:React.ReactNode;ghost?:ScoreGhostKind;onGhost?:(ghost:ScoreGhostKind|null)=>void}>=({label,value,max,icon,tip,ghost,onGhost})=><div className="relative flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-300">{icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-black text-slate-400">{label}</span><span className="text-lg font-black leading-none tabular-nums text-white">{value}<span className="ml-1 text-[9px] text-slate-600">/{max}</span></span></span><ToolTip large text={tip} onHoverChange={ghost&&onGhost?(active)=>onGhost(active?ghost:null):undefined}/></div>;

const PhaseStep:React.FC<{label:string;active:boolean;done:boolean;number:string}>=({label,active,done,number})=><div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] ${active?'border-amber-300 bg-amber-950/40 text-amber-100':done?'border-emerald-800 bg-emerald-950/25 text-emerald-300':'border-slate-800 bg-slate-950/60 text-slate-600'}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${active?'border-amber-300':done?'border-emerald-600':'border-slate-700'}`}>{done?<CheckCircle2 className="h-3 w-3"/>:number}</span>{label}</div>;

const ChallengeToken:React.FC<{challenge:KMWeekChallenge;company:CompanyV2;selected:boolean;draft?:Exclude<PendingResponse,null>;onClick:()=>void}>=({challenge,company,selected,draft,onClick})=>{
 const site=company.sites.find(item=>item.id===challenge.siteId);
 const local=site?.teamCapability[challenge.domain]||0;
 const done=challenge.status!=='open';
 const shell='min-w-0 rounded-xl border-2 p-2 text-left transition ';
 const stateClass=selected?'border-violet-300 bg-violet-950/35':done?(challenge.status==='success'?'border-emerald-800 bg-emerald-950/20':'border-rose-900 bg-rose-950/20'):'border-slate-700 bg-slate-950/70 hover:border-violet-600';
 return <button type="button" onClick={onClick} className={shell+stateClass}>
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
   return <span key={index} className={'h-4 rounded-md border-2 transition-all duration-200 '+(available?(applied?colour:idle):'border-slate-800 bg-slate-950')}/>;
  })}
 </div>;
 const Selector:React.FC<{state:ResponseSelectionState;disabled?:boolean;anchor?:string}>=({state,disabled=false,anchor})=>{
  const tone=disabled?'border-slate-800 bg-slate-950':state==='depth'?'border-amber-200 bg-amber-400 text-slate-950':state==='breadth'?'border-sky-300 bg-slate-900':'border-slate-500 bg-slate-900';
  return <span data-kmw-tour={anchor} aria-label={state==='depth'?'Selected as depth':state==='breadth'?'Selected as breadth':'Not selected'} className={'relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full border-2 '+tone+(attention&&!disabled?' kmw-attention-circle':'')}>{state==='depth'?'✓':state==='breadth'?<span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/2 bg-sky-400"/>:''}</span>;
 };
 const localFilled=localSelection==='depth'?local:localSelection==='breadth'?Math.min(local,1):0;
 const expertFilled=expertSelection==='depth'?expert:expertSelection==='breadth'?Math.min(expert,1):0;
 return <div className="mt-2 space-y-1.5" data-kmw-knowledge-bars>
  <div data-kmw-tour="required" className={'grid w-full grid-cols-[100px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 '+(requirementMet?'border-emerald-400/80 bg-emerald-950/20': 'border-rose-900/70 bg-rose-950/10')+(guideStep===1?' kmw-tour-highlight':'')}>
   <span><span className="block text-[13px] font-black text-white">Required</span><span className={'block text-[12px] font-bold '+(requirementMet?'text-emerald-300':'text-rose-300')}>{domainLabel(domain)} {requirement}</span></span>
   <SegmentBar value={requirement} filled={requirement} tone="requirement"/>
   <b className={'text-center text-sm font-black '+(requirementMet?'text-emerald-300':'text-rose-300')}>{requirement}</b>
  </div>
  <button type="button" disabled={localDisabled} onClick={onLocalClick} className={'grid w-full grid-cols-[100px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition disabled:opacity-35 '+(localSelection!=='none'?'border-sky-500 bg-sky-950/20':'border-slate-700 bg-slate-950/70 hover:border-sky-700')+(attention&&!localDisabled?' kmw-attention-button':'')+(guideStep===2||guideStep===4?' kmw-tour-highlight':'')}>
   <span><span className="block text-[13px] font-black text-white">{siteLabel} team</span><span className="block text-[12px] font-bold text-sky-300">{domainLabel(domain)} {local}</span></span>
   <SegmentBar value={local} filled={localFilled} tone="local"/>
   <Selector state={localSelection} disabled={localDisabled} anchor={guideStep===4?'breadth':'local'}/>
  </button>
  {expertName&&<button type="button" disabled={expertDisabled} onClick={onExpertClick} className={'grid w-full grid-cols-[100px_minmax(0,1fr)_26px] items-center gap-2 rounded-xl border px-2 py-2 text-left transition disabled:opacity-35 disabled:grayscale '+(expertSelection!=='none'?'border-amber-400 bg-amber-950/20':'border-slate-700 bg-slate-950/70 hover:border-amber-700')+(attention&&!expertDisabled?' kmw-attention-button':'')+(guideStep===3?' kmw-tour-highlight':'')}>
   <span className="min-w-0"><span className="block truncate text-[13px] font-black text-white">{expertName.split(' ')[0]}{expertLocation?' · '+(SITE_ABBR[expertLocation]||expertLocation):''}</span><span className="block text-[12px] font-bold text-amber-300">{domainLabel(domain)} {expert}{expertTraining?'':expertDisabled?' · used':travelCost?' · $'+travelCost+'k travel':''}</span></span>
   <SegmentBar value={expert} filled={expertFilled} tone="expert"/>
   <Selector state={expertSelection} disabled={expertDisabled} anchor="expert"/>
  </button>}
  {expertTraining&&<p className="text-sm font-bold text-red-800">Busy training staff</p>}
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
 const[guideAnchor,setGuideAnchor]=useState<{left:number;top:number;targetX:number;targetY:number;panelWidth:number}|null>(null);
 const[firstInvestBriefDismissed,setFirstInvestBriefDismissed]=useState(false);
 const[scoreBriefOpen,setScoreBriefOpen]=useState(false);
 const[scorePadOpen,setScorePadOpen]=useState(false);
 const[turnoverChartOpen,setTurnoverChartOpen]=useState(false);
 const[expertChangeDismissedKey,setExpertChangeDismissedKey]=useState('');
 const[challengeAttention,setChallengeAttention]=useState(false);
 const[riskResult,setRiskResult]=useState<{roll:number;won:boolean;requiredRoll:number;performanceGap:number}|null>(null);
 const[riskRollPending,setRiskRollPending]=useState<{requiredRoll:number;performanceGap:number}|null>(null);
 const[scoreGhost,setScoreGhost]=useState<ScoreGhostKind|null>(null);
 const[riverFrozenCompany,setRiverFrozenCompany]=useState<CompanyV2|null>(null);
 const[investment,setInvestment]=useState<KMWeekInvestment>('TRAIN_EXPERT');
 const[expertId,setExpertId]=useState('');
 const[sourceSiteId,setSourceSiteId]=useState('brisbane');
 const[targetSiteId,setTargetSiteId]=useState('perth');
 const[trainingSiteId,setTrainingSiteId]=useState('brisbane');
 const[now,setNow]=useState(Date.now());
 const challengeDraftsRef=useRef(challengeDrafts);

 const members=session.participants.filter(item=>item.role!=='facilitator'&&item.companyId===company.id);
 const goalId=session.kmWeekGoalId||'local-heroes';
 const goal=KM_WEEK_GOALS[goalId];
 const scoreSuggestion=scoreBriefSuggestion(goalId);
 const coaching=kmWeekCoachV1(company);
 const sites=KM_WEEK_SITE_IDS.map(id=>company.sites.find(site=>site.id===id)).filter((site):site is CompanyV2['sites'][number]=>Boolean(site));
 const experts=company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>KM_WEEK_DOMAINS.includes(skill.domain)));
 const specialist=expertId?experts.find(item=>item.id===expertId):specialistFor(company,selectedDomain);
 const specialistDomain=specialist?.domains.find(skill=>KM_WEEK_DOMAINS.includes(skill.domain))?.domain||selectedDomain;
 const localTrainingSite=company.sites.find(site=>site.id===trainingSiteId&&!site.isClosed);
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
  setChallengeFocusOpen(!challengePhase);
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
   if(!target)return;
   const rect=target.getBoundingClientRect();
   const panelWidth=Math.min(350,window.innerWidth-24);
   const roomLeft=rect.left-panelWidth-26;
   const left=roomLeft>=12?roomLeft:rect.right+panelWidth+26<window.innerWidth?rect.right+18:12;
   const top=Math.max(72,Math.min(window.innerHeight-330,rect.top-72));
   setGuideAnchor({left,top,targetX:rect.left+rect.width/2,targetY:rect.top+rect.height/2,panelWidth});
  };
  frame=requestAnimationFrame(position);
  window.addEventListener('resize',position);
  window.addEventListener('scroll',position,true);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true)};
 },[guideStep,challengeFocusOpen,state?.stage,state?.guidedTurn,state?.phase]);

 useEffect(()=>{setScorePadOpen(false)},[state?.stage,state?.phase,state?.guidedTurn,state?.freeRound]);
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

 const cycleKnowledgeSource=(source:'local'|'expert')=>{
  if(!activeChallenge)return;
  setChallengeAttention(false);
  const current=pendingResponse?.challengeId===activeChallenge.id?pendingResponse:null;
  let localState:ResponseSelectionState=current?.localSelection||'none';
  let expertState:ResponseSelectionState=current?.expertSelection||'none';
  if(source==='expert'&&(expertUsed||expertTraining||activeExpertScore<=0))return;
  const next=toggleKMWeekSourceV1(localState,expertState,source,localScore,activeExpertScore);
  localState=next.local;expertState=next.expert;
  if(guideStep===2&&source==='local'&&localState!=='none')setGuideStep(3);
  if(guideStep===3&&source==='expert'&&expertState==='depth')setGuideStep(4);
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
  if(!pendingResponse)return;
  if(!pendingResponse.method)return;
  if(guideStep===5)setGuideStep(0);
  const committed=pendingResponse;
  const payload={type:'KM_WEEK_RESOLVE',challengeId:committed.challengeId,method:committed.method,expertId:committed.expertId,includeLocalBreadth:committed.localSelection==='breadth',includeExpertBreadth:committed.expertSelection==='breadth',useLocalRisk:committed.method==='risk'&&committed.localSelection!=='none',useExpertRisk:committed.method==='risk'&&committed.expertSelection==='depth'};
  if(committed.method==='risk'){
   const selectedLocal=riskKnowledge;
   const immediateOdds=kmWeekRiskOddsV1(selectedLocal,activeChallenge?.difficulty||0);
   // Show the dice surface immediately while the server resolves the authoritative roll.
   // This masks network latency and also blocks Invest-phase teaching popups until
   // the player has seen the result and explicitly continued.
   setScoreBriefOpen(false);
   setRiskRollPending({requiredRoll:immediateOdds.requiredRoll,performanceGap:immediateOdds.performanceGap});
  }
  const beforeApply=committed.method==='risk'?async(nextSession:GameSessionV2)=>{
   const nextCompany=nextSession.companies.find(item=>item.id===company.id);
   const resolved=nextCompany?.kmWeek?.challenges.find(item=>item.id===committed.challengeId);
   if(resolved?.dieRoll!==undefined){
    const odds=kmWeekRiskOddsV1(riskKnowledge,resolved.difficulty);
    setRiskResult({roll:resolved.dieRoll,won:resolved.status==='success',requiredRoll:odds.requiredRoll,performanceGap:odds.performanceGap});
    setRiskRollPending(null);
   }
  }:undefined;
  const ok=await post(payload,beforeApply);
  if(!ok&&committed.method==='risk')setRiskRollPending(null);
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
 };

 const guidedTargetInvestment:KMWeekInvestment|undefined=guided?(state.guidedTurn===1?'TRAIN_EXPERT':state.guidedTurn===2?'LOCAL_TRAINING':'KNOWLEDGE_TRANSFER'):undefined;
 const source=company.sites.find(site=>site.id===sourceSiteId);
 const target=company.sites.find(site=>site.id===targetSiteId);
 const investmentPreview=investment==='TRAIN_EXPERT'
   ?specialist?`${specialist.name}: ${specialistScore(company,specialistDomain)} → ${Math.min(KM_WEEK_MAX_EXPERT_KNOWLEDGE,specialistScore(company,specialistDomain)+1)}`:'Choose a company expert'
   :investment==='LOCAL_TRAINING'
    ?specialist&&localTrainingSite?`${localTrainingSite.name} ${domainLabel(specialistDomain)}: ${localTrainingSite.teamCapability[specialistDomain]||0} → ${Math.min(5,specialistScore(company,specialistDomain),(localTrainingSite.teamCapability[specialistDomain]||0)+2)} · ${localTrainingTravelCost?`Travel $2k · total $12k`:'No travel · total $10k'}`:'Choose an expert and training site'
    :source&&target?(()=>{
      const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;
      const uplift=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
      return uplift?`${source.name} ${domainLabel(selectedDomain)} ${from} → ${target.name} ${to} → ${Math.min(from,to+uplift)} (+${uplift})`:`${source.name} must know more than ${target.name}`;
    })():'Choose two sites';

 const scoreGhostPreview:RiverGhostPreview|undefined=(()=>{
  if(scoreGhost==='expertise'&&specialist){
   const score=specialistScore(company,specialistDomain);
   return score<KM_WEEK_MAX_EXPERT_KNOWLEDGE?{kind:'expert',domain:specialistDomain,expertId:specialist.id,delta:1}:undefined;
  }
  if(scoreGhost==='local'&&specialist&&localTrainingSite){
   const current=localTrainingSite.teamCapability[specialistDomain]||0;
   const ceiling=specialistScore(company,specialistDomain);
   return current<ceiling&&current<5?{kind:'site',domain:specialistDomain,siteId:localTrainingSite.id,delta:Math.min(2,ceiling-current,5-current)}:undefined;
  }
  if(scoreGhost==='flow'&&source&&target){
   const from=source.teamCapability[selectedDomain]||0,to=target.teamCapability[selectedDomain]||0;
   const uplift=from>to?Math.max(1,Math.ceil((from-to)/2)):0;
   return uplift&&to<5?{kind:'transfer',domain:selectedDomain,sourceSiteId:source.id,targetSiteId:target.id,delta:uplift}:undefined;
  }
  if(scoreGhost==='resilience')return{kind:'threshold',value:KM_WEEK_SHOCK_CUTOFF,label:`SHOCK READY · ${KM_WEEK_SHOCK_CUTOFF}`};
  return undefined;
 })();

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
  onPresentationHoldChange?.(true);

  // Build the River-only result locally so the capability change can begin
  // the instant the orb lands, even if the server round-trip is still finishing.
  const optimisticCompany=structuredClone(company);
  if(investment==='TRAIN_EXPERT'){
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
 const challengeStepDone=state.stage==='guided'||state.stage==='free'?state.phase==='invest':state.stage==='shock'||shockDone;
 const investStepDone=state.stage==='shock'||shockDone;

 return <div className="min-h-screen bg-[#071019] text-slate-100 xl:h-screen xl:overflow-hidden">
  <header className="relative z-[100] border-b-2 border-amber-950/60 bg-[#09131f]/98 px-3 py-2 shadow-xl min-[700px]:h-[66px]">
   <div className="mx-auto flex h-full w-full items-center gap-2">
    <div className="mr-auto min-w-0"><div className="text-[8px] font-black uppercase tracking-[.22em] text-emerald-300">The Performance Gap · KM Week</div><div className="flex min-w-0 items-center gap-2"><Building2 className="h-5 w-5 shrink-0 text-amber-300"/><h1 className="truncate text-lg font-black text-white">{company.name}</h1><span className="hidden rounded-md border border-slate-700 px-1.5 py-0.5 text-[9px] font-black text-slate-500 sm:inline">{session.id}</span>{readOnly?<span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400 lg:inline">Watching · CEO {controllerName}</span>:<span className="hidden rounded-full border border-amber-600 bg-amber-950/50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200 lg:inline"><Crown className="mr-1 inline h-3 w-3"/>CEO · You</span>}</div></div>
    <button type="button" onClick={()=>setTurnoverChartOpen(true)} aria-haspopup="dialog" className="flex h-12 min-w-[112px] flex-col justify-center rounded-xl border-2 border-emerald-800 bg-emerald-950/25 px-3 text-left transition hover:border-emerald-500 hover:bg-emerald-950/40"><div className="text-[8px] font-black uppercase text-emerald-400">Turnover</div><div className="text-base font-black leading-none text-emerald-200">{money(company.turnover)}</div></button>
    <div className="flex h-12 min-w-[82px] flex-col justify-center rounded-xl border-2 border-amber-700 bg-amber-950/25 px-3"><div className="text-[8px] font-black uppercase text-amber-400">Score</div><div className="text-base font-black leading-none text-amber-200">{state.score.total}</div></div>
    <div title={overtime?'KM Week is time-boxed, not hard-stopped. Finish the game at your own pace.':undefined} className="flex h-12 min-w-[92px] flex-col justify-center rounded-xl border-2 border-violet-800 bg-violet-950/25 px-3"><div className="text-[8px] font-black uppercase text-violet-400">Game time</div><div className={`font-black leading-none tabular-nums ${overtime?'text-xs text-amber-200':'text-base text-violet-100'}`}>{overtime?'OVERTIME':`${mm}:${ss}`}</div></div>
    {!readOnly&&members.length>1&&onTransferCeo&&<select defaultValue="" onChange={event=>{const id=event.target.value;event.currentTarget.value='';if(id)onTransferCeo(id)}} className="h-12 rounded-xl border-2 border-amber-800 bg-slate-950 px-2 text-[10px] font-black text-amber-100"><option value="">Pass CEO…</option>{members.filter(member=>member.id!==participant?.id).map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>}
    <button onClick={onLeave} className="h-12 min-w-[92px] rounded-xl border-2 border-rose-800 bg-rose-950/30 px-3 text-xs font-black text-rose-200 hover:border-rose-500"><LogOut className="mr-1 inline h-4 w-4"/>Leave</button>
   </div>
  </header>

  {firstGuidedTour&&guideAnchor&&activeChallenge&&<>
   <svg className="pointer-events-none fixed inset-0 z-[150]" style={{width:'100vw',height:'100vh'}} aria-hidden="true">
    <defs><marker id="kmw-tour-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="#38bdf8" strokeWidth="1.5"/></marker></defs>
    <path d={`M ${guideAnchor.left+(guideAnchor.left<guideAnchor.targetX?guideAnchor.panelWidth:0)} ${guideAnchor.top+112} Q ${(guideAnchor.left+guideAnchor.panelWidth/2+guideAnchor.targetX)/2} ${guideAnchor.targetY-35} ${guideAnchor.targetX} ${guideAnchor.targetY}`} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" markerEnd="url(#kmw-tour-arrowhead)"/>
   </svg>
   <section role="status" aria-live="polite" aria-label="Guided challenge walkthrough" className="fixed z-[160] rounded-[22px] border-[3px] border-sky-400 bg-[#071526] p-4 text-left text-white shadow-[0_14px_55px_rgba(8,145,178,.4)]" style={{left:guideAnchor.left,top:guideAnchor.top,width:guideAnchor.panelWidth,maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100vh - 96px)',overflowY:'auto'}}>
    <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wide text-sky-200">{guideStep} of 5</span><span className="flex gap-1">{[1,2,3,4,5].map(i=><span key={i} className={'h-2 w-2 rounded-full '+(i===guideStep?'bg-sky-300':i<guideStep?'bg-sky-600':'bg-slate-600')}/>)}</span></div>
    <h3 className="text-lg font-black text-white">{guideStep===1?'The business problem':guideStep===2?'Start with the local team':guideStep===3?'Bring in our expert':guideStep===4?'The team still contributes':'Solve the problem'}</h3>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">{guideStep===1?<>A surprise business problem has happened in {siteName(company,activeChallenge.siteId)}. Solving it requires significant {domainLabel(activeChallenge.domain)} expertise.</>:guideStep===2?<>Your {siteName(company,activeChallenge.siteId)} team is usually pretty good, but doesn’t have enough knowledge to handle this problem alone. Click their circle to involve them and watch the chance of success increase.</>:guideStep===3?<>Thankfully {activeExpert?.name.split(' ')[0]||'our specialist'} is our company expert in {domainLabel(activeChallenge.domain)}. Based in {activeExpert?siteName(company,activeExpert.location):'another city'}, we can fly them in for a small travel and accommodation cost. Select their circle. Their expertise will guarantee success.</>:guideStep===4?<>Notice how {siteName(company,activeChallenge.siteId)} has moved into a supporting role. We call this <b className="text-sky-300">knowledge breadth</b>. Each additional supporting source contributes one point alongside the expert’s depth.</>:<>Now click <b className="text-amber-300">Commit Response</b> to solve the problem.</>}</p>
    {(guideStep===1||guideStep===4)&&<button type="button" onClick={()=>setGuideStep(guideStep===1?2:5)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-sky-400 px-3 py-2 text-sm font-black text-slate-950">NEXT <ArrowRight className="h-4 w-4"/></button>}
    {(guideStep===2||guideStep===3||guideStep===5)&&<p className="mt-3 text-xs font-bold text-sky-300">Select the highlighted {guideStep===5?'Commit Response button':'circle'} to continue.</p>}
   </section>
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
    <h2 className="mt-2 text-2xl font-black text-white">The next three investments are guided.</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">For the next three rounds you will solve a Challenge, make one guided investment, then watch the Knowledge River change.</p>
    <div className="mt-4 grid gap-2">
     <div className="flex items-center gap-3 rounded-xl border border-amber-800 bg-amber-950/25 px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-500 bg-amber-950 text-xs font-black text-amber-200">1</span><div><b className="text-sm text-white">Train Expert</b><div className="text-[11px] text-slate-400">Build deeper expertise.</div></div></div>
     <div className="flex items-center gap-3 rounded-xl border border-sky-800 bg-sky-950/20 px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-500 bg-sky-950 text-xs font-black text-sky-200">2</span><div><b className="text-sm text-white">Local Training</b><div className="text-[11px] text-slate-400">Build capability at a site.</div></div></div>
     <div className="flex items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/20 px-3 py-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-emerald-500 bg-emerald-950 text-xs font-black text-emerald-200">3</span><div><b className="text-sm text-white">Knowledge Transfer</b><div className="text-[11px] text-slate-400">Spread capability between sites.</div></div></div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-slate-400">After the third guided investment, the board opens up and the investment choice is yours.</p>
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
    <button type="button" onClick={()=>setRiskResult(null)} className={`mt-4 h-11 w-full rounded-xl border-2 text-sm font-black ${riskResult.won?'border-emerald-200 bg-emerald-300 text-emerald-950':'border-rose-200 bg-rose-300 text-rose-950'}`}>CONTINUE</button>
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

  {scoreBriefOpen&&<>
   <div aria-hidden="true" className="fixed inset-0 z-[120] bg-black/70"/>
   <div className="fixed left-1/2 top-1/2 z-[145] w-[min(430px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border-2 border-amber-300 bg-[linear-gradient(145deg,#2b1f0b,#111827)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.72)] xl:left-[38%]">
    <div className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">Score briefing · Round 4 Invest</div>
    <h2 className="mt-2 text-2xl font-black text-white">Nice work — you’re up to {state.score.total} points.</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-200">Your Score Pad is already showing the effect of the choices you have made. <b className="text-amber-200">Only the total score matters</b>, so there is no single “right” way to build the company. You can earn points through business performance, deeper expertise, stronger local capability, knowledge flow, resilience and the Goal card.</p>
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/75 p-3">
     <div className="text-[9px] font-black uppercase tracking-[.14em] text-violet-300">Your Goal card</div>
     <div className="mt-1 text-base font-black text-white">{goal.title} · 5 points</div>
     <p className="mt-1 text-xs leading-relaxed text-slate-400">{goal.description}</p>
     <p className="mt-2 text-xs leading-relaxed text-emerald-200"><b>One idea for this Invest:</b> {scoreSuggestion}</p>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-slate-400">That is only a suggestion. From here, choose the investment that fits the company you want to build.</p>
    <button type="button" onClick={()=>{localStorage.setItem(`tpg:kmw-score-brief:${session.id}:${company.id}`,'seen');setScoreBriefOpen(false)}} className="mt-4 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950">GOT IT — LET ME INVEST <ArrowRight className="ml-1 inline h-4 w-4"/></button>
   </div>
  </>}

  {state.stage==='guided'&&state.guidedTurn===1&&state.phase==='challenge'&&!challengeFocusOpen&&<div aria-hidden="true" className="fixed inset-0 z-[110] bg-black/70"/>}

  {challengeFocusOpen&&state.phase==='challenge'&&(state.stage==='guided'||state.stage==='free')&&<div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 top-[66px] z-40 bg-black/20"/>}

  {state.stage==='complete'?<KMWeekDebriefV1 session={session} company={company}/>:<main className="mx-auto w-full p-3 min-[700px]:flex min-[700px]:h-[calc(100dvh-66px)] min-[700px]:flex-col min-[700px]:overflow-hidden">
   <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
    <div className="rounded-xl border-2 border-indigo-700 bg-indigo-950/45 px-3 py-1.5 text-[10px] font-black text-indigo-100">{phaseTitle(company)}</div>
    <PhaseStep number="1" label="Challenge" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'} done={challengeStepDone}/>
    <PhaseStep number="2" label="Invest" active={(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'} done={investStepDone}/>
    <PhaseStep number="3" label="Business Shock" active={state.stage==='shock'} done={shockDone}/>
    <PhaseStep number="4" label="Score" active={state.stage==='complete'} done={false}/>
    <div className="ml-auto rounded-xl border border-amber-800 bg-amber-950/20 px-3 py-1.5 text-xs font-black text-amber-100"><span className="mr-2 text-[9px] uppercase text-amber-500">Current phase</span>{currentPhaseLabel(company)}</div>
   </div>

   {coaching&&state.phase==='challenge'&&challengeFocusOpen&&<div className="mb-2 shrink-0 rounded-xl border border-amber-800 bg-amber-950/25 px-3 py-2 text-sm text-amber-100">{coaching.text}</div>}

   {finalShockWindow&&<div className="mb-2 shrink-0 rounded-xl border-2 border-rose-500 bg-rose-950/35 px-3 py-2 text-[10px] font-bold leading-relaxed text-rose-100"><b className="text-rose-300">FINAL 3 MINUTES.</b> Finish this round. After your next investment, the Business Shock begins and company experts become unavailable.</div>}

   <div className="grid gap-3 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div className="space-y-3 min-[700px]:flex min-[700px]:min-h-0 min-[700px]:flex-col min-[700px]:space-y-0 min-[700px]:gap-2 xl:gap-3">
     <Card className="relative p-3 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:p-2 xl:p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
       <div><div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">Knowledge River</div><h2 className="text-lg font-black text-white min-[700px]:text-sm lg:text-base xl:text-lg">Where is the capability now?</h2></div>
       <div data-kmw-scorepad>
        <button type="button" aria-expanded={scorePadOpen} onClick={()=>setScorePadOpen(open=>!open)} className={`flex min-w-[176px] items-center justify-between gap-3 rounded-xl border-2 px-3 py-2 text-left text-xs font-black shadow-lg transition ${scorePadOpen?'border-amber-300 bg-amber-400 text-slate-950':'border-amber-700 bg-amber-950/35 text-amber-100 hover:border-amber-400'}`}>
         <span className="flex items-center gap-2"><Medal className="h-4 w-4"/>SCORE PAD</span><span className={`rounded-lg border px-2 py-0.5 text-sm ${scorePadOpen?'border-slate-900/30 bg-slate-950/10':'border-amber-700 bg-slate-950/40'}`}>{state.score.total}</span>
        </button>
       </div>
      </div>
      <div className="relative top-8 h-[360px] min-[700px]:h-[calc(100%-76px)] min-[700px]:min-h-[210px] xl:h-[calc(100%-78px)] xl:min-h-[285px]"><InvestmentRiverView company={riverFrozenCompany||company} mode="km_week" selectedDomain={selectedDomain} highlightDomain guidedSiteId={firstGuidedTour?activeChallenge?.siteId:undefined} ghostPreview={scoreGhostPreview} thresholdLine={state.stage==='shock'||state.stage==='complete'?{value:KM_WEEK_SHOCK_CUTOFF,label:`SHOCK CUT-OFF · ${KM_WEEK_SHOCK_CUTOFF}`}:undefined}/></div>
      {scorePadOpen&&<div data-kmw-scorepad className={`absolute left-2 right-2 top-[54px] z-[90] h-fit overflow-visible rounded-[18px] border-2 border-amber-700 bg-[#101827]/[.98] p-3 shadow-[0_20px_60px_rgba(0,0,0,.7)] min-[700px]:left-auto min-[700px]:w-2/3 ${scoreBriefOpen?'z-[135] ring-4 ring-amber-300/80 shadow-[0_0_40px_rgba(250,204,21,.45)]':''}`}>
       <div className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-300"/><h2 className="text-sm font-black text-white">Score pad</h2><span className="ml-auto rounded-lg border border-amber-700 bg-amber-950/30 px-2 py-0.5 text-sm font-black text-amber-200">{state.score.total}</span></div>
       <div className="mt-2 grid grid-cols-2 gap-1.5">
        <ScoreCell label="Business Performance" value={state.score.business} max="12" icon={<CircleDollarSign className="h-3.5 w-3.5"/>} tip="Weighted by Challenge difficulty. Harder problems contribute more Business Performance points; solving the full six-round challenge set is worth 12."/>
        <ScoreCell label="Expertise" value={state.score.expertise} max="6" icon={<Brain className="h-3.5 w-3.5"/>} tip="Rewards deep expert capability. Each expert scores 1 point per knowledge level above 3. Use Train Expert to improve it. Hover here to preview the next +1 on the River." ghost="expertise" onGhost={setScoreGhost}/>
        <ScoreCell label="Local capability" value={state.score.localCapability} max="9" icon={<Users className="h-3.5 w-3.5"/>} tip="Scores the strength of the whole local River: 1 point for every 2 local knowledge levels across the nine site/domain positions, up to 9 points. Improve it with Local Training or Knowledge Transfer." ghost="local" onGhost={setScoreGhost}/>
        <ScoreCell label="Knowledge Flow" value={state.score.knowledgeFlow} max="6" icon={<Workflow className="h-3.5 w-3.5"/>} tip="Rewards knowledge actually moved. A transfer now moves half the gap to the stronger source (rounded up), and each level moved scores here, with a bonus when the target crosses Knowledge 2." ghost="flow" onGhost={setScoreGhost}/>
        <ScoreCell label="Resilience" value={state.score.resilience} max="5" icon={<ShieldCheck className="h-3.5 w-3.5"/>} tip="Scored in the final Business Shock: 1 point for each test your sites can handle without company experts. Hover here to see the main resilience cut-off on the River." ghost="resilience" onGhost={setScoreGhost}/>
        <ScoreCell label="KM Week goal" value={state.score.goal} max="5" icon={<Target className="h-3.5 w-3.5"/>} tip={<span className="block text-left"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-amber-300">Goal · 5 pts</span><span className="mt-1 block text-sm font-black text-white">{goal.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-slate-300">{goal.description}</span><span className={`mt-2 block rounded-lg border px-2 py-1 text-[9px] font-black ${state.score.goal?'border-emerald-700 bg-emerald-950/30 text-emerald-300':'border-amber-800 bg-amber-950/25 text-amber-300'}`}>{state.score.goal?'ACHIEVED · +5':'IN PLAY'}</span></span>}/>
       </div>
       {standings.length>1&&<div className="mt-2 border-t border-slate-800 pt-2"><div className="text-[8px] font-black uppercase tracking-[.14em] text-violet-300">Workshop standings</div><div className="mt-1 grid grid-cols-2 gap-1">{standings.map((entry,index)=><div key={entry.id} className={`flex items-center rounded-lg border px-2 py-1 text-[9px] ${entry.id===company.id?'border-violet-500 bg-violet-950/25':'border-slate-800 bg-slate-950'}`}><span className="w-4 font-black text-slate-500">{index+1}</span><span className="min-w-0 flex-1 truncate font-bold text-slate-300">{entry.name}</span><b className="text-white">{entry.score}</b></div>)}</div></div>}
      </div>}
     </Card>

     <div className="grid shrink-0 gap-2 md:grid-cols-3 min-[700px]:gap-1.5 xl:gap-2">
      {sites.map((site,index)=><Card key={site.id} className={`relative overflow-hidden p-3 min-[700px]:p-2 xl:p-3 ${index===0?'rotate-[-.2deg]':index===2?'rotate-[.2deg]':''}`}>
       <div className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[8px] font-black text-slate-500">{SITE_ABBR[site.id]}</div>
       <div className="flex items-center gap-2 min-[700px]:gap-1.5"><MapPin className="h-4 w-4 text-emerald-300 min-[700px]:h-3.5 min-[700px]:w-3.5"/><h3 className="text-sm font-black text-white min-[700px]:text-xs xl:text-sm">{site.name}</h3></div>
       <div className="mt-2 space-y-1.5 min-[700px]:mt-1.5 min-[700px]:space-y-1 xl:mt-2 xl:space-y-1.5">{KM_WEEK_DOMAINS.map(domain=><button key={domain} onClick={()=>setSelectedDomain(domain)} className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-left min-[700px]:gap-1 min-[700px]:px-1.5 min-[700px]:py-0.5 xl:gap-2 xl:px-2 xl:py-1"><span className="w-16 truncate text-[9px] font-black text-slate-400 min-[700px]:w-10 min-[700px]:text-[8px] xl:w-16 xl:text-[9px]">{domainLabel(domain)}</span><KnowledgePips value={site.teamCapability[domain]||0} domain={domain} compact/><b className="ml-auto text-xs text-white">{site.teamCapability[domain]||0}</b></button>)}</div>
       <div className="mt-2 border-t border-slate-800 pt-1.5 text-[9px] font-bold text-slate-500 min-[700px]:mt-1 min-[700px]:pt-1 min-[700px]:text-[8px] xl:mt-2 xl:pt-1.5 xl:text-[9px]">Expert here: <span className="text-amber-200">{experts.filter(expert=>expert.location===site.id).map(expert=>expert.name.split(' ')[0]).join(', ')||'—'}</span></div>
      </Card>)}
     </div>
    </div>

    <aside className="kmw-controls min-w-0 space-y-2 min-[700px]:flex min-[700px]:min-h-0 min-[700px]:flex-col min-[700px]:space-y-0 min-[700px]:gap-2">
     {(state.stage==='guided'||state.stage==='free')&&state.phase==='challenge'&&!challengeFocusOpen?<div className={`relative ${state.stage==='guided'&&state.guidedTurn===1?'z-[120]':''} overflow-y-auto overscroll-contain touch-pan-y flex min-h-[360px] shrink-0 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-violet-500/70 bg-violet-950/10 p-5 min-[700px]:min-h-0 min-[700px]:flex-1 min-[700px]:p-3 xl:p-5`}>
      {state.stage==='guided'&&state.guidedTurn===1&&<div className="mb-4 max-w-[350px] rounded-2xl border border-amber-700/70 bg-amber-950/20 p-3 text-left shadow-lg"><div className="text-[13px] font-black uppercase tracking-[.16em] text-amber-300">CEO briefing · Before Challenge</div><p className="mt-2 text-[16px] leading-relaxed text-slate-200">Welcome! You are the new CEO of <b className="text-white">{company.name}</b>. It’s a business with promise but also some challenges to overcome. There are islands of excellence and a few experts you can rely on to meet the challenges, but your role is to build up knowledge so every site performs well. Business goes on while you make improvements, so you will have to use the expertise you have to solve daily events. In fact, here comes one right now. <b className="text-amber-200">Click the card below to see what it is.</b></p></div>}
      <button type="button" onClick={()=>{setChallengeFocusOpen(true);if(state.stage==='guided'&&state.guidedTurn===1)setGuideStep(1)}} className="group kmw-start-card relative flex h-[230px] w-[168px] flex-col items-center justify-center overflow-hidden rounded-[18px] border-[3px] border-violet-300 bg-[linear-gradient(145deg,#28184d,#111827)] px-5 text-center shadow-[0_18px_35px_rgba(0,0,0,.42)] transition hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(124,58,237,.25)] focus:outline-none focus:ring-4 focus:ring-violet-400/40" aria-label="Open the next Challenge">
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
        <div className="mt-2 rounded-xl border border-amber-800 bg-amber-950/15 px-2.5 py-2 text-[10px] text-slate-300">Resolve both Challenges. Pick one, choose the knowledge you will use, then commit the response.</div>
        <div className={'mt-2 grid gap-2 '+(state.challenges.length>1?'grid-cols-2':'grid-cols-1')}>{state.challenges.map(challenge=><ChallengeToken key={challenge.id} challenge={challenge} company={company} selected={challenge.id===activeChallenge?.id} draft={challengeDrafts[challenge.id]} onClick={()=>setSelectedChallengeId(challenge.id)}/>)}</div>
       </>}

       {activeChallenge&&activeChallenge.status==='open'&&<div className="mt-2 rounded-xl border border-slate-700 bg-black/20 p-2.5">
        <div className="flex items-start justify-between gap-3">
         <div className="min-w-0">
          {guided&&<div className="text-[12px] font-black uppercase tracking-[.14em] text-amber-300">{guidedCopy.title}</div>}
          <div className={(guided?'mt-0.5 ':'')+'text-[20px] leading-tight font-black text-white'}>{challengeDisplayTitle(company,activeChallenge)}</div>
          <div className="mt-1 text-[13px] font-bold text-slate-400">Needs: <b className="text-white">{domainLabel(activeChallenge.domain)} {activeChallenge.difficulty}</b> · Local knowledge: <b className={localScore>=activeChallenge.difficulty?'text-emerald-300':'text-sky-300'}>{localScore}</b></div>
         </div>
         <div className="shrink-0 text-right"><div className="text-[13px] font-black uppercase tracking-[.12em] text-slate-500">Selected knowledge</div><div className={'mt-0.5 text-[34px] font-black leading-none tracking-[-.05em] tabular-nums '+(selectedKnowledge>=activeChallenge.difficulty?'text-emerald-300':'text-white')}>{selectedKnowledge}<span className="text-[20px] text-slate-500">/{activeChallenge.difficulty}</span></div>{pendingResponse?.challengeId===activeChallenge.id&&pendingResponse.method==='risk'&&<div className="mt-1 text-[10px] font-black text-amber-300">RISK {riskOdds.chancePercent}% · {riskOdds.requiredRoll<=1?'ANY ROLL':riskOdds.requiredRoll>6?'NO WINNING ROLL':'NEED '+riskOdds.requiredRoll+'+'}</div>}</div>
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
         <div className="flex items-center gap-2"><Target className="h-5 w-5 text-sky-300"/><div><div className="text-[13px] font-black text-white">Chance of success</div><div className="text-[11px] text-slate-300">Based on selected team and expertise</div></div></div>
         <b className={'text-2xl font-black tabular-nums '+(selectedKnowledge>=activeChallenge.difficulty?'text-emerald-300':'text-sky-300')}>{successChance}%</b>
        </div>
        {!guided&&deterministicSelected&&knowledgeShortfall>0&&<div className="mt-1.5 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-1.5 text-[10px] font-black text-rose-200">KNOWLEDGE SHORTFALL {knowledgeShortfall} · If you commit this response, the Challenge will fail.</div>}
        {(!guided||state.guidedTurn===3)&&<div className="mt-1.5"><ResponseButton selectionState={riskSelected?'depth':'none'} onClick={()=>{setChallengeAttention(false);setPendingResponse({challengeId:activeChallenge.id,method:riskSelected?(expertSelection==='depth'?'expert':localSelection==='depth'?'local':undefined):'risk',expertId:activePending?.expertId,localSelection,expertSelection,label:'Take the risk'})}}><Dices className="mr-1 inline h-4 w-4"/>TAKE THE RISK <span className="ml-1 text-slate-500">{riskOdds.chancePercent}% · gap {riskOdds.performanceGap} · need {riskOdds.requiredRoll<=1?'1+':riskOdds.requiredRoll>6?'impossible':riskOdds.requiredRoll+'+ on d6'}</span></ResponseButton></div>}
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-2 py-1.5">
         <div><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">If you solve it</div><div className="text-sm font-black text-emerald-300">+{money(activeChallenge.impact)} turnover</div></div>
         <div><div className="text-[8px] font-black uppercase tracking-[.12em] text-slate-500">If you fail</div><div className="text-sm font-black text-rose-300">-{money(activeChallenge.impact)} turnover</div></div>
        </div>
        {actionError&&<div className="mt-1.5 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-2 text-[10px] font-black text-rose-200">{actionError}</div>}
        <button type="button" onClick={()=>void commitResponse()} disabled={!responseReady||busy||readOnly} data-kmw-tour="commit" className={'mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-600'+(firstGuidedTour&&guideStep===5?' kmw-tour-highlight':'')}>{busy?'COMMITTING…':'COMMIT RESPONSE'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>}

       {challengeDone&&<div className="mt-3 rounded-xl border-2 border-emerald-700 bg-emerald-950/25 p-3 text-xs font-black text-emerald-200">Challenges complete. Moving to Invest…</div>}
      </>}

      {(state.stage==='guided'||state.stage==='free')&&state.phase==='invest'&&<>
       <div className="mt-2 rounded-xl border-2 border-amber-700 bg-amber-950/20 p-2.5">{coaching&&<p className="mb-2 text-sm font-bold leading-snug text-amber-100">{coaching.text}</p>}<div className="text-[9px] font-black uppercase tracking-[.14em] text-amber-300">What to do now</div><p className="mt-1 text-[11px] leading-relaxed text-slate-300">{guided?<><span>{guidedCopy.invest}</span><br/><span className="font-black text-amber-200">Guided move: choose {guidedTargetInvestment==='TRAIN_EXPERT'?'Train Expert':guidedTargetInvestment==='LOCAL_TRAINING'?'Local Training':'Knowledge Transfer'}.</span></>:'Choose exactly one investment. Check the preview, then press COMMIT INVESTMENT. The next round starts immediately.'}</p></div>
       <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button disabled={guided&&guidedTargetInvestment!=='TRAIN_EXPERT'} onClick={()=>setInvestment('TRAIN_EXPERT')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='TRAIN_EXPERT'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='TRAIN_EXPERT'?'border-amber-300 bg-amber-950/40':'border-slate-700 bg-slate-950'}`}><GraduationCap className="h-4 w-4 text-amber-300"/><div className="mt-1 text-[10px] font-black text-white">Train Expert</div><div className="text-[9px] text-slate-500">+1 depth · $15k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='LOCAL_TRAINING'} onClick={()=>setInvestment('LOCAL_TRAINING')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='LOCAL_TRAINING'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='LOCAL_TRAINING'?'border-sky-300 bg-sky-950/40':'border-slate-700 bg-slate-950'}`}><Users className="h-4 w-4 text-sky-300"/><div className="mt-1 text-[10px] font-black text-white">Local Training</div><div className="text-[9px] text-slate-500">+2 local · $10k</div></button>
        <button disabled={guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'} onClick={()=>setInvestment('KNOWLEDGE_TRANSFER')} className={`rounded-xl border-2 p-2 text-left transition ${guided&&guidedTargetInvestment!=='KNOWLEDGE_TRANSFER'?'cursor-not-allowed border-slate-800 bg-slate-950/55 opacity-35':investment==='KNOWLEDGE_TRANSFER'?'border-emerald-300 bg-emerald-950/40':'border-slate-700 bg-slate-950'}`}><Workflow className="h-4 w-4 text-emerald-300"/><div className="mt-1 text-[10px] font-black text-white">Knowledge Transfer</div><div className="text-[9px] text-slate-500">Move half the gap · $8k</div></button>
       </div>
       <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/75 p-2.5">
        {investment!=='KNOWLEDGE_TRANSFER'?<div className="grid grid-cols-2 items-start gap-2"><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">Company expert<select value={specialist?.id||''} onChange={event=>{const next=experts.find(item=>item.id===event.target.value);setExpertId(event.target.value);if(next)setSelectedDomain(next.domains[0].domain)}} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{experts.map(expert=><option key={expert.id} value={expert.id}>{expert.name} ({SITE_ABBR[expert.location]||expert.location}) · {domainLabel(expert.domains[0].domain)} {expert.domains[0].score}</option>)}</select></label><div>{investment==='LOCAL_TRAINING'?<label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">Training site<select value={trainingSiteId} onChange={event=>setTrainingSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · Team {site.teamCapability[specialistDomain]||0}{specialist?.location===site.id?' · expert here':' · +$2k travel'}</option>)}</select></label>:<div><div className="text-[9px] font-black uppercase text-slate-500">Knowledge domain</div><div className="mt-1 rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs font-black text-white">{domainLabel(specialistDomain)}</div></div>}</div></div>:<div className="grid grid-cols-3 gap-2"><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">Domain<select value={selectedDomain} onChange={event=>setSelectedDomain(event.target.value as KnowledgeDomain)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{KM_WEEK_DOMAINS.map(domain=><option key={domain} value={domain}>{domainLabel(domain)}</option>)}</select></label><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">From<select value={sourceSiteId} onChange={event=>setSourceSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label><label className="block min-w-0 text-[9px] font-black uppercase text-slate-500">To<select value={targetSiteId} onChange={event=>setTargetSiteId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-[#071019] px-2 py-2 text-xs normal-case text-white">{sites.map(site=><option key={site.id} value={site.id}>{site.name} · {site.teamCapability[selectedDomain]||0}</option>)}</select></label></div>}
        <div className="mt-2 rounded-lg border border-amber-800 bg-amber-950/15 px-2 py-1.5 text-[10px]"><span className="font-black text-amber-300">Preview:</span> <span className="text-slate-200">{investmentPreview}</span>{investment==='LOCAL_TRAINING'&&<div className="mt-1 font-bold text-red-300">Training commitment — unavailable next round</div>}</div>
        {actionError&&<div className="mt-2 rounded-lg border border-rose-700 bg-rose-950/30 px-2 py-2 text-[10px] font-black text-rose-200">{actionError}</div>}
        <button onClick={event=>void invest(event)} disabled={busy||readOnly} className="mt-2 h-11 w-full rounded-xl border-2 border-amber-200 bg-amber-400 text-sm font-black text-slate-950 shadow-lg disabled:bg-slate-800 disabled:text-slate-600">{busy?'COMMITTING…':guided?'COMMIT GUIDED INVESTMENT':finalShockWindow?'COMMIT FINAL INVESTMENT & FACE BUSINESS SHOCK':'COMMIT INVESTMENT & START NEXT ROUND'} <ArrowRight className="ml-1 inline h-4 w-4"/></button>
       </div>
      </>}

      {state.stage==='shock'&&<div className="mt-2">
       <div className="rounded-2xl border-2 border-rose-700 bg-[linear-gradient(145deg,#32121d,#171827)] p-3 text-left">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 border-rose-300 bg-rose-950"><ShieldCheck className="h-5 w-5 text-rose-200"/></div><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-rose-300">Business Shock · final three minutes</div><h3 className="mt-0.5 text-lg font-black text-white">The experts cannot be everywhere at once.</h3></div></div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-200">Five critical issues hit across the company at the same time. Your specialists are already committed elsewhere, so each site has to act using the knowledge that has actually been built locally.</p>
        <div className="mt-2 rounded-xl border border-amber-700/70 bg-amber-950/25 p-2 text-[10px] leading-relaxed text-amber-100"><b className="text-amber-300">The consequence:</b> every missing local Knowledge point requires emergency external support at <b>$${KM_WEEK_SHOCK_GAP_COST}k per point</b>. The larger the capability gap, the larger the hit to turnover.</div>
       </div>

       <div className="mt-3 space-y-1.5">
        {!state.shockResolved?KM_WEEK_SHOCK_SPECS.map(check=>{
         const site=company.sites.find(item=>item.id===check.siteId);
         return <div key={check.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-2 text-left">
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] font-black text-white">{site?.name||check.siteId} · {domainLabel(check.domain)}</div><div className="text-[9px] text-slate-500">Critical local capability · requires Knowledge {check.difficulty}</div></div><div className="rounded-full border border-slate-600 px-2 py-1 text-[8px] font-black text-slate-400">ABOUT TO BE TESTED</div></div>
         </div>;
        }):state.shockChecks.map(check=>{
         const site=company.sites.find(item=>item.id===check.siteId);
         return <div key={check.id} className={'rounded-xl border p-2 text-left '+(check.passed?'border-emerald-700 bg-emerald-950/25':'border-rose-700 bg-rose-950/30')}>
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[10px] font-black text-white">{site?.name||check.siteId} · {domainLabel(check.domain)}</div><div className="text-[9px] text-slate-400">Local Knowledge {check.localKnowledge} · required {check.difficulty}</div></div><div className={'rounded-full border px-2 py-1 text-[9px] font-black '+(check.passed?'border-emerald-500 text-emerald-300':'border-rose-500 text-rose-200')}>{check.passed?'HELD LOCALLY':'CAPABILITY GAP'}</div></div>
          {!check.passed&&<div className="mt-2 rounded-lg border border-rose-800 bg-slate-950/70 px-2 py-1.5 text-[9px] font-black text-rose-200">Shortfall {Math.max(0,check.difficulty-check.localKnowledge)} · emergency support {money(Math.max(0,check.difficulty-check.localKnowledge)*KM_WEEK_SHOCK_GAP_COST)}</div>}
         </div>;
        })}
       </div>

       {!state.shockResolved?<button onClick={()=>void post({type:'KM_WEEK_RESOLVE_SHOCK'})} disabled={busy||readOnly} className="mt-3 h-11 w-full rounded-xl border-2 border-white bg-white text-sm font-black text-rose-950 disabled:opacity-40">{busy?'REVEALING…':'REVEAL WHAT THE COMPANY CAN HANDLE'}</button>:<>
        {(()=>{
         const gaps=state.shockChecks.filter(check=>!check.passed).length;
         const ready=state.shockChecks.length-gaps;
         const missingKnowledge=state.shockChecks.reduce((sum,check)=>sum+Math.max(0,check.difficulty-check.localKnowledge),0);
         const cost=missingKnowledge*KM_WEEK_SHOCK_GAP_COST;
         const beforeShock=company.turnover+cost;
         return <div className={'mt-3 rounded-2xl border-2 p-3 text-left '+(gaps?'border-rose-500 bg-rose-950/30':'border-emerald-500 bg-emerald-950/25')}>
          <div className={'text-[9px] font-black uppercase tracking-[.16em] '+(gaps?'text-rose-300':'text-emerald-300')}>BUSINESS SHOCK RESULT</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Held locally</div><div className="text-xl font-black text-white">{ready}/{state.shockChecks.length}</div></div>
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Knowledge missing</div><div className={'text-xl font-black '+(missingKnowledge?'text-rose-200':'text-emerald-200')}>{missingKnowledge}</div></div>
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Emergency support</div><div className={'text-xl font-black '+(cost?'text-rose-200':'text-emerald-200')}>{cost?'-'+money(cost):money(0)}</div></div>
           <div className="rounded-xl border border-white/10 bg-black/20 p-2"><div className="text-[8px] font-black uppercase text-slate-500">Turnover</div><div className="text-sm font-black text-white">{money(beforeShock)} → {money(company.turnover)}</div></div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-300">{gaps?<>The company bought emergency expertise for <b className="text-rose-200">{missingKnowledge} missing knowledge point{missingKnowledge===1?'':'s'}</b>. This cost is now permanently recorded in turnover and will remain visible in the debrief graph.</>:<>Every tested capability was already available where the work happened. No emergency external support was needed.</>}</p>
         </div>;
        })()}
        <button onClick={()=>void post({type:'KM_WEEK_COMPLETE_SHOCK'})} disabled={busy||readOnly} className="mt-3 h-11 w-full rounded-xl border-2 border-emerald-300 bg-emerald-400 text-sm font-black text-emerald-950 disabled:opacity-40">{busy?'FINISHING…':'CONTINUE TO DEBRIEF'}</button>
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
