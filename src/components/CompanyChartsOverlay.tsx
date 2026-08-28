import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { CompanyV2 } from '../types/gameV2.ts';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';

export type RoundSnapshot = {
  round: number;
  companyTurnover: number;
  cumulativeKnowledgeSpend: number;
  cumulativeCorporateKnowledgeSpend: number;
  intranet: Record<KnowledgeDomain, number>;
  sites: Record<string, {
    name: string;
    turnover: number;
    totalLocalKnowledge: number;
    totalCodifiedKnowledge: number;
    cumulativeKnowledgeSpend: number;
    maxByDomain: Record<KnowledgeDomain, number>;
  }>;
};

type Props = {
  company: CompanyV2;
  snapshots: RoundSnapshot[];
  onClose: () => void;
  showIntro?: boolean;
};

type Series = { id: string; label: string; values: number[]; group: string };
const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];
const LINE_COLORS = ['#22c55e','#38bdf8','#f59e0b','#a78bfa','#fb7185','#2dd4bf','#60a5fa','#f97316','#ef4444','#16a34a','#9333ea','#facc15','#c084fc','#94a3b8'];

function liveSnapshot(company: CompanyV2, round: number): RoundSnapshot {
  const sites: RoundSnapshot['sites'] = {};
  for (const site of company.sites) {
    const totalLocalKnowledge = DOMAINS.reduce((sum, d) => sum + site.teamCapability[d], 0);
    const totalCodifiedKnowledge = DOMAINS.reduce((sum, d) => sum + site.codifiedKnowledge[d], 0);
    const maxByDomain = Object.fromEntries(DOMAINS.map((d) => [d, Math.max(site.teamCapability[d], site.codifiedKnowledge[d])])) as Record<KnowledgeDomain, number>;
    sites[site.id] = {
      name: site.name,
      turnover: site.turnover,
      totalLocalKnowledge,
      totalCodifiedKnowledge,
      cumulativeKnowledgeSpend: company.cumulativeSiteKnowledgeSpend?.[site.id] || 0,
      maxByDomain,
    };
  }
  return {
    round,
    companyTurnover: company.turnover,
    cumulativeKnowledgeSpend: company.cumulativeKnowledgeSpend || 0,
    cumulativeCorporateKnowledgeSpend: company.cumulativeCorporateKnowledgeSpend || 0,
    intranet: { ...company.intranet },
    sites,
  };
}

export function captureRoundSnapshot(company: CompanyV2, round: number): RoundSnapshot {
  return liveSnapshot(company, round);
}

const TrendChart: React.FC<{ title: string; rounds: number[]; series: Series[]; enabled: Record<string, boolean> }> = ({ title, rounds, series, enabled }) => {
  const shown = series.filter((s) => enabled[s.id]);
  const width = 760, height = 92, left = 20, right = 12, top = 8, bottom = 20;
  const innerW = width - left - right, innerH = height - top - bottom;
  const pointsFor = (values: number[]) => {
    const min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max - min);
    return values.map((v, i) => {
      const x = left + (values.length <= 1 ? innerW / 2 : i * innerW / (values.length - 1));
      const y = top + innerH - ((v - min) / span) * innerH;
      return `${x},${y}`;
    }).join(' ');
  };
  return <section className="rounded-xl border border-slate-700 bg-slate-950/85 p-2 min-w-0">
    <div className="font-black text-white text-xs mb-1">{title}</div>
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[82px] bg-slate-900/55 rounded-lg">
      {rounds.map((r,i)=>{const x=left+(rounds.length<=1?innerW/2:i*innerW/(rounds.length-1));return <g key={r}><line x1={x} y1={top} x2={x} y2={top+innerH} stroke="#334155" strokeWidth="1"/><text x={x} y={height-5} textAnchor="middle" fill="#94a3b8" fontSize="9">R{r}</text></g>})}
      {shown.map((s)=><polyline key={s.id} points={pointsFor(s.values)} fill="none" stroke={LINE_COLORS[series.findIndex(x=>x.id===s.id)%LINE_COLORS.length]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>)}
    </svg>
  </section>;
};

