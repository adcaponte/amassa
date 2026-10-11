# AMASSA — Plataforma de Gestão do Ateliê

Plataforma web interna, privada e responsiva, para os gestores da **AMASSA CERRADO** — espaço de
cerâmica artesanal de alta temperatura em **Pirenópolis**, com loja física e café, inauguração em
dezembro de 2026 — administrarem a operação do dia a dia em um único lugar, substituindo planilhas
e controles espalhados.

Módulos (os que existem em `app/gestao/(app)/` e na barra lateral, `lib/navegacao/itens.ts`):
**Início** (Anotações da casa e Lembretes), **Financeiro** (Venda, Despesa, Caixa, Mês, e a
precificação: Orçamentos e Peças — substitui a antiga Calculadora de Orçamento), **Produção** (o
redesenho das Encomendas), **Agenda** (turmas, oficinas, uso livre, presença e "a receber"),
**Queimas** (contador de queimas dos fornos, contagem do que queimou e relatórios), **Estoque**,
**Lembretes** e **Cadastros** (catálogo, categorias, contas fixas, taxas, parâmetros, clientes e
fornecedores). A **Abertura do Espaço** (temporária, com o **Comparador de Compras**) fica no menu
do usuário.

**Não confundir os dois negócios.** A **AMASSA** de **Goiânia** (`amassaceramica.com.br`, com loja
Shopify) é de outras sócias e está **fora do escopo** deste repositório — sem redirecionamento, sem
dado compartilhado.

O domínio deste projeto é **`amassacerrado.com.br`**: a raiz é o **site público institucional** da
AMASSA CERRADO (estático, continua no ar com o Postgres derrubado) e a plataforma responde em
**`/gestao`**, sem link a partir do site.

*Até 11/10/2026 este README falava da AMASSA de Goiânia, de "cinco módulos" com a "Calculadora de
Orçamento", de Next.js 15+, de `amassaceramica.com.br` como o site institucional e de um pipeline de
quatro jobs — tudo anterior às Fases 04.4–06.5. Corrigido conferindo o código: `app/gestao/(app)/`,
`lib/navegacao/itens.ts`, `package.json`, `docker/` e `.github/workflows/entrega.yml`.*

A documentação de arquitetura, modelo de dados, roadmap original e design system vive em
[`amassa-plataforma/`](./amassa-plataforma) (escrita a partir do material da AMASSA de Goiânia —
as regras de negócio podem não valer para Pirenópolis). O planejamento e o estado do projeto vivem
em `.planning/` (`ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`). Este README cobre só o que é preciso
para rodar e operar o sistema.

### Roteiros de operação

Os roteiros comentados do servidor vivem em [`docs/operacao/`](./docs/operacao), numerados na ordem
em que foram executados pelo dono:

- **01–03** — preparar o servidor (VPS, Docker, `/opt/amassa`, chave de deploy), DNS, primeira
  publicação, HTTPS e monitor externo, backup e restauração.
- **04–23** — a migração (ou a correção) de cada fase: Encomendas (04), Queimas (05), espera dos
  marcos (06), Abertura do Espaço (07, 08), Comparador de Compras (09), Financeiro (10, 11), fotos,
  volume e backup (12), Precificação e Orçamentos (13), `/gestao` e site público (14), Estoque (15),
  Produção (16), Agenda (17, 18), Fornecedores (19), Lembretes (20), Queimas — contagem (21),
  Polimento (22) e as correções da revisão 06.5 (23).
- **24** — [`24-limpeza-geral.md`](./docs/operacao/24-limpeza-geral.md): a limpeza geral dos dados
  antes da inauguração (`npm run limpeza-geral`, ensaio por padrão).

## Stack

Next.js 16 (App Router, TypeScript estrito), React 19, Tailwind CSS v4, shadcn/ui (Radix), Recharts,
PostgreSQL em Docker, Drizzle ORM, Auth.js v5 (Credentials + argon2id), Server Actions + Zod,
react-hook-form, lucide-react, Vitest e Playwright; Caddy como proxy reverso com HTTPS automático.
As versões exatas estão no `package.json`. Ver `amassa-plataforma/01-ARQUITETURA.md` §2 para a
razão de cada escolha.

## Desenvolvimento local

```bash
cp .env.example .env.local   # preencher com valores de desenvolvimento
docker compose --env-file .env.local -f docker/compose.yml -f docker/compose.dev.yml up -d postgres
npm install
npm run db:migrate
npm run dev
```

