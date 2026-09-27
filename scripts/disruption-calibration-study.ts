import { mkdirSync, writeFileSync } from 'node:fs';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../src/types/gameV2.ts';
import type { KnowledgeDomain } from '../src/types/game.ts';
import { createNewSessionV2 } from '../src/server/gameServiceV5.ts';
import { drawRoundEventsV2, prepareNextRoundV2, recalculateCompanySPOFV2 } from '../src/engine/coreV2.ts';
import { applyProgressionToCurrentEvents, PROGRAMMED_FAILURE_TAG } from '../src/engine/eventProgressionV5.ts';
import { evaluateEventDomainKnowledgeExplicitV2, resolveSingleEventExplicitV2 } from '../src/engine/challengeResponseV2.ts';
import { evaluateFinalDisruptionV1 } from '../src/engine/disruptionPlusV1.ts';
import { executeInvestmentActionV4, expertTravelCostV4, copMembershipActiveV4 } from '../src/engine/investmentActionsV4.ts';
import { executeRiverKnowledgeSharing } from '../src/engine/riverKnowledgeV1.ts';
import { executeRiskPhaseV4 } from '../src/engine/riskPhaseV4.ts';
import { interventionUnlocked } from '../src/engine/experienceModeV3.ts';

const RUNS_PER_LENGTH=20;
const MIN_ROUNDS=3;
const MAX_ROUNDS=35;
const STARTING_ROUND_MINUTES=[10,9,8,7,6,5,4];
const MIN_ROUND_MINUTES=3;
const DISRUPTION_DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations'];

class RNG {
  constructor(public state:number){}
  next(){this.state=(this.state*1664525+1013904223)>>>0;return this.state/4294967296}
}

interface Profile { name:string; reserve:number; }
const PROFILES:Profile[]=[
  {name:'focused',reserve:.12},
  {name:'balanced',reserve:.18},
  {name:'cautious',reserve:.25},
  {name:'conservative',reserve:.32},
];

type Candidate={type:string;params:any;label:string};
interface RunRow {
  rounds:number;
  modeledMinutes:number;
  run:number;
  profile:string;
  domainA:KnowledgeDomain;
  domainB:KnowledgeDomain;
  scoreA:number;
  scoreB:number;
  lowScore:number;
  highScore:number;
  siteA:number;
  siteB:number;
  intranetA:number;
  intranetB:number;
  expertA:number;
  expertB:number;
  breadthA:number;
  breadthB:number;
  copA:number;
  copB:number;
  turnover:number;
  turnoverRatio:number;
  actionsUsed:number;
  expertDepartures:number;
  siteLosses:number;
}

const mean=(xs:number[])=>xs.reduce((sum,value)=>sum+value,0)/Math.max(1,xs.length);
const percentile=(xs:number[],p:number)=>{
  if(!xs.length)return 0;
  const sorted=[...xs].sort((a,b)=>a-b);
  const index=(sorted.length-1)*p;
  const low=Math.floor(index),high=Math.ceil(index);
  return low===high?sorted[low]:sorted[low]+(sorted[high]-sorted[low])*(index-low);
};
const roundMinutes=(rounds:number)=>Array.from({length:rounds},(_,index)=>index<STARTING_ROUND_MINUTES.length?STARTING_ROUND_MINUTES[index]:MIN_ROUND_MINUTES).reduce((a,b)=>a+b,0);

function companyOf(session:GameSessionV2){return session.companies[0];}

