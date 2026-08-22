import React from 'react';
import { Company, Site, KnowledgeDomain, DOMAIN_INFO, SimulationConfig } from '../types/game.ts';
import { DEFAULT_CONFIG } from '../engine/config.ts';
import {
  Info,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Building,
  Users,
  BookOpen
} from 'lucide-react';

interface KnowledgeAuditModalProps {
  company: Company;
  siteId: string;
  config?: SimulationConfig;
  onClose: () => void;
}

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export const KnowledgeAuditModal: React.FC<KnowledgeAuditModalProps> = ({
  company,
  siteId,
  config = DEFAULT_CONFIG,
  onClose,
}) => {
  const site = company.sites.find((s) => s.id === siteId);
  if (!site) return null;

  // Find weakest capability domain
  let weakestDomain: KnowledgeDomain = 'engineering';
  let weakestScore = 99;
  for (const d of DOMAINS) {
    if ((site.teamCapability[d] || 0) < weakestScore) {
      weakestScore = site.teamCapability[d] || 0;
      weakestDomain = d;
    }
  }

  // Find uncodified domains (where team > codified)
  const uncodifiedDomains = DOMAINS.filter(
    (d) => (site.teamCapability[d] || 0) > (site.codifiedKnowledge[d] || 0)
  );

  // Find absorptive bottlenecks (where intranet > team + 2)
  const absorptiveBottlenecks = DOMAINS.filter(
    (d) => (company.intranet[d] || 0) > (site.teamCapability[d] || 0) + config.absorptive_capacity_bonus
  );

  // Resident experts with SPOF gap
  const residentExperts = company.experts.filter((e) => !e.isVacant && e.location === site.id);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0c10]/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-[#c9d1d9]">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-purple-400 font-bold shadow-inner">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight font-mono">
                KNOWLEDGE AUDIT: {site.name.toUpperCase()} SITE
              </h3>
              <p className="text-[11px] text-[#8b949e]">Forensic Diagnostic Risk & Absorptive Assessment</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white flex items-center justify-center transition border border-[#30363d] text-xs font-mono"
          >
            ✕
          </button>
        </div>

        {/* Audit Findings */}
        <div className="space-y-2 text-xs">
          {/* Weakest capability */}
          <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-mono">WEAKEST LOCAL CAPABILITY:</strong>{' '}
              <span className="text-amber-300 font-mono font-bold">
                {DOMAIN_INFO[weakestDomain].label} (Level {weakestScore})
              </span>
              <p className="text-[#8b949e] text-[11px] mt-0.5">
                Low team capability prevents this site from handling operational shocks in {DOMAIN_INFO[weakestDomain].label}.
              </p>
            </div>
          </div>

          {/* Absorptive Bottlenecks */}
          <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] flex items-start gap-2.5">
            <Building className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-mono">ABSORPTIVE CAPACITY BOTTLENECKS:</strong>{' '}
              {absorptiveBottlenecks.length === 0 ? (
                <span className="text-emerald-400 font-mono text-[11px]">None. Site absorbs all intranet knowledge fully.</span>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1">
                  {absorptiveBottlenecks.map((d) => (
                    <span key={d} className="px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/80 text-purple-300 font-mono text-[10px]">
                      {DOMAIN_INFO[d].label} (Intranet: {company.intranet[d]} vs Max: {site.teamCapability[d] + config.absorptive_capacity_bonus})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Uncodified Vulnerabilities */}
          <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-mono">UNCODIFIED PROCESS VULNERABILITIES:</strong>{' '}
              {uncodifiedDomains.length === 0 ? (
                <span className="text-emerald-400 font-mono text-[11px]">All local processes codified.</span>
              ) : (
                <div className="flex flex-wrap gap-1 mt-1">
                  {uncodifiedDomains.map((d) => (
                    <span key={d} className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-800/80 text-sky-300 font-mono text-[10px]">
                      {DOMAIN_INFO[d].label} (Team: {site.teamCapability[d]} &gt; Codified: {site.codifiedKnowledge[d]})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SPOF Expert Exposures */}
          <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white font-mono">DEEP EXPERT SPOF EXPOSURE:</strong>{' '}
              {residentExperts.filter((e) => e.isSPOF).length === 0 ? (
                <span className="text-emerald-400 font-mono text-[11px]">No resident SPOF risks detected.</span>
              ) : (
                <div className="space-y-1 mt-1 text-[11px] text-amber-200">
                  {residentExperts
                    .filter((e) => e.isSPOF)
                    .map((exp) => (
                      <div key={exp.id}>
                        • <strong>{exp.name}</strong> is a SPOF in{' '}
                        {exp.spofDomains.map((d) => DOMAIN_INFO[d].label).join(', ')}. If over-assigned or poached, capability is lost!
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold rounded-lg transition shadow-xs"
          >
            CLOSE AUDIT REPORT
          </button>
        </div>
      </div>
    </div>
  );
};
