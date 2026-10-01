# Agenda — aulas, oficinas e uso livre

> Briefing escrito com o Theo no Cowork em **26/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Agenda AMASSA", **aprovado pelo Theo em 26/09/2026**). **O protótipo vence sobre a
> interface; este documento vence sobre regra de dado.** Dados, nomes e preços do protótipo são
> inventados. Executar depois do Financeiro (partes 1 e 2), do `/gestao` e do Estoque: usa o
> cadastro de clientes, o Catálogo, a Venda e as movimentações de estoque.

## 1. O que o módulo faz, em uma frase

Um calendário só, onde **o Theo e a Andressa lançam** turmas fixas, aulas e oficinas avulsas, uso livre
do ateliê e dias fechados; marcam **quem veio**, controlam **reposições** e **o que falta receber** —
e o site mostra só o que for marcado como público.

## 2. Decisões do Theo (não reabrir)

1. **Os dois formatos de aula existem**: turma fixa (mesmos alunos, mensalidade) e aula/oficina
   avulsa (uma data, vagas, preço por pessoa). Aulas planejadas e guiadas, **material incluso**.
2. **Uso livre cobrado por hora cheia** (passou da hora, conta a próxima). Ferramentas e utensílios
   sempre inclusos. **Matéria-prima** (argila, esmalte, papel, tinta, tecido) é registrada por item e
   pode ser **cobrada ou inclusa**, item a item (§6) — a decisão de cobrar ou não ainda está em aberto
   no negócio, por isso o sistema aceita as duas.
3. **Só o ateliê lança.** O cliente não reserva pela internet; no máximo enxerga a agenda no site e
   chama no WhatsApp.
4. **Presença por pessoa**: veio / faltou, se pagou, se tem aula a repor.
5. **Reposição sem validade** — vale até ser usada.
6. **Mensalidade com dia de vencimento escolhido** por turma (1–28).
7. **Mensalidade sempre proporcional** para quem entra no meio do mês: aulas que restam ÷ aulas da
   turma no mês × valor.
8. **Sem controle de lotação do espaço.** Nenhum limite de lugares, nenhum aviso de sobreposição —
   isso é gestão na hora, fora do sistema (uma oficina pode até ser na área externa). Mostrar
   **quantos inscritos** tem cada aula resolve.
9. **Site**: calendário com aulas e oficinas apenas (lista "próximas" e calendário mensal); uso
   livre é um texto com preço e o botão "Consulte disponibilidade no WhatsApp". Sem nome de aluno.

## 3. Os quatro tipos de lançamento

| Tipo | Tem | Nasce de | Pagamento |
|---|---|---|---|
| **Turma fixa** | dia da semana, horário, vagas, mensalidade, dia de vencimento, público sim/não | "Lançar" → cria a turma **e já marca N semanas** (o Theo escolhe quantas; padrão 8; dá para estender) | mensalidade por aluno e mês |
| **Aula / oficina avulsa** | data, horário, vagas, preço por pessoa, público sim/não | "Lançar" | por inscrição |
| **Uso livre** | pessoa, data, hora de chegada, horas previstas, quantas pessoas | "Lançar" (reserva) | horas cheias × preço da hora + material cobrado |
| **Fechado** | data, motivo | "Lançar" | — |

- Uma **data de turma** é um evento próprio (pode ser cancelada sozinha, tem a própria lista de
  presença). Cancelar uma data **pelo ateliê não conta falta** para ninguém; a reposição se combina
  marcando uma data extra ou colocando os alunos em outra.
- Cancelar nunca apaga: fica riscado, com "cancelada". Reserva de uso livre não iniciada e bloqueio
  podem ser removidos.
- Vista **semana** (lista por dia, padrão no celular) e **mês** (pontos por tipo; toque abre a semana).

## 4. Pessoas, turmas, presença e reposição

- **Pessoas = o cadastro de clientes do Financeiro.** Não criar cadastro paralelo: quem faz aula é
  quem compra na loja e pede orçamento. A Agenda acrescenta ao cliente o que é dela: turmas em que
  está, presenças, reposições. Telefone continua no cadastro do cliente.
