# Phase 1: Fundação e Primeiro Deploy - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega **o caminho do código até a internet**, sem nenhuma funcionalidade de produto: projeto
Next.js configurado, repositório público no GitHub com higiene de segredos, VPS Contabo endurecido,
`compose.yml` com postgres + app + caddy + ferramentas, DNS apontado com HTTPS válido, Drizzle
conectado e migrando, banco de testes para o E2E, GitHub Actions publicando no GHCR e fazendo
deploy por SSH, e `/api/health` verificando a aplicação e uma consulta real ao banco.

Corresponde à **M0** de `amassa-plataforma/03-ROADMAP.md`.

**Fora desta fase:** login, tabela `usuarios`, backup automático do banco, design system, casca de
navegação e qualquer módulo de produto — tudo isso é a Fase 2 ou depois.

</domain>

<decisions>
## Implementation Decisions

### Pré-requisitos e sequenciamento

- **D-01:** Domínio, VPS Contabo e conta GitHub **já existem**. O armazenamento externo para o
  backup ainda não foi criado — mas ele só é usado na Fase 2, então não bloqueia esta.
- **D-02:** A execução é **local primeiro, servidor depois**. Executar de ponta a ponta tudo o que
  roda na máquina do Theo (projeto Next.js, repositório, `compose.yml`, Dockerfile, Drizzle, testes,
  workflow do Actions) e **parar num checkpoint explícito** antes dos passos que exigem SSH no VPS
  e mudança de DNS. — **Reversibility:** reversible — é ordenação de trabalho, não escolha técnica.
- **D-03:** Os passos de servidor são entregues como **roteiro comentado para o Theo rodar** — cada
  comando com uma linha explicando o que faz e o que ele deve ver de volta. Não um script único
  opaco, e **não** execução por SSH feita pelo agente. Isso mantém o controle da máquina com o dono
  e torna cada falha localizável.

### Domínio e DNS

- **D-04:** O domínio da plataforma é **`amassacerrado.com.br`**, dedicado — separado do
  `amassaceramica.com.br`, que é o site público e está fora do escopo.
- **D-05:** Servir no **apex** (`amassacerrado.com.br`), com `www.amassacerrado.com.br` redirecionando
  para o apex no Caddyfile. `NEXT_PUBLIC_SITE_URL=https://amassacerrado.com.br`.
  — **Reversibility:** reversible — trocar para subdomínio é editar o Caddyfile, um registro de DNS
  e uma variável de build.

### Repositório e imagem

- **D-06:** Repositório GitHub chamado **`amassa`**, público.
- **D-07:** O *package* do GHCR é **público**, sem `docker login` no VPS. O repositório já é público
  e a imagem não carrega segredo nenhum — `DATABASE_URL` e `AUTH_SECRET` vivem só no `.env` do
  servidor, em tempo de execução, nunca dentro da imagem. Elimina uma credencial para manter e
  renovar, e remove o modo de falha "primeiro deploy trava sem mensagem óbvia".
  — **Reversibility:** reversible — tornar o package privado e adicionar um PAT depois é uma
  configuração no GitHub mais um comando no servidor.
- **D-08:** A pasta de planejamento `amassa-plataforma/` fica **versionada** no repositório público.
  Ela não contém segredo nem dado real — só decisões, schema e roadmap.

### Banco de testes e E2E

- **D-09:** O banco de testes é um **serviço Postgres separado**, não um segundo database dentro da
  mesma instância. A separação é física, não uma convenção de nome — um teste que apaga tudo não
  tem como encostar no banco real. Volume efêmero (`tmpfs`), sem porta publicada.
  — **Reversibility:** costly — inverter depois exige refazer o compose, as URLs de conexão do
  pipeline e a configuração do Playwright.
- **D-10:** O E2E roda **só no GitHub Actions**, com o Postgres de teste como *service container* do
  runner. O VPS não carrega peso extra, e o pipeline continua sendo o único portão antes do deploy.
