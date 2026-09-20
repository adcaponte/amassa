---
quick_id: 260920-jxb
status: ready
---

# Quick Task 260920-jxb: Timeout do pool de conexão + teste e2e de bloqueio mais leve

Aplica as duas mudanças aprovadas pelo dono em 2026-09-20, no checkpoint do
`.planning/debug/auth-bloqueio-timeout-e2e.md` (commit `a129fb4`): (A) limitar
`connectionTimeoutMillis` no pool do `pg` e (B) reduzir de 6 para 1 as idas e vindas
reais pela UI no teste de bloqueio de login, semeando as cinco primeiras tentativas por
um caminho de servidor real (não hand-rolled).

## Contexto herdado do debug

- Hipótese original (custo do argon2id × 6 tentativas) foi MEDIDA e REFUTADA: 25-150ms
  por tentativa, ordens de grandeza abaixo do teto de 120s.
- Hipótese líder, não confirmada por reprodução direta: `db/index.ts` não define
  `connectionTimeoutMillis` (padrão do `pg-pool`: `0` = espera infinita) por uma conexão
  livre do pool, sob contenção real do runner de CI (4 vCPUs compartilhadas).
- `WINDOWS.md` #3 (02b, aberto desde 2026-08-08) e #24 (04.2, fechado como "fixed" sem
  mudança de código real — confirmado lendo 04.2-05-SUMMARY.md).
- Nenhuma das duas falhas de CI de hoje foi causada de fato por `autenticacao.spec.ts`
  (ver Evidence do debug) — mas o defeito estrutural é real e de longa data, e o dono
  pediu a correção mesmo assim.

## Tarefa 1 — `connectionTimeoutMillis` no pool (db/index.ts)

**Tipo:** auto

**Arquivos:** `db/index.ts`, `tests/unit/pool-conexao.test.ts` (novo)

**Ação:**

1. Adicionar `connectionTimeoutMillis: 5_000` ao `new Pool({...})` em `db/index.ts`, com
   comentário explicando a escolha (evidência, não gosto pessoal):
   - Custo real por consulta de login medido no debug: 1-43ms mesmo sob carga da suíte
     completa (2 workers).
   - A retentativa de CI que absorveu a falha de hoje levou 1.9s.
   - 5s dá ~2,5× de folga sobre o pior caso real observado, falha rápido o bastante para
     nunca mais "travar até o teto" (o padrão binário rápido-ou-trava-no-teto do debug),
     e ainda é curto o bastante para caber com folga dentro de qualquer timeout de teste
     ou requisição de usuário.
   - NÃO mexer em `max` (continua o padrão do `pg-pool`, 10), nem em nenhum parâmetro de
     argon2, nem no limite/janela de AUTH-04.
2. Verificar (leitura de código, sem mudança) e documentar no SUMMARY qual caminho um
   erro de timeout de pool percorre a partir de `authorize()` em `lib/auth/auth.ts`:
   `db.select()` lança → `@auth/core` embrulha em `CallbackRouteError` (subclasse de
   `AuthError`, não `CredentialsSignin`) → `entrar()` em `lib/auth/acoes.ts` captura via
   `if (erro instanceof AuthError) redirect("/login?erro=credenciais")` → a MESMA
   mensagem humana de credenciais inválidas aparece, nunca uma stack crua nem
   `app/(app)/error.tsx` / `app/error.tsx`.
3. Criar `tests/unit/pool-conexao.test.ts`: importa o `pool` exportado de `@/db` e
   afirma que `pool.options.connectionTimeoutMillis` é um número finito maior que zero
   (não `0`/`undefined`, que é o padrão perigoso do `pg-pool`). Não abre conexão real
   (construir um `Pool` não conecta) — roda dentro de `npm test`, sem precisar de
   `DATABASE_URL_TESTE`.

**Verificação:** `npm test`, `npx tsc --noEmit`, `npm run lint`.

**Feito quando:** `connectionTimeoutMillis` está definido e testado; `max` e os
parâmetros de AUTH-04/argon2 continuam intocados; o caminho de falha documentado no
SUMMARY.

## Tarefa 2 — Semear as cinco primeiras tentativas pelo caminho real de servidor

**Tipo:** auto

**Arquivos:** `tests/e2e/autenticacao.spec.ts`

**Ação:**

