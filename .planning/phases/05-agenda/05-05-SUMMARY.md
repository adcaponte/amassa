---
phase: 05-agenda
plan: 05
subsystem: agenda
status: complete
tags: [agenda, seletor-de-pessoa, oficina, inscricao, lista-cheia, d-08, ui-d5, ui-d14, ui-d16, age-10, age-11, age-12]
requires:
  - "05-01: inscricoes (inscricoes_evento_cliente_uk, inscricoes_oficina_cobra), travarEvento/travarInscricao, RecusaDaAgenda, FolhaEvento, LinhaInscrito, semear-agenda.ts"
  - "05-03: CancelarEstaData (CLASSES_BOTAO_DE_ERRO), o molde de ConfirmarTirarBloqueio"
  - "05-04: listarClientes, FormularioCliente (contexto agenda, aoUsarExistente), TOAST_PESSOA_CADASTRADA"
provides:
  - "lib/agenda/vagas.ts (puro): vagasRestantes, rotuloDeVagas, listaCheia — o rótulo serve ao site no plano 15"
  - "lib/agenda/seletor.ts (puro): LIMITE_DO_SELETOR = 8, gruposDoSeletor, PessoaDoSeletor, GrupoDoSeletor"
  - "lib/agenda/textos.ts: frases do seletor, da faixa, da lista cheia, de tirar da lista, da D-08 e da UI-D14; rotuloDoGrupoDoSeletor(tipo)"
  - "lib/agenda/esquemas.ts: esquemaBuscarPessoas, esquemaColocarNaData, esquemaTirarDaLista"
  - "lib/agenda/consultas.ts: pessoasParaData (PessoasParaData), vendaDaInscricao; InscritoCarregado ganha cobrar, valorCentavos e venda"
  - "lib/agenda/gravacao.ts: travarInscricaoComVenda (InscricaoComVenda, VendaDaInscricao); EventoTravado ganha precoCentavos"
  - "lib/agenda/acoes.ts: buscarPessoasParaData, colocarNaData, tirarDaLista (96 ações no portão)"
  - "lib/clientes/consultas.ts: listarClientes aceita `restricao` (uma condição a mais escrita por quem chama)"
  - "SeletorPessoa (+ naoFecharComOSeletorAberto), ColocarAlguem, ConfirmarTirarDaLista"
  - "tests/e2e/apoio/semear-agenda.ts: inscricoesDoEvento, ligarVendaAInscricao, cancelarDocumentoNoBanco"
  - "data-testid: seletor-pessoa, seletor-campo, seletor-painel, seletor-opcao (data-cliente-id), seletor-cadastrar, seletor-ha-mais, seletor-mensagem, seletor-carregando, seletor-erro, colocar-alguem, faixa-colocar, colocar-na-lista, colocar-erro, aviso-lista-cheia, tirar-da-lista, confirmar-tirar-da-lista(-sim|-nao|-erro), venda-ativa, quem-vem, folha-evento-vazia"
affects:
  - "FolhaEvento: o Esc com a lista do seletor aberta não fecha a folha; “Colocar alguém” abaixo da lista (só avulsa não cancelada)"
  - "LinhaInscrito: linha de baixo da inscrição de oficina (tirar da lista ou a frase da UI-D14)"
tech-stack:
  added: []
  patterns:
    - "Combobox de busca no servidor por ação de LEITURA (exigirUsuario + Zod), com espera de 300 ms e só a última resposta valendo"
    - "Esc em combobox aberto dentro de um Dialog do Radix: preventDefault no onEscapeKeyDown pelo alvo do evento (o Radix ouve na captura do documento)"
    - "Recusa dentro da confirmação e router.refresh() ao fechá-la — a frase não some com a atualização da tela"
