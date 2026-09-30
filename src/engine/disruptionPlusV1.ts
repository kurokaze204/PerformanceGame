import type { KnowledgeDomain } from '../types/game.ts';
import type { CompanyV2, DisruptionAssignmentV1, GameSessionV2 } from '../types/gameV2.ts';
import { FINAL_DISRUPTION_CARDS } from './cards.ts';
import { copMembershipActiveV4 } from './investmentActionsV4.ts';
import { copPeerKnowledgeSourceV5, copSupportBonusV5 } from './copNetworkV5.ts';
import { calculateUsableIntranetV2 } from './coreV2.ts';
import { composeKnowledgeSources } from './knowledgeCompositionV1.ts';

const DOMAINS: KnowledgeDomain[] = ['engineering','hr','marketing','operations','finance'];
const NEWBIE_DOMAINS: KnowledgeDomain[] = ['engineering','hr','marketing','operations'];

const ROUND_MINUTES=[10,9,8,7,6,5,4];
const MIN_ROUND_MINUTES=3;

export function estimatedDisruptionRoundsForTimedGameV1(session:GameSessionV2):number{
  const availableMinutes=Math.max(1,(session.gameDurationMinutes||60)-Math.max(0,session.finalWindowMinutes||0));
  let elapsed=0;
  for(let round=1;round<=200;round++){
    elapsed+=round<=ROUND_MINUTES.length?ROUND_MINUTES[round-1]:MIN_ROUND_MINUTES;
    // The Final Challenge is checked at a round boundary, so if the timer enters
    // its final window during a round, that round still completes.
    if(elapsed>=availableMinutes)return Math.max(3,round);
  }
  return 200;
}

export function disruptionStrengthForRoundsV1(rounds:number):{rounds:number;high:number;low:number}{
  const calibratedRounds=Math.max(1,Math.round(rounds));
  const high=Math.max(3,Math.round(9.45+0.385*calibratedRounds));
  return{rounds:calibratedRounds,high,low:Math.max(2,high-1)};
}

export function disruptionStrengthForSessionV1(session:GameSessionV2){
  const rounds=session.experienceMode==='expert'&&session.gameEndMode==='rounds'
    ?Math.max(1,session.finalRoundCount||1)
    :estimatedDisruptionRoundsForTimedGameV1(session);
  return disruptionStrengthForRoundsV1(rounds);
}


function hash(text:string):number{
  let value=0;
  for(let i=0;i<text.length;i++)value=((value<<5)-value+text.charCodeAt(i))|0;
  return Math.abs(value);
}

function uniqueExpertDomains(company:CompanyV2):KnowledgeDomain[]{
  return [...new Set(company.experts.flatMap(e=>e.domains.map(d=>d.domain)))];
}

function orderedDomains(seed:string, candidates:KnowledgeDomain[]):KnowledgeDomain[]{
  if(!candidates.length)return [...DOMAINS];
  const start=hash(seed)%candidates.length;
  return [...candidates.slice(start),...candidates.slice(0,start)];
}

function strategicDomainsForSession(session:GameSessionV2):KnowledgeDomain[]{
  const existing=(session.strategicDisruptionDomains||[]).filter((domain,index,list)=>DOMAINS.includes(domain)&&list.indexOf(domain)===index);
  if(existing.length===3)return existing;
  const pool=session.experienceMode==='newbie'?NEWBIE_DOMAINS:DOMAINS;
  const strategic=orderedDomains(`${session.id}:strategic-disruption-domains`,pool).slice(0,3);
  session.strategicDisruptionDomains=strategic;
  return strategic;
}

function ensureStrategicExpertCoverage(company:CompanyV2,strategic:KnowledgeDomain[]):void{
  const covered=new Set(uniqueExpertDomains(company));
  for(const missing of strategic.filter(domain=>!covered.has(domain))){
    let replaced=false;
    for(const expert of company.experts){
      const skill=expert.domains.find(candidate=>!strategic.includes(candidate.domain));
      if(!skill)continue;
      covered.delete(skill.domain);
      skill.domain=missing;
      covered.add(missing);
      replaced=true;
      break;
    }
    if(!replaced&&company.experts[0]){
      company.experts[0].domains.push({domain:missing,score:company.experts[0].domains[0]?.score||4});
      covered.add(missing);
    }
  }
}

function rotatedSiteIds(session:GameSessionV2):string[]{
  const ids=session.companies[0]?.sites.filter(site=>!site.isClosed).map(site=>site.id)||[];
  if(!ids.length)return[];
  const start=hash(`${session.id}:disruption-sites`)%ids.length;
  return [...ids.slice(start),...ids.slice(0,start)];
}

function disruptionImpact(requirements:{difficulty:number}[]):number{
  const total=requirements.reduce((sum,r)=>sum+r.difficulty,0);
  return 60+(15*total)+(Math.max(0,requirements.length-1)*40);
}

