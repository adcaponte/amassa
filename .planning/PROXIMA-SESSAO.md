# Próxima sessão — ATUALIZADO em 2026-10-04 (~13h40 UTC: Queimas, 06.4, executada no branch até o portão do Theo; nada publicado — próximo, a Parte 0, o Roteiro 21 e a caminhada dele)

*Até ~13h40 UTC de 04/10/2026 este título dizia "Próxima sessão — ATUALIZADO em 2026-10-04 (Queimas, 06.4, planejada e verificada com a D-07 do Theo; nada executado — próximo, executar quando ele pedir)".*

*Até 04/10/2026 este título dizia "Próxima sessão — ATUALIZADO em 2026-10-03 (~17h50 UTC: Fases 06.2, Fornecedores, e 06.3, Lembretes, FECHADAS e no ar; nenhuma fase em execução — próximo item da fila, o 8 (Queimas), quando o Theo quiser)".*

*Até ~17h50 UTC de 03/10/2026 este título dizia "Próxima sessão — ATUALIZADO em 2026-10-03 (~18h UTC: Fase 06.2, Fornecedores, FECHADA e no ar; Fase 06.3, Lembretes, aprovada pelo Theo e em fechamento)" — a 06.3 fechou em seguida.*

> **✅ ATUALIZAÇÃO DE 05/10/2026, ~01h10 UTC — PENDÊNCIAS 1 E 2 DO `ROTEIRO-PENDENCIAS-DO-DONO.md` FEITAS.** (1) `backup.sh`/`restaurar.sh` re-extraídos da `ferramentas` (15 911 / 9 339 bytes, `grep -c pasta_ilegivel` = 3, saída colada pelo Theo às 01:04 UTC). (2) `client_id` próprio do Drive: app OAuth `amassa-backup` no Google Cloud da conta da amassacerrado, "Em produção" (exigiu `/privacidade`, publicada em `7ae156f`, run `37226512538`), remoto reautorizado com a conta da amassacerrado — `rclone lsd amassa-backup:amassa` lista `anexos-fornecedores` e `fotos`, `backup.sh --agora` exit 0, `/api/health/backup` 200. **Falta do Theo:** o Passo 3 (8 decisões sobre os avisos 06.2/06.3/06.4) e apagar o projeto de teste no Console pessoal + revogar o acesso dele na conta pessoal.

> **✅ ATUALIZAÇÃO DE 04/10/2026, ~18h20 UTC — FASE 06.4 (QUEIMAS) FECHADA. Nenhuma fase em execução; a fila do Code está vazia (itens 1–8 fechados, o 9 — Polimento — sem escopo).**
> **Como sei:** caminhada no formulário "Caminhada das Queimas" — os 20 itens da Parte 2 "Ok" (17:32–17:46 UTC) — e "Aprovado!" do Theo no chat; `06.4-VERIFICATION.md` `passed` (5/5 critérios, 11/11 QMC, `npm run verificar` exit 0); `06.4-REVIEW.md` 0 bloqueios, 3 avisos, 9 informativos; `/api/health/queimas` 200 às 18:14 UTC. Achado do Theo fora do roteiro (faltava voltar no detalhe do forno) consertado e publicado em `6af1364` — run `37222643020` em andamento às 18:14 UTC, não acompanhado a pedido dele.
> **Com o Theo:** `Claude outputs/ROTEIRO-PENDENCIAS-DO-DONO.md` — (1) re-extrair `backup.sh`/`restaurar.sh`, (2) 🔴 `client_id` próprio do Drive no `rclone`, (3) decidir os avisos: 06.2-WR-01/02, 06.3-WR-01/02/03 e 06.4-WR-01/02/03. **Próximo do Code, quando ele pedir:** desenhar o Polimento (proposta: lista do que já está anotado → caminhada do Cowork → planejamento aqui) e, avulsas fora do Polimento, dividir o job `e2e` da CI por projeto, o aviso do Turbopack (`lib/fornecedores/caminho-anexos.ts:47`) e os 112 `boundingBox()` dos e2e sem espera de visibilidade.

> *Até ~18h20 UTC de 04/10/2026 o topo era este (histórico — a fase foi aprovada e fechada depois, ver acima):* **🟢 ATUALIZAÇÃO DE 04/10/2026, ~17h20 UTC — QUEIMAS (06.4) NO AR E MIGRADAS. Falta só a caminhada do Theo (Parte 2 de `06.4-VERIFICACAO-HUMANA.md`) e, com o "aprovado", revisão de código, verificação e fechamento da fase.**
> **Como sei:** push `f2c4e12..57a67d6` às 16:19 UTC; run `37216322851` verde nos quatro jobs (qualidade, e2e, publicar imagens, implantar — `gh run view`), `/api/health/queimas` = 503 às 16:54 UTC (código no ar, `0030` não aplicada); o Theo rodou o Passo 4 (saída no chat: `0030_queimas-contagem.sql` na imagem, "Migrações aplicadas com sucesso.", `echo $?` = 0); `/api/health/queimas` = **200** às 17:13 UTC; Passo 5.2 colado pelo Theo: `queima_contagens` 0 · `queima_vendas` 0; `queima_externa_g/m/p` os três **CRIADOS pela 0030** (17:12:47 UTC, `ativo = t`, `aparece_na_venda = t`, `controla_estoque = f`, **sem preço**); régua `queima_regua_m_ate` 25000 e `queima_regua_p_ate` 10000, vigentes desde 2026-09-20; queimas 5 · documentos 25 (iguais ao Passo 1) · itens 24 (21 + 3) · parâmetros 20 (18 + 2) · **31 migrações**.
> **Para a caminhada:** os itens "Queima externa P/M/G" estão sem preço — cadastrar em Cadastros → Catálogo antes de testar a cobrança (sem preço, "a cobrar" avisa e bloqueia, por desenho, UI-D5). As 5 queimas antigas aparecem em "Sem contagem" — esperado.

> *Até ~17h20 UTC de 04/10/2026 o topo era este (histórico — publicado e migrado depois, ver acima):* **🟡 ATUALIZAÇÃO DE 04/10/2026, ~16h20 UTC — O TESTE QUE DERRUBOU O PIPELINE DAS QUEIMAS ESTÁ CONSERTADO. O defeito era do TESTE, não do produto. Commit local `99be41d`, NÃO publicado; produção intacta. Próximo: push (que implanta as Queimas) → Passo 4 (`db:migrate` da `0030`) e Passo 5 do Roteiro 21 pelo Theo → caminhada → fechamento da 06.4.**
> **Causa:** o detalhe do forno tem `loading.tsx`, então o HTML chega por streaming — primeiro o esqueleto, depois o conteúdo num `<div hidden>` que o React troca de lugar. O `toHaveText` da linha "Contagem" casa mesmo com o elemento oculto; o `boundingBox()` não espera nada e mediu o trilho ainda oculto (`null` → "Sem caixa"). O caso do cartão escapava porque o `scrollIntoViewIfNeeded` dele já espera a visibilidade. **Conserto:** `caixa()` em `tests/e2e/queimas-medidor.spec.ts` faz `await expect(alvo).toBeVisible()` antes de medir — mais estrito, mesma geometria conferida. Registro: `.planning/debug/resolved/queimas-medidor-detalhe-320.md`. *(As suspeitas anotadas às 15h25 — folha/diálogo por cima, trilho de largura zero — foram descartadas.)*
> **Como sei:** trace do artefato `playwright-falhas` do run `37209767592` — a última imagem, no instante do `Bounding box`, é o esqueleto do `loading.tsx`, e a rede não tem navegação RSC depois do documento (só prefetches); `npm run test:e2e -- --grep "medidor sem sobreposição"` (uma invocação): 77 passed, os 4 do medidor verdes em `desktop` e `celular`; `npm run verificar` exit 0; `git log origin/main..main` = `5fc3c79`, `99be41d` e o commit deste estado (sem `git fetch`); às 16:17 UTC `/api/health` = 200, `/api/health/queimas` = 404 e `gh run list` com o `37209767592` (failure) no topo — nada subiu.
> **Cuidado:** o próximo push verde implanta as Queimas; o `db:migrate` da `0030` (Passo 4) tem de vir logo depois do `implantar` verde. O backup do Passo 2 é das 14:33 UTC — se passar muito tempo até o push, refazer (`./scripts/backup.sh --agora`).

> *Até ~16h20 UTC de 04/10/2026 o topo era este (histórico — o teste foi consertado, ver acima):* **🔴 ATUALIZAÇÃO DE 04/10/2026, ~15h25 UTC — QUEIMAS (06.4) NO `origin/main` MAS NÃO IMPLANTADA: O PIPELINE CAIU NUM TESTE DAS QUEIMAS. PRODUÇÃO INTACTA, `0030` NÃO APLICADA. PRÓXIMA SESSÃO: CONSERTAR O TESTE/DEFEITO, PUBLICAR E MIGRAR.**
> **O que aconteceu:** o Theo respondeu a Parte 0 da 06.4 ("Tudo fica", `32ba44e`), fez os Passos 1 e 2 do Roteiro 21 (saídas no chat: queimas 5 · documentos 25 · itens 21 · parâmetros 18 · **30 migrações**; `/api/health/queimas` 404; backup de **14:33 UTC** com `sucesso = t`, fotos 488 929/t, anexos 17 761 518/t). O Code fez o merge `--no-ff` de `gsd/phase-06.4-queimas` e subiu o limite do e2e do CI para 50 min (decisão do Theo: "pode subir como for melhor"), e deu o push: `fffb842..f2c4e12`. O run **`37209767592`** ficou **vermelho no e2e** (1477 passed, 22,3 min): **`tests/e2e/queimas-medidor.spec.ts:121`** ("no detalhe: a linha Contagem, os rótulos sem cruzar a 320 px…") falhou no desktop e no celular, nas 3 tentativas — "Sem caixa: o elemento não está visível" em `conferirRotulos`; o outro vermelho (`autenticacao.spec.ts:84` celular) passou na repetição. "Publicar imagens" e "Implantar" foram **pulados**.
> **Como sei que produção não mudou:** `git ls-remote origin refs/heads/main` = `f2c4e12` **mas** `/api/health/queimas` = **404** e `/api/health` = 200 às 15:25 UTC (o código das Queimas nunca subiu; o banco segue com 30 migrações; nada a desfazer).
> **Diagnóstico até aqui (não terminado):** reproduz **sempre** localmente com `npm run test:e2e -- --grep "medidor sem sobreposi" --project=desktop --no-deps` (o caso do cartão passa; o do detalhe falha). No trace: `getByTestId('medidor').getByTestId('medidor-trilho')` "resolved to **hidden**" na página `/gestao/queimas/{id}` a 320 px, logo depois de a linha "Contagem: 8 queimas até a manutenção." passar; o snapshot da falha mostra o `<main>` vazio na árvore de acessibilidade. Nenhuma regra de `app/globals.css` esconde o medidor (as de `data-folha-contagem` só mexem no toast). Suspeitas a testar: algo que abre por cima no detalhe (folha/diálogo modal → `aria-hidden`/`inert` no resto) ou largura zero do trilho. **Atenção:** o relatório do executor da 06.4 dizia que nenhum teste das Queimas falhou na varredura — este falha sempre; conferir se ele estava entre os "did not run".
> 🔴 **Cuidado:** o `origin/main` já tem o código das Queimas. **O próximo push que passar no CI implanta as Queimas, e aí a `0030` tem de ser aplicada logo em seguida** (Passo 4 do Roteiro 21; a janela só derruba as telas de Queimas). Como o backup do Passo 2 é de 14:33 UTC de 04/10, **refazer o Passo 2** antes do `db:migrate` se tiver passado tempo.
> **Próximo, na ordem:** (1) `/gsd-debug` do `queimas-medidor.spec.ts:121` — achar a causa (defeito do produto ou do teste), corrigir sem afrouxar o teste, `npm run verificar` e um e2e `--grep "queimas"`; (2) push e acompanhar o pipeline; (3) com "implantar" verde, o Theo roda o Passo 4 (`docker compose pull ferramentas && docker compose run --rm ferramentas ls db/migrations | grep 0030 && docker compose run --rm ferramentas npm run db:migrate; echo $?`) e o Passo 5 (conferência: 31 migrações, as duas tabelas vazias, os 3 itens "Queima externa", a régua 10000/25000) — roteiro em `Claude outputs/queimas/21-migracao-queimas.md`; (4) a caminhada da 06.4 (Parte 2 de `Claude outputs/queimas/06.4-VERIFICACAO-HUMANA.md`); (5) com o "aprovado": revisão de código, verificação e fechamento da 06.4.

