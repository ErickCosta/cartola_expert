// src/config/scoring.ts

/**
 * Config centralizada de pesos/multiplicadores do modelo heurístico atual.
 *
 * Objetivo: permitir calibragem rápida sem espalhar "números mágicos".
 */
export const SCORING = {
  blend: {
    scoutWeight: 0.65,
    mediaWeight: 0.35,
    mediaHomeMult: 1.06,
    mediaAwayMult: 0.97,
  },

  mando: {
    atkHome: 1.10,
    atkAway: 0.95,
    defHome: 1.08,
    defAway: 0.97,
    tecHome: 1.05,
    tecAway: 0.98,
  },

  // pesos por posição (em cima das taxas por jogo)
  weights: {
    GOL: {
      SG: 7.0,
      DS: 1.2,
      DE: 0.9,
      DD: 1.6,
      DP: 7.0,
      CA: -1.0,
      CV: -3.0,
      GC: -5.0,
    },
    ZAG: {
      SG: 7.0,
      DS: 1.6,
      CA: -1.0,
      CV: -3.0,
      FC: -0.4,
      GC: -5.0,
    },
    LAT: {
      SG: 6.5,
      DS: 1.3,
      A: 5.0,
      G: 6.0,
      CA: -1.0,
      CV: -3.0,
      FC: -0.4,
    },
    MEI: {
      DS: 1.2,
      A: 6.0,
      G: 6.5,
      CHUTES: 0.25, // FF+FD+FT
      CA: -1.0,
      CV: -3.0,
      PP: -3.0,
    },
    ATA: {
      G: 7.5,
      A: 4.5,
      CHUTES: 0.35, // FF+FD+FT
      CA: -1.0,
      CV: -3.0,
      PP: -3.0,
      I: -0.2,
    },
  },

  // multiplicadores do confronto (via attackIndex/defenseIndex)
  matchup: {
    k: 0.14,
    min: 0.90,
    max: 1.15,
  },

  // seleção de candidatos (para reduzir o espaço do beam)
  candidates: {
    perPos: {
      topByScore: 35,
      topByValue: 25,
      cheapest: 25,
    },
    // Limite "duro" por posição depois de unir buckets
    capPerPos: 100,
  },
} as const;