export function dealCompanyDisruptionsV1(session:GameSessionV2):void{
  const strategic=strategicDomainsForSession(session);
  const strength=disruptionStrengthForSessionV1(session);

  const pairs:[[KnowledgeDomain,KnowledgeDomain],[KnowledgeDomain,KnowledgeDomain],[KnowledgeDomain,KnowledgeDomain]]=[
    [strategic[0],strategic[1]],
    [strategic[0],strategic[2]],
    [strategic[1],strategic[2]],
  ];
  const pairStart=hash(`${session.id}:disruption-pairs`)%pairs.length;
  const siteIds=rotatedSiteIds(session);

  session.companies.forEach((company,index)=>{
    if(company.disruptionCard)return;
    ensureStrategicExpertCoverage(company,strategic);
    const siteId=siteIds.length?siteIds[index%siteIds.length]:company.sites[0]?.id;
    const site=company.sites.find(candidate=>candidate.id===siteId&&!candidate.isClosed)||company.sites.find(candidate=>!candidate.isClosed)||company.sites[0];
    const template=FINAL_DISRUPTION_CARDS[(hash(`${session.id}:template`)+index)%FINAL_DISRUPTION_CARDS.length]||FINAL_DISRUPTION_CARDS[0];
    const domains=pairs[(pairStart+index)%pairs.length];
    const requirements=domains.map((domain,i)=>({domain,difficulty:i===0?strength.high:strength.low}));
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

export function refreshCompanyDisruptionStrengthV1(session:GameSessionV2):void{
  const strength=disruptionStrengthForSessionV1(session);
  for(const company of session.companies){
    if(!company.disruptionCard)continue;
    company.disruptionCard.domains=company.disruptionCard.domains.map((requirement,index)=>({
      ...requirement,
      difficulty:index===0?strength.high:strength.low,
    }));
    company.disruptionCard.impact=disruptionImpact(company.disruptionCard.domains);
  }
}

function supportsCard(company:CompanyV2,card:DisruptionAssignmentV1):boolean{
  const expertDomains=new Set(uniqueExpertDomains(company));
  return card.domains.every(requirement=>expertDomains.has(requirement.domain));
}

export function swapDisruptionWithPeerV1(session:GameSessionV2,companyId:string){
  const company=session.companies.find(candidate=>candidate.id===companyId);
  if(!company?.disruptionCard||session.companies.length<2)return null;
  const candidates=session.companies.filter(peer=>{
    if(peer.id===company.id||!peer.disruptionCard)return false;
    return supportsCard(company,peer.disruptionCard)&&supportsCard(peer,company.disruptionCard!);
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
    domains:company.disruptionCard.domains.map(item=>item.domain),
  };
  partner.disruptionSwapNotice={
    fromCompanyId:company.id,fromCompanyName:company.name,round:session.round,
    cardTitle:partner.disruptionCard.title,siteName:partner.disruptionCard.siteName,
    domains:partner.disruptionCard.domains.map(item=>item.domain),
  };
  return{companyId:company.id,partnerId:partner.id,companyName:company.name,partnerName:partner.name};
}

export function finalDisruptionChanceV1(missingPoints:number):number{
  return Math.max(0,Math.min(100,100-23*Math.max(0,Math.floor(missingPoints))));
}

export interface FinalDisruptionSelectionV1{expertId?:string}
export type FinalDisruptionSelectionsV1=Partial<Record<KnowledgeDomain,FinalDisruptionSelectionV1>>;

export function evaluateFinalDisruptionV1(session:GameSessionV2,company:CompanyV2,selections:FinalDisruptionSelectionsV1={}){
  const card=company.disruptionCard;
  if(!card)return null;
  const site=company.sites.find(candidate=>candidate.id===card.siteId);
  const domainResults=card.domains.map(requirement=>{
    const domain=requirement.domain;
    const team=site&&!site.isClosed?(site.teamCapability[domain]||0):0;
    const localCodified=session.experienceMode==='expert'&&site&&!site.isClosed?(site.codifiedKnowledge[domain]||0):0;
    const siteKnowledge=session.experienceMode==='expert'?Math.max(team,localCodified):team;
    const selectedExpertId=selections[domain]?.expertId;
    const expert=selectedExpertId?company.experts.find(candidate=>!candidate.isVacant&&candidate.id===selectedExpertId&&candidate.domains.some(skill=>skill.domain===domain)):undefined;
    const expertScore=expert?.domains.find(skill=>skill.domain===domain)?.score||0;
    const corporateRaw=company.intranet[domain]||0;
    const corporate=site&&!site.isClosed
      ?calculateUsableIntranetV2(company,site,domain,session.config,Boolean(expert))
      :(expert?corporateRaw:0);
    const composed=composeKnowledgeSources([siteKnowledge,corporate,expertScore]);
    const copActive=copMembershipActiveV4(session,company.id,domain);
    const reciprocalPeer=copActive?copPeerKnowledgeSourceV5(session,company.id,domain):null;
    const peer=reciprocalPeer?{score:reciprocalPeer.score,sourceCompanyName:reciprocalPeer.name}:{score:0,sourceCompanyName:undefined};
    const copBonus=copActive?copSupportBonusV5(session,company,domain,composed.depth):0;
    const totalKnowledge=composed.total+copBonus;
    const gap=Math.max(0,requirement.difficulty-totalKnowledge);
    return{
      domain,
      difficulty:requirement.difficulty,
      siteId:card.siteId,
      siteName:card.siteName,
      local:siteKnowledge,
      team,
      localCodified,
      corporate,
      corporateRaw,
      expertId:expert?.id,
      expertName:expert?.name,
      expertScore,
      expertTranslator:Boolean(expert),
      depthKnowledge:composed.depth,
      breadthBonus:composed.breadth,
      sourceCount:composed.sourceCount,
      copScore:copBonus,
      copPeerKnowledge:peer.score,
      copSourceCompanyName:peer.sourceCompanyName,
      totalKnowledge,
      gap,
    };
  });
  const required=domainResults.reduce((sum,result)=>sum+result.difficulty,0);
  const gap=domainResults.reduce((sum,result)=>sum+result.gap,0);
  const consultantPercent=required>0?80*(gap/required):0;
  const consultantCost=Math.round(company.turnover*(consultantPercent/100));
  return{card,site,domainResults,required,gap,consultantPercent,consultantCost};
}
