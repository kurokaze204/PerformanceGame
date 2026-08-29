import React, { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Building2, Dices, Flame, ShieldCheck, Sparkles } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { formatCurrency } from '../utils/format.ts';
import confetti from 'canvas-confetti';

interface FinalDisruptionModalProps {
  session: GameSessionV2;
  company: CompanyV2;
  onResolveFinalDisruption: () => Promise<void> | void;
  onOpenAAR: () => void;
}

const bestLocal = (company: CompanyV2, domain: KnowledgeDomain) => Math.max(
  0,
  ...company.sites.filter(s => !s.isClosed).map(s => Math.max(s.teamCapability[domain] || 0, s.codifiedKnowledge[domain] || 0)),
);

const bestExpert = (company: CompanyV2, domain: KnowledgeDomain) => Math.max(
  0,
  ...company.experts.filter(e => !e.isVacant).flatMap(e => e.domains.filter(d => d.domain === domain).map(d => d.score)),
);

export const FinalDisruptionModal: React.FC<FinalDisruptionModalProps> = ({
  session,
  company,
  onResolveFinalDisruption,
  onOpenAAR,
}) => {
  const card = session.finalDisruptionCard;
  const isResolved = Boolean(session.finalDisruptionResolved);
  const [busy, setBusy] = useState(false);
  const domains = card?.domains || [];
  const riskPercent = card && company.turnover > 0 ? Math.round((card.impact / company.turnover) * 100) : 0;
  const intranetMean = useMemo(() => {
    const values = Object.values(company.intranet) as number[];
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '0.0';
  }, [company.intranet]);

  if (!card) return null;

  const resolve = async () => {
    if (busy || isResolved) return;
    setBusy(true);
    try {
      await onResolveFinalDisruption();
      confetti({ particleCount: 70, spread: 90, origin: { y: 0.62 } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed left-3 right-3 top-[94px] bottom-3 z-[170] rounded-3xl border-2 border-violet-700 bg-[#080b12]/[0.99] shadow-2xl p-4 overflow-hidden text-slate-200">
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-4 shrink-0 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-xl border border-violet-600 bg-violet-950 grid place-items-center shadow-lg shadow-violet-950/50">
              <Flame className="w-6 h-6 text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300 font-black">Round 6 · Climactic Event</div>
              <h2 className="text-2xl font-black text-white">The final disruption</h2>
              <p className="text-xs text-slate-400 mt-0.5">This is the cumulative test of the knowledge capability you built during the game.</p>
            </div>
          </div>
          {isResolved ? (
            <button onClick={onOpenAAR} className="rounded-xl border border-indigo-600 bg-indigo-950 px-4 py-2.5 text-xs font-black text-indigo-100 flex items-center gap-2 shrink-0">
              <BookOpen className="w-4 h-4" /> Start After Action Review
            </button>
          ) : (
            <div className="rounded-xl border border-violet-700 bg-violet-950/50 px-3 py-2 text-right shrink-0">
              <div className="text-[9px] uppercase text-violet-300 font-black">Final test</div>
              <div className="text-sm font-black text-white">No new investment</div>
            </div>
          )}
        </div>

        {!isResolved ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 mt-4 min-h-0 flex-1">
            <div className="space-y-3 min-h-0">
              <section className="rounded-2xl overflow-hidden border-2 border-rose-700/80 bg-slate-950 shadow-2xl">
                <div className="px-5 py-4 bg-gradient-to-r from-rose-950 via-violet-950/60 to-slate-950">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-wider font-black text-white/60">Climactic event · Whole company</div>
                      <h3 className="text-2xl font-black text-white mt-1">{card.title}</h3>
                      <p className="text-sm text-slate-300 mt-2 leading-relaxed">{card.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[9px] uppercase text-slate-500 font-black">Loss if failed</div>
                      <div className="text-2xl font-black text-rose-200">−{formatCurrency(card.impact)}</div>
                      <div className="text-[10px] text-slate-400">{riskPercent}% of current turnover</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t border-slate-800">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-black mb-2">Knowledge required</div>
                  <div className={`grid gap-2 ${domains.length >= 3 ? 'grid-cols-3' : domains.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {domains.map(d => (
                      <div key={d.domain} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DOMAIN_INFO[d.domain].color }} />
                          <b className="text-sm text-white">{DOMAIN_INFO[d.domain].label}</b>
                        </div>
                        <div className="mt-2 flex justify-between items-end">
                          <span className="text-[9px] uppercase text-slate-500 font-black">Difficulty</span>
                          <span className="text-xl font-black text-indigo-200">{d.difficulty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <div className="rounded-2xl border border-amber-700/60 bg-amber-950/20 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-black text-amber-100">You cannot buy your way out now.</div>
                  <div className="text-xs text-amber-100/70 mt-0.5">The climactic event tests the corporate, local, expert, network and embedded capability you built through the earlier rounds.</div>
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border-2 border-violet-500 bg-violet-950/55 p-4 shadow-xl min-h-0 overflow-auto">
              <div className="text-[10px] uppercase tracking-wider text-violet-300 font-black">Your capability going in</div>
              <h3 className="text-lg font-black text-white mt-1">Final knowledge position</h3>
              <div className="space-y-2 mt-3">
                {domains.map(d => {
                  const local = bestLocal(company, d.domain);
                  const expert = bestExpert(company, d.domain);
                  const corporate = company.intranet[d.domain] || 0;
                  const automated = company.automatedDomains.includes(d.domain);
                  return (
                    <div key={d.domain} className="rounded-xl border border-violet-800 bg-slate-950/75 p-3">
                      <div className="flex justify-between items-center gap-2">
                        <b className="text-sm text-white">{DOMAIN_INFO[d.domain].label}</b>
                        <span className="text-xs font-black text-violet-200">Need {d.difficulty}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-2 text-center">
                        <Metric label="Corporate" value={corporate} />
                        <Metric label="Best local" value={local} />
                        <Metric label="Best expert" value={expert} />
                      </div>
                      <div className={`mt-2 rounded-lg px-2 py-1.5 text-[10px] font-bold ${automated ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                        {automated ? <><Sparkles className="inline w-3 h-3 mr-1" />Automation embedded in this domain</> : 'No automation bonus in this domain'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={resolve} disabled={busy} className="mt-4 w-full rounded-xl bg-white text-slate-950 py-3.5 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                <Dices className="w-5 h-5" /> {busy ? 'RESOLVING…' : 'RESOLVE CLIMACTIC EVENT'}
              </button>
            </aside>
          </div>
        ) : (
          <div className="mt-4 min-h-0 flex-1 grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4">
            <section className="rounded-2xl border-2 border-emerald-600 bg-emerald-950/35 p-5">
              <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="w-6 h-6"/><span className="text-xs uppercase tracking-wider font-black">Climactic event resolved</span></div>
              <h3 className="text-2xl font-black text-white mt-3">{company.name}</h3>
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <div className="text-[10px] uppercase text-slate-500 font-black">Final turnover</div>
                <div className="text-3xl font-black text-emerald-300 mt-1">{formatCurrency(company.turnover)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Metric label="Surviving sites" value={company.sites.filter(s => !s.isClosed).length} />
                <Metric label="Intranet mean" value={intranetMean} />
              </div>
              <div className="mt-2"><Metric label="Automated domains" value={company.automatedDomains.length} /></div>
              <p className="text-xs text-slate-400 mt-4">The final result reflects the capability and resilience accumulated across all earlier rounds.</p>
            </section>

            <section className="rounded-2xl border border-slate-700 bg-slate-950 p-4 overflow-auto">
              <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-300"/><h3 className="text-sm font-black text-white">Final company comparison</h3></div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-500 uppercase text-[9px] tracking-wider">
                    <tr><th className="px-3 py-2">Company</th><th className="px-3 py-2">Final turnover</th><th className="px-3 py-2">Sites</th><th className="px-3 py-2">Intranet mean</th><th className="px-3 py-2">Automation</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {session.companies.map(comp => {
                      const values = Object.values(comp.intranet) as number[];
                      const mean = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '0.0';
                      return <tr key={comp.id} className={comp.id === company.id ? 'bg-indigo-950/25' : ''}><td className="px-3 py-3 font-black text-white">{comp.name}</td><td className="px-3 py-3 font-black text-emerald-300">{formatCurrency(comp.turnover)}</td><td className="px-3 py-3 text-slate-300">{comp.sites.filter(s => !s.isClosed).length}</td><td className="px-3 py-3 text-violet-300">{mean}</td><td className="px-3 py-3 text-slate-300">{comp.automatedDomains.length}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <button onClick={onOpenAAR} className="mt-4 w-full rounded-xl border border-indigo-500 bg-indigo-600 px-4 py-3.5 font-black text-white flex items-center justify-center gap-2"><BookOpen className="w-4 h-4"/>START AFTER ACTION REVIEW</button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-center">
    <div className="text-[8px] uppercase tracking-wide text-slate-500 font-black">{label}</div>
    <div className="text-xl font-black text-white mt-0.5">{value}</div>
  </div>
);
