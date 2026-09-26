---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 04.4
current_phase_name: Financeiro — parte 1
status: executing
stopped_at: "04.4-13: Tarefas 1-3 concluidas (aviso acima da barra, etiqueta de desconto, total em Todas, ajuste fino da grade/Despesa); parado na Tarefa 4, checkpoint do dono - ultima porta da Fase 04.4"
last_updated: "2026-09-26T13:40:00.000Z"
last_activity: 2026-09-26
last_activity_desc: "tarefa rápida 260926-qpv: remove o atalho 'Pagar conta que já existe' da Despesa (decisão do dono)"
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 64
  completed_plans: 64
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05)

**Core value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.
**Current focus:** Phase 04.4 — Financeiro — parte 1

## Current Position

Phase: 04.4 (Financeiro — parte 1) — EXECUTING (executa antes das Fases 5 e 6 — ordem completa no
ROADMAP.md, §Overview)
Plan: 13 planos — 01 a 10 completos; no 11, Tarefas 1-3 concluídas (Roteiro 10, verificação humana
escrita, varredura completa, e a migração aplicada em produção pelo dono); no 12, Tarefas 1-3
concluídas (as duas mudanças pedidas pelo dono em 20/09); no 13, Tarefas 1-3 concluídas (os quatro
achados da conferência do dono em 26/09 — aviso acima da barra, etiqueta de desconto, total em
"Todas", ajuste fino da grade de parcelas/Despesa). A Tarefa 4 de cada um desses três planos é
`checkpoint:human-verify` do dono — a Seção E (itens 20-23) de `04.4-VERIFICACAO-HUMANA.md` é a
ÚLTIMA da lista (agora com 23 itens); percorrida, ela fecha a Fase 04.4.
Status: Em andamento, com o dono presente. Código no ar desde o deploy de 20/09; migrações
0014/0015/0016 aplicadas e conferidas (evidência no 04.4-11-SUMMARY.md); as 8 suposições foram
respondidas (04.4-VERIFICACAO-HUMANA.md).

O QUE FALTA PARA FECHAR A 04.4:

  1. **Plano 04.4-12** (do dono, 20/09): "à vista" passa a poder nascer NÃO paga (boleto único a
     pagar depois), e "Gerar as contas" ganha seletor de mês (adiantar dezembro/janeiro).

  2. **Conferência humana** — os itens restantes de `04.4-VERIFICACAO-HUMANA.md` no celular e no
     computador. Já provado em produção: venda de R$ 1,00 com pagamento em DUAS formas, lançada e
     cancelada, riscando as duas entradas.

  3. ~~**Deploy bloqueado por falha de acessibilidade**~~ — **RESOLVIDO no código local (quick
     260920-wcg)**: o CI (run 35508463753) reprovou "E2E contra a imagem real" em
     `/cadastros?sub=fixas` (contraste 2.99:1 numa conta fixa desativada), pulando GHCR publish e
     o deploy — o código da 04.4-12 nunca chegou a produção. Causa raiz corrigida (não um ajuste
     de cor: a técnica de `opacity` sobre texto secundário), e o mesmo achado eliminado em mais
     oito componentes. Falta só o `git push` (não dado por esta tarefa) para o CI reprocessar.

VARREDURA DO E2E — NÃO ESTÁ 100% VERDE: 580 passaram, 2 falharam. As duas são a "sexta tentativa
de bloqueio" de `tests/e2e/autenticacao.spec.ts` (limite de tentativas de login), defeito
pré-existente da Fase 02b, aberto em WINDOWS #3 desde 08/2026 e sem relação com o Financeiro.
Nenhum teste do Financeiro falhou.

DECIDIDO SEM O THEO (revisar; detalhe em cada SUMMARY, seção "Decidido sem o Theo"):

  - 04.4-06: "+ outra forma" divide meio a meio e escolhe automaticamente uma segunda forma
    diferente da primeira; `BlocoPagamento` recebe `hoje`/`dataSaldoInicial` para validar parcela
    paga no futuro.

  - 04.4-08: texto das frases de recusa do Desfazer e de data inválida; `formatarInstanteCurto`
    para `cancelado_em` no fuso de Brasília; duas instâncias do diálogo de documento.

  - 04.4-09: nove meses reservados de uma vez, com 3 meses de distância entre eles, para os testes
    não disputarem totais; total filtrado do extrato pode ser nulo.

  - 04.4-10: dois formatos de nome de mês (título x botão); `avisoDaUrl` passa a receber objeto;
    valor da conta fixa exibido com separador de milhar.

  - 04.4-11: pílulas de filtro do extrato usam `aria-current` em vez de `aria-pressed` (única
    correção de produto do plano — `aria-pressed` não é válido em link).

  - 04.4-05 e 04.4-07: detalhes de mensagem e de estrutura de tela, sem efeito em regra de dinheiro.

