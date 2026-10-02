# Roteiro 15 — Migração do Estoque (`0023`) e a publicação da Fase 06

**Quando rodar:** **uma vez**, depois de responder a Parte 0 de
`.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md` (as decisões de dinheiro do cancelamento) e
antes de qualquer outra coisa da Fase 06 chegar ao ar. **Nunca pelo pipeline.** Escrito em
29/09/2026, pelo plano `06-11-PLAN.md`, sem ter sido rodado — se algum passo divergir do descrito,
o erro pode ser do roteiro: **pare naquele passo** e não improvise.

> 🔴 **Por que este roteiro tem uma ordem que não se inverte (D-33).** O código da Fase 06 grava a
> movimentação de estoque **dentro** de toda venda e de toda compra de material, na mesma
> transação. Se esse código subir antes da migração `0023`, a tabela que ele grava não existe, e
> **TODA venda e TODA compra de material quebram** — não um bloco da tela, o lançamento inteiro. A
> ordem é: **backup → aplicar a `0023` → conferir de fora → só então publicar o código.** É por isso
> que o código da fase mora no branch `gsd/phase-06-estoque`, fora de `main`: um `git push` de
> rotina em `main` nunca o publica antes da hora.
>
> 🔴 **Mas o pipeline também roda à mão — e aí publica o branch que você escolher.** Até o Passo 6,
> **não** use "Run workflow" em Actions → "Entrega contínua" no GitHub (nem `gh workflow run`) com
> o branch `gsd/phase-06-estoque` selecionado: o job `implantar` não confere de que branch veio o
> código, e publicaria o código da fase antes da migração — o mesmo defeito do D-33. Se precisar
> rodar o pipeline à mão antes do Passo 6, só com `main` selecionado.

**O que este roteiro faz, em uma frase por passo:**

| Passo | Onde | O quê |
|---|---|---|
| 0 | celular | Você responde D-23/D-24 e D-29 (decisões tomadas sem você) — **feito em 29/09/2026** |
| 1 | servidor | Guarda: confirmar servidor e banco certos |
| 2 | seu computador | Publicar **só** a migração (sem nenhum código novo) |
| 3 | servidor | Backup, conferido por linha e tamanho |
| 4 | servidor | Aplicar a `0023` pela `ferramentas` |
| 5 | servidor | Conferir de fora, por SQL, **antes** do código |
| 6 | seu computador | Publicar o código da fase |
| 7 | qualquer lugar | Conferir de fora **depois** do código: `/api/health/estoque` |
| 8 | celular | A primeira abertura e a contagem inicial real |
| 9 | — | Se der errado: o caminho de volta |

**O que a `0023` muda no banco — e por que o app de hoje continua rodando com ela.** Ela só
**acrescenta**: a tabela nova `movimentacoes_estoque` (o livro do estoque, que nasce vazia), três
colunas novas em `itens_catalogo`, todas com padrão (`estoque_minimo_milesimos` = 0, `observacoes`
nula, `ativo` verdadeiro), um gatilho que só age sobre item **que já tem movimentação** — como o
livro nasce vazio, ele não tem sobre quem agir até o código novo gravar a primeira —, e **uma
categoria de compra nova, "Produção da casa"** (área Peças; a sua resposta à D-29 em 29/09/2026 —
não entra se você já tiver uma categoria com esse nome). Nenhuma coluna existente muda, nenhuma é
apagada. Por isso o app de hoje, que não sabe de nada disso, continua
funcionando com a `0023` aplicada — o Passo 5 confere isso de fora (`/api/health` em 200).

**O que este roteiro NÃO faz:**

- **Não mexe no Caddy, no `.env` nem no `AUTH_URL`.** A seção "O que NÃO muda", no fim, diz por quê.
- **Não confere os 9 critérios da fase.** Isso é a Parte 2 da caminhada
  (`06-VERIFICACAO-HUMANA.md`), no celular, depois deste roteiro.
- **Não roda nada pelo pipeline.** O pipeline publica imagem e sobe o app; migração é à mão, depois
  de backup, por você olhando (regra do projeto).

