import React,{useMemo}from'react';
import{motion}from'motion/react';
import type{KnowledgeDomain}from'../types/game.ts';
import type{CompanyV2,ExperienceMode}from'../types/gameV2.ts';
import{riverSiteKnowledgeScore}from'../engine/riverKnowledgeV1.ts';
import{DOMAIN_INFO}from'../types/game.ts';

export type RiskRiverEffect=
 |{kind:'workforce-loss';siteId:string;domain:KnowledgeDomain;previousScore:number;newScore:number}
 |{kind:'expert-check';expertId:string;status:'ok'|'spof'}
 |{kind:'expert-departed';expertId:string}
 |{kind:'replacement';expertId:string;siteId:string}
 |null;

interface Props{company:CompanyV2;mode:ExperienceMode;effect:RiskRiverEffect;}
const NEWBIE:KnowledgeDomain[]=['engineering','hr','marketing','operations'];
const EXPERT:KnowledgeDomain[]=[...NEWBIE,'finance'];

export const RiskRiverDiagram:React.FC<Props>=({company,mode,effect})=>{
 const domains=mode==='expert'?EXPERT:NEWBIE;
 const sites=company.sites.filter(s=>!s.isClosed);
 const activeExperts=company.experts.filter(e=>!e.isVacant);
 const departing=effect?.kind==='expert-departed'?company.experts.find(e=>e.id===effect.expertId):undefined;
 const replacement=effect?.kind==='replacement'?company.experts.find(e=>e.id===effect.expertId):undefined;
 const data=useMemo(()=>domains.map(domain=>({domain,scores:sites.map(site=>({site,score:riverSiteKnowledgeScore(site,domain,mode)}))})),[company,mode]);
 const expertMarks=activeExperts.flatMap(expert=>expert.domains.filter(skill=>domains.includes(skill.domain)).map(skill=>({expert,domain:skill.domain,score:skill.score})));
 const transient=[...(departing?.domains||[]),...(replacement?.domains||[])].filter(skill=>domains.includes(skill.domain)).map(skill=>skill.score);
 const maxY=Math.max(6,...data.flatMap(d=>d.scores.map(x=>x.score)),...expertMarks.map(x=>x.score),...transient);
 const W=900,H=260,padL=46,padR=22,padT=24,padB=42;
 const x=(i:number)=>padL+i*((W-padL-padR)/Math.max(1,domains.length-1));
 const y=(v:number)=>padT+(maxY-v)*((H-padT-padB)/maxY);
 const north=data.map(d=>Math.max(0,...d.scores.map(s=>s.score))),south=data.map(d=>Math.min(...d.scores.map(s=>s.score)));
 const northPath=north.map((v,i)=>`${i?'L':'M'} ${x(i)} ${y(v)}`).join(' '),southPath=south.map((v,i)=>`${i?'L':'M'} ${x(i)} ${y(v)}`).join(' ');
 const fill=`${northPath} ${[...south].reverse().map((v,ri)=>`L ${x(south.length-1-ri)} ${y(v)}`).join(' ')} Z`;
 const person=(px:number,py:number,fill='#374151')=><><circle cx={px} cy={py-5} r="4" fill={fill}/><path d={`M ${px-7} ${py+9} Q ${px-6} ${py-1} ${px} ${py-1} Q ${px+6} ${py-1} ${px+7} ${py+9} Z`} fill={fill}/></>;
 const expertFigure=(key:string,px:number,py:number,kind:'normal'|'departed'|'replacement',ring?:'ok'|'spof')=>{
  if(kind==='normal')return <g key={key}>{ring&&<circle cx={px} cy={py} r="21" fill="none" stroke={ring==='spof'?'#fb923c':'#22c55e'} strokeWidth="4"/>}<circle cx={px} cy={py} r="16" fill="#facc15" stroke="#713f12" strokeWidth="1.5"/>{person(px,py)}</g>;
  if(kind==='departed')return <motion.g key={key} initial={{opacity:1}} animate={{opacity:[1,1,0]}} transition={{duration:1.35,delay:3,times:[0,.68,1]}}><circle cx={px} cy={py} r="22" fill="none" stroke="#ef4444" strokeWidth="4"/><motion.circle cx={px} cy={py} r="16" fill="#facc15" stroke="#713f12" strokeWidth="1.5" animate={{r:[16,19,16]}} transition={{duration:.45,delay:3}}/>{person(px,py)}<motion.g initial={{opacity:0}} animate={{opacity:[0,1,1,0]}} transition={{duration:1.35,delay:3,times:[0,.25,.78,1]}}><path d={`M ${px-18} ${py-18} L ${px+18} ${py+18} M ${px+18} ${py-18} L ${px-18} ${py+18}`} stroke="#ef4444" strokeWidth="5" strokeLinecap="round"/></motion.g></motion.g>;
  const rise=y(0)-py;
  return <motion.g key={key} initial={{y:rise,opacity:.25}} animate={{y:0,opacity:1}} transition={{duration:.8,ease:'easeOut'}}><motion.circle cx={px} cy={py} r="16" initial={{fill:'#22c55e'}} animate={{fill:['#22c55e','#22c55e','#facc15']}} transition={{duration:1.15,times:[0,.7,1]}} stroke="#14532d" strokeWidth="1.5"/>{person(px,py)}</motion.g>;
 };
 return <div className="rounded-2xl border border-slate-700 bg-slate-950/90 p-3">
  <div className="flex items-center justify-between gap-3 px-1"><div className="text-[10px] uppercase tracking-[.16em] font-black text-emerald-300">Knowledge River</div><div className="text-[10px] text-slate-500">white · sites &nbsp; yellow · experts &nbsp; ring · expert under test</div></div>
  <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full h-auto" role="img" aria-label="Knowledge River showing current Knowledge Risk impact">
   {[0,2,4,6,8].filter(v=>v<=maxY).map(v=><g key={v}><line x1={padL} x2={W-padR} y1={y(v)} y2={y(v)} stroke="#243047"/><text x={padL-8} y={y(v)+3} textAnchor="end" fill="#64748b" fontSize="9">{v}</text></g>)}
   <path d={fill} fill="#0c4a6e" fillOpacity=".7"/><path d={northPath} fill="none" stroke="#22c55e" strokeWidth="3"/><path d={southPath} fill="none" stroke="#22c55e" strokeWidth="3"/>
   {data.map((d,di)=><g key={d.domain}><text x={x(di)} y={H-11} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="800">{DOMAIN_INFO[d.domain].label}</text>{d.scores.map(({site,score},si)=>{const jitter=(si-(d.scores.length-1)/2)*6;const px=x(di)+jitter;const hit=effect?.kind==='workforce-loss'&&effect.siteId===site.id&&effect.domain===d.domain;if(!hit)return <circle key={site.id} cx={px} cy={y(score)} r="4.3" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5"/>;return <motion.circle key={`${site.id}-loss`} cx={px} r="5" fill="#f8fafc" stroke="#fb7185" strokeWidth="2" initial={{cy:y(effect.previousScore)}} animate={{cy:[y(effect.previousScore),y(effect.previousScore),y(effect.newScore)],r:[5,8,5],fill:['#f8fafc','#fb7185','#f8fafc']}} transition={{duration:.8,times:[0,.24,1],ease:'easeInOut'}}/>})}{expertMarks.filter(m=>m.domain===d.domain).map((m,ei)=>{const same=expertMarks.filter(z=>z.domain===d.domain);const ring=effect?.kind==='expert-check'&&effect.expertId===m.expert.id?effect.status:undefined;return expertFigure(`${m.expert.id}-${d.domain}`,x(di)+(ei-(same.length-1)/2)*38,y(m.score),'normal',ring)})}{departing?.domains.filter(s=>s.domain===d.domain).map((s,ei)=>expertFigure(`depart-${departing.id}-${d.domain}-${ei}`,x(di),y(s.score),'departed'))}{replacement?.domains.filter(s=>s.domain===d.domain).map((s,ei)=>expertFigure(`hire-${replacement.id}-${effect?.kind==='replacement'?effect.siteId:''}-${d.domain}-${ei}`,x(di),y(4),'replacement'))}</g>)}
  </svg>
 </div>;
};
