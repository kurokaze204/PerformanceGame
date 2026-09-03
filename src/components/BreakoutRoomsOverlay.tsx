import React from 'react';
import { Users, X } from 'lucide-react';
import type { GameSessionV2 } from '../types/gameV2.ts';

interface Props { session:GameSessionV2; onClose:()=>void; }

export const BreakoutRoomsOverlay:React.FC<Props>=({session,onClose})=>{
 const players=(session.participants||[]).filter(p=>p.role==='participant');
 return <div className="fixed inset-0 z-[230] bg-black/70 p-4 grid place-items-center" role="dialog" aria-modal="true" aria-label="Breakout room assignments">
  <div className="w-full max-w-3xl max-h-[82dvh] overflow-hidden rounded-3xl border-2 border-violet-500 bg-[#0b0f18] shadow-2xl flex flex-col">
   <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><div className="text-[10px] uppercase tracking-[.16em] text-violet-300 font-black">Facilitator</div><h2 className="text-xl font-black text-white">Breakout rooms</h2></div><button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-xl border border-slate-700" aria-label="Close breakout rooms"><X className="w-5 h-5"/></button></div>
   <div className="min-h-0 overflow-y-auto p-4 grid sm:grid-cols-2 gap-3">{session.companies.map(company=>{const team=players.filter(p=>p.companyId===company.id);return <section key={company.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-4"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-300"/><h3 className="font-black text-white">{company.name}</h3><span className="ml-auto text-xs text-slate-500">{team.length}</span></div><div className="mt-3 space-y-1.5">{team.length?team.map(p=><div key={p.id} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">{p.name}</div>):<div className="text-xs italic text-slate-600">No players assigned</div>}</div></section>})}</div>
  </div>
 </div>;
};
