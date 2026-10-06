# Roteiro 22 — O Polimento: a publicação e a migração `0031`

**Quando rodar:** **uma vez**, para publicar a Fase 06.5 (Polimento), com o backup feito por você e olhando.
**Nunca pelo pipeline.** Escrito em 06/10/2026 pelo plano `06.5-11` e completado pelo `06.5-30`, sem ter sido rodado.
Se algum passo divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

**Passo 0:** responda a Parte 0 de `.planning/phases/06.5-polimento/06.5-VERIFICACAO-HUMANA.md` (escrita pelo
plano `06.5-30`). Se trocar alguma resposta, o executor ajusta no branch e roda `npm run verificar` antes de este
roteiro seguir.

---

## Resumo

**O que a `0031_polimento.sql` faz no banco.** Nada é apagado nem renomeado além da única trocada no primeiro item.

- **Conta fixa cancelada libera o mês** — a única `documentos_conta_fixa_mes_uk` sai e entra o índice único
  parcial `documentos_conta_fixa_mes_ativo_uk` (só entre os lançamentos não cancelados). É mais frouxo que a única:
  nenhum dado de hoje o viola. Duas contas ativas do mesmo mês continuam recusadas.
- **Três índices de leitura** — `movimentacoes_estoque_encomenda_idx`, `mensalidades_cliente_idx` e
  `usos_livres_cliente_idx`. Não mudam nenhum dado.
- **`correcoes_de_documento`** — o vínculo do “Corrigir” (original → corrigido). Nasce vazia e só cresce: o app
  pode ler e gravar, nunca alterar nem apagar.

**O que NÃO muda:** `.env`, `compose.yml`, `Caddyfile` (os cabeçalhos de segurança vêm **na imagem**, pelo
`next.config.ts`, e o Caddy não é tocado), as pastas do host, os scripts de backup e o cron.

**Provada, não aplicada:** rodou no Postgres efêmero de `npm run test:migracoes` (`conferirPolimento` e a prova da
janela, `provarJanelaDoPolimentoEmBancoProprio`, que aplica a `0031` sobre um banco parado na `0030`) e em toda
execução do e2e. Em produção, só você a aplica. Comandos do servidor: SSH como `theo`, em `/opt/amassa`.

**Estado medido em 06/10/2026, 12:05 UTC, no computador, sem `git fetch` e sem tocar o servidor (plano `06.5-30`):**
`git log origin/main..main --oneline | wc -l` → **5** (só documentação: o planejamento da 06.5, de `4484c19` a
`0b646f7`); `git merge-base --is-ancestor main gsd/phase-06.5-polimento; echo $?` → **`0`** (merge sem conflito);
`git log main..gsd/phase-06.5-polimento --oneline | wc -l` → **125** antes dos commits do plano 30 (o número final
está no `06.5-30-SUMMARY.md`); `gh run list --limit 3` → `37254337900` (05/10, success, **31m37s**), `37226512538`
(34m09s), `37222643020` (35m25s); `curl` de `/api/health/polimento` → **`404`**, `/api/health/queimas` → `200`,
`/api/health/backup` → `200`; `curl -sI /` → `X-Powered-By: Next.js` e **nenhum** cabeçalho de segurança (o "antes").
**Só o seu push e o servidor medem:** o pipeline novo de verdade (grafo, tempo, digest), o `200` da rota e a `0031`.

---

## Passo 1 — Guarda e contagem ANTES (no servidor)

```bash
hostname
whoami
cd /opt/amassa
docker compose exec postgres psql -U amassa_owner -d amassa -c "select current_database();"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from documentos) as documentos, (select count(*) from contas_fixas) as contas_fixas, (select count(*) from movimentacoes_estoque) as movimentacoes, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/polimento
```

**O que você deve ver:** o host do VPS, `theo`, `amassa`; quatro números — anote-os — com
**`migracoes_aplicadas = 31`** (`0000` a `0030`, desde o Roteiro 21); e **`404`** (a rota ainda não foi
publicada). `migracoes_aplicadas` diferente de 31, ou `200`/`503` no `curl`: **pare aqui** e chame.

