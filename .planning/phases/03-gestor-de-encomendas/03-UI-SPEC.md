---
phase: 3
slug: gestor-de-encomendas
status: draft
shadcn_initialized: true
preset: none
created: 2026-08-09
---

# Fase 3 — Contrato de Design de UI

> Contrato visual e de interação para "Gestor de Encomendas". Gerado por `gsd-ui-researcher`,
> verificado por `gsd-ui-checker`. As decisões já travadas em `03-CONTEXT.md` (D-01 a D-18),
> `amassa-plataforma/04-DESIGN-SYSTEM.md` §6/§7/§8 e `00-BRIEFING.md` §5 entram aqui como **linhas
> vinculantes com ponteiro para a fonte** — não são reabertas. O trabalho real deste documento é a
> trilha vertical de etapas, o tratamento do rascunho no Gantt, a folha de impressão A4, a
> apresentação de filtro/busca no celular, os estados "nada encontrado", a lista do histórico, a
> hierarquia cancelar/excluir, os estados de carregamento/erro e os casos de borda de etapa
> atual/dias restantes — nenhum dos quais tem fonte prévia.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui — já inicializado desde a 2b (`components.json` existe, `style: radix-nova`) |
| Preset | não aplicável — nenhum preset de `ui.shadcn.com/create`; tokens já vivem em `app/globals.css` |
| Component library | Radix UI (via shadcn) |
| Icon library | `lucide-react` |
| Font | Archivo Narrow (`display`/`título`) + Inter (`corpo`/`apoio`/`micro`/`mono`) — já carregadas via `next/font/google` desde a 2b, nenhuma mudança aqui |

**Componentes shadcn já instalados** (herdados da 2b): `button`, `card`, `dropdown-menu`, `input`,
`separator`, `sheet`, `sidebar`, `skeleton`, `tooltip`.

**Componentes shadcn a instalar nesta fase** (03-CONTEXT.md, seção "Integration Points" — e só
estes, seguindo o padrão "cada fase instala o que usa" de 02b-CONTEXT D-06):

| Componente | Uso nesta fase |
|------------|-----------------|
| `alert-dialog` | Confirmação de exclusão (D-09) e confirmação de cancelamento |
| `sonner` | Avisos de 5s (salvar, cancelar, excluir, falha de ajuste rápido) |
| `select` | Seletor de ordenação (D-12), seletor de status no filtro |
| `dialog` | Formulário no desktop (D-03) |
| `form` | Wrapper de `react-hook-form` + Zod do shadcn, formulário de criar/editar |
| `label` | Rótulos de campo do formulário |
| `switch` | Interruptor de marco (queima1/queima2/entrega) no formulário e no ajuste rápido da trilha (D-15, ENC-03) |

`sheet` (já instalado) é reaproveitado para a folha do formulário no celular (D-03) — não é um
componente novo, é um segundo uso do mesmo componente instalado na 2b para o menu do usuário.

---

## Design Tokens — cores de etapa (herdadas, NÃO ALTERAR)

Já existem em `app/globals.css` desde a 2b (`amassa-plataforma/04-DESIGN-SYSTEM.md` §2). Esta
fase é a primeira a **consumi-los** de verdade — nenhum valor novo é criado.

| Etapa | Token | Cor | Tipo |
|-------|-------|-----|------|
| Produção | `--color-producao` | `#8B6F47` | intervalo |
| Secagem | `--color-secagem` | `#C9B896` | intervalo |
| Queima (biscoito) | `--color-queima1` | `#C2451B` | marco |
| Esmaltação | `--color-esmaltacao` | `#2E7D8C` | intervalo |
| Queima (esmalte) | `--color-queima2` | `#7A3527` | marco |
| Entrega | `--color-entrega` | `#5B7553` | marco |

**Cuidado obrigatório:** texto sobre `--color-secagem` (`#C9B896`) usa `#3A331F`, nunca branco —
`#C9B896` é claro demais para contraste AA com branco. Aplica-se a qualquer rótulo de etapa
desenhado dentro da barra ou do losango de secagem (não existe losango de secagem — secagem é
sempre intervalo — mas o rótulo dentro da barra de secagem, quando ela passa de 46px, segue esta
regra).

Todas as outras combinações etapa-sobre-fundo-claro (rótulo branco sobre `producao`, `queima1`,
`esmaltacao`, `queima2`, `entrega`) já passam em AA — as cinco são escuras o bastante.

---

## Spacing Scale

Escala de 8 pontos do projeto (`02b-UI-SPEC.md`), sem alteração. **Exceções desta fase** — vêm do
protótipo preservado literalmente (`04-DESIGN-SYSTEM.md` §8) e da acessibilidade, não da escala:

| Valor | Uso |
|-------|-----|
| **18px** | Escala do Gantt — 18px por dia (D-06 do 03-CONTEXT, `04-DESIGN-SYSTEM.md` §8). Não é arredondado para a escala de 4pt; é o valor literal do protótipo. |
| **46px** | Largura mínima da barra do Gantt para o rótulo da etapa aparecer dentro dela. Abaixo disso, a barra é só cor, sem texto. |
| **44px** | Alvo de toque mínimo — setas de reordenar item (D-16), botões +/- do ajuste rápido (D-15), interruptor de marco, botão de menu "⋮ Mais ações", botões de ícone do cabeçalho. |
| **56px** | Altura da barra de busca/filtro fixa no celular (item novo desta fase, ver "Filtro e Busca — Celular" abaixo) — mesma altura da barra inferior e do cabeçalho móvel já estabelecidas na 2b, para manter o ritmo vertical da casca. |
| **16px** | Tamanho mínimo de qualquer campo do formulário (nome, cliente, descrição de item, quantidade, data) — regra permanente do projeto. |

---

## Typography

Reaproveita a escala travada de `04-DESIGN-SYSTEM.md` §4 (6 papéis, 4 pesos — ver `02b-UI-SPEC.md`
"Typography" para a tabela completa; não repetida aqui por não haver desvio). Uso específico desta
fase:

| Papel | Onde aparece em Encomendas |
|-------|------------------------------|
| `display` | Título "Encomendas" no cabeçalho de página; título "Editar encomenda" / "Nova encomenda" no formulário |
| `título` | Nome da encomenda no cartão mobile e na linha do histórico; nome de cada etapa na trilha vertical |
| `corpo` | Todo campo de formulário; corpo do estado vazio/erro |
| `apoio` | Cliente, metadados ("3 itens", "6 dias"), texto de contexto do filtro |
| `micro` | Rótulos de seção do formulário ("ETAPAS", "ITENS"), badge "RASCUNHO", badge de status no histórico |
| `mono` | Todas as datas e quantidades — data de início, data de cada etapa, duração total, data de conclusão, quantidade de item. `font-variant-numeric: tabular-nums`, para as colunas de data não "dançarem" ao trocar de dígito |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#F6F3F0` (`--color-fundo`) | Fundo de toda tela |
| Secondary (30%) | `#FFFFFF` / `#EFEAE5` | Cartões, linhas do histórico, modal/folha do formulário, fundo da barra fixa de busca |
| Accent (10%) | `#894025` (`--color-acento`) | Ver lista fechada por tela abaixo |
| Destructive | `#B91C1C` (`--color-erro`) | Só o item "Excluir encomenda" dentro do menu "⋮" e o botão de confirmar exclusão no `alert-dialog`. Nunca no botão "Cancelar encomenda" (D-08 — cancelar não é destrutivo) |
| Etapas | tabela acima | Só no Gantt, na trilha vertical e na legenda — nunca decoração, nunca em outro módulo |

