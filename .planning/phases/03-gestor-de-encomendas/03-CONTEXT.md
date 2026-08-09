# Phase 3: Gestor de Encomendas - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega o **módulo de Encomendas real, multiusuário e persistido em Postgres**, substituindo o
protótipo `gestor-ceramica.html`: as três tabelas (`encomendas`, `encomenda_itens`,
`encomenda_etapas`), o módulo puro `lib/encomendas/cronograma.ts` com testes escritos antes do
código, as Server Actions de CRUD transacional, o Gantt no desktop, a lista vertical no celular,
a página de detalhe, o formulário com pré-visualização ao vivo, filtros/busca/ordenação, os
estados vazio/carregando/erro e o teste ponta a ponta.

Corresponde à **M2** de `amassa-plataforma/03-ROADMAP.md`.
Requisitos: **ENC-01 a ENC-14**.

**Sobre o ENC-14 (impressão):** não veio da M2 — surgiu nesta discussão e foi dobrado nesta fase por
decisão do dono (D-18). Já registrado em `.planning/ROADMAP.md` §"Phase 3" (requisito e critério de
sucesso 12) e em `.planning/REQUIREMENTS.md`. **`amassa-plataforma/03-ROADMAP.md` §M2 não o menciona
e não será atualizado** — aquele documento é a especificação original; quando os dois divergirem,
`.planning/` é a fonte para planejar.

**Fora desta fase:**

- **Progresso por item** — o check de "modelado / queimado / finalizado" em cada item foi levantado
  e conscientemente adiado (ver Ideias Adiadas). As 6 etapas continuam pertencendo à **encomenda**,
  nunca ao item.
- **Ficha de cadastro de cliente, valores, sinal, fotos e anexos** — recusados em `PROJECT.md`.
  `cliente_nome` continua texto livre.
- **Atualização em tempo real entre dispositivos** — ENC-12 é explicitamente "ao recarregar a
  página". Nada de WebSocket, polling ou revalidação automática.
- **Ligar `queima1`/`queima2` a uma fornada concreta** do módulo de Fornos (Fase 4). Aqui os dois
  são apenas marcos de 24h no cronograma — `00-BRIEFING.md` já registra isso.
- **Consumo de material por encomenda** — a movimentação de estoque que referencia uma encomenda
  nasce na Fase 6.

</domain>

<decisions>
## Implementation Decisions

### Arquitetura de telas

- **D-01: A encomenda tem página própria em `/encomendas/[id]`.** O Gantt e a lista viram índice;
  clicar abre uma página de detalhe com os itens, a trilha das 6 etapas e as ações. Server
  Component, URL compartilhável, botão voltar do celular funcionando, e o Gantt do desktop não
  precisa disputar espaço com os itens.
  — **Reversibility:** reversible — colapsar a página numa folha depois é mover JSX.

- **D-02: O índice alterna Gantt e lista vertical apenas por CSS** (`hidden md:block` no Gantt,
  `md:hidden` na lista). Os dois vão no HTML e um fica escondido. Zero JavaScript de detecção, zero
  risco de piscar antes de hidratar, e o Playwright cobre os dois só trocando o viewport — que é
  exatamente como os projetos desktop e celular já rodam desde a Fase 1. Consequência aceita: o DOM
  do Gantt viaja para o celular sem ser exibido. **Não usar `hooks/use-mobile.ts` para isso** — o
  hook existe (veio com o Sidebar do shadcn) e seria o erro fácil de cometer.
  — **Reversibility:** reversible.

- **D-03: O formulário é modal centralizado no desktop e folha que sobe de baixo no celular
  (`04-DESIGN-SYSTEM.md` §6 — não é escolha, é contrato), e tem endereço na URL**:
  `/encomendas?nova` e o equivalente para editar. Abrir e fechar é derivado do parâmetro de busca.
  No celular o botão voltar do sistema fecha o formulário em vez de sair da tela inteira — que é o
  gesto de reflexo de quem usa o telefone em pé. Recarregar reabre onde estava.
  — **Reversibility:** reversible — trocar por `useState` é local.

