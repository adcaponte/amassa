# Phase 5: Agenda - Context

**Gathered:** 2026-10-01 (discussão com o dono no chat, por formulário, ~01h35–02h UTC)
**Refined:** 2026-10-01, depois da pesquisa — D-08..D-18 são as respostas do dono no chat às dez
perguntas abertas de `05-RESEARCH.md`, durante o `/gsd-plan-phase 5`
**Status:** Ready for planning

<domain>
## Phase Boundary

Um calendário só, em `/gestao/agenda`, onde o Theo e a Andressa lançam **turmas fixas, aulas e
oficinas avulsas, uso livre do ateliê e dias fechados**; marcam quem veio, controlam reposições e o
que falta receber — **sem guardar dinheiro** (toda cobrança vira Venda no Financeiro), dando **baixa
no Estoque** do material do uso livre, **sem controle de lotação** — e o site público mostra só o que
for marcado como público. Requisitos: AGE-01..20 (transcritos do briefing de 26/09 em 01/10/2026).
Fora: tudo o que o §10 do briefing lista.

A especificação é o `BRIEFING.md` e o `prototipo.html` desta pasta (aprovados pelo dono em
26/09/2026). **O protótipo vence sobre a interface; o briefing vence sobre regra de dado.** Este
CONTEXT fecha as quatro questões da §11, três buracos achados na discussão (D-01..D-07) e as dez
perguntas abertas da pesquisa (D-08..D-18); **em conflito com o briefing, este arquivo vence**.

</domain>

<decisions>
## Implementation Decisions

### Travadas pelo briefing de 26/09/2026 (não reabrir)
As nove decisões do §2 (dois formatos de aula com material incluso · uso livre por hora cheia,
matéria-prima cobrada ou inclusa item a item · só o ateliê lança · presença por pessoa · reposição
sem validade · vencimento 1–28 por turma · mensalidade proporcional · sem controle de lotação · site
só com aulas e oficinas, uso livre como texto) e as regras de §3 a §9. Estão nos AGE-01..20.

### Pessoas — o cadastro de clientes (buraco do briefing, fora da §11)
- **D-01:** O "cadastro de clientes do Financeiro" que a §4 pressupõe **não existe**: a Venda guarda
  o nome em texto livre (`documentos.pessoa_nome`), como o Orçamento (`orcamentos.cliente_nome`) e a
  Produção (`ordens_producao.cliente_nome`); o `04.4-CONTEXT.md` tirou "cadastro de Pessoas" do
  escopo de propósito. Decisão do dono: **o cadastro de clientes nasce nesta fase** — uma tabela de
  clientes (nome; telefone opcional), visível em Cadastros, que passa a ser **o** cadastro de pessoas
  do sistema; a Agenda é a primeira a usá-lo ("+ Pessoa" da aba Pessoas cria aqui). As Vendas
  criadas pela Agenda gravam o **vínculo com o cliente além do `pessoa_nome`** (que continua
  preenchido, para o Financeiro seguir funcionando igual). **A Venda manual, o Orçamento e a
  Produção continuam com texto livre nesta fase**; ligá-los ao cadastro é trabalho de outra fase
  (ver Deferred). Cumpre o "sem cadastro paralelo": não haverá outro. — **Reversibility:** one-way —
  tabela nova e coluna de vínculo em `documentos` por migração aplicada pelo dono; desfazer depois de
  haver dado exige migração de dado.

### Mensalidade (§11.1)
- **D-02:** A mensalidade do mês **nasce ao abrir a tela, de forma idempotente** — sem rotina no dia
  1 (o projeto não tem `cron` nem worker na aplicação, Out of Scope). Ao abrir a Agenda ("A
  receber", a ficha da pessoa, o Início), o servidor cria as mensalidades do mês corrente que faltam,
  uma por aluno e mês, com a garantia **no banco** (chave única + `on conflict do nothing`), no
  padrão de `gerarContasDoMes` (`lib/cadastros/acoes.ts`) — nunca uma leitura prévia de "já
  existe?". O dono perguntou se é o do protótipo: o protótipo **não simula a virada do mês** (as
  mensalidades vêm dos dados de exemplo; só a entrada na turma cria uma, linha 331), mas mostra o
  resultado — mensalidades já em "A receber", sem botão de gerar —, que só esta opção reproduz.
  Ao entrar na turma no meio do mês continua valendo o proporcional (AGE-07), e a chave única evita
  que o "ao abrir" crie uma segunda mensalidade para esse aluno.

