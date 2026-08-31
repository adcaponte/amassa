---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 04.2
current_phase_name: abertura-do-espaco
status: complete
stopped_at: "Fase 4.2 COMPLETA e no ar. Migrações 0010/0011 aplicadas à mão em produção (2026-09-01), verificadas pelo psql; marcar e sair testados pelo dono no celular real. Próximo: Fase 6 (Estoque) — LEIA .planning/PROXIMA-SESSAO.md antes de qualquer comando: protótipo antes da execução, a pedido do dono."
last_updated: "2026-08-31T21:14:32.747Z"
last_activity: 2026-09-01
last_activity_desc: Fase 04.2 no ar em produção, verificada pelo dono
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 46
  completed_plans: 46
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05)

**Core value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.
**Current focus:** Phase 04.2 — abertura-do-espaco

## Current Position

Phase: 04.2 (abertura-do-espaco) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Server Action, rota `/abertura` e entrada no menu do usuário. Faltam 04.2-02 a 04.2-05
(tarefas, marcar/editar/remover, painel e visão por mês, migração de remoção).
Last activity: 2026-08-30 — Phase 04.2 execution started

Progress: [██████████] 100% (42 de 46 planos executados e verificados até aqui)

## Performance Metrics

**Velocity:**

- Total plans completed: 26
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 7 | - | - |
| 02a | 8 | - | - |
| 2b | 5 | - | - |
| 04.1 | 6 | - | - |

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
| Phase 03 P07 | ~65min | 3 tasks | 10 files |
| Phase 03 P08 | ~40min (agente) + execucao real em producao | 4 tasks | 20 files |
| Phase 04 P01 | ~55min | 3 tasks | 18 files |
| Phase 04 P02 | ~75min | 3 tasks | 12 files |
| Phase 04 P03 | ~50min | 3 tasks | 10 files |
| Phase 04 P04 | ~40min | 3 tasks | 10 files |
| Phase 04 P05 | ~2h10min | 3 tasks | 12 files |
| Phase 04 P06 | ~3h | 3 tasks | 16 files |
| Phase 04 P07 | ~5h (span) | 3 tasks | 8 files |
| Phase 04.1 P01 | 55min | 3 tasks | 17 files |
| Phase 04.1 P02 | ~45min | 3 tasks | 8 files |
| Phase 04.1 P03 | ~25min | 2 tasks | 4 files |
| Phase 04.1 P04 | ~15min (Tarefa 1) + execucao real da migracao pelo dono | 2 tasks | 4 files |
| Phase 04.1 P05 | ~15min | 2 tasks | 7 files |
| Phase 04.1 P06 | ~35min | 3 tasks | 8 files |
| Phase 4.2 P01 | 55min | 4 tasks | 22 files |
| Phase 04.2 P02 | 70min | 3 tasks | 14 files |
| Phase 04.2 P03 | ~3h | 3 tasks | 16 files |
| Phase 04.2 P04 | 1h10min | 3 tasks | 16 files |
| Phase 04.2 P05 | 100min | 2 tasks | 6 files |

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
- [Phase ?]: 03-07: filtros.ts é o quarto módulo puro sem import da fase — redeclara estruturalmente o Situacao de cronograma.ts (SituacaoDeUrgencia) em vez de import type, porque o grep de aceite exige zero linhas de import no arquivo
- [Phase ?]: 03-07: compararPorUrgencia usa um único número de proximidade por Situacao (atrasada mais negativo = mais urgente, marco=0, as três proximidades em dias, sem-próxima-etapa sempre no fim) — fórmula não especificada no plano, decisão do executor
- [Phase ?]: 03-07: estado-vazio.tsx ganhou aoClicar?: () => void aditivo (ação de cliente) ao lado de hrefBotao (navegação) — Limpar filtros usa aoClicar, Nova encomenda continua usando hrefBotao
- [Phase ?]: 03-07: e2e — page.waitForLoadState('networkidle') depois de navegar para uma rota antes de clicar num botão que acabou de aparecer, para evitar clique perdido por hidratação do React ainda não ter anexado o onClick (achado real, não suposição)
- [Phase ?]: 03-08: textoDaSituacao(semCor:true) reaproveitado verbatim na folha impressa, sem estender Situacao com campo etapa no ramo atrasada
- [Phase ?]: 03-08: listarEncomendasAtivas() e listarEncomendasDoIndice(hoje) compartilham anexarItensEEtapas (join), nunca o WHERE — escopos permanecem distintos
- [Phase ?]: 03-08: roteiro de migracao corrigido para 'docker compose run --rm ferramentas', nao 'docker compose exec app' — a imagem app nao tem drizzle-kit/tsx/db/
- [Phase ?]: 03-08: Fase 3 completa e migrada em producao (2026-08-10) — ENC-01 a ENC-14 entregues; verificacao humana de fim de fase PARCIAL (criacao+celular confirmados, 12 criterios nao percorridos item a item, ajustes de desktop mencionados sem detalhe, ver SUMMARY)
- [Phase ?]: 04-01: aplicar-no-fim-da-fase — migracao 0007/0008 gerada agora, aplicada em producao so no plano de fechamento 04-07, apos backup, a mao
- [Phase ?]: 04-01: consultas.ts devolve dado bruto (ocorrenciasDeQueima/ultimaManutencaoEm), nunca contador/total pre-agregados em SQL — cartao-forno.tsx chama medirForno() (lib/queimas/contador.ts), unico lugar que decide a regra
- [Phase ?]: 04-01: FOR-11 nao marcado completo apesar de listado no frontmatter do plano — so o cadastro (criarForno) foi entregue; desativar/reativar forno e escopo do plano 04-04
- [Phase ?]: 04-01: erro de FK (forno inexistente) traduzido via erro.code === '23503' (SQLSTATE foreign_key_violation) — primeira vez que o projeto checa codigo de erro do Postgres diretamente
- [Phase ?]: 04-02: fraseDoRodape recebe data ja formatada (nao timestamptz bruto) para preservar textos.ts nunca importar valor de formato.ts
- [Phase ?]: 04-02: queimas-cartao.spec.ts prova as tres fronteiras de FOR-04 com forno de limite 10 (piso Math.max(1,limite-10)=1), 10 registros reais em vez de 100
- [Phase ?]: 04-02: specs de Queimas ganharam retries:2 local + timeouts alargados — servidor Next unico compartilhado por todos os workers da suite, confirmado deterministico isolado (--workers=1)
- [Phase ?]: 04-03: buscarForno reaproveita a consulta de manutencoes (desc) para dois propositos — ultimaManutencao e o historico completo exibido
- [Phase ?]: 04-03: ocorrenciasDeQueima de buscarForno traz TODAS as queimas (sem limite) — so queimasRecentes e limitada a 25; medirForno precisa do total real
- [Phase ?]: 04-03: excluirQueima passou a revalidar tambem /queimas/[id], nao so /queimas — gap do plano 04-01 frente ao padrao ja documentado em 04-PATTERNS.md
- [Phase ?]: 04-03: historico-queimas.tsx virou client component (estado local de qual linha tem o dialog de exclusao aberto); historico-manutencoes.tsx continua Server Component
- [Phase ?]: registrarManutencao usa db.transaction + select...for update para serializar manutenções concorrentes; desativarForno/reativarForno filtram o WHERE pelo valor oposto de ativo em vez de checar-e-decidir
- [Phase ?]: lib/queimas/consultas.ts não precisou de mudança neste plano — FornoMedido/FornoComHistorico já expunham ativo desde 04-01/04-02
- [Phase ?]: 04-05: fraseDoBanner/prefixoDoBanner e ordenarParaBanner (lib/queimas/filtros.ts) sao o unico par que produz a copy do aviso agregado, reaproveitado pelo banner de /queimas e pelo cartao do painel inicial
- [Phase ?]: 04-05: CartaoPainel ganhou children opcional (aditivo) em vez de um segundo componente - os outros tres cartoes do painel nao mudaram de assinatura
- [Phase ?]: 04-05: scripts/testar-e2e.mjs passou a esperar conectividade TCP real na porta do Postgres de teste (nao so o Health.Status do Docker) apos ECONNREFUSED intermitente sob troca rapida de conteineres no Windows/WSL2
- [Phase ?]: recharts fixado em 3.10.1 (linha 3.x, não 2.x) apesar do Redux Toolkit transitivo — rota própria isola o peso do caminho de dois toques
- [Phase ?]: estatisticas-queimas.spec: teste de total GLOBAL roda só no projeto desktop (test.skip no celular), delta tolerante ao único escritor concorrente conhecido do arquivo
- [Phase ?]: 04-07: migração 0007_queimas/0008_gatilhos-queimas aplicada em producao e verificada no banco (pg_trigger, atualizado_em provado por edição real) — Tarefa 2 concluída
- [Phase ?]: 04-07: 04-VERIFICACAO-HUMANA.md produzido com 26 itens, todos em aberto — Tarefa 3 redefinida em tempo real para 'produzir, não completar' porque o dono estava indisponível (decisão do coordenador)
- [Phase ?]: 04-07: duas causas raiz de falha real de CI corrigidas (autenticacao.spec.ts sem testInfo.retry no e-mail de bloqueio; queimas-manutencao.spec.ts sincronizando por um valor que não muda) — confirmadas com --workers=2 e CI run #46 verde
- [Phase ?]: D-06 confirmado pelo humano (2026-08-21): substituir marcos_zero_ou_um por marcos_sempre_um_dia (dias=1 fixo nos tres marcos), nao apenas remover a restricao
- [Phase ?]: diasAteProxima de em-etapa-intervalo corrigido para contar ate o inicio da proxima faixa desenhada, nunca ate o fimExclusivo da atual (mentia quando havia vao de espera)
- [Phase ?]: 04.1-02: posicaoDeHojeNaTrilha passou a medir extensao de calendario (fimExclusivo da ultima faixa desenhada menos inicio da primeira), nao soma de duracoes - o 27o dia de uma encomenda de 32 dias caia num vao de espera e sumia com null
- [Phase ?]: 04.1-02: segmentosDaTrilha(faixas) novo em lib/encomendas/trilha.ts - geometria proporcional de etapas + vaos discriminada por tipo, consumida por trilha-segmentos.tsx sem nenhuma aritmetica de calendario no componente
- [Phase ?]: 04.1-02: vao do Gantt provado por medida de pixel (54px/90px/0px) em vez de inspecao visual - nenhuma linha de codigo nova em gantt.ts/gantt.tsx, confirmando D-09 (o vao sai de graca do deslocamento de inicio do plano 01)
- [Phase ?]: 04.1-02: corrigido bug latente do plano 01 - teste e2e da fronteira producao/secagem assumia producao com 3 dias (valor anterior a DIAS_PADRAO da fase 04.1); dataEmDias(-3) virou dataEmDias(-5), nao reverificado por e2e nesta sessao (fora do --grep desta tarefa), confirmado na varredura completa do plano 04.1-04
- [Phase ?]: ENC-03 reescrito, ENC-04 retirado (nao apagado) e ENC-15 criado em REQUIREMENTS.md; criterio de sucesso 3 da Fase 3 corrigido com nota apontando a Fase 04.1
- [Phase ?]: 02-MODELO-DE-DADOS.md e 00-BRIEFING.md nao mencionam mais marco como interruptor; DDL de encomenda_etapas espelha db/schema.ts
- [Phase ?]: Migracao 0009_espera-dos-marcos aplicada em producao (D-10 conferido, backup verificado, coluna/tres restricoes lidas do banco, insert invalido rejeitado) — fecha a Fase 04.1
- [Phase ?]: Esmaltacao mantida em 1 dia — pendencia nao bloqueante carregada para o dono decidir depois
- [Phase ?]: O caminhador de arvore sintatica decide pelo texto do no do topo da cadeia de chamadas, nunca sobre o arquivo inteiro — evita falso positivo de orderBy em outra consulta do mesmo arquivo.
- [Phase ?]: inverterOrdemFisicaDasEtapas usa delete+reinsert, nunca UPDATE — HOT update preservaria o ponteiro fisico e nao provaria a divergencia de ordem.
- [Phase ?]: duracaoTotalEmDias/dataDeConclusao invariantes a ordem sob as restricoes atuais foi documentado como acidente, nao garantia.
- [Phase ?]: 04.1-06: AjusteInvalido (molde de EncomendaNaoEncontrada) fecha o gap 17/CR-02 — teto de 365 dias devolve { ok: false, erro } em vez de exceção não tratada; try/catch/finally no cliente garante saída do estado pendente em todo caminho
- [Phase ?]: 04.1-06: WR-02 resolvido com região viva (aria-live=polite + sr-only) ao lado do número aria-hidden, não aria-label no span — anuncia valor atual e valor novo sem tocar em rótulo de botão já testado
- [Phase ?]: 04.1-06: roteiro de migração ganhou guarda que confere dias<>1 em linha de marco (WR-01); WR-03 (datas conflitantes em TrilhaEtapas) registrado como adiado em 04.1-CONTEXT.md, sem código, aguardando o dono
- [Phase ?]: D-19 consultada e confirmada (04.2-01): parcela cujo dia nao existe no mes seguinte cai no ultimo dia daquele mes; ja decidida pelo dono em 2026-08-30, sem novo portao
- [Phase ?]: 04.2-01: calcularParcelas usa soma por prefixo telescopico (nao total/n repetido) para a soma das parcelas fechar exata com o total mesmo em divisao nao exata
- [Phase ?]: T-04.2-07 verificado com a corrida real: gestor escolhido no formulário é desativado depois de escolhido e antes do envio, provando que o servidor decide no instante do salvamento, não o formulário.
- [Phase ?]: Contas de gestor DEDICADAS (nunca a global E2E_EMAIL_TESTE) para qualquer teste e2e que mute ativo — mesmo padrão de tests/e2e/sessao.spec.ts.
- [Phase ?]: Diálogo de remoção montado por LINHA (não por página), cada instância lendo o próprio useSearchParams() e abrindo só quando ?removerItem=<este id> bate — evita promover as listas inteiras a Client Component
- [Phase ?]: removerItemDeAbertura conta as tarefas ligadas DENTRO da mesma transação que apaga a linha, e nunca toca abertura_tarefas — quem solta é a restrição on delete set null da migração 0010
- [Phase ?]: CaixaMarcacao recebe o estado desejado, nunca inverter — duas chamadas com o mesmo valor convergem sempre, o que torna o salvamento otimista seguro sob concorrência (T-04.2-13)
- [Phase ?]: fluxoMensal e a fonte unica do fluxo mensal - resumoDoPainel e a aba Por mes leem dela, nunca uma segunda soma
- [Phase ?]: Empate no topo do pico marca TODOS os meses empatados (nunca so o primeiro), para o resultado nao depender da ordem de iteracao de um Map
- [Phase ?]: definirDataDeInauguracao usa insert...on conflict sobre a restricao de linha unica - nunca select seguido de insert/update
- [Phase ?]: Fase 4.2 fecha com a ressalva registrada: a suite e2e nao esta 100% verde (defeito de framework React/Next.js, mitigado nos fluxos criticos, tambem presente em Queimas/Encomendas).
- [Phase ?]: conferirRemocaoDoModuloAbertura semeia dado LIGADO (item_id nao nulo) antes do drop, provando a FK em uso, nao so linha solta.

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
- Dois gaps de infraestrutura abertos (WINDOWS.md ids 13, 14): pipeline nao puxa imagem :ferramentas no deploy; compose.yml do servidor nao e ressincronizado apos o Roteiro 1 — candidatos a fase futura de polimento de CI/roteiros
- Ajustes necessarios no desktop mencionados pelo dono apos a verificacao em producao (03-08), sem detalhamento — capturar no backlog em separado antes de assumir a experiencia desktop pronta
- ~~Verificação humana de fim de fase (04)~~ — **RESOLVIDO em 2026-08-11**: 26/26 percorridos (22 por transferência de evidência do UAT com rastro por item, 4 confirmados pelo dono numa resposta única). `04-VERIFICATION.md` passou a `passed`.
- Tela de login não distingue banco indisponível de credencial errada: com o Postgres fora do ar, responde "Confira o e-mail e a senha e tente de novo" e manda o gestor conferir uma senha que está certa. A mensagem anti-enumeração está funcionando como projetada; o problema é que ela também absorve falha de infraestrutura. Mesma família do G-04-5 (falha de infra vestida de erro do usuário). Achado durante a verificação do quick 260811-uiy; mexer nisso exige cuidado para não virar oráculo de contas.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260811-2jb | Avaliar retries e custo do teste de fronteira (04-02) | 2026-08-11 | 65ec17e | [260811-2jb-avaliar-retries-e-custo-do-teste-de-fron](./quick/260811-2jb-avaliar-retries-e-custo-do-teste-de-fron/) |
| 260811-uiy | Fronteira de erro global acima do layout de rota protegida (G-04-5) | 2026-08-11 | b5bf62b | [260811-uiy-fronteira-de-erro-global-acima-do-layout](./quick/260811-uiy-fronteira-de-erro-global-acima-do-layout/) |
| 260812-2et | BRIEF-NOTURNO: Lote A (Gantt clicável, eixo de tempo na barra do celular, timeline semanal desde hoje) + Lote C (tela de trocar senha) | 2026-08-12 | c3adfa2, aa5a720, bc0d790, b91accc | [260812-2et-executa-brief-noturno-lote-a-gantt-clica](./quick/260812-2et-executa-brief-noturno-lote-a-gantt-clica/) |
| 260820-uot | Fecha os gaps da Fase 3: interruptor dos marcos legivel, botao de voltar na encomenda e contagem de itens no indice | 2026-08-20 | 9a3beca, 274aa72, 0ff1b46 | [260820-uot-fechar-os-gaps-da-fase-3-interruptor-dos](./quick/260820-uot-fechar-os-gaps-da-fase-3-interruptor-dos/) |
| 260821-3af | Hachura de rascunho vira teste automatizado, fechando a verificacao manual C da Fase 3 | 2026-08-21 | 8446d48 | [260821-3af-hachura-de-rascunho-vira-teste-automatiz](./quick/260821-3af-hachura-de-rascunho-vira-teste-automatiz/) |

