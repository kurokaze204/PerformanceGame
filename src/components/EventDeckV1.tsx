import React,{useEffect,useRef}from'react';
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
const stackCards=12;
const OPEN_MARKER='uiCompanyOpenCard';

function tilt(id:string,index:number){let hash=index*97;for(let i=0;i<id.length;i++)hash=(hash*31+id.charCodeAt(i))%10000;return -2.5+(hash%501)/100;}
function short(text:string,max=94){return text.length<=max?text:`${text.slice(0,max-1).trim()}…`;}
function stackRotation(index:number){
  if(index===stackCards-1)return 2;
  if(index===stackCards-2)return -2;
  const subtle=[0,-.15,.12,-.08,.18,-.12,.08,0,.14,-.1];
  return subtle[index%subtle.length];
}
function isSharedOpen(event:ActiveEventV2){const domain=event.card.domains[0]?.domain;if(!domain)return false;return Boolean((event.allocations[domain] as any)?.[OPEN_MARKER]);}

const CardBack:React.FC<{label?:string}>=({label='EVENT'})=><div className="absolute inset-0 rounded-[15px] border-[4px] border-violet-300 bg-[radial-gradient(circle_at_50%_22%,#40246b_0%,#1b1034_48%,#080b12_100%)] shadow-[0_8px_18px_rgba(0,0,0,.42)] grid place-items-center overflow-hidden"><div className="absolute inset-3 rounded-xl border-2 border-emerald-400/25"/><b className="text-xl font-black tracking-[.15em] text-violet-100">{label}</b></div>;

const FaceCard:React.FC<{event:ActiveEventV2;canDelay?:boolean;onDelay?:()=>void;delayed?:boolean}>=({event,canDelay=false,onDelay,delayed=false})=><div className="absolute inset-0 rounded-[15px] border-[4px] border-violet-300 bg-[#0b0f18] p-3 shadow-[0_15px_34px_rgba(0,0,0,.48)] text-left overflow-hidden"><div className="flex items-center justify-between gap-2"><b className="text-[11px] font-black tracking-[.15em] text-violet-200">EVENT</b>{delayed&&<span className="rounded-full bg-violet-950 px-2 py-0.5 text-[9px] font-black tracking-wider text-violet-200">NEXT ROUND</span>}</div><div className="mt-2 text-[13px] font-black leading-[1.15] text-white">{short(event.card.title.replace(/^(LEARNING|MATERIAL|HIGH STAKES|CRITICAL):\s*/,''),56)}</div><div className="mt-2 flex flex-wrap gap-1">{event.card.domains.slice(0,3).map(req=><DomainBadge key={req.domain} domain={req.domain}/>)}</div><p className="mt-2 text-[10px] leading-[1.28] text-slate-400">{short(event.card.description,112)}</p>{canDelay&&<button type="button" onClick={e=>{e.stopPropagation();onDelay?.();}} className="absolute bottom-2 left-2 right-2 rounded-lg border-2 border-violet-300 bg-violet-700 px-2 py-1.5 text-[10px] font-black text-white hover:bg-violet-600">DELAY UNTIL NEXT ROUND</button>}</div>;

