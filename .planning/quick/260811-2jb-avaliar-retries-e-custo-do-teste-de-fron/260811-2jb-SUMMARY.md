---
id: 260811-2jb
status: complete
date: 2026-08-11
---

# Quick 260811-2jb — Resumo

## O que foi feito

**Tarefa 2 (custo do teste de fronteira) — concluída e medida.**
`tests/e2e/queimas-cartao.spec.ts` deixou de dar dez toques reais em laço. Agora dá **dois**: as
duas TRAVESSIAS de fronteira (`ok → atenção` e `atenção → crítico`) continuam sendo cliques de
verdade, pela mesma Server Action `registrarQueima`; só o enchimento entre elas (oito queimas de
fundo, sobre as quais nenhuma asserção fala) entra pelo novo
`tests/e2e/apoio/semear-queimas.ts`, no mesmo padrão de `apoio/alternar-ativo.ts`.

As três asserções de nível continuam no arquivo, intactas: `ok` sem selo, "Manutenção próxima" e
"Manutenção vencida" com o ícone. Também caiu o `force: true` — ele existia porque dez toques
empilhavam dez toasts de 7s que podiam cobrir o botão; com dois toques separados por um
recarregamento não há pilha, e o clique voltou a ser um clique de verdade, com a checagem de
sobreposição do Playwright valendo.

Medição, na mesma varredura completa e sob a mesma carga:

| | antes (10 toques) | depois (2 toques) |
|---|---|---|
| `[desktop]` | **3.0m — FALHOU** (estourou o `setTimeout(180_000)`), passou só no retry #1 em 10.2s | **10.0s — passou de primeira** |
| `[celular]` | 22.8s | — (a corrida caiu antes, por causa abaixo) |
| idas e voltas de Server Action | 20 (10 × 2 projetos) | 4 (2 × 2 projetos) |

**Não foi possível declarar "um limite menor" como saída:** `medirForno` recusa `limite < 10`
(`lib/queimas/contador.ts`) e `limiarDeAtencao(10)` é `Math.max(1, 0) = 1`. Dez é o menor limite
que existe, e chegar ao crítico por toques reais custava dez registros. Por isso a redução veio de
"menos toques", não de "limite menor".

**Tarefa 1 (retries) — removidos, mas a estabilidade NÃO pôde ser comprovada.**
`retries: 2` saiu dos dois arquivos. `mode: "serial"` ficou só em `queimas-registro.spec.ts`
(dois testes); em `queimas-cartao.spec.ts` o `test.describe.configure` saiu inteiro, porque com um
único teste no arquivo `mode: "serial"` é decorativo.

A pergunta "as retentativas são necessárias?" **não tem resposta empírica limpa neste momento**,
porque a suíte completa não fecha verde por motivos que nada têm a ver com estes dois arquivos.

## O que a investigação encontrou (tudo FORA do escopo declarado, nada corrigido)

Sete varreduras completas. A causa que o plano 04-02 registrou — "lentidão transitória do
servidor compartilhado" — está errada em dois pontos: o número de workers não é 4, e o servidor
não fica lento, ele **morre**.

**1. `next start` roda numa combinação que o próprio Next declara não suportada.**
`next.config.ts` usa `output: "standalone"`; `playwright.config.ts:92` sobe o servidor local com
`npm run build && npm run start` (= `next start`). O Next avisa em toda execução:

> `⚠ "next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.`

O comentário do próprio `playwright.config.ts` (linhas 14-16) já reconhece essa incompatibilidade
— mas só para explicar por que o CI **não** usa o `command`. Localmente ele continua sendo usado.
Em 3 das 7 varreduras o servidor caiu no meio e tudo depois virou
`net::ERR_CONNECTION_REFUSED at http://localhost:3000` — 46, 46 e 299 testes derrubados em
cascata. Retentativa em duas specs não protege contra isso.

**2. São 8 workers, não 4.** `Running 303 tests using 8 workers` — a máquina tem 16 núcleos e o
padrão do Playwright é `núcleos / 2`. Com 15.8 GB de RAM (4.4 GB livres em repouso), 8 Chromium +
a VM do Docker + Postgres + o servidor Next disputam memória. `playwright.config.ts` não limita
`workers`.

**3. `tests/e2e/apoio/preparar-usuario.ts` não é idempotente e sofre corrida.** Reproduzido
diretamente: banco de teste fresco, `usuarios` em 0 antes de `npx playwright test`, **1** depois —
e mesmo assim o `globalSetup` falhou. Ou seja, `criar-usuario` roda mais de uma vez na mesma
execução. Falha das duas formas, alternando:

- `Já existe uma conta com o e-mail gestora.teste@exemplo.test.` (a segunda execução vê a primeira)
- `DrizzleQueryError` na `insert into "usuarios"` (as duas executam concorrentes e batem no índice único)

Qualquer um dos dois mata a corrida inteira no `globalSetup`, antes do primeiro teste. Aconteceu
em 4 das 7 varreduras. **Isto é o candidato mais forte à "instabilidade" que o plano 04-02 tentou
resolver com retentativa** — e retentativa de spec nunca poderia consertar, porque a falha é
anterior a qualquer spec.

**4. Duas falhas vermelhas pré-existentes, presentes já em `HEAD` sem nenhuma mudança minha:**

