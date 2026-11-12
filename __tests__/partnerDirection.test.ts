import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { partnerDirection } from '../src/utils/partnerDirection';

test('partner oku iki telefonun konumundan ve kendi pusulasından hesaplanır', () => {
  const origin = { latitude: 0, longitude: 0 };
  assert.equal(partnerDirection(origin, { latitude: 1, longitude: 0 }, 0).rotation, 0);
  assert.equal(partnerDirection(origin, { latitude: 0, longitude: 1 }, 0).rotation, 90);
  assert.equal(partnerDirection(origin, { latitude: -1, longitude: 0 }, 0).rotation, 180);
  assert.equal(partnerDirection(origin, { latitude: 0, longitude: -1 }, 0).rotation, 270);
  assert.equal(partnerDirection(origin, { latitude: 0, longitude: 1 }, 90).rotation, 0);
  assert.equal(partnerDirection(origin, { latitude: 0, longitude: 1 }, 180).rotation, 270);
  assert.equal(partnerDirection({ latitude: 0, longitude: 1 }, origin, 0).rotation, 270);
});

test('yakındaki partner için yön uydurmaz; pusulasız cihazda kuzeye göre gösterir', () => {
  const origin = { latitude: 41, longitude: 29 };
  assert.equal(partnerDirection(origin, origin, 45).rotation, null);
  assert.equal(partnerDirection({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }, null).rotation, 90);
  const acrossDateline = partnerDirection({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 }, 0);
  assert.equal(acrossDateline.rotation, 90);
  assert.ok(acrossDateline.distance > 22000 && acrossDateline.distance < 23000);
});
