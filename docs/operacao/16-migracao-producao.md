# Roteiro 16 — A publicação da Fase 06.1 (Produção) e as migrações `0024` e `0025`

**Quando rodar:** **uma vez**, depois de ler e responder a Parte 0 de
`.planning/phases/06.1-producao/06.1-VERIFICACAO-HUMANA.md` (as decisões tomadas sem você), numa
janela em que ninguém esteja usando a plataforma — com o backup feito por você, olhando. **Nunca pelo
pipeline.** Escrito em 30/09/2026, pelo plano `06.1-15-PLAN.md`, sem ter sido rodado. Se algum passo
divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

**O que este roteiro faz, em uma frase por passo:**

| Passo | Onde | O quê |
|---|---|---|
| 0 | celular | Você lê as decisões tomadas sem você (Parte 0 da caminhada) e confirma ou pede troca |
| 1 | servidor | Guarda: confirmar servidor e banco certos |
| 2 | servidor | Contar ANTES o que as migrações vão mudar, e você confirmar que nada daquilo é real |
| 3 | servidor | Backup, conferido por linha e tamanho |
| 4 | seu computador | Publicar: `git merge --no-ff gsd/phase-06.1-producao` e `git push`; esperar o job `implantar` **terminar** |
| 5 | servidor | `db:migrate` pela `ferramentas`, **logo em seguida** — a `0024` e a `0025` juntas |
| 6 | qualquer lugar | Conferir de fora: `/api/health/producao` em 200 |
| 7 | servidor | Conferir de dentro, por SQL: tabelas, `has_table_privilege`, as ordens do D-02, antes × depois |
| 8 | celular | Um orçamento aprovado, a Produção, e o endereço antigo `/gestao/encomendas` |
| 9 | — | Se der errado: o caminho de volta |
| 10 | — | A data da publicação (D-17) |

