import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { luminanciaRelativa, razaoDeContraste } from "@/lib/acessibilidade/contraste";
import { ORDEM_DAS_COLUNAS } from "@/lib/producao/etapas";

// O briefing do site (BRIEFING-site.md §4) manda CONFERIR o contraste da faixa amarela, não
// afirmá-lo — "a faixa amarela `--sol` com texto `--tinta` passa; conferir". Uma frase de plano
// não confere nada; um número, sim (SIT-10, aresta `precision`). Os pares do site são lidos do
// `app/globals.css` REAL por `node:fs` (nunca hex repetido aqui) — o mesmo molde de
// `tests/unit/tokens.test.ts` — para mudar um neutro reexecutar esta conferência sozinho.
const globalsCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf-8");

// Resolve o valor de UMA variável CSS (`--nome: valor;`) em app/globals.css — pode ser um hex
// literal ou uma referência `var(--outra-variavel)` (D-19: sete dos treze tokens do site
// referenciam um token da plataforma, de propósito, para os dois nunca divergirem sem ninguém
// notar). Segue a cadeia de `var(...)` até achar hex, ou lança se não achar em 5 saltos (limite
// de segurança contra ciclo, nunca esperado num CSS real).
function resolverVariavelCss(nomeDaVariavel: string, saltosRestantes = 5): string {
  if (saltosRestantes <= 0) {
    throw new Error(`cadeia de var(...) longa demais ao resolver ${nomeDaVariavel} — possível ciclo`);
  }
  const padrao = new RegExp(`${nomeDaVariavel}:\\s*([^;]+);`);
  const encontrado = globalsCss.match(padrao);
  if (!encontrado) {
    throw new Error(`variável ${nomeDaVariavel} não encontrada em app/globals.css`);
  }
  const valorBruto = encontrado[1].trim();
  const casoHex = valorBruto.match(/^#[0-9A-Fa-f]{6}$/);
  if (casoHex) return valorBruto;

  const casoVar = valorBruto.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (casoVar) return resolverVariavelCss(casoVar[1], saltosRestantes - 1);

  throw new Error(`valor "${valorBruto}" de ${nomeDaVariavel} não é hex nem var(...) — formato inesperado`);
}

function tokenDoSite(nome: string): string {
  return resolverVariavelCss(`--color-site-${nome}`);
}

// Fase 04.6: o mesmo resolvedor, agora para os tokens da PLATAFORMA. Até aqui este arquivo só
// media o site (SIT-10), e foi por isso que o plano 04.6-08 descobriu por LEITURA, na varredura
// completa, que o bloco Produção pintava texto branco sobre `--color-secagem` a 1,94:1 — o
// módulo de medir existia desde o plano 04, mas nada apontava para as telas de `/gestao`.
function tokenDaPlataforma(nome: string): string {
  return resolverVariavelCss(`--color-${nome}`);
}

describe("lib/acessibilidade/contraste — razaoDeContraste e luminanciaRelativa (SIT-10)", () => {
  it("razaoDeContraste é simétrica: branco/preto e preto/branco devolvem 21", () => {
    expect(razaoDeContraste("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(razaoDeContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
  });

  it("razaoDeContraste da mesma cor contra si mesma devolve 1", () => {
    expect(razaoDeContraste("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("aceita hex com e sem #, maiúsculo e minúsculo", () => {
    const comCerquilha = razaoDeContraste("#FFFFFF", "#000000");
    const semCerquilha = razaoDeContraste("FFFFFF", "000000");
    const minusculo = razaoDeContraste("ffffff", "000000");
    expect(semCerquilha).toBeCloseTo(comCerquilha, 5);
    expect(minusculo).toBeCloseTo(comCerquilha, 5);
  });

  it("recusa entrada mal formada com erro claro em português", () => {
    expect(() => razaoDeContraste("não é hex", "#000000")).toThrow(/hex/i);
    expect(() => razaoDeContraste("#FFF", "#000000")).toThrow(/hex/i);
    expect(() => razaoDeContraste("#GGGGGG", "#000000")).toThrow(/hex/i);
  });

  it("luminanciaRelativa do branco é 1 e do preto é 0", () => {
    expect(luminanciaRelativa("#FFFFFF")).toBeCloseTo(1, 5);
    expect(luminanciaRelativa("#000000")).toBeCloseTo(0, 5);
  });

  it("o par --color-site-sol sobre --color-site-tinta passa AA (>= 4.5)", () => {
    const sol = tokenDoSite("sol");
    const tinta = tokenDoSite("tinta");
    expect(razaoDeContraste(sol, tinta)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["fundo", "papel", "areia"])(
    "--color-site-tinta sobre --color-site-%s passa AA (>= 4.5)",
    (fundo) => {
      const tinta = tokenDoSite("tinta");
      const corDeFundo = tokenDoSite(fundo);
      expect(razaoDeContraste(tinta, corDeFundo)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("--color-site-tinta-fraca sobre --color-site-fundo passa AA (>= 4.5) — achado real se não passar: o token muda, não o teste", () => {
    const tintaFraca = tokenDoSite("tinta-fraca");
    const fundo = tokenDoSite("fundo");
    expect(razaoDeContraste(tintaFraca, fundo)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("app/sitemap.ts — MetadataRoute.Sitemap (SIT-08)", () => {
  it("devolve uma entrada só (a raiz), com lastModified, determinística entre chamadas", async () => {
    const modulo = await import("@/app/sitemap");
    const sitemap = modulo.default;

    const primeira = sitemap();
    const segunda = sitemap();

    expect(primeira).toHaveLength(1);
    expect(primeira[0]?.url).toMatch(/\/$/);
    expect(primeira[0]?.lastModified).toBeDefined();
    expect(segunda).toEqual(primeira);
  });
});

// Fase 04.6, achado do plano 08 — a lacuna que este bloco fecha.
//
// `components/amassa/inicio/bloco-producao.tsx` e `components/amassa/producao/folha-geral.tsx`
// pintam o rótulo (ou o contador) da etapa DENTRO de uma pílula cuja cor de fundo é
// `--color-<etapa>`. (Até a Fase 06.1 o segundo era o Gantt de Encomendas, apagado no plano 14.)
// A regra da cor do texto é a mesma nos dois: tinta escura na `secagem` (o único token claro da
// família), branco em todas as outras. Dois problemas que só um teste pega:
//
// 1. Um token de etapa pode ser reescrito sem ninguém remedir o par. Foi exatamente o que
//    aconteceu: `--color-secagem` (#C9B896) dá 1,95:1 contra branco, e o bloco Produção nasceu
//    com texto branco em cima. Dois tokens hoje passam por pouco — `--color-producao` a 4,71 e
//    `--color-esmaltacao` a 4,74, contra o mínimo de 4,5 — então um ajuste pequeno de paleta
//    reprova de verdade.
// 2. A regra está DUPLICADA em dois componentes. Se um deles mudar e o outro não, a mesma
//    pílula passa a ter contraste diferente em duas telas.
//
// A lista de etapas vem de `ORDEM_DAS_COLUNAS` (`lib/producao/etapas.ts`), não escrita à mão aqui: uma etapa nova sem token
// (ou com um token que reprova) cai neste teste, não na tela do ateliê.
describe("contraste das pílulas de etapa nas telas de /gestao (GES-07, achado do plano 04.6-08)", () => {
  // A mesma regra dos dois componentes, num lugar só, para o teste poder cobrá-la dos dois.
  const TINTA_SOBRE_CLARO = "#3A331F";
  const BRANCO = "#FFFFFF";
  const corDoTextoDaEtapa = (etapa: string) => (etapa === "secagem" ? TINTA_SOBRE_CLARO : BRANCO);

  it.each(ORDEM_DAS_COLUNAS.map((etapa) => [etapa] as const))(
    "a pílula da etapa %s passa AA (>= 4.5) com a cor de texto que os componentes escolhem",
    (etapa) => {
      const fundo = tokenDaPlataforma(etapa);
      const texto = corDoTextoDaEtapa(etapa);
      const razao = razaoDeContraste(fundo, texto);
      // Achado real se reprovar: o TOKEN muda (ou a regra da cor do texto), nunca o limiar.
      expect(razao, `--color-${etapa} (${fundo}) sob ${texto} deu ${razao.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(4.5);
    },
  );

  it("a secagem é mesmo o único token de etapa que precisa de texto escuro", () => {
    const precisamDeEscuro = ORDEM_DAS_COLUNAS.filter(
      (etapa) => razaoDeContraste(tokenDaPlataforma(etapa), BRANCO) < 4.5,
    );
    // Se outro token entrar nesta lista, a regra `secagem ? escuro : branco` dos dois
    // componentes deixou de ser suficiente — e é isso que precisa mudar, não este número.
    expect(precisamDeEscuro).toEqual(["secagem"]);
  });

  it.each([
    ["components/amassa/inicio/bloco-producao.tsx"],
    // Fase 06.1, plano 13 (Q13): o contador colorido da seção de etapa da folha geral A4.
    ["components/amassa/producao/folha-geral.tsx"],
  ])("%s carrega a mesma regra de cor de texto (a duplicação não pode divergir)", (caminho) => {
    const fonte = readFileSync(join(process.cwd(), caminho), "utf-8");
    expect(fonte).toContain(TINTA_SOBRE_CLARO);
    expect(fonte).toMatch(/"secagem"\s*\?/);
  });
});

// Fase 06.1 (plano 14, D-16): o bloco Produção do Início deixou as tags sem etapa do modelo antigo
// ("Atrasada", "Começa em", "Em espera" — CR-04 da 04.6) e passou a mostrar o SELO da ordem, o mesmo
// chip do quadro (`ChipDoSelo`, em `cartao-ordem.tsx`), e a linha "{N} aguardando o sinal". Cada par
// de cor que eles usam — Q1 a Q4 da tabela "Pares de contraste" de `06.1-UI-SPEC.md` — é MEDIDO aqui,
// lido do `app/globals.css` real. Q1 (4,51) e Q2 (4,57) passam por pouco: um ajuste de paleta
// reprova aqui de propósito. Achado real se reprovar: o token ou o par muda, nunca o limiar.
describe("contraste dos selos e da linha de aguardando do bloco Produção do Início (Q1–Q4)", () => {
  const PARES_DO_SELO = [
    ["Q1 · +N nesta etapa", "atencao", "atencao-fundo", "text-atencao", "bg-atencao-fundo"],
    ["Q2 · no ritmo", "sucesso", "sucesso-fundo", "text-sucesso", "bg-sucesso-fundo"],
    ["Q3 · vai atrasar", "erro", "erro-fundo", "text-erro", "bg-erro-fundo"],
    ["Q4 · aguardando o sinal", "tinta-media", "superficie-2", "text-tinta-media", "bg-superficie-2"],
  ] as const;

  it.each(PARES_DO_SELO)(
    "o par %s (--color-%s sobre --color-%s) passa AA (>= 4.5)",
    (_rotulo, tokenDoTexto, tokenDoFundo) => {
      const texto = tokenDaPlataforma(tokenDoTexto);
      const fundo = tokenDaPlataforma(tokenDoFundo);
      const razao = razaoDeContraste(texto, fundo);
      expect(razao, `${texto} sobre ${fundo} deu ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(PARES_DO_SELO)(
    "o chip do selo usa de fato o par medido %s",
    (_rotulo, _texto, _fundo, classeDoTexto, classeDoFundo) => {
      const fonte = readFileSync(
        join(process.cwd(), "components/amassa/producao/cartao-ordem.tsx"),
        "utf-8",
      );
      expect(fonte).toContain(`${classeDoFundo} ${classeDoTexto}`);
    },
  );

  it("o bloco Produção usa o chip do selo do quadro e o par Q4 na linha de aguardando", () => {
    const fonte = readFileSync(
      join(process.cwd(), "components/amassa/inicio/bloco-producao.tsx"),
      "utf-8",
    );
    expect(fonte).toContain("<ChipDoSelo");
    expect(fonte).toContain("text-tinta-media");
    expect(fonte).toContain("bg-superficie-2");
  });
});

// Fase 06 (Estoque), plano 06-04: os pares de cor que a fase passa a usar, P1 a P17b da tabela
// "Color → Pares de contraste" de `.planning/phases/06-estoque/06-UI-SPEC.md`, cada um lido do
// `app/globals.css` real por `tokenDaPlataforma` — nenhum hex repetido aqui. Mínimo 4,5 para texto
// normal; 3,0 para elemento não-texto (borda de 4px, preenchimento de barra) e para texto grande.
// Achado real se reprovar: o token (ou o par que o componente usa) muda, nunca o limiar.
describe("contraste do Estoque (06-UI-SPEC.md)", () => {
  const TEXTO_NORMAL = 4.5;
  const NAO_TEXTO = 3.0;
  const TEXTO_GRANDE = 3.0;

  const PARES = [
    // Margem quase nula — qualquer ajuste de paleta reprova aqui de propósito (P1 = 4,51:1).
    ["P1", "atencao", "atencao-fundo", TEXTO_NORMAL, "banner e chip “Acabando”"],
    ["P2", "atencao", "superficie", TEXTO_NORMAL, "saldo acabando no cartão e na tabela"],
    ["P3", "erro", "superficie", TEXTO_NORMAL, "saldo negativo"],
    ["P4", "erro", "erro-fundo", TEXTO_NORMAL, "chips “Saldo negativo” e “Perda”"],
    ["P5", "acento", "acento-fundo", TEXTO_NORMAL, "pílula marcada, destino marcado"],
    ["P6", "acento-hover", "acento-fundo", TEXTO_NORMAL, "“o saldo passa de X para Y”"],
    ["P7", "primary-foreground", "acento", TEXTO_NORMAL, "segmento marcado, botão primário"],
    ["P8", "tinta-media", "superficie-2", TEXTO_NORMAL, "prévia neutra, atalhos, notas"],
    ["P9", "tinta-fraca", "superficie-2", TEXTO_NORMAL, "chip “Desativado”"],
    ["P10", "sucesso", "superficie", TEXTO_NORMAL, "número de entrada, “✓ Contado”"],
    // Margem quase nula — qualquer ajuste de paleta reprova aqui de propósito (P11 = 4,57:1).
    ["P11", "sucesso", "sucesso-fundo", TEXTO_NORMAL, "chip “Venda”"],
    ["P12", "acento", "superficie-2", NAO_TEXTO, "barra do “Para onde foi”"],
    ["P13", "erro", "superficie-2", NAO_TEXTO, "barra “Perda ou quebra”"],
    ["P14", "atencao", "superficie", NAO_TEXTO, "borda esquerda de 4px — acabando"],
    ["P15", "erro", "superficie", NAO_TEXTO, "borda esquerda de 4px — negativo"],
    ["P16", "erro", "atencao-fundo", TEXTO_NORMAL, "linha “Com saldo negativo: …” no banner"],
    // P17a e P17b são válidos SÓ em Display 28px/700 (texto grande, WCAG 1.4.3). P17a (4,20:1)
    // reprovaria como texto normal: o componente nunca pode usar `atencao` sobre `superficie-2`
    // abaixo de 24px (ou 18,66px em 700).
    ["P17a", "atencao", "superficie-2", TEXTO_GRANDE, "saldo acabando no resumo da folha (Display)"],
    ["P17b", "erro", "superficie-2", TEXTO_GRANDE, "saldo negativo no resumo da folha (Display)"],
  ] as const;

  it("a tabela tem os 18 pares da UI-SPEC (P1..P16, P17a, P17b)", () => {
    expect(PARES.map(([par]) => par)).toEqual([
      ...Array.from({ length: 16 }, (_, indice) => `P${indice + 1}`),
      "P17a",
      "P17b",
    ]);
  });

  it.each(PARES)(
    "%s — --color-%s sobre --color-%s passa o mínimo de %s (%s)",
    (par, tokenDaFrente, tokenDoFundo, minimo) => {
      const frente = tokenDaPlataforma(tokenDaFrente);
      const fundo = tokenDaPlataforma(tokenDoFundo);
      const razao = razaoDeContraste(frente, fundo);
      expect(razao, `${par}: ${frente} sobre ${fundo} deu ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        minimo,
      );
    },
  );

  it("P17a só passa por ser texto grande — como texto normal reprovaria (o limite é real)", () => {
    const razao = razaoDeContraste(tokenDaPlataforma("atencao"), tokenDaPlataforma("superficie-2"));
    expect(razao).toBeLessThan(TEXTO_NORMAL);
  });
});

// Fase 06.1 (Produção), plano 09: os pares de cor que a fase usa, Q1 a Q12 e Q14 da tabela "Color →
// Pares de contraste" de `.planning/phases/06.1-producao/06.1-UI-SPEC.md`, cada um lido do
// `app/globals.css` real por `tokenDaPlataforma` — nenhum hex repetido aqui. Pares que o Estoque já
// prova entram de novo com o uso da Produção: o teste cobre o uso, não só o par. (Q13 é o bloco
// "contraste das pílulas de etapa", acima.) Achado real se reprovar: o token (ou o par que o
// componente usa) muda, nunca o limiar.
describe("contraste da Produção (06.1-UI-SPEC.md)", () => {
  const TEXTO_NORMAL = 4.5;
  const NAO_TEXTO = 3.0;
  const ETAPAS_COM_COR_PROPRIA = ["producao", "queima1", "esmaltacao", "queima2", "entrega"] as const;

  const PARES: readonly (readonly [string, string, string, number, string])[] = [
    // Margem quase nula — qualquer ajuste de paleta reprova aqui de propósito (Q1 = 4,51:1).
    ["Q1", "atencao", "atencao-fundo", TEXTO_NORMAL, "selo “+N dias nesta etapa”, caixa “Aguardando o sinal”, chip “Entrega parcial”"],
    // Margem curta (Q2 = 4,57:1).
    ["Q2", "sucesso", "sucesso-fundo", TEXTO_NORMAL, "selo “no ritmo”, selo “concluída”"],
    ["Q3", "erro", "erro-fundo", TEXTO_NORMAL, "selo “vai atrasar”, caixa “Faltam {n}…”"],
    ["Q4", "tinta-media", "superficie-2", TEXTO_NORMAL, "selo “aguardando o sinal”, chips neutros, nome da coluna"],
    ["Q5", "tinta-fraca", "superficie-2", TEXTO_NORMAL, "“—” de coluna vazia, contador da coluna"],
    ["Q6", "tinta-fraca", "superficie", TEXTO_NORMAL, "detalhe do cartão, legenda, cabeçalho de semana"],
    ["Q7", "acento", "superficie", TEXTO_NORMAL, "etapa atual na trilha, links, títulos da folha"],
    ["Q8", "erro", "superficie", TEXTO_NORMAL, "“vai atrasar” na coluna fixa, linha de hoje, “Cancelar ordem”"],
    ["Q9", "atencao", "superficie", TEXTO_NORMAL, "“gastou X kg a mais que o previsto”"],
    ...ETAPAS_COM_COR_PROPRIA.map(
      (etapa) =>
        ["Q10", etapa, "superficie", NAO_TEXTO, "segmento cheio e borda do listrado da linha do tempo"] as const,
    ),
    ...ETAPAS_COM_COR_PROPRIA.map(
      (etapa) => ["Q11", etapa, "superficie-2", NAO_TEXTO, "ponto de etapa no cabeçalho da coluna"] as const,
    ),
    ["Q12", "tinta-fraca", "superficie", NAO_TEXTO, "contorno de 1px da secagem (UI-D13) sobre o painel"],
    ["Q12", "tinta-fraca", "superficie-2", NAO_TEXTO, "contorno de 1px da secagem (UI-D13) sobre a coluna"],
    ["Q14", "tinta", "superficie", NAO_TEXTO, "traço da entrega prometida"],
  ];

  it("a tabela tem Q1..Q12 e Q14 (Q13 é o bloco das pílulas de etapa)", () => {
    expect([...new Set(PARES.map(([par]) => par))]).toEqual([
      ...Array.from({ length: 12 }, (_, indice) => `Q${indice + 1}`),
      "Q14",
    ]);
  });

  it.each(PARES)(
    "%s — --color-%s sobre --color-%s passa o mínimo de %s (%s)",
    (par, tokenDaFrente, tokenDoFundo, minimo) => {
      const frente = tokenDaPlataforma(tokenDaFrente);
      const fundo = tokenDaPlataforma(tokenDoFundo);
      const razao = razaoDeContraste(frente, fundo);
      expect(razao, `${par}: ${frente} sobre ${fundo} deu ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        minimo,
      );
    },
  );

  it("a secagem sem contorno continua reprovada como objeto gráfico — por isso o contorno de tinta-fraca (UI-D13)", () => {
    // Se um dia o token mudar e isto passar, o contorno pode sair; enquanto não, ele é obrigatório.
    const secagem = tokenDaPlataforma("secagem");
    expect(razaoDeContraste(secagem, tokenDaPlataforma("superficie"))).toBeLessThan(NAO_TEXTO);
    expect(razaoDeContraste(secagem, tokenDaPlataforma("superficie-2"))).toBeLessThan(NAO_TEXTO);
  });

  it("a linha do tempo desenha a secagem com o contorno de tinta-fraca e não repete hex", () => {
    const fonte = readFileSync(
      join(process.cwd(), "components/amassa/producao/linha-do-tempo.tsx"),
      "utf-8",
    );
    expect(fonte).toMatch(/"secagem"\s*\?\s*"var\(--color-tinta-fraca\)"/);
    expect(fonte).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });
});