- **D-11:** O `compose.yml` do servidor **não** inclui serviço de teste. Se um dia for preciso rodar
  E2E contra o ambiente real, isso entra como decisão separada.

### O que vai ao ar nesta fase

- **D-12:** A Fase 1 publica uma **página mínima com a marca**: fundo `#F6F3F0`, o nome AMASSA e uma
  linha dizendo que a plataforma está no ar. Não é o design system da Fase 2 — são poucas linhas de
  CSS inline ou uma classe utilitária, sem tokens, sem shadcn, sem `@theme`.
- **D-13:** Essa página existe por dois motivos concretos: prova visualmente que HTTPS, domínio e
  deploy funcionam, e dá **o que alterar** no critério de aceite "alterar um texto, dar push, e a
  mudança aparecer sozinha". Uma página em branco não tem texto para alterar.
- **D-14:** **Não antecipar** os tokens de cor nem o mapeamento `@theme inline` do shadcn. Eles são a
  primeira fase de UI da Fase 2 e precisam existir **antes** de qualquer componente shadcn ser
  instalado. Misturar as duas fases embaralha a fronteira e arrisca instalar componente antes do
  mapeamento — que é exatamente o erro que a seção 2 de `04-DESIGN-SYSTEM.md` alerta.

### Monitoramento

- **D-15:** Monitor externo: **UptimeRobot**, nível gratuito, checagem a cada 5 minutos com alerta
  por e-mail. Configurar já nesta fase apontando para `/api/health`; o `/api/health/backup` entra no
  mesmo painel na Fase 2, quando existir.

### Decisões já fechadas nos documentos fonte — não reabrir

Estas não foram discutidas porque já estão decididas e justificadas em `01-ARQUITETURA.md` e
`03-ROADMAP.md`. Listadas aqui para que o pesquisador e o planejador não as tratem como abertas:

- Stack: Next.js 15+ App Router, TypeScript **estrito**, Tailwind CSS v4, shadcn/ui, Vitest,
  Playwright, ESLint + Prettier com `--max-warnings=0` no CI.
- Postgres em Docker, imagem oficial, **versão estável mais recente** (mínimo 15), volume **nomeado**
  (nunca *bind mount* do host), **sem porta publicada**, **sem `TZ` injetado**.
- Caddy no lugar do Nginx — obtém e renova o certificado sozinho.
- Dockerfile em múltiplos estágios: saída `standalone` para o serviço `app`, e um estágio
  **`ferramentas`** com dependências completas, `drizzle-kit`, `tsx` e a pasta `db/`, invocado sob
  demanda com `docker compose run --rm`. Sem ele, migrar e criar usuário simplesmente não funciona.
- Endurecimento do VPS: UFW só 22/80/443, fail2ban, `unattended-upgrades`, SSH só por chave, login
  direto como root desabilitado, um usuário comum com `sudo` que é o usuário do deploy.
- A senha de root que a Contabo mandou é usada **uma única vez**, no primeiro passo, e nunca mais.
- Build no **GitHub Actions**, nunca no servidor — um `next build` pode estourar a RAM do VPS e
  derrubar o site junto com o banco, que agora mora na mesma máquina.
- Deploy sempre `docker compose up -d app`, **nunca** `up -d` sozinho, para não recriar o Postgres.
- `NEXT_PUBLIC_SITE_URL` passada como **build-arg**, não como variável de runtime.
- `AUTH_TRUST_HOST=true` obrigatório atrás do Caddy (relevante a partir da Fase 2, mas a variável
  entra no `.env.example` já aqui).
- Migrações aplicadas **à mão**, depois de backup, fora do pipeline automático.
- `.env` em `/opt/amassa/.env` com permissão `600`. `.env.example` versionado, **sem valores**.
- Repositório público com *secret scanning* e *push protection* habilitados.
- Sem pgAdmin, Adminer ou qualquer console de banco exposto na web.

