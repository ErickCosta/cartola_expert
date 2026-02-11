import type { Atleta } from "../cartola/types.js";

function s(scout: Record<string, number> | undefined, key: string): number {
  return Number(scout?.[key] ?? 0);
}

type ClubAgg = {
  nAtk: number;
  nDef: number;
  atkSum: number; // maior = mais ofensivo
  defSum: number; // maior = mais defensivo
};

export type ClubRatings = {
  attackIndex: Map<number, number>;  // clubeId -> 0..~1
  defenseIndex: Map<number, number>; // clubeId -> 0..~1
  attackMean: number;
  defenseMean: number;
};

export function buildClubRatings(atletas: Atleta[]): ClubRatings {
  const agg = new Map<number, ClubAgg>();

  for (const a of atletas) {
    const jogos = Math.max(a.jogos, 1);
    const scout = a.scout ?? {};
    const clubeId = a.clubeId;

    const row = agg.get(clubeId) ?? { nAtk: 0, nDef: 0, atkSum: 0, defSum: 0 };

    // features por jogo
    const G = s(scout, "G") / jogos;
    const A = s(scout, "A") / jogos;
    const DS = s(scout, "DS") / jogos;
    const SG = (s(scout, "SG") || s(scout, "GS")) / jogos;
    const DE = s(scout, "DE") / jogos;

    const FF = s(scout, "FF") / jogos;
    const FD = s(scout, "FD") / jogos;
    const FT = s(scout, "FT") / jogos;

    // ataque: produção + volume
    const atkFeat = (G * 1.0) + (A * 0.7) + ((FF + FD + FT) * 0.15);

    // defesa: SG + desarmes + goleiro defesas
    const defFeat =
      (SG * 1.0) +
      (DS * 0.25) +
      (a.posicao === "GOL" ? (DE * 0.20) : 0);

    if (a.posicao === "MEI" || a.posicao === "ATA") {
      row.atkSum += atkFeat;
      row.nAtk += 1;
    }

    if (a.posicao === "GOL" || a.posicao === "ZAG" || a.posicao === "LAT") {
      row.defSum += defFeat;
      row.nDef += 1;
    }

    agg.set(clubeId, row);
  }

  const attackIndex = new Map<number, number>();
  const defenseIndex = new Map<number, number>();

  // 1) médias por clube (brutas)
  const atkVals: number[] = [];
  const defVals: number[] = [];

  for (const [clubeId, row] of agg.entries()) {
    const atk = row.nAtk > 0 ? row.atkSum / row.nAtk : 0;
    const def = row.nDef > 0 ? row.defSum / row.nDef : 0;
    attackIndex.set(clubeId, atk);
    defenseIndex.set(clubeId, def);
    atkVals.push(atk);
    defVals.push(def);
  }

  // 2) normalização simples: divide pela média da liga
  const attackMean = atkVals.reduce((a, b) => a + b, 0) / Math.max(atkVals.length, 1);
  const defenseMean = defVals.reduce((a, b) => a + b, 0) / Math.max(defVals.length, 1);

  for (const [clubeId, v] of attackIndex.entries()) {
    attackIndex.set(clubeId, attackMean > 0 ? v / attackMean : 1);
  }
  for (const [clubeId, v] of defenseIndex.entries()) {
    defenseIndex.set(clubeId, defenseMean > 0 ? v / defenseMean : 1);
  }

  return { attackIndex, defenseIndex, attackMean, defenseMean };
}

export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
