# Phase 2b: Design System e Casca da Aplicação - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega **a identidade visual do AMASSA aplicada e a casca por onde se navega**: os tokens de
`04-DESIGN-SYSTEM.md` §2 no `app/globals.css`, o mapeamento `@theme inline` que faz o shadcn/ui
enxergar esses tokens (incluindo o namespace próprio do componente Sidebar), as duas fontes, a
navegação (barra inferior de 5 itens no celular, barra lateral de 240px no desktop, menu do
usuário), as telas vazias dos 4 módulos, o painel inicial com espaços reservados e a rota
`/orcamentos`. A tela de login e a página de erro, deixadas com estilo mínimo na 2a, são
reestilizadas aqui.

Corresponde às **fases 5 a 7 da M1** de `amassa-plataforma/03-ROADMAP.md`.
Requisitos: **UI-01 a UI-09**.

**Fora desta fase:**

- Qualquer módulo de produto — encomendas, agenda, queimas e estoque só ganham telas vazias aqui.
  Nenhuma tabela nova, nenhuma Server Action de produto, nenhuma consulta ao banco além do que o
  login já faz.
- **UI-10** (nenhum erro no console) e **UI-11** (carrega em menos de 3s em 4G) — são critérios de
  polimento medidos sobre o sistema completo e pertencem à Fase 7. `ROADMAP.md` já registra isso.
- O painel inicial **de verdade**, com números reais respondendo "o que preciso fazer hoje?" — é a
  Fase 7. Aqui ele nasce como quatro cartões nomeados e vazios.
- A **Calculadora de Orçamento** em si (M6, bloqueada). `/orcamentos` existe como tela que diz que
  o módulo está por vir, nada além disso.

</domain>

<decisions>
## Implementation Decisions

### Profundidade das telas vazias

- **D-01: Cada tela de módulo nasce com cabeçalho, estado vazio e botão de ação inerte.** Título da
  página, a frase de contexto do estado vazio, e o botão principal desabilitado com a nota de que a
  ação chega na fase do módulo. É o que faz UI-07 ter prova real nesta fase — com só uma frase
  solta, "toda tela tem estado vazio com frase de contexto **e botão**" ficaria por cumprir. As
  Fases 3 a 6 trocam o miolo e mantêm a moldura.
  — **Reversibility:** reversible — é a moldura que as fases seguintes iam construir de qualquer forma.
- **D-02: O painel inicial mostra os quatro cartões nomeados, cada um com o vazio dele** —
  Encomendas por etapa, Aulas de hoje, Fornos em atenção, Estoque baixo. São exatamente as quatro
  fontes que PNL-01 (Fase 7) exige. O leiaute nasce agora e cada módulo futuro só preenche o cartão
  dele, em vez de a Fase 7 desenhar o painel inteiro do zero.
  — **Reversibility:** reversible — quatro cartões estáticos.
- **D-03: Esqueleto de carregamento não é usado como espaço reservado permanente.** Um esqueleto que
  nunca resolve lê como travamento. Espaço reservado é estado vazio nomeado; esqueleto só aparece
  enquanto algo carrega de verdade.
- **D-04: `/orcamentos` é rota real com tela dizendo que o módulo está por vir.** UI-04 pede o item
  no menu do usuário; um item que não leva a lugar nenhum convida a clicar de novo. A tela diz, em
  linguagem humana, que a calculadora depende das planilhas de precificação.
- **D-05: Só a frase de estado vazio de Encomendas está escrita** — *"A roda ainda não gira"*
  (`04-DESIGN-SYSTEM.md` §8). As demais são escritas pelo executor seguindo a voz da §9 (afetiva,
  sensorial, direta, nunca corporativa) e revisadas pelo dono na verificação da fase. Não são
  bloqueio de planejamento.
  — **Reversibility:** reversible — texto.

### Kit shadcn e tipografia

- **D-06: Instalar apenas os componentes que a casca usa** — `button`, `card`, `sidebar`, `sheet`,
  `skeleton`, `dropdown-menu`, `separator`. Cada fase futura instala o que ela própria usa. Kit
  completo antecipado vira pasta de código não usado que envelhece antes de ser tocado.
  — **Reversibility:** reversible — `shadcn add` é aditivo.
