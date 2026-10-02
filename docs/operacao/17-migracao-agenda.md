# Roteiro 17 — A publicação da Fase 5 (Agenda) e a migração `0026`

**Quando rodar:** **uma vez**, depois de ler e responder a Parte 0 de
`.planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md` (as decisões tomadas sem você), num dia em que a
plataforma **continua fora de uso real** — com o backup feito por você, olhando. **Nunca pelo
pipeline.** Escrito em 02/10/2026, pelo plano `05-16-PLAN.md`, sem ter sido rodado. Se algum passo
divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

**O que este roteiro faz, em uma frase por passo:**

| Passo | Onde | O quê |
|---|---|---|
| 0 | celular | Você lê as decisões tomadas sem você (Parte 0 da caminhada) e confirma ou pede troca |
| 1 | servidor | Guarda: servidor e banco certos — **e a plataforma continua fora de uso real hoje** |
| 2 | servidor | Contar ANTES: vendas, parcelas, livro do Estoque, e os nomes que a semente da `0026` usa |
| 3 | servidor | Backup, conferido por linha e tamanho |
| 4 | seu computador | Publicar: `git merge --no-ff gsd/phase-05-agenda` e `git push`; esperar o job `implantar` **terminar** |
| 5 | servidor | `db:migrate` pela `ferramentas`, **logo em seguida** — a `0026` numa transação só |
| 6 | qualquer lugar | Conferir de fora: `/api/health/agenda` em 200 |
| 7 | servidor | Conferir de dentro, por SQL: oito tabelas, `has_table_privilege`, o enum, os itens do sistema, antes × depois |
| 8 | celular | O preço da hora do uso livre em Cadastros, e a Agenda, "A receber" e o Início |
| 9 | — | Se der errado: o caminho de volta |

