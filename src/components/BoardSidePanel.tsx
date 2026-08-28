import React, { useState } from 'react';
import { AlertTriangle, Building2, MapPin, Users, X } from 'lucide-react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ActiveEventAllocationV2, ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
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
  const [showSpofHelp, setShowSpofHelp] = useState(false);
  const selectedSite = company.sites.find((site) => site.id === selectedSiteId) || company.sites[0];
  const committedExpertIds = new Set(
    currentEvent
      ? (Object.values(currentEvent.allocations) as ActiveEventAllocationV2[])
          .map((allocation) => allocation.expertId)
          .filter((expertId): expertId is string => Boolean(expertId))
      : [],
  );

  const changeContext = (value: string) => {
    if (value === 'HQ') onSelectHQ();
    else onSelectSite(value);
  };

  return (
    <>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white font-black text-lg"><Users className="w-5 h-5 text-indigo-400" />Experts</div>
            <button
              onClick={() => setShowSpofHelp(true)}
              className="rounded-lg border border-amber-500/50 bg-amber-950/35 px-2.5 py-1 text-[11px] font-black text-amber-200 hover:bg-amber-950/60"
              title="What is a Single Point of Failure?"
            >
              What is SPOF?
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {company.experts.map((expert) => {
              const siteName = expert.location === 'HQ'
                ? 'Corporate HQ'
                : company.sites.find((site) => site.id === expert.location)?.name || expert.location;
              const committed = committedExpertIds.has(expert.id) || ['Supporting Event', 'CoP Participant', 'Knowledge Transfer', 'Training', 'Expertise Capture'].includes(expert.state);
              const unavailable = expert.isVacant || committed;
              const spofLabels = expert.spofDomains.map((domain) => DOMAIN_INFO[domain].label);
              return (
                <div
                  key={expert.id}
                  className={`rounded-xl border px-3 py-2 ${unavailable ? 'border-slate-800 bg-slate-950/60 opacity-55' : expert.isSPOF ? 'border-rose-400 bg-amber-400 text-slate-950 shadow-[0_0_0_1px_rgba(251,113,133,0.35)]' : 'border-amber-300 bg-amber-400 text-slate-950'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-black">{expert.isVacant ? 'VACANT' : expert.name}</div>
                    <div className="font-black italic text-sm text-right">{siteName}</div>
                  </div>
                  <div className={`text-xs mt-0.5 ${unavailable ? 'text-slate-400' : 'text-slate-900'}`}>
                    {expert.domains.map((skill) => `${DOMAIN_INFO[skill.domain].label} ${skill.score}`).join(' · ') || 'Replacement pending'}
                  </div>
                  {!expert.isVacant && expert.isSPOF && (
                    <button
                      onClick={() => setShowSpofHelp(true)}
                      className="mt-2 w-full rounded-lg border border-rose-700/50 bg-rose-950/90 px-2.5 py-1.5 text-left text-rose-100"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide"><AlertTriangle className="w-3.5 h-3.5" /> Single Point of Failure</span>
                      <span className="block mt-0.5 text-[10px] text-rose-200/85">Critical in {spofLabels.join(', ')} · click to understand the risk</span>
                    </button>
                  )}
                  {unavailable && <div className="text-[10px] uppercase tracking-wider font-black text-slate-500 mt-1">{expert.isVacant ? 'Vacant' : committedExpertIds.has(expert.id) ? 'Committed to current challenge' : expert.state}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {showSpofHelp && (
        <div className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-sm grid place-items-center p-5" onClick={() => setShowSpofHelp(false)}>
          <div className="w-full max-w-2xl rounded-3xl border-2 border-amber-500 bg-slate-950 shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-amber-300 text-xs uppercase tracking-[0.18em] font-black"><AlertTriangle className="w-4 h-4" /> Knowledge Risk</div>
                <h2 className="text-2xl font-black text-white mt-1">Single Point of Failure</h2>
              </div>
              <button onClick={() => setShowSpofHelp(false)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm leading-relaxed">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="font-black text-white">What does it mean?</div>
                <p className="text-slate-300 mt-1">A Deep Expert is a <b>Single Point of Failure (SPOF)</b> when their expertise is substantially stronger than the knowledge the organisation can access without them. If they are unavailable, the capability gap is exposed.</p>
              </div>
              <div className="rounded-xl border border-rose-800 bg-rose-950/30 p-4">
                <div className="font-black text-rose-200">Why does it matter?</div>
                <p className="text-slate-300 mt-1">SPOF Experts carry more organisational risk. In the Knowledge Risk phase, being a SPOF increases the pressure behind their departure risk. If they leave, their uncodified expertise leaves with them and the replacement arrives later at only baseline capability.</p>
              </div>
              <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
                <div className="font-black text-emerald-200">How do I solve it?</div>
                <p className="text-slate-300 mt-1">Reduce the gap between the Expert and the organisation. Use investment actions to <b>transfer knowledge to the local team</b>, <b>codify the Expert's knowledge</b>, or <b>build corporate knowledge</b>. Developing another Expert in the same domain also reduces dependence on one person.</p>
                <div className="mt-3 rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-400">The SPOF badge disappears automatically once the organisation has built enough alternative capability in that domain.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
