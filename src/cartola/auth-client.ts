import axios from "axios";

export function cartolaAuth(params: { bearer: string; glbTag?: string }) {
  const { bearer, glbTag } = params;

  return axios.create({
    timeout: 20000,
    headers: {
      "User-Agent": "cartola-expert/1.0",
      "authorization": `Bearer ${bearer}`,
      "x-glb-app": "cartola_web",
      "x-glb-auth": "oidc",
      ...(glbTag ? { "x-glb-tag": glbTag } : {}),
      "origin": "https://cartola.globo.com",
      "referer": "https://cartola.globo.com/",
      "accept": "*/*",
    },
  });
}