### Turma (§11.2)
- **D-03:** A turma fixa ganha uma **folha própria, simples** (aberta da aula e da ficha da
  pessoa): **editar** nome, horário, vagas, mensalidade, dia de vencimento e público; **"Marcar mais
  N semanas"**; **desativar** (sai das datas futuras e do site; o passado fica; nunca apaga). Mudar
  horário ou vagas vale para as datas futuras; mudar a mensalidade vale do **próximo mês** em diante
  (a do mês corrente, já nascida, não muda).

### Item do Catálogo da mensalidade (§11.3)
- **D-04:** **Um item "Mensalidade" só** no Catálogo (categoria das aulas, área Espaço), e **não** um
  item por turma como o briefing propunha. A linha da Venda leva a descrição com a turma e o mês
  ("Mensalidade · Torno iniciante · outubro") e o valor **vem da turma** (ou do proporcional). Por
  quê: o Mês do Financeiro agrupa por **categoria**, não por item (`lib/financeiro/mes.ts`), então
  um item por turma não muda o relatório; e o valor já é campo da turma (§3) — item por turma
  poria o mesmo preço em dois lugares. Soma por turma, se um dia for preciso, sai da própria Agenda
  (o vínculo mensalidade ↔ venda é guardado). Vale o mesmo raciocínio para "Inscrição em oficina"
  (um item, preço vindo do evento) e "Uso livre (hora)" (um item, cujo **preço de venda é o preço
  da hora** — cadastro, nunca código).

### Início (§11.4)
- **D-05:** O bloco "Agenda de hoje" do Início passa a ler as consultas da Agenda (GES-09) e lista os
  eventos do dia como no `prototipo-gestao.html` da 04.6. A linha permanente **"Agora no espaço: N
  pessoas"** soma: as pessoas de todo **uso livre com "Chegou" e ainda não encerrado** + os
  **inscritos de toda aula/oficina cujo horário cobre o momento atual**, sem contar quem já está
  marcado "Faltou". A aula conta pelo horário porque ninguém marca chegada de aluno. Continua
  contagem, sem fração (decisão do dono de 29/09, `lib/agenda/espaco.ts`). *Refinada pela D-18:
  conta só os usos livres de hoje.*

### Estoque (buraco achado na discussão)
- **D-06:** O material do uso livre sai do Estoque com um **destino novo, "Uso livre do espaço"**,
  pago pela **área Espaço**, com **vínculo ao uso livre** que o gerou. O destino "uso do espaço" que
  o briefing cita não existe: hoje há "Consumo em aula" (Espaço) e "Uso do ateliê" (Peças)
  (`lib/estoque/destinos.ts`). Separar de "Consumo em aula" é o que deixa o Estoque dizer quanto o
  uso livre consome por mês — o número que o §6 quer para decidir se passa a cobrar material. —
  **Reversibility:** one-way — valor novo no enum `destino_saida` e coluna de vínculo em
  `movimentacoes_estoque`, por migração aplicada pelo dono; enum do Postgres não perde valor sem
  recriar o tipo.

### Aula experimental (buraco achado na discussão)
- **D-07:** Quem entra **só numa data de turma fixa** (experimental/avulsa — não é aluno e não é
  reposição) tem a cobrança **decidida na hora**: ao colocar a pessoa, a folha pergunta **"cobrar"
  ou "gratuita"**. "Cobrar" sugere o valor de uma aula (mensalidade ÷ aulas da turma no mês,
  arredondado ao centavo), **editável**, e vai para "A receber" como uma inscrição — "Recebi agora"
  / "Lançar na Venda", como o resto. O protótipo não cobrava nada; o briefing não dizia. Mesmo
  padrão do "cobrar / incluso" do material (AGE-14).

