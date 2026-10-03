# Roteiro 20 — Os Lembretes: a migração `0029`, de carona no Roteiro 19

**Quando rodar:** **uma vez**, para publicar a Fase 06.3 (Lembretes), com o backup feito por você e olhando.
**Nunca pelo pipeline.** Escrito em 03/10/2026 pelo plano `06.3-06`, sem ter sido rodado, no molde dos Roteiros
18 e 19. Se algum passo divergir do descrito, o erro pode ser do roteiro: **pare naquele passo** e não improvise.

**Passo 0:** leia a Parte 0 de `.planning/phases/06.3-lembretes/06.3-VERIFICACAO-HUMANA.md` (as decisões
tomadas sem você) e responda — e, antes dela, a Parte 0 da 06.2 (`06.2-VERIFICACAO-HUMANA.md`), se ainda não
foi respondida. Se trocar alguma, o executor ajusta no branch e roda `npm run verificar` antes de seguir.

---

## Resumo

**O que a `0029_lembretes.sql` faz no banco — só acrescenta uma tabela, `lembretes`** (checks, três chaves
para `usuarios`, um índice e o gatilho `tocar_atualizado_em`). Nada é apagado nem renomeado; o código de antes
ignora a tabela.

- 🔴 **Ela MANTÉM o `delete` para `amassa_app`, de propósito — EXCEÇÃO DELIBERADA (LMB-08, sua decisão de
  02/10/2026).** Lembrete se apaga de verdade: é o único "apagar" de registro da plataforma. Na conferência, o
  `t` do `DELETE` é o resultado **certo** — ao contrário do `f` de `fornecedores` no Roteiro 19.
- **Nada de pasta, volume, `.env`, `compose.yml` ou script de backup novo.** O backup despeja o banco inteiro;
  a tabela nova entra nele sozinha.
- **Provada, não aplicada:** rodou no Postgres efêmero de `npm run test:migracoes` (`conferirLembretes`) e em
  toda execução do e2e. Em produção, só você a aplica.

### A ordem dos branches — publicar a 06.3 publica a 06.2 junto

**Medido em 03/10/2026, 05h12 UTC (02h12 em Brasília), no computador, sem tocar o servidor:**

- `git merge-base --is-ancestor gsd/phase-06.2-fornecedores gsd/phase-06.3-lembretes; echo $?` → **`0`**: o
  branch da 06.3 **contém** a 06.2 inteira (foi criado dela, em `d6ff7bf`). Então
  `git merge --no-ff gsd/phase-06.3-lembretes` em `main` leva as duas fases.
- `git log main..gsd/phase-06.3-lembretes --oneline | wc -l` → **89** (64 da 06.2 e 25 da 06.3, antes deste
  plano; o número final está no `06.3-06-SUMMARY.md`).
- 🔴 **O `main` andou depois que os branches nasceram:** `git merge-base --is-ancestor main
  gsd/phase-06.3-lembretes; echo $?` → **`1`**. O `main` local ganhou `05ac5b7` (quick `261003-fot`: a foto de
  orçamento de 10–15 MB que chegava cortada — o achado (a) da §0.6 da 06.2, corrigido noutra sessão). Por isso
  o merge **não é avanço rápido**: é um merge de verdade. Medido sem mexer em nada (`git merge-tree
  --write-tree main gsd/phase-06.3-lembretes` → saída `0`): **sem conflito**. A frase do Passo 4 do Roteiro 19
  "o `main` é ancestral do branch" deixou de valer em 03/10 — o merge continua limpo.
- `git log origin/main..main --oneline` → **7 commits**: os 6 do quick `261002-sdt` (`c008b1d`..`0b6bdd4`, a
  `0027` e o Roteiro 18) e o `05ac5b7`. O `git push` publica os sete junto com o merge.
- `curl` de `/api/health/backup` → `200`; `/api/health/fornecedores` → `404`; `/api/health/lembretes` → `404`
  (nada das duas fases está no ar).

**Se o branch da 06.2 ganhar commits depois disso** (uma troca da Parte 0 dela), o primeiro comando acima
devolve **`1`**: aí mescle primeiro `gsd/phase-06.2-fornecedores` e depois `gsd/phase-06.3-lembretes`, nessa
ordem, e confira de novo com `git log main..gsd/phase-06.3-lembretes --oneline` (deve sobrar zero).

