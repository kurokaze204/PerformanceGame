import React, { useState } from 'react';
import { Expert, Company, DOMAIN_INFO, KnowledgeDomain, SimulationConfig } from '../types/game.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import {
  UserCheck,
  ShieldAlert,
  MapPin,
  Building2,
  GraduationCap,
  BookOpen,
  ArrowRightLeft,
  Users,
  AlertTriangle,
  Zap,
  Info
} from 'lucide-react';

interface ExpertModalProps {
  expert: Expert;
  company: Company;
  config?: SimulationConfig;
  onClose: () => void;
  onPerformAction: (actionType: string, params: any) => void;
}

export const ExpertModal: React.FC<ExpertModalProps> = ({
  expert,
  company,
  config = DEFAULT_CONFIG,
  onClose,
  onPerformAction,
}) => {
  const [selectedRelocationTarget, setSelectedRelocationTarget] = useState<string>('HQ');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain>(expert.domains[0]?.domain || 'engineering');

  const currentLocationName =
    expert.location === 'HQ'
      ? 'Corporate Headquarters'
      : company.sites.find((s) => s.id === expert.location)?.name || expert.location;

  const isAtOperatingSite = expert.location !== 'HQ';
  const site = isAtOperatingSite ? company.sites.find((s) => s.id === expert.location) : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10]/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-[#c9d1d9]">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-white font-mono font-bold text-lg shadow-xs">
              {expert.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight font-mono">{expert.name}</h3>
                {expert.isSPOF && (
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 font-bold animate-pulse">
                    <ShieldAlert className="w-3 h-3 text-amber-400" />
                    <span>SPOF_RISK</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#8b949e] font-mono mt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-400" />
                  {currentLocationName}
                </span>
                <span>•</span>
                <span>STATUS: <strong className="text-indigo-300">{expert.state.toUpperCase()}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition border border-[#30363d] text-xs font-mono"
          >
            ✕
          </button>
        </div>

        {/* Domain Proficiencies */}
        <div>
          <h4 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono mb-1.5">
            Domain Expertise Proficiencies
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {expert.domains.map((d) => {
              const dInfo = DOMAIN_INFO[d.domain];
              const isSpofInDomain = expert.spofDomains.includes(d.domain);
              return (
                <div
                  key={d.domain}
                  onClick={() => setSelectedDomain(d.domain)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    selectedDomain === d.domain
                      ? 'bg-[#21262d] border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-[#0d1117] border-[#30363d] hover:border-[#484f58]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dInfo.color }} />
                    <span className="text-xs font-semibold text-white">{dInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-mono text-indigo-300">Level {d.score}</span>
                    {isSpofInDomain && (
                      <span title="SPOF Gap >= 3" className="text-amber-400">⚠</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SPOF Diagnostic Explanation Box */}
        {expert.isSPOF && (
          <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-[11px] text-amber-200/90 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Single Point of Failure (SPOF) Risk
            </div>
            <p>
              {expert.name}'s expertise exceeds the surrounding site's capability by ≥{config.spof_gap} levels.
              If {expert.name} departs (attrition check d12 ≤ 2), this uncodified knowledge will vanish!
            </p>
          </div>
        )}

        {/* Action Controls for Expert */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider font-mono">
            Deploy Expert Knowledge Actions (1 Action)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Knowledge Transfer to local team */}
            <button
              onClick={() => {
                onPerformAction('KNOWLEDGE_TRANSFER', {
                  siteId: expert.location,
                  expertId: expert.id,
                  domain: selectedDomain,
                });
                onClose();
              }}
              disabled={company.actionsRemaining <= 0 || !isAtOperatingSite || expert.state !== 'Available'}
              className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-40 text-left border border-[#30363d] transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-indigo-300">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Knowledge Transfer</span>
              </div>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                Increase {site?.name} Team Capability +1 in {DOMAIN_INFO[selectedDomain].label}.
              </p>
            </button>

            {/* Train Expert */}
            <button
              onClick={() => {
                onPerformAction('TRAIN_EXPERT', {
                  expertId: expert.id,
                  domain: selectedDomain,
                });
                onClose();
              }}
              disabled={company.actionsRemaining <= 0 || company.turnover < 120}
              className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-40 text-left border border-[#30363d] transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-blue-300">
                <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                <span>Train Expert ($20k-$120k)</span>
              </div>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                Advance {expert.name}'s {DOMAIN_INFO[selectedDomain].label} score +1.
              </p>
            </button>

            {/* Codify Local Expert Knowledge */}
            <button
              onClick={() => {
                onPerformAction('CODIFY_EXPERT', {
                  siteId: expert.location,
                  expertId: expert.id,
                  domain: selectedDomain,
                });
                onClose();
              }}
              disabled={company.actionsRemaining <= 0 || !isAtOperatingSite}
              className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-40 text-left border border-[#30363d] transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-sky-300">
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                <span>Local Codification</span>
              </div>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                Document standard procedures locally (+1 Local Codified).
              </p>
            </button>

            {/* Expertise Capture into Intranet */}
            <button
              onClick={() => {
                onPerformAction('EXPERTISE_CAPTURE', {
                  expertId: expert.id,
                  domain: selectedDomain,
                });
                onClose();
              }}
              disabled={company.actionsRemaining <= 0 || company.turnover < 60}
              className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] disabled:opacity-40 text-left border border-[#30363d] transition"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-purple-300">
                <Zap className="w-3.5 h-3.5 text-purple-400" />
                <span>Expertise Capture ($10k-$60k)</span>
              </div>
              <p className="text-[10px] text-[#8b949e] mt-0.5">
                Capture deep insights directly into Corporate Intranet (+2).
              </p>
            </button>
          </div>
        </div>

        {/* Permanent Relocation */}
        <div className="pt-3 border-t border-[#30363d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e] font-mono">Relocate to:</span>
            <select
              value={selectedRelocationTarget}
              onChange={(e) => setSelectedRelocationTarget(e.target.value)}
              className="bg-[#0d1117] text-xs text-[#c9d1d9] font-mono border border-[#30363d] rounded px-2 py-1 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="HQ">Corporate Headquarters</option>
              {company.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} Site
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              onPerformAction('MOVE_EXPERT', {
                expertId: expert.id,
                targetLocation: selectedRelocationTarget,
              });
              onClose();
            }}
            disabled={company.actionsRemaining <= 0 || expert.location === selectedRelocationTarget}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-mono font-semibold shadow-xs transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>RELOCATE (1 ACTION)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
