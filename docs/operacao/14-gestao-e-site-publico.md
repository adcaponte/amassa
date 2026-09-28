# Roteiro 14 — Migração das Anotações da casa, e a virada `/gestao` + site público

**Quando rodar:** **uma vez**, depois do `git push` que publica a Fase 04.6 (Tarefa 2 do plano
`04.6-08-PLAN.md` — o `push` é seu, feito antes de abrir este roteiro) e depois de o pipeline
`Entrega contínua` ter fechado os quatro jobs verdes (`gh run list`). **Nunca pelo pipeline.**

**O que muda nesta virada, e por que este roteiro é mais que "aplicar uma migração":** a Fase
04.6 move a plataforma inteira de `/` para `/gestao` e põe o site público institucional na raiz —
é a maior mudança de endereço que este projeto já fez. Ela já está publicada quando você abre este
roteiro (o deploy automático a subiu); o que resta é (1) a migração `0022`, que cria a tabela das
Anotações da casa, o quinto e último bloco do Início, e (2) confirmar de fora que a virada de
endereço não quebrou nada que o Caddy ou o `AUTH_URL` dependam.

**O que este roteiro faz:** aplica a migração `0022_anotacoes-da-casa.sql` (cria a tabela, o
gatilho de `atualizado_em`, os grants/revoke, e semeia a linha única vazia), confirma de fora que
ela pegou, e documenta as duas coisas do proxy/autenticação que **não precisam mudar** — porque é
fácil, vendo uma mudança de rota tão grande, presumir que elas precisam.

**O que este roteiro NÃO faz:**

- **Não faz o `git push`.** Isso é a Parte A da Tarefa 2 do plano `04.6-08-PLAN.md`, antes deste
  roteiro. Confirme o pipeline verde antes de continuar.
- **Não confere GES-04** (o login voltando para dentro de `/gestao`, no celular, em produção). Isso
  é a Parte C da mesma Tarefa 2, depois deste roteiro — precisa da migração já aplicada e do
  `AUTH_URL` conferido no Passo 6 abaixo antes de fazer sentido testar o login de ponta a ponta.
- **Não mexe no Caddy, no `.env` nem em nenhum outro serviço.** O Passo 5 explica por quê.

**Como ler cada passo:** o mesmo formato dos Roteiros 12 e 13 — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, **pare naquele passo** e não siga para o próximo.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo`. Use `docker compose run --rm
ferramentas`, **nunca** `docker compose exec app` — a imagem `app` não tem `drizzle-kit`, `tsx` nem
a pasta `db/`, de propósito (`WINDOWS.md #14`). Nenhum comando abaixo pede credencial de acesso nem
string de conexão — o repositório é público.

---

## Passo 1 — Guarda de segurança: confirmar em qual servidor a sessão está

```bash
hostname
whoami
ls -d /opt/amassa
```

**O que faz:** confirma que você está na sessão SSH do servidor de produção, não no seu computador
— os passos seguintes aplicam migração num banco de verdade, e o comando certo no lugar errado não
tem desfazer fácil.

**O que você deve ver:** o nome do host do VPS (não o nome do seu computador), `theo`, e
`/opt/amassa` listado sem erro. Se `ls` disser "No such file or directory", você não está no
servidor certo — **pare aqui**.

---

## Passo 2 — Backup, antes de qualquer coisa

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso. Confira com `echo $?` (`0` é sucesso).

