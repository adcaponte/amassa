---
phase: 06-estoque
fixed_at: 2026-09-29T08:49:09Z
review_path: .planning/phases/06-estoque/06-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-09-29T08:49:09Z
**Source review:** `.planning/phases/06-estoque/06-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (0 bloqueios, 5 avisos; o escopo é `critical_warning`)
- Fixed: 4. WR-01 foi corrigido só na documentação e a regra não mudou; WR-03, WR-04 e WR-05 foram
  corrigidos de fato.
- Skipped: 1. WR-02 não mudou no código; ficou documentado para o dono.

Isto rodou sob os limites da sessão noturna de 29/09. Nenhuma regra de dinheiro, saldo ou
cancelamento foi decidida aqui. Não houve `git push` nem merge em `main`. Servidor, `.env` e
migração ficaram intocados, e também `db/migrations/0023_estoque.sql` e `.github/workflows/`.
Tudo foi commitado no branch `gsd/phase-06-estoque`.

## Fixed Issues

### WR-01: D-23 não é o que o código faz quando o estoque está ≤ 0 no cancelamento

**Status:** corrigido só na documentação. **A regra continua a mesma e depende do dono.**
**Files modified:** `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md`, `tests/unit/estoque-custo.test.ts`, `lib/estoque/custo.ts` (só comentário)
**Commit:** c99d9c9
**Applied fix:**
- **Parte 0 §0.1** ganhou um bloco logo depois de D-23. Ele usa os números do revisor: última compra
  a R$ 10,00/un, venda A de 2 un, compra de 5 un por R$ 250,00, venda B de 4 un e depois o
  cancelamento de A. O bloco mostra o que o código faz hoje: o estorno grava +R$ 60,00 e a unidade
  que sobrou vale R$ 10,00, porque a prateleira foi reprecificada ao custo da venda antiga. Mostra
  também a alternativa do revisor: com Q ≤ 0, o estorno entra ao custo médio do instante, no estilo
  da R6, e a unidade continua valendo R$ 50,00. O texto dá a consequência de cada opção para o valor
  em estoque. Explica ainda por que nenhuma das duas consegue gravar os R$ 20,00 exatos: a unidade
  ficaria valendo −R$ 30,00. Há uma caixa desmarcada para o dono escolher.
- Um teste no bloco "D-23/D-24" fixa o comportamento de hoje. O nome dele é "comportamento atual — a
  confirmar pelo dono (WR-01): …". Ele confere +6000 no estorno, o estado (1000, 1000), R$ 10,00/un
  e que o estorno passa a ser a última entrada com preço.
- O comentário de `movimentoDoEstorno` foi corrigido. Agora ele diz que o valor gravado só é igual ao
  da venda com saldo positivo (R2). Com saldo zero ou negativo, R1, R3 e R4 decidem o valor. O
  "Para onde foi" zera por causa de `contaComoConsumo` (`lib/estoque/historico.ts`), e não por causa
  desta função.

### WR-03: O custo da primeira contagem era digitado para a diferença da página e aplicado à diferença do servidor

**Files modified:** `lib/estoque/esquemas.ts`, `lib/estoque/contagem.ts`, `lib/estoque/gravacao.ts`, `lib/estoque/acoes.ts`, `lib/estoque/textos.ts`, `components/amassa/estoque/linha-contagem.tsx`, `tests/unit/estoque-contagem.test.ts`, `tests/e2e/estoque-contagem.spec.ts`
**Commit:** 68bacb0
**Applied fix:**
- `esquemaConfirmarContagem` passa a exigir `saldoEsperadoMilesimos`, um inteiro com o saldo contra o
  qual a tela calculou a dica do custo. Se ele faltar ou for inválido, a frase é "Esta tela da
  contagem está desatualizada. Recarregue a página e confirme de novo." O valor não decide nada:
  modo e diferença continuam sendo do servidor (T-06-45).
- Nova função pura `conferirSaldoDoCusto` em `lib/estoque/contagem.ts`. Quando o plano é `entrada`
  (o único que leva o custo digitado) e o saldo sob a trava é diferente do esperado, ela devolve
  "O saldo mudou de {X} para {Y} {un} enquanto você contava — confira o custo e confirme de novo."
  Diferença zero e ajuste continuam como antes.
- `gravarContagem` chama essa conferência depois de `planejarContagem`. Se recusar, devolve a frase
  e o saldo novo. A ação passa a `unidade` do item travado. A classe `CustoDaContagemFaltando` virou
  `RecusaDaContagem`, porque agora cobre as duas recusas; o campo continua `custou`. A linha manda
  `saldoEsperadoMilesimos: saldo` e, como já fazia na recusa, adota o saldo devolvido. Com isso a
  dica "o que você pagou por N un" se refaz com a diferença nova.
- Testes: 3 unitários para `conferirSaldoDoCusto`, 1 para o esquema recusando saldo ausente ou
  inválido, e os casos existentes do esquema com o campo novo. O e2e ganhou o caso **(f)**. Com a
  contagem aberta, outra aba vende 1 un. A confirmação é recusada com a frase, a dica passa de
  "10 un" para "11 un", e só a venda fica gravada. Ao confirmar de novo, grava a entrada de 11 un
  por R$ 100,00.

### WR-04: Roteiro 15, Passo 9, Caso B: fazer o merge do branch de novo não traz o código de volta

**Files modified:** `docs/operacao/15-migracao-estoque.md`, `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md` (caixa do Passo 4)
**Commit:** 9460e8f
**Applied fix:**
- **WR-04:** novo sub-passo "Caso B, depois — voltar com o código". Ele avisa em destaque que rodar
  o Passo 6 de novo não funciona depois do Caso B (`Already up to date`) e explica por quê. Depois
  vem a sequência: `git revert <hash do commit "Revert "Merge branch 'gsd/phase-06-estoque'"">`, as
  correções que houver (um `merge --no-ff` do branch da fase traz só os commits novos), `git push`,
  `gh run list`, a conferência do Passo 7 e a contagem no celular. O sub-passo também diz quando a
  proibição de `db:generate` termina.
- **IN-02 (aprovado pelo orquestrador, no mesmo documento):** o Passo 4 agora roda
  `docker compose run --rm ferramentas ls db/migrations | grep 0023_estoque` antes do `db:migrate`.
  O texto diz: "deve aparecer `0023_estoque.sql`. Nada? Pare aqui". Na caminhada, a caixa do Passo 4
  pede esse registro.
- **IN-04 (aprovado pelo orquestrador, no mesmo documento):** no quadro 🔴 do topo, um aviso para
  não usar "Run workflow" nem `gh workflow run` com `gsd/phase-06-estoque` antes do Passo 6.
  `.github/workflows/` não foi alterado.

### WR-05: Desativar/reativar no diálogo do Catálogo sem try/finally

**Files modified:** `components/amassa/cadastros/dialogo-item-catalogo.tsx`
**Commit:** f9216d1
**Applied fix:** `desativar()` e `reativar()` agora usam try/catch/finally, como o revisor
sugeriu. No `finally`, `setAlternandoAtivo(false)` sempre roda. No `catch`, o erro vai para o log e
aparece `FRASE_FALHA_AO_SALVAR` ("Não deu para salvar. Verifique a internet e tente de novo."). Na
desativação a frase fica dentro da confirmação; na reativação, no erro do diálogo.

## Skipped Issues

### WR-02: O estorno conta como "última entrada com preço", que decide a D-26 e o custo médio mostrado

**File:** `lib/estoque/gravacao.ts:143-169`, `lib/estoque/consultas.ts:114-122`, `lib/estoque/custo.ts:138-141`
**Reason:** o código ficou como está por ordem do orquestrador. Tirar o estorno da "última entrada
com preço" muda a valoração da D-26, e `06-RESEARCH.md` §Pergunta 3 define o estorno de venda como
uma entrada com preço. Isso é regra de dinheiro que o dono ainda não decidiu. **A questão está
documentada para ele** (commit 7c2612f):
- Parte 0 §0.1 de `06-VERIFICACAO-HUMANA.md`, logo depois do bloco do WR-01 e no mesmo formato. O
  bloco descreve o comportamento de hoje, com as duas consequências. A primeira: com a prateleira
  vazia, a baixa sai pelo custo da venda cancelada (R$ 10,00), e não pelo da última compra
  (R$ 50,00). A segunda: um material que nunca foi comprado passa a mostrar **"R$ 0,00/un"** onde a
  tela promete "—". O bloco traz também a opção do revisor (o estorno não conta), os três lugares
  que andam juntos e uma caixa desmarcada. (O revisor citou `lerSaldos`, mas a função real é
  `listarSaldos`, em `lib/estoque/consultas.ts`. O documento usa o nome real.)
- Dois testes fixam o comportamento de hoje. Os dois se chamam "comportamento atual — a confirmar
  pelo dono (WR-02): …": um para a baixa com prateleira vazia a R$ 10,00, outro para
  `custoMedioParaExibir(...) === 0`, e não `null`, depois de cancelar uma venda de custo zero.
**Original issue:** a última entrada com preço é a última linha com `tipo = 'entrada'`, e um estorno
de venda é uma dessas linhas. Por isso uma venda cancelada redefine a D-26, e "R$ 0,00" aparece onde
a tela promete "—".

## Verificação — onde e o quê

**Onde rodou:** tudo no **checkout principal** (`C:/Users/Andre/amassa`), no branch
`gsd/phase-06-estoque`. `workflow.use_worktrees` está em `false` em `.planning/config.json`, então
não foi criado worktree nem branch temporário, e não há sentinela. Os números podem ser repetidos a
partir deste checkout.

Comandos que de fato rodaram:
- Por correção: `npx vitest run tests/unit/estoque-custo.test.ts` (WR-01 e WR-02: 22 e depois 24
  testes passando), `npx vitest run tests/unit/estoque-contagem.test.ts` (WR-03: 27 passando),
  `npx tsc --noEmit` e `npx eslint <arquivos tocados>` (WR-03 e WR-05: sem saída).
- `npm run verificar` → **saiu com 0**. Passaram lint, `tsc --noEmit`, `verificar-acoes` (80 ações,
  0 violações), `npm test` (92 arquivos, 1624 testes) e `test:migracoes` ("Todas as afirmações
  passaram.").
- `npm run test:e2e -- --grep "estoque contagem|estoque primeira abertura|cadastros catalogo ativo"`,
  **uma invocação só** → **66 passed (1.1m)**, incluindo o caso novo (f) em desktop e celular. O log
  do servidor tem 36 linhas `[WebServer] ⨯ Error: The destination stream closed early.`. Nenhum
  teste falhou por causa delas. Parecem ser streams de RSC interrompidos por navegação, mas isso não
  foi investigado nesta sessão.
- Nenhum `npm run build` separado.

## Para o orquestrador

- **Roteiro 15, Passo 0, não foi alterado.** Ele ainda diz "Se trocar D-23 ou D-24: pare aqui."
  Agora o §0.1 tem mais duas escolhas (D-23 com saldo ≤ 0 e a WR-02, que mexe na D-26). Se o dono
  trocar alguma delas, também precisa parar antes do Passo 1. Vale uma linha no Passo 0; isso ficou
  fora do escopo autorizado para o roteiro.
- Os documentos de estado (`STATE.md`, `ROADMAP.md`, `PROXIMA-SESSAO.md` e os de fora do git) não
  foram tocados por este fixer. Eles ainda não citam os commits c99d9c9..f9216d1 nem as duas caixas
  novas da Parte 0.

---

_Fixed: 2026-09-29T08:49:09Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
