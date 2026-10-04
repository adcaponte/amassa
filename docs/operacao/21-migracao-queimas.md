# Roteiro 21 — As Queimas: a contagem, a publicação e a migração `0030`

**Quando rodar:** **uma vez**, para publicar a Fase 06.4 (Queimas — contagem), com o backup feito por você e
olhando. **Nunca pelo pipeline.** Escrito em 04/10/2026 pelo plano `06.4-07`, sem ter sido rodado, no molde dos
Roteiros 19 e 20. Se algum passo divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e não
improvise.

**Passo 0:** responda a Parte 0 de `.planning/phases/06.4-queimas-contagem/06.4-VERIFICACAO-HUMANA.md` (as ⭐
primeiro). Se trocar alguma, o executor ajusta no branch e roda `npm run verificar` antes de este roteiro seguir.

---

## Resumo

**O que a `0030_queimas-contagem.sql` faz no banco — só acrescenta.** Nada é apagado nem renomeado.

- **`queima_contagens`** — uma linha por queima contada (sem linha = "sem contagem"); seis contadores e "saiu cheio".
- **`queima_vendas`** — uma linha por venda das externas de uma queima (D-07: várias vendas por queima, uma por pessoa).
- **Três itens do sistema "Queima externa P/M/G"** (chaves `queima_externa_p|m|g`), sem preço, na venda, sem
  estoque. Se você já tinha cadastrado um item ativo, sem estoque, com o mesmo nome, ele é **adotado** (ganha a
  chave e guarda seu nome e preço) em vez de duplicado.
- **A régua P · M · G** em Parâmetros: P até 10 cm (`10000`), M até 25 cm (`25000`), vigente desde `2026-09-20`.
- **Dois checks trocados por listas maiores** (as chaves novas de itens e de parâmetros) — nada que vale hoje passa
  a ser recusado.

**Nada de pasta, volume, `.env`, `compose.yml` ou script de backup novo.** **Provada, não aplicada:** rodou no
Postgres efêmero de `npm run test:migracoes` (`conferirQueimas` e as onze corridas das Queimas) e em toda execução
do e2e. Em produção, só você a aplica. Comandos do servidor: SSH como `theo`, em `/opt/amassa`; nenhum pede senha.

**Estado medido em 04/10/2026, ~12h58 UTC, no computador, sem `git fetch` e sem tocar o servidor:**
`git log origin/main..main --oneline | wc -l` → **17** (só documentação: o fechamento da 06.2 e da 06.3 e o
planejamento da 06.4, de `f65d495` a `0e1b1dd`); `git merge-base --is-ancestor main gsd/phase-06.4-queimas;
echo $?` → **`0`** (o `main` é ancestral do branch — merge sem conflito); `curl` de `/api/health/queimas` →
**`404`**, `/api/health/lembretes` → `200`, `/api/health/backup` → `200`.

---

## Passo 1 — Guarda e contagem ANTES (no servidor)

```bash
hostname
whoami
cd /opt/amassa
docker compose exec postgres psql -U amassa_owner -d amassa -c "select current_database();"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from queimas) as queimas, (select count(*) from documentos) as documentos, (select count(*) from itens_catalogo) as itens, (select count(*) from parametros_precificacao) as parametros, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/queimas
```

**O que você deve ver:** o host do VPS, `theo`, `amassa`; cinco números — anote-os — com
**`migracoes_aplicadas = 30`** (`0000` a `0029`, desde o Roteiro 19/20 em 03/10/2026); e **`404`** (a rota ainda
não foi publicada). `migracoes_aplicadas` diferente de 30, ou `200` no `curl`: **pare aqui** e chame.

---

## Passo 2 — Backup, antes de tocar em qualquer coisa

```bash
./scripts/backup.sh --agora
echo $?
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok, fotos_bytes, fotos_destino_externo_ok, anexos_bytes, anexos_destino_externo_ok from execucoes_backup order by quando desc limit 1;"
stat -c '%a %n' /opt/amassa/dados/fotos-orcamentos /opt/amassa/dados/anexos-fornecedores
grep -c pasta_ilegivel /opt/amassa/scripts/backup.sh
```