> 🔴 **As duas janelas — por que a ordem não se inverte (D-09).**
>
> **Janela 1, aceita por você:** entre o fim do job `implantar` (Passo 4) e o fim do `db:migrate`
> (Passo 5), o **código novo roda sobre o banco velho**. Nesse intervalo falham com a tela de erro
> (ou com "não deu para…"):
>
> - a Produção (`/gestao/producao`), o vínculo "Qual ordem?" do Estoque e o bloco "Produção" do
>   Início;
> - a aprovação de orçamento (que agora abre a ordem);
> - **todo cancelamento no Caixa — de venda E de despesa**: o cancelamento agora procura a ordem
>   ligada ao documento (D-07) antes de qualquer outra coisa, e essa tabela ainda não existe;
> - **toda gravação no livro do Estoque**, porque toda linha nova do livro leva a coluna
>   `material_da_ordem`, que só nasce na `0024`: lançar venda com item de estoque, lançar compra de
>   material (despesa com material), e no Estoque a entrada, a saída, o ajuste e a contagem;
> - abrir o Histórico do Estoque também pode falhar.
>
> Ou seja: nesse meio-tempo, **não lance nem cancele nada no Financeiro e não mexa no Estoque**
> (revisão de código de 30/09/2026, IN-08 — até ela, este parágrafo citava só "lançar venda com
> estoque"). Você aceitou isso no D-09 ("se o unico problema for o site ficar meio quebrado por um
> momento, nao tem problema. ainda nao estamos operando na plataforma."). Por isso a migração vem **logo depois** do `implantar` — alguns minutos,
> não horas — e ninguém lança nada nesse meio-tempo.
>
> **Janela 2, proibida:** migrar **antes** de o `implantar` terminar. A imagem `ferramentas` (a que
> migra) é publicada pelo job `imagem`, que roda **antes** do `implantar`. Se você rodar o
> `db:migrate` nesse intervalo, a `0025` apaga as tabelas de Encomendas enquanto o **código antigo**
> ainda está no ar — e o código antigo usa exatamente essas tabelas: Encomendas, a aprovação de
> orçamento e o Início quebram, e não "por um momento", mas até o `implantar` terminar ou falhar. **Só
> migre com o run inteiro verde, os quatro jobs.**
>
> 🔴 **O pipeline também roda à mão — e aí publica o branch que você escolher.** Até o Passo 4,
> **não** use "Run workflow" em Actions → "Entrega contínua" no GitHub (nem `gh workflow run`) com o
> branch `gsd/phase-06.1-producao` selecionado: o job `implantar` não confere de que branch veio o
> código, e publicaria a fase antes do backup do Passo 3, abrindo a Janela 1 sem você por perto. Se
> precisar rodar o pipeline à mão antes do Passo 4, só com `main` selecionado.

**O que as duas migrações fazem no banco.**

- **`0024_producao.sql` — cria, grava e religa.** Cria as tabelas `ordens_producao`, `ordem_etapas` e
  `ordem_pecas` e a coluna `movimentacoes_estoque.material_da_ordem`. Grava o **D-02**: todo orçamento
  **aprovado**, cuja encomenda provisória ainda estava em andamento e cuja venda não foi cancelada,
  ganha uma ordem nova **aguardando o sinal**, com as seis etapas e as peças do orçamento (sem nenhum
  caso, não grava nada). Solta o vínculo de quem apontava para uma encomenda que não virou ordem
  (orçamento ou baixa do Estoque — no livro, a nota guarda o nome da encomenda). Passa os dois vínculos
  (`orcamentos.encomenda_id` e `movimentacoes_estoque.encomenda_id`) a apontar para a ordem. Tira o
  `delete` das três tabelas novas de `amassa_app`: na Produção nada se apaga, só "Cancelar ordem".
- **`0025_remover-encomendas.sql` — apaga.** Apaga as tabelas `encomendas`, `encomenda_itens` e
  `encomenda_etapas` e os dois tipos delas (**D-01**: "O item 5 da produção pode sim zerar todos os
  dados. nada é real ainda." — você, em 29/09/2026). **Esta é a parte sem volta:** depois dela, os
  dados de teste de Encomendas só voltam pelo backup do Passo 3.
- **As duas entram juntas ou nenhuma entra.** O `db:migrate` aplica todas as migrações pendentes numa
  transação só (`node_modules/drizzle-orm/pg-core/dialect.js`, `session.transaction` em volta do laço
  das migrações). Se qualquer instrução falhar, o banco fica exatamente como estava.
- **Provadas, não aplicadas.** As duas rodaram e foram conferidas no Postgres efêmero de `npm run
  test:migracoes` (um banco próprio parado na `0023`, com dado de teste, recebe a `0024` e depois a
  `0025`) e em toda execução do e2e. Em produção, só você as aplica.

**O que este roteiro NÃO faz:**

- **Não mexe no Caddy, no `.env` nem no `AUTH_URL`.** A seção "O que NÃO muda", no fim, diz por quê.
- **Não confere os 8 critérios da fase.** Isso é a Parte 2 da caminhada
  (`06.1-VERIFICACAO-HUMANA.md`), no celular, depois deste roteiro.
- **Não roda nada pelo pipeline.** O pipeline publica imagem e sobe o app; migração é à mão, depois
  de backup, por você olhando (regra do projeto).

**Como ler cada passo:** o mesmo formato dos Roteiros 12 a 15 — cada comando vem com **o que faz** e
**o que você deve ver**. Os comandos do servidor rodam na sessão SSH como `theo`, com `docker compose
run --rm ferramentas`, **nunca** `docker compose exec app` (a imagem `app` não tem `drizzle-kit` nem
a pasta `db/`, `WINDOWS.md #14`). Nenhum comando abaixo pede credencial nem string de conexão — o
repositório é público.

**Onde anotar:** a Parte 1 da caminhada tem uma linha **Resultado** para cada passo. **Não cole nome
de cliente** nas anotações — a caminhada fica no repositório, que é público. Números e "ok" bastam.

> Sobre `gh` no seu computador: ele está instalado e autenticado, mas o Git Bash não o enxerga sem
> `export PATH="/c/Program Files/GitHub CLI:$PATH"`. No PowerShell ele já funciona direto.

---

## Passo 0 — As decisões que só você toma

Antes de qualquer comando: abra `.planning/phases/06.1-producao/06.1-VERIFICACAO-HUMANA.md`,
**Parte 0**, e responda. Ela junta tudo o que foi decidido sem você na noite do planejamento e nos
14 planos da execução, cada item com "como desfazer" — e as três escolhas de interface que você mais
provavelmente queira rever: **UI-D4** ("Desfazer" pede confirmação), **UI-D3** (a barra fixa do
"Terminei" no celular) e **UI-D2** (seis colunas só a partir de 1280px).

**Se trocar alguma decisão: pare aqui.** Peça o ajuste no branch `gsd/phase-06.1-producao`, espere
`npm run verificar` sair verde nele, e só então siga. Uma troca que mexa na `0024` ou na `0025` é
barata **agora** — elas não estão aplicadas em lugar nenhum —, e cara depois do Passo 5.

---

## Passo 1 — Guarda: servidor certo, banco certo

```bash
hostname
whoami
ls -d /opt/amassa
cd /opt/amassa
docker compose exec postgres psql -U amassa_owner -d amassa -c "select current_database();"
```

**O que faz:** confirma que você está na sessão SSH do servidor de produção e no banco `amassa` — os
passos seguintes apagam tabelas num banco de verdade, e o comando certo no lugar errado não tem
desfazer fácil.

**O que você deve ver:** o nome do host do VPS (não o do seu computador), `theo`, `/opt/amassa`
listado sem erro, e `amassa` na última saída. Qualquer outra coisa — **pare aqui**.

---

## Passo 2 — Contar ANTES o que as migrações vão mudar

Ainda no servidor, em `/opt/amassa`. Anote os números na Parte 1 da caminhada: o Passo 7 compara
com eles.

**2.1 — O que existe hoje em Encomendas (é o que a `0025` apaga):**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from encomendas) as encomendas, (select count(*) from encomenda_itens) as itens, (select count(*) from encomenda_etapas) as etapas;"
```

**O que você deve ver:** três números. São os dados de teste de Encomendas que somem no Passo 5.

**2.2 — Os orçamentos que o D-02 vai transformar em ordem "aguardando o sinal":**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select o.ano, o.sequencial, e.status as situacao_da_encomenda, (select count(*) from orcamento_linhas l where l.orcamento_id = o.id) as pecas from orcamentos o join encomendas e on e.id = o.encomenda_id join documentos d on d.id = o.documento_id where o.status = 'aprovado' and e.status in ('rascunho', 'em_producao') and d.cancelado_em is null order by o.ano, o.sequencial;"
```

**O que faz:** é o mesmo `where` do bloco (a) do D-02 na `0024` — a lista exata dos orçamentos que
ganham ordem nova. Cada linha é um orçamento (ORC-{ano}-{sequencial}) e quantas peças ele tem.

**O que você deve ver:** a lista — pode ser `(0 rows)`, e aí a `0024` não cria ordem nenhuma (D-02:
"se não houver nenhum, a migração não faz nada"). Anote **quantas linhas** (vamos chamar de **N**) e
**a soma das peças** (**P**).

**2.3 — Os vínculos que vão mudar de alvo:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) filter (where encomenda_id is not null) as orcamentos_com_encomenda from orcamentos;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as movimentacoes, count(encomenda_id) as com_encomenda, count(*) filter (where origem = 'producao') as da_producao from movimentacoes_estoque;"
```

**O que você deve ver:** na primeira, quantos orçamentos apontam hoje para uma encomenda (depois da
migração, só os **N** do 2.2 continuam apontando — agora para a ordem). Na segunda, o total do livro
do Estoque (**não muda** com a migração: nada do livro se apaga), quantas baixas apontam para uma
encomenda, e **`da_producao = 0`**. Esse último **tem de ser 0**: nenhum código antes desta fase grava
entrada da Produção, e a `0024` acrescenta uma regra que a recusaria sem ordem. Diferente de 0 —
**pare aqui** e chame.

**2.4 — Quantas migrações o banco já tem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as migracoes_aplicadas from drizzle.__drizzle_migrations;"
```

