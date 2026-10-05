import React from 'react';

interface BoardShellProps {
  board: React.ReactNode;
  overlay?: React.ReactNode;
  boardTools?: React.ReactNode;
  eventDeck?: React.ReactNode;
  phaseBar?: React.ReactNode;
  toolOpen?: boolean;
}

export const BoardShell:React.FC<BoardShellProps>=({board,overlay,boardTools,eventDeck,phaseBar})=>(
 <section className={`tpg-board-shell ${overlay?'tpg-board-has-overlay':''} relative min-w-0 w-full mx-auto max-w-full xl:max-w-[min(100%,calc((100dvh-var(--tpg-header-height,88px)-24px)*4/3))]`}>
  <div className="tpg-board-frame relative rounded-3xl border border-violet-900/70 bg-[#080b12] overflow-hidden">
   <div className="tpg-board-stage relative min-w-0 p-2 sm:p-3">
    <div className="h-full min-w-0">{board}</div>
    {eventDeck}
    {overlay&&<div className="tpg-board-overlay-scroll absolute inset-2 sm:inset-3 z-30 pointer-events-auto overflow-y-scroll overflow-x-hidden overscroll-contain touch-pan-y rounded-2xl [-webkit-overflow-scrolling:touch]"><div className="min-h-full flex items-start p-2 pb-24 sm:p-3 sm:pb-24"><div className="pointer-events-auto w-full min-w-0">{overlay}</div></div></div>}
    {phaseBar&&<div className="absolute left-3 right-3 bottom-3 z-[35] pointer-events-none">{phaseBar}</div>}
   </div>
   {boardTools&&<div className="absolute inset-y-0 right-0 z-40 pointer-events-none [&>*]:pointer-events-auto">{boardTools}</div>}
  </div>
 </section>
);
