import { mkdirSync, writeFileSync } from 'node:fs';
import type { ActiveEventV2, CompanyV2, GameSessionV2 } from '../src/types/gameV2.ts';
import type { KnowledgeDomain } from '../src/types/game.ts';
import { createNewSessionV2 } from '../src/server/gameServiceV5.ts';
import { drawRoundEventsV2, prepareNextRoundV2, recalculateCompanySPOFV2 } from '../src/engine/coreV2.ts';
import { applyProgressionToCurrentEvents, PROGRAMMED_FAILURE_TAG } from '../src/engine/eventProgressionV5.ts';
import { evaluateFinalDisruptionV1 } from '../src/engine/disruptionPlusV1.ts';
import { executeInvestmentActionV4, recordPublicationEvidenceV4 } from '../src/engine/investmentActionsV4.ts';
import { executeRiverKnowledgeSharing } from '../src/engine/riverKnowledgeV1.ts';
import { executeRiskPhaseV4 } from '../src/engine/riskPhaseV4.ts';
import { interventionUnlocked } from '../src/engine/experienceModeV3.ts';

const RUNS_PER_LENGTH=20;
const MIN_ROUNDS=3;
const MAX_ROUNDS=35;
const CONFIRMATION_ROUNDS=[3,6,10,15,20,25,30,35];
const CONFIRMATION_RUNS=100;
const STARTING_ROUND_MINUTES=[10,9,8,7,6,5,4];
const MIN_ROUND_MINUTES=3;
const DISRUPTION_DOMAINS:KnowledgeDomain[]=['engineering','hr','marketing','operations'];

class RNG {
  constructor(public state:number){}
  next(){this.state=(this.state*1664525+1013904223)>>>0;return this.state/4294967296}
}