key-files:
  created:
    - lib/agenda/vagas.ts
    - lib/agenda/seletor.ts
    - components/amassa/agenda/seletor-pessoa.tsx
    - components/amassa/agenda/colocar-alguem.tsx
    - components/amassa/agenda/confirmar-tirar-da-lista.tsx
    - tests/unit/agenda-vagas.test.ts
    - tests/unit/agenda-seletor.test.ts
    - tests/e2e/agenda-colocar.spec.ts
  modified:
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - lib/clientes/consultas.ts
    - components/amassa/agenda/folha-evento.tsx
    - components/amassa/agenda/linha-inscrito.tsx
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "Teto do seletor: 8 por grupo + “Há mais pessoas com esse nome — continue digitando.” (backstop E8, a decisão que o plano já trazia)"
  - "O “Cadastrar “…”” do seletor salva e ESCOLHE a pessoa (verdade 1 do plano); o botão do formulário continua “Salvar pessoa”, não o “Salvar e colocar” da UI-SPEC"
  - "Recusa de colocar (já na lista, data cancelada) revalida a Agenda; recusa de tirar (D-08) não — a frase fica no diálogo e a folha se atualiza ao fechá-lo"
  - "tirarDaLista recusa data cancelada e inscrição que não é de oficina (reposição/experimental chegam no plano 08)"
metrics:
  duration: "~25 min (18:55 → 19:20, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 2
  files: 17
actuals:
  tokens: 19200
  tasks: 2
  commits: 3
---

# Phase 5 Plan 05: colocar alguém numa oficina e tirar da lista — Summary

**O gestor acha a pessoa pelo nome no seletor. “joao” acha “João”, por pedaço do nome, e quem já
está na data não aparece. Quem chegou pela primeira vez se cadastra ali mesmo, pelo
“Cadastrar “…””. A pessoa entra na oficina como inscrição paga à parte, com o preço do evento
copiado pelo servidor sob a trava. Passar das vagas mostra a caixa âmbar e grava do mesmo jeito.
Tirar da lista pede confirmação. A inscrição que já virou venda não cancelada não sai pela Agenda:
a linha mostra a frase da D-08 com “ver no Caixa”, e o servidor recusa se a tela estiver velha.**

## O que foi feito

### Tarefa 1: o seletor de pessoa (commits `5254f91` RED, `fb6028d` GREEN)

- **Módulos puros, com teste de pureza.** Cada um só importa `./textos`.
  - `vagas.ts`: `vagasRestantes` pode ficar negativo. `rotuloDeVagas` devolve “{n} vagas”, “últimas
    2 vagas”, “última vaga” ou “esgotado” (zero ou menos). `listaCheia` é `inscritos >= vagas`.
  - `seletor.ts`: `LIMITE_DO_SELETOR = 8`. `gruposDoSeletor` monta “Tem aula a repor” (vazio até o
    plano 08) e depois o grupo do contexto. Corta cada um em 8, marca `temMais` e não repete quem
    já está no primeiro grupo.
  - `rotuloDoGrupoDoSeletor(tipo)` em `textos.ts`: “Inscrever” na avulsa, “Aula experimental /
    avulsa” na turma e “Pessoas” sem data.
- **A leitura.**
  - `pessoasParaData` reaproveita `listarClientes` com `quantos: LIMITE_DO_SELETOR + 1` e uma
    `restricao` nova, `not exists` das inscrições daquela data.
  - Com a busca vazia, não lista ninguém e responde só se existe alguém cadastrado. É o que separa
    “Digite para buscar.” de “Ninguém cadastrado ainda. Digite o nome para cadastrar.”.
  - `buscarPessoasParaData` é uma ação de leitura: `exigirUsuario()` primeiro, Zod com `eventoId`
    uuid opcional e `busca` de até 160 caracteres, e devolve os grupos prontos.
- **`SeletorPessoa`.**
  - O campo tem `role=combobox`, `aria-expanded`, `aria-controls` e `aria-activedescendant`, 16px e
  44px de altura.
  - O `listbox` contém só grupos (`role=group` + `aria-label`) e opções. O esqueleto de 3 linhas, o
    erro com “Tentar de novo” e as mensagens de vazio ficam fora dele.
  - Teclado: as setas percorrem, Enter escolhe e Esc fecha só a lista.
  - `naoFecharComOSeletorAberto` vai no `onEscapeKeyDown` da folha. O Radix ouve o Esc na captura
    do documento, antes do campo.
  - A busca espera 300 ms e só a última resposta vale.
  - Cada linha mostra o nome (Corpo 600) e o telefone (Apoio `tinta-fraca`). Sem telefone, só o nome.
  - “Cadastrar “{texto}”” abre o `FormularioCliente` (`contexto="agenda"`) com o nome escrito, por
    cima da folha. Salvo, ou com “Usar … que já existe”, a pessoa fica escolhida.

