import assert from 'node:assert/strict';
import { finalChallengeDue } from '../src/server/gameServiceV4.ts';
import type { GameSessionV2 } from '../src/types/gameV2.ts';

function session(overrides: Partial<GameSessionV2> = {}): GameSessionV2 {
  return {
    id: 'FINAL-TRIGGER-SMOKE',
    title: 'Final trigger smoke',
    round: 1,
    phase: 'risk',
    isPaused: false,
    isFinalDisruptionActive: false,
    finalDisruptionCard: undefined,
    finalDisruptionResolved: false,
    companies: [],
    activeEvents: {},
    copMemberships: [],
    config: {} as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timerStartedAt: null,
    timerEndsAt: null,
    timerPausedSecondsRemaining: 60 * 60,
    riskResults: null,
    rulesVersion: 'test',
    deckVersion: 'test',
    balanceVersion: 'test',
    experienceMode: 'newbie',
    gameDurationMinutes: 60,
    finalWindowMinutes: 10,
    minutesPerMove: 8,
    maxPlayersPerCompany: 6,
    populationMode: 'balanced',
    participants: [],
    gameEndMode: 'time',
    finalRoundCount: 30,
    ...overrides,
  } as GameSessionV2;
}

assert.equal(finalChallengeDue(session({ round: 99 })), false);
assert.equal(finalChallengeDue(session({
  timerStartedAt: new Date().toISOString(),
  timerEndsAt: new Date(Date.now() + 11 * 60 * 1000).toISOString(),
  timerPausedSecondsRemaining: null,
})), false);
assert.equal(finalChallengeDue(session({
  timerStartedAt: new Date().toISOString(),
  timerEndsAt: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
  timerPausedSecondsRemaining: null,
})), true);
assert.equal(finalChallengeDue(session({
  round: 99,
  timerStartedAt: null,
  timerEndsAt: null,
  timerPausedSecondsRemaining: 60 * 60,
})), false);
assert.equal(finalChallengeDue(session({
  experienceMode: 'expert',
  gameEndMode: 'rounds',
  finalRoundCount: 30,
  round: 29,
})), false);
assert.equal(finalChallengeDue(session({
  experienceMode: 'expert',
  gameEndMode: 'rounds',
  finalRoundCount: 30,
  round: 30,
})), true);
assert.equal(finalChallengeDue(session({
  experienceMode: 'newbie',
  gameEndMode: 'rounds',
  finalRoundCount: 1,
  round: 99,
})), false);

console.log('Final challenge trigger smoke tests passed.');
