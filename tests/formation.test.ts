import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFormation } from '../src/optimizer/formation.ts';

test('interpreta formações válidas e inclui goleiro e técnico', () => {
  assert.deepEqual(parseFormation('4-3-3'), { GOL: 1, LAT: 2, ZAG: 2, MEI: 3, ATA: 3, TEC: 1 });
  assert.deepEqual(parseFormation('3-5-2'), { GOL: 1, LAT: 2, ZAG: 1, MEI: 5, ATA: 2, TEC: 1 });
  assert.deepEqual(parseFormation('5-4-1'), { GOL: 1, LAT: 2, ZAG: 3, MEI: 4, ATA: 1, TEC: 1 });
});

test('rejeita formações inválidas', () => {
  for (const value of ['4-4', 'abc', '2-5-3', '6-3-1', '4-2-4', '4-3-2']) {
    assert.throws(() => parseFormation(value), Error, value);
  }
});