### Decididas pelo dono depois da pesquisa (01/10/2026, no chat)
Respostas às dez perguntas abertas de `05-RESEARCH.md` (seção "Open Questions"; a 4 tinha duas
partes), por formulário, durante o `/gsd-plan-phase 5`. Na 7 o dono escreveu a resposta à mão; as
outras são a opção recomendada pela pesquisa, escolhida por ele. *Atenção ao nome: a D-18 abaixo é
desta fase; a "D-18 da 04.6" (sem preço no site) é outra e é citada sempre com "da 04.6".*

- **D-08 (venda cancelada — pergunta 1):** quando o Caixa cancela a venda de uma cobrança da Agenda
  (mensalidade, inscrição, uso livre), a cobrança **volta a "A receber" sozinha**, por derivação —
  vínculo com venda cancelada conta como livre; **nada é gravado no cancelamento** e
  `cancelarDocumento` não muda. Ela aparece com a etiqueta "venda nº N cancelada" e pode ser lançada
  de novo. "Tirar da lista" / sair da data de uma cobrança ligada a venda **não cancelada** é
  recusado com a frase "Esta inscrição já virou a venda nº N. Para devolver, cancele a venda no
  Caixa." (o protótipo já dizia que devolução se resolve no Financeiro).
- **D-09 (dispensar — pergunta 2):** "A receber" ganha **"Dispensar"** na linha de mensalidade e de
  inscrição **ainda não lançada (ou com venda cancelada)**: confirmação, motivo opcional, marca quem
  e quando (`dispensada_em`/`dispensada_por` ou equivalente), **nunca apaga**, e tem "desfazer".
  Casos: aluno que saiu no dia 2, bolsa, experimental marcada "cobrar" por engano, venda cancelada
  que não será refeita. — **Reversibility:** one-way — colunas novas por migração aplicada pelo dono.
- **D-10 (preço no site — pergunta 3):** o calendário público mostra **preço nos cartões de evento**
  (turma: "por mês"; oficina: "por pessoa" — o valor que o gestor digitou ao lançar), e o bloco "Uso
  livre do ateliê" **continua sem preço**, com "Consulte o valor pelo WhatsApp", como a D-18 da 04.6.
  Revoga a D-18 da 04.6 **só para os cartões de evento**: o motivo dela (não depender do banco na
  página que precisa sobreviver ao Postgres cair) não vale para o evento, que já vem do banco com
  queda segura. Nenhuma ligação do site com o Catálogo.
- **D-11 (site sem evento — pergunta 4a):** sem nenhum evento público marcado, a seção de aulas do
  site continua no **estado aprovado da 04.6 (SIT-07)** — os três cartões de texto e "o calendário
  entra aqui em breve" —, nunca um calendário vazio. O calendário aparece com o primeiro evento
  público.
- **D-12 (vagas da turma no site — pergunta 4b):** em **"Próximas"**, a turma fixa mostra **vagas da
  turma − alunos ativos** (a vaga de quem quer entrar na turma); no **calendário mensal**, cada data
  conta a lista daquele dia (com reposições e experimentais), como no protótipo.
- **D-13 (dia fechado — pergunta 5):** lançar algo num dia fechado, ou fechar um dia que já tem algo,
  **avisa e não bloqueia** ("Esse dia está fechado: Natal — lançar mesmo assim?"). Datas de turma que
  caem num dia fechado **não são canceladas sozinhas**: aparecem com a etiqueta "dia fechado" e o
  gestor cancela com um toque. Gerar ou estender turma não pula dia fechado. Presença e crédito nunca
  mudam sem o gestor ver. O §2.8 (sem aviso de sobreposição) continua valendo: é sobre lotação.
- **D-14 (material cobrado — pergunta 6):** "cobrar" só aparece para material **com preço de venda
  cadastrado**; sem preço, só "incluso", com a dica "Cadastre o preço de venda em Cadastros para poder
  cobrar". Na venda, o material cobrado entra como **linha livre** (nunca como linha de item de
  estoque — daria baixa duas vezes, e a linha de venda só aceita quantidade inteira), na **mesma
  categoria do item "Uso livre (hora)"**. O preço unitário é **congelado** na linha do material no
  encerramento. — **Reversibility:** one-way — coluna do preço congelado por migração.
