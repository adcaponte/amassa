# Roteiro 25 — Troca de domínio: amassacerrado.com.br → amuleto.art.br

**Quando rodar:** **uma vez**, depois que o domínio novo já aponta para o servidor (Passo A1) e depois que o
Passo 1 da troca de nome (o nome AMULETO no código) já estiver no `main`. Escrito em 30/10/2026 pelo Code, **sem
ter sido rodado** — o domínio ainda não resolvia nesse dia. Se algum passo divergir do descrito, o erro pode ser do
roteiro: **pare naquele passo** e não improvise.

**Sem migração, sem restauração.** O banco, o backup diário, as fotos e os anexos não mudam de lugar. O que muda são
três coisas: o **Caddy** (que endereço ele serve), o **`.env` do servidor** (o endereço que o login usa) e a
**variável `NEXT_PUBLIC_SITE_URL` do GitHub** (o endereço que vai embutido no site e que o pipeline confere).

---

## Resumo

**Depois deste roteiro:**

- `https://amuleto.art.br` serve o site e a gestão (`/gestao`);
- `https://www.amuleto.art.br` redireciona para `https://amuleto.art.br`;
- `https://amassacerrado.com.br` e `https://www.amassacerrado.com.br` redirecionam para o domínio novo,
  **com o mesmo caminho** (`/gestao`, `/privacidade`…). Links antigos continuam chegando;
- todo mundo entra **de novo uma vez** na gestão — a sessão era do endereço velho.

**O que NÃO muda:** banco, backups, `/opt/amassa/dados`, senhas, usuários, rotas (`/api/health/*`), nomes internos
com "amassa". O `.env` muda só em duas linhas.

**Por que o Caddy vem antes do push** (e não depois): o pipeline **não** leva o `Caddyfile` ao servidor e **não**
reinicia o Caddy — o job `implantar` só copia o `compose.yml` e recria o serviço `app` (`docker compose up -d app`).
E o último passo do pipeline confere `/api/health` no endereço da variável `NEXT_PUBLIC_SITE_URL`. Se a variável já
diz `amuleto.art.br` e o Caddy ainda não serve esse nome, o pipeline fica vermelho no fim. Por isso: primeiro o Caddy
e o `.env` (Partes B a D), conferidos de fora (Parte E); só então a variável e o push (Parte F).

**Por que a variável do GitHub vem só no fim:** enquanto ela disser o domínio velho, qualquer push (de qualquer
outra mudança) continua implantando e conferindo no endereço velho, sem surpresa.

---

## Parte A — Antes de começar (no seu computador)

### Passo A1 — O domínio novo aponta para o servidor

```bash
nslookup amuleto.art.br
```

**O que você deve ver:** em "Addresses"/"Address", **o mesmo IP do servidor** (o que você vê no painel da Contabo).

```bash
nslookup www.amuleto.art.br
```

**O que você deve ver:** o mesmo IP.

Compare com o domínio velho, que já aponta para o servidor:

```bash
nslookup amassacerrado.com.br
```

**O que você deve ver:** o mesmo IP dos dois de cima. **Se qualquer um dos dois novos não responder, ou responder
outro IP: pare aqui.** O Caddy só consegue tirar o certificado quando o nome já chega ao servidor.

### Passo A2 — O sistema está no ar antes de mexer

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amassacerrado.com.br/api/health
```

**O que você deve ver:** **`200`**. Qualquer outro número: **pare** e chame — o problema é anterior a este roteiro.

---

## Parte B — No servidor: o `.env` e a cópia do Caddyfile atual

Entre por SSH como `theo` (`ssh theo@<IP_DO_SEU_VPS>`) e vá para `/opt/amassa`:

```bash
cd /opt/amassa
```

### Passo B1 — Cópia do `.env` antes de editar (é o caminho de volta)

```bash
cp -p /opt/amassa/.env /opt/amassa/.env.antes-amuleto
```

**O que você deve ver:** nenhuma saída. O `-p` mantém a permissão do original (o arquivo tem segredos).

### Passo B2 — Cópia do Caddyfile atual (também caminho de volta)

```bash
cp -p /opt/amassa/Caddyfile /opt/amassa/Caddyfile.antes-amuleto
```

**O que você deve ver:** nenhuma saída.

### Passo B3 — Ver as duas linhas como estão hoje

```bash
grep -E "^(AUTH_URL|NEXT_PUBLIC_SITE_URL)=" /opt/amassa/.env
```

**O que você deve ver:** `NEXT_PUBLIC_SITE_URL=https://amassacerrado.com.br` e, talvez, `AUTH_URL=https://amassacerrado.com.br`.
Se a linha `AUTH_URL` **não aparecer**, tudo bem: hoje o padrão vem do `compose.yml`. Você vai acrescentá-la no B4.

