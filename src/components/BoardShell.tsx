import React from 'react';

interface BoardShellProps {
  board: React.ReactNode;
  sidePanel?: React.ReactNode;
  overlay?: React.ReactNode;
  boardTools?: React.ReactNode;
  eventDeck?: React.ReactNode;
  phaseBar?: React.ReactNode;
}

export const BoardShell:React.FC<BoardShellProps>=({board,overlay,boardTools,eventDeck,phaseBar})=>(
 <section className="relative min-w-0">
  <div className="relative min-h-[560px] sm:min-h-[620px] rounded-3xl border border-violet-900/70 bg-[#080b12] p-2 sm:p-3 overflow-hidden">
   <div className="h-full min-w-0">{board}</div>
   {eventDeck}
   {boardTools}
   {overlay&&<div className="absolute inset-2 sm:inset-3 z-30 pointer-events-none overflow-y-auto overflow-x-hidden rounded-2xl"><div className="min-h-full flex items-start pointer-events-none p-2 sm:p-3"><div className="pointer-events-auto w-full min-w-0">{overlay}</div></div></div>}
   {phaseBar&&<div className="absolute left-2 right-2 bottom-2 z-25 pointer-events-none">{phaseBar}</div>}
  </div>
 </section>
);
