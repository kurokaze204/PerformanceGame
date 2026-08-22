import React from 'react';
import { Company, KnowledgeDomain, DOMAIN_INFO, Expert, GameSession } from '../types/game.ts';
import {
  Building2,
  Cpu,
  Radio,
  Users,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Info
} from 'lucide-react';

interface CorporateHQPanelProps {
  session: GameSession;
  company: Company;
  onPerformAction: (actionType: string, params: any) => void;
  onSelectExpert: (expert: Expert) => void;
  onOpenCoP: () => void;
}

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export const CorporateHQPanel: React.FC<CorporateHQPanelProps> = ({
  session,
  company,
  onPerformAction,
  onSelectExpert,
  onOpenCoP,
}) => {
  const hqExperts = company.experts.filter((e) => !e.isVacant && e.location === 'HQ');

  const renderScoreBlocks = (score: number, maxScore: number = 6, colorClass: string = 'bg-purple-500') => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: maxScore }).map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2.5 rounded-xs ${
              i < score ? colorClass : 'bg-[#0d1117] border border-[#30363d]'
            }`}
          />
        ))}
        <span className="text-xs font-mono font-bold ml-1.5 text-[#c9d1d9]">{score}</span>
      </div>
    );
  };

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4">
      {/* HQ Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] flex items-center justify-center text-indigo-400 font-bold shadow-inner">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight font-mono">CORPORATE HEADQUARTERS</h2>
            <p className="text-[11px] text-[#8b949e]">Enterprise Repositories, Systems & Global Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8b949e] font-mono">ACTIONS:</span>
          <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-700/60 text-indigo-300 text-xs font-bold font-mono">
            {company.actionsRemaining}/4 REMAINING
          </span>
        </div>
      </div>

      {/* Corporate Intranet Matrix */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
            Corporate Intranet Repository
          </h3>
          <span className="text-[10px] text-[#8b949e] font-mono">MAX +2 GROWTH PER DOMAIN / ROUND</span>
        </div>

        <div className="bg-[#0d1117] rounded-lg border border-[#30363d] divide-y divide-[#30363d]">
          {DOMAINS.map((domain) => {
            const score = company.intranet[domain] || 0;
            const roundGrowth = company.intranetRoundGrowth[domain] || 0;
            const hasHQExpert = hqExperts.some((e) => e.domains.some((d) => d.domain === domain));
            const isAutomated = company.automatedDomains.includes(domain);

            return (
              <div key={domain} className="p-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-[130px]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DOMAIN_INFO[domain].color }} />
                  <span className="text-xs font-semibold text-[#c9d1d9]">{DOMAIN_INFO[domain].label}</span>
                </div>

                <div className="flex items-center gap-3">
                  {renderScoreBlocks(score, 6, 'bg-purple-500')}

                  {roundGrowth > 0 && (
                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-700/60 text-purple-300">
                      +{roundGrowth} this round
                    </span>
                  )}

                  {isAutomated && (
                    <span className="flex items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
                      <Cpu className="w-2.5 h-2.5" />
                      <span>Automated (+2)</span>
                    </span>
                  )}
                </div>

                {/* Quick Intranet Update Action */}
                <button
                  onClick={() => onPerformAction('UPDATE_INTRANET', { domain })}
                  disabled={company.actionsRemaining <= 0 || roundGrowth >= 2}
                  className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 text-xs font-mono font-medium text-purple-300 border border-[#30363d] transition shadow-xs"
                  title="Update Corporate Intranet"
                >
                  Update {hasHQExpert ? '(+2 HQ)' : '(+1)'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* HQ Experts & HQ Trade-off Box */}
      <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs font-mono">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Deep Experts Stationed at Headquarters ({hqExperts.length})</span>
          </div>
          <span className="text-[9px] text-[#8b949e] font-mono uppercase">Corporate Multiplier Hub</span>
        </div>

        {hqExperts.length === 0 ? (
          <p className="text-xs text-[#8b949e]">
            No experts currently stationed at HQ. Move an expert to HQ to accelerate Corporate Intranet codification (+2 per update instead of +1) and support Enterprise-wide events directly!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hqExperts.map((exp) => (
              <div
                key={exp.id}
                onClick={() => onSelectExpert(exp)}
                className="p-2 bg-[#161b22] border border-[#30363d] rounded-lg cursor-pointer hover:border-indigo-500/80 transition"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span>{exp.name}</span>
                  <span className="text-[9px] text-indigo-400 font-mono">HQ STATIONED</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {exp.domains.map((d) => (
                    <span key={d.domain} className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                      {DOMAIN_INFO[d.domain].label} {d.score}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] text-[#8b949e] bg-[#161b22] p-2 rounded border border-[#30363d] space-y-1">
          <div className="font-semibold text-[#c9d1d9] flex items-center gap-1 font-mono">
            <Info className="w-3 h-3 text-indigo-400" />
            Headquarters Strategic Trade-Off:
          </div>
          <p>
            <strong>Benefit:</strong> HQ experts provide enterprise reach, boost corporate codification to +2, and support company-wide Enterprise Events.
          </p>
          <p>
            <strong>Cost:</strong> HQ experts cannot perform local Knowledge Transfer at operating sites without paying 1d6 travel turnover and do not absorb local experiential learning.
          </p>
        </div>
      </div>

      {/* Relational & Anticipatory Knowledge: Communities of Practice & Horizon Scanning */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Communities of Practice Box */}
        <div
          onClick={onOpenCoP}
          className="p-3 bg-[#0d1117] border border-[#30363d] hover:border-amber-500/50 rounded-lg cursor-pointer transition shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-300 mb-1 font-mono">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              Communities of Practice
            </span>
            <ArrowRight className="w-3 h-3" />
          </div>
          <p className="text-[11px] text-[#8b949e]">
            {session.copMemberships.filter((m) => m.companyId === company.id).length} Active Assignments.
            Connect with peer companies for external +2 expert assistance.
          </p>
        </div>

        {/* Horizon Scanning Box */}
        <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-lg shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-300 mb-1 font-mono">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              Horizon Scanning Radar
            </span>
          </div>
          <p className="text-[11px] text-[#8b949e]">
            {company.horizonScanDomain ? (
              <span className="text-amber-300">
                Active in <strong>{DOMAIN_INFO[company.horizonScanDomain].label}</strong>. Can redraw 1 matching event next round.
              </span>
            ) : (
              <span>No domain actively scanned. Spend 1 action to scout risks.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
