import React from 'react';
import type { GamePhase } from '../types/game.ts';

interface Props {
  phase: GamePhase;
  eventProgress?: string;
}

const phaseIndex = (phase: GamePhase) => phase === 'investment' ? 1 : phase === 'risk' ? 2 : 0;

const Pawn: React.FC = () => (
  <svg viewBox="0 0 64 92" className="h-[68px] w-[48px] drop-shadow-[0_5px_5px_rgba(0,0,0,.55)]" aria-hidden="true">
    <defs>
      <linearGradient id="pawn-green" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#91c984" />
        <stop offset="0.48" stopColor="#5ea657" />
        <stop offset="1" stopColor="#377c3d" />
      </linearGradient>
      <linearGradient id="pawn-edge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#73bb69" />
        <stop offset="1" stopColor="#2f6f35" />
      </linearGradient>
      <radialGradient id="pawn-head" cx="34%" cy="24%" r="70%">
        <stop offset="0" stopColor="#a7d79a" />
        <stop offset="0.5" stopColor="#68ad60" />
        <stop offset="1" stopColor="#438a47" />
      </radialGradient>
    </defs>
    <ellipse cx="32" cy="82" rx="27" ry="8" fill="#245c2e" opacity=".55" />
    <path d="M7 73c1-13 8-22 17-28l3-15h10l3 15c9 6 16 15 17 28 0 7-11 12-25 12S7 80 7 73Z" fill="url(#pawn-green)" stroke="#336f38" strokeWidth="2" />
    <ellipse cx="32" cy="72" rx="25" ry="8" fill="url(#pawn-edge)" stroke="#326d37" strokeWidth="2" />
    <ellipse cx="32" cy="46" rx="17" ry="7" fill="#67aa60" stroke="#356f39" strokeWidth="2" />
    <circle cx="32" cy="24" r="16" fill="url(#pawn-head)" stroke="#3b7840" strokeWidth="2" />
  </svg>
);

export const PhaseTrackV1: React.FC<Props> = ({ phase, eventProgress }) => {
  const index = phaseIndex(phase);
  const markerLeft = ['9%', '42.5%', '75.8%'][index];
  const labels = [
    { key: 'events', text: `EVENTS${eventProgress ? ` ${eventProgress}` : ''}` },
    { key: 'investment', text: 'INVEST' },
    { key: 'risk', text: 'KNOWLEDGE RISK' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl pt-7" aria-label="Round phase">
      <div
        className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 transition-[left] duration-700 ease-in-out motion-reduce:transition-none"
        style={{ left: markerLeft }}
      >
        <Pawn />
      </div>
      <div className="grid grid-cols-3 gap-5 rounded-xl border border-violet-900 bg-[#090d15]/95 px-4 py-3 text-sm font-black">
        {labels.map((item, itemIndex) => (
          <div
            key={item.key}
            className={`min-h-9 rounded-lg border px-3 py-2 text-center transition-colors ${itemIndex === index ? 'border-violet-500/70 bg-violet-950/55 text-violet-100' : 'border-slate-800/70 bg-slate-950/40 text-slate-600'}`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
};
