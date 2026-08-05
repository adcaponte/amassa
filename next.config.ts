import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Saída mínima (sem devDependencies) usada pela imagem de produção do serviço `app`.
  output: "standalone",
};

export default nextConfig;
