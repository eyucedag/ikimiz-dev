import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SharedRecord } from '../src/types';
import { formatDate, getUpcoming, localDay, nextOccurrence, parseLocalDay, relationshipDuration } from '../src/utils/date';

function record(id: string, date: string, patch: Partial<SharedRecord> = {}): SharedRecord {
  return { id, category: 'calendar', title: id, date, authorId: 'a', createdAt: '', updatedAt: '', version: 1, ...patch };
}

test('local day remains local on both sides of UTC midnight', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Europe/Istanbul';
    assert.equal(localDay(new Date('2026-11-09T22:30:00Z')), '2026-11-10');
    assert.match(formatDate('2026-11-10'), /10 Kasım/);
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(localDay(new Date('2026-11-10T01:30:00Z')), '2026-11-09');
    assert.match(formatDate('2026-11-10'), /10 Kasım/);
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('invalid days are rejected instead of rolling into the next month', () => {
  assert.equal(parseLocalDay('2026-02-29'), null);
  assert.equal(parseLocalDay('2026-02-30'), null);
  assert.equal(parseLocalDay('2026-13-01'), null);
  assert.equal(formatDate('2026-02-30'), '');
  assert.equal(localDay(parseLocalDay('2028-02-29')!), '2028-02-29');
});

test('upcoming includes today and six following calendar days sorted by date and time', () => {
  const records = [
    record('out', '2026-11-17'), record('last', '2026-11-16', { time: '23:59' }),
    record('yesterday', '2026-11-09'), record('late', '2026-11-10', { time: '19:30' }),
    record('early', '2026-11-10', { time: '09:00' }), record('all-day', '2026-11-10'),
    record('not-an-event', '2026-11-10', { category: 'tasks' }),
  ];
  assert.deepEqual(getUpcoming(records, new Date(2026, 10, 10, 23, 59)).map(item => item.id), ['all-day', 'early', 'late', 'last']);
});

test('yearly special days cross New Year while one-off events keep their original date', () => {
  const birthday = record('birthday', '1994-01-02', { category: 'special-days', specialDayType: 'birthday' });
  const anniversary = record('anniversary', '2020-12-31', { category: 'special-days', specialDayType: 'anniversary' });
  const once = record('once', '2020-12-31', { category: 'special-days', specialDayType: 'other' });
  const upcoming = getUpcoming([birthday, anniversary, once], new Date(2026, 11, 29));
  assert.deepEqual(upcoming.map(item => [item.id, item.date]), [['anniversary', '2026-12-31'], ['birthday', '2027-01-02']]);
  assert.equal(birthday.date, '1994-01-02', 'calculating an occurrence must not mutate saved history');
});

test('Feb 29 recurs on Feb 28 in common years and Feb 29 in leap years', () => {
  const leap = record('leap', '2000-02-29', { category: 'special-days', specialDayType: 'birthday' });
  assert.equal(nextOccurrence(leap, '2026-02-27'), '2026-02-28');
  assert.equal(nextOccurrence(leap, '2026-03-01'), '2027-02-28');
  assert.equal(nextOccurrence(leap, '2028-02-27'), '2028-02-29');
  assert.equal(nextOccurrence(record('future', '2028-02-29', { category: 'special-days', specialDayType: 'anniversary' }), '2026-02-27'), '2028-02-29');
});

test('upcoming spans calendar days across DST rather than a fixed number of hours', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const upcoming = getUpcoming([record('last', '2026-03-10'), record('outside', '2026-03-11')], new Date(2026, 2, 4, 23, 45));
    assert.deepEqual(upcoming.map(item => item.id), ['last']);
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test('relationship duration handles no start, future start, and local midnight', () => {
  const now = new Date(2026, 10, 10, 8, 24, 16);
  assert.deepEqual(relationshipDuration('', now), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(relationshipDuration('2026-11-11', now), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(relationshipDuration('2026-11-09', now), { days: 1, hours: 8, minutes: 24, seconds: 16 });
});
