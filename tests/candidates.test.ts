import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCandidatesByPos, pickCandidatesFlat } from '../src/selection/candidates.ts';
import type { ScoredAtleta } from '../src/selection/candidates.ts';

const make = (id: number, posicao: ScoredAtleta['posicao'], preco: number, pontScore: number, valScore: number): ScoredAtleta =>
  ({ id, apelido: `Atleta ${id}`, clubeId: 1, posicao, preco, jogos: 5, media: 5, pontScore, valScore });

test('separa candidatos por posição e remove duplicados por id', () => {
  const pool = [make(1, 'GOL', 5, 10, 2), make(1, 'GOL', 5, 10, 2), make(2, 'ATA', 7, 8, 4)];
  const grouped = pickCandidatesByPos(pool, 'pontuacao');
  assert.deepEqual(grouped.GOL.map(a => a.id), [1]);
  assert.deepEqual(grouped.ATA.map(a => a.id), [2]);
  assert.deepEqual(grouped.ZAG, []);
  assert.deepEqual(pickCandidatesFlat(pool, 'pontuacao').map(a => a.id), [1, 2]);
  assert.equal(pool.length, 3);
});

test('mantém candidatos de baixo custo para permitir escalações econômicas', () => {
  const pool = [make(1, 'MEI', 20, 20, 1), make(2, 'MEI', 2, 1, 10)];
  const ids = pickCandidatesByPos(pool, 'pontuacao').MEI.map(a => a.id);
  assert.ok(ids.includes(1));
  assert.ok(ids.includes(2));
});
