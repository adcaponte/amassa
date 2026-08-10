# Phase 4: Contador de Queima - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega o **módulo de Fornos**: as três tabelas (`fornos`, `queimas`, `manutencoes`), o módulo puro
`lib/queimas/contador.ts` com testes escritos antes do código, as Server Actions, o índice de
cartões com medidor, o registro de queima em dois toques com "Desfazer", o registro de manutenção,
a página do forno, o banner agregado, os relatórios em Recharts e o cartão "Fornos em atenção" do
painel inicial.

Corresponde à **M4** de `amassa-plataforma/03-ROADMAP.md`. Requisitos **FOR-01 a FOR-13**.

**O nome do módulo engana e vale repetir:** não é um contador de queimas, é um **controle de vida
útil das resistências**. Cada forno acumula queimas; ao chegar no limite, precisa de manutenção; a
manutenção **zera o contador sem apagar nada** — o contador volta a zero por consequência do corte
de data, nunca por exclusão. É isso que permite responder "quantas queimas o Forno 01 já fez na
vida", que é pergunta diferente de "quantas desde a última troca de resistência".

**Fora desta fase:**

- **Ligar uma queima a uma encomenda.** `queima1`/`queima2` no módulo de Encomendas continuam sendo
  apenas marcos de 24h no cronograma — `00-BRIEFING.md` registra isso explicitamente. Nenhuma
  ligação entre os dois módulos nesta fase.
- **Consumo de material por queima** — a movimentação de estoque com referência de origem nasce na
  Fase 6.
- **Exclusão de forno pela aplicação.** O `on delete cascade` continua no schema como rede para
  exclusão manual no banco, mas a interface nunca oferece apagar um forno.
- A aba "Ajustes" do protótipo, com "definir seu nome" e "limpar dados" — ambos morreram: o usuário
  vem do login, e limpar dados é o oposto do propósito do módulo.

</domain>

<decisions>
## Implementation Decisions

### Estrutura de telas

- **D-01: Rotas de verdade, com um seletor no topo que parece aba mas navega.** `/queimas` mostra
  os cartões dos fornos, `/queimas/relatorios` os gráficos, `/queimas/[id]` a página de um forno.
  Cada tela tem endereço próprio, o botão voltar do celular funciona, e cada Server Component busca
  só o que a sua tela precisa — quem abre para registrar uma queima não paga o custo das agregações
  do relatório. É a mesma decisão da Fase 3 (D-01/D-02 de `03-CONTEXT.md`): uma convenção de
  navegação no projeto, não duas.
  — **Reversibility:** reversible.

- **D-02: Não existe tela de cadastro de fornos.** Cadastrar sai de um botão no índice; editar nome,
  descrição e limite, e desativar, acontecem na **página do próprio forno**, onde já estão o
  histórico e as manutenções. Uma tela a menos, e cada coisa junto do seu contexto.
  — **Consequência aceita, e é ela que motiva D-05:** sem tela de cadastro, não sobra nenhum lugar
  que responda "quais fornos o ateliê tem, incluindo os desativados". O filtro do índice (D-05)
  passa a ser o único caminho — se ele for cortado, essa pergunta fica sem resposta na interface.
  — **Reversibility:** reversible.

- **D-03: "Registrar manutenção" só existe na página do forno.** O cartão do índice fica com **um
  único botão — "Queimar"** — e nada compete com ele. Manutenção acontece uma vez a cada ~100
  queimas; pôr na tela mais usada cobra atenção diária por algo raro. O caminho natural já existe: o
  banner de atenção leva ao forno, e lá está o botão, junto do histórico que ajuda a decidir.
  — **Reversibility:** reversible.

### O "Desfazer" de 7 segundos — decisão do executor, não do dono

O dono não selecionou esta área e pediu explicitamente: *"trabalhe a decisão do desfazer de 7
segundos se tiver um motivo técnico muito vantajoso. se não pode fazer mais simples."* A análise
foi feita e o simples **é** o tecnicamente melhor — não há tensão a resolver aqui.

