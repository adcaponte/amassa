# Roteiro 18 — A publicação da dispensa do uso livre e a migração `0027`

**Quando rodar:** **uma vez**, na próxima publicação depois do quick `261002-sdt` (02/10/2026), num dia
em que a plataforma **continua fora de uso real** — com o backup feito por você, olhando. **Nunca pelo
pipeline.** Escrito em 02/10/2026, sem ter sido rodado, no molde do Roteiro 17
(`docs/operacao/17-migracao-agenda.md`), que já foi rodado com sucesso. Se algum passo divergir do
descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

**Por que existe:** você decidiu no chat, em 02/10/2026, depois da verificação do Cowork
(`Claude outputs/agenda/VERIFICACAO-COWORK-05.md` §2 item 2), que o **uso livre encerrado com a venda
cancelada no Caixa** também se dispensa ("seguir sugestão do cowork"). Para usar a mesma mecânica das
mensalidades e inscrições (quem, quando, motivo opcional, "Desfazer", nada apagado), `usos_livres`
precisa de três colunas novas — a `0027`.

**O que a `0027_dispensa-do-uso-livre.sql` faz no banco — só acrescenta.**

- **Três colunas que aceitam vazio** em `usos_livres`: `dispensada_em`, `dispensada_por` (aponta para
  `usuarios`) e `motivo_dispensa`. Nenhuma linha antiga ganha valor nelas.
- **Três checks:** `usos_livres_dispensada_por` (quem dispensou é obrigatório),
  `usos_livres_motivo_so_com_dispensa` (motivo só com dispensa, até 200 caracteres) e
  `usos_livres_dispensa_so_com_venda` (só o uso **encerrado** e **com venda ligada** se dispensa).
  Todas as linhas de hoje passam neles, porque as colunas nascem vazias.
- **Nada é apagado nem renomeado.** O código de antes funciona sobre o banco novo.
- **Provada, não aplicada.** Ela rodou no Postgres efêmero de `npm run test:migracoes` (cinco recusas
  com o nome certo do check e um aceite) e em toda execução do e2e. Em produção, só você a aplica.

> 🔴 **A janela — a mesma da D-15, menor.**
>
> Entre o fim do job `implantar` (Passo 3) e o fim do `db:migrate` (Passo 4), o **código novo roda
> sobre o banco velho**. Nesse intervalo **a Agenda falha em boa parte**: "A receber", a semana com uso
> livre encerrado, a ficha da pessoa, reservar e encerrar uso livre e o "Lançar na Venda" que vem da
> Agenda — o Drizzle passa a listar as colunas novas de `usos_livres`. **`/api/health/agenda` fica
> `503`** até a migração: é o sinal de que ela falta. Caixa, Estoque, Produção e o site não dependem
> dessas colunas.
>
> Migrar **antes** de o `implantar` terminar também seria seguro (a `0027` só acrescenta), mas a imagem
> `ferramentas` só traz a `0027` depois que o job `imagem` publica. Este roteiro segue a ordem que os
> Roteiros 15, 16 e 17 já provaram: publicar, esperar o `implantar`, migrar logo em seguida.

**Como ler cada passo:** o mesmo formato do Roteiro 17 — cada comando com **o que faz** e **o que você
deve ver**. Os comandos do servidor rodam na sessão SSH como `theo`, em `/opt/amassa`, com `docker
compose run --rm ferramentas` (nunca `docker compose exec app`). Nenhum comando pede credencial.

---

## Passo 1 — Guarda e contagem ANTES

```bash
hostname
whoami
cd /opt/amassa
docker compose exec postgres psql -U amassa_owner -d amassa -c "select current_database();"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select tipo, count(*) as quantos, max(data) as ultimo_dia from documentos where cancelado_em is null and data >= current_date - 14 group by tipo order by tipo;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from usos_livres) as usos_livres, (select count(*) from documentos) as documentos, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:** o host do VPS, `theo`, `amassa`; na segunda consulta, só o que você reconhece
como teste. **Se já houver venda real no Caixa, pare e decida de novo** se a janela é aceitável hoje.
Na terceira, anote os três números: `migracoes_aplicadas` deve ser **27** (as `0000` a `0026`; medido
pelo Passo 7 do Roteiro 17 em 02/10/2026). Depois do Passo 4 ele tem de ser **28**, e os outros dois,
iguais.

---

## Passo 2 — Backup, antes de tocar em qualquer coisa

```bash
cd /opt/amassa
./scripts/backup.sh --agora
echo $?
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok from execucoes_backup order by quando desc limit 1;"
ls -la /opt/amassa/backups/ | tail -5
```

**O que você deve ver:** nenhuma saída do backup, `0` no `echo`, uma linha com `sucesso = t` e o horário
de agora, e o arquivo de hoje com tamanho na mesma ordem dos anteriores. **Sem backup verificado (linha
E tamanho), não siga.** Daqui até o fim do Passo 5, ninguém lança nada na plataforma.

---

## Passo 3 — Publicar (no seu computador) e esperar o pipeline TERMINAR

```bash
cd <a pasta do projeto no seu computador>
git status
git fetch
git log origin/main..main --oneline
git push
gh run list --limit 3
```

**O que faz:** confirma que não há nada a meio, lista o que vai junto e publica o `main` local. O
`push` dispara "Entrega contínua".

**O que você deve ver:** `nothing to commit, working tree clean`; no `git log`, os commits do quick
`261002-sdt` (entre eles `feat(agenda): migração 0027 — dispensa do uso livre (versionada, não
aplicada)`) e nada que você não reconheça — **um commit estranho, pare e pergunte**. Depois, repita `gh
run list` até o run ficar **`completed  success`** nos quatro jobs (`qualidade`, `e2e`, `imagem`,
`implantar`; uns 20 a 25 minutos).

> **A janela abre quando o `implantar` fica verde.** Vá direto ao Passo 4. Vermelho em `qualidade`,
> `e2e` ou `imagem`: o app no ar continua o antigo e o banco está intacto — **não migre**, chame. Se for
> a janela 60 (fonte), `gh run rerun <id> --failed`.

---

## Passo 4 — `db:migrate`, logo em seguida

```bash
cd /opt/amassa
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep 0027
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que faz:** baixa a `ferramentas` do run do Passo 3, confere que a `0027` está dentro dela e a aplica
numa transação só.