Confira que a linha foi gravada, **e que o tamanho é plausível** (não um arquivo vazio ou minúsculo
— o dump de hoje deve ter um tamanho parecido com o do dia anterior):

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok from execucoes_backup order by quando desc limit 1;"
ls -la /opt/amassa/dados/backups/ | tail -5
```

**O que você deve ver:** uma linha com `sucesso = t` e o horário de agora; e, na segunda saída, o
arquivo de hoje com um tamanho na mesma ordem de grandeza dos últimos — nada em `0` bytes nem
visivelmente menor. **Sem um backup verificado (linha E tamanho), não siga para o Passo 3.**

---

## Passo 3 — Aplicar a migração `0022`

Pelo serviço `ferramentas`, nunca por `docker compose exec app`:

```bash
docker compose pull ferramentas
docker compose run --rm ferramentas npm run db:migrate
```

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Seguro rodar
mais de uma vez — o Drizzle pula o que já foi aplicado, e a semente da linha única é idempotente
(`insert ... on conflict do nothing` — reaplicar não duplica a linha).

> Não espere uma lista de migrações — o `migrate()` do Drizzle é silencioso, e a mensagem de
> sucesso **não prova o que foi aplicado**. O Passo 4 é quem prova.

O quinto bloco do Início ("Anotações da casa") passa a responder a partir daqui — antes deste
passo, ele mostrava o próprio estado de erro (`BlocoAnotacoes` tem `try`/`catch` próprio, D-09/GES-08:
uma tabela ausente não derruba o Início inteiro, só aquele bloco).

---

## Passo 4 — Conferir de fora que a tabela existe, a linha única e o gatilho

A mesma ideia de `/api/health/backup`: uma conferência que só passa se a migração realmente
aplicou — não a saída silenciosa do Passo 3.

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'anotacoes_da_casa';"
```

**O que você deve ver:** uma linha, `anotacoes_da_casa`. Se vier vazio, a migração não aplicou —
**pare aqui** e confira a saída do Passo 3 antes de repetir.

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select count(*) as linhas, texto, salvo_por from anotacoes_da_casa group by texto, salvo_por;"
```

**O que você deve ver:** exatamente **1 linha**, `texto` vazio (`''`), `salvo_por` nulo — "ninguém
salvou ainda". Mais de uma linha, ou nenhuma, é a garantia de linha única falhando; **pare aqui**.

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select event_object_table, trigger_name from information_schema.triggers where trigger_name = 'tocar_atualizado_em_anotacoes_da_casa';"
```

**O que você deve ver:** uma linha, `anotacoes_da_casa` / `tocar_atualizado_em_anotacoes_da_casa` —
o gatilho que mantém `atualizado_em` como marca de versão (é ele que `decidirGravacao` compara para
avisar de escrita concorrente, GES-10).

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select has_table_privilege('amassa_app', 'anotacoes_da_casa', 'select') as pode_ler, has_table_privilege('amassa_app', 'anotacoes_da_casa', 'insert') as pode_inserir, has_table_privilege('amassa_app', 'anotacoes_da_casa', 'update') as pode_atualizar, has_table_privilege('amassa_app', 'anotacoes_da_casa', 'delete') as pode_apagar;"
```

**O que você deve ver:** `pode_ler`/`pode_inserir`/`pode_atualizar = t`, e **`pode_apagar = f`** — a
folha nunca se apaga, só esvazia (D-08: "ver o dela" troca o texto, nunca apaga a linha). Se
`pode_apagar` vier `t`, algo na migração saiu diferente do escrito — **pare e chame** antes de
seguir.

Na tela (não no terminal): abra **Início** pelo navegador e confira que o quinto bloco, "Anotações
da casa", mostra uma caixa de texto vazia — não mais o estado de erro.

---

## Passo 5 — O Caddy NÃO muda

🔴 **Leia isto antes de tocar no `Caddyfile` "por precaução".** A mudança de rota desta fase é
inteiramente **dentro** da aplicação Next — `middleware.ts` passou a proteger só `/gestao/:path*`,
e a raiz passou a servir o site público (`app/page.tsx`, estático). O `Caddyfile` do servidor
continua exatamente assim, porque a **mesma aplicação Next**, no **mesmo processo**, na **mesma
porta 3000**, serve as duas coisas — o proxy reverso nunca soube (e não precisa saber) que existe
um `/gestao`:

```caddyfile
# HTTPS automático (Let's Encrypt), renovação sozinha — nenhuma configuração manual de TLS.
# Serve o apex e redireciona o www para ele (D-04/D-05).

amassacerrado.com.br {
	reverse_proxy app:3000
}