---

## Passo 2 — Backup, antes de tocar em qualquer coisa

```bash
./scripts/backup.sh --agora
echo $?
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok, fotos_bytes, fotos_destino_externo_ok, anexos_bytes, anexos_destino_externo_ok from execucoes_backup order by quando desc limit 1;"
```

**O que você deve ver:** nenhuma saída do backup e **`0`** no `echo`; uma linha com o horário de agora,
**`sucesso = t`**, **`destino_externo_ok = t`**, `fotos_bytes` e `anexos_bytes` maiores que zero e os dois
`_destino_externo_ok = t` — como no Passo 2 do Roteiro 21.

`echo` diferente de `0`, `sucesso = f`, algum `_ok = f` ou bytes vazios ou `0`: **pare aqui** — sem backup
verificado, não siga.

---

## Passo 3 — Publicar (no seu computador) e esperar o `implantar` TERMINAR

```bash
git status
git checkout main
git fetch
git log origin/main..main --oneline
git merge-base --is-ancestor main gsd/phase-06.5-polimento; echo $?
git log main..gsd/phase-06.5-polimento --oneline | wc -l
git merge --no-ff gsd/phase-06.5-polimento -m "Merge da Fase 06.5 (Polimento) em main — Roteiro 22"
git push
gh run list --limit 3
gh run view <o número do run>
```

**O que você deve ver:** árvore limpa; no `log`, os **5** commits de documentação medidos acima (ou nada, se já
publicados — um que não reconhece: **pare e pergunte**); **`0`** no `merge-base`; no `wc -l`, o número do
`06.5-30-SUMMARY.md`; o merge sem conflito; e, repetindo `gh run list`, o run **`completed  success`**.

**O pipeline é novo (plano `06.5-22`) — sete jobs.** Começam juntos `Qualidade — lint e testes unitários` e `Construir a
imagem (tag do commit)`; depois dos dois, `E2E (desktop) contra a imagem real` e `E2E (celular) contra a imagem real` (as
duas fatias, em paralelo); depois da `Qualidade`, `Banco — migrações e backup de ponta a ponta`; quando os três ficam
verdes, `Publicar as imagens testadas no GHCR` dá `:latest` e `:ferramentas` à imagem testada; por fim, `Implantar no VPS`.
O `gh run view` mostra os sete com o tempo de cada um. **Anote o tempo total do run** (critério 6: menos que os ~32 min
de hoje). **Estimativa, não medição:** cada fatia ~15–18 min de testes + ~3 min de preparo (limite 35); o primeiro run
parte de **cache frio** no `construir`, então pode demorar mais que os seguintes. Só este run prova o grafo, as tags
`:<sha>` puxadas sem login, o `publicar` e as fontes do PDF na imagem (`06.5-22-SUMMARY.md`, "O que só o primeiro push
prova").

Vermelho ou cancelado por tempo antes do `implantar`: o app no ar continua o antigo e o banco está intacto — **não
migre**, chame. Vermelho só em `cotacoes-categorias` é o defeito de teste aberto WINDOWS #64: não migre; chame.
**A janela abre quando o `implantar` fica verde — vá direto ao Passo 4.**

---

## Passo 4 — `db:migrate`, logo em seguida (no servidor)

```bash
cd /opt/amassa
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep 0031
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que você deve ver:** `0031_polimento.sql` no `grep` (**faltou? pare** — a imagem é velha e o `db:migrate`
diria sucesso sem aplicar nada); **`Migrações aplicadas com sucesso.`**; e **`0`**. Diferente de `0`: **pare**,
copie a saída e vá ao caminho de volta.

---

## A janela — entre o `implantar` verde e o fim do `db:migrate`

O código novo roda sobre o banco sem a `0031`:

- **só o lançamento de uma correção falha** — “Corrigir” mostra “Não deu para lançar…” e **nada é gravado**;
- o Caixa e o detalhe de um lançamento **abrem normalmente**, só sem as linhas “Corrigida pela…”;
- **“Gerar as contas de {mês}” funciona** — o mesmo pedido vale antes e depois da `0031` (provado em banco
  próprio no `test:migracoes`); um mês com a conta cancelada só volta a ser gerado depois da migração;
- `/api/health/polimento` responde **`503`**.

**Nada mais para:** venda, despesa, “Recebi agora”, Orçamentos, Produção, Estoque, Agenda, Queimas, Fornecedores,
Lembretes e Cadastros funcionam normalmente — o vínculo da correção mora numa tabela à parte, e nenhum outro
lançamento depende dela.

---

## Passo 5 — Conferir: de fora e de dentro

**5.1 — De fora (no seu computador):**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/polimento
curl -s https://amassacerrado.com.br/api/health/polimento
curl -sI https://amassacerrado.com.br/
```

**O que você deve ver:** **`200`** e `{"status":"ok"}` — a rota só responde `200` se `correcoes_de_documento` e o
índice `documentos_conta_fixa_mes_ativo_uk` existem (os dois nascem na `0031`). Era `404` antes do Passo 3 e
`503` na janela; **`503` agora:** a migração não aplicou, volte ao Passo 4. No `curl -sI`, os cabeçalhos
`strict-transport-security`, `x-content-type-options`, `referrer-policy`, `x-frame-options`, `permissions-policy`
e `content-security-policy-report-only` — e **nenhum** `x-powered-by`. Faltou algum: o app está no ar e o banco
certo; anote e chame (não é motivo para reverter).

**5.2 — De dentro, por SQL (no servidor):**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select indexname, indexdef from pg_indexes where schemaname = 'public' and indexname in ('documentos_conta_fixa_mes_ativo_uk', 'documentos_conta_fixa_mes_uk', 'movimentacoes_estoque_encomenda_idx', 'mensalidades_cliente_idx', 'usos_livres_cliente_idx') order by indexname;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as correcoes from correcoes_de_documento;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from documentos) as documentos, (select count(*) from contas_fixas) as contas_fixas, (select count(*) from movimentacoes_estoque) as movimentacoes, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:**