**Como ler cada passo:** o mesmo formato dos Roteiros 12 a 14 — cada comando vem com **o que faz**
e **o que você deve ver**. Os comandos do servidor rodam na sessão SSH como `theo`, com `docker
compose run --rm ferramentas`, **nunca** `docker compose exec app` (a imagem `app` não tem
`drizzle-kit` nem a pasta `db/`, `WINDOWS.md #14`). Nenhum comando abaixo pede credencial nem
string de conexão — o repositório é público.

> Sobre `gh` no seu computador: ele está instalado e autenticado, mas o Git Bash não o enxerga sem
> `export PATH="$PATH:/c/Program Files/GitHub CLI"`. No PowerShell ele já funciona direto.

---

## Passo 0 — As decisões que só você toma

> ✅ **Feito em 29/09/2026, pela manhã** — você respondeu a Parte 0 de
> `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md` no chat, por formulário, e as mudanças já
> estão no branch da fase e no branch só-migração (o `06-11-SUMMARY.md`, no adendo, tem os commits e
> o `npm run verificar` verde dos dois). O que você decidiu:
>
> - **D-23** (venda cancelada volta ao custo que a venda levou) e **D-24** (compra cancelada sai ao
>   custo médio de agora): **valem**, sem mudança.
> - **WR-01** (venda cancelada com o saldo zerado ou negativo na hora de cancelar): **a
>   alternativa** — o material volta ao custo médio do instante, e a prateleira não é reprecificada
>   pelo cancelamento. Com saldo positivo, continua a D-23.
> - **WR-02**: **a venda cancelada não conta** como "última entrada com preço" — só compra, entrada
>   manual (e peça pronta) e contagem contam. Material nunca comprado continua mostrando "—".
> - **D-29**: **sim** — a categoria de compra **"Produção da casa"**, área Peças, entra como semente
>   **dentro da própria `0023`** (o Passo 5.5 confere). Por isso o branch só-migração ganhou um
>   commit novo em 29/09: os quatro arquivos continuam os mesmos quatro, com a semente.

O texto abaixo é o que este passo pedia antes das respostas — fica como registro.

Antes de qualquer comando: abra `.planning/phases/06-estoque/06-VERIFICACAO-HUMANA.md`, **Parte 0**,
e responda:

- **D-23** (venda cancelada devolve o material ao custo que a venda levou) e **D-24** (compra
  cancelada sai ao custo médio de agora) — com o exemplo em números. São as duas únicas decisões da
  fase que tocam o **valor do cancelamento**, e foram tomadas numa noite sem você.
- **D-29** — se quer uma categoria de compra própria para a peça produzida na casa (sim / não /
  depois). *(Até a sua resposta de 29/09, nada tinha sido semeado.)*
- **As duas escolhas que a revisão de código achou** (29/09, `06-REVIEW.md` WR-01 e WR-02), na mesma
  Parte 0, §0.1: o valor do estorno de venda quando o saldo está zerado ou negativo na hora de
  cancelar, e se o estorno de venda conta como "última entrada com preço".

**Se trocar D-23, D-24 ou alguma das duas escolhas da revisão: pare aqui.** Peça o ajuste no branch
`gsd/phase-06-estoque` — é um ramo de `movimentoDoEstorno`/`valorarMovimento` em
`lib/estoque/custo.ts` (a WR-02 também mexe nas consultas da "última entrada com preço") e os testes
do bloco "D-23/D-24" de `tests/unit/estoque-custo.test.ts` —, espere `npm run verificar` sair verde,
e só então siga. A troca de D-23/D-24/WR-01/WR-02 **não** mexe na migração; a D-29 sim (foi o que
aconteceu em 29/09 — o branch só-migração foi atualizado).

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
passos seguintes aplicam migração num banco de verdade, e o comando certo no lugar errado não tem
desfazer fácil.

**O que você deve ver:** o nome do host do VPS (não o do seu computador), `theo`, `/opt/amassa`
listado sem erro, e `amassa` na última saída. Qualquer outra coisa — **pare aqui**.

---

## Passo 2 — Publicar SÓ a migração (no seu computador)

**Por que este passo existe.** A migração em produção é aplicada pela imagem `ferramentas`, e essa
imagem só é construída pelo pipeline, a partir de `main` (`.github/workflows/entrega.yml` roda em
`push` para `main`; o job `imagem` publica `:ferramentas`, e o job `implantar` a baixa no
servidor). Se a `0023` não estiver em `main`, ela não existe dentro da imagem do servidor, e o
Passo 4 não teria o que aplicar. Mas pôr o **código** da fase em `main` agora publicaria o código
antes da migração — exatamente o que o D-33 proíbe.

