import React, { useState } from 'react';
import { Company, GameSession, KnowledgeDomain, DOMAIN_INFO } from '../types/game.ts';
import { formatCurrency } from '../utils/format.ts';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  GraduationCap,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ConsequencesModalProps {
  session: GameSession;
  company: Company;
  onApplyLearning: (eventInstanceId: string, domain: KnowledgeDomain, target: 'team' | 'expert', targetId?: string) => void;
  onNextPhase: () => void;
}

export const ConsequencesModal: React.FC<ConsequencesModalProps> = ({
  session,
  company,
  onApplyLearning,
  onNextPhase,
}) => {
  const companyEvents = session.activeEvents[company.id] || [];
  const successfulOpportunities = companyEvents.filter(
    (e) => e.isResolved && e.success && e.card.type === 'opportunity'
  );

  const [selectedLearningTarget, setSelectedLearningTarget] = useState<'team' | 'expert'>('team');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain>(
    successfulOpportunities[0]?.card.domains[0]?.domain || 'engineering'
  );
  const [selectedExpertId, setSelectedExpertId] = useState<string>(company.experts[0]?.id || '');

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm space-y-4 text-[#c9d1d9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight font-mono">PHASE 3: EVENT CONSEQUENCES & LEARNING</h2>
          <p className="text-[11px] text-[#8b949e] mt-0.5">Review turnover shifts and convert successful opportunities into capability.</p>
        </div>

        <button
          onClick={onNextPhase}
          className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
        >
          <span>PROCEED TO INVESTMENT</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Events Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {companyEvents.map((evt) => (
          <div
            key={evt.instanceId}
            className={`p-3 rounded-lg border ${
              evt.success
                ? 'bg-[#0d1117] border-emerald-800/60'
                : 'bg-[#0d1117] border-rose-800/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold font-mono mb-1">
              <span className="text-white">{evt.card.title}</span>
              <span className={evt.success ? 'text-emerald-400' : 'text-rose-400'}>
                {evt.success ? 'SUCCESS' : 'FAILURE'}
              </span>
            </div>

            <div className="text-[11px] text-[#8b949e] mb-2">
              {evt.card.type === 'problem'
                ? evt.success
                  ? 'Problem prevented. No turnover loss.'
                  : `Loss incurred: -${formatCurrency(evt.card.impact)} turnover.`
                : evt.success
                ? `Revenue captured: +${formatCurrency(evt.card.impact)} turnover.`
                : 'Opportunity missed. No turnover change.'}
            </div>

            <div className="flex flex-wrap gap-1">
              {evt.card.domains.map((d) => (
                <span
                  key={d.domain}
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${DOMAIN_INFO[d.domain].bgClass} ${DOMAIN_INFO[d.domain].borderClass}`}
                >
                  {DOMAIN_INFO[d.domain].label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Experiential Learning Section (if successful opportunity) */}
      {successfulOpportunities.length > 0 && (
        <div className="p-3.5 bg-[#0d1117] border border-indigo-500/40 rounded-lg space-y-2.5">
          <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>EXPERIENTIAL LEARNING AVAILABLE</span>
          </div>
          <p className="text-[11px] text-[#8b949e]">
            A successful opportunity generates actionable experience. Choose an involved knowledge domain to increase either site Team Capability or a participating Deep Expert (+1).
          </p>

          {successfulOpportunities.map((opp) => {
            if (opp.experientialLearningAwarded) {
              return (
                <div key={opp.instanceId} className="p-2 bg-[#161b22] rounded border border-[#30363d] text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Experiential learning claimed for "{opp.card.title}".</span>
                </div>
              );
            }

            return (
              <div key={opp.instanceId} className="p-3 bg-[#161b22] rounded-lg border border-[#30363d] space-y-2.5">
                <div className="font-semibold text-xs text-white font-mono">EVENT: {opp.card.title}</div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {/* Select Domain */}
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block mb-1">Domain to Increase:</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      {opp.card.domains.map((d) => (
                        <option key={d.domain} value={d.domain}>
                          {DOMAIN_INFO[d.domain].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Learning Target */}
                  <div>
                    <label className="text-[10px] text-[#8b949e] font-mono block mb-1">Target Recipient:</label>
                    <select
                      value={selectedLearningTarget}
                      onChange={(e) => setSelectedLearningTarget(e.target.value as any)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                    >
                      <option value="team">Site Team Capability (+1)</option>
                      <option value="expert">Participating Deep Expert (+1)</option>
                    </select>
                  </div>

                  {/* Expert Selector if Expert Target */}
                  {selectedLearningTarget === 'expert' ? (
                    <div>
                      <label className="text-[10px] text-[#8b949e] font-mono block mb-1">Expert:</label>
                      <select
                        value={selectedExpertId}
                        onChange={(e) => setSelectedExpertId(e.target.value)}
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
                      >
                        {company.experts
                          .filter((e) => !e.isVacant)
                          .map((exp) => (
                            <option key={exp.id} value={exp.id}>
                              {exp.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-end">
                      <span className="text-[10px] text-[#8b949e] font-mono">Awarded to {opp.targetSiteId ? company.sites.find((s) => s.id === opp.targetSiteId)?.name : 'All'} Team</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() =>
                    onApplyLearning(
                      opp.instanceId,
                      selectedDomain,
                      selectedLearningTarget,
                      selectedLearningTarget === 'expert' ? selectedExpertId : opp.targetSiteId
                    )
                  }
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold rounded transition shadow-xs"
                >
                  Claim +1 {DOMAIN_INFO[selectedDomain].label} Learning
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
