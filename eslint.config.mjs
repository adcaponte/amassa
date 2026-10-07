import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Ferramentas do GSD e documentos de planejamento não são código da aplicação.
      ".claude/**",
      ".planning/**",
      "amassa-plataforma/**",
    ],
  },
  {
    // `boundingBox()` não espera nada: mede o conteúdo ainda oculto do streaming do `loading.tsx` e
    // devolve `null` (run 37209767592). `medirCaixa` espera a visibilidade antes de medir (D-23).
    // Vale para TODO arquivo de `tests/e2e/` desde o plano 06.5-23, que migrou os 42 specs antigos e
    // apagou a lista de exceções; a única exceção é o próprio auxiliar, que é quem chama
    // `boundingBox()` depois de esperar. Nenhuma exceção nova: meça por `medirCaixa`.
    files: ["tests/e2e/**/*.ts"],
    ignores: ["tests/e2e/apoio/medir-caixa.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='boundingBox']",
          message:
            "Use medirCaixa(…) de tests/e2e/apoio/medir-caixa.ts — ele espera a visibilidade antes de medir (D-23).",
        },
      ],
    },
  },
];

export default eslintConfig;