A saída é um branch que leva **só** a migração: `gsd/phase-06-estoque-migracao`, criado a partir do
seu `main` local, com exatamente quatro arquivos a mais — `db/migrations/0023_estoque.sql`,
`db/migrations/meta/_journal.json`, `db/migrations/meta/0023_snapshot.json` e
`scripts/testar-migracoes.mjs`. **Nenhum código, nenhum `db/schema.ts`.** O app que sobe junto com
este `push` é o de antes, sem nada do Estoque; a `0023` só chega ao servidor dentro da imagem
`ferramentas`, esperando você aplicá-la no Passo 4. (Por que sem `db/schema.ts`: com as colunas
novas no schema e a migração ainda não aplicada, qualquer consulta de todas as colunas de
`itens_catalogo` quebraria o app de hoje.)

Primeiro, veja o que vai junto:

```bash
cd <a pasta do projeto no seu computador>
git log origin/main..main --oneline
```

**O que faz:** lista os commits do seu `main` local que ainda não foram publicados. O `push` deste
passo publica **todos** eles, não só a migração — o branch só-migração saiu do seu `main` local.

**O que você deve ver:** a mesma lista que o executor registrou em
`.planning/phases/06-estoque/06-11-SUMMARY.md`, na seção "O branch só-migração", medida no instante
em que criou o branch — **mais os dois commits só de documentos do adendo no fim desse SUMMARY**
(`c4713e1` e `f44f6dc`, "docs(state): main com o estado da fase 06 …", que sincronizaram o `STATE`,
o `ROADMAP` e a `PROXIMA-SESSAO` do `main` depois do corte; o branch só-migração foi refeito sobre
eles). Se você já tiver dado `push` do `main` antes, a lista vem menor ou vazia — tudo bem. São commits de documento e as correções já feitas antes da Fase 06 (entre
elas a da barra de cima do site, SIT-10). Se aparecer um commit que você não reconhece, **pare
aqui** e pergunte antes de publicar.

```bash
git diff --name-only main gsd/phase-06-estoque-migracao
```

**O que você deve ver:** exatamente os quatro arquivos acima, nada mais. Um quinto arquivo —
**pare aqui**.

**Antes de trocar de branch:** este roteiro e a caminhada (`06-VERIFICACAO-HUMANA.md`) só existem
no branch da fase. Ao fazer `git switch main`, os dois **somem do disco** até o Passo 6 — justamente
durante o backup e a migração. Siga daqui em diante pela cópia de leitura em
`Claude outputs/estoque/` (fora do git, não some), ou deixe este arquivo aberto num editor que não
recarregue do disco.

```bash
git switch main
git merge gsd/phase-06-estoque-migracao
git push
```

**O que faz:** traz o commit só-migração para `main` (um avanço rápido, sem conflito: o branch
saiu do seu `main`) e publica.

**O que você deve ver:** `Fast-forward` com os quatro arquivos, e o `push` aceito.

```bash
gh run list --limit 3
```

**O que você deve ver:** o run de `Entrega contínua` do commit que você acabou de publicar, até ele
ficar **verde** (`completed  success`) — os quatro jobs: qualidade, e2e, imagem, implantar. Leva
uns 20 minutos. O e2e desse run é a prova de que o app de hoje passa a suíte inteira com a `0023`
no banco de teste. Vermelho — **pare aqui**, não siga para o backup; veja qual job caiu. (A janela
60 do `WINDOWS.md` — o build buscando fonte no Google — já derrubou um run uma vez e passou na 2ª
tentativa sem mudar nada; se for ela, `gh run rerun <id> --failed`.)

> 🔴 **Daqui até o fim do Passo 6, ninguém roda `npm run db:generate` nem cria migração nova em
> `main`.** Por quê: a partir deste `push`, `main` tem a `0023` e o `meta/0023_snapshot.json`, mas
> **não** o `db/schema.ts` que os gerou — ele só chega no Passo 6, com o código. Um `db:generate`
> nesse intervalo compararia o `schema.ts` antigo com o snapshot novo e escreveria uma migração que
> **DESFAZ** a `0023` (derruba o livro do estoque e as colunas novas). Se aparecer necessidade de
> migração nesse intervalo, **pare e termine este roteiro antes**.