**O que você deve ver:** um número — deve ser `24` (as migrações `0000` a `0023`). Anote: depois do
Passo 5 ele tem de ser **esse mais 2**.

**2.5 — A sua confirmação (D-01):** olhe o 2.1 e o 2.2 e responda na Parte 1 da caminhada: **nada
daquilo é encomenda real?** O briefing (§1) e o D-01 dizem que não — "nada é real ainda". Se agora
existir alguma encomenda de verdade (de uma cliente real, feita depois de 29/09), **pare aqui**: a
`0025` a apagaria, e ela só voltaria pelo backup.

---

## Passo 3 — Backup, antes de tocar em qualquer coisa

No servidor:

```bash
cd /opt/amassa
./scripts/backup.sh --agora
echo $?
```

**O que você deve ver:** nenhuma saída do backup (sucesso silencioso) e `0` no `echo`.

Confira que a linha foi gravada **e que o tamanho é plausível**:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok from execucoes_backup order by quando desc limit 1;"
ls -la /opt/amassa/backups/ | tail -5
```

**O que você deve ver:** uma linha com `sucesso = t` e o horário de agora; e o arquivo de hoje com
tamanho na mesma ordem de grandeza dos anteriores — nada em `0` bytes nem visivelmente menor.
**Sem backup verificado (linha E tamanho), não siga para o Passo 4.** É este dump que desfaz a `0025`
se algo der errado.

**Daqui até o fim do Passo 7, ninguém lança nada na plataforma** (nem você, nem a Andressa): o que
for gravado depois deste backup se perde se precisarmos restaurá-lo.

---

## Passo 4 — Publicar (no seu computador) e esperar o pipeline TERMINAR

**4.1 — Veja o que vai junto:**

```bash
cd <a pasta do projeto no seu computador>
git status
git log origin/main..main --oneline
git log gsd/phase-06.1-producao..main --oneline
```

**O que faz:** o primeiro confirma que não há nada a meio no seu computador; o segundo lista os
commits do seu `main` local que ainda não foram publicados — o `push` deste passo publica **todos**
eles junto com a fase; o terceiro confirma que o `main` não andou desde que o branch da fase saiu
dele (se tivesse andado, a integração poderia ter conflito).

**O que você deve ver:** `nothing to commit, working tree clean`; os **12 commits só de documentos**
da preparação da fase, de `ef8d598` ("cria a fase Producao — briefing e prototipo…") a `9e7c6e7`
("execucao iniciada pelo dono…") — medido em 30/09/2026 às 10h57 UTC, com o `origin/main` local
igual ao do GitHub (`cd7453e`, conferido por `git ls-remote`); e **nada** no terceiro. Se você já tiver
dado `push` do `main` antes, a segunda lista vem menor ou vazia — tudo bem. Um commit que você não
reconhece, ou qualquer linha no terceiro — **pare aqui** e pergunte antes de publicar.

**4.2 — Integrar e publicar:**

```bash
git switch main
git merge --no-ff gsd/phase-06.1-producao
git push
```

**O que faz:** integra o branch da fase inteira em `main`, com um commit de integração próprio (é
ele que o Passo 9 reverte se precisar), e publica. O `push` dispara o pipeline "Entrega contínua".

**O que você deve ver:** o editor com a mensagem do merge (salve e feche), a lista de arquivos da
fase, e o `push` aceito. **Não deve haver conflito** — o branch saiu do seu `main` e o `main` não
andou (o 4.1 provou). Conflito em qualquer arquivo — **pare** (`git merge --abort`) e chame.

> Entre o `git switch main` e o fim do `git merge`, este roteiro e a caminhada somem do disco por um
> instante (eles só existem no branch da fase até a integração). Se estiver lendo pelo editor, use um
> que não recarregue do disco — ou siga pela cópia de leitura em `Claude outputs/producao/`, fora do
> git.

**4.3 — Esperar o run inteiro, com o `implantar` concluído:**

```bash
gh run list --limit 3
```

**O que você deve ver:** o run de `Entrega contínua` do commit de integração, até ele ficar
**`completed  success`** — os quatro jobs: `qualidade`, `e2e`, `imagem` e `implantar`. Leva uns 25
minutos (o e2e sozinho leva uns 20). Repita o comando de tempos em tempos; para ver os jobs um por um,
`gh run view <id>`.

> 🔴 **Não migre antes.** Quando o job `imagem` fica verde, a `ferramentas` nova (com a `0025` dentro)
> já está no registro — mas o app no ar ainda é o antigo, que usa as tabelas que a `0025` apaga (a
> Janela 2, no topo). **Só siga para o Passo 5 com o `implantar` verde.** A partir desse instante a
> Janela 1 está aberta: vá direto ao Passo 5, sem pausa.

**Vermelho em algum job:** **pare aqui**, não migre; veja qual caiu (`gh run view <id>`). Se caiu no
`qualidade`, no `e2e` ou no `imagem`, o app no ar continua o antigo e o banco está intacto — nada
quebrou; chame. (A janela 60 do `WINDOWS.md` — o build buscando fonte no Google — já derrubou um run
uma vez e passou na 2ª tentativa sem mudar nada; se for ela, `gh run rerun <id> --failed`.) Se caiu no
`implantar`, veja o Passo 9, caso C.

---

## Passo 5 — `db:migrate`, logo em seguida

No servidor, em `/opt/amassa`.

**5.1 — (Só se alguém lançou algo desde o Passo 3) um backup de novo:** se, apesar do aviso, alguém
lançou alguma coisa na plataforma depois do backup do Passo 3, rode o Passo 3 inteiro de novo agora —
o backup que vale é o último antes da migração. Se ninguém lançou nada, pule.

**5.2 — A imagem certa, com as duas migrações dentro:**

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep -E "0024|0025"
```