> 🔴 **A janela que você aceitou — D-15.**
>
> Entre o fim do job `implantar` (Passo 4) e o fim do `db:migrate` (Passo 5), o **código novo roda
> sobre o banco velho**. Nesse intervalo falham com a tela de erro (ou com "não deu para…"):
>
> - **toda venda** (manual, pelo Caixa, ou vinda de orçamento) e **toda despesa**, inclusive a **conta
>   fixa** — o `insert` de `documentos` que o Drizzle monta agora lista a coluna `cliente_id`, que só
>   nasce na `0026`;
> - **a aprovação de orçamento** (que grava a venda);
> - **toda gravação no livro do Estoque** — entrada, saída, ajuste, contagem, a baixa da venda com item
>   de estoque e a compra de material — porque toda linha nova do livro leva a coluna `uso_livre_id`,
>   que também só nasce na `0026`;
> - **a conclusão na Produção** (que guarda a peça no estoque);
> - a Agenda inteira (`/gestao/agenda`), Cadastros → Clientes e o bloco da Agenda no Início — as
>   tabelas deles ainda não existem;
> - a seção de aulas do site (`amassacerrado.com.br`) cai no estado de antes (o da Fase 04.6), sem
>   erro na tela.
>
> É o Pitfall 2 da pesquisa da fase. Você aceitou isso na D-15 ("vamos publicar da melhor forma, nao
> tem importancia o site falhar agora"), **com a plataforma fora de uso real** — por isso o Passo 1
> confere, no dia, que ela continua assim. A migração vem **logo depois** do `implantar` — alguns
> minutos, não horas —, e `/api/health/agenda` fica `503` até ela.
>
> **Migrar antes de o `implantar` terminar também seria aceitável aqui**, ao contrário do Roteiro 16:
> a `0026` **só acrescenta** (oito tabelas, três colunas que aceitam vazio, um valor de enum, dois
> gatilhos, a semente) e não apaga nem renomeia nada, então o código antigo continua funcionando sobre
> o banco novo. Mesmo assim, **este roteiro segue a ordem que você decidiu** (publicar, esperar o
> `implantar`, migrar): é a ordem que os Roteiros 15 e 16 já provaram, e a que a imagem `ferramentas`
> garante — ela só traz a `0026` depois que o job `imagem` publica.
>
> 🔴 **O pipeline também roda à mão — e aí publica o branch que você escolher.** Até o Passo 4,
> **não** use "Run workflow" em Actions → "Entrega contínua" no GitHub (nem `gh workflow run`) com o
> branch `gsd/phase-05-agenda` selecionado: o job `implantar` não confere de que branch veio o código,
> e publicaria a fase antes do backup do Passo 3, abrindo a janela sem você por perto. Se precisar
> rodar o pipeline à mão antes do Passo 4, só com `main` selecionado.

**O que a `0026_agenda.sql` faz no banco — só acrescenta.**

- **Cria** as tabelas `clientes`, `turmas`, `turma_alunos`, `eventos`, `inscricoes`, `mensalidades`,
  `usos_livres` e `usos_livres_material`, os tipos `tipo_evento`, `tipo_inscricao`, `presenca` e
  `estado_uso_livre`, e a função `nome_normalizado()` (busca sem acento: "Joao" acha "João").
- **Acrescenta** três colunas vazias: `documentos.cliente_id` (a venda que a Agenda lança aponta para
  a pessoa — D-01; a venda manual continua com o nome em texto), `movimentacoes_estoque.uso_livre_id`
  (o material do uso livre — D-06) e `itens_catalogo.chave_do_sistema` (D-17). Nenhuma linha antiga
  ganha valor nelas.
- **Acrescenta o valor `uso_livre`** ao fim do tipo `destino_saida` (o destino "Uso livre do espaço"
  das saídas do Estoque — D-06). Depois de aplicado, esse valor só sai recriando o tipo.
- **Semeia** as categorias "Aulas e oficinas" e "Uso do espaço" (só se não existirem pelo nome) e três
  itens do Catálogo que a Agenda acha **pelo código, nunca pelo nome**: "Mensalidade", "Inscrição em
  oficina" e "Uso livre (hora)", **todos sem preço** — o da mensalidade vem da turma, o da oficina vem
  do evento, e o da hora **você** cadastra no Passo 8 (AGE-17). Um gatilho impede desativá-los ou
  trocar o código; nome, preço e categoria continuam editáveis.
- **Tira o `delete`** de `clientes`, `turmas`, `turma_alunos` e `mensalidades` do usuário do app
  (`amassa_app`): pessoa, turma, matrícula e mensalidade não se apagam — sair é "saiu em", desativar é
  "inativa", não cobrar é "dispensar".
- **Entra inteira ou não entra.** O `db:migrate` aplica todas as migrações pendentes numa transação só
  (`node_modules/drizzle-orm/pg-core/dialect.js`, `session.transaction` em volta do laço). Se qualquer
  instrução falhar, o banco fica exatamente como estava. (É por isso que os dois `check`s do livro do
  Estoque comparam o destino **como texto**: o Postgres recusa usar um valor de enum na mesma transação
  que o criou — Pitfall 1.)
- **Provada, não aplicada.** Ela rodou e foi conferida no Postgres efêmero de `npm run test:migracoes`
  (`conferirAgenda`, um banco próprio que recebe todas as migrações, com dado de teste) e em toda
  execução do e2e. Em produção, só você a aplica.

**O que este roteiro NÃO faz:**

- **Não mexe no Caddy, no `.env`, no `AUTH_URL` nem no número do WhatsApp do site.** A seção "O que
  NÃO muda", no fim, diz por quê.
- **Não confere os 9 critérios da fase.** Isso é a Parte 2 da caminhada
  (`05-VERIFICACAO-HUMANA.md`), no celular, depois deste roteiro.
- **Não roda nada pelo pipeline.** O pipeline publica imagem e sobe o app; migração é à mão, depois de
  backup, por você olhando (regra do projeto).

**Como ler cada passo:** o mesmo formato dos Roteiros 12 a 16 — cada comando vem com **o que faz** e
**o que você deve ver**. Os comandos do servidor rodam na sessão SSH como `theo`, com `docker compose
run --rm ferramentas`, **nunca** `docker compose exec app` (a imagem `app` não tem `drizzle-kit` nem a
pasta `db/`, `WINDOWS.md #14`). Nenhum comando abaixo pede credencial nem string de conexão — o
repositório é público.

**Onde anotar:** a Parte 1 da caminhada tem uma linha **Resultado** para cada passo. **Não cole nome de
cliente** nas anotações — a caminhada fica no repositório, que é público. Números e "ok" bastam.

> Sobre `gh` no seu computador: ele está instalado e autenticado, mas o Git Bash não o enxerga sem
> `export PATH="/c/Program Files/GitHub CLI:$PATH"`. No PowerShell ele já funciona direto.

---

## Passo 0 — As decisões que só você toma

Antes de qualquer comando: abra `.planning/phases/05-agenda/05-VERIFICACAO-HUMANA.md`, **Parte 0**, e
responda. Ela junta tudo o que foi decidido sem você no planejamento e nos 15 planos da execução, cada
item com "como desfazer" — primeiro as que mexem em dinheiro, depois as escolhas de interface que você
mais provavelmente queira rever, e a conferência do **número do WhatsApp do site**
(`CONTEUDO_SITE.zap` — era o placeholder `5562900000000`; em 02/10/2026 você deu o real, `5562994817661`, já no branch): o botão "Reservar pelo WhatsApp"
vai ao ar com este roteiro.

**Se trocar alguma decisão: pare aqui.** Peça o ajuste no branch `gsd/phase-05-agenda`, espere
`npm run verificar` sair verde nele, e só então siga. Uma troca que mexa na `0026` é barata **agora** —
ela não está aplicada em lugar nenhum —, e cara depois do Passo 5.

---

## Passo 1 — Guarda: servidor certo, banco certo, plataforma fora de uso

**1.1 — O servidor e o banco:**

```bash
hostname
whoami
ls -d /opt/amassa
cd /opt/amassa
docker compose exec postgres psql -U amassa_owner -d amassa -c "select current_database();"
```

**O que faz:** confirma que você está na sessão SSH do servidor de produção e no banco `amassa` — os
passos seguintes mudam a estrutura de um banco de verdade, e o comando certo no lugar errado não tem
desfazer fácil.

**O que você deve ver:** o nome do host do VPS (não o do seu computador), `theo`, `/opt/amassa` listado
sem erro, e `amassa` na última saída. Qualquer outra coisa — **pare aqui**.

**1.2 — A plataforma continua fora de uso real? (a condição da D-15)**

A D-15 foi aceita com a plataforma **fora de uso**: durante a janela (o quadro no topo), nenhuma venda
grava. Responda na Parte 1 da caminhada: **alguém está usando a plataforma de verdade hoje — vendas
reais no Caixa, despesas reais, baixas reais no Estoque?** Para ajudar a lembrar, o que foi lançado nos
últimos 14 dias:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select tipo, count(*) as quantos, max(data) as ultimo_dia from documentos where cancelado_em is null and data >= current_date - 14 group by tipo order by tipo;"
```

**O que faz:** conta, por tipo (venda, despesa…), os lançamentos não cancelados das duas últimas
semanas, e o dia do mais recente. Só números — nenhum nome.

**O que você deve ver:** só o que você reconhece como teste (ou `(0 rows)`). **Se já houver venda real
no Caixa — a loja ou o café lançando de verdade —, pare aqui e fale com o Theo antes** (se for você
mesmo o Theo: decida de novo, com essa informação, se a janela ainda é aceitável, e em que horário).
Nesse caso o caminho mais seguro é migrar **antes** de publicar (o quadro do topo explica por que a
`0026` permite) — mas isso muda o roteiro, e não se improvisa no servidor.

---

## Passo 2 — Contar ANTES

Ainda no servidor, em `/opt/amassa`. Anote os números na Parte 1 da caminhada: o Passo 7 compara com
eles.

**2.1 — O que a migração NÃO pode mexer (vendas, parcelas, livro do Estoque):**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from documentos) as documentos, (select count(*) from parcelas) as parcelas, (select count(*) from movimentacoes_estoque) as movimentacoes;"
```

**O que você deve ver:** três números. Anote os três — depois do Passo 5 eles têm de ser **iguais** (a
`0026` só acrescenta coluna vazia; não grava nem apaga linha nessas tabelas).

**2.2 — Itens do Catálogo com os nomes que a semente usa:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nome, ativo, preco_venda_centavos from itens_catalogo where lower(trim(nome)) in ('mensalidade', 'inscrição em oficina', 'uso livre (hora)');"
```

**O que faz:** procura item cadastrado à mão com o mesmo nome dos três itens que a `0026` cria. O nome
de item não é único no Catálogo, e a semente procura pelo **código** (`chave_do_sistema`), não pelo
nome.

**O que você deve ver:** `(0 rows)` — o esperado. **Se aparecer alguma linha, não pare:** anote. A
semente cria **outro** item com o mesmo nome, com o código, e é esse que a Agenda usa. Depois do
Passo 8, renomeie (ou desative) o que foi feito à mão em Cadastros → Catálogo, para não ficarem dois
iguais na Venda.

**2.3 — As duas categorias que a semente usa:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nome, grupo, area, ativa from categorias where lower(trim(nome)) in ('aulas e oficinas', 'uso do espaço') order by nome;"
```

**O que você deve ver:** duas linhas — "Aulas e oficinas" e "Uso do espaço" —, as duas `receita`,
`espaco`, `ativa = t` (vêm da semente da `0016`). Se faltar alguma, tudo bem: a `0026` a recria. **Se
alguma estiver `ativa = f`**, anote: os itens da Agenda nascem apontando para ela; reative-a em
Cadastros → Categorias depois do Passo 8.

**2.4 — Quantas migrações o banco já tem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as migracoes_aplicadas from drizzle.__drizzle_migrations;"
```

**O que você deve ver:** `26` (as migrações `0000` a `0025`; a contagem que você colou no chat depois
do Roteiro 16, em 30/09/2026, foi 26). Anote: depois do Passo 5 ele tem de ser **esse mais 1**.

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
tamanho na mesma ordem de grandeza dos anteriores — nada em `0` bytes nem visivelmente menor. **Sem
backup verificado (linha E tamanho), não siga para o Passo 4.**

**Daqui até o fim do Passo 7, ninguém lança nada na plataforma** (nem você, nem a Andressa): o que for
gravado depois deste backup se perde se precisarmos restaurá-lo — e, durante a janela, nem grava.

---

## Passo 4 — Publicar (no seu computador) e esperar o pipeline TERMINAR

> 🔴 **D-15, de novo, porque é aqui que a janela abre.** Quando o pipeline deste passo terminar de
> subir o app, o código novo estará no ar sobre o banco velho, e **toda venda, despesa, aprovação de orçamento, conta fixa,
> baixa de estoque e conclusão da Produção falha** até o Passo 5 (o quadro no topo). Não comece este
> passo sem tempo para ir direto ao Passo 5.

**4.1 — Veja o que vai junto:**

```bash
cd <a pasta do projeto no seu computador>
git status
git fetch
git log origin/main..main --oneline
git log gsd/phase-05-agenda..main --oneline
```

**O que faz:** o primeiro confirma que não há nada a meio no seu computador; o segundo atualiza o que
o seu computador sabe do GitHub; o terceiro lista os commits do seu `main` local que ainda não foram
publicados — o `push` deste passo publica **todos** eles junto com a fase; o quarto confirma que o
`main` não andou desde que o branch da fase saiu dele (se tivesse andado, a integração poderia ter
conflito).

**O que você deve ver:** `nothing to commit, working tree clean`; **nada** no terceiro — medido em
02/10/2026 às 00h38 UTC: `main` = `origin/main` = `cfd0990` ("create phase plan — 16 planos
sequenciais", 01/10), conferido por `git ls-remote origin refs/heads/main`; e **nada** no quarto. Um
commit que você não reconhece, ou qualquer linha no quarto — **pare aqui** e pergunte antes de
publicar.

**4.2 — Integrar e publicar:**

```bash
git switch main
git merge --no-ff gsd/phase-05-agenda
git push
```

**O que faz:** integra o branch da fase inteira em `main`, com um commit de integração próprio (é ele
que o Passo 9 reverte se precisar), e publica. O `push` dispara o pipeline "Entrega contínua".

**O que você deve ver:** o editor com a mensagem do merge (salve e feche), a lista de arquivos da fase,
e o `push` aceito. **Não deve haver conflito** — o branch saiu do seu `main` e o `main` não andou (o 4.1
provou). Conflito em qualquer arquivo — **pare** (`git merge --abort`) e chame.

> Entre o `git switch main` e o fim do `git merge`, este roteiro e a caminhada somem do disco por um
> instante (eles só existem no branch da fase até a integração). Se estiver lendo pelo editor, use um
> que não recarregue do disco — ou siga pela cópia de leitura em `Claude outputs/agenda/`, fora do git.

**4.3 — Esperar o run inteiro, com o `implantar` concluído:**

```bash
gh run list --limit 3
```

**O que você deve ver:** o run de `Entrega contínua` do commit de integração, até ele ficar
**`completed  success`** — os quatro jobs: `qualidade`, `e2e`, `imagem` e `implantar`. Leva uns 20 a
25 minutos. Repita o comando de tempos em tempos; para ver os jobs um por um, `gh run view <id>`.

> **A janela abre quando o `implantar` fica verde.** A partir desse instante, vá direto ao Passo 5,
> sem pausa. (Antes disso, com o job `imagem` verde, a `ferramentas` nova já está no registro — e
> migrar ali também não quebraria nada, porque a `0026` só acrescenta; mas a ordem decidida é esperar o
> `implantar`.)

**Vermelho em algum job:** **pare aqui**, não migre; veja qual caiu (`gh run view <id>`). Se caiu no
`qualidade`, no `e2e` ou no `imagem`, o app no ar continua o antigo e o banco está intacto — nada
quebrou; chame. (O build buscando fonte no Google — janela 60 do `WINDOWS.md` — já derrubou o run
`36443052672`, em 28/09, e o `36802909361`, em 01/10 — o seguinte passou sem mudar nada; se for ela, `gh
run rerun <id> --failed`.) Se caiu no `implantar`, veja o Passo 9, caso C.

---

## Passo 5 — `db:migrate`, logo em seguida

No servidor, em `/opt/amassa`.

**5.1 — (Só se alguém lançou algo desde o Passo 3) um backup de novo:** se, apesar do aviso, alguém
lançou alguma coisa na plataforma depois do backup do Passo 3, rode o Passo 3 inteiro de novo agora —
o backup que vale é o último antes da migração. Se ninguém lançou nada, pule.

**5.2 — A imagem certa, com a migração dentro:**

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep 0026
```

**O que faz:** baixa a imagem `ferramentas` publicada pelo run do Passo 4 (o `implantar` já a baixou;
este `pull` é a garantia) e confere que a `0026` está dentro dela, **antes** de migrar.

**O que você deve ver:** uma linha, `0026_agenda.sql`. **Nenhuma? Pare aqui** — a imagem baixada é
velha, e o `db:migrate` abaixo diria "Migrações aplicadas com sucesso." sem aplicar nada. Volte ao
`gh run list` do Passo 4.

**5.3 — Migrar:**

```bash
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que faz:** aplica a migração que falta — a `0026` — **numa transação só**.

**O que você deve ver:** `Migrações aplicadas com sucesso.` e `0` no `echo`.

> O `migrate()` do Drizzle é silencioso: a mensagem de sucesso **não prova o que foi aplicado**. Os
> Passos 6 e 7 é que provam.

**Saiu diferente de `0`** (ou apareceu "Falha ao aplicar migrações:"): **pare.** Não repita às cegas.
Copie a saída inteira e vá ao Passo 9, caso A — como a transação é uma só, **nada** ficou aplicado.

---

## Passo 6 — Conferir de fora: `/api/health/agenda`

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/agenda
curl -s https://amassacerrado.com.br/api/health/agenda
```

**O que faz:** `/api/health/agenda` é uma rota nova desta fase: ela consulta a tabela de clientes, a
coluna nova das vendas e a coluna nova do livro do Estoque, e responde `200` só se encontra as três —
as três nascem na `0026`. É a prova de fora de que **o app publicado** enxerga o banco migrado. Entre o
`implantar` e o `db:migrate` ela respondia `503` — era a janela. É pública (como `/api/health/producao`)
e nunca diz quantas pessoas estão cadastradas, nem nome, nem valor — só "ok" ou "erro".

**O que você deve ver:** `200` e `{"status":"ok"}`. **Anote a data e a hora** na Parte 1 da caminhada.

- `503` — o app novo está no ar, mas não enxerga a `0026`: a migração não aplicou. Volte ao Passo 5 e
  confira a saída; se o `db:migrate` saiu `0`, vá ao Passo 9, caso B.
- `404` — o app no ar não é o da fase (o `implantar` não terminou, ou não publicou). Volte ao Passo 4.

Confira também que o resto continua de pé:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/estoque
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/producao
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** `200` nos quatro.

---

## Passo 7 — Conferir de dentro, por SQL, DEPOIS

No servidor, em `/opt/amassa`. Cada consulta só dá o resultado esperado se a `0026` aplicou de verdade.

**7.1 — As oito tabelas novas existem:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('clientes', 'turmas', 'turma_alunos', 'eventos', 'inscricoes', 'mensalidades', 'usos_livres', 'usos_livres_material') order by table_name;"
```

**O que você deve ver:** exatamente **oito** linhas: `clientes`, `eventos`, `inscricoes`,
`mensalidades`, `turma_alunos`, `turmas`, `usos_livres`, `usos_livres_material`.

**7.2 — Pessoa, turma, matrícula e mensalidade não se apagam, nem pelo app:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select t as tabela, has_table_privilege('amassa_app', t, 'SELECT') as pode_ler, has_table_privilege('amassa_app', t, 'INSERT') as pode_inserir, has_table_privilege('amassa_app', t, 'UPDATE') as pode_editar, has_table_privilege('amassa_app', t, 'DELETE') as pode_apagar from unnest(array['clientes', 'turmas', 'turma_alunos', 'mensalidades']) as t;"
```

**O que você deve ver:** quatro linhas, cada uma com `pode_ler = t`, `pode_inserir = t`, `pode_editar
= t` e **`pode_apagar = f`**. `t` em `pode_apagar` em qualquer uma — **pare e chame**. (As outras quatro
tabelas — `eventos`, `inscricoes`, `usos_livres`, `usos_livres_material` — podem apagar, de propósito:
o dia fechado, tirar da lista, a reserva não iniciada e o material antes de encerrar.)

**7.3 — O destino novo do Estoque:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select enum_range(null::destino_saida);"
```

**O que você deve ver:** uma lista entre chaves que **termina em `uso_livre`**.

**7.4 — Os três itens do sistema, sem preço:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select i.nome, i.chave_do_sistema, i.preco_venda_centavos, i.ativo, i.aparece_na_venda, c.nome as categoria from itens_catalogo i join categorias c on c.id = i.categoria_venda_id where i.chave_do_sistema is not null order by i.chave_do_sistema;"
```

**O que você deve ver:** três linhas — `Inscrição em oficina` (`inscricao_oficina`, "Aulas e
oficinas"), `Mensalidade` (`mensalidade`, "Aulas e oficinas") e `Uso livre (hora)` (`uso_livre_hora`,
"Uso do espaço") —, as três com `preco_venda_centavos` **vazio**, `ativo = t` e `aparece_na_venda = t`.

**7.5 — A busca sem acento:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select nome_normalizado('  JOÃO  da  Silva ');"
```

**O que você deve ver:** `joao da silva` — minúsculas, sem acento, sem os espaços a mais.

**7.6 — Antes × depois: a migração não mexeu em dado:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from documentos) as documentos, (select count(*) from parcelas) as parcelas, (select count(*) from movimentacoes_estoque) as movimentacoes;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) filter (where cliente_id is not null) as vendas_com_pessoa from documentos;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as migracoes_aplicadas from drizzle.__drizzle_migrations;"
```

**O que você deve ver:**

- `documentos`, `parcelas` e `movimentacoes` **iguais** aos três números do Passo 2.1;
- `vendas_com_pessoa = 0` (nenhuma venda antiga ganhou pessoa — só as que a Agenda lançar daqui para
  frente);
- `migracoes_aplicadas` = o número do 2.4 **mais 1**.

Qualquer divergência — **pare e chame** antes de seguir para o celular.

---

## Passo 8 — No celular: o preço da hora, a Agenda, "A receber" e o Início

1. **O preço da hora do uso livre — decisão sua, não do sistema (AGE-17).** Em
   `amassacerrado.com.br/gestao/cadastros` → **Catálogo**, o item **"Uso livre (hora)"** aparece com a
   marca de item do sistema e o preço vazio. Toque nele, preencha o preço da hora e salve. Sem esse
   preço, dá para reservar, mas encerrar um uso livre avisa "O preço da hora ainda não foi
   cadastrado…" e não cobra. (Os outros dois ficam sem preço
   **de propósito**: a mensalidade usa o preço da turma, e a oficina, o do evento.)
