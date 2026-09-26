import React,{useMemo}from'react';
import type{Expert,KnowledgeDomain}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,ExperienceMode}from'../types/gameV2.ts';
import{riverSiteKnowledgeScore}from'../engine/riverKnowledgeV1.ts';

interface Props{
 company:CompanyV2;
 mode:ExperienceMode;
 selectedDomain:KnowledgeDomain;
 selectedSiteId?:string;
 sourceSiteId?:string;
 selectedExpertId?:string;
 highlightHQ?:boolean;
 highlightAllSites?:boolean;
 highlightDomain?:boolean;
 showSiteLabels?:boolean;
}

const NEWBIE:KnowledgeDomain[]=['engineering','hr','marketing','operations'];
const EXPERT:KnowledgeDomain[]=[...NEWBIE,'finance'];
const ABBR:Record<string,string>={melbourne:'MEL',sydney:'SYD',brisbane:'BNE',adelaide:'ADL',perth:'PER',darwin:'DRW'};
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();

export const InvestmentRiverView:React.FC<Props>=({company,mode,selectedDomain,selectedSiteId,sourceSiteId,selectedExpertId,highlightHQ=false,highlightAllSites=false,highlightDomain=false,showSiteLabels=false})=>{
 const domains=mode==='expert'?EXPERT:NEWBIE;
 const sites=company.sites.filter(site=>!site.isClosed);
 const experts=company.experts.filter(expert=>!expert.isVacant);
 const data=useMemo(()=>domains.map(domain=>{
   const scores=sites.map(site=>({site,score:riverSiteKnowledgeScore(site,domain,mode)}));
   return{domain,scores,north:Math.max(0,...scores.map(item=>item.score)),south:Math.min(...scores.map(item=>item.score))};
 }),[company,mode]);
 const expertMarks=useMemo(()=>experts.flatMap(expert=>expert.domains.filter(skill=>domains.includes(skill.domain)).map(skill=>({expert,domain:skill.domain,score:skill.score}))),[company,mode]);
 const maxY=Math.max(6,...data.flatMap(item=>item.scores.map(score=>score.score)),...expertMarks.map(mark=>mark.score),...domains.map(domain=>company.intranet[domain]||0));
 const W=900,H=335,padL=56,padR=44,padT=30,padB=52;
 const x=(index:number)=>padL+index*((W-padL-padR)/Math.max(1,domains.length-1));
 const y=(value:number)=>padT+(maxY-value)*((H-padT-padB)/maxY);
 const northPath=data.map((item,index)=>`${index?'L':'M'} ${x(index)} ${y(item.north)}`).join(' ');
 const southPath=data.map((item,index)=>`${index?'L':'M'} ${x(index)} ${y(item.south)}`).join(' ');
 const fill=`${northPath} ${[...data].reverse().map((item,reverseIndex)=>`L ${x(data.length-1-reverseIndex)} ${y(item.south)}`).join(' ')} Z`;
 const domainIndex=domains.indexOf(selectedDomain);
 return <div className="h-full min-h-[260px] rounded-2xl border border-slate-700 bg-slate-950/95 p-3 shadow-inner">
  <div className="flex items-center justify-between gap-3 px-1">
   <div><div className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">Knowledge River</div><div className="text-sm font-black text-white">Where is the knowledge now?</div></div>
   <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500"><span>● Site</span><span className="text-sky-300">◆ HQ</span><span className="text-amber-300">● Expert</span></div>
  </div>
  <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-[calc(100%-42px)] min-h-[220px] w-full" role="img" aria-label="Knowledge River showing sites, corporate knowledge and experts">
   {[0,2,4,6,8].filter(value=>value<=maxY).map(value=><g key={value}><line x1={padL} x2={W-padR} y1={y(value)} y2={y(value)} stroke="#243047"/><text x={padL-9} y={y(value)+4} textAnchor="end" fill="#64748b" fontSize="10">{value}</text></g>)}
   {highlightDomain&&domainIndex>=0&&<rect x={Math.max(padL-42,x(domainIndex)-72)} y={padT-12} width="144" height={H-padT-padB+28} rx="16" fill="#facc15" fillOpacity=".06" stroke="#facc15" strokeOpacity=".38" strokeWidth="2"/>}
   <path d={fill} fill="#0c4a6e" fillOpacity=".72"/><path d={northPath} fill="none" stroke="#22c55e" strokeWidth="3"/><path d={southPath} fill="none" stroke="#22c55e" strokeWidth="3"/>
   {data.map((item,di)=>{
    const domainExperts=expertMarks.filter(mark=>mark.domain===item.domain);
    const domainSelected=item.domain===selectedDomain;
    return <g key={item.domain}>
     <text x={x(di)} y={H-12} textAnchor="middle" fill={domainSelected?'#fde047':'#cbd5e1'} fontSize="13" fontWeight={domainSelected?'900':'700'}>{DOMAIN_INFO[item.domain].label}</text>
     {item.scores.map(({site,score},si)=>{
       const spread=showSiteLabels&&domainSelected?18:7;
       const jitter=(si-(item.scores.length-1)/2)*spread,px=x(di)+jitter;
       const target=domainSelected&&(site.id===selectedSiteId||highlightAllSites);
       const source=domainSelected&&site.id===sourceSiteId;
       const labelVisible=domainSelected&&(showSiteLabels||target||source);
       const labelY=y(score)+(si%2===0?-10:15);
       return <g key={site.id}>
        {(target||source)&&<circle cx={px} cy={y(score)} r="12" fill={source?'#10b981':'#facc15'} fillOpacity=".15" stroke={source?'#34d399':'#fde047'} strokeWidth="3"/>}
        <circle cx={px} cy={y(score)} r={target||source?5.5:4} fill="#f8fafc" stroke={source?'#34d399':target?'#fde047':'#0f172a'} strokeWidth={target||source?2.5:1.5}/>
        {labelVisible&&<text x={px} y={labelY} textAnchor="middle" fill={source?'#6ee7b7':target?'#fde047':'#e2e8f0'} fontSize="9" fontWeight={target||source?'900':'700'} paintOrder="stroke" stroke="#020617" strokeWidth="3">{showSiteLabels?`${site.name} · ${score}`:`${ABBR[site.id]||site.name.slice(0,3).toUpperCase()} · ${score}`}</text>}
       </g>
     })}
     {(()=>{
       const hqScore=company.intranet[item.domain]||0;
       const hqSelected=domainSelected&&highlightHQ;
       const px=x(di)+28;
       const py=y(hqScore);
       return <g>
        {hqSelected&&<circle cx={px} cy={py} r="13" fill="#38bdf8" fillOpacity=".15" stroke="#7dd3fc" strokeWidth="3"/>}
        <rect x={px-5} y={py-5} width="10" height="10" transform={`rotate(45 ${px} ${py})`} fill="#38bdf8" stroke={hqSelected?'#e0f2fe':'#075985'} strokeWidth="2"/>
        {hqSelected&&<text x={px+10} y={py-8} fill="#7dd3fc" fontSize="10" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3">HQ · {hqScore}</text>}
       </g>
     })()}
     {domainExperts.map((mark,ei)=>{
       const px=x(di)+(ei-(domainExperts.length-1)/2)*42,py=y(mark.score);
       const selected=domainSelected&&mark.expert.id===selectedExpertId;
       return <g key={`${mark.expert.id}-${item.domain}`}>
        {selected&&<circle cx={px} cy={py} r="25" fill="#facc15" fillOpacity=".12" stroke="#fde047" strokeWidth="3.5"/>}
        <circle cx={px} cy={py} r="15" fill="#facc15" stroke="#713f12" strokeWidth="1.5"/>
        <circle cx={px} cy={py-5} r="3.7" fill="#374151"/><path d={`M ${px-7} ${py+8} Q ${px-6} ${py} ${px} ${py} Q ${px+6} ${py} ${px+7} ${py+8} Z`} fill="#374151"/>
        {selected&&<text x={px+21} y={py-7} fill="#fde047" fontSize="10" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3">{initials(mark.expert.name)} · {mark.score}</text>}
       </g>
     })}
    </g>
   })}
   <text x="18" y={H/2} textAnchor="middle" fill="#64748b" fontSize="11" transform={`rotate(-90 18 ${H/2})`}>Knowledge level</text>
  </svg>
 </div>;
};