**Regra travada (`04-DESIGN-SYSTEM.md` §3): um botão terracota por tela, no máximo.** Cada
"tela" desta fase, com seu único terracota:

| Tela | Botão terracota único |
|------|------------------------|
| Índice (`/encomendas`, Gantt ou lista, qualquer filtro) | "Nova encomenda" no cabeçalho de página |
| Formulário (modal desktop / folha celular) | "Salvar" (rodapé do formulário) — é uma superfície própria (overlay), o "Nova encomenda" por baixo fica coberto e não conta |
| Detalhe (`/encomendas/[id]`) | "Editar" no cabeçalho da página de detalhe |
| Impressão (`/encomendas/imprimir`) | nenhum — página só de leitura/impressão, sem ação primária |

Os demais botões de cada tela usam variante `outline` ou `secondary` (Cancelar, Fechar, Voltar,
setas de reordenar, +/- do ajuste rápido, interruptor de marco) ou `destructive` só quando forem de
fato destrutivos (excluir). O botão "Cancelar encomenda" no detalhe usa `outline`, nunca terracota
nem destrutivo — reforça D-08.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Nova encomenda" (abre `/encomendas?nova`) |
| Empty state heading | "A roda ainda não gira." *(já escrito, `04-DESIGN-SYSTEM.md` §8 — preservado literalmente)* |
| Empty state body | "Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui." *(o texto já existe em `app/(app)/encomendas/page.tsx`; nesta fase o botão "Nova encomenda" deixa de estar `disabled` e a nota "Chega na Fase 3." é removida — ver "Rotas e Arquivos Novos")* |
| Error state | "Não deu para carregar as encomendas. Verifique a internet e tente de novo." + botão "Tentar de novo" (reaproveita `EstadoErro`) |
| Destructive confirmation | Ver "Cancelar vs. Excluir" abaixo — dois textos distintos, um por ação |

### "Nada encontrado" — distinto de "A roda ainda não gira"

Estado vazio de resultado de busca/filtro (existem encomendas, mas nenhuma bate com o filtro
atual). Voz da §9 — afetiva, direta, nunca corporativa:

- **Título:** "Nada por aqui com esse filtro."
- **Corpo:** "Tente outro nome, cliente ou item — ou limpe a busca para ver tudo de novo."
- **Botão:** "Limpar filtros" — **ativo**, não desabilitado; ao clicar, zera busca/filtro/ordenação
  para o padrão (D-12: data de início).

Reaproveita o mesmo componente `EstadoVazio`, sem `notaBotao`.

### Toasts (5 segundos, `sonner`)

| Ação | Texto |
|------|-------|
| Encomenda criada | "Encomenda criada." |
| Encomenda editada | "Encomenda salva." |
| Encomenda cancelada | "Encomenda cancelada." |
| Encomenda excluída | "Encomenda excluída." |
| Item reordenado | sem toast — a mudança de posição já é visível na hora, um toast por seta clicada seria ruído |
| Ajuste rápido de dias/marco salvo | sem toast — o número já muda na tela; ver "Ajuste Rápido" abaixo para o retorno visual correto |
| Falha ao salvar (formulário ou ajuste rápido) | "Não deu para salvar. Verifique a internet e tente de novo." (`§7` do design system, mesma frase-padrão do projeto) |

### Cancelar vs. Excluir — os dois textos de confirmação (D-08, D-09)

Os dois usam `alert-dialog`, mas com pesos visuais diferentes — ver seção "Cancelar vs. Excluir —
Hierarquia" mais abaixo para o posicionamento. Aqui só o texto:

- **Cancelar** (`AlertDialog` não-destrutivo — título e botão de confirmação em `outline`, nunca em
  vermelho):
  - Título: *"Cancelar a encomenda «{nome}»?"*
  - Corpo: *"Ela sai do Gantt e vai para o histórico. Dá para consultar depois, mas não dá para
    reabrir — se foi engano, prefira Excluir."*
  - Botões: "Voltar" (secundário) / "Cancelar encomenda" (`outline`, confirma).
  - **Decisão de discrição resolvida aqui** (03-CONTEXT.md deixou como discricionária): a
    encomenda cancelada **não pode ser reaberta** nesta fase — é a solução mais simples, e reabrir
    depois é um botão a mais, revisável com uso real. O aviso acima já avisa disso na hora, então
    ninguém cancela por engano sem saber a consequência.
- **Excluir** (`AlertDialog` destrutivo — título e botão de confirmação em `--color-erro`):
  - Título: *"Excluir a encomenda «{nome}»?"*
  - Corpo, com item(ns) — forma exata da fonte (`04-DESIGN-SYSTEM.md` §7): *"Os {N} itens dela
    serão apagados."* Singular quando N=1: *"O item dela será apagado."*
  - Botões: "Voltar" (secundário) / "Excluir" (`destructive`, confirma).

**Aviso ao concluir antes da data prevista — decisão de discrição resolvida aqui:** marcar
"Concluída" quando a data de conclusão calculada ainda não chegou mostra um `alert-dialog`
não-destrutivo: *"A conclusão prevista é {data}, que ainda não chegou. Marcar como concluída assim
mesmo?"* / "Voltar" / "Concluir". Serve de proteção contra toque errado, sem bloquear o fluxo real
(entregar antes do prazo acontece e é bom, não deve ser difícil de registrar).

### Voz — regras de toda frase nova desta fase (§9, sem alteração)

Afetiva, sensorial, direta, nunca corporativa. Feminino para alunas (não se aplica aqui — este
módulo fala com gestores, forma neutra). Erro sempre diz o que fazer.

---

## Gantt Desktop — Contrato Vinculante (transcrito, não reaberto)

Fonte: `00-BRIEFING.md` §5, `04-DESIGN-SYSTEM.md` §8, 03-CONTEXT.md D-06/D-10.

| Regra | Valor |
|-------|-------|
| Escala | 18px por dia |
| Cabeçalho | Quinzenas (1–15 e 16–fim do mês) |
| Coluna fixa | Nome + cliente da encomenda, à esquerda, não rola horizontalmente com o resto |
| Linha de "Hoje" | Vermelha, vertical, na posição exata do dia atual |
| Abertura | A timeline já nasce rolada horizontalmente até deixar "Hoje" aproximadamente centralizada |
| Extensão automática | Cobre todas as encomendas desenhadas + uma quinzena de folga em cada ponta |
| Marcos (queima1, queima2, entrega) | Losango — um quadrado de 12px rotacionado 45°, cor da etapa. **Não** o ícone `Diamond` do `lucide-react` (proporção de naipe de carta, visualmente diferente do losango do protótipo) |
| Intervalos (produção, secagem, esmaltação) | Retângulo, cor da etapa, altura consistente com a linha do Gantt |
| Rótulo da etapa dentro da barra | Só quando a barra tem mais de 46px de largura |
| Etapa de duração 0 | Não desenhada — nem losango nem retângulo, nem espaço reservado |
| Escopo | Só `rascunho` e `em_producao` (D-06) — `concluida`/`cancelada` nunca aparecem aqui |
| Ordenação padrão | Data de início (D-12) |

