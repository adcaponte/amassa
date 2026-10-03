import { describe, expect, it } from "vitest";

import { TAMANHO_MAXIMO_BYTES } from "@/lib/orcamentos/fotos";
import nextConfig from "../../next.config";

// Quick 261003-fot: uma foto de orçamento atravessa DOIS limites do Next — o clone do corpo que o
// middleware faz (`proxyClientMaxBodySize`, padrão 10 MB, que CORTA em silêncio) e o da Server
// Action (`serverActions.bodySizeLimit`). Os dois precisam ser o mesmo número e caber a foto
// maior que o D-26 aceita, com folga para o envelope do multipart.
function emBytes(valor: unknown): number {
  const texto = String(valor).toLowerCase();
  const casou = /^(\d+)mb$/.exec(texto);
  if (!casou) throw new Error(`limite em formato inesperado: ${texto}`);
  return Number(casou[1]) * 1024 * 1024;
}

describe("next.config — limites do corpo da requisição", () => {
  const experimental = nextConfig.experimental ?? {};

  it("o middleware não corta antes da Server Action: os dois limites são o mesmo número", () => {
    expect(experimental.proxyClientMaxBodySize).toBeDefined();
    expect(experimental.proxyClientMaxBodySize).toBe(experimental.serverActions?.bodySizeLimit);
  });

  it("cabe a maior foto aceita (15 MB) com folga de pelo menos 1 MB para o envelope", () => {
    expect(emBytes(experimental.proxyClientMaxBodySize)).toBeGreaterThanOrEqual(TAMANHO_MAXIMO_BYTES + 1024 * 1024);
  });
});
