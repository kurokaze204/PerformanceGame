import React, { useMemo, useState } from 'react';
import type { KnowledgeDomain } from '../types/game.ts';
import { DOMAIN_INFO } from '../types/game.ts';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../types/gameV2.ts';
import { PROGRAMMED_FAILURE_TAG } from '../engine/eventProgressionV5.ts';
import { localCodifiedVisible } from '../engine/learningCurveBalanceV1.ts';
import { EventDecisionCardV4 } from './EventDecisionCardV4.tsx';

interface Props {
  session: GameSessionV2;
  company: CompanyV2;
  event: ActiveEventV2;
  cardNumber: number;
  onSetAllocation: (eventId:string,domain:KnowledgeDomain,allocation:any)=>Promise<void>|void;
  onResolveEvent: (eventId:string)=>Promise<any>;
  onAcknowledgeResolution: (data:any)=>Promise<void>|void;
  onRedrawEvent?: (eventId:string)=>Promise<void>|void;
  canHorizonRedraw?: boolean;
}

export const EventDecisionCardPlaytestV1:React.FC<Props>=(props)=>{
  const {session,company,event,cardNumber,onAcknowledgeResolution}=props;
  const [pendingContinue,setPendingContinue]=useState<any|null>(null);
  const isOpeningLesson=session.experienceMode==='newbie'&&cardNumber===1&&event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
  const lessonKey=`tpg_intranet_unlock_${session.id}_${company.id}`;
  const domain=event.card.domains[0]?.domain;
  const sourceId=event.card.tags?.find(tag=>tag.startsWith('tutorial-source:'))?.slice('tutorial-source:'.length);
  const targetId=event.card.tags?.find(tag=>tag.startsWith('tutorial-target:'))?.slice('tutorial-target:'.length);
  const source=company.sites.find(site=>site.id===sourceId),target=company.sites.find(site=>site.id===targetId);
  const showLocalCodified=localCodifiedVisible(session.experienceMode);
  const scores=useMemo(()=>{
    if(!domain)return {source:0,target:0};
    const score=(site:typeof source)=>site?(showLocalCodified?Math.max(site.teamCapability[domain]||0,site.codifiedKnowledge[domain]||0):(site.teamCapability[domain]||0)):0;
    return {source:score(source),target:score(target)};
  },[domain,source,target,showLocalCodified]);
  const interceptContinue=async(data:any)=>{
    if(isOpeningLesson&&!localStorage.getItem(lessonKey)){setPendingContinue(data);return;}
    await onAcknowledgeResolution(data);
  };
  const finishLesson=async()=>{
    const data=pendingContinue;
    localStorage.setItem(lessonKey,'1');
    setPendingContinue(null);
    await onAcknowledgeResolution(data);
  };
  if(pendingContinue)return <div className="fixed inset-0 z-[170] grid place-items-center bg-black/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="knowledge-gap-title"><div className="w-full max-w-3xl rounded-[28px] border-2 border-violet-400 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,.25),transparent_38%),#0a0f18] p-7 shadow-[0_30px_100px_rgba(0,0,0,.75)]"><div className="text-sm font-black uppercase tracking-[.2em] text-emerald-300">A knowledge gap is not always a knowledge shortage</div><h2 id="knowledge-gap-title" className="mt-3 text-3xl font-black leading-tight text-white">The company knew. {target?.name||'This site'} couldn’t use enough of it.</h2><p className="mt-5 text-lg leading-relaxed text-slate-300">{target?.name||'The affected site'} could reach about <b className="text-white">{scores.target}</b> in {domain?DOMAIN_INFO[domain].label:'the required knowledge'}, while {source?.name||'another site'} already held capability around <b className="text-white">{scores.source}</b>. The knowledge existed inside the organisation, but it was not sufficiently available at the point of decision.</p><div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5"><div className="text-lg font-black text-emerald-200">That is the Performance Gap.</div><p className="mt-2 text-base leading-relaxed text-slate-300">A Corporate Intranet can help move useful knowledge across the organisation. It does not make everyone an expert: people still need enough local capability to recognise, interpret and apply what they find.</p></div><button onClick={finishLesson} className="mt-6 w-full rounded-2xl bg-violet-500 px-5 py-4 text-lg font-black text-white hover:bg-violet-400">CONTINUE TO THE NEXT EVENT</button></div></div>;
  return <EventDecisionCardV4 {...props} onAcknowledgeResolution={interceptContinue}/>;
};
