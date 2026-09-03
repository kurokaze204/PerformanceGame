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
    <div className="relative w-full px-5 pb-1 pt-[74px]" aria-label={`Current phase: ${labels[active]}`}>
      <div className="relative grid grid-cols-3 gap-10 rounded-2xl border border-slate-700/80 bg-slate-950/90 px-5 py-2 shadow-xl">
        {labels.map((label, index) => (
          <div key={label} className="relative min-w-0 text-center">
            <div className={`text-[11px] font-black uppercase tracking-[0.16em] ${index === active ? 'text-white' : 'text-slate-500'}`}>
              {label}
            </div>
            {index === 0 && eventProgress && (
              <div className="mt-0.5 text-[10px] font-bold text-slate-500">{eventProgress} resolved</div>
            )}
          </div>
        ))}

        <motion.div
          className="pointer-events-none absolute bottom-[8px] left-0 z-20 w-1/3"
          animate={{ x: `${active * 100}%` }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative mx-auto h-[104px] w-[92px]">
            <img
              src={pawnSrc}
              alt=""
              aria-hidden="true"
              className="absolute bottom-[-16px] left-1/2 h-[108px] w-auto max-w-none -translate-x-1/2 select-none drop-shadow-[0_10px_9px_rgba(0,0,0,.55)]"
              draggable={false}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PhaseTrackV1;
