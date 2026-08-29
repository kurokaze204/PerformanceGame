import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';

type Mode='newbie'|'expert';
type Domain='engineering'|'hr'|'marketing'|'operations'|'finance';
type Intervention='river'|'intranet'|'codify'|'train'|'aar'|'cop'|'automation'|'corporate-training';
const DOMAINS:Domain[]=['engineering','hr','marketing','operations','finance'];
const SITES=['MEL','SYD','BNE','ADL','PER','DRW'];
const COSTS:Record<Intervention,number>={river:18,intranet:35,codify:20,train:20,aar:15,cop:25,automation:150,'corporate-training':95};

interface Persona{name:string;risk:number;tech:number;sharing:number;codify:number;learning:number;expert:number;network:number;spend:number}
interface Site{turnover:number;team:Record<Domain,number>;docs:Record<Domain,number>}
interface CompanyState{sites:Site[];intranet:Record<Domain,number>;experts:Record<Domain,number>;automated:Set<Domain>;cop:Set<Domain>;turnover:number}
interface MarketMove{domain:Domain;local:boolean;siteIndex:number;type:'problem'|'opportunity'}
interface CompanyResult{session:number;mode:Mode;company:number;players:string;scribe:string;successRate:number;turnoverRatio:number;bankrupt:boolean;negativeSite:boolean;actionsUsedRatio:number;diversity:number;riverUses:number;intranetUses:number;aarUses:number;automationUses:number;dominantShare:number;learningScore:number}
interface SessionResult{session:number;mode:Mode;allSurvive:boolean;anyNegativeSite:boolean;leaderSpread:number;meanSuccess:number;meanTurnoverRatio:number}

class RNG{constructor(public s:number){}next(){this.s=(this.s*1664525+1013904223)>>>0;return this.s/4294967296}int(n:number){return Math.floor(this.next()*n)}pick<T>(a:T[]){return a[this.int(a.length)]}chance(p:number){return this.next()<p}}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
const rec=<T extends string>(keys:T[],v:number)=>Object.fromEntries(keys.map(k=>[k,v])) as Record<T,number>;

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

function blend(players:Persona[],scribe:number):Persona{
 const keys:(Exclude<keyof Persona,'name'>)[]=['risk','tech','sharing','codify','learning','expert','network','spend'];
 const result:any={name:players.map(p=>p.name).join(' + ')};
 for(const key of keys){const avg=mean(players.map(p=>p[key]));result[key]=avg*.75+players[scribe][key]*.25;}
 return result as Persona;
}
function diversify(m:Record<Domain,number>,r:RNG){const vals=DOMAINS.map(d=>m[d]),hi=Math.max(...vals),lo=Math.min(...vals);const high=r.pick(DOMAINS.filter(d=>m[d]===hi));m[high]+=2;const lows=DOMAINS.filter(d=>m[d]===lo&&d!==high);const low=r.pick(lows.length?lows:DOMAINS.filter(d=>m[d]===lo));m[low]=Math.max(0,m[low]-1)}
function makeCompany(r:RNG):CompanyState{
 const sites:Site[]=SITES.map(()=>{const team=rec(DOMAINS,0),docs=rec(DOMAINS,0);for(const d of DOMAINS){team[d]=1+r.int(3);docs[d]=1+r.int(3)}diversify(team,r);diversify(docs,r);return{turnover:Math.round(DEFAULT_CONFIG.starting_turnover/6),team,docs}});
 const intranet=rec(DOMAINS,DEFAULT_CONFIG.starting_intranet_score);diversify(intranet,r);
 const experts=rec(DOMAINS,0);for(const d of DOMAINS)experts[d]=4+r.int(3);
 return{sites,intranet,experts,automated:new Set<Domain>(),cop:new Set<Domain>(),turnover:DEFAULT_CONFIG.starting_turnover};
}
const siteKnowledge=(s:Site,d:Domain)=>Math.max(s.team[d],s.docs[d]);
const successProbability=(k:number,d:number)=>clamp((13-Math.max(1,d+1-k))/12,0,1);
function pressureMove(mode:Mode,move:number){const step=DEFAULT_CONFIG.event_expert_moves_per_pressure_step??6;return mode==='newbie'?move:1+Math.floor((move-1)/step)}
function marketSchedule(mode:Mode,r:RNG):MarketMove[]{const rounds=mode==='newbie'?4:28;return Array.from({length:rounds*2},(_,i)=>({domain:r.pick(DOMAINS),local:r.chance(.55),siteIndex:r.int(SITES.length),type:i%2===0?'problem':'opportunity'}));}
function playersForCompany(r:RNG,company:number):Persona[]{return [CORE[(company+r.int(CORE.length))%CORE.length],r.pick(MARKET),r.pick(MARKET)];}