1. As cinco primeiras tentativas do teste "a sexta tentativa..." passam a ser
   disparadas via `page.request` contra a própria rota REST do Auth.js
   (`app/api/auth/[...nextauth]/route.ts`, já exposta e usada em produção) — NÃO um
   INSERT em tabela (o contador de tentativas é em memória, `lib/auth/tentativas-memoria.ts`,
   sem tabela nenhuma) e NÃO uma chamada direta à função interna (o processo do
   Playwright não é o processo do servidor):
   - `GET /api/auth/csrf` uma vez → captura `csrfToken` (protocolo padrão do Auth.js,
     dança de cookie de "duplo envio", a mesma exigida de qualquer cliente HTTP).
   - Cinco `POST /api/auth/callback/credentials` com `{ email, senha, csrfToken }`
     (form-urlencoded) — é o MESMO `authorize()` de `lib/auth/auth.ts` que a Server
     Action usa, chamado pela rota HTTP real do próprio Auth.js, não uma rota inventada
     para o teste.
   - `page.request` compartilha cookies com o `page` da mesma `BrowserContext`, então o
     cookie de CSRF/sessão fica coerente entre a semeadura e a sexta tentativa real.
2. A sexta tentativa continua exatamente como está: `page.goto`, preencher e-mail/senha,
   clicar "Entrar" pela UI de verdade, esperar a resposta do POST, e afirmar que o
   alerta mostra a mensagem de bloqueio com "minuto" — essa prova não muda.
3. Atualizar os comentários do arquivo (topo do describe e do teste) para refletir a
   nova mecânica e o resultado desta investigação (hipótese do argon2 refutada; causa
   líder era o pool sem limite, corrigido na Tarefa 1) — sem reescrever a explicação do
   `mode: "serial"` nem do sufixo de e-mail por `testInfo.retry` (continuam válidas).
   Reavaliar `testInfo.setTimeout(120_000)`: com só 1 ida real pela UI (antes eram 6),
   um valor bem menor já cobre folga generosa — ajustar e justificar o novo número no
   comentário.

**Verificação (par RED/GREEND, honesto):**
1. RED: editar temporariamente `LIMITE_DE_ERROS` em `lib/auth/tentativas.ts` (ex.: para
   `99`) e rodar `npm run test:e2e -- --grep "autenticação"` — o teste da sexta
   tentativa DEVE falhar (a mensagem de bloqueio não aparece mais na sexta).
2. Reverter o valor de `LIMITE_DE_ERROS` para `5`.
3. GREEN: rodar `npm run test:e2e -- --grep "autenticação"` de novo — todos os quatro
   testes do describe devem passar, incluindo a prova real da mensagem com minutos na
   UI.
4. Registrar os dois comandos e os dois resultados no SUMMARY.

**Feito quando:** o teste ainda prova a mensagem de bloqueio real na UI; AUTH-04 não foi
enfraquecida (limite, janela, e conferência real de hash continuam os mesmos em todos os
6 erros); RED e GREEN documentados.

## Tarefa 3 — Ledger e requisitos

**Tipo:** auto

**Arquivos:** `.planning/WINDOWS.md` (via `gsd-tools windows`), SUMMARY.md

**Ação:**

1. `gsd-tools windows fixed 3` — a causa real foi diagnosticada e corrigida nesta tarefa
   (a menos que a Tarefa 1 ou 2 não consiga fechar o ciclo RED/GREEN — nesse caso não
   marcar como fixed e explicar no SUMMARY).
2. `gsd-tools windows append` com um registro novo, kind `deviation`, referenciando que
   #24 foi marcado "fixed" em 04.2 sem mudança de código real (nenhum arquivo relacionado
   tocado naquele plano) — a correção de fato é esta quick task — e então
   `gsd-tools windows fixed <novo-id>` no mesmo registro, já que o código corrigido está
   nesta mesma sessão.
3. Nenhuma mudança em REQUIREMENTS.md — AUTH-03/AUTH-04 continuam "Complete", sem
   alteração de comportamento de produção.

**Feito quando:** #3 fechado (ou justificativa registrada), correção de #24 documentada
no ledger.

## Verificação geral

`npm run verificar` (lint, tsc, verificar-acoes, testes unitários, test:migracoes) deve
passar ao final. `npm run test:e2e -- --grep "autenticação"` conforme o par RED/GREEN da
Tarefa 2 (duas invocações, dentro do orçamento de uma invocação por tarefa). Nenhum
`git push`.