**Interação de reajuste de intervalo pelo Gantt (arrastar borda) foi avaliada e recusada** (D-15,
Deferred Ideas do 03-CONTEXT.md) — não faz parte desta fase.

---

## Rascunho no Gantt — Tratamento Atenuado (D-10, item genuinamente indesenhado)

`rascunho` aparece no Gantt (D-10), mas precisa ser visualmente distinguível de `em_producao` sem
ler como "desabilitado" — uma encomenda rascunho é uma encomenda real, só não fechada ainda.

**Decisão: hachura diagonal, não opacidade reduzida.** Justificativa contra `04-DESIGN-SYSTEM.md`
§3 ("cor é informação, não decoração"): opacidade reduzida é a linguagem visual já usada pelo
sistema para "desabilitado" (o botão inerte da 2b usa exatamente isso) — reaproveitá-la aqui faria
rascunho parecer "ainda não existe", o oposto do que é. A hachura preserva a cor cheia da etapa
(a informação "que etapa é esta" continua 100% legível) e adiciona uma camada ortogonal de
significado ("isto ainda não está fechado"), o que é o próprio critério da regra — carrega
informação, não é enfeite.

**Especificação:**

- Todas as 6 barras/losangos daquela encomenda usam `repeating-linear-gradient(45deg, {cor da
  etapa} 0 4px, color-mix(in srgb, {cor da etapa} 100%, black 20%) 4px 8px)` — listras de 4px
  alternando a cor pura da etapa e a mesma cor escurecida 20%. O losango de marco usa a mesma
  hachura recortada pela forma rotacionada.
- Borda adicional: 1px tracejada, cor da etapa a 70% de opacidade — reforço de contraste não
  dependente de cor pura (ajuda quem tem dificuldade de discriminar cor).
- Badge "RASCUNHO" (papel `micro`, caixa alta, `letter-spacing 0.06em`, fundo
  `--color-superficie-2`, texto `--color-tinta-media`, borda `--color-borda-forte`) na coluna fixa
  do Gantt, ao lado do nome da encomenda — **não** repetido em cada uma das 6 barras (seria ruído
  visual); uma vez por encomenda basta.
- No cartão mobile (ver abaixo), o mesmo badge "RASCUNHO" aparece no cabeçalho do cartão, e a
  trilha de 6 segmentos horizontais usa a mesma hachura.

---

## Lista Vertical Mobile — Contrato Vinculante (transcrito)

Fonte: `04-DESIGN-SYSTEM.md` §6, linha "Encomendas".

Cada cartão mostra: nome, cliente, a trilha das 6 etapas como segmentos horizontais (cor da etapa,
proporcional à duração — não a escala em pixels/dia do Gantt, que não cabe no celular), a etapa
atual destacada, e dias restantes. Sem rolagem horizontal (regra dura de `04-DESIGN-SYSTEM.md` §6).

**Destaque da etapa atual no cartão:** o segmento correspondente ganha uma borda de 2px na cor da
própria etapa (mais saturada/escura que o preenchimento) por cima do segmento, e os dias restantes
aparecem como texto (papel `apoio`, `mono` para o número) abaixo da trilha — ver "Etapa Atual e
Dias Restantes" para o texto exato de cada caso, incluindo os casos de borda.

---

## Página de Detalhe — Trilha Vertical de Etapas (D-04, o núcleo indesenhado desta fase)

Rota `/encomendas/[id]`. Mesma implementação no desktop e no celular (D-04) — não é responsiva por
CSS como o índice, é um layout único de coluna, que naturalmente cabe nas duas larguras.

### Estrutura de cada linha da trilha

```
  ●───┐
  │   │  {nome da etapa}                    {intervalo de datas, papel mono}
  │   │  {chip de duração + controle rápido}
  │   │
  ◆───┤  {nome da etapa — marco}             {data única, papel mono}
  │   │  {interruptor ligado/desligado}
  ...
```

- Uma linha vertical conectora (1px, `--color-borda-forte`) atravessa todas as 6 linhas, dando a
  leitura de "trilha" — ela é neutra (não usa cor de etapa), só o marcador de cada linha usa a cor.
- **Intervalo** (produção, secagem, esmaltação): marcador é um círculo preenchido de 14px na cor da
  etapa, com uma barra vertical curta conectando ao próximo, na mesma cor a 40% de opacidade — lê
  como "isto ocupa um período".
- **Marco** (queima1, queima2, entrega): marcador é o mesmo losango do Gantt (quadrado 14px
  rotacionado 45°), preenchido na cor da etapa — mesma técnica visual do Gantt, para quem já leu o
  Gantt reconhecer de cara o mesmo símbolo na trilha.
- Nome da etapa: papel `título`, `--color-tinta`.
- Datas: papel `mono`, `--color-tinta-media`. Intervalo mostra "12 a 18 ago" (início–fim,
  fim exclusivo conforme `00-BRIEFING.md` §5 — a data mostrada como "fim" é o último dia que a
  etapa realmente ocupa, não o dia em que a próxima começa, para não confundir quem lê); marco
  mostra uma data única "19 ago".
- Duração como texto pequeno, papel `apoio`, ao lado do controle rápido: "6 dias".

### Etapa de hoje — destaque

**Decisão:** nada de cor nova. A linha cuja janela de datas contém "hoje" ganha:

- Fundo da linha inteira em `--color-superficie-2` (mesmo tom neutro usado em cartões/hover em
  todo o sistema — não introduz significado de cor extra).
- Um selo "HOJE" (papel `micro`, caixa alta, fundo `--color-tinta`, texto branco) à direita do
  intervalo de datas daquela linha — pequeno, 44px de largura aproximada, não um botão (sem
  interação).
- Se "hoje" cai exatamente na borda entre duas etapas (fim exclusivo — ver `00-BRIEFING.md` §5), o
  selo "HOJE" vai na etapa que **começa** naquele dia, nunca na que termina, coerente com a
  semântica de fim exclusivo já travada.
- Se a encomenda ainda não começou ou já passou da última etapa sem estar concluída, nenhuma linha
  recebe o selo "HOJE" — ver "Etapa Atual e Dias Restantes" para o texto de contexto que substitui
  o selo nesses casos, mostrado no topo da trilha.

### Etapa desligada (duração 0)

Continua **visível** na trilha (não desaparece — D-15 deixa reversível pelo interruptor), mas:

- Marcador (círculo ou losango) sem preenchimento — só contorno, 1.5px, cor da etapa a 100% de
  opacidade (o contorno colorido, não o preenchimento, é o que resta).
- Nome da etapa em `--color-tinta-fraca` em vez de `--color-tinta`.
- No lugar do intervalo de datas: "Desligada" (papel `apoio`, `--color-tinta-fraca`).
- Linha conectora que passa por ela também fica tracejada nesse trecho, reforçando "isto não ocupa
  tempo" sem depender só da cor.

### Controles rápidos (D-15) — como sentam na trilha sem virar alvo de toque acidental

Cada linha de **intervalo** tem, ao lado do texto de duração, um par de botões `-`/`+` de 32×32px
visualmente mas com área de toque de 44×44px (padding invisível expandindo a zona clicável — mesmo
padrão do botão de avatar da 2b), separados entre si por 8px (`spacing sm`) e por 16px do resto do
conteúdo da linha (`spacing md`) — distância suficiente para não ativar por engano ao tocar em
outro lugar da linha. `aria-label="Diminuir dias de {etapa}"` / `"Aumentar dias de {etapa}"`.
Dias não pode ir abaixo de 0.