O `--env-file .env.local` é obrigatório: o `docker/compose.yml` lê `${POSTGRES_USER}`,
`${POSTGRES_PASSWORD}` e `${POSTGRES_DB}`, e o Compose procura o `.env` na pasta `docker/`, que não
existe — sem a opção o Postgres sobe sem senha e reinicia em loop ("superuser password is not
specified").

`docker/compose.dev.yml` é uma sobreposição só de desenvolvimento — publica o Postgres em
`127.0.0.1:5433` e sabe construir as imagens `app`/`ferramentas` localmente a partir do
`docker/Dockerfile`. Ela nunca vai para o servidor.

### Portões de qualidade

```bash
npm run verificar        # o portão de todo plano: lint, tsc --noEmit, verificar-acoes, npm test e test:migracoes
```

`npm run verificar` encadeia, nesta ordem:

```bash
npm run lint             # ESLint, --max-warnings=0
npx tsc --noEmit         # tipos
npm run verificar-acoes  # exigirUsuario() na primeira instrução de toda ação que toca o banco
npm test                 # Vitest
npm run test:migracoes   # base comum do banco, de fora, num Postgres efêmero (lista TABELAS_ESPERADAS)
```

Fora dele, mais caros ou mais específicos:

```bash
npm run test:e2e             # Playwright contra a imagem construída (~53 s de Postgres e build antes do 1º teste)
npm run test:backup          # backup.sh e restaurar.sh de ponta a ponta, sem servidor
npm run test:site-sem-banco  # o site público responde com o Postgres derrubado
```

Toda fase que mexe em `db/schema.ts` atualiza `TABELAS_ESPERADAS` em `scripts/testar-migracoes.mjs`.

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
docker compose --profile ferramentas pull ferramentas
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

Além dessas, cada módulo que trouxe migração tem a sua rota de saúde em `app/api/health/`
(`agenda`, `estoque`, `fornecedores`, `lembretes`, `polimento`, `producao`, `queimas`): cada uma
faz `select` de algo que a migração dela cria e responde `503` se não existir — é como os roteiros
provam, de fora, que a migração foi aplicada.

## Produção

Tudo roda em `https://amassacerrado.com.br`, no apex (com `www.amassacerrado.com.br` redirecionando
para o apex no Caddyfile): o site público na raiz e a plataforma em `/gestao`. Os endereços antigos
da plataforma (de antes de ela descer para `/gestao`) redirecionam até 2027-03-28
(`lib/rotas/redirecionamentos-antigos.ts`). Nada aqui tem relação com `amassaceramica.com.br`,
que é da AMASSA de Goiânia.

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
acionamento manual) e roda seis jobs encadeados por `needs` — sete execuções, porque o `e2e` é
uma matriz de duas fatias. Um teste quebrado interrompe a fila antes de `:latest` mudar:

1. **`qualidade`** — `npm run lint`, `npm run verificar-acoes` e `npm test`, nessa ordem.
   `verificar-acoes` garante, por análise da árvore sintática (nunca expressão regular), que toda
   Server Action que toca o banco chama `exigirUsuario()` como primeira instrução; se reprovar, a
   mensagem aponta arquivo, linha e função.
2. **`construir`** — roda em paralelo com a `qualidade`: constrói e sobe ao GHCR as imagens
   `app` e `ferramentas` com a tag do commit, a partir do mesmo `docker/Dockerfile`, e entrega
   os digests aos jobs seguintes. `NEXT_PUBLIC_SITE_URL` entra como build-arg, nunca como
   variável de runtime — é embutida no JavaScript durante o `next build`, e a imagem nasce aqui,
   não no servidor.
3. **`e2e`** (matriz `desktop` / `celular`, depois de `qualidade` e `construir`) — cada fatia sobe
   o seu Postgres de teste como *service container*, aplica o schema, baixa a imagem `app` **pelo
   digest** e roda o Playwright **contra essa imagem rodando de verdade** — nunca contra `next
   start`, que não é compatível com a saída `standalone` usada em produção.
4. **`banco`** (depois de `qualidade` e `construir`) — aplica o schema num banco de teste **pela
   imagem `ferramentas`** do commit, confere que ela traz exatamente as migrações do commit, e
   roda `npm run test:migracoes` e `npm run test:backup`.
5. **`publicar`** (depois de `construir`, `e2e` e `banco`) — promove pelos digests testados a
   imagem `app` a `:latest` e a `ferramentas` a `:ferramentas`, e confere que as tags apontam para
   eles.
6. **`implantar`** — só roda quando a variável de repositório `DEPLOY_ATIVO` vale `true`.
   Ressincroniza o `compose.yml` do servidor, conecta por SSH e executa
   `docker compose pull app`, `docker compose --profile ferramentas pull ferramentas` e
   `docker compose up -d app` (sempre nomeando o serviço, nunca `up -d` sozinho), e confere
   `/api/health` pelo domínio. **Nenhum passo deste pipeline aplica migração** — migração é sempre
   manual, depois de um backup, por alguém que está olhando. O `.env` do servidor também não é
   tocado: é do dono e editado à mão.

O GitHub Actions espera os seguintes secrets e variáveis já cadastrados no repositório — só
os nomes ficam aqui, os valores nunca:

- secret `VPS_HOST` — endereço do servidor de produção
- secret `VPS_USUARIO` — usuário SSH de deploy no VPS
- secret `VPS_SSH_CHAVE` — chave privada SSH usada pelo pipeline para conectar no VPS
- variável `NEXT_PUBLIC_SITE_URL` — passada como build-arg, nunca como variável de runtime
- variável `DEPLOY_ATIVO` — liga/desliga o job `implantar` sem desativar o restante do pipeline

O login no GHCR usa o token efêmero do próprio runner (`GITHUB_TOKEN`).

O *package* do GHCR precisa ficar **público** para o VPS baixar a imagem sem autenticar em
registro nenhum (D-07) — passo de configuração no GitHub que o dono executa no roteiro do
plano 01-06, depois da primeira publicação.

## Estrutura do repositório

```
app/            rotas do Next.js (App Router): o site público na raiz, a plataforma em app/gestao/
components/     componentes React (amassa/ da plataforma, site/ do site público, ui/ do shadcn)
conteudo/       textos do site público
db/             schema, migrações, limpeza geral e conexão com o Postgres (Drizzle)
docker/         Dockerfile, compose.yml, compose.dev.yml, compose.teste.yml, Caddyfile
docs/operacao/  roteiros comentados do servidor (01 a 24)
lib/            regras de negócio puras e testadas, ações e consultas por módulo
scripts/        comandos de linha de comando (contas, backup, limpeza) e os testes de fora
tests/          testes unitários (Vitest) e E2E (Playwright)
amassa-plataforma/  documentação original de arquitetura, modelo de dados e roadmap
```
