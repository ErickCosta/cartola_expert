import type { Posicao } from "../cartola/types.js";

export type Formation = Record<Posicao, number>;

/**
 * Ex: "4-3-3" => 1 GOL, 2 LAT, 2 ZAG, 3 MEI, 3 ATA, 1 TEC
 * Regras:
 * - sempre 1 goleiro
 * - sempre 2 laterais
 * - zagueiros = defensores - 2
 * - sempre 1 técnico
 */
export function parseFormation(input: string): Formation {
  const parts = input.split("-").map((x) => Number(x.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("Formação inválida. Use ex: 4-3-3, 3-4-3, 4-4-2");
  }

  const [def, mei, ata] = parts;

  if (def < 3 || def > 5) throw new Error("Defensores deve estar entre 3 e 5.");
  if (mei < 3 || mei > 5) throw new Error("Meias deve estar entre 3 e 5.");
  if (ata < 1 || ata > 3) throw new Error("Atacantes deve estar entre 1 e 3.");
  if (def + mei + ata !== 10) throw new Error("Formação inválida: soma deve ser 10 (sem contar goleiro).");

  const zags = def - 2; // 2 laterais fixos
  if (zags < 1) throw new Error("Formação inválida: defensores < 3 não fecha com 2 laterais.");

  return {
    GOL: 1,
    LAT: 2,
    ZAG: zags,
    MEI: mei,
    ATA: ata,
    TEC: 1,
  };
}
