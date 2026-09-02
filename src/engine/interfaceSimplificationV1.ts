import type { EventCard, KnowledgeDomain } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';
const FINANCE:KnowledgeDomain='finance';const FALLBACK:KnowledgeDomain='operations';
const CITY_CODES:Record<string,string>={melbourne:'MEL',sydney:'SYD',brisbane:'BNE',adelaide:'ADL',perth:'PER',darwin:'DRW',HQ:'HQ'};
const cityCode=(location:string)=>CITY_CODES[location]||CITY_CODES[location?.toLowerCase()]||location?.slice(0,3).toUpperCase()||'—';
function labelExperts(session:GameSessionV2):void{for(const company of session.companies)for(const expert of company.experts){if(!/\s\([A-Z]{2,3}\)$/.test(expert.name))expert.name=`${expert.name} (${cityCode(expert.homeLocation||expert.location)})`;}}
function simplifyCard(card?:EventCard):void{if(!card)return;const withoutFinance=card.domains.filter(req=>req.domain!==FINANCE);card.domains=withoutFinance.length?withoutFinance:card.domains.map(req=>req.domain===FINANCE?{...req,domain:FALLBACK}:req);}
function simplifyExpert(expert:GameSessionV2['companies'][number]['experts'][number]):void{
 const financeSkill=expert.domains.find(skill=>skill.domain===FINANCE);
 const visibleSkills=expert.domains.filter(skill=>skill.domain!==FINANCE);
 // Newbie hides Finance, but an expert must never become domain-less because of that.
 // If Finance was their only expertise, preserve the score by remapping it to Operations.
 expert.domains=visibleSkills.length?visibleSkills:(financeSkill?[{...financeSkill,domain:FALLBACK}]:[]);
 const visibleSpof=expert.spofDomains.filter(domain=>domain!==FINANCE);
 const financeWasSpof=expert.spofDomains.includes(FINANCE);
 expert.spofDomains=visibleSpof.length?visibleSpof:(financeWasSpof&&expert.domains.some(skill=>skill.domain===FALLBACK)?[FALLBACK]:[]);
 expert.isSPOF=expert.spofDomains.length>0;
}
export function applyInterfaceSimplificationV1(session:GameSessionV2):void{
 labelExperts(session);
 if(session.experienceMode!=='newbie')return;
 session.copMemberships=session.copMemberships.filter(m=>m.domain!==FINANCE);simplifyCard(session.finalDisruptionCard);
 for(const company of session.companies){company.automatedDomains=company.automatedDomains.filter(d=>d!==FINANCE);if(company.horizonScanDomain===FINANCE)company.horizonScanDomain=null;company.experts.forEach(simplifyExpert);for(const event of session.activeEvents[company.id]||[]){simplifyCard(event.card);const allocations:any={};event.card.domains.forEach(req=>{allocations[req.domain]=(event.allocations as any)?.[req.domain]||{}});event.allocations=allocations;}}
}