TAREFA SEPARADA, FORA DESTA FASE (chip criado): o Drizzle embrulha o erro do Postgres, e as
mensagens humanas de "chave estrangeira" não aparecem em Abertura, Comparador e Queimas — os três
já estão no ar.
  → FEITO em 20/09 pela tarefa rápida 260920-dx9 (mergeada em `main`, commit `d98b2c6`). Detector
    extraído para `lib/erro/postgres.ts` e aplicado em Abertura/Cotações/Queimas, com par RED/GREEN
    de e2e provando as frases humanas.
  → FECHADO em 20/09 pela tarefa rápida 260920-fk9: os dois consumidores deixados de propósito por
    aquele plano — `lib/financeiro/acoes.ts` e `lib/cadastros/acoes.ts` — agora importam do mesmo
    detector compartilhado. Prova e2e nova cobrindo o Financeiro (Despesa "outra"), com uma
    descoberta real: `lancarVenda`/`lancarDespesa` fazem pré-conferência da categoria antes do
    `insert` (diferente dos outros três módulos), então a prova exigiu simular a corrida
    select-antes-do-insert com uma transação de teste presa (sem commit), não só apagar a linha
    antes do envio. Zero duplicata de leitor de SQLSTATE no repositório agora. Detalhes em
    `.planning/quick/260920-fk9-*/260920-fk9-SUMMARY.md`.