- **D-04: A queima é gravada no instante do toque; "Desfazer" apaga a linha.** Nunca o inverso
  (segurar 7 segundos e gravar depois).

  **Por quê.** Gravar na hora é o modelo verdadeiro: a queima aconteceu quando a pessoa tocou. Se o
  celular travar, o sinal cair ou o app fechar dentro da janela de 7 segundos, o registro sobrevive.
  A alternativa perde a queima **em silêncio** exatamente nesse cenário, e a pessoa sai achando que
  registrou — num ateliê, em pé, com a mão suja, isso não é hipótese remota. E queima perdida
  corrompe o contador de vida útil da resistência, que é o propósito inteiro do módulo.

  **E não custa mais.** A Server Action de excluir queima já precisa existir para o FOR-10 (remover
  uma lançada por engano no histórico). O "Desfazer" reaproveita a mesma ação. A diferença é que o
  "Desfazer" **não pede confirmação** — a confirmação é do histórico, onde se remove um registro
  antigo e se desloca o contador; o toast cobre o arrependimento de três segundos atrás. O
  `02-MODELO-DE-DADOS.md` §3 já faz essa distinção.
  — **Reversibility:** reversible.

### Forno desativado

- **D-05: Filtro no próprio índice.** `/queimas` mostra os ativos por padrão; um seletor discreto
  oferece "Desativados" e "Todos". É o mesmo mecanismo do histórico de encomendas (D-07 da Fase 3) —
  uma convenção reaproveitada em vez de uma segunda inventada. O forno desativado aparece
  **esmaecido e sem o botão "Queimar"**, e a página dele continua abrindo normalmente com todo o
  histórico de vida útil.
  — **Reversibility:** reversible.

- **D-06: Dá para reativar, pela página do forno.** O mesmo lugar que desativa oferece reativar.
  Desativar por engano é fácil e o conserto tem que ser óbvio. O contador volta exatamente de onde
  parou, porque nada foi apagado — queimas e manutenções continuam lá. Custa quase nada: é o campo
  `ativo` no sentido inverso.
  — **Reversibility:** reversible.

### Relatórios

- **D-07: No celular, as quatro estatísticas primeiro; os gráficos rolam na horizontal dentro do
  próprio contêiner.** Total, últimos 30 dias e a contagem dos dois primeiros tipos vêm empilhados e
  legíveis. Os gráficos vêm abaixo, cada um com rolagem horizontal **própria** — a página nunca rola
  lateralmente. É a mesma forma que o Gantt usa no desktop: a exceção fica contida no elemento, não
  na tela. Os dois tamanhos mostram **o mesmo recorte de dados** (8 semanas, 6 meses); nada é
  reduzido no celular, porque duas pessoas olhando o mesmo relatório precisam ver a mesma coisa.
  — **Reversibility:** reversible.

- **D-08: Sem nenhuma queima registrada, os gráficos dão lugar a um estado vazio**, na voz da §9,
  com o caminho de volta para os fornos. Gráfico de eixos desenhados e nenhuma barra parece defeito,
  e num celular é indistinguível de um que falhou ao carregar. O item "Relatórios" **continua
  visível** no seletor — mesma razão pela qual o botão de imprimir da Fase 3 fica desabilitado em
  vez de sumir: controle que aparece e some é mais difícil de aprender que um sempre presente.
  — **Reversibility:** reversible.

### Decisões já fechadas nos documentos fonte — não reabrir

- **O schema literal das três tabelas**, com `tipo_queima` de **três** valores: `biscoito`,
  `esmalte` e **`ouro`** (a douração é uma terceira passagem pelo forno; a versão anterior do plano
  só previa dois e foi corrigida).
- **A regra do contador:** `contador = queimas com ocorrida_em > data da última manutenção`. Sem
  manutenção, conta todas. `const atencao = Math.max(1, limite - 10)` — o `Math.max(1, ...)` é rede
  de proteção do módulo puro e **é preservado mesmo parecendo redundante**.
- **Três níveis:** `ok` < `limite − 10` ≤ `atencao` < `limite` ≤ `critico`. Selo textual
  "Manutenção próxima" em atenção, "Manutenção vencida" em crítico, nada em ok. Margem de atenção
  **fixa em 10**; limite padrão **100**, mínimo **10** (`check (limite >= 10)`).
