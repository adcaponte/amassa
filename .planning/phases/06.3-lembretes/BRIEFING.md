# Lembretes — a lista "Para fazer" ao lado das Anotações do Início

> Briefing escrito com o Theo no Cowork em **02/10/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Lembretes AMASSA", **aprovado pelo Theo em 02/10/2026**).
> **O protótipo vence sobre a interface; este documento vence sobre regra de dado.**
> Módulo **pequeno e isolado**; roda **logo depois dos Fornecedores** (item 7 da FILA), na mesma
> levada ou como fase curta própria. Não toca Financeiro, Estoque, Produção nem Agenda.

## 1. O que é, e por quê

O Início já tem a **folha da casa** (`anotacoes_da_casa`, uma linha só, "o que um escreve o outro
vê"). Ela continua **exatamente como está** — é para recado, ideia, telefone anotado às pressas. O
que falta é o item que nasce, fica pendente e some quando alguém marca feito: "pedir argila",
"modelar o protótipo da cumbuca para a Pousada". O bloco "Anotações" do Início vira **"Anotações e
lembretes"**: a folha de um lado, a lista **"Para fazer"** do outro (empilhados no celular).

## 2. Lembrete (dados)

Tabela `lembretes`: `id`, `texto` (1–200), `para_quando` (date, anulável = sem data),
`quem` (`usuario_id` anulável = "geral"), `feito_em` (timestamptz anulável), `feito_por`
(`usuario_id` anulável), `criado_em`, `criado_por`, `atualizado_em`.

- Da casa: todo usuário vê e mexe em todos. "Quem" é só uma etiqueta (Theo · Andressa · geral),
  não um filtro de permissão.
- 🔴 **Lembrete se apaga de verdade** ("Excluir"), ao contrário de tudo o mais na plataforma.
  Decisão do Theo (02/10): lembrete não é registro de dinheiro nem de estoque. Portanto **sem
  `revoke delete`** nesta tabela, e a ação de excluir apaga a linha. O e2e prova que apagou.
- Feito **não** apaga: grava `feito_em`/`feito_por`; desfazer limpa os dois.
- Sem prioridade, etiqueta, repetição, notificação, anexo ou vínculo com encomenda, cliente ou
  fornecedor. Se um dia precisar apontar para uma ordem, é um acréscimo.

## 3. Regras de tela (como no protótipo)

- **Criar em uma linha:** campo "+ lembrete · ex.: pedir argila…" no topo da lista; Enter ou
  "Guardar". Ao focar, aparecem as opções "para [data]" e "geral / Theo / Andressa" (padrão: sem
  data, geral). Texto vazio não cria.
- **Ordem dos abertos:** por `para_quando` crescente (vencidos primeiro), depois os sem data; empate
  por `criado_em`. Vencido (`para_quando < hoje`) em vermelho com "venceu dd/mm · N dias"; hoje em
  âmbar ("hoje"); amanhã = "amanhã"; demais = dd/mm.
- **No Início:** no máximo **6** abertos; acima disso, "e mais N — ver todos". Cabeçalho "Para fazer
  · N abertos · M vencidos" (ou "nada pendente"). Estado vazio com uma frase.
- **Feito:** caixinha à esquerda; marca → risca e vai para "Feitos (N)", dobrado no fim do bloco
  (os 5 mais recentes; o resto em "ver todos"); toast "Feito: …" com **Desfazer** por ~6 s.
  Desmarcar em "Feitos" reabre.
- **Editar** na própria linha (texto, data, quem); Enter salva; "cancelar".
- **Excluir** em qualquer lembrete, aberto ou feito, no bloco e em "ver todos"; apaga na hora, com
  **Desfazer** no toast por ~6 s (o desfazer recria com os mesmos dados — ou a exclusão só
  acontece quando o toast expira; o Code escolhe o mais simples de provar).
- **"Ver todos"** (folha ou rota `/gestao/lembretes`): filtros **Abertos / Feitos** e **Todos /
  Geral / Theo / Andressa**; cada linha mostra "por X · dd/mm hh:mm" e, nos feitos, "feito por Y ·
  dd/mm hh:mm". Lista com "Mostrar mais 50" se passar de 50.
- A folha da casa não muda: continua salvando sozinha com "X salvou às hh:mm" (**em Brasília** —
  conferir, a 04.6 pode estar mostrando UTC).
- Alvos de 44 px; sem rolagem lateral a 320 px; a lista inteira funciona no celular com um toque
  por ação.

## 4. Técnica, no padrão da casa

Uma migração (`lembretes`, sem `revoke delete`, com índice em `(feito_em, para_quando)`); Server
Actions com Zod: `criarLembrete`, `marcarFeito` (com desfazer), `editarLembrete`,
`excluirLembrete`; `verificar-acoes` passando; `lib/lembretes/{consultas,acoes,esquemas,textos}`;
`components/amassa/inicio/bloco-anotacoes.tsx` cresce para o bloco duplo (ou um
`bloco-lembretes.tsx` ao lado, no mesmo cartão). Testes unitários para a ordenação e os rótulos de
data (vencido/hoje/amanhã, virada de dia em Brasília). e2e: criar, marcar feito e desfazer, editar,
excluir e provar que sumiu do banco, "e mais N", filtros de "ver todos", 320 px. Sem roteiro de
operação além do `db:migrate` normal (sem pasta, sem volume).

## 5. Fora

Prioridade · repetição · lembrete por notificação/WhatsApp · anexos · vínculo com encomenda,
cliente ou fornecedor · lembrete privado (só meu) · histórico de edições.

## 6. Em aberto para o `/gsd-discuss-phase` (com recomendação)

1. "Ver todos" como folha dentro do Início ou rota própria `/gestao/lembretes`? Recomendado: rota
   própria (dá para abrir direto e cabe na navegação "todos os módulos" sem mexer na barra de
   baixo).
2. Feitos somem do bloco do Início depois de quanto tempo? Recomendado: ficam só os 5 mais
   recentes no "Feitos" dobrado, sem prazo; o resto só em "ver todos".
3. Excluir com desfazer: recriar a linha ou adiar a exclusão até o toast expirar? Recomendado:
   adiar (uma ação só, sem id novo), com a página revalidando quando efetivar.