- **D-04: A página de detalhe mostra as 6 etapas como trilha vertical com as datas**, cada uma com
  sua cor, duração, início e fim, marcos como losango e a etapa de hoje destacada. Mesma
  implementação no desktop e no celular. Não repetir o Gantt ali: uma barra sozinha num campo largo
  de dias desperdiça a tela, e no celular o Gantt nem existe.
  — **Reversibility:** reversible.

### Ciclo de vida, cancelamento e exclusão

- **D-05: `concluida` é sempre marcada à mão — nunca deduzida da data final.** Uma encomenda cuja
  data passou continua `em_producao`, e isso é informação útil: atraso acontece, e o sistema
  marcando "concluída" sozinho esconderia justamente o que precisa ser visto. É o que o schema já
  assume (`status` é coluna, não cálculo).
  — **Reversibility:** reversible.

- **D-06: Concluir tira a encomenda do Gantt e a manda para o histórico.** O Gantt desenha apenas
  `rascunho` e `em_producao`. Isso é o que impede a timeline de esticar indefinidamente conforme os
  meses passam — resolve o problema na origem, sem regra de recorte por data.
  — **Reversibility:** reversible.

- **D-07: O histórico é um filtro do próprio índice, renderizado como lista — inclusive no
  desktop.** Trocar o filtro para "concluídas" (ou "canceladas") troca o conteúdo por uma lista com
  nome, cliente, período e itens. Nenhuma rota nova, e ENC-10 (filtrar por status) é satisfeito
  pelo mesmo mecanismo. Gantt de coisa que já acabou não ajuda a decidir nada.
  — **Reversibility:** reversible.

- **D-08: Cancelar é o caminho normal; excluir é para engano.** Cliente desistiu → `cancelada`: sai
  do Gantt, vai para o histórico junto das concluídas, continua consultável. Excluir fica para
  "criei duplicado" ou "digitei tudo errado". Hierarquia visual obrigatória: cancelar à vista,
  excluir um passo mais fundo — dois botões parecidos com consequências muito diferentes, numa tela
  pequena e com a mão suja, é pedido de acidente.
  — **Reversibility:** reversible.

- **D-09: A confirmação de exclusão nomeia o que se perde**, no formato da §7 do design system:
  *"Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão apagados."* É a implementação de
  UI-08, que a Fase 2b registrou como convenção obrigatória e deixou para a primeira fase que
  tivesse algo a excluir. **`alert-dialog` e `sonner` entram nesta fase** (adiados em D-07 da 2b).
  — **Reversibility:** reversible.

- **D-10: `rascunho` é a encomenda ainda não fechada, e aparece no Gantt com aparência atenuada**
  (opacidade menor ou hachurado). Serve ao planejamento de capacidade — "se essa fechar, cabe junto
  com as outras?" — que é boa parte do valor de um Gantt. Custa um tratamento visual a mais no
  desenho das barras.
  — **Reversibility:** reversible.

### Filtros, busca, ordenação e escopo da timeline

- **D-11: Filtro, ordenação e busca acontecem no cliente, sobre a lista já carregada.** O servidor
  manda as encomendas de uma vez e o navegador filtra — resposta instantânea a cada tecla, sem ida
  ao servidor. Duas consequências aceitas conscientemente: o índice vira Client Component (a página
  continua sendo Server Component que busca os dados e passa para baixo), e **recarregar a página
  perde o filtro**. **Ponto a rever se um dia o volume crescer:** hoje o ateliê tem dezenas de
  encomendas; se passar de alguns milhares, mover para parâmetros de URL com filtro no banco.
  — **Reversibility:** costly — inverter obriga a mover a busca para consulta SQL e a repensar a
  fronteira servidor/cliente do índice inteiro.

