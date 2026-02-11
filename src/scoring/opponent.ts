export type OpponentCtx = {
  opponentByClubeId: Map<number, number>;
  isHomeByClubeId: Map<number, boolean>;
};

export function buildOpponentCtx(partidasData: any): OpponentCtx {
  const opponentByClubeId = new Map<number, number>();
  const isHomeByClubeId = new Map<number, boolean>();

  const partidas = partidasData?.partidas;
  if (Array.isArray(partidas)) {
    for (const p of partidas) {
      const casa = p?.clube_casa_id;
      const fora = p?.clube_visitante_id;

      if (typeof casa === "number" && typeof fora === "number") {
        opponentByClubeId.set(casa, fora);
        opponentByClubeId.set(fora, casa);
        isHomeByClubeId.set(casa, true);
        isHomeByClubeId.set(fora, false);
      }
    }
  }

  return { opponentByClubeId, isHomeByClubeId };
}
