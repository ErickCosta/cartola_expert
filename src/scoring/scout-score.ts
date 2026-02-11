// src/scoring/scout-score.ts
import type { Atleta } from "../cartola/types.js";

function s(scout: Record<string, number> | undefined, key: string): number {
  return Number(scout?.[key] ?? 0);
}

function blend(scoutScore: number, media: number, isHome: boolean) {
  const mediaAdj = media * (isHome ? 1.06 : 0.97);
  return 0.65 * scoutScore + 0.35 * mediaAdj;
}

/**
 * Score baseado em scout do /atletas/mercado (histórico agregado) normalizado por jogos_num.
 * Depois mistura com média (para evitar distorções como goleiro com média muito negativa).
 */
export function scoreByScout(atleta: Atleta, ctx: { isHome: boolean }): number {
  const jogos = Math.max(atleta.jogos, 1);
  const scout = atleta.scout ?? {};

  // fallback: se não tiver scout nenhum, volta pra média com mando
  if (Object.keys(scout).length === 0) {
    return atleta.media * (ctx.isHome ? 1.06 : 0.97);
  }

  const G = s(scout, "G") / jogos;
  const A = s(scout, "A") / jogos;
  const DS = s(scout, "DS") / jogos;

  // SG pode vir como SG ou GS dependendo do ano
  const SG = (s(scout, "SG") || s(scout, "GS")) / jogos;

  const DE = s(scout, "DE") / jogos;
  const DD = s(scout, "DD") / jogos;
  const DP = s(scout, "DP") / jogos;

  const CA = s(scout, "CA") / jogos;
  const CV = s(scout, "CV") / jogos;
  const GC = s(scout, "GC") / jogos;
  const PP = s(scout, "PP") / jogos;
  const FC = s(scout, "FC") / jogos;
  const I = s(scout, "I") / jogos;

  const FF = s(scout, "FF") / jogos;
  const FD = s(scout, "FD") / jogos;
  const FT = s(scout, "FT") / jogos;

  const mandoAtk = ctx.isHome ? 1.10 : 0.95;
  const mandoDef = ctx.isHome ? 1.08 : 0.97;

  let scoutScore = 0;

  if (atleta.posicao === "GOL") {
    scoutScore =
      SG * 7.0 * mandoDef +
      DS * 1.2 +
      DE * 0.9 +
      DD * 1.6 +
      DP * 7.0 -
      CA * 1.0 -
      CV * 3.0 -
      GC * 5.0;

    return blend(scoutScore, atleta.media, ctx.isHome);
  }

  if (atleta.posicao === "ZAG") {
    scoutScore =
      SG * 7.0 * mandoDef +
      DS * 1.6 -
      CA * 1.0 -
      CV * 3.0 -
      FC * 0.4 -
      GC * 5.0;

    return blend(scoutScore, atleta.media, ctx.isHome);
  }

  if (atleta.posicao === "LAT") {
    scoutScore =
      SG * 6.5 * mandoDef +
      DS * 1.3 +
      A * 5.0 * mandoAtk +
      G * 6.0 * mandoAtk -
      CA * 1.0 -
      CV * 3.0 -
      FC * 0.4;

    return blend(scoutScore, atleta.media, ctx.isHome);
  }

  if (atleta.posicao === "MEI") {
    scoutScore =
      DS * 1.2 +
      A * 6.0 * mandoAtk +
      G * 6.5 * mandoAtk +
      (FF + FD + FT) * 0.25 -
      CA * 1.0 -
      CV * 3.0 -
      PP * 3.0;

    return blend(scoutScore, atleta.media, ctx.isHome);
  }

  if (atleta.posicao === "ATA") {
    scoutScore =
      G * 7.5 * mandoAtk +
      A * 4.5 * mandoAtk +
      (FF + FD + FT) * 0.35 -
      CA * 1.0 -
      CV * 3.0 -
      PP * 3.0 -
      I * 0.2;

    return blend(scoutScore, atleta.media, ctx.isHome);
  }

  // TEC: média + mando
  const mandoTec = ctx.isHome ? 1.05 : 0.98;
  return atleta.media * mandoTec;
}
