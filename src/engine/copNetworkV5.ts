import type { CoPMembership, DomainScoreMap, KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, GameSessionV2, SoloCoPPeerV1 } from '../types/gameV2.ts';

export const COP_JOIN_COST_V5=5;
export const COP_MEMBERSHIP_ROUNDS_V5=2;
export const COP_GENERAL_DOMAIN_V5='general' as const;
export const COP_DOMAINS_V5:KnowledgeDomain[]=['engineering','hr','marketing','operations','finance'];

const hash=(text:string)=>{
  let value=0;
  for(let i=0;i<text.length;i++)value=((value<<5)-value+text.charCodeAt(i))|0;
  return Math.abs(value);
};
const seeded=(seed:string,index:number,min:number,max:number)=>{
  const span=Math.max(1,max-min+1);
  return min+(hash(`${seed}:${index}`)%span);
};

export function companyBestKnowledgeV5(session:GameSessionV2,company:CompanyV2,domain:KnowledgeDomain):number{
  const siteBest=Math.max(0,...company.sites.filter(site=>!site.isClosed).map(site=>{
    const team=site.teamCapability[domain]||0;
    const codified=session.experienceMode==='expert'?(site.codifiedKnowledge[domain]||0):0;
    return Math.max(team,codified);
  }));
  const expertBest=Math.max(0,...company.experts.filter(expert=>!expert.isVacant).flatMap(expert=>expert.domains.filter(skill=>skill.domain===domain).map(skill=>skill.score)));
  return Math.max(company.intranet[domain]||0,siteBest,expertBest);
}

export function copMembershipMatchesV5(session:GameSessionV2,membership:CoPMembership,companyId:string,domain:KnowledgeDomain):boolean{
  if(membership.companyId!==companyId||membership.activeRound<session.round)return false;
  if(session.experienceMode==='newbie')return membership.scope==='general'||membership.domain===COP_GENERAL_DOMAIN_V5||membership.scope==null;
  return membership.scope!=='general'&&membership.domain===domain;
}

export function companyHasCopMembershipV5(session:GameSessionV2,companyId:string,domain:KnowledgeDomain):boolean{
  return session.copMemberships.some(membership=>copMembershipMatchesV5(session,membership,companyId,domain));
}

export function reciprocalCopPeersV5(session:GameSessionV2,companyId:string,domain:KnowledgeDomain):{id:string;name:string;score:number;simulated?:boolean}[]{
  if(!companyHasCopMembershipV5(session,companyId,domain))return[];
  const peers=session.companies
    .filter(peer=>peer.id!==companyId&&companyHasCopMembershipV5(session,peer.id,domain))
    .map(peer=>({id:peer.id,name:peer.name,score:companyBestKnowledgeV5(session,peer,domain)}));
  if(session.soloMode&&session.soloCopPeer){
    peers.push({id:session.soloCopPeer.id,name:session.soloCopPeer.name,score:session.soloCopPeer.scores[domain]||0,simulated:true});
  }
  return peers;
}

export function copPeerKnowledgeSourceV5(session:GameSessionV2,companyId:string,domain:KnowledgeDomain){
  const peers=reciprocalCopPeersV5(session,companyId,domain).sort((a,b)=>b.score-a.score);
  return peers[0]||null;
}

export function copSupportBonusV5(session:GameSessionV2,company:CompanyV2,domain:KnowledgeDomain,currentDepth:number):number{
  const peer=copPeerKnowledgeSourceV5(session,company.id,domain);
  if(!peer)return 0;
  return Math.max(0,Math.min(session.config.cop_support_bonus,peer.score-currentDepth));
}

export function anyReciprocalCopV5(session:GameSessionV2,companyId:string):boolean{
  const domains=session.experienceMode==='newbie'?COP_DOMAINS_V5.slice(0,4):COP_DOMAINS_V5;
  return domains.some(domain=>reciprocalCopPeersV5(session,companyId,domain).length>0);
}

export function initialiseSoloCoPPeerV5(session:GameSessionV2):SoloCoPPeerV1|null{
  if(!session.soloMode||session.companies.length!==1)return null;
  const company=session.companies[0],card=company.disruptionCard;
  const disruptionDomains=card?.domains.map(item=>item.domain)||[];
  const scores={} as DomainScoreMap;
  COP_DOMAINS_V5.forEach((domain,index)=>{
    const requirement=card?.domains.find(item=>item.domain===domain);
    if(requirement){
      const cap=Math.max(1,requirement.difficulty-2);
      const upper=Math.max(1,Math.min(cap,requirement.difficulty-4));
      scores[domain]=seeded(session.id,index,1,upper);
    }else{
      scores[domain]=seeded(session.id,index,2,5);
    }
  });
  session.soloCopPeer={id:`solo-cop-peer-${session.id.toLowerCase()}`,name:'Meridian Partners',scores,disruptionDomains,lastGrowthRound:session.round};
  return session.soloCopPeer;
}

export function advanceSoloCoPPeerV5(session:GameSessionV2):boolean{
  const peer=session.soloCopPeer;
  if(!session.soloMode||!peer||peer.lastGrowthRound>=session.round)return false;
  peer.lastGrowthRound=session.round;
  if(Math.random()>=0.70)return false;
  const company=session.companies[0],card=company?.disruptionCard;
  const eligible=(card?.domains||[]).filter(item=>(peer.scores[item.domain]||0)<Math.max(1,item.difficulty-2));
  if(!eligible.length)return false;
  const pick=eligible[Math.floor(Math.random()*eligible.length)];
  peer.scores[pick.domain]=Math.min(Math.max(1,pick.difficulty-2),(peer.scores[pick.domain]||0)+1);
  return true;
}

export function soloPeerAutoReplyV5(session:GameSessionV2,domain?:KnowledgeDomain):string{
  const label=domain?domain:'general business';
  const score=domain&&session.soloCopPeer?session.soloCopPeer.scores[domain]:undefined;
  return score!=null
    ? `Happy to stay connected in ${label}. Our current strongest score there is ${score}; if that helps your team, we are willing to share what we know.`
    : 'Happy to join the general business community and share what we can. Let us know where the exchange would be useful.';
}
