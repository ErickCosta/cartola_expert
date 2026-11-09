import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAtletas } from '../src/cartola/normalize.ts';
import { filterByStatus } from '../src/cartola/filter.ts';
import { buildMatchupCtx } from '../src/scoring/matchup.ts';

test('normaliza os atletas da API e aplica valores padrão', () => {
  const result = normalizeAtletas({ atletas: [
    { atleta_id: '17', apelido: 'Jogador', posicao_id: 5, clube_id: 42, preco_num: '8.5', media_num: 6, status_id: 7, scout: { G: 2 } },
    { atleta_id: 18, posicao_id: 1, clube_id: 43 },
  ] });
  assert.equal(result.length, 2);
  assert.deepEqual({ id: result[0].id, posicao: result[0].posicao, preco: result[0].preco, scout: result[0].scout },
    { id: 17, posicao: 'ATA', preco: 8.5, scout: { G: 2 } });
  assert.equal(result[1].apelido, '');
  assert.equal(result[1].preco, 0);
  assert.deepEqual(result[1].scout, {});
  assert.deepEqual(normalizeAtletas({ atletas: null }), []);
  assert.deepEqual(normalizeAtletas(null), []);
});

test('filtra por status sem alterar a lista original', () => {
  const athletes = normalizeAtletas({ atletas: [
    { atleta_id: 1, posicao_id: 5, status_id: 7 },
    { atleta_id: 2, posicao_id: 5, status_id: 2 },
  ] });
  assert.deepEqual(filterByStatus(athletes, [7]).map(a => a.id), [1]);
  assert.equal(athletes.length, 2);
});

test('identifica mandante e visitante nas partidas', () => {
  const ctx = buildMatchupCtx({ partidas: [{ clube_casa_id: 10, clube_visitante_id: 20 }] });
  assert.equal(ctx.isHomeByClubeId.get(10), true);
  assert.equal(ctx.isHomeByClubeId.get(20), false);
  assert.equal(ctx.isHomeByClubeId.has(30), false);
  assert.equal(buildMatchupCtx({}).isHomeByClubeId.size, 0);
});