- **Registro em dois toques:** um no botão do cartão, outro no tipo. **Sem formulário, sem campo
  obrigatório.** É o fluxo mais usado do sistema inteiro. Não acrescentar campo aqui.
- **O medidor com entalhes a cada 10 queimas**, marca vertical no limiar de atenção e rótulos
  `0 / atenção N / limite N` sob a barra, contador `atual / limite` em números tabulares.
  **Não simplificar para barra lisa** — os entalhes são o que deixa o ritmo de desgaste legível.
- **Banner agregado** no topo: *"2 fornos precisam de atenção: Forno 01 (95/100) · Forno 02
  (103/100)"*. Inclui nível **atenção**, não só crítico.
- **Rodapé do cartão:** *"Última manutenção em {data} · {responsável}"* ou *"Sem manutenção
  registrada"*, seguido de *"· {total} no total"*.
- **A janela de manutenção diz, em texto, "o contador vai de N para 0"**, com responsável e
  observações **ambos opcionais**. Responsável é texto livre de propósito — quem faz a manutenção
  pode ser um técnico de fora.
- **Toast de "Desfazer" dura 7 segundos** — a única exceção aos 5s do resto do sistema, porque ali
  o aviso não é informativo, é uma janela de ação.
- **Agregação, reproduzida exatamente:** semana começa na segunda (`(getDay() + 6) % 7`); "8
  semanas" = 8 baldes de 7 dias a partir do início da semana de `hoje − 49 dias`; "6 meses" = meses
  civis, o atual mais os 5 anteriores; uma queima entra no balde quando `inicio <= ocorrida_em < fim`.
- **Cores dos três tipos:** biscoito `#9A3412`, esmalte `#155E75`, ouro `#CA8A04` — já são tokens
  desde a Fase 2b, marcados **NÃO ALTERAR**.
- **Detalhe do forno:** histórico de manutenções e as **últimas 25 queimas**.
- **Excluir queima do histórico pede confirmação** (regra 10 do briefing), ao contrário do protótipo,
  onde a exclusão é imediata.
- **`registrado_por` é o usuário logado**, sem pedir nada a mais no fluxo.
- **Celular:** cartões empilhados, botão "Queimar" ocupando a largura toda (`04-DESIGN-SYSTEM.md` §6).

### Claude's Discretion

- Texto exato das frases novas, seguindo a voz da §9.
- Como o seletor do topo é composto e onde ele fica em cada largura.
- Estrutura de arquivos dentro de `app/(app)/queimas/` e nomes dos componentes.
- Ícones do `lucide-react`.
- O que a página do forno mostra além do histórico e das manutenções.
- Comportamento do banner quando nenhum forno precisa de atenção (provavelmente: não renderiza).
- Se o cartão "Fornos em atenção" do painel inicial repete o banner ou resume.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação do módulo — leitura obrigatória

- `amassa-plataforma/02-MODELO-DE-DADOS.md` §3 — o SQL literal das três tabelas, a regra central do
  contador com o trecho de código de `lib/queimas/contador.ts`, a tabela dos três níveis, a view de
  apoio `fornos_medidos`, a seção "O que o protótipo faz e deve ser preservado", as regras de
  agregação que o módulo puro precisa reproduzir exatamente, e "O que muda em relação ao protótipo".
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §0 — base comum: `hoje_brasilia()` (o container do
  Postgres roda em UTC e `current_date` devolve o dia errado à noite), `atualizado_em` e seu gatilho,
  os dois papéis de banco.
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §6 — ordem das migrações e o fluxo com Drizzle.
- `amassa-plataforma/00-BRIEFING.md` §7 — o módulo de Fornos no briefing, e a nota de que `queima1`/
  `queima2` das Encomendas continuam sendo só marcos.
- `amassa-plataforma/03-ROADMAP.md` §"M4" — as 11 fases do milestone, que viram os planos, e os
  critérios de aceite.

### Design