Last activity: 2026-09-20 — tarefa rápida 260920-jxb: connectionTimeoutMillis no pool do
Postgres corrigido; teste e2e de bloqueio revertido após achado de módulo não-compartilhado
entre rota REST e Server Action (WINDOWS #34, aberto) — Fase 04.4 segue aguardando o dono

Progress: [██████████] 100% (64 de 64 planos; 04.4-11/12/13 contam como automatizáveis
concluídos, migração (04.4-11) e verificação humana (04.4-11/12/13, itens 20-23) pendentes do
dono — a última porta da Fase 04.4)

## Performance Metrics

**Velocity:**

- Total plans completed: 31
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 7 | - | - |
| 02a | 8 | - | - |
| 2b | 5 | - | - |
| 04.1 | 6 | - | - |
| 04.3 | 5 | - | - |

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
| Phase 04.3 P01 | ~65min | 3 tasks | 33 files |
| Phase 04.3 P02 | ~70min | 3 tasks | 16 files |
| Phase 04.3 P03 | ~2h | 3 tasks | 14 files |
| Phase 04.3 P04 | ~2h | 3 tasks | 14 files |
| Phase 04.3 P05 | ~3h35min | 3 tasks | 9 files |
| Phase 04.4 P01 | ~2h40min | 4 tasks | 34 files |
| Phase 04.4 P02 | ~1h10min | 3 tasks | 28 files |
| Phase 04.4 P03 | ~50min | 3 tasks | 22 files |
| Phase 04.4 P04 | ~50min | 3 tasks | 7 files |
| Phase 04.4 P05 | ~2h | 2 tasks | 14 files |
| Phase 04.4 P06 | ~1h20min | 2 tasks | 16 files |
| Phase 04.4 P07 | ~1h40min | 2 tasks | 14 files |
| Phase 04.4 P08 | ~2h50min | 3 tasks | 18 files |
| Phase 04.4 P09 | ~3h20min | 3 tasks | 17 files |
| Phase 04.4 P10 | ~30min | 2 tasks | 14 files |
| Phase 04.4 P11 | ~2h30min | 2 tasks | 6 files |
| Phase 04.4 P12 | ~2h15min | 3 tasks | 19 files |
| Phase 04.4 P13 | ~2h30min | 3 tasks | 22 files |

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
- [Phase ?]: 04.3-01: shadcn CLI 3.8.5 (textarea/checkbox) importa cn de pacote npm de terceiro em vez de @/lib/utils — corrigido, dependencia revertida
- [Phase ?]: 04.3-01: pilula 'editar categoria' (D-15) nao construida no plano 01 — sem Server Action de update/delete; registrado em WINDOWS.md #28 para plano seguinte
- [Phase ?]: 04.3-02: canal local abrirCategoriaParaEditar no abridor de cotacoes - history.pushState nao busca dado novo do servidor, achado real pelo e2e
- [Phase ?]: 04.3-02: Excluir categoria troca categoriaDialogo por categoriaRemover na URL (Dialog e AlertDialog nunca abertos ao mesmo tempo)
- [Phase ?]: 04.3-03: atualizarCotacao/removerCotacao nunca apagam e recriam a linha; categoriaId nunca entra no UPDATE embora o esquema o exija por composicao
- [Phase ?]: 04.3-03: botao de remover de cotacao nao usa canal local no abridor (ao contrario do de editar) - confirmacao acha a linha na lista ja carregada, so a presenca de ?cotacaoRemover= na URL importa
- [Phase ?]: 04.3-03: LinhaCotacao/CartaoCotacao extraidos de lista-cotacoes.tsx, com o icone TriangleAlert (D-12) visivel antes do nome da empresa quando ha alertas
- [Phase ?]: 04.3-04: ordenarCotacoes generalizada (T extends CotacaoParaOrdenar) para devolver o tipo completo de Cotacao, sem segunda passagem de dados
- [Phase ?]: 04.3-04: CamposLongos compartilhado por DetalheCotacao e ComparacaoCotacoes - um so lugar para o rotulo/tratamento de alerta dos seis campos longos
- [Phase ?]: 04.3-04: MarcarCotacao usa zona de toque REAL de 44x44 (span externo) + hit-slop maior no Checkbox, nunca so um hit-slop invisivel
- [Phase ?]: 04.3-05: migracoes 0012/0013 aplicadas em producao pelo dono em 2026-09-18 (Roteiro 9); passo 4 do roteiro corrigido antes (0c690d4, sintaxe \gset invalida em psql -c); evidencia colada para tabelas/gatilhos/enum/privilegios/restricao, backup pos-deploy e residuo relatados sem saida colada (lacuna registrada no SUMMARY)
- [Phase ?]: 04.4-01: numeração de documentos = opção A (sequência única venda+despesa), decisão do dono na Tarefa 0 (checkpoint pré-respondido)
- [Phase ?]: 04.4-01: textoVendaLancada recebe o total já formatado (string), nunca centavos — textos.ts nunca importa formato.ts (mesma disciplina de lib/queimas/textos.ts)
- [Phase ?]: 04.4-01: DialogoValorLivre sem aria-label redundante no DialogContent — colidia com getByLabel('Valor') do Playwright via o aria-labelledby automático do Radix ("Valor livre" contém "Valor")
- [Phase ?]: 04.4-02: ITENS_NAVEGACAO dividido em ITENS_NAVEGACAO_CELULAR (5, Financeiro no lugar do Estoque)/ITENS_NAVEGACAO_LATERAL (6, ganhou o Financeiro) — D-04/D-05
- [Phase ?]: 04.4-02: AbasFinanceiro virou Client Component (usePathname) para saber se está em /cadastros; memo com comparador próprio sobre (aba, emCadastros)
- [Phase ?]: 04.4-02: lib/cadastros/categorias.ts nem import de tipo (grep de aceite do plano) — enums grupo/área redeclarados como literais, não importados de db/schema.ts
- [Phase ?]: 04.4-02: codigoDoErroPostgres() em lib/cadastros/acoes.ts olha erro.code E erro.cause.code — drizzle-orm/node-postgres embrulha o SQLSTATE real em .cause; mesmo padrão quebrado suspeito em ehViolacaoDeChaveEstrangeira de outros módulos, não corrigido (fora do escopo)
- [Phase ?]: 04.4-03: repartirDesconto (D-09/D-10) chamada idêntica no cliente e no servidor — piso inteiro, sobra na maior linha (empate: a primeira), recusa de repartição impossível
- [Phase ?]: 04.4-03: efeitoNoEstoque faz toda conta em milésimos inteiros (nunca ponto flutuante acumulado) — contrato estável que a Fase 6 troca de mostrar para gravar
- [Phase ?]: 04.4-03: DialogoValorLivre agrupa por GRUPO (Receitas/Fora do resultado), não por área — evita esconder a distinção sob o rótulo 'Geral' compartilhado
- [Phase ?]: 04.4-03: lancarVenda resolve item de catálogo no servidor (descrição/categoria/existência nunca vêm do cliente); mudar preço depois não reescreve venda já lançada
- [Phase ?]: 04.4-04: parcelasInteirasDoItem chama calcularParcelas e só acrescenta arredondamento de prefixo em centavos inteiros — lib/abertura/parcelas.ts continua a fonte única da data/valor de cada parcela
- [Phase ?]: 04.4-04: a data do documento importado é a da COMPRA (item.primeiraParcelaEm original), nunca a da primeira parcela ainda em aberto — suposição 2 do plano
- [Phase ?]: 04.4-04: lib/virada/ é o único módulo fora de lib/abertura que importa lib/abertura/parcelas.ts, por caminho relativo — sai junto com o código da Abertura (Roteiro 8), só depois de o Roteiro 11 já ter rodado
- [Phase ?]: 04.4-05: esquemaItem/esquemaEdicaoDeItem viram fábricas (recebem o mapa de insumos) — validarItem precisa desse retrato do banco, que só existe depois de uma leitura
- [Phase ?]: 04.4-05: podeDeixarDeTerEstoque roda ANTES da regra estrutural genérica (cliente e servidor) — quando as duas seriam verdade ao mesmo tempo, 'esse item é insumo de X' é a frase mais acionável
- [Phase ?]: 04.4-05: FichaTecnica sempre visível no diálogo do item, independente de 'Tem estoque próprio' — a ficha pertence ao item vendido, não ao insumo
- [Phase ?]: 04.4-06: gerarPlano usa divisão inteira (floor) com o resto do arredondamento na PRIMEIRA parcela (Nx) e metade arredondada para cima na primeira (sinal) — diferente do prefixo telescópico de lib/abertura/parcelas.ts, por exigência explícita do must_have da fase
- [Phase ?]: 04.4-06: BlocoPagamento decide só rótulos e o aviso do cartão (tipo venda|despesa); o painel hospedeiro chama gerarPlano/dividirEmDuasFormas e guarda o estado — mesmo componente para Venda e Despesa (plano 07)
- [Phase ?]: 04.4-06: conferirParcelas chamada duas vezes do lado do cliente (BlocoPagamento para mostrar, painel-venda.tsx para gatear o botão) — duplicação deliberada de função pura, exigida pelo grep de aceite do plano
- [Phase ?]: 04.4-07: GradeCatalogo/ListaCompleta generalizados com uma prop 'modo' (venda|compra) via generics — o mesmo componente, painel-venda.tsx continua sem mudança
- [Phase ?]: 04.4-07: categoria de compra nunca conferida quanto a 'ativa' em lancarDespesa (só controlaEstoque do item) — só a categoria de 'outra despesa' recusa quando desativada, como o must_have pede
- [Phase ?]: 04.4-07: lancarDespesa nunca grava taxaPontosBase, mesmo com forma 'cartao' — despesa no cartão entra pelo valor cheio
- [Phase ?]: 04.4-08: planejarDesfazer decide por temLinhaDeDiferenca + previsto/pago, nunca recontando linhas/parcelas isoladamente — a decisão vem do que aconteceu, não de uma nova contagem
- [Phase ?]: 04.4-08: ordem fixa de trava (documento primeiro, parcela depois) repetida em cancelarDocumento/registrarPagamento/desfazerPagamento — evita deadlock entre qualquer par delas
- [Phase ?]: 04.4-08: formatarInstanteCurto (novo, lib/financeiro/formato.ts) formata timestamptz com fuso America/Sao_Paulo explícito — nunca confundir com formatarDataCurta (dia civil puro)
- [Phase ?]: 04.4-09: resumoDoMes cobre a linha de diferença (D-02) sem caso especial — a categoria 'Juros, multas e descontos' já nasce grupo geral
- [Phase ?]: 04.4-09: filtrarExtrato nunca recalcula saldoDepoisCentavos (D-12) — recebe as linhas já com o saldo global de montarExtrato
- [Phase ?]: 04.4-09: mes-reservado.ts com nove meses espaçados de 3 em 3 — o mês anterior de qualquer chave é garantidamente vazio sob desktop/celular em paralelo
- [Phase ?]: 04.4-09: e2e do extrato compara saldo depois por diferença RELATIVA entre linhas, não valor absoluto entre leituras — saldo depois é acumulado global (D-12), vulnerável ao próprio projeto irmão em comparações absolutas
- [Phase ?]: 04.4-10: contas-fixas.ts com formato próprio de mês curto (janeiro/2027) para o título gerado, distinto de nomeDoMes (janeiro de 2027) do rótulo/aviso — os dois exemplos do plano usam grafias diferentes
- [Phase ?]: 04.4-10: avisoDaUrl (lib/cadastros/avisos.ts) migrado de string para objeto {aviso,quantidade,mes} para caber o aviso contas-geradas — teste unitário existente atualizado, não deixado quebrado
- [Phase ?]: 04.4-10: gerarContasDoMes idempotente por insert...on conflict(conta_fixa_id, mes_referencia) do nothing dentro de uma transação — o banco decide, nunca uma leitura prévia de já existe?
- [Phase ?]: 04.4-11: Roteiro 10 e verificação humana produzidos (Tarefas 1-2); Tarefas 3 (migração em produção) e 4 (verificação humana) pendentes do dono — checkpoints não resolvidos por regra do projeto
- [Phase ?]: pagaAVista/pagas movidos para o módulo puro lib/financeiro/parcelas.ts (não a tela) porque o painel regenera o plano do zero a cada mudança de carrinho/data/plano
- [Phase ?]: mesPermitidoParaGeracao(hoje, mes) substitui a igualdade fixa com o mês seguinte — a única porta que o servidor usa para aceitar um mês em gerarContasDoMes
- [Phase ?]: vencimentoAvistaAberto (estado próprio do painel) preserva a data Vence em através da regeneração do plano — achado necessário pelo próprio caso de e2e do plano (Rule 1, corrigido antes do commit)
- [Phase ?]: 04.4-13: token unico --deslocamento-aviso deriva o deslocamento do toast da altura real da barra, lido pelas duas portas do sonner (offset/mobileOffset), trocando de valor no breakpoint md (768px) para cobrir a faixa 601-767px
- [Phase ?]: 04.4-13: etiqueta do carrinho separa TEXTO por motivo - tabela R$ X so para preco editado, - R$ X de desconto para qualquer linha atingida pelo desconto (item comum, valor na hora, valor livre)
- [Phase ?]: 04.4-13: filtrarExtrato soma sempre (tipo deixa de aceitar null); a politica de esconder a linha do total quando nao ha movimento passou para a tela

### Pending Todos

None yet.

### Blockers/Concerns

- **04.4-11 bloqueado na Tarefa 3 (checkpoint:human-action, `gate="blocking"`) — migração 0014/0015/0016 em produção.** O dono precisa abrir a sessão SSH, dizer "pode enviar" (para os commits desta fase serem enviados e o pipeline publicar), e seguir `docs/operacao/10-migracao-financeiro.md` do passo 1 ao 5. A Tarefa 4 (verificação humana, `04.4-VERIFICACAO-HUMANA.md`, 17 itens + 8 perguntas do planejador) segue depois. Só então a Fase 04.4 fecha de fato.
- M6 (Calculadora de Orçamento) permanece bloqueada até as planilhas de precificação do Theo existirem. Não afeta a Fase 7 (Polimento), que não depende de M6.
- Fonte de títulos (Vinila Condensed vs. Archivo Narrow) é decisão pendente do Theo — usar Archivo Narrow até lá (ver `04-DESIGN-SYSTEM.md`).
- Lista real de materiais do ateliê precisa ser levantada durante a Fase 6 (Estoque), senão o módulo nasce vazio.
- Pré-requisitos de conta (domínio, VPS Contabo, GitHub, armazenamento externo de backup) precisam existir antes de a Fase 1 poder começar de fato.
- Protecao da branch main (bloquear force-push e exclusao) pendente de configuracao manual pelo dono via GitHub Settings > Branches
- 01-05 Task 2 parcial: falta cadastrar NEXT_PUBLIC_SITE_URL e DEPLOY_ATIVO no repositorio GitHub, observar a primeira execucao real do workflow e provar o portao com um PR de teste quebrado — requer gh CLI/credenciais que a sessao de execucao nao tinha (ver 01-05-SUMMARY.md User Setup Required)
- callbackUrl do redirecionamento nao autenticado vaza https://0.0.0.0:3000 em vez do dominio publico (WINDOWS.md id 2, deferred-items.md da fase 02a) — bloqueia /gsd-ship ate resolvido ou dispensado; causa provavel em lib/auth/auth.config.ts/middleware.ts, fora do escopo do plano 02a-08
- tests/e2e/autenticacao.spec.ts:72 (sexta tentativa de bloqueio) trava/estoura timeout de forma pre-existente e independente da 02b-03 — WINDOWS.md id 3 continua aberto, mas o diagnostico avançou (quick 260920-jxb, .planning/debug/auth-bloqueio-timeout-e2e.md): hipotese do custo do argon2id REFUTADA por medicao; connectionTimeoutMillis (hipotese lider) corrigido em db/index.ts (5s, testado), mas a falha intermitente original nunca foi reproduzida localmente para fechar o ciclo RED/GREEN. WINDOWS.md id 34 (novo, aberto): o contador de tentativas em memoria nao e compartilhado entre a rota REST do Auth.js e a Server Action de login nesta build (Next.js 16.3.5 + Turbopack + output standalone) — investigacao propria necessaria antes de tentar de novo encurtar este teste.
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
| 6 | callbackUrl do login apontava para 0.0.0.0:3000; AUTH_URL com padrao no compose.yml (d9fdc2b), conferido em producao | 2026-09-17 | d9fdc2b | — |
| 7 | Roteiro 9: corrige o teste de restrição do passo 4 (\\gset em psql -c dava syntax error) e acrescenta 'Quando rodar' — commit 0c690d4 | 2026-09-18 | 0c690d4 | — |
| 8 | Caixinha de marcar para comparar sem fundo terracota (CR-01 do 04.3-REVIEW): data-checked -> data-[state=checked] em components/ui/checkbox.tsx, medido na build de producao — commit 2e33c5f | 2026-09-18 | 2e33c5f | — |
| 9 | casca.spec.ts:124 contava aria-current na página inteira; em /queimas o submenu também marca — conta só no menu principal (reprovação do pipeline 35432168671 após Next 16) | 2026-09-19 | e7aecb7 | — |
| 10 | Fecha a sessão de debug e2e-toque-nao-navega-ci após conferência do dono no celular; WINDOWS #12 #29 #30 #31 corrigidos | 2026-09-19 | 8666291 | — |
| 260919-e4n | Cartões do painel da Abertura por aba: Comprometido e Sai neste mês só em Por mês; Precisa de atenção só em Itens; nenhum em Tarefas e Cotações | 2026-09-19 | cefee93 | [260919-e4n-cartoes-do-painel-da-abertura-por-aba](./quick/260919-e4n-cartoes-do-painel-da-abertura-por-aba/) |
| 260919-ou8 | Ignorar `Claude outputs/` e versionar o protótipo aprovado do Estoque | 2026-09-19 | 93ef4e2 | [260919-ou8-gitignore-claude-outputs-e-prototipo-do-](./quick/260919-ou8-gitignore-claude-outputs-e-prototipo-do-/) |
| 260920-dx9 | Detectar SQLSTATE embrulhado pelo Drizzle em Abertura, Cotações e Queimas — a mensagem humana de chave estrangeira voltou a aparecer nos três módulos em produção | 2026-09-20 | 6288f67, b23b81e, fcbb3c3, 865e338, cc399ae | [260920-dx9-detectar-sqlstate-embrulhado-pelo-drizzl](./quick/260920-dx9-detectar-sqlstate-embrulhado-pelo-drizzl/) |
| 260920-fk9 | Unificar o detector de SQLSTATE em Financeiro e Cadastros (pendência do 260920-dx9) — os dois módulos passam a importar de lib/erro/postgres.ts, prova e2e nova cobrindo a corrida real do Financeiro com par RED/GREEN | 2026-09-20 | 638d372, c19126b, 035c570 | [260920-fk9-detector-sqlstate-financeiro-e-cadastr](./quick/260920-fk9-detector-sqlstate-financeiro-e-cadastr/) |
| 260920-wcg | Corrige a violação de contraste AA (axe-core) que barrou o deploy da fase 04.4-12: `opacity-70` diluía `--color-tinta-fraca` para 2.99:1 numa conta fixa desativada — causa raiz é a técnica (composição alfa sobre texto), não o token; corrigido o mesmo padrão em mais oito componentes (Categorias, Cotações, Queimas, Abertura), com par RED/GREEN provado por axe | 2026-09-20 | 48a8676, cf4a94d, 4e22cf6, a492da8 | [260920-wcg-contraste-aa-conta-fixa-desativada](./quick/260920-wcg-contraste-aa-conta-fixa-desativada/) |
| 260920-jxb | connectionTimeoutMillis=5000 no pool do pg (db/index.ts, com teste de regressão) — corrige o risco real de espera infinita apontado pelo debug de auth-bloqueio-timeout-e2e.md; a segunda mudança aprovada (semear tentativas via API) foi revertida ao descobrir que a rota REST e a Server Action não compartilham o contador de tentativas em memória nesta build (achado novo, WINDOWS #34) | 2026-09-20 | c7b13e1 | [260920-jxb-aplicar-timeout-do-pool-de-conexoes-do-b](./quick/260920-jxb-aplicar-timeout-do-pool-de-conexoes-do-b/) |
| 260926-ijl | Corrige o toast do sonner sem fundo (transparente sobre os cartões do Caixa, achado do dono fotografado em 26/09/2026): as quatro variáveis CSS (--normal-bg/-text/-border, --border-radius) apontavam para nomes inexistentes neste projeto; remapeadas para os tokens reais (--color-popover/-popover-foreground/-border, --radius-xl), cn-toast (classe morta) removida, com par RED/GREEN provando a asserção de fundo opaco em tests/e2e/financeiro-caixa.spec.ts | 2026-09-26 | 22166e8, ef898ee | [260926-ijl-toast-do-sonner-sem-fundo-transparente-s](./quick/260926-ijl-toast-do-sonner-sem-fundo-transparente-s/) |
| 260926-qpv | Remove o atalho "Pagar conta que já existe" da Despesa (decisão do dono, 26/09/2026, depois de usar o módulo no celular: o botão pareceu inútil e grande) — a Despesa fica com as duas escolhas de verdade (Compra de material/Outra despesa); BRIEFING.md, REQUIREMENTS.md (FNC-06), 04.4-UI-SPEC.md e 04.4-CONTEXT.md registram a decisão datada e a consequência (pagar uma conta existente passa a ser só por Caixa → "A pagar" → "Paguei") | 2026-09-26 | 366cfcd, 64f6b46 | [260926-qpv-remove-atalho-pagar-conta-da-despesa](./quick/260926-qpv-remove-atalho-pagar-conta-da-despesa/) |

### Roadmap Evolution

- Phase 3 edited: ENC-14 (botao de imprimir folha A4) adicionado aos requisitos e criterios de sucesso
- Phase 3 edited: criterios 4 e 13 reconciliados com o quick 260812-2et (BRIEF-NOTURNO): Gantt passou de celulas quinzenais para semanais (segunda a domingo), a timeline deixou de abrir centralizada para abrir em hoje na borda esquerda, e o nome da encomenda virou link. Supersessao deliberada, nao regressao — os 18px/dia do 03-UI-SPEC.md continuam valendo
- Phase 04.1 inserted after Phase 4: Datas dos Marcos da Encomenda — nasceu da caminhada humana do dono, reabre ENC-03, precisa de migracao. Executa antes da Fase 5 (URGENT)
- Phase 04.2 inserted after Phase 04.1: Abertura do Espaço — módulo TEMPORÁRIO (data de morte, ABE-15) para organizar a abertura do novo espaço do ateliê; protótipo validado com o dono em cinco rodadas antes do planejamento. Ordem de execução revista: 4.2 → 6 (Estoque) → 5 (Agenda) → 7 (Polimento), por decisão do dono em 2026-08-22
- Phase 04.3 inserted after Phase 4.2: Comparador de Compras — aba do módulo Abertura para comparar cotações lado a lado; protótipo do dono é a especificação; preço numérico, independente dos itens, sem mudança de permissão (URGENT)
- Phase 04.4 inserted after Phase 04.3: Financeiro — parte 1: Venda, Compra, Caixa, Mês e Cadastros. Revisão do projeto de 2026-09-19: executa antes das Fases 5 e 6; Estoque deixa de ser a próxima (URGENT)

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

Last session: 2026-09-26T11:46:31.130Z
Stopped at: 04.4-13: Tarefas 1-3 concluidas (aviso acima da barra, etiqueta de desconto, total em Todas, ajuste fino da grade/Despesa); parado na Tarefa 4, checkpoint do dono - ultima porta da Fase 04.4
Resume file: None
