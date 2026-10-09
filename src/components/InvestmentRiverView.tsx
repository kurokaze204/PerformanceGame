import React,{useMemo,useState}from'react';
import type{Expert,KnowledgeDomain}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,ExperienceMode}from'../types/gameV2.ts';
import{riverSiteKnowledgeScore}from'../engine/riverKnowledgeV1.ts';

export type RiverGhostPreview =
 | {kind:'expert';domain:KnowledgeDomain;expertId:string;delta:number}
 | {kind:'site';domain:KnowledgeDomain;siteId:string;delta:number}
 | {kind:'transfer';domain:KnowledgeDomain;sourceSiteId:string;targetSiteId:string;delta:number}
 | {kind:'threshold';value:number;label:string};

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
 guidedSiteId?:string;
 showSiteLabels?:boolean;
 referenceSiteId?:string;
 referenceHQ?:boolean;
 previewSiteDelta?:number;
 previewExpertDelta?:number;
 previewHQDelta?:number;
 thresholdLine?:{value:number;label:string};
 compact?:boolean;
 ghostPreview?:RiverGhostPreview;
}

const KM_WEEK:KnowledgeDomain[]=['operations','hr','marketing'];
const NEWBIE:KnowledgeDomain[]=['engineering','hr','marketing','operations'];
const EXPERT:KnowledgeDomain[]=[...NEWBIE,'finance'];
const ABBR:Record<string,string>={melbourne:'MEL',sydney:'SYD',brisbane:'BNE',adelaide:'ADL',perth:'PER',darwin:'DRW',HQ:'HQ'};
const firstName=(name:string)=>name.trim().split(/\s+/)[0]||name;
const abbrev=(value:string)=>ABBR[value]||value.slice(0,3).toUpperCase();