- `amassa-plataforma/04-DESIGN-SYSTEM.md` §8, bloco **Fornos** — os detalhes a preservar
  literalmente: dois toques, "Desfazer" de 7s, o medidor com entalhes, o selo textual, o banner
  agregado, o rodapé do cartão, a frase "o contador vai de N para 0", o alternador Semana/Mês.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §6 — a linha de Fornos na tabela de adaptações para
  celular (cartões empilhados, botão "Queimar" na largura toda) e a **regra dura** da rolagem
  horizontal, que D-07 acomoda contendo a exceção dentro do gráfico.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §2 e §3 — os três tokens de tipo de queima e os três de
  nível do contador (**NÃO ALTERAR**), e a regra de que cor é informação: um botão terracota por tela.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §7 e §9 — padrões de interação e a voz da interface.

### Escopo e requisitos

- `.planning/ROADMAP.md` §"Phase 4" — os critérios de sucesso desta fase.
- `.planning/REQUIREMENTS.md` §"Contador de Queima" — FOR-01 a FOR-13 na íntegra.

### Decisões anteriores que continuam valendo

- `.planning/phases/03-gestor-de-encomendas/03-CONTEXT.md` — as convenções que esta fase
  reaproveita: rota própria para detalhe (D-01), alternância por CSS (D-02), filtro no cliente
  (D-11), histórico como filtro do próprio índice (D-07), confirmação destrutiva nomeando o que se
  perde (D-09).
- `.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md` — em especial o achado de que um
  status sem caminho de criação na interface vira código inalcançável. **Não repetir com `ativo`:**
  D-02 e D-06 garantem que desativar e reativar existem na interface.
- `.planning/phases/02b-design-system-e-casca-da-aplica-o/02b-CONTEXT.md` — a moldura das telas e a
  fronteira `components/ui/` (shadcn) vs `components/amassa/` (nosso).
- `.claude/CLAUDE.md` §Conventions — as três lições que a Fase 3 pagou caro, incluindo
  `npm run verificar` e o isolamento de testes que afirmam condição global do banco.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`app/(app)/queimas/page.tsx`** — a tela vazia da 2b, com `exigirUsuario()` na primeira linha. É
  o ponto de partida literal; o miolo é substituído, a moldura fica.
- **`components/amassa/estado-vazio.tsx`** e **`estado-erro.tsx`** — já com `hrefBotao` (acrescentado
  na Fase 3), que é o que D-08 precisa para o estado vazio dos relatórios.
- **`components/amassa/cabecalho-pagina.tsx`**, **`cartao-painel.tsx`** — o cartão do painel inicial
  já existe nomeado e vazio ("Fornos em atenção"); esta fase o preenche.
- **`lib/encomendas/`** é o molde direto deste módulo: `cronograma.ts` (puro, testado antes),
  `esquemas.ts` (Zod único compartilhado pelos caminhos de escrita), `acoes.ts` (Server Actions com
  `exigirUsuario()` na primeira linha), `consultas.ts` (leitura), `filtros.ts` (filtro no cliente),
  `formato.ts` (datas de Brasília via `Intl`, sem `date-fns` — ver PD-04 da Fase 3), `textos.ts`.
  `lib/queimas/` espelha essa organização.
- **shadcn já instalado:** `alert-dialog`, `button`, `card`, `dialog`, `dropdown-menu`, `field`,
  `input`, `label`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `switch`,
  `tooltip`. O toast de 7 segundos usa o `sonner` que já está montado desde a Fase 3.
- **`tests/e2e/` com a cadeia de projetos** `vazio-celular → vazio-desktop → vazio-historico →
  desktop/celular` — qualquer teste desta fase que afirme "nenhum forno existe" entra etiquetado
  nessa cadeia, nunca solto sob `--grep`.
- **`npm run verificar`** — o comando que junta lint, `tsc`, `verificar-acoes`, testes unitários e
  `test:migracoes`.

### Established Patterns

- **Módulo puro testado antes do código**, sem React e sem cliente de banco, com "hoje" sempre
  recebido como argumento — nunca lido de dentro. `lib/queimas/contador.ts` é a aplicação desta fase.
- **`exigirUsuario()` como primeira instrução** de toda Server Action e página protegida, verificado
  por `npm run verificar-acoes`.
- **Zod no servidor**, esquema único compartilhado por todos os caminhos de escrita da mesma regra.
- Português nos nomes de arquivo e rotas, inglês nos identificadores.
- `lint` com `--max-warnings=0`.

