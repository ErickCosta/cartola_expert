export type Posicao = "GOL" | "LAT" | "ZAG" | "MEI" | "ATA" | "TEC";

export type Atleta = {
  id: number;
  apelido: string;
  posicao: Posicao;
  posicaoId: number;
  clubeId: number;

  preco: number;
  media: number;
  pontos: number;
  variacao: number;
  jogos: number;

  statusId: number;
  scout: Record<string, number>;
};