- **D-07: Consequência aceita de D-06 — `alert-dialog` e `sonner` NÃO entram nesta fase.** Não há
  nada para excluir nem nenhuma ação otimista a avisar. **UI-08 (toda remoção pede confirmação
  nomeando o que será perdido) fica registrado como convenção obrigatória** que as Fases 3 a 6
  implementam com `alert-dialog`, e o texto da confirmação segue o formato da §7:
  *"Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão apagados."*
  — **Reversibility:** reversible — instalar os dois componentes depois é um comando.
- **D-08: O mapeamento `@theme inline` vem ANTES de qualquer `shadcn add`.** Não é preferência de
  ordem: `04-DESIGN-SYSTEM.md` §2 é explícito, e ajustar depois significa revisar componente por
  componente. As **oito** variáveis `--color-sidebar-*` são parte obrigatória do mapeamento — sem
  elas a barra lateral sai com a paleta padrão do Tailwind mesmo com todo o resto certo.
  — **Reversibility:** costly — inverter a ordem obriga a revisar cada componente já instalado.
- **D-09: UI-01 é provado por teste automatizado que lê a cor computada no navegador.** Um teste
  Playwright abre a casca e confere que o botão primário resolve para `#894025`, o fundo para
  `#F6F3F0` e o título usa Archivo Narrow. "Parece certo na minha tela" não é teste — é a mesma
  lição que a Fase 1 aprendeu verificando de fora. O teste barra a regressão de alguém instalar
  componente sem o mapeamento.
  — **Reversibility:** reversible.
- **D-10: Archivo Narrow e Inter entram por `next/font/google`**, baixadas no `next build` e
  servidas pelo próprio domínio. Sem requisição a servidor do Google em produção, sem FOUT, sem
  vazar o IP de quem usa. O build roda no GitHub Actions, que tem internet. Não usar `<link>` para
  CDN nem versionar `.woff2` no repositório.
  — **Reversibility:** reversible — trocar para `next/font/local` são poucas linhas, e continua
  valendo a regra permanente D-06 da 2a: nenhum arquivo de fonte licenciada entra no repositório.
- **D-11: `components/ui/` é território do `shadcn add`; `components/amassa/` é código nosso.**
  Fronteira por origem, não por assunto: o que o shadcn pode sobrescrever numa atualização fica de
  um lado, o que nunca é sobrescrito fica do outro.
  — **Reversibility:** reversible — mover arquivos e ajustar imports.

### Casca, marca e login

- **D-12: A barra lateral do desktop é fixa em 240px, sem recolher.** UI-03 pede 240px com os itens
  e o menu do usuário no rodapé — não pede recolher. Com 3 a 5 pessoas em telas de trabalho, ganhar
  180px de largura não paga um estado a mais para persistir e testar em toda tela futura. A §5 do
  documento de design diz "recolhível"; esta é uma decisão consciente de simplificar.
  — **Reversibility:** reversible — o componente `Sidebar` do shadcn traz o recolher e a
  persistência por cookie praticamente de graça se um dia fizer falta.
- **D-13: O logo é um componente `Logo` isolado até o SVG chegar.** Renderiza a palavra AMASSA em
  Archivo Narrow. O dono exporta o SVG da Vinila do mídia kit quando puder e a troca é um arquivo.
  **A fase não fica bloqueada esperando o ativo.** O executor **não** desenha uma
  aproximação da Vinila em curvas — imitar uma fonte licenciada num repositório público é
  exatamente o terreno que D-04 e D-06 da 2a mandam evitar.
  — **Reversibility:** reversible — trocar o conteúdo de um componente.
- **D-14: A tela de login e a página de erro são reestilizadas nesta fase.** A 2a registrou
  explicitamente que "a 2b reestiliza" (D-03 da 2a). Login é a primeira tela que qualquer pessoa vê;
  deixá-la crua seria o único canto do sistema fora da identidade.
  — **Reversibility:** reversible.
- **D-15: O menu do usuário tem três coisas — nome de quem entrou, Orçamentos e Sair.** No desktop
  fica no rodapé da lateral. **No celular vem de um botão de avatar no cabeçalho**, não da barra
  inferior — a barra inferior é dos 5 módulos (UI-02) e não pode ganhar um sexto item. Sair
  precisa ficar alcançável sem navegar nem rolar.
  — **Reversibility:** reversible.
- **D-16: A rota provisória `app/(app)/page.tsx` da 2a vira o painel inicial real.** O comentário no
  arquivo já anuncia isso. `exigirUsuario()` continua na primeira
  linha de toda página protegida — é o padrão, não uma exceção daquela tela.

### Decisões já fechadas nos documentos fonte — não reabrir

Listadas para que o pesquisador e o planejador não as tratem como abertas:

