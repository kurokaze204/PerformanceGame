import type { KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, DisruptionAssignmentV1, GameSessionV2 } from '../types/gameV2.ts';
import { FINAL_DISRUPTION_CARDS } from './cards.ts';
import { copMembershipActiveV4 } from './investmentActionsV4.ts';

const DOMAINS: KnowledgeDomain[] = ['engineering','hr','marketing','operations','finance'];

function hash(text:string):number{
  let value=0;
  for(let i=0;i<text.length;i++)value=((value<<5)-value+text.charCodeAt(i))|0;
  return Math.abs(value);
}

function uniqueExpertDomains(company:CompanyV2):KnowledgeDomain[]{
  return [...new Set(company.experts.filter(e=>!e.isVacant).flatMap(e=>e.domains.map(d=>d.domain)))];
}

function orderedDomains(seed:string, candidates:KnowledgeDomain[]):KnowledgeDomain[]{
  if(!candidates.length)return [...DOMAINS];
  const start=hash(seed)%candidates.length;
  return [...candidates.slice(start),...candidates.slice(0,start)];
}

function disruptionImpact(requirements:{difficulty:number}[]):number{
  const total=requirements.reduce((sum,r)=>sum+r.difficulty,0);
  return 60+(15*total)+(Math.max(0,requirements.length-1)*40);
}

export function dealCompanyDisruptionsV1(session:GameSessionV2):void{
  session.companies.forEach((company,index)=>{
    if(company.disruptionCard)return;
    const sites=company.sites.filter(site=>!site.isClosed);
    const site=sites[hash(`${session.id}:${company.id}:site`)%Math.max(1,sites.length)]||company.sites[0];
    const template=FINAL_DISRUPTION_CARDS[(hash(`${session.id}:${company.id}:template`)+index)%FINAL_DISRUPTION_CARDS.length]||FINAL_DISRUPTION_CARDS[0];
    const eligible=session.experienceMode==='newbie'?uniqueExpertDomains(company):DOMAINS;
    const domains=orderedDomains(`${session.id}:${company.id}:domains`,eligible).slice(0,2);
    while(domains.length<2){
      const next=DOMAINS.find(domain=>!domains.includes(domain));
      if(!next)break;
      domains.push(next);
    }
    const requirements=domains.map((domain,i)=>({domain,difficulty:i===0?9:8}));
    company.disruptionCard={
      id:`${template.id}-${company.id}`,
      title:template.title,
      description:template.description,
      siteId:site?.id||'melbourne',
      siteName:site?.name||'Melbourne',
      domains:requirements,
      impact:disruptionImpact(requirements),
      originalCompanyId:company.id,
      swapCount:0,
    };
    company.disruptionSwapNotice=null;
  });
}

function supportsNewbieCard(company:CompanyV2,card:DisruptionAssignmentV1):boolean{
  const expertDomains=new Set(uniqueExpertDomains(company));
  return card.domains.every(requirement=>expertDomains.has(requirement.domain));
}

export function swapDisruptionWithPeerV1(session:GameSessionV2,companyId:string){
  const company=session.companies.find(c=>c.id===companyId);
  if(!company?.disruptionCard||session.companies.length<2)return null;
  const candidates=session.companies.filter(peer=>{
    if(peer.id===company.id||!peer.disruptionCard)return false;
    if(session.experienceMode!=='newbie')return true;
    return supportsNewbieCard(company,peer.disruptionCard)&&supportsNewbieCard(peer,company.disruptionCard!);
  });
  if(!candidates.length)return null;
  const partner=candidates[hash(`${session.id}:${session.round}:${company.id}:swap`)%candidates.length];
  const companyCard=company.disruptionCard;
  const partnerCard=partner.disruptionCard!;

  company.disruptionCard={...partnerCard,previousCompanyId:partner.id,previousCompanyName:partner.name,swapCount:(partnerCard.swapCount||0)+1};
  partner.disruptionCard={...companyCard,previousCompanyId:company.id,previousCompanyName:company.name,swapCount:(companyCard.swapCount||0)+1};

  company.disruptionSwapNotice={
    fromCompanyId:partner.id,fromCompanyName:partner.name,round:session.round,
    cardTitle:company.disruptionCard.title,siteName:company.disruptionCard.siteName,
    domains:company.disruptionCard.domains.map(d=>d.domain),
  };
  partner.disruptionSwapNotice={
    fromCompanyId:company.id,fromCompanyName:company.name,round:session.round,
    cardTitle:partner.disruptionCard.title,siteName:partner.disruptionCard.siteName,
    domains:partner.disruptionCard.domains.map(d=>d.domain),
  };
  return{companyId:company.id,partnerId:partner.id,companyName:company.name,partnerName:partner.name};
}

