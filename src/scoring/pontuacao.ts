import type { Atleta } from "../cartola/types.js";

export function scorePontuacao(atleta: Atleta, ctx: { isHome: boolean }): number {
  const base = atleta.media;

  // mando: bônus pequeno
  const mando = ctx.isHome ? 1.08 : 0.96;

  // defensores um pouco mais "seguros"
  const posMult =
    atleta.posicao === "GOL" || atleta.posicao === "LAT" || atleta.posicao === "ZAG"
      ? 1.05
      : atleta.posicao === "TEC"
        ? 0.95
        : 1.0;

  return base * mando * posMult;
}