> **🟡 ATUALIZAÇÃO DE 04/10/2026, ~13h40 UTC — QUEIMAS (06.4) EXECUTADA ATÉ O PORTÃO DO THEO. NADA PUBLICADO, A `0030` NÃO APLICADA.**
> **Feito (no branch `gsd/phase-06.4-queimas`):** os planos 01 a 06 (a folha "O que queimou?" depois dos dois toques, "Sem contagem", o Histórico com corrigir/apagar, os chips da Produção e "Repetir a última", a régua em Parâmetros, "Queimas externas a cobrar" com "Recebi agora" — pessoa opcional — e "Lançar na Venda", várias vendas por queima (D-07), os Números do forno, a linha "Contagem" e o medidor consertado) e as Tarefas 1 e 2 do 06.4-07: a única varredura e2e completa (`1449 passed · 14 failed · 0 flaky · 9 skipped · 61 did not run`, 1533 testes, 21,5 min — nenhuma falha das Queimas; as 14 são 11 janelas abertas com número e 3 contenções que passaram na reexecução isolada; os 44 `@parametro-global` à parte com `--no-deps`, 42 passed e 2 skipped), o Roteiro 21 (`docs/operacao/21-migracao-queimas.md`) e a caminhada `.planning/phases/06.4-queimas-contagem/06.4-VERIFICACAO-HUMANA.md`.
> **Já decidido por ele em 04/10:** D-07 (B); UI-D30 fica (as quantidades da própria Venda são o passo); UI-D13 troca — "Recebi agora" com Pessoa opcional (grava `cliente_id` + `pessoa_nome`; feito no plano 04). *A "pergunta (a) antes do plano 05" do bloco de baixo foi respondida assim.*
> **Decidido sem o Theo — para ele olhar as ⭐ primeiro (Parte 0 da caminhada, cada uma com alternativa e como desfazer):** UI-D8 (ouro sem "saiu cheio"), UI-D4 (30 dias / 20 em "Sem contagem", com "Ver todas"), UI-D5 (sem preço — e preço zero — bloqueia a cobrança), UI-D1 (N = o que falta para a manutenção), UI-D12 (folha × aviso com "Desfazer"), nome digitado e não escolhido segura o "Recebi agora", faixa da Venda sempre com o forno. Mais seis notas técnicas na 0.2 (180 s nos testes da cobrança; preços lidos dentro da transação; o zero da régua; a frase da Agenda para `queima:` adulterado; o erro dos Números não forçável).
> **CI:** a fase leva a suíte de 1459 para 1533 testes; estimativa do job `e2e` **30 a 35 min** (limite 40; os últimos verdes levaram 27 e 26 min) — sem folga para retries extras. Dividir o job por projeto continua aberto no STATE.
> **O que o Theo faz, na ordem:** (1) a Parte 0 — trocas voltam ao branch com `npm run verificar` antes de publicar; (2) o Roteiro 21 — `./scripts/backup.sh --agora` (no servidor; `fotos_bytes` e `anexos_bytes` > 0, pastas em `755`), `git checkout main` + `git merge --no-ff gsd/phase-06.4-queimas` + `git push` (no computador), `gh run list` até o `implantar` verde, `docker compose run --rm ferramentas npm run db:migrate`, `curl https://amassacerrado.com.br/api/health/queimas` = 200 e o SQL (`migracoes_aplicadas = 31`; quantos itens "Queima externa" adotados × criados); (3) a Parte 2 no celular; (4) "aprovado".
> **Como sei (04/10/2026, 13:37 UTC, sem `git fetch`):** `git log main..gsd/phase-06.4-queimas --oneline | wc -l` = 31 antes dos 2 commits do plano 07; `git log origin/main..main --oneline | wc -l` = 17 (só documentação); `gh run list -L 3` com o `37140573238` (03/10, success) no topo; `curl …/api/health/queimas` = 404; `npm run verificar` exit 0; `06.4-07-SUMMARY.md` (parcial) e `Claude outputs/RETRATO-DA-SUITE.md`.

> **🟢 ATUALIZAÇÃO DE 04/10/2026 — QUEIMAS (06.4) PLANEJADA E VERIFICADA, COM A D-07 DO THEO (B). NADA EXECUTADO, NADA PUBLICADO.** *(~13h40 UTC de 04/10/2026: executada até o portão — bloco acima; "nada executado" valia até ~10h UTC.)*
> **A decisão dele:** a pergunta da Tarefa 0 foi respondida no chat em 04/10 — **(B) várias vendas por queima, uma por pessoa** (cada venda com a quantidade por tamanho; nunca uma venda por peça como regra; "a cobrar" = externas − o que está em vendas ativas; venda cancelada no Caixa devolve a quantidade; baixar a contagem abaixo do já lançado é recusado). Registrada como **D-07** no `06.4-CONTEXT.md` (`bdf9d5d`).
> **O que foi feito:** os 7 planos refeitos para B — a `0030` ganha a tabela `queima_vendas` (uma linha por venda, com P·M·G) no lugar de `queima_contagens.documento_id`; "Recebi agora" com o passo de quantidade; a Venda do "Lançar na Venda" abre com o que falta; prova de corrida por tamanho; UI-SPEC, pesquisa, padrões e VALIDATION alinhados, com a história datada (`046c008`, `02773d4`, `e09d999`). **Verificador de planos:** rodada de base (a do dia 03, refeita porque o relatório não foi salvo) 1 bloqueio + 5 avisos + a D-07; rodada 1 — 0 bloqueios, 6 avisos; rodada 2 — 0 bloqueios, 1 aviso; **rodada 3 — aprovado** (`## VERIFICATION PASSED`, 0 bloqueios, 0 avisos). **Como sei que leu:** cada rodada devolveu a tabela de linhas lidas × `wc -l` — a rodada 3 leu os 7 planos e o CONTEXT inteiros; a rodada 2 leu também a UI-SPEC, a pesquisa, os padrões e a VALIDATION inteiros, e nenhum desses mudou depois (`git show --stat e09d999` só toca os planos 01 e 02).
> **Para o Theo olhar (estão em "Decidido sem o dono" e com ⭐ na Parte 0 da caminhada):** (a) **UI-D30 — no "Lançar na Venda", as quantidades editáveis da própria Venda são o passo de "quantas de cada tamanho"** (a Venda abre com tudo o que falta; diminuir deixa o resto em "a cobrar"; não há tela de quantidade antes). **Pergunta antes do plano 05:** prefere assim, ou um passo próprio antes de abrir a Venda (como o do "Recebi agora")? Sem resposta, o plano 05 segue a leitura UI-D30; "passo próprio" para o plano 05 e refaz a Tarefa 1 dele. (b) **UI-D13 — "Recebi agora" cria a venda já paga e sem pessoa;** para separar por pessoa com nome, é o "Lançar na Venda". (c) Apagar uma contagem com venda ativa é recusado; com só vendas canceladas, os vínculos cancelados vão junto (as vendas ficam no Caixa). (d) O "Desfazer" do aviso do registro continua sem confirmação (se outro aparelho lançar venda nesses 7 s, o vínculo some; a venda fica). (e) Planos 01 e 04 um pouco acima do orçamento de contexto — aceito.
> **Local, não publicado:** só documentos (`git log origin/main..main` = 16 commits de `.planning/` contando o de estado, medido em 04/10 sem `git fetch`).
> **Próximo:** `/gsd-execute-phase 06.4` quando o Theo pedir (7 planos sequenciais no branch `gsd/phase-06.4-queimas`; a `0030` só é aplicada por ele no Roteiro 21, no plano 07); a resposta da pergunta (a) antes do plano 05.

> **⏸ ATUALIZAÇÃO DE 03/10/2026, ~19h UTC (16h em Brasília) — DIA FECHADO: AGENDA, FORNECEDORES E LEMBRETES NO AR, MIGRADOS, VERIFICADOS PELO THEO E FECHADOS. QUEIMAS (06.4) DISCUTIDA COM ELE; PLANEJAMENTO PAUSADO A PEDIDO DELE COM 7 PLANOS EM RASCUNHO.**
> **No ar** (`origin/main` = `fffb842`, run `37140573238` verde): as três migrações `0027`–`0029` aplicadas pelo Theo numa sessão só (Roteiros 19+20, saídas coladas no chat: 30 migrações, documentos 25 / parcelas 31 iguais antes e depois, cinco rotas de saúde 200, DELETE f/t/t). Dois tropeços do pipeline corrigidos no caminho: `dafa82e` (`fileTypeFromFile` puxava `strtok3`, ausente na imagem standalone — reproduzido contra a imagem) e `213cb15` (e2e de 25→40 min; a suíte tem 1459 testes). **Backup:** achado em produção que o backup (roda como `theo`) não lia as pastas `750` e registrava "vazia, sucesso" — fotos de orçamento sem cópia externa desde 27/09; o Theo pôs `755` (488 929 + 17 761 518 bytes copiados, `rclone lsl` conferido) e o `backup.sh` novo (quick `261003-bkp`) falha alto se a pasta for ilegível; scripts re-extraídos por ele às ~18h UTC (15 911 bytes, `grep pasta_ilegivel` = 3, exit 0).
> **Fechadas hoje:** Fase 5 (Agenda, `ccac9d7`, 9/9 + AGE-01..20), 06.2 (Fornecedores, `f65d495`, 6/6 + FRN-01..14), 06.3 (Lembretes, `3f40105`, 6/6 + LMB-01..09) — as três caminhadas aprovadas pelo Theo no chat. Revisões de código sem bloqueio; os avisos (2 + 3), o teto de pixels da foto e o WINDOWS #64 foram **para o Polimento por decisão dele**, com arquivo e linha na Fase 7 do ROADMAP (`ea1a112`).
> **Queimas (06.4):** criada (`986c340`, QMC-01..11), discutida com o Theo (`06.4-CONTEXT.md`, D-01..D-06, `7078666`), pesquisa + UI-SPEC (aprovado na 2ª rodada) + padrões commitados; **7 planos em rascunho** (`06.4-0[1-7]-PLAN.md`): o verificador de planos reprovou a 1ª rodada (1 bloqueio, 6 avisos) e o Theo pediu para pausar antes da revisão. *(04/10/2026: retomado e concluído — bloco acima.)* **Pendente dele:** a "Tarefa 0" — **uma venda por queima (A) ou várias (B)** para a cobrança das externas (`06.4-UI-SPEC.md` §"Pendente do dono"; os planos estão escritos para A).
> **Local, não publicado:** só documentos (`git log origin/main..main` = 10 commits de `.planning/`, medido às ~19h UTC); sobem no próximo push, sem pressa.
> **Abertos para depois (STATE, Pending Todos):** `client_id` próprio do rclone antes do uso real (o compartilhado será desligado em 2026 — sem ele, todo o backup externo para); dividir o e2e do CI por projeto; o `path.join` de `lib/fornecedores/caminho-anexos.ts:47` que infla a imagem.
> **Próximo, na ordem** *(em 03/10; em 04/10 o Theo respondeu B — D-07 — e o (2) foi feito: bloco acima)*: (1) o Theo responde A ou B; (2) retomar o planejamento da 06.4 pela revisão dos planos + nova rodada do verificador (`/gsd-plan-phase 06.4` retoma do que existe); (3) executar quando ele pedir.

> **🟢 ATUALIZAÇÃO DE 03/10/2026, ~17h50 UTC — FASE 06.3 (LEMBRETES) FECHADA.** O Theo escreveu no chat (~18h UTC): *"fiz a verificação dos lembretes. Tudo OK."* — o portão 06.3-06 aprovado, **sem anotação por item**. Fechamento: `06.3-06-SUMMARY.md` com a Tarefa 3; LMB-01..09 marcados; ROADMAP 6/6 `Complete`; verificação `06.3-VERIFICATION.md` **`passed`** (6/6 critérios, 9/9 LMB; `npm run verificar` exit 0 rodado pelo verificador); `phase.complete`. **Revisão de código `06.3-REVIEW.md`: 0 bloqueios, 3 avisos, 9 informativos — nada corrigido, o Theo decide:** WR-01 (o "Desfazer" da exclusão some quando outro aviso chega por cima, e a exclusão acontece mesmo assim), WR-02 ("Ver todos" para em 500 por filtro, sem aviso) e WR-03 (o "Desfazer" do "Feito" pode desfazer o feito de outra pessoa, e o aviso diz "Feito" com a linha já reaberta). **Como sei que está no ar:** a saída do dele terminal — Roteiro 20 pelo caminho A, merge `6a20ee6`, run `37133630212` verde, `0029` no mesmo `db:migrate` (`migracoes_aplicadas = 30`), `/api/health/lembretes` 200, `apaga_lembrete = t`. **Fica aberto:** WINDOWS #64 (`/gsd-debug` depois). **Nenhuma fase em execução;** o próximo item da fila é o 8 (Queimas), quando o Theo quiser.

*Até ~18h UTC de 03/10/2026 este título dizia "Próxima sessão — ATUALIZADO em 2026-10-03 (~05h30 UTC: Fases 06.2, Fornecedores, e 06.3, Lembretes, com o código completo no branch `gsd/phase-06.3-lembretes` (que contém a 06.2), não publicado; aguardando o Theo — as duas Partes 0, o Roteiro 19 com o 20 de carona, as duas caminhadas)" — as duas fases foram publicadas e migradas pelo Theo na tarde de 03/10 (Roteiro 19 com o 20 de carona).*

