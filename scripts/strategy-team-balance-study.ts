import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import type { BusinessStrategy, KnowledgeStrategy } from '../src/types/gameV2.ts';

type Mode='newbie'|'expert';
type Domain='engineering'|'hr'|'marketing'|'operations'|'finance';
type Intervention='river'|'intranet'|'codify'|'train'|'aar'|'cop'|'automation'|'corporate-training';
type RiskOverlay='bullish'|'balanced'|'risk_averse';
const DOMAINS:Domain[]=['engineering','hr','marketing','operations','finance'];
const SITES=['MEL','SYD','BNE','ADL','PER','DRW'];
const COSTS:Record<Intervention,number>={river:18,intranet:35,codify:20,train:20,aar:15,cop:25,automation:150,'corporate-training':95};
const BUSINESS:BusinessStrategy[]=['short_term_profit','growth','downside_protection','balanced','adaptive'];
const KNOWLEDGE:KnowledgeStrategy[]=['rely_on_people','build_team_capability','capture_knowledge','build_networks','automate_critical_knowledge','buy_expertise','no_particular_strategy'];
const OVERLAYS:RiskOverlay[]=['bullish','balanced','risk_averse'];

interface Policy { risk:number; spend:number; sharing:number; codify:number; learning:number; expert:number; network:number; tech:number; reserve:number; minValueRatio:number; }
interface Site {turnover:number;team:Record<Domain,number>;docs:Record<Domain,number>}
interface CompanyState {sites:Site[];intranet:Record<Domain,number>;experts:Record<Domain,number>;automated:Set<Domain>;cop:Set<Domain>;turnover:number}
interface MarketMove {domain:Domain;local:boolean;siteIndex:number;type:'problem'|'opportunity'}
interface CompanyResult {session:number;mode:Mode;company:number;businessStrategy:BusinessStrategy;knowledgeStrategy:KnowledgeStrategy;overlay:RiskOverlay;successRate:number;turnoverRatio:number;bankrupt:boolean;negativeSite:boolean;actionsUsedRatio:number;actionsUsed:number;actionsAvailable:number;stoppedNoValue:number;retryCount:number;diversity:number;riverUses:number;intranetUses:number;aarUses:number;automationUses:number;dominantShare:number;learningScore:number}
interface SessionResult {session:number;mode:Mode;allSurvive:boolean;anyNegativeSite:boolean;leaderSpread:number;meanSuccess:number;meanTurnoverRatio:number}
interface Candidate {i:Intervention;d:Domain;value:number;execute:()=>boolean}

class RNG {constructor(public s:number){} next(){this.s=(this.s*1664525+1013904223)>>>0;return this.s/4294967296} int(n:number){return Math.floor(this.next()*n)} pick<T>(a:T[]){return a[this.int(a.length)]} chance(p:number){return this.next()<p}}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const rec=<T extends string>(keys:T[],v:number)=>Object.fromEntries(keys.map(k=>[k,v])) as Record<T,number>;
const siteKnowledge=(s:Site,d:Domain)=>Math.max(s.team[d],s.docs[d]);
const successProbability=(k:number,d:number)=>clamp((13-Math.max(1,d+1-k))/12,0,1);