- Aluno **entra ou sai da turma pela ficha da pessoa**. Ao entrar: é inscrito nas datas futuras da
  turma e nasce a mensalidade do mês (proporcional, §2.7). Ao sair: sai das datas futuras; o que já
  aconteceu fica.
- Na data da aula: lista de inscritos com **Veio / Faltou** por pessoa (toque de novo desmarca).
  Data passada com alguém sem marcação mostra o aviso "marcar presença".
- **Falta em turma fixa** abre a opção "tem direito a repor esta aula" (decisão caso a caso). Isso
  gera **1 crédito de reposição**, sem validade. Falta em oficina avulsa não gera reposição.
- **Colocar alguém numa data**: a lista oferece primeiro quem **tem aula a repor** (entra como
  "reposição", consome 1 crédito, não paga) e depois qualquer pessoa (em turma fixa entra como
  **experimental/avulsa naquela data**; em oficina, como inscrição paga). Lista cheia **avisa e não
  bloqueia** (§2.8).
- Crédito de reposição = faltas com direito − reposições usadas, por pessoa. Guardar os dois lados.

## 5. Dinheiro: "A receber pela agenda"

🔴 **A Agenda não guarda dinheiro. Toda cobrança vira Venda no Financeiro.** A aba "A receber" é
a lista do que ainda **não virou venda**: mensalidades do mês, inscrições em oficina e usos livres
encerrados. Cada item tem dois botões, e **os dois criam a Venda**:

- **"Recebi agora"** — pergunta a forma (dinheiro · pix · cartão) e cria a Venda **já paga hoje**,
  que entra no Caixa na hora. É o caminho de um toque.
- **"Lançar na Venda"** — abre o rascunho da Venda preenchido (cliente, item do Catálogo, quantidade,
  valor) para ajustar; a parcela fica em aberto e aparece no Caixa em **"o que vence"**, com o dia de
  vencimento da turma (mensalidade) ou a data do evento.

Depois de lançado, o item some de "A receber" e o estado passa a vir do Financeiro: quando o Caixa
marca "Recebi", a Agenda mostra **"pago"** ao lado do nome, sozinha. Guardar na Agenda o **vínculo
com a venda** (mensalidade ↔ venda, inscrição ↔ venda, uso livre ↔ venda).

- **Mensalidades em lote**: sanfona "Lançar todas as mensalidades de uma vez", aberta por padrão,
  listando **cada aluno com turma, mês e valor** (e "proporcional" quando for) e o total; um botão
  cria **uma Venda por aluno**, parcela vencendo no dia da turma. Mensalidade nasce em aberto no
  **1º dia do mês** para cada aluno de turma fixa (rotina do sistema ou ao abrir a tela — o
  planejador decide; sem duplicar).
- Itens do Catálogo que a Agenda usa (criados pela fase, editáveis em Cadastros): **"Mensalidade —
  <turma>"** (ou um item "Mensalidade" com o nome da turma na linha), **"Oficina — <nome>"** /
  "Inscrição em oficina", **"Uso livre (hora)"**, e os materiais do estoque (§6). Nenhum preço no
  código: preço da hora e das mensalidades são cadastro.
- Devolução e cancelamento de venda continuam no Financeiro (a tela diz isso).

## 6. Uso livre: chegada, encerramento, material e estoque

Fluxo: **Reservado → Chegou → Encerrado.**

- "Chegou" registra a hora real de chegada (proposta: a da reserva, editável). É o que vira
  **registro de uso** do espaço.
- Ao encerrar: hora de saída → **horas cheias** = teto((saída − chegada) / 60 min) × pessoas.
- **Material usado** (opcional, lista): item do estoque + quantidade + **cobrar / incluso**. Ao
  encerrar, **cada linha vira uma movimentação de saída no Estoque** com destino "uso do espaço"
  (nome já previsto no adendo do Estoque), origem `manual`, **vínculo com o uso livre** e custo médio
  do momento. "Cobrar" acrescenta o item (preço de venda do Catálogo × quantidade) à conta da
  pessoa, junto com as horas; "incluso" só baixa o estoque.
