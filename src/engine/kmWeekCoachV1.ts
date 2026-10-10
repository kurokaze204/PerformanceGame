import type {CompanyV2} from '../types/gameV2.ts';
import {KM_WEEK_DOMAINS} from './kmWeekV1.ts';

// One distinct business question per free-play round. The first four prompts
// build from expert dependence to distribution, constraints and resilience.
// Round 5 retirement and Round 6 replacement have their own reflection popups.
export function kmWeekCoachV1(company:CompanyV2){
 const state=company.kmWeek;
 if(!state||state.stage!=='free'||state.freeRound<1||state.freeRound>6)return null;
 const sites=company.sites.filter(site=>!site.isClosed);
 const experts=company.experts.filter(expert=>!expert.isVacant);
 const gaps=state.challenges.map(card=>({
  domain:card.domain,
  gap:Math.max(0,card.difficulty-(sites.find(site=>site.id===card.siteId)?.teamCapability[card.domain]||0)),
  impact:card.impact,
 })).sort((a,b)=>b.gap*b.impact-a.gap*a.impact);
 const domain=gaps[0]?.domain||KM_WEEK_DOMAINS[0];
 const domainName=domain==='hr'?'Human Resources':domain==='marketing'?'Marketing':'Operations';
 const expert=experts.find(item=>item.domains.some(skill=>skill.domain===domain));
 const expertScore=expert?.domains.find(skill=>skill.domain===domain)?.score||0;
 const scores=sites.map(site=>({site,score:site.teamCapability[domain]||0})).sort((a,b)=>b.score-a.score);
 const top=scores[0],bottom=scores[scores.length-1];
 if(!top||!bottom)return null;
 const firstName=expert?.name.split(' ')[0]||'your company expert';

 if(state.freeRound===1)return {domain,text:`${firstName} knows ${domainName} at level ${expertScore}, but ${bottom.site.name} only has level ${bottom.score}. Will you keep sending your expert to problems, or build local expertise that can spread?`};
 if(state.freeRound===2)return {domain,text:top.score===bottom.score
  ?`Your ${domainName} capability is similar across sites. Where would a stronger local team make the biggest difference?`
  :`${top.site.name} has ${domainName} ${top.score}, while ${bottom.site.name} has ${bottom.score}. How could you make the stronger site's knowledge available elsewhere?`};
 if(state.freeRound===3)return {domain,text:`Where did missing ${domainName} knowledge put business performance at risk this round? What one investment would remove the biggest constraint?`};
 if(state.freeRound===4)return {domain,text:`If ${firstName} were unavailable tomorrow, could ${bottom.site.name} handle a ${domainName} problem? What would you build now?`};
 // Normally the retirement/replacement popup replaces these questions.
 if(state.freeRound===5)return {domain,text:`What must change so ${domainName} capability doesn't depend on one person?`};
 return {domain,text:`Where is ${domainName} still hard to access locally, and how will you strengthen it before the next disruption?`};
}
