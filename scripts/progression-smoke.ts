import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import { capProgressedEventImpact, diversifyInitialKnowledge, progressEventCard } from '../src/engine/eventProgressionV5.ts';
import type { EventCard } from '../src/types/game.ts';

assert.equal(DEFAULT_CONFIG.starting_turnover, 875);
assert.equal(DEFAULT_CONFIG.event_value_growth_factor, 1.4);
assert.equal(DEFAULT_CONFIG.event_difficulty_growth_per_move, 0.28);
assert.equal(DEFAULT_CONFIG.event_impact_cap_ratio, 0.35);
assert.equal(DEFAULT_CONFIG.event_difficulty_cap, 9);
assert.equal(DEFAULT_CONFIG.event_expert_moves_per_pressure_step, 6);
assert.equal(DEFAULT_CONFIG.actions_per_round, 5);

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
const move3=progressEventCard(base,3,DEFAULT_CONFIG,'newbie');
const move4=progressEventCard(base,4,DEFAULT_CONFIG,'newbie');
assert.ok(move4.impact>move3.impact,'financial exposure should increase each newbie move');
assert.ok(move4.domains[0].difficulty>=move3.domains[0].difficulty,'difficulty should not fall as moves progress');

const learning=progressEventCard(base,1,DEFAULT_CONFIG,'newbie');
assert.ok(learning.title.startsWith('LEARNING:'));
assert.ok(learning.impact<=25,'first move should remain cheap');
assert.ok(learning.domains.every(d=>d.difficulty<=3),'first move should remain simple');

const expertMove6=progressEventCard(base,6,DEFAULT_CONFIG,'expert');
const expertMove7=progressEventCard(base,7,DEFAULT_CONFIG,'expert');
assert.ok(expertMove7.impact>=expertMove6.impact,'expert pressure should advance in slower steps, never backwards');
assert.ok(expertMove7.impact<progressEventCard(base,7,DEFAULT_CONFIG,'newbie').impact,'expert mode should pace escalation more slowly for long-horizon play');

const localSite=company.sites[0];
const oversized:EventCard={...base,impact:9999};
const capped=capProgressedEventImpact(oversized,company,localSite.id,DEFAULT_CONFIG);
assert.ok(capped.impact<=Math.max(5,Math.round(localSite.turnover*0.35)),'local event impact should be capped to the tuned share of site turnover');

const critical=progressEventCard(base,13,DEFAULT_CONFIG,'newbie');
assert.ok(critical.title.startsWith('CRITICAL:'));
assert.ok(critical.domains.every(d=>d.difficulty<=9),'difficulty must respect the tuned ceiling');

console.log('Progression V5 smoke tests passed.');