function policyFor(b:BusinessStrategy,k:KnowledgeStrategy,o:RiskOverlay):Policy{
 let p:Policy={risk:.50,spend:.50,sharing:.50,codify:.50,learning:.50,expert:.50,network:.50,tech:.50,reserve:.20,minValueRatio:.02};
 const business:Record<BusinessStrategy,Partial<Policy>>={
  short_term_profit:{risk:.62,spend:.30,reserve:.28,minValueRatio:.045}, growth:{risk:.78,spend:.78,reserve:.10,minValueRatio:.012}, downside_protection:{risk:.22,spend:.38,reserve:.34,minValueRatio:.035}, balanced:{risk:.50,spend:.50,reserve:.20,minValueRatio:.025}, adaptive:{risk:.55,spend:.62,reserve:.18,minValueRatio:.018}
 };
 const knowledge:Record<KnowledgeStrategy,Partial<Policy>>={
  rely_on_people:{expert:.92,sharing:.62,codify:.18,network:.35,tech:.20,learning:.45}, build_team_capability:{sharing:.85,learning:.82,expert:.55,codify:.48,network:.45}, capture_knowledge:{codify:.95,learning:.70,sharing:.52,expert:.42,network:.30}, build_networks:{network:.95,sharing:.78,expert:.55,codify:.35}, automate_critical_knowledge:{tech:.95,codify:.55,sharing:.35,learning:.35}, buy_expertise:{expert:.98,spend:.72,sharing:.25,codify:.20,network:.20}, no_particular_strategy:{sharing:.50,codify:.50,learning:.50,expert:.50,network:.50,tech:.50}
 };
 p={...p,...business[b],...knowledge[k]};
 if(o==='bullish'){p.risk=clamp(p.risk+.18,0,1);p.spend=clamp(p.spend+.18,0,1);p.reserve=Math.max(.05,p.reserve-.08);p.minValueRatio=Math.max(.006,p.minValueRatio*.65)}
 if(o==='risk_averse'){p.risk=clamp(p.risk-.18,0,1);p.spend=clamp(p.spend-.14,0,1);p.reserve=Math.min(.45,p.reserve+.10);p.minValueRatio=Math.min(.08,p.minValueRatio*1.45)}
 return p;
}

function diversify(m:Record<Domain,number>,r:RNG){const vals=DOMAINS.map(d=>m[d]),hi=Math.max(...vals),lo=Math.min(...vals);const high=r.pick(DOMAINS.filter(d=>m[d]===hi));m[high]+=2;const lows=DOMAINS.filter(d=>m[d]===lo&&d!==high);const low=r.pick(lows.length?lows:DOMAINS.filter(d=>m[d]===lo));m[low]=Math.max(0,m[low]-1)}
function makeCompany(r:RNG):CompanyState{const sites:Site[]=SITES.map(()=>{const team=rec(DOMAINS,0),docs=rec(DOMAINS,0);for(const d of DOMAINS){team[d]=1+r.int(3);docs[d]=1+r.int(3)}diversify(team,r);diversify(docs,r);return{turnover:Math.round(DEFAULT_CONFIG.starting_turnover/6),team,docs}});const intranet=rec(DOMAINS,DEFAULT_CONFIG.starting_intranet_score);diversify(intranet,r);const experts=rec(DOMAINS,0);for(const d of DOMAINS)experts[d]=4+r.int(3);return{sites,intranet,experts,automated:new Set<Domain>(),cop:new Set<Domain>(),turnover:DEFAULT_CONFIG.starting_turnover}}
function pressureMove(mode:Mode,move:number){const step=DEFAULT_CONFIG.event_expert_moves_per_pressure_step??6;return mode==='newbie'?move:1+Math.floor((move-1)/step)}
function marketSchedule(mode:Mode,r:RNG):MarketMove[]{const rounds=mode==='newbie'?4:28;return Array.from({length:rounds*2},(_,i)=>({domain:r.pick(DOMAINS),local:r.chance(.55),siteIndex:r.int(SITES.length),type:i%2===0?'problem':'opportunity'}))}

function strategyForSeat(sessionNo:number,companyNo:number){const ix=((sessionNo-1)*3+(companyNo-1));return {business:BUSINESS[ix%BUSINESS.length],knowledge:KNOWLEDGE[Math.floor(ix/BUSINESS.length)%KNOWLEDGE.length],overlay:OVERLAYS[Math.floor(ix/(BUSINESS.length*KNOWLEDGE.length))%OVERLAYS.length]}}