**O que faz:** dump, fotos e anexos; confere as pastas (em `750` o backup não as lia — lição de 03/10/2026).

**O que você deve ver:**

- nenhuma saída do backup e **`0`** no `echo`;
- uma linha com o horário de agora, **`sucesso = t`**, **`destino_externo_ok = t`**, **`fotos_bytes`** maior que
  zero (era `488929` em 03/10/2026), **`fotos_destino_externo_ok = t`**, **`anexos_bytes`** maior que zero (era
  `17761518` em 03/10/2026 — o PDF de teste) e **`anexos_destino_externo_ok = t`**;
- no `stat`, **`755`** nas duas pastas;
- no `grep`, um número **maior que zero** (é o `backup.sh` do quick `261003-bkp`). **`0`:** o host ainda roda o
  script antigo — ele funciona porque as pastas estão `755`, mas re-extraia agora pelo Passo 6 do Roteiro 19
  (seguro: a `0028` já está aplicada), rode este passo de novo e confira **15911 bytes** com `ls -l`.

`echo` diferente de `0`, `sucesso = f`, algum `_ok = f` ou `anexos_bytes`/`fotos_bytes` vazio ou `0`: **pare
aqui** — sem backup verificado, não siga. (Pasta em `750`: `sudo chmod 755` nela, Roteiro 19 Passo 3, e repita.)

---

## Passo 3 — Publicar (no seu computador) e esperar o `implantar` TERMINAR

```bash
git status
git checkout main
git fetch
git log origin/main..main --oneline
git merge-base --is-ancestor main gsd/phase-06.4-queimas; echo $?
git log main..gsd/phase-06.4-queimas --oneline | wc -l
git merge --no-ff gsd/phase-06.4-queimas -m "Merge da Fase 06.4 (Queimas — contagem) em main — Roteiro 21"
git push
gh run list --limit 3
```

**O que você deve ver:** árvore limpa; no `log`, os **17** commits de documentação medidos acima (ou nada, se você
já os publicou — um commit que você não reconhece: **pare e pergunte**); **`0`** no `merge-base`; no `wc -l`, o
número de commits da fase que está no `06.4-07-SUMMARY.md`; o merge sem conflito; e, repetindo `gh run list`, o
run **`completed  success`** nos quatro jobs. **Conte com 30 a 40 minutos:** o job `e2e` levou 27 min em 03/10
(1459 testes) e a fase acrescenta testes — a estimativa está no `06.4-07-SUMMARY.md`.

Vermelho ou **cancelado por tempo** em `qualidade`, `e2e` ou `imagem`: o app no ar continua o antigo e o banco
está intacto — **não migre**, chame. Vermelho só em `cotacoes-categorias:291` é o defeito aberto WINDOWS #64
(caminhada da 06.3, §0.8): não migre; chame. **A janela abre quando o `implantar` fica verde — vá direto ao Passo 4.**

---

## Passo 4 — `db:migrate`, logo em seguida (no servidor)

```bash
cd /opt/amassa
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep 0030
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que você deve ver:** `0030_queimas-contagem.sql` no `grep` (**faltou? pare** — a imagem é velha e o
`db:migrate` diria sucesso sem aplicar nada); **`Migrações aplicadas com sucesso.`**; e **`0`**. Diferente de
`0`: **pare**, copie a saída e vá ao caminho de volta.

---

## A janela — entre o `implantar` verde e o fim do `db:migrate`, confinada às Queimas

O código novo roda sobre o banco sem a `0030`:

- no índice das Queimas, os cartões dos fornos aparecem, mas **as listas ("a cobrar" e "Sem contagem") dão lugar
  ao bloco de erro** com "Tentar de novo";
- **registrar uma queima em dois toques funciona**, como hoje — só a folha "O que queimou?" não abre;
- **o detalhe de um forno mostra a página de erro** ("Algo não funcionou.");
- em Cadastros → Parâmetros, o grupo "Queimas" mostra só a frase da régua ausente: *"A régua P · M · G ainda não
  está no banco. …"* (`parametros-regua-ausente`) — os outros grupos, normais;
- `/api/health/queimas` responde **`503`**.

**Nada fora das Queimas para:** Orçamentos, Produção, Estoque, Financeiro (Caixa e Venda), Agenda, Fornecedores,
Lembretes e o resto de Cadastros funcionam normalmente — a régua está no catálogo de Parâmetros marcada fora do
cálculo, então nenhum outro módulo a exige.

---

## Passo 5 — Conferir: de fora e de dentro

**5.1 — De fora:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/queimas
curl -s https://amassacerrado.com.br/api/health/queimas
```