> **🟢 ATUALIZAÇÃO DE 03/10/2026, ~18h UTC — FASE 06.2 (FORNECEDORES) FECHADA.** O Theo escreveu no chat (~17h UTC):
> *"fiz a verificação dos fornecedores."* — o portão 06.2-13 aprovado, **sem anotação por item**. Feito nesta sessão:
> `06.2-13-SUMMARY.md` com a Tarefa 3; FRN-01..14 `[x]`/`Complete` (com a nota datada da D-06 sem acento no FRN-02);
> ROADMAP 13/13 `Complete`; `06.2-VERIFICATION.md` **`passed`** (6/6 critérios, 14/14 FRN; `npm run verificar` exit 0);
> `phase.complete`. **Revisão de código `06.2-REVIEW.md`: 0 bloqueios, 2 avisos, 10 informativos — nada corrigido, o
> Theo decide** (WR-01: falha do banco no upload aparece como "Sua sessão terminou" e o arquivo se perde; WR-02:
> "Baixar"/"abrir" um anexo sumido troca a aba pelo JSON cru). **Como sei que está no ar:** a saída do terminal dele no
> Roteiro 19 (run `37133630212` verde, `migracoes_aplicadas = 30`, `/api/health/fornecedores` 200, PDF de 17 761 518
> bytes, backup com os anexos e `rclone lsl`). `origin/main` = `fffb842` (`git log origin/main..main` vazio às 17h31
> UTC; o run `37140573238` do `fffb842` em andamento nessa hora). **Falta ao Theo:** re-extrair `backup.sh`/`restaurar.sh`
> da `ferramentas` depois desse deploy (Roteiro 19, Passo 6) e decidir os dois avisos.

*Até ~05h30 UTC de 03/10/2026 este título dizia "ATUALIZADO em 2026-10-03 (~02h50 UTC: Fase 06.2, Fornecedores, código completo no branch `gsd/phase-06.2-fornecedores`, não publicado; aguardando o Theo — Parte 0, Roteiro 19 com o 18 junto, caminhada)" — continua certo para a 06.2; a 06.3 entrou depois (bloco abaixo).*

> **🟡 ATUALIZAÇÃO DE 03/10/2026, ~16h UTC — BACKUP CEGO PARA PASTA ILEGÍVEL: CORRIGIDO NO REPOSITÓRIO, NÃO PUBLICADO (quick `261003-bkp`).** *(~18h UTC de 03/10: já publicado — `origin/main` = `fffb842`, `git log origin/main..main` vazio às 17h31 UTC; falta só a re-extração no host.)* O Theo mediu no servidor em 03/10: com as pastas `fotos-orcamentos` e `anexos-fornecedores` em `750` (dono 100, grupo 101), o backup — que roda pelo crontab de `theo` — não as lia e gravava `0`/`t` com 4 fotos (488 929 bytes) e um PDF de 17 761 518 bytes dentro; nada chegou à cópia externa desde 27/09. Corrigido no servidor com `sudo chmod 755` (backup seguinte: `488929`/`t` e `17761518`/`t`, arquivos no `rclone lsl`). No repositório: `backup.sh` agora grava destino `false`, mensagem "permissão" e sai ≠ 0 nesse caso, e `/api/health/backup` vira 503 (`9f5c73c`, Etapas 10–11 do `test:backup` como usuário sem privilégio, RED→GREEN); Roteiros 12 e 19 em `755` com nota datada (`1b9da54`). **Falta:** publicar, e depois do deploy re-extrair `backup.sh`/`restaurar.sh` da `ferramentas` (Roteiro 19, Passo 6; 15 911 bytes, `grep -c pasta_ilegivel` > 0). **Pendências novas abertas** (Pending Todos do `.planning/STATE.md`): 🔴 `client_id` próprio do Drive no `rclone` antes do uso real (o compartilhado "will stop working during 2026" — sem ele, todas as cópias externas param); dividir o job `e2e` da CI por projeto (o limite subiu 25→40 min em `213cb15`); o `path.join` dinâmico de `lib/fornecedores/caminho-anexos.ts:47` faz o standalone rastrear o projeto inteiro. **Como sei:** `git log origin/main..main` depois de `git fetch` = `9f5c73c`, `1b9da54` (e o commit de estado deste quick); `gh run list` → `37133630212` (`213cb15`) `success` às 15:32 UTC; `npm run verificar` exit 0; `npm run test:backup` "Todas as etapas passaram."; detalhe em `.planning/quick/261003-bkp-backup-pasta-ilegivel/261003-bkp-SUMMARY.md`.

> **🟢 ATUALIZAÇÃO DE 03/10/2026, ~13h UTC — FASE 5 (AGENDA) FECHADA.**
> O Theo escreveu no chat em 03/10 (~10–11h de Brasília): *"1 - finalizei a verificação humana da agenda."* — o portão
> 05-16 aprovado. **Sem anotação por item nem o tempo do C.1** (não registrados porque ele não deu). Feito nesta
> sessão: `05-16-SUMMARY.md`; AGE-01..20 `[x]` e `Complete` no REQUIREMENTS; 05-16 `[x]`, a Fase 5 `[x]` e 16/16
> `Complete` no ROADMAP; a verificação da fase `05-VERIFICATION.md` — **`passed`**, 9/9 critérios e 20/20
> requisitos. **Como sei:** `gsd-verifier` rodou `lint`, `tsc --noEmit`, `verificar-acoes` (122 ações) e `npm test`
> (2825 testes) verdes e leu o código; `gh run view` confirmou os runs `37013475323` e `37061857675` (`success`);
> `git ls-remote origin main` = `eac0203` (03/10/2026). `npm run verificar`/`test:migracoes`/e2e não rodaram nesta
> sessão (outro processo usava o Postgres efêmero). **Fica de fora da fase:** a `0027` (quick `261002-sdt`) no
> `main` local, não no ar — sai com o Roteiro 19 (o 18 de carona). *Os "Próximo (Theo): a caminhada da Agenda" dos
> blocos de 02/10 abaixo estão feitos desde 03/10.*

> **🟢 ATUALIZAÇÃO DE 03/10/2026 (tarde) — AS ⭐ DAS DUAS PARTES 0 RESPONDIDAS PELO THEO NO CHAT; AS DUAS TROCAS FEITAS NO BRANCH (quick `261003-d06`), NÃO PUBLICADAS.**
> **D-06 trocada:** nome de fornecedor único entre os ativos sem caixa **nem acento** (`nome_normalizado(nome)`; a `0028` editada no lugar, antes de ser aplicada) — `555f0c7`. **Copy dos Lembretes trocada:** "com data ele fica vermelho quando vencer" — `82b6102`. **Ficam:** a exclusão de lembrete sem diálogo ("Pode seguir excluindo o lembrete"), as demais ⭐ das duas §0.1, e o §0.8 da 06.3 = (a) publicar e investigar a WINDOWS #64 depois.
> **Como sei:** `npm run verificar` verde (com `test:migracoes`); `npx drizzle-kit generate` → "No schema changes"; e2e de fornecedores e `lembretes inicio` verdes — comandos e números no `261003-d06-SUMMARY.md`. **Continua dependendo do Theo:** as §0.2–0.7 das duas Partes 0 ("Fica tudo" ou a troca), o Roteiro 19 com o 20 de carona (agora com a `0028` nova — o branch é o mesmo) e as duas caminhadas.

