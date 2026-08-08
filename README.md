# AMASSA — Plataforma de Gestão do Ateliê

Plataforma web interna, privada e responsiva, para os gestores do **AMASSA** — ateliê de
cerâmica artesanal de alta temperatura em Goiânia — administrarem a operação do dia a dia em
um único lugar. Cinco módulos: Encomendas, Agenda de Aulas, Contador de Queima, Estoque e
Calculadora de Orçamento.

Este não é o site institucional (`amassaceramica.com.br`) nem a loja Shopify — os dois
continuam existindo separadamente e estão fora do escopo deste repositório.

A documentação completa de arquitetura, modelo de dados, roadmap e design system vive em
[`amassa-plataforma/`](./amassa-plataforma). Este README cobre só o que é preciso para rodar
e operar o sistema no dia a dia.

Os roteiros comentados para preparar e publicar o servidor de produção vivem em
[`docs/operacao/`](./docs/operacao): [`01-preparar-servidor.md`](./docs/operacao/01-preparar-servidor.md)
(endurecimento do VPS, Docker, `/opt/amassa` e chave de deploy) e
[`02-publicar-e-dominio.md`](./docs/operacao/02-publicar-e-dominio.md) (DNS, primeira
publicação, HTTPS e monitor externo).

## Stack

Next.js 15+ (App Router, TypeScript estrito), React 19, Tailwind CSS v4, PostgreSQL em
Docker, Drizzle ORM, Vitest. Ver `amassa-plataforma/01-ARQUITETURA.md` §2 para a lista
completa e a razão de cada escolha.

## Desenvolvimento local

```bash
cp .env.example .env.local   # preencher com valores de desenvolvimento
docker compose -f docker/compose.yml -f docker/compose.dev.yml up -d postgres
npm install
npm run db:migrate
npm run dev
```

`docker/compose.dev.yml` é uma sobreposição só de desenvolvimento — publica o Postgres em
`127.0.0.1:5433` e sabe construir as imagens `app`/`ferramentas` localmente a partir do
`docker/Dockerfile`. Ela nunca vai para o servidor.

### Portões de qualidade

```bash
npm run lint             # ESLint, --max-warnings=0
npm run verificar-acoes  # exigirUsuario() na primeira instrução de toda ação que toca o banco
npm test                 # Vitest
npm run test:migracoes   # base comum do banco, de fora, num Postgres efêmero
npm run test:backup      # backup.sh e restaurar.sh de ponta a ponta, sem servidor
npm run build            # next build
```

## Operação em produção

A topologia de produção (`docker/compose.yml`) tem quatro serviços: `postgres`, `app`,
`caddy` e `ferramentas`. `ferramentas` fica sob um profile e nunca sobe sozinho — é invocado
sob demanda com `docker compose run --rm`. Ver a caixa "Por que existe um serviço
`ferramentas`" em `amassa-plataforma/01-ARQUITETURA.md` §4: a imagem `app` usa a saída
`standalone` do Next.js e não carrega `drizzle-kit`, `tsx` nem os scripts do
`package.json` — só a imagem `ferramentas` consegue migrar o banco ou (a partir da Fase 2)
criar e redefinir usuário.

### Aplicar migração

**Migração é aplicada à mão, depois de um backup, por alguém que está olhando o resultado —
nunca pelo pipeline automático.**

```bash
docker compose run --rm ferramentas npm run db:migrate
```

Esperado: a saída termina com `Migrações aplicadas com sucesso.` e sai com código `0`. É
seguro rodar mais de uma vez — o Drizzle pula o que já foi aplicado.

Rodar o mesmo comando contra o serviço `app` (`docker compose exec app npm run db:migrate`)
falha — não é um defeito, é o motivo de o estágio `ferramentas` existir.

### Operações de conta

Não existe tela de cadastro nem "esqueci minha senha" — as três operações de conta sempre
passam pelo estágio `ferramentas`, nunca pela imagem `app`:

```bash
docker compose run --rm ferramentas npm run criar-usuario -- --nome "Fulana da Silva" --email "fulana@exemplo.com"
docker compose run --rm ferramentas npm run redefinir-senha -- --email "fulana@exemplo.com"
docker compose run --rm ferramentas npm run desativar-usuario -- --email "fulana@exemplo.com"
docker compose run --rm ferramentas npm run desativar-usuario -- --email "fulana@exemplo.com" --reativar
```