interface Profile { name:string; disruptionActionsPerRound:number; }
const PROFILES:Profile[]=[
  {name:'light-focus',disruptionActionsPerRound:1},
  {name:'moderate-focus',disruptionActionsPerRound:2},
  {name:'strong-focus',disruptionActionsPerRound:3},
  {name:'very-strong-focus',disruptionActionsPerRound:4},
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

function scoreUtility(before:GameSessionV2,after:GameSessionV2,finalRound:number){
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
  return lowerGain*120+totalGain*35+weakGain*4+rawGain;
}

function cloneSession(session:GameSessionV2):GameSessionV2{return structuredClone(session);}

function applyCandidate(session:GameSessionV2,candidate:Candidate){
  const company=companyOf(session);
  const turnover=company.turnover;
  const siteTurnovers=new Map(company.sites.map(site=>[site.id,site.turnover]));
  const result=candidate.type==='SITE_KNOWLEDGE_SHARING'
    ?executeRiverKnowledgeSharing(session,company,{type:candidate.type,companyId:company.id,...candidate.params})
    :executeInvestmentActionV4(session,company,{type:candidate.type,companyId:company.id,...candidate.params} as any);
  // This rig calibrates attainable knowledge, not economic survivability. Reimburse
  // investment spend so long-horizon results are not dominated by event/turnover compounding.
  company.turnover=turnover;
  company.sites.forEach(site=>{site.turnover=siteTurnovers.get(site.id)??site.turnover});
  return result;
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

function chooseAndApplyInvestment(session:GameSessionV2,totalRounds:number){
  const candidates=candidatesFor(session,totalRounds);
  let best:{candidate:Candidate;utility:number}|null=null;
  for(const candidate of candidates){
    const trial=cloneSession(session);
    const result:any=applyCandidate(trial,candidate);
    if(!result?.success)continue;
    const utility=scoreUtility(session,trial,totalRounds);
    if(utility<=0)continue;
    if(!best||utility>best.utility+1e-9)best={candidate,utility};
  }
  if(!best)return false;
  const result:any=applyCandidate(session,best.candidate);
  return Boolean(result?.success);
}

function resolveRoundEvents(session:GameSessionV2){
  const company=companyOf(session);
  session.phase='respond';
  for(const event of (session.activeEvents[company.id]||[]) as ActiveEventV2[]){
    event.isResolved=true;
    event.success=!event.card.tags?.includes(PROGRAMMED_FAILURE_TAG);
    const evidence=event.card.tags?.some(tag=>['critical','safety','site-threatening','specialist','novel'].includes(tag))?2:1;
    for(const req of event.card.domains)recordPublicationEvidenceV4(company,req.domain,evidence);
  }
}

async function simulate(rounds:number,run:number,seedOffset=0):Promise<RunRow>{
  const seed=7300000+seedOffset+rounds*1000+run;
  const rng=new RNG(seed);
  const realRandom=Math.random;
  Math.random=()=>rng.next();
  try{
    const profile=PROFILES[(run-1)%PROFILES.length];
    const session=await createNewSessionV2(`CAL-${seedOffset}-${rounds}-${run}`,'Disruption calibration',['Calibration Co'],{experienceMode:'newbie',gameDurationMinutes:60,actionsPerRound:5});
    const company=companyOf(session);
    const initialTurnover=company.turnover;
    let actionsUsed=0,expertDepartures=0,siteLosses=0;

    for(let round=1;round<=rounds;round++){
      session.round=round;
      resolveRoundEvents(session);

      session.phase='investment';
      company.actionsRemaining=session.config.actions_per_round;
      for(let slot=0;slot<profile.disruptionActionsPerRound;slot++){
        if(!chooseAndApplyInvestment(session,rounds))break;
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

function isotonicNonDecreasing(values:number[]):number[]{
  const blocks=values.map((value,index)=>({start:index,end:index,weight:1,value}));
  for(let i=0;i<blocks.length-1;){
    if(blocks[i].value<=blocks[i+1].value+1e-9){i++;continue}
    const left=blocks[i],right=blocks[i+1],weight=left.weight+right.weight;
    blocks.splice(i,2,{start:left.start,end:right.end,weight,value:(left.value*left.weight+right.value*right.weight)/weight});
    if(i>0)i--;
  }
  const result=Array(values.length).fill(0);
  for(const block of blocks)for(let i=block.start;i<=block.end;i++)result[i]=block.value;
  return result;
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

const smoothedP60=isotonicNonDecreasing(summary.map(row=>row.p60DomainScore));
const candidateTable=summary.map((row,index)=>{
  const smoothed=smoothedP60[index];
  const high=Math.max(3,Math.ceil(smoothed));
  const low=Math.max(3,high-1);
  return{rounds:row.rounds,modeledMinutes:row.modeledMinutes,smoothedP60:smoothed,high,low};
});
for(let i=0;i<summary.length;i++)Object.assign(summary[i],{
  smoothedP60DomainScore:candidateTable[i].smoothedP60,
  candidateHigh:candidateTable[i].high,
  candidateLow:candidateTable[i].low,
});

interface ConfirmationRow extends RunRow {
  targetHigh:number;
  targetLow:number;
  gapA:number;
  gapB:number;
  totalGap:number;
  chanceWithoutConsultant:number;
  consultantPercent:number;
  outright:boolean;
}

const confirmationRows:ConfirmationRow[]=[];
for(const rounds of CONFIRMATION_ROUNDS){
  const candidate=candidateTable.find(row=>row.rounds===rounds)!;
  for(let run=1;run<=CONFIRMATION_RUNS;run++){
    const row=await simulate(rounds,run,2000000);
    const gapA=Math.max(0,candidate.high-row.scoreA);
    const gapB=Math.max(0,candidate.low-row.scoreB);
    const totalGap=gapA+gapB;
    const required=candidate.high+candidate.low;
    confirmationRows.push({
      ...row,
      targetHigh:candidate.high,
      targetLow:candidate.low,
      gapA,
      gapB,
      totalGap,
      chanceWithoutConsultant:Math.max(0,100-23*totalGap),
      consultantPercent:required>0?80*(totalGap/required):0,
      outright:totalGap===0,
    });
  }
}

const confirmation=CONFIRMATION_ROUNDS.map(rounds=>{
  const r=confirmationRows.filter(row=>row.rounds===rounds);
  const candidate=candidateTable.find(row=>row.rounds===rounds)!;
  return{
    rounds,
    modeledMinutes:roundMinutes(rounds),
    targetHigh:candidate.high,
    targetLow:candidate.low,
    games:r.length,
    outrightRate:r.filter(row=>row.outright).length/r.length,
    gap1Rate:r.filter(row=>row.totalGap===1).length/r.length,
    gap2Rate:r.filter(row=>row.totalGap===2).length/r.length,
    gap3PlusRate:r.filter(row=>row.totalGap>=3).length/r.length,
    meanGap:mean(r.map(row=>row.totalGap)),
    meanChanceWithoutConsultant:mean(r.map(row=>row.chanceWithoutConsultant)),
    consultantNeededRate:r.filter(row=>row.totalGap>0).length/r.length,
    meanConsultantPercent:mean(r.map(row=>row.consultantPercent)),
    meanExpertDepartures:mean(r.map(row=>row.expertDepartures)),
    meanSiteLosses:mean(r.map(row=>row.siteLosses)),
    meanScoreA:mean(r.map(row=>row.scoreA)),
    meanScoreB:mean(r.map(row=>row.scoreB)),
  };
});

mkdirSync('balance-results',{recursive:true});
writeFileSync('balance-results/disruption-calibration.json',JSON.stringify({meta:{generatedAt:new Date().toISOString(),mode:'newbie',runsPerLength:RUNS_PER_LENGTH,confirmationRuns:CONFIRMATION_RUNS,confirmationRounds:CONFIRMATION_ROUNDS,minRounds:MIN_ROUNDS,maxRounds:MAX_ROUNDS,roundCadenceMinutes:[10,9,8,7,6,5,4,3],profiles:PROFILES,notes:'Knowledge-only calibration using the current production starting state, event/domain stream, depth+breadth scoring, facilitator AAR, SPOF/risk and investment mechanics. Five Actions remain available each round, but the four player profiles devote 1, 2, 3 or 4 of them to the known Disruption; the remaining Actions are assumed to serve other business priorities. Investment and Event financial effects are excluded so long-horizon scores measure knowledge growth rather than compounding turnover. Candidate card strengths are derived by isotonic smoothing of the 60th percentile domain score, rounding the stronger requirement up and setting the second domain one point lower.'},summary,candidateTable,confirmation,rows,confirmationRows},null,2));

const columns=Object.keys(rows[0]) as (keyof RunRow)[];
const csv=[columns.join(','),...rows.map(row=>columns.map(key=>JSON.stringify(row[key])).join(','))].join('\n');
writeFileSync('balance-results/disruption-calibration-runs.csv',csv);

const summaryColumns=Object.keys(summary[0]) as (keyof typeof summary[0])[];
writeFileSync('balance-results/disruption-calibration-summary.csv',[summaryColumns.join(','),...summary.map(row=>summaryColumns.map(key=>String(row[key])).join(','))].join('\n'));
const confirmationColumns=Object.keys(confirmation[0]) as (keyof typeof confirmation[0])[];
writeFileSync('balance-results/disruption-confirmation-summary.csv',[confirmationColumns.join(','),...confirmation.map(row=>confirmationColumns.map(key=>String(row[key])).join(','))].join('\n'));
const confirmationRunColumns=Object.keys(confirmationRows[0]) as (keyof ConfirmationRow)[];
writeFileSync('balance-results/disruption-confirmation-runs.csv',[confirmationRunColumns.join(','),...confirmationRows.map(row=>confirmationRunColumns.map(key=>JSON.stringify(row[key])).join(','))].join('\n'));

const md=['# Disruption calibration study','',`660 Newbie knowledge-calibration simulations: 20 games for every round count from 3 to 35. Round cadence is 10, 9, 8, 7, 6, 5, 4, then 3 minutes per round thereafter. Across the 20 games, five players devote 1, 2, 3 or 4 of their five Actions each round to their known Disruption. Event and investment financial effects are excluded so this study isolates knowledge growth and Knowledge Risk.`,'','## Calibration curve','','| Rounds | Model min | P60 raw | P60 smoothed | Candidate |','|---:|---:|---:|---:|:---|',...summary.map((row:any)=>`| ${row.rounds} | ${row.modeledMinutes} | ${row.p60DomainScore.toFixed(2)} | ${row.smoothedP60DomainScore.toFixed(2)} | ${row.candidateHigh}/${row.candidateLow} |`),'','## 100-game confirmation at key breakpoints','','| Rounds | Min | Card | Outright | Gap 1 | Gap 2 | Gap 3+ | Mean luck chance | Mean consultant % |','|---:|---:|:---|---:|---:|---:|---:|---:|---:|',...confirmation.map(row=>`| ${row.rounds} | ${row.modeledMinutes} | ${row.targetHigh}/${row.targetLow} | ${(row.outrightRate*100).toFixed(0)}% | ${(row.gap1Rate*100).toFixed(0)}% | ${(row.gap2Rate*100).toFixed(0)}% | ${(row.gap3PlusRate*100).toFixed(0)}% | ${row.meanChanceWithoutConsultant.toFixed(1)}% | ${row.meanConsultantPercent.toFixed(1)}% |`),''].join('\n');
writeFileSync('balance-results/disruption-calibration.md',md);
console.log('\n'+md);
