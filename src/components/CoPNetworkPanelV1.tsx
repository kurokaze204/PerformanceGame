import React,{useMemo,useState}from'react';
import{Handshake,MessageCircle,Send}from'lucide-react';
import type{KnowledgeDomain}from'../types/game.ts';
import{DOMAIN_INFO}from'../types/game.ts';
import type{CompanyV2,GameSessionV2}from'../types/gameV2.ts';
import{companyBestKnowledgeV5,companyHasCopMembershipV5,reciprocalCopPeersV5}from'../engine/copNetworkV5.ts';

interface Props{
  session:GameSessionV2;
  company:CompanyV2;
  domain:KnowledgeDomain;
  onPerformAction:(type:string,params:any)=>void;
}
const DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];

export const CoPNetworkPanelV1:React.FC<Props>=({session,company,domain,onPerformAction})=>{
  const visibleDomains=session.experienceMode==='newbie'?DOMAINS.filter(item=>item!=='finance'):DOMAINS;
  const [contactId,setContactId]=useState('');
  const peers=useMemo(()=>{
    const actual=session.companies.filter(peer=>peer.id!==company.id).map(peer=>({
      id:peer.id,
      name:peer.name,
      simulated:false,
      scores:Object.fromEntries(visibleDomains.map(item=>[item,companyBestKnowledgeV5(session,peer,item)])) as Record<KnowledgeDomain,number>,
      joined:companyHasCopMembershipV5(session,peer.id,domain),
    }));
    if(session.soloMode&&session.soloCopPeer){
      actual.push({
        id:session.soloCopPeer.id,
        name:session.soloCopPeer.name,
        simulated:true,
        scores:session.soloCopPeer.scores,
        joined:true,
      });
    }
    return actual;
  },[session,company.id,domain,visibleDomains.join('|')]);
  const selectedPeer=peers.find(peer=>peer.id===contactId);
  const [draft,setDraft]=useState('');
  const startContact=(peerId:string)=>{
    const peer=peers.find(item=>item.id===peerId);if(!peer)return;
    setContactId(peerId);
    setDraft(session.experienceMode==='newbie'
      ?`Would ${peer.name} be willing to join the general business Community of Practice with us and share knowledge?`
      :`Would ${peer.name} be willing to join the ${DOMAIN_INFO[domain].label} Community of Practice with us and share knowledge?`);
  };
  const send=()=>{
    if(!selectedPeer||!draft.trim())return;
    onPerformAction('COP_MESSAGE',{targetCompanyId:selectedPeer.id,domain:session.experienceMode==='expert'?domain:undefined,message:draft.trim()});
    setDraft('');
  };
  const ownJoined=companyHasCopMembershipV5(session,company.id,domain);
  const reciprocal=reciprocalCopPeersV5(session,company.id,domain);
  const messages=(session.copMessages||[])
    .filter(message=>message.fromCompanyId===company.id||message.toCompanyId===company.id)
    .slice(-10);
  const responseFor=(messageId:string)=>(session.copMessages||[]).find(message=>message.replyToId===messageId&&message.kind==='response');
  const companyName=(id:string)=>id===company.id?company.name:peers.find(peer=>peer.id===id)?.name||session.companies.find(peer=>peer.id===id)?.name||'Other company';

  return <div className="mt-2 space-y-3">
    <div className="rounded-xl border border-violet-700 bg-violet-950/25 p-3">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-black text-white"><Handshake className="h-4 w-4 text-violet-300"/>{session.experienceMode==='newbie'?'General business Community of Practice':`${DOMAIN_INFO[domain].label} Community of Practice`}</div><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Both companies must join before knowledge can be used. Membership costs $5k and one Action for the next Event round. Support closes up to two points of the gap to the strongest reciprocal member, so the knowledge holder may receive little or no direct benefit.</p></div><div className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${reciprocal.length?'border-emerald-600 bg-emerald-950 text-emerald-200':ownJoined?'border-amber-700 bg-amber-950 text-amber-200':'border-slate-700 bg-slate-900 text-slate-400'}`}>{reciprocal.length?'CONNECTED':ownJoined?'WAITING FOR PARTNER':'NOT JOINED'}</div></div>
    </div>

    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/65">
      <table className="w-full min-w-[680px] text-[10px]"><thead><tr className="border-b border-slate-800 text-slate-500"><th className="px-2 py-2 text-left">Company</th>{visibleDomains.map(item=><th key={item} className="px-2 py-2 text-center">{DOMAIN_INFO[item].label}</th>)}<th className="px-2 py-2 text-center">CoP</th><th className="px-2 py-2 text-right">Contact</th></tr></thead><tbody>
        <tr className="border-b border-slate-800 bg-indigo-950/20"><td className="px-2 py-2 font-black text-white">{company.name} <span className="text-indigo-300">YOU</span></td>{visibleDomains.map(item=><td key={item} className="px-2 py-2 text-center font-black text-white">{companyBestKnowledgeV5(session,company,item)}</td>)}<td className="px-2 py-2 text-center">{ownJoined?<span className="text-emerald-300 font-black">JOINED</span>:<span className="text-slate-500">—</span>}</td><td/></tr>
        {peers.map(peer=><tr key={peer.id} className="border-b border-slate-900 last:border-b-0"><td className="px-2 py-2 font-bold text-slate-200">{peer.name}{peer.simulated?<span className="ml-1 text-[8px] uppercase text-violet-300">solo partner</span>:null}</td>{visibleDomains.map(item=><td key={item} className={`px-2 py-2 text-center font-black ${peer.scores[item]>companyBestKnowledgeV5(session,company,item)?'text-emerald-300':peer.scores[item]<companyBestKnowledgeV5(session,company,item)?'text-slate-500':'text-white'}`}>{peer.scores[item]}</td>)}<td className="px-2 py-2 text-center">{peer.joined?<span className="text-emerald-300 font-black">JOINED</span>:<span className="text-slate-500">NOT YET</span>}</td><td className="px-2 py-2 text-right"><button type="button" onClick={()=>startContact(peer.id)} className="rounded-lg border border-violet-700 bg-violet-950 px-2 py-1 font-black text-violet-200"><MessageCircle className="mr-1 inline h-3 w-3"/>CONTACT</button></td></tr>)}
      </tbody></table>
    </div>

    {selectedPeer&&<div className="rounded-xl border border-violet-700 bg-slate-950 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-violet-300">Message {selectedPeer.name}</div><textarea value={draft} onChange={event=>setDraft(event.target.value)} rows={2} maxLength={600} className="mt-2 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white" placeholder="Ask them to join, explain what your company can share, or offer help."/>
<div className="mt-2 flex justify-end"><button type="button" onClick={send} disabled={!draft.trim()} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Send className="mr-1 inline h-3.5 w-3.5"/>SEND</button></div></div>}

    {messages.length>0&&<div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">CoP conversation</div><div className="mt-2 space-y-2">{messages.map(message=>{const outgoing=message.fromCompanyId===company.id;const reply=message.kind==='request'?responseFor(message.id):undefined;const awaiting=!outgoing&&message.kind==='request'&&!reply;return <div key={message.id} className={`rounded-lg border px-3 py-2 text-xs ${outgoing?'ml-8 border-indigo-800 bg-indigo-950/25':'mr-8 border-emerald-800 bg-emerald-950/20'}`}><div className="flex items-center justify-between gap-2"><div className="text-[9px] font-black uppercase text-slate-500">{outgoing?'You':companyName(message.fromCompanyId)} · Round {message.round}</div>{message.response&&<span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase ${message.response==='accepted'?'border-emerald-700 text-emerald-300':'border-rose-800 text-rose-300'}`}>{message.response}</span>}</div><div className="mt-0.5 text-slate-200">{message.message}</div>{awaiting&&<div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>onPerformAction('COP_RESPONSE',{messageId:message.id,response:'accepted'})} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[9px] font-black text-white">YES — WE'LL JOIN</button><button type="button" onClick={()=>onPerformAction('COP_RESPONSE',{messageId:message.id,response:'declined'})} className="rounded-lg border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-[9px] font-black text-slate-300">NOT THIS ROUND</button></div>}{!outgoing&&!awaiting&&message.kind!=='response'&&<button type="button" onClick={()=>startContact(message.fromCompanyId)} className="mt-1 text-[9px] font-black text-violet-300">REPLY</button>}{outgoing&&message.kind==='request'&&reply&&<div className={`mt-1 text-[9px] font-black ${reply.response==='accepted'?'text-emerald-300':'text-rose-300'}`}>{companyName(reply.fromCompanyId)} {reply.response==='accepted'?'is willing to join.':'declined this round.'}</div>}</div>})}</div></div>}
  </div>;
};