### Tarefa 2: colocar e tirar (commit `acd24f2`)

- **`colocarNaData`.**
  - `exigirUsuario()` primeiro. Zod com os dois ids e nenhum valor.
  - Trava o evento. Se ele não existe ou a data foi cancelada, devolve a frase. Data de turma
    recebe a frase genérica, até o plano 08.
  - Faz `insert` de `oficina` com `cobrar = true` e `valor_centavos` = o `preco_centavos` lido sob a
    trava, `on conflict (evento_id, cliente_id) do nothing`.
  - Se nada foi inserido, responde “{nome} já está nesta lista — a tela foi atualizada.” e
    revalida. Não existe conta de vagas em lugar nenhum do servidor.
- **`tirarDaLista`.**
  - `exigirUsuario()` primeiro. `travarInscricaoComVenda` trava a inscrição
    (`for no key update ... of inscricoes`) e LÊ o `numero` e o `cancelado_em` da venda na mesma
    instrução, sem travar o documento.
  - Responde “Isso já tinha sido removido.” quando a inscrição sumiu, a frase da data cancelada, e
    a genérica quando a inscrição não é de oficina.
  - Com a venda não cancelada, recusa com a frase da D-08, verbatim. Sem venda, ou com ela
    cancelada, faz `delete`.
  - As duas ações revalidam com o `publico` do evento.
- **`obterEvento`** traz, por inscrito, `cobrar`, `valorCentavos` e `venda: { numero, cancelada } |
  null`. A venda vem de um `left join documentos` e é montada por `vendaDaInscricao`.
- **Tela.**
  - `ColocarAlguem` só aparece em avulsa não cancelada. Tem o seletor, a caixa âmbar
    `aviso-lista-cheia` (`atencao-fundo`/`atencao`, nunca vermelha) e a faixa `aria-live=polite`
    “{nome} entra como inscrição de {R$} — vai para “A receber”.”.
  - O botão “Colocar na lista” é `outline`. Enquanto grava, fica “Colocando…” com `disabled`,
    `aria-busy` e guarda síncrona. Depois mostra o toast “Inscrito. A inscrição foi para “A
    receber”.”.
  - Na `FolhaEvento`, “Quem vem · {n} de {vagas}” conta todas as inscrições. “Ninguém inscrito
    ainda.” aparece com o “Colocar alguém” logo abaixo. A lista rola dentro da folha e o rodapé
    continua preso.
  - Na `LinhaInscrito` de oficina, a linha de baixo mostra “tirar da lista” (44px, `tinta-media`
    sublinhado, `aria-label` “Tirar {nome} da lista”). Com a venda ativa, mostra no lugar “Já virou
    a venda nº {N} — para devolver, cancele a venda no Caixa.” + “ver no Caixa” (`hrefDoCaixa()`).
  - `ConfirmarTirarDaLista`: “Tirar {nome} da lista?” / “A inscrição sai desta data e de “A
    receber”.”, com os botões “Manter na lista” · “Tirar da lista” (`outline` de erro). O erro
    aparece dentro do diálogo. Depois de tirar, o toast “{nome} saiu da lista.”.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-vagas.test.ts tests/unit/agenda-seletor.test.ts` (RED) | falhou como esperado: os 2 arquivos, porque os módulos não existiam |
| o mesmo depois de implementar | **14/14** |
| `npm run verificar` (Tarefa 1) | **verde**: 106 arquivos / 2002 testes, `verificar-acoes` 94 ações e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run verificar` (Tarefa 2) | **verde**: 106 / 2002, **96 ações**, 0 violações, `test:migracoes` verde. As linhas “1 violação” do log são os fixtures do próprio `verificar-acoes` |
| `npm run test:e2e -- --grep "agenda colocar"` | **60 passed (1.1m)** na primeira: `agenda colocar` (a)-(d) × desktop e celular, mais a cadeia `vazio-*` |

