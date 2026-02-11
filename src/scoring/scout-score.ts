// src/scoring/scout-score.ts

type PosKey = "GOL" | "ZAG" | "LAT" | "MEI" | "ATA" | "TEC";

export type NormalizedAtleta = {
  id: number;
  apelido: string;
  clubeId: number;
  posicao: PosKey;

  preco: number;
  jogos: number;
  media: number;

  scout?: Record<string, number | undefined>;
};

export type ScoutParts = {
  offTalent: number; // talento ofensivo (histórico)
  defTalent: number; // talento defensivo (histórico)
  media: number;     // média do cartola (histórico agregado)
};

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function getScout(a: NormalizedAtleta, key: string): number {
  return n(a.scout?.[key]);
}

/**
 * Shrinkage para início de campeonato:
 * rate = (raw + k*prior) / (games + k)
 * prior = 0 porque a gente já mistura com média (media_num)
 */
function perGame(raw: number, games: number, k = 3, prior = 0): number {
  const g = Math.max(0, n(games));
  return (raw + k * prior) / (g + k);
}

// Mando (leve) por tipo
const HOME_ATK = 1.06;
const AWAY_ATK = 0.94;
const HOME_DEF = 1.05;
const AWAY_DEF = 0.95;

export function scoreByScoutParts(atleta: NormalizedAtleta, opts: { isHome: boolean }): ScoutParts {
  const isHome = !!opts.isHome;

  const games = Math.max(0, n(atleta.jogos));
  const media = n(atleta.media);

  // Scouts relevantes (SEM SG e SEM GS aqui)
  const DD = getScout(atleta, "DD");
  const DS = getScout(atleta, "DS");
  const A  = getScout(atleta, "A");
  const G  = getScout(atleta, "G");

  // Normaliza por jogo com shrinkage
  const dd = perGame(DD, games);
  const ds = perGame(DS, games);
  const a  = perGame(A, games);
  const g  = perGame(G, games);

  let offTalent = 0;
  let defTalent = 0;

  switch (atleta.posicao) {
    case "GOL":
      // talento do GOL = defesas por jogo
      defTalent = dd * 1.0;
      break;

    case "ZAG":
      defTalent = ds * 1.0;
      break;

    case "LAT":
      defTalent = ds * 1.0;
      offTalent = a * 0.75;
      break;

    case "MEI":
      defTalent = ds * 0.70;
      offTalent = a * 1.00 + g * 1.15;
      break;

    case "ATA":
      offTalent = g * 1.25 + a * 0.80;
      break;

    case "TEC":
      // técnico não usa scout aqui (vai direto na média no index)
      offTalent = 0;
      defTalent = 0;
      break;
  }

  // aplica mando separado
  const offMult = isHome ? HOME_ATK : AWAY_ATK;
  const defMult = isHome ? HOME_DEF : AWAY_DEF;

  return {
    offTalent: offTalent * offMult,
    defTalent: defTalent * defMult,
    media,
  };
}

/**
 * Mantém compatibilidade: score único (talento puro + média).
 * OBS: matchup + SG esperado ficam no index.
 */
export function scoreByScout(atleta: NormalizedAtleta, opts: { isHome: boolean }) {
  const { offTalent, defTalent, media } = scoreByScoutParts(atleta, opts);
  return (offTalent + defTalent) * 0.65 + media * 0.35;
}