2. **A Agenda:** abra `amassacerrado.com.br/gestao/agenda`. Você deve ver a semana de hoje, sem
   nenhum lançamento, com o "+ Lançar na agenda", e as abas **Agenda · Pessoas · A receber · Números ·
   No site**.
3. **"A receber":** a aba abre vazia ("Ninguém devendo."), sem erro.
4. **O Início:** `amassacerrado.com.br/gestao` mostra o bloco da Agenda de hoje (vazio, logo depois da
   migração) sem erro.
5. **Os itens anotados no Passo 2:** se o 2.2 achou item feito à mão com o mesmo nome, renomeie-o (ou
   desative) agora; se o 2.3 achou categoria desativada, reative-a em Cadastros → Categorias.

Anote na Parte 1 da caminhada. Depois, siga para a **Parte 2** (o celular, no ateliê).

---

## Passo 9 — Se der errado: o caminho de volta

**Caso A — a migração falhou no Passo 5** (código diferente de `0`). Como o migrador aplica tudo numa
transação só, **nada ficou aplicado**: o banco está exatamente como no backup do Passo 3. Mas o código
novo está no ar sobre esse banco — a janela continua aberta. Você escolhe:

- **Corrigir para a frente** (o recomendado, se a causa for clara): copie a saída inteira e chame. A
  correção entra como commit no branch da fase, passa por `npm run verificar`, e é publicada com `git
  merge --no-ff gsd/phase-05-agenda` + `git push` (traz só os commits novos); espere o `implantar` e
  volte ao Passo 5.