- **quatro linhas**: `documentos_conta_fixa_mes_ativo_uk` com `UNIQUE` e `WHERE (cancelado_em IS NULL)`, e os três
  índices de leitura — e **nenhuma** `documentos_conta_fixa_mes_uk` (a única antiga saiu);
- `correcoes = 0` — a tabela existe e está vazia;
- comparado com o Passo 1: `documentos`, `contas_fixas` e `movimentacoes` **iguais**; **`migracoes_aplicadas =
  32`**.

Contagem diferente, índice faltando ou a única antiga ainda lá: **pare e chame**.

**Passo 6 — a caminhada:** a Parte 2 de `.planning/phases/06.5-polimento/06.5-VERIFICACAO-HUMANA.md`.

---

## Se der errado: o caminho de volta

- **A migração falhou (código diferente de `0`).** **Nada ficou aplicado** (transação única). O app novo está no
  ar sobre o banco velho — a janela acima continua. Corrija para a frente (copie a saída e chame) ou volte o app,
  no seu computador: `git log --oneline -5`, `git revert -m 1 <o hash do merge>`, `git push`, e espere o run
  verde.
- **Falha depois da migração** (`503` com o `db:migrate` em `0`, SQL que não bate, telas quebradas). A `0031` só
  acrescenta e troca a única por um índice mais frouxo: **reverter a publicação basta** (`git revert -m 1 <merge>`
  + `git push`). **Uma exceção, medida:** o código antigo pede o conflito sem o predicado, e sobre a `0031` o
  Postgres o recusa (`42P10`, provado no `test:migracoes`) — com a publicação revertida, **só “Gerar as contas de
  {mês}” falha** (a frase de erro, nada gravado); lance a conta do mês à mão no Caixa até a fase voltar. Restaurar
  o backup do Passo 2 (Roteiro 3) **só se algum dado tiver sido estragado** — compare o 5.2 com o Passo 1: iguais,
  não restaure.
- **Desfazer a `0031` de vez:** outra migração, escrita por um plano, provada no `test:migracoes` e aplicada por
  este mesmo caminho (backup antes). Nunca à mão no `psql`.

Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.