---

## Caminho A — junto com o Roteiro 19 (o recomendado: nada das duas fases está publicado)

Siga o Roteiro 19 (`docs/operacao/19-migracao-fornecedores.md`) **inteiro**, na ordem — a pasta dos anexos com
o `chown` **antes** do deploy (Passo 3) e a re-extração dos scripts de backup **depois** do `db:migrate`
(Passo 6) continuam obrigatórias, porque a 06.2 vai junto. Uma sessão só:
**um backup** (o do Passo 2 do 19) e **um `db:migrate`** (o do Passo 5 do 19) para as três migrações — `0027`,
`0028` e `0029`, numa transação só. Só quatro trocas:

| Passo do 19 | Troca |
|---|---|
| **1.4** | O esperado continua **27** antes (28 se você rodou o Roteiro 18 sozinho). Depois do Passo 5, o número esperado passa a ser **30** nos dois casos (não 29). |
| **4** | Antes do merge: `git merge-base --is-ancestor gsd/phase-06.2-fornecedores gsd/phase-06.3-lembretes; echo $?` → `0`. No lugar do merge da 06.2, `git merge --no-ff gsd/phase-06.3-lembretes -m "Merge das Fases 06.2 (Fornecedores) e 06.3 (Lembretes) em main — Roteiros 19 e 20"`. O `wc -l` que importa é o de `git log main..gsd/phase-06.3-lembretes`. O merge não é avanço rápido (o `main` andou — veja acima); conflito: **pare e chame**. Vermelho no `e2e` só em `cotacoes-categorias:291`: é o defeito aberto do §0.8 da caminhada da 06.3 — não migre; chame. |
| **5** | O `grep` vira `docker compose run --rm ferramentas ls db/migrations \| grep -E "0027\|0028\|0029"` e deve mostrar as três. **Faltou a `0029`? Pare** — a imagem é velha. O `db:migrate` é o mesmo, uma vez. |
| **8** | Some a conferência deste roteiro (abaixo: "De fora" e "De dentro") ao 8.1 e ao 8.2; no 8.3, `migracoes_aplicadas = 30`. |

**A janela fica a do Roteiro 19** (vendas e despesas param; `/api/health/fornecedores` e `/api/health/backup`
503), **mais a dos lembretes** (abaixo). Vá do `implantar` verde ao `db:migrate` sem parar.

---

## Caminho B — depois do Roteiro 19 já feito

Só se a 06.2 já está no ar e migrada (`/api/health/fornecedores` = 200 e `migracoes_aplicadas` = 29).

**B.1 — Guarda e contagem** (no servidor, em `/opt/amassa`): os comandos do **Passo 1.1 do Roteiro 19**
(host do VPS, `theo`, banco `amassa` — o comando certo no banco errado não tem desfazer fácil) e depois:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select (select count(*) from drizzle.__drizzle_migrations) as migracoes_aplicadas;"
```

**O que você deve ver:** **`29`**. Outro número: **pare e chame**.

**B.2 — Backup:**

```bash
./scripts/backup.sh --agora
echo $?
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso from execucoes_backup order by quando desc limit 1;"
```

**O que você deve ver:** `0` e uma linha com `sucesso = t` e o horário de agora. **Sem isso, não siga.**

**B.3 — Publicar** (no seu computador):

```bash
git status
git checkout main
git fetch
git log origin/main..main --oneline
git log main..gsd/phase-06.3-lembretes --oneline | wc -l
git merge --no-ff gsd/phase-06.3-lembretes -m "Merge da Fase 06.3 (Lembretes) em main — Roteiro 20"
git push
gh run list --limit 3
```

**O que você deve ver:** árvore limpa; no `log`, só o que você reconhece (um commit estranho: pare e
pergunte); o merge sem conflito; e, repetindo o `gh run list`, o run **`completed  success`** nos quatro jobs
(`qualidade`, `e2e`, `imagem`, `implantar` — uns 20 a 30 minutos). Vermelho antes do `implantar`: o app no ar
é o antigo e o banco está intacto — **não migre**, chame. **A janela abre quando o `implantar` fica verde.**

**B.4 — `db:migrate`, logo em seguida** (no servidor):

```bash
cd /opt/amassa
docker compose pull ferramentas
docker compose run --rm ferramentas ls db/migrations | grep 0029
docker compose run --rm ferramentas npm run db:migrate
echo $?
```

**O que você deve ver:** `0029_lembretes.sql` no `grep` (faltou? **pare** — imagem velha), **`Migrações
aplicadas com sucesso.`** e **`0`**. Diferente de `0`: **pare**, copie a saída e vá ao caminho de volta.
Depois, **B.5 — a conferência** (abaixo), com `migracoes_aplicadas = 30`.

---

## A janela — pequena, e escrita

Entre o `implantar` verde e o fim do `db:migrate`, o código novo roda sobre o banco sem a `0029`:

- no Início, a coluna **"Para fazer"** mostra **"Não deu para carregar os lembretes. Verifique a internet e
  tente de novo."** — a **folha da casa ao lado continua funcionando**;
- `/gestao/lembretes` mostra a página de erro ("Algo não funcionou.");
- `/api/health/lembretes` responde **`503`**.

**Nada mais para por causa da `0029`.** (No caminho A, a janela do Roteiro 19 vale junto.)

---

## A conferência — de fora e de dentro

**De fora** (de qualquer lugar):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health/lembretes
curl -s https://amassacerrado.com.br/api/health/lembretes
```