- **D-12: Ordena por data de início por padrão, com seletor oferecendo "próxima etapa mais perto"
  (urgência) e "nome".** A data de início é o padrão porque num Gantt é assim que a leitura
  funciona — as barras descem em escada e o fluxo do tempo fica visível. O seletor é o que cumpre o
  "ordenadas" do ENC-10.
  — **Reversibility:** reversible.

- **D-13: A busca varre nome, cliente E a descrição dos itens, ignorando acento e maiúscula.**
  Digitar `colecao verao` acha «Coleção Verão»; digitar `caneca` acha toda encomenda que tem
  caneca dentro. Vai um passo além do texto do ENC-10 ("nome ou cliente") por decisão do dono.
  Com o filtro rodando no navegador, ignorar acento é uma normalização de string — **não usar
  `unaccent()`/`nome_normalizado()` no banco para isto**, que é a armadilha documentada no §0 do
  modelo de dados e aqui não se aplica. Consequência: **os itens precisam vir carregados junto da
  lista do índice**, não só na página de detalhe.
  — **Reversibility:** reversible.

- **D-14: Quando o filtro ou a busca reduz a lista, a timeline reajusta o intervalo ao que sobrou**,
  mantendo a quinzena de folga em cada ponta que o protótipo já faz. Filtrou duas encomendas de
  março, vê março — sem rolar por meses vazios. O cálculo do intervalo roda no cliente junto do
  filtro, como decorrência de D-11.
  — **Reversibility:** reversible.

### Edição de durações e itens

- **D-15: Dois caminhos de escrita, com uma regra dura.** O formulário completo (com
  pré-visualização ao vivo) **e** um ajuste rápido de mais/menos dia em cada etapa da trilha
  vertical na página de detalhe, que salva sozinho — "a secagem vai precisar de mais dois dias"
  resolve em dois toques, em pé, no ateliê. **Os dois caminhos passam obrigatoriamente pelo mesmo
  esquema Zod e pelo mesmo `lib/encomendas/cronograma.ts`.** Duas validações separadas para a mesma
  regra divergem — é questão de tempo, e quando divergem ninguém sabe qual está certa. O ajuste
  rápido respeita a restrição `marcos_zero_ou_um`: em marco ele é interruptor, não mais/menos.
  — **Reversibility:** costly — remover o segundo caminho depois exige achar todos os pontos que o
  chamam e garantir que nenhum comportamento dependia só dele.

- **D-16: Itens se reordenam por setas para cima e para baixo**, com alvo de 44px, gravando na
  coluna `ordem` que o schema já tem. Funciona com o dedo em pé e por teclado, e **não entra
  biblioteca de arrastar-e-soltar no projeto**. A ordem é manual justamente para que se possa pôr
  os itens na sequência do fluxo de produção.
  — **Reversibility:** reversible.

- **D-17: O rodapé com duração total e data de conclusão (ENC-11) aparece no formulário, tanto
  criando quanto editando**, recalculando enquanto se digita. É o que torna o ajuste de duração
  confiável: vê-se o efeito antes de salvar, em vez de descobrir depois no Gantt. Está na lista do
  §8 do design system como detalhe a preservar literalmente do protótipo.
  — **Reversibility:** reversible.

### Impressão — requisito novo

- **D-18: Botão de imprimir gerando uma folha prática de "o que tem e em que pé está" (ENC-14).**
  Rota `/encomendas/imprimir` com `@media print` — **sem biblioteca de PDF, sem dependência nova,
  sem custo recorrente**, coerente com a restrição de custo do projeto. O alvo é **uma folha A4**.
  Duas coisas o planejador precisa resolver, não inventar na hora: (a) qual o **comportamento acima
  de ~12–15 encomendas ativas** — encolher o texto abaixo do legível não é opção, então ou é
  segunda página ou é recorte explícito; (b) a folha usa a **ordenação e o filtro vigentes na tela**
  ou tem escopo próprio fixo. Registrar a escolha no plano.
  — **Reversibility:** reversible.

### Claude's Discretion

