# Phase 5: Agenda - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 05-agenda
**Areas discussed:** Cadastro de clientes (fora da §11), §11.1 mensalidade, §11.2 tela de turma, §11.3 item do Catálogo, §11.4 bloco do Início, destino do material do uso livre, aula experimental

O dono pediu os quatro pontos da §11, um de cada vez, com recomendação. O cadastro de clientes veio
antes porque o briefing o pressupõe e ele não existe; os dois últimos foram achados na discussão e o
dono escolheu resolvê-los na hora em vez de deixá-los para a pesquisa.

---

## Cadastro de clientes (fora da §11)

| Option | Description | Selected |
|--------|-------------|----------|
| Criar o cadastro agora (Recommended) | Tabela de clientes em Cadastros; a Agenda usa; Vendas criadas pela Agenda gravam o vínculo; Venda manual, Orçamento e Produção seguem texto livre por ora | ✓ |
| Criar e já ligar à Venda | Mesmo cadastro, e a Venda manual ganha seletor de cliente — mexe no Financeiro no ar | |
| Agenda usa texto livre | Sem tabela; quebra ficha, créditos e "entrar na turma" | |

**User's choice:** Criar o cadastro agora.

---

## §11.1 — Quando nasce a mensalidade

| Option | Description | Selected |
|--------|-------------|----------|
| Ao abrir a tela, idempotente (Recommended) | Servidor cria as que faltam ao abrir; chave única no banco; padrão de `gerarContasDoMes` | ✓ |
| Rotina no dia 1 (cron do host) | Reabre "sem cron na aplicação"; falha em silêncio | |
| Botão manual | Explícito, mas é mais uma coisa a lembrar | |

**User's choice:** "acho que a 1. me parece o do prototipo, confere?"
**Notes:** Conferido e respondido: o protótipo não simula a virada do mês (mensalidades vêm dos dados
de exemplo; só a entrada na turma cria uma), mas mostra o resultado — mensalidades já em "A
receber", sem botão de gerar —, que só a opção 1 reproduz. Registrada como escolha dele.

---

## §11.2 — Tela de turma

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, simples (Recommended) | Editar, "Marcar mais N semanas", desativar | ✓ |
| Sem tela; estender pelo "Lançar" | Criaria outra turma; alunos entrariam de novo | |
| Sem tela; datas sem fim | Contraria o §2.3 | |

**User's choice:** Sim, simples.

---

## §11.3 — Item do Catálogo da mensalidade

| Option | Description | Selected |
|--------|-------------|----------|
| Um item "Mensalidade" (Recommended) | Turma na descrição da linha; preço vem da turma | ✓ |
| Um item por turma | Proposta do briefing; no Mês sai igual (agrupa por categoria) e o preço fica em dois lugares | |
| Uma categoria por turma | Só ela separa turmas no Mês; enche o Cadastro | |

**User's choice:** Um item "Mensalidade".
**Notes:** Recomendação contrária à proposta do briefing, com o motivo dito antes da pergunta.

---

## §11.4 — Bloco "Agenda de hoje" do Início

| Option | Description | Selected |
|--------|-------------|----------|
| Uso livre + aula em curso (Recommended) | Uso livre com "Chegou" não encerrado + inscritos de aula cujo horário cobre agora, sem "Faltou" | ✓ |
| Só uso livre com "Chegou" | Mostra 0 durante uma turma cheia | |
| Tirar a linha | Contraria GES-07 e a D-07 da 04.6 | |

**User's choice:** Uso livre + aula em curso.

---

## Fechar ou resolver mais dois pontos

| Option | Description | Selected |
|--------|-------------|----------|
| Resolver os dois agora (Recommended) | Mudam o que o sistema grava | ✓ |
| Fechar; deixar para a pesquisa | Voltariam no planejamento | |

---

## Destino do material do uso livre

| Option | Description | Selected |
|--------|-------------|----------|
| Destino novo, área Espaço (Recommended) | "Uso livre do espaço", vínculo ao uso livre; separa do consumo em aula | ✓ |
| Reusar "Consumo em aula" | Sem migração de destino, mas mistura os números | |
| Reusar "Uso do ateliê" | Área Peças — custo no resultado errado | |

**User's choice:** Destino novo, área Espaço.

---

## Aula experimental em turma fixa

| Option | Description | Selected |
|--------|-------------|----------|
| Decide na hora (Recommended) | "Cobrar" (sugere mensalidade ÷ aulas no mês, editável) ou "gratuita" | ✓ |
| Sempre gratuita | Como o protótipo | |
| Sempre cobra preço fixo | Campo a mais na turma; cortesia vira cobrança a cancelar | |

**User's choice:** Decide na hora.

---

## Claude's Discretion

- WhatsApp do site continua em `conteudo/site.ts` (D-17 da 04.6).
- Lugar da página pública do calendário e a revalidação; modelo de dados exato; como o "Lançar na
  Venda" abre o rascunho.

## Deferred Ideas

- Ligar Venda manual, Orçamento e Produção ao cadastro de clientes.
- O §10 do briefing inteiro.

---

## Depois da pesquisa — as dez perguntas abertas de `05-RESEARCH.md` (01/10/2026, `/gsd-plan-phase 5`)

Perguntadas em três formulários, cada uma com a recomendação da pesquisa como primeira opção.

| Pergunta | Escolha do dono | Vira |
|----------|-----------------|------|
| 1. Venda da Agenda cancelada no Caixa | Volta a "A receber" sozinha (derivado); "tirar da lista" bloqueado com venda ativa (rec.) | D-08 |
| 2. Dispensar cobrança não lançada | Sim, "Dispensar" marcado, nunca apaga, com desfazer (rec.) | D-09 |
| 3. Preço no site | Só nos cartões de evento; uso livre segue sem preço (rec.) | D-10 |
| 4a. Site sem evento público | Os três cartões de hoje, SIT-07 (rec.) | D-11 |
| 4b. Vagas da turma em "Próximas" | Vagas − alunos ativos (rec.) | D-12 |
| 5. Dia fechado × o que já está nele | Avisa, não bloqueia; etiqueta "dia fechado" (rec.) | D-13 |
| 6. Material "cobrar" | Só com preço cadastrado; categoria do "Uso livre (hora)"; preço congelado (rec.) | D-14 |
| 7. Publicação | Escrita à mão: "vamos publicar da melhor forma, nao tem importancia o site falhar agora." → uma publicação, `db:migrate` logo depois | D-15 |
| 8. Homônimos no cadastro | Permitir, com aviso por nome normalizado (rec.) | D-16 |
| 9. Itens do sistema em Cadastros | Protegidos: chave estável + gatilho; nome/preço/categoria editáveis (rec.) | D-17 |
| 10. Uso livre esquecido "no espaço" | Só conta o de hoje; o antigo ganha "encerrar" (rec.) | D-18 |

Antes das perguntas, o dono escolheu no mesmo formulário: **pesquisar antes de planejar** e **gerar o
UI-SPEC na mesma rodada** (o portão de UI bloquearia o planejamento sem ele).
