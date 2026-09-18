import { describe, expect, it } from "vitest";

import { podeRenovarSessao, semRenovacaoDaSessao } from "../../lib/auth/renovacao-sessao";

// A regra que impede um prefetch atrasado de ressuscitar a sessão depois de "Sair" (AUTH-06).
// O comportamento de ponta a ponta fica em tests/e2e/sessao.spec.ts ("depois de sair...").
// Os cabeçalhos abaixo são os que o MIDDLEWARE recebe: o Next já tirou `rsc` e
// `next-router-prefetch` antes dele (next/dist/server/web/adapter.js), por isso a regra olha
// `Sec-Fetch-Dest`, que vem do navegador.

describe("podeRenovarSessao", () => {
  it("não renova em GET feito por fetch() — prefetch ou navegação RSC do roteador", () => {
    const cabecalhos = new Headers({ "sec-fetch-dest": "empty", "sec-fetch-mode": "cors" });
    expect(podeRenovarSessao("GET", cabecalhos)).toBe(false);
  });

  it("renova no carregamento de página (reabrir o app mantém a sessão de 30 dias, AUTH-05)", () => {
    const cabecalhos = new Headers({ "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" });
    expect(podeRenovarSessao("GET", cabecalhos)).toBe(true);
  });

  it("renova em Server Action (POST por fetch)", () => {
    const cabecalhos = new Headers({ "sec-fetch-dest": "empty", "next-action": "abc123" });
    expect(podeRenovarSessao("POST", cabecalhos)).toBe(true);
  });

  it("renova quando o navegador não manda Sec-Fetch-Dest (comportamento anterior)", () => {
    expect(podeRenovarSessao("GET", new Headers())).toBe(true);
  });

  it("renova em GET de outros destinos (imagem, script)", () => {
    expect(podeRenovarSessao("GET", new Headers({ "sec-fetch-dest": "image" }))).toBe(true);
    expect(podeRenovarSessao("GET", new Headers({ "sec-fetch-dest": "script" }))).toBe(true);
  });
});

describe("semRenovacaoDaSessao", () => {
  const outro = "authjs.csrf-token=abc; Path=/; HttpOnly";

  it("tira o token de sessão em http (sem prefixo)", () => {
    const linhas = ["authjs.session-token=eyJ; Path=/; HttpOnly; SameSite=Lax", outro];
    expect(semRenovacaoDaSessao(linhas)).toEqual([outro]);
  });

  it("tira o token de sessão com o prefixo __Secure- (produção, https)", () => {
    const linhas = ["__Secure-authjs.session-token=eyJ; Path=/; Secure; HttpOnly", outro];
    expect(semRenovacaoDaSessao(linhas)).toEqual([outro]);
  });

  it("tira todos os pedaços de um token dividido (.0, .1)", () => {
    const linhas = [
      "__Secure-authjs.session-token.0=eyJ; Path=/",
      "__Secure-authjs.session-token.1=parte; Path=/",
      outro,
    ];
    expect(semRenovacaoDaSessao(linhas)).toEqual([outro]);
  });

  it("mantém cookies de nome parecido que não são o token de sessão", () => {
    const linhas = ["x-authjs.session-token=1; Path=/", "authjs.session-token-antigo=1; Path=/"];
    expect(semRenovacaoDaSessao(linhas)).toEqual(linhas);
  });

  it("devolve a lista intacta quando não há token de sessão", () => {
    expect(semRenovacaoDaSessao([outro])).toEqual([outro]);
    expect(semRenovacaoDaSessao([])).toEqual([]);
  });
});
