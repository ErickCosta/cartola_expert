// src/index.ts
import "dotenv/config";

import { cartolaPublic } from "./cartola/client.js";
import { endpoints } from "./cartola/endpoints.js";
import { normalizeAtletas } from "./cartola/normalize.js";
import { filterByStatus } from "./cartola/filter.js";

import { buildOpponentCtx } from "./scoring/opponent.js";
import { scoreByScout } from "./scoring/scout-score.js";
import { buildClubRatings, clamp } from "./scoring/club-ratings.js";

import { parseFormation } from "./optimizer/formation.js";
import { optimizeBeam } from "./optimizer/beam.js";

function fmt(n: number) {
  return n.toFixed(2).replace(".", ",");
}

function printTeam(title: string, team: { atletas: any[]; custo: number; score: number }) {
  console.log(`\n==============================`);
  console.log(title);
  console.log(`Custo: C$ ${fmt(team.custo)} | Score: ${team.score.toFixed(2)}`);
  console.log(`------------------------------`);

  const order: Record<string, number> = {
    GOL: 1,
    LAT: 2,
    ZAG: 3,
    MEI: 4,
    ATA: 5,
    TEC: 6,
  };

  team.atletas
    .slice()
    .sort((a: any, b: any) => order[a.posicao] - order[b.posicao])
    .forEach((a: any) => {
      console.log(
        `${a.posicao} | ${a.apelido} | C$ ${fmt(a.preco)} | média ${a.media} | jogos ${a.jogos}`
      );
    });
}

function pickTopCandidates(pool: any[], topNPerPos = 60) {
  const positions = ["GOL", "LAT", "ZAG", "MEI", "ATA", "TEC"];

  const picked: any[] = [];
  for (const pos of positions) {
    const top = pool
      .filter((a) => a.posicao === pos)
      .slice()
      // pré-filtro: média + pequeno empurrão pra quem tem mais jogos (e nunca favorecer média negativa)
      .sort(
        (a, b) =>
          (Math.max(b.media, 0) + 0.05 * b.jogos) - (Math.max(a.media, 0) + 0.05 * a.jogos)
      )
      .slice(0, topNPerPos);

    picked.push(...top);
  }

  const seen = new Set<number>();
  return picked.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

function applyOpponentMultiplier(params: {
  posicao: string;
  opponentId: number | null;
  ratings: ReturnType<typeof buildClubRatings>;
}) {
  const { posicao, opponentId, ratings } = params;
  if (!opponentId) return 1.0;

  const oppAtk = ratings.attackIndex.get(opponentId) ?? 1; // >1 ataque forte
  const oppDef = ratings.defenseIndex.get(opponentId) ?? 1; // >1 defesa forte

  // defesa gosta de enfrentar ataque fraco (oppAtk < 1)
  const defBoost = clamp(1 + (1 - oppAtk) * 0.25, 0.85, 1.20);

  // ataque gosta de enfrentar defesa fraca (oppDef < 1)
  const atkBoost = clamp(1 + (1 - oppDef) * 0.25, 0.85, 1.20);

  if (posicao === "GOL" || posicao === "ZAG" || posicao === "LAT") return defBoost;
  if (posicao === "MEI" || posicao === "ATA") return atkBoost;

  return 1.0; // TEC
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Uso: npm run dev:tls <orcamento> <formacao>");
    console.log("Ex:  npm run dev:tls 108.04 4-3-3");
    process.exit(1);
  }

  const budget = Number(args[0]);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("Orçamento inválido. Ex: 108.04");
  }

  const formation = parseFormation(args[1]);
  console.log("✅ Formação interpretada:", formation);

  const pub = cartolaPublic();

  const [statusRes, mercadoRes, partidasRes] = await Promise.all([
    pub.get(endpoints.status),
    pub.get(endpoints.mercado),
    pub.get(endpoints.partidas),
  ]);

  console.log("✅ Rodada:", statusRes.data?.rodada_atual);

  const atletas = normalizeAtletas(mercadoRes.data);

  // Contexto: mando + adversário
  const ctx = buildOpponentCtx(partidasRes.data);

  // Ratings por clube (ataque/defesa) a partir do scout do mercado
  const ratings = buildClubRatings(atletas);

  // Log opcional pra validar que está calculando algo
  console.log("✅ Ratings sample (3 clubes):");
  {
    let c = 0;
    for (const [id, atk] of ratings.attackIndex.entries()) {
      if (c++ >= 3) break;
      console.log({
        clubeId: id,
        atk: atk.toFixed(2),
        def: (ratings.defenseIndex.get(id) ?? 1).toFixed(2),
      });
    }
  }

  // SEMPRE só prováveis (status 7) e com preço > 0
  const poolAll = atletas.filter((a) => a.preco > 0);

  const statusCounts = poolAll.reduce((acc: Record<string, number>, a) => {
    acc[String(a.statusId)] = (acc[String(a.statusId)] ?? 0) + 1;
    return acc;
  }, {});
  console.log("✅ PoolAll por statusId:", statusCounts);

  const pool = filterByStatus(poolAll, [7]);
  console.log("✅ Pool (prováveis=7) tamanho:", pool.length);

  const byPos = pool.reduce((acc: Record<string, number>, a) => {
    acc[a.posicao] = (acc[a.posicao] ?? 0) + 1;
    return acc;
  }, {});
  console.log("✅ Pool por posição:", byPos);

  // Seleciona um subconjunto (pra otimizar tempo do solver)
  const candidates = pickTopCandidates(pool, 60);
  console.log("✅ Candidates (pré-top por posição):", candidates.length);

  // Pontuação: score por scouts + mando + confronto
  const scoredPont = candidates.map((a) => {
    const isHome = ctx.isHomeByClubeId.get(a.clubeId) ?? false;
    const opponentId = ctx.opponentByClubeId.get(a.clubeId) ?? null;

    const base = scoreByScout(a, { isHome });
    const mult = applyOpponentMultiplier({ posicao: a.posicao, opponentId, ratings });

    return { ...a, isHome, opponentId, score: base * mult };
  });

  // Valorização: (score/price) com o mesmo multiplicador de confronto
  const scoredVal = candidates.map((a) => {
    const isHome = ctx.isHomeByClubeId.get(a.clubeId) ?? false;
    const opponentId = ctx.opponentByClubeId.get(a.clubeId) ?? null;

    const base = scoreByScout(a, { isHome });
    const mult = applyOpponentMultiplier({ posicao: a.posicao, opponentId, ratings });

    const preco = Math.max(a.preco, 0.1);
    return { ...a, isHome, opponentId, score: (base * mult) / preco };
  });

  const teamPont = optimizeBeam({ atletas: scoredPont, budget, formation });
  const teamVal = optimizeBeam({ atletas: scoredVal, budget, formation });

  console.log("✅ Tamanho time pontuação:", teamPont.atletas.length);
  console.log("✅ Tamanho time valorização:", teamVal.atletas.length);

  printTeam(`🏆 TIME PARA PONTUAÇÃO (${args[1]})`, teamPont);
  printTeam(`💰 TIME PARA VALORIZAÇÃO (${args[1]})`, teamVal);
}

main().catch((e: any) => {
  console.error("❌ Erro:", e?.message ?? e);
  process.exit(1);
});
