# AMASSA — Plataforma de Gestão do Ateliê
## Briefing mestre (documento fonte para o GSD Core)

> **Como usar este arquivo:** ele é a entrada do comando `/gsd-new-project` do GSD Core.
> Os arquivos `01` a `04` são referências que o Claude Code deve ler durante o planejamento
> de cada fase. O arquivo `05` é o passo a passo para o Theo, não para o agente.
>
> **Versão:** 2.2 · **Data:** 01/08/2026 · **Responsável:** Theo Restivo
>
> **Restrição estruturante deste projeto: custo recorrente adicional próximo de zero.**
> Tudo roda no VPS Contabo que já está contratado. A única despesa nova é o **Auto Backup da
> Contabo (~€2/mês)**, que protege o servidor inteiro. Nenhuma outra assinatura, nenhum
> "gratuito até certo volume" que um dia vira cobrança. Veja o arquivo `01`.

---

## 1. O que estamos construindo

Uma plataforma web interna, privada e responsiva, para os gestores do **AMASSA** — ateliê de
cerâmica artesanal de alta temperatura em Goiânia — administrarem a operação do dia a dia
em um único lugar, substituindo planilhas e controles espalhados.

**Não é** um site institucional, nem uma loja. O site público (amassaceramica.com.br) e a
loja Shopify continuam existindo separadamente e **estão fora do escopo**.

### Os cinco módulos

| # | Módulo | Origem da especificação | Situação |
|---|--------|------------------------|----------|
| 1 | **Gestor de Encomendas** | Protótipo HTML anexo (`gestor-ceramica.html`) | Especificado |
| 2 | **Agenda de Aulas** | Protótipo JSX anexo (`agenda-amassa.jsx`) | Especificado |
| 3 | **Contador de Queima** | Protótipo JSX anexo (`forno-controle.jsx`) | Especificado |
| 4 | **Estoque** | Descrito neste documento | Especificado |
| 5 | **Calculadora de Orçamento** | Depende das planilhas de precificação | 🔴 **Bloqueado** |

---

## 2. Contexto do negócio

O AMASSA opera em quatro frentes. A plataforma atende principalmente **Escola** e
**Encomendas**, com suporte de **Estoque** para todas.

| Frente | O que é | Impacto na plataforma |
|--------|---------|----------------------|
| **Escola** | Aulas semanais fixas, modelo de mensalidade. Turmas de até 8 alunas. Modalidades: modelagem manual, torno elétrico, pintura/esmaltação. 1 aula/semana, 3h, 4 aulas/mês. | Módulo **Agenda de Aulas** |
| **Encomendas** | Produção personalizada sob medida, B2B/marcas. Orçamento dedicado e prazo alinhado à capacidade produtiva. | Módulos **Encomendas** + **Orçamento** |
| **Experiências** | Oficinas pontuais, 4 a 8 pessoas, em datas específicas (domingos, quintas, sextas). | Fora do escopo v1 — anotar como possível módulo futuro |
| **Loja** | E-commerce Shopify + venda física no ateliê. | Fora do escopo. O estoque **de matéria-prima** entra; o de peças acabadas, não. |

### Vocabulário técnico da cerâmica (usar consistentemente na UI)

O ciclo de uma peça, que é a espinha dorsal do módulo de Encomendas:

```
argila plástica → modelagem → ponto de couro → acabamento →
seco/verde → QUEIMA 1 (biscoito, 800–1000 °C) →
esmaltação → QUEIMA 2 (alta temperatura, 1200–1300 °C) → peça pronta
```

Termos que aparecem na interface: *biscoito*, *esmalte*, *fornada*, *cone pirométrico*,
*retração* (8–15%), *barbotina*, *chamote*, *atmosfera oxidante/redutora*.
Nunca traduzir nem simplificar esses termos — é o vocabulário de quem vai usar o sistema.

---

## 3. Usuários e acesso

**Decisão tomada:** apenas **gestores** — 3 a 5 pessoas, todas com acesso total.

- Sem cadastro público. Contas são criadas por **linha de comando no servidor** — dois
  scripts, `criar-usuario` e `redefinir-senha`.
- Login por **e-mail e senha**.
- Sessão persistente de 30 dias (não obrigar login diário — as pessoas usam do celular, com
  a mão suja).
- **Nenhuma tela é pública** exceto a de login. Toda rota passa por middleware de autenticação.

