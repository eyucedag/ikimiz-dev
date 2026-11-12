import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addRecordToData, assertRecordVersion, createEmptyData, deleteRecordFromData, updateRecordInData,
  validateProfile, validateRecord, validateSettings,
} from '../src/services/local';

test('a new local area starts without invented people, dates or shared content', () => {
  const data = createEmptyData();
  assert.deepEqual(data.records, []);
  assert.deepEqual(data.notifications, []);
  assert.deepEqual(data.profile, { name: '', partnerName: '', relationshipDate: '' });
});

test('each partner gets a separate daily song; repeating one selection updates it', () => {
  const input = { category: 'song' as const, title: 'Bir şarkı', body: 'Bir sanatçı', date: '2026-11-10' };
  let data = addRecordToData(createEmptyData(), input, 'a');
  const firstId = data.records[0].id;
  data = addRecordToData(data, { ...input, title: 'Partnerin şarkısı' }, 'b');
  data = addRecordToData(data, { ...input, title: 'Yeni seçim' }, 'a');
  assert.equal(data.records.length, 2);
  assert.equal(data.records.find(record => record.authorId === 'a')?.id, firstId);
  assert.equal(data.records.find(record => record.authorId === 'a')?.title, 'Yeni seçim');
  assert.equal(data.records.find(record => record.authorId === 'b')?.title, 'Partnerin şarkısı');
});

test('mood is normalized and limited to one per author per local day', () => {
  let data = addRecordToData(createEmptyData(), { category: 'mood', title: 'İyi', mood: '😊', date: '2026-11-10' }, 'a');
  data = addRecordToData(data, { category: 'mood', title: 'Yorgunum', mood: '😴', date: '2026-11-10', body: 'Uzun bir gündü.' }, 'a');
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].title, 'Yorgunum');
  assert.equal(data.records[0].version, 2);
  assert.throws(() => validateRecord({ category: 'mood', title: 'İyi', mood: '😊', body: 'a'.repeat(281) }), /280/);
  assert.throws(() => validateRecord({ category: 'mood', title: 'Bilinmeyen', mood: 'x' }), /ruh hâli/);
});

test('updates preserve authorship and support records created by either partner', () => {
  let data = addRecordToData(createEmptyData(), { category: 'tasks', title: 'Faturayı öde', done: false }, 'b');
  const original = data.records[0];
  data = updateRecordInData(data, original.id, { done: true });
  assert.equal(data.records[0].authorId, 'b');
  assert.equal(data.records[0].done, true);
  assert.equal(data.records[0].createdAt, original.createdAt);
  data = deleteRecordFromData(data, original.id);
  assert.equal(data.records.length, 0);
});

test('changing a day cannot silently overwrite another daily record', () => {
  let data = addRecordToData(createEmptyData(), { category: 'song', title: 'Dün', date: '2026-11-09' }, 'a');
  data = addRecordToData(data, { category: 'song', title: 'Bugün', date: '2026-11-10' }, 'a');
  const old = data.records.find(record => record.date === '2026-11-09')!;
  assert.throws(() => updateRecordInData(data, old.id, { date: '2026-11-10' }), /zaten bir kayıt/);
});

test('a form or delete confirmation opened before a live change cannot overwrite the newer record', () => {
  let data = addRecordToData(createEmptyData(), { category: 'notebook', title: 'Ortak not', body: 'İlk metin' }, 'a');
  const opened = { ...data.records[0] };
  data = updateRecordInData(data, opened.id, { body: 'Partnerin yeni metni' });
  assert.throws(() => assertRecordVersion(data, opened.id, opened.version), /değiştirildi/);
  assert.doesNotThrow(() => assertRecordVersion(data, opened.id, data.records[0].version));
  assert.equal(data.records[0].body, 'Partnerin yeni metni');
});

test('note limits, dates, times and external URL schemes are validated before saving', () => {
  assert.throws(() => validateRecord({ category: 'partner-note', title: 'Not', body: 'a'.repeat(141) }), /140/);
  assert.throws(() => validateRecord({ category: 'calendar', title: 'Yemek', date: '2026-02-30' }), /tarih/);
  assert.throws(() => validateRecord({ category: 'calendar', title: 'Yemek', date: '2026-11-10', time: '25:00' }), /Saati/);
  assert.throws(() => validateRecord({ category: 'documents', title: 'Bağlantı', url: 'javascript:alert(1)' }), /Bağlantı/);
  assert.equal(validateRecord({ category: 'documents', title: ' Bağlantı ', url: 'https://example.org/a' }).title, 'Bağlantı');
  assert.throws(() => validateProfile({ name: 'A', partnerName: '', relationshipDate: '2999-01-01' }), /başlangıcı/);
});

test('home layout preferences preserve all categories and independently hidden cards', () => {
  const base = createEmptyData().settings;
  const next = validateSettings({ ...base, homeOrder: ['song', 'song'], hiddenCards: ['upcoming', 'mood'] });
  assert.equal(next.homeOrder[0], 'song');
  assert.equal(next.homeOrder.length, 17);
  assert.deepEqual(next.hiddenCards, ['upcoming', 'mood']);
  assert.deepEqual(base.hiddenCards, []);
});