**O que faz:** baixa a imagem `ferramentas` publicada pelo run do Passo 4 (o `implantar` já a baixou;
este `pull` é a garantia) e confere que as duas migrações estão dentro dela, **antes** de migrar.

**O que você deve ver:** duas linhas, `0024_producao.sql` e `0025_remover-encomendas.sql`. **Uma só,
ou nenhuma? Pare aqui** — a imagem baixada é velha, e o `db:migrate` abaixo diria "Migrações aplicadas
com sucesso." sem aplicar nada. Volte ao `gh run list` do Passo 4.

**5.3 — Migrar:**

```bash
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que faz:** aplica as migrações que faltam — a `0024` e a `0025`, nessa ordem, **numa transação
só**.

**O que você deve ver:** `Migrações aplicadas com sucesso.` e `0` no `echo`.

> O `migrate()` do Drizzle é silencioso: a mensagem de sucesso **não prova o que foi aplicado**. Os
> Passos 6 e 7 é que provam.

**Saiu diferente de `0`** (ou apareceu "Falha ao aplicar migrações:"): **pare.** Não repita às cegas.
Copie a saída inteira e vá ao Passo 9, caso A — como a transação é uma só, **nada** ficou aplicado.

---

## Passo 6 — Conferir de fora: `/api/health/producao`

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/producao
curl -s https://amassacerrado.com.br/api/health/producao
```