- **D-15 (publicação — pergunta 7):** **uma publicação e o `db:migrate` logo depois do `implantar`**,
  como a D-09 da 06.1. Palavras do dono: "vamos publicar da melhor forma, nao tem importancia o site
  falhar agora." A janela entre o deploy e a migração — em que toda venda, despesa, aprovação de
  orçamento e baixa de estoque falham, porque o código novo grava colunas que ainda não existem
  (Pitfall 2 da pesquisa) — é aceita, e o roteiro do portão a descreve. O roteiro confere no dia se a
  plataforma continua fora de uso real. — **Reversibility:** one-way — é o procedimento de produção.
- **D-16 (homônimos — pergunta 8):** nomes repetidos **são permitidos**; ao criar, se já existe o
  mesmo nome ignorando acento e maiúscula (nome normalizado), a tela avisa "Já existe Marina Lopes
  (62) 9…. É a mesma pessoa?" → usar a existente / criar outra; o telefone aparece na lista para
  distinguir. Índice não único.
- **D-17 (itens do sistema — pergunta 9):** "Mensalidade", "Inscrição em oficina" e "Uso livre
  (hora)" são **itens do sistema**: não se desativam nem saem da Venda; nome, preço e categoria
  continuam editáveis. A Agenda os acha por uma **chave estável** (coluna, ex.: `chave_do_sistema`),
  nunca pelo nome; a proteção fica no banco (gatilho), como a categoria "diferença" da 04.4. —
  **Reversibility:** one-way — coluna e gatilho por migração.
- **D-18 (uso livre esquecido — pergunta 10):** "Agora no espaço" conta **só usos livres de hoje**
  com "Chegou" e não encerrados (refina a D-05, que descreve o caso normal); o de dia passado aparece
  na semana com a etiqueta "encerrar" (como "marcar presença") e continua encerrável.

### Claude's Discretion
- O número do WhatsApp do site: o briefing diz "é cadastro"; a 04.6 decidiu (D-17) que ele mora em
  `conteudo/site.ts` (`CONTEUDO_SITE.zap`), lido por `lib/site/whatsapp.ts`. **Manter o da 04.6** —
  é o conteúdo do site, editado num lugar só; não criar segundo lugar.
- Onde fica a página pública do calendário (seção da raiz e/ou rota própria) e a revalidação por
  tempo (SIT-02: "lê o banco com cache e revalidação por tempo, nunca a cada visita") — pesquisa e
  planejamento decidem, seguindo `components/site/aulas-e-oficinas.tsx`, que hoje mostra o estado
  "sem Agenda" (SIT-07).
- Modelo de dados exato (o §9 do briefing é sugestão), nomes de tabela em português.
- Como o "Lançar na Venda" abre o rascunho preenchido da Venda.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação da fase
- `.planning/phases/05-agenda/BRIEFING.md` — regras de dado (§2–§9), fora da fase (§10), as questões da §11 (respondidas aqui)
- `.planning/phases/05-agenda/prototipo.html` — interface aprovada ("Agenda AMASSA"); vence sobre a interface
- `.planning/REQUIREMENTS.md` §"Agenda — aulas, oficinas e uso livre (Fase 5…)" — AGE-01..20
- `.planning/ROADMAP.md` §"Phase 5: Agenda" — goal e critérios de sucesso

### Financeiro (a Venda que a Agenda cria)
- `.planning/phases/04.4-financeiro-parte-1/04.4-CONTEXT.md` — Venda, parcela, Caixa, "Recebi"; por que não havia cadastro de Pessoas
- `Claude outputs/BRIEFING-modulo-financeiro.md` §"Brecha 5" (fora do git) — "a frente é da transação, nunca do cliente": cadastro de pessoa é transversal
- `lib/financeiro/acoes.ts` — `lancarVenda`, `registrarPagamento` (o "Recebi")
- `lib/financeiro/mes.ts` — o Mês agrupa por categoria (base da D-04)
- `lib/cadastros/acoes.ts` — `gerarContasDoMes`, o padrão idempotente da D-02

### Estoque
- `.planning/phases/06-estoque/` — CONTEXT e ADENDO do Estoque (destinos, áreas, custo médio)
- `lib/estoque/destinos.ts` — a lista única de destinos de saída (D-06 acrescenta um)
- `db/schema.ts` — `movimentacoes_estoque`, enum `destino_saida`