### Integration Points

- `db/schema.ts` ganha o enum `tipo_queima` e as três tabelas; a migração é **`0007`** (0005 e 0006
  são das encomendas), aplicada **à mão depois de backup**, nunca pelo pipeline.
- **A migração precisa incluir os três gatilhos `tocar_atualizado_em_*`** para as tabelas novas — o
  Drizzle não os gera, e sem eles `atualizado_em` fica congelado. Foi exatamente o conteúdo da
  migração `0006` da Fase 3; siga o mesmo formato.
- **`scripts/testar-migracoes.mjs`: `TABELAS_ESPERADAS` precisa ganhar `fornos`, `queimas` e
  `manutencoes`.** Esta constante barrou o deploy da Fase 3 por não ter sido atualizada. É uma
  convenção do `CLAUDE.md` agora.
- **`recharts` não está instalado** — é a única dependência nova desta fase, e passa pelo portão de
  legitimidade de pacote como as da Fase 3.
- `middleware.ts` já protege tudo fora de `/login` e `/api/health`; as rotas novas nascem protegidas.
- O cartão "Fornos em atenção" do painel inicial (`app/(app)/page.tsx`) passa a receber dado real.

</code_context>

<specifics>
## Specific Ideas

- **O modo de falha desta fase é perder uma queima em silêncio.** Não quebra nada, não registra
  erro: o contador fica um a menos e a resistência estoura antes do previsto. É a razão de D-04, e
  vale que o teste ponta a ponta prove que a queima sobrevive a um recarregamento imediato após o
  registro, não só que o toast aparece.
- **O protótipo `forno-controle.jsx` não está neste repositório.** `PROJECT.md` manda lê-lo antes de
  planejar. Tudo o que importa dele está transcrito em `02-MODELO-DE-DADOS.md` §3 e
  `04-DESIGN-SYSTEM.md` §8 — se o arquivo não aparecer, esses dois são a fonte, e o planejador deve
  registrar isso em vez de inferir comportamento.
- **`lib/queimas/contador.ts` tem uma armadilha de fuso.** O corte "queimas depois da última
  manutenção" compara `timestamptz` com `timestamptz`, o que é seguro; mas a agregação semanal e
  mensal dos relatórios trabalha com **dias civis de Brasília**, e é aí que `getDay()` do fuso do
  processo dá o resultado errado. O `formato.ts` da Fase 3 já resolveu esse problema com
  `Intl.DateTimeFormat` e `timeZone: "America/Sao_Paulo"` — reaproveite a abordagem.
- **A view `fornos_medidos` do documento de dados é de apoio, não obrigatória.** Se o módulo puro
  já calcula o nível a partir de dados carregados, uma view a mais é superfície a manter. O
  planejador decide, mas deve decidir conscientemente e registrar.
- **Dois toques é um requisito medível (FOR-01: menos de 5 segundos no celular).** Vale um teste que
  conte os toques e não só verifique que a queima foi gravada.

</specifics>

<deferred>
## Deferred Ideas

- **Ligar uma queima a uma encomenda** — os marcos `queima1`/`queima2` das Encomendas continuam
  desconectados do módulo de Fornos. Candidato natural depois desta fase, e a primeira vez que os
  dois módulos se falariam.
- **Consumo de material por queima** — a movimentação de estoque com origem nasce na Fase 6.
- **Exclusão de forno pela aplicação** — recusada por desenho: apagar destrói o histórico de vida
  útil do equipamento, que é o propósito do módulo. Desativar ocupa o lugar (D-05, D-06).
- **Alerta ativo (notificação) quando um forno chega ao limite** — hoje o aviso é passivo: banner na
  tela e cartão no painel inicial. Notificação exigiria canal de envio, que o projeto não tem e cujo
  custo recorrente a restrição de custo proíbe.
- **Relatórios com recorte reduzido no celular** — considerado e recusado em D-07: duas pessoas
  olhando o mesmo relatório precisam ver a mesma coisa.

</deferred>

---

*Phase: 4-Contador de Queima*
*Context gathered: 2026-08-10*
