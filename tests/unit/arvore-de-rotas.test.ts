import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// O portão estrutural contra o novo modelo de proteção falhar em silêncio (T-04.6-01). Fase
// 04.6 (D-03): o `middleware.ts` deixou de proteger tudo por padrão e passou a proteger só
// `/gestao` — o modelo passou de "erra fechado" (tela nova nasce protegida) para "erra aberto"
// (tela nova nasce pública). Este teste é o que paga essa dívida: ele varre `app/` inteiro
// procurando todo `page.tsx` e `route.ts`, e reprova qualquer um que exista fora de
// `app/gestao/` sem estar nomeado explicitamente aqui embaixo.
//
// ALARGAR ESTA LISTA É PUBLICAR UMA ROTA. Quem revisar uma mudança nesta constante precisa lê-la
// como uma decisão consciente de que aquele caminho pode ser acessado sem sessão — nunca como
// manutenção de rotina.
const ARQUIVOS_DE_ROTA_PUBLICOS = [
  "app/page.tsx",
  "app/privacidade/page.tsx",
  "app/robots.ts",
  // Decidida no plano 04 (Fase 04.6): rota pública nova, exigida por SIT-08 (o critério do
  // dono é aparecer no Google para "amassa cerrado pirenópolis"). Não serve nada além do XML
  // do sitemap — sem sessão, sem banco, sem `await` de I/O (app/sitemap.ts).
  "app/sitemap.ts",
  "app/api/health/route.ts",
  "app/api/health/backup/route.ts",
  // Decidida no plano 06-11 (Fase 06): pública de propósito, no molde de `/api/health/backup` —
  // é o Passo 7 do Roteiro 15 (prova de fora que o app publicado enxerga a migração 0023) e o
  // monitor externo. O corpo é só `{ status }`: nunca contagem, saldo, valor ou nome de banco
  // (T-06-49, `tests/e2e/estoque-saude.spec.ts`).
  "app/api/health/estoque/route.ts",
  // Decidida no plano 06.1-15 (Fase 06.1): pública de propósito, no molde de
  // `/api/health/estoque` — é o Passo 6 do Roteiro 16 (prova de fora que o app publicado enxerga
  // as migrações 0024 e 0025) e o monitor externo. O corpo é só `{ status }`: nunca contagem de
  // ordens, nome, valor ou nome de banco (T-06.1-56, `tests/e2e/producao-saude.spec.ts`).
  "app/api/health/producao/route.ts",
  // Decidida no plano 05-16 (Fase 5): pública de propósito, no molde de `/api/health/producao` —
  // é o Passo 6 do Roteiro 17 (prova de fora que o app publicado enxerga a migração 0026) e o
  // monitor externo. O corpo é só `{ status }`: nunca contagem de pessoas, nome, valor ou nome de
  // banco (T-05-74, `tests/e2e/agenda-saude.spec.ts`).
  "app/api/health/agenda/route.ts",
  // Decidida no plano 06.2-13 (Fase 06.2): pública de propósito, no molde de `/api/health/agenda` —
  // é o Passo 8 do Roteiro 19 (prova de fora que o app publicado enxerga a migração 0028) e o
  // monitor externo. O corpo é só `{ status }`: nunca contagem de fornecedores ou anexos, nome,
  // valor, caminho ou nome de banco (T-06.2-45, `tests/e2e/fornecedores-saude.spec.ts`).
  "app/api/health/fornecedores/route.ts",
  // Decidida no plano 06.3-02 (Fase 06.3): pública de propósito, no molde de
  // `/api/health/fornecedores` — é a conferência de fora do Roteiro 20 (prova que o app publicado
  // enxerga a migração 0029) e o monitor externo. O corpo é só `{ status }`: nunca contagem de
  // lembretes, texto, nome ou nome de banco (T-06.3-08, `tests/e2e/lembretes-saude.spec.ts`).
  "app/api/health/lembretes/route.ts",
  // Decidida no plano 06.4-01 (Fase 06.4): pública de propósito, no molde de
  // `/api/health/lembretes` — é a conferência de fora do Roteiro 21 (prova que o app publicado
  // enxerga a migração 0030: as duas tabelas e a semente) e o monitor externo. O corpo é só
  // `{ status }` (e um `motivo` fixo no erro): nunca contagem de peças, venda, valor ou nome de
  // banco (T-06.4-08).
  "app/api/health/queimas/route.ts",
  "app/api/auth/[...nextauth]/route.ts",
];

const IGNORAR = new Set(["node_modules", ".next", ".git"]);
const RAIZ = process.cwd();

function listarArquivosDeRota(diretorio: string): string[] {
  let entradas: string[];
  try {
    entradas = readdirSync(diretorio);
  } catch {
    return [];
  }

  const resultado: string[] = [];
  for (const entrada of entradas) {
    if (IGNORAR.has(entrada)) continue;
    const caminhoAbsoluto = join(diretorio, entrada);
    const info = statSync(caminhoAbsoluto);

    if (info.isDirectory()) {
      resultado.push(...listarArquivosDeRota(caminhoAbsoluto));
      continue;
    }

    if (entrada === "page.tsx" || entrada === "route.ts") {
      resultado.push(caminhoAbsoluto);
    }
  }
  return resultado;
}

// Caminho relativo com barras normais, para o resultado não depender do separador do SO
// (Windows usa `\`) nem da forma como `RAIZ` termina.
function caminhoRelativo(caminhoAbsoluto: string): string {
  return caminhoAbsoluto.slice(RAIZ.length + 1).split("\\").join("/");
}

describe("árvore de rotas — proteção opt-in por prefixo (T-04.6-01)", () => {
  it("todo page.tsx/route.ts vive sob app/gestao/ ou está na lista pública explícita", () => {
    const arquivos = listarArquivosDeRota(join(RAIZ, "app")).map(caminhoRelativo);

    const foraDaCerca = arquivos.filter(
      (arquivo) => !arquivo.startsWith("app/gestao/") && !ARQUIVOS_DE_ROTA_PUBLICOS.includes(arquivo),
    );

    expect(foraDaCerca).toEqual([]);
  });

  // Complementar à asserção acima: prova que a lista não está vazia por acidente (ex.: um typo
  // no caminho do `app/` faria a varredura devolver [] e o teste "passaria" sem testar nada).
  it("encontra pelo menos um arquivo de rota dentro de app/gestao/", () => {
    const arquivos = listarArquivosDeRota(join(RAIZ, "app")).map(caminhoRelativo);
    const dentroDaCerca = arquivos.filter((arquivo) => arquivo.startsWith("app/gestao/"));

    expect(dentroDaCerca.length).toBeGreaterThan(0);
  });
});