### Claude's Discretion

- Estrutura interna do `Dockerfile` e ordem das camadas, desde que o estágio `ferramentas` exista e
  a saída `standalone` seja usada no `app`.
- Nomes dos jobs e steps do workflow do GitHub Actions.
- Forma exata do `healthcheck` do compose e do endpoint `/api/health` (desde que ele faça uma
  consulta real ao banco, não só responda 200).
- Organização dos arquivos em `docker/` e `scripts/`.
- Quais testes mínimos existem nesta fase para provar que o pipeline barra build quebrado.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquitetura e infraestrutura — leitura obrigatória para esta fase
- `amassa-plataforma/01-ARQUITETURA.md` — documento inteiro. Stack, estrutura de pastas,
  segurança do banco, topologia do VPS, deploy, variáveis de ambiente e custo.
- `amassa-plataforma/01-ARQUITETURA.md` §2 — tabela de stack com a razão de cada escolha, e a lista
  do que **não** usar.
- `amassa-plataforma/01-ARQUITETURA.md` §3 — estrutura de pastas do projeto (`app/`, `components/`,
  `db/`, `lib/`, `scripts/`, `tests/`, `docker/`, `middleware.ts`).
- `amassa-plataforma/01-ARQUITETURA.md` §4 — a caixa "Por que existe um serviço `ferramentas` no
  `compose.yml`". Sem esse estágio, migração e criação de usuário não funcionam na imagem de produção.
- `amassa-plataforma/01-ARQUITETURA.md` §6 — topologia, componentes, endurecimento do VPS, deploy,
  as três armadilhas do deploy, e o bloco de variáveis de ambiente com as duas caixas de aviso
  (`AUTH_TRUST_HOST` e `NEXT_PUBLIC_*` como build-args).
- `amassa-plataforma/01-ARQUITETURA.md` §9 — observabilidade: `/api/health` verificando app **e**
  banco, monitor externo, e a decisão de não usar Sentry/APM/analytics.
- `amassa-plataforma/01-ARQUITETURA.md` §10 — repositório público: o que isso exige, o que fica
  público sem problema, e o que nunca pode entrar.

### Modelo de dados — só o necessário nesta fase
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §0 — a armadilha de fuso do container Postgres em UTC,
  e o aviso de nunca injetar `TZ` no serviço `postgres`. **Relevante já aqui**, porque o
  `compose.yml` é escrito nesta fase.
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §6 — fluxo de trabalho com Drizzle (`drizzle-kit
  generate`, migrações versionadas, `--custom` para funções/views/papéis que o Drizzle não gera).
  As tabelas em si são da Fase 2 em diante.

### Roadmap e critérios de aceite
- `amassa-plataforma/03-ROADMAP.md` §M0 — as 9 fases do milestone e os 10 critérios de aceite,
  escritos para o Theo verificar sozinho, sem ler código.
- `.planning/ROADMAP.md` §"Phase 1" — a tradução GSD, com os requisitos INFRA-01 a INFRA-10 mapeados.
- `.planning/REQUIREMENTS.md` §"Infraestrutura e Deploy" — os 10 requisitos INFRA em forma testável.

### Regras que valem para o projeto inteiro
- `amassa-plataforma/00-BRIEFING.md` §11 — os 10 critérios de qualidade não negociáveis.
- `.planning/PROJECT.md` §Constraints — os mesmos critérios, mais as restrições de custo, fuso e
  autorização.

### Design — só o estritamente necessário nesta fase
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §2 — apenas para pegar `#F6F3F0` (fundo) e `#1D2221`
  (tinta) para a página mínima da D-12. **Não implementar o bloco `@theme` nem o `@theme inline`
  aqui** — isso é a Fase 2, e precisa vir antes de qualquer componente shadcn.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