**O que você deve ver:** `200` e `{"status":"ok"}`. A rota só responde `200` se a coluna `feito_por` da tabela
`lembretes` existe — as duas nascem na `0029`. Era `404` antes da publicação e `503` na janela. **`503` agora:**
a migração não aplicou; volte ao `db:migrate`.

**De dentro, por SQL** (no servidor):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'lembretes';"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select has_table_privilege('amassa_app', 'lembretes', 'DELETE') as apaga_lembrete, has_table_privilege('amassa_app', 'lembretes', 'INSERT') as cria_lembrete;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as lembretes from lembretes;"
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as migracoes_aplicadas from drizzle.__drizzle_migrations;"
```

**O que você deve ver:** a linha `lembretes`; **`apaga_lembrete = t`** — o resultado CERTO, a EXCEÇÃO
DELIBERADA da LMB-08 (em `fornecedores` o certo é `f`; aqui não) — e `cria_lembrete = t`; `lembretes = 0`; e
**`migracoes_aplicadas = 30`**. `apaga_lembrete = f`: algo retirou o privilégio — os Lembretes não conseguem
excluir; **pare e chame**.

---

## Se der errado: o caminho de volta

- **A migração falhou (código diferente de `0`).** **Nada ficou aplicado** — o migrador aplica as pendentes numa
  transação só (no caminho A, nem a `0027` nem a `0028` entram). O app novo está no ar sobre o banco velho: ou
  corrija para a frente (copie a saída e chame), ou volte o app, no seu computador:

  ```bash
  git log --oneline -5
  git revert -m 1 <o hash do merge>
  git push
  ```

  e espere o run verde. No caminho A, isso tira as duas fases do ar; siga também o Passo 10 do Roteiro 19.
- **Falha depois da migração** (`503` com o `db:migrate` em `0`, SQL que não bate, telas quebradas). A `0029`
  só acrescenta e o código antigo ignora a tabela: **reverter a publicação basta** (`git revert -m 1 <merge>` +
  `git push`). A tabela pode ficar, vazia e sem uso. Restaurar o backup **só se algum dado tiver sido
  estragado** (Roteiro 3).
- **Desfazer a `0029` de vez:** outra migração, escrita por um plano, provada no `test:migracoes` e aplicada por
  este mesmo caminho (backup antes). Nunca à mão no `psql`.

Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.

---

## O que NÃO muda

- **`.env`, Caddy e as pastas do host:** nada a mexer.
- **`compose.yml` e os scripts de backup:** nada da 06.3 — o que muda neles é da 06.2 (chega pelo `implantar` e
  pela re-extração do Passo 6 do Roteiro 19). O cron do backup é o mesmo; a tabela nova entra no próximo dump.
