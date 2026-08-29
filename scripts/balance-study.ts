import { DEFAULT_CONFIG } from '../src/engine/config.ts';

type Mode='newbie'|'expert';
type Domain='engineering'|'hr'|'marketing'|'operations'|'finance';
type Intervention='river'|'intranet'|'codify'|'train'|'aar'|'cop'|'automation'|'corporate-training';
const DOMAINS:Domain[]=['engineering','hr','marketing','operations','finance'];
const SITES=['MEL','SYD','BNE','ADL','PER','DRW'];

interface Tune {
  name:string;
  growth:number;
  difficultyGrowth:number;
  impactCapRatio:number;
  difficultyCap:number;
  riverEfficiency:number;
  automationBonus:number;
  intranetIncrement:number;
}
interface Persona {
  name:string;risk:number;tech:number;sharing:number;codify:number;learning:number;expert:number;network:number;spend:number;
}
interface Site {turnover:number;team:Record<Domain,number>;docs:Record<Domain,number>}
interface RunResult {
  mode:Mode;turnoverRatio:number;successRate:number;lateExposure:number;bankrupt:boolean;negativeSite:boolean;actionsUsed:number;actionCapacity:number;
  diversity:number;riverUses:number;intranetUses:number;aarUses:number;automationUses:number;learning:number;falseLessonPenalty:number;dominantShare:number;rounds:number;
}

class RNG { constructor(public s:number){} next(){this.s=(this.s*1664525+1013904223)>>>0;return this.s/4294967296} int(n:number){return Math.floor(this.next()*n)} pick<T>(a:T[]){return a[this.int(a.length)]} chance(p:number){return this.next()<p} }
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const rec=<T extends string>(keys:T[],v:number)=>Object.fromEntries(keys.map(k=>[k,v])) as Record<T,number>;
const COSTS:Record<Intervention,number>={river:18,intranet:35,codify:20,train:20,aar:15,cop:25,automation:150,'corporate-training':95};

