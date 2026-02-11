import type { Atleta, Posicao } from "./types.js";

const POS_MAP: Record<number, Posicao> = {
  1: "GOL",
  2: "LAT",
  3: "ZAG",
  4: "MEI",
  5: "ATA",
  6: "TEC",
};

export function normalizeAtletas(mercadoData: any): Atleta[] {
  const atletasRaw = mercadoData?.atletas ?? [];
  if (!Array.isArray(atletasRaw)) return [];

  return atletasRaw.map((a: any) => {
    const posicaoId = Number(a?.posicao_id);
    const posicao = POS_MAP[posicaoId] ?? "MEI";

    return {
      id: Number(a?.atleta_id),
      apelido: String(a?.apelido ?? ""),
      posicao,
      posicaoId,
      clubeId: Number(a?.clube_id),

      preco: Number(a?.preco_num ?? 0),
      media: Number(a?.media_num ?? 0),
      pontos: Number(a?.pontos_num ?? 0),
      variacao: Number(a?.variacao_num ?? 0),
      jogos: Number(a?.jogos_num ?? 0),

      statusId: Number(a?.status_id ?? 0),
      scout: (a?.scout && typeof a.scout === "object") ? a.scout : {},
    } satisfies Atleta;
  });
}
