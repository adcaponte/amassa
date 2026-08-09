# Phase 3: Gestor de Encomendas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 3-Gestor de Encomendas
**Areas discussed:** Arquitetura de telas, Ciclo de vida e exclusão, Filtros/busca/timeline, Edição de durações e itens

---

## Arquitetura de telas

### Onde vive o detalhe de uma encomenda

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Página própria `/encomendas/[id]` | URL compartilhável, botão voltar funcionando, não disputa espaço com o Gantt | ✓ |
| Folha (Sheet) sobre a lista | Nenhuma rota nova, mas sem URL própria e cobre o Gantt no desktop | |
| Híbrido — página no celular, folha no desktop | Natural em cada plataforma, mas duas telas de detalhe para manter | |

### Alternância Gantt / lista vertical

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Só por CSS, os dois no HTML | Zero JS, sem piscar antes de hidratar, Playwright cobre trocando viewport | ✓ |
| Detecção por `useIsMobile` | Sem DOM inútil, mas vira Client Component e pisca no primeiro render | |
| Alternador explícito Gantt/Lista | Ambas em qualquer tamanho, mas nenhum requisito pede | |

### Endereço do formulário

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Endereço na URL (`?nova`) | Botão voltar do celular fecha o formulário; recarregar reabre | ✓ |
| Estado de tela puro (`useState`) | Menos código, mas voltar sai da tela e recarregar perde tudo | |
| Rotas de interceptação do Next | Mais correto em navegação, muito mais caro e nada pede link direto | |

### Conteúdo da página de detalhe

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Trilha vertical com data de cada etapa | Uma implementação para desktop e celular; ler datas é mais fácil que medir barras | ✓ |
| O mesmo Gantt, só dessa encomenda | Reaproveita o componente, mas barra sozinha desperdiça a tela e não existe no celular | |
| Trilha vertical + barra por cima | Mais completo, informação repetida e mais casos de tela estreita | |

**Notas:** ao ser perguntado se queria seguir aprofundando a área, o dono respondeu *"vamos seguindo
e depois com os sistemas funcionando vou ajustando conforme utilizo para perceber melhor o que
ajustar."* — o que virou instrução geral para a seção Claude's Discretion do CONTEXT.md.

---

## Ciclo de vida e exclusão

### Como uma encomenda vira "concluída"

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Sempre à mão | Atraso continua visível; o schema já assume status como coluna | ✓ (com acréscimo) |
| Deduzido da data | Ninguém precisa marcar nada, mas atraso vira invisível e cria duas verdades | |
| À mão, com o sistema cutucando | Junta os dois, custa um estado visual a mais | |

**Resposta do dono (texto livre):** *"Concluir a mão, e aquela encomenda some do gant e vai para um
histórico de encomendas."* — acrescentou o comportamento do Gantt, que resolveu de quebra o problema
da timeline esticando com encomendas velhas.

### Formato do histórico

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Filtro do próprio índice, mostrado como lista | Nenhuma rota nova; satisfaz ENC-10 pelo mesmo mecanismo | ✓ |
| Rota própria `/encomendas/historico` | Separação clara, custa tela e segundo conjunto de filtros | |
| Filtro mantendo o Gantt para concluídas | Uma implementação só, mas traz de volta a timeline gigante | |

### Cancelar vs. excluir

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Cancelar é o normal; excluir para engano | Hierarquia visual evita acidente na tela pequena | ✓ |
| Cancelar substitui excluir | Nada apagado, mas ENC (critério 10) pede exclusão com confirmação | |
| Os dois sem hierarquia | Simples de construir, pedido de acidente no uso real | |

### Papel do status "rascunho"

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Encomenda não fechada, no Gantt atenuada | Responde "se essa fechar, cabe?" — planejamento de capacidade | ✓ |
| Fora do Gantt, só na lista | Tela do dia a dia mais limpa, perde a leitura do que vem por aí | |
| Não usar rascunho na v1 | Um estado a menos, entra depois sem migração | |

---

## Filtros, busca e escopo da timeline

### Onde vive o estado de filtro/ordenação/busca

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Na URL, como parâmetros de busca | Server Component, recarregar mantém o estado | |
| No cliente, sobre a lista carregada | Instantâneo; página vira Client Component e recarregar perde o filtro | ✓ |
| Misto — status na URL, busca no cliente | Melhor dos dois em uso, duas fontes de estado no mesmo painel | |

**Notas:** consequência registrada na hora — o servidor manda a lista inteira, e o ponto de revisão
é o volume. Anotado em D-11 como decisão `costly` de reverter.

### Ordenação

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Data de início por padrão + urgência + nome | Gantt lê em escada; o seletor cumpre o "ordenadas" do ENC-10 | ✓ |
| Urgência primeiro | Responde "o que fazer hoje?", mas o Gantt perde a escada | |
| Só data de início, sem seletor | Igual ao protótipo, deixa parte do ENC-10 por cumprir | |