> **🟡 ATUALIZAÇÃO DE 03/10/2026, ~05h30 UTC (02h30 em Brasília) — FASE 06.3 (LEMBRETES): CÓDIGO COMPLETO NO BRANCH `gsd/phase-06.3-lembretes`, NÃO PUBLICADO. AGUARDANDO O THEO. A `0029` NÃO ESTÁ APLICADA (NEM A `0027`/`0028`).**
> Sob a mesma autorização de 02/10 à noite, a 06.3 foi planejada (duas pesquisas, UI-SPEC, 6 planos aprovados na 2ª rodada do plan-checker) e executada logo depois da 06.2: os planos 01–05 inteiros e o 06 (o portão) até o checkpoint dele. O branch foi criado do `gsd/phase-06.2-fornecedores` (`d6ff7bf`) e **contém a 06.2**: publicar a 06.3 publica as duas. O 06 fez: a única varredura e2e completa da fase (1457 testes, **1383 passed · 12 failed · 0 flaky · 9 skipped · 53 did not run** (16,1 min, 05h11–05h28 UTC, árvore `4241b0e`); os `lembretes-*` verdes nos dois projetos menos o (d) de `lembretes-inicio` — uma corrida com a hidratação no teste da fase, corrigida em `02a03f3` e reverificada com um `--grep`; 7 das 12 são janelas conhecidas (#3/#24/#34, #50, #51, #57); `casca:236` passou na reexecução (contenção); e 🔴 **`cotacoes-categorias:291` ficou ABERTA**: o `goto` da fronteira de erro da Abertura às vezes não recebe o `load` em 30 s (a página de erro aparece certa), e por experimento isso está ligado ao item "Lembretes" da lateral (sem ele, 8/8 passam; com ele, 3–4/8 falham); mecanismo não identificado, não corrigido, teste não afrouxado — WINDOWS #64), o **Roteiro 20** (`docs/operacao/20-migracao-lembretes.md`, curto, de carona no 19) e a caminhada (`.planning/phases/06.3-lembretes/06.3-VERIFICACAO-HUMANA.md`).
> **Como sei (medido às 05h12 UTC de 03/10):** `git log origin/main..main` = **7 commits** — os 6 do quick `261002-sdt` (`c008b1d`..`0b6bdd4`) e o `05ac5b7` (quick `261003-fot`, a foto de orçamento de 10–15 MB, feito noutra sessão); `git log main..gsd/phase-06.3-lembretes | wc -l` = 89 antes deste plano; `git merge-base --is-ancestor gsd/phase-06.2-fornecedores gsd/phase-06.3-lembretes` → `0` (contém a 06.2); `git merge-base --is-ancestor main gsd/phase-06.3-lembretes` → `1` (o `main` andou com o `05ac5b7`; `git merge-tree --write-tree main gsd/phase-06.3-lembretes` → sem conflito); `gh run list` — o último run continua o `37061857675` (02/10 20h38 UTC, verde); `/api/health/backup` 200, `/api/health/fornecedores` **404**, `/api/health/lembretes` **404**. **No branch:** `npm run verificar` verde (130 arquivos, 2823 testes, `test:migracoes` com a `0029`). Nenhum LMB marcado.
> **🔴 O que depende do Theo, nesta ordem:** (1) **a Parte 0 da 06.2** e (2) **a Parte 0 da 06.3** — nesta, ⭐ a tensão "toda remoção pede confirmação" × o toast com "Desfazer" (fica o toast, ou um diálogo antes de excluir?), D-03 + UI-D13 (fechar o toast também apaga), UI-D1 (Lembretes na lateral e na pílula), UI-D2 (a cor pela ordem de cadastro — se Andressa foi cadastrada antes, ela fica teal), UI-D10 (o trecho no toast), e a copy "com data ele avisa quando vencer"; e o §0.8 — o defeito aberto WINDOWS #64 (`cotacoes-categorias:291`, ligado ao item Lembretes da lateral): publicar e investigar depois com `/gsd-debug`, ou investigar antes; troca vira commit no branch + `npm run verificar` antes da publicação; (3) **o Roteiro 19 com o 20 de carona** (caminho A): o 19 inteiro, com `git merge --no-ff gsd/phase-06.3-lembretes` no lugar do merge da 06.2, `0027` + `0028` + `0029` num `db:migrate` só depois de um backup, 30 migrações no fim, e a conferência do 20 (`/api/health/lembretes` 200; SQL com `DELETE` = `t` em `lembretes` — o certo, exceção deliberada); ou o 19 e depois o 20 (caminho B); (4) **as duas caminhadas**; (5) **"aprovado"**.

*No bloco 🟡 de ~02h50 UTC de 03/10 logo abaixo, "o Roteiro 19 … `git merge --no-ff gsd/phase-06.2-fornecedores`" continua certo se a 06.2 for publicada sozinha; publicando as duas, o merge é o da 06.3 (bloco acima). E "o `main` é ancestral do branch" deixou de valer em 03/10 (o `05ac5b7`) — o merge continua sem conflito.*

*Até ~02h50 UTC de 03/10/2026 o título dizia "ATUALIZADO em 2026-10-02 (~01h15 UTC: Fase 5, Agenda, código completo no branch `gsd/phase-05-agenda`, não publicado; aguardando o Theo — Parte 0, Roteiro 17, caminhada)" — já estava velho desde 02/10, quando a Agenda foi publicada e migrada (blocos abaixo).*

> **🟡 ATUALIZAÇÃO DE 03/10/2026, ~02h50 UTC (23h50 de 02/10 em Brasília) — FASE 06.2 (FORNECEDORES): CÓDIGO COMPLETO NO BRANCH `gsd/phase-06.2-fornecedores`, NÃO PUBLICADO. AGUARDANDO O THEO. NEM A `0027` NEM A `0028` ESTÃO APLICADAS.**
> Com a autorização dele de 02/10 à noite (*"pode rodar o que conseguir também. amanhã fazemos todas verificações e migrações."*), os 13 planos da fase rodaram sem ele: 01–12 inteiros e o 13 (o portão) até o checkpoint dele. O 13 fez: `/api/health/fornecedores` (`8c3cafb`), a única varredura e2e completa da fase, uma correção num teste da fase (`3ffbd2d`), o `test:backup`, o **Roteiro 19** (`docs/operacao/19-migracao-fornecedores.md`) e a caminhada (`.planning/phases/06.2-fornecedores/06.2-VERIFICACAO-HUMANA.md`). Cópias de leitura dos dois em `Claude outputs/fornecedores/`.
> **Como sei (medido às 02h17 UTC de 03/10):** `git log origin/main..main` = **6 commits** do quick `261002-sdt` (`c008b1d`..`0b6bdd4`, entre eles a `0027` e o Roteiro 18) — **o Roteiro 18 não foi rodado**; `git ls-tree origin/main db/migrations/ | grep -c 0027` = 0; `git log main..gsd/phase-06.2-fornecedores | wc -l` = 60 (o número final está no `06.2-13-SUMMARY.md`); `gh run list` — o último run é o `37061857675` (`eac0203`, 02/10 20h38 UTC, verde); `/api/health/backup` 200, `/api/health/agenda` 200 (a versão no ar não lê `dispensada_em`: prova só a `0026`), `/api/health/fornecedores` **404**. **No branch:** `npm run verificar` verde; varredura completa (1385 testes, 02h16–02h32 UTC): **1312 passed · 11 failed · 0 flaky · 9 skipped · 53 did not run** — **nenhuma falha dos Fornecedores** (152 `ok` nos 11 specs novos); as 11 são janelas conhecidas (#3/#24/#34, #32, #50, #51, #57) ou o menu do usuário fora da tela sob carga, que passou na reexecução; `npm run test:backup` "Todas as etapas passaram." Detalhe spec a spec em `Claude outputs/RETRATO-DA-SUITE.md`. Nenhum FRN marcado (só a caminhada marca).
> **🔴 O que depende do Theo, nesta ordem:** (1) **a Parte 0 da caminhada** — as decisões tomadas sem ele; as seis com ⭐ primeiro: D-04 (um campo só na Despesa), D-06 (unicidade sem acento ficou de fora), D-07 (HEIC recusado), UI-D1 (a sétima pílula sozinha), UI-D2 (o rótulo do modo Outra), UI-D10 (envio sem porcentagem); e os achados fora do escopo, para tarefas separadas; troca vira commit no branch + `npm run verificar` antes do Passo 4; (2) **o Roteiro 19, que já inclui o Roteiro 18**: guarda e "fora de uso real?" → contagem (`migracoes_aplicadas` = 27 esperado) → backup → **criar `/opt/amassa/dados/anexos-fornecedores` com `sudo chown 100:101` ANTES do deploy** → `git merge --no-ff gsd/phase-06.2-fornecedores` + `git push` (publica junto os 6 commits do Roteiro 18) → esperar o `implantar` (na janela, vendas e despesas falham e `/api/health/fornecedores` e `/api/health/backup` ficam 503) → `db:migrate` logo em seguida (`0027` + `0028` numa transação) → re-extrair `backup.sh`/`restaurar.sh` DEPOIS do `db:migrate` → conferência de escrita → `/api/health/fornecedores` 200 → SQL (29 migrações) → `backup.sh --agora` e `/api/health/backup` 200; (3) **a caminhada** (Parte 2: os 6 critérios, o PDF de ~15 MB pelo domínio, a foto do celular, a aba anônima, as 11 `backstop`; depois do primeiro anexo, `rclone lsl` da pasta remota `anexos-fornecedores`). Depois do "aprovado": FRN marcados pelo que a caminhada confirmou, `06.2-13-SUMMARY.md` completado, ✅ no item 7 da fila. **A caminhada da Agenda (Fase 5) continua pendente também.**

*No bloco 🟡 de ~20h40 UTC de 02/10 logo abaixo, o "Próximo (Theo): Roteiro 18" foi absorvido pelo Roteiro 19 em 03/10 (bloco acima): rodar o 19 publica e migra a `0027` junto. Rodar o 18 sozinho antes continua possível — o 19 diz o que muda nesse caso.*

*Até ~01h15 UTC de 02/10/2026 este título dizia "(~23h10 UTC: Fase 5, Agenda, 15 de 16 planos feitos no branch; próximo, o portão — plano 16)".*

*Até ~23h10 UTC de 01/10/2026 este título dizia "(~06h45 UTC: Fase 5, Agenda, planos 01 e 02 de 16 feitos no branch; próximo, plano 03)".*

*Até ~06h45 UTC de 01/10/2026 este título dizia "(manhã UTC: Fase 5, Agenda, planejada — 16 planos; próximo, executar)".*

*Até a manhã de 01/10/2026 este título dizia "(~02h UTC: Fase 5, Agenda, discutida; próximo, planejar)".*

*Até ~02h UTC de 01/10/2026 este título dizia "(~01h30 UTC: Fase 06.1 fechada; próxima, a Agenda)".*

*Até ~01h30 UTC de 01/10/2026 este título dizia "Próxima sessão — ATUALIZADO em 2026-10-01 (madrugada: Fase 06.1 concluída e no ar)".*

> **🟡 ATUALIZAÇÃO DE 02/10/2026, ~20h40 UTC — AS TRÊS DECISÕES DO THEO SOBRE A VERIFICAÇÃO DO COWORK ESTÃO FEITAS, NÃO PUBLICADAS. PUBLICAR PELO ROTEIRO 18 (TEM MIGRAÇÃO).**
> Decididas por ele no chat: caixa "Mostrar no calendário público" **desmarcada** por padrão; **dispensar uso livre** quando a venda dele foi cancelada (escolheu a migração **`0027`**, três colunas em `usos_livres`); o lote de mensalidades pede **"Lançar N vendas?"**. Quick `261002-sdt`: `eac0203`, `c008b1d` (só a migração), `5e91ab3`, `534afd2`, `60d16b3`. **Como sei:** `npm run verificar` verde (2303 testes, `test:migracoes` com a 0027); e2e da Agenda verde nos specs tocados, em duas invocações (detalhe e a falha de Queimas não relacionada em `.planning/quick/261002-sdt-agenda-decisoes-do-cowork/`). Uma pausa no meio: o PC do Theo pegou malware, antivírus e reinício; nada do repositório se perdeu (`git status` limpo de deleções; os arquivos da metade da tarefa conferidos).
> **Próximo (Theo):** **Roteiro 18** (`docs/operacao/18-migracao-dispensa-do-uso-livre.md`, cópia em `Claude outputs/agenda/`): backup → push dos 6 commits locais → esperar `implantar` verde → `db:migrate` logo em seguida (entre um e outro, "A receber" e uso livre falham, `/api/health/agenda` 503) → `/api/health/agenda` 200, 28 migrações. Depois, a caminhada da Agenda; e confirmar o `06.2-CONTEXT.md` (Fornecedores).

*No bloco 🟢 de ~14h45 abaixo, as "duas decisões do Theo" deixaram de ser pendentes às ~20h40 (bloco acima).*

> **🟢 ATUALIZAÇÃO DE 02/10/2026, ~14h45 UTC — FONTES VERSIONADAS NO AR (JANELA 60 FECHADA NA PRÁTICA). AGENDA: FALTA SÓ A CAMINHADA DO THEO. FORNECEDORES (ITEM 7 DA FILA) ADIANTADO ATÉ A DISCUSSÃO — NÃO PLANEJADO.**
> **Push** do `main` pelo Code, a pedido do Theo ("dê o push… se der vermelho já corrige"), depois de `npm run verificar` verde: `1102e05..71aedc6`. Run **`37018095205` verde nos quatro jobs de primeira** — o "Publicar imagens no GHCR" passou sem rerun, primeira vez desde a janela 60 que o build não depende do Google. **Como sei:** `gh run view 37018095205` (concluído 14:38 UTC); `git ls-remote origin refs/heads/main` = `71aedc6`; `/api/health`, `/agenda`, `/backup`, `/producao`, `/estoque` = 200 às 14:38 UTC.
> **Verificação do Cowork da Agenda** (`Claude outputs/agenda/VERIFICACAO-COWORK-05.md`, 09h15–09h55 de Brasília): 22 passos em produção, **nenhum 🔴**. **Duas decisões do Theo antes de a agenda virar real:** (1) "Mostrar no calendário público" vem **marcado** por padrão — manter ou inverter até dezembro; (2) uso livre encerrado cuja venda foi cancelada fica **para sempre** em "A receber" (não tem "Dispensar", D-09) — sugestão: permitir dispensar nesse caso. Menor: o lote de mensalidades lança sem um "Lançar N vendas?" final. Dados `[teste cowork]` em produção listados na §3 do relatório (três vendas a cancelar quando quiser). A linha velha "Nada da Fase 5 está no ar" de `05-VERIFICACAO-HUMANA.md` corrigida.
> **Fornecedores — adiantamento (item 7, liberado pelo Theo: "se tiver adiantamentos desse próximo item, já pode fazer"):** fase **06.2** criada no ROADMAP (depois da 06.1, ordem Agenda → Fornecedores → Queimas); `BRIEFING.md` + `prototipo.html` copiados para `.planning/phases/06.2-fornecedores/` (`cmp` idêntico); **FRN-01..14** no REQUIREMENTS (207 no total; FRN porque FOR já é do Contador de Queima); `06.2-CONTEXT.md` com os três pontos da §8 pela recomendação, **`[auto]`, aguardando o Theo**: D-01 upload por Route Handler em stream (não Server Action de 24mb), D-02 fornecedor só no lançamento da despesa (**não existe edição de despesa** — conferido em `lib/financeiro/acoes.ts`), D-03 total do ano corrente; e quatro achados do código: rota em `/gestao/api/`, **a pasta nova precisa de bind mount e de entrar no `backup.sh`/`restaurar.sh`** (hoje só copiam `fotos-orcamentos`), foto 2000 px (os orçamentos usam 1600), CSV não tem assinatura. **Nada planejado** — a fila diz esperar a resposta dele.
> **Próximo (Theo):** (1) a caminhada da Agenda (Parte 2 de `05-VERIFICACAO-HUMANA.md`) e as duas decisões do Cowork acima; depois do "aprovado": AGE-01..20, `05-16-SUMMARY.md`, verificação da fase, ✅ no item 6; (2) confirmar ou trocar as decisões `[auto]` do `06.2-CONTEXT.md` → `/gsd-plan-phase 06.2`.

*O bloco 🟡 abaixo ficou velho às 14h38 UTC de 02/10/2026: o push e o pipeline que ele pedia foram feitos (bloco acima).*

> **🟡 ATUALIZAÇÃO DE 02/10/2026, ~14h45 UTC — FONTES VERSIONADAS INTEGRADAS NO `main` LOCAL, NÃO PUBLICADAS. PRÓXIMA SESSÃO: PUSH + PIPELINE, DEPOIS A CAMINHADA DA AGENDA.**
> A tarefa das fontes (quick `261002-j98`, janela 60) rodou noutra sessão, no branch `claude/eager-lichterman-f6ae86` (`5057c7e` + `fd497de`); integrada aqui no merge `ae77a80` sem conflito. Provas medidas depois do merge (02/10, ~14h40 UTC): `npm run verificar` = 0 (2294 testes, `test:migracoes`); `npm run test:e2e -- --grep "design system|site"` = 118 passed, 3 skipped; `npm run test:site-sem-banco` = todas as etapas. **Não publicado, a pedido do Theo** ("deixa eu dar o push depois do /clear").
> **Próximo, nesta ordem:** (1) o Theo dá o push do `main` (`git log origin/main..main` = o commit de estado `36c6115`, este e o merge das fontes); a sessão acompanha o pipeline — o job "Publicar imagens no GHCR" é a prova de que o build não baixa mais nada do Google — e corrige se cair; (2) a caminhada da Agenda (bloco abaixo).

> **🟢 ATUALIZAÇÃO DE 02/10/2026, ~14h UTC — CORREÇÕES DA REVISÃO DE CÓDIGO DA AGENDA NO AR. FALTA SÓ A CAMINHADA DO THEO.**
> Revisão de código (`05-REVIEW-A.md` servidor, `05-REVIEW-B.md` telas; `aa84289`): 3 BLOCKERS (venda em dobro em requisições sobrepostas — reproduzido em Postgres descartável; uso livre reservado para a pessoa errada ao cadastrar dentro da folha "Lançar"; presença que falha depois do "Pronto" sem aviso) + 11 avisos + 13 informativos. O Theo mandou corrigir tudo e publicar se verde, e decidiu a WR-03: **sem aula no mês, sem mensalidade** (nota datada sob a D-02 no `05-CONTEXT.md`). `gsd-code-fixer`: 14/14 bloqueios e avisos + 9/13 informativos, um commit por achado (`664fe25`..`1102e05`, relatório `05-REVIEW-FIX.md`); prova nova `scripts/provar-corridas-da-agenda.ts` (duas transações sobrepostas de verdade, dentro do `test:migracoes`). Run `37013475323`: e2e completo verde; a imagem caiu de novo na janela 60 (fonte do Google), `gh run rerun --failed` → verde, implantar 13:59 UTC. **Como sei:** `gh run view 37013475323`; `/api/health/agenda`, `/producao`, `/backup` = 200 às 14:00 UTC.
> **Próximo (Theo, com calma):** a caminhada — roteiro enxuto em 9 passos (preparar 6 alunas + Visitante em Pessoas; os 4 tipos; turma de 4 semanas; presença cronometrada; mesmo cadastro em Clientes; Recebi agora/Lançar na Venda/cancelar no Caixa; uso livre com 2 materiais; lista cheia; site em janela anônima; cancelar não apaga; limpeza) — detalhado na Parte 2 de `05-VERIFICACAO-HUMANA.md` (D.1–D.50 podem ficar para depois). 🔴 desmarcar "Mostrar no calendário público" em todo lançamento de teste. Antes de tudo, o Passo 8 do Roteiro 17: preço da hora do "Uso livre (hora)" em Cadastros → Catálogo. Depois do "aprovado": AGE-01..20, `05-16-SUMMARY.md`, verificação da fase. **Em paralelo:** a tarefa das fontes locais (janela 60) — o Theo a inicia em outra sessão.

> **🟢 ATUALIZAÇÃO DE 02/10/2026, ~10h40 UTC — `0026` APLICADA PELO THEO; A AGENDA ESTÁ NO AR E GRAVANDO. FALTAM O PASSO 8 E A CAMINHADA.**
> Passo 5: `ferramentas` puxada, `0026_agenda.sql` dentro da imagem, `db:migrate` → "Migrações aplicadas com sucesso." e `0` (saída colada no chat). Passo 6 (medido às 10:35 UTC): `/api/health/agenda` 200 `{"status":"ok"}`; `/api/health`, `/estoque`, `/producao`, `/backup` 200. Passo 7 (saídas coladas pelo Theo): as 8 tabelas; `pode_apagar = f` em clientes, turmas, turma_alunos, mensalidades; `destino_saida` termina em `uso_livre`; os 3 itens do sistema sem preço, ativos, nas categorias "Aulas e oficinas"/"Uso do espaço"; `nome_normalizado` → "joao da silva"; documentos 20 · parcelas 26 · movimentacoes 13 (iguais ao Passo 2), 0 vendas com pessoa, 27 migrações (26 + 1). A janela da D-15 durou de 03:46 a ~10:30 UTC, sem lançamento perdido (contagens iguais).
> **Próximo (Theo):** Passo 8 no celular (preço da hora do "Uso livre (hora)" em Cadastros → Catálogo; Agenda, "A receber" e Início) e a caminhada (Parte 2 de `05-VERIFICACAO-HUMANA.md`). Depois do "aprovado": AGE-01..20 marcados, `05-16-SUMMARY.md`, verificação da fase.

> **🔴 ATUALIZAÇÃO DE 02/10/2026, ~03h50 UTC — FASE 5 (AGENDA) PUBLICADA; A JANELA DA D-15 ESTÁ ABERTA: FALTA O `db:migrate` (ROTEIRO 17, PASSO 5), DO THEO.**
> Roteiro 17 até o Passo 4: Parte 0 respondida pelo Theo (WhatsApp real 5562994817661, `6dc5417`; tudo mais "Fica", `29ab8de`); dados dos últimos 14 dias confirmados como teste; contagens do Passo 2: documentos 20, parcelas 26, movimentacoes 13, migrações 26; backup do Passo 3 às 02:28 UTC (`sucesso = t`, destino externo ok, `/opt/amassa/backups/amassa-2026-10-01-2328.sql.gz`, 35.424 bytes). Merge `627c1d9` e push com o "pode publicar" dele; o run `36956290624` caiu no e2e (1 teste: a 320px a barra da semana estourava a largura no Linux do CI) — nada foi implantado; corrigido em `9b640e2` (gsd-debugger) e publicado com a autorização dele ("pode dar o push … corrige e dá de novo se precisar"); run `36959745229` verde nos quatro jobs, implantar às 03:46 UTC.
> **Como sei:** `gh run view 36959745229`; `/api/health/agenda` = **503** (código novo no ar, `0026` não aplicada — a rota faz select de coluna que a migração cria), `/api/health/producao` e `/backup` = 200, medidos às ~03h50 UTC. **Até o `db:migrate`, toda venda, despesa, aprovação e baixa falha.**
> **Próximo (Theo, no servidor):** Roteiro 17, Passo 5 (`docker compose pull ferramentas` → conferir `0026_agenda.sql` na imagem → `docker compose run --rm ferramentas npm run db:migrate`), depois Passos 6–8 e a caminhada (Parte 2). Os Roteiros 14–17 tinham o caminho de backup errado (`dados/backups`); corrigido em `ff21c14`.

> **🟡 ATUALIZAÇÃO DE 02/10/2026, ~01h15 UTC (22h15 de 01/10 em Brasília) — FASE 5 (AGENDA): CÓDIGO COMPLETO NO BRANCH `gsd/phase-05-agenda`, NÃO PUBLICADO. AGUARDANDO O THEO. A `0026` NÃO ESTÁ APLICADA EM LUGAR NENHUM.**
> O plano 05-16 (o portão) fez a parte do executor e parou no checkpoint do Theo: `/api/health/agenda` + o Roteiro 17 (`docs/operacao/17-migracao-agenda.md`) + a caminhada (`.planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md`) em `f82261f`; a única varredura e2e completa da fase e o `test:site-sem-banco`; uma correção de teste em `d4fc10a`. O `05-16-SUMMARY.md` é escrito depois do "aprovado" dele.
> **Como sei (medido em 02/10/2026, 01h11 UTC):** `git ls-remote origin refs/heads/main` = `cfd0990` = `origin/main` = `main` local, e `git log origin/main..main` vazio (nada local esperando `push`); `gh run list` — o último run é o `36822643805` (`cfd0990`, 01/10 06h01 UTC, verde); `curl https://amassacerrado.com.br/api/health/agenda` = **404** (a rota só existe no branch), `/api/health/backup` = 200, `/api/health/producao` = 200; `git log main..gsd/phase-05-agenda` = 89 commits (mais o desta atualização); `git log main -- lib/agenda components/amassa/agenda` só traz os dois commits da Fase 04.6 (`fbdecb2`, `223748a`) — nenhum desta fase em `main`. **No branch:** `npm run verificar` verde depois da correção (114 ações, 2287 testes, `test:migracoes`); a varredura completa (`f82261f`, 00h48–01h03 UTC): **1127 passed · 19 failed · 0 flaky · 9 skipped · 52 did not run** — **nenhuma falha da Agenda** (215 `ok` nos 25 specs novos); 4 falhas causadas pela fase — dois e2e da Agenda semeavam uma venda paga com a data futura da oficina, o que derrubou `financeiro-caixa:151` e `financeiro-tracador:23` nos dois projetos —, corrigidas em `d4fc10a` e reverificadas com um `--grep` (104 passed; o único vermelho dele, `rotas:168` desktop, passou isolado); as outras 15 são janelas conhecidas (#3/#34, #32, #35, #50, #51, #57) ou contenção que passou na reexecução. `npm run test:site-sem-banco`: "Todas as etapas passaram." **45 invocações de e2e na fase** (41 nos planos 01–15, segundo os SUMMARY; 4 no 16). Detalhe spec a spec em `Claude outputs/RETRATO-DA-SUITE.md`. Nenhum requisito AGE marcado (só a caminhada marca).
> **🔴 O que depende do Theo, nesta ordem:** (1) **a Parte 0 da caminhada** — as decisões tomadas sem ele (primeiro as de dinheiro, §0.2), e **o número real do WhatsApp** (`CONTEUDO_SITE.zap` ainda é o placeholder `5562900000000`, já no ar no botão geral do site desde a 04.6; com a fase vai também em todo "Reservar pelo WhatsApp"); troca vira commit no branch + `npm run verificar` antes do Passo 4; (2) **o Roteiro 17**: guarda e "a plataforma continua fora de uso real hoje?" (a condição da D-15) → contagem antes (inclui os itens de Catálogo com o nome da semente) → backup → `git merge --no-ff gsd/phase-05-agenda` + `git push` → esperar o `implantar` → `db:migrate` logo em seguida → `/api/health/agenda` 200 → SQL → o preço do "Uso livre (hora)" em Cadastros; (3) **a caminhada no celular** (Parte 2: os 9 critérios, a presença de uma turma de 6 cronometrada, o site numa janela anônima, as 50 conferências). Cópias de leitura do roteiro e da caminhada, fora do git: `Claude outputs/agenda/`.

> **🟡 ATUALIZAÇÃO DE 01/10/2026, ~23h10 UTC — FASE 5 (AGENDA): 15 DE 16 PLANOS FEITOS NO BRANCH `gsd/phase-05-agenda`. FALTA SÓ O PLANO 16, O PORTÃO DO THEO. NADA PUBLICADO, `0026` NÃO APLICADA.** *(Retrato de 01/10, 23h10 UTC; o plano 16 rodou na noite seguinte — ver o bloco acima.)*
> Executados nesta sessão (a pedido do Theo, `/gsd-execute-phase 5`, executores em Opus, um plano por vez): 05-03 lançar avulsa e dia fechado · 05-04 cadastro de clientes · 05-05 seletor e colocar alguém · 05-06 turma fixa · 05-07 entrar na turma e mensalidade · 05-08 presença, reposição, experimental · 05-09 uso livre · 05-10 material → Estoque · 05-11 `gravarVenda`, "A receber", "Recebi agora" · 05-12 "Lançar na Venda" e o lote · 05-13 dispensar, etiquetas de pagamento, venda cancelada com o Caixa real · 05-14 Início e Números · 05-15 calendário público do site e a aba "No site".
> **Como sei:** `git log main..gsd/phase-05-agenda` = 87 commits; 15 `05-NN-SUMMARY.md` com "Self-Check: PASSED"; `npm run verificar` verde no fim de cada plano (2287 testes no 15) e e2e com `--grep` verdes, segundo os SUMMARY; `main` = `origin/main` = `cfd0990`. Vários planos passaram do orçamento de uma invocação de e2e por tarefa (registrado em cada SUMMARY). A varredura completa sem `--grep` ainda não rodou — é do plano 16.
> **Para a Parte 0 do portão (além do "Decidido sem o Theo" de cada SUMMARY):** (1) **regra de dinheiro corrigida no 05-07:** a mensalidade que nasce ao abrir (D-02) vale para quem já era aluno ANTES do dia 1; quem entra durante o mês tem a dela decidida pela ação de entrar (evita mensalidade cheia para quem entrou sem aula restante; desfazer: `<` → `<=` em `garantirMensalidadesDoMes`); (2) **conformidade no 05-08:** quem tem aula a repor também aparece em "qualquer pessoa" (BRIEFING §4) — numa oficina pode entrar pagando; (3) relançar cobrança de venda cancelada re-aponta o vínculo para a venda nova (sem histórico de vínculos); (4) a linha da Agenda na Venda continua com valor editável (UI-SPEC); (5) **o número do WhatsApp do site é o placeholder `5562900000000`** e já vai em todo "Reservar pelo WhatsApp" — confirmar o real antes de publicar; (6) antes de aplicar a `0026`, conferir se produção tem item de catálogo chamado "Mensalidade", "Inscrição em oficina" ou "Uso livre (hora)" (consulta no `05-01-SUMMARY.md`); (7) o run `36802909361` (push de documentos `b019cbb`, 01/10) falhou ao montar a imagem — o `next/font/google` não baixou a fonte durante o build; o run seguinte passou; risco de rede no build, sem relação com a Agenda.
> **Próximo:** `/gsd-execute-phase 5` — executa só o 05-16: rota de saúde, Roteiro 17, varredura e2e completa + `test:site-sem-banco`, e para no checkpoint do Theo (Parte 0 → roteiro de publicação com backup e `db:migrate` logo depois do deploy, D-15 → caminhada no celular). O checkout está no branch `gsd/phase-05-agenda`. *(Feito em 02/10/2026, ~01h15 UTC — ver o bloco acima.)*

> **🟡 ATUALIZAÇÃO DE 01/10/2026, ~06h45 UTC — FASE 5 (AGENDA) EM EXECUÇÃO: PLANOS 01 E 02 DE 16 FEITOS, NO BRANCH `gsd/phase-05-agenda`. NADA PUBLICADO, NENHUMA MIGRAÇÃO APLICADA.**
> O Theo pediu, com 1h30 até uma pausa, para rodar os planos 01 e 02 e parar. **05-01** (25 min): a migração `0026_agenda.sql` inteira (versionada, **não aplicada**) e o traçador — a oficina de hoje na semana, a lista por `?evento=`, "Veio" em um toque que grava e sobrevive ao recarregar; 13 decisões sem o Theo no `05-01-SUMMARY.md`; o teste `@vazio-global` do Catálogo passou a esperar os três itens do sistema. **05-02** (11 min): `conferirAgenda` completa no Postgres efêmero — e ela **achou um defeito real na `0026`, corrigido** (o check `inscricoes_direito_so_com_falta` aceitava direito a repor com presença nula); os três itens "do sistema" em Cadastros, com o preço da hora cadastrável e desativação impossível.
> **Como sei:** `git log --oneline main..gsd/phase-05-agenda` = 8 commits (3db116d..0df9a88 + o desta atualização); `main` = `origin/main` = `cfd0990`; os dois SUMMARY com "Self-Check: PASSED"; `npm run verificar` verde no fim de cada plano (1865 testes, `test:migracoes`), e2e com `--grep` 80/80 e 66/66, segundo os SUMMARY.
> **Próximo:** `/gsd-execute-phase 5` retoma no plano 03 (o checkout está no branch `gsd/phase-05-agenda`). *(Feito em 01/10, tarde e noite — ver o bloco acima.)* **Para o portão (Parte 0):** antes de aplicar a `0026`, conferir se produção já tem item de catálogo chamado "Mensalidade", "Inscrição em oficina" ou "Uso livre (hora)" (o nome não é único — a consulta está no `05-01-SUMMARY.md`).

> **🟢 ATUALIZAÇÃO DE 01/10/2026, MANHÃ (UTC) — FASE 5 (AGENDA) PLANEJADA: 16 PLANOS. NADA EXECUTADO, NADA PUBLICADO.**
> No `/gsd-plan-phase 5` (todos os agentes em Opus, pedido do Theo): pesquisa (`bba6cd7`) com as dez perguntas abertas respondidas por ele no chat → **D-08..D-18** (`bcd21bf`; a D-15, escrita à mão: uma publicação e o `db:migrate` logo depois, "nao tem importancia o site falhar agora"); validação (`ce11cd9`); **UI-SPEC aprovado** pelo verificador de UI, com as quatro escolhas de tela dele (`2c5c4e0`); mapa de padrões (`a166efb`); sonda de bordas dos AGE-01..20 (97, 96 com critério, 1 checagem) e de estados de tela (195, 146 com critério, 49 checagem), tipos escritos à mão; **16 planos** sequenciais (`05-01`..`05-16`, uma onda cada, branch `gsd/phase-05-agenda` criado pelo plano 01), verificados pelo `gsd-plan-checker` — 5 avisos na primeira passada, corrigidos, **aprovado na segunda**; portões de cobertura: AGE 20/20, decisões 18/18, lacunas 38/38. O plano 16 é o portão do Theo (Parte 0 com as decisões tomadas sem ele, Roteiro 17, caminhada).
> **Como sei:** os commits citados; `ls .planning/phases/05-agenda/05-*-PLAN.md` = 16; nenhum `SUMMARY` na pasta; o branch `gsd/phase-05-agenda` não existe ainda (`git branch`).
> **Próximo:** `/gsd-execute-phase 5`, quando o Theo quiser. **Para a Parte 0 (decidido sem ele, cada um reversível):** proporcional sem aula restante no mês = sem mensalidade; aluno ativo no dia 1 que sai depois fica com a do mês (dispensável); desativar turma apaga as datas futuras e recusa se alguma já virou venda ativa; seletor de pessoa mostra até 8 por grupo; oficina pode ter preço R$ 0 (não vira cobrança); experimental que falta pode ganhar crédito de reposição; e confirmar o número real do WhatsApp do site (`conteudo/site.ts` tem `5562900000000`, cara de placeholder) antes de o botão "Reservar pelo WhatsApp" ir ao ar.

> **🟢 ATUALIZAÇÃO DE 01/10/2026, ~02h UTC — FASE 5 (AGENDA) DISCUTIDA; NADA PLANEJADO NEM EXECUTADO.**
> O Theo respondeu no chat os quatro pontos da §11 do briefing e três buracos achados na discussão — sete decisões, D-01..D-07, todas pela recomendação (`.planning/phases/05-agenda/05-CONTEXT.md`, `2a0a477`). A mais pesada: **o "cadastro de clientes do Financeiro" que o briefing pressupõe não existia** (a Venda guarda `pessoa_nome` em texto) — **nasce nesta fase** (D-01). Também: mensalidade nasce ao abrir a tela, idempotente (D-02); folha de turma simples (D-03); um item "Mensalidade" só, preço da turma (D-04, contra a proposta do briefing); "Agora no espaço" = uso livre com "Chegou" + inscritos de aula em curso (D-05); destino novo "Uso livre do espaço", área Espaço (D-06); aula experimental cobrada ou gratuita, decidido na hora (D-07). Antes: `BRIEFING.md` e `prototipo.html` copiados para `.planning/phases/05-agenda/` (idênticos, `cmp`), ROADMAP com a Fase 5 "Agenda" e REQUIREMENTS com **AGE-01..20** (os antigos eram **AGD-01..16**, nunca executados, ficaram como registro) — `14dffb7`.
> **Produção (medido às 01h47 UTC):** o `3a1ef2d` está no ar — run `36801218591` verde em todos os jobs, "Implantar no VPS" às 01h45 UTC; `/api/health/producao` e `/api/health/backup` 200. **Local, não publicado:** só documento — `git log origin/main..main` mostra `62d8832`, `390e84f`, `14dffb7`, `2a0a477` e o desta atualização.
> **Próximo:** `/gsd-plan-phase 5` (com pesquisa), quando o Theo quiser — ele pediu para não planejar antes de responder a discussão, e a discussão acabou de fechar. *(Feito na mesma manhã de 01/10 — ver o bloco acima.)*

> **🟢 ATUALIZAÇÃO DE 01/10/2026, ~01h30 UTC (22h30 de 30/09 em Brasília) — FASE 06.1 FECHADA; PRÓXIMA: AGENDA.**
> Produção no ar desde 30/09 (merge `1846563`, `0024`/`0025` aplicadas pelo Theo depois de backup), caminhada aprovada por ele, verificação `passed` 8/8 com `behavior_unverified: 0` (sonda de concorrência `7a4a9a9`). **Em produção:** `4bce84f` — run `36799259189` verde; ele confirmou numa ordem nova "esmaltação ta com 4 dias". **Publicado depois:** `3a1ef2d` (sonda de concorrência + "Tentar de novo" com `retry` nas 11 telas de erro antigas) — run `36801218591` **em andamento** às 01h29 UTC; conferir com `gh run list` antes de afirmar que está no ar. *(01/10, 01h47 UTC: terminou verde, implantado às 01h45 — ver o bloco acima.)* **Local, não publicado:** só commits de documento (`62d8832` e o desta atualização) — `git log origin/main..main`.
> **Próximo (escolha do Theo, 01/10):** a **Agenda** (item 6 da fila; Fase 5 do ROADMAP), antes das Queimas. Primeiro passo: copiar `Claude outputs/agenda/BRIEFING.md` e `prototipo.html` para a pasta da fase, atualizar ROADMAP e REQUIREMENTS (os AGE-* antigos descrevem outro modelo), e `/gsd-discuss-phase 5` com os quatro pontos da §11 do briefing. **Pendências para o Polimento:** a edição velha da ficha (Pending Todos do `STATE.md`).


*Até 01/10/2026 este título dizia "2026-09-30 (manhã, Fase 06.1 com o código completo no branch; aguardando você)".*

> **🟢 ATUALIZAÇÃO DE 01/10/2026, MADRUGADA — A FASE 06.1 (PRODUÇÃO) ESTÁ CONCLUÍDA E NO AR.** Como sei: merge `1846563` em `origin/main` e run `36769632264` verde (30/09, 20h UTC); `db:migrate` com as `0024`/`0025` rodado pelo Theo depois de backup (saída e conferência SQL coladas no chat: 26 migrações, tabelas novas presentes, `encomenda*` ausentes); `/api/health/producao` 200 medido em 01/10 00h30 UTC; caminhada aprovada por ele no chat; Cowork sem 🔴 (`Claude outputs/producao/VERIFICACAO-COWORK-06.1.md`); verificação da fase `passed` 8/8 (`06.1-VERIFICATION.md`). Correções da aprovação (dias padrão Esmaltação 4 / Queima de esmalte 1; "Quantas" seleciona tudo; horas com as a mais) publicadas pelo Code com autorização dele — ver o run seguinte em `gh run list`. Próximo: o que a fila indicar, quando ele quiser. *O bloco 🟡 abaixo é o retrato de 30/09.*


*Até 30/09/2026, ~11h UTC, este título dizia "madrugada, Fase 06.1 planejada".*

> **Adendo de 30/09/2026, tarde — Parte 0 respondida pelo Theo e aplicada no branch** (`e335e2b`, `4b29211`..`6910df8`, `06.1-PARTE0-AJUSTES.md`; `npm run verificar` verde e e2e 234 passed). Próximo, dele: Roteiro 16 → caminhada.


> **Adendo de 30/09/2026, ~12h45 UTC — revisão de código antes do portão:** 112 arquivos de produção revisados em duas partes (`06.1-REVIEW.md`, `a4c00f3`): 0 bloqueios, 11 avisos, 18 informativos. **10 avisos corrigidos** mais IN-02 e IN-08 (texto do Roteiro 16: entre o deploy e o `db:migrate` quebram também todo cancelamento no Caixa e toda gravação no Estoque) — `06.1-REVIEW-FIX.md` (`813f547`). Como sei: `npm run verificar` verde (85 ações, 1792 testes, `test:migracoes`); e2e `--grep "producao|estoque movimentacao"` 217 passed/1 failed (`producao-quadro:153`, a regex do teste casou com o sufixo aleatório do nome — falha do teste, não do código) e `--grep "producao quadro"` 54 passed. **O WR-01 ficou com você**, na Parte 0, §0.6 (ordem da casa com ficha que vira exclusiva no meio da produção não conclui — recomendado: recusar tornar exclusiva a ficha usada por ordem da casa ativa), junto com a confirmação do WR-03 (o seletor da casa só oferece itens em `un`).

> **🟡 ATUALIZAÇÃO DE 30/09/2026, MANHÃ (~11h UTC) — A FASE 06.1 (PRODUÇÃO) ESTÁ COM O CÓDIGO
> COMPLETO NO BRANCH `gsd/phase-06.1-producao`, NÃO PUBLICADO. AGUARDANDO VOCÊ.** Os 15 planos rodaram
> (o 15, o portão, até a parte do executor): a Produção em `/gestao/producao`, o módulo antigo de
> Encomendas apagado do código, `/gestao/encomendas*` redirecionando, as migrações `0024` e `0025`
> escritas e provadas no Postgres de teste — **não aplicadas** —, `/api/health/producao`, o Roteiro 16
> e a caminhada.
>
> **Como sei (medido em 30/09/2026, 11h08 UTC):**
> - **Nada publicado:** `git ls-remote origin refs/heads/main` = `cd7453e` (o mesmo do `origin/main`
>   local); `git log origin/main..main` = 12 commits, todos `docs(06.1)` da preparação da fase
>   (`ef8d598`..`9e7c6e7`); `gh run list` — o último run é o `36641765972` (`cd7453e`, 29/09 22h48
>   UTC, verde), nenhum depois; `curl https://amassacerrado.com.br/api/health/producao` = **404** (a
>   rota só existe no branch), `/api/health/backup` = 200, `/gestao/encomendas` = 307 para o login (o
>   módulo antigo ainda no ar).
> - **O branch:** `git log main..gsd/phase-06.1-producao` com os commits dos planos 01 a 15;
>   `npm run verificar` verde no último (85 ações, 1776 testes, `test:migracoes` com a `0024` e a
>   `0025` provadas em banco próprio). A única varredura e2e completa da fase (30/09, 11h08 UTC,
>   `39f0982`): **917 passed · 14 failed · 1 flaky · 7 skipped · 49 did not run** — **nenhuma falha
>   da Produção** (157 testes `producao` passaram); uma falha causada pela fase (`design-system:58`,
>   corrida com o esqueleto da Produção) corrigida em `27b7125`; as outras são janelas conhecidas ou
>   passaram em série, e `financeiro-mes:114` (celular) virou a janela #62. Detalhe no
>   `06.1-15-SUMMARY.md` e em `Claude outputs/RETRATO-DA-SUITE.md`. **34 invocações de e2e na fase**
>   (30 nos planos 01–14, 4 no 15).
> - Nenhum requisito PRD marcado (só a caminhada marca).
>
> **🔴 O que depende de você, nesta ordem:**
> 1. **A Parte 0** de `.planning/phases/06.1-producao/06.1-VERIFICACAO-HUMANA.md` — as decisões
>    tomadas sem você na fase inteira, cada uma com "como desfazer"; primeiro UI-D4, UI-D3 e UI-D2, e
>    as que mudam o que o sistema grava (a correção do check da `0024`; o D-13 trocando a categoria de
>    compra do item para "Produção da casa"). Troca aqui é barata.
> 2. **O Roteiro 16** (`docs/operacao/16-migracao-producao.md`): guarda → contagem antes → backup →
>    `git merge --no-ff gsd/phase-06.1-producao` + `git push` → esperar o job `implantar` **terminar**
>    → `db:migrate` logo em seguida (a `0024` e a `0025` numa transação só) → `/api/health/producao`
>    200 → SQL depois → o celular → **anotar o dia da publicação** (se não for 30/09,
>    `DATA_DE_REMOCAO_DA_PRODUCAO` muda de `2027-03-30` para publicação + 6 meses).
> 3. **A caminhada no celular** (Parte 2): os 8 critérios, o "Terminei" em dois toques cronometrado e
>    as conferências de tela e de papel.
>
> Cópias de leitura do roteiro e da caminhada, fora do git: `Claude outputs/producao/`.

> **🟢 ATUALIZAÇÃO DE 30/09/2026, MADRUGADA — A FASE 06.1 (PRODUÇÃO) ESTÁ PLANEJADA. NADA FOI
> EXECUTADO NEM PUBLICADO.** *(Até ~02h45 de 30/09, quando a execução começou. Registro: o bloco acima
> é o presente.)* Você respondeu no chat, antes de dormir, as nove perguntas da pesquisa
> (D-09..D-17 no `06.1-CONTEXT.md`; a D-09 foi a sua: uma publicação e uma sessão de `db:migrate`) e
> autorizou seguir pelas recomendadas. Depois disso saíram, sem você, o UI-SPEC, o mapa de padrões e
> **15 planos** (`06.1-01..15`, uma onda cada, no branch `gsd/phase-06.1-producao` na execução).
> O bloco de 29/09 logo abaixo, que diz "item 5 da fila (Produção) … fases ainda por criar", foi
> superado: a 06.1 foi criada, discutida e planejada.
>
> **Como sei:** os 15 `PLAN.md` na pasta da fase; `check.decision-coverage-plan` 17/17; os 20 PRD nos
> `requirements` dos planos; o verificador de planos sem bloqueio (o único aviso, "4 tarefas", refutado
> por medição: cada plano tem 3). `git log origin/main..main` só com commits de documento.
>
> **O que fica com você, sem pressa:**
> 1. **Ler "Decidido sem o Theo — 06.1"** no topo do `.planning/STATE.md` — nove itens, cada um com
>    como desfazer. Os três de interface que mais pedem o seu olho: **UI-D2** (seis colunas só a
>    partir de 1280px), **UI-D3** (barra fixa do "Terminei" no celular) e **UI-D4** ("Desfazer" pede
>    confirmação), no `06.1-UI-SPEC.md`.
> 2. **O `push`** dos commits de documento desta noite, quando quiser.
> 3. **Quando quiser executar:** `/gsd-execute-phase 06.1`. O último plano (15) é o seu portão: o
>    Roteiro 16 — backup, publicação, esperar o job `implantar`, `db:migrate`, `/api/health/producao`,
>    conferir as ordens do D-02, abrir um orçamento aprovado.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, FIM DA TARDE — A FASE 06 (ESTOQUE) ESTÁ CONCLUÍDA E NO AR.**
> Como sei: verificação da fase `passed`, 30 de 30 (`.planning/phases/06-estoque/06-VERIFICATION.md`,
> commit `2ed2d0b`); portão 06-11 aprovado pelo Theo no chat; `phase.complete` no ROADMAP; produção
> em `2345850` (run `36587755269` verde, `/api/health/estoque` 200). Os blocos abaixo que dizem
> "próximo: verificação da fase" foram superados. Os commits só de documentos do fechamento, no `main`
> local, esperam o `push` do Theo (`git log origin/main..main` mostra quais).
>
> **Próximo:** item 5 da fila (Produção) e/ou 6 (Agenda) — fases ainda por criar. O Theo já confirmou
> para a Produção: "pode sim zerar todos os dados. nada é real ainda." (29/09). Pendências pequenas
> e as 7 observações do Cowork estão em Pending Todos do `STATE.md`.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, TARDE — O ESTOQUE ESTÁ NO AR E O PORTÃO FOI APROVADO.** Você fez o
> Roteiro 15 e a caminhada e aprovou no chat ("repassei toda verificação. o cowork tambem verificou.
> Aprovado."). O plano 06-11 está concluído; os 11 planos da fase também. **Próximo: a verificação
> da fase e o `phase.complete`** (do orquestrador — nada depende de você para isso).
>
> **Como sei:**
> - **Produção em `2345850`** (o merge da fase): `git ls-remote origin refs/heads/main` =
>   `234585063890…` (16:15 UTC); run `36587755269` verde; `/api/health/estoque` 200
>   `{"status":"ok"}`; a `0023` conferida no banco pelo SQL que você colou (Passo 5).
> - **Cowork** verificou em produção (`Claude outputs/estoque/VERIFICACAO-COWORK-06.md`): 19 passos,
>   nenhum 🔴, 7 observações que não bloqueiam — em `.planning/STATE.md`, Pending Todos.
> - **EST-01..21 marcados** em `REQUIREMENTS.md`, com a evidência de cada um; o EST-09 (< 15 s) só
>   pela sua aprovação, porque os tempos não vieram.
>
> **O que fica com você, sem pressa:**
> 1. **Terminar a contagem inicial**, se ainda não terminou: às 12h46 o Cowork viu "2 de 7 contados
>    hoje" — só o "Bolo do dia" era seu. `/gestao/estoque/contagem`.
> 2. **As decisões `[auto]`** das §0.3/§0.4/§0.5 de `06-VERIFICACAO-HUMANA.md` — valem como estão até
>    você pedir troca. O Cowork destacou perda paga por Peças (D-14), saldo negativo dentro de
>    "Acabando" (D-21) e material desativado nunca avisar.
> 3. **Custo vazio na entrada manual** recusa (zero digitado aceita) — está certo assim?
> 4. **"Andressa salvou às 15h45"** nas Anotações do Início às 13h de Brasília — hora em UTC ou data
>    faltando? Confira com ela.
> 5. **O `push` deste fechamento** (só documentos em `.planning/`) é seu, quando quiser.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, MANHÃ (~09h30 UTC) — PARTE 0 RESPONDIDA E APLICADA. O PRÓXIMO PASSO
> É O ROTEIRO 15.** Você respondeu a Parte 0 no chat, por formulário: **D-23 vale, D-24 vale, WR-01 e
> WR-02 pela alternativa, D-29 sim ("Produção da casa", área Peças).**
>
> **Como sei (medido nesta manhã):**
> - **Código (WR-01, WR-02):** `f05c373` no branch `gsd/phase-06-estoque` — estorno de venda com
>   saldo zero ou negativo volta ao custo médio do instante; estorno de venda não conta como "última
>   entrada com preço". **Migração (D-29):** `b13d300` — a semente idempotente no fim da `0023`.
>   **Documentos:** `a69bb69` (caminhada, contexto, Roteiro 15 com o novo Passo 5.5).
> - **Branch só-migração em `0848b8c`** (um commit novo sobre `2907667`): `git diff --name-only main
>   gsd/phase-06-estoque-migracao` = os quatro arquivos, idênticos aos do branch da fase.
> - **`npm run verificar` exit 0 nos dois branches** (fase: 1627 testes; só-migração: 1325 testes;
>   `test:migracoes` passou nos dois, com a categoria contada 1 depois de migrar e depois de
>   reaplicar). E2e `--grep "estoque financeiro|estoque abas|estoque material|cadastros"`: 140
>   passed, 2 skipped.
> - Nada publicado, nenhuma migração aplicada, nenhum requisito EST marcado.
>
> **🔴 O que depende de você, nesta ordem:**
> 1. **Roteiro 15** (`docs/operacao/15-migracao-estoque.md`, a partir do Passo 1; o Passo 0 está
>    feito). O Passo 2 publica o só-migração `0848b8c`; o Passo 5.5 é novo (a categoria, contada 1).
> 2. **A contagem inicial real e a Parte 2 da caminhada**, no celular, com cronômetro na baixa.

> **🟡 ATUALIZAÇÃO DE 29/09/2026, MANHÃ (antes da Parte 0) — A FASE 06 (ESTOQUE) ESTÁ PRONTA NO BRANCH E ESPERA VOCÊ.**
> Nada dela está no ar, de propósito: o código grava dentro de toda venda e compra, e se subir antes
> da migração `0023`, toda venda quebra (D-33).
>
> **Como sei (medido nesta manhã):**
> - **Código completo no branch `gsd/phase-06-estoque`** — 11 planos, 06-01 a 06-10 concluídos e o
>   06-11 (o portão) com as Tarefas 1 e 2 feitas: `/api/health/estoque`, o Roteiro 15, a caminhada
>   `06-VERIFICACAO-HUMANA.md`, e a única varredura completa da fase — `948 passed · 12 failed · 1
>   flaky · 38 skipped · 61 did not run`, **nenhuma falha do Estoque**, todas classificadas
>   (`Claude outputs/RETRATO-DA-SUITE.md`). `npm run verificar` verde.
> - **Revisão de código rodada ANTES do seu portão** (`06-REVIEW.md`): 0 bloqueios, 5 avisos. Três
>   corrigidos (WR-03 custo da contagem, WR-04 roteiro, WR-05 diálogo do Catálogo — `06-REVIEW-FIX.md`,
>   `verificar` verde e um e2e com `--grep`, 66 passed). **WR-01 e WR-02 são regras de dinheiro do
>   cancelamento: ficaram com você**, na Parte 0, §0.1, com números.
> - **Pronto para o Passo 2 do roteiro:** o branch LOCAL `gsd/phase-06-estoque-migracao` leva só os
>   quatro arquivos da `0023` sobre o seu `main` local, com `npm run verificar` verde (refeito às ~09h
>   UTC sobre o `main` com os documentos sincronizados — hash no adendo do `06-11-SUMMARY.md`).
> - **Produção continua em `ecdca87`** (`git ls-remote`), run `36509335475` verde o mais recente
>   (`gh run list`), `/api/health/backup` 200, `/api/health/estoque` 404 (esperado: não publicado).
>   `git log origin/main..main` = **17 commits** locais — o bloco da madrugada, logo abaixo, dizia 7;
>   vieram depois o fechamento da 04.6 e o planejamento da Fase 06 (só documentos). O SIT-10 continua
>   fora do ar (`grep -c 'hidden gap-2 md:flex'` = 0).
>
> **🔴 O que depende de você, nesta ordem:** *(retrato de antes da Parte 0 — o item 1 foi FEITO em
> 29/09 de manhã, ver o bloco acima; o branch só-migração agora está em `0848b8c`)*
> 1. ~~**`06-VERIFICACAO-HUMANA.md`, Parte 0**~~ — ✅ respondida em 29/09/2026, manhã — confirmar ou trocar **D-23/D-24** (o valor do estorno,
>    com o exemplo em números), responder **D-29**, e escolher nas duas questões da revisão (**WR-01**:
>    estorno de venda com saldo zerado ou negativo; **WR-02**: se o estorno conta como "última
>    entrada com preço"). Antes de qualquer comando no servidor.
> 2. **Roteiro 15** (`docs/operacao/15-migracao-estoque.md`): publicar só a migração → backup →
>    `0023` → conferência SQL → publicar o código → `/api/health/estoque`. O `push` do Passo 2 leva
>    junto os commits locais de `main` — os 17 da lista do `06-11-SUMMARY.md` mais os commits
>    de documentos que sincronizaram o `main` (entre eles o SIT-10).
> 3. **A contagem inicial real e a Parte 2 da caminhada**, no celular, com cronômetro na baixa.
> 4. As decisões tomadas sem você: "Decidido sem o Theo" no topo de `.planning/STATE.md` (itens 1 a
>    28) e a Parte 0 da caminhada.

> **🟢 ATUALIZAÇÃO DE 29/09/2026, MADRUGADA — A FASE 04.6 ESTÁ FECHADA.** O que vem logo abaixo
> deste bloco é o retrato de 29/09 de manhã cedo e dizia, no presente, "falta o fechamento formal e
> o push de 6 commits" — as duas coisas aconteceram depois. Mantido como registro.
>
> **Como sei (medido, não afirmado):**
> - **Fechamento formal feito:** verificação da fase `passed`, 9 de 9 — os 8 critérios do ROADMAP e
>   os 24 requisitos (commit `e3527e4`); `phase.complete` em `598fbc7`; ROADMAP com a 04.6 marcada.
> - **Revisão de código rodou antes** (`82ac7c2`): 4 bloqueadores, **todos conferidos no código**
>   pelo orquestrador, e o dono mandou corrigir antes de fechar. Corrigidos 7 achados em 9 commits
>   (`2604b1a`..`9605a8d`, relatório `d835434`) — entre eles **perda de texto nas Anotações** (a
>   gravação pendente era cancelada ao sair da tela, com o indicador dizendo "salvo") e o **aviso de
>   conflito contra a própria gravação**; encomenda atrasada aparecendo como "Em espera"; e ~65
>   navegações ainda nos endereços antigos, que só funcionavam pelo redirecionamento temporário.
> - **Essas correções ESTÃO no ar:** o dono deu o push; `gh run list` mostra o run `36509335475`
>   verde nos quatro jobs, inclusive `Implantar no VPS`; e o `<html>` de produção traz
>   `data-scroll-behavior="smooth"`, atributo que só essas correções introduziram.
> - **Varredura completa sobre o código corrigido:** `826 passed · 10 failed · 1 flaky · 37 skipped ·
>   48 did not run`. Spec a spec: 7 falhas são as janelas antigas conhecidas; 3 eram novas
>   (`rotas.spec.ts:168`, `sessao.spec.ts:111`, `financeiro-venda.spec.ts:495`) e **passaram
>   isoladas nos dois viewports** — contenção de carga, não regressão. Os "did not run" são a cadeia
>   `parametros-*`, estrutural e anterior à fase.
> - **O verificador achou um defeito que ninguém tinha visto:** no celular, a barra de cima do site
>   cortava o botão "Encomendas" (em 375px lia-se "Encom"). Confirmado em produção por screenshot,
>   corrigido em `748b1c6` (teste vermelho) → `ddfecfd` (verde), seguindo o protótipo aprovado,
>   que esconde esses botões no celular. **Esta correção NÃO está no ar ainda.**
>
> **🔴 O que depende de você:**
> 1. **`git push`** — 7 commits locais (`git log origin/main..main` em 29/09 madrugada): a correção
>    da barra do site (`748b1c6`, `ddfecfd`) e documentos. Depois do deploy, confira:
>    `curl -s https://amassacerrado.com.br/ | grep -c 'hidden gap-2 md:flex'` deve dar **1**.
> 2. **As decisões tomadas sem você esta noite**, todas reversíveis e cada uma com o jeito de desfazer — ver "Decidido sem o Theo" no
>    topo do `.planning/STATE.md`.
> 3. **Uma mudança de comportamento para saber:** nas Anotações, com o aviso de conflito na tela,
>    digitar não o esconde mais — ele espera você escolher "manter o meu" ou "ver o dela". O jeito
>    antigo entrava em laço.
>
> **Em seguida:** Fase **06 — Estoque** (item 4 da fila), que o orquestrador segue durante a noite
> sob a sua autorização de 29/09 ("roda o máximo que puder em opções recomendadas").


> **A porta de entrada de qualquer sessão agora é `ESTADO-ATUAL.md`, na raiz do projeto** (mora só
> neste computador; está no `.gitignore`). Ele tem o negócio, o que está no ar, a ordem de trabalho e
> as pendências. Este arquivo continua valendo pelas **lições técnicas** da seção "O que a Fase 4.2
> ensinou". Se os dois divergirem sobre prioridade, o `ESTADO-ATUAL.md` vence.

## Ordem atual

> ⚠️ **A lista de 2026-09-17 abaixo está cumprida ou superada.** Atualizada em 2026-09-29. A ordem
> de trabalho de verdade mora em `Claude outputs/FILA-DO-CODE.md`, mantida pelo Cowork; esta seção
> só a espelha.

1. ~~**Fase 04.3 — Comparador de Compras**~~ — **concluída em 2026-09-18.** Depois dela vieram a
   **04.4** (Financeiro, parte 1, concluída em 26/09, verificada 9/9 + 17/17) e a **04.5**
   (Financeiro, parte 2 — Precificação e Orçamento, **concluída em 27/09**, 14 planos, 23 dos 25
   itens da verificação humana passando de primeira e os dois outros corrigidos no plano 14).

2. ~~**Fase 04.6 — plataforma em `/gestao`, Início novo, navegação e site público.**~~ **Executada em
   28/09 e com o portão humano percorrido em 28-29/09/2026** — 8 planos. *Fechamento formal feito na madrugada de 29/09 (`598fbc7`, verificação `e3527e4`); até então esta linha dizia "faltando apenas o
   fechamento formal pelo orquestrador (`phase.complete` + verificador)".* **Como sei:**
   `04.6-VERIFICACAO-HUMANA.md` tem os 16 itens respondidos, nenhum reprovado; o dono aplicou a
   migração `0022` pelo Roteiro 14 e colou as quatro conferências de fora (tabela, semente de 1
   linha, gatilho, `delete` revogado); `gh run list` em 29/09 mostra o run `36443052672` verde
   (2ª tentativa, commit `72b8881` — a 1ª caiu na busca de fonte do Google, transitório, janela 60
   do `WINDOWS.md` seguia aberta — *corrigida no código em 02/10/2026 pelo quick `261002-j98`,
   commit `5057c7e`, ainda não publicada*); e `curl` de fora em 29/09 devolve `/gestao` → 307 com
   `callbackUrl` no domínio público (GES-04 fechada). Detalhe: `04.6-08-SUMMARY.md`.
   **A última varredura e2e (`798 passed · 13 failed · 37 skipped · 74 did not run`) não
   exercitou tudo: os ~74 que não rodaram são a cadeia `parametros-*`**, estrutural e anterior à
   fase. **Não publicado ainda:** `223748a` (o espaço sem capacidade fixa) e `41ba169`
   (correção do Roteiro 14) estão só locais — `git log origin/main..main` em 29/09 mostrava 5
   commits antes do de fechamento; o `git push` é do dono.

   **Abertos que esta fase deixa:** os textos do site (o dono está preparando um lote de edições;
   registrado em `WINDOWS.md`) e a **ambiguidade do limite por turma** — ele decidiu que o
   *espaço* não tem capacidade fixa, mas a frase sobre "remover os avisos de lotação na agenda"
   servia também às *turmas*, e o máximo por turma é algo que ele disse querer. AGD-02/03/04 não
   foram tocados; voltar à mesa quando a Fase 5 for discutida.

   **Corrigido em 28/09 (execução do plano 08):** este arquivo dizia "falta executar
   `/gsd-execute-phase 04.6`". Os 8 planos executaram no mesmo dia (28/09) — o texto acima descrevia
   o estado ANTES da execução, preservado como registro logo abaixo. **A metade "não dar push sem
   confirmar" continua valendo:** o plano 08 é `autonomous: false` e põe o push, a migração `0022`
   e GES-04 em produção nas mãos dele — em 28/09 nada tinha sido publicado nem migrado em produção; **em 29/09 isso deixou de ser verdade** (ver o parágrafo do item 2 acima: o dono publicou, migrou e conferiu). O que continua sem push são só `223748a`, `41ba169` e o commit de fechamento.

   **Correção do que este arquivo dizia antes:** o planejamento do site **não** está mais fora do
   repositório, e **não há mais "Em breve"**. O dono aprovou o protótipo do site inteiro em
   26/09 (`Claude outputs/site/`), que substituiu a página provisória; o marco "M8 — Página Em
   breve" do `amassa-cerrado` foi superado por essa decisão. Continua valendo o resto: não apague
   nem altere nada em `C:\Users\Andre\amassa-cerrado`.

3. **Fase 6 — Estoque**, com protótipo antes da execução — 🔒 depois da 04.6 estar no ar (item 4
   da fila). *(Condição cumprida em 29/09/2026: a 04.6 está no ar — deploy `72b8881`, run
   `36443052672` verde. **Atualizado em 29/09 de manhã:** a fase foi discutida em `--auto`, planejada e executada na noite de 29/09 sob a autorização dele; o código está no branch `gsd/phase-06-estoque`, não publicado, e o portão 06-11 espera o dono — ver o bloco do topo.)* O protótipo já foi aprovado em 18/09 e revisto em 20/09, e o **adendo**
   (`Claude outputs/estoque/ADENDO.md`) vence o briefing antigo. O restante deste arquivo, a
   partir de "Como começar", foi escrito para ela e continua valendo nas lições técnicas.

---

# Fase 6: Estoque (instruções originais de 2026-09-01)

## Como começar

O dono pediu, explicitamente, **protótipo antes da execução** — o mesmo caminho que deu certo na
Abertura do Espaço:

1. **Protótipo primeiro.** Um HTML interativo, publicado como Artifact (nunca arquivo estático: um
   arquivo fora da pasta do projeto vira captura sem interação, e os botões não funcionam). Iterar
   com o dono até ele dizer "vamos levar isso para a plataforma".
2. **Versionar o protótipo aprovado** em `.planning/phases/06-estoque/prototipo.html`. Na 4.2 ele
   virou a especificação: onde a prosa e o protótipo divergiam, **o protótipo vencia**.
3. Só então `/gsd-discuss-phase 6`, `/gsd-plan-phase 6`, `/gsd-execute-phase 6`.

Não comece pelo `/gsd-discuss-phase`. O dono decide melhor olhando uma tela do que respondendo
perguntas sobre uma tela.

## O que o ROADMAP já fixa (não reabra sem motivo)

**Objetivo**: saber o que existe, o que está acabando e para onde o material foi — **saldo sempre
derivado das movimentações, nunca uma coluna editável**.

Critérios de sucesso, verbatim:
1. Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
2. Material abaixo do mínimo aparece destacado na lista e no painel inicial
3. O histórico mostra toda movimentação com autor e data
4. **Não existe nenhuma forma de editar ou apagar uma movimentação pela interface** — só registrar um ajuste
5. Registrar uma baixa no celular leva menos de 15 segundos
6. O saldo mostrado bate com a soma manual do histórico

Requisitos: EST-01 a EST-12. Depende só da Fase 2b. `UI hint: yes` (tem fase de UI-SPEC).

## O que a Fase 4.2 ensinou e vale para o Estoque

Isto não é história — é o que vai economizar horas.

**1. Atualização de tela depois de gravar.** Existe um defeito de agendamento do React/Next em
produção: a confirmação de uma transição falha em silêncio numa fração dos toques. Medido no
servidor `standalone` (o mesmo do VPS): marcar um item não atualizava a tela em **83%** dos toques.
O padrão que resolveu, e que o Estoque deve nascer com ele:

- **Abrir diálogo, marcar, editar, fechar**: nunca dependem do servidor. A URL é escrita por
  `window.history.pushState` (ver `components/amassa/abertura/url-sem-navegar.ts`), que não dispara
  transição, e o estado que a tela mostra vem do cliente, que já o tem no instante do toque.
- **Gravar**: usa navegação COMPLETA (`window.location.assign`), porque só o servidor sabe o
  resultado. Custa um carregamento numa ação pouco frequente e sempre mostra a verdade.
- **`router.refresh()` depois de Server Action é o antipadrão.** O módulo Abertura não tem nenhum.

**Registro aberto nº 26**: Queimas e Encomendas ainda usam esse padrão. `queimas-registro.spec.ts:84`
("Desfazer") já falhou por isso numa varredura. Tem menos testes batendo nele, não é menos real.

**2. Prova destrutiva tem banco próprio.** `scripts/testar-migracoes.mjs` prova a migração de
remoção com `drop table` de verdade. Ela recebia o banco compartilhado; localmente era inofensivo
(Postgres efêmero próprio), mas em CI apagava as tabelas que o e2e ia usar em seguida — pipeline
vermelho sem defeito nenhum no módulo. Hoje ela cria `<banco>_remocao`, prova e apaga. **Se o
Estoque acrescentar qualquer verificação destrutiva, ela nasce com banco próprio.**

**3. O pipeline agora enxerga.** Quando o e2e reprova, ele guarda o log do contêiner e os artefatos
do Playwright (`error-context.md` traz o retrato da página no instante da falha). Foi isso que deu a
causa raiz em uma linha depois de horas de adivinhação. **Use os artefatos antes de tentar
reproduzir o ambiente do runner.**

**4. Rodapé de diálogo é preso por flex, nunca por `position: sticky`.** Ver
`.planning/debug/resolved/rodape-formulario-desktop.md`. Já reincidiu uma vez.

**5. Orçamento de e2e.** `npm run test:e2e` custa ~53s de imposto fixo. No máximo uma invocação por
tarefa, com `--grep`. A varredura completa roda uma vez por fase, no último plano. Na 4.2 ela rodou
oito vezes — foi necessário por causa do defeito, mas não é o padrão.

## Estado do projeto

- Fase 4.2 **completa e no ar**. Migrações 0010/0011 aplicadas à mão em produção em 2026-09-01,
  verificadas pelo psql (3 tabelas, 12 grants, 3 gatilhos). O dono testou no celular real.
- Pipeline verde nos quatro jobs. 385 testes passando.
- Ordem de execução: **4.2 (feita) → 6 (Estoque) → 5 (Agenda) → 7 (Polimento)**. A Agenda está em
  espera por decisão do dono.
- Registro de defeitos: 17 abertos em `.planning/WINDOWS.md`. O nº 26 é o mais relevante para quem
  for mexer em Queimas ou Encomendas.

## O que só o dono faz

- Aplicar migração em produção, à mão, depois de backup verificado. Nunca o agente, nunca o pipeline.
- Editar o `.env` do servidor.
- Testar no celular de verdade. Todos os números do agente vêm de navegador automatizado; a mão
  suja no ateliê é o único teste que decide.
