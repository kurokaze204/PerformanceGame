import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { DomainBadge } from './DomainBadge.tsx';

interface Props {
  session: GameSessionV2;
  company: CompanyV2;
  events: ActiveEventV2[];
  activeIndex: number;
  cardOpen?: boolean;
  onOpenCard: (index:number)=>void;
  onDelayCard: (eventInstanceId:string)=>void;
}

const cardW=132;
const cardH=184;
const dealStartX=176;
const dealGap=146;
const deckDepth=12;

function tilt(id:string,index:number){let hash=index*97;for(let i=0;i<id.length;i++)hash=(hash*31+id.charCodeAt(i))%10000;return -2.5+(hash%501)/100;}
function short(text:string,max=94){return text.length<=max?text:`${text.slice(0,max-1).trim()}…`;}
function stackRotation(index:number){
  const fromTop=deckDepth-1-index;
  if(fromTop===0)return -1.1;
  if(fromTop===1)return .8;
  if(fromTop===2)return -.35;
  return ((index%3)-1)*.08;
}

const CardBack:React.FC<{label?:string;stackLayer?:boolean}>=({label='EVENT',stackLayer=false})=><div className={`absolute inset-0 rounded-[15px] border-[4px] border-violet-300 bg-[radial-gradient(circle_at_50%_22%,#40246b_0%,#1b1034_48%,#080b12_100%)] grid place-items-center overflow-hidden ${stackLayer?'shadow-[0_2px_3px_rgba(0,0,0,.5)]':'shadow-[0_15px_34px_rgba(0,0,0,.48)]'}`}><div className="absolute inset-3 rounded-xl border-2 border-emerald-400/25"/><b className="-rotate-6 text-xl font-black tracking-[.15em] text-violet-100">{label}</b></div>;

const FaceCard:React.FC<{event:ActiveEventV2;canDelay?:boolean;onDelay?:()=>void;delayed?:boolean}>=({event,canDelay=false,onDelay,delayed=false})=><div className="absolute inset-0 rounded-[15px] border-[4px] border-violet-300 bg-[#0b0f18] p-3 shadow-[0_15px_34px_rgba(0,0,0,.48)] text-left overflow-hidden"><div className="flex items-center justify-between gap-2"><b className="text-[11px] font-black tracking-[.15em] text-violet-200">EVENT</b>{delayed&&<span className="rounded-full bg-violet-950 px-2 py-0.5 text-[9px] font-black tracking-wider text-violet-200">NEXT ROUND</span>}</div><div className="mt-2 text-[13px] font-black leading-[1.15] text-white">{short(event.card.title.replace(/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):\s*/,''),56)}</div><div className="mt-2 flex flex-wrap gap-1">{event.card.domains.slice(0,3).map(req=><DomainBadge key={req.domain} domain={req.domain}/>)}</div><p className="mt-2 text-[10px] leading-[1.28] text-slate-400">{short(event.card.description,112)}</p>{canDelay&&<button type="button" onClick={e=>{e.stopPropagation();onDelay?.();}} className="absolute bottom-2 left-2 right-2 rounded-lg border-2 border-violet-300 bg-violet-700 px-2 py-1.5 text-[10px] font-black text-white hover:bg-violet-600">DELAY UNTIL NEXT ROUND</button>}</div>;

export const EventDeckV1:React.FC<Props>=({session,company,events,activeIndex,cardOpen=false,onOpenCard,onDelayCard})=>{
 const horizonActive=company.horizonScanAvailableRound===session.round&&!company.horizonScanUsedThisRound&&Boolean(company.horizonScanDomain);
 const unresolved=events.map((event,index)=>({event,index})).filter(item=>!item.event.isResolved);
 const delayed=company.delayedEvent;
 return <div className="absolute left-4 top-4 z-20 h-[440px] w-[650px] max-w-[calc(100%-24px)] select-none pointer-events-none" aria-label="Event cards">
   <div className="absolute left-0 top-0" style={{width:cardW+16,height:cardH+16}}><div className="absolute inset-0 rounded-[18px] border-[4px] border-dashed border-violet-700/80 bg-transparent grid place-items-center"><span className="text-sm font-black tracking-[.18em] text-violet-700/70">EVENTS</span></div></div>
   <div className="absolute left-[8px] top-[8px] pointer-events-none" style={{width:cardW,height:cardH,filter:'drop-shadow(7px 10px 8px rgba(0,0,0,.42))'}}>
    {Array.from({length:deckDepth},(_,index)=>{
      const offset=deckDepth-1-index;
      return <div key={index} className="absolute inset-0" style={{transform:`translate(${-offset}px,${-offset}px) rotate(${stackRotation(index)}deg)`,zIndex:index}}><CardBack stackLayer={index<deckDepth-1}/></div>;
    })}
   </div>

   <AnimatePresence initial>
    {unresolved.map(({event,index},slot)=>{
      const faceUp=horizonActive&&(session.experienceMode==='newbie'||event.card.domains.some(req=>req.domain===company.horizonScanDomain));
      const canDelay=faceUp&&!delayed;
      const rotation=tilt(event.instanceId,slot);
      const isCurrent=cardOpen&&index===activeIndex;
      const finalLeft=dealStartX+slot*dealGap;
      return <motion.button key={event.instanceId} type="button" onClick={()=>!cardOpen&&onOpenCard(index)} disabled={cardOpen} initial={{x:8-finalLeft,y:8,rotate:rotation,opacity:1}} animate={{x:0,y:0,rotate:rotation,opacity:isCurrent?0:1}} exit={{opacity:0,y:-18,scale:.94}} transition={{duration:1.2,delay:slot*.08,ease:[.2,.8,.22,1]}} className="absolute top-0 pointer-events-auto disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-violet-300 rounded-[15px]" style={{left:finalLeft,width:cardW,height:cardH,zIndex:18-slot}} aria-label={faceUp?`Event: ${event.card.title}`:'Face-down Event card'}>{faceUp?<FaceCard event={event} canDelay={canDelay} onDelay={()=>onDelayCard(event.instanceId)}/>:<CardBack/>}</motion.button>;
    })}
   </AnimatePresence>

   <div className="absolute left-0 top-[226px]" style={{width:cardW+16,height:cardH+16}}><div className="absolute inset-0 rounded-[18px] border-[4px] border-dashed border-violet-700/80 bg-transparent grid place-items-center"><span className="text-sm font-black tracking-[.18em] text-violet-700/70">DELAYED</span></div></div>
   {delayed&&<motion.div initial={{opacity:0,y:-120,rotate:tilt(delayed.instanceId,0)}} animate={{opacity:1,y:0,rotate:0}} transition={{duration:.7,ease:[.2,.8,.2,1]}} className="absolute left-[8px] top-[234px] pointer-events-none" style={{width:cardW,height:cardH}}><FaceCard event={delayed} delayed/></motion.div>}

   {horizonActive&&<div className="absolute left-[176px] top-[198px] rounded-full border border-emerald-700 bg-emerald-950/90 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-emerald-300">Horizon Scan · {session.experienceMode==='newbie'?'all Events revealed':`${company.horizonScanDomain} Events revealed`}</div>}
 </div>;
};