function simulateCompany(sessionNo:number,mode:Mode,companyNo:number,market:MarketMove[],seed:number):CompanyResult{
 const r=new RNG(seed),c=makeCompany(r),s=strategyForSeat(sessionNo,companyNo),policy=policyFor(s.business,s.knowledge,s.overlay),rounds=mode==='newbie'?4:28,initialTurnover=c.turnover;
 let successes=0,challenges=0,negativeSite=false,actionsUsed=0,learning=0,retryCount=0,stoppedNoValue=0;
 const used:Record<Intervention,number>={river:0,intranet:0,codify:0,train:0,aar:0,cop:0,automation:0,'corporate-training':0};
 for(let round=1;round<=rounds;round++){
  for(let j=0;j<2;j++){
   const move=(round-1)*2+j+1,m=market[move-1];challenges++;
   if(move===1){const ranked=[...c.sites].sort((a,b)=>siteKnowledge(a,m.domain)-siteKnowledge(b,m.domain));ranked[0].turnover-=18;c.turnover-=18;if(ranked[0].turnover<0)negativeSite=true;continue}
   const pm=pressureMove(mode,move),target=m.local?c.sites[m.siteIndex]:undefined,baseImpact=pm===2?18:(pm<5?24:30),growth=DEFAULT_CONFIG.event_value_growth_factor??1.4,raw=Math.round(baseImpact*Math.pow(growth,pm-1)),scopeBase=m.local?Math.max(1,target!.turnover):Math.max(1,c.turnover),cap=DEFAULT_CONFIG.event_impact_cap_ratio??.35,impact=Math.max(5,Math.min(raw,Math.round(scopeBase*cap))),baseDiff=pm<=2?2:pm<5?4:6,difficulty=Math.min(DEFAULT_CONFIG.event_difficulty_cap??9,Math.round(baseDiff+(pm-1)*(DEFAULT_CONFIG.event_difficulty_growth_per_move??.28)));
   let k=m.local?Math.max(siteKnowledge(target!,m.domain),Math.min(c.intranet[m.domain],target!.team[m.domain]+2)):Math.max(c.intranet[m.domain],...c.sites.map(x=>siteKnowledge(x,m.domain)));
   if(c.automated.has(m.domain))k+=DEFAULT_CONFIG.automation_bonus;if(c.cop.has(m.domain)&&r.chance(policy.network))k+=DEFAULT_CONFIG.cop_support_bonus;if(r.chance(policy.expert*.55))k=Math.max(k,c.experts[m.domain]+DEFAULT_CONFIG.expert_support_bonus);
   const ok=r.chance(successProbability(k,difficulty));if(ok)successes++;
   if(m.type==='problem'&&!ok){if(m.local){target!.turnover-=impact;if(target!.turnover<0)negativeSite=true}else{c.sites.forEach(x=>x.turnover-=Math.round(impact/6));c.turnover-=impact}}
   else if(m.type==='opportunity'&&ok){if(m.local)target!.turnover+=impact;else{c.sites.forEach(x=>x.turnover+=Math.round(impact/6));c.turnover+=impact}}
  }

  for(let slot=0;slot<DEFAULT_CONFIG.actions_per_round;slot++){
   const candidates:Candidate[]=[];
   const reserve=initialTurnover*policy.reserve;
   const canAfford=(i:Intervention)=>c.turnover-COSTS[i]>=reserve;
   for(const d of DOMAINS){
    const sorted=[...c.sites].sort((a,b)=>siteKnowledge(a,d)-siteKnowledge(b,d)),lo=sorted[0],hi=sorted.at(-1)!;
    const riverTarget=Math.min(6,Math.round(siteKnowledge(hi,d)*.8)),riverGain=Math.max(0,riverTarget-lo.team[d]);
    if(riverGain>0&&canAfford('river'))candidates.push({i:'river',d,value:riverGain*(1.4+policy.sharing)*8/COSTS.river,execute:()=>{lo.team[d]=riverTarget;learning+=.8;return true}});
    const best=Math.max(...c.sites.map(x=>siteKnowledge(x,d))),intranetGain=Math.max(0,best-c.intranet[d]);
    if(round>1&&intranetGain>0&&canAfford('intranet'))candidates.push({i:'intranet',d,value:intranetGain*(1+policy.codify)*6/COSTS.intranet,execute:()=>{c.intranet[d]=Math.min(best,c.intranet[d]+DEFAULT_CONFIG.normal_intranet_increment);learning+=.55;return true}});
    const codifySites=c.sites.filter(x=>x.docs[d]<x.team[d]);
    if(codifySites.length&&canAfford('codify'))candidates.push({i:'codify',d,value:policy.codify*codifySites.length*5/COSTS.codify,execute:()=>{const x=r.pick(codifySites);x.docs[d]++;learning+=.45;return true}});
    if(c.experts[d]<8&&canAfford('train'))candidates.push({i:'train',d,value:policy.expert*(8-c.experts[d])*4/COSTS.train,execute:()=>{c.experts[d]++;learning+=.35;return true}});
    if(!c.cop.has(d)&&canAfford('cop'))candidates.push({i:'cop',d,value:policy.network*7/COSTS.cop,execute:()=>{c.cop.add(d);learning+=.55;return true}});
    if((round>=3||mode==='expert')&&!c.automated.has(d)&&canAfford('automation'))candidates.push({i:'automation',d,value:policy.tech*20/COSTS.automation,execute:()=>{c.automated.add(d);learning+=policy.tech>.7?.25:.45;return true}});
    const trainable=c.sites.filter(x=>x.team[d]<c.intranet[d]);
    if(trainable.length&&canAfford('corporate-training'))candidates.push({i:'corporate-training',d,value:(.5+policy.learning)*trainable.length*6/COSTS['corporate-training'],execute:()=>{for(const x of trainable)x.team[d]++;learning+=.5;return true}});
    if(canAfford('aar'))candidates.push({i:'aar',d,value:policy.learning*4/COSTS.aar,execute:()=>{const x=r.pick(c.sites);if(r.chance(.5))x.team[d]=Math.min(6,x.team[d]+1);else x.docs[d]=Math.min(6,x.docs[d]+1);learning+=.9;return true}});
   }
   const viable=candidates.filter(x=>x.value>=policy.minValueRatio).sort((a,b)=>b.value-a.value);
   if(!viable.length){stoppedNoValue++;break}
   let executed=false;
   while(viable.length&&!executed){const top=Math.min(5,viable.length),pickIndex=r.int(top),candidate=viable.splice(pickIndex,1)[0];if(candidate.execute()){executed=true;used[candidate.i]++;actionsUsed++;c.turnover-=COSTS[candidate.i];const share=Math.round(COSTS[candidate.i]/6);for(const x of c.sites)x.turnover-=share;if(c.sites.some(x=>x.turnover<0))negativeSite=true}else retryCount++}
   if(!executed){stoppedNoValue++;break}
  }
 }
 const counts:number[]=Object.values(used),total=counts.reduce((a,b)=>a+b,0),diversity=counts.filter(x=>x>0).length,dominantShare=total?Math.max(...counts)/total:1;
 return{session:sessionNo,mode,company:companyNo,businessStrategy:s.business,knowledgeStrategy:s.knowledge,overlay:s.overlay,successRate:successes/Math.max(1,challenges-1),turnoverRatio:c.turnover/initialTurnover,bankrupt:c.turnover<=0,negativeSite,actionsUsedRatio:actionsUsed/(rounds*DEFAULT_CONFIG.actions_per_round),actionsUsed,actionsAvailable:rounds*DEFAULT_CONFIG.actions_per_round,stoppedNoValue,retryCount,diversity,riverUses:used.river,intranetUses:used.intranet,aarUses:used.aar,automationUses:used.automation,dominantShare,learningScore:learning}
}

