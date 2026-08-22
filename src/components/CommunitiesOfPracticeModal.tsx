import React, { useState } from 'react';
import { GameSession, Company, KnowledgeDomain, DOMAIN_INFO, Expert } from '../types/game.ts';
import {
  Users,
  MessageSquare,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface CommunitiesOfPracticeModalProps {
  session: GameSession;
  company: Company;
  onClose: () => void;
  onPerformAction: (actionType: string, params: any) => void;
}

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export const CommunitiesOfPracticeModal: React.FC<CommunitiesOfPracticeModalProps> = ({
  session,
  company,
  onClose,
  onPerformAction,
}) => {
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain>('operations');
  const [selectedExpertId, setSelectedExpertId] = useState<string>(
    company.experts.filter((e) => !e.isVacant)[0]?.id || ''
  );

  const availableExperts = company.experts.filter((e) => !e.isVacant);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10]/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-3xl w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-[#c9d1d9]">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight font-mono">COMMUNITIES OF PRACTICE (CoP)</h3>
              <p className="text-[11px] text-[#8b949e]">Inter-Organisational Relational Knowledge Exchange</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition border border-[#30363d] text-xs font-mono"
          >
            ✕
          </button>
        </div>

        {/* Verbal Negotiation Reminder Box */}
        <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-2.5">
          <MessageSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="font-mono">CROSS-COMPANY NEGOTIATION:</strong> A Community of Practice becomes <strong>ACTIVE</strong> when at least <strong>two companies</strong> maintain participating Deep Experts in the same domain.
          </div>
        </div>

        {/* 5 Domains CoP Matrix */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
            Industry Communities of Practice Status
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DOMAINS.map((domain) => {
              const dInfo = DOMAIN_INFO[domain];
              const memberships = session.copMemberships.filter((m) => m.domain === domain);
              const participatingCompanies = new Set(memberships.map((m) => m.companyId));
              const isActive = participatingCompanies.size >= 2;

              return (
                <div
                  key={domain}
                  className={`p-3 rounded-lg border transition ${
                    isActive
                      ? 'bg-[#0d1117] border-emerald-500/50'
                      : 'bg-[#0d1117] border-[#30363d]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dInfo.color }} />
                      <span className="text-xs font-semibold text-white">{dInfo.label} CoP</span>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isActive
                          ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300'
                          : 'bg-[#161b22] border border-[#30363d] text-[#8b949e]'
                      }`}
                    >
                      {isActive ? 'ACTIVE (+2 SUPPORT)' : 'INACTIVE (<2)'}
                    </span>
                  </div>

                  {/* Participating Companies list */}
                  <div className="mt-2 text-[10px] text-[#8b949e] space-y-1 font-mono">
                    <div>
                      Participating ({participatingCompanies.size}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {memberships.length === 0 ? (
                        <span className="text-[#8b949e] italic font-sans">No members assigned</span>
                      ) : (
                        memberships.map((m, idx) => {
                          const comp = session.companies.find((c) => c.id === m.companyId);
                          const exp = comp?.experts.find((e) => e.id === m.expertId);
                          return (
                            <span
                              key={idx}
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                m.companyId === company.id
                                  ? 'bg-indigo-950 border-indigo-700 text-indigo-300 font-bold'
                                  : 'bg-[#161b22] border-[#30363d] text-[#c9d1d9]'
                              }`}
                            >
                              {comp?.name || 'Partner'} ({exp?.name.split(' ')[0] || 'Expert'})
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Join or Assign CoP Form */}
        <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] space-y-2.5">
          <h4 className="text-[11px] font-bold font-mono text-white">ASSIGN EXPERT TO COMMUNITY OF PRACTICE (FEE $10k-$60k)</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-[#8b949e] font-mono block mb-1">Select Domain:</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value as KnowledgeDomain)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_INFO[d].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-[#8b949e] font-mono block mb-1">Select Expert:</label>
              <select
                value={selectedExpertId}
                onChange={(e) => setSelectedExpertId(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-xs text-[#c9d1d9] font-mono"
              >
                {availableExperts.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                onPerformAction('JOIN_COP', {
                  expertId: selectedExpertId,
                  domain: selectedDomain,
                });
                onClose();
              }}
              disabled={company.actionsRemaining <= 0 || company.turnover < 60}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-mono font-semibold rounded-lg transition shadow-xs"
            >
              Enroll in {DOMAIN_INFO[selectedDomain].label} CoP (1 Act + $10k-$60k Fee)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