### Roadmap Evolution

- Phase 3 edited: ENC-14 (botao de imprimir folha A4) adicionado aos requisitos e criterios de sucesso
- Phase 3 edited: criterios 4 e 13 reconciliados com o quick 260812-2et (BRIEF-NOTURNO): Gantt passou de celulas quinzenais para semanais (segunda a domingo), a timeline deixou de abrir centralizada para abrir em hoje na borda esquerda, e o nome da encomenda virou link. Supersessao deliberada, nao regressao — os 18px/dia do 03-UI-SPEC.md continuam valendo
- Phase 04.1 inserted after Phase 4: Datas dos Marcos da Encomenda — nasceu da caminhada humana do dono, reabre ENC-03, precisa de migracao. Executa antes da Fase 5 (URGENT)
- Phase 04.2 inserted after Phase 04.1: Abertura do Espaço — módulo TEMPORÁRIO (data de morte, ABE-15) para organizar a abertura do novo espaço do ateliê; protótipo validado com o dono em cinco rodadas antes do planejamento. Ordem de execução revista: 4.2 → 6 (Estoque) → 5 (Agenda) → 7 (Polimento), por decisão do dono em 2026-08-22

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Calculadora de Orçamento (M6) — ORC-01..05 | Bloqueado (planilhas de precificação) | Definição do roadmap |
| v2 | Financeiro da Escola — FIN-01, FIN-02 | Adiado conscientemente | Definição do roadmap |
| v2 | Integração Encomenda↔Queima (INT-01), Módulo Experiências (INT-02) | Adiado conscientemente | Definição do roadmap |
| Produto | Encomenda "rascunho" não é alcançável pela interface — só por SQL direto. Decidir se deve existir um caminho na UI ou se o status rascunho sai do produto | Pergunta aberta | Fase 3, verificação humana |
| Produto | Os tres marcos SEMPRE acontecem — o interruptor liga/desliga nunca foi o modelo certo. Queima de biscoito nao precisa de interruptor (a duracao da secagem ja a posiciona); queima de esmalte e entrega precisam de QUANDO, porque nao vem logo apos a etapa anterior. E o nucleo do lote de datas; repensar o modelo de marco antes de virar plano | Pergunta aberta — reabre ENC-03 | Fase 3, segunda rodada 2026-08-20 |
| Tecnico | router.refresh() e um canal com perda (~6% medido): a resposta chega 200 e a arvore nunca e aplicada. Outros DEZ pontos de chamada carregam a mesma exposicao — o mais gemeo e confirmar-cancelar.tsx, mesma tela e mesma transicao final; o caminho de cancelar ainda nao tem trava de estado confirmado | Aberto — merece plano proprio | Debug refresh-nao-chega-no-celular, 2026-08-21 |
| Tecnico | staleTimes.dynamic: 0 provoca tempestade de prefetch, custando servidor e dados moveis sem beneficio. Achado de carona na mesma sessao | Aberto | Debug refresh-nao-chega-no-celular, 2026-08-21 |
| Produto | Depois de concluir ou cancelar, os ajustes rapidos das seis etapas continuam ativos: mexer num deles faz o rodape mostrar uma Conclusao prevista nova enquanto a linha de situacao mantem a data gravada — duas datas na mesma tela. DONO DECIDIU DEIXAR COMO ESTA (2026-08-21), para nao perder a chance de corrigir duracao depois de fechar | Divida conhecida, aceita | Debug refresh-nao-chega-no-celular, 2026-08-21 |

## Session Continuity

Last session: 2026-08-31T21:14:32.694Z
Stopped at: Completed 04.2-05-PLAN.md (Tarefas 1-2; Tarefa 3 e checkpoint humano pendente)
Resume file: None