`criar-usuario` e `redefinir-senha` imprimem a senha gerada uma única vez, numa linha
`SENHA: ...` — guarde-a na hora, ela não pode ser recuperada depois. `desativar-usuario` marca
`ativo = false` (ou `true` com `--reativar`); nenhum dos três comandos apaga uma linha da
tabela `usuarios`.

### Publicar uma nova versão

```bash
docker compose pull app
docker compose up -d app
```

**Sempre nomeando o serviço `app`.** Rodar `docker compose up -d` sem nomear o serviço
recria todos os contêineres declarados, inclusive o `postgres` — e por isso o comando de
publicação, tanto no pipeline quanto no roteiro do servidor, nomeia sempre `app`.

### Reiniciar a máquina

```bash
docker compose restart
```

`postgres`, `app` e `caddy` têm `restart: unless-stopped` — voltam sozinhos, com os dados
intactos, sem intervenção manual.

### Backup e restauração

`scripts/backup.sh` roda pelo `cron` do host (nunca pelo Compose, que não tem agendador — ver
`amassa-plataforma/01-ARQUITETURA.md` §7). Ele gera o dump do dia, comprime, confere a
integridade, mantém os últimos 14 dias, copia o dia 1º para uma pasta mensal que nunca é
limpa, envia ao destino externo configurado em `RCLONE_REMOTE` (vazio, o padrão, significa não
enviar) e registra o resultado em `execucoes_backup` — é essa tabela que `GET
/api/health/backup` consulta. Antes de qualquer migração:

```bash
./scripts/backup.sh --agora
```

`scripts/restaurar.sh` faz o caminho de volta: `--arquivo` aponta o dump comprimido,
`--banco` o banco de destino. **Sem `--confirmar`, ele só mostra o que seria perdido (as
contagens de linha atuais de cada tabela) e não escreve nada** — restaurar substitui dados, e
a pessoa que roda isto pode estar tendo um dia ruim; o script não confia em quem pediu, confia
na confirmação explícita. Com `--confirmar`, confere a integridade do arquivo antes de tocar no
banco, restaura parando no primeiro erro, e termina mostrando tabela e contagem de linhas para
conferência imediata.

Os dois scripts são shell POSIX puro e compartilham as mesmas variáveis injetáveis (comandos do
Postgres, diretório de backups, arquivo de ambiente) — só o nome das variáveis fica aqui, nunca
um endereço de conta ou nome de destino real. `npm run test:backup` prova os dois de ponta a
ponta, sem servidor, dentro do Postgres efêmero de teste.

### Observabilidade

Duas rotas públicas (liberadas em `lib/auth/rotas-publicas.ts`, respondem sem sessão) devem
ser monitoradas de fora, a cada cinco minutos, por um serviço externo gratuito (UptimeRobot ou
similar), com alerta por e-mail:

- **`GET /api/health`** — garante que a aplicação está no ar **e** que uma consulta real ao
  Postgres funciona.
- **`GET /api/health/backup`** — garante que o backup diário está fresco: responde `ok` só se
  a última linha de `execucoes_backup` tiver sucesso, cópia externa confirmada e menos de 26
  horas; caso contrário responde `503` com o motivo em português. Ver
  `amassa-plataforma/01-ARQUITETURA.md` §9 — **um backup que para em silêncio é pior do que
  não ter backup**, porque dá a impressão de estar protegido.

## Produção

A plataforma roda em `https://amassacerrado.com.br` — domínio dedicado, separado do site
institucional `amassaceramica.com.br`. Serve no apex, com `www.amassacerrado.com.br`
redirecionando para o apex no Caddyfile.

## Variáveis de ambiente

A lista completa de variáveis, pelo nome, vive em [`.env.example`](./.env.example) — o arquivo
nunca tem valor real, só os nomes. Valores reais existem em exatamente dois lugares:

