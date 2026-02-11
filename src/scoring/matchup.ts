export type MatchupCtx = {
  isHomeByClubeId: Map<number, boolean>;
};

export function buildMatchupCtx(partidasData: any): MatchupCtx {
  const map = new Map<number, boolean>();
  const partidas = partidasData?.partidas;

  if (Array.isArray(partidas)) {
    for (const p of partidas) {
      const casa = p?.clube_casa_id;
      const fora = p?.clube_visitante_id;
      if (typeof casa === "number") map.set(casa, true);
      if (typeof fora === "number") map.set(fora, false);
    }
  }

  return { isHomeByClubeId: map };
}
