import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePontuacao } from '../src/scoring/pontuacao.ts';
import { scoreValorizacao } from '../src/scoring/valorizacao.ts';
import type { Atleta } from '../src/cartola/types.ts';

function atleta(overrides: Partial<Atleta> = {}): Atleta {
  return { id: 1, apelido: 'Teste', posicao: 'MEI', posicaoId: 4, clubeId: 1,
    preco: 10, media: 5, pontos: 0, variacao: 0, jogos: 5, statusId: 7, scout: {}, ...overrides };
}

test('pontuação considera mando e multiplicador da posição', () => {
  assert.equal(scorePontuacao(atleta(), { isHome: true }), 5.4);
  assert.equal(scorePontuacao(atleta({ posicao: 'ZAG' }), { isHome: false }), 5 * 0.96 * 1.05);
  assert.equal(scorePontuacao(atleta({ posicao: 'TEC' }), { isHome: true }), 5 * 1.08 * 0.95);
});

test('valorização considera preço, bônus para baratos e penalidade do técnico', () => {
  assert.equal(scoreValorizacao(atleta({ preco: 8 }), { isHome: true }), (5.4 / 8) * 1.25);
  assert.equal(scoreValorizacao(atleta({ preco: 12 }), { isHome: true }), (5.4 / 12) * 1.1);
  assert.equal(scoreValorizacao(atleta({ preco: 13 }), { isHome: true }), 5.4 / 13);
  assert.equal(scoreValorizacao(atleta({ posicao: 'TEC', preco: 10 }), { isHome: true }),
    (5 * 1.08 * 0.95 / 10) * 1.1 * 0.9);
});

test('valorização protege divisão por zero', () => {
  assert.ok(Number.isFinite(scoreValorizacao(atleta({ preco: 0 }), { isHome: false })));
});
