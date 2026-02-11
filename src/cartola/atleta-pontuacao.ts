import fs from "node:fs";
import path from "node:path";
import { cartolaAuth } from "./auth-client.js";

const CACHE_DIR = path.resolve(process.cwd(), ".cache", "pontuacao");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFile(atletaId: number) {
  return path.join(CACHE_DIR, `${atletaId}.json`);
}

export type PontuacaoItem = {
  scout?: Record<string, number>;
  // pode ter outras chaves (rodada_id, pontos, etc)
  [k: string]: any;
};

export type PontuacaoRaw = PontuacaoItem[] | { scout?: Record<string, number>; [k: string]: any };

export type PontuacaoNorm = {
  raw: PontuacaoRaw;
  items: PontuacaoItem[]; // sempre array
  scoutAgg: Record<string, number>; // soma dos scouts
};

function addScout(acc: Record<string, number>, scout?: Record<string, number>) {
  if (!scout) return;
  for (const [k, v] of Object.entries(scout)) {
    acc[k] = (acc[k] ?? 0) + Number(v ?? 0);
  }
}

export function normalizePontuacao(raw: PontuacaoRaw): PontuacaoNorm {
  const items: PontuacaoItem[] = Array.isArray(raw) ? raw : [raw];
  const scoutAgg: Record<string, number> = {};

  for (const it of items) addScout(scoutAgg, it?.scout);

  return { raw, items, scoutAgg };
}

export async function getAtletaPontuacao(params: {
  atletaId: number;
  bearer: string;
  glbTag?: string;
  useCache?: boolean;
}): Promise<PontuacaoNorm> {
  const { atletaId, bearer, glbTag, useCache = true } = params;

  ensureCacheDir();
  const file = cacheFile(atletaId);

  if (useCache && fs.existsSync(file)) {
    const rawTxt = fs.readFileSync(file, "utf-8");
    const raw = JSON.parse(rawTxt) as PontuacaoRaw;
    return normalizePontuacao(raw);
  }

  const auth = cartolaAuth({ bearer, glbTag });
  const url = `https://api.cartola.globo.com/auth/mercado/atleta/${atletaId}/pontuacao`;

  const res = await auth.get(url);
  const raw = res.data as PontuacaoRaw;

  if (useCache) fs.writeFileSync(file, JSON.stringify(raw, null, 2), "utf-8");

  return normalizePontuacao(raw);
}