- **Voltar ao app de antes**, com o banco intacto:

  ```bash
  git switch main
  git log --merges --oneline -3
  git revert -m 1 <o hash do commit "Merge branch 'gsd/phase-05-agenda'">
  git push
  gh run list --limit 3
  ```

  **O que faz:** `git revert -m 1` cria um commit novo que desfaz tudo o que a integração da fase
  trouxe, mantendo o histórico. Com o run verde, o app volta ao de antes — e o banco, que nunca mudou,
  é o dele. **O que você deve ver:** o run verde e `/api/health` em `200`.

**Caso B — falha DEPOIS da migração** (`503` no Passo 6 com o `db:migrate` em `0`, o SQL do Passo 7 não
bate, ou telas quebradas no Passo 8). Como a `0026` **só acrescenta** — nenhuma tabela ou coluna antiga
muda —, **o código antigo funciona sobre o banco novo**. Então:

1. **Reverter a publicação basta**, com os mesmos comandos do Caso A (`git revert -m 1 <merge>` + `git
   push`) e esperar o run verde. As tabelas novas ficam no banco, vazias e sem uso; os três itens do
   sistema continuam no Catálogo (sem preço, a Venda antiga os mostra como qualquer item "valor na
   hora" — não lance nada com eles).
2. **Restaurar o backup do Passo 3** (ou do 5.1), pelo Roteiro 3 (`docs/operacao/03-backup-e-restauracao.md`,
   `./scripts/restaurar.sh`), **só se algum dado tiver sido estragado.** Como saber: rode as consultas do
   Passo 7.6 e compare com o Passo 2.1. **Iguais** — nenhum dado antigo foi tocado, não restaure (a
   restauração perderia o que foi lançado depois). **Diferentes, sem ninguém ter lançado nada** — algo
   mexeu em dado: pare, chame, e restaure.

**Caso C — o job `implantar` caiu no Passo 4.** Veja em `gh run view <id>` em que passo dele. Se caiu
antes do `docker compose up -d app`, o app no ar continua o antigo e o banco está intacto: **não
migre**; chame. Se caiu depois (no "Verificar /api/health pelo domínio"), o app novo pode estar no ar:
confira com `curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/agenda` —
`503` quer dizer app novo sobre banco velho (a janela); chame antes de migrar.

**Depois de um revert — voltar com o código.** 🔴 Rodar o Passo 4 de novo **não funciona** depois de um
`git revert -m 1`: para o git, os commits do branch já foram integrados (o revert desfez o efeito
deles, não a integração), e `git merge --no-ff gsd/phase-05-agenda` responde `Already up to date`, ou
traz só os commits novos. O caminho é desfazer o revert:

```bash
git switch main
git log --oneline -10
git revert <o hash do commit "Revert "Merge branch 'gsd/phase-05-agenda'"">
```

**O que faz:** cria um commit novo que devolve todo o código da fase — o "revert do revert". Se houve
correção em commits novos no branch da fase, `git merge --no-ff gsd/phase-05-agenda` traz esses commits
(e só eles). Depois, `git push`, o run verde, e este roteiro **de novo a partir do Passo 3** (backup
novo). Se a `0026` já estava aplicada, o `db:migrate` do Passo 5 não tem nada a fazer — a conferência do
Passo 7 continua valendo.

Se nenhum dos casos descreve o que você está vendo: **pare e chame** antes de improvisar num banco ou
num servidor de produção.

---

## O que NÃO muda

- **Caddy.** A Agenda é mais uma rota **dentro** de `/gestao`, servida pela mesma aplicação Next, no
  mesmo processo e na mesma porta 3000; `/api/health/agenda` está sob `/api/health`, que o Caddy também
  só repassa; e o calendário público é parte da raiz do site, que já é do Next. O `Caddyfile` não tem
  regra de caminho nenhuma (Roteiro 14, Passo 5) — nada a acrescentar.
- **`.env`.** A fase não cria variável de ambiente nova, nem segredo novo. O `.env` é seu, editado à
  mão no servidor, e continua como está.
- **`AUTH_URL`.** Continua **sem** caminho no fim (`https://amassacerrado.com.br`), pelo motivo do
  Roteiro 14, Passo 6: com caminho, ele viraria o `basePath` do Auth.js e quebraria o login. A fase não
  mexe em autenticação.
- **O número do WhatsApp do site.** Ele é conteúdo do código (`conteudo/site.ts`, `CONTEUDO_SITE.zap`),
  não do servidor: muda por commit, no branch, antes do Passo 4 — nunca por este roteiro. Por isso a
  conferência dele está na Parte 0 da caminhada (Passo 0), e não aqui.
- **O backup.** O dump diário do Postgres já inclui as tabelas novas por inteiro; `/api/health/backup`
  continua sendo a vigia dele.