- **Os valores dos tokens são literais de `04-DESIGN-SYSTEM.md` §2.** As cores marcadas
  **"NÃO ALTERAR"** — as 6 de etapa, as 3 de modalidade, os 3 tipos de queima e os 3 níveis do
  contador — são copiadas exatamente, mesmo que nenhuma tela desta fase as use. Elas vêm dos
  protótipos e já estão na cabeça de quem os viu.
- **O namespace de raio no Tailwind v4 é `--radius-*`.** Um token chamado só `--radius` não gera
  utilitário `rounded-*` nenhum. `Card` e `Dialog` do shadcn usam `rounded-xl`, que precisa de
  `--radius-xl: 18px`.
- **`--color-tinta-fraca` é `#6E5F56`, não `#8A7A70`.** O valor original reprova no AA (3,7:1) e é
  justamente a cor dos metadados em 14px.
- **Texto sobre `--color-secagem` (`#C9B896`) é `#3A331F`**, nunca branco.
- **Tipografia: Archivo Narrow nos títulos, Inter no corpo** (opção A da §4). A Vinila é usada
  **apenas** no logo, como SVG — nunca como fonte carregada. Decidido na 2a (D-04, D-05, D-06) com
  base na confirmação do dono de que não há licença de webfont.
- **A escala tipográfica da §4 é fixa**: display 28/32 700, título 20/28 600, corpo 16/24 400, apoio
  14/20 400, micro 12/16 500 com `letter-spacing 0.06em`, mono 13/18 400. **Campo de formulário
  nunca abaixo de 16px** — abaixo disso o iOS dá zoom sozinho ao focar. É defeito de usabilidade,
  não preferência estética.
- **Os 5 itens da barra inferior são Início, Encomendas, Agenda, Queimas, Estoque**, com ícone +
  rótulo e altura mínima de 56px. Orçamentos **não** entra aí (UI-04).
- **Sem tema claro/escuro** — fora do escopo da v1 (`PROJECT.md`).
- **Um botão terracota por tela, no máximo.** Terracota `#894025` significa ação principal; cor não
  é decoração neste sistema.
- **Voz da interface conforme §9**: *"Nada por aqui ainda. Cadastre o primeiro material."*, nunca
  *"Nenhum registro encontrado no sistema."* Feminino ao falar de alunas; forma neutra para quem usa
  o sistema.
- **Avisos temporários duram 5 segundos** (a exceção de 7 segundos é o "Desfazer" da queima, na
  Fase 4).
- **Nenhuma tela pode exigir rolagem horizontal no celular** (UI-06). Única exceção em todo o
  sistema é o Gantt no desktop, que no celular nem existe.
- **`exigirUsuario()` na primeira linha de toda Server Action e de toda página protegida.** O portão
  de máquina no pipeline (`npm run verificar-acoes`) já existe desde a 2a e continua valendo.

### Claude's Discretion

O dono não selecionou a área das regras transversais; o caminho abaixo é decisão do executor,
sujeita a revisão na verificação da fase:

- **UI-07 vira componentes compartilhados em `components/amassa/`** — um para o estado vazio (frase
  + botão), um para o estado de erro em linguagem humana, e esqueletos no formato do conteúdo. Uma
  convenção sem componente não sobrevive a seis fases.
- **UI-09 ganha uma verificação junto do teste de UI-01**: alvos de toque com no mínimo 44px na
  barra inferior e no menu, `aria-label` em todo botão só com ícone, e a navegação por teclado da
  casca. O contraste das combinações do §2 é conferido com ferramenta, não a olho — o próprio
  documento de design pede isso antes de fechar a M1.
- Estrutura de rotas dentro de `app/(app)/`, nomes dos arquivos e como o item ativo da navegação é
  detectado.
- Escolha dos ícones do `lucide-react` para os 5 módulos.
- Como o `Logo` é composto internamente e onde o SVG será encaixado quando chegar.
- Texto exato das frases de estado vazio dos módulos além de Encomendas (ver D-05).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design system — leitura obrigatória, é a fonte única de verdade visual