const companies:CompanyResult[]=[];const sessions:SessionResult[]=[];
for(let session=1;session<=100;session++){
 const mode:Mode=session<=60?'newbie':'expert',market=marketSchedule(mode,new RNG(1700000+session)),trio:CompanyResult[]=[];
 for(let company=1;company<=3;company++){const result=simulateCompany(session,mode,company,market,1900000+session*10+company);companies.push(result);trio.push(result)}
 const turnovers=trio.map(x=>x.turnoverRatio);sessions.push({session,mode,allSurvive:trio.every(x=>!x.bankrupt),anyNegativeSite:trio.some(x=>x.negativeSite),leaderSpread:Math.max(...turnovers)-Math.min(...turnovers),meanSuccess:mean(trio.map(x=>x.successRate)),meanTurnoverRatio:mean(turnovers)})
}
function summarize(xs:CompanyResult[]){return{companies:xs.length,successRate:mean(xs.map(x=>x.successRate)),turnoverRatio:mean(xs.map(x=>x.turnoverRatio)),bankruptcyRate:xs.filter(x=>x.bankrupt).length/xs.length,negativeSiteRate:xs.filter(x=>x.negativeSite).length/xs.length,actionsUsedRatio:mean(xs.map(x=>x.actionsUsedRatio)),meanActionsUsed:mean(xs.map(x=>x.actionsUsed)),meanNoValueStops:mean(xs.map(x=>x.stoppedNoValue)),meanRetries:mean(xs.map(x=>x.retryCount)),diversity:mean(xs.map(x=>x.diversity)),riverUses:mean(xs.map(x=>x.riverUses)),intranetUses:mean(xs.map(x=>x.intranetUses)),aarUses:mean(xs.map(x=>x.aarUses)),automationUses:mean(xs.map(x=>x.automationUses)),dominantShare:mean(xs.map(x=>x.dominantShare)),learningScore:mean(xs.map(x=>x.learningScore))}}
const newbie=companies.filter(x=>x.mode==='newbie'),expert=companies.filter(x=>x.mode==='expert');
const byOverlay=Object.fromEntries(OVERLAYS.map(o=>[o,summarize(companies.filter(x=>x.overlay===o))]));
const byBusiness=Object.fromEntries(BUSINESS.map(b=>[b,summarize(companies.filter(x=>x.businessStrategy===b))]));
const byKnowledge=Object.fromEntries(KNOWLEDGE.map(k=>[k,summarize(companies.filter(x=>x.knowledgeStrategy===k))]));
const report={generatedAt:new Date().toISOString(),description:'100 synthetic three-company sessions with three players/company. Strategy-driven policies replace occupational archetypes. Invalid or low-value investment ideas do not consume an Action; the simulator retries until it spends the Action or proves no value-generating action remains.',counts:{sessions:100,companies:300,playerSeats:900,newbieSessions:60,expertSessions:40},newbie:summarize(newbie),expert:summarize(expert),byOverlay,byBusiness,byKnowledge,sessionCompetition:{newbieAllSurvive:sessions.filter(x=>x.mode==='newbie'&&x.allSurvive).length/60,expertAllSurvive:sessions.filter(x=>x.mode==='expert'&&x.allSurvive).length/40,newbieLeaderSpread:mean(sessions.filter(x=>x.mode==='newbie').map(x=>x.leaderSpread)),expertLeaderSpread:mean(sessions.filter(x=>x.mode==='expert').map(x=>x.leaderSpread))}};
mkdirSync('balance-results',{recursive:true});writeFileSync('balance-results/strategy-team-study.json',JSON.stringify({report,companies,sessions},null,2));
const headers=Object.keys(companies[0]) as (keyof CompanyResult)[];writeFileSync('balance-results/strategy-team-companies.csv',[headers.join(','),...companies.map(row=>headers.map(h=>String(row[h])).join(','))].join('\n'));
const md=`# Strategy-based multiplayer balance study\n\nGenerated: ${report.generatedAt}\n\n100 sessions, 3 companies × 3 players, 60 Newbie / 40 Expert. Policies come from the game's starting Business Strategy and Knowledge Strategy choices, overlaid with bullish, balanced, or risk-averse behaviour. Failed/invalid ideas are retried and only successful value-generating actions consume an Action.\n\n## Newbie\n- Success: ${(report.newbie.successRate*100).toFixed(1)}%\n- Bankruptcy: ${(report.newbie.bankruptcyRate*100).toFixed(1)}%\n- Actions used: ${(report.newbie.actionsUsedRatio*100).toFixed(1)}%\n- Mean no-value stops/company: ${report.newbie.meanNoValueStops.toFixed(2)}\n- Intervention diversity: ${report.newbie.diversity.toFixed(2)} / 8\n\n## Expert\n- Success: ${(report.expert.successRate*100).toFixed(1)}%\n- Bankruptcy: ${(report.expert.bankruptcyRate*100).toFixed(1)}%\n- Actions used: ${(report.expert.actionsUsedRatio*100).toFixed(1)}%\n- Mean no-value stops/company: ${report.expert.meanNoValueStops.toFixed(2)}\n- Intervention diversity: ${report.expert.diversity.toFixed(2)} / 8\n\n## Interpretation\nUnused Actions now mean the simulator exhausted all currently value-generating, affordable interventions above that strategy's minimum value threshold. They no longer represent a rejected idea consuming a decision slot.\n`;
writeFileSync('balance-results/strategy-team-summary.md',md);
console.log('\n=== STRATEGY-BASED THREE-COMPANY STUDY ===');console.log(report);console.log(md);