### Passo B4 — Editar

```bash
nano /opt/amassa/.env
```

Deixe as duas linhas **exatamente** assim (sem barra no fim, sem `/gestao`):

```
AUTH_URL=https://amuleto.art.br
NEXT_PUBLIC_SITE_URL=https://amuleto.art.br
```

Se `AUTH_URL` não existia, acrescente a linha no fim do arquivo. Não mexa em mais nada. Salve com **Ctrl+O**, Enter,
e saia com **Ctrl+X**.

**Por que sem `/gestao`:** com caminho no fim, o login quebra (Roteiro 14, Passo 6).

**Sobre `NEXT_PUBLIC_SITE_URL` no `.env`:** o app não lê esta linha em funcionamento — ela é embutida na imagem
durante o build, a partir da variável do GitHub (Parte F). Trocar aqui é só para o `.env` não mentir.

### Passo B5 — Conferir

```bash
grep -E "^(AUTH_URL|NEXT_PUBLIC_SITE_URL)=" /opt/amassa/.env
```

**O que você deve ver:** as duas linhas, **uma vez cada**, com `https://amuleto.art.br`. Se alguma aparecer duas
vezes, volte ao B4 e apague a repetida.

O `.env` ainda **não vale**: o app só o relê quando é recriado (Passo D6). Deixe a janela do SSH aberta.

---

## Parte C — No seu computador: trazer o Caddyfile novo

### Passo C1 — O `main` em dia

Na pasta do repositório:

```bash
git switch main
```

```bash
git pull
```

**O que você deve ver:** `Already up to date` ou a lista do que chegou. Sem conflito.

### Passo C2 — Juntar a virada no `main` (sem push ainda)

```bash
git merge --no-ff --no-edit amuleto-passo-2
```

**O que você deve ver:** `Merge made by the 'ort' strategy.` e, na lista, `docker/Caddyfile`, `docker/compose.yml`,
`.github/workflows/entrega.yml` e este roteiro. **Não dê push agora** — o push é o Passo F3. O `--no-ff` garante um
commit de merge, que é o que o caminho de volta (item 3) desfaz de uma vez.

Se aparecer **conflito**: pare e chame.

### Passo C3 — Conferir que o Caddyfile é o novo

```bash
git show main:docker/Caddyfile
```

**O que você deve ver:** três blocos — `amuleto.art.br` com `reverse_proxy app:3000`; `www.amuleto.art.br` com
`redir https://amuleto.art.br{uri} permanent`; e `amassacerrado.com.br, www.amassacerrado.com.br` com o mesmo `redir`.

### Passo C4 — Copiar para o servidor, com outro nome

```bash
scp docker/Caddyfile theo@<IP_DO_SEU_VPS>:/opt/amassa/Caddyfile.novo
```

**O que você deve ver:** uma linha de progresso terminando em `100%`. O nome `Caddyfile.novo` é de propósito: o
arquivo em uso só é trocado depois de validado (D1).

---

## Parte D — No servidor: trocar o Caddy e recriar o app

De volta à janela do SSH, em `/opt/amassa`.

### Passo D1 — Validar o arquivo novo antes de usar