- `amassa-plataforma/04-DESIGN-SYSTEM.md` §2 — os tokens literais **e o mapeamento `@theme inline`
  obrigatório para o shadcn**, incluindo as oito variáveis `--color-sidebar-*`. Traz também a
  armadilha do namespace `--radius-*` do Tailwind v4 e a correção de contraste de
  `--color-tinta-fraca`.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §3 — o significado de cada cor. Cor aqui é informação, não
  decoração; um botão terracota por tela.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §4 — a escala tipográfica e o aviso do zoom do iOS abaixo
  de 16px em campo de formulário.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §5 — navegação: os 5 itens, os 56px da barra inferior, os
  240px da lateral, Orçamentos no menu do usuário.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §6 — as adaptações obrigatórias para celular. Só a linha
  de "Formulários" (folha que sobe de baixo) toca esta fase; as outras são contrato para as Fases
  3 a 6 e explicam por que a casca precisa comportar as duas formas.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §7 — padrões de interação: estados vazios com ação,
  esqueleto no formato do conteúdo, confirmação destrutiva nomeando o que se perde, duração dos
  avisos.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §9 — a voz da interface, com os pares "sim/não" que
  definem o registro das frases desta fase.

### Escopo da fase

- `amassa-plataforma/03-ROADMAP.md` §"M1" — fases 5, 6 e 7 do milestone (design system, casca,
  painel com espaços reservados) e os critérios de aceite da M1.
- `.planning/ROADMAP.md` §"Phase 2b" — os 5 critérios de sucesso desta fase e a nota explicando por
  que UI-10 e UI-11 ficam na Fase 7.
- `.planning/REQUIREMENTS.md` §"Casca e Design System" — UI-01 a UI-09 na íntegra.

### Decisões anteriores que continuam valendo

- `.planning/phases/02a-login-banco-base-e-backup/02a-CONTEXT.md` — em especial **D-03** (a tela de
  login ficou com estilo mínimo esperando esta fase), **D-04/D-05/D-06** (Vinila só como SVG,
  Archivo Narrow + Inter, nenhuma fonte licenciada no repositório).
- `.planning/phases/01-funda-o-e-primeiro-deploy/01-CONTEXT.md` — decisões de infraestrutura da
  Fase 1 que a casca herda.

### Arquitetura

- `amassa-plataforma/01-ARQUITETURA.md` §3 — a estrutura de pastas prevista para `app/`, incluindo
  os grupos `(auth)` e `(app)` que já existem.

</canonical_refs>

<code_context>
## Existing Code Insights

### Ponto de partida — o que NÃO existe hoje

Vale registrar explicitamente, porque muda o tamanho da fase:

- **`app/globals.css` tem uma linha só**: `@import "tailwindcss";`. Nenhum token, nenhum
  `@theme`, nenhum mapeamento.
- **Nada de shadcn está instalado** — não existe `components.json`, não existe `components/`, e o
  `package.json` não tem `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`,
  `tailwindcss-animate` nem nenhum pacote `@radix-ui/*`. A inicialização do shadcn é trabalho desta
  fase.
- **`public/` está vazio** — nenhum logo, nenhum ícone, nenhum favicon.
- **`app/layout.tsx` é o esqueleto padrão do `create-next-app`**: sem fonte configurada, sem classe
  no `<body>`, com `lang="pt-BR"` já correto.

### Reusable Assets

- **`app/(app)/page.tsx`** — rota protegida provisória, com o padrão `exigirUsuario()` na primeira
  linha já demonstrado. É substituída pelo painel inicial (D-16), mas o padrão dela é o que toda
  página desta fase segue.
- **`app/(auth)/login/page.tsx` + `botao-entrar.tsx`** — a separação servidor/cliente e o estado de
  carregando do formulário já estão resolvidos; esta fase troca a aparência, não a mecânica.
- **`lib/auth/exigirUsuario()`** — devolve o usuário com `nome`, que é o que o menu do usuário
  precisa exibir. Sem consulta nova.
- **`lib/auth/acoes.ts` → `sair`** — a Server Action de logout já existe e já é usada; o menu do
  usuário a reaproveita.
- **`tests/e2e/` + `scripts/testar-e2e.mjs`** — a infraestrutura Playwright já roda com projetos
  **desktop e celular** separados, e o portão já foi provado nos dois sentidos na Fase 1. É onde os
  testes de D-09 (cor computada) e da verificação de UI-09 entram, sem montar nada novo.
- **`npm run verificar-acoes`** — o portão de máquina que confere `exigirUsuario()` continua
  rodando sobre `app` e `lib`; as páginas novas passam por ele automaticamente.

### Established Patterns

- **Módulos puros e testados** (`lib/saude.ts`, `lib/backup/frescor.ts`): zero imports, recebem
  dados e devolvem dados. Não há regra de negócio nesta fase, mas o padrão vale se aparecer alguma
  (por exemplo, decidir o item ativo da navegação a partir do caminho).
