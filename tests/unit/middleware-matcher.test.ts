import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

// A cerca do `middleware.ts` com a ÚNICA exceção da Fase 06.2 (D-08, pesquisa Achado 1): o Next
// 16.3.5 clona e TRUNCA em 10 MB, sem erro, o corpo de toda requisição que o middleware intercepta —
// então o PUT de upload dos anexos (até 20 MiB) precisa ficar de fora. Só o caminho EXATO dele: o GET
// `/gestao/api/fornecedores/anexos/<id>` e tudo o mais sob `/gestao` continuam protegidos.
//
// O teste lê o TEXTO de `middleware.ts` (no molde de `arvore-de-rotas.test.ts`): o `config` precisa ser
// literal estático — o Next o lê em tempo de build —, e é o literal que está no arquivo que vale, não
// uma constante importada que poderia divergir dele. Depois pergunta ao próprio Next, com
// `unstable_doesMiddlewareMatch`, quais caminhos casam.
//
// ALARGAR A EXCEÇÃO É TIRAR UMA ROTA DA CERCA. Quem mudar a lista abaixo precisa lê-la como uma decisão
// de segurança (T-06.2-23), nunca como manutenção.
const MATCHER_ESPERADO = ["/gestao", "/gestao/((?!api/fornecedores/anexos$).*)"];

const UUID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

// Os caminhos e o que o matcher deve responder — a tabela medida na pesquisa (Achado 1).
const CASOS: ReadonlyArray<{ url: string; casa: boolean; porque: string }> = [
  { url: "/gestao", casa: true, porque: "a raiz da plataforma" },
  { url: "/gestao/", casa: true, porque: "a raiz com barra" },
  { url: "/gestao/login", casa: true, porque: "a tela de entrada (o middleware decide se é pública)" },
  { url: "/gestao/cadastros?sub=fornecedores", casa: true, porque: "uma tela com query" },
  { url: "/gestao/api/orcamentos/fotos/abc", casa: true, porque: "a rota da foto de orçamento" },
  { url: "/gestao/api/fornecedores/anexos", casa: false, porque: "o PUT de upload — a exceção" },
  {
    url: "/gestao/api/fornecedores/anexos?fornecedorId=x",
    casa: false,
    porque: "o PUT de upload com os metadados na query",
  },
  { url: "/gestao/api/fornecedores/anexos/", casa: true, porque: "com barra no fim já não é o PUT" },
  {
    url: `/gestao/api/fornecedores/anexos/${UUID}`,
    casa: true,
    porque: "o GET do anexo continua sob o middleware",
  },
  { url: "/gestao/api/fornecedores/anexosX", casa: true, porque: "um prefixo de texto não é o PUT" },
  { url: "/", casa: false, porque: "o site público" },
  { url: "/api/health", casa: false, porque: "a saúde, fora de /gestao" },
];

function lerMatcherDoMiddleware(): unknown {
  const texto = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
  const casamento = /matcher:\s*(\[[^\]]*\])/.exec(texto);
  if (!casamento) {
    throw new Error("Não achei `matcher: [...]` em middleware.ts — o config precisa ser literal.");
  }
  return JSON.parse(casamento[1]);
}

type Conferidor = (argumentos: { config: { matcher: string[] }; url: string }) => boolean;

let doesMiddlewareMatch: Conferidor;

beforeAll(async () => {
  // Pitfall 2: fora do Next, importar `next/experimental/testing/server` explode com "AsyncLocalStorage
  // accessed in runtime where it is not available". O Next procura a classe no `globalThis`.
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
  const modulo = await import("next/experimental/testing/server");
  doesMiddlewareMatch = modulo.unstable_doesMiddlewareMatch as Conferidor;
});

describe("middleware.ts — o matcher literal", () => {
  it("é exatamente a lista com a exceção do PUT de anexos (D-08)", () => {
    expect(lerMatcherDoMiddleware()).toEqual(MATCHER_ESPERADO);
  });
});

describe("middleware.ts — quais caminhos o middleware intercepta", () => {
  for (const caso of CASOS) {
    it(`${caso.url} ${caso.casa ? "casa" : "NÃO casa"} — ${caso.porque}`, () => {
      const matcher = lerMatcherDoMiddleware() as string[];
      expect(doesMiddlewareMatch({ config: { matcher }, url: caso.url })).toBe(caso.casa);
    });
  }
});
