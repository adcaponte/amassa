import type { NextConfig } from "next";

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
};

export default nextConfig;
