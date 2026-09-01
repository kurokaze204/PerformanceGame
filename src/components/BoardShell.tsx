import React from 'react';

interface BoardShellProps {
  board: React.ReactNode;
  overlay?: React.ReactNode;
  boardTools?: React.ReactNode;
  eventDeck?: React.ReactNode;
  phaseBar?: React.ReactNode;
  toolOpen?: boolean;
}

export const BoardShell:React.FC<BoardShellProps>=({board,overlay,boardTools,eventDeck,phaseBar,toolOpen=false})=>(
 <section className="relative min-w-0">
  <div className="relative min-h-[560px] sm:min-h-[620px] rounded-3xl border border-violet-900/70 bg-[#080b12] overflow-hidden">
   <div className="flex min-w-0 items-stretch">
    <div className={`relative min-w-0 flex-1 p-2 sm:p-3 transition-[width] duration-300 ${toolOpen?'basis-[58%]':'basis-full'}`}>
     <div className="h-full min-w-0">{board}</div>
     {eventDeck}
     {overlay&&<div className="absolute inset-2 sm:inset-3 z-30 pointer-events-none overflow-y-auto overflow-x-hidden rounded-2xl"><div className="min-h-full flex items-start pointer-events-none p-2 sm:p-3"><div className="pointer-events-auto w-full min-w-0">{overlay}</div></div></div>}
     {phaseBar&&<div className="absolute left-3 right-3 bottom-3 z-25 pointer-events-none">{phaseBar}</div>}
    </div>
    {boardTools}
   </div>
  </div>
 </section>
);