**Notas:** esta pergunta foi dispensada na primeira vez e reaberta a pedido do dono depois da
conversa sobre a impressão.

### Alcance da busca

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Nome e cliente, ignorando acento e maiúscula | Exatamente o que ENC-10 pede | |
| Nome, cliente e descrição dos itens | Acha "caneca" mesmo sem estar no nome; exige carregar os itens na lista | ✓ |
| Nome e cliente, busca literal | Mais simples, falha para quem digita sem acento no celular | |

**Resposta do dono:** *"a opção recomendada + descrição dos itens"* — ou seja, as duas coisas: o
alcance ampliado **e** a normalização de acento/maiúscula.

### Timeline sob filtro

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Reajusta ao que sobrou, com a quinzena de folga | Sem rolar por meses vazios | ✓ |
| Intervalo fixo de todas as ativas | Posição estável, mas tela quase toda em branco ao filtrar | |
| Reajusta garantindo o "Hoje" visível | Referência nunca some, mais um caso de borda para testar | |

---

## Edição de durações e itens

### Onde se muda a duração de uma etapa

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Só pelo formulário, com pré-visualização | Um caminho de escrita, uma validação, um teste | |
| Formulário + ajuste rápido na página de detalhe | Dois toques em pé no ateliê; dois caminhos de escrita para manter | ✓ |
| Arrastar a barra no Gantt | Gesto mais direto, o mais caro, e não existe no celular | |

**Notas:** aceito com a regra dura de que os dois caminhos passam pelo mesmo Zod e pelo mesmo
módulo de cronograma (D-15).

### Reordenação de itens

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Setas para cima e para baixo | 44px, funciona com o dedo e por teclado, sem dependência nova | ✓ |
| Arrastar e soltar | Esperado no desktop, custa biblioteca e falha no celular | |
| Não reordenar | Mais barato, mas a M2 lista "reordenar" explicitamente | |

**Resposta do dono:** *"Opção recomendada, que pode ordenar de acordo com o fluxo de produção, e
pensar um check em cada item confirmando que aquele item ja foi modelado, queimado ou finalizado."*
A primeira metade já é atendida pela ordenação manual; a segunda foi tratada como capacidade nova
(ver Ideias Adiadas).

### Check de progresso por item

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Ideia adiada, decidir depois de usar | Deixa o dono descobrir se a resposta certa é por item, por quantidade ou por etapa | ✓ |
| Versão mínima — um check "pronto" por item | Uma coluna booleana, risco de virar meia-funcionalidade | |
| Completo — item guarda sua etapa | Mais fiel ao ateliê, reescreve ENC-01/02/09 e dobra a fase | |

### Rodapé de duração total (ENC-11)

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| No formulário, criando e editando | Vê-se o efeito antes de salvar | ✓ |
| Só na criação | Menos um estado, mas o ajuste de duração fica às cegas | |
| Formulário + fixo na página de detalhe | Informação sempre à mão, cálculo repetido em dois lugares | |

---

## Fora das quatro áreas

### Botão de imprimir (ENC-14)

Proposto pelo dono no meio da discussão: *"um botão de imprimir criando um template pratico e
objetivo de entender quais encomendas tem, em que pé estão etc.. De preferencia que ocupe apenas um
a4."*

Classificado como **capacidade nova** — nada em ENC-01 a ENC-13 nem nas 9 fases da M2 menciona
imprimir ou exportar.

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Na Fase 3, como requisito ENC-14 | Módulo aberto na mesa; exige registrar o requisito no ROADMAP e no REQUIREMENTS | ✓ |
| Ideia adiada | Decidir depois de usar, combina com a preferência declarada do dono | |
| Fase 7, junto do resto da entrega | Formato único para o sistema inteiro, não só encomendas | |

**Pendência gerada:** `.planning/ROADMAP.md` e `.planning/REQUIREMENTS.md` ainda não contêm o
ENC-14. Registrado no `<domain>` do CONTEXT.md como bloqueio antes de planejar.

---

## Claude's Discretion

O dono declarou preferência por ajustar com uso real em vez de esgotar decisões agora. Ficaram a
critério do executor: textos de rótulos e mensagens (seguindo a §9), apresentação do filtro no
celular e o estado vazio de "nada encontrado", estrutura de arquivos e nomes de componentes, ícones
do `lucide-react`, se dá para reabrir encomenda concluída e se há aviso ao concluir cedo, e o
tratamento visual exato do rascunho atenuado.

## Deferred Ideas

- Progresso por item (check de modelado / queimado / finalizado) — adiado com a tensão do ENC-09
  documentada; decidir por item, por quantidade ou por etapa depois do uso real.
- Ligar `queima1`/`queima2` a uma fornada concreta — candidato depois da Fase 4.
- Consumo de material por encomenda — Fase 6.
- Arrastar a borda da barra no Gantt — recusado em D-15.
- Filtro persistido na URL — caminho de volta se o volume crescer.
- Alternador explícito Gantt/Lista no desktop — recusado em D-02.