const CORE:Persona[]=[
 {name:'CEO sceptic',risk:.65,tech:.35,sharing:.35,codify:.25,learning:.25,expert:.45,network:.25,spend:.35},
 {name:'CIO',risk:.50,tech:.90,sharing:.45,codify:.55,learning:.35,expert:.45,network:.40,spend:.65},
 {name:'Experienced KMer',risk:.45,tech:.45,sharing:.95,codify:.80,learning:.90,expert:.65,network:.85,spend:.60},
 {name:'Beginner KMer',risk:.55,tech:.45,sharing:.55,codify:.55,learning:.55,expert:.50,network:.45,spend:.50},
 {name:'Change Manager',risk:.50,tech:.35,sharing:.80,codify:.45,learning:.80,expert:.45,network:.70,spend:.50},
 {name:'L&D architect',risk:.45,tech:.35,sharing:.75,codify:.55,learning:.95,expert:.60,network:.65,spend:.55},
 {name:'Operations manager',risk:.55,tech:.45,sharing:.70,codify:.55,learning:.60,expert:.70,network:.35,spend:.55},
 {name:'Introverted legal professional',risk:.35,tech:.35,sharing:.45,codify:.85,learning:.70,expert:.45,network:.25,spend:.40},
];
const MARKET:Persona[]=[
 {name:'Accountant',risk:.30,tech:.40,sharing:.35,codify:.80,learning:.50,expert:.45,network:.25,spend:.30},
 {name:'IT support analyst',risk:.55,tech:.85,sharing:.65,codify:.65,learning:.65,expert:.55,network:.55,spend:.55},
 {name:'Truck driver',risk:.70,tech:.25,sharing:.70,codify:.25,learning:.55,expert:.55,network:.50,spend:.35},
 {name:'Warehouse supervisor',risk:.60,tech:.35,sharing:.70,codify:.45,learning:.60,expert:.60,network:.35,spend:.45},
 {name:'HR adviser',risk:.40,tech:.30,sharing:.75,codify:.55,learning:.75,expert:.45,network:.65,spend:.45},
 {name:'Sales manager',risk:.75,tech:.45,sharing:.65,codify:.25,learning:.40,expert:.50,network:.70,spend:.65},
 {name:'Maintenance engineer',risk:.45,tech:.55,sharing:.60,codify:.55,learning:.60,expert:.90,network:.45,spend:.55},
 {name:'Project manager',risk:.50,tech:.50,sharing:.65,codify:.65,learning:.70,expert:.55,network:.55,spend:.50},
 {name:'Customer service lead',risk:.55,tech:.50,sharing:.75,codify:.65,learning:.75,expert:.40,network:.55,spend:.45},
 {name:'Procurement officer',risk:.35,tech:.35,sharing:.45,codify:.75,learning:.55,expert:.55,network:.60,spend:.35},
 {name:'Plant operator',risk:.65,tech:.35,sharing:.70,codify:.35,learning:.65,expert:.70,network:.35,spend:.40},
 {name:'Finance business partner',risk:.35,tech:.45,sharing:.45,codify:.75,learning:.60,expert:.50,network:.35,spend:.40},
];
function blend(a:Persona,b:Persona):Persona{const k=(x:keyof Persona)=>((a[x] as number)+(b[x] as number))/2;return{name:`${a.name} + ${b.name}`,risk:k('risk'),tech:k('tech'),sharing:k('sharing'),codify:k('codify'),learning:k('learning'),expert:k('expert'),network:k('network'),spend:k('spend')}}
function diversify(m:Record<Domain,number>,r:RNG){const vals=DOMAINS.map(d=>m[d]);const hi=Math.max(...vals),lo=Math.min(...vals);const highs=DOMAINS.filter(d=>m[d]===hi);const high=r.pick(highs);m[high]+=2;const lows=DOMAINS.filter(d=>m[d]===lo&&d!==high);const low=r.pick(lows.length?lows:DOMAINS.filter(d=>m[d]===lo));m[low]=Math.max(0,m[low]-1)}
function makeCompany(r:RNG){
 const sites:Site[]=SITES.map(()=>{const team=rec(DOMAINS,0),docs=rec(DOMAINS,0);for(const d of DOMAINS){team[d]=1+r.int(3);docs[d]=1+r.int(3)}diversify(team,r);diversify(docs,r);return{turnover:Math.round(DEFAULT_CONFIG.starting_turnover/6),team,docs}});
 const intranet=rec(DOMAINS,DEFAULT_CONFIG.starting_intranet_score);diversify(intranet,r);
 const experts=DOMAINS.map(()=>4+r.int(3));
 return{sites,intranet,experts,automated:new Set<Domain>(),cop:new Set<Domain>(),turnover:DEFAULT_CONFIG.starting_turnover};
}
function siteKnowledge(s:Site,d:Domain){return Math.max(s.team[d],s.docs[d])}
function successProbability(knowledge:number,difficulty:number){const need=Math.max(1,difficulty+1-knowledge);return clamp((13-need)/12,0,1)}
function chooseDomain(r:RNG){return r.pick(DOMAINS)}

