# Roteiro 23 — As correções da revisão 06.5: publicar e conferir a taxa das correções já gravadas

**Quando rodar:** **uma vez**, quando você disser “publica”. **Sem migração nenhuma:** a `0031` continua sendo a
última, e nenhum passo do Roteiro 22 se repete. Escrito em 07/10/2026 pelo quick `261007-shs`, **sem ter sido
rodado**. Se algum passo divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

---

## Resumo

**O que vai para o ar** (os cinco itens da revisão de código da Fase 06.5 que você decidiu em 07/10/2026):

- **BL-01 — o “Corrigir” no cartão.** A parcela já recebida no cartão mantém, na venda corrigida, a taxa com que foi
  recebida. Só a parcela nova, ou a em aberto marcada como paga agora, usa a taxa de hoje. O aviso do cartão na
  Venda aberta por “Corrigir” diz a taxa que de fato vai ser gravada.
- **WR-01 — o retrato.** A tela da correção lê o rascunho e a versão de uma vez só. Um “Recebi” feito no meio não
  se perde mais.
- **WR-02 — cancelar uma correção.** A confirmação diz que a original continua cancelada e oferece “Corrigir”.
- **WR-03 — perguntar antes.** “Gerar as contas de {mês}”, nos Cadastros e no Caixa, lista pelo nome as contas
  fixas canceladas naquele mês. Elas aparecem desmarcadas, e só as marcadas voltam.
- **WR-04 — o pipeline.** As duas imagens passam a circular pelo digest. A `ferramentas` migra o banco efêmero do
  job `banco` antes de ser promovida, e o `publicar` confere as tags.

**O que NÃO muda:** o banco de produção (nenhuma migração, nenhum `db:migrate`), `.env`, `compose.yml`, `Caddyfile`,
as pastas do host, os scripts de backup e o cron.

**Estado medido em 07/10/2026, 20:36 UTC, no computador, sem `git fetch` e sem tocar o servidor:**

- `git log origin/main..main --oneline` lista **2 commits de documentação** (`7747c7f`, `83c3837`) **e os commits do
  quick** (o número final está no `261007-shs-SUMMARY.md`);
- `gh run list --limit 1` → `37667733188` (07/10, success, **23m13s**);
- `curl` de `/api/health` e de `/api/health/polimento` → **`200`** e **`200`**.

**Só o seu push mede:** o GitHub aceitar as saídas e o `needs` novos; o `docker run` da `ferramentas` no runner,
com `--network host`; e os digests conferidos no `publicar`.

---

## Passo 1 — O push (no seu computador)

```bash
git push
```

**O que você deve ver:** o push aceito, sem aviso de segredo. Recusou: **pare** e cole a saída para o Code.

---

## Passo 2 — O pipeline (no seu computador)

```bash
gh run list --limit 3
gh run watch
```

**O que você deve ver:** o run novo no topo, com os seis jobs verdes. Olhe três coisas:

- no job **`banco`**, os três passos novos, todos verdes:
  - “Aplicar o schema no banco de teste PELA imagem ferramentas”;
  - “Conferir que a imagem aplicou exatamente as migrações do commit”, que deve terminar com
    **`32 migrações conferidas, iguais às do commit (última: 0031_polimento).`**;
  - “Conferir que o atalho de migração da imagem aponta para o mesmo arquivo”.
- no job **`publicar`**, “Conferir que as tags apontam para os digests testados”, verde, com duas linhas
  `…:latest = sha256:…` e `…:ferramentas = sha256:…`;
- o job **`implantar`**, verde.

O tempo deve ficar perto dos 23 min do run anterior. O `banco` agora espera o `construir`, mas o `e2e` já esperava,
então o caminho mais longo não muda.

**Se algo der errado:**

- **Algum job vermelho:** nada foi implantado, e o `:latest` continua o de antes. Cole o nome do job e as últimas
  linhas do log para o Code.
- **Run cancelado no meio do `publicar`:** pode ser outro push que começou, porque o pipeline cancela o run anterior.
  Nesse caso, **não use a `ferramentas`** (nenhum `docker compose run --rm ferramentas …`) até o próximo run verde.
  Sem o run verde, `:latest` e `:ferramentas` podem ser de commits diferentes.

---

## Passo 3 — Conferir de fora (no seu computador)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/polimento
```

**O que você deve ver:** **`200`** e **`200`**. Qualquer outro número: anote e chame.

---

## Passo 4 — A taxa das correções já gravadas (BL-01), só leitura (no servidor)

A Fase 06.5 está no ar desde 07/10/2026. Até este push, o “Corrigir” de uma venda recebida no cartão gravava a taxa
de HOJE na parcela já recebida. Se a taxa em Cadastros → Taxas mudou entre o recebimento e a correção, o líquido e o
saldo do passado mudaram. As duas consultas abaixo **só leem**. Use SSH como `theo`, em `/opt/amassa`, na mesma
forma do Roteiro 22, Passo 5.

**Consulta 1 — as correções cuja original tinha parcela recebida no cartão:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select o.numero as original, n.numero as corrigida, c.criado_em from correcoes_de_documento c join documentos o on o.id = c.original_id join documentos n on n.id = c.corrigido_id where o.tipo = 'venda' and exists (select 1 from parcelas p where p.documento_id = o.id and p.forma = 'cartao' and p.pago_em is not null) order by c.criado_em;"
```

**Consulta 2 — dessas, as que gravaram na parcela recebida uma taxa diferente da original** (a consulta da revisão,
`06.5-REVIEW.md`, com os números dos documentos):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select o.numero as original, n.numero as corrigida, po.pago_em, po.valor_centavos, po.taxa_pontos_base as taxa_original, pn.taxa_pontos_base as taxa_nova from correcoes_de_documento c join documentos o on o.id = c.original_id join documentos n on n.id = c.corrigido_id join parcelas po on po.documento_id = c.original_id and po.forma = 'cartao' and po.pago_em is not null join parcelas pn on pn.documento_id = c.corrigido_id and pn.forma = 'cartao' and pn.pago_em = po.pago_em and pn.valor_centavos = po.valor_centavos where pn.taxa_pontos_base is distinct from po.taxa_pontos_base order by c.criado_em;"
```

**O que você deve ver:**

- **Consulta 1 com `(0 rows)`:** nada a fazer. Nenhuma correção tocou uma venda recebida no cartão. Fim do roteiro.
- **Alguma linha em qualquer das duas:** **pare** e cole as duas saídas para o Code. Não corrija nada à mão no
  `psql`. Uma correção de dados é outro quick, com backup antes. Uma cadeia (correção de correção) precisa da taxa
  da venda **original da cadeia**, não da do meio.

A caminhada de 07/10 pode ter gravado correções de teste. Se aparecerem aqui, a limpeza geral (item 10 da fila)
vai tirá-las. Mesmo assim, cole as saídas: o Code diz o que é teste e o que é venda real.
