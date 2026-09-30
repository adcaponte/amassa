import { defineConfig, devices } from "@playwright/test";

// Localmente, sobe a build real (nunca o modo dev): é na build que as variáveis
// NEXT_PUBLIC_* são embutidas, e testar contra `next dev` esconderia exatamente a classe de
// falha que a Fase 1 existe para prevenir. `DATABASE_URL` do processo do servidor vem de
// `DATABASE_URL_TESTE` — nunca do banco real (D-09).
//
// No job `e2e` do workflow (plano 01-05), quem sobe o servidor não é este arquivo: o
// workflow constrói a MESMA imagem Docker que o job `imagem` publica (alvo `app`, saída
// `standalone`) e já a deixa respondendo em http://127.0.0.1:3000 antes de rodar
// `npx playwright test` diretamente. `reuseExistingServer: true` é o que permite os dois
// mundos convivirem no mesmo arquivo: se já existe um servidor respondendo na `url` (o
// contêiner, em CI), o Playwright reaproveita e nunca chega a executar o `command` abaixo;
// se não existe (uso local), ele sobe via `next build && next start`. Isso importa porque
// "next start" não é compatível com `output: "standalone"` — testar via `command` em CI
// estaria validando um processo diferente do que sobe em produção.
//
// Dois projetos porque o sistema é usado em pé, no ateliê, numa tela de celular — testar só
// no desktop não mede o que importa (Core Value, PROJECT.md). Ambos usam Chromium (só um
// motor instalado); o de celular usa o preset "Pixel 7" para viewport, toque e user agent
// de um Android real, sem precisar do motor WebKit.
export default defineConfig({
  testDir: "./tests/e2e",
  // Cria a conta de gestor rodando o próprio scripts/criar-usuario.ts contra o banco de
  // teste, e publica e-mail/senha em variáveis de ambiente para as specs (AUTH-07 de
  // verdade, ver tests/e2e/apoio/preparar-usuario.ts).
  globalSetup: "./tests/e2e/apoio/preparar-usuario.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    // "localhost", não "127.0.0.1": o `NextURL` interno do Next.js normaliza QUALQUER
    // hostname 127.x.x.x para o literal "localhost" ao montar URLs (inclusive o redirect do
    // middleware para /login). Testar com "127.0.0.1" faria o redirect de autenticação
    // trocar de origem no meio do fluxo (127.0.0.1 → localhost) — origens diferentes não
    // compartilham cookie de sessão, o que quebraria login de verdade sem ser um bug da
    // aplicação. Não é o AUTH_TRUST_HOST: é puramente esse detalhe de teste local.
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  // Quatro testes afirmam uma condição GLOBAL do banco ("nenhuma encomenda existe", "nenhuma
  // concluída existe"). Com `fullyParallel: true` e mais de um worker, outro arquivo de spec cria
  // encomendas ao mesmo tempo e a premissa deixa de valer — não é instabilidade de ambiente, é uma
  // afirmação global disputada por escritas concorrentes. Eles passavam só quando rodados isolados
  // por `--grep`, o que mascarou o problema durante a Fase 3 e barrou o primeiro deploy dela.
  //
  // A correção é ordem explícita, via `dependencies`: o Playwright roda um projeto de dependência
  // até o fim antes de iniciar quem depende dele. A cadeia é
  //
  //   vazio-celular → vazio-desktop → vazio-historico → { desktop, celular }
  //
  // Os dois primeiros rodam os testes `@vazio-global` (só leitura, banco intacto) um viewport de
  // cada vez — em paralelo eles não se atrapalhariam, mas `vazio-historico` CRIA uma encomenda,
  // então precisa vir depois dos dois. Só então `desktop` e `celular` rodam todo o resto em
  // paralelo, com `grepInvert` para não repetir os quatro.
  //
  // Custo: alguns segundos de login a mais por etapa da cadeia. O que se compra é a prova de
  // ENC-13 (o estado vazio "A roda ainda não gira.") rodando na suíte completa, não só sob grep.
  //
  // (30/09/2026, plano 06.1-14: os specs de Encomendas saíram com o módulo, e com eles os quatro
  // testes citados acima. A cadeia continua pelo mesmo motivo, com os `@vazio-global` que ficaram —
  // Início, Produção, Estoque, Queimas… — e os `@vazio-historico` do Estoque e da perda medida da
  // Produção.)
  projects: [
    {
      name: "vazio-celular",
      use: { ...devices["Pixel 7"] },
      grep: /@vazio-global/,
    },
    {
      name: "vazio-desktop",
      use: { ...devices["Desktop Chrome"] },
      grep: /@vazio-global/,
      dependencies: ["vazio-celular"],
    },
    {
      name: "vazio-historico",
      use: { ...devices["Desktop Chrome"] },
      grep: /@vazio-historico/,
      dependencies: ["vazio-desktop"],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: [/@vazio-(global|historico)/, /@parametro-global/],
      dependencies: ["vazio-historico"],
    },
    {
      name: "celular",
      use: { ...devices["Pixel 7"] },
      grepInvert: [/@vazio-(global|historico)/, /@parametro-global/],
      dependencies: ["vazio-historico"],
    },
    // A SEGUNDA cadeia, e o motivo dela (WINDOWS #53, 2026-09-27).
    //
    // Três arquivos de spec sobem PARÂMETROS GLOBAIS de precificação para provar o próprio
    // comportamento: `orcamentos-revisao` (preco_folga_negociacao/preco_imposto_sobre_venda),
    // `orcamentos-ciclo` (forno_desgaste_por_fornada/forno_tarifa_energia) e
    // `precificacao-parametros` (material_argila/material_esmalte/trabalho_hora). Eles restauram
    // no `afterAll`, mas `parametros_precificacao` é um CATÁLOGO FIXO GLOBAL — não há chave
    // própria por spec a isolar. Enquanto o parâmetro está elevado, qualquer arquivo que leia
    // custo/mínimo/selo vê um número que não é o da semente: `precificacao-ficha`,
    // `precificacao-pecas`, `orcamentos-editor`, `orcamentos-total`.
    //
    // Com `fullyParallel` e 8 workers, o `afterAll` do mutador corre contra a leitura do outro
    // arquivo NOUTRO worker. Isso não é instabilidade de ambiente — é a mesma premissa falsa que
    // o comentário acima descreve para o estado vazio, e o CLAUDE.md manda resolver do mesmo
    // jeito: ordem explícita por `dependencies`, nunca `--grep` como muleta.
    //
    // Duas escolhas que não são óbvias:
    //
    // 1. Os mutadores rodam por ÚLTIMO, não primeiro. Mutadores-primeiro só seria seguro se a
    //    restauração fosse garantida, e ela não é: o `update ... where chave = $1 and
    //    vigente_desde = hoje_brasilia()` afeta ZERO linhas em silêncio se a data não casar — a
    //    mesma classe de defeito da WINDOWS #44. Por último, um `afterAll` que falha em silêncio
    //    não entrega um banco sujo a mais ninguém.
    //
    // 2. `workers: 1` em cada um, porque os três mutadores disputam entre SI, não só com as
    //    vítimas: o mínimo depende de TODOS os parâmetros (lib/precificacao/calculo.ts), então
    //    chave dedicada protege a chave, nunca o número derivado. `fullyParallel: false` por
    //    projeto NÃO resolveria — serializa os testes dentro de um arquivo, não os arquivos entre
    //    si. É o uso que a própria documentação do Playwright dá a `testProject.workers`.
    //
    // 🔴 DOIS CUSTOS REAIS DESTA CADEIA, medidos em 2026-09-27. Leia antes de usar `--grep`.
    //
    // 1. **`--grep` que atinja um destes três arquivos passa a custar a SUÍTE INTEIRA.** O
    //    Playwright roda projeto de dependência por completo e NÃO aplica o `--grep` nele — então
    //    pedir um teste só de `precificacao-parametros` arrasta `desktop` e `celular` junto.
    //    Medido: 9,5 e 9,7 minutos, para um teste que sozinho leva 19 segundos. Isso contraria a
    //    economia de `--grep` que o CLAUDE.md impõe, e é consequência direta de "rodar depois de".
    //    **Localmente, use `--no-deps` nestes três arquivos** — com a ressalva do parágrafo abaixo.
    //    Em CI nada muda: lá a varredura roda inteira de qualquer jeito.
    //
    // 2. **Se `desktop`/`celular` falharem, estes dois nem rodam** ("did not run"). Um defeito
    //    antigo lá em cima esconde tudo aqui embaixo — foi o que aconteceu com a WINDOWS #3 na
    //    primeira tentativa de validar esta própria mudança.
    //
    // ⚠️ `--no-deps` é a saída para iterar, NUNCA para validar: ele desliga exatamente a
    // serialização que estes projetos existem para garantir, e aí `parametros-desktop` e
    // `parametros-celular` voltam a rodar ao mesmo tempo, um poluindo o outro. Comprovado: com
    // `--no-deps` o mínimo de uma peça saltou de R$ 157,35 para R$ 3.144,97 no meio do teste.
    // Para VALIDAR, rode a varredura completa, sem `--grep` e sem `--no-deps`.
    {
      name: "parametros-desktop",
      use: { ...devices["Desktop Chrome"] },
      grep: /@parametro-global/,
      dependencies: ["desktop", "celular"],
      workers: 1,
    },
    {
      name: "parametros-celular",
      use: { ...devices["Pixel 7"] },
      grep: /@parametro-global/,
      dependencies: ["parametros-desktop"],
      workers: 1,
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    // `/api/health`, NÃO a raiz. A sonda de prontidão do Playwright só considera o servidor
    // pronto com status `>= 200 && < 404` (`isURLAvailable`, em
    // `playwright-core/lib/coreBundle.js`) — um 404 mantém a sonda tentando até o timeout.
    // Enquanto a plataforma respondia na raiz, sondar `/` funcionava por acidente: o
    // middleware devolvia 302 para `/login`. Depois da Fase 04.6 (plano 01) a raiz não tem
    // `app/page.tsx` até o site público existir (plano 03), então `/` devolve 404 e a suíte
    // inteira morria em 180s de `webServer` — 5 tentativas idênticas no plano 04.6-01,
    // diagnosticadas na época, por engano, como problema desta máquina.
    // `/api/health` é a URL mais estável do sistema por decisão de projeto: está em
    // `ROTAS_PUBLICAS`, fica FORA de `/gestao` (é onde o monitoramento externo aponta), e
    // devolve 200 só depois de uma consulta real ao banco — que é exatamente o que
    // "servidor pronto" precisa significar aqui, já que o `globalSetup` cria a conta de
    // gestor no banco antes do primeiro teste.
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TESTE ?? "",
      // Valor de teste explicitamente descartável, no mesmo espírito da senha efêmera de
      // docker/compose.teste.yml — nunca o AUTH_SECRET real.
      AUTH_SECRET: "segredo-de-teste-efemero-sem-valor-real",
      // Obrigatório atrás de proxy reverso (Caddy) — sem ela o Auth.js ignora
      // X-Forwarded-* e monta URLs de callback erradas (01-ARQUITETURA.md §6). Exercitada
      // aqui para não descobrir a falta só em produção.
      AUTH_TRUST_HOST: "true",
    },
  },
});
