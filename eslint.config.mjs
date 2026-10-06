import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Specs e2e que ainda medem caixa do jeito antigo, com `boundingBox()` direto (D-23, Fase 06.5). O
// plano 06.5-23 os migra para `medirCaixa` e APAGA esta lista. Nenhum arquivo novo entra nela: teste
// novo mede só por `tests/e2e/apoio/medir-caixa.ts`.
const ESPECS_COM_BOUNDINGBOX_ANTIGO = [
  "tests/e2e/lembretes-inicio.spec.ts",
  "tests/e2e/lembretes-todos.spec.ts",
  "tests/e2e/orcamentos-aprovacao.spec.ts",
  "tests/e2e/orcamentos-ciclo.spec.ts",
  "tests/e2e/orcamentos-editor.spec.ts",
  "tests/e2e/orcamentos-fotos.spec.ts",
  "tests/e2e/orcamentos-revisao.spec.ts",
  "tests/e2e/orcamentos-total.spec.ts",
  "tests/e2e/orcamentos-tracador.spec.ts",
  "tests/e2e/precificacao-ficha.spec.ts",
  "tests/e2e/precificacao-parametros.spec.ts",
  "tests/e2e/precificacao-pecas.spec.ts",
  "tests/e2e/producao-concluidas.spec.ts",
  "tests/e2e/producao-linha-do-tempo.spec.ts",
  "tests/e2e/producao-quadro.spec.ts",
  "tests/e2e/producao-trilha.spec.ts",
  "tests/e2e/queimas-atalhos.spec.ts",
  "tests/e2e/queimas-cobranca.spec.ts",
  "tests/e2e/queimas-contagem.spec.ts",
  "tests/e2e/site-abertura.spec.ts",
  "tests/e2e/site-secoes.spec.ts",
];

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
    files: ["tests/e2e/**/*.ts"],
    ignores: ["tests/e2e/apoio/medir-caixa.ts", ...ESPECS_COM_BOUNDINGBOX_ANTIGO],
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