- `tests/e2e/casca.spec.ts:214` — afirma o estado vazio de Fornos ("Nenhum forno cadastrado
  ainda.", botão "Novo forno") sem etiqueta `@vazio-global`, então roda em paralelo com as specs
  de Fornos que criam fornos. É exatamente a "premissa falsa" que o comentário do
  `playwright.config.ts` (linhas 42-59) documenta — a mesma armadilha, num módulo novo.
- `tests/e2e/autenticacao.spec.ts:72` — o teste de bloqueio por tentativas estoura
  `page.waitForResponse` em 60s.

## Estado do `HEAD` medido (varredura de referência, com os retries ainda presentes)

`5 failed, 2 flaky, 21 skipped, 271 passed`. Os 2 flaky passaram **só no retry**:
`queimas-cartao.spec.ts` (desktop) e `queimas-registro.spec.ts:84` (celular). E
`queimas-registro.spec.ts:84` no desktop **falhou mesmo com 2 retentativas**. Ou seja: no estado
anterior a este plano, a retentativa já não estava dando conta — estava só escondendo.

## Comandos efetivamente rodados (regra de orçamento do CLAUDE.md)

`npm run test:e2e` é caro; esta tarefa É o diagnóstico, então a exceção do CLAUDE.md se aplica.
Registro honesto:

| # | comando | resultado |
|---|---|---|
| 1 | `npm run test:e2e` (retries removidos, teste de 10 toques ainda inteiro) | 46 failed, 64 did not run — servidor morreu |
| 2 | `npm run test:e2e` (em `HEAD`, via `git stash`) — **linha de base** | 5 failed, 2 flaky, 271 passed |
| 3 | `npm run test:e2e` (as duas mudanças) | morreu no `db:migrate` — `ECONNREFUSED` na 5434 |
| 4 | `npm run test:e2e` (as duas mudanças) | 46 failed, 63 did not run — servidor morreu; **`queimas-cartao` desktop passou em 10.0s** |
| 5 | `npm run test:e2e -- --workers=4` | morreu no `globalSetup` — "Já existe" |
| 6 | `npm run test:e2e -- --workers=4` | 4 failed, 299 did not run — servidor morreu no `vazio-celular` |
| 7 | `npm run test:e2e -- --grep "cartão do forno"` (×3) | morreu no `globalSetup` nas três |
| 8 | `npx playwright test --grep "cartão do forno"` direto, com banco controlado à mão | provou a corrida do `globalSetup` (0 → 1 usuário + falha) |

Rápidos, rodados à vontade: `npm run lint` ✓, `npx tsc --noEmit` ✓, `npm test` ✓ (358 testes).
`npm run test:migracoes` **não** foi rodado — nada aqui toca `db/schema.ts`.

## Adendo — o dono aprovou corrigir só o item 3 (corrida do globalSetup)

`tests/e2e/apoio/preparar-usuario.ts` agora **garante** a conta em vez de só criá-la:

1. `pg_advisory_lock` do Postgres em volta de "conferir e então gravar" — a trava é do banco, não
   do processo, então serializa mesmo entre processos diferentes.
2. Dentro da trava, cria OU redefine. `redefinir-senha` imprime a senha nova na mesma linha
   `SENHA: ...`; o comentário daquele script já dizia que ele existe para ser consumido aqui.

Diagnóstico temporário (`pid` + instante) confirmou que numa corrida **saudável** o globalSetup
roda **uma vez só** — a execução dupla é consequência das corridas que morrem no meio, não um
comportamento constante do Playwright 1.62. A trava cobre os dois casos.

### Resultado, varredura completa antes × depois

| | `HEAD` (retries LIGADOS) | agora (retries desligados, teste leve, globalSetup corrigido) |
|---|---|---|
| failed | 5 | 5 |
| **flaky** | **2** | **0** |
| passed | 271 | **273** |
| `queimas-cartao` | desktop **3.0m FALHOU** + retry; celular 22.8s | desktop **9.2s ok**, celular **24.0s ok**, sem retentativa |

As 5 falhas restantes são todas conhecidas e nenhuma é destes dois arquivos:

- `autenticacao.spec.ts:72` (×2) — já estava em Blockers/Concerns do STATE.md
- `casca.spec.ts:214` (×2) — premissa falsa sem `@vazio-global`; o dono optou por não corrigir agora
- `queimas-registro.spec.ts:84` (celular) — `element is not stable` ao clicar em "Desfazer"
  dentro de um toast do `sonner` ainda em animação. Defeito real e próprio do teste; a
  retentativa nunca o consertou (em `HEAD` ele falhava no desktop **mesmo com 2 retentativas**).

**A pergunta 1 agora tem resposta:** para `queimas-cartao.spec.ts`, `mode: "serial"` sozinho não
só bastava como era desnecessário — o arquivo tem um teste só e passa limpo nos dois projetos sem
rede nenhuma. Para `queimas-registro.spec.ts`, `mode: "serial"` fica, sem `retries`: o que sobra
ali é um defeito de verdade, e agora ele aparece em vez de ser escondido.

## Recomendação

As retentativas locais foram removidas e devem continuar removidas: elas mascaram, não consertam,
e as evidências acima mostram que o que precisava de mascaramento não era o comportamento da
aplicação. Mas a suíte só volta a ser um sinal confiável depois dos itens 1, 2 e 3 — nenhum deles
está nestes dois arquivos, e todos envolvem decisão do dono (trade-off de tempo de suíte, e mudar
como o servidor local sobe). Ficaram por fazer de propósito.