Fiz **uma** invocação de e2e no plano, na Tarefa 2, como o orçamento pedia. A Tarefa 1 ficou coberta
pelos unitários e pelo e2e da Tarefa 2. Não rodei `npm run build` separado nem a varredura sem
`--grep`, que é do plano 16. O log repete `digest: '1591381167'` (“destination stream closed
early”), o mesmo ruído dos planos 02-04, e nenhum teste falhou por causa dele.

**Não rodei de novo `agenda tracador`, `agenda cancelamento` e `agenda lancamento`**, que também
abrem a folha do evento. Li os três. Nenhum usa Esc, combobox, ou um nome de botão que agora
apareça duas vezes. Na data cancelada a folha continua só de leitura. A varredura do plano 16 é a
prova.

Greps de aceite:
- `LIMITE_DO_SELETOR = 8` em `seletor.ts`: 1.
- `combobox` em `seletor-pessoa.tsx`: 4. `listbox`: 4.
- `Esta inscrição já virou a venda nº` em `textos.ts`: 1.
- `for("no key update"` em `gravacao.ts`: de 2 para **3**.
- `listaCheia` ou `vagasRestantes` em `acoes.ts`, `gravacao.ts` e `db/`: nada. Lista cheia nunca
  bloqueia.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3] `lib/clientes/consultas.ts` fora da lista do plano**
- O plano pede para reaproveitar `listarClientes` “excluindo os `cliente_id` já inscritos
  (subconsulta `not exists`)”, mas a função não aceitava um filtro a mais.
- Ganhou o parâmetro opcional `restricao?: SQL`. Quem chama sem ele, que são as duas telas do
  plano 04, não muda. O módulo de clientes continua sem conhecer as tabelas da Agenda.
- **Commit:** `fb6028d`.

**2. Todas as frases entraram no commit da Tarefa 1**
- `lib/agenda/textos.ts` está na lista das duas tarefas. As frases de colocar, tirar e da D-08
  foram escritas de uma vez, no `fb6028d`.
- O commit da Tarefa 2 não toca em `textos.ts`.

**3. [Rule 2] `EventoTravado` ganhou `precoCentavos`**
- O preço da inscrição precisa ser lido SOB A TRAVA do evento (T-05-24). `travarEvento` já era a
  trava, então passou a ler também o preço, e `cancelarData` não muda.

Nenhuma outra. Nenhuma migração, nenhum pacote novo, e a `0026` não mudou.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, sem banco nenhum fora do
efêmero.

1. **O “Cadastrar “…”” do seletor salva e escolhe a pessoa, sem colocá-la.** A tabela de Ações da
   UI-SPEC diz “Cadastrar “{texto}”” → “Salvar e colocar”. A verdade 1 do plano diz “salvo,
   escolhe a pessoa”, e o mesmo seletor serve ao “Quem” do uso livre (plano 09) e à experimental
   (plano 08, que pede “Cobrar · Gratuita” antes de colocar). Por isso o formulário continua com
   “Salvar pessoa”, e a faixa + “Colocar na lista” aparecem em seguida: um toque a mais. Também
   mostra o toast “Pessoa cadastrada.”. *Desfazer:* dar ao `FormularioCliente` um rótulo de botão
   opcional e, em `ColocarAlguem`, chamar `colocarNaData` logo depois do `aoEscolher` vindo do
   cadastro.
2. **A caixa “A lista já está cheia…” aparece assim que a lista enche**, antes de escolher a
   pessoa, entre o seletor e a faixa. A UI-SPEC diz “acima do botão”, e o botão só existe depois
   de escolher. *Desfazer:* em `colocar-alguem.tsx`, trocar `cheia ?` por
   `cheia && escolhida !== null ?`.
3. **Recusa ao colocar revalida a tela; recusa ao tirar, não.** Ao colocar, a frase já diz “a
   tela foi atualizada”. Ao tirar, a frase da D-08 fica dentro do diálogo, porque atualizar na
   hora trocaria a linha e fecharia o diálogo junto com a frase. A folha só se atualiza
   (`router.refresh()`) quando o diálogo fecha. *Desfazer:* em `tirarDaLista`, chamar
   `revalidarTelasDaAgenda` também no ramo da `RecusaDaAgenda`.
