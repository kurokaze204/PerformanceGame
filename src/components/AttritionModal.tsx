import React from 'react';
import { Company, GameSession, DOMAIN_INFO } from '../types/game.ts';
import {
  ShieldAlert,
  UserX,
  Users,
  AlertTriangle,
  Building2,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface AttritionModalProps {
  session: GameSession;
  company: Company;
  phaseResult: any;
  onAdvanceToNextRound: () => void;
}

export const AttritionModal: React.FC<AttritionModalProps> = ({
  session,
  company,
  phaseResult,
  onAdvanceToNextRound,
}) => {
  const summary = phaseResult?.attritionSummaries?.[company.id] || {
    departedExperts: [],
    workforceAttrition: [],
    closedSites: [],
  };

  const hasDepartures = summary.departedExperts.length > 0;
  const hasWorkforceLoss = summary.workforceAttrition.length > 0;
  const hasClosedSites = summary.closedSites.length > 0;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4 text-[#c9d1d9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight font-mono">PHASE 5: KNOWLEDGE RISK & ATTRITION REVIEW</h2>
          <p className="text-[11px] text-[#8b949e] mt-0.5">Resolving end-of-round expert departures, workforce turnover, and site solvency.</p>
        </div>

        <button
          onClick={onAdvanceToNextRound}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
        >
          <span>{session.round >= session.config.rounds ? 'FACE FINAL DISRUPTION' : `BEGIN ROUND ${session.round}`}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Expert Departures Review */}
      <div className="space-y-2.5">
        <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono flex items-center gap-1.5">
          <UserX className="w-3.5 h-3.5 text-rose-400" />
          <span>Deep Expert Attrition Checks (d12: Normal ≤ 1, SPOF ≤ 2)</span>
        </h3>

        {hasDepartures ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {summary.departedExperts.map((exp: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-[#0d1117] border border-rose-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-rose-300">{exp.expertName} Resigned!</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-300">
                    ROLL: {exp.roll}
                  </span>
                </div>
                <p className="text-xs text-[#8b949e]">
                  {exp.wasSPOF
                    ? '⚠ Single Point of Failure: High workload and market poaching triggered departure.'
                    : 'Standard career transition / relocation.'}
                </p>
                <div className="p-2 bg-[#161b22] rounded border border-[#30363d] text-[10px] text-[#8b949e]">
                  <strong className="text-[#c9d1d9]">Impact:</strong> Uncodified expertise lost. Role becomes VACANT until replacement arrives next round at baseline score 4.
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-[#0d1117] border border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs">All Deep Experts retained this round! Zero attrition.</span>
          </div>
        )}
      </div>

      {/* 2. Workforce Attrition Review */}
      <div className="space-y-2.5">
        <h3 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>General Workforce Turnover Shifts</span>
        </h3>

        {hasWorkforceLoss ? (
          <div className="space-y-1.5">
            {summary.workforceAttrition.map((w: any, idx: number) => (
              <div key={idx} className="p-2.5 bg-[#0d1117] rounded-lg border border-[#30363d] flex items-center justify-between text-xs">
                <span>
                  <strong className="text-white font-mono">{w.siteName} Site:</strong> Routine staff departure in {DOMAIN_INFO[w.domain as any]?.label || w.domain} reduced Team Capability.
                </span>
                <span className="font-mono text-amber-300 font-bold text-xs">
                  {w.previousScore} → {w.newScore}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 bg-[#0d1117] rounded-lg border border-[#30363d] text-xs text-[#8b949e] font-mono">
            Local site workforce capability remained stable across all operating branches.
          </div>
        )}
      </div>

      {/* 3. Site Solvency & Closures */}
      {hasClosedSites && (
        <div className="p-3 bg-rose-950/40 border border-rose-600 rounded-lg space-y-1.5 text-xs text-rose-200">
          <div className="flex items-center gap-1.5 font-bold text-rose-300 text-xs font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>SITE INSOLVENCY NOTICE</span>
          </div>
          <p className="text-[11px]">
            The following sites dropped to ≤ $0k turnover and were forced to close: <strong>{summary.closedSites.join(', ')}</strong>.
            Local team capability was lost, but all knowledge previously transferred to Corporate Intranet survived!
          </p>
        </div>
      )}
    </div>
  );
};
