# Phase 4: Contador de Queima - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 4-Contador de Queima
**Areas offered:** Estrutura de telas, O "Desfazer" de 7 segundos, Relatórios no celular, Forno desativado
**Areas selected:** Estrutura de telas, Relatórios no celular, Forno desativado
**Not selected:** O "Desfazer" de 7 segundos — deixado a critério do executor, com instrução posterior do dono (ver ao final)

---

## Estrutura de telas

### As três áreas do módulo viram o quê

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Rotas de verdade, com seletor no topo | Endereço próprio por tela, botão voltar funcionando, cada Server Component busca só o seu dado | ✓ |
| Abas de verdade, uma rota só | Fiel ao protótipo, troca instantânea; uma rota carrega o dado das três | |
| Abas com o estado na URL | Meio-termo; continua carregando tudo e mistura duas ideias de navegação | |

### Onde fica o cadastro de fornos

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Rota `/queimas/fornos` no seletor | Lugar único que lista todos os fornos, incluindo desativados | |
| Dentro do detalhe do forno, sem tela própria | Uma tela a menos, cada coisa no seu contexto; não sobra lugar que liste todos | ✓ |
| No menu do usuário | Trata como configuração; esconde uma tarefa que acontece junto do módulo | |

**Consequência registrada na hora:** sem tela de cadastro, nada responde "quais fornos existem,
incluindo os desligados". Isso foi levado explicitamente para a área do forno desativado e é o que
motiva o filtro do índice (D-05).

### Onde fica "Registrar manutenção"

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Só na página do forno | O cartão fica com "Queimar" sozinho; nada compete com o fluxo mais usado | ✓ |
| No cartão, só quando em atenção ou crítico | Ação a um toque no momento certo; cartão muda de forma conforme o estado | |
| No cartão, sempre | Previsível; põe um botão raro ao lado do mais usado, com a mão suja | |

---

## Relatórios no celular

### Os gráficos numa tela de 6 polegadas

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Estatísticas primeiro; gráficos com rolagem horizontal própria | Exceção contida no elemento, nunca na página — mesma forma do Gantt no desktop | ✓ |
| Só estatísticas no celular; gráficos só no desktop | Respeita a regra dura sem exceção; uma funcionalidade deixa de existir num tamanho | |
| Gráficos adaptados, sem rolagem | Nada rola; celular e desktop passam a mostrar recortes diferentes do mesmo relatório | |

### Sem nenhuma queima registrada

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Estado vazio no lugar dos gráficos | Gráfico de eixos vazios parece defeito, e no celular é indistinguível de falha de carga | ✓ |
| Gráficos vazios, com eixos desenhados | Ensina a ler o relatório antes de haver dado | |
| Esconder o item Relatórios até haver dado | Nada vazio para ver; item que aparece e some é difícil de aprender | |

---

## Forno desativado

### Onde ele fica

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Filtro no próprio índice | Mesmo mecanismo do histórico de encomendas — uma convenção em vez de duas | ✓ |
| Sempre na lista, esmaecido, no fim | Zero mecanismo novo; ocupa espaço permanente na tela mais usada | |
| Só alcançável por link direto | Tela limpa ao máximo; o histórico de vida útil vira inalcançável na prática | |

### Dá para reativar

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Sim, pela página dele | O contador volta de onde parou, porque nada foi apagado | ✓ |
| Não — desativar é definitivo | Menos um caminho; um toque errado vira linha morta e o histórico se perde | |

---

## Fora das áreas selecionadas

### O "Desfazer" de 7 segundos

O dono não selecionou esta área. Ao fechar a discussão, instruiu:

> *"trabalhe a decisão do desfazer de 7 segundos se tiver um motivo tecnico muito vantajoso. se não
> pode fazer mais simples."*

Análise feita. As duas formas eram: gravar no instante do toque e apagar se desfizer, ou segurar 7
segundos e gravar depois. **O simples e o tecnicamente melhor coincidem**, então não houve conflito
a resolver:

- Gravar na hora é o modelo verdadeiro — a queima aconteceu quando a pessoa tocou. Se o celular
  travar, o sinal cair ou o app fechar dentro da janela, o registro sobrevive.
- Segurar 7 segundos perde a queima **em silêncio** nesse mesmo cenário, e a pessoa sai achando que
  registrou. Queima perdida corrompe o contador de vida útil, que é o propósito do módulo.
- Não custa mais: a ação de excluir queima já precisa existir para o FOR-10, e o "Desfazer" a
  reaproveita — sem confirmação, ao contrário da exclusão no histórico.

Registrado como D-04 no CONTEXT.md, com o raciocínio, para poder ser contestado na leitura.

## Claude's Discretion

Texto das frases novas; composição do seletor do topo; estrutura de arquivos e nomes de componentes;
ícones; conteúdo da página do forno além do histórico; comportamento do banner quando ninguém
precisa de atenção; se o cartão do painel inicial repete ou resume o banner.

## Deferred Ideas

Ligar queima a encomenda; consumo de material por queima; exclusão de forno pela aplicação
(recusada por desenho); alerta ativo por notificação; relatório com recorte reduzido no celular
(recusado em D-07).
