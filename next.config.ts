import type { NextConfig } from "next";

import {
  REDIRECIONAMENTOS_ANTIGOS,
  REDIRECIONAMENTOS_DA_PRODUCAO,
} from "./lib/rotas/redirecionamentos-antigos";

const nextConfig: NextConfig = {
  // Saída mínima (sem devDependencies) usada pela imagem de produção do serviço `app`.
  output: "standalone",
  experimental: {
    serverActions: {
      // O padrão do Next.js para o corpo de uma Server Action é 1 MB — recusaria a foto de
      // até 15 MB (D-26/ORC-14) ANTES de qualquer código nosso rodar, com um erro que não é
      // legível para quem está no ateliê. 20 MB cobre os 15 MB do arquivo com folga para o
      // envelope do `multipart/form-data` do envio (limite medido em `lib/orcamentos/fotos.ts`,
      // `TAMANHO_MAXIMO_BYTES`).
      bodySizeLimit: "20mb",
    },
  },
  // Fase 04.6 (D-01/D-21): os 13 endereços antigos da plataforma, de quando ela respondia na
  // raiz. A lista mora em `lib/rotas/redirecionamentos-antigos.ts` — um módulo puro — para
  // poder ser testada sem subir o Next inteiro; este arquivo só a espalha.
  // Fase 06.1 (D-03, D-17): depois deles, os três endereços antigos do módulo de Encomendas, que
  // viraram a Produção — mesma lista explícita, no mesmo módulo, com data de remoção própria.
  async redirects() {
    return [...REDIRECIONAMENTOS_ANTIGOS, ...REDIRECIONAMENTOS_DA_PRODUCAO];
  },
};

export default nextConfig;
