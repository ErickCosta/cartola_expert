// src/scoring/opponent.ts
import { SCORING } from "../config/scoring";

export function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function safe(n: number, fallback = 1) {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function tanh(x: number) {
  const e2x = Math.exp(2 * x);
  return (e2x - 1) / (e2x + 1);
}

/**
 * Constrói mapa:
 * - opponentByClubeId
 * - isHomeByClubeId
 */
export function buildOpponentCtx(partidas: any[]) {
  const opponentByClubeId = new Map<number, number>();
  const isHomeByClubeId = new Map<number, boolean>();

  for (const p of partidas) {
    const mandante = p.clube_casa_id;
    const visitante = p.clube_visitante_id;
    if (!mandante || !visitante) continue;

    opponentByClubeId.set(mandante, visitante);
    opponentByClubeId.set(visitante, mandante);

    isHomeByClubeId.set(mandante, true);
    isHomeByClubeId.set(visitante, false);
  }

  return { opponentByClubeId, isHomeByClubeId };
}

export function matchupOffMultiplier(params: {
  clubeId: number;
  opponentId: number | null;
  attackIndex: Map<number, number>;
  defenseIndex: Map<number, number>;
}) {
  const { clubeId, opponentId, attackIndex, defenseIndex } = params;
  if (!opponentId) return 1.0;

  const atkTeam = safe(attackIndex.get(clubeId) ?? 1);
  const defOpp  = safe(defenseIndex.get(opponentId) ?? 1);

  const x = Math.log(atkTeam) - Math.log(defOpp);
  const k = SCORING.matchup.k;

  return clamp(1 + tanh(x) * k, SCORING.matchup.min, SCORING.matchup.max);
}

export function matchupDefMultiplier(params: {
  clubeId: number;
  opponentId: number | null;
  attackIndex: Map<number, number>;
  defenseIndex: Map<number, number>;
}) {
  const { clubeId, opponentId, attackIndex, defenseIndex } = params;
  if (!opponentId) return 1.0;

  const defTeam = safe(defenseIndex.get(clubeId) ?? 1);
  const atkOpp  = safe(attackIndex.get(opponentId) ?? 1);

  const x = Math.log(defTeam) - Math.log(atkOpp);
  const k = SCORING.matchup.k;

  return clamp(1 + tanh(x) * k, SCORING.matchup.min, SCORING.matchup.max);
}

/**
 * Proxy de “chance de SG” (efeito do time + confronto + mando).
 * Não é probabilidade real, é um multiplicador controlado.
 */
export function sgExpectedMultiplier(params: {
  clubeId: number;
  opponentId: number | null;
  isHome: boolean;
  attackIndex: Map<number, number>;
  defenseIndex: Map<number, number>;
}) {
  const { isHome } = params;

  // usa a mesma base do confronto defensivo
  const defMult = matchupDefMultiplier(params);

  // mando leve para SG
  const homeSg = 1.03;
  const awaySg = 0.97;

  // mantém dentro do mesmo min/max do matchup (já é estável)
  return clamp(defMult * (isHome ? homeSg : awaySg), SCORING.matchup.min, SCORING.matchup.max);
}

/**
 * Compatibilidade: devolve por posição (como você já usava)
 */
export function matchupMultiplier(params: {
  posicao: "GOL" | "ZAG" | "LAT" | "MEI" | "ATA" | "TEC";
  clubeId: number;
  opponentId: number | null;
  attackIndex: Map<number, number>;
  defenseIndex: Map<number, number>;
}) {
  const { posicao, clubeId, opponentId, attackIndex, defenseIndex } = params;

  if (posicao === "ATA" || posicao === "MEI") {
    return matchupOffMultiplier({ clubeId, opponentId, attackIndex, defenseIndex });
  }
  if (posicao === "GOL" || posicao === "ZAG" || posicao === "LAT") {
    return matchupDefMultiplier({ clubeId, opponentId, attackIndex, defenseIndex });
  }
  return 1.0;
}
