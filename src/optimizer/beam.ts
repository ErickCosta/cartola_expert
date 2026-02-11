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
  // ordem ajuda a estabilizar construção
  return ["GOL", "LAT", "ZAG", "MEI", "ATA", "TEC"];
}

export function optimizeBeam(params: {
  atletas: ScoredAtleta[];
  budget: number;
  formation: Formation;
  beamWidth?: number; // ex: 200
  candidatesPerStep?: number; // ex: 60
}): Picked {
  const { atletas, budget, formation } = params;
  const beamWidth = params.beamWidth ?? 250;
  const candidatesPerStep = params.candidatesPerStep ?? 80;

  // separa por posição e ordena por score desc
  const byPos = new Map<Posicao, ScoredAtleta[]>();
  for (const p of posOrder()) byPos.set(p, []);
  for (const a of atletas) byPos.get(a.posicao)!.push(a);
  for (const p of posOrder()) byPos.get(p)!.sort((a, b) => b.score - a.score);

  // remaining inicial
  const remaining: Record<Posicao, number> = {
    GOL: formation.GOL,
    LAT: formation.LAT,
    ZAG: formation.ZAG,
    MEI: formation.MEI,
    ATA: formation.ATA,
    TEC: formation.TEC,
  };

  let beam: TeamState[] = [
    {
      picked: [],
      usedIds: new Set(),
      cost: 0,
      score: 0,
      remaining,
    },
  ];

  while (true) {
    // terminou?
    const done = beam.find((s) => sumRemaining(s.remaining) === 0);
    if (done) return { atletas: done.picked, custo: done.cost, score: done.score };

    // escolhe próxima posição a preencher: a que ainda falta e com menor pool (heurística)
    const needPositions = posOrder().filter((p) => beam[0].remaining[p] > 0);

    // fallback (nunca deveria acontecer)
    if (needPositions.length === 0) break;

    // pega a posição mais "crítica": menos candidatos disponíveis
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
    if (!candidates.length) {
      throw new Error(`Sem candidatos para posição ${nextPos}.`);
    }

    const nextBeam: TeamState[] = [];

    for (const state of beam) {
      // tenta adicionar os melhores candidatos dessa posição (limitando quantidade por passo)
      let added = 0;

      for (const a of candidates) {
        if (state.usedIds.has(a.id)) continue;
        if (state.cost + a.preco > budget) continue;

        const rem = state.remaining[nextPos];
        if (rem <= 0) continue;

        const newRemaining = cloneRemaining(state.remaining);
        newRemaining[nextPos] = rem - 1;

        const newUsed = new Set(state.usedIds);
        newUsed.add(a.id);

        nextBeam.push({
          picked: [...state.picked, a],
          usedIds: newUsed,
          cost: state.cost + a.preco,
          score: state.score + a.score,
          remaining: newRemaining,
        });

        added++;
        if (added >= candidatesPerStep) break;
      }
    }

    if (!nextBeam.length) {
      // não achou expansão possível (orçamento apertado)
      throw new Error(
        `Não foi possível montar time completo com orçamento C$ ${budget}. ` +
        `Tente aumentar orçamento ou reduzir formação/TEC.`
      );
    }

    // Mantém só os melhores estados
    nextBeam.sort((a, b) => b.score - a.score);
    beam = nextBeam.slice(0, beamWidth);
  }

  throw new Error("Falha inesperada ao montar time.");
}