function simulate(mode:Mode,t:Tune,seed:number):RunResult{
 const r=new RNG(seed);const persona=blend(CORE[seed%CORE.length],r.pick(MARKET));const c=makeCompany(r);const rounds=mode==='newbie'?4:28;const actionsPerRound=5;
 let successes=0,challenges=0,lateExposure=0,negativeSite=false,actionsUsed=0;const used:Record<Intervention,number>={river:0,intranet:0,codify:0,train:0,aar:0,cop:0,automation:0,'corporate-training':0};let learning=0,falseLessonPenalty=0;
 const initialTurnover=c.turnover;
 for(let round=1;round<=rounds;round++){
   for(let j=0;j<2;j++){
     const move=(round-1)*2+j+1;challenges++;
     if(move===1){const d=chooseDomain(r);const ranked=[...c.sites].sort((a,b)=>siteKnowledge(a,d)-siteKnowledge(b,d));const target=ranked[0];target.turnover-=18;c.turnover-=18;if(target.turnover<0)negativeSite=true;continue}
     const d=chooseDomain(r);const local=r.chance(.55);const target=local?r.pick(c.sites):undefined;
     const baseImpact=move===2?18:(move<5?24:30);const raw=Math.round(baseImpact*Math.pow(t.growth,move-1));const scopeBase=local?Math.max(1,target!.turnover):Math.max(1,c.turnover);const impact=Math.max(5,Math.min(raw,Math.round(scopeBase*t.impactCapRatio)));
     const baseDiff=move<=2?2:move<5?4:6;const difficulty=Math.min(t.difficultyCap,Math.round(baseDiff+(move-1)*t.difficultyGrowth));
     let k=local?Math.max(siteKnowledge(target!,d),Math.min(c.intranet[d],target!.team[d]+2)):Math.max(c.intranet[d],...c.sites.map(s=>siteKnowledge(s,d)));
     if(c.automated.has(d))k+=t.automationBonus;if(c.cop.has(d)&&r.chance(persona.network))k+=2;
     const expIdx=DOMAINS.indexOf(d);if(r.chance(persona.expert*.55))k=Math.max(k,c.experts[expIdx]+2);
     const p=successProbability(k,difficulty);const ok=r.chance(p);if(ok)successes++;
     const type=(move%2===0)?'opportunity':'problem';if(type==='problem'&&!ok){if(local){target!.turnover-=impact;if(target!.turnover<0)negativeSite=true}else c.sites.forEach(s=>s.turnover-=Math.round(impact/6));c.turnover-=impact}else if(type==='opportunity'&&ok){if(local)target!.turnover+=impact;else c.sites.forEach(s=>s.turnover+=Math.round(impact/6));c.turnover+=impact}
     if(move>4)lateExposure+=impact/Math.max(1,scopeBase);
   }
   let actions=actionsPerRound;
   while(actions-->0){
     const gapByDomain=DOMAINS.map(d=>{const vals=c.sites.map(s=>siteKnowledge(s,d));return{d,gap:Math.max(...vals)-Math.min(...vals)}}).sort((a,b)=>b.gap-a.gap);const g=gapByDomain[0];
     const choices:{i:Intervention;w:number}[]=[];
     choices.push({i:'river',w:persona.sharing*(g.gap>=2?3:.4)});
     choices.push({i:'intranet',w:(round>1?1:0)*(.6+persona.codify)*Math.max(0,Math.max(...c.sites.map(s=>siteKnowledge(s,g.d)))-c.intranet[g.d])});
     choices.push({i:'codify',w:persona.codify*1.4});choices.push({i:'aar',w:persona.learning*(mode==='newbie'?1.6:1.0)});choices.push({i:'train',w:persona.expert*.8});choices.push({i:'cop',w:persona.network*.75});choices.push({i:'automation',w:persona.tech*(round>=3||mode==='expert'?1:0)*.8});choices.push({i:'corporate-training',w:.5+persona.learning*.5});
     const total=choices.reduce((s,x)=>s+x.w,0);let z=r.next()*total;let picked=choices[0].i;for(const x of choices){z-=x.w;if(z<=0){picked=x.i;break}}
     let did=false;const d=picked==='river'?g.d:chooseDomain(r);const cost=COSTS[picked];if(cost>c.turnover*(.08+.25*persona.spend)&&r.chance(.70))continue;
     if(picked==='river'){const sorted=[...c.sites].sort((a,b)=>siteKnowledge(a,d)-siteKnowledge(b,d));const lo=sorted[0],hi=sorted[sorted.length-1],targetScore=Math.round(siteKnowledge(hi,d)*t.riverEfficiency);if(targetScore>lo.team[d]){lo.team[d]=Math.min(6,targetScore);did=true;learning+=.8}}
     else if(picked==='intranet'){const best=Math.max(...c.sites.map(s=>siteKnowledge(s,d)));if(best>c.intranet[d]){c.intranet[d]=Math.min(best,c.intranet[d]+t.intranetIncrement);did=true;learning+=.55}}
     else if(picked==='codify'){const s=r.pick(c.sites);if(s.docs[d]<s.team[d]){s.docs[d]++;did=true;learning+=.45}}
     else if(picked==='aar'){const s=r.pick(c.sites);if(r.chance(.5))s.team[d]=Math.min(6,s.team[d]+1);else s.docs[d]=Math.min(6,s.docs[d]+1);did=true;learning+=.9}
     else if(picked==='train'){const idx=DOMAINS.indexOf(d);if(c.experts[idx]<8){c.experts[idx]++;did=true;learning+=.35}}
     else if(picked==='cop'){if(!c.cop.has(d)){c.cop.add(d);did=true;learning+=.55}}
     else if(picked==='automation'){if(!c.automated.has(d)){c.automated.add(d);did=true;learning+=persona.tech>.7?.25:.45;if(persona.tech>.75&&used.automation>=used.river+used.intranet)falseLessonPenalty+=.6}}
     else {for(const s of c.sites)if(s.team[d]<c.intranet[d]){s.team[d]++;did=true}if(did)learning+=.5}
     if(did){used[picked]++;actionsUsed++;c.turnover-=cost;const share=Math.round(cost/6);for(const s of c.sites)s.turnover-=share;if(c.sites.some(s=>s.turnover<0))negativeSite=true}
   }
 }
 const counts:number[]=Object.values(used);const nonzero=counts.filter(x=>x>0).length;const totalUsed=counts.reduce((s,x)=>s+x,0);const dominant=totalUsed?Math.max(...counts)/totalUsed:1;
 return{mode,turnoverRatio:c.turnover/initialTurnover,successRate:successes/Math.max(1,challenges-1),lateExposure:lateExposure/Math.max(1,challenges-5),bankrupt:c.turnover<=0,negativeSite,actionsUsed,actionCapacity:rounds*actionsPerRound,diversity:nonzero,riverUses:used.river,intranetUses:used.intranet,aarUses:used.aar,automationUses:used.automation,learning,falseLessonPenalty,dominantShare:dominant,rounds};
}
function quality(r:RunResult){
 const targetSuccess=r.mode==='newbie'?.68:.72;let s=100;
 s-=Math.abs(r.successRate-targetSuccess)*90;s-=r.bankrupt?60:0;s-=r.negativeSite?(r.mode==='newbie'?25:12):0;
 if(r.mode==='newbie'){s-=Math.abs(r.lateExposure-.22)*45;s-=Math.max(0,.55-r.actionsUsed/r.actionCapacity)*30;s-=Math.max(0,5-r.diversity)*5;s-=r.riverUses===0?12:0;s-=r.intranetUses===0?12:0;s-=r.aarUses===0?8:0;s-=r.falseLessonPenalty*5;}
 else {s-=Math.abs(r.lateExposure-.28)*25;s-=Math.max(0,.45-r.actionsUsed/r.actionCapacity)*15;s-=Math.max(0,6-r.diversity)*3;s-=Math.max(0,r.dominantShare-.45)*50;s-=Math.max(0,.25-r.turnoverRatio)*30;s-=r.falseLessonPenalty*4;}
 return s;
}
function summary(results:RunResult[]){return{n:results.length,score:mean(results.map(quality)),success:mean(results.map(x=>x.successRate)),turnover:mean(results.map(x=>x.turnoverRatio)),lateExposure:mean(results.map(x=>x.lateExposure)),negativeSites:results.filter(x=>x.negativeSite).length/results.length,bankrupt:results.filter(x=>x.bankrupt).length/results.length,actionsUsed:mean(results.map(x=>x.actionsUsed/x.actionCapacity)),diversity:mean(results.map(x=>x.diversity)),river:mean(results.map(x=>x.riverUses)),intranet:mean(results.map(x=>x.intranetUses)),aar:mean(results.map(x=>x.aarUses)),dominant:mean(results.map(x=>x.dominantShare)),learning:mean(results.map(x=>x.learning))}}
const baseline:Tune={name:'CURRENT / uncapped',growth:DEFAULT_CONFIG.event_value_growth_factor??1.8,difficultyGrowth:DEFAULT_CONFIG.event_difficulty_growth_per_move??.75,impactCapRatio:99,difficultyCap:99,riverEfficiency:.8,automationBonus:DEFAULT_CONFIG.automation_bonus,intranetIncrement:DEFAULT_CONFIG.normal_intranet_increment};
const candidates:Tune[]=[
 {name:'A gentle capped',growth:1.22,difficultyGrowth:.16,impactCapRatio:.45,difficultyCap:9,riverEfficiency:.8,automationBonus:2,intranetIncrement:1},
 {name:'B moderate capped',growth:1.28,difficultyGrowth:.18,impactCapRatio:.50,difficultyCap:9,riverEfficiency:.8,automationBonus:2,intranetIncrement:1},
 {name:'C stronger pressure',growth:1.32,difficultyGrowth:.20,impactCapRatio:.55,difficultyCap:10,riverEfficiency:.8,automationBonus:2,intranetIncrement:1},
 {name:'D sharing stronger',growth:1.28,difficultyGrowth:.18,impactCapRatio:.50,difficultyCap:9,riverEfficiency:.85,automationBonus:2,intranetIncrement:1},
 {name:'E automation softer',growth:1.28,difficultyGrowth:.18,impactCapRatio:.50,difficultyCap:9,riverEfficiency:.8,automationBonus:1,intranetIncrement:1},
 {name:'F broad intranet',growth:1.25,difficultyGrowth:.18,impactCapRatio:.50,difficultyCap:9,riverEfficiency:.8,automationBonus:2,intranetIncrement:2},
];
function makeRuns(t:Tune,nNewbie:number,nExpert:number,seedBase:number){const a:RunResult[]=[];for(let i=0;i<nNewbie;i++)a.push(simulate('newbie',t,seedBase+i));for(let i=0;i<nExpert;i++)a.push(simulate('expert',t,seedBase+1000+i));return a}
const baselineRuns=makeRuns(baseline,12,8,10000);console.log('\n=== 100-GAME BALANCE STUDY ===');console.log('Cohort: 60 Newbie / 40 Expert. Expert games run 28 rounds; Newbie games run 4 rounds.');console.log('\nBASELINE 20',baseline,summary(baselineRuns));
const exploratory:{t:Tune;r:RunResult[];s:number}[]=[];candidates.forEach((t,i)=>{const r=makeRuns(t,6,4,20000+i*2000);const s=summary(r).score;exploratory.push({t,r,s});console.log(`\nEXPLORE ${t.name} (10)`,t,summary(r))});
exploratory.sort((a,b)=>b.s-a.s);const best=exploratory[0].t;const confirmRuns=makeRuns(best,12,8,50000);console.log('\nCONFIRM BEST 20',best,summary(confirmRuns));
const all=[...baselineRuns,...exploratory.flatMap(x=>x.r),...confirmRuns];const newbie=all.filter(x=>x.mode==='newbie'),expert=all.filter(x=>x.mode==='expert');console.log('\nTOTAL COHORT CHECK', {total:all.length,newbie:newbie.length,expert:expert.length});console.log('ALL NEWBIE',summary(newbie));console.log('ALL EXPERT',summary(expert));
console.log('\nRECOMMENDED_CONFIG='+JSON.stringify(best));
const conf=summary(confirmRuns);const firstPlayReady=conf.bankrupt<.05&&conf.negativeSites<.25&&conf.success>.55&&conf.success<.86&&conf.actionsUsed>.45&&conf.diversity>=5;
console.log('FIRST_PLAY_APPROVAL_READINESS='+String(firstPlayReady));
if(!firstPlayReady)console.log('WARNING: candidate still misses first-play guardrails; inspect metrics before deployment.');