```bash
docker run --rm -v /opt/amassa/Caddyfile.novo:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

**O que você deve ver:** algumas linhas de log e, no fim, **`Valid configuration`**. Isso não mexe no Caddy que está
no ar — roda uma cópia descartável só para ler o arquivo. Se aparecer `Error`: **pare aqui**, nada mudou ainda.

(Fim de linha do Windows no arquivo não atrapalha: o Code validou as duas formas, LF e CRLF, em 30/10.)

### Passo D2 — Pôr o arquivo novo no lugar

```bash
mv /opt/amassa/Caddyfile.novo /opt/amassa/Caddyfile
```

**O que você deve ver:** nenhuma saída.

### Passo D3 — Reiniciar o Caddy

```bash
docker compose restart caddy
```

**O que você deve ver:** `Container amassa-caddy-1  Restarted` (o nome pode variar um pouco). O site fica fora por
poucos segundos.

**Por que `restart` e não `caddy reload`:** o `compose.yml` monta o **arquivo** `./Caddyfile` dentro do contêiner.
O `mv` do D2 troca o arquivo por outro, e um contêiner já rodando continua vendo o arquivo **antigo** até ser
reiniciado. `docker compose up -d caddy` também não serve: ele não vê mudança na configuração e não reinicia nada.

### Passo D4 — O Caddy está lendo o arquivo novo

```bash
docker compose exec caddy head -n 15 /etc/caddy/Caddyfile
```

**O que você deve ver:** o comentário que cita o Roteiro 25 e o bloco `amuleto.art.br {`. Se ainda aparecer
`amassacerrado.com.br {` sozinho, como antes: repita o D3.

### Passo D5 — O certificado do domínio novo saiu

```bash
docker compose logs --since 5m caddy | grep -i "amuleto"
```

**O que você deve ver:** linhas com `amuleto.art.br` e `www.amuleto.art.br`, entre elas
`certificate obtained successfully` para cada um. Pode levar até um minuto; se ainda não apareceu, espere e repita.
Se aparecer `error` com `challenge` ou `NXDOMAIN`: o DNS ainda não chegou ao Let's Encrypt — vá ao caminho de volta
(item 2) ou espere uma hora e repita o D5.

### Passo D6 — Recriar o app com o `.env` novo

```bash
docker compose up -d app
```

**O que você deve ver:** `Container amassa-app-1  Recreated` e `Started`. O `postgres` e o `caddy` **não** são
recriados (o nome do serviço no fim é o que garante isso — o mesmo comando que o pipeline usa).

### Passo D7 — Os três serviços no ar

```bash
docker compose ps
```

**O que você deve ver:** `postgres`, `app` e `caddy` com estado `Up`, o `app` como `(healthy)` depois de uns
30 segundos.

---

## Parte E — Conferir de fora, antes do push (no seu computador)

### Passo E1 — O domínio novo responde

```bash
curl -sI https://amuleto.art.br
```

**O que você deve ver:** na primeira linha **`200`** (`HTTP/1.1 200 OK` ou `HTTP/2 200`) e, entre os cabeçalhos,
**`Strict-Transport-Security: max-age=31536000; includeSubDomains`**. Esse cabeçalho vem do app, não do Caddy — ele
aparecer prova que o pedido chegou ao app pelo domínio novo.

### Passo E2 — O `www` novo redireciona

```bash
curl -sI https://www.amuleto.art.br
```

**O que você deve ver:** **`301`** e `Location: https://amuleto.art.br/`.

### Passo E3 — O domínio velho redireciona para o novo

```bash
curl -sI https://amassacerrado.com.br
```

**O que você deve ver:** **`301`** e **`Location: https://amuleto.art.br/`**.

### Passo E4 — O caminho é preservado

```bash
curl -sI https://www.amassacerrado.com.br/privacidade
```

**O que você deve ver:** **`301`** e `Location: https://amuleto.art.br/privacidade`.

### Passo E5 — Saúde no domínio novo

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amuleto.art.br/api/health
```

**O que você deve ver:** **`200`**.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://amuleto.art.br/api/health/backup
```

**O que você deve ver:** **`200`**.

Se algum dos E1 a E5 der outro resultado: **pare** e vá ao caminho de volta (item 2). Nada foi publicado ainda.

---

## Parte F — A variável do GitHub e o push (no seu computador)

### Passo F1 — Trocar a variável

```bash
gh variable set NEXT_PUBLIC_SITE_URL --body https://amuleto.art.br
```

**O que você deve ver:** uma linha de confirmação, `✓ Updated variable NEXT_PUBLIC_SITE_URL for adcaponte/amassa`
(ou parecida).

### Passo F2 — Conferir

```bash
gh variable list
```

**O que você deve ver:** `NEXT_PUBLIC_SITE_URL   https://amuleto.art.br` e `DEPLOY_ATIVO   true`.

### Passo F3 — O push

```bash
git push
```

**O que você deve ver:** o push aceito, sem aviso de segredo.

### Passo F4 — O pipeline começou

```bash
gh run list --limit 3
```

**O que você deve ver:** o run novo no topo, em andamento (`in_progress` ou `queued`).

### Passo F5 — Esperar o pipeline terminar

```bash
gh run watch
```

**O que você deve ver:** todos os jobs verdes, inclusive o **`implantar`**. No log do último passo do `implantar`
("Verificar /api/health pelo domínio") aparece **`Produção respondendo em https://amuleto.art.br.`**

**Se algum job antes do `implantar` ficar vermelho:** nada foi implantado; o servidor continua como você deixou na
Parte D, já no domínio novo e funcionando. **Pare** e cole para o Code o nome do job e as últimas linhas do log. Um
vermelho provável é um teste que ainda espere o endereço velho no `sitemap.xml` ou no `canonical` — o site agora é
construído com o endereço novo.

**Se só o último passo ficar vermelho** (`Produção não respondeu a tempo`): repita a Parte E. Se a Parte E passar,
foi demora do app para subir; rode `gh run rerun --failed` para conferir de novo.

---

## Parte G — Conferir de novo, com a imagem nova

Repita os Passos **E1 a E5**. Os resultados têm de ser os mesmos.

E confira que o site agora se apresenta pelo endereço novo:

```bash
curl -s https://amuleto.art.br/sitemap.xml
```

**O que você deve ver:** `<loc>https://amuleto.art.br/</loc>` e `<loc>https://amuleto.art.br/privacidade</loc>`. Se
ainda aparecer `amassacerrado.com.br`, a imagem foi construída antes da troca da variável: chame.

---

## Parte H — No navegador

### Passo H1 — Entrar de novo

Abra `https://amuleto.art.br/gestao`. Vai aparecer a tela de login: **é esperado**. A sessão anterior era do
`amassacerrado.com.br`, e o navegador não a leva para outro endereço. Entre com o mesmo e-mail e a mesma senha de
sempre. Avise a Andressa: ela também vai precisar entrar uma vez.

**O que você deve ver:** o Início da gestão, com o endereço `amuleto.art.br` na barra.

### Passo H2 — Uma gravação de verdade no domínio novo

Na **Agenda → A receber**, se houver um recebimento real para lançar, use o **"Recebi agora"**. Se não houver, faça
qualquer gravação pequena de verdade (por exemplo, um lembrete no Início, que você conclui em seguida).

**O que você deve ver:** a confirmação de gravado, sem mensagem de erro. Isso prova que as ações do sistema funcionam
pelo endereço novo. Atenção: tocar uma forma de pagamento no "Recebi agora" **já grava** — não faça de teste.

### Passo H3 — Abrir um anexo de fornecedor

Em **Cadastros → Fornecedores**, abra um fornecedor que tenha anexo e abra o anexo.

**O que você deve ver:** o arquivo abrindo. Se nenhum fornecedor tiver anexo (depois da limpeza do Roteiro 24 pode
não haver), pule este passo.

### Passo H4 — No celular

Abra `https://amassacerrado.com.br/gestao` no celular, pelo endereço **velho**.

**O que você deve ver:** o navegador vai sozinho para `https://amuleto.art.br/gestao` e pede o login. Entre. Se o
ícone da gestão estava na tela inicial do celular, apague-o e adicione de novo pelo endereço novo.

---

## Se der errado: o caminho de volta

**1. Algo falhou ANTES do Passo D2:** nada mudou no ar. Para desfazer o `.env`:

```bash
cp -p /opt/amassa/.env.antes-amuleto /opt/amassa/.env
```

E, no seu computador, se você já tinha feito o merge do C2 e **não** deu push, confira primeiro o que ainda não foi
publicado:

```bash
git log --oneline origin/main..main
```

**O que você deve ver:** só o merge do C2 e os commits do `amuleto-passo-2`. Se aparecer **mais alguma coisa**,
pare e chame — o próximo comando a apagaria. Se for só isso, desfaça o merge (o branch `amuleto-passo-2` continua
existindo):

```bash
git reset --hard origin/main
```

**2. Algo falhou DEPOIS do D2 e ANTES do push (F3)** — Caddy e app já trocados, GitHub intocado. No servidor, um
comando por vez:

```bash
cp -p /opt/amassa/Caddyfile.antes-amuleto /opt/amassa/Caddyfile
```

```bash
docker compose restart caddy
```

```bash
cp -p /opt/amassa/.env.antes-amuleto /opt/amassa/.env
```

```bash
docker compose up -d app
```

Se você já tinha rodado o F1, devolva a variável:

```bash
gh variable set NEXT_PUBLIC_SITE_URL --body https://amassacerrado.com.br
```

E desfaça o merge local como no item 1 (primeiro o `git log`, depois o `reset`). Confira com o Passo A2: **`200`**.

**3. Desfazer DEPOIS do push.** Faça o item 2 inteiro (Caddy, `.env` e variável) **antes** de publicar a volta — pelo
mesmo motivo da ordem da ida: o pipeline confere o endereço da variável. Depois, no seu computador:

```bash
git revert -m 1 HEAD
```

(se o merge do C2 não for mais o último commit, troque `HEAD` pelo hash dele, que `git log --oneline -5` mostra)

```bash
git push
```

```bash
gh run watch
```

**O que você deve ver:** pipeline verde, terminando em `Produção respondendo em https://amassacerrado.com.br.`

**Cuidado com a volta depois de alguns dias:** o redirecionamento é **permanente** (`301`), e os navegadores
guardam isso. Quem já foi redirecionado continua indo direto para `amuleto.art.br` mesmo depois da volta. Se você
voltar com o domínio novo ainda apontando para o servidor, acrescente ao Caddyfile restaurado (antes do `restart`)
um bloco que devolve essas pessoas:

```caddyfile
amuleto.art.br, www.amuleto.art.br {
	redir https://amassacerrado.com.br{uri}
}
```

(sem `permanent`: é provisório). Chame o Code para isso — não é passo para improvisar.

**4.** Se nenhum caso descreve o que você vê: **pare e chame** antes de improvisar em produção.

---

## Depois da virada (fora do sistema)

- **Instagram @amuletoartecafe:** pôr `amuleto.art.br` no link da bio.
- **Monitor externo** (UptimeRobot ou o que você usa): trocar os dois monitores (`/api/health` e
  `/api/health/backup`) para `https://amuleto.art.br`. Os antigos passam a receber `301`, e um monitor que não segue
  redirecionamento vai acusar falha.
- **Google Cloud, app OAuth `amassa-backup`:** na tela de consentimento, trocar o link da política de privacidade
  para `https://amuleto.art.br/privacidade`. O endereço velho redireciona, então não tem pressa. **O nome do app e o
  remoto do rclone NÃO mudam.**
- Google Meu Negócio, cartões e outros lugares onde o endereço aparece.
- **Manter `amassacerrado.com.br` registrado por pelo menos um ano.** É ele que sustenta os redirecionamentos.
- Quando tudo estiver bem por uns dias, apague as cópias:

```bash
rm /opt/amassa/.env.antes-amuleto /opt/amassa/Caddyfile.antes-amuleto
```

---

## Por que cada mudança do repositório existe

- **`docker/Caddyfile`:** o domínio novo serve o app; o `www` novo e os dois do domínio velho redirecionam com `301`
  preservando o caminho (`{uri}`). Validado em 30/10 com `caddy validate` e `caddy adapt` na mesma imagem do
  `compose.yml` (`caddy:2-alpine`), com fim de linha LF e CRLF.
- **`docker/compose.yml`:** o padrão de `AUTH_URL` passa a ser `https://amuleto.art.br`. O valor que vale é o do
  `.env` (Passo B4); o padrão só importa se a linha sumir do `.env`.
- **`.github/workflows/entrega.yml`:** o `curl` de saúde do fim do `implantar` lê `vars.NEXT_PUBLIC_SITE_URL` em vez
  do endereço escrito à mão. Da próxima vez que o domínio mudar, é só a variável.
