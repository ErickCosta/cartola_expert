// src/selection/candidates.ts
import { SCORING } from "../config/scoring";

export type PosKey = "GOL" | "ZAG" | "LAT" | "MEI" | "ATA" | "TEC";
export type PickMode = "pontuacao" | "valorizacao";

// Shape compatível com o que sai do teu normalize + scoring no index
export type ScoredAtleta = {
  id: number;            // atleta id
  apelido: string;
  clubeId: number;
  posicao: PosKey;

  preco: number;         // preco_num
  jogos: number;         // jogos_num
  media: number;         // media_num

  pontScore: number;
  valScore: number;
};

function uniqById(list: ScoredAtleta[]): ScoredAtleta[] {
  const seen = new Set<number>();
  const out: ScoredAtleta[] = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

function groupByPos(list: ScoredAtleta[]): Record<PosKey, ScoredAtleta[]> {
  const out: Record<PosKey, ScoredAtleta[]> = {
    GOL: [],
    ZAG: [],
    LAT: [],
    MEI: [],
    ATA: [],
    TEC: [],
  };

  for (const a of list) {
    const p = a.posicao;
    if (!p || !(p in out)) continue; // segurança extra
    out[p].push(a);
  }
  return out;
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function pickForPos(group: ScoredAtleta[], mode: PickMode): ScoredAtleta[] {
  const { topByScore, topByValue, cheapest } = SCORING.candidates.perPos;
  const cap = SCORING.candidates.capPerPos;

  const scoreKey: "pontScore" | "valScore" = mode === "pontuacao" ? "pontScore" : "valScore";

  // 1) Top por score do modo
  const byScore = group
    .slice()
    .sort((a, b) => safe(b[scoreKey]) - safe(a[scoreKey]))
    .slice(0, topByScore);

  // 2) Top por value (sempre valScore)
  const byValue = group
    .slice()
    .sort((a, b) => safe(b.valScore) - safe(a.valScore))
    .slice(0, topByValue);

  // 3) Baratos SEM filtro (garante viabilidade do orçamento)
  const cheapestRaw = group
    .slice()
    .sort((a, b) => a.preco - b.preco)
    .slice(0, cheapest);

  // 4) Baratos viáveis (piso leve)
  const lastScore = byScore.length ? safe(byScore[byScore.length - 1][scoreKey]) : 0;
  const scoreFloor = lastScore * 0.4;

  const cheapestViable = group
    .filter((a) => safe(a[scoreKey]) >= scoreFloor)
    .slice()
    .sort((a, b) => a.preco - b.preco)
    .slice(0, cheapest);

  return uniqById([
    ...byScore,
    ...byValue,
    ...cheapestRaw,
    ...cheapestViable,
  ]).slice(0, cap);
}

export function pickCandidatesByPos(
  pool: ScoredAtleta[],
  mode: PickMode
): Record<PosKey, ScoredAtleta[]> {
  const byPos = groupByPos(pool);

  return {
    GOL: pickForPos(byPos.GOL, mode),
    LAT: pickForPos(byPos.LAT, mode),
    ZAG: pickForPos(byPos.ZAG, mode),
    MEI: pickForPos(byPos.MEI, mode),
    ATA: pickForPos(byPos.ATA, mode),
    TEC: pickForPos(byPos.TEC, mode),
  };
}

export function pickCandidatesFlat(pool: ScoredAtleta[], mode: PickMode): ScoredAtleta[] {
  const byPos = pickCandidatesByPos(pool, mode);
  return [
    ...byPos.GOL,
    ...byPos.LAT,
    ...byPos.ZAG,
    ...byPos.MEI,
    ...byPos.ATA,
    ...byPos.TEC,
  ];
}
