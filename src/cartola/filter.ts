import type { Atleta } from "./types.js";

export function filterByStatus(atletas: Atleta[], allowStatus: number[]) {
  const allow = new Set(allowStatus);
  return atletas.filter((a) => allow.has(a.statusId));
}