---

## Passo 3 — Backup, antes de tocar no banco

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
**Sem backup verificado (linha E tamanho), não siga para o Passo 4.** É este dump que desfaz o
Passo 4 se ele der errado.

---

## Passo 4 — Aplicar a `0023`

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep 0023_estoque
```

**O que faz:** baixa a imagem `ferramentas` publicada pelo run do Passo 2 e confere que a `0023`
está dentro dela, **antes** de migrar.

**O que você deve ver:** uma linha, `0023_estoque.sql`. **Nada? Pare aqui** — a imagem baixada é
velha (o run do Passo 2 não terminou, ou não publicou), e o `db:migrate` abaixo diria "Migrações
aplicadas com sucesso." sem aplicar nada. Volte ao `gh run list` do Passo 2.

```bash
docker compose run --rm ferramentas npm run db:migrate
```

**O que faz:** aplica as migrações que faltam — só a `0023`.

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Seguro repetir:
o Drizzle pula o que já foi aplicado.

> O `migrate()` do Drizzle é silencioso: a mensagem de sucesso **não prova o que foi aplicado**. O
> Passo 5 é quem prova.

Se sair diferente de `0`: **pare**. Não repita às cegas; vá ao Passo 9, caso A.

---

## Passo 5 — Conferir de fora, ANTES do código

Cada consulta só dá o resultado esperado se a `0023` aplicou de verdade.

**5.1 — O livro existe, e nasce vazio:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'movimentacoes_estoque';"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as movimentacoes from movimentacoes_estoque;"
```

**O que você deve ver:** uma linha, `movimentacoes_estoque`; e `0` movimentações. Vazio na primeira
— **pare aqui**, a migração não aplicou.

**5.2 — As três colunas novas do catálogo, com os padrões em todas as linhas:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select column_name, column_default, is_nullable from information_schema.columns where table_name = 'itens_catalogo' and column_name in ('estoque_minimo_milesimos', 'observacoes', 'ativo') order by column_name;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as itens, count(*) filter (where ativo) as ativos, count(*) filter (where estoque_minimo_milesimos = 0) as minimo_zero from itens_catalogo;"
```

**O que você deve ver:** três linhas — `ativo` com padrão `true` e `NO`; `estoque_minimo_milesimos`
com padrão `0` e `NO`; `observacoes` sem padrão e `YES`. Na segunda, os três números **iguais**:
todo item existente ficou ativo e com mínimo zero ("nunca avisa").

**5.3 — O livro não se edita nem se apaga, nem pelo app:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select has_table_privilege('amassa_app', 'movimentacoes_estoque', 'select') as pode_ler, has_table_privilege('amassa_app', 'movimentacoes_estoque', 'insert') as pode_inserir, has_table_privilege('amassa_app', 'movimentacoes_estoque', 'update') as pode_editar, has_table_privilege('amassa_app', 'movimentacoes_estoque', 'delete') as pode_apagar;"
```

**O que você deve ver:** `pode_ler = t`, `pode_inserir = t`, e **`pode_editar = f`** e
**`pode_apagar = f`**. É a garantia do EST-06 feita pelo próprio banco: correção é ajuste,
cancelamento é estorno, nunca edição nem exclusão. `t` em qualquer um dos dois últimos — **pare e
chame** antes de seguir.

**5.4 — O gatilho que trava a unidade, e o índice que impede estorno em dobro:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name = 'travar_unidade_do_item_com_movimentacao';"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select indexname from pg_indexes where tablename = 'movimentacoes_estoque' and indexname = 'movimentacoes_estoque_estorno_de_uk';"
```

**O que você deve ver:** uma linha, `itens_catalogo` / `travar_unidade_do_item_com_movimentacao` (o
item que já tem movimentação não muda de unidade — 5 kg não viram 5 g); e uma linha,
`movimentacoes_estoque_estorno_de_uk` (uma movimentação só pode ser estornada uma vez).

**5.5 — A categoria de compra "Produção da casa" (D-29), uma vez só:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) from categorias where nome = 'Produção da casa';"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nome, grupo, area, ativa from categorias where nome = 'Produção da casa';"
```

