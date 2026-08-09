---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 3
current_phase_name: Gestor de Encomendas
status: executing
stopped_at: Completed 03-06-PLAN.md
last_updated: "2026-08-09T18:56:48.468Z"
last_activity: 2026-08-09
last_activity_desc: Phase 3 execution started
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 28
  completed_plans: 26
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05)

**Core value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.
**Current focus:** Phase 3 — Gestor de Encomendas

## Current Position

Phase: 3 (Gestor de Encomendas) — EXECUTING
Plan: 7 of 8
Status: Ready to execute
Last activity: 2026-08-09 — Phase 3 execution started

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 7 | - | - |
| 02a | 8 | - | - |
| 2b | 5 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 45min | 2 tasks | 26 files |
| Phase 01 P03 | 45min | 3 tasks | 8 files |
| Phase 01-funda-o-e-primeiro-deploy P02 | 20min | 2 tasks | 1 files |
| Phase 01 P04 | 45min | 2 tasks | 7 files |
| Phase 01 P05 | ~50min | 2 tasks | 3 files |
| Phase 01-funda-o-e-primeiro-deploy P06 | 35min | 2 tasks | 3 files |
| Phase 02a P01 | 32min | 3 tasks | 23 files |
| Phase 02a P02 | 50min | 3 tasks | 11 files |
| Phase 02a P03 | 31min | 3 tasks | 11 files |
| Phase 02a P04 | 38min | 3 tasks | 10 files |
| Phase 02a P05 | 45min | 3 tasks | 11 files |
| Phase 02a P06 | 55min | 3 tasks | 11 files |
| Phase 02a P07 | ~100min | 3 tasks | 8 files |
| Phase 02a P08 | ~4h50min (execucao real) + autoria | 3 tasks | 8 files |
| Phase 02b P01 | ~55min | 3 tasks | 12 files |
| Phase 02b P02 | ~2h | 4 tasks | 18 files |
| Phase 02b P03 | ~55min | 3 tasks | 14 files |
| Phase 02b P04 | ~50min | 3 tasks | 7 files |
| Phase 02b P05 | ~40min | 3 tasks | 6 files |
| Phase 03 P01 | 36min | 3 tasks | 27 files |
| Phase 03 P02 | 16min | 3 tasks | 8 files |
| Phase 03 P03 | 14min | 3 tasks | 4 files |
| Phase 03 P04 | 100min | 3 tasks | 10 files |
| Phase 03 P05 | ~110min | 3 tasks | 9 files |
| Phase 03 P06 | ~100min | 3 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: ordem de execução M0→M1→M2→**M4**→M3→M5→M7 preservada do documento fonte (Fornos antecipado por ser o menor módulo e o fluxo mais usado; Agenda deslocada por ser a mais complexa)
- Roadmap: backup automático (BKP-01..07) mapeado para a Fase 2 (M1), não para a fase de polimento final — é a única rede de proteção sem serviço gerenciado
- Roadmap: M6 (Calculadora de Orçamento) excluída do roadmap ativo — bloqueada por planilhas de precificação ausentes; requisitos ORC-01..05 vivem em REQUIREMENTS.md v2
- Roadmap: M0 e M1 mantidas como fases separadas (não fundidas) — decisão estrutural do documento fonte para isolar toda a dor de infraestrutura antes dos módulos de produto
- [Phase ?]: FRASE_NO_AR vive em app/frase-no-ar.ts (nao em app/page.tsx) porque o Next.js 15 rejeita exports extras em arquivos de pagina
- [Phase ?]: db/migrate.ts e drizzle.config.ts carregam .env.local via process.loadEnvFile() quando o arquivo existe, ja que scripts soltos nao herdam o .env do runtime do Next.js
- [Phase ?]: node:24.19.0-alpine fixado como imagem base do Dockerfile — mesma versao exata do Node local, confirmado por digest identico ao de node:24-alpine
- [Phase ?]: NPM_CONFIG_OFFLINE=true na imagem app — garante que a falha do drizzle-kit na imagem de producao seja deterministica mesmo com rede disponivel no container
- [Phase ?]: Repositorio ja existia (criado pelo dono, publico, secret scanning e push protection ligados); Task 2 adaptada para git puro (remote add + push) sem gh CLI
- [Phase ?]: Protecao de branch main (force-push/exclusao) nao configurada nesta execucao por falta de gh CLI e credenciais de API; registrada como acao pendente do dono
- [Phase ?]: docker/compose.teste.yml sem ports: (D-09 ao pe da letra); scripts/testar-e2e.mjs publica porta so via CLI (docker compose run -p) durante a execucao do teste
- [Phase ?]: Projeto celular do Playwright usa preset Pixel 7 (Chromium) em vez de iPhone (WebKit), para nao instalar um segundo motor
- [Phase ?]: E2E de CI constroi e roda a imagem Docker real (alvo app), nunca next start — corrige lacuna entre o que o gate testa e o que sobe em producao
- [Phase ?]: Migracao do banco de teste em CI chama db/migrate.ts diretamente, nao npm run db:migrate, para manter o workflow livre de qualquer mencao ao comando reservado a migracao de producao
- [Phase ?]: Deploy por SSH sem action de terceiro — cliente ssh nativo do runner, para respeitar a mitigacao do threat model (so actions oficiais do GitHub/Docker)
- [Phase ?]: POSTGRES_USER=amassa_owner e POSTGRES_DB=amassa fixados como convenção nos roteiros de servidor (não são segredo), permitindo que o Roteiro 2 referencie esses nomes diretamente
- [Phase ?]: Linha de prova gravada na tabela verificacao_infraestrutura durante a migração do Roteiro 2, reconferida depois do reinício do VPS, como prova concreta de dados intactos (INFRA-05)
- [Phase ?]: 02a-01: next-auth fixado em 5.0.0-beta.32 (maior 5.x publicada; a tag latest do npm ainda aponta para a linha 4.x) — aprovado no portao de legitimidade de pacote
- [Phase ?]: 02a-01: @node-rs/argon2 fixado em 2.0.2 apesar de ~20 meses sem publicacao — avaliado e aceito pelo dono (ligacao nativa fina e estavel sobre a crate Rust argon2, monorepo napi-rs/node-rs ainda ativo)
- [Phase ?]: 02a-01: playwright.config.ts usa baseURL http://localhost:3000, nao 127.0.0.1 — o NextURL do Next.js normaliza qualquer host 127.x.x.x para 'localhost' ao montar URLs, o que trocaria a origem no meio do redirect de login e descartaria o cookie de sessao
- [Phase ?]: 02a-01: divisao de borda do Auth.js (auth.config.ts sem argon2/banco/authorize x auth.ts com tudo isso) provada por teste de grafo de modulos, nao so por inspecao — tests/unit/auth-borda.test.ts falha se a divisao for desfeita
- [Phase ?]: 02a-02: amassa_app nasce sem senha na migracao (login sem password) — o metodo de autenticacao da imagem exige senha para conexao por rede, entao nao ha janela de acesso entre a migracao e a definicao da senha no servidor (roteiro do plano 08)
- [Phase ?]: 02a-02: grant connect usa current_database() dinamico via bloco do $$ ... execute format(...) $$, nao o nome literal 'amassa' — a mesma migracao vale tambem contra o banco de teste efemero (amassa_teste)
- [Phase ?]: 02a-02: scripts/testar-migracoes.mjs calcula a data de Brasilia com Intl.DateTimeFormat nativo do Node, sem instalar date-fns-tz so para a conferencia de teste
- [Phase ?]: 02a-03: ErroBloqueado (subclasse de CredentialsSignin) carrega segundosParaLiberar intacto ate lib/auth/acoes.ts sem serializacao, confirmado nas fontes de @auth/core
- [Phase ?]: 02a-03: avaliarCredenciais compara contra usuario.senhaHash quando o usuario existe (mesmo desativado) e contra um hashDeReferencia gerado no boot so quando nao existe, igualando o tempo de resposta
- [Phase ?]: 02a-03: tests/e2e/autenticacao.spec.ts roda em modo serial (test.describe.configure) para eliminar contencao de recursos entre os quatro testes e a corrida teorica sobre a conta compartilhada
- [Phase ?]: 02a-04: exigirUsuario() busca usuario pelo e-mail da sessao (indice funcional lower(email)), nao por id de token — o callback session padrao do Auth.js remove id do objeto de sessao, e adiciona-lo exigiria module augmentation so para isso
- [Phase ?]: 02a-04: cookies.sessionToken.options.secure=true estatico em auth.config.ts funciona em http://localhost porque o Chrome trata localhost como contexto seguro (aceita cookies Secure sem TLS)
- [Phase ?]: 02a-04: auth.ts e importado de forma dinamica dentro de exigirUsuario() (nao no topo do arquivo) para manter avaliarAutorizacao() testavel no Vitest sem herdar a resolucao de next/server que so o bundler do Next.js resolve
- [Phase ?]: 02a-04: testes e2e que MUTAM estado compartilhado (ativo de um usuario) usam conta dedicada criada na hora, exclusiva por projeto Playwright — reaproveitar a conta global de login so e seguro para leitura
- [Phase ?]: 02a-05: verificar-acoes.mjs decide por arvore sintatica do compilador do TypeScript (nunca regex) se uma acao de servidor toca o banco sem exigirUsuario() na primeira instrucao
- [Phase ?]: 02a-05: verificar-acoes.mjs aceita arquivo ou diretorio no mesmo argumento de linha de comando, permitindo o teste unitario apontar fixtures individuais sem subpasta so de aprovados
- [Phase ?]: 02a-05: scripts/testar-migracoes.mjs roda redefinir-senha e desativar-usuario como processo filho de verdade (nao reimplementa a logica) para provar o comando que a pessoa vai digitar
- [Phase ?]: 02a-06: execucoes_backup nasce sem atualizado_em/trigger — segunda tabela do sistema na excecao 'so insercao' de 02-MODELO-DE-DADOS.md §0
- [Phase ?]: 02a-06: decidirFrescorDoBackup() checa relogio no futuro antes de sucesso/destino_externo_ok — timestamp inconsistente invalida a leitura inteira
- [Phase ?]: 02a-06: /api/health/backup nunca expoe bytes no corpo — o tamanho absoluto do dump revelaria o volume de dados do atelie a qualquer pessoa na internet (T-02a-28)
- [Phase ?]: 02a-06: advisory lock do Postgres (pg_advisory_lock) serializa backup.spec.ts entre os dois projetos do Playwright — execucoes_backup nao tem chave natural de particionamento como usuarios tem por e-mail
- [Phase ?]: 02a-07: pg_dump gerado sempre com --clean --if-exists — o mesmo dump restaura sobre banco vazio ou sobre o mesmo banco de onde saiu, sem 'relation already exists'
- [Phase ?]: 02a-07: mensagem de registro entra no psql pela entrada padrao (stdin), nunca por -c — psql -c nao substitui variaveis :'nome' nesta versao (17.10)
- [Phase ?]: 02a-07: .gitattributes novo forcando LF em *.sh — CRLF quebraria os scripts POSIX no servidor Linux independente do core.autocrlf de quem commita
- [Phase ?]: 02a-07: scripts/testar-backup.mjs descobre o container do Postgres de teste em CI pela imagem (docker ps --filter ancestor=postgres:17-alpine), nao por nome fixo
- [Phase ?]: 02a-08: teste comprimido do disparo do cron (linha temporaria, poucos minutos a frente) em vez de esperar 24h — descobriu que o daemon do cron nao releu o fuso apos a normalizacao do servidor para UTC, sem nenhuma mensagem de erro em crontab -l/systemctl/journal
- [Phase ?]: 02a-08: servidor normalizado para Etc/UTC em vez de compensar o fuso de Brasilia dentro da linha do cron; reiniciar o cron apos qualquer mudanca de fuso do sistema, ja que ele so le TZ na inicializacao
- [Phase ?]: 02a-08: execucoes_backup diverge por construcao entre o banco do ensaio de restauracao e a producao (o backup.sh registra a propria execucao DEPOIS do dump) — so usuarios e verificacao_infraestrutura precisam bater exatamente na conferencia
- [Phase ?]: 02a-08: bug de callbackUrl vazando https://0.0.0.0:3000 no redirecionamento nao autenticado registrado em WINDOWS.md (id 2) e nao corrigido — fora de files_modified deste plano, causa provavel em lib/auth/auth.config.ts das fases 02a-03/02a-04
- [Phase ?]: 02b-01: shadcn CLI fixada em 3.8.5 (nao @latest) para init/add button — a versao mais recente usaria o preset padrao 'Nova' com @base-ui/react em vez de primitivas Radix, contrariando o Component library: Radix UI do 02b-UI-SPEC.md
- [Phase ?]: 02b-01: registro do shadcn resolve radix-ui (pacote unificado) no lugar de @radix-ui/react-slot, e lucide-react numa linha 1.x — nao e artefato de versao da CLI, e o registro do lado do servidor; aprovado apos novo portao de legitimidade com lucide-react fixado em 1.28.0 (nao 1.30.0, por higiene de cadeia de suprimentos)
- [Phase ?]: 02b-01: @theme do Tailwind v4 resolve no escopo :root — variavel de fonte do next/font/google declarada so no <body> nao e enxergada la; as classes .variable precisam ir no <html>. Achado no portao de retorno do tracer via getComputedStyle, nao por lint/tsc/build
- [Phase ?]: 02b-01: next/font/google com a opcao variable produz o nome legivel da familia (Archivo Narrow, com espaco), nao o nome com hash (__Archivo_Narrow_hash) — este ultimo so aparece no padrao de uso via .className direto. Testes futuros de font-family devem usar o nome medido
- [Phase ?]: 02b-02: shadcn CLI mantida em 3.8.5 (nao @latest), repetindo a 02b-01, por consistencia com components.json (radix-nova) e button.tsx ja commitados
- [Phase ?]: 02b-02: zero pacote npm novo na instalacao de card/sidebar/sheet/skeleton/dropdown-menu/separator — os quatro primitivos Radix necessarios ja vinham vendidos por radix-ui@1.6.7 aprovado na 02b-01, confirmado por diff vazio de package.json/package-lock.json
- [Phase ?]: 02b-02: DropdownMenuItem do Radix com asChild aplica role=menuitem no elemento raiz e nao submete <form> aninhado de verdade — quando role=button precisa ser preservado, o alvo do asChild e um <div> neutro com o <button real dentro chamando a Server Action direto no onClick
- [Phase ?]: 02b-03: CabecalhoPagina nao recebe children em nenhuma das seis telas — o botao desabilitado de cada modulo vive dentro de EstadoVazio, seguindo o esqueleto literal do texto de acao em vez do diagrama do 02b-UI-SPEC.md; componente continua pronto para children (flex-wrap ja resolvido)
- [Phase ?]: 02b-03: tests/e2e/casca.spec.ts roda em serie (mesma convencao de autenticacao/sessao.spec.ts) por prudencia de carga — cada caso faz login com hash argon2id real
- [Phase ?]: 02b-03: locator de navegacao por visibilidade (nunca por nome de projeto Playwright) — barra lateral e barra inferior sempre coexistem no DOM, so uma fica oculta por CSS; :visible filtra a metade oculta em checagens de aria-current
- [Phase ?]: 02b-04: app/not-found.tsx (raiz) confirmado em execucao real como quem sempre responde a URL sem casamento (mesmo sub-rota de modulo existente), nunca app/(app)/not-found.tsx, que fica pronto para a primeira notFound() de rota dinamica da Fase 3
- [Phase ?]: 02b-04: tests/e2e/estados.spec.ts prova que a navegacao NAO aparece no 404 alcancavel por URL (ausencia estrutural, fora da casca) - correcao da suposicao original do plano, documentada com achado em execucao real
- [Phase ?]: 02b-05: gate de legitimidade da Tarefa 1 resolvido pela verificacao independente do orquestrador (npm view confirmou axe-core@4.13.0 e @axe-core/playwright@4.12.1 do repositorio oficial dequelabs/axe-core-npm) sob autorizacao permanente do dono
- [Phase ?]: 02b-05: NOME_ACESSIVEL_MENU_USUARIO vive em lib/acessibilidade/rotulos.ts (modulo puro) em vez de cabecalho-movel.tsx — importar direto do componente quebrava o carregador de teste do Playwright (cadeia ate next-auth/next-server)
- [Phase ?]: 02b-05: backstop de nome longo do UI-SPEC convertido em teste automatizado real com 53 caracteres (nao os 43 do exemplo do checklist humano, que nao forca corte no Sheet do celular)
- [Phase ?]: 02b-05: checkpoint bloqueante da Tarefa 3 (UI-05, D-05, olhada geral) nao respondido nem auto-aprovado — registrado em 02b-VERIFICACAO-HUMANA.md, pendente do dono
- [Phase ?]: Formatação de data por split/reverse/join direto em page.tsx (sem Date), adiando lib/encomendas/formato.ts (PD-04) para quando mais de um lugar precisar formatar
- [Phase ?]: criarEncomenda usa assinatura pronta para useActionState (estadoAnterior, FormData), chamada hoje via .bind(null, null) a partir de Server Component
- [Phase ?]: shadcn 'form' (radix-nova/CLI 3.8.5) não instala nenhum arquivo — decisão de field vs wrapper próprio vs react-hook-form direto fica em aberto para o plano 06 (WINDOWS.md #4)
- [Phase ?]: celulasDeQuinzena recebe formatarMes por injeção de parâmetro para manter gantt.ts sem import
- [Phase ?]: situacaoEm ordena cancelada -> concluida -> sem-etapas -> nao-comecou -> atrasada -> busca de etapa, cada if com retorno próprio
- [Phase ?]: textoDaSituacao(semCor:true) troca a frase de atrasada para uma forma sem depender de --color-atencao, revisável no plano 08
- [Phase ?]: 03-03: select ... for update dentro de db.transaction (PD-02) — o novo valor do ajuste rápido nasce da linha travada, nunca de um número vindo do cliente
- [Phase ?]: 03-03: entrada de objeto tipado (não FormData) nas seis ações novas — nenhuma UI as consome ainda; criarEncomenda continua com FormData/useActionState
- [Phase ?]: 03-03: esquemaAtualizacaoDeEncomenda local a acoes.ts via esquemaEncomenda.extend() — reusa nome/cliente/data/etapas sem reimplementar, só acrescenta id + itens com id opcional para reconciliação
- [Phase ?]: Gantt e lista mobile compartilham o mesmo conjunto filtrado (rascunho+em_producao, D-06) ate o plano 07 trazer filtro/historico de verdade
- [Phase ?]: Coluna fixa do Gantt via position:sticky dentro do unico container rolavel, nao dois containers sincronizados por scroll
- [Phase ?]: estado-vazio.tsx ganhou hrefBotao?: string aditivo — botao vira Link habilitado quando presente, mantem o disabled de sempre quando ausente
- [Phase ?]: 03-05: Switch/botao do ajuste rapido usam style inline (nao classe) para o alvo de toque de 44px — o Switch do shadcn tem data-[size=default] embutido, que vence qualquer classe solta por especificidade CSS
- [Phase ?]: 03-05: AlertDialogAction com event.preventDefault() + open/onOpenChange controlado é o padrao para dialogo que nao fecha ate a resposta do servidor — vale para qualquer acao destrutiva futura do projeto
- [Phase ?]: 03-05: D-06 (Gantt/lista so mostra rascunho/em_producao) provado com dado real pela primeira vez, ja que este plano criou os unicos caminhos de escrita que alcancam concluida/cancelada
- [Phase ?]: 03-06: FormularioEncomenda montado em page.tsx, nao em lista-encomendas.tsx — o vazio precisa abrir ?nova antes de existir qualquer encomenda
- [Phase ?]: 03-06: Dialog unico com conteudo responsivo por CSS em vez de Dialog+Sheet simultaneos — dois Root modais abertos ao mesmo tempo levam o proprio Radix a marcar ambos aria-hidden, provado por teste real
- [Phase ?]: 03-06: criarEncomenda migrado de (estadoAnterior, FormData) para (entradaBruta: unknown), mesmo formato das outras seis acoes; useActionState deixou de ser necessario

### Pending Todos

None yet.

### Blockers/Concerns

- M6 (Calculadora de Orçamento) permanece bloqueada até as planilhas de precificação do Theo existirem. Não afeta a Fase 7 (Polimento), que não depende de M6.
- Fonte de títulos (Vinila Condensed vs. Archivo Narrow) é decisão pendente do Theo — usar Archivo Narrow até lá (ver `04-DESIGN-SYSTEM.md`).
- Lista real de materiais do ateliê precisa ser levantada durante a Fase 6 (Estoque), senão o módulo nasce vazio.
- Pré-requisitos de conta (domínio, VPS Contabo, GitHub, armazenamento externo de backup) precisam existir antes de a Fase 1 poder começar de fato.
- Protecao da branch main (bloquear force-push e exclusao) pendente de configuracao manual pelo dono via GitHub Settings > Branches
- 01-05 Task 2 parcial: falta cadastrar NEXT_PUBLIC_SITE_URL e DEPLOY_ATIVO no repositorio GitHub, observar a primeira execucao real do workflow e provar o portao com um PR de teste quebrado — requer gh CLI/credenciais que a sessao de execucao nao tinha (ver 01-05-SUMMARY.md User Setup Required)
- callbackUrl do redirecionamento nao autenticado vaza https://0.0.0.0:3000 em vez do dominio publico (WINDOWS.md id 2, deferred-items.md da fase 02a) — bloqueia /gsd-ship ate resolvido ou dispensado; causa provavel em lib/auth/auth.config.ts/middleware.ts, fora do escopo do plano 02a-08
- tests/e2e/autenticacao.spec.ts:72 (sexta tentativa de bloqueio) trava/estoura timeout de forma pre-existente e independente da 02b-03 (confirmado via --grep-invert) — ver deferred-items.md da fase 02b item 1 e WINDOWS.md id 3; investigar pool do pg.Pool em db/index.ts ou UV_THREADPOOL_SIZE
- Verificacao humana de fim de fase (02b) pendente: 02b-VERIFICACAO-HUMANA.md — UI-05 (polegar em celular real), voz das frases D-05 (Agenda/Queimas/Estoque/Orcamentos) e olhada geral de cor/tipografia/legibilidade sob luz forte. Dono indisponivel no momento da execucao do 02b-05.

### Roadmap Evolution

- Phase 3 edited: ENC-14 (botao de imprimir folha A4) adicionado aos requisitos e criterios de sucesso

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Calculadora de Orçamento (M6) — ORC-01..05 | Bloqueado (planilhas de precificação) | Definição do roadmap |
| v2 | Financeiro da Escola — FIN-01, FIN-02 | Adiado conscientemente | Definição do roadmap |
| v2 | Integração Encomenda↔Queima (INT-01), Módulo Experiências (INT-02) | Adiado conscientemente | Definição do roadmap |

## Session Continuity

Last session: 2026-08-09T18:56:48.419Z
Stopped at: Completed 03-06-PLAN.md
Resume file: None