export const EventDeckV1:React.FC<Props>=({session,company,events,activeIndex,cardOpen=false,onOpenCard,onDelayCard})=>{
 const horizonActive=company.horizonScanAvailableRound===session.round&&!company.horizonScanUsedThisRound&&Boolean(company.horizonScanDomain);
 const unresolved=events.map((event,index)=>({event,index})).filter(item=>!item.event.isResolved);
 const delayed=company.delayedEvent;
 const promotedRef=useRef('');
 const shared=unresolved.find(item=>isSharedOpen(item.event));
 const markSharedOpen=async(index:number)=>{
   const event=events[index],domain=event?.card.domains[0]?.domain;
   if(!event||!domain||event.isResolved||isSharedOpen(event))return;
   try{await fetch(`/api/sessions/${session.id}/events/allocate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId:company.id,eventInstanceId:event.instanceId,domain,allocation:{[OPEN_MARKER]:true}})});}catch{}
 };
 useEffect(()=>{
   if(shared){
     promotedRef.current='';
     if(!cardOpen||shared.index!==activeIndex)onOpenCard(shared.index);
     return;
   }
   const active=events[activeIndex];
   if(cardOpen&&active?.isResolved&&unresolved.length){
     const next=unresolved[0],key=`${session.id}:${company.id}:${next.event.instanceId}`;
     if(promotedRef.current!==key){promotedRef.current=key;onOpenCard(next.index);void markSharedOpen(next.index);}
   }
 },[shared?.event.instanceId,cardOpen,activeIndex,events,unresolved.length,session.id,company.id]);
 const openCard=(index:number)=>{if(cardOpen)return;onOpenCard(index);void markSharedOpen(index)};
 return <div className="absolute left-4 top-4 z-20 h-[440px] w-[650px] max-w-[calc(100%-24px)] select-none pointer-events-none" aria-label="Event cards">
   <div className="absolute left-0 top-0" style={{width:cardW+16,height:cardH+16}}><div className="absolute inset-0 rounded-[18px] border-[4px] border-dashed border-violet-700/80 bg-transparent grid place-items-center"><span className="text-sm font-black tracking-[.18em] text-violet-700/70">EVENTS</span></div></div>
   <div className="absolute left-[8px] top-[8px] pointer-events-none" style={{width:cardW,height:cardH,transform:'translate(4px,4px)',filter:'drop-shadow(0 13px 12px rgba(0,0,0,.6))'}}/>
   {Array.from({length:stackCards},(_,index)=>{
     const offset=stackCards-1-index;
     return <div key={`deck-${index}`} className="absolute pointer-events-none" style={{left:8-offset,top:8-offset,width:cardW,height:cardH,zIndex:2+index,transform:`rotate(${stackRotation(index)}deg)`,transformOrigin:'center center'}}><CardBack/></div>;
   })}

   <AnimatePresence initial>
    {unresolved.map(({event,index},slot)=>{
      const faceUp=horizonActive&&(session.experienceMode==='newbie'||event.card.domains.some(req=>req.domain===company.horizonScanDomain));
      const canDelay=faceUp&&!delayed;
      const rotation=tilt(event.instanceId,slot);
      const isCurrent=cardOpen&&index===activeIndex;
      const finalLeft=dealStartX+slot*dealGap;
      return <motion.button key={event.instanceId} type="button" onClick={()=>openCard(index)} disabled={cardOpen} initial={{x:8-finalLeft,y:8,rotate:rotation,opacity:1}} animate={{x:0,y:0,rotate:rotation,opacity:isCurrent?0:1}} exit={{opacity:0,y:-18,scale:.94}} transition={{duration:1.2,delay:slot*.08,ease:[.2,.8,.22,1]}} className="absolute top-0 pointer-events-auto disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-violet-300 rounded-[15px]" style={{left:finalLeft,width:cardW,height:cardH,zIndex:18-slot}} aria-label={faceUp?`Event: ${event.card.title}`:'Face-down Event card'}>{faceUp?<FaceCard event={event} canDelay={canDelay} onDelay={()=>onDelayCard(event.instanceId)}/>:<CardBack/>}</motion.button>;
    })}
   </AnimatePresence>

   <div className="absolute left-0 top-[226px]" style={{width:cardW+16,height:cardH+16}}><div className="absolute inset-0 rounded-[18px] border-[4px] border-dashed border-violet-700/80 bg-transparent grid place-items-center"><span className="text-sm font-black tracking-[.18em] text-violet-700/70">DELAYED</span></div></div>
   {delayed&&<motion.div initial={{opacity:0,y:-120,rotate:tilt(delayed.instanceId,0)}} animate={{opacity:1,y:0,rotate:0}} transition={{duration:.7,ease:[.2,.8,.2,1]}} className="absolute left-[8px] top-[234px] pointer-events-none" style={{width:cardW,height:cardH}}><FaceCard event={delayed} delayed/></motion.div>}

   {horizonActive&&<div className="absolute left-[176px] top-[198px] rounded-full border border-emerald-700 bg-emerald-950/90 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-emerald-300">Horizon Scan · {session.experienceMode==='newbie'?'all Events revealed':`${company.horizonScanDomain} Events revealed`}</div>}
 </div>;
};
