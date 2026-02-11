import type { Atleta } from "../cartola/types.js";
import { scorePontuacao } from "./pontuacao.js";

export function scoreValorizacao(atleta: Atleta, ctx: { isHome: boolean }): number {
  // proxy de valorização: pontuação esperada por custo + bônus para baratos
  const pont = scorePontuacao(atleta, ctx);
  const preco = Math.max(atleta.preco, 0.1);

  const baratoBonus =
    atleta.preco <= 8 ? 1.25 :
    atleta.preco <= 12 ? 1.10 :
    1.0;

  // técnico tende a ser "custo baixo", mas não queremos dominar o modelo
  const tecPenalty = atleta.posicao === "TEC" ? 0.9 : 1.0;

  return (pont / preco) * baratoBonus * tecPenalty;
}