**O que você deve ver:** `0027_dispensa-do-uso-livre.sql` no `grep` (**nenhuma linha? pare** — a imagem
é velha e o `db:migrate` diria sucesso sem aplicar nada); depois `Migrações aplicadas com sucesso.` e
`0`. Saiu diferente de `0`: **pare**, copie a saída e vá ao Passo 6 — nada ficou aplicado.

---

## Passo 5 — Conferir: de fora e de dentro

**5.1 — De fora:**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/agenda
curl -s https://amassacerrado.com.br/api/health/agenda
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
```

**O que você deve ver:** `200`, `{"status":"ok"}` e `200`. Desde o quick `261002-sdt` a rota da Agenda
também pede a coluna `usos_livres.dispensada_em` — `200` prova que o app publicado enxerga a `0027`.
`503`: a migração não aplicou; volte ao Passo 4.

**5.2 — De dentro, por SQL — as três colunas e os três checks:**

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'usos_livres' and column_name in ('dispensada_em', 'dispensada_por', 'motivo_dispensa') order by column_name;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select conname from pg_constraint where conrelid = 'public.usos_livres'::regclass and conname in ('usos_livres_dispensada_por', 'usos_livres_motivo_so_com_dispensa', 'usos_livres_dispensa_so_com_venda', 'usos_livres_dispensada_por_usuarios_id_fk') order by conname;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from usos_livres) as usos_livres, (select count(*) from usos_livres where dispensada_em is not null) as dispensados, (select count(*) from documentos) as documentos, (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:** três colunas, todas `is_nullable = YES` (`dispensada_em` como `timestamp with
time zone`, `dispensada_por` como `uuid`, `motivo_dispensa` como `text`); **quatro** restrições (os três
checks e a chave estrangeira); e, na última, `usos_livres` e `documentos` **iguais** aos do Passo 1,
`dispensados = 0` e `migracoes_aplicadas = 28`.

**5.3 — No celular:** abra a Agenda → "A receber". Ela abre sem erro. Se houver um uso livre encerrado
com a venda cancelada, ele mostra "Dispensar a cobrança"; o uso livre sem venda continua sem o botão.

---

## Passo 6 — Se der errado: o caminho de volta

- **A migração falhou (Passo 4, código diferente de `0`).** Nada ficou aplicado (transação só). O app
  novo está no ar sobre o banco velho — a janela continua. Ou corrija para a frente (copie a saída e
  chame; a correção é commit novo, `npm run verificar`, `git push`, e de volta ao Passo 4), ou volte o
  app: `git log --oneline -10`, `git revert <os commits do quick 261002-sdt, do mais novo ao mais
  antigo>`, `git push`, run verde. O banco nunca mudou.
- **Falha depois da migração** (`503` com o `db:migrate` em `0`, SQL que não bate, telas quebradas).
  Como a `0027` só acrescenta, **o código antigo funciona sobre o banco novo**: reverter os commits
  (como acima) basta, e as três colunas ficam vazias e sem uso. **Restaurar o backup do Passo 2** pelo
  Roteiro 3 (`./scripts/restaurar.sh`) **só se algum dado tiver sido estragado** — compare o 5.2 com o
  Passo 1: iguais, não restaure.
- **Desfazer a `0027` de vez** (se um dia você desistir da dispensa do uso livre): é outra migração,
  nova, com `alter table usos_livres drop constraint …` dos três checks e da chave e `drop column` das
  três colunas — escrita por um plano, provada no `test:migracoes`, aplicada por este mesmo caminho
  (backup antes). Nunca à mão no `psql`.

Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.

---

## O que NÃO muda

- **Caddy, `.env`, `AUTH_URL`:** nada a mexer. A mudança é só código e três colunas.
- **O default de `turmas.publica`:** continua `true` no banco. A caixa "Mostrar no calendário público
  do site" agora vem desmarcada (decisão 1 do dono, 02/10/2026), mas isso é só da tela — o único
  `insert` de turmas grava o valor que a ação recebe, e o Zod exige esse valor. Sem migração para isso.
- **O backup:** o dump diário já inclui as colunas novas; `/api/health/backup` continua a vigia.