4. **`tirarDaLista` recusa data cancelada**, com a frase de data cancelada, e **inscrição que não
   é de oficina**, com a frase genérica. A lista cancelada já é só de leitura na tela. Reposição e
   experimental entram no plano 08, e o aluno sai da turma pela ficha. *Desfazer:* tirar as duas
   condições em `tirarDaLista`.
5. **Frases que a UI-SPEC não fixa:**
   - “Não deu para colocar na lista. Verifique a internet e tente de novo.”;
   - “Não deu para tirar da lista. Verifique a internet e tente de novo.” (as duas no molde da
     “ação genérica”);
   - “Tirando…”, no molde de “Tirando…” do bloqueio.

   *Desfazer:* `lib/agenda/textos.ts`.
6. **A busca vazia não lista ninguém**, e o seletor mostra “Digite para buscar.”. A UI-SPEC liga
   essa frase a “busca vazia, sem ninguém a repor”, e no plano 08 o grupo “Tem aula a repor”
   aparece mesmo com a busca vazia. *Desfazer:* em `pessoasParaData`, listar com `busca` vazia
   também.

## Para o dono olhar no portão (plano 16)

Itens da verificação de reserva (backstop), não automatizados:
- **E6·overflow:** semear uma oficina com 20 inscritos e abrir a folha a 360×640. A lista tem que
  rolar dentro da folha, e o rodapé com “Pronto” e “Cancelar esta data” continua preso e visível.
- **E8·overflow:** cadastrar 200 pessoas e digitar “a” a 360px. A lista para em 8 e mostra “Há
  mais pessoas com esse nome — continue digitando.”. A faixa e o “Colocar na lista” têm que ficar
  alcançáveis sem rolar a folha inteira.
- **E8·long-text:** digitar 160 caracteres a 320px. “Cadastrar “{texto}”” quebra sem estourar, e um
  resultado com nome de 160 caracteres quebra dentro da opção, como o `[overflow-wrap:anywhere]` já
  manda.
- **No celular de verdade:** tocar numa linha do seletor com o teclado aberto escolhe a pessoa?
  O `onMouseDown` com `preventDefault` segura o foco no campo, e no Android real vale conferir.

## Known Stubs

Nenhum que impeça o objetivo do plano. Três faltas são de propósito e cada uma já tem dono, como os
comentários do código dizem:
- O grupo “Tem aula a repor” sai sempre vazio (`aRepor: []` em `pessoasParaData`). Entra no plano
  08.
- O “Colocar alguém” não aparece em data de turma, e `colocarNaData` recusa a turma. Plano 08.
- As tags da situação do pagamento da inscrição (“a receber”, “venda nº N cancelada”…) entram no
  plano 11.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-23:** as três ações novas têm `exigirUsuario()` primeiro. O portão passou de 93 para 96
  ações, com 0 violações.
- **T-05-24:** o esquema de `colocarNaData` só aceita os dois ids, e o valor vem de
  `travarEvento(...).precoCentavos`.
- **T-05-25:** trava da inscrição e leitura do `cancelado_em` na mesma instrução. A recusa é
  provada pelo e2e (d) com a tela velha.
- **T-05-26:** `inscricoes_evento_cliente_uk` + `onConflictDoNothing`. O e2e (b) prova com duas
  abas.
- **T-05-27:** aceito. O telefone aparece só atrás de `exigirUsuario()`.

## TDD Gate Compliance

- Tarefa 1: `test(05-05)` `5254f91` (RED) → `feat(05-05)` `fb6028d` (GREEN). Sem refatoração.
- Tarefa 2: não era `tdd`. Commit único, `acd24f2`.

## Self-Check: PASSED

- Os 8 arquivos novos estão presentes: `vagas.ts`, `seletor.ts`, `seletor-pessoa.tsx`,
  `colocar-alguem.tsx`, `confirmar-tirar-da-lista.tsx`, os dois unitários e a spec.
- Os commits `5254f91`, `fb6028d` e `acd24f2` estão no branch `gsd/phase-05-agenda`. Não houve push
  nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff c6a2a1d..HEAD` nesses
  três arquivos não lista nada.