> **Por que não existe "esqueci minha senha" por e-mail:** enviar e-mail exige um serviço de
> SMTP, configuração de domínio e mais uma conta para manter. Com 3 a 5 pessoas que se
> conhecem, um comando no servidor resolve em 10 segundos e não adiciona nada ao sistema.
> Se um dia houver 30 usuários, aí vale a pena — não antes.

> **Decisão deliberada de arquitetura:** mesmo com um único papel hoje, a tabela `usuarios`
> tem a coluna `papel`. Adicionar "professora" ou "aluna" no futuro será uma mudança de
> regras de autorização, não uma reescrita. Custa quase nada agora e evita retrabalho.

---

## 4. Onde e como será usado

**Decisão tomada:** **celular no ateliê + desktop**, com o celular como prioridade real.

Isso não é "responsivo por educação". Os fluxos abaixo acontecem **em pé, no ateliê,
em uma tela de 6 polegadas**, e precisam ser confortáveis assim:

- Marcar presença de uma turma
- Dar baixa em material do estoque
- **Registrar uma queima** — este é o mais frequente de todos, e precisa caber em dois toques
- Consultar em que etapa está uma encomenda

Fluxos que podem exigir tela grande (e devem ter uma versão mobile alternativa, não uma
versão espremida):

- Gantt de encomendas → em mobile vira **lista vertical com barra de etapas**
- Grade semanal de aulas → em mobile vira **um dia por vez, com navegação lateral**

**Alvos:** iOS Safari e Android Chrome, versões atuais. Desktop: Chrome, Safari, Firefox.

---

## 5. Módulo 1 — Gestor de Encomendas

Baseado no protótipo `gestor-ceramica.html`, que deve ser lido antes de planejar esta fase.

### O que o protótipo já faz (preservar integralmente)

- Cada encomenda tem **nome**, **cliente** (texto livre), **data de início** e a duração
  em dias de cada uma das 6 etapas.
- As datas de cada etapa são **calculadas em cascata**: a etapa começa quando a anterior
  termina. Só a data de início é informada.
- As 6 etapas, com cores e comportamento fixos:

| Etapa | Tipo | Padrão | Cor |
|-------|------|--------|-----|
| Produção | intervalo | 3 dias | `#8B6F47` |
| Secagem | intervalo | 6 dias | `#C9B896` |
| Queima (biscoito) | **marco (24h fixo)** | 1 dia | `#C2451B` |
| Esmaltação | intervalo | 1 dia | `#2E7D8C` |
| Queima (esmalte) | **marco (24h fixo)** | 1 dia | `#7A3527` |
| Entrega | **marco (24h fixo)** | 1 dia | `#5B7553` |

- **Marcos** não têm campo numérico de duração (valem 1 dia quando existem) e são desenhados
  como losango, não como barra. Ver a ressalva sobre marcos zerados mais abaixo.
- Gráfico de Gantt com escala de **18 px/dia**, cabeçalho em **quinzenas** (1–15 e 16–fim
  do mês) e uma **linha vermelha de "Hoje"**.
- Ao carregar, a timeline rola sozinha para deixar o "Hoje" mais ou menos centralizado.
- A timeline se estende automaticamente para cobrir todas as encomendas, com uma quinzena
  de folga em cada ponta.
- Etapas com duração 0 não são desenhadas.
- Estado vazio com a mensagem "A roda ainda não gira".
- Encomendas ordenadas por data de início.

### O que muda em relação ao protótipo

1. **Itens da encomenda** (decisão tomada): em vez de só um nome livre, a encomenda passa a
   ter uma lista de itens — `descrição` + `quantidade` (ex.: "40 × caneca cônica",
   "12 × bowl médio"). O nome da encomenda continua existindo como título.
2. **Persistência real** em Postgres, multiusuário, no lugar de `window.storage`.
3. **Status explícito**: rascunho · em produção · concluída · cancelada.
4. **Etapa atual derivada**: dada a data de hoje, o sistema mostra em qual etapa cada
   encomenda está e quantos dias faltam para a próxima.
5. **Versão mobile** da timeline (lista vertical).

### O que fica de fora por decisão explícita

- Cliente permanece **texto livre**, sem ficha de cadastro.
- Sem valores, sinal ou controle de pagamento.
- Sem fotos ou anexos.

> Estes três itens foram avaliados e recusados nesta versão. O schema no arquivo `02` está
> desenhado para acomodá-los depois sem migração destrutiva — em particular, `cliente_nome`
> é uma coluna que futuramente vira `cliente_id` com uma tabela `clientes` ao lado.

### Regras que o agente precisa respeitar

