---
schema_version: 1
open_count: 30
waived_count: 1
fixed_count: 31
total_count: 62
last_updated: 2026-09-30T11:44:34.384Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01-funda-o-e-primeiro-deploy | deviation | README.md |  | Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md | open |  | 2026-08-06T17:44:26.584Z |  |
| 2 | 02a-login-banco-base-e-backup | deviation | middleware.ts |  | callbackUrl do redirecionamento nao autenticado vaza o endereco interno do container (https://0.0.0.0:3000/...) em vez do dominio publico — confirmado de fora em producao (curl -I https://amassacerrado.com.br/encomendas). O cookie __Secure-authjs.callback-url resolve o dominio certo, mas o parametro de query da Location nao. Descoberto durante a verificacao externa do plano 02a-08 (Tarefa 3); fora do escopo de arquivos deste plano (nao toca middleware.ts nem lib/auth/) — precisa de investigacao dedicada em auth.config.ts / trustHost do Auth.js v5 | fixed |  | 2026-08-08T14:39:57.410Z | 2026-09-17T17:38:56.775Z |
| 3 | 02b | deviation | tests/e2e/autenticacao.spec.ts | 72 | Sexta tentativa de bloqueio trava/estoura timeout de forma pre-existente (confirmado via --grep-invert, independente da 02b-03) — ver deferred-items.md item 1 | open |  | 2026-08-08T18:37:46.938Z |  |
| 4 | 03 | deviation | .planning/phases/03-gestor-de-encomendas/deferred-items.md |  | shadcn 'form' registry item (radix-nova style, CLI 3.8.5) has no files to install; plan 06 must decide field vs hand-rolled wrapper vs direct react-hook-form before building the full formulario | fixed |  | 2026-08-09T14:15:31.870Z | 2026-08-09T18:53:21.639Z |
| 5 | 03 | deviation | tests/e2e/encomendas-indice.spec.ts |  | Teste 'com o banco vazio, a frase A roda ainda nao gira aparece uma unica vez' (ENC-13) so e confiavel quando rodado com --grep 'indice de encomendas' (comando de verificacao literal da Tarefa 3). No npm run test:e2e completo sem grep, outro arquivo de spec (encomendas.spec.ts) roda em paralelo e pode criar uma encomenda antes da asserção — limitação estrutural da suite (sem isolamento de banco por teste), nao um defeito do EstadoVazio/hrefBotao. | fixed |  | 2026-08-09T16:31:43.430Z | 2026-08-10T18:51:44.328Z |
| 6 | 03-gestor-de-encomendas | deviation | components/amassa/cabecalho-pagina.tsx |  | O <h1> do cabecalho de pagina (CabecalhoPagina) nao quebra em linha para um titulo muito comprido sem espaco (ex.: nome de encomenda de 120 caracteres colados) — causa rolagem horizontal da PAGINA inteira (nao dos dois alert-dialog de 03-05, que ja tem overflow-wrap:anywhere e foram provados por e2e). Descoberto durante 03-05 (pagina de detalhe usa o nome da encomenda como titulo); fora do escopo de arquivos deste plano (componente compartilhado da 2b). Precisa de break-words/overflow-wrap no h1 de cabecalho-pagina.tsx, revisavel numa fase futura de polimento. | open |  | 2026-08-09T17:35:18.070Z |  |
| 7 | 03-gestor-de-encomendas | unrun-verify | tests/e2e/encomendas-detalhe.spec.ts |  | E5 detalhe — vazio (backstop do plano 03-05): a trilha nunca deveria mostrar uma encomenda sem item (esquemaEncomenda exige >=1), mas isso depende do formulario recusar 0 itens (plano 06, ainda nao existe UI para isso) — nao verificado a mao nesta execucao; conferir quando o formulario de edicao de itens existir. | fixed |  | 2026-08-09T17:35:32.827Z | 2026-08-09T18:53:26.159Z |
| 8 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/confirmar-cancelar.tsx |  | E8 confirmar cancelar — erro (backstop do plano 03-05): o AlertDialog deve permanecer aberto mostrando o texto de falha sem fechar sozinho quando cancelarEncomenda falha; caminho implementado (estado erro + onOpenChange bloqueado por enviando) mas nao ha teste automatizado nem verificacao manual do caminho de falha nesta execucao (dificil de simular falha de rede/servidor de forma confiavel em e2e local). | open |  | 2026-08-09T17:35:33.701Z |  |
| 9 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/confirmar-excluir.tsx |  | E9 confirmar excluir — erro (backstop do plano 03-05): mesma situacao de E8 aplicada a excluirEncomenda — caminho implementado, sem prova automatizada nem verificacao manual do caminho de falha nesta execucao. | open |  | 2026-08-09T17:35:34.500Z |  |
| 10 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/lista-itens.tsx |  | E11 reordenacao — carregando (backstop do plano 03-06): a seta clicada fica com opacidade reduzida e disabled (par inteiro) ate a resposta do servidor, o que deveria impedir que dois cliques rapidos na mesma seta gravem fora de ordem; nao verificado a mao nem com teste automatizado de concorrencia real nesta execucao (dificil simular corrida de rede confiavel em e2e local). | open |  | 2026-08-09T18:53:37.603Z |  |
| 11 | 03-gestor-de-encomendas | deviation | tests/e2e/encomendas-impressao.spec.ts |  | Teste 'sem nenhuma encomenda ativa' (folha de impressao) so e confiavel isolado (--grep impressao de encomendas); sob --grep encomenda/suite completa, outros specs criam encomendas em paralelo e o teste falha por contagem global nao-zero. Mesma classe estrutural de WINDOWS #5 (sem isolamento de banco por teste). | fixed |  | 2026-08-09T20:57:04.606Z | 2026-08-10T18:51:44.807Z |
| 12 | 03-gestor-de-encomendas | deviation | tests/e2e/sessao.spec.ts | 110 | 'depois de sair o botao de voltar cai em /login' falhou uma vez (celular) sob a concorrencia da varredura completa (npm run test:e2e sem grep, 8 workers) — timing de navegacao apos logout, nao reproduziu em execucao isolada nem em runs seguintes da mesma varredura. Arquivo da fase 02a, fora do escopo de arquivos do plano 03-08; achado durante a varredura completa que este plano e dono de executar (03-08-PLAN.md full_sweep_responsibility). | fixed |  | 2026-08-09T20:57:11.541Z | 2026-09-19T09:09:19.931Z |
| 13 | 03-gestor-de-encomendas | deviation | .github/workflows/entrega.yml |  | O passo 'implantar' do pipeline faz docker compose pull app + up -d app, mas nunca faz pull da imagem :ferramentas (usada para migrar e criar/redefinir usuario). docker compose run usa o cache local, entao apos um deploy o servidor pode rodar a imagem ferramentas de uma fase anterior por ate a proxima vez que alguem rodar 'docker compose pull ferramentas' a mao. Descoberto na execucao do roteiro 04 (migracao de producao da Fase 3): o servidor rodou meia hora com a imagem da Fase 2a antes do pull manual (passo 2 do roteiro) pegar. Os roteiros de docs/operacao/ ja incluem o pull manual como salvaguarda; o gap e o pipeline nao fazer isso sozinho. | fixed |  | 2026-08-10T19:55:19.553Z | 2026-08-10T20:08:36.048Z |
| 14 | 03-gestor-de-encomendas | deviation | docker/compose.yml |  | O compose.yml do servidor e copiado por scp no Roteiro 1 e nenhum roteiro posterior nem o pipeline o atualizam depois disso — ele pode divergir do docker/compose.yml versionado no repositorio. Descoberto na execucao do roteiro 04: DATABASE_URL_MIGRACAO entrou no compose.yml no commit e593e83 (plano 02a-02, depois da copia inicial), entao o servico ferramentas do servidor ainda lia DATABASE_URL (que aponta para amassa_app, sem privilegio de DDL) e a migracao falhou com 'permission denied for database amassa' (42501) ate o dono copiar o compose.yml atual para o servidor a mao. Nenhum roteiro de docs/operacao/ inclui um passo de 'sincronize o compose.yml antes de migrar' — candidato a um passo novo numa fase de polimento. | fixed |  | 2026-08-10T19:55:19.982Z | 2026-08-10T20:08:36.522Z |
| 15 | 04 | unrun-verify | components/amassa/queimas/medidor.tsx |  | Posição visual em pixels dos entalhes/marca do limiar não medida por teste automatizado — verificação humana pendente para 04-07 | open |  | 2026-08-11T00:10:18.811Z |  |
| 16 | 04 | unrun-verify | app/(app)/queimas/error.tsx |  | error.tsx não foi exercitado por um erro real forçado em teste e2e — verificação funcional pendente para 04-07 | open |  | 2026-08-11T00:10:19.316Z |  |
| 17 | 04 | unrun-verify | app/(app)/page.tsx |  | Ramo de erro de fornosQuePrecisamDeAtencao() no painel inicial (EstadoErro dentro do CartaoPainel) so provado por revisao de codigo, sem teste e2e forcando falha real | open |  | 2026-08-11T01:30:30.547Z |  |
| 18 | 04 | unrun-verify | components/amassa/queimas/banner-atencao.tsx |  | E5 long-text (UI-SPEC backstop): altura previsivel do banner com 3 fornos de nomes de 80 caracteres + 'e mais 2' em viewport de celular estreito, nunca checada visualmente | open |  | 2026-08-11T01:30:31.078Z |  |
| 19 | 04 | unrun-verify | app/(app)/queimas/relatorios/page.tsx |  | D-08: estado vazio de /queimas/relatorios (nenhuma queima registrada) provado só por revisão de código — o e2e desta tarefa foi construído 'sem etiqueta de vazio' por escopo do plano 04-06 | open |  | 2026-08-11T02:09:34.019Z |  |
| 20 | 04 | unrun-verify | components/amassa/queimas/relatorios-recharts.tsx |  | D-07: ordem visual das 4 estatísticas antes dos gráficos no celular e o 'mesmo recorte de dados' nos dois tamanhos de tela garantidos por código, nunca checados com screenshot | open |  | 2026-08-11T02:09:34.524Z |  |
| 21 | 04 | deviation | tests/e2e/encomendas-detalhe.spec.ts | 657 | 'concluir uma encomenda cuja data já passou... mostra Concluída em ao atualizar' (celular) flaky sob a varredura completa (npm run test:e2e sem grep, CI run #45 e localmente): botão some / texto 'Concluída em' aparece via router.refresh() após concluirEncomenda, com toHaveCount/toContainText já polling 10s — passou na retentativa sem mudança de código, mesma classe de contenção de servidor Next único compartilhado já registrada em WINDOWS #12 (sessao.spec.ts). Arquivo da Fase 3, fora do escopo de arquivos do plano 04-07; não é um defeito óbvio e pequeno (diferente do achado real em queimas-manutencao.spec.ts, corrigido nesta mesma execução) — não modificado aqui. | open |  | 2026-08-11T06:04:00.822Z |  |
| 22 | 04 | deviation | tests/e2e/encomendas-impressao.spec.ts | 155 | 'só rascunho e em_producao aparecem — concluída e cancelada nunca' (celular) falhou uma vez sob npm run test:e2e --workers=2 (concorrência representativa de CI): linha-impressao-{idConcluida} ainda visível em /encomendas/imprimir depois de o botão 'Marcar como concluída' já ter sumido na página de detalhe (confirmando status=concluida commitado) e um page.goto novo para a rota de impressão. Sinal real (não é o mesmo defeito de 'valor que não muda' já corrigido em queimas-manutencao.spec.ts nesta execução) — não reproduziu em runs anteriores nem depois; mesma classe de contenção de servidor Next único sob carga, ainda sem causa raiz pequena e óbvia. Arquivo da Fase 3, fora do escopo de arquivos do plano 04-07. | open |  | 2026-08-11T06:26:32.166Z |  |
| 23 | 04 | deviation | app/(app)/layout.tsx | 15 | Falha em exigirUsuario() no layout de rota protegida cai na tela padrão do Next.js ("Application error: a server-side exception has occurred"), não num estado de erro em linguagem humana. No App Router, error.tsx NÃO captura erro do layout do PRÓPRIO segmento: app/(app)/error.tsx é irmão do layout que falha, e não existe app/error.tsx nem app/global-error.tsx acima dele. Atinge TODA rota autenticada (Encomendas, Agenda, Fornos, Estoque, Orçamentos), não só Fornos. Achado no UAT da Fase 4 (teste 5, gap G-04-5) derrubando o Postgres local. As fronteiras de PÁGINA estão provadas funcionando (teste 13, método cirúrgico: renomear só a tabela fornos). Defeito pré-existente — layout é da Fase 2b. Decisão do dono no fechamento do UAT: corrigir como tarefa própria, fora da Fase 4. Corrigido pelo quick task 260811-uiy: app/error.tsx (fronteira acima do layout de (app)) e app/global-error.tsx (último recurso, prova estrutural — não observável em next dev). Prova COMPORTAMENTAL com o Postgres local parado NÃO pôde ser executada de forma automatizada nesta sessão (E2E_EMAIL_TESTE/E2E_SENHA_TESTE não definidos em .env.local para login manual fora do pipeline de teste); escalada ao roteiro manual do dono, registrado em 260811-uiy-SUMMARY.md. | fixed |  | 2026-08-11T20:55:00.000Z | 2026-08-11T21:15:34.000Z |
| 24 | 04.2 | deviation | tests/e2e/autenticacao.spec.ts | 84 | Sexta tentativa de bloqueio (limite de tentativas) falhou em desktop e celular na varredura completa sem --grep desta fase (4 failed/382 passed/33 skipped/1 did not run) -- arquivo da Fase 02b, fora do escopo de arquivos do plano 04.2-05, mesma classe ja registrada em WINDOWS #3 para este arquivo. | fixed |  | 2026-08-31T21:11:52.752Z | 2026-08-31T23:32:07.157Z |
| 25 | 04.2 | deviation | tests/e2e/abertura-edicao.spec.ts | 234 | 'editar uma tarefa preserva o vinculo dela com o item' falha intermitente, so no celular, na varredura completa -- o equivalente para ITEM (linha 165) passa nos dois viewports. Mesma classe do defeito de framework documentado em .planning/debug/abertura-navegacao-trava.md (payload RSC do FormularioTarefa em modo edicao); nao corrigido nesta execucao (orcamento de sessao de depuracao ja esgotado nesta fase). | fixed |  | 2026-08-31T21:11:53.253Z | 2026-08-31T23:32:07.674Z |
| 26 | 04.2 | deviation | tests/e2e/queimas-registro.spec.ts | 84 | ACHADO QUE ULTRAPASSA A FASE: 'Desfazer' remove a queima recem-registrada -- falhou numa das varreduras completas de 04.2. Usa router.refresh() apos a Server Action (mesmo padrao de components/amassa/queimas/registrar-queima.tsx), o MESMO canal com perda ja diagnosticado em .planning/debug/abertura-navegacao-trava.md (confirmado tambem para components/amassa/encomendas/trilha-etapas.tsx, ja anotado ali como 'canal com perda', ver WINDOWS #12/#21/#22). Queimas e Encomendas usam o mesmo padrao router.refresh() e tem menos testes batendo nele que Abertura tinha. Nao corrigido nesta execucao -- fora do escopo de arquivos do plano 04.2-05 (nenhum arquivo de Queimas/Encomendas foi tocado). | open |  | 2026-08-31T21:12:06.353Z |  |
| 27 | 04.2 | deviation | components/amassa/abertura/data-inauguracao.tsx | 79 | DataInauguracao.salvar() ainda chama router.refresh() apos definirDataDeInauguracao, ao contrario de formulario-item.tsx/formulario-tarefa.tsx/confirmar-remover-item.tsx/confirmar-remover-tarefa.tsx (todos migrados para navegacao completa nesta mesma fase para escapar do canal-com-perda documentado em .planning/debug/abertura-navegacao-trava.md). Risco: o toast de sucesso pode aparecer enquanto a contagem regressiva/data exibida no cabecalho fica com o valor antigo, na mesma taxa de falha (~54-70%) medida para a marcacao. Descoberto na conferencia lado a lado do plano 04.2-05 (Tarefa 2); nao corrigido nesta execucao porque o arquivo nao esta no escopo de arquivos do plano e a correcao (navegacao completa) implica uma terceira perda declarada (o toast de sucesso da data) que precisa de decisao do dono, nao so troca de codigo. | fixed |  | 2026-08-31T21:12:06.799Z | 2026-08-31T23:32:08.168Z |
| 28 | 04.3 | deviation | components/amassa/cotacoes/sub-abas-categorias.tsx |  | Pílula 'editar categoria' (renomear/excluir, D-15) não implementada nesta tarefa — sem Server Action de update/delete de categoria no plano 01; a pílula de nova categoria funciona, a de editar fica para plano seguinte da fase. | waived | Escopo da onda 2: o plano 04.3-02 ja cobre renomear e remover categoria com confirmacao (D-15). Nao e debito. | 2026-09-17T19:30:34.969Z | 2026-09-17T19:34:05.445Z |
| 29 | 04.3 | deviation | tests/e2e/cotacoes-categorias.spec.ts | 94 | Falha intermitente sob a varredura completa (npm run test:e2e sem --grep): pilulaA.click() as vezes nao navega (URL/categoria nunca troca), entao as duas cotacoes criadas em seguida vao para a categoria ainda ativa em vez de A, e a contagem da pilula A fica 0 contra 0 linhas (nao e discrepancia de dado, e o clique que nao comitou). Mesma classe do defeito de framework documentado em .planning/debug/abertura-navegacao-trava.md (React/Next as vezes nao comita o startTransition de um <Link> RSC sob carga). Reexecucao isolada (npm run test:e2e -- --grep "cotacoes categorias\|cotacoes tracador") passou 36/36 nos dois projetos, confirmando flakiness, nao regressao deterministica. Nao corrigido nesta execucao: a mitigacao (navegacao completa em vez de <Link> RSC) contraria a decisao explicita do UI-SPEC de usar <Link> normal para troca de categoria (nao history.pushState), e reescrever o padrao de navegacao de leitura e mudanca arquitetural fora do escopo de arquivos do plano 04.3-05. | fixed |  | 2026-09-18T18:22:36.267Z | 2026-09-19T09:09:20.336Z |
| 30 | 04.3 | deviation | tests/e2e/cotacoes-tracador.spec.ts | 44 | Falha intermitente sob a varredura completa: clicar na aba 'Cotacoes' (<Link> RSC, abas-abertura.tsx) as vezes nao navega para ?aba=cotacoes dentro do timeout padrao de 5s (URL fica em /abertura). Mesma classe do defeito de framework documentado em .planning/debug/abertura-navegacao-trava.md. Reexecucao isolada (--grep "cotacoes categorias\|cotacoes tracador") passou 36/36 nos dois projetos (incluindo este teste), confirmando flakiness sob carga da suite completa, nao regressao deterministica. Nao corrigido nesta execucao pelo mesmo motivo do achado irmao em cotacoes-categorias.spec.ts:94. | fixed |  | 2026-09-18T18:22:36.736Z | 2026-09-19T09:09:20.752Z |
| 31 | 04.3 | deviation | tests/e2e/abertura-edicao.spec.ts | 165 | 'editar um item com tarefa ligada atualiza a linha e preserva o vinculo' (celular) falhou na varredura completa desta fase -- mesma classe ja registrada para a variante 'tarefa' (WINDOWS #25, fechado em 04.2), agora atingindo a variante ITEM tambem, sob a carga da suite inteira (490+ testes). Arquivo da Fase 4.2, fora do escopo de arquivos do plano 04.3-05; achado durante a varredura completa que este plano e dono de executar (04.3-05-PLAN.md, Tarefa 2). | fixed |  | 2026-09-18T18:22:37.243Z | 2026-09-19T09:09:21.148Z |
| 32 | 04.4-financeiro-parte-1 | deviation | tests/e2e/financeiro-extrato.spec.ts | 212 | 'navega por mes, filtra por forma, mantem o saldo global, e mostra os dois vazios' (desktop) falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers locais): getByTestId('extrato-linha') veio 0 em vez de 5 apos clicar em 'mes seguinte'. Reexecucao isolada (--grep 'financeiro extrato') passou 32/32 nos dois projetos (incluindo este teste), confirmando flakiness sob carga da suite completa, nao regressao deterministica -- mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#29/#30/#31. Achado incidentalmente ao provar a correcao da fuga de dado do teste 04.4-11 (script/testar-migracoes.mjs); nao corrigido nesta execucao, fora do escopo de arquivos da correcao (nenhuma logica de extrato foi tocada). | open |  | 2026-09-20T09:24:14.442Z |  |
| 33 | quick-260920-jxb | deviation | db/index.ts |  | WINDOWS #3/#24 diagnostico atualizado (ver .planning/debug/auth-bloqueio-timeout-e2e.md, 2026-09-20): hipotese do custo do argon2id foi MEDIDA e REFUTADA (25-150ms/tentativa). Hipotese lider, nao confirmada por reproducao direta (3 tentativas honestas falharam), era connectionTimeoutMillis ausente no pool pg (espera infinita). Corrigido aqui: connectionTimeoutMillis=5000 em db/index.ts, com teste de regressao (tests/unit/pool-conexao.test.ts) e caminho de falha documentado (cai na mesma mensagem humana via AuthError, nunca stack crua). #24 foi marcado 'fixed' em 2026-08-31 (fase 04.2) SEM nenhuma mudanca de codigo relacionada -- esta e a primeira correcao real do problema estrutural que #3/#24 descrevem. #3 permanece OPEN porque a Tarefa 2 deste quick task (semear tentativas via API para encurtar o teste) foi revertida -- ver entrada irma sobre o bug de duplicacao de modulo descoberto -- entao o ciclo RED/GREEN provando o fim da falha intermitente original nao fechou. | fixed |  | 2026-09-20T13:48:00.596Z | 2026-09-20T13:48:07.409Z |
| 34 | quick-260920-jxb | deviation | lib/auth/tentativas-memoria.ts |  | ACHADO NOVO, fora do escopo desta tarefa: o contador de tentativas em memoria (lib/auth/tentativas-memoria.ts) NAO parece ser um singleton verdadeiro entre a rota REST do Auth.js (app/api/auth/[...nextauth]/route.ts, POST /api/auth/callback/credentials) e a Server Action de login (lib/auth/acoes.ts, entrar() -> signIn() server-side) nesta build (Next.js 16.3.5 + Turbopack, output: standalone). Confirmado empiricamente: 5 POSTs reais e corretos contra a rota REST (GET /api/auth/csrf + POST /api/auth/callback/credentials, protocolo padrao do Auth.js, cada um retornando code=credentials como esperado) NAO bloqueiam a 6a tentativa feita pela Server Action via UI real (continua mostrando a mensagem generica de credencial invalida, nao a de bloqueio) -- mesmo com um servidor 'next start' recem-construido, sem processo travado, e mesmo com curl provando que 5 POSTs + um 6o POST, TODOS pela MESMA rota REST, bloqueiam corretamente entre si. Isso e a MESMA classe de suspeita ja registrada (nao confirmada) no debug auth-bloqueio-timeout-e2e.md para o pool de conexao do Postgres ('pools de conexao podem nao ser verdadeiramente compartilhados entre diferentes rotas/Server Actions nesta build') -- agora CONFIRMADA para um modulo diferente (o contador de tentativas). Por causa disso, a Tarefa 2 deste quick task (semear as 5 primeiras tentativas de tests/e2e/autenticacao.spec.ts via a rota REST, mantendo a 6a pela UI real) foi revertida sem aplicar -- nao ha caminho honesto de semear via HTTP que compartilhe estado com a Server Action nesta build, e o unico substituto seria reproduzir o protocolo interno de Server Actions do Next.js (header Next-Action com id derivado do build), que e exatamente o tipo de hack fragil que a tarefa pediu para evitar. Merece investigacao propria (Turbopack chunk splitting de modulos compartilhados sob output: standalone) antes de qualquer nova tentativa de encurtar este teste. | open |  | 2026-09-20T13:48:30.734Z |  |
| 35 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-tracador.spec.ts | 63 | 'a 320px, a aba nao rola na horizontal e as sete pilulas do Financeiro estao em duas fileiras' (desktop e celular) falhou sob a carga de 8 workers (npm run test:e2e --grep 'orcamentos tracador'): boundingBox() de financeiro-aba-venda/financeiro-aba-orcamentos veio null nos dois, junto de varios 'The destination stream closed early' no log do servidor Next. Reexecucao isolada (--grep 'estao em duas fileiras' --workers=1) passou 32/32 (todos os specs da cadeia, incluindo este), confirmando flakiness sob contencao do servidor unico, nao regressao deterministica -- mesma classe ja registrada em WINDOWS #12/#21/#22/#29/#30/#31/#32. Nao corrigido nesta execucao: nao ha causa raiz pequena e obvia neste arquivo (o teste em si nao muta estado nem depende de outro spec). | open |  | 2026-09-26T17:04:40.752Z |  |
| 36 | 04.5-financeiro-parte-2 | deviation | lib/precificacao/textos.ts | 183 | A frase que recusa apagar uma peca em uso usa o plural preguicoso: 'Esta peca esta em 1 orcamento(s). Nao da para apagar.' Com uma ocorrencia so, le mal. A regra do CLAUDE.md pede erro em linguagem humana, e o resto do projeto ja trata plural direito. Correcao de duas linhas (singular/plural por contagem), deixada fora do plano 05 de proposito para nao editar trabalho ja commitado no meio da execucao da fase. Achado pelo orquestrador ao conferir D-20 depois do plano 05. | fixed |  | 2026-09-26T20:08:12.449Z | 2026-09-26T21:05:11.553Z |
| 37 | 04.5-financeiro-parte-2 | unrun-verify | components/amassa/orcamentos/cabecalho-do-orcamento.tsx |  | O bloco 'Para quem e para quando' fora de rascunho (leitura simples, sem controle de edicao) esta implementado mas sem prova automatizada: nenhum plano ate agora move um orcamento para fora de status rascunho (a acao 'Marcar como enviado' e de um plano futuro). Conferir quando essa transicao existir. | fixed |  | 2026-09-26T20:55:15.622Z | 2026-09-26T22:29:49.043Z |
| 38 | 04.5 | deviation | lib/orcamentos/acoes.ts |  | Acceptance script da Tarefa 2 (04.5-07-PLAN.md) procura 'function exigirRascunho'; a guarda real, reaproveitada do plano 06, chama-se travarOrcamentoRascunho (1 ocorrencia, 9 chamadores) — intent satisfeito, nome do script desatualizado \|\| FECHADA em 28/09/2026, sem alteracao de codigo: conferido — a guarda real travarOrcamentoRascunho existe em lib/orcamentos/acoes.ts (13 ocorrencias). O codigo sempre esteve certo; so o nome no script de aceitacao do plano estava desatualizado. O plano ja foi executado: o script e artefato historico, nao se reescreve. | fixed |  | 2026-09-26T21:48:07.443Z | 2026-09-28T00:02:26.665Z |
| 39 | 04.5 | deviation | components/amassa/orcamentos/escolher-peca.tsx |  | Acceptance script da Tarefa 3 (04.5-07-PLAN.md) acusa 'router.push\|router.refresh' em orcamentos/ — e um COMENTARIO (plano 06) explicando por que o componente NAO usa router.refresh(), nao uma chamada real; nenhum router. de verdade no modulo \|\| FECHADA em 28/09/2026, sem alteracao de codigo: conferido — grep por router.push\|router.refresh em components/amassa/orcamentos/ nao acha nenhuma chamada real, so o comentario que explica por que o componente NAO usa router.refresh(). O script de aceitacao casou com o comentario. | fixed |  | 2026-09-26T21:48:07.985Z | 2026-09-28T00:02:26.665Z |
| 40 | 04.5 | deviation | lib/orcamentos/acoes.ts |  | Acceptance script da Tarefa 2 (04.5-08-PLAN.md, checagem 'for update' via new RegExp com barras invertidas quadruplas) quebra ao atravessar plano->bash->JS->RegExp: o padrao vira [sS]*?\\n} (nunca casa nada), confirmado testando contra acrescentarLinha (funcao correta desde o plano 06). Reescrevendo o mesmo regex sem a camada extra de escape, as quatro transicoes (marcarComoEnviado/recusarOrcamento/voltarParaRascunho/duplicarOrcamento) confirmam for update antes do fechamento -- intent satisfeito, escape do script quebrado \|\| FECHADA em 28/09/2026, sem alteracao de codigo: conferido — for update aparece 18 vezes em lib/orcamentos/acoes.ts. A guarda existe; o que quebrou foi a RegExp do script ao atravessar plano->bash->JS. Mesmo caso do #38: plano executado, script e historico. | fixed |  | 2026-09-26T22:29:11.144Z | 2026-09-28T00:02:26.665Z |
| 41 | 04.5-financeiro-parte-2 | unrun-verify | tests/e2e/orcamentos-ciclo.spec.ts | 161 | D-21 diz que, depois de congelado, mudar um PARAMETRO OU UMA FICHA nao altera o orcamento. O teste (3) prova a metade do parametro, e prova bem: congela, muda um parametro dedicado, e total/minimo/painel inteiro continuam byte a byte iguais — com o caso de controle (um rascunho novo com a mesma receita ja usa o valor novo), que descarta o falso positivo de 'nada recalcula'. A metade da FICHA nao tem teste. Argumento estrutural a favor, conferido pelo orquestrador: existe o invariante de banco (status='rascunho') = (snapshot is null), e lerDoSnapshot e a UNICA porta de leitura dos numeros congelados — entao uma mudanca de ficha atravessaria exatamente a mesma porta que o teste do parametro ja exercita. Isso e argumento, nao prova. Fechar com um teste que edita a ficha de uma peca ja usada num orcamento enviado, ou conferir a mao na verificacao humana. | fixed |  | 2026-09-26T22:33:28.372Z | 2026-09-27T13:53:12.441Z |
| 42 | 04.5-financeiro-parte-2 | skipped-test | tests/e2e/orcamentos-revisao.spec.ts |  | (f) 'num orcamento aprovado o botao Atualizar precos nao existe' fica test.skip: nao existe, nesta fase, nenhum caminho pela UI para aprovar um orcamento (Cliente aprovou e do plano 12 e continua desabilitado). Verificado por leitura de codigo (editor-orcamento.tsx: o guarda 'status !== aprovado' envolve o dialogo inteiro); reabrir quando o plano 12 existir. | open |  | 2026-09-26T23:12:42.378Z |  |
| 43 | 04.5-financeiro-parte-2 | deviation | .planning/REQUIREMENTS.md |  | Tabela de rastreabilidade (linha ~447/450) mostra ORC-07/ORC-10 como 'Pending' apesar de 04.5-07-SUMMARY.md/04.5-08-SUMMARY.md listarem os dois em requirements-completed -- gap pre-existente, nao introduzido nem corrigido pelo plano 09 (fora do escopo de arquivos); so ORC-09 (deste plano) foi corrigido para Complete. \|\| FECHADA em 28/09/2026, sem alteracao de codigo: ja nao reproduz — a tabela de rastreabilidade do REQUIREMENTS.md mostra ORC-07 e ORC-10 como Complete (linhas 543 e 546). Corrigido em algum plano posterior ao registro; a janela ficou aberta a toa. | fixed |  | 2026-09-26T23:18:22.102Z | 2026-09-28T00:02:26.665Z |
| 44 | 04.5-financeiro-parte-2 | deviation | db/migrations/0019_parametros-iniciais.sql | 20 | A semente de parametros_precificacao usa vigente_desde = current_date do Postgres (UTC, sem TZ definida no contêiner), enquanto a leitura em lib/precificacao/consultas.ts::parametrosVigentes usa hojeEmBrasilia (America/Sao_Paulo, UTC-3). Entre 21:00 e 23:59:59 BRT (00:00-02:59:59 UTC do dia seguinte), current_date ja avancou um dia mas hojeEmBrasilia ainda esta no dia anterior — a query 'vigente_desde <= hoje' nao acha nenhum parametro, e toda tela que depende de parametrosVigentes (Pecas, editor de Orcamento) mostra 'Nao deu para carregar os parametros'. Reproduzido de forma deterministica (workers=1, isolado por --grep) as 00:08-00:31 UTC de 2026-09-27, tanto em precificacao-pecas.spec.ts @vazio-global quanto no editor de orcamentos. Fora do escopo de arquivos do plano 04.5-10 (fotos) — achado ao depurar o e2e orcamentos-fotos, nao corrigido aqui. | fixed |  | 2026-09-27T00:33:48.319Z | 2026-09-27T04:11:14.798Z |
| 45 | 04.5-financeiro-parte-2 | unrun-verify | tests/e2e/orcamentos-pdf.spec.ts |  | Paridade de conteudo (caso b) e acentuacao (caso c) do PDF gerado nao sao lidas do ARQUIVO final: pdfjs-dist (a biblioteca de extracao de texto oferecida no checkpoint da Tarefa 1) nao foi instalada porque a resposta do dono confirma tres pacotes para a fase inteira e nao confirma explicitamente essa quarta -- na duvida, o executor nao supoe autorizacao. Cobertura real: teste unitario de estrutura (orcamentos-documento-cliente.test.ts) prova que tela e PDF leem do MESMO DocumentoDoCliente, e o e2e confere o arquivo baixado por assinatura/tamanho/Content-Disposition, nunca o texto interno. Verificacao humana pendente para o plano 13: abrir o PDF de um orcamento com 'Jose Conceicao' e conferir visualmente os acentos. | open |  | 2026-09-27T01:29:07.118Z |  |
| 46 | 04.5-financeiro-parte-2 | unrun-verify | lib/orcamentos/pdf/documento.tsx |  | A ausencia de custo/minimo/margem/hora no PDF (caso d, D-24/D-29) e provada por CONSTRUCAO -- DocumentoDoCliente nao tem esses campos (teste unitario varre por nome de chave), documento.tsx so consome esse tipo (acceptance_criteria confere por grep que nao ha chamada a contasDoOrcamento/resultadoDaFicha/calcularPeca) -- mas nenhum teste le o BYTE do PDF final procurando esses numeros, porque pdfjs-dist nao foi instalado (ver entrada irma sobre paridade/acentuacao). Verificacao humana pendente para o plano 13. | open |  | 2026-09-27T01:29:16.936Z |  |
| 47 | 04.5-financeiro-parte-2 | deviation | tests/e2e/cadastros-contas-fixas.spec.ts | 201 | cria, desativa, gera duas vezes sem duplicar... falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): locator.click no botao Desfazer estourou 30s. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35 -- arquivo da Fase 04.4, fora do escopo de arquivos do plano 04.5-13; nao corrigido (sem causa raiz pequena e obvia). \|\| NOTA de 28/09/2026: esta janela e a #58 descrevem O MESMO teste, na MESMA linha (cadastros-contas-fixas.spec.ts:201), com veredito oposto — a #47 diz que passou isolada, a #58 diz que falhou isolada tambem. E o CI do commit e0a0290 passou verde em 27/09 as 19h31. Os tres nao podem estar certos ao mesmo tempo. Resolver junto, nao separado. \|\| RESOLVIDA a contradicao em 28/09/2026, com medicao: reexecucao isolada (npm run test:e2e --workers=1 --grep) FALHOU. A #58 esta certa e esta janela esta errada — o que a #47 registrou como "passou isolada" nao reproduz. Tratar como duplicata da #58 e resolver la. | fixed |  | 2026-09-27T03:28:00.123Z | 2026-09-28T00:10:03.556Z |
| 48 | 04.5-financeiro-parte-2 | deviation | tests/e2e/financeiro-mes.spec.ts | 167 | areas (criterio 1 do ROADMAP): venda de tres areas paga no Pix aparece cada valor na sua area -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): a tabela do Mes mostrou R$ 0,00 nas tres areas em vez dos valores lancados. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35 -- arquivo da Fase 04.4, fora do escopo de arquivos do plano 04.5-13; nao corrigido (sem causa raiz pequena e obvia). | open |  | 2026-09-27T03:28:13.487Z |  |
| 49 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-aprovacao.spec.ts | 304 | (f) cancelar a venda no Financeiro nao apaga nem reabre o orcamento -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): toHaveURL(/aviso=cancelado/) expirou em 10s mesmo com o log mostrando a navegacao correta acontecendo ("navigated to ...aviso=cancelado..."), a URL assentou em .../financeiro?aba=caixa sem o parametro no momento da checagem. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao/corrida de confirmacao de navegacao ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35; nao corrigido (sem causa raiz pequena e obvia). | fixed |  | 2026-09-27T03:28:14.050Z | 2026-09-27T14:18:14.697Z |
| 50 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-fotos.spec.ts | 181 | (g) a 320px as tres celulas cabem sem rolagem horizontal, e todo alvo de toque mede ao menos 44px -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): getByTestId('foto-celula') veio 1 em vez de 3 (upload/reducao de duas fotos nao concluiu a tempo sob a carga da suite inteira). Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35; nao corrigido (sem causa raiz pequena e obvia). \|\| RECLASSIFICADA em 28/09/2026: NAO e contencao. Reexecucao isolada com --workers=1 falhou nos DOIS projetos (desktop e celular): page.getByTestId("fotos-grade").getByTestId("foto-celula") resolveu para 0 elementos, esperando 3, com 14 tentativas do locator. As fotos nao aparecem na grade nessa execucao. O dono verificou o envio de foto em producao no item 15 da caminhada (27/09) e PASSOU, entao o produto funciona — a suspeita recai sobre o preparo do teste (as tres fotos nao chegam a existir antes da asercao) ou sobre o volume de fotos no ambiente efemero. Merece diagnostico proprio, com causa raiz, antes de qualquer conserto. | open |  | 2026-09-27T03:28:31.255Z |  |
| 51 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-tracador.spec.ts | 95 | todo botao visivel da aba Orcamentos mede ao menos 44px de altura -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): page.locator('main').getByRole('button').count() veio 0 (pagina nao terminou de renderizar sob a carga), junto de 'The destination stream closed early' no log do servidor Next -- mesmo sintoma ja registrado em WINDOWS #35 para o teste irmao (linha 63) do MESMO arquivo. Reexecucao isolada (--workers=1) passou limpa. Nao corrigido: mesma classe de contencao de servidor unico sob carga, sem causa raiz pequena e obvia neste arquivo. \|\| CONFIRMADA como contencao em 28/09/2026: reexecucao isolada com --workers=1 passou limpa. | open |  | 2026-09-27T03:28:31.805Z |  |
| 52 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-revisao.spec.ts | 181 | (a) parametro dedicado sobe o minimo -- falhou sob carga de 8 workers (npm run test:e2e --grep, reverificacao do plano 04.5-13 apos corrigir a poluicao de parametro entre specs): toHaveURL(/aviso=orcamento-enviado/) expirou em 10s mesmo com o log mostrando a navegacao correta acontecendo ("navigated to ...aviso=orcamento-enviado..."), a URL assentou sem o parametro no momento da checagem. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao/corrida de confirmacao de navegacao ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35; nao corrigido (sem causa raiz pequena e obvia). | fixed |  | 2026-09-27T03:28:42.694Z | 2026-09-27T14:18:15.178Z |
| 53 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-revisao.spec.ts | 190 | Poluicao de parametro global entre arquivos de spec, achado real da varredura completa (plano 04.5-13, Tarefa 1): orcamentos-revisao.spec.ts/orcamentos-ciclo.spec.ts/precificacao-parametros.spec.ts sobem parametros globais (preco_folga_negociacao/preco_imposto_sobre_venda, forno_desgaste_por_fornada/forno_tarifa_energia, material_argila/material_esmalte/trabalho_hora) sem desfazer, corrompendo o custo/minimo/selo que precificacao-ficha.spec.ts/precificacao-pecas.spec.ts esperam calculado com os valores PADRAO da semente. Corrigido com test.afterAll restaurando cada parametro direto no banco (commit fix(04.5-13) desta sessao) -- a poluicao DETERMINISTICA (ordem alfabetica de arquivo) foi eliminada e confirmada por reexecucao isolada e em grupo repetidas vezes. RESIDUAL: sob os 8 workers default do npm run test:e2e (fullyParallel, sem dependencies entre estes arquivos), uma janela de corrida ainda existe -- o teste que sobe o parametro e o afterAll que restaura rodam no MESMO arquivo/worker, mas um ARQUIVO DIFERENTE pode ler o parametro num worker concorrente durante a janela em que ele esta elevado, antes do afterAll disparar. Eliminar de vez exigiria uma cadeia de dependencies (mesmo padrao de vazio-celular/vazio-desktop/vazio-historico do playwright.config.ts) sequenciando estes cinco arquivos -- mudanca estrutural de infraestrutura de teste, fora do escopo deste plano de fechamento; frequencia observada baixa (1 em ~4 varreduras completas) e sempre no SELO/etiqueta de faixa, nunca no numero de custo (esse lado ja fechou). | fixed |  | 2026-09-27T03:58:55.587Z | 2026-09-27T14:18:14.194Z |
| 54 | 04.5-financeiro-parte-2 | deviation | components/amassa/precificacao/lista-pecas.tsx | 264 | Achado 8 da verificacao humana (27/09/2026, dono, no celular): o botao Apagar de uma peca EXCLUSIVA nao fazia nada -- palavras dele: 'peca exclusiva quando clica em Apagar a tela da peca fecha mas nao apaga nada, apenas esconde a lista das pecas exclusivas novamente'. Causa raiz: ConfirmarApagarPeca era montado DENTRO do map de fichasVisiveis; sem ?exclusivas=1 a ficha exclusiva nao esta nessa lista, o dialogo nao existe no DOM, ninguem le o ?apagarPeca= e o botao so navega para o nada. A Server Action apagarFicha e o confirmar-apagar-peca.tsx sempre estiveram corretos -- nunca rodavam. Corrigido no plano 04.5-14, Tarefa 1 (commit e5daf10): dialogos montados a partir de TODAS as fichas, fora do map do que aparece na lista, e hrefDaAbaPecas (lib/precificacao/navegacao.ts, modulo puro e testado) preservando ?exclusivas nas quatro navegacoes que o descartavam. Testes novos (i) e (j) em tests/e2e/precificacao-pecas.spec.ts, com RED provado antes. | fixed |  | 2026-09-27T18:23:58.743Z | 2026-09-27T18:24:28.989Z |
| 55 | 04.5-financeiro-parte-2 | deviation | components/amassa/orcamentos/veredito-da-aprovacao.tsx | 37 | Achado 14 da verificacao humana (27/09/2026, dono, no celular): o veredito do orcamento aprovado seguia verde dizendo 'ordem aberta na Producao' depois de a encomenda ser cancelada -- palavras dele: 'na producao ela fica cancelada e vai pro historico, mas tambem segue em verde com ordem aberta na Producao'. Causa raiz: textoVeredito(numero, encomendaId !== null) -- o parametro se chama ordemAberta mas respondia 'o id existe?'; encomendas.status nao era lido em ponto nenhum desse caminho e obterOrcamentoParaEdicao nem importava a tabela encomendas. Lacuna, nao regressao: este lado do criterio 14 nunca foi implementado. A outra metade (aviso de venda cancelada) passou -- o dono a encontrou depois, abaixo do bloco verde. Corrigido no plano 04.5-14, Tarefa 2 (commit fcc072a): leftJoin com encomendas, vereditoDaAprovacao em lib/orcamentos/situacao.ts (modulo puro e testado), FRASE_ENCOMENDA_CANCELADA_AVISO, cor do bloco descendo de sucesso para atencao quando venda OU ordem foi cancelada, e revalidatePath('/financeiro') em cancelarEncomenda. Teste novo (j) em tests/e2e/orcamentos-aprovacao.spec.ts, com RED provado antes. | fixed |  | 2026-09-27T18:23:59.229Z | 2026-09-27T18:24:29.468Z |
| 56 | 04.5-financeiro-parte-2 | deviation | lib/orcamentos/consultas.ts | 38 | Lacuna conhecida e NAO corrigida (fora do escopo do criterio 14, decisao registrada em 04.5-14-PLAN.md): listarOrcamentos (a lista da aba Orcamentos) nao faz join com documentos nem com encomendas, entao um orcamento cuja venda ou cuja encomenda foi cancelada e indistinguivel de um saudavel no cartao da lista. O criterio 14 ('aviso nos dois lados') quer dizer orcamento e venda, nao lista e editor -- o aviso existe nos dois lados, e no editor agora cobre tambem a encomenda. Resolver isto exigiria dois leftJoin a mais numa consulta de lista e uma decisao de desenho sobre o que o cartao mostra; nenhuma das duas coisas foi pedida. | open |  | 2026-09-27T18:23:59.705Z |  |
| 57 | 04.5-financeiro-parte-2 | deviation | tests/e2e/orcamentos-aprovacao.spec.ts | 364 | (i) a 320px o dialogo de aprovacao rola no corpo (backstop com oito pecas) -- falhou sob a varredura completa do plano 04.5-14 (npm run test:e2e sem --grep, 8 workers, desktop): dentro de acrescentarPecaExclusiva, depois do Salvar, a URL ficou em ...&peca=novo e o toHaveURL(/orcamento=<id>$/) expirou em 10s. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao/corrida de confirmacao de navegacao ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35/#49; nao corrigido (sem causa raiz pequena e obvia). \|\| CONFIRMADA como contencao em 28/09/2026: reexecucao isolada com --workers=1 passou limpa. | open |  | 2026-09-27T18:24:16.621Z |  |
| 58 | 04.5-financeiro-parte-2 | deviation | tests/e2e/cadastros-contas-fixas.spec.ts | 201 | Achado REAL da varredura completa do plano 04.5-14, e NAO e contencao: o teste 'cria, desativa, gera duas vezes sem duplicar, paga o aluguel...' falhou na varredura E de novo em reexecucao isolada com --workers=1. O clique em 'Desfazer' (linha 201) depende do toast de 7 segundos (D-03) ainda estar na tela, mas entre pagar e clicar o teste abre o detalhe do extrato, faz tres asseroes e fecha o dialogo -- tudo dentro da janela de 7s. O instantaneo da falha mostra a regiao de avisos vazia: o toast ja tinha expirado. Fragilidade de teste, nao defeito de produto (o Desfazer funciona; so nao da tempo). Fora do escopo de arquivos do plano 04.5-14 (area da Fase 04.4, Cadastros) -- registrado sem corrigir, conforme a regra de limite de escopo do CLAUDE.md. Conserto provavel: clicar em Desfazer logo apos o pagamento e so entao abrir o extrato. | open |  | 2026-09-27T18:24:17.096Z |  |
| 59 | 04.5-financeiro-parte-2 | deviation | components/amassa/precificacao/dialogo-ficha.tsx | 409 | Achado da verificacao do Cowork (27/09/2026): "ao salvar peca nova a tela reabre a mesma peca em edicao em vez de voltar a lista". Confirmado — a URL de volta leva ?peca=<id>, que e o parametro que ABRE a ficha, enquanto o comentario logo acima prometia "volta para a lista de pecas". RESOLVIDO em 28/09/2026 SEM mudanca de comportamento: o dono decidiu que reabrir a ficha esta certo — numa tela de precificacao ele acabou de digitar medidas e quer ver o numero, o selo e a barra de custo sem procurar a linha. Quem mentia era o comentario, e foi ele que mudou. Nota historica: cheguei a aplicar a mudanca de codigo e revertí ao descobrir que o teste (b) de precificacao-pecas.spec.ts depende do comportamento atual (le o id da peca criada de url.searchParams.get("peca"), e esse id alimenta casos posteriores) — o que tirou a mudanca da categoria "opcao claramente recomendada" e levou a pergunta ao dono. | fixed |  | 2026-09-28T00:26:54.662Z | 2026-09-28T00:26:54.663Z |
| 60 | 04.6-gestao-inicio-e-site-publico | deviation | docker/Dockerfile | 31 | A construcao da imagem depende de fonts.googleapis.com estar no ar: app/layout.tsx carrega tres fontes por next/font/google (Inter, Archivo Narrow e, desde o plano 04.6-03, Fraunces) e o RUN npm run build do docker/Dockerfile as baixa dentro do conteiner. Falhou por isso no run 36443052672 (28/09/2026, push do commit 72b8881): 14x "Module not found: Cannot resolve @vercel/turbopack-next/internal/font/google/font", que e o sintoma do Turbopack quando a busca da fonte falha. NAO e defeito de codigo: o comando exato do CI (docker build --target app --no-cache, inclusive com NEXT_PUBLIC_SITE_URL vazia) foi reproduzido na maquina do dono e PASSOU, npm run build correndo 90,8s dentro do Alpine, zero erro de fonte. Primeira ocorrencia deste modo em 20 runs (as outras 4 falhas recentes foram do Playwright). Distinguir transitorio de permanente exige re-executar o pipeline, e isso e do dono porque verde encadeia implantar. Correcao duravel possivel, NAO aplicada por contrariar decisao travada: versionar os arquivos de fonte e usar next/font/local — D-10 decidiu de proposito que nenhum arquivo de fonte e versionado, entao reabrir isso e decisao do dono. | open |  | 2026-09-28T15:43:18.429Z |  |
| 61 | 04.6 | todo | conteudo/site.ts |  | Textos do site publico ainda com colchetes [...] e a faixa 'em construcao' no ar; o dono declarou em 29/09/2026 (VERIFICACAO-HUMANA item 14) que vai entregar um pacote unico de alteracoes de texto — pendencia declarada dele, nao defeito; fecha quando o lote entrar | open |  | 2026-09-28T23:41:02.301Z |  |
| 62 | 06.1 | deviation | tests/e2e/financeiro-mes.spec.ts | 114 | 'areas (criterio 1): venda de tres areas paga no Pix' (celular) falhou na varredura completa do plano 06.1-15 (8 workers) E na execucao serial seguinte (--workers=1, 968 testes): o Mes de 2021-10 mostrou R$ 0,00 nas quatro areas. Passou isolado (so a cadeia vazio-*). Nenhum arquivo do Financeiro da venda ou do Mes mudou na fase. Hipotese nao provada: o teste preenche Data/busca antes da hidratacao do PainelVenda (useState(hoje)) quando o banco esta cheio, e a venda sai com a data de hoje; esperarVendaLancada so confere a URL ?aba=venda. Proximo passo: waitForLoadState networkidle + toHaveValue da Data antes de Lancar venda, como o helper de despesa do mesmo arquivo ja faz. | open |  | 2026-09-30T11:44:34.384Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01-funda-o-e-primeiro-deploy",
    "file": "README.md",
    "line": null,
    "description": "Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-06T17:44:26.584Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "02a-login-banco-base-e-backup",
    "file": "middleware.ts",
    "line": null,
    "description": "callbackUrl do redirecionamento nao autenticado vaza o endereco interno do container (https://0.0.0.0:3000/...) em vez do dominio publico — confirmado de fora em producao (curl -I https://amassacerrado.com.br/encomendas). O cookie __Secure-authjs.callback-url resolve o dominio certo, mas o parametro de query da Location nao. Descoberto durante a verificacao externa do plano 02a-08 (Tarefa 3); fora do escopo de arquivos deste plano (nao toca middleware.ts nem lib/auth/) — precisa de investigacao dedicada em auth.config.ts / trustHost do Auth.js v5",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-08T14:39:57.410Z",
    "resolved_at": "2026-09-17T17:38:56.775Z"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "02b",
    "file": "tests/e2e/autenticacao.spec.ts",
    "line": 72,
    "description": "Sexta tentativa de bloqueio trava/estoura timeout de forma pre-existente (confirmado via --grep-invert, independente da 02b-03) — ver deferred-items.md item 1",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T18:37:46.938Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "03",
    "file": ".planning/phases/03-gestor-de-encomendas/deferred-items.md",
    "line": null,
    "description": "shadcn 'form' registry item (radix-nova style, CLI 3.8.5) has no files to install; plan 06 must decide field vs hand-rolled wrapper vs direct react-hook-form before building the full formulario",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-09T14:15:31.870Z",
    "resolved_at": "2026-08-09T18:53:21.639Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "03",
    "file": "tests/e2e/encomendas-indice.spec.ts",
    "line": null,
    "description": "Teste 'com o banco vazio, a frase A roda ainda nao gira aparece uma unica vez' (ENC-13) so e confiavel quando rodado com --grep 'indice de encomendas' (comando de verificacao literal da Tarefa 3). No npm run test:e2e completo sem grep, outro arquivo de spec (encomendas.spec.ts) roda em paralelo e pode criar uma encomenda antes da asserção — limitação estrutural da suite (sem isolamento de banco por teste), nao um defeito do EstadoVazio/hrefBotao.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-09T16:31:43.430Z",
    "resolved_at": "2026-08-10T18:51:44.328Z"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/cabecalho-pagina.tsx",
    "line": null,
    "description": "O <h1> do cabecalho de pagina (CabecalhoPagina) nao quebra em linha para um titulo muito comprido sem espaco (ex.: nome de encomenda de 120 caracteres colados) — causa rolagem horizontal da PAGINA inteira (nao dos dois alert-dialog de 03-05, que ja tem overflow-wrap:anywhere e foram provados por e2e). Descoberto durante 03-05 (pagina de detalhe usa o nome da encomenda como titulo); fora do escopo de arquivos deste plano (componente compartilhado da 2b). Precisa de break-words/overflow-wrap no h1 de cabecalho-pagina.tsx, revisavel numa fase futura de polimento.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:18.070Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "tests/e2e/encomendas-detalhe.spec.ts",
    "line": null,
    "description": "E5 detalhe — vazio (backstop do plano 03-05): a trilha nunca deveria mostrar uma encomenda sem item (esquemaEncomenda exige >=1), mas isso depende do formulario recusar 0 itens (plano 06, ainda nao existe UI para isso) — nao verificado a mao nesta execucao; conferir quando o formulario de edicao de itens existir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:32.827Z",
    "resolved_at": "2026-08-09T18:53:26.159Z"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/encomendas/confirmar-cancelar.tsx",
    "line": null,
    "description": "E8 confirmar cancelar — erro (backstop do plano 03-05): o AlertDialog deve permanecer aberto mostrando o texto de falha sem fechar sozinho quando cancelarEncomenda falha; caminho implementado (estado erro + onOpenChange bloqueado por enviando) mas nao ha teste automatizado nem verificacao manual do caminho de falha nesta execucao (dificil de simular falha de rede/servidor de forma confiavel em e2e local).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:33.701Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/encomendas/confirmar-excluir.tsx",
    "line": null,
    "description": "E9 confirmar excluir — erro (backstop do plano 03-05): mesma situacao de E8 aplicada a excluirEncomenda — caminho implementado, sem prova automatizada nem verificacao manual do caminho de falha nesta execucao.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T17:35:34.500Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "unrun-verify",
    "phase": "03-gestor-de-encomendas",
    "file": "components/amassa/encomendas/lista-itens.tsx",
    "line": null,
    "description": "E11 reordenacao — carregando (backstop do plano 03-06): a seta clicada fica com opacidade reduzida e disabled (par inteiro) ate a resposta do servidor, o que deveria impedir que dois cliques rapidos na mesma seta gravem fora de ordem; nao verificado a mao nem com teste automatizado de concorrencia real nesta execucao (dificil simular corrida de rede confiavel em e2e local).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T18:53:37.603Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "03-gestor-de-encomendas",
    "file": "tests/e2e/encomendas-impressao.spec.ts",
    "line": null,
    "description": "Teste 'sem nenhuma encomenda ativa' (folha de impressao) so e confiavel isolado (--grep impressao de encomendas); sob --grep encomenda/suite completa, outros specs criam encomendas em paralelo e o teste falha por contagem global nao-zero. Mesma classe estrutural de WINDOWS #5 (sem isolamento de banco por teste).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-09T20:57:04.606Z",
    "resolved_at": "2026-08-10T18:51:44.807Z"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "03-gestor-de-encomendas",
    "file": "tests/e2e/sessao.spec.ts",
    "line": 110,
    "description": "'depois de sair o botao de voltar cai em /login' falhou uma vez (celular) sob a concorrencia da varredura completa (npm run test:e2e sem grep, 8 workers) — timing de navegacao apos logout, nao reproduziu em execucao isolada nem em runs seguintes da mesma varredura. Arquivo da fase 02a, fora do escopo de arquivos do plano 03-08; achado durante a varredura completa que este plano e dono de executar (03-08-PLAN.md full_sweep_responsibility).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-09T20:57:11.541Z",
    "resolved_at": "2026-09-19T09:09:19.931Z"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "03-gestor-de-encomendas",
    "file": ".github/workflows/entrega.yml",
    "line": null,
    "description": "O passo 'implantar' do pipeline faz docker compose pull app + up -d app, mas nunca faz pull da imagem :ferramentas (usada para migrar e criar/redefinir usuario). docker compose run usa o cache local, entao apos um deploy o servidor pode rodar a imagem ferramentas de uma fase anterior por ate a proxima vez que alguem rodar 'docker compose pull ferramentas' a mao. Descoberto na execucao do roteiro 04 (migracao de producao da Fase 3): o servidor rodou meia hora com a imagem da Fase 2a antes do pull manual (passo 2 do roteiro) pegar. Os roteiros de docs/operacao/ ja incluem o pull manual como salvaguarda; o gap e o pipeline nao fazer isso sozinho.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T19:55:19.553Z",
    "resolved_at": "2026-08-10T20:08:36.048Z"
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "03-gestor-de-encomendas",
    "file": "docker/compose.yml",
    "line": null,
    "description": "O compose.yml do servidor e copiado por scp no Roteiro 1 e nenhum roteiro posterior nem o pipeline o atualizam depois disso — ele pode divergir do docker/compose.yml versionado no repositorio. Descoberto na execucao do roteiro 04: DATABASE_URL_MIGRACAO entrou no compose.yml no commit e593e83 (plano 02a-02, depois da copia inicial), entao o servico ferramentas do servidor ainda lia DATABASE_URL (que aponta para amassa_app, sem privilegio de DDL) e a migracao falhou com 'permission denied for database amassa' (42501) ate o dono copiar o compose.yml atual para o servidor a mao. Nenhum roteiro de docs/operacao/ inclui um passo de 'sincronize o compose.yml antes de migrar' — candidato a um passo novo numa fase de polimento.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-10T19:55:19.982Z",
    "resolved_at": "2026-08-10T20:08:36.522Z"
  },
  {
    "id": 15,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "components/amassa/queimas/medidor.tsx",
    "line": null,
    "description": "Posição visual em pixels dos entalhes/marca do limiar não medida por teste automatizado — verificação humana pendente para 04-07",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T00:10:18.811Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "app/(app)/queimas/error.tsx",
    "line": null,
    "description": "error.tsx não foi exercitado por um erro real forçado em teste e2e — verificação funcional pendente para 04-07",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T00:10:19.316Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "app/(app)/page.tsx",
    "line": null,
    "description": "Ramo de erro de fornosQuePrecisamDeAtencao() no painel inicial (EstadoErro dentro do CartaoPainel) so provado por revisao de codigo, sem teste e2e forcando falha real",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T01:30:30.547Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "components/amassa/queimas/banner-atencao.tsx",
    "line": null,
    "description": "E5 long-text (UI-SPEC backstop): altura previsivel do banner com 3 fornos de nomes de 80 caracteres + 'e mais 2' em viewport de celular estreito, nunca checada visualmente",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T01:30:31.078Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "app/(app)/queimas/relatorios/page.tsx",
    "line": null,
    "description": "D-08: estado vazio de /queimas/relatorios (nenhuma queima registrada) provado só por revisão de código — o e2e desta tarefa foi construído 'sem etiqueta de vazio' por escopo do plano 04-06",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:09:34.019Z",
    "resolved_at": null
  },
  {
    "id": 20,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "components/amassa/queimas/relatorios-recharts.tsx",
    "line": null,
    "description": "D-07: ordem visual das 4 estatísticas antes dos gráficos no celular e o 'mesmo recorte de dados' nos dois tamanhos de tela garantidos por código, nunca checados com screenshot",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T02:09:34.524Z",
    "resolved_at": null
  },
  {
    "id": 21,
    "kind": "deviation",
    "phase": "04",
    "file": "tests/e2e/encomendas-detalhe.spec.ts",
    "line": 657,
    "description": "'concluir uma encomenda cuja data já passou... mostra Concluída em ao atualizar' (celular) flaky sob a varredura completa (npm run test:e2e sem grep, CI run #45 e localmente): botão some / texto 'Concluída em' aparece via router.refresh() após concluirEncomenda, com toHaveCount/toContainText já polling 10s — passou na retentativa sem mudança de código, mesma classe de contenção de servidor Next único compartilhado já registrada em WINDOWS #12 (sessao.spec.ts). Arquivo da Fase 3, fora do escopo de arquivos do plano 04-07; não é um defeito óbvio e pequeno (diferente do achado real em queimas-manutencao.spec.ts, corrigido nesta mesma execução) — não modificado aqui.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T06:04:00.822Z",
    "resolved_at": null
  },
  {
    "id": 22,
    "kind": "deviation",
    "phase": "04",
    "file": "tests/e2e/encomendas-impressao.spec.ts",
    "line": 155,
    "description": "'só rascunho e em_producao aparecem — concluída e cancelada nunca' (celular) falhou uma vez sob npm run test:e2e --workers=2 (concorrência representativa de CI): linha-impressao-{idConcluida} ainda visível em /encomendas/imprimir depois de o botão 'Marcar como concluída' já ter sumido na página de detalhe (confirmando status=concluida commitado) e um page.goto novo para a rota de impressão. Sinal real (não é o mesmo defeito de 'valor que não muda' já corrigido em queimas-manutencao.spec.ts nesta execução) — não reproduziu em runs anteriores nem depois; mesma classe de contenção de servidor Next único sob carga, ainda sem causa raiz pequena e óbvia. Arquivo da Fase 3, fora do escopo de arquivos do plano 04-07.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T06:26:32.166Z",
    "resolved_at": null
  },
  {
    "id": 23,
    "kind": "deviation",
    "phase": "04",
    "file": "app/(app)/layout.tsx",
    "line": 15,
    "description": "Falha em exigirUsuario() no layout de rota protegida cai na tela padrão do Next.js (\"Application error: a server-side exception has occurred\"), não num estado de erro em linguagem humana. No App Router, error.tsx NÃO captura erro do layout do PRÓPRIO segmento: app/(app)/error.tsx é irmão do layout que falha, e não existe app/error.tsx nem app/global-error.tsx acima dele. Atinge TODA rota autenticada (Encomendas, Agenda, Fornos, Estoque, Orçamentos), não só Fornos. Achado no UAT da Fase 4 (teste 5, gap G-04-5) derrubando o Postgres local. As fronteiras de PÁGINA estão provadas funcionando (teste 13, método cirúrgico: renomear só a tabela fornos). Defeito pré-existente — layout é da Fase 2b. Decisão do dono no fechamento do UAT: corrigir como tarefa própria, fora da Fase 4. Corrigido pelo quick task 260811-uiy: app/error.tsx (fronteira acima do layout de (app)) e app/global-error.tsx (último recurso, prova estrutural — não observável em next dev). Prova COMPORTAMENTAL com o Postgres local parado NÃO pôde ser executada de forma automatizada nesta sessão (E2E_EMAIL_TESTE/E2E_SENHA_TESTE não definidos em .env.local para login manual fora do pipeline de teste); escalada ao roteiro manual do dono, registrado em 260811-uiy-SUMMARY.md.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-11T20:55:00.000Z",
    "resolved_at": "2026-08-11T21:15:34.000Z"
  },
  {
    "id": 24,
    "kind": "deviation",
    "phase": "04.2",
    "file": "tests/e2e/autenticacao.spec.ts",
    "line": 84,
    "description": "Sexta tentativa de bloqueio (limite de tentativas) falhou em desktop e celular na varredura completa sem --grep desta fase (4 failed/382 passed/33 skipped/1 did not run) -- arquivo da Fase 02b, fora do escopo de arquivos do plano 04.2-05, mesma classe ja registrada em WINDOWS #3 para este arquivo.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-31T21:11:52.752Z",
    "resolved_at": "2026-08-31T23:32:07.157Z"
  },
  {
    "id": 25,
    "kind": "deviation",
    "phase": "04.2",
    "file": "tests/e2e/abertura-edicao.spec.ts",
    "line": 234,
    "description": "'editar uma tarefa preserva o vinculo dela com o item' falha intermitente, so no celular, na varredura completa -- o equivalente para ITEM (linha 165) passa nos dois viewports. Mesma classe do defeito de framework documentado em .planning/debug/abertura-navegacao-trava.md (payload RSC do FormularioTarefa em modo edicao); nao corrigido nesta execucao (orcamento de sessao de depuracao ja esgotado nesta fase).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-31T21:11:53.253Z",
    "resolved_at": "2026-08-31T23:32:07.674Z"
  },
  {
    "id": 26,
    "kind": "deviation",
    "phase": "04.2",
    "file": "tests/e2e/queimas-registro.spec.ts",
    "line": 84,
    "description": "ACHADO QUE ULTRAPASSA A FASE: 'Desfazer' remove a queima recem-registrada -- falhou numa das varreduras completas de 04.2. Usa router.refresh() apos a Server Action (mesmo padrao de components/amassa/queimas/registrar-queima.tsx), o MESMO canal com perda ja diagnosticado em .planning/debug/abertura-navegacao-trava.md (confirmado tambem para components/amassa/encomendas/trilha-etapas.tsx, ja anotado ali como 'canal com perda', ver WINDOWS #12/#21/#22). Queimas e Encomendas usam o mesmo padrao router.refresh() e tem menos testes batendo nele que Abertura tinha. Nao corrigido nesta execucao -- fora do escopo de arquivos do plano 04.2-05 (nenhum arquivo de Queimas/Encomendas foi tocado).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T21:12:06.353Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "deviation",
    "phase": "04.2",
    "file": "components/amassa/abertura/data-inauguracao.tsx",
    "line": 79,
    "description": "DataInauguracao.salvar() ainda chama router.refresh() apos definirDataDeInauguracao, ao contrario de formulario-item.tsx/formulario-tarefa.tsx/confirmar-remover-item.tsx/confirmar-remover-tarefa.tsx (todos migrados para navegacao completa nesta mesma fase para escapar do canal-com-perda documentado em .planning/debug/abertura-navegacao-trava.md). Risco: o toast de sucesso pode aparecer enquanto a contagem regressiva/data exibida no cabecalho fica com o valor antigo, na mesma taxa de falha (~54-70%) medida para a marcacao. Descoberto na conferencia lado a lado do plano 04.2-05 (Tarefa 2); nao corrigido nesta execucao porque o arquivo nao esta no escopo de arquivos do plano e a correcao (navegacao completa) implica uma terceira perda declarada (o toast de sucesso da data) que precisa de decisao do dono, nao so troca de codigo.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-31T21:12:06.799Z",
    "resolved_at": "2026-08-31T23:32:08.168Z"
  },
  {
    "id": 28,
    "kind": "deviation",
    "phase": "04.3",
    "file": "components/amassa/cotacoes/sub-abas-categorias.tsx",
    "line": null,
    "description": "Pílula 'editar categoria' (renomear/excluir, D-15) não implementada nesta tarefa — sem Server Action de update/delete de categoria no plano 01; a pílula de nova categoria funciona, a de editar fica para plano seguinte da fase.",
    "status": "waived",
    "reason": "Escopo da onda 2: o plano 04.3-02 ja cobre renomear e remover categoria com confirmacao (D-15). Nao e debito.",
    "recorded_at": "2026-09-17T19:30:34.969Z",
    "resolved_at": "2026-09-17T19:34:05.445Z"
  },
  {
    "id": 29,
    "kind": "deviation",
    "phase": "04.3",
    "file": "tests/e2e/cotacoes-categorias.spec.ts",
    "line": 94,
    "description": "Falha intermitente sob a varredura completa (npm run test:e2e sem --grep): pilulaA.click() as vezes nao navega (URL/categoria nunca troca), entao as duas cotacoes criadas em seguida vao para a categoria ainda ativa em vez de A, e a contagem da pilula A fica 0 contra 0 linhas (nao e discrepancia de dado, e o clique que nao comitou). Mesma classe do defeito de framework documentado em .planning/debug/abertura-navegacao-trava.md (React/Next as vezes nao comita o startTransition de um <Link> RSC sob carga). Reexecucao isolada (npm run test:e2e -- --grep \"cotacoes categorias|cotacoes tracador\") passou 36/36 nos dois projetos, confirmando flakiness, nao regressao deterministica. Nao corrigido nesta execucao: a mitigacao (navegacao completa em vez de <Link> RSC) contraria a decisao explicita do UI-SPEC de usar <Link> normal para troca de categoria (nao history.pushState), e reescrever o padrao de navegacao de leitura e mudanca arquitetural fora do escopo de arquivos do plano 04.3-05.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-18T18:22:36.267Z",
    "resolved_at": "2026-09-19T09:09:20.336Z"
  },
  {
    "id": 30,
    "kind": "deviation",
    "phase": "04.3",
    "file": "tests/e2e/cotacoes-tracador.spec.ts",
    "line": 44,
    "description": "Falha intermitente sob a varredura completa: clicar na aba 'Cotacoes' (<Link> RSC, abas-abertura.tsx) as vezes nao navega para ?aba=cotacoes dentro do timeout padrao de 5s (URL fica em /abertura). Mesma classe do defeito de framework documentado em .planning/debug/abertura-navegacao-trava.md. Reexecucao isolada (--grep \"cotacoes categorias|cotacoes tracador\") passou 36/36 nos dois projetos (incluindo este teste), confirmando flakiness sob carga da suite completa, nao regressao deterministica. Nao corrigido nesta execucao pelo mesmo motivo do achado irmao em cotacoes-categorias.spec.ts:94.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-18T18:22:36.736Z",
    "resolved_at": "2026-09-19T09:09:20.752Z"
  },
  {
    "id": 31,
    "kind": "deviation",
    "phase": "04.3",
    "file": "tests/e2e/abertura-edicao.spec.ts",
    "line": 165,
    "description": "'editar um item com tarefa ligada atualiza a linha e preserva o vinculo' (celular) falhou na varredura completa desta fase -- mesma classe ja registrada para a variante 'tarefa' (WINDOWS #25, fechado em 04.2), agora atingindo a variante ITEM tambem, sob a carga da suite inteira (490+ testes). Arquivo da Fase 4.2, fora do escopo de arquivos do plano 04.3-05; achado durante a varredura completa que este plano e dono de executar (04.3-05-PLAN.md, Tarefa 2).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-18T18:22:37.243Z",
    "resolved_at": "2026-09-19T09:09:21.148Z"
  },
  {
    "id": 32,
    "kind": "deviation",
    "phase": "04.4-financeiro-parte-1",
    "file": "tests/e2e/financeiro-extrato.spec.ts",
    "line": 212,
    "description": "'navega por mes, filtra por forma, mantem o saldo global, e mostra os dois vazios' (desktop) falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers locais): getByTestId('extrato-linha') veio 0 em vez de 5 apos clicar em 'mes seguinte'. Reexecucao isolada (--grep 'financeiro extrato') passou 32/32 nos dois projetos (incluindo este teste), confirmando flakiness sob carga da suite completa, nao regressao deterministica -- mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#29/#30/#31. Achado incidentalmente ao provar a correcao da fuga de dado do teste 04.4-11 (script/testar-migracoes.mjs); nao corrigido nesta execucao, fora do escopo de arquivos da correcao (nenhuma logica de extrato foi tocada).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T09:24:14.442Z",
    "resolved_at": null
  },
  {
    "id": 33,
    "kind": "deviation",
    "phase": "quick-260920-jxb",
    "file": "db/index.ts",
    "line": null,
    "description": "WINDOWS #3/#24 diagnostico atualizado (ver .planning/debug/auth-bloqueio-timeout-e2e.md, 2026-09-20): hipotese do custo do argon2id foi MEDIDA e REFUTADA (25-150ms/tentativa). Hipotese lider, nao confirmada por reproducao direta (3 tentativas honestas falharam), era connectionTimeoutMillis ausente no pool pg (espera infinita). Corrigido aqui: connectionTimeoutMillis=5000 em db/index.ts, com teste de regressao (tests/unit/pool-conexao.test.ts) e caminho de falha documentado (cai na mesma mensagem humana via AuthError, nunca stack crua). #24 foi marcado 'fixed' em 2026-08-31 (fase 04.2) SEM nenhuma mudanca de codigo relacionada -- esta e a primeira correcao real do problema estrutural que #3/#24 descrevem. #3 permanece OPEN porque a Tarefa 2 deste quick task (semear tentativas via API para encurtar o teste) foi revertida -- ver entrada irma sobre o bug de duplicacao de modulo descoberto -- entao o ciclo RED/GREEN provando o fim da falha intermitente original nao fechou.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-20T13:48:00.596Z",
    "resolved_at": "2026-09-20T13:48:07.409Z"
  },
  {
    "id": 34,
    "kind": "deviation",
    "phase": "quick-260920-jxb",
    "file": "lib/auth/tentativas-memoria.ts",
    "line": null,
    "description": "ACHADO NOVO, fora do escopo desta tarefa: o contador de tentativas em memoria (lib/auth/tentativas-memoria.ts) NAO parece ser um singleton verdadeiro entre a rota REST do Auth.js (app/api/auth/[...nextauth]/route.ts, POST /api/auth/callback/credentials) e a Server Action de login (lib/auth/acoes.ts, entrar() -> signIn() server-side) nesta build (Next.js 16.3.5 + Turbopack, output: standalone). Confirmado empiricamente: 5 POSTs reais e corretos contra a rota REST (GET /api/auth/csrf + POST /api/auth/callback/credentials, protocolo padrao do Auth.js, cada um retornando code=credentials como esperado) NAO bloqueiam a 6a tentativa feita pela Server Action via UI real (continua mostrando a mensagem generica de credencial invalida, nao a de bloqueio) -- mesmo com um servidor 'next start' recem-construido, sem processo travado, e mesmo com curl provando que 5 POSTs + um 6o POST, TODOS pela MESMA rota REST, bloqueiam corretamente entre si. Isso e a MESMA classe de suspeita ja registrada (nao confirmada) no debug auth-bloqueio-timeout-e2e.md para o pool de conexao do Postgres ('pools de conexao podem nao ser verdadeiramente compartilhados entre diferentes rotas/Server Actions nesta build') -- agora CONFIRMADA para um modulo diferente (o contador de tentativas). Por causa disso, a Tarefa 2 deste quick task (semear as 5 primeiras tentativas de tests/e2e/autenticacao.spec.ts via a rota REST, mantendo a 6a pela UI real) foi revertida sem aplicar -- nao ha caminho honesto de semear via HTTP que compartilhe estado com a Server Action nesta build, e o unico substituto seria reproduzir o protocolo interno de Server Actions do Next.js (header Next-Action com id derivado do build), que e exatamente o tipo de hack fragil que a tarefa pediu para evitar. Merece investigacao propria (Turbopack chunk splitting de modulos compartilhados sob output: standalone) antes de qualquer nova tentativa de encurtar este teste.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T13:48:30.734Z",
    "resolved_at": null
  },
  {
    "id": 35,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-tracador.spec.ts",
    "line": 63,
    "description": "'a 320px, a aba nao rola na horizontal e as sete pilulas do Financeiro estao em duas fileiras' (desktop e celular) falhou sob a carga de 8 workers (npm run test:e2e --grep 'orcamentos tracador'): boundingBox() de financeiro-aba-venda/financeiro-aba-orcamentos veio null nos dois, junto de varios 'The destination stream closed early' no log do servidor Next. Reexecucao isolada (--grep 'estao em duas fileiras' --workers=1) passou 32/32 (todos os specs da cadeia, incluindo este), confirmando flakiness sob contencao do servidor unico, nao regressao deterministica -- mesma classe ja registrada em WINDOWS #12/#21/#22/#29/#30/#31/#32. Nao corrigido nesta execucao: nao ha causa raiz pequena e obvia neste arquivo (o teste em si nao muta estado nem depende de outro spec).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-26T17:04:40.752Z",
    "resolved_at": null
  },
  {
    "id": 36,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "lib/precificacao/textos.ts",
    "line": 183,
    "description": "A frase que recusa apagar uma peca em uso usa o plural preguicoso: 'Esta peca esta em 1 orcamento(s). Nao da para apagar.' Com uma ocorrencia so, le mal. A regra do CLAUDE.md pede erro em linguagem humana, e o resto do projeto ja trata plural direito. Correcao de duas linhas (singular/plural por contagem), deixada fora do plano 05 de proposito para nao editar trabalho ja commitado no meio da execucao da fase. Achado pelo orquestrador ao conferir D-20 depois do plano 05.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T20:08:12.449Z",
    "resolved_at": "2026-09-26T21:05:11.553Z"
  },
  {
    "id": 37,
    "kind": "unrun-verify",
    "phase": "04.5-financeiro-parte-2",
    "file": "components/amassa/orcamentos/cabecalho-do-orcamento.tsx",
    "line": null,
    "description": "O bloco 'Para quem e para quando' fora de rascunho (leitura simples, sem controle de edicao) esta implementado mas sem prova automatizada: nenhum plano ate agora move um orcamento para fora de status rascunho (a acao 'Marcar como enviado' e de um plano futuro). Conferir quando essa transicao existir.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T20:55:15.622Z",
    "resolved_at": "2026-09-26T22:29:49.043Z"
  },
  {
    "id": 38,
    "kind": "deviation",
    "phase": "04.5",
    "file": "lib/orcamentos/acoes.ts",
    "line": null,
    "description": "Acceptance script da Tarefa 2 (04.5-07-PLAN.md) procura 'function exigirRascunho'; a guarda real, reaproveitada do plano 06, chama-se travarOrcamentoRascunho (1 ocorrencia, 9 chamadores) — intent satisfeito, nome do script desatualizado || FECHADA em 28/09/2026, sem alteracao de codigo: conferido — a guarda real travarOrcamentoRascunho existe em lib/orcamentos/acoes.ts (13 ocorrencias). O codigo sempre esteve certo; so o nome no script de aceitacao do plano estava desatualizado. O plano ja foi executado: o script e artefato historico, nao se reescreve.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T21:48:07.443Z",
    "resolved_at": "2026-09-28T00:02:26.665Z"
  },
  {
    "id": 39,
    "kind": "deviation",
    "phase": "04.5",
    "file": "components/amassa/orcamentos/escolher-peca.tsx",
    "line": null,
    "description": "Acceptance script da Tarefa 3 (04.5-07-PLAN.md) acusa 'router.push|router.refresh' em orcamentos/ — e um COMENTARIO (plano 06) explicando por que o componente NAO usa router.refresh(), nao uma chamada real; nenhum router. de verdade no modulo || FECHADA em 28/09/2026, sem alteracao de codigo: conferido — grep por router.push|router.refresh em components/amassa/orcamentos/ nao acha nenhuma chamada real, so o comentario que explica por que o componente NAO usa router.refresh(). O script de aceitacao casou com o comentario.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T21:48:07.985Z",
    "resolved_at": "2026-09-28T00:02:26.665Z"
  },
  {
    "id": 40,
    "kind": "deviation",
    "phase": "04.5",
    "file": "lib/orcamentos/acoes.ts",
    "line": null,
    "description": "Acceptance script da Tarefa 2 (04.5-08-PLAN.md, checagem 'for update' via new RegExp com barras invertidas quadruplas) quebra ao atravessar plano->bash->JS->RegExp: o padrao vira [sS]*?\\n} (nunca casa nada), confirmado testando contra acrescentarLinha (funcao correta desde o plano 06). Reescrevendo o mesmo regex sem a camada extra de escape, as quatro transicoes (marcarComoEnviado/recusarOrcamento/voltarParaRascunho/duplicarOrcamento) confirmam for update antes do fechamento -- intent satisfeito, escape do script quebrado || FECHADA em 28/09/2026, sem alteracao de codigo: conferido — for update aparece 18 vezes em lib/orcamentos/acoes.ts. A guarda existe; o que quebrou foi a RegExp do script ao atravessar plano->bash->JS. Mesmo caso do #38: plano executado, script e historico.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T22:29:11.144Z",
    "resolved_at": "2026-09-28T00:02:26.665Z"
  },
  {
    "id": 41,
    "kind": "unrun-verify",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-ciclo.spec.ts",
    "line": 161,
    "description": "D-21 diz que, depois de congelado, mudar um PARAMETRO OU UMA FICHA nao altera o orcamento. O teste (3) prova a metade do parametro, e prova bem: congela, muda um parametro dedicado, e total/minimo/painel inteiro continuam byte a byte iguais — com o caso de controle (um rascunho novo com a mesma receita ja usa o valor novo), que descarta o falso positivo de 'nada recalcula'. A metade da FICHA nao tem teste. Argumento estrutural a favor, conferido pelo orquestrador: existe o invariante de banco (status='rascunho') = (snapshot is null), e lerDoSnapshot e a UNICA porta de leitura dos numeros congelados — entao uma mudanca de ficha atravessaria exatamente a mesma porta que o teste do parametro ja exercita. Isso e argumento, nao prova. Fechar com um teste que edita a ficha de uma peca ja usada num orcamento enviado, ou conferir a mao na verificacao humana.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T22:33:28.372Z",
    "resolved_at": "2026-09-27T13:53:12.441Z"
  },
  {
    "id": 42,
    "kind": "skipped-test",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-revisao.spec.ts",
    "line": null,
    "description": "(f) 'num orcamento aprovado o botao Atualizar precos nao existe' fica test.skip: nao existe, nesta fase, nenhum caminho pela UI para aprovar um orcamento (Cliente aprovou e do plano 12 e continua desabilitado). Verificado por leitura de codigo (editor-orcamento.tsx: o guarda 'status !== aprovado' envolve o dialogo inteiro); reabrir quando o plano 12 existir.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-26T23:12:42.378Z",
    "resolved_at": null
  },
  {
    "id": 43,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": ".planning/REQUIREMENTS.md",
    "line": null,
    "description": "Tabela de rastreabilidade (linha ~447/450) mostra ORC-07/ORC-10 como 'Pending' apesar de 04.5-07-SUMMARY.md/04.5-08-SUMMARY.md listarem os dois em requirements-completed -- gap pre-existente, nao introduzido nem corrigido pelo plano 09 (fora do escopo de arquivos); so ORC-09 (deste plano) foi corrigido para Complete. || FECHADA em 28/09/2026, sem alteracao de codigo: ja nao reproduz — a tabela de rastreabilidade do REQUIREMENTS.md mostra ORC-07 e ORC-10 como Complete (linhas 543 e 546). Corrigido em algum plano posterior ao registro; a janela ficou aberta a toa.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-26T23:18:22.102Z",
    "resolved_at": "2026-09-28T00:02:26.665Z"
  },
  {
    "id": 44,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "db/migrations/0019_parametros-iniciais.sql",
    "line": 20,
    "description": "A semente de parametros_precificacao usa vigente_desde = current_date do Postgres (UTC, sem TZ definida no contêiner), enquanto a leitura em lib/precificacao/consultas.ts::parametrosVigentes usa hojeEmBrasilia (America/Sao_Paulo, UTC-3). Entre 21:00 e 23:59:59 BRT (00:00-02:59:59 UTC do dia seguinte), current_date ja avancou um dia mas hojeEmBrasilia ainda esta no dia anterior — a query 'vigente_desde <= hoje' nao acha nenhum parametro, e toda tela que depende de parametrosVigentes (Pecas, editor de Orcamento) mostra 'Nao deu para carregar os parametros'. Reproduzido de forma deterministica (workers=1, isolado por --grep) as 00:08-00:31 UTC de 2026-09-27, tanto em precificacao-pecas.spec.ts @vazio-global quanto no editor de orcamentos. Fora do escopo de arquivos do plano 04.5-10 (fotos) — achado ao depurar o e2e orcamentos-fotos, nao corrigido aqui.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T00:33:48.319Z",
    "resolved_at": "2026-09-27T04:11:14.798Z"
  },
  {
    "id": 45,
    "kind": "unrun-verify",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-pdf.spec.ts",
    "line": null,
    "description": "Paridade de conteudo (caso b) e acentuacao (caso c) do PDF gerado nao sao lidas do ARQUIVO final: pdfjs-dist (a biblioteca de extracao de texto oferecida no checkpoint da Tarefa 1) nao foi instalada porque a resposta do dono confirma tres pacotes para a fase inteira e nao confirma explicitamente essa quarta -- na duvida, o executor nao supoe autorizacao. Cobertura real: teste unitario de estrutura (orcamentos-documento-cliente.test.ts) prova que tela e PDF leem do MESMO DocumentoDoCliente, e o e2e confere o arquivo baixado por assinatura/tamanho/Content-Disposition, nunca o texto interno. Verificacao humana pendente para o plano 13: abrir o PDF de um orcamento com 'Jose Conceicao' e conferir visualmente os acentos.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T01:29:07.118Z",
    "resolved_at": null
  },
  {
    "id": 46,
    "kind": "unrun-verify",
    "phase": "04.5-financeiro-parte-2",
    "file": "lib/orcamentos/pdf/documento.tsx",
    "line": null,
    "description": "A ausencia de custo/minimo/margem/hora no PDF (caso d, D-24/D-29) e provada por CONSTRUCAO -- DocumentoDoCliente nao tem esses campos (teste unitario varre por nome de chave), documento.tsx so consome esse tipo (acceptance_criteria confere por grep que nao ha chamada a contasDoOrcamento/resultadoDaFicha/calcularPeca) -- mas nenhum teste le o BYTE do PDF final procurando esses numeros, porque pdfjs-dist nao foi instalado (ver entrada irma sobre paridade/acentuacao). Verificacao humana pendente para o plano 13.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T01:29:16.936Z",
    "resolved_at": null
  },
  {
    "id": 47,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/cadastros-contas-fixas.spec.ts",
    "line": 201,
    "description": "cria, desativa, gera duas vezes sem duplicar... falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): locator.click no botao Desfazer estourou 30s. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35 -- arquivo da Fase 04.4, fora do escopo de arquivos do plano 04.5-13; nao corrigido (sem causa raiz pequena e obvia). || NOTA de 28/09/2026: esta janela e a #58 descrevem O MESMO teste, na MESMA linha (cadastros-contas-fixas.spec.ts:201), com veredito oposto — a #47 diz que passou isolada, a #58 diz que falhou isolada tambem. E o CI do commit e0a0290 passou verde em 27/09 as 19h31. Os tres nao podem estar certos ao mesmo tempo. Resolver junto, nao separado. || RESOLVIDA a contradicao em 28/09/2026, com medicao: reexecucao isolada (npm run test:e2e --workers=1 --grep) FALHOU. A #58 esta certa e esta janela esta errada — o que a #47 registrou como \"passou isolada\" nao reproduz. Tratar como duplicata da #58 e resolver la.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T03:28:00.123Z",
    "resolved_at": "2026-09-28T00:10:03.556Z"
  },
  {
    "id": 48,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/financeiro-mes.spec.ts",
    "line": 167,
    "description": "areas (criterio 1 do ROADMAP): venda de tres areas paga no Pix aparece cada valor na sua area -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): a tabela do Mes mostrou R$ 0,00 nas tres areas em vez dos valores lancados. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35 -- arquivo da Fase 04.4, fora do escopo de arquivos do plano 04.5-13; nao corrigido (sem causa raiz pequena e obvia).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T03:28:13.487Z",
    "resolved_at": null
  },
  {
    "id": 49,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-aprovacao.spec.ts",
    "line": 304,
    "description": "(f) cancelar a venda no Financeiro nao apaga nem reabre o orcamento -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): toHaveURL(/aviso=cancelado/) expirou em 10s mesmo com o log mostrando a navegacao correta acontecendo (\"navigated to ...aviso=cancelado...\"), a URL assentou em .../financeiro?aba=caixa sem o parametro no momento da checagem. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao/corrida de confirmacao de navegacao ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35; nao corrigido (sem causa raiz pequena e obvia).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T03:28:14.050Z",
    "resolved_at": "2026-09-27T14:18:14.697Z"
  },
  {
    "id": 50,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-fotos.spec.ts",
    "line": 181,
    "description": "(g) a 320px as tres celulas cabem sem rolagem horizontal, e todo alvo de toque mede ao menos 44px -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): getByTestId('foto-celula') veio 1 em vez de 3 (upload/reducao de duas fotos nao concluiu a tempo sob a carga da suite inteira). Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao de servidor Next unico ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35; nao corrigido (sem causa raiz pequena e obvia). || RECLASSIFICADA em 28/09/2026: NAO e contencao. Reexecucao isolada com --workers=1 falhou nos DOIS projetos (desktop e celular): page.getByTestId(\"fotos-grade\").getByTestId(\"foto-celula\") resolveu para 0 elementos, esperando 3, com 14 tentativas do locator. As fotos nao aparecem na grade nessa execucao. O dono verificou o envio de foto em producao no item 15 da caminhada (27/09) e PASSOU, entao o produto funciona — a suspeita recai sobre o preparo do teste (as tres fotos nao chegam a existir antes da asercao) ou sobre o volume de fotos no ambiente efemero. Merece diagnostico proprio, com causa raiz, antes de qualquer conserto.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T03:28:31.255Z",
    "resolved_at": null
  },
  {
    "id": 51,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-tracador.spec.ts",
    "line": 95,
    "description": "todo botao visivel da aba Orcamentos mede ao menos 44px de altura -- falhou sob a varredura completa (npm run test:e2e sem --grep, 8 workers, plano 04.5-13): page.locator('main').getByRole('button').count() veio 0 (pagina nao terminou de renderizar sob a carga), junto de 'The destination stream closed early' no log do servidor Next -- mesmo sintoma ja registrado em WINDOWS #35 para o teste irmao (linha 63) do MESMO arquivo. Reexecucao isolada (--workers=1) passou limpa. Nao corrigido: mesma classe de contencao de servidor unico sob carga, sem causa raiz pequena e obvia neste arquivo. || CONFIRMADA como contencao em 28/09/2026: reexecucao isolada com --workers=1 passou limpa.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T03:28:31.805Z",
    "resolved_at": null
  },
  {
    "id": 52,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-revisao.spec.ts",
    "line": 181,
    "description": "(a) parametro dedicado sobe o minimo -- falhou sob carga de 8 workers (npm run test:e2e --grep, reverificacao do plano 04.5-13 apos corrigir a poluicao de parametro entre specs): toHaveURL(/aviso=orcamento-enviado/) expirou em 10s mesmo com o log mostrando a navegacao correta acontecendo (\"navigated to ...aviso=orcamento-enviado...\"), a URL assentou sem o parametro no momento da checagem. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao/corrida de confirmacao de navegacao ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35; nao corrigido (sem causa raiz pequena e obvia).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T03:28:42.694Z",
    "resolved_at": "2026-09-27T14:18:15.178Z"
  },
  {
    "id": 53,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-revisao.spec.ts",
    "line": 190,
    "description": "Poluicao de parametro global entre arquivos de spec, achado real da varredura completa (plano 04.5-13, Tarefa 1): orcamentos-revisao.spec.ts/orcamentos-ciclo.spec.ts/precificacao-parametros.spec.ts sobem parametros globais (preco_folga_negociacao/preco_imposto_sobre_venda, forno_desgaste_por_fornada/forno_tarifa_energia, material_argila/material_esmalte/trabalho_hora) sem desfazer, corrompendo o custo/minimo/selo que precificacao-ficha.spec.ts/precificacao-pecas.spec.ts esperam calculado com os valores PADRAO da semente. Corrigido com test.afterAll restaurando cada parametro direto no banco (commit fix(04.5-13) desta sessao) -- a poluicao DETERMINISTICA (ordem alfabetica de arquivo) foi eliminada e confirmada por reexecucao isolada e em grupo repetidas vezes. RESIDUAL: sob os 8 workers default do npm run test:e2e (fullyParallel, sem dependencies entre estes arquivos), uma janela de corrida ainda existe -- o teste que sobe o parametro e o afterAll que restaura rodam no MESMO arquivo/worker, mas um ARQUIVO DIFERENTE pode ler o parametro num worker concorrente durante a janela em que ele esta elevado, antes do afterAll disparar. Eliminar de vez exigiria uma cadeia de dependencies (mesmo padrao de vazio-celular/vazio-desktop/vazio-historico do playwright.config.ts) sequenciando estes cinco arquivos -- mudanca estrutural de infraestrutura de teste, fora do escopo deste plano de fechamento; frequencia observada baixa (1 em ~4 varreduras completas) e sempre no SELO/etiqueta de faixa, nunca no numero de custo (esse lado ja fechou).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T03:58:55.587Z",
    "resolved_at": "2026-09-27T14:18:14.194Z"
  },
  {
    "id": 54,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "components/amassa/precificacao/lista-pecas.tsx",
    "line": 264,
    "description": "Achado 8 da verificacao humana (27/09/2026, dono, no celular): o botao Apagar de uma peca EXCLUSIVA nao fazia nada -- palavras dele: 'peca exclusiva quando clica em Apagar a tela da peca fecha mas nao apaga nada, apenas esconde a lista das pecas exclusivas novamente'. Causa raiz: ConfirmarApagarPeca era montado DENTRO do map de fichasVisiveis; sem ?exclusivas=1 a ficha exclusiva nao esta nessa lista, o dialogo nao existe no DOM, ninguem le o ?apagarPeca= e o botao so navega para o nada. A Server Action apagarFicha e o confirmar-apagar-peca.tsx sempre estiveram corretos -- nunca rodavam. Corrigido no plano 04.5-14, Tarefa 1 (commit e5daf10): dialogos montados a partir de TODAS as fichas, fora do map do que aparece na lista, e hrefDaAbaPecas (lib/precificacao/navegacao.ts, modulo puro e testado) preservando ?exclusivas nas quatro navegacoes que o descartavam. Testes novos (i) e (j) em tests/e2e/precificacao-pecas.spec.ts, com RED provado antes.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T18:23:58.743Z",
    "resolved_at": "2026-09-27T18:24:28.989Z"
  },
  {
    "id": 55,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "components/amassa/orcamentos/veredito-da-aprovacao.tsx",
    "line": 37,
    "description": "Achado 14 da verificacao humana (27/09/2026, dono, no celular): o veredito do orcamento aprovado seguia verde dizendo 'ordem aberta na Producao' depois de a encomenda ser cancelada -- palavras dele: 'na producao ela fica cancelada e vai pro historico, mas tambem segue em verde com ordem aberta na Producao'. Causa raiz: textoVeredito(numero, encomendaId !== null) -- o parametro se chama ordemAberta mas respondia 'o id existe?'; encomendas.status nao era lido em ponto nenhum desse caminho e obterOrcamentoParaEdicao nem importava a tabela encomendas. Lacuna, nao regressao: este lado do criterio 14 nunca foi implementado. A outra metade (aviso de venda cancelada) passou -- o dono a encontrou depois, abaixo do bloco verde. Corrigido no plano 04.5-14, Tarefa 2 (commit fcc072a): leftJoin com encomendas, vereditoDaAprovacao em lib/orcamentos/situacao.ts (modulo puro e testado), FRASE_ENCOMENDA_CANCELADA_AVISO, cor do bloco descendo de sucesso para atencao quando venda OU ordem foi cancelada, e revalidatePath('/financeiro') em cancelarEncomenda. Teste novo (j) em tests/e2e/orcamentos-aprovacao.spec.ts, com RED provado antes.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-27T18:23:59.229Z",
    "resolved_at": "2026-09-27T18:24:29.468Z"
  },
  {
    "id": 56,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "lib/orcamentos/consultas.ts",
    "line": 38,
    "description": "Lacuna conhecida e NAO corrigida (fora do escopo do criterio 14, decisao registrada em 04.5-14-PLAN.md): listarOrcamentos (a lista da aba Orcamentos) nao faz join com documentos nem com encomendas, entao um orcamento cuja venda ou cuja encomenda foi cancelada e indistinguivel de um saudavel no cartao da lista. O criterio 14 ('aviso nos dois lados') quer dizer orcamento e venda, nao lista e editor -- o aviso existe nos dois lados, e no editor agora cobre tambem a encomenda. Resolver isto exigiria dois leftJoin a mais numa consulta de lista e uma decisao de desenho sobre o que o cartao mostra; nenhuma das duas coisas foi pedida.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T18:23:59.705Z",
    "resolved_at": null
  },
  {
    "id": 57,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/orcamentos-aprovacao.spec.ts",
    "line": 364,
    "description": "(i) a 320px o dialogo de aprovacao rola no corpo (backstop com oito pecas) -- falhou sob a varredura completa do plano 04.5-14 (npm run test:e2e sem --grep, 8 workers, desktop): dentro de acrescentarPecaExclusiva, depois do Salvar, a URL ficou em ...&peca=novo e o toHaveURL(/orcamento=<id>$/) expirou em 10s. Reexecucao isolada (--workers=1) passou limpa. Mesma classe de contencao/corrida de confirmacao de navegacao ja registrada em WINDOWS #12/#21/#22/#26/#27/#29/#30/#31/#32/#35/#49; nao corrigido (sem causa raiz pequena e obvia). || CONFIRMADA como contencao em 28/09/2026: reexecucao isolada com --workers=1 passou limpa.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T18:24:16.621Z",
    "resolved_at": null
  },
  {
    "id": 58,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "tests/e2e/cadastros-contas-fixas.spec.ts",
    "line": 201,
    "description": "Achado REAL da varredura completa do plano 04.5-14, e NAO e contencao: o teste 'cria, desativa, gera duas vezes sem duplicar, paga o aluguel...' falhou na varredura E de novo em reexecucao isolada com --workers=1. O clique em 'Desfazer' (linha 201) depende do toast de 7 segundos (D-03) ainda estar na tela, mas entre pagar e clicar o teste abre o detalhe do extrato, faz tres asseroes e fecha o dialogo -- tudo dentro da janela de 7s. O instantaneo da falha mostra a regiao de avisos vazia: o toast ja tinha expirado. Fragilidade de teste, nao defeito de produto (o Desfazer funciona; so nao da tempo). Fora do escopo de arquivos do plano 04.5-14 (area da Fase 04.4, Cadastros) -- registrado sem corrigir, conforme a regra de limite de escopo do CLAUDE.md. Conserto provavel: clicar em Desfazer logo apos o pagamento e so entao abrir o extrato.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T18:24:17.096Z",
    "resolved_at": null
  },
  {
    "id": 59,
    "kind": "deviation",
    "phase": "04.5-financeiro-parte-2",
    "file": "components/amassa/precificacao/dialogo-ficha.tsx",
    "line": 409,
    "description": "Achado da verificacao do Cowork (27/09/2026): \"ao salvar peca nova a tela reabre a mesma peca em edicao em vez de voltar a lista\". Confirmado — a URL de volta leva ?peca=<id>, que e o parametro que ABRE a ficha, enquanto o comentario logo acima prometia \"volta para a lista de pecas\". RESOLVIDO em 28/09/2026 SEM mudanca de comportamento: o dono decidiu que reabrir a ficha esta certo — numa tela de precificacao ele acabou de digitar medidas e quer ver o numero, o selo e a barra de custo sem procurar a linha. Quem mentia era o comentario, e foi ele que mudou. Nota historica: cheguei a aplicar a mudanca de codigo e revertí ao descobrir que o teste (b) de precificacao-pecas.spec.ts depende do comportamento atual (le o id da peca criada de url.searchParams.get(\"peca\"), e esse id alimenta casos posteriores) — o que tirou a mudanca da categoria \"opcao claramente recomendada\" e levou a pergunta ao dono.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-28T00:26:54.662Z",
    "resolved_at": "2026-09-28T00:26:54.663Z"
  },
  {
    "id": 60,
    "kind": "deviation",
    "phase": "04.6-gestao-inicio-e-site-publico",
    "file": "docker/Dockerfile",
    "line": 31,
    "description": "A construcao da imagem depende de fonts.googleapis.com estar no ar: app/layout.tsx carrega tres fontes por next/font/google (Inter, Archivo Narrow e, desde o plano 04.6-03, Fraunces) e o RUN npm run build do docker/Dockerfile as baixa dentro do conteiner. Falhou por isso no run 36443052672 (28/09/2026, push do commit 72b8881): 14x \"Module not found: Cannot resolve @vercel/turbopack-next/internal/font/google/font\", que e o sintoma do Turbopack quando a busca da fonte falha. NAO e defeito de codigo: o comando exato do CI (docker build --target app --no-cache, inclusive com NEXT_PUBLIC_SITE_URL vazia) foi reproduzido na maquina do dono e PASSOU, npm run build correndo 90,8s dentro do Alpine, zero erro de fonte. Primeira ocorrencia deste modo em 20 runs (as outras 4 falhas recentes foram do Playwright). Distinguir transitorio de permanente exige re-executar o pipeline, e isso e do dono porque verde encadeia implantar. Correcao duravel possivel, NAO aplicada por contrariar decisao travada: versionar os arquivos de fonte e usar next/font/local — D-10 decidiu de proposito que nenhum arquivo de fonte e versionado, entao reabrir isso e decisao do dono.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-28T15:43:18.429Z",
    "resolved_at": null
  },
  {
    "id": 61,
    "kind": "todo",
    "phase": "04.6",
    "file": "conteudo/site.ts",
    "line": null,
    "description": "Textos do site publico ainda com colchetes [...] e a faixa 'em construcao' no ar; o dono declarou em 29/09/2026 (VERIFICACAO-HUMANA item 14) que vai entregar um pacote unico de alteracoes de texto — pendencia declarada dele, nao defeito; fecha quando o lote entrar",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-28T23:41:02.301Z",
    "resolved_at": null
  },
  {
    "id": 62,
    "kind": "deviation",
    "phase": "06.1",
    "file": "tests/e2e/financeiro-mes.spec.ts",
    "line": 114,
    "description": "'areas (criterio 1): venda de tres areas paga no Pix' (celular) falhou na varredura completa do plano 06.1-15 (8 workers) E na execucao serial seguinte (--workers=1, 968 testes): o Mes de 2021-10 mostrou R$ 0,00 nas quatro areas. Passou isolado (so a cadeia vazio-*). Nenhum arquivo do Financeiro da venda ou do Mes mudou na fase. Hipotese nao provada: o teste preenche Data/busca antes da hidratacao do PainelVenda (useState(hoje)) quando o banco esta cheio, e a venda sai com a data de hoje; esperarVendaLancada so confere a URL ?aba=venda. Proximo passo: waitForLoadState networkidle + toHaveValue da Data antes de Lancar venda, como o helper de despesa do mesmo arquivo ja faz.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-30T11:44:34.384Z",
    "resolved_at": null
  }
]
````
