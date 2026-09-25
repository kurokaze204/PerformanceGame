import React,{useEffect,useMemo,useState}from'react';
import{BarChart3}from'lucide-react';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import{formatCurrency}from'../utils/format.ts';

type TurnoverPoint={round:number;values:Record<string,number>};

interface Props{
 session:GameSessionV2;
 company:CompanyV2;
 selectedSiteName?:string;
 onOpenCharts?:()=>void;
}

function readLocal(session:GameSessionV2):TurnoverPoint[]{
 const key=`tpg_turnover_history_${session.id}`;
 let history:TurnoverPoint[]=[];
 try{history=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
 const current:TurnoverPoint={round:session.round,values:Object.fromEntries(session.companies.map(company=>[company.id,company.turnover]))};
 const next=[...history.filter(point=>point.round!==session.round),current].sort((a,b)=>a.round-b.round);
 try{localStorage.setItem(key,JSON.stringify(next))}catch{}
 return next;
}

function analyticsHistory(session:GameSessionV2,metrics:any[]):TurnoverPoint[]{
 const byRound=new Map<number,Map<string,{turnover:number;at:number}>>();
 for(const row of metrics||[]){
  const round=Number(row.round||0),companyId=String(row.company_id||''),turnover=Number(row.turnover);
  if(!round||!companyId||!Number.isFinite(turnover))continue;
  const at=new Date(row.captured_at||0).getTime()||0;
  const roundMap=byRound.get(round)||new Map();
  const current=roundMap.get(companyId);
  if(!current||at>=current.at)roundMap.set(companyId,{turnover,at});
  byRound.set(round,roundMap);
 }
 const rounds=[...byRound.keys()].sort((a,b)=>a-b);
 const last=Object.fromEntries(session.companies.map(company=>[company.id,company.startingTurnover])) as Record<string,number>;
 return rounds.map(round=>{
  const map=byRound.get(round)!;
  for(const company of session.companies){
   const value=map.get(company.id)?.turnover;
   if(Number.isFinite(value))last[company.id]=Number(value);
  }
  return{round,values:{...last}};
 });
}

const ComparativeTurnoverChart:React.FC<{session:GameSessionV2;companyId:string}>=({session,companyId})=>{
 const[analytics,setAnalytics]=useState<any[]|null>(null);
 const local=useMemo(()=>readLocal(session),[session.id,session.round,...session.companies.map(company=>company.turnover)]);
 useEffect(()=>{
  let alive=true;
  fetch(`/api/sessions/${session.id}/aar`).then(response=>response.ok?response.json():null).then(data=>{if(alive&&data?.available&&Array.isArray(data.metrics))setAnalytics(data.metrics)}).catch(()=>undefined);
  return()=>{alive=false};
 },[session.id,session.round]);
 const data=useMemo(()=>{
  const fromAnalytics=analytics?analyticsHistory(session,analytics):[];
  const merged=new Map<number,TurnoverPoint>();
  for(const point of fromAnalytics)merged.set(point.round,point);
  for(const point of local)merged.set(point.round,point);
  return[...merged.values()].sort((a,b)=>a.round-b.round);
 },[analytics,local,session]);
 const rounds=data.map(point=>point.round);
 const max=Math.max(1,...data.flatMap(point=>Object.values(point.values)));
 const width=360,height=160,left=10,right=10,top=12,bottom=25,innerW=width-left-right,innerH=height-top-bottom;
 const x=(index:number)=>left+(rounds.length<=1?innerW/2:index*innerW/(rounds.length-1));
 const y=(value:number)=>top+innerH-(Math.max(0,value)/max)*innerH;
 const valuesFor=(id:string)=>{
  let last=session.companies.find(company=>company.id===id)?.startingTurnover||0;
  return data.map(point=>{const next=point.values[id];if(Number.isFinite(next))last=next;return last});
 };
 if(!data.length)return <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">Turnover history will appear as the game progresses.</div>;
 const playerValues=valuesFor(companyId);
 return <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
  <div className="flex items-end justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[.14em] text-slate-500 font-black">Turnover trend</div><div className="text-sm font-black text-white">All companies</div></div><div className="text-[10px] text-slate-500">Green = you · Grey = others</div></div>
  <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full h-[160px]" role="img" aria-label="Turnover by round for all companies">
   {[0,.5,1].map(level=>{const yy=top+innerH-(level*innerH);return <line key={level} x1={left} x2={width-right} y1={yy} y2={yy} stroke="#1e293b" strokeWidth="1"/>})}
   {rounds.map((round,index)=><g key={round}><line x1={x(index)} x2={x(index)} y1={top} y2={top+innerH} stroke="#172033" strokeWidth="1"/><text x={x(index)} y={height-6} textAnchor="middle" fill="#64748b" fontSize="9">R{round}</text></g>)}
   {session.companies.filter(company=>company.id!==companyId).map(company=><polyline key={company.id} points={valuesFor(company.id).map((value,index)=>`${x(index)},${y(value)}`).join(' ')} fill="none" stroke="#64748b" strokeOpacity=".72" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>)}
   <polyline points={playerValues.map((value,index)=>`${x(index)},${y(value)}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
   {playerValues.map((value,index)=><circle key={index} cx={x(index)} cy={y(value)} r="3.5" fill="#22c55e"/>)}
   <text x={left} y={top+9} fill="#64748b" fontSize="9">{formatCurrency(max)}</text>
  </svg>
 </div>;
};

export const ScorePanelV2:React.FC<Props>=({session,company,selectedSiteName,onOpenCharts})=><div>
 <h2 className="text-xl font-black text-white">Company position</h2>
 <div className="grid grid-cols-2 gap-2 mt-3"><Stat label="Turnover" value={formatCurrency(company.turnover)}/><Stat label="Actions" value={String(company.actionsRemaining)}/><Stat label="Reputation" value={String(company.reputationPoints)}/><Stat label="Events" value={String(company.eventsDrawnCount)}/></div>
 {selectedSiteName&&<div className="mt-3 text-xs text-slate-500">Selected site: <b className="text-slate-300">{selectedSiteName}</b></div>}
 <div className="mt-4"><ComparativeTurnoverChart session={session} companyId={company.id}/></div>
 {onOpenCharts&&<button type="button" onClick={onOpenCharts} className="mt-3 w-full rounded-xl border-2 border-indigo-600 bg-indigo-950/55 px-4 py-3 font-black text-indigo-100 hover:border-indigo-300 hover:bg-indigo-950 flex items-center justify-center gap-2"><BarChart3 className="h-5 w-5"/>OPEN DETAILED CHARTS</button>}
</div>;

const Stat:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-xl border-2 border-slate-800 bg-slate-950 p-3"><div className="text-xs uppercase text-slate-500 font-black">{label}</div><div className="text-xl font-black text-emerald-300">{value}</div></div>;