- Toda a matemática de datas fica em um **módulo puro de TypeScript**
  (`lib/encomendas/cronograma.ts`), sem React e sem acesso ao banco, com testes unitários.
  Essa é a regra de negócio mais delicada do sistema.
- Fuso **America/Sao_Paulo**. Datas de etapa são `date` (dia civil), nunca `timestamp`.
  **Atenção:** o container do Postgres roda em UTC, e `current_date` lá dentro devolve o dia
  errado à noite. Use sempre a função `hoje_brasilia()` definida na seção 0 do arquivo `02`.
- Etapas com duração **0 são permitidas**, inclusive nos marcos — uma peça que só vai a
  biscoito, ou uma encomenda retirada no ateliê sem etapa de entrega, são casos reais.
  Na interface, um marco é um **interruptor** (acontece ou não), nunca um campo numérico.
- O fim de uma etapa é **exclusivo** (a etapa seguinte começa no mesmo dia em que a
  anterior termina), exatamente como no protótipo. Mudar isso quebra a leitura do Gantt.

---

## 6. Módulo 2 — Agenda de Aulas

Baseado no protótipo `agenda-amassa.jsx`, que deve ser lido antes de planejar esta fase.

### O que o protótipo já faz (preservar)

- **Grade semanal**: linhas = turnos (matutino/vespertino), colunas = dias
  (segunda a sábado; domingo é opcional, controlado em Ajustes).
- Cada célula é uma **turma**: modalidade, horário em texto ("9h–12h"), número de vagas
  (padrão 8) e lista de alunas.
