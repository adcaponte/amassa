import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mesmo alias de tsconfig.json (`"@/*": ["./*"]`) — sem isso, qualquer módulo testado
    // que importe por `@/` (o padrão do resto do app) falha só dentro do Vitest, que não lê
    // `paths` do tsconfig sozinho.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    watch: false,
  },
});
