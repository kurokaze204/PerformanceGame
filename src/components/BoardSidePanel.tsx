import React from 'react';
import { Building2, MapPin, Users } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { calculateUsableIntranetV2 } from '../engine/coreV2.ts';
import { KnowledgeHubPanel } from './KnowledgeHubPanel.tsx';
import { formatCurrency } from '../utils/format.ts';

interface BoardSidePanelProps {
  session: GameSessionV2;
  company: CompanyV2;
  selectedSiteId: string;
  isHQSelected: boolean;
  currentEvent?: ActiveEventV2;
  onSelectSite: (siteId: string) => void;
  onSelectHQ: () => void;
}

export const BoardSidePanel: React.FC<BoardSidePanelProps> = ({
  session,
  company,
  selectedSiteId,
  isHQSelected,
  currentEvent,
  onSelectSite,
  onSelectHQ,
}) => {
  const selectedSite = company.sites.find((site) => site.id === selectedSiteId) || company.sites[0];
  const committedExpertIds = new Set(
    currentEvent
      ? Object.values(currentEvent.allocations).map((allocation) => allocation?.expertId).filter(Boolean)
      : [],
  );

  const changeContext = (value: string) => {
    if (value === 'HQ') onSelectHQ();
    else onSelectSite(value);
  };

  return (
    <aside className="rounded-3xl border border-slate-800 bg-slate-900/75 p-4 min-h-[620px] overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-indigo-300 font-black">Selected site</div>
          <div className="mt-2 flex items-center gap-2">
            {isHQSelected ? <Building2 className="w-5 h-5 text-indigo-400" /> : <MapPin className="w-5 h-5 text-indigo-400" />}
            <select
              value={isHQSelected ? 'HQ' : selectedSite.id}
              onChange={(event) => changeContext(event.target.value)}
              className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-lg font-black text-white outline-none focus:border-indigo-400"
            >
              <option value="HQ">Corporate HQ</option>
              {company.sites.filter((site) => !site.isClosed).map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500">Turnover</div>
          <div className="font-black text-white">{isHQSelected ? formatCurrency(company.turnover) : formatCurrency(selectedSite.turnover)}</div>
        </div>
      </div>

      <div className="mt-4">
        {isHQSelected ? (
          <KnowledgeHubPanel company={company} embedded />
        ) : (
          <div className="space-y-2">
            {(Object.keys(DOMAIN_INFO) as KnowledgeDomain[]).map((domain) => {
              const info = DOMAIN_INFO[domain];
              const usableIntranet = calculateUsableIntranetV2(company, selectedSite, domain, session.config);
              return (
                <div key={domain} className="rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                      {info.label}
                    </span>
                    <span className="text-xs text-slate-500">usable {Math.max(selectedSite.teamCapability[domain], selectedSite.codifiedKnowledge[domain], usableIntranet)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-slate-400">
                    <span>Team <b className="text-white">{selectedSite.teamCapability[domain]}</b></span>
                    <span>Docs <b className="text-white">{selectedSite.codifiedKnowledge[domain]}</b></span>
                    <span>Corp <b className="text-white">{company.intranet[domain]}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-2 text-white font-black text-lg"><Users className="w-5 h-5 text-indigo-400" />Experts</div>
        <div className="mt-3 space-y-2">
          {company.experts.map((expert) => {
            const siteName = expert.location === 'HQ'
              ? 'Corporate HQ'
              : company.sites.find((site) => site.id === expert.location)?.name || expert.location;
            const committed = committedExpertIds.has(expert.id) || ['Supporting Event', 'CoP Participant', 'Knowledge Transfer', 'Training', 'Expertise Capture'].includes(expert.state);
            const unavailable = expert.isVacant || committed;
            return (
              <div
                key={expert.id}
                className={`rounded-xl border px-3 py-2 ${unavailable ? 'border-slate-800 bg-slate-950/60 opacity-55' : 'border-amber-300 bg-amber-400 text-slate-950'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-black">{expert.isVacant ? 'VACANT' : expert.name}</div>
                  <div className="font-black italic text-sm text-right">{siteName}</div>
                </div>
                <div className={`text-xs mt-0.5 ${unavailable ? 'text-slate-400' : 'text-slate-900'}`}>
                  {expert.domains.map((skill) => `${DOMAIN_INFO[skill.domain].label} ${skill.score}`).join(' · ') || 'Replacement pending'}
                </div>
                {unavailable && <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mt-1">{expert.isVacant ? 'Vacant' : committedExpertIds.has(expert.id) ? 'Committed to current challenge' : expert.state}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
