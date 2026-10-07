import type { NextConfig } from "next";

import {
  REDIRECIONAMENTOS_ANTIGOS,
  REDIRECIONAMENTOS_DA_PRODUCAO,
} from "./lib/rotas/redirecionamentos-antigos";
import { CABECALHOS_DE_SEGURANCA } from "./lib/seguranca/cabecalhos";

// Teto do corpo de uma requisição — o mesmo número nos DOIS limites do Next que um envio de foto
// atravessa (quick 261003-fot). Um só valor: se um ficar abaixo do outro, o menor vence em silêncio.
const LIMITE_DO_CORPO = "20mb";

const nextConfig: NextConfig = {
  // Saída mínima (sem devDependencies) usada pela imagem de produção do serviço `app`.
  output: "standalone",
  // Fase 06.5 (D-19): nenhuma resposta anuncia `X-Powered-By: Next.js` — dizer a quem sonda qual
  // servidor está por trás não serve a ninguém do ateliê.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // O padrão do Next.js para o corpo de uma Server Action é 1 MB — recusaria a foto de
      // até 15 MB (D-26/ORC-14) ANTES de qualquer código nosso rodar, com um erro que não é
      // legível para quem está no ateliê. 20 MB cobre os 15 MB do arquivo com folga para o
      // envelope do `multipart/form-data` do envio (limite medido em `lib/orcamentos/fotos.ts`,
      // `TAMANHO_MAXIMO_BYTES`).
      bodySizeLimit: LIMITE_DO_CORPO,
    },
    // O middleware (`middleware.ts`) roda em toda requisição sob `/gestao` — inclusive no POST
    // da Server Action que recebe a foto — e, para isso, o Next CLONA o corpo. Sem esta linha, o
    // clone para em 10 MB (`DEFAULT_BODY_CLONE_SIZE_LIMIT` em `next/dist/server/body-streams.js`)
    // e a Server Action recebe SÓ os primeiros 10 MB, sem erro — só um aviso no log. Uma foto de
    // 10 a 15 MB (D-26) chegava cortada e era recusada como "Não deu para enviar essa foto".
    // Medido em 03/10/2026: 12 MB enviados, 10.485.760 bytes recebidos. Prova de ponta a ponta:
    // `tests/e2e/orcamentos-fotos.spec.ts`, caso (h).
    proxyClientMaxBodySize: LIMITE_DO_CORPO,
  },
  // Fase 04.6 (D-01/D-21): os 13 endereços antigos da plataforma, de quando ela respondia na
  // raiz. A lista mora em `lib/rotas/redirecionamentos-antigos.ts` — um módulo puro — para
  // poder ser testada sem subir o Next inteiro; este arquivo só a espalha.
  // Fase 06.1 (D-03, D-17): depois deles, os três endereços antigos do módulo de Encomendas, que
  // viraram a Produção — mesma lista explícita, no mesmo módulo, com data de remoção própria.
  async redirects() {
    return [...REDIRECIONAMENTOS_ANTIGOS, ...REDIRECIONAMENTOS_DA_PRODUCAO];
  },
  // Fase 06.5 (D-19): os cabeçalhos de segurança em TODA resposta — o site, a plataforma, as rotas
  // de API e de saúde. A lista mora em `lib/seguranca/cabecalhos.ts` — um módulo puro, testado sem
  // subir o Next (o porquê de cada valor, e de a CSP ser só report-only, está lá); este arquivo só a
  // espalha. Pelo Next, e não pelo `docker/Caddyfile`, porque o Caddyfile não é ressincronizado pelo
  // `implantar`: aqui os cabeçalhos chegam ao servidor junto com a imagem.
  async headers() {
    return [{ source: "/:path*", headers: [...CABECALHOS_DE_SEGURANCA] }];
  },
};

export default nextConfig;
