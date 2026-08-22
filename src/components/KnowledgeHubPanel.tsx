import React from 'react';
import { Building2 } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { CompanyV2 } from '../types/gameV2.ts';

interface KnowledgeHubPanelProps {
  company: CompanyV2;
}

export const KnowledgeHubPanel: React.FC<KnowledgeHubPanelProps> = ({ company }) => {
  const domains = Object.keys(DOMAIN_INFO) as KnowledgeDomain[];

  return (
    <aside className="rounded-3xl border border-indigo-700/60 bg-slate-900/80 p-4 shadow-xl shadow-indigo-950/20">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/60 grid place-items-center">
          <Building2 className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-indigo-400 font-black">Corporate Intranet</div>
          <div className="text-xl font-black text-white mt-0.5">{company.name} Knowledge Hub</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {domains.map((domain) => {
          const info = DOMAIN_INFO[domain];
          return (
            <div key={domain} className="rounded-xl bg-slate-950/85 border border-slate-800 px-3 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                <span className="font-bold text-white truncate">{info.label}</span>
              </div>
              <span className="text-[28px] leading-none font-black text-white tabular-nums">{company.intranet[domain]}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
