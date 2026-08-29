import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import { diversifyInitialKnowledge, progressEventCard } from '../src/engine/eventProgressionV5.ts';
import type { EventCard } from '../src/types/game.ts';

assert.equal(DEFAULT_CONFIG.starting_turnover, 875);
assert.equal(DEFAULT_CONFIG.event_value_growth_factor, 1.8);

const company=createInitialCompanyV2('Progression Co','progression-co',DEFAULT_CONFIG);
assert.equal(company.turnover,875);
diversifyInitialKnowledge(company);
for(const site of company.sites){
  const team=Object.values(site.teamCapability);
  const docs=Object.values(site.codifiedKnowledge);
  assert.ok(Math.max(...team)-Math.min(...team)>=2,'team knowledge should have visible spread');
  assert.ok(Math.max(...docs)-Math.min(...docs)>=2,'codified knowledge should have visible spread');
  assert.ok(Math.min(...team)>=0&&Math.min(...docs)>=0,'knowledge scores cannot fall below zero');
}
const intranet=Object.values(company.intranet);
assert.equal(Math.max(...intranet),4);
assert.equal(Math.min(...intranet),1);

const base:EventCard={id:'TEST',type:'problem',scope:'local',title:'Test escalation',description:'Test',domains:[{domain:'operations',difficulty:4}],impact:100,tags:['test']};
const move3=progressEventCard(base,3,DEFAULT_CONFIG);
const move4=progressEventCard(base,4,DEFAULT_CONFIG);
assert.ok(move4.impact>move3.impact,'financial exposure should increase each move');
assert.ok(move4.domains[0].difficulty>=move3.domains[0].difficulty,'difficulty should not fall as moves progress');

const learning=progressEventCard(base,1,DEFAULT_CONFIG);
assert.ok(learning.title.startsWith('LEARNING:'));
assert.ok(learning.impact<=25,'first move should remain cheap');
assert.ok(learning.domains.every(d=>d.difficulty<=3),'first move should remain simple');

const high=progressEventCard(base,7,DEFAULT_CONFIG);
assert.ok(high.title.startsWith('CRITICAL:'));
assert.ok(high.impact>company.startingTurnover*0.2,'late game should be capable of materially threatening the company');

console.log('Progression V5 smoke tests passed.');