### Início e site (Fase 04.6)
- `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-CONTEXT.md` — D-07 (linha "Agora no espaço"), D-17 (WhatsApp)
- `.planning/phases/04.6-gestao-inicio-e-site-publico/prototipo-gestao.html` — o bloco "Agenda de hoje"
- `.planning/phases/04.6-gestao-inicio-e-site-publico/prototipo-site.html` e `BRIEFING-site.md` — a seção de aulas do site
- `lib/agenda/espaco.ts`, `components/amassa/inicio/bloco-agenda-de-hoje.tsx`, `components/site/aulas-e-oficinas.tsx` — os pontos que esta fase liga

### Projeto
- `.claude/CLAUDE.md` — `exigirUsuario()` na primeira linha, Zod no servidor, regra pura em `lib/`, estados vazio/carregamento/erro, exclusão com confirmação, migração à mão, `npm run verificar`, `test:migracoes` (`TABELAS_ESPERADAS`), regra do e2e

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/gestao/(app)/agenda/page.tsx`: hoje só o estado vazio "Chega na Fase 5" — vira a Agenda.
- `lib/agenda/espaco.ts` (`ocupacaoDoEspaco`): a frase da contagem; ganha a consulta real (D-05).
- `components/amassa/inicio/bloco-agenda-de-hoje.tsx`: o bloco do Início, que hoje não consulta nada.
- `components/site/aulas-e-oficinas.tsx` + `lib/site/whatsapp.ts` (`hrefDoWhatsapp`): a seção do site e o link do WhatsApp.
- `lib/financeiro/acoes.ts` (`lancarVenda`, `registrarPagamento`): o caminho para "Recebi agora" e "Lançar na Venda".
- `lib/estoque/destinos.ts`: lista única dos destinos; a área nunca vem do cliente.
- `components/amassa/estado-vazio.tsx`, `estado-erro.tsx`, `cabecalho-pagina.tsx`: os estados obrigatórios.

### Established Patterns
- Idempotência pelo banco (`on conflict do nothing`), nunca por leitura prévia — `gerarContasDoMes`.
- "Hoje" calculado na borda (`hojeEmBrasilia`), recebido por parâmetro nos módulos puros.
- Módulo puro sem import de React/drizzle/`@/db` (grep de aceite) — `lib/estoque/destinos.ts`, `lib/producao/`.
- Vínculo real entre módulos por coluna (`movimentacoes_estoque.encomenda_id` → `ordens_producao`) — o uso livre ganha o seu (D-06).
- Venda: total = soma das linhas; forma de pagamento mora na parcela; linha tem `item_id`, `descricao` e `categoria_id`.
- Drizzle embrulha o SQLSTATE: o código do Postgres fica em `erro.cause.code`.

### Integration Points
- Financeiro: Vendas criadas pela Agenda (com o vínculo ao cliente, D-01); "pago" derivado das parcelas.
- Estoque: saídas manuais com o destino novo (D-06), custo médio do momento.
- Cadastros: a tabela de clientes (D-01) e os itens "Mensalidade", "Inscrição em oficina", "Uso livre (hora)" (D-04).
- Início: bloco "Agenda de hoje" (D-05). Site: calendário público (AGE-18).

</code_context>

<specifics>
## Specific Ideas

- O dono confirmou a D-02 perguntando "me parece o do protótipo, confere?" — a referência dele é o
  protótipo: abrir "A receber" e as mensalidades do mês já estarem lá, sem passo a mais.
- §6 do briefing tem a fórmula escrita com "× pessoas" duas vezes; vale a do protótipo (horas cheias
  × pessoas × preço da hora, uma vez) — anotado no AGE-13.

</specifics>

<deferred>
## Deferred Ideas

- **Ligar a Venda manual, o Orçamento e a Produção ao cadastro de clientes** (seletor de cliente no
  lugar do texto livre) — consequência da D-01; fase própria ou Polimento.
- Tudo o que o §10 do briefing lista: reserva online · pacotes/planos · lembrete automático por
  WhatsApp · lista de espera · cobrança automática de mensalidade · integração com Queimas.

</deferred>

---

*Phase: 05-agenda*
*Context gathered: 2026-10-01*
