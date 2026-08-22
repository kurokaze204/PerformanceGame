import React, { useState } from 'react';
import { Company, Site, KnowledgeDomain, DOMAIN_INFO } from '../types/game.ts';
import { calculateUsableIntranet } from '../engine/rules.ts';
import {
  Users,
  BookOpen,
  Building2,
  AlertTriangle,
  Info,
  HelpCircle,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

interface KnowledgeRelationshipViewerProps {
  company: Company;
  site: Site;
  highlightDomain?: KnowledgeDomain;
}

const DOMAINS: KnowledgeDomain[] = ['engineering', 'hr', 'marketing', 'operations', 'finance'];

export const KnowledgeRelationshipViewer: React.FC<KnowledgeRelationshipViewerProps> = ({
  company,
  site,
  highlightDomain,
}) => {
  const [activeDomain, setActiveDomain] = useState<KnowledgeDomain>(highlightDomain || 'engineering');

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3.5 space-y-3 font-sans">
      {/* Header with Visual Key */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Knowledge Architecture at {site.name}
          </h4>
        </div>

        {/* Visual Bar Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#8b949e]">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-indigo-500" />
            <span>Team Cap</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-sky-500" />
            <span>Codified</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-purple-500" />
            <span>Intranet</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-amber-400" />
            <span>Cutoff Ceiling</span>
          </div>
        </div>
      </div>

      {/* Domain Comparative Stacked Bars */}
      <div className="space-y-3">
        {DOMAINS.map((domain) => {
          const dInfo = DOMAIN_INFO[domain];
          const team = site.teamCapability[domain] || 0;
          const localCodified = site.codifiedKnowledge[domain] || 0;
          const intranet = company.intranet[domain] || 0;
          const { usable, maxPotential, bottleneck } = calculateUsableIntranet(company, site, domain);
          const effectiveLocalPower = Math.max(team, localCodified, usable);

          // Scaled to max possible score 6
          const teamPct = Math.min((team / 6) * 100, 100);
          const localPct = Math.min((localCodified / 6) * 100, 100);
          const intranetPct = Math.min((intranet / 6) * 100, 100);
          const cutoffPct = Math.min((maxPotential / 6) * 100, 100);

          const isSelected = activeDomain === domain;

          return (
            <div
              key={domain}
              onClick={() => setActiveDomain(domain)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#161b22] border-indigo-500 ring-1 ring-indigo-500/50 shadow-xs'
                  : 'bg-[#12161f] border-[#30363d]/80 hover:border-[#484f58]'
              }`}
            >
              {/* Domain Title & Numeric Values */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dInfo.color }} />
                  <span className="font-bold text-white text-xs">{dInfo.label}</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-indigo-400">Team: <strong>{team}</strong></span>
                  <span className="text-[#30363d]">•</span>
                  <span className="text-sky-400">Docs: <strong>{localCodified}</strong></span>
                  <span className="text-[#30363d]">•</span>
                  <span className="text-purple-400">Intranet: <strong>{intranet}</strong></span>
                  <span className="text-[#30363d]">➔</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold">
                    Usable: {effectiveLocalPower}
                  </span>
                </div>
              </div>

              {/* Graphical Comparative Dual Track & Cutoff Bar */}
              <div className="space-y-1">
                {/* Track 1: Local Team Capability & Local Codified (Side by Side Comparison) */}
                <div className="relative h-3 bg-[#0d1117] rounded-sm overflow-hidden flex items-center">
                  {/* Team Capability Bar */}
                  <div
                    style={{ width: `${teamPct}%` }}
                    className="h-full bg-indigo-500 rounded-l-xs transition-all duration-300 relative group"
                    title={`Team Capability: Level ${team}`}
                  />
                  {/* Codified overlay segment */}
                  <div
                    style={{ width: `${Math.max(localPct - teamPct, 0)}%` }}
                    className="h-full bg-sky-500 transition-all duration-300"
                    title={`Local Codified Knowledge: Level ${localCodified}`}
                  />
                </div>

                {/* Track 2: Corporate Intranet & Absorptive Capacity Cutoff */}
                <div className="relative h-3 bg-[#0d1117] rounded-sm overflow-hidden flex items-center">
                  {/* Corporate Intranet Bar */}
                  <div
                    style={{ width: `${intranetPct}%` }}
                    className={`h-full transition-all duration-300 ${bottleneck ? 'bg-purple-600/70' : 'bg-purple-500'}`}
                    title={`Corporate Intranet: Level ${intranet}`}
                  />

                  {/* Cutoff Vertical Line indicating Absorptive Capacity Ceiling */}
                  <div
                    style={{ left: `${cutoffPct}%` }}
                    className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-xs shadow-amber-400 z-10"
                    title={`Absorptive Capacity Limit: Level ${maxPotential} (Team + 2)`}
                  />
                </div>
              </div>

              {/* Bottleneck Warning Note if Intranet is Capped */}
              {bottleneck && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-amber-300 font-mono">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    Absorptive Bottleneck: Intranet has Level {intranet}, but local team can only absorb up to Level {maxPotential}.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Domain Math Explainer Card */}
      {activeDomain && (
        <div className="p-3 bg-[#161b22] border border-indigo-500/40 rounded-lg text-xs text-[#c9d1d9] space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-300 font-bold font-mono text-[11px]">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>HOW THE MATH WORKS FOR {DOMAIN_INFO[activeDomain].label.toUpperCase()}</span>
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed">
            Local operating power = <strong>max(Team, Codified, Usable Intranet)</strong>.
            Because Team is Level <strong className="text-white">{site.teamCapability[activeDomain]}</strong>, the site can utilize up to Level <strong className="text-white">{site.teamCapability[activeDomain] + 2}</strong> from the Corporate Intranet (Level {company.intranet[activeDomain]}).
          </p>
        </div>
      )}
    </div>
  );
};