`DATABASE_URL` e `DATABASE_URL_MIGRACAO` são conexões diferentes com papéis diferentes:
`DATABASE_URL` usa o papel restrito `amassa_app` (sem posse de tabela, sem privilégio de
definição de estrutura) e é o que o serviço `app` usa em runtime; `DATABASE_URL_MIGRACAO` usa
o dono do banco (`amassa_owner`) e é o que o serviço `ferramentas` usa para migrar. Separar os
dois é o que faz um `revoke` futuro sobre uma tabela valer alguma coisa — dono de tabela retém
privilégio implícito e pode se reconceder.

- os **secrets do GitHub**, usados pelo pipeline em tempo de build e deploy;
- o arquivo `/opt/amassa/.env` **no servidor**, com permissão `600`, lido pelo `compose.yml` em
  tempo de execução.

Nunca em um terceiro lugar, e nunca num commit.

## Pipeline (GitHub Actions)

`.github/workflows/entrega.yml` dispara em todo `git push` na `main` (e também sob
acionamento manual) e roda quatro jobs encadeados por `needs`, nesta ordem — um teste
quebrado interrompe a fila antes de qualquer publicação:

1. **`qualidade`** — `npm run lint`, `npm run verificar-acoes` e `npm test`, nessa ordem. O
   portão mais barato, vem primeiro. `verificar-acoes` garante, por análise da árvore
   sintática (nunca expressão regular), que toda Server Action que toca o banco chama
   `exigirUsuario()` como primeira instrução; se reprovar, a mensagem aponta arquivo, linha e
   função — corrija a chamada que falta e rode `npm run verificar-acoes` de novo antes de subir.
2. **`e2e`** — sobe um Postgres de teste como *service container* do runner (D-10), aplica o
   schema nele, constrói a imagem Docker do alvo `app` (o mesmo `docker/Dockerfile` que o job
   seguinte publica) e roda o Playwright **contra essa imagem rodando de verdade** — nunca
   contra `next start`, que não é compatível com a saída `standalone` usada em produção.
3. **`imagem`** — publica duas tags no GHCR a partir do mesmo Dockerfile: o alvo `app`
   (`ghcr.io/<dono>/amassa:latest`) e o alvo `ferramentas`
   (`ghcr.io/<dono>/amassa:ferramentas`). `NEXT_PUBLIC_SITE_URL` entra como build-arg, nunca
   como variável de runtime — é embutida no JavaScript durante o `next build`, e a imagem
   nasce aqui, não no servidor.
4. **`implantar`** — só roda quando a variável de repositório `DEPLOY_ATIVO` vale `true`.
   Conecta por SSH no VPS e executa `docker compose pull app && docker compose up -d app`
   (sempre nomeando o serviço, nunca `up -d` sozinho) e confere `/api/health` pelo domínio.
   Nenhum passo deste pipeline aplica migração — migração é sempre manual, depois de um
   backup, por alguém que está olhando.

O GitHub Actions espera os seguintes secrets e variáveis já cadastrados no repositório — só
os nomes ficam aqui, os valores nunca:

- `VPS_HOST` — endereço do servidor de produção
- `VPS_USUARIO` — usuário SSH de deploy no VPS
- `VPS_SSH_CHAVE` — chave privada SSH usada pelo pipeline para conectar no VPS
- `NEXT_PUBLIC_SITE_URL` — passada como build-arg, nunca como variável de runtime
- `DEPLOY_ATIVO` — liga/desliga o job `implantar` sem desativar o restante do pipeline;
  começa em `false` até o servidor existir (plano 01-07)

O *package* do GHCR precisa ficar **público** para o VPS baixar a imagem sem autenticar em
registro nenhum (D-07) — passo de configuração no GitHub que o dono executa no roteiro do
plano 01-06, depois da primeira publicação.

## Estrutura do repositório

```
app/            rotas e páginas do Next.js (App Router)
db/             schema, migrações e conexão com o Postgres (Drizzle)
docker/         Dockerfile, compose.yml, compose.dev.yml, Caddyfile
lib/            regras de negócio puras e testadas
scripts/        comandos de linha de comando invocados via ferramentas (Fase 2 em diante)
tests/          testes unitários e (a partir da Fase 2) E2E
amassa-plataforma/  documentação de arquitetura, modelo de dados e roadmap
```
