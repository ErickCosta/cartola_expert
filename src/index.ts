// src/index.ts
import "dotenv/config";

import { cartolaPublic } from "./cartola/client.js";
import { endpoints } from "./cartola/endpoints.js";
import { normalizeAtletas } from "./cartola/normalize.js";
import { filterByStatus } from "./cartola/filter.js";

import {
  buildOpponentCtx,
  matchupOffMultiplier,
  matchupDefMultiplier,
  sgExpectedMultiplier,
} from "./scoring/opponent.js";

import { scoreByScoutParts } from "./scoring/scout-score.js";
import { buildClubRatings } from "./scoring/club-ratings.js";

import { pickCandidatesFlat } from "./selection/candidates.js";
import { parseFormation } from "./optimizer/formation.js";
import { optimizeBeam } from "./optimizer/beam.js";

// =====================
// Config principais
// =====================
const PONT_SCORE_SCALE = 2.2;

// Mais peso para “jogo atual” (contexto) mas mantendo estabilidade
const BLEND_SCOUT = 0.72;
const BLEND_MEDIA = 0.28;

// Suavização do confronto
const EXP_OFF = 0.82; // ATA/MEI/LAT (ataque)
const EXP_DEF = 0.65; // GOL/ZAG/LAT (defesa)

// SG esperado (efeito do time/confronto)
const SG_WEIGHT_GOL = 2.6;
const SG_WEIGHT_DEF = 2.0;

// Valorização: bônus suave até 10C$
const CHEAP_BONUS_MAX = 0.06;

// Beam
const BEAM_WIDTH = 300;
const CANDIDATES_PER_STEP = 100;
const COST_PENALTY_PONT = 0.015;
const COST_PENALTY_VAL = 0.07;

// ================================
// HOME PRIORITY + AWAY EXCEPTION
// ================================
const HOME_BOOST_ATK = 1.40
const HOME_BOOST_DEF = 1.30;

const AWAY_PENALTY_ATK = 0.70;
const AWAY_PENALTY_DEF = 0.60;

// Exceção fora (time goleador vs peneira) — thresholds de time
const STRONG_ATK_TH = 1.00;
const WEAK_DEF_TH = 0.85;

// Exceção fora depende do jogador (evita visitante “mediano” entrar só por ser do time forte)
const PLAYER_OFF_TH = 0.65; // ajuste fino: 0.45 (mais permissivo) | 0.65 (mais rígido)

const ALPHA_MIN = 1.6;
const ALPHA_MAX = 3.2;

