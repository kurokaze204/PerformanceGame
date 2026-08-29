import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Company, Expert, DOMAIN_INFO } from '../types/game.ts';
import { HQ_COORDINATES } from '../engine/config.ts';
import { AUSTRALIA_GRID } from '../utils/australiaGrid.ts';
import { formatCurrency } from '../utils/format.ts';
import { ShieldAlert, Building2, FlaskConical, AlertTriangle, UserCheck } from 'lucide-react';

export interface SiteImpactEffect {
  id: string;
  siteIds: string[];
  amount: number;
  enterprise: boolean;
}

interface AustraliaMapProps {
  company: Company;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string) => void;
  onSelectHQ: () => void;
  isHQSelected: boolean;
  onSelectExpert: (expert: Expert) => void;
  impactEffect?: SiteImpactEffect | null;
}

export const AustraliaMap: React.FC<AustraliaMapProps> = ({
  company,
  selectedSiteId,
  onSelectSite,
  onSelectHQ,
  isHQSelected,
  onSelectExpert,
  impactEffect = null,
}) => {
  const expertsAtHQ = company.experts.filter((e) => !e.isVacant && e.location === 'HQ');
  const getExpertsAtSite = (siteId: string) => company.experts.filter((e) => !e.isVacant && e.location === siteId);
  const [displayedImpactEffect, setDisplayedImpactEffect] = useState<SiteImpactEffect | null>(null);
  const [impactProgress, setImpactProgress] = useState(0);
  const impactStartTimer = useRef<number | null>(null);
  const impactEndTimer = useRef<number | null>(null);
  const impactFrame = useRef<number | null>(null);

  // A challenge can be resolved while the player is scrolled down at the card.
  // Bring the map back into view first, then animate both the financial impact
  // and the affected turnover over four seconds.
  useEffect(() => {
    if (!impactEffect) return;

    if (impactStartTimer.current) window.clearTimeout(impactStartTimer.current);
    if (impactEndTimer.current) window.clearTimeout(impactEndTimer.current);
    if (impactFrame.current) window.cancelAnimationFrame(impactFrame.current);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    impactStartTimer.current = window.setTimeout(() => {
      setDisplayedImpactEffect(impactEffect);
      setImpactProgress(0);

      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 4000);
        setImpactProgress(progress);
        if (progress < 1) impactFrame.current = window.requestAnimationFrame(animate);
      };
      impactFrame.current = window.requestAnimationFrame(animate);

      impactEndTimer.current = window.setTimeout(() => {
        setDisplayedImpactEffect((current) => current?.id === impactEffect.id ? null : current);
        setImpactProgress(0);
      }, 4200);
    }, 500);
  }, [impactEffect?.id]);

  useEffect(() => () => {
    if (impactStartTimer.current) window.clearTimeout(impactStartTimer.current);
    if (impactEndTimer.current) window.clearTimeout(impactEndTimer.current);
    if (impactFrame.current) window.cancelAnimationFrame(impactFrame.current);
  }, []);

  const activeImpact = displayedImpactEffect;
  const animatedImpactAmount = activeImpact ? Math.round(activeImpact.amount * impactProgress) : 0;
  const enterpriseStartTurnover = activeImpact?.enterprise ? company.turnover - activeImpact.amount : company.turnover;
  const animatedEnterpriseTurnover = activeImpact?.enterprise
    ? Math.round(enterpriseStartTurnover + activeImpact.amount * impactProgress)
    : company.turnover;

  const { coastSquares, ocean1Squares, ocean2Squares, ocean3Squares, ocean4Squares, interiorSquares } = useMemo(() => {
    const coast: typeof AUSTRALIA_GRID.squares = [];
    const o1: typeof AUSTRALIA_GRID.squares = [];
    const o2: typeof AUSTRALIA_GRID.squares = [];
    const o3: typeof AUSTRALIA_GRID.squares = [];
    const o4: typeof AUSTRALIA_GRID.squares = [];
    const interior: typeof AUSTRALIA_GRID.squares = [];
    for (const sq of AUSTRALIA_GRID.squares) {
      if (sq.type === 'coast') coast.push(sq);
      else if (sq.type === 'ocean_1') o1.push(sq);
      else if (sq.type === 'ocean_2') o2.push(sq);
      else if (sq.type === 'ocean_3') o3.push(sq);
      else if (sq.type === 'ocean_4') o4.push(sq);
      else if (sq.type === 'interior') interior.push(sq);
    }
    return { coastSquares: coast, ocean1Squares: o1, ocean2Squares: o2, ocean3Squares: o3, ocean4Squares: o4, interiorSquares: interior };
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/11] min-h-[560px] lg:min-h-[620px] bg-[#060a0f] rounded-xl border border-[#30363d] shadow-2xl overflow-hidden p-2 sm:p-4 select-none flex flex-col justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0d1620]/60 via-[#060a0f] to-[#030609] pointer-events-none" />

      {activeImpact?.enterprise && activeImpact.amount !== 0 && (
        <motion.div
          key={`enterprise-impact-${activeImpact.id}`}
          initial={{ opacity: 0, scale: 0.75, y: 10 }}
          animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.75, 1.18, 1.08, 1, 1], y: [10, -6, -10, -16, -24] }}
          transition={{ duration: 4, times: [0, 0.12, 0.3, 0.82, 1] }}
          className={`absolute left-1/2 top-[42%] -translate-x-1/2 z-40 rounded-2xl border-2 px-7 py-4 text-center shadow-2xl pointer-events-none ${activeImpact.amount > 0 ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200' : 'bg-rose-950/95 border-rose-400 text-rose-200'}`}
        >
          <div className="text-4xl font-black tabular-nums">COMPANY {activeImpact.amount > 0 ? '+' : '−'}{formatCurrency(Math.abs(animatedImpactAmount))}</div>
          <div className="mt-1 text-sm font-bold text-white/80 tabular-nums">Turnover {formatCurrency(enterpriseStartTurnover)} → {formatCurrency(animatedEnterpriseTurnover)}</div>
        </motion.div>
      )}

      {company.horizonScanDomain && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-[#161b22]/90 backdrop-blur-xs border border-amber-500/60 rounded-md px-2.5 py-1 text-xs text-amber-300 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-[11px] font-mono">SCAN: <strong className="text-amber-200">{DOMAIN_INFO[company.horizonScanDomain].label}</strong></span>
        </div>
      )}

      {company.automatedDomains.length > 0 && (
        <div className="absolute top-3 right-40 z-30 flex items-center gap-1.5 bg-[#161b22]/90 backdrop-blur-xs border border-emerald-500/60 rounded-md px-2.5 py-1 text-xs text-emerald-300 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-mono">AUTO: {company.automatedDomains.map((d) => DOMAIN_INFO[d].label).join(', ')}</span>
        </div>
      )}

      <svg viewBox={`0 0 ${AUSTRALIA_GRID.viewWidth} ${AUSTRALIA_GRID.viewHeight}`} className="w-full h-full absolute inset-0 pointer-events-none" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="coast-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g fill="#05080c" stroke="#0a0f15" strokeWidth="0.5">{interiorSquares.map((sq, i) => <rect key={`in-${i}`} x={sq.x} y={sq.y} width="9" height="9" rx="1.5" />)}</g>
        <g fill="#047857" opacity="0.12">{ocean4Squares.map((sq, i) => <rect key={`o4-${i}`} x={sq.x} y={sq.y} width="9" height="9" rx="1.5" />)}</g>
        <g fill="#059669" opacity="0.25">{ocean3Squares.map((sq, i) => <rect key={`o3-${i}`} x={sq.x} y={sq.y} width="9" height="9" rx="1.5" />)}</g>
        <g fill="#10b981" opacity="0.48">{ocean2Squares.map((sq, i) => <rect key={`o2-${i}`} x={sq.x} y={sq.y} width="9" height="9" rx="1.5" />)}</g>
        <g fill="#34d399" opacity="0.75">{ocean1Squares.map((sq, i) => <rect key={`o1-${i}`} x={sq.x} y={sq.y} width="9" height="9" rx="1.5" />)}</g>
        <g fill="#4ade80" filter="url(#coast-glow)">{coastSquares.map((sq, i) => <rect key={`c-${i}`} x={sq.x} y={sq.y} width="9" height="9" rx="1.5" />)}</g>

        {company.sites.map((site) => {
          const hqX = (HQ_COORDINATES.x / 100) * AUSTRALIA_GRID.viewWidth;
          const hqY = (HQ_COORDINATES.y / 100) * AUSTRALIA_GRID.viewHeight;
          const siteX = (site.coordinates.x / 100) * AUSTRALIA_GRID.viewWidth;
          const siteY = (site.coordinates.y / 100) * AUSTRALIA_GRID.viewHeight;
          return (
            <g key={`corridor-${site.id}`}>
              <line x1={hqX} y1={hqY} x2={siteX} y2={siteY} stroke="#10b981" strokeWidth="1.2" strokeDasharray="4 6" opacity={site.isClosed ? '0.15' : '0.45'} />
              <circle cx={siteX} cy={siteY} r="7" fill="none" stroke="#34d399" strokeWidth="1" opacity={site.isClosed ? '0.2' : '0.7'} />
              <circle cx={siteX} cy={siteY} r="2.5" fill={site.isClosed ? '#f43f5e' : '#10b981'} />
            </g>
          );
        })}
        <circle cx={(HQ_COORDINATES.x / 100) * AUSTRALIA_GRID.viewWidth} cy={(HQ_COORDINATES.y / 100) * AUSTRALIA_GRID.viewHeight} r="9" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
      </svg>

      <div
        style={{ left: `${HQ_COORDINATES.x}%`, top: `${HQ_COORDINATES.y}%`, transform: 'translate(-50%, -50%)' }}
        onClick={onSelectHQ}
        className={`absolute z-20 cursor-pointer p-2.5 rounded-lg border transition-all duration-200 shadow-xl ${isHQSelected ? 'bg-[#161b22] border-indigo-500 ring-2 ring-indigo-500/50 scale-110 shadow-indigo-500/20' : 'bg-[#12161f]/95 border-[#30363d] hover:border-indigo-400 hover:scale-150 hover:z-30'}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-indigo-600/25 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shadow-inner"><Building2 className="w-4 h-4" /></div>
          <div><div className="text-[11px] font-bold text-white tracking-tight font-mono flex items-center gap-1.5"><span>CORPORATE HQ</span><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" /></div><div className="text-[9px] text-[#8b949e] uppercase font-mono">Central Knowledge Repo</div></div>
        </div>
        {expertsAtHQ.length > 0 && (
          <div className="mt-2 pt-1.5 border-t border-[#30363d] flex flex-wrap gap-1">
            {expertsAtHQ.map((expert) => <button key={expert.id} onClick={(e) => { e.stopPropagation(); onSelectExpert(expert); }} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] text-[9px] font-mono text-[#c9d1d9] hover:text-white hover:bg-indigo-950/80 hover:border-indigo-600 transition"><UserCheck className="w-2.5 h-2.5 text-indigo-400" /><span>{expert.name.split(' ')[0]}</span></button>)}
          </div>
        )}
      </div>

      {company.sites.map((site) => {
        const isSelected = selectedSiteId === site.id;
        const residentExperts = getExpertsAtSite(site.id);
        const hasSPOF = residentExperts.some((e) => e.isSPOF);
        const isImpacting = !!activeImpact?.siteIds.includes(site.id);
        const localImpact = isImpacting && !activeImpact?.enterprise && activeImpact ? activeImpact.amount : 0;
        const startingTurnover = localImpact ? site.turnover - localImpact : site.turnover;
        const displayedTurnover = localImpact ? Math.round(startingTurnover + localImpact * impactProgress) : site.turnover;

        let transformClass = 'translate(-50%, -50%)';
        if (site.id === 'adelaide') transformClass = 'translate(-100%, -50%)';
        else if (site.id === 'sydney') transformClass = 'translate(-88%, -50%)';
        else if (site.id === 'melbourne') transformClass = 'translate(-50%, 8%)';
        else if (site.id === 'brisbane') transformClass = 'translate(-85%, -50%)';
        else if (site.id === 'perth') transformClass = 'translate(6%, -50%)';
        else if (site.id === 'darwin') transformClass = 'translate(-50%, 6%)';

        return (
          <div
            key={site.id}
            style={{ left: `${site.coordinates.x}%`, top: `${site.coordinates.y}%`, transform: transformClass }}
            onClick={() => onSelectSite(site.id)}
            className={`absolute z-20 cursor-pointer p-2 rounded-lg border transition-all duration-300 min-w-[120px] max-w-[140px] shadow-lg backdrop-blur-xs ${
              site.isClosed
                ? 'bg-[#161b22]/75 border-rose-900/60 opacity-60'
                : isImpacting
                ? activeImpact && activeImpact.amount >= 0
                  ? 'bg-emerald-950/95 border-emerald-300 ring-4 ring-emerald-400/50 scale-150 z-30 shadow-emerald-400/40'
                  : 'bg-rose-950/95 border-rose-300 ring-4 ring-rose-400/50 scale-150 z-30 shadow-rose-400/40'
                : isSelected
                ? 'bg-[#161b22] border-emerald-400 ring-2 ring-emerald-400/50 scale-110 shadow-emerald-500/20 hover:scale-150 hover:z-30'
                : 'bg-[#12161f]/95 border-[#30363d] hover:border-emerald-500/70 hover:scale-150 hover:z-30'
            }`}
          >
            {isImpacting && !activeImpact?.enterprise && activeImpact && activeImpact.amount !== 0 && (
              <motion.div
                key={`${site.id}-${activeImpact.id}`}
                initial={{ opacity: 0, scale: 0.7, y: 8 }}
                animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.7, 1.2, 1.08, 1, 1], y: [8, -8, -12, -18, -28] }}
                transition={{ duration: 4, times: [0, 0.12, 0.3, 0.82, 1] }}
                className={`absolute -top-14 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-xl border-2 px-4 py-2 text-center shadow-2xl pointer-events-none ${activeImpact.amount > 0 ? 'bg-emerald-950 border-emerald-300 text-emerald-200' : 'bg-rose-950 border-rose-300 text-rose-200'}`}
              >
                <div className="text-2xl font-black tabular-nums">{activeImpact.amount > 0 ? '+' : '−'}{formatCurrency(Math.abs(animatedImpactAmount))}</div>
                <div className="mt-0.5 text-[10px] font-bold text-white/80 tabular-nums">Turnover {formatCurrency(startingTurnover)} → {formatCurrency(displayedTurnover)}</div>
              </motion.div>
            )}

            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 truncate"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${site.isClosed ? 'bg-rose-500' : 'bg-emerald-400 shadow-xs shadow-emerald-400'}`} /><span className="text-xs font-semibold text-white tracking-tight truncate">{site.name}</span></div>
              <span className={`text-xs font-mono font-bold shrink-0 tabular-nums ${site.isClosed ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(displayedTurnover)}</span>
            </div>

            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {site.isRDSite && <span className="flex items-center gap-1 text-[8.5px] px-1 py-0.2 rounded bg-indigo-950/70 border border-indigo-800/70 text-indigo-300 font-mono"><FlaskConical className="w-2.5 h-2.5" /><span>R&D</span></span>}
              {hasSPOF && <span className="flex items-center gap-1 text-[8.5px] px-1 py-0.2 rounded bg-amber-950/80 border border-amber-700/80 text-amber-300 font-mono font-bold animate-pulse"><ShieldAlert className="w-2.5 h-2.5 text-amber-400" /><span>SPOF</span></span>}
              {site.isClosed && <span className="text-[8.5px] px-1 py-0.2 rounded bg-rose-950/80 border border-rose-800/80 text-rose-300 font-mono">CLOSED</span>}
            </div>

            {residentExperts.length > 0 && !site.isClosed && (
              <div className="mt-1.5 pt-1 border-t border-[#30363d] flex flex-wrap gap-1">
                {residentExperts.map((expert) => (
                  <button key={expert.id} onClick={(e) => { e.stopPropagation(); onSelectExpert(expert); }} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-mono border transition ${expert.isSPOF ? 'bg-amber-950/70 border-amber-700/80 text-amber-200 hover:bg-amber-900/80' : 'bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d] hover:text-white'}`}>
                    <span className="w-1 h-1 rounded-full bg-emerald-400" /><span className="truncate max-w-[55px]">{expert.name.split(' ')[0]}</span>{expert.isSPOF && <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