O dono foi explícito: *"vamos seguindo e depois com os sistemas funcionando vou ajustando conforme
utilizo para perceber melhor o que ajustar."* Tratar o que segue como decisão do executor, sujeita a
revisão na verificação da fase — e **preferir a solução mais simples que funcione**, porque ela vai
ser ajustada com uso real de qualquer forma:

- Texto exato dos rótulos, dos avisos e das mensagens de erro (seguindo a voz da §9 — afetiva,
  sensorial, direta, nunca corporativa).
- Como o filtro é apresentado no celular (visível o tempo todo vs. dentro de um botão) e o que a
  tela mostra quando o filtro não acha nada (é estado vazio distinto do "A roda ainda não gira").
- Estrutura de arquivos dentro de `app/(app)/encomendas/`, nomes dos componentes e onde mora cada
  Server Action.
- Ícones do `lucide-react` para as ações.
- Se dá para reabrir uma encomenda concluída, e se há aviso ao concluir algo cuja data ainda não
  chegou.
- O tratamento visual exato do rascunho atenuado (opacidade vs. hachura).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação do módulo — leitura obrigatória

- `amassa-plataforma/00-BRIEFING.md` §5 — o que o protótipo `gestor-ceramica.html` já faz e **deve
  ser preservado integralmente**: as 6 etapas com cores e padrões, cascata de datas, 18px/dia,
  quinzenas, losango para marco, rolagem automática até o "Hoje", etapas de duração 0 não
  desenhadas, ordenação por data de início. Traz também o que muda em relação ao protótipo (itens,
  persistência, status, etapa atual derivada, versão mobile) e as regras que o agente precisa
  respeitar (módulo puro, fuso, fim de etapa **exclusivo**).
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §1 — o SQL literal das três tabelas, os índices, a
  restrição `marcos_zero_ou_um`, os padrões `producao 3 · secagem 6 · queima1 1 · esmaltacao 1 ·
  queima2 1 · entrega 1`, e a regra de que **as datas não são armazenadas**.
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §0 — a base comum: `hoje_brasilia()` (o container do
  Postgres roda em UTC e `current_date` devolve o dia errado à noite), `atualizado_em`, os dois
  papéis de banco, e a ausência de RLS.
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §6 — ordem das migrações e o fluxo de trabalho com
  Drizzle (editar `db/schema.ts` → gerar → aplicar à mão no servidor, depois do backup).
- `amassa-plataforma/03-ROADMAP.md` §"M2" — as 9 fases do milestone, que viram os planos desta
  fase, e os critérios de aceite.

### Design

- `amassa-plataforma/04-DESIGN-SYSTEM.md` §8 — "O que preservar dos protótipos, literalmente",
  bloco **Encomendas**: 18px/dia, quinzenas, marcos como losango, **rótulo da etapa só acima de
  46px**, timeline abrindo rolada no "Hoje", "A roda ainda não gira", rodapé do formulário.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §6 — a tabela de adaptações obrigatórias para celular. A
  linha de Encomendas define o cartão da lista vertical (nome, cliente, trilha das 6 etapas como
  segmentos, etapa atual destacada, dias restantes) e a de Formulários fixa modal no desktop /
  folha no celular. **A regra dura da rolagem horizontal está aqui.**
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §7 — confirmação destrutiva nomeando o que se perde,
  avisos de 5 segundos, estados vazios com ação, esqueleto no formato do conteúdo.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §2 e §3 — as 6 cores de etapa (**NÃO ALTERAR**), já
  presentes como tokens desde a 2b, e a regra de que cor é informação: um botão terracota por tela.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §9 — a voz da interface.

### Escopo e requisitos

- `.planning/ROADMAP.md` §"Phase 3" — os 11 critérios de sucesso desta fase.
- `.planning/REQUIREMENTS.md` §"Módulo 1 — Gestor de Encomendas" — ENC-01 a ENC-13 na íntegra.
  **Ambos precisam ganhar o ENC-14 antes de planejar** (ver aviso em `<domain>`).

### Decisões anteriores que continuam valendo