- **Português nos nomes de arquivo e nas rotas, inglês nos identificadores de código.** Já valendo
  em `lib/auth/exigir-usuario.ts`, `lib/auth/tentativas-memoria.ts`, `app/frase-no-ar.ts`.
- **Verificar de fora, nunca aceitar o relato de quem executou** — a lição mais cara da Fase 1, e a
  razão de D-09 ser um teste e não uma conferência visual.
- **`lint` roda com `--max-warnings=0`** — código de componente novo precisa passar limpo.

### Integration Points

- `app/layout.tsx` recebe as duas fontes (`next/font/google`) e as classes no `<body>`.
- `app/globals.css` recebe os dois blocos: `@theme` com os tokens e `@theme inline` com o
  mapeamento shadcn.
- Nasce um layout para o grupo `app/(app)/layout.tsx` com a casca — hoje o grupo não tem layout
  próprio, só a página. É ele que envolve todas as telas de módulo.
- `middleware.ts` já protege tudo fora de `/login` e `/api/health`; as rotas novas
  (`/encomendas`, `/agenda`, `/queimas`, `/estoque`, `/orcamentos`) ficam protegidas sem
  configuração adicional. Conferir `lib/auth/rotas-publicas.ts` para não abrir nada por engano.
- O `Dockerfile` e o pipeline não mudam — não há dependência nova de sistema, só pacotes npm.

</code_context>

<specifics>
## Specific Ideas

- **O mapeamento `@theme inline` é o ponto onde esta fase mais provavelmente falha em silêncio.**
  Não quebra o build, não dá erro no console: os componentes simplesmente renderizam com a paleta
  padrão do Tailwind e alguém precisa reparar. As oito variáveis `--color-sidebar-*` são o caso mais
  provável de esquecimento, porque só a barra lateral as usa. É a mesma classe de defeito que a
  Fase 1 encontrou três vezes — funciona, mas não é o que se pretendia. D-09 existe por isso.
- **O critério "a navegação funciona confortavelmente com o polegar" (UI-05) não é medível por
  teste.** Precisa de conferência humana num celular de verdade, em pé, como o núcleo de valor do
  projeto descreve. Vale reservar isso na verificação da fase em vez de deixar como item de
  checklist automático.
- **O contraste precisa ser conferido com ferramenta.** `04-DESIGN-SYSTEM.md` §2 já corrigiu uma
  cor que reprovava no AA e pede explicitamente que o resto seja verificado antes de fechar a M1 —
  "parece legível na minha tela" não é o teste.
- **Esta é a primeira fase do projeto cujo resultado é visual.** As duas anteriores foram
  verificadas por `curl`, portas e dumps. Aqui a verificação inclui olhar telas, e vale planejar
  para isso: capturas em desktop e em celular, do jeito que o projeto Playwright já separa.

</specifics>

<deferred>
## Deferred Ideas

- **Barra lateral recolhível com estado persistido** — o componente `Sidebar` do shadcn traz isso
  quase de graça, e a §5 do documento de design menciona "recolhível". Adiado em D-12 por não valer
  o estado extra com 3 a 5 pessoas em tela de trabalho.
- **Página interna de amostra (`/estilo`) mostrando todos os componentes com os tokens aplicados** —
  seria referência viva para as Fases 3 a 6. Considerada e não escolhida: o teste de cor computada
  (D-09) resolve a prova, e a amostra vira mais uma tela a manter. Vale reconsiderar na Fase 7.
- **`alert-dialog` e `sonner`** — chegam na primeira fase que tiver algo a excluir ou a avisar
  (Fase 3), junto com a implementação de UI-08.
- **`--color-chart-1` a `--color-chart-5`** do shadcn — só fazem falta quando entrar gráfico, na
  Fase 4 (relatórios de queima com Recharts). `04-DESIGN-SYSTEM.md` §2 já registra isso.
- **Logo em SVG a partir da Vinila** — o dono exporta do mídia kit; até lá, texto em Archivo Narrow
  (D-13). Não bloqueia a fase.
- **Favicon e ícones de aplicação** — `public/` está vazio. Não é requisito de UI-01 a UI-09; cabe
  no polimento da Fase 7 ou junto do logo, o que vier primeiro.
- **Kit shadcn completo** — cada fase instala o que usa (D-06).

</deferred>

---

*Phase: 2b-Design System e Casca da Aplicação*
*Context gathered: 2026-08-08*