function bestExpert(company:CompanyV2,domain:KnowledgeDomain){
  return company.experts
    .filter(expert=>!expert.isVacant)
    .map(expert=>({expert,score:expert.domains.find(skill=>skill.domain===domain)?.score||0}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score)[0]?.expert;
}

function selectionsFor(session:GameSessionV2){
  const company=companyOf(session);
  const selections:any={};
  for(const req of company.disruptionCard?.domains||[]){
    const expert=bestExpert(company,req.domain);
    selections[req.domain]={expertId:expert?.id};
  }
  return selections;
}

function finalState(session:GameSessionV2,finalRound:number){
  const originalRound=session.round;
  session.round=finalRound;
  const company=companyOf(session);
  const evaluation=evaluateFinalDisruptionV1(session,company,selectionsFor(session));
  session.round=originalRound;
  if(!evaluation)throw new Error('Missing final disruption evaluation');
  return evaluation;
}

function rawDepthAssets(session:GameSessionV2){
  const company=companyOf(session),card=company.disruptionCard!;
  return card.domains.map(req=>{
    const site=company.sites.find(s=>s.id===card.siteId&&!s.isClosed);
    const expert=bestExpert(company,req.domain);
    return{
      domain:req.domain,
      site:site?.teamCapability[req.domain]||0,
      intranet:company.intranet[req.domain]||0,
      expert:expert?.domains.find(skill=>skill.domain===req.domain)?.score||0,
    };
  });
}

function scoreUtility(before:GameSessionV2,after:GameSessionV2,finalRound:number,cost:number){
  const b=finalState(before,finalRound).domainResults;
  const a=finalState(after,finalRound).domainResults;
  const bScores=b.map(x=>x.totalKnowledge),aScores=a.map(x=>x.totalKnowledge);
  const lowerGain=Math.min(...aScores)-Math.min(...bScores);
  const totalGain=aScores.reduce((s,x)=>s+x,0)-bScores.reduce((s,x)=>s+x,0);
  const bAssets=rawDepthAssets(before),aAssets=rawDepthAssets(after);
  let rawGain=0,weakGain=0;
  const weakIndex=bScores[0]<=bScores[1]?0:1;
  for(let i=0;i<aAssets.length;i++){
    const delta=(aAssets[i].site+aAssets[i].intranet+aAssets[i].expert)-(bAssets[i].site+bAssets[i].intranet+bAssets[i].expert);
    rawGain+=delta;
    if(i===weakIndex)weakGain+=delta;
  }
  return lowerGain*120+totalGain*35+weakGain*4+rawGain-cost*.025;
}

function cloneSession(session:GameSessionV2):GameSessionV2{return structuredClone(session);}

function applyCandidate(session:GameSessionV2,candidate:Candidate){
  const company=companyOf(session);
  if(candidate.type==='SITE_KNOWLEDGE_SHARING')return executeRiverKnowledgeSharing(session,company,{type:candidate.type,companyId:company.id,...candidate.params});
  return executeInvestmentActionV4(session,company,{type:candidate.type,companyId:company.id,...candidate.params} as any);
}

function candidatesFor(session:GameSessionV2,totalRounds:number):Candidate[]{
  const company=companyOf(session),card=company.disruptionCard!;
  const targetSite=company.sites.find(site=>site.id===card.siteId&&!site.isClosed);
  const candidates:Candidate[]=[];
  for(const req of card.domains){
    const domain=req.domain;
    const experts=company.experts.filter(expert=>!expert.isVacant&&expert.domains.some(skill=>skill.domain===domain));
    for(const expert of experts){
      if(interventionUnlocked('newbie',session.round,'TRAIN_EXPERT'))candidates.push({type:'TRAIN_EXPERT',params:{expertId:expert.id,domain},label:`train-expert:${domain}:${expert.id}`});
      if(targetSite&&interventionUnlocked('newbie',session.round,'KNOWLEDGE_TRANSFER'))candidates.push({type:'KNOWLEDGE_TRANSFER',params:{siteId:targetSite.id,expertId:expert.id,domain},label:`local-training:${domain}:${expert.id}`});
    }
    if(interventionUnlocked('newbie',session.round,'UPDATE_INTRANET'))candidates.push({type:'UPDATE_INTRANET',params:{domain},label:`intranet:${domain}`});
    if(interventionUnlocked('newbie',session.round,'CORPORATE_TRAINING'))candidates.push({type:'CORPORATE_TRAINING',params:{domain},label:`corporate-training:${domain}`});
    if(targetSite){
      for(const source of company.sites.filter(site=>!site.isClosed&&site.id!==targetSite.id)){
        candidates.push({type:'SITE_KNOWLEDGE_SHARING',params:{sourceSiteId:source.id,siteId:targetSite.id,domain},label:`river:${domain}:${source.id}`});
      }
    }
    if(session.round>=Math.max(2,totalRounds-1)&&interventionUnlocked('newbie',session.round,'JOIN_COP')){
      for(const expert of experts)candidates.push({type:'JOIN_COP',params:{expertId:expert.id,domain},label:`cop:${domain}:${expert.id}`});
    }
    if(interventionUnlocked('newbie',session.round,'LESSONS_LEARNED')){
      for(const event of (session.activeEvents[company.id]||[]).filter(event=>event.isResolved&&!event.experientialLearningAwarded&&event.card.domains.some(r=>r.domain===domain))){
        const siteId=event.card.scope==='local'?event.targetSiteId:targetSite?.id;
        if(!siteId)continue;
        for(const expert of experts)candidates.push({type:'LESSONS_LEARNED',params:{siteId,expertId:expert.id,domain,eventInstanceId:event.instanceId},label:`aar:${domain}:${event.instanceId}:${expert.id}`});
      }
    }
  }
  return candidates;
}

function chooseAndApplyInvestment(session:GameSessionV2,totalRounds:number,initialTurnover:number,profile:Profile){
  const company=companyOf(session);
  const beforeTurnover=company.turnover;
  const reserve=initialTurnover*profile.reserve;
  const candidates=candidatesFor(session,totalRounds);
  let best:{candidate:Candidate;utility:number;trial:GameSessionV2}|null=null;
  for(const candidate of candidates){
    const trial=cloneSession(session);
    const trialCompany=companyOf(trial);
    const result:any=applyCandidate(trial,candidate);
    if(!result?.success)continue;
    const cost=Math.max(0,beforeTurnover-trialCompany.turnover);
    if(trialCompany.turnover<reserve)continue;
    const utility=scoreUtility(session,trial,totalRounds,cost);
    if(utility<=0)continue;
    if(!best||utility>best.utility+1e-9)best={candidate,utility,trial};
  }
  if(!best)return false;
  const result:any=applyCandidate(session,best.candidate);
  return Boolean(result?.success);
}

function allocateEvent(session:GameSessionV2,event:ActiveEventV2,usedExperts:Set<string>){
  const company=companyOf(session);
  for(const req of event.card.domains){
    const allocation:any={useTeamCapability:true,useCorporateIntranet:true,consultantPoints:0};
    const tutorial=event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
    if(!tutorial){
      const expert=company.experts
        .filter(item=>!item.isVacant&&!usedExperts.has(item.id))
        .map(item=>({expert:item,score:item.domains.find(skill=>skill.domain===req.domain)?.score||0}))
        .filter(item=>item.score>0)
        .sort((a,b)=>b.score-a.score)[0]?.expert;
      if(expert){
        allocation.expertId=expert.id;
        if(event.card.scope==='local'&&event.targetSiteId)allocation.expertTravelCost=expertTravelCostV4(expert.location,event.targetSiteId);
        usedExperts.add(expert.id);
      }
      if(copMembershipActiveV4(session,company.id,req.domain))allocation.useCoPSupport=true;
    }
    event.allocations[req.domain]=allocation;
  }
}

function resolveRoundEvents(session:GameSessionV2){
  const company=companyOf(session);
  session.phase='respond';
  const usedExperts=new Set<string>();
  for(const event of (session.activeEvents[company.id]||[]) as ActiveEventV2[]){
    allocateEvent(session,event,usedExperts);
    const tutorial=event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
    let originals:number[]|null=null;
    if(tutorial){
      originals=event.card.domains.map(req=>req.difficulty);
      event.card.domains.forEach(req=>{req.difficulty=99});
    }
    resolveSingleEventExplicitV2(session,company,event);
    if(tutorial&&originals){
      event.card.domains.forEach((req,index)=>{req.difficulty=originals![index]});
      event.success=false;
      if(event.domainResults)event.domainResults.forEach((result:any)=>{result.domainSuccess=false});
    }
    event.isResolved=true;
  }
}

async function simulate(rounds:number,run:number):Promise<RunRow>{
  const seed=7300000+rounds*1000+run;
  const rng=new RNG(seed);
  const realRandom=Math.random;
  Math.random=()=>rng.next();
  try{
    const profile=PROFILES[(run-1)%PROFILES.length];
    const session=await createNewSessionV2(`CAL-${rounds}-${run}`,'Disruption calibration',['Calibration Co'],{experienceMode:'newbie',gameDurationMinutes:60,actionsPerRound:5});
    const company=companyOf(session);
    const initialTurnover=company.turnover;
    let actionsUsed=0,expertDepartures=0,siteLosses=0;

    for(let round=1;round<=rounds;round++){
      session.round=round;
      resolveRoundEvents(session);

      session.phase='investment';
      company.actionsRemaining=session.config.actions_per_round;
      for(let slot=0;slot<session.config.actions_per_round;slot++){
        if(!chooseAndApplyInvestment(session,rounds,initialTurnover,profile))break;
        actionsUsed++;
      }

      const risk=executeRiskPhaseV4(session,company);
      expertDepartures+=risk.departedExperts.length;
      siteLosses+=risk.workforceAttrition.length;

      if(round<rounds){
        session.round=round+1;
        prepareNextRoundV2(session);
        session.activeEvents[company.id]=drawRoundEventsV2(session,company);
        applyProgressionToCurrentEvents(session,company);
      }
    }

    recalculateCompanySPOFV2(company,session.config);
    const evaluation=finalState(session,rounds);
    const [a,b]=evaluation.domainResults;
    return{
      rounds,
      modeledMinutes:roundMinutes(rounds),
      run,
      profile:profile.name,
      domainA:a.domain,
      domainB:b.domain,
      scoreA:a.totalKnowledge,
      scoreB:b.totalKnowledge,
      lowScore:Math.min(a.totalKnowledge,b.totalKnowledge),
      highScore:Math.max(a.totalKnowledge,b.totalKnowledge),
      siteA:a.local,
      siteB:b.local,
      intranetA:a.corporate,
      intranetB:b.corporate,
      expertA:a.expertScore,
      expertB:b.expertScore,
      breadthA:a.breadthBonus,
      breadthB:b.breadthBonus,
      copA:a.copScore,
      copB:b.copScore,
      turnover:company.turnover,
      turnoverRatio:company.turnover/initialTurnover,
      actionsUsed,
      expertDepartures,
      siteLosses,
    };
  }finally{Math.random=realRandom}
}

const rows:RunRow[]=[];
for(let rounds=MIN_ROUNDS;rounds<=MAX_ROUNDS;rounds++){
  for(let run=1;run<=RUNS_PER_LENGTH;run++)rows.push(await simulate(rounds,run));
  const current=rows.filter(row=>row.rounds===rounds);
  console.log(`rounds=${rounds} minutes=${roundMinutes(rounds)} meanLow=${mean(current.map(x=>x.lowScore)).toFixed(2)} meanHigh=${mean(current.map(x=>x.highScore)).toFixed(2)} p60Low=${percentile(current.map(x=>x.lowScore),.60).toFixed(2)} p60High=${percentile(current.map(x=>x.highScore),.60).toFixed(2)}`);
}

const summary=Array.from({length:MAX_ROUNDS-MIN_ROUNDS+1},(_,i)=>MIN_ROUNDS+i).map(rounds=>{
  const r=rows.filter(row=>row.rounds===rounds);
  const domainScores=r.flatMap(row=>[row.scoreA,row.scoreB]);
  return{
    rounds,
    modeledMinutes:roundMinutes(rounds),
    approximateMinutes:Math.round(roundMinutes(rounds)/5)*5,
    games:r.length,
    meanDomainScore:mean(domainScores),
    medianDomainScore:percentile(domainScores,.5),
    p60DomainScore:percentile(domainScores,.6),
    p65DomainScore:percentile(domainScores,.65),
    meanLowScore:mean(r.map(x=>x.lowScore)),
    p60LowScore:percentile(r.map(x=>x.lowScore),.6),
    meanHighScore:mean(r.map(x=>x.highScore)),
    p60HighScore:percentile(r.map(x=>x.highScore),.6),
    meanSite:mean(r.flatMap(x=>[x.siteA,x.siteB])),
    meanIntranet:mean(r.flatMap(x=>[x.intranetA,x.intranetB])),
    meanExpert:mean(r.flatMap(x=>[x.expertA,x.expertB])),
    meanBreadth:mean(r.flatMap(x=>[x.breadthA,x.breadthB])),
    meanCoP:mean(r.flatMap(x=>[x.copA,x.copB])),
    meanTurnoverRatio:mean(r.map(x=>x.turnoverRatio)),
    meanActionsUsed:mean(r.map(x=>x.actionsUsed)),
    meanExpertDepartures:mean(r.map(x=>x.expertDepartures)),
    meanSiteLosses:mean(r.map(x=>x.siteLosses)),
  };
});

mkdirSync('balance-results',{recursive:true});
writeFileSync('balance-results/disruption-calibration.json',JSON.stringify({meta:{generatedAt:new Date().toISOString(),mode:'newbie',runsPerLength:RUNS_PER_LENGTH,minRounds:MIN_ROUNDS,maxRounds:MAX_ROUNDS,roundCadenceMinutes:[10,9,8,7,6,5,4,3],profiles:PROFILES,notes:'Current production engine setup, event progression, depth+breadth scoring, facilitator AAR, SPOF/risk and investment actions. Agent knows its revealed Disruption from the start and prioritises improving the weaker of the two final domains while preserving a strategy-dependent turnover reserve.'},summary,rows},null,2));

const columns=Object.keys(rows[0]) as (keyof RunRow)[];
const csv=[columns.join(','),...rows.map(row=>columns.map(key=>JSON.stringify(row[key])).join(','))].join('\n');
writeFileSync('balance-results/disruption-calibration-runs.csv',csv);

const summaryColumns=Object.keys(summary[0]) as (keyof typeof summary[0])[];
writeFileSync('balance-results/disruption-calibration-summary.csv',[summaryColumns.join(','),...summary.map(row=>summaryColumns.map(key=>String(row[key])).join(','))].join('\n'));

const md=['# Disruption calibration study','',`660 Newbie simulations: 20 games for every round count from 3 to 35. Round cadence is 10, 9, 8, 7, 6, 5, 4, then 3 minutes per round thereafter. The player agent knows its Disruption from the start and deliberately builds capability toward it, while retaining a turnover reserve.`,'','| Rounds | Model min | Mean domain | P60 domain | Mean low | P60 low | Mean high | P60 high |','|---:|---:|---:|---:|---:|---:|---:|---:|',...summary.map(row=>`| ${row.rounds} | ${row.modeledMinutes} | ${row.meanDomainScore.toFixed(2)} | ${row.p60DomainScore.toFixed(2)} | ${row.meanLowScore.toFixed(2)} | ${row.p60LowScore.toFixed(2)} | ${row.meanHighScore.toFixed(2)} | ${row.p60HighScore.toFixed(2)} |`),''].join('\n');
writeFileSync('balance-results/disruption-calibration.md',md);
console.log('\n'+md);
