import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModels, loadEvents, blended, rank, toCSV, validate } from '../src/prices.mjs';

test('shipped data passes its own schema validation', () => {
  assert.deepEqual(validate(), []);
});

test('blended math: (ratio*in + out) / (ratio + 1)', () => {
  const m = { in: 2, out: 10 };
  assert.ok(Math.abs(blended(m, 10) - 30 / 11) < 1e-12);
  assert.equal(blended(m, 1), 6);
  assert.throws(() => blended(m, 0), RangeError);
});

test('rank sorts cheapest-first and respects provider filter', () => {
  const { models } = loadModels();
  const all = rank(models, 10);
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i].blended >= all[i - 1].blended);
  }
  const anthropicOnly = rank(models, 10, { providers: ['Anthropic'] });
  assert.ok(anthropicOnly.length > 0);
  assert.ok(anthropicOnly.every((m) => m.provider === 'Anthropic'));
});

test('toCSV emits a header plus one row per model', () => {
  const { models } = loadModels();
  const lines = toCSV(models, 10).trim().split('\n');
  assert.equal(lines.length, models.length + 1);
  assert.match(lines[0], /^model,provider,input_usd_per_m/);
});

test('events are newest-first with known types', () => {
  const { events } = loadEvents();
  assert.ok(events.length >= 3);
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].date <= events[i - 1].date);
  }
});

test('validate catches a malformed model and a bad event', () => {
  const bad = validate({
    models: { verified: 'Oct 7, 2026', models: [{ id: 'x', name: 'X', provider: 'P', in: -1, out: 5, ctx: 1000 }] },
    events: { events: [{ date: '2026-13-99', type: 'party', models: [] }] },
  });
  assert.ok(bad.some((p) => p.includes('bad in')));
  assert.ok(bad.some((p) => p.includes('bad type')));
  assert.ok(bad.some((p) => p.includes('empty models')));
});