function peerOrganisationalKnowledge(session:GameSessionV2,company:CompanyV2,domain:KnowledgeDomain,preferredCompanyId?:string):{score:number;sourceCompanyName?:string}{
  const scoreFor=(peer:CompanyV2)=>{
    const siteBest=Math.max(0,...peer.sites.filter(site=>!site.isClosed).map(site=>{
      const team=site.teamCapability[domain]||0;
      const codified=session.experienceMode==='expert'?(site.codifiedKnowledge[domain]||0):0;
      return Math.max(team,codified);
    }));
    return Math.max(peer.intranet[domain]||0,siteBest);
  };
  const preferred=preferredCompanyId?session.companies.find(peer=>peer.id===preferredCompanyId&&peer.id!==company.id):undefined;
  if(preferred)return{score:scoreFor(preferred),sourceCompanyName:preferred.name};
  const peers=session.companies.filter(peer=>peer.id!==company.id);
  if(!peers.length)return{score:0};
  const ranked=peers.map(peer=>({peer,score:scoreFor(peer)})).sort((a,b)=>b.score-a.score);
  return{score:ranked[0]?.score||0,sourceCompanyName:ranked[0]?.peer.name};
}

export interface FinalDisruptionSelectionV1{expertId?:string}
export type FinalDisruptionSelectionsV1=Partial<Record<KnowledgeDomain,FinalDisruptionSelectionV1>>;

export function evaluateFinalDisruptionV1(session:GameSessionV2,company:CompanyV2,selections:FinalDisruptionSelectionsV1={}){
  const card=company.disruptionCard;
  if(!card)return null;
  const site=company.sites.find(candidate=>candidate.id===card.siteId);
  const domainResults=card.domains.map(requirement=>{
    const domain=requirement.domain;
    const local=site&&!site.isClosed?(site.teamCapability[domain]||0):0;
    const corporate=company.intranet[domain]||0;
    const localCodified=session.experienceMode==='expert'&&site&&!site.isClosed?(site.codifiedKnowledge[domain]||0):0;
    const selectedExpertId=selections[domain]?.expertId;
    const expert=selectedExpertId?company.experts.find(candidate=>!candidate.isVacant&&candidate.id===selectedExpertId&&candidate.domains.some(skill=>skill.domain===domain)):undefined;
    const expertScore=expert?.domains.find(skill=>skill.domain===domain)?.score||0;
    const copActive=copMembershipActiveV4(session,company.id,domain);
    const peer=copActive?peerOrganisationalKnowledge(session,company,domain,card.previousCompanyId):{score:0,sourceCompanyName:undefined};
    const totalKnowledge=local+corporate+localCodified+expertScore+peer.score;
    const gap=Math.max(0,requirement.difficulty-totalKnowledge);
    return{
      domain,difficulty:requirement.difficulty,siteId:card.siteId,siteName:card.siteName,
      local,corporate,localCodified,expertId:expert?.id,expertName:expert?.name,expertScore,
      copScore:peer.score,copSourceCompanyName:peer.sourceCompanyName,totalKnowledge,gap,
    };
  });
  const required=domainResults.reduce((sum,result)=>sum+result.difficulty,0);
  const gap=domainResults.reduce((sum,result)=>sum+result.gap,0);
  const consultantPercent=required>0?80*(gap/required):0;
  const consultantCost=Math.round(company.turnover*(consultantPercent/100));
  return{card,site,domainResults,required,gap,consultantPercent,consultantCost};
}