function simulateCompany(sessionNo:number,mode:Mode,companyNo:number,market:MarketMove[],seed:number):CompanyResult{
 const r=new RNG(seed),c=makeCompany(r),players=playersForCompany(r,companyNo),scribe=r.int(3),team=blend(players,scribe),rounds=mode==='newbie'?4:28,initialTurnover=c.turnover;
 let successes=0,challenges=0,negativeSite=false,actionsUsed=0,learning=0;
 const used:Record<Intervention,number>={river:0,intranet:0,codify:0,train:0,aar:0,cop:0,automation:0,'corporate-training':0};
 for(let round=1;round<=rounds;round++){
  for(let j=0;j<2;j++){
   const move=(round-1)*2+j+1,m=market[move-1];challenges++;
   if(move===1){const ranked=[...c.sites].sort((a,b)=>siteKnowledge(a,m.domain)-siteKnowledge(b,m.domain));ranked[0].turnover-=18;c.turnover-=18;if(ranked[0].turnover<0)negativeSite=true;continue;}
   const pm=pressureMove(mode,move),target=m.local?c.sites[m.siteIndex]:undefined,baseImpact=pm===2?18:(pm<5?24:30),growth=DEFAULT_CONFIG.event_value_growth_factor??1.4,raw=Math.round(baseImpact*Math.pow(growth,pm-1)),scopeBase=m.local?Math.max(1,target!.turnover):Math.max(1,c.turnover),cap=DEFAULT_CONFIG.event_impact_cap_ratio??.35,impact=Math.max(5,Math.min(raw,Math.round(scopeBase*cap))),baseDiff=pm<=2?2:pm<5?4:6,difficulty=Math.min(DEFAULT_CONFIG.event_difficulty_cap??9,Math.round(baseDiff+(pm-1)*(DEFAULT_CONFIG.event_difficulty_growth_per_move??.28)));
   let k=m.local?Math.max(siteKnowledge(target!,m.domain),Math.min(c.intranet[m.domain],target!.team[m.domain]+2)):Math.max(c.intranet[m.domain],...c.sites.map(s=>siteKnowledge(s,m.domain)));
   if(c.automated.has(m.domain))k+=DEFAULT_CONFIG.automation_bonus;if(c.cop.has(m.domain)&&r.chance(team.network))k+=DEFAULT_CONFIG.cop_support_bonus;if(r.chance(team.expert*.55))k=Math.max(k,c.experts[m.domain]+DEFAULT_CONFIG.expert_support_bonus);
   const ok=r.chance(successProbability(k,difficulty));if(ok)successes++;
   if(m.type==='problem'&&!ok){if(m.local){target!.turnover-=impact;if(target!.turnover<0)negativeSite=true}else{c.sites.forEach(s=>s.turnover-=Math.round(impact/6));c.turnover-=impact}}
   else if(m.type==='opportunity'&&ok){if(m.local)target!.turnover+=impact;else{c.sites.forEach(s=>s.turnover+=Math.round(impact/6));c.turnover+=impact}}
  }
  let actions=DEFAULT_CONFIG.actions_per_round;
  while(actions-->0){
   const gaps=DOMAINS.map(d=>{const vals=c.sites.map(s=>siteKnowledge(s,d));return{d,gap:Math.max(...vals)-Math.min(...vals)}}).sort((a,b)=>b.gap-a.gap),g=gaps[0];
   const choices:{i:Intervention;w:number}[]=[{i:'river',w:team.sharing*(g.gap>=2?3:.35)},{i:'intranet',w:(round>1?1:0)*(.6+team.codify)*Math.max(0,Math.max(...c.sites.map(s=>siteKnowledge(s,g.d)))-c.intranet[g.d])},{i:'codify',w:team.codify*1.4},{i:'aar',w:team.learning*(mode==='newbie'?1.6:1)},{i:'train',w:team.expert*.8},{i:'cop',w:team.network*.75},{i:'automation',w:team.tech*(round>=3||mode==='expert'?1:0)*.8},{i:'corporate-training',w:.5+team.learning*.5}];
   const total=choices.reduce((s,x)=>s+x.w,0);let z=r.next()*total,picked=choices[0].i;for(const x of choices){z-=x.w;if(z<=0){picked=x.i;break}}
   const d=picked==='river'?g.d:r.pick(DOMAINS),cost=COSTS[picked],reserve=initialTurnover*(mode==='expert'?.28:.18);if(c.turnover-cost<reserve&&r.chance(.9))continue;if(cost>c.turnover*(.045+.13*team.spend)&&r.chance(.8))continue;let did=false;
   if(picked==='river'){const sorted=[...c.sites].sort((a,b)=>siteKnowledge(a,d)-siteKnowledge(b,d)),lo=sorted[0],hi=sorted.at(-1)!,targetScore=Math.round(siteKnowledge(hi,d)*.8);if(targetScore>lo.team[d]){lo.team[d]=Math.min(6,targetScore);did=true;learning+=.8}}
   else if(picked==='intranet'){const best=Math.max(...c.sites.map(s=>siteKnowledge(s,d)));if(best>c.intranet[d]){c.intranet[d]=Math.min(best,c.intranet[d]+DEFAULT_CONFIG.normal_intranet_increment);did=true;learning+=.55}}
   else if(picked==='codify'){const s=r.pick(c.sites);if(s.docs[d]<s.team[d]){s.docs[d]++;did=true;learning+=.45}}
   else if(picked==='aar'){const s=r.pick(c.sites);if(r.chance(.5))s.team[d]=Math.min(6,s.team[d]+1);else s.docs[d]=Math.min(6,s.docs[d]+1);did=true;learning+=.9}
   else if(picked==='train'){if(c.experts[d]<8){c.experts[d]++;did=true;learning+=.35}}
   else if(picked==='cop'){if(!c.cop.has(d)){c.cop.add(d);did=true;learning+=.55}}
   else if(picked==='automation'){if(!c.automated.has(d)){c.automated.add(d);did=true;learning+=team.tech>.7?.25:.45}}
   else{for(const s of c.sites)if(s.team[d]<c.intranet[d]){s.team[d]++;did=true}if(did)learning+=.5}
   if(did){used[picked]++;actionsUsed++;c.turnover-=cost;const share=Math.round(cost/6);for(const s of c.sites)s.turnover-=share;if(c.sites.some(s=>s.turnover<0))negativeSite=true}
  }
 }
 const counts:number[]=Object.values(used),total=counts.reduce((s,x)=>s+x,0),diversity=counts.filter(x=>x>0).length,dominantShare=total?Math.max(...counts)/total:1;
 return{session:sessionNo,mode,company:companyNo,players:players.map(p=>p.name).join(' | '),scribe:players[scribe].name,successRate:successes/Math.max(1,challenges-1),turnoverRatio:c.turnover/initialTurnover,bankrupt:c.turnover<=0,negativeSite,actionsUsedRatio:actionsUsed/(rounds*DEFAULT_CONFIG.actions_per_round),diversity,riverUses:used.river,intranetUses:used.intranet,aarUses:used.aar,automationUses:used.automation,dominantShare,learningScore:learning};
}