export const CompanyChartsOverlay: React.FC<Props> = ({ company, snapshots, onClose, showIntro = false }) => {
  const [intro, setIntro] = useState(showIntro);
  const data = useMemo(() => {
    const byRound = new Map<number, RoundSnapshot>();
    snapshots.forEach((s) => byRound.set(s.round, s));
    const latestRound = Math.max(1, ...snapshots.map(s=>s.round));
    byRound.set(latestRound, liveSnapshot(company, latestRound));
    return [...byRound.values()].sort((a,b)=>a.round-b.round);
  }, [company, snapshots]);
  const rounds = data.map(d=>d.round);
  const roundDelta=(values:number[])=>values.map((value,index)=>index===0?value:Math.max(0,value-values[index-1]));
  const commonSeries = (siteId?: string): Series[] => {
    const local = siteId ? data.map(d=>d.sites[siteId]?.totalLocalKnowledge || 0) : data.map(()=>0);
    const codified = siteId ? data.map(d=>d.sites[siteId]?.totalCodifiedKnowledge || 0) : data.map(()=>0);
    const turnover = siteId ? data.map(d=>d.sites[siteId]?.turnover || 0) : data.map(d=>d.companyTurnover);
    const cumulativeInvestment = siteId
      ? data.map(d=>d.sites[siteId]?.cumulativeKnowledgeSpend || 0)
      : data.map(d=>d.cumulativeCorporateKnowledgeSpend || 0);
    const investment = roundDelta(cumulativeInvestment);
    const maxSeries = DOMAINS.map(domain=>({id:`max-${domain}`,label:`Max ${DOMAIN_INFO[domain].label}`,group:'Max domain',values:siteId?data.map(d=>d.sites[siteId]?.maxByDomain[domain]||0):data.map(()=>0)}));
    const corpSeries = DOMAINS.map(domain=>({id:`corp-${domain}`,label:`Corp ${DOMAIN_INFO[domain].label}`,group:'Corporate',values:data.map(d=>d.intranet[domain])}));
    return [
      {id:'turnover',label:'Site Turnover',group:'Core',values:turnover},
      {id:'local',label:'Total Local Knowledge',group:'Core',values:local},
      {id:'codified',label:'Total Codified Knowledge',group:'Core',values:codified},
      ...maxSeries,...corpSeries,
      {id:'investment',label:'Round Knowledge Investment $',group:'Core',values:investment},
    ];
  };
  const legendSeries=commonSeries(company.sites.find(s=>!s.isClosed)?.id);
  const [enabled,setEnabled]=useState<Record<string,boolean>>(()=>Object.fromEntries(legendSeries.map((s,i)=>[s.id,i<3])));
  return <div className="fixed inset-0 z-[160] bg-[#080b12]/98 backdrop-blur-sm p-3 md:p-5 overflow-hidden">
    <div className="h-full max-w-[1600px] mx-auto rounded-3xl border border-indigo-700 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700 flex items-start justify-between gap-4 shrink-0">
        <div><div className="text-xs uppercase tracking-[0.18em] text-indigo-300 font-black">Company Trends</div><h2 className="text-xl font-black text-white">How your capability is changing round by round</h2><p className="text-xs text-slate-400 mt-1">Trend view only: there is deliberately no Y-axis scale. The shared legend controls every chart. Site investment includes direct spend at that office plus its allocated share of corporate investment; Corporate HQ shows corporate investment only.</p></div>
        <button onClick={onClose} className="rounded-xl border border-slate-600 bg-slate-950 p-2 text-white hover:bg-slate-800"><X className="w-5 h-5"/></button>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_230px] gap-3 p-3">
        <div className="overflow-auto grid grid-cols-2 xl:grid-cols-3 gap-2 content-start">
          <TrendChart title="Corporate HQ" rounds={rounds} series={commonSeries()} enabled={enabled}/>
          {company.sites.filter(s=>!s.isClosed).map(site=><TrendChart key={site.id} title={site.name} rounds={rounds} series={commonSeries(site.id)} enabled={enabled}/>)}
        </div>
        <aside className="rounded-2xl border border-slate-700 bg-slate-950/80 p-3 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-black mb-2">All charts</div>
          <div className="space-y-1.5">{legendSeries.map((s,i)=><button key={s.id} onClick={()=>setEnabled(v=>({...v,[s.id]:!v[s.id]}))} className={`w-full rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold ${enabled[s.id]?'border-slate-400 bg-slate-800 text-white':'border-slate-800 bg-slate-950 text-slate-600'}`}><span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{background:LINE_COLORS[i%LINE_COLORS.length]}}/>{s.label}</button>)}</div>
        </aside>
      </div>
      {intro && <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/75 p-6"><div className="max-w-xl rounded-3xl border-2 border-indigo-500 bg-slate-950 p-6 shadow-2xl"><div className="text-xs uppercase tracking-[0.18em] text-indigo-300 font-black">Round 2 — Charts unlocked</div><h3 className="text-2xl font-black text-white mt-2">Watch the shape of your company change.</h3><p className="text-sm text-slate-300 mt-3 leading-relaxed">These compact charts show turnover, local knowledge, codified knowledge, domain strength, corporate knowledge and knowledge investment across rounds. Use the single legend on the right to turn a measure on or off across every chart at once. Site investment combines direct local spend with that office's share of company-wide investment.</p><p className="text-sm text-slate-300 mt-3">Close this view with the X. From now on you can reopen it at any time using the <b>Charts</b> button at the top of the game.</p><button onClick={()=>setIntro(false)} className="mt-5 w-full rounded-xl bg-indigo-500 py-3 font-black text-white">VIEW MY COMPANY</button></div></div>}
    </div>
  </div>;
};