- Modalidades: **Modelagem** `#92400E` · **Torno** `#115E59` · **Pintura** `#1D4ED8`.
- Alunas podem ser **matriculadas** ou **experimentais** (com nota, ex.: "primeira aula
  nesta semana"). Experimental pode ser **efetivada** — vira matriculada.
- Indicador visual de assentos, com três níveis: **aberta** (vagas livres),
  **completa** (lotada) e **excedida** (mais alunas do que vagas — permitido, sinalizado
  em vermelho, nunca bloqueado).
- Três abas: **Grade** · **Alunos** (busca e filtro) · **Ajustes**.
- Estatísticas de topo: nº de aulas, nº de pessoas únicas, experimentais, vagas livres.
- Aviso quando o mesmo nome já está em outra turma no mesmo dia/turno.

### O que muda: aulas com data real e presença

**Decisão tomada.** O protótipo só conhece a grade recorrente. Agora:

- A **turma** continua sendo a definição recorrente (Terça · Manhã · Torno · 9h–12h).
- Cada semana gera **aulas com data concreta** a partir das turmas ativas.
- Em cada aula você marca, por aluna: **presente · falta · falta justificada · reposição**.
- Uma aula pode ser **cancelada** (feriado, ausência da professora), com motivo.
- Cada aluna tem um **histórico** de presenças consultável.

**Como as aulas são geradas — decisão importante:** por **materialização preguiçosa**, não
por tarefa agendada. Quando alguém abre a semana de 10 a 16 de agosto, o servidor verifica
se já existem registros de aula para as turmas ativas naquela semana e cria os que faltam,
em uma única transação idempotente.

> Por quê: elimina completamente a necessidade de `cron`, `pg_cron` ou worker em background.
> Menos infraestrutura para manter, menos coisa para quebrar às 3 da manhã, e o
> comportamento é trivialmente testável. É a escolha certa para uma equipe sem apoio técnico.

### O que fica de fora por decisão explícita

- Mensalidades, planos, taxa de matrícula, controle de pagamento. Continuam fora do sistema.
- Portal para as alunas.

> Observação honesta: as regras financeiras da escola estão bem documentadas
> (mensalidade R$ 580/600, matrícula R$ 90/ano, massa R$ 40/mês, +R$ 20 no cartão,
> planos mensal/trimestral/anual). É um módulo natural e provavelmente valioso — mas foi
> conscientemente adiado. O schema de `alunas` e `matriculas` já suporta anexá-lo depois.

---

## 7. Módulo 3 — Contador de Queima

Baseado no protótipo `forno-controle.jsx`, que deve ser lido antes de planejar esta fase.

**O que o módulo realmente é, e o nome não entrega:** um **controle de vida útil das
resistências dos fornos**. Cada forno acumula queimas; ao se aproximar de um limite, precisa
de manutenção; a manutenção zera o contador sem apagar o histórico. É manutenção preventiva
de equipamento caro, não um diário de queimas.

### O que o protótipo faz (preservar)

- **Cartão por forno** com medidor visual, contador `atual / limite`, nível colorido, data da
  última manutenção e da última queima.
- **Contador = queimas registradas depois da última manutenção.** Se nunca houve manutenção,
  conta todas.
- **Três níveis**, com margem de atenção fixa de 10 queimas e limite padrão de 100 (editável
  por forno):

| Nível | Condição | Cor |
|-------|----------|-----|
| ok | `contador < limite − 10` | `#D97706` |
| atenção | `contador >= limite − 10` | `#CA8A04` |
| crítico | `contador >= limite` | `#DC2626` |

- **Registrar queima em dois toques**: abre a janela, escolhe o tipo, pronto. Sem formulário.
  Este é o fluxo mais usado do módulo — acontece no ateliê, com a mão suja. **Não acrescente
  campos obrigatórios aqui.**
- **Três tipos de queima**: Biscoito `#9A3412` · Esmalte `#155E75` · **Ouro** `#CA8A04`.
- **Registrar manutenção** dizendo explicitamente "o contador vai de N para 0", com
  responsável e observações. Grava quantas queimas o forno tinha acumulado naquele momento.
- **Detalhe do forno**: histórico de manutenções e de queimas, com opção de excluir uma
  queima lançada por engano.
- **Relatórios**: barras empilhadas por tipo, alternando entre 8 semanas e 6 meses; barras
  horizontais por forno; e quatro estatísticas — total, últimos 30 dias e a contagem dos
  dois primeiros tipos.
- **Aviso com "Desfazer"** por alguns segundos após registrar uma queima. Preservar — é a
  proteção certa para um botão de dois toques.
- Abas: **Fornos** · **Relatórios** · **Ajustes**.

### O que muda

1. `usuario` deixa de ser um nome digitado em Ajustes e passa a ser o **usuário logado**.
   O campo "Responsável" da manutenção continua texto livre, porque quem faz a manutenção
   pode ser um técnico de fora.
2. Persistência real em Postgres, multiusuário.
3. A aba Ajustes perde "definir seu nome" e "limpar dados"; mantém o cadastro de fornos.

### Uma correção que este arquivo trouxe

A versão anterior deste plano supunha **duas** queimas (biscoito e esmalte). São **três** —
existe a queima de **ouro** (douração), que é uma terceira passagem pelo forno. Isso já está
corrigido no modelo de dados.

> **Nota sobre o módulo de Encomendas:** lá, `queima1` e `queima2` continuam sendo apenas
> marcos de 24h no cronograma. Ligar uma encomenda a uma queima concreta deste módulo é
> possível e provavelmente desejável — mas fica **fora da v1**, para não acoplar dois
> módulos antes de os dois estarem em uso real.

---

## 8. Módulo 4 — Estoque

Não existe protótipo. A especificação abaixo é a fonte de verdade.

**Decisão tomada:** movimentações com histórico + alertas de mínimo.

### Escopo

- **Materiais** organizados em três categorias: **cerâmica** (argilas, esmaltes, óxidos,
  engobes, chamote), **pintura** (tintas, pincéis, vernizes) e **bordado** (linhas, tecidos,
  agulhas, bastidores).
- Cada material tem: nome, categoria, unidade (kg, g, L, mL, unidade, metro),
  **estoque mínimo**, custo unitário de referência, fornecedor e observações.
- Toda mudança de saldo é uma **movimentação** registrada, com tipo:

| Tipo | Sinal | Uso |
|------|-------|-----|
| entrada | + | Compra ou reposição |
| saída — consumo | − | Uso em aula, encomenda ou fornada |
| saída — venda | − | Material vendido para aluna no balcão |
| ajuste | ± | Correção após contagem física |
| perda | − | Quebra, vencimento, desperdício |

- **O saldo nunca é uma coluna editável.** É sempre a soma das movimentações, exposta por
  uma view do banco.

> Por quê: saldo armazenado e saldo real divergem — é questão de tempo, e quando divergem
> ninguém sabe qual está certo. Derivando do histórico, o número mostrado é sempre
> reconstruível e auditável. Com o volume de um ateliê, o custo de performance é zero.

- **Alerta** quando o saldo fica igual ou abaixo do mínimo, visível no painel inicial.
- Movimentação pode referenciar uma **aula**, **fornada** ou **encomenda** de origem
  (campo opcional) — é o que depois permite saber quanto de material cada encomenda consumiu.

### O que fica de fora

- Ponto de venda, formas de pagamento, custo médio ponderado, relatórios de margem.
- Estoque de peças acabadas (isso vive no Shopify).

---

## 9. Módulo 5 — Calculadora de Orçamento 🔴 BLOQUEADO

**Aguardando as planilhas de precificação do Theo.**

Não planeje este módulo. Quando as planilhas chegarem, o que será necessário saber:

1. Quais são as variáveis de entrada (peso da peça? tempo de torno? nº de queimas? tamanho?)
2. Quais custos entram (argila, esmalte, energia da fornada, mão de obra, embalagem, frete)
3. Como a margem é aplicada (percentual fixo? por faixa de quantidade? por tipo de cliente?)
4. Se há desconto por volume e como ele escalona
5. O que sai no final: um número, uma faixa, ou um documento de proposta para enviar

O schema em `02` reserva os nomes de tabela para isso, sem defini-las.

---

## 10. Pendências que bloqueiam o planejamento

Duas categorias, e a diferença importa.

### A. Pré-requisitos — você contrata, e a M0 começa

| # | Item | Como resolver |
|---|------|---------------|
| 1 | **Domínio** registrado e com DNS acessível | Concluir a compra e informar o domínio |
| 2 | **VPS Contabo** criado, com IP e acesso SSH | Criar o servidor. A senha de root que a Contabo envia é usada **uma única vez**, no primeiro passo da M0, para criar um usuário comum com chave SSH e desligar o acesso por senha. Depois disso, nunca mais |
| 3 | Conta **GitHub** | Criar, se ainda não tiver. Gratuita |
| 4 | Conta em **um armazenamento gratuito** para o backup externo | Cloudflare R2, Backblaze B2 ou Google Drive. Ver seção 7 do arquivo `01` |
| 5 | **Auto Backup da Contabo** habilitado | Marcar no painel, ~€2/mês. Feito na M0 |

Nenhum destes exige decisão de produto.

### B. Bloqueios de informação — nenhum planejamento os contorna

| # | Item | Efeito | Como resolver |
|---|------|--------|---------------|
| 5 | **Planilhas de precificação** | **Bloqueia a Milestone 6** | Enviar as planilhas prontas |
| 6 | Decisão sobre a **fonte de títulos** | Não bloqueia — há um padrão seguro | Ver seção 4 do arquivo `04` |
| 7 | Lista real de **materiais** do ateliê | Não bloqueia a construção, mas a M5 nasce vazia sem ela | Levantar durante a M5 |
| ~~8~~ | ~~Repositório público ou privado~~ | **Resolvido: público** | Ver seção 10 do arquivo `01` — traz obrigações de higiene de segredos |

**Com o `forno-controle.jsx` entregue, a Calculadora de Orçamento é a única coisa realmente
bloqueada.** Todas as demais milestones podem ser executadas de ponta a ponta assim que o
grupo A estiver resolvido.

---

## 11. Critérios de qualidade que valem para o projeto inteiro

Estes não são negociáveis e devem constar no `CONTEXT.md` do GSD para que todo executor
os herde:

1. **Português do Brasil** em toda a interface, mensagens de erro e nomes de tabela/coluna.
   Código (variáveis, funções, tipos) em inglês, seguindo a convenção da linguagem.
2. **TypeScript em modo estrito.** `any` só com comentário justificando.
3. **Toda Server Action começa por `exigirUsuario()`.** É a única porta de autorização do
   sistema — não há RLS por trás para salvar um esquecimento. Uma ação que toca o banco sem
   essa chamada na primeira linha está errada, e isso é verificável em revisão.
4. **Toda entrada do usuário é validada com Zod no servidor.** Validação de formulário no
   cliente é conveniência, não segurança.
5. **Regras de negócio ficam em módulos puros e testados** — nunca dentro de componente React.
6. **Nenhum segredo no repositório — que é público.** Chaves só nos *secrets* do GitHub e no
   `.env` do servidor. `.env.example` versionado, sem valores. Nenhum dado real de aluna ou
   cliente, em nenhum arquivo, em nenhum commit.
7. **Estados vazios, de carregamento e de erro em toda tela.** Uma tela em branco enquanto
   carrega é um defeito, não um detalhe.
8. **Acessibilidade básica**: alvos de toque com no mínimo 44 px, contraste AA, navegação por
   teclado nos formulários, `aria-label` em botões só com ícone.
9. **Mensagens de erro em linguagem humana**, dizendo o que fazer. "Erro 500" não é mensagem.
10. **Nada de exclusão silenciosa.** Toda remoção pede confirmação e diz o que será perdido.