const companies:CompanyResult[]=[];const sessions:SessionResult[]=[];
for(let s=1;s<=100;s++){
 const mode:Mode=s<=60?'newbie':'expert',market=marketSchedule(mode,new RNG(700000+s));const trio:CompanyResult[]=[];
 for(let c=1;c<=3;c++){const result=simulateCompany(s,mode,c,market,900000+s*10+c);companies.push(result);trio.push(result)}
 const turnovers=trio.map(x=>x.turnoverRatio);sessions.push({session:s,mode,allSurvive:trio.every(x=>!x.bankrupt),anyNegativeSite:trio.some(x=>x.negativeSite),leaderSpread:Math.max(...turnovers)-Math.min(...turnovers),meanSuccess:mean(trio.map(x=>x.successRate)),meanTurnoverRatio:mean(turnovers)});
}

function summarise(mode:Mode){const c=companies.filter(x=>x.mode===mode),s=sessions.filter(x=>x.mode===mode);return{sessions:s.length,companies:c.length,players:c.length*3,successRate:mean(c.map(x=>x.successRate)),turnoverRatio:mean(c.map(x=>x.turnoverRatio)),bankruptcyRate:c.filter(x=>x.bankrupt).length/c.length,negativeSiteRate:c.filter(x=>x.negativeSite).length/c.length,allThreeSurviveRate:s.filter(x=>x.allSurvive).length/s.length,anyNegativeSiteSessionRate:s.filter(x=>x.anyNegativeSite).length/s.length,meanLeaderSpread:mean(s.map(x=>x.leaderSpread)),actionsUsedRatio:mean(c.map(x=>x.actionsUsedRatio)),interventionDiversity:mean(c.map(x=>x.diversity)),riverUses:mean(c.map(x=>x.riverUses)),intranetUses:mean(c.map(x=>x.intranetUses)),aarUses:mean(c.map(x=>x.aarUses)),automationUses:mean(c.map(x=>x.automationUses)),dominantShare:mean(c.map(x=>x.dominantShare)),learningScore:mean(c.map(x=>x.learningScore))};}
const newbie=summarise('newbie'),expert=summarise('expert');
const readiness={newbie:newbie.bankruptcyRate<.05&&newbie.allThreeSurviveRate>.85&&newbie.successRate>.55&&newbie.successRate<.88&&newbie.actionsUsedRatio>.45&&newbie.interventionDiversity>=5,expert:expert.bankruptcyRate<.2&&expert.allThreeSurviveRate>.6&&expert.successRate>.55&&expert.successRate<.88&&expert.turnoverRatio>.15&&expert.dominantShare<.45};
const meta={generatedAt:new Date().toISOString(),description:'100 synthetic multiplayer sessions. Each session has 3 companies and 3 players per company; 60 Newbie / 40 Expert. Results are written to CI artifacts only and never to Neon.',config:{...DEFAULT_CONFIG},newbie,expert,readiness,counts:{sessions:100,companies:300,playerSeats:900}};
mkdirSync('balance-results',{recursive:true});
writeFileSync('balance-results/three-company-study.json',JSON.stringify({meta,sessions,companies},null,2));
const cols:(keyof CompanyResult)[]=['session','mode','company','players','scribe','successRate','turnoverRatio','bankrupt','negativeSite','actionsUsedRatio','diversity','riverUses','intranetUses','aarUses','automationUses','dominantShare','learningScore'];
const esc=(v:unknown)=>`"${String(v).replaceAll('"','""')}"`;writeFileSync('balance-results/three-company-study.csv',[cols.join(','),...companies.map(row=>cols.map(k=>esc(row[k])).join(','))].join('\n'));
const pct=(v:number)=>(v*100).toFixed(1)+'%';
const report=`# Three-company / three-player balance study\n\nGenerated: ${meta.generatedAt}\n\nThis run contains **100 synthetic game sessions**, each with **3 companies × 3 players** (900 player-seats): 60 Newbie sessions and 40 Expert sessions. It does **not** write to Neon. All three companies in a session face the same market sequence, while their starting knowledge and team personas differ. Team decisions use the mean of the three personas with a 25% scribe influence.\n\n## Newbie\n- Company success rate: ${pct(newbie.successRate)}\n- Company bankruptcy rate: ${pct(newbie.bankruptcyRate)}\n- Sessions where all three companies survive: ${pct(newbie.allThreeSurviveRate)}\n- Companies taking at least one site negative: ${pct(newbie.negativeSiteRate)}\n- Mean final turnover / starting turnover: ${newbie.turnoverRatio.toFixed(2)}×\n- Actions used: ${pct(newbie.actionsUsedRatio)}\n- Mean intervention diversity: ${newbie.interventionDiversity.toFixed(2)} / 8\n- River uses/company: ${newbie.riverUses.toFixed(2)}; Intranet: ${newbie.intranetUses.toFixed(2)}; AAR: ${newbie.aarUses.toFixed(2)}\n- First-play guardrail: **${readiness.newbie?'PASS':'REVIEW'}**\n\n## Expert (28-round long horizon)\n- Company success rate: ${pct(expert.successRate)}\n- Company bankruptcy rate: ${pct(expert.bankruptcyRate)}\n- Sessions where all three companies survive: ${pct(expert.allThreeSurviveRate)}\n- Companies taking at least one site negative: ${pct(expert.negativeSiteRate)}\n- Mean final turnover / starting turnover: ${expert.turnoverRatio.toFixed(2)}×\n- Actions used: ${pct(expert.actionsUsedRatio)}\n- Mean intervention diversity: ${expert.interventionDiversity.toFixed(2)} / 8\n- Mean dominant intervention share: ${pct(expert.dominantShare)}\n- Expert long-horizon guardrail: **${readiness.expert?'PASS':'REVIEW'}**\n\n## Competition / team signal\n- Mean spread between first and third company final turnover: Newbie ${newbie.meanLeaderSpread.toFixed(2)}×; Expert ${expert.meanLeaderSpread.toFixed(2)}×.\n- This is a balance model, not a usability test. Persona aggregation approximates group discussion; it does not reproduce real negotiation, social inhibition, facilitation quality or screen-level interaction.\n`;
writeFileSync('balance-results/three-company-study.md',report);
console.log('\n=== THREE-COMPANY / THREE-PLAYER STUDY ===');console.log(meta);console.log('\n'+report);