Nenhum — projeto greenfield. Não existe código de aplicação, `package.json` nem `node_modules`.
O único conteúdo do repositório hoje é `.planning/`, `.claude/` (instalação do GSD) e
`amassa-plataforma/` (os documentos de planejamento).

### Established Patterns
- `.gitignore` já criado antes do primeiro commit de código, cobrindo `.env*` (menos
  `.env.example`), `backups/`, `*.sql.gz`, chaves e artefatos de build. Era o item 8 da lista
  "coisas que vão poupar horas" e o único que não quebra nada quando falta.
- Git já inicializado, com identidade local configurada e 4 commits de planejamento.
- Convenção de commits do GSD já em uso (`docs:`, `chore:` com escopo de fase).

### Integration Points
- A estrutura de pastas de `01-ARQUITETURA.md` §3 é o alvo — esta fase cria o esqueleto
  (`app/`, `db/`, `lib/`, `scripts/`, `tests/`, `docker/`), e as fases seguintes o preenchem.
- `db/schema.ts` nasce nesta fase **vazio ou quase**, só o suficiente para provar que
  `npm run db:migrate` funciona. As tabelas reais chegam na Fase 2.
- O `.env.example` criado aqui já declara todas as variáveis do projeto (inclusive `AUTH_SECRET` e
  `AUTH_TRUST_HOST`, usadas só a partir da Fase 2), sem valores.

</code_context>

<specifics>
## Specific Ideas

- **A página mínima precisa ter texto alterável.** O critério de aceite INFRA-02 é "alterar um
  texto, dar push, e a mudança aparecer sozinha" — uma página em branco não tem o que alterar. A
  frase que ficar no ar deve ser óbvia de encontrar no código.
- **Voz da interface já vale aqui.** Mesmo numa página de uma linha, o registro é o do AMASSA:
  afetivo e direto, nunca corporativo. `04-DESIGN-SYSTEM.md` §9.
- **O roteiro de servidor precisa dizer o que esperar de volta.** Não só "rode isto", mas "você
  deve ver X". É o que permite o Theo perceber que algo saiu errado no passo em que saiu, e não
  três passos depois.
- **Conferir a higiene de segredos antes de fechar a fase**, com
  `git log --all --full-history -- .env`. Está no primeiro critério de aceite da M0 por um motivo:
  um segredo que entra num repositório público é um segredo queimado mesmo que o commit seja
  apagado depois — e a resposta certa não é apagar o commit, é trocar a credencial.

</specifics>

<deferred>
## Deferred Ideas

- **Armazenamento externo do backup (Google Drive via rclone)** — decidido nesta conversa (D-01),
  mas a implementação pertence à **Fase 2**, junto com `scripts/backup.sh`, o `cron` do host, a
  tabela `execucoes_backup` e o endpoint `/api/health/backup`. Criar a conta e configurar o rclone
  é pré-requisito da Fase 2, não desta.
- **`/api/health/backup` no UptimeRobot** — o endpoint só existe na Fase 2. Nesta fase o monitor
  cobre apenas `/api/health`; o segundo é adicionado ao mesmo painel depois.
- **Serviço de teste no `compose.yml` do servidor** — descartado agora (D-11). Se um dia for preciso
  rodar E2E contra o ambiente real, entra como decisão própria.
- **Tokens de cor e mapeamento `@theme inline` do shadcn** — Fase 2, primeira fase de UI, antes de
  instalar qualquer componente (D-14).
- **Dump de hora em hora no lugar do diário** — a correção mais barata do plano inteiro se as 24h de
  perda máxima um dia incomodarem. Uma linha no `cron`, custo zero. Não fazer agora.
- **Rolling update no deploy** — `docker compose up -d app` para o container antigo e sobe o novo,
  com alguns segundos fora do ar. Aceitável para 5 usuários internos. Registrado para que ninguém
  suponha uma rede de proteção que não existe.

</deferred>

---

*Phase: 1-Fundação e Primeiro Deploy*
*Context gathered: 2026-08-05*
