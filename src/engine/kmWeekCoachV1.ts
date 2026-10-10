import type { CompanyV2 } from '../types/gameV2.ts';
import { KM_WEEK_DOMAINS } from './kmWeekV1.ts';

// Ask a River-informed question after each of the first six full-play rounds.
// The three introductory guided turns are separate and must not use up those six.
export function kmWeekCoachV1(company:CompanyV2){
 const state=company.kmWeek;
 if(!state||state.stage!=='free'||state.freeRound<1||state.freeRound>6)return null;
 const sites=company.sites.filter(site=>!site.isClosed);
 const experts=company.experts.filter(expert=>!expert.isVacant);
 const busy=experts.find(expert=>state.trainingCommitments?.[expert.id]===company.round);
 if(busy)return {domain:busy.domains[0].domain,text:'Your expert is busy building capability elsewhere. How well can your sites perform without them?'};
 const gaps=state.challenges.map(card=>({domain:card.domain,gap:Math.max(0,card.difficulty-(sites.find(site=>site.id===card.siteId)?.teamCapability[card.domain]||0)),impact:card.impact})).sort((a,b)=>b.gap*b.impact-a.gap*a.impact);
 const domain=gaps[0]?.domain||KM_WEEK_DOMAINS[0];
 const expert=experts.find(item=>item.domains.some(skill=>skill.domain===domain));
 const depth=expert?.domains.find(skill=>skill.domain===domain)?.score||0;
 const scores=sites.map(site=>({site,score:site.teamCapability[domain]||0})).sort((a,b)=>b.score-a.score);
 const top=scores[0],bottom=scores[scores.length-1];
 if(!top||!bottom)return null;
 if(!state.investmentHistory.some(item=>item.type==='TRAIN_EXPERT'&&item.domain===domain)&&depth<6)return {domain,text:'Your organisation needs deeper expertise. Who could you develop to tackle tougher challenges?'};
 const trained=state.investmentHistory.some(item=>item.type==='LOCAL_TRAINING'&&item.domain===domain);
 const transferred=state.investmentHistory.some(item=>item.type==='KNOWLEDGE_TRANSFER'&&item.domain===domain);
 if(company.round>=4&&gaps[0]?.gap&&transferred)return {domain,text:'If you took a Theory of Constraints view, where could you invest to remove the greatest blocker right now?'};
 if(top.score>bottom.score&&(trained||top.score>=depth))return {domain,text:`${top.site.name} is ahead in ${domain}. How could you turn that advantage into company-wide capability?`};
 if(depth>top.score&&top.score<5)return {domain,text:'Your expert knows the answers. Are you planning to have them go site to site, or train the best site so they can transfer to the others? Remember, if you use them for training they won’t be available to help solve problems next round.'};
 if(depth<6&&gaps[0]?.gap)return {domain,text:'Your organisation needs deeper expertise. Who could you develop to tackle tougher challenges?'};
 if(top.score-bottom.score<=1)return {domain,text:'Your knowledge is spreading. Where would your next investment create the greatest business advantage?'};
 return {domain,text:'What happens if your strongest expert leaves tomorrow?'};
}