www.amassacerrado.com.br {
	redir https://amassacerrado.com.br{uri} permanent
}
```

Dez linhas, dois blocos: o apex manda tudo para `app:3000`, e o `www` redireciona para o apex.
**Nenhum dos dois é específico de caminho** — é por isso que a virada `/gestao` não os toca. Não há
um segundo host, uma segunda porta nem uma regra de caminho a acrescentar.

Confira, se quiser, comparando o resumo criptográfico do arquivo no servidor com o do repositório:

```bash
sha256sum /opt/amassa/Caddyfile
```

**O que você deve ver:**
`ef7cf1390e63a592a41ee94cfc81e4f5b272f15fa783f9fe4f8b3e62e2f8ec2e` — o mesmo do
`docker/Caddyfile` no commit `72b8881`. Se conferir, o arquivo está igual ao do repositório e
**nenhuma mudança é necessária**.

Se o resumo **divergir**, compare o conteúdo a olho com o bloco de dez linhas acima
(`cat /opt/amassa/Caddyfile`) antes de concluir qualquer coisa: a causa mais provável é fim de
linha (o servidor usa LF) ou uma edição manual anterior — **não desta fase**. Nos dois casos,
**não edite agora** por causa deste roteiro; se precisar mexer no Caddy por outro motivo, trate
como mudança à parte.

> **Correção de 28/09/2026, durante a execução do próprio roteiro.** Este passo pedia antes
> `diff /opt/amassa/Caddyfile <(docker compose run --rm ferramentas cat docker/Caddyfile)`. Esse
> comando **não podia funcionar**: o estágio `ferramentas` do `docker/Dockerfile` copia
> `package.json`, `tsconfig.json`, `drizzle.config.ts`, `db/`, `scripts/` e `lib/` — nunca
> `docker/`. Rodado no servidor, devolveu `cat: can't open 'docker/Caddyfile'` e, com o lado
> direito vazio, um `1,10d0` que **parecia** dizer que o Caddyfile do servidor estava sobrando.
> Não estava: conferido, ele é igual ao do repositório. O passo também citava só o bloco do apex,
> omitindo o do `www`, o que faria quem comparasse a olho achar que o servidor tinha um bloco a
> mais. Os dois erros eram do roteiro, escrito sem ter sido rodado; o veredito do passo ("o Caddy
> não muda") continua valendo e agora é verificável.

---

## Passo 6 — `AUTH_URL` continua sem caminho no fim

🔴 **A classe exata do defeito de 17/09/2026** (`WINDOWS.md #2`) era o login voltando para
`https://0.0.0.0:3000/...` — corrigido, na época, adicionando `AUTH_URL` **sem** `/gestao` no fim.
Esta fase não muda isso, e é fácil de errar aqui justamente porque a plataforma inteira migrou de
endereço: a tentação é "atualizar" `AUTH_URL` para incluir `/gestao`, e isso **quebraria** o login
de novo, por um motivo diferente e mais sutil.

```bash
grep -A2 "AUTH_URL" /opt/amassa/compose.yml
```

**O que você deve ver:** `AUTH_URL: ${AUTH_URL:-https://amassacerrado.com.br}` — **sem** `/gestao`
no fim, com o comentário acima dele explicando o `basePath` do Auth.js (`/api/auth`). Se o `.env`
do servidor tiver uma linha `AUTH_URL=...` própria, confira que ela também termina sem caminho:

```bash
grep "^AUTH_URL=" /opt/amassa/.env 2>/dev/null || echo "Sem AUTH_URL no .env — usa o padrão do compose.yml, que já está certo."
```

**Por que `AUTH_URL` com caminho quebraria:** em `next-auth` 5.0.0-beta.32, o `callbackUrl` do
middleware sai de `reqWithEnvURL` (`node_modules/next-auth/lib/env.js`), que reescreve a ORIGEM a
partir de `AUTH_URL` — e se `AUTH_URL` tiver um caminho no fim (`.../gestao`), esse caminho vira o
**`basePath`** das rotas internas do Auth.js (`/api/auth/session`, `/api/auth/csrf`, etc.), que
precisam continuar em `/api/auth`, fora de `/gestao`. Isto é o comentário que já existe em
`docker/compose.yml` desde a Fase 04.4 — este roteiro só confirma que a Fase 04.6 não o invalidou.

**Sobre o `.env`:** ele é do dono, editado à mão no servidor, e **não** é ressincronizado pelo job
`implantar` — ao contrário de `compose.yml` e da imagem `ferramentas`, que o pipeline atualiza a
cada deploy. Uma variável que dependesse só do `.env` para ficar certa envelheceria em silêncio;
por isso o valor padrão correto já mora no `compose.yml` (linha acima), e o `.env` só precisa de
uma linha própria se você quiser sobrescrever esse padrão.

---

## Passo 7 — Refazer o atalho da tela inicial do celular

🔴 **O briefing marca isto em vermelho, e é a primeira coisa que você e a Andressa vão sentir.**
O atalho antigo, salvo na tela inicial do celular de cada um, aponta para
`https://amassacerrado.com.br` — que agora é o **site público**, não a plataforma.

- [ ] No seu celular: abra `https://amassacerrado.com.br/gestao` no navegador, entre com sua conta,
      e adicione à tela inicial ("Adicionar à tela de início" / "Adicionar à tela inicial",
      conforme o navegador). Apague o atalho antigo, que aponta para a raiz.
- [ ] Peça para a Andressa fazer o mesmo, no celular dela.

Este passo não tem comando de terminal — é feito no navegador do celular de cada um.

---

## Passo 8 — Backup depois, e a rota de saúde

```bash
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso.

```bash
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"` — o backup diário já cobre a tabela nova
(`anotacoes_da_casa` está dentro do dump do Postgres, que o backup sempre incluiu por inteiro; não
precisa de nenhuma extensão de escopo como a das fotos no Roteiro 12).

**Depois deste roteiro:** siga para a Parte C da Tarefa 2 do plano `04.6-08-PLAN.md` — GES-04
conferida em produção, no celular, com a barra de endereço.

---

## O que fazer se algo falhar

Quatro erros prováveis, cada um com a causa e a correção:

1. **`docker compose run --rm ferramentas npm run db:migrate` sai diferente de `0`, com um erro de
   permissão negada no banco.** Causa mais provável: o `compose.yml` do servidor está desatualizado
   em relação à variável de conexão de migração (`WINDOWS.md #14`). Correção: confirme que o
   `git push` da Tarefa 2 já subiu e que o pipeline já rodou o job `implantar` antes de repetir.

2. **O Passo 4 mostra mais de uma linha em `anotacoes_da_casa`, ou nenhuma.** Isto não deveria
   acontecer com a migração aplicada por este roteiro (a restrição de linha única está no banco,
   não na aplicação) — **pare, não tente corrigir por `delete`/`insert` manual**, e chame antes de
   mexer: uma segunda linha nesta tabela é sintoma de a restrição não ter sido criada, e apagar à
   mão sem entender por quê pode mascarar o problema real.

3. **`/cadastros?sub=parametros` ou qualquer outra tela dentro de `/gestao` respondem 404 ou uma
   tela quebrada logo depois do deploy, antes mesmo deste roteiro.** Causa provável: o contêiner
   `app` ainda está rodando a imagem de ANTES desta fase (`WINDOWS.md #13` — o pipeline não faz
   `pull` automático de `ferramentas`, e o `app` também precisa ser atualizado). Correção:
   `docker compose pull app && docker compose up -d app`.

4. **O login não volta para dentro de `/gestao`** (a Parte C da Tarefa 2, depois deste roteiro,
   mostra uma porta, um IP ou `0.0.0.0` na barra de endereço). **Pare e reporte exatamente o que
   apareceu na barra** — não tente corrigir editando `AUTH_URL` você mesmo antes de reportar; é
   exatamente o defeito de 17/09 e merece diagnóstico, não uma correção às pressas num banco de
   produção.

Se nenhum destes quatro descrever o que você está vendo: **pare e chame** antes de improvisar num
banco ou num servidor de produção — um problema pequeno vira grande rápido quando alguém tenta um
comando inventado na hora.

Se precisar desfazer: o backup do Passo 2 é o caminho de volta — restaure com
`./scripts/restaurar.sh` (Roteiro 3, `docs/operacao/03-restauracao-de-backup.md`) contra o dump de
antes deste roteiro. A migração `0022` é aditiva (cria uma tabela nova; não altera nenhuma
existente), então o caminho de volta mais simples costuma ser só reverter o deploy do código
(`git revert`) sem precisar restaurar o banco — mas se o banco também precisar voltar, o dump do
Passo 2 é o ponto certo.