- `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md` — a moldura que esta fase
  herda e substitui: **D-01** (cada tela nasceu com cabeçalho, estado vazio e botão inerte — a Fase
  3 troca o miolo e mantém a moldura), **D-06/D-07** (cada fase instala o shadcn que usa;
  `alert-dialog` e `sonner` estavam explicitamente reservados para esta fase), **D-11**
  (`components/ui/` é do shadcn, `components/amassa/` é código nosso).
- `.planning/PROJECT.md` §"Key Decisions" — em especial "Datas de etapa calculadas, nunca
  armazenadas" e a ordem de execução M0→M1→M2→M4→M3→M5→M7.

### Arquitetura

- `amassa-plataforma/01-ARQUITETURA.md` §3 — a estrutura de pastas prevista para `app/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`app/(app)/encomendas/page.tsx`** — a tela vazia da 2b, com `exigirUsuario()` na primeira linha
  e a frase "A roda ainda não gira." já escrita. É o ponto de partida literal: o miolo é
  substituído, a moldura fica.
- **`components/amassa/estado-vazio.tsx`** — Server Component com `titulo`, `corpo`, `rotuloBotao` e
  `notaBotao`. Esta fase troca o botão inerte por um que abre o formulário; o componente já prevê a
  ausência de `notaBotao`.
- **`components/amassa/cabecalho-pagina.tsx`** e **`estado-erro.tsx`** — cabeçalho e erro em
  linguagem humana já padronizados.
- **`lib/auth/exigir-usuario.ts`** — devolve o usuário; é o que preenche `criado_por`.
- **`db/schema.ts` + `db/migrations/`** — quatro migrações já aplicadas; `usuarios` existe e é o
  alvo da FK `criado_por`. A próxima migração é a das encomendas.
- **`tests/e2e/` com projetos desktop e celular separados** + `scripts/testar-e2e.mjs` — a
  infraestrutura do teste ponta a ponta (fase 9 da M2) já está montada e provada nos dois sentidos.
  `tests/e2e/apoio/preparar-usuario.ts` resolve o login nos testes.
- **`tests/fixtures/acoes/`** — fixtures que já exercitam Server Actions com e sem banco.
- **`npm run verificar-acoes`** — portão de máquina que confere `exigirUsuario()` na primeira linha,
  rodando sobre `app` e `lib`. As Server Actions novas passam por ele automaticamente.

### Established Patterns

- **Módulos puros e testados** (`lib/saude.ts`, `lib/backup/frescor.ts`): zero imports, recebem
  dados e devolvem dados. `lib/encomendas/cronograma.ts` é a aplicação mais importante desse padrão
  no projeto inteiro — e a M2 exige **testes escritos antes do código**.
- **Português nos nomes de arquivo e nas rotas, inglês nos identificadores de código.**
- **Verificar de fora, nunca aceitar o relato de quem executou** — a lição da Fase 1, e a razão de a
  2b ter provado a cor computada por teste em vez de conferência visual. Vale igual aqui para o
  18px/dia e a posição da linha de "Hoje".
- **`lint` com `--max-warnings=0`.**
- **Nenhum componente shadcn instalado além de `button`, `card`, `dropdown-menu` e os da casca** —
  esta fase instala o que usar (`alert-dialog`, `sonner`, `input`, `select`, `dialog`/`sheet`,
  `form`/`label`), nunca o kit inteiro.

### Integration Points

- `db/schema.ts` ganha os dois enums e as três tabelas; nova migração aplicada **à mão, depois de
  backup** (restrição de `PROJECT.md` — nunca pelo pipeline).
- `app/(app)/encomendas/` deixa de ser um único `page.tsx` e ganha `[id]/`, o formulário e o
  `/imprimir`.
- `middleware.ts` já protege tudo fora de `/login` e `/api/health` — as rotas novas nascem
  protegidas sem configuração. Conferir `lib/auth/rotas-publicas.ts` para não abrir nada por engano.
- O `Dockerfile` e o pipeline não mudam: nenhuma dependência de sistema nova.
- Tokens de cor de etapa já existem em `app/globals.css` desde a 2b — o Gantt os consome, não os
  redefine.

</code_context>

<specifics>
## Specific Ideas

- **`lib/encomendas/cronograma.ts` é a regra de negócio mais delicada do sistema** e a M2 pede os
  testes **antes** do código, cobrindo: cascata, **fim exclusivo** (a etapa seguinte começa no mesmo
  dia em que a anterior termina — mudar isso quebra a leitura do Gantt), marcos valendo 0 ou 1 e
  nunca outro valor, etapas de 0 dias ignoradas no desenho, duração total, data de conclusão, etapa
  atual em relação a hoje, virada de mês e ano bissexto.
- **O protótipo `gestor-ceramica.html` não está neste repositório.** `PROJECT.md` manda lê-lo antes
  de planejar. Cada detalhe dele que importa está transcrito em `00-BRIEFING.md` §5 e
  `04-DESIGN-SYSTEM.md` §8 — se o arquivo não aparecer, esses dois são a fonte, e o planejador deve
  registrar isso em vez de inferir comportamento.
- **O modo de falha desta fase é o cálculo de datas errar em silêncio.** Não quebra o build, não dá
  erro no console: a barra fica um dia fora do lugar e ninguém repara até uma queima ser marcada no
  dia errado. É a mesma classe de defeito que a 2b enfrentou com o `@theme inline` — e a resposta é
  a mesma: teste que mede, não conferência visual. Vale testar a posição em pixels da linha de
  "Hoje" e o 18px/dia, não só que "o Gantt aparece".
- **O ENC-09 (etapa atual e dias restantes) tem casos de borda que precisam de resposta explícita no
  plano:** encomenda cuja data de início ainda não chegou, encomenda cuja data final já passou mas
  continua `em_producao` (que D-05 torna comum), e encomenda cancelada. Nenhum deles tem "etapa
  atual" óbvia.
- **Esta é a primeira fase que escreve dados de produto no banco.** Toda Server Action começa por
  `exigirUsuario()`, toda entrada passa por Zod no servidor, e encomenda + itens + etapas gravam em
  **uma transação** (fase 3 da M2) — meia encomenda gravada é pior que nenhuma.

</specifics>

<deferred>
## Deferred Ideas

- **Progresso por item — check de "modelado / queimado / finalizado" em cada item.** Levantado nesta
  discussão e adiado conscientemente. Três razões: exige coluna ou tabela nova; deixa o ENC-09
  ambíguo (a etapa da encomenda passaria a derivar da data ou do item mais atrasado?); e muda o
  módulo de *planejamento de cronograma* para *acompanhamento de produção*, que é decisão de produto
  com peso próprio. **Antes de implementar, decidir qual pergunta ele responde de verdade** — por
  item ("as canecas já foram"), por quantidade ("28 das 40 prontas") ou por etapa — porque são
  desenhos bem diferentes. O dono vai usar o módulo algumas semanas e decidir com uso real.
- **Ligar `queima1`/`queima2` a uma fornada concreta** do módulo de Fornos — `00-BRIEFING.md` já
  registra que aqui eles são só marcos. Candidato natural depois da Fase 4.
- **Consumo de material por encomenda** — a movimentação de estoque com referência de origem nasce
  na Fase 6.
- **Arrastar a borda da barra no Gantt para ajustar duração** — considerado e recusado em D-15: o
  gesto mais direto que existe para essa operação, e de longe o mais caro de construir e testar, sem
  equivalente no celular, que é onde o sistema mais é usado.
- **Filtro persistido na URL** — recusado em D-11 a favor do filtro no cliente. É o caminho de volta
  se o volume crescer ou se compartilhar link filtrado passar a fazer falta.
- **Alternador explícito Gantt/Lista no desktop** — considerado e não escolhido em D-02: nenhum
  requisito de ENC-01 a ENC-14 pede, e é mais um estado para guardar e testar.

</deferred>

---

*Phase: 3-Gestor de Encomendas*
*Context gathered: 2026-08-09*