// =====================
// Utils
// =====================
function fmt(n: number) {
  return n.toFixed(2).replace(".", ",");
}

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function median(xs: number[]) {
  const arr = xs.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function printTeam(title: string, team: { atletas: any[]; custo: number; score: number }, formationStr: string) {
  console.log(`\n==============================`);
  console.log(`${title} (${formationStr})`);
  console.log(`Custo: C$ ${fmt(team.custo)} | Score: ${team.score.toFixed(2)}`);
  console.log(`------------------------------`);

  const order: Record<string, number> = { GOL: 1, LAT: 2, ZAG: 3, MEI: 4, ATA: 5, TEC: 6 };

  team.atletas
    .slice()
    .sort((a: any, b: any) => (order[a.posicao] ?? 99) - (order[b.posicao] ?? 99))
    .forEach((a: any) => {
      const tagHome = a.isHome === true ? "🏠" : "✈️";
      const tagExc = a.awayAtkException ? "🟢" : "";
      console.log(`${a.posicao} | ${a.apelido} ${tagHome}${tagExc} | C$ ${fmt(a.preco)} | média ${a.media} | jogos ${a.jogos}`);
    });
}

function logCountsByPos(label: string, arr: any[]) {
  const counts = arr.reduce((acc: Record<string, number>, a: any) => {
    const p = a.posicao ?? a.pos ?? "UNK";
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});
  console.log(label, counts);
}

function minCostToFill(pool: any[], formation: Record<string, number>) {
  const posList = ["GOL", "LAT", "ZAG", "MEI", "ATA", "TEC"] as const;
  let total = 0;
  const detail: Record<string, { need: number; got: number; cost: number }> = {};

  for (const pos of posList) {
    const need = formation[pos] ?? 0;
    const cheapest = pool
      .filter((a) => (a.posicao ?? a.pos) === pos)
      .slice()
      .sort((a, b) => Number(a.preco ?? a.price ?? 0) - Number(b.preco ?? b.price ?? 0))
      .slice(0, need);

    const cost = cheapest.reduce((s, a) => s + Number(a.preco ?? a.price ?? 0), 0);
    detail[pos] = { need, got: cheapest.length, cost: Number(cost.toFixed(2)) };
    total += cost;
  }

  return { total: Number(total.toFixed(2)), detail };
}

function summarizeHomeAway(team: any[]) {
  const home = team.filter((a) => a.isHome === true).length;
  const away = team.filter((a) => a.isHome === false).length;
  const awayExc = team.filter((a) => a.isHome === false && a.awayAtkException).length;
  return { home, away, awayExc };
}

// =====================
// Main
// =====================
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Uso: npm run dev:tls <orcamento> <formacao>");
    console.log("Ex:  npm run dev:tls 108.04 4-3-3");
    process.exit(1);
  }

  const budget = Number(args[0]);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("Orçamento inválido. Ex: 108.04");

  const formationStr = args[1];
  const formation = parseFormation(formationStr);
  console.log("✅ Formação interpretada:", formation);

  const pub = cartolaPublic();

  const [statusRes, mercadoRes, partidasRes] = await Promise.all([
    pub.get(endpoints.status),
    pub.get(endpoints.mercado),
    pub.get(endpoints.partidas),
  ]);

  console.log("✅ Rodada:", statusRes.data?.rodada_atual);

  const atletas = normalizeAtletas(mercadoRes.data);

  const partidas = Array.isArray(partidasRes.data?.partidas) ? partidasRes.data.partidas : partidasRes.data;
  const ctx = buildOpponentCtx(partidas);

  console.log("CTX debug:", {
    totalClubs: ctx.isHomeByClubeId.size,
    totalOpp: ctx.opponentByClubeId.size,
    homeCount: [...ctx.isHomeByClubeId.values()].filter(v => v === true).length,
    awayCount: [...ctx.isHomeByClubeId.values()].filter(v => v === false).length,
  });

  const ratings = buildClubRatings(atletas);

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

  const poolAll = atletas.filter((a: any) => Number(a.preco) > 0);

  const statusCounts = poolAll.reduce((acc: Record<string, number>, a: any) => {
    acc[String(a.statusId)] = (acc[String(a.statusId)] ?? 0) + 1;
    return acc;
  }, {});
  console.log("✅ PoolAll por statusId:", statusCounts);

  const pool = filterByStatus(poolAll, [7]);
  console.log("✅ Pool (prováveis=7) tamanho:", pool.length);
  logCountsByPos("✅ Pool por posição:", pool);

  // ==========================================================
  // PASSO 1: calcula expectedRaw (sem alpha) + parts
  // ==========================================================
  const temp = pool.map((a: any) => {
    const isHome = ctx.isHomeByClubeId.get(a.clubeId) ?? false;
    const opponentId = ctx.opponentByClubeId.get(a.clubeId) ?? null;

    const parts = scoreByScoutParts(a, { isHome });

    const rawOff = matchupOffMultiplier({
      clubeId: a.clubeId,
      opponentId,
      attackIndex: ratings.attackIndex,
      defenseIndex: ratings.defenseIndex,
    });

    const rawDef = matchupDefMultiplier({
      clubeId: a.clubeId,
      opponentId,
      attackIndex: ratings.attackIndex,
      defenseIndex: ratings.defenseIndex,
    });

    const offMatch = Math.pow(rawOff, EXP_OFF);
    const defMatch = Math.pow(rawDef, EXP_DEF);

    // time indices
    const atkTeam = Number(ratings.attackIndex.get(a.clubeId) ?? 1);
    const defOpp = Number(opponentId ? (ratings.defenseIndex.get(opponentId) ?? 1) : 1);

    // ✅ Exceção fora agora depende do jogador (offTalent) e posição
    const isAttacker = a.posicao === "ATA" || a.posicao === "MEI" || a.posicao === "LAT";
    const playerOff = Number(parts.offTalent);

    const awayAtkException =
      !isHome &&
      isAttacker &&
      atkTeam >= STRONG_ATK_TH &&
      defOpp <= WEAK_DEF_TH &&
      playerOff >= PLAYER_OFF_TH;

    // prioridade casa / penalidade fora
    let homeAwayAtkFactor = 1;
    let homeAwayDefFactor = 1;

    if (isHome) {
      homeAwayAtkFactor = HOME_BOOST_ATK;
      homeAwayDefFactor = HOME_BOOST_DEF;
    } else {
      homeAwayAtkFactor = awayAtkException ? 1.00 : AWAY_PENALTY_ATK;
      homeAwayDefFactor = AWAY_PENALTY_DEF;
    }

    const expectedOff = parts.offTalent * offMatch * homeAwayAtkFactor;
    const expectedDef = parts.defTalent * defMatch * homeAwayDefFactor;

    // SG esperado (só defesa)
    let sgScore = 0;
    if (a.posicao === "GOL" || a.posicao === "ZAG" || a.posicao === "LAT") {
      const sgMult = sgExpectedMultiplier({
        clubeId: a.clubeId,
        opponentId,
        isHome,
        attackIndex: ratings.attackIndex,
        defenseIndex: ratings.defenseIndex,
      });
      const w = a.posicao === "GOL" ? SG_WEIGHT_GOL : SG_WEIGHT_DEF;
      sgScore = w * Math.log(sgMult);
    }

    const expectedRaw = expectedOff + expectedDef + sgScore;

    return { ...a, isHome, opponentId, awayAtkException, parts, expectedRaw };
  });

  // ==========================================================
  // PASSO 2: auto-calibração alpha
  // ==========================================================
  const medExpected = median(temp.map((x: any) => Number(x.expectedRaw)));
  const medMedia = median(temp.map((x: any) => Number(x.parts?.media ?? x.media ?? 0)));

  const alphaRaw = medExpected > 0 ? medMedia / medExpected : 2.2;
  const alpha = clamp(alphaRaw, ALPHA_MIN, ALPHA_MAX);

  console.log(
    `🧪 Calibração expectedRaw→media | medianExpected=${medExpected.toFixed(3)} medianMedia=${medMedia.toFixed(
      3
    )} alpha=${alpha.toFixed(3)} (raw=${alphaRaw.toFixed(3)})`
  );

  // ==========================================================
  // PASSO 3: score final
  // ==========================================================
  const scoredPool = temp.map((x: any) => {
    const parts = x.parts;

    // Técnico: só média com mando leve
    if (x.posicao === "TEC") {
      const tecMult = x.isHome ? 1.03 : 0.97;
      const tecBase = parts.media * tecMult;
      const pontScoreTec = clamp(tecBase * PONT_SCORE_SCALE, -10, 80);

      const preco = Math.max(Number(x.preco ?? 0), 0.1);
      const cheapBonus = 1 + CHEAP_BONUS_MAX * Math.max(0, 10 - preco) / 10;
      const valScoreTec = (pontScoreTec / preco) * cheapBonus;

      return { ...x, pontScore: pontScoreTec, valScore: valScoreTec };
    }

    const expectedScaled = x.expectedRaw * alpha;
    const blended = expectedScaled * BLEND_SCOUT + parts.media * BLEND_MEDIA;

    const pontScore = clamp(blended * PONT_SCORE_SCALE, -10, 80);

    const preco = Math.max(Number(x.preco ?? 0), 0.1);
    const cheapBonus = 1 + CHEAP_BONUS_MAX * Math.max(0, 10 - preco) / 10;
    const valScore = (pontScore / preco) * cheapBonus;

    return { ...x, pontScore, valScore };
  });

  const candidatesPont = pickCandidatesFlat(scoredPool as any, "pontuacao") as any[];
  const candidatesVal = pickCandidatesFlat(scoredPool as any, "valorizacao") as any[];

  console.log("✅ Candidates (pontuação):", candidatesPont.length);
  logCountsByPos("   por posição (pont):", candidatesPont);

  console.log("✅ Candidates (valorização):", candidatesVal.length);
  logCountsByPos("   por posição (val):", candidatesVal);

  const minPont = minCostToFill(candidatesPont, formation as any);
  console.log("🔎 MinCost pont:", fmt(minPont.total), "| det:", minPont.detail);

  const minVal = minCostToFill(candidatesVal, formation as any);
  console.log("🔎 MinCost val:", fmt(minVal.total), "| det:", minVal.detail);

  const beamPontInput = candidatesPont.map((a: any) => ({
    ...a,
    pos: a.posicao,
    price: Number(a.preco),
    score: Number(a.pontScore),
  }));

  const beamValInput = candidatesVal.map((a: any) => ({
    ...a,
    pos: a.posicao,
    price: Number(a.preco),
    score: Number(a.valScore),
  }));

  const teamPont = optimizeBeam({
    atletas: beamPontInput,
    budget,
    formation,
    beamWidth: BEAM_WIDTH,
    candidatesPerStep: CANDIDATES_PER_STEP,
    costPenalty: COST_PENALTY_PONT,
  });

  const teamVal = optimizeBeam({
    atletas: beamValInput,
    budget,
    formation,
    beamWidth: BEAM_WIDTH,
    candidatesPerStep: CANDIDATES_PER_STEP,
    costPenalty: COST_PENALTY_VAL,
  });

  console.log("✅ Tamanho time pontuação:", teamPont.atletas.length);
  console.log("✅ Tamanho time valorização:", teamVal.atletas.length);

  // métricas rápidas de “prioridade casa”
  const homeAwayPont = summarizeHomeAway(teamPont.atletas);
  console.log(`🏠/✈️ Time pontuação | home=${homeAwayPont.home} away=${homeAwayPont.away} awayByException=${homeAwayPont.awayExc}`);

  printTeam("🏆 TIME PARA PONTUAÇÃO", teamPont, formationStr);
  printTeam("💰 TIME PARA VALORIZAÇÃO", teamVal, formationStr);
}

main().catch((e: any) => {
  console.error("❌ Erro:", e?.message ?? e);
  process.exit(1);
});