Cada linha de **marco** tem, no lugar do par -/+, um `Switch` do shadcn (44×44px de área de toque
mesmo que o componente visual seja menor), ligado quando dias=1, desligado quando dias=0.
`aria-label="Ativar {etapa}"` / `"Desativar {etapa}"` conforme o estado atual (o rótulo descreve a
ação que o toque vai fazer, não o estado — convenção padrão de toggle acessível).

**Comportamento de salvamento — não é otimista.** `04-DESIGN-SYSTEM.md` §7 reserva salvamento
otimista para presença e estoque, não para encomendas. O ajuste rápido:

1. Ao soltar o botão/interruptor, o número/estado muda imediatamente na tela (resposta visual
   instantânea de UI local).
2. Um indicador discreto substitui o número por um pequeno spinner (16px) por até ~1s enquanto a
   Server Action confirma.
3. Se falhar, o número volta ao valor anterior e aparece o toast "Não deu para salvar. Verifique a
   internet e tente de novo." — sem travar a tela, sem modal.
4. Ambos os caminhos de escrita (formulário completo e ajuste rápido) passam pelo mesmo Zod e pelo
   mesmo `lib/encomendas/cronograma.ts` (D-15) — o rodapé de duração total/data de conclusão do
   restante da trilha recalcula visualmente assim que a resposta confirma, nunca antes.

---

## Formulário — Modal / Folha (D-03, D-17)

| Contexto | Contêiner |
|----------|-----------|
| Desktop (≥768px) | `Dialog` do shadcn, centralizado |
| Celular (<768px) | `Sheet` do shadcn, `side="bottom"`, ocupando a tela toda |

- URL: `/encomendas?nova` (criar) e `/encomendas?editar={id}` (editar) — abrir/fechar deriva do
  parâmetro de busca (D-03). No celular, o botão voltar do sistema fecha o formulário, não a tela
  inteira.
- Campos: nome, cliente (texto livre), data de início, lista de itens (descrição + quantidade,
  reordenáveis por setas — ver abaixo), as 6 etapas (intervalos com campo numérico de dias, marcos
  com `Switch`).
- **Rodapé fixo do formulário (D-17), sempre visível, em criar e editar:** "Duração total: **{N}
  dias** · Conclusão prevista: **{data}**" (papel `corpo`, números em `mono`), recalculando a cada
  tecla digitada nos campos de duração — sem esperar salvar.
- Botões do rodapé: "Cancelar" (`outline`, fecha sem salvar) / "Salvar" (terracota, único da tela —
  ver tabela de Color acima).

### Estado inicial da lista de itens — decisão do dono

Ao abrir para **criar**, a lista de itens nasce com **uma linha em branco, pronta para digitar** —
o cursor não precisa de um "Adicionar item" antes de poder escrever. Toda encomenda tem ao menos um
item, então esse toque seria cobrado de todo mundo, sempre.

A última linha restante **não pode ser removida**: o botão de remover fica desabilitado quando só
resta um item. Esvaziar os campos é permitido; ficar sem nenhuma linha, não — a validação Zod que
exige ao menos um item passa a ser a rede, não o único aviso.

### Reordenação de itens (D-16)

Cada item do formulário: descrição, quantidade, e duas setas (cima/baixo) de 44×44px,
`aria-label="Mover {descrição} para cima"` / `"...para baixo"`. A seta do primeiro item fica
desabilitada para cima; a do último, desabilitada para baixo (nunca escondida — sumir o botão muda
o layout e engana quem navega por teclado). Grava na coluna `ordem` ao clicar (ou ao soltar Enter),
sem esperar o "Salvar" do formulário inteiro — mesma lógica de resposta imediata do ajuste rápido
da trilha, mas dentro do formulário: se falhar, a ordem volta e o toast de falha aparece.

### Estado de carregamento do formulário (editar)

Ao abrir para editar, se os dados da encomenda ainda não chegaram (navegação direta por URL antes
do índice carregar), o formulário mostra esqueleto no formato do próprio formulário — barras no
lugar de cada rótulo+campo, por até a resposta chegar. Nunca abre com campos vazios que parecem
"em branco de verdade" (isso pareceria um formulário de criar, não de editar carregando).

---

## Filtro, Busca e Ordenação (D-11 a D-14)

Roda no cliente, sobre a lista já carregada (D-11) — sem ida ao servidor a cada tecla.

### Desktop

Barra acima do Gantt/lista, sempre visível: campo de busca (`Input`, ícone `Search` à esquerda,
placeholder "Buscar por nome, cliente ou item…") + `Select` de status (Todas · Em produção ·
Rascunho · Concluídas · Canceladas — D-07 é este mesmo seletor) + `Select` de ordenação (Data de
início · Urgência · Nome — D-12). Os três lado a lado, sem esconder nada — a tela é larga o
bastante.

### Celular — decisão de discrição resolvida aqui

`04-DESIGN-SYSTEM.md` já reserva 56px de cabeçalho + 56px de barra inferior. 03-CONTEXT.md deixou
"visível o tempo todo vs. dentro de um botão" como discricionário, com instrução de preferir a
solução mais simples. **Decisão: busca sempre visível, filtro/ordenação atrás de um botão.**

- Barra fixa de 56px logo abaixo do cabeçalho móvel (`position: sticky`, mesma técnica do
  cabeçalho): campo de busca ocupando a largura disponível (`Input`, 44px de altura, 16px de
  fonte) + um botão de ícone `SlidersHorizontal` de 44×44px à direita, `aria-label="Filtrar e
  ordenar encomendas"`.
- O botão abre um `Sheet` (`side="right"` ou `side="bottom"` conforme o restante do conteúdo)
  com o `Select` de status e o `Select` de ordenação — os mesmos dois campos do desktop, só
  reorganizados verticalmente.
- Justificativa da divisão: busca por texto é o gesto mais frequente (D-13 já vai além do nome/
  cliente, cobrindo item — vale a pena estar sempre à mão); status e ordenação mudam raramente por
  sessão de uso, então cabem atrás de um toque a mais sem custar fluidez.

### Reajuste da timeline ao filtrar (D-14)

Ao aplicar busca/filtro, o Gantt recalcula o intervalo desenhado para cobrir só o que sobrou +
uma quinzena de folga (mesma regra da extensão automática). Se a lista filtrada ficar vazia, ver
"Nada encontrado" no Copywriting Contract acima.

---

## Histórico (D-07) — Linhas da Lista

O histórico é o próprio índice com o filtro de status em "Concluídas" ou "Canceladas" (ou "Todas",
que mistura ativas e históricas — nesse caso as ativas continuam no Gantt/lista normal e as
históricas aparecem *abaixo*, sempre como lista, nunca desenhadas no Gantt). Renderizado como lista
mesmo no desktop (D-07) — sem barras, sem datas em escala de pixel.

Cada linha:

| Campo | Conteúdo | Papel |
|-------|----------|-------|
| Nome | Nome da encomenda | `título` |
| Badge de status | "Concluída" (fundo `--color-sucesso-fundo`, texto `--color-sucesso`) ou "Cancelada" (fundo `--color-superficie-2`, texto `--color-tinta-media` — **nunca** `--color-erro`, cancelar não é erro) | `micro`, caixa alta |
| Cliente | Texto livre do campo `cliente_nome`, ou "—" se vazio | `apoio` |
| Período | "12 ago – 3 set" (início – conclusão real calculada) | `mono` |
| Itens | "3 itens" (ou a primeira descrição + "· +2" se houver mais de uma, para dar uma pista de conteúdo sem abrir o detalhe) | `apoio` |