**O que você deve ver:** **`200`** e `{"status":"ok"}`. A rota só responde `200` se `queima_contagens`,
`queima_vendas` e o item `queima_externa_p` existem — os três nascem na `0030`. Era `404` antes do Passo 3 e
`503` na janela. **`503` agora:** a migração não aplicou; volte ao Passo 4.

**5.2 — De dentro, por SQL:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from queima_contagens) as contagens, (select count(*) from queima_vendas) as vendas_das_queimas;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select chave_do_sistema, nome, ativo, aparece_na_venda, controla_estoque, preco_venda_centavos, criado_em, case when criado_em > now() - interval '1 hour' then 'CRIADO pela 0030' else 'ADOTADO (já existia)' end as origem from itens_catalogo where chave_do_sistema like 'queima_externa_%' order by chave_do_sistema;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select chave, valor_inteiro, vigente_desde from parametros_precificacao where chave like 'queima_regua_%' order by chave;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from queimas) as queimas, (select count(*) from documentos) as documentos, (select count(*) from itens_catalogo) as itens, (select count(*) from parametros_precificacao) as parametros, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:**

- `contagens = 0` e `vendas_das_queimas = 0` — as tabelas existem e estão vazias;
- **três linhas**, `queima_externa_g`, `queima_externa_m`, `queima_externa_p`, todas com `ativo = t`,
  `aparece_na_venda = t`, `controla_estoque = f`. **`CRIADO pela 0030`**: nome "Queima externa P/M/G", preço vazio
  (você cadastra em Cadastros → Catálogo — sem preço, "a cobrar" avisa e não deixa cobrar). **`ADOTADO`**: é o seu
  item antigo, com o nome e o preço que você tinha. Anote quantos de cada;
- `queima_regua_m_ate | 25000 | 2026-09-20` e `queima_regua_p_ate | 10000 | 2026-09-20`;
- comparado com o Passo 1: `queimas` e `documentos` **iguais**; `parametros` **+ 2**; `itens` **+ (3 − os
  adotados)**; **`migracoes_aplicadas = 31`**.

`queimas` ou `documentos` diferentes, menos de três itens, ou régua faltando: **pare e chame**.

**Passo 6 — a caminhada:** Parte 2 de `06.4-VERIFICACAO-HUMANA.md`. Toda queima registrada desde a Fase 4 aparece
em "Sem contagem" (as dos últimos 30 dias, até 20; "Ver todas" mostra todas) — esperado, não defeito.

---

## Se der errado: o caminho de volta

- **A migração falhou (código diferente de `0`).** **Nada ficou aplicado** (transação única). O app novo está no
  ar sobre o banco velho — a janela acima continua. Corrija para a frente (copie a saída e chame) ou volte o app,
  no seu computador: `git log --oneline -5`, `git revert -m 1 <o hash do merge>`, `git push`, e espere o run
  verde.
- **Falha depois da migração** (`503` com o `db:migrate` em `0`, SQL que não bate, telas quebradas). A `0030` só
  acrescenta e o código antigo ignora as tabelas novas: **reverter a publicação basta** (`git revert -m 1 <merge>`
  + `git push`). As tabelas ficam vazias e sem uso. Restaurar o backup do Passo 2 (Roteiro 3) **só se algum dado
  tiver sido estragado** — compare o 5.2 com o Passo 1: iguais, não restaure.
- **Desfazer a `0030` de vez:** outra migração, escrita por um plano, provada no `test:migracoes` e aplicada por
  este mesmo caminho (backup antes). Nunca à mão no `psql`.

Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.

**O que NÃO muda:** `.env`, Caddy, `compose.yml`, as pastas do host, os scripts de backup e o cron — nada a mexer
por esta fase; as tabelas novas entram no próximo dump.
