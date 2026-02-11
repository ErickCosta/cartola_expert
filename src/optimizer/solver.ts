import solver from "javascript-lp-solver";
import type { Atleta, Posicao } from "../cartola/types.js";
import type { Formation } from "./formation.js";

type ScoredAtleta = Atleta & { score: number };

export type Picked = {
  atletas: ScoredAtleta[];
  custo: number;
  score: number;
  feasible: boolean;
};

function makePosVar(pos: Posicao, atletaPos: Posicao) {
  return atletaPos === pos ? 1 : 0;
}

export function optimizeLineup(params: {
  atletas: ScoredAtleta[];
  budget: number;
  formation: Formation;
}): Picked {
  const { atletas, budget, formation } = params;

  const model: any = {
    optimize: "score",
    opType: "max",
    constraints: {
      budget: { max: budget },
      GOL: { equal: formation.GOL },
      LAT: { equal: formation.LAT },
      ZAG: { equal: formation.ZAG },
      MEI: { equal: formation.MEI },
      ATA: { equal: formation.ATA },
      TEC: { equal: formation.TEC },
    },
    variables: {},
    ints: {},
  };

  for (const a of atletas) {
    const key = `a_${a.id}`;
    model.variables[key] = {
      score: a.score,
      budget: a.preco,
      GOL: makePosVar("GOL", a.posicao),
      LAT: makePosVar("LAT", a.posicao),
      ZAG: makePosVar("ZAG", a.posicao),
      MEI: makePosVar("MEI", a.posicao),
      ATA: makePosVar("ATA", a.posicao),
      TEC: makePosVar("TEC", a.posicao),
    };
    model.ints[key] = 1;
  }

  const result: any = solver.Solve(model);

  const feasible = result?.feasible === true;

  if (!feasible) {
    // Mostra info útil pra debug sem despejar tudo
    const pickedCount = Object.keys(result).filter((k) => k.startsWith("a_") && result[k] === 1).length;
    throw new Error(
      `Solver retornou solução inviável (feasible=false). pickedCount=${pickedCount}. ` +
      `Verifique se o solver está respeitando constraints.`
    );
  }

  const pickedIds = new Set<number>();
  for (const k of Object.keys(result)) {
    if (k.startsWith("a_") && result[k] === 1) pickedIds.add(Number(k.slice(2)));
  }

  const picked = atletas.filter((a) => pickedIds.has(a.id));
  const custo = picked.reduce((s, a) => s + a.preco, 0);
  const score = picked.reduce((s, a) => s + a.score, 0);

  return { atletas: picked, custo, score, feasible };
}
