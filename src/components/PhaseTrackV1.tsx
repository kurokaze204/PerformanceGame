import React from 'react';
import { motion } from 'motion/react';
import type { GamePhase } from '../types/game.ts';
import pawnSrc from '../image_ecc870e4.png';

interface Props {
  phase: GamePhase;
  eventProgress?: string;
}

const labels = ['Events', 'Invest', 'Knowledge Risk'] as const;
const indexForPhase = (phase: GamePhase) => phase === 'investment' ? 1 : phase === 'risk' ? 2 : 0;

export const PhaseTrackV1: React.FC<Props> = ({ phase, eventProgress }) => {
  const active = indexForPhase(phase);

  return (
    <div className="relative w-full px-4 pb-1 pt-[48px]" aria-label={`Current phase: ${labels[active]}`}>
      <div className="relative grid grid-cols-3 gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-3 py-2 shadow-xl">
        {labels.map((label, index) => (
          <div key={label} className="relative min-w-0 pl-[42px] pr-1 text-center">
            <div className={`text-sm font-black uppercase tracking-[0.14em] ${index === active ? 'text-white' : 'text-slate-500'}`}>
              {label}
            </div>
            {index === 0 && eventProgress && (
              <div className="mt-0.5 text-xs font-bold text-slate-500">{eventProgress} resolved</div>
            )}
          </div>
        ))}

        <motion.div
          className="pointer-events-none absolute bottom-[4px] left-0 z-20 w-1/3"
          animate={{ x: `${active * 100}%` }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative ml-[5px] h-[64px] w-[46px]">
            <img
              src={pawnSrc}
              alt=""
              aria-hidden="true"
              className="absolute bottom-[-6px] left-1/2 h-[65px] w-auto max-w-none -translate-x-1/2 select-none drop-shadow-[0_8px_7px_rgba(0,0,0,.5)]"
              draggable={false}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PhaseTrackV1;
