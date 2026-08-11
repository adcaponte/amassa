---
schema_version: 1
open_count: 16
waived_count: 0
fixed_count: 7
total_count: 23
last_updated: 2026-08-11T21:15:34.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01-funda-o-e-primeiro-deploy | deviation | README.md |  | Protecao da branch main (bloquear force-push e exclusao) nao configurada — requer gh CLI/API do GitHub e credenciais nao disponiveis nesta execucao; acao pendente do dono, documentada em 01-02-SUMMARY.md | open |  | 2026-08-06T17:44:26.584Z |  |
| 2 | 02a-login-banco-base-e-backup | deviation | middleware.ts |  | callbackUrl do redirecionamento nao autenticado vaza o endereco interno do container (https://0.0.0.0:3000/...) em vez do dominio publico — confirmado de fora em producao (curl -I https://amassacerrado.com.br/encomendas). O cookie __Secure-authjs.callback-url resolve o dominio certo, mas o parametro de query da Location nao. Descoberto durante a verificacao externa do plano 02a-08 (Tarefa 3); fora do escopo de arquivos deste plano (nao toca middleware.ts nem lib/auth/) — precisa de investigacao dedicada em auth.config.ts / trustHost do Auth.js v5 | open |  | 2026-08-08T14:39:57.410Z |  |
| 3 | 02b | deviation | tests/e2e/autenticacao.spec.ts | 72 | Sexta tentativa de bloqueio trava/estoura timeout de forma pre-existente (confirmado via --grep-invert, independente da 02b-03) — ver deferred-items.md item 1 | open |  | 2026-08-08T18:37:46.938Z |  |
| 4 | 03 | deviation | .planning/phases/03-gestor-de-encomendas/deferred-items.md |  | shadcn 'form' registry item (radix-nova style, CLI 3.8.5) has no files to install; plan 06 must decide field vs hand-rolled wrapper vs direct react-hook-form before building the full formulario | fixed |  | 2026-08-09T14:15:31.870Z | 2026-08-09T18:53:21.639Z |
| 5 | 03 | deviation | tests/e2e/encomendas-indice.spec.ts |  | Teste 'com o banco vazio, a frase A roda ainda nao gira aparece uma unica vez' (ENC-13) so e confiavel quando rodado com --grep 'indice de encomendas' (comando de verificacao literal da Tarefa 3). No npm run test:e2e completo sem grep, outro arquivo de spec (encomendas.spec.ts) roda em paralelo e pode criar uma encomenda antes da asserção — limitação estrutural da suite (sem isolamento de banco por teste), nao um defeito do EstadoVazio/hrefBotao. | fixed |  | 2026-08-09T16:31:43.430Z | 2026-08-10T18:51:44.328Z |
| 6 | 03-gestor-de-encomendas | deviation | components/amassa/cabecalho-pagina.tsx |  | O <h1> do cabecalho de pagina (CabecalhoPagina) nao quebra em linha para um titulo muito comprido sem espaco (ex.: nome de encomenda de 120 caracteres colados) — causa rolagem horizontal da PAGINA inteira (nao dos dois alert-dialog de 03-05, que ja tem overflow-wrap:anywhere e foram provados por e2e). Descoberto durante 03-05 (pagina de detalhe usa o nome da encomenda como titulo); fora do escopo de arquivos deste plano (componente compartilhado da 2b). Precisa de break-words/overflow-wrap no h1 de cabecalho-pagina.tsx, revisavel numa fase futura de polimento. | open |  | 2026-08-09T17:35:18.070Z |  |
| 7 | 03-gestor-de-encomendas | unrun-verify | tests/e2e/encomendas-detalhe.spec.ts |  | E5 detalhe — vazio (backstop do plano 03-05): a trilha nunca deveria mostrar uma encomenda sem item (esquemaEncomenda exige >=1), mas isso depende do formulario recusar 0 itens (plano 06, ainda nao existe UI para isso) — nao verificado a mao nesta execucao; conferir quando o formulario de edicao de itens existir. | fixed |  | 2026-08-09T17:35:32.827Z | 2026-08-09T18:53:26.159Z |
| 8 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/confirmar-cancelar.tsx |  | E8 confirmar cancelar — erro (backstop do plano 03-05): o AlertDialog deve permanecer aberto mostrando o texto de falha sem fechar sozinho quando cancelarEncomenda falha; caminho implementado (estado erro + onOpenChange bloqueado por enviando) mas nao ha teste automatizado nem verificacao manual do caminho de falha nesta execucao (dificil de simular falha de rede/servidor de forma confiavel em e2e local). | open |  | 2026-08-09T17:35:33.701Z |  |
| 9 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/confirmar-excluir.tsx |  | E9 confirmar excluir — erro (backstop do plano 03-05): mesma situacao de E8 aplicada a excluirEncomenda — caminho implementado, sem prova automatizada nem verificacao manual do caminho de falha nesta execucao. | open |  | 2026-08-09T17:35:34.500Z |  |
| 10 | 03-gestor-de-encomendas | unrun-verify | components/amassa/encomendas/lista-itens.tsx |  | E11 reordenacao — carregando (backstop do plano 03-06): a seta clicada fica com opacidade reduzida e disabled (par inteiro) ate a resposta do servidor, o que deveria impedir que dois cliques rapidos na mesma seta gravem fora de ordem; nao verificado a mao nem com teste automatizado de concorrencia real nesta execucao (dificil simular corrida de rede confiavel em e2e local). | open |  | 2026-08-09T18:53:37.603Z |  |
| 11 | 03-gestor-de-encomendas | deviation | tests/e2e/encomendas-impressao.spec.ts |  | Teste 'sem nenhuma encomenda ativa' (folha de impressao) so e confiavel isolado (--grep impressao de encomendas); sob --grep encomenda/suite completa, outros specs criam encomendas em paralelo e o teste falha por contagem global nao-zero. Mesma classe estrutural de WINDOWS #5 (sem isolamento de banco por teste). | fixed |  | 2026-08-09T20:57:04.606Z | 2026-08-10T18:51:44.807Z |
| 12 | 03-gestor-de-encomendas | deviation | tests/e2e/sessao.spec.ts | 110 | 'depois de sair o botao de voltar cai em /login' falhou uma vez (celular) sob a concorrencia da varredura completa (npm run test:e2e sem grep, 8 workers) — timing de navegacao apos logout, nao reproduziu em execucao isolada nem em runs seguintes da mesma varredura. Arquivo da fase 02a, fora do escopo de arquivos do plano 03-08; achado durante a varredura completa que este plano e dono de executar (03-08-PLAN.md full_sweep_responsibility). | open |  | 2026-08-09T20:57:11.541Z |  |
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
| 23 | 04 | deviation | app/(app)/layout.tsx | 15 | Falha em exigirUsuario() no layout de rota protegida cai na tela padrão do Next.js ("Application error: a server-side exception has occurred"), não num estado de erro em linguagem humana. No App Router, error.tsx NÃO captura erro do layout do PRÓPRIO segmento: app/(app)/error.tsx é irmão do layout que falha, e não existe app/error.tsx nem app/global-error.tsx acima dele. Atinge TODA rota autenticada (Encomendas, Agenda, Fornos, Estoque, Orçamentos), não só Fornos. Achado no UAT da Fase 4 (teste 5, gap G-04-5) derrubando o Postgres local. As fronteiras de PÁGINA estão provadas funcionando (teste 13, método cirúrgico: renomear só a tabela fornos). Defeito pré-existente — layout é da Fase 2b. Decisão do dono no fechamento do UAT: corrigir como tarefa própria, fora da Fase 4. Corrigido pelo quick task 260811-uiy: app/error.tsx (fronteira acima do layout de (app), corrigida e observada por revisão estrutural e execução de app/(app)/error.tsx) e app/global-error.tsx (último recurso, prova estrutural — não observável em next dev). Prova COMPORTAMENTAL com o Postgres local parado NÃO pôde ser executada de forma automatizada nesta sessão (E2E_EMAIL_TESTE/E2E_SENHA_TESTE não definidos em .env.local para login manual fora do pipeline de teste); escalada ao roteiro manual do dono, registrado em 260811-uiy-SUMMARY.md. | fixed |  | 2026-08-11T20:55:00.000Z | 2026-08-11T21:15:34.000Z |

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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T14:39:57.410Z",
    "resolved_at": null
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
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T20:57:11.541Z",
    "resolved_at": null
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
  }
]
````