export const InvestmentRiverView:React.FC<Props>=({company,mode,selectedDomain,selectedSiteId,sourceSiteId,selectedExpertId,highlightHQ=false,highlightAllSites=false,highlightDomain=false,guidedSiteId,showSiteLabels=false,referenceSiteId,referenceHQ=false,previewSiteDelta=0,previewExpertDelta=0,previewHQDelta=0,thresholdLine,compact=false,ghostPreview})=>{
 const[riverInfoOpen,setRiverInfoOpen]=useState(false);
 const domains=mode==='expert'?EXPERT:mode==='km_week'?KM_WEEK:NEWBIE;
 const sites=company.sites.filter(site=>!site.isClosed);
 const experts=company.experts.filter(expert=>!expert.isVacant);
 const data=useMemo(()=>domains.map(domain=>{
   const scores=sites.map(site=>({site,score:riverSiteKnowledgeScore(site,domain,mode)}));
   return{domain,scores,north:Math.max(0,...scores.map(item=>item.score)),south:Math.min(...scores.map(item=>item.score))};
 }),[company,mode]);
 const expertMarks=useMemo(()=>experts.flatMap(expert=>expert.domains.filter(skill=>domains.includes(skill.domain)).map(skill=>({expert,domain:skill.domain,score:skill.score}))),[company,mode]);
 const selectedSitePreview=selectedSiteId?sites.find(site=>site.id===selectedSiteId)?.teamCapability[selectedDomain]||0:0;
 const selectedExpertPreview=selectedExpertId?expertMarks.find(mark=>mark.expert.id===selectedExpertId&&mark.domain===selectedDomain)?.score||0:0;
 const selectedHQPreview=company.intranet[selectedDomain]||0;
 const rawMax=mode==='km_week'?Math.max(6,...data.flatMap(item=>item.scores.map(score=>score.score)),...expertMarks.map(mark=>mark.score),selectedExpertPreview+previewExpertDelta):Math.max(6,...data.flatMap(item=>item.scores.map(score=>score.score)),...expertMarks.map(mark=>mark.score),...domains.map(domain=>company.intranet[domain]||0),selectedSitePreview+previewSiteDelta,selectedExpertPreview+previewExpertDelta,selectedHQPreview+previewHQDelta);
 const niceStep=(max:number)=>{const raw=Math.max(1,max/4),power=Math.pow(10,Math.floor(Math.log10(raw))),scaled=raw/power;return(scaled<=1?1:scaled<=2?2:scaled<=5?5:10)*power};
 const tickStep=niceStep(rawMax),maxY=Math.max(tickStep,Math.ceil(rawMax/tickStep)*tickStep);
 const ticks=Array.from({length:Math.floor(maxY/tickStep)+1},(_,index)=>index*tickStep);
 const W=mode==='km_week'&&!compact?660:920,H=350,padL=64,padR=92,padT=34,padB=58;
 const x=(index:number)=>padL+index*((W-padL-padR)/Math.max(1,domains.length-1));
 const y=(value:number)=>padT+(maxY-value)*((H-padT-padB)/maxY);
 const riverLeft=x(0)-40,riverRight=x(domains.length-1)+40;
 const northPath=`M ${riverLeft} ${y(data[0].north)} ${data.map((item,index)=>`L ${x(index)} ${y(item.north)}`).join(' ')} L ${riverRight} ${y(data[data.length-1].north)}`;
 const southPath=`M ${riverLeft} ${y(data[0].south)} ${data.map((item,index)=>`L ${x(index)} ${y(item.south)}`).join(' ')} L ${riverRight} ${y(data[data.length-1].south)}`;
 const fill=`${northPath} L ${riverRight} ${y(data[data.length-1].south)} ${[...data].reverse().map((item,reverseIndex)=>`L ${x(data.length-1-reverseIndex)} ${y(item.south)}`).join(' ')} L ${riverLeft} ${y(data[0].south)} Z`;
 const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
 const spreadLabelYs=(preferred:number[],gap=17)=>{if(!preferred.length)return[] as number[];const min=padT+10,max=H-padB-8;const ordered=preferred.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value);const placed=ordered.map(item=>item.value);for(let i=0;i<placed.length;i++)placed[i]=Math.max(i?placed[i-1]+gap:min,Math.max(min,placed[i]));if(placed[placed.length-1]>max){placed[placed.length-1]=max;for(let i=placed.length-2;i>=0;i--)placed[i]=Math.min(placed[i],placed[i+1]-gap)}const result=Array(preferred.length).fill(0);ordered.forEach((item,index)=>{result[item.index]=placed[index]});return result};
 const domainIndex=domains.indexOf(selectedDomain);
 const referenceSite=referenceSiteId?sites.find(site=>site.id===referenceSiteId):undefined;
 const referencePath=referenceHQ?data.map((item,di)=>`${di?'L':'M'} ${x(di)+28} ${y(company.intranet[item.domain]||0)}`).join(' '):referenceSite?data.map((item,di)=>{const si=item.scores.findIndex(entry=>entry.site.id===referenceSite.id);if(si<0)return'';const domainSelected=item.domain===selectedDomain;const siteSpread=showSiteLabels&&domainSelected?18:9;const px=clamp(x(di)+(si-(item.scores.length-1)/2)*siteSpread,padL+6,W-padR-6);return `${di?'L':'M'} ${px} ${y(item.scores[si].score)}`}).filter(Boolean).join(' '):'';
 return <div className={`${compact?'h-full min-h-[170px] rounded-xl p-2':'h-full min-h-[260px] rounded-2xl p-3'} relative border border-slate-700 bg-slate-950/95 shadow-inner`}>
  {!compact&&<div className="flex items-center justify-between gap-3 px-1">
   <div><div className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">Knowledge River</div><div className="text-sm font-black text-white">Where is the knowledge now?</div></div>
   <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500"><span className="text-slate-50">● Site</span>{mode!=='km_week'&&<span className="text-sky-300">◆ HQ</span>}<span className="text-amber-300">● Expert</span>{thresholdLine&&<span className="text-yellow-300">┄ Shock cut-off</span>}</div>
  </div>}
  <svg viewBox={`0 0 ${W} ${H}`} className={`${compact?'h-full min-h-[150px]':'mt-1 h-[calc(100%-42px)] min-h-[220px]'} w-full`} role="img" aria-label="Knowledge River showing sites, corporate knowledge and experts">
   {ghostPreview&&<defs><filter id="kmw-blue-ghost-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>}
   {ticks.map(value=><g key={value}><line x1={padL} x2={W-padR} y1={y(value)} y2={y(value)} stroke="#243047"/><text x={padL-9} y={y(value)+4} textAnchor="end" fill="#64748b" fontSize="13" fontWeight="700">{value}</text></g>)}
   {highlightDomain&&domainIndex>=0&&<rect x={Math.max(padL-42,x(domainIndex)-72)} y={padT-12} width="144" height={H-padT-padB+28} rx="16" fill="#facc15" fillOpacity=".06" stroke="#facc15" strokeOpacity=".38" strokeWidth="2"/>}
   <path d={fill} fill="#0c4a6e" fillOpacity=".72"/><path d={northPath} fill="none" stroke="#22c55e" strokeWidth="3"/><path d={southPath} fill="none" stroke="#22c55e" strokeWidth="3"/>
   {thresholdLine&&<g data-kmw-shock-cutoff>
    <line x1={padL} x2={W-padR} y1={y(thresholdLine.value)} y2={y(thresholdLine.value)} stroke="#facc15" strokeWidth="9" strokeOpacity=".10"/>
    <line x1={padL} x2={W-padR} y1={y(thresholdLine.value)} y2={y(thresholdLine.value)} stroke="#fde047" strokeWidth="3" strokeDasharray="10 8"/>
    <rect x={W-padR-145} y={y(thresholdLine.value)-25} width="140" height="20" rx="10" fill="#422006" stroke="#facc15" strokeWidth="1.5"/>
    <text x={W-padR-75} y={y(thresholdLine.value)-11} textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="900">{thresholdLine.label}</text>
   </g>}
   {ghostPreview?.kind==='threshold'&&<g data-kmw-score-ghost="threshold" filter="url(#kmw-blue-ghost-glow)">
    <line x1={padL} x2={W-padR} y1={y(ghostPreview.value)} y2={y(ghostPreview.value)} stroke="#38bdf8" strokeWidth="3" strokeDasharray="9 8" opacity=".92"/>
    <text x={W-padR-8} y={y(ghostPreview.value)-9} textAnchor="end" fill="#7dd3fc" fontSize="11" fontWeight="900">{ghostPreview.label}</text>
   </g>}
   {referencePath&&<><path d={referencePath} fill="none" stroke="#fde047" strokeWidth="9" strokeOpacity=".12" strokeLinecap="round" strokeLinejoin="round"/><path d={referencePath} fill="none" stroke="#fde047" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round"/></>}
   {data.map((item,di)=>{
    const domainExperts=expertMarks.filter(mark=>mark.domain===item.domain);
    const domainSelected=item.domain===selectedDomain;
    const siteSpread=showSiteLabels&&domainSelected?18:9;
    const sitePoints=item.scores.map(({score},si)=>({px:clamp(x(di)+(si-(item.scores.length-1)/2)*siteSpread,padL+6,W-padR-6),py:y(score)}));
    const expertPoints=domainExperts.map((mark,ei)=>({px:clamp(x(di)+(ei-(domainExperts.length-1)/2)*54,padL+26,W-padR-26),py:y(mark.score)}));
    const transferGhost=ghostPreview?.kind==='transfer'&&ghostPreview.domain===item.domain?(()=>{
      const sourceIndex=item.scores.findIndex(entry=>entry.site.id===ghostPreview.sourceSiteId);
      const targetIndex=item.scores.findIndex(entry=>entry.site.id===ghostPreview.targetSiteId);
      if(sourceIndex<0||targetIndex<0)return null;
      const sourceScore=item.scores[sourceIndex].score;
      const targetScore=item.scores[targetIndex].score;
      const sourcePoint=sitePoints[sourceIndex],targetPoint=sitePoints[targetIndex];
      const targetY=y(Math.min(5,targetScore+ghostPreview.delta));
      const bendX=(sourcePoint.px+targetPoint.px)/2;
      const bendY=Math.min(sourcePoint.py,targetY)-42;
      return{sourcePoint,targetPoint,targetY,path:`M ${sourcePoint.px} ${sourcePoint.py} Q ${bendX} ${bendY} ${targetPoint.px} ${targetY}`};
    })():null;
    const labelYs=spreadLabelYs([...sitePoints.map(point=>point.py-10),...expertPoints.map(point=>point.py-4)]);
    return <g key={item.domain}>
     {transferGhost&&<g data-kmw-score-ghost="flow" filter="url(#kmw-blue-ghost-glow)">
      <path d={transferGhost.path} fill="none" stroke="#38bdf8" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round" opacity=".9"/>
      <circle cx={transferGhost.targetPoint.px} cy={transferGhost.targetY} r="8" fill="#082f49" stroke="#7dd3fc" strokeWidth="2.5" strokeDasharray="4 3"/>
     </g>}
     <text x={x(di)} y={H-12} textAnchor="middle" fill={domainSelected?'#fde047':'#cbd5e1'} fontSize="15" fontWeight={domainSelected?'900':'800'}>{DOMAIN_INFO[item.domain].label}</text>
     {item.scores.map(({site,score},si)=>{
       const {px,py}=sitePoints[si];
       const target=domainSelected&&(site.id===selectedSiteId||highlightAllSites);
       const source=domainSelected&&site.id===sourceSiteId;
       const reference=!referenceHQ&&site.id===referenceSiteId;
       const rightEdge=px>W-padR-58;
       const labelX=rightEdge?px-10:px+10;
       const labelAnchor=rightEdge?'end':'start';
       const guidedSite=mode==='km_week'&&domainSelected&&site.id===guidedSiteId;
       const siteGhost=ghostPreview?.kind==='site'&&ghostPreview.domain===item.domain&&ghostPreview.siteId===site.id&&ghostPreview.delta>0;
       const siteGhostY=siteGhost?y(Math.min(5,score+ghostPreview.delta)):py;
       return <g key={site.id} className="kmw-river-motion" data-river-target={`site:${site.id}:${item.domain}`}>
        {guidedSite&&<circle className="kmw-guided-site-pulse" data-kmw-guided-site={site.id} cx={px} cy={py} r="17" fill="#082f49" fillOpacity=".20" stroke="#38bdf8" strokeWidth="3" strokeDasharray="5 5"/>}
        {siteGhost&&<g data-kmw-score-ghost="local" filter="url(#kmw-blue-ghost-glow)"><line x1={px} y1={py} x2={px} y2={siteGhostY} stroke="#38bdf8" strokeWidth="3" strokeDasharray="6 5"/><circle cx={px} cy={siteGhostY} r="8" fill="#082f49" stroke="#7dd3fc" strokeWidth="2.5" strokeDasharray="4 3"/></g>}
        {(target||source||reference)&&<circle cx={px} cy={py} r="12" fill={source?'#10b981':'#facc15'} fillOpacity=".15" stroke={source?'#34d399':'#fde047'} strokeWidth="3"/>}
        {target&&previewSiteDelta>0&&<><line x1={px} y1={py} x2={px} y2={y(score+previewSiteDelta)} stroke="#fde047" strokeWidth="2" strokeDasharray="4 3"/><circle cx={px} cy={y(score+previewSiteDelta)} r="7" fill="#0f172a" stroke="#fde047" strokeWidth="2" strokeDasharray="3 2"/><text x={px+10} y={y(score+previewSiteDelta)-5} fill="#fde047" fontSize="12" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3">+{previewSiteDelta}</text></>}
        <circle cx={px} cy={py} r={target||source||reference?6:5} fill="#f8fafc" stroke={source?'#34d399':target||reference?'#fde047':'#0f172a'} strokeWidth={target||source||reference?2.5:1.8}/>
        <text x={labelX} y={labelYs[si]} textAnchor={labelAnchor} fill={source?'#6ee7b7':target?'#fde047':'#f8fafc'} fontSize="13" fontWeight={target||source?'900':'800'} paintOrder="stroke" stroke="#020617" strokeWidth="3" strokeLinejoin="round">{abbrev(site.id)}</text>
       </g>
     })}
     {mode!=='km_week'&&(()=>{
       const hqScore=company.intranet[item.domain]||0;
       const hqSelected=domainSelected&&highlightHQ;
       const hqReference=referenceHQ;
       const px=x(di)+28;
       const py=y(hqScore);
       return <g>
        {(hqSelected||hqReference)&&<circle cx={px} cy={py} r="13" fill={hqReference?'#facc15':'#38bdf8'} fillOpacity=".15" stroke={hqReference?'#fde047':'#7dd3fc'} strokeWidth="3"/>}
        {hqSelected&&previewHQDelta>0&&<><line x1={px} y1={py} x2={px} y2={y(hqScore+previewHQDelta)} stroke="#7dd3fc" strokeWidth="2" strokeDasharray="4 3"/><rect x={px-6} y={y(hqScore+previewHQDelta)-6} width="12" height="12" transform={`rotate(45 ${px} ${y(hqScore+previewHQDelta)})`} fill="#0f172a" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="3 2"/><text x={px+13} y={y(hqScore+previewHQDelta)-6} fill="#7dd3fc" fontSize="12" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3">+{previewHQDelta}</text></>}
        <rect x={px-5} y={py-5} width="10" height="10" transform={`rotate(45 ${px} ${py})`} fill="#38bdf8" stroke={hqReference?'#fde047':hqSelected?'#e0f2fe':'#075985'} strokeWidth={hqReference?2.5:2}/>
        {hqSelected&&<text x={px+10} y={py-8} fill="#7dd3fc" fontSize="13" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3">HQ · {hqScore}</text>}
       </g>
     })()}
     {domainExperts.map((mark,ei)=>{
       const {px,py}=expertPoints[ei];
       const selected=domainSelected&&mark.expert.id===selectedExpertId;
       const rightEdge=px>W-padR-120;
       const labelX=rightEdge?px-26:px+26;
       const labelAnchor=rightEdge?'end':'start';
       const loc=abbrev(mark.expert.location);
       const expertGhost=ghostPreview?.kind==='expert'&&ghostPreview.domain===item.domain&&ghostPreview.expertId===mark.expert.id&&ghostPreview.delta>0;
       const expertGhostY=expertGhost?y(Math.min(mode==='km_week'?6:5,mark.score+ghostPreview.delta)):py;
       return <g key={`${mark.expert.id}-${item.domain}`} className="kmw-river-motion" data-river-target={`expert:${mark.expert.id}:${item.domain}`}>
        {expertGhost&&<g data-kmw-score-ghost="expertise" filter="url(#kmw-blue-ghost-glow)"><line x1={px} y1={py} x2={px} y2={expertGhostY} stroke="#38bdf8" strokeWidth="3" strokeDasharray="6 5"/><circle cx={px} cy={expertGhostY} r="18" fill="#082f49" fillOpacity=".72" stroke="#7dd3fc" strokeWidth="2.5" strokeDasharray="5 4"/></g>}
        {selected&&<circle cx={px} cy={py} r="25" fill="#facc15" fillOpacity=".12" stroke="#fde047" strokeWidth="3.5"/>}
        {selected&&previewExpertDelta>0&&<><line x1={px} y1={py} x2={px} y2={y(mark.score+previewExpertDelta)} stroke="#fde047" strokeWidth="2" strokeDasharray="4 3"/><circle cx={px} cy={y(mark.score+previewExpertDelta)} r="17" fill="#0f172a" stroke="#fde047" strokeWidth="2" strokeDasharray="3 2"/><text x={px+22} y={y(mark.score+previewExpertDelta)-7} fill="#fde047" fontSize="12" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3">+{previewExpertDelta}</text></>}
        <circle cx={px} cy={py} r="16" fill="#facc15" stroke="#713f12" strokeWidth="1.5"/>
        <circle cx={px} cy={py-5} r="4" fill="#374151"/><path d={`M ${px-7} ${py+9} Q ${px-6} ${py-1} ${px} ${py-1} Q ${px+6} ${py-1} ${px+7} ${py+9} Z`} fill="#374151"/>
        <text x={labelX} y={labelYs[item.scores.length+ei]} textAnchor={labelAnchor} fill="#fde047" fontSize="13" fontWeight="900" paintOrder="stroke" stroke="#020617" strokeWidth="3" strokeLinejoin="round">{firstName(mark.expert.name)} · {loc}</text>
       </g>
     })}
    </g>
   })}
   <text x="18" y={H/2} textAnchor="middle" fill="#64748b" fontSize="14" fontWeight="700" transform={`rotate(-90 18 ${H/2})`}>Knowledge level</text>
  </svg>
  {riverInfoOpen&&<div role="dialog" aria-label="About the River diagram" className="absolute bottom-12 right-3 z-30 w-[min(340px,calc(100%-24px))] rounded-xl border-2 border-sky-700 bg-[#0b1220]/98 p-3 text-left shadow-[0_16px_40px_rgba(0,0,0,.55)]">
   <div className="text-[9px] font-black uppercase tracking-[.14em] text-sky-300">About The River</div>
   <p className="mt-1 text-[11px] leading-relaxed text-slate-200">To learn more about The River diagram and how to use it to manage your knowledge, check out Chris Collison and Geoff Parcell&apos;s book <b className="text-white">&apos;No more consultants&apos;</b>.</p>
  </div>}
  <button type="button" aria-label="About the River diagram" aria-expanded={riverInfoOpen} onClick={()=>setRiverInfoOpen(open=>!open)} className="absolute bottom-3 right-3 z-40 grid h-8 w-8 place-items-center rounded-full border-2 border-sky-500 bg-slate-950/95 text-sm font-black italic text-sky-200 shadow-lg hover:border-sky-300 hover:text-white">i</button>
 </div>;
};