Clicar na linha inteira (não só no nome) leva para `/encomendas/[id]` — alvo de toque da linha
inteira, mínimo 56px de altura (`min-h-14`), consistente com a convenção de linha alta de toque
único do projeto.

### Janela carregada — decisão do dono

O índice carrega sempre **todas** as `rascunho` e `em_producao`, mais as `concluida` e `cancelada`
**dos últimos 12 meses**. Mais antigo que isso não vem junto: exige um filtro de período explícito,
que consulta o servidor.

Isto fecha o ponto que o D-11 do CONTEXT.md deixou anotado. Com filtro no cliente e histórico sem
recorte, toda abertura da tela passaria a carregar um conjunto que só cresce — a conta chegaria num
dia em que ninguém está pensando nisso. Doze meses mantém a tela leve para sempre sem esconder
nada: o dado continua no banco e continua alcançável, só não vem no carregamento padrão.

---

## Cancelar vs. Excluir — Hierarquia Visual (D-08)

**Estado em trânsito dos dois diálogos — decisão do dono:** ao confirmar, o botão de confirmar
desabilita e mostra que está gravando, e o `AlertDialog` **não fecha** até haver resposta do
servidor. Duas razões: impede o toque duplo que dispararia duas gravações, e em caso de falha a
pessoa já está no lugar certo para tentar de novo — sem reabrir o menu e refazer o caminho de uma
ação destrutiva, que é exatamente quando a dúvida "será que apagou?" aparece.


Na página de detalhe, área de ações no cabeçalho:

```
┌──────────────────────────────────────────────┐
│ {nome da encomenda}          [Editar] [Cancelar encomenda] [⋮] │
└──────────────────────────────────────────────┘
```

- **"Editar"** — terracota (único da tela), abre o formulário em `/encomendas?editar={id}`.
- **"Cancelar encomenda"** — `outline`, ao lado, à vista. Abre o `alert-dialog` não-destrutivo
  (texto na seção de Copywriting acima).
- **"⋮" (Mais ações)** — botão de ícone (`MoreVertical`, 44×44px, `aria-label="Mais ações da
  encomenda"`), à direita, separado por pelo menos 16px do grupo Editar/Cancelar. Dentro do
  `DropdownMenu`, um único item: **"Excluir encomenda"**, em texto `--color-erro`, com ícone
  `Trash2`. É a única forma de chegar à exclusão — nunca um botão "Excluir" solto ao lado de
  "Cancelar".
- No celular, o mesmo grupo se empilha (o cabeçalho de página já resolve isso com `flex-wrap` desde
  a 2b): "Editar" e "Cancelar" continuam lado a lado (cabem, são texto curto), "⋮" desce para o
  fim da segunda linha se necessário — nunca os três espremidos na mesma linha do nome.
- Concluir uma encomenda **não** é uma ação nesta lista — é feita a partir da trilha vertical (um
  controle "Marcar como concluída" no fim da trilha, abaixo da última etapa, `outline`), separada
  fisicamente das ações de cancelar/excluir para não formar um quarto botão na mesma fileira.

---

## Estados de Carregamento e Erro

| Superfície | Carregando | Erro |
|------------|------------|------|
| Índice desktop (Gantt) | `Skeleton` no formato do Gantt: coluna fixa com 3–4 barras cinza (nome), área de barras com retângulos cinza em posições e larguras variadas simulando encomendas — nunca "carregando…" solto | `EstadoErro` — "Algo não funcionou." / "Não deu para carregar as encomendas. Verifique a internet e tente de novo." / "Tentar de novo" |
| Índice mobile (lista) | 3–4 `Skeleton` no formato do cartão (barra de título + barra de subtítulo + trilha de 6 segmentos cinza) | mesmo `EstadoErro` acima |
| Detalhe (trilha) | `Skeleton`: barra de título + 6 linhas no formato da trilha (marcador circular cinza + duas barras de texto) | mesmo `EstadoErro`, com botão "Voltar para Encomendas" como alternativa ao lado de "Tentar de novo" (a página de detalhe pode ter sido excluída por outra pessoa nesse meio-tempo) |
| Formulário (editar) | `Skeleton` no formato do formulário (ver seção do formulário acima) | banner inline (não tela cheia — o formulário continua aberto) "Não deu para carregar os dados desta encomenda. Feche e tente de novo." |
| Impressão | sem estado de carregamento perceptível esperado (dados já vieram do índice); se a consulta falhar, mesmo `EstadoErro` |

Todos os `Skeleton` usam o componente já instalado desde a 2b — nenhuma dependência nova.

---

## Etapa Atual e Dias Restantes (ENC-09) — Casos de Borda

Texto mostrado no topo da trilha vertical (abaixo do nome, acima da primeira linha) e, de forma
resumida, no cartão da lista mobile e na linha do histórico quando aplicável:

| Caso | Condição | Texto |
|------|----------|-------|
| Normal — intervalo | Hoje cai dentro de uma etapa de intervalo | "Etapa atual: **{nome da etapa}** · faltam **{N} dias** para {próxima etapa}" |
| Normal — marco | Hoje é o dia do marco | "Etapa atual: **{nome do marco}**" (marco não tem "dias restantes" — dura 1 dia por definição) |
| Última etapa | Hoje cai na última etapa com duração > 0 | "Etapa atual: **{nome}** · **{N} dias** até a entrega" |
| Ainda não começou | `hoje < data_inicio` | "Começa em **{N} dias** (previsto para {data de início})" — nenhuma linha da trilha recebe o selo "HOJE" |
| Atrasada (data final passou, ainda `em_producao`) | `hoje > data de conclusão calculada` e `status = em_producao` — comum por D-05 | "**Atrasada** — a conclusão prevista era {data}, há {N} dias" em `--color-atencao` (reaproveita o token semântico já existente do projeto, nunca um vermelho novo — atraso é atenção, não erro crítico) + badge "ATRASADA" (papel `micro`) no cabeçalho da trilha e no cartão mobile. Nenhuma linha específica ganha o selo "HOJE" — a última etapa não concluída fica com uma borda em `--color-atencao` no lugar do fundo neutro de "hoje" |
| Rascunho | `status = rascunho` | Mesmo texto do caso "Ainda não começou"/"Normal" conforme a data, **mais** o badge "RASCUNHO" — rascunho não muda a lógica de datas, só adiciona o aviso de que ainda não está fechada |
| Concluída | `status = concluida` | "Concluída em **{data}**" — sem contagem de dias, trilha inteira sem selo "HOJE" nem destaque de "atrasada" mesmo que a conclusão real tenha passado da prevista (já aconteceu, não é mais um alerta) |
| Cancelada | `status = cancelada` | "Cancelada" — sem etapa atual, sem trilha de datas detalhada (a trilha ainda mostra as 6 etapas para referência histórica, mas sem nenhum destaque de "hoje"/"atrasada") |

Esta tabela é o contrato que `lib/encomendas/cronograma.ts` precisa alimentar com dados
suficientes (etapa atual, dias restantes ou de atraso, se está antes do início) — a lógica de
cálculo em si pertence ao módulo puro, não a este documento; aqui está o texto e o estado visual
que a interface produz a partir do que aquele módulo devolver.

