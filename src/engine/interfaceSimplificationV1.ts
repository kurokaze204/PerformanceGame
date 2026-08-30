import type { EventCard, KnowledgeDomain } from '../types/game.ts';
import type { GameSessionV2 } from '../types/gameV2.ts';

const FINANCE:KnowledgeDomain='finance';
const FALLBACK:KnowledgeDomain='operations';

function simplifyCard(card?:EventCard):void{
 if(!card)return;
 const withoutFinance=card.domains.filter(req=>req.domain!==FINANCE);
 // A small number of cards may be Finance-only. Keep the business scenario but
 // make the Newbie knowledge test operational rather than reintroducing Finance.
 card.domains=withoutFinance.length?withoutFinance:card.domains.map(req=>req.domain===FINANCE?{...req,domain:FALLBACK}:req);
}

export function applyInterfaceSimplificationV1(session:GameSessionV2):void{
 if(session.experienceMode!=='newbie')return;
 session.copMemberships=session.copMemberships.filter(m=>m.domain!==FINANCE);
 simplifyCard(session.finalDisruptionCard);
 for(const company of session.companies){
  company.automatedDomains=company.automatedDomains.filter(d=>d!==FINANCE);
  if(company.horizonScanDomain===FINANCE)company.horizonScanDomain=null;
  company.experts.forEach(expert=>{
   expert.domains=expert.domains.filter(skill=>skill.domain!==FINANCE);
   expert.spofDomains=expert.spofDomains.filter(domain=>domain!==FINANCE);
   expert.isSPOF=expert.spofDomains.length>0;
  });
  for(const event of session.activeEvents[company.id]||[]){
   simplifyCard(event.card);
   const allocations:any={};
   event.card.domains.forEach(req=>{allocations[req.domain]=(event.allocations as any)?.[req.domain]||{}});
   event.allocations=allocations;
  }
 }
}