**O que faz:** `/api/health/producao` é uma rota nova desta fase: ela consulta a tabela das ordens e a
coluna nova do livro do Estoque e responde `200` só se as encontra. Ela é a prova de fora de que **o
app publicado** enxerga o banco migrado. Entre o `implantar` e o `db:migrate` ela respondia `503` —
era a Janela 1. É pública (como `/api/health/estoque`) e nunca diz quantas ordens existem, nem nome,
nem valor — só "ok" ou "erro".

**O que você deve ver:** `200` e `{"status":"ok"}`. **Anote a data e a hora** na Parte 1 da caminhada.

- `503` — o app novo está no ar, mas não enxerga a `0024`: a migração não aplicou. Volte ao Passo 5 e
  confira a saída; se o `db:migrate` saiu `0`, vá ao Passo 9, caso B.
- `404` — o app no ar não é o da fase (o `implantar` não terminou, ou não publicou). Volte ao Passo 4.

Confira também que o resto continua de pé:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/estoque
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** `200` nos três.

---

## Passo 7 — Conferir de dentro, por SQL, DEPOIS

No servidor, em `/opt/amassa`. Cada consulta só dá o resultado esperado se as duas migrações
aplicaram de verdade.

**7.1 — As três tabelas novas existem e as três velhas não:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('ordens_producao', 'ordem_etapas', 'ordem_pecas', 'encomendas', 'encomenda_itens', 'encomenda_etapas') order by table_name;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select typname from pg_type where typname in ('status_encomenda', 'etapa_encomenda');"
```

**O que você deve ver:** exatamente três linhas — `ordem_etapas`, `ordem_pecas`, `ordens_producao`
(nenhuma `encomenda…`); e `(0 rows)` na segunda (os tipos velhos saíram). É o **critério 8** do
ROADMAP: os dados de teste de Encomendas foram apagados pela migração.

**7.2 — Na Produção nada se apaga, nem pelo app:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select t as tabela, has_table_privilege('amassa_app', t, 'SELECT') as pode_ler, has_table_privilege('amassa_app', t, 'INSERT') as pode_inserir, has_table_privilege('amassa_app', t, 'UPDATE') as pode_editar, has_table_privilege('amassa_app', t, 'DELETE') as pode_apagar from unnest(array['ordens_producao', 'ordem_etapas', 'ordem_pecas']) as t;"
```

**O que você deve ver:** três linhas, cada uma com `pode_ler = t`, `pode_inserir = t`, `pode_editar
= t` e **`pode_apagar = f`**. `t` em `pode_apagar` em qualquer uma — **pare e chame**.