---

## Impressão A4 (D-18, ENC-14)

Rota `/encomendas/imprimir`, `@media print`, sem biblioteca de PDF.

### Escopo — decisão resolvida aqui (D-18 pedia que o plano não inventasse na hora)

**A folha usa escopo próprio e fixo, independente do filtro/busca/ordenação vigentes na tela.**
Mostra sempre todas as encomendas `rascunho` + `em_producao` (mesmo escopo do Gantt, D-06),
ordenadas por data de início. Justificativa: o botão de imprimir serve para "o que tem e em que pé
está" — um retrato operacional completo para levar para a bancada — não uma cópia do que a pessoa
filtrou por acaso na tela um minuto antes. Se um dia fizer falta imprimir só o filtrado, é
acréscimo de um parâmetro na URL (`/encomendas/imprimir?status=...`), não uma mudança de decisão.

### Layout

- Cabeçalho: "AMASSA — Encomendas ativas" (Archivo Narrow 700, ~16pt) + "Impresso em {data e hora,
  papel mono}" à direita.
- Tabela de 4 colunas exatas — as mesmas do critério de sucesso 12 do ROADMAP, nem mais nem menos:
  **Nome · Cliente · Etapa atual · Conclusão prevista**.
  - "Etapa atual" reaproveita o texto da tabela "Etapa Atual e Dias Restantes" acima, mas sem cor
    (impressão pode ser P&B): o caso "Atrasada" vira sufixo textual "{etapa} (atrasada)" em vez de
    depender de `--color-atencao`.
  - Nome de encomenda `rascunho` leva o sufixo " (rascunho)" depois do nome, mesma razão — sem
    hachura em papel.
- Tipo a escala de impressão (não a escala de tela): cabeçalho de coluna 8pt caixa alta
  `letter-spacing`; corpo de linha 10pt regular; rodapé de data 8pt. **Nunca encolher abaixo
  disso** — é a restrição explícita de D-18.
- Altura de linha ~24px (impressão) — confortavelmente mais do que os 12–15 registros do volume
  atual do ateliê cabem numa página A4 com essas medidas (o teto de 12–15 citado em D-18 seria
  motivo de segunda página só se cada linha carregasse muito mais informação do que estas 4
  colunas; com 4 colunas simples, a folha comporta bem mais do que isso numa página só).
- **Sem truncamento de dados.** Se a lista um dia crescer além de uma página A4, a tabela usa
  `break-inside: avoid` por linha e flui para uma segunda folha via `@page` do CSS de impressão —
  nunca corta silenciosamente encomendas da folha impressa (coerente com a regra do projeto contra
  perda de informação silenciosa, ainda que aqui não seja exclusão de dado, é omissão de dado
  operacional que alguém no ateliê poderia precisar).
- `@page { size: A4; margin: 15mm; }`.

### Sem nenhuma encomenda ativa — decisão do dono

