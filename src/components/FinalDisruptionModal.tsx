import React from 'react';
import { GameSession, Company, DOMAIN_INFO } from '../types/game.ts';
import { formatCurrency } from '../utils/format.ts';
import {
  AlertTriangle,
  Flame,
  ShieldCheck,
  Building2,
  TrendingDown,
  TrendingUp,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  Dices
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface FinalDisruptionModalProps {
  session: GameSession;
  company: Company;
  onResolveFinalDisruption: () => void;
  onOpenAAR: () => void;
}

export const FinalDisruptionModal: React.FC<FinalDisruptionModalProps> = ({
  session,
  company,
  onResolveFinalDisruption,
  onOpenAAR,
}) => {
  const card = session.finalDisruptionCard;
  const isResolved = session.finalDisruptionResolved;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4 text-[#c9d1d9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-purple-400 font-bold shadow-inner">
            <Flame className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-950/80 border border-purple-700/60 text-purple-300 font-bold">
              ROUND 6 • CLIMAX GAME EVENT
            </span>
            <h2 className="text-sm font-bold text-white tracking-tight font-mono mt-0.5">
              THE FINAL DISRUPTION EVENT
            </h2>
          </div>
        </div>

        {isResolved ? (
          <button
            onClick={onOpenAAR}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>OPEN EXECUTIVE AAR DEBRIEF</span>
          </button>
        ) : (
          <button
            onClick={() => {
              onResolveFinalDisruption();
              confetti({ particleCount: 50, spread: 80, origin: { y: 0.6 } });
            }}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>RESOLVE FINAL DISRUPTION (ALL COMPANIES)</span>
          </button>
        )}
      </div>

      {/* Disruption Card Presentation */}
      {card && (
        <div className="p-3.5 bg-[#0d1117] border border-purple-700/60 rounded-lg space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold font-mono text-purple-400 uppercase tracking-wider">
                Systemic Macro Disruption
              </span>
              <span className="text-xs font-mono font-bold text-rose-400">
                Failure Impact: -{formatCurrency(card.impact || 500)} Turnover
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight font-mono mt-0.5">{card.title}</h3>
            <p className="text-xs text-[#8b949e] leading-relaxed mt-1">{card.description}</p>
          </div>

          {/* Required Domains */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {card.domains.map((d) => (
              <div key={d.domain} className="p-2.5 bg-[#161b22] rounded-lg border border-[#30363d] space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DOMAIN_INFO[d.domain].color }} />
                  <span className="text-xs font-semibold text-white">{DOMAIN_INFO[d.domain].label}</span>
                </div>
                <div className="text-[11px] text-[#8b949e] flex items-center justify-between">
                  <span>Required Difficulty:</span>
                  <strong className="text-indigo-300 font-mono">Level {d.difficulty}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Companies Outcome Comparison Table (if resolved) */}
      {isResolved && (
        <div className="space-y-2 pt-1">
          <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
            Comparative Final Performance & Resilience
          </h3>

          <div className="overflow-x-auto border border-[#30363d] rounded-lg bg-[#0d1117]">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e] text-[10px] uppercase bg-[#161b22]">
                  <th className="py-2 px-3">Company</th>
                  <th className="py-2 px-3">Final Turnover</th>
                  <th className="py-2 px-3">Surviving Sites</th>
                  <th className="py-2 px-3">Intranet Mean</th>
                  <th className="py-2 px-3">Automated Domains</th>
                  <th className="py-2 px-3 text-right">Disruption Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/60">
                {session.companies.map((comp) => {
                  const activeSites = comp.sites.filter((s) => !s.isClosed).length;
                  const intranetMean = (
                    (Object.values(comp.intranet) as number[]).reduce((a, b) => a + b, 0) / 5
                  ).toFixed(1);

                  return (
                    <tr key={comp.id} className="hover:bg-[#161b22] transition">
                      <td className="py-2 px-3 font-bold text-white">{comp.name}</td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-400">{formatCurrency(comp.turnover)}</td>
                      <td className="py-2 px-3 text-[#8b949e]">{activeSites}/6 Sites</td>
                      <td className="py-2 px-3 font-mono text-purple-300">Level {intranetMean}</td>
                      <td className="py-2 px-3 text-[#8b949e]">{comp.automatedDomains.length} Domains</td>
                      <td className="py-2 px-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 font-bold font-mono">
                          SURVIVED
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