**O que você deve ver:** `1`; e uma linha, `Produção da casa | custo | pecas | t`. `0` — a semente
não rodou (volte ao Passo 4). Se você já tinha criado pela tela uma categoria com esse nome, a sua
fica como estava (a semente não duplica) e a segunda linha mostra o grupo e a área que você deu.

**5.6 — O app de hoje continua de pé com a migração:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
```

**O que você deve ver:** `200`. É o app de antes, sem nada do Estoque, respondendo com a `0023`
aplicada — a prova de que a migração só acrescenta. Se quiser, lance uma venda de teste no celular
agora: ela funciona como sempre e **não** mexe em estoque nenhum (o código que grava ainda não
subiu).

**Tudo conferido? Só então siga para o Passo 6.** Qualquer divergência: pare, não publique o código.

---

## Passo 6 — Publicar o código da fase (no seu computador)

```bash
git switch main
git merge --no-ff gsd/phase-06-estoque
```

**O que faz:** integra o branch da fase inteira em `main`, com um commit de integração próprio (é
ele que o Passo 9 reverte se precisar). Os quatro arquivos da migração já estão em `main` desde o
Passo 2, idênticos, então eles não conflitam.

**O que você deve ver:** o editor com a mensagem do merge (salve e feche), e a lista de arquivos.
**Conflito só pode aparecer em `.planning/`** (documentos de estado): fique com a versão do branch
(`git checkout --theirs <arquivo>` e `git add <arquivo>`), confira a data no topo dele, e conclua com
`git commit`. Conflito em qualquer arquivo fora de `.planning/` — **pare** (`git merge --abort`) e
chame.

```bash
git push
gh run list --limit 3
```

**O que você deve ver:** o `push` aceito, e o run de `Entrega contínua` desse commit até ficar
**verde**, os quatro jobs. A partir do `implantar` verde, o Estoque está no ar. A proibição de
`db:generate` do Passo 2 acaba aqui: `db/schema.ts` e a `0023` estão juntos em `main` de novo.

---

## Passo 7 — Conferir de fora, DEPOIS do código

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/estoque
curl -s https://amassacerrado.com.br/api/health/estoque
```

**O que faz:** `/api/health/estoque` é uma rota nova desta fase: ela consulta a tabela do livro e
as colunas novas do catálogo e responde `200` só se as encontra. O Passo 5 provou o banco; este
passo prova que **o app publicado** enxerga o banco. Ela é pública (como `/api/health/backup`) e
nunca diz quantidade, saldo nem valor — só "ok" ou "erro".

**O que você deve ver:** `200` e `{"status":"ok"}`. **`503`**, ou `404` depois do run verde (o app
publicado não é o da fase) — vá ao Passo 9, caso B.

Anote a data e a hora da medição na Parte 1 da caminhada.

---

## Passo 8 — A primeira abertura e a contagem inicial (no celular)

Abra `amassacerrado.com.br/gestao/estoque`. Você deve ver o painel **"Antes de tudo, conte o que
tem na prateleira."** no lugar da lista — sem saldos, sem alertas, sem a barra de baixo. É de
propósito: antes da contagem, qualquer saldo seria só o efeito de vendas sem uma contagem por
baixo.

Toque em **"Começar a contagem"** e conte o ateliê de verdade: para cada material, quanto tem na
prateleira e quanto custou ao todo. A contagem é às cegas — o sistema só mostra o saldo dele depois
que você digita, para você contar e não copiar.

- **Dá para parar no meio.** Cada material fica gravado quando você toca "Confirmar contagem"; ao
  voltar, os já contados hoje aparecem com ✓.