O botão de imprimir fica **desabilitado**, com a nota abaixo dele dizendo por quê ("Nada ativo para
imprimir agora."). Não some: um controle que aparece e desaparece é mais difícil de aprender do que
um que fica sempre no mesmo lugar, às vezes apagado. E ninguém gasta uma folha de papel para
descobrir que não havia nada — a própria tela já diz "A roda ainda não gira." logo ali.

---

## Rotas e Arquivos Novos desta Fase

```
app/(app)/encomendas/
├─ page.tsx                 # SUBSTITUÍDO — índice: Gantt (desktop) + lista (mobile) por CSS (D-02)
├─ [id]/page.tsx             # NOVO — detalhe com a trilha vertical (D-01, D-04)
├─ imprimir/page.tsx         # NOVO — folha A4, @media print (D-18)
└─ loading.tsx / error.tsx   # NOVO — esqueleto e erro específicos do módulo (a casca já cobre o genérico desde a 2b; aqui o formato passa a ser o do Gantt/lista, não o genérico)

components/amassa/encomendas/
├─ gantt.tsx                 # Gantt desktop
├─ lista-encomendas.tsx      # Lista vertical mobile
├─ cartao-encomenda.tsx      # Cartão da lista mobile / linha do histórico
├─ trilha-etapas.tsx         # Trilha vertical da página de detalhe
├─ ajuste-rapido-etapa.tsx   # +/- e Switch dentro da trilha
├─ formulario-encomenda.tsx  # Dialog (desktop) / Sheet (mobile), campos + rodapé (D-17)
├─ lista-itens.tsx           # Itens do formulário com setas de reordenar (D-16)
├─ filtro-encomendas.tsx     # Busca + Select de status + Select de ordenação
├─ confirmar-cancelar.tsx    # AlertDialog não-destrutivo
└─ confirmar-excluir.tsx     # AlertDialog destrutivo

lib/encomendas/
└─ cronograma.ts             # módulo puro — cascata, fim exclusivo, marcos 0/1, etapa atual (fora do escopo deste documento de UI)
```

`middleware.ts` já protege `/encomendas/*` desde a 2a — nada muda ali. `exigirUsuario()` entra na
primeira linha de toda página nova e de toda Server Action nova, sem exceção.

---

## Acessibilidade (UI-09) — Contrato de Verificação

| Requisito | Como é garantido | Como é verificado |
|-----------|-------------------|---------------------|
| Alvo de toque ≥ 44px | Setas de reordenar, +/- do ajuste rápido, `Switch` de marco, "⋮ Mais ações", botão de filtro mobile — todos com área de toque de 44×44px mesmo quando o desenho visual é menor | Playwright mede `boundingBox()` de cada um |
| Contraste AA | Tokens de etapa já conferidos na 2b/04-DESIGN-SYSTEM; texto sobre `--color-secagem` usa `#3A331F` (não branco); badge "ATRASADA" usa `--color-atencao` (já aprovado) | axe-core sobre as telas desta fase, mais o teste manual de "texto sobre secagem" |
| Navegação por teclado | Formulário inteiro tabulável em ordem lógica (nome → cliente → data → itens → etapas → salvar); `Dialog`/`Sheet` do Radix já prendem o foco; setas de reordenar operáveis por Tab+Enter; `Switch` de marco operável por Tab+Espaço | Playwright navega o formulário só com teclado, do campo nome até salvar |
| `aria-label` em botão só com ícone | "⋮ Mais ações da encomenda", setas de reordenar ("Mover {item} para cima/baixo"), +/- do ajuste rápido, `Switch` de marco (aria-label dinâmico conforme estado), botão de filtro mobile ("Filtrar e ordenar encomendas"), botão de imprimir se for só ícone no cabeçalho | Revisão de código + `getByRole('button', { name: ... })` |
| Campo de formulário ≥ 16px | Nome, cliente, quantidade de item, dias de etapa — todos papel `corpo` (16px) | Revisão de código / `getComputedStyle` |
| Confirmação nomeando o que se perde (UI-08) | "Excluir" nomeia os N itens; "Cancelar" nomeia a consequência (sai do Gantt, vai pro histórico, não reabre) | Revisão de texto no `alert-dialog`, mais teste de que o nome da encomenda aparece interpolado no diálogo |

---

## UI Considerations

Cobertura calculada pela sonda de considerações de UI (`ui-consideration-probe`) sobre as 11
superfícies novas desta fase, com os tipos de elemento declarados à mão — a heurística de
classificação do motor é em inglês e não reconhece prosa em português, então os tipos foram
autorados explicitamente (é o passo *propose-then-confirm* previsto pelo próprio fluxo).

Esta é a primeira fase do projeto com dado real de produto, então quase toda categoria é
genuinamente aplicável — ao contrário da 2b, que era casca vazia.

**Superfícies e tipos declarados:**

| ID | Superfície | Tipos de elemento |
|----|-----------|-------------------|
| E1 | Índice desktop — Gantt | `list-collection` |
| E2 | Índice mobile — lista de cartões | `list-collection` |
| E3 | Busca, filtro e ordenação | `form`, `interactive-control` |
| E4 | Formulário criar/editar | `form`, `list-collection` |
| E5 | Detalhe — trilha vertical | `list-collection`, `static-content` |
| E6 | Ajuste rápido (+/− e interruptor) | `interactive-control` |
| E7 | Histórico | `list-collection` |
| E8 | Confirmação de cancelar | `static-content`, `interactive-control` |
| E9 | Confirmação de excluir | `static-content`, `interactive-control` |
| E10 | Folha de impressão A4 | `list-collection`, `static-content` |
| E11 | Reordenação de itens | `interactive-control`, `list-collection` |

**69 considerações aplicáveis: 61 covered · 5 backstop · 2 unresolved · 1 dismissed.**
Mais 1 item transversal sem categoria da taxonomia, registrado ao final.

### E1 — Índice desktop (Gantt)

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | Sem nenhuma encomenda, o `EstadoVazio` substitui o Gantt inteiro — nunca um Gantt vazio com eixo desenhado. Copy: "A roda ainda não gira." + botão ativo "Nova encomenda" |
| loading | ✅ covered | Esqueleto no formato do Gantt (coluna fixa + faixas horizontais), nunca tela em branco |
| error | ✅ covered | `EstadoErro` com "Tentar de novo" |
| populated | ✅ covered | 18px/dia, coluna fixa, cabeçalho em quinzenas, ordenação por data de início — contrato vinculante transcrito acima |
| partial | ✅ covered | Encomenda com etapas de duração 0 desenha só as etapas que existem, resultando numa barra mais curta — nunca um vão vazio no meio da linha (§8: duração 0 não é desenhada) |
| overflow | 🧪 backstop | **Statement:** o nome trunca com `text-overflow: ellipsis` em uma linha dentro da largura da coluna fixa, com o nome completo em `title`. **Verification: backstop** — nenhuma encomenda de teste tem nome longo hoje; conferir manualmente com um nome de 60+ caracteres antes de fechar a fase |
| zero-one-many | ✅ covered | O leiaute não depende de contagem mínima; com uma encomenda só, o Gantt ainda desenha a quinzena de folga em cada ponta |

### E2 — Índice mobile (lista de cartões)

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | Mesmo `EstadoVazio` do E1 — a frase e o botão são os mesmos nas duas larguras |
| loading | ✅ covered | Esqueleto no formato dos cartões |
| error | ✅ covered | `EstadoErro` com "Tentar de novo" |
| populated | ✅ covered | Cartões empilhados com rolagem vertical, sem paginação — volume do ateliê é de dezenas |
| partial | ✅ covered | Cartão de encomenda com etapas desligadas mostra menos segmentos na trilha; os segmentos existentes somam a largura inteira, sem lacuna |
| overflow | ✅ covered | Nome e cliente quebram em linha, sem cortar — o cartão tem altura livre, ao contrário da coluna fixa do Gantt |
| zero-one-many | ✅ covered | Um cartão e muitos cartões usam o mesmo leiaute |

### E3 — Busca, filtro e ordenação

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | "Nada por aqui com esse filtro." + botão ativo "Limpar filtros" — estado distinto de "A roda ainda não gira.", que significa que não existe encomenda nenhuma |
| loading | ✅ covered | O filtro roda no navegador (D-11), então não tem estado de carregamento próprio. Os controles nascem desabilitados enquanto o índice carrega, junto do esqueleto, e habilitam quando o dado chega |
| error | ✅ covered | Não há caminho de erro próprio — o filtro não vai ao servidor (D-11). Falha de carga do índice cobre o caso |
| partial | ✅ covered | Filtro de status, busca e ordenação combinam por interseção; combinação sem resultado cai no estado `empty` acima, não numa lista vazia sem explicação |
| long-text | ✅ covered | O `Input` de busca tem largura fixa com rolagem interna nativa do campo — comportamento padrão de `<input>`, sem tratamento especial |

### E4 — Formulário criar/editar

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | **Decisão do dono:** o formulário de nova encomenda abre com **uma linha de item em branco já pronta para digitar**. Toda encomenda tem ao menos um item, então exigir "Adicionar item" antes de poder escrever cobra um toque de todo mundo, sempre. A última linha não pode ser removida — ela só esvazia |
| loading | ✅ covered | Ao editar, esqueleto no formato do formulário enquanto os dados chegam |
| error | ✅ covered | Banner inline "Não deu para salvar. Verifique a internet e tente de novo." — o formulário continua aberto e o que foi digitado não se perde |
| populated | ✅ covered | Todos os campos preenchidos e vários itens: a lista de itens rola dentro do `Dialog`/`Sheet`, e o rodapé com duração total e data de conclusão permanece fixo e visível |
| partial | ✅ covered | Validação Zod no envio aponta o campo faltante; as datas recalculam com o que já foi digitado, sem travar a pré-visualização |
| overflow | ✅ covered | Lista de itens longa rola dentro do formulário; rodapé fixo nunca sai da tela |
| zero-one-many | ✅ covered | Com um item só, as duas setas de reordenar ficam desabilitadas — comportamento correto, não defeito a esconder |
| long-text | ✅ covered | Descrição de item é limitada a 200 caracteres pelo banco; o campo quebra em duas linhas e a mensagem Zod aparece se estourar. Sem contador de caracteres — ruído para um limite que quase ninguém alcança |

### E5 — Detalhe (trilha vertical)

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | 🧪 backstop | **Statement:** a trilha nunca mostra uma encomenda sem item — ENC-05 implica ao menos 1 item para salvar, e o E4 `empty` garante a linha inicial. **Verification: backstop** — depende da validação Zod mínima de itens, que é regra de negócio e não vive neste documento; conferir manualmente que "Salvar" é barrado com zero itens antes de fechar a fase |
| loading | ✅ covered | Esqueleto no formato da trilha (seis linhas) |
| error | ✅ covered | `EstadoErro` com "Tentar de novo" |
| populated | ✅ covered | Uma linha por etapa, com cor, duração, início e fim — especificado na íntegra acima |
| partial | ✅ covered | Seção "Etapa desligada (duração 0)": renderização própria, nunca escondida — a etapa continua na trilha dizendo que não acontece |
| overflow | ✅ covered | Coluna única, sem elemento horizontal além da própria linha — cabe em 320px sem rolagem lateral |
| zero-one-many | ✅ covered | Sempre seis linhas na trilha, mesmo com etapas em 0 dias |
| long-text | ✅ covered | Descrição longa de item na lista do detalhe quebra em linha, não corta — mesma regra do cartão mobile |

### E6 — Ajuste rápido (+/− e interruptor)

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| loading | ✅ covered | Spinner de 16px substituindo o número ou o estado do interruptor por até ~1s (seção "Controles rápidos") |
| error | ✅ covered | O número reverte ao valor anterior e um aviso de falha aparece |
| long-text | ⛔ dismissed | **Motivo:** o controle não carrega texto de comprimento variável. O rótulo é o nome da etapa, que vem de um enum fechado de seis valores, todos curtos e conhecidos em tempo de escrita. Não há caminho pelo qual texto de usuário chegue neste controle |

### E7 — Histórico

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | `EstadoVazio` com corpo próprio: "Nada concluído ou cancelado ainda." |
| loading | ✅ covered | Esqueleto no formato das linhas de lista |
| error | ✅ covered | `EstadoErro` compartilhado com o índice — é a mesma tela com outro filtro |
| populated | ✅ covered | **Decisão do dono:** o índice carrega sempre as ativas e os rascunhos, mais as concluídas e canceladas **dos últimos 12 meses**. Mais antigo que isso exige um filtro de período explícito, que consulta o servidor. Isto resolve agora o ponto que o D-11 deixou anotado — o filtro no cliente não passa a carregar um histórico que cresce para sempre |
| partial | ✅ covered | Encomenda cancelada no meio mostra o período que chegou a existir, não o previsto — a linha diz "cancelada em {data}", não uma data de conclusão que nunca aconteceu |
| overflow | ✅ covered | A lista rola verticalmente, sem paginação, dentro da janela de 12 meses |
| zero-one-many | ✅ covered | Uma linha e muitas linhas usam o mesmo leiaute, altura mínima de 56px |
| long-text *(extra, fora das 69)* | ✅ covered | Nome e cliente longos quebram, não cortam — a linha tem altura livre |

### E8 — Confirmação de cancelar

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| loading | ✅ covered | **Decisão do dono:** o botão de confirmar desabilita e mostra que está gravando; o diálogo **não fecha** até haver resposta. Impede o toque duplo que dispara duas gravações, e em caso de falha a pessoa já está no lugar certo para tentar de novo |
| error | 🧪 backstop | **Statement:** o `AlertDialog` permanece aberto e mostra o texto de falha, sem fechar sozinho. **Verification: backstop** — não há teste automatizado deste caminho de falha nesta especificação; verificar manualmente antes de fechar a fase |
| overflow | ✅ covered | Corpo de duas frases curtas dentro do padrão do `alert-dialog` do shadcn — não rola |
| long-text | ⚠ unresolved | Ver item consolidado E8/E9 abaixo |

### E9 — Confirmação de excluir

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| loading | ✅ covered | Mesma regra do E8: botão desabilitado com indicador, diálogo aberto até haver resposta |
| error | 🧪 backstop | **Statement:** o `AlertDialog` permanece aberto e mostra o texto de falha, sem fechar sozinho. **Verification: backstop** — não há teste automatizado deste caminho de falha nesta especificação; verificar manualmente antes de fechar a fase |
| overflow | ✅ covered | Corpo nomeia a contagem de itens em uma frase curta — não rola |
| long-text | ⚠ unresolved | Ver item consolidado E8/E9 abaixo |

**⚠ unresolved — nome longo interpolado no título dos dois diálogos (E8 e E9).** O nome vai
interpolado em *"Cancelar a encomenda «{nome}»?"* e *"Excluir a encomenda «{nome}»?"*, e o banco
permite até 120 caracteres. Este documento **não resolve** se o nome trunca dentro das aspas ou se o
diálogo cresce em altura. Recomendação registrada, não testada: permitir quebra de linha dentro do
`AlertDialogTitle` — truncar um nome dentro de uma pergunta de confirmação destrutiva é
exatamente onde truncar custa caro. **O planejador deve tratar isto como suposição explícita e
decidir, não herdar em silêncio.**

### E10 — Folha de impressão A4

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | **Decisão do dono:** sem nenhuma encomenda ativa, o botão de imprimir fica **desabilitado**, com nota dizendo por quê. Ninguém gasta papel para descobrir que não havia nada — e o estado vazio já diz "A roda ainda não gira." na mesma tela |
| loading | ✅ covered | Sem estado de carregamento perceptível: o dado já veio com o índice, a folha não busca nada por conta própria |
| error | ✅ covered | Não há busca própria, então não há erro próprio — falha de carga do índice cai no `EstadoErro` genérico antes de a folha existir |
| populated | ✅ covered | Tabela com nome, cliente, etapa atual e data de conclusão, uma linha por encomenda ativa |
| partial | ✅ covered | Encomenda sem etapa atual definida (ainda não começou, ou já passou da data) imprime o rótulo do caso de borda da seção ENC-09 — nunca célula vazia, que em papel não tem como ser investigada |
| overflow | ✅ covered | Segunda página via `break-inside: avoid` + `@page`, sem truncamento e sem encolher o texto abaixo do legível |
| zero-one-many | ✅ covered | Uma encomenda e muitas usam a mesma tabela; o cabeçalho repete na segunda página |
| long-text | ✅ covered | Nome longo **quebra** na célula, nunca trunca — em papel não existe `title` nem tooltip para recuperar o que foi cortado |

### E11 — Reordenação de itens

| Category | Status | Resolution / Reason |
|----------|--------|---------------------|
| empty | ✅ covered | Com a linha em branco inicial (E4 `empty`), existe sempre ao menos um item; nesse caso as duas setas ficam desabilitadas |
| loading | 🧪 backstop | **Statement:** a seta clicada mostra estado ocupado (opacidade reduzida no par de setas daquele item) até confirmar. **Verification: backstop** — comportamento análogo ao do ajuste rápido, não medido por teste automatizado nesta especificação; conferir manualmente que dois cliques rápidos na mesma seta não gravam fora de ordem |
| error | ✅ covered | A ordem volta ao estado anterior e um aviso de falha aparece |
| populated | ✅ covered | Setas em todos os itens, desabilitadas nas pontas (a primeira não sobe, a última não desce) |
| partial | ✅ covered | Item ainda sem descrição participa da ordenação normalmente — reordenar não exige item válido |
| overflow | ✅ covered | As setas ficam à direita com largura fixa; a descrição longa quebra à esquerda sem empurrar as setas para fora da linha |
| zero-one-many | ✅ covered | Com um item só, ambas as setas desabilitadas; com muitos, o comportamento é o mesmo em cada linha |
| long-text | ✅ covered | Mesma regra da descrição de item no formulário: quebra em duas linhas, limite de 200 caracteres do banco |

### Item transversal sem categoria da taxonomia

| Elemento | Status | Reason |
|----------|--------|--------|
| E6/E11 — duas gravações rápidas em sequência na mesma etapa ou no mesmo item | ⚠ unresolved | Este documento especifica a resposta visual (spinner, reversão em falha) mas **não resolve a corrida** entre duas gravações quase simultâneas (ex.: dois cliques rápidos em "+"). É comportamento de Server Action e transação, fora do escopo de um contrato de UI. Registrado para o planejador decidir entre *debounce*, fila, ou "a última resposta ganha" — **não deve ser inventado em silêncio na implementação** |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `alert-dialog`, `sonner`, `select`, `dialog`, `form`, `label`, `switch` (novos desta fase) + `button`, `card`, `dropdown-menu`, `input`, `separator`, `sheet`, `sidebar`, `skeleton`, `tooltip` (herdados) | not required |

Nenhum registro de terceiros foi declarado nesta fase. Não se aplica portão de vetting de
terceiros.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

**UI Considerations:** 52 aplicáveis, 44 cobertas, 6 backstop, 2 sem resolver (registradas acima
como suposições explícitas do planejador, não como padrão silencioso).
