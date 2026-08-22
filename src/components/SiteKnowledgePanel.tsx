import React, { useState } from 'react';
import { Company, Site, KnowledgeDomain, DOMAIN_INFO, Expert } from '../types/game.ts';
import { calculateUsableIntranet } from '../engine/rules.ts';
import { formatCurrency } from '../utils/format.ts';
import { KnowledgeRelationshipViewer } from './KnowledgeRelationshipViewer.tsx';
import {
  HelpCircle,
  AlertTriangle,
  Info,
  BookOpen,
  Users,
  Building,
  CheckCircle,
  FlaskConical,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface SiteKnowledgePanelProps {
  company: Company;
  site?: Site | null;
  onPerformAction: (actionType: string, params: any) => void;
  onSelectExpert: (expert: Expert) => void;
}

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export const SiteKnowledgePanel: React.FC<SiteKnowledgePanelProps> = ({
  company,
  site,
  onPerformAction,
  onSelectExpert,
}) => {
  const [selectedDomainExplanation, setSelectedDomainExplanation] = useState<KnowledgeDomain | null>(null);

  if (!site) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-center text-[#8b949e] text-xs">
        Select an operating site to view site knowledge and operational capacity.
      </div>
    );
  }

  const residentExperts = company.experts.filter((e) => !e.isVacant && e.location === site.id);

  // Render score indicator blocks
  const renderScoreBlocks = (score: number, maxScore: number = 6, colorClass: string = 'bg-indigo-500') => {
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
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-sm">
      {/* Site Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] flex items-center justify-center text-indigo-400 font-bold font-mono text-sm shadow-inner">
            {site.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">{site.name} Operating Site</h2>
              {site.isRDSite && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 font-mono">
                  <FlaskConical className="w-2.5 h-2.5" />
                  <span>R&D Hub</span>
                </span>
              )}
              {site.isClosed && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 font-mono font-bold">
                  CLOSED
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8b949e]">
              Site Turnover: <strong className="text-emerald-400 font-mono">{formatCurrency(site.turnover)}</strong> • Resident Experts: <strong className="text-white font-mono">{residentExperts.length}</strong>
            </p>
          </div>
        </div>

        {/* Quick Diagnose Action */}
        <button
          onClick={() => onPerformAction('KNOWLEDGE_AUDIT', { siteId: site.id })}
          disabled={company.actionsRemaining <= 0 || site.isClosed}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-indigo-300 text-xs font-semibold border border-[#30363d] transition"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Audit Site Knowledge</span>
        </button>
      </div>


      {/* Domain Knowledge Matrix & Dual Bar Graphs */}
      <div className="mt-3">
        <KnowledgeRelationshipViewer
          company={company}
          site={site}
          highlightDomain={selectedDomainExplanation || undefined}
        />
      </div>

      {/* Interactive Absorptive Capacity Explanation Drawer */}
      {selectedDomainExplanation && (
        <div className="mt-3 p-3 bg-[#0d1117] border border-indigo-500/40 rounded-lg text-xs text-[#c9d1d9] space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-indigo-400 font-bold">
            <span className="flex items-center gap-1.5 text-xs font-mono">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Absorptive Capacity Analysis: {DOMAIN_INFO[selectedDomainExplanation].label}
            </span>
            <button
              onClick={() => setSelectedDomainExplanation(null)}
              className="text-[#8b949e] hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-[#8b949e]">
            Corporate Intranet holds Level <strong className="text-white">{company.intranet[selectedDomainExplanation]}</strong> {DOMAIN_INFO[selectedDomainExplanation].label} knowledge.
            However, this site's Team Capability is Level <strong className="text-white">{site.teamCapability[selectedDomainExplanation]}</strong>, granting an absorptive ceiling of{' '}
            <strong className="text-white">{site.teamCapability[selectedDomainExplanation] + 2}</strong> (Team + 2 bonus).
          </p>
          <div className="bg-[#161b22] p-2 rounded border border-[#30363d] text-[10px] text-[#8b949e]">
            <strong className="text-[#c9d1d9]">Key Learning Principle:</strong> Access to knowledge is not the same as ability to use knowledge. Investing in local Team Capability unlocks higher corporate intranet absorption!
          </div>
        </div>
      )}

      {/* Resident Experts Section */}
      <div className="mt-4 pt-3 border-t border-[#30363d]">
        <h3 className="text-[11px] font-bold text-[#8b949e] uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Resident Deep Experts at {site.name}</span>
          <span className="text-[#8b949e] font-mono text-[10px]">{residentExperts.length} stationed</span>
        </h3>

        {residentExperts.length === 0 ? (
          <div className="p-2.5 bg-[#0d1117] rounded-lg border border-[#30363d] text-center text-xs text-[#8b949e]">
            No Deep Experts currently stationed at {site.name}. Experts at other sites or Corporate HQ must travel to support local events.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {residentExperts.map((expert) => (
              <div
                key={expert.id}
                onClick={() => onSelectExpert(expert)}
                className={`p-2.5 rounded-lg border cursor-pointer transition ${
                  expert.isSPOF
                    ? 'bg-amber-950/30 border-amber-800/70 hover:bg-amber-950/50'
                    : 'bg-[#0d1117] border-[#30363d] hover:bg-[#21262d]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white">{expert.name}</span>
                  {expert.isSPOF && (
                    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-700 text-amber-300 font-mono font-bold">
                      <ShieldAlert className="w-2.5 h-2.5" />
                      <span>SPOF</span>
                    </span>
                  )}
                </div>

                {/* Domains */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {expert.domains.map((d) => (
                    <span
                      key={d.domain}
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${DOMAIN_INFO[d.domain].bgClass} ${DOMAIN_INFO[d.domain].borderClass}`}
                    >
                      {DOMAIN_INFO[d.domain].label} Level {d.score}
                    </span>
                  ))}
                </div>

                <div className="text-[10px] text-[#8b949e] mt-1.5 flex items-center justify-between font-mono">
                  <span>Status: <strong className="text-[#c9d1d9]">{expert.state}</strong></span>
                  <span className="text-indigo-400 flex items-center gap-0.5 font-sans">Manage <ArrowRight className="w-2.5 h-2.5" /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
