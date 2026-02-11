// src/optimizer/beam.ts
import type { Atleta, Posicao } from "../cartola/types.js";
import type { Formation } from "./formation.js";

type ScoredAtleta = Atleta & { score: number };

export type Picked = {
  atletas: ScoredAtleta[];
  custo: number;
  score: number;
};

type TeamState = {
  picked: ScoredAtleta[];
  usedIds: Set<number>;
  cost: number;
  score: number;
  remaining: Record<Posicao, number>;
};

function sumRemaining(r: Record<Posicao, number>) {
  return Object.values(r).reduce((a, b) => a + b, 0);
}

function cloneRemaining(r: Record<Posicao, number>) {
  return { ...r };
}

function posOrder(): Posicao[] {
  return ["GOL", "LAT", "ZAG", "MEI", "ATA", "TEC"];
}

function buildMinCostHelper(byPos: Map<Posicao, ScoredAtleta[]>, formation: Formation) {
  const prefix: Record<Posicao, number[]> = {
    GOL: [0],
    LAT: [0],
    ZAG: [0],
    MEI: [0],
    ATA: [0],
    TEC: [0],
  };

  for (const p of posOrder()) {
    const need = formation[p];
    const costs = (byPos.get(p) ?? [])
      .map((a) => Number((a as any).preco ?? (a as any).price))
      .filter((x) => Number.isFinite(x) && x >= 0)
      .sort((a, b) => a - b);

    if (costs.length < need) {
      throw new Error(`Sem candidatos suficientes para posição ${p}. Need=${need}, pool=${costs.length}`);
    }

    const pref = [0];
    for (let i = 1; i <= need; i++) pref[i] = pref[i - 1] + costs[i - 1];
    prefix[p] = pref;
  }

  function minRemainingCost(remaining: Record<Posicao, number>) {
    let total = 0;
    for (const p of posOrder()) {
      const k = remaining[p] ?? 0;
      total += prefix[p][k] ?? 0;
    }
    return total;
  }

  return { minRemainingCost };
}

export function optimizeBeam(params: {
  atletas: ScoredAtleta[];
  budget: number;
  formation: Formation;
  beamWidth?: number;
  candidatesPerStep?: number;
  costPenalty?: number; // default 0.08
}): Picked {
  const { atletas, budget, formation } = params;
  const beamWidth = params.beamWidth ?? 250;
  const candidatesPerStep = params.candidatesPerStep ?? 80;
  const costPenalty = params.costPenalty ?? 0.08;

  // separa por posição e ordena por score desc
  const byPos = new Map<Posicao, ScoredAtleta[]>();
  for (const p of posOrder()) byPos.set(p, []);

  for (const a of atletas) {
    const preco = Number((a as any).preco ?? (a as any).price);
    const score = Number((a as any).score);

    if (!Number.isFinite(preco) || preco < 0) continue;
    if (!Number.isFinite(score)) continue;

    // garante que posicao existe
    const pos: Posicao = (a as any).posicao ?? (a as any).pos;
    if (!pos || !byPos.has(pos)) continue;

    // garante `preco` no objeto para custo final consistente
    (a as any).preco = preco;
    (a as any).posicao = pos;
    (a as any).score = score;

    byPos.get(pos)!.push(a);
  }

  for (const p of posOrder()) byPos.get(p)!.sort((a, b) => (b as any).score - (a as any).score);

  const { minRemainingCost } = buildMinCostHelper(byPos, formation);

  const remaining: Record<Posicao, number> = {
    GOL: formation.GOL,
    LAT: formation.LAT,
    ZAG: formation.ZAG,
    MEI: formation.MEI,
    ATA: formation.ATA,
    TEC: formation.TEC,
  };

  let beam: TeamState[] = [
    { picked: [], usedIds: new Set(), cost: 0, score: 0, remaining },
  ];

  if (minRemainingCost(remaining) > budget) {
    throw new Error(
      `Mesmo o time mais barato não cabe no orçamento. MinCost=${minRemainingCost(remaining).toFixed(
        2
      )} > budget=${budget.toFixed(2)}`
    );
  }

  while (true) {
    const done = beam.find((s) => sumRemaining(s.remaining) === 0);
    if (done) return { atletas: done.picked, custo: done.cost, score: done.score };

    const needPositions = posOrder().filter((p) => beam[0].remaining[p] > 0);
    if (!needPositions.length) break;

    // escolhe próxima posição (menor pool primeiro)
    let nextPos: Posicao = needPositions[0];
    let minPool = Infinity;
    for (const p of needPositions) {
      const poolSize = byPos.get(p)!.length;
      if (poolSize < minPool) {
        minPool = poolSize;
        nextPos = p;
      }
    }

    const candidates = byPos.get(nextPos)!;
    if (!candidates.length) throw new Error(`Sem candidatos para posição ${nextPos}.`);

    const nextBeam: TeamState[] = [];

    for (const state of beam) {
      const minRem = minRemainingCost(state.remaining);
      if (state.cost + minRem > budget) continue;

      let added = 0;

      for (const a of candidates) {
        if (state.usedIds.has((a as any).id)) continue;

        const rem = state.remaining[nextPos];
        if (rem <= 0) continue;

        const newCost = state.cost + Number((a as any).preco);
        if (!Number.isFinite(newCost) || newCost > budget) continue;

        const newRemaining = cloneRemaining(state.remaining);
        newRemaining[nextPos] = rem - 1;

        const minRem2 = minRemainingCost(newRemaining);
        if (newCost + minRem2 > budget) continue;

        const newUsed = new Set(state.usedIds);
        newUsed.add((a as any).id);

        nextBeam.push({
          picked: [...state.picked, a],
          usedIds: newUsed,
          cost: newCost,
          score: state.score + Number((a as any).score),
          remaining: newRemaining,
        });

        added++;
        if (added >= candidatesPerStep) break;
      }
    }

    if (!nextBeam.length) {
      throw new Error(
        `Não foi possível montar time completo com orçamento C$ ${budget}. Tente aumentar orçamento ou reduzir formação/TEC.`
      );
    }

    // rank: score alto, mas sem “se matar” no custo
    nextBeam.sort((a, b) => {
      const ra = a.score - costPenalty * a.cost;
      const rb = b.score - costPenalty * b.cost;
      return rb - ra;
    });

    beam = nextBeam.slice(0, beamWidth);
  }

  throw new Error("Falha inesperada ao montar time.");
}