- **Vendas lançadas entre o Passo 6 e a contagem** já baixaram o estoque e aparecem como saldo
  negativo (ex.: −2 un). Não é defeito: a contagem grava a **diferença** contra o saldo daquele
  instante, e o material termina **exatamente** no número que você contou ("o saldo passa de −2 para
  10 un").
- **Vendas e compras de antes do Passo 6 não entram** — nenhuma movimentação retroativa (EST-15).

Depois da contagem, siga para a **Parte 2** da caminhada (`06-VERIFICACAO-HUMANA.md`).

---

## Passo 9 — Se der errado: o caminho de volta

**Caso A — a migração falhou no Passo 4** (código diferente de `0`, ou o Passo 5 não bateu).
O código da fase **ainda não subiu**, então nenhuma venda depende da `0023`. Pare, copie a saída
inteira, e chame. Se o banco ficou num estado parcial e precisar voltar, restaure o dump do Passo 3
com `./scripts/restaurar.sh`, como no Roteiro 3 (`docs/operacao/03-backup-e-restauracao.md`).
**Não** siga para o Passo 6 com a migração em dúvida.

**Caso B — depois do `push` do Passo 6: `/api/health/estoque` em `503`, ou vendas falhando.**
Reverta o código, não o banco:

```bash
git switch main
git log --merges --oneline -3
git revert -m 1 <o hash do commit "Merge branch 'gsd/phase-06-estoque'">
git push
gh run list --limit 3
```

**O que faz:** `git revert -m 1` cria um commit novo que desfaz tudo o que a integração da fase
trouxe, mantendo o histórico. O app volta ao de antes. O banco **fica com a `0023`** — ela é aditiva,
e o Passo 5.6 já provou que o app de antes roda com ela. A `0023` também continua em `main`: ela
chegou no Passo 2, antes da integração, e o revert não a toca.

**O que você deve ver:** o run verde, e `/api/health` em `200`. Enquanto o código estiver revertido,
as vendas voltam a não mexer em estoque — quando o código voltar, confira a contagem.

> Depois de um revert, `main` volta a ter a `0023` sem o `db/schema.ts` que a gerou — a proibição de
> `db:generate` do Passo 2 **volta a valer** até o código ser reintegrado.

**Caso B, depois — voltar com o código.** 🔴 **Rodar o Passo 6 de novo NÃO funciona depois do Caso
B.** Para o git, os commits do branch da fase já foram integrados (o revert desfez o efeito deles,
não a integração): `git merge --no-ff gsd/phase-06-estoque` responde `Already up to date`, ou traz
só os commits feitos depois. O código do Estoque continuaria fora do ar enquanto parece ter sido
publicado. O caminho é desfazer o revert:

```bash
git switch main
git log --oneline -10
git revert <o hash do commit "Revert "Merge branch 'gsd/phase-06-estoque'"">
```

**O que faz:** `git log` mostra os últimos commits; ache o do revert do Caso B (a mensagem começa
com `Revert "Merge branch 'gsd/phase-06-estoque'"`). `git revert` desse commit cria um commit novo
que devolve todo o código da fase — o "revert do revert".

**O que você deve ver:** o editor com a mensagem (`Revert "Revert "Merge branch…""`) — salve e
feche — e a lista de arquivos da fase de volta.

Se o Caso B aconteceu por um defeito, a correção entra **agora**, antes do `push`: se ela foi feita
como commits novos no branch da fase, `git merge --no-ff gsd/phase-06-estoque` traz esses commits
(e só eles — o resto já voltou pelo revert do revert). Conflito fora de `.planning/` — pare e
chame. Depois:

```bash
git push
gh run list --limit 3
```

**O que você deve ver:** o run verde, os quatro jobs. Então refaça a conferência do **Passo 7**
(`/api/health/estoque` em `200` e `{"status":"ok"}`, com data e hora) e confira a contagem no
celular — as vendas do intervalo em que o código esteve revertido não mexeram no estoque. A
proibição de `db:generate` acaba de novo aqui.

Se nenhum dos dois casos descreve o que você está vendo: **pare e chame** antes de improvisar num
banco ou num servidor de produção.

---

## O que NÃO muda

- **Caddy.** O Estoque é mais uma rota **dentro** de `/gestao`, servida pela mesma aplicação Next,
  no mesmo processo e na mesma porta 3000; `/api/health/estoque` está sob `/api/health`, que o Caddy
  também só repassa. O `Caddyfile` não tem regra de caminho nenhuma (Roteiro 14, Passo 5) — nada a
  acrescentar.
- **`.env`.** A fase não cria variável de ambiente nova, nem segredo novo. O `.env` é seu, editado à
  mão no servidor, e continua como está.
- **`AUTH_URL`.** Continua **sem** caminho no fim (`https://amassacerrado.com.br`), pelo motivo do
  Roteiro 14, Passo 6: com caminho, ele viraria o `basePath` do Auth.js e quebraria o login. A fase
  não mexe em autenticação.
- **O backup.** O dump diário do Postgres já inclui a tabela nova por inteiro; `/api/health/backup`
  continua sendo a vigia dele.