**7.3 — As ordens do D-02, aguardando o sinal, com seis etapas e as peças:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select op.numero, op.status, op.inicio, (select count(*) from ordem_etapas oe where oe.ordem_id = op.id) as etapas, (select count(*) from ordem_pecas p where p.ordem_id = op.id) as pecas from ordens_producao op order by op.numero;"
```

**O que você deve ver:** **N** linhas (o N do Passo 2.2) — uma ordem por orçamento da lista —, todas
com `status = aguardando_sinal`, `inicio` vazio, `etapas = 6`, e a soma de `pecas` igual ao **P** do
2.2. Com N = 0, `(0 rows)`.

**7.4 — Os vínculos, antes × depois:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) filter (where encomenda_id is not null) as orcamentos_com_ordem from orcamentos;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as movimentacoes, count(encomenda_id) as com_ordem, count(*) filter (where origem = 'producao') as da_producao from movimentacoes_estoque;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as migracoes_aplicadas from drizzle.__drizzle_migrations;"
```

**O que você deve ver:**

- `orcamentos_com_ordem` = **N** (só os orçamentos que viraram ordem continuam ligados);
- `movimentacoes` **igual** ao do 2.3 (nada do livro se apagou); `com_ordem` menor ou igual ao
  `com_encomenda` do 2.3 (as baixas de encomenda que não virou ordem perderam o vínculo, e a nota
  delas guarda o nome); `da_producao = 0`;
- `migracoes_aplicadas` = o número do 2.4 **mais 2**.

Qualquer divergência — **pare e chame** antes de seguir para o celular.

---

## Passo 8 — No celular: um orçamento aprovado, a Produção e o endereço antigo

1. **A Produção:** abra `amassacerrado.com.br/gestao/producao`. Você deve ver a tela da Produção — com
   N = 0 e nenhuma ordem, o vazio "Nada em produção agora." com o botão "Nova ordem"; com N > 0, a
   seção **"Aguardando o sinal"** com as ordens do D-02.
2. **Um orçamento aprovado** (se N > 0): em Financeiro → aba **Orçamentos**, abra um dos orçamentos
   da lista do Passo 2.2. O veredito diz **"… e ordem aberta na Produção."**, e o link **"Ver
   encomenda na Produção"** leva à ordem dele, **aguardando o sinal**, com as peças do orçamento. (Com
   N = 0, isto fica para o critério 1 da caminhada, que aprova um orçamento de teste.)
3. **O endereço antigo:** abra `amassacerrado.com.br/gestao/encomendas` (ou um favorito antigo). Ele
   deve cair na **Produção** — o redirecionamento vale por seis meses (D-17).
4. **O Início:** o bloco "Produção" mostra as ordens liberadas (nenhuma, logo depois da migração) e,
   com N > 0, a linha **"N aguardando o sinal"**.

Anote na Parte 1 da caminhada. Depois, siga para a **Parte 2** (o celular, no ateliê).

---

## Passo 9 — Se der errado: o caminho de volta

**Caso A — a migração falhou no Passo 5** (código diferente de `0`). Como o migrador aplica tudo numa
transação só, **nada ficou aplicado**: o banco está exatamente como no backup do Passo 3, e as tabelas
de Encomendas continuam lá. Mas o código novo está no ar sobre esse banco — a Janela 1 continua
aberta. Você escolhe:

- **Corrigir para a frente** (o recomendado, se a causa for clara): copie a saída inteira e chame. A
  correção entra como commit no branch da fase, passa por `npm run verificar`, e é publicada com
  `git merge --no-ff gsd/phase-06.1-producao` + `git push` (traz só os commits novos); espere o
  `implantar` e volte ao Passo 5.
- **Voltar ao app de antes**, com o banco intacto:

  ```bash
  git switch main
  git log --merges --oneline -3
  git revert -m 1 <o hash do commit "Merge branch 'gsd/phase-06.1-producao'">
  git push
  gh run list --limit 3
  ```

  **O que faz:** `git revert -m 1` cria um commit novo que desfaz tudo o que a integração da fase
  trouxe, mantendo o histórico. Com o run verde, o app volta ao de antes — que usa as tabelas de
  Encomendas, e elas estão lá. **O que você deve ver:** o run verde e `/api/health` em `200`.

**Caso B — falha DEPOIS da migração** (`503` no Passo 6 com o `db:migrate` em `0`, o SQL do Passo 7
não bate, ou telas quebradas no Passo 8). Aqui a `0025` já apagou as tabelas que o código antigo usa:
**reverter só o código não basta** — o app antigo subiria sobre tabelas que não existem. São as duas
coisas, **nesta ordem**:

1. **Restaurar o backup do Passo 3** (ou do 5.1, se você o fez), pelo Roteiro 3
   (`docs/operacao/03-backup-e-restauracao.md`, `./scripts/restaurar.sh`). O banco volta a ser o de
   antes, com as tabelas de Encomendas. Enquanto o passo 2 abaixo não termina, o código novo roda
   sobre o banco velho — é a Janela 1 de novo, a que você aceitou.
2. **Reverter a publicação**, com os mesmos comandos do Caso A (`git revert -m 1 <merge>` + `git push`)
   e esperar o run verde.

Por que nessa ordem e não na inversa: revertendo primeiro, o código **antigo** ficaria no ar sobre o
banco **migrado** (sem as tabelas dele) durante os ~25 minutos do pipeline — a Janela 2, a proibida.

**Caso C — o job `implantar` caiu no Passo 4.** Veja em `gh run view <id>` em que passo dele. Se caiu
antes do `docker compose up -d app`, o app no ar continua o antigo e o banco está intacto: **não
migre**; chame. Se caiu depois (no "Verificar /api/health pelo domínio"), o app novo pode estar no ar:
confira com `curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/producao`
— `503` quer dizer app novo sobre banco velho (a Janela 1); chame antes de migrar.

**Depois de um revert — voltar com o código.** 🔴 Rodar o Passo 4 de novo **não funciona** depois de
um `git revert -m 1`: para o git, os commits do branch já foram integrados (o revert desfez o efeito
deles, não a integração), e `git merge --no-ff gsd/phase-06.1-producao` responde `Already up to date`,
ou traz só os commits novos. O caminho é desfazer o revert:

```bash
git switch main
git log --oneline -10
git revert <o hash do commit "Revert "Merge branch 'gsd/phase-06.1-producao'"">
```

**O que faz:** cria um commit novo que devolve todo o código da fase — o "revert do revert". Se houve
correção em commits novos no branch da fase, `git merge --no-ff gsd/phase-06.1-producao` traz esses
commits (e só eles). Depois, `git push`, o run verde, e este roteiro **de novo a partir do Passo 3**
(backup novo antes da migração).

Se nenhum dos casos descreve o que você está vendo: **pare e chame** antes de improvisar num banco ou
num servidor de produção.

---

## Passo 10 — A data da publicação (D-17)

Anote na Parte 1 da caminhada **o dia em que o job `implantar` terminou verde** (a data do run no
`gh run list`, no horário de Brasília).

Os endereços antigos `/gestao/encomendas`, `/gestao/encomendas/imprimir` e `/gestao/encomendas/{id}`
levam à Produção por **seis meses depois da publicação** (D-17). A data de remoção está escrita no
código como `DATA_DE_REMOCAO_DA_PRODUCAO = "2027-03-30"` (`lib/rotas/redirecionamentos-antigos.ts`),
calculada em 30/09/2026 — **provisória**. **Se a publicação não foi em 30/09/2026**, a sessão seguinte
troca a constante (e a data do comentário ao lado) para **a data da publicação + 6 meses**. É uma
linha, sem migração; o teste unitário acompanha, porque lê a constante.

---

## O que NÃO muda

- **Caddy.** A Produção é mais uma rota **dentro** de `/gestao`, servida pela mesma aplicação Next, no
  mesmo processo e na mesma porta 3000; `/api/health/producao` está sob `/api/health`, que o Caddy
  também só repassa; e os redirecionamentos de `/gestao/encomendas*` são do próprio Next
  (`next.config.ts`). O `Caddyfile` não tem regra de caminho nenhuma (Roteiro 14, Passo 5) — nada a
  acrescentar.
- **`.env`.** A fase não cria variável de ambiente nova, nem segredo novo. O `.env` é seu, editado à
  mão no servidor, e continua como está.
- **`AUTH_URL`.** Continua **sem** caminho no fim (`https://amassacerrado.com.br`), pelo motivo do
  Roteiro 14, Passo 6: com caminho, ele viraria o `basePath` do Auth.js e quebraria o login. A fase
  não mexe em autenticação.
- **O backup.** O dump diário do Postgres já inclui as tabelas novas por inteiro;
  `/api/health/backup` continua sendo a vigia dele.
