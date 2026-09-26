import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/engine/config.ts';
import { createInitialCompanyV2 } from '../src/engine/coreV2.ts';
import { executeRiverKnowledgeSharing, riverTeachingSitesUsedThisRound } from '../src/engine/riverKnowledgeV1.ts';
import type { GameSessionV2 } from '../src/types/gameV2.ts';

const company=createInitialCompanyV2('Transfer Test Co','transfer-test',DEFAULT_CONFIG);
company.actionsRemaining=5;
const mel=company.sites.find(site=>site.id==='melbourne')!;
const syd=company.sites.find(site=>site.id==='sydney')!;
const bri=company.sites.find(site=>site.id==='brisbane')!;
const adl=company.sites.find(site=>site.id==='adelaide')!;
mel.teamCapability.engineering=6;
syd.teamCapability.engineering=0;
bri.teamCapability.engineering=0;
adl.teamCapability.engineering=5;

const session={
  id:'TRANSFER-TEST',title:'Transfer Test',round:1,phase:'investment',isPaused:false,isFinalDisruptionActive:false,
  companies:[company],activeEvents:{[company.id]:[]},copMemberships:[],config:{...DEFAULT_CONFIG},
  createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),timerStartedAt:null,timerEndsAt:null,timerPausedSecondsRemaining:3600,
  riskResults:null,rulesVersion:'test',deckVersion:'test',balanceVersion:'test',experienceMode:'newbie',gameDurationMinutes:45,finalWindowMinutes:10,minutesPerMove:8,maxPlayersPerCompany:1,populationMode:'balanced',gameEndMode:'time',finalRoundCount:8,participants:[],
} as GameSessionV2;

const first=executeRiverKnowledgeSharing(session,company,{type:'SITE_KNOWLEDGE_SHARING',sourceSiteId:'melbourne',siteId:'sydney',domain:'engineering'});
assert.equal(first.success,true,'first use of a teaching site in a round should succeed');
assert.deepEqual(riverTeachingSitesUsedThisRound(company,1),['melbourne']);

const repeat=executeRiverKnowledgeSharing(session,company,{type:'SITE_KNOWLEDGE_SHARING',sourceSiteId:'melbourne',siteId:'brisbane',domain:'engineering'});
assert.equal(repeat.success,false,'same teaching site must not be reused in the same round');
assert.match(String(repeat.message),/already been used as a teaching site this round/i);

const other=executeRiverKnowledgeSharing(session,company,{type:'SITE_KNOWLEDGE_SHARING',sourceSiteId:'adelaide',siteId:'brisbane',domain:'engineering'});
assert.equal(other.success,true,'a different teaching site should still be available in the same round');
assert.deepEqual(new Set(riverTeachingSitesUsedThisRound(company,1)),new Set(['melbourne','adelaide']));

session.round=2;
company.actionsRemaining=5;
const nextRound=executeRiverKnowledgeSharing(session,company,{type:'SITE_KNOWLEDGE_SHARING',sourceSiteId:'melbourne',siteId:'brisbane',domain:'engineering'});
assert.equal(nextRound.success,true,'teaching-site eligibility must reset automatically in a new round');
assert.deepEqual(riverTeachingSitesUsedThisRound(company,2),['melbourne']);

console.log('River teaching-site limit smoke tests passed.');
