import assert from 'node:assert/strict';
import test from 'node:test';
import { plantGrowthLabel, plantGrowthStage, plantWiltLevel } from '../src/utils/plantGrowth';

test('plant growth advances every two days and stops at the mature stage', () => {
  const started = { plantStartedAt: '2026-11-01T12:00:00.000Z' };
  assert.equal(plantGrowthStage(started, new Date('2026-11-01T12:00:00.000Z')), 0);
  assert.equal(plantGrowthStage(started, new Date('2026-11-03T12:00:00.000Z')), 1);
  assert.equal(plantGrowthStage(started, new Date('2026-11-05T12:00:00.000Z')), 2);
  assert.equal(plantGrowthStage(started, new Date('2026-11-07T12:00:00.000Z')), 3);
  assert.equal(plantGrowthStage(started, new Date('2027-01-01T12:00:00.000Z')), 3);
});

test('both partners speed growth while missed days gradually wilt the plant', () => {
  const waterings = [
    { userId: 'a', date: '2026-11-01', createdAt: '2026-11-01T08:00:00.000Z' },
    { userId: 'b', date: '2026-11-01', createdAt: '2026-11-01T09:00:00.000Z' },
    { userId: 'a', date: '2026-11-02', createdAt: '2026-11-02T08:00:00.000Z' },
    { userId: 'b', date: '2026-11-02', createdAt: '2026-11-02T09:00:00.000Z' },
  ];
  assert.equal(plantGrowthStage({ plantStartedAt: waterings[0].createdAt, plantWaterings: waterings }), 1);
  assert.equal(plantGrowthStage({ plantStartedAt: waterings[0].createdAt, plantWaterings: waterings.slice(0, 2) }), 0);
  assert.equal(plantWiltLevel({ plantWaterings: waterings, wateredAt: waterings.at(-1)!.createdAt }, new Date('2026-11-03T12:00:00+03:00')), 0);
  assert.equal(plantWiltLevel({ plantWaterings: waterings, wateredAt: waterings.at(-1)!.createdAt }, new Date('2026-11-05T12:00:00+03:00')), 2);
});

test('mature plants describe flowers or extended vines', () => {
  assert.equal(plantGrowthLabel('violet', 3), 'Çiçek açtı');
  assert.equal(plantGrowthLabel('cactus', 3), 'Çiçek açtı');
  assert.equal(plantGrowthLabel('heart', 3), 'Yemyeşil oldu');
});