- Valor a receber = horas cheias × pessoas × preço da hora + Σ material cobrado. Vai para "A receber"
  e segue a §5.
- Mesmo com tudo "incluso", o Estoque passa a mostrar quanto o uso livre consome por mês — é o que
  vai embasar a decisão de cobrar ou não.

## 7. O site (calendário público)

- Mostra só eventos com **"Mostrar no calendário público"** marcado e não cancelados, a partir de hoje.
- Duas vistas: **Próximas** (turma fixa aparece uma vez, como "toda terça, 19h às 21h"; oficinas
  por data) e **Calendário mensal** (ponto por evento na cor do tipo; ponto cinza = esgotado; dia
  fechado marcado; toque no dia lista os eventos dele; navegação por mês).
- Cada cartão: nome, quando, preço (por mês ou por pessoa), "material incluso", **vagas restantes**
  (n vagas · últimas 2 · última vaga · esgotado) e botão **"Reservar pelo WhatsApp"** (some quando
  esgotado). **Sem nomes de alunos**, sem inscrição online.
- Bloco fixo **"Uso livre do ateliê"**: texto com preço da hora, ferramentas inclusas, queima inclusa,
  e botão **"Consulte disponibilidade no WhatsApp"**. Nada de lugares livres por período.
- Rota pública, sem login, lendo os mesmos dados (servidor); o número do WhatsApp é cadastro.

## 8. Números (aba)

Do mês até hoje: **horas de uso livre** (horas-pessoa e visitas) · **presença nas aulas** (% e faltas)
· **aulas a repor** em aberto · **pessoas diferentes** que passaram pelo espaço · **horas-pessoa por
dia da semana** (barra). Só leitura; sem cruzar com custo.

## 9. Dados (para o planejador)

- `turmas` (nome, dow, horário, vagas, valor, dia_vencimento, público, ativa) · `turma_alunos`
  (turma, cliente, entrou_em, saiu_em).
- `eventos` (tipo, data, início, fim, título, vagas, preço, público, cancelado, turma_id opcional).
- `inscricoes` (evento, cliente, presença: null/veio/faltou, tem_reposicao, é_reposição, venda_id).
- `mensalidades` (turma, cliente, mês, valor em centavos, venda_id) — "pago" **deriva da venda**.
- `usos_livres` (cliente, data, chegada, saída, pessoas, estado, venda_id) · `usos_livres_material`
  (uso, item_catalogo, quantidade em milésimos, cobrar, movimentacao_estoque_id).
- Dinheiro em centavos, quantidade em milésimos. Módulo puro `lib/agenda/` para: horas cheias,
  proporcional, créditos de reposição, geração de datas da turma, vagas restantes — testado, com
  "hoje" recebido por parâmetro.
- Cancelar/remover **nunca apaga** venda nem movimentação de estoque já gerada.

## 10. Fora desta fase

Reserva online · pacotes/planos (só se aparecer demanda) · lembrete automático por WhatsApp · lista
de espera · cobrança automática de mensalidade · integração com Queimas (peça de aula/uso livre é
"interna" na contagem, sem vínculo por pessoa).

## 11. Em aberto para a discussão da fase

1. Quando a mensalidade do mês nasce: rotina no dia 1 ou ao abrir a tela (proposta: ao abrir,
   idempotente).
2. Turma fixa: "estender mais N semanas" pela ficha da turma — confirmar se há tela de turma além
   do "Lançar" (proposta: sim, simples: editar, estender, desativar).
3. Item do Catálogo por turma ("Mensalidade — Torno iniciante") ou um item "Mensalidade" com o nome
   da turma na linha da venda (proposta: um item por turma, para o relatório por categoria).
4. O bloco "Agenda de hoje" do Início (`/gestao`) passa a ler `lib/agenda/consultas`.
