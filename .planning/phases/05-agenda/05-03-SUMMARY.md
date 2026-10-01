---
phase: 05-agenda
plan: 03
subsystem: agenda
status: complete
tags: [agenda, lancamento, cancelamento, vista-mes, d-13, contraste]
requires:
  - "05-01: lib/agenda/* (semana, abas, textos, esquemas, consultas, gravacao, acoes), SemanaDaAgenda, CartaoEvento, FolhaEvento, semear-agenda.ts"
  - "05-02: a 0026 provada (check inscricoes_direito_so_com_falta corrigido)"
provides:
  - "lancarAvulsa, fecharDia, conferirDiaParaLancar, cancelarData (estado desejado + perdas), tirarBloqueio (lib/agenda/acoes.ts)"
  - "travarEvento, contarPerdasAoCancelar, temPerdas, PerdasAoCancelar (lib/agenda/gravacao.ts)"
  - "lerDiaParaLancar, lerMes, perdasAoCancelar; EventoCarregado ganha publico e perdasAoCancelar (lib/agenda/consultas.ts)"
  - "diaDaUrl, lancarDaUrl, vistaDaUrl, mesDaUrl, VistaDaAgenda (lib/agenda/abas.ts)"
  - "gradeDoMes, resumoDoDia, pontosDoDia, tituloDoMes, mesVizinho, rotuloDaCelulaDoMes, TipoDoPonto (lib/agenda/semana.ts)"
  - "FolhaLancar (pílulas avulsa/fechado — os planos 06 e 09 acrescentam turma e uso livre), BarraDaAgenda, GradeDoMes/EsqueletoDoMes, FolhaFechado, CancelarEstaData, ConfirmarTirarBloqueio, enderecoDaAgendaCom"
  - "semearFechado, semearTurmaComDatas, eventoNoBanco, eventosComTitulo, inscricaoNoBanco, marcarPresencaNoBanco (tests/e2e/apoio/semear-agenda.ts)"
  - "data-testid: agenda-lancar, agenda-hoje, agenda-anterior, agenda-proxima, agenda-titulo, agenda-vista-{semana|mes}, agenda-mes, mes-dia-{data}, agenda-lancar-no-dia, folha-lancar, lancar-tipo-{avulsa|fechado}, lancar-gravar, lancar-erro-{campo}, aviso-dia-fechado, folha-fechado, cancelar-data, desfazer-cancelamento, tirar-bloqueio, confirmar-cancelar-data(-sim|-nao|-erro), confirmar-tirar-bloqueio(-sim|-nao|-erro)"
affects:
  - "A barra ‹ título › saiu de SemanaDaAgenda para BarraDaAgenda; os testids agenda-semana-anterior/agenda-proxima-semana/agenda-titulo-semana do plano 01 (que nenhum teste usava) viraram agenda-anterior/agenda-proxima/agenda-titulo"
  - "ordenarNoDia desempata o mesmo horário por TÍTULO antes do tipo (ver Decidido 1)"
tech-stack:
  added: []
  patterns:
    - "Ação de cancelar devolve { situacao: 'confirmar', perdas } sem gravar quando algo se perderia e a tela não confirmou — a confirmação nunca depende de dado velho da tela"
    - "Folha que não precisa do servidor abre por pushState (enderecoDaAgendaCom + irParaSemNavegar); a vista que precisa do banco espera atrás de Suspense com o esqueleto dela"
key-files:
  created:
    - components/amassa/agenda/folha-lancar.tsx
    - components/amassa/agenda/barra-da-agenda.tsx
    - components/amassa/agenda/grade-do-mes.tsx
    - components/amassa/agenda/folha-fechado.tsx
    - components/amassa/agenda/confirmar-cancelar-data.tsx
    - components/amassa/agenda/confirmar-tirar-bloqueio.tsx
    - components/amassa/agenda/url-da-agenda.ts
    - tests/unit/agenda-esquemas.test.ts
    - tests/e2e/agenda-lancamento.spec.ts
    - tests/e2e/agenda-cancelamento.spec.ts
    - tests/e2e/agenda-vistas.spec.ts
  modified:
    - lib/agenda/abas.ts
    - lib/agenda/semana.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - app/gestao/(app)/agenda/loading.tsx
    - components/amassa/agenda/semana-da-agenda.tsx
    - components/amassa/agenda/folha-evento.tsx
    - tests/unit/agenda-abas.test.ts
    - tests/unit/agenda-semana.test.ts
    - tests/unit/contraste.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "Desempate do dia por título (UI-SPEC e verdade do plano 03) — revoga o Decidido 11 do plano 01"
  - "cancelarData aceita `confirmado` opcional e confere as perdas SOB A TRAVA; sem confirmação e com perda, devolve as perdas sem gravar"
  - "gradeDoMes(“2026-02”) tem 35 células, não 42 — o plano errou o exemplo; o caso de 42 é março de 2026"
metrics:
  duration: "~35 min (17:52 → 18:28, 01/10/2026)"
  completed: 2026-10-01
  tasks: 3
  files: 26
actuals:
  tokens: 44700
  tasks: 3
  commits: 5
---

# Phase 5 Plan 03: Lançar, cancelar e andar pela Agenda — Summary

**A folha “Lançar na agenda” lança uma aula ou oficina avulsa (preço em centavos inteiros, “0” vale)
e fecha um dia, e avisa sem bloquear quando o dia está fechado ou já tem algo (D-13). “Cancelar esta
data” risca a data sem apagar nada. Ela pede confirmação só quando algo se perde, e o servidor confere
isso de novo sob a trava. Dá para desfazer pelo toast ou pela folha. O fechado é o único evento que se
remove, com `delete … and tipo = 'fechado'` na própria instrução. A barra ganhou “‹ ›”, “Hoje” (que
rola até hoje) e o alternador “Semana · Mês”. A grade do mês mostra até seis pontos por dia e o resumo
com plural de verdade no `aria-label`.**

## O que foi feito

### Tarefa 1: lançar uma aula avulsa e fechar um dia (commits `8f344ec` RED, `c47bf02` GREEN)

- `abas.ts`: `diaDaUrl`, `lancarDaUrl` (só o "1"), `vistaDaUrl`, `mesDaUrl(valor, hoje)`. Valor
  desconhecido ou lista cai no padrão.
- `esquemas.ts`: `esquemaLancarAvulsa` com título aparado e contado em pontos de código (1..120),
  data civil, “HH:MM” com fim depois do começo (o erro fica no campo do fim), vagas inteiras de 1 a
  999 e preço por `converterReaisParaCentavos` (vazio é erro, “0” vale 0). Também
  `esquemaFecharDia`, `esquemaConferirDia`, `esquemaCancelarData` e `esquemaTirarBloqueio`. A folha
  roda o mesmo esquema antes de gravar, e o servidor roda de novo.
- Ações (`exigirUsuario()` primeiro, 89 → 91 no `verificar-acoes`):
  - `lancarAvulsa` e `fecharDia` devolvem o erro de cada campo em `campos`. Nenhuma das duas recusa
    por dia fechado nem por horário repetido. O fechado nasce com `publico = false` e revalida o
    site.
  - `conferirDiaParaLancar` devolve só `{ fechadoMotivo, lancamentos }`.
- `FolhaLancar` abre por `?lancar=1&dia=` via `pushState` e fecha do mesmo jeito.
  - Pílulas em `radiogroup` (“O que lançar”). A última escolha vale enquanto a página está aberta.
  - Todos os campos ficam num estado só, então trocar de pílula mantém o que foi digitado.
  - O aviso D-13 fica numa região `role=status` que existe sempre.
  - O erro aparece embaixo do campo e o foco vai ao primeiro campo com erro. Foco inicial só a
    partir de 768px.
  - Uma guarda síncrona impede o toque duplo. Ao gravar: toast, `replaceState` e `router.push`
    para a semana da data.
- `BarraDaAgenda` traz “‹ título ›”, “+ Lançar na agenda” (o único terracota) e “Hoje”. Cada dia
  ganhou o “+ lançar” (44px, `aria-label` “Lançar em {dia}, {dd/mm}”). O cartão do fechado já vinha
  do plano 01. A ordem do dia passou a usar o título como desempate (Decidido 1).

### Tarefa 2: cancelar, desfazer, tirar o bloqueio (commit `ef66c6f`)

- `travarEvento` (`for no key update`) e `contarPerdasAoCancelar`: presenças marcadas, e inscrições
  cobradas, não dispensadas, sem venda ou com venda cancelada.
- `cancelarData` trabalha com estado desejado:
  - fechado → recusa;
  - já no estado pedido → sucesso sem gravar;
  - cancelar sem `confirmado` e com perdas → `{ situacao: "confirmar", perdas }`, nada gravado;
  - cancelar → carimbos, e na mesma transação limpa `presenca` e `direito_a_repor`;
  - desfazer → limpa os carimbos, e as presenças não voltam.
- `tirarBloqueio` usa `db.delete(eventos).where(and(eq(id), eq(eventos.tipo, "fechado")))`. Se
  nenhuma linha for afetada, responde “Isso já tinha sido removido.”.
- `CancelarEstaData` fica no rodapé `justify-between` da folha do evento. Os títulos e corpos vêm do
  Copywriting, com “Cancelando…” e o erro dentro do diálogo. O “Desfazer” do toast só age no
  primeiro toque e, se falhar, mostra a frase da E29.
- `FolhaFechado` tem o título com quebra livre ao lado do fechar 44×44 e o rodapé `flex-wrap`.
  `ConfirmarTirarBloqueio` mostra “Tirando…” e o erro dentro do diálogo. Quem tira o bloqueio não
  recebe o toast de link velho do próprio evento.

### Tarefa 3: semana, Hoje e o mês (commits `19a8a03` RED, `a7348b5` GREEN)

- Funções puras: `gradeDoMes` (corta a 6ª linha só quando ela é toda fora do mês, igual ao
  protótipo), `resumoDoDia`, `pontosDoDia`, `tituloDoMes`, `mesVizinho` e `rotuloDaCelulaDoMes`.
- `lerMes(mes)` lê os eventos não cancelados da primeira à última célula da grade.
- Página com `?vista=`. O mês fica atrás de `<Suspense fallback={<EsqueletoDoMes/>}>`, com o
  cabeçalho dos dias e 35 células de 52px. O `loading.tsx` continua sendo a semana, agora com a
  fileira de 52px.
- O alternador neutro é um `tablist` de links, com setas e Home/End. “Hoje” rola na própria semana,
  ou navega com `#dia-{hoje}` quando está em outra. Abrir sem `?semana=` rola até hoje, instantâneo.
- `GradeDoMes`:
  - célula `<button>` de `min-h-[52px]`; fora do mês em `superficie-2`; hoje com borda 2px `acento`;
  - ponto ouro com `outline-tinta-fraca`;
  - legenda, “Nada marcado neste mês.” e a dica;
  - tocar leva a `?semana={dia}#dia-{dia}`.
- `contraste.test.ts` ganhou o bloco “contraste da Agenda (05-UI-SPEC.md)” com os pares A1-A17 (25
  linhas). Ele afirma que o ouro sozinho fica abaixo de 3 nos três fundos e confere, lendo
  `grade-do-mes.tsx`, que o contorno está lá e que não há hex no arquivo.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-abas.test.ts tests/unit/agenda-esquemas.test.ts` (RED) | 22 falhas, como esperado |
| o mesmo depois de implementar | 1 falha. O Zod 4 roda o `superRefine` mesmo com hora vazia, e `minutosDe("")` lançava. Corrigi conferindo o formato antes. Depois disso, 29/29 |
| `npm run verificar` (Tarefa 1) | **verde**: 102 arquivos / 1888 testes, `verificar-acoes` 89 ações e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "agenda lancamento"` | **58 passed (1.2m)**: 5 casos × desktop e celular, mais a cadeia `vazio-*` |
| `npm run lint`, `verificar-acoes` (91, 0 violações), `npx vitest run` (1888) (Tarefa 2) | verdes. Não rodei o `verificar` completo nesta tarefa: o `test:migracoes` não muda sem schema |
| `npm run test:e2e -- --grep "agenda cancelamento"` | **56 passed (51.9s)**: 4 casos × 2 projetos |
| `npx vitest run tests/unit/agenda-semana.test.ts tests/unit/contraste.test.ts` (RED) | 14 falhas (13 da semana e o teste do contorno); os 25 pares A1-A17 já passavam, como era de esperar |
| `npm run verificar` (Tarefa 3) | **verde**: 102 arquivos / 1932 testes, 91 ações, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda vistas\|agenda tracador\|/gestao/agenda não tem violação\|nenhuma das oito rotas exige rolagem"` | **66 passed, 2 failed**. O caso (a) de `agenda vistas` tocava “‹” duas vezes sem esperar a primeira navegação, e o segundo toque usava o link velho. Era defeito do teste. O traçador, o axe de `/gestao/agenda` e o 320px da casca passaram nos dois projetos |
| `npm run test:e2e -- --grep "agenda vistas"` (2ª, depois de esperar o título entre os toques) | **58 passed (53.3s)** |

Fiz **quatro** invocações de e2e. O orçamento era três: a Tarefa 3 precisou de uma segunda para
provar a correção do teste. Não rodei `npm run build` separado nem varredura sem `--grep`, que é do
plano 16. O log do servidor repete `digest: '1591381167'` também durante os testes `@vazio-global` de
outros módulos. É o mesmo ruído que o 05-02 registrou (“destination stream closed early”), e nenhum
teste falhou por causa dele.

Greps de aceite:
- “Este dia está fechado”: 1. `lotação|sobreposição|capacidade` em `textos.ts`: 0.
- “Lançar aula|Fechar o dia”: 2. “Isso já tinha sido removido”: 1. “A data continua cancelada”: 1.
- `eq(eventos.tipo, "fechado")` em `acoes.ts`: 1. “contraste da Agenda”: 1.
- “Semana anterior|Próxima semana|Mês anterior|Próximo mês”: 4 em `textos.ts`. A barra recebe os
  rótulos por prop.
- `toISOString` nos e2e da Agenda: 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - erro do plano] `gradeDoMes("2026-02")` não tem 42 células**
- **Found during:** Tarefa 3, ao escrever o RED.
- **Issue:** o `<behavior>` diz que fevereiro de 2026 “começa num domingo” e por isso tem 42
  células. Ele começa mesmo num domingo, mas com 28 dias termina no sábado 28/02, dentro da 5ª
  linha, e a 6ª linha fica toda fora do mês. A regra herdada do protótipo
  (`if(i>=35&&fora)break`) dá 35.
- **Fix:** o teste prova 42 com março de 2026 (começa num domingo e tem 31 dias) e prova que
  fevereiro de 2026 dá 35. A regra não mudou.

**2. [Rule 2] `cancelarData` confere as perdas sob a trava**
- **Issue:** se a confirmação dependesse só do que a folha leu ao abrir, uma presença marcada em
  outro celular depois disso se perderia sem aviso, o que quebra o “nada de exclusão silenciosa”.
- **Fix:** `confirmado?: boolean` no esquema. Sem ele e com perdas, a ação devolve
  `{ situacao: "confirmar", perdas }` sem gravar, e a tela abre a confirmação com os números de agora.
- **Commit:** `ef66c6f`

**3. [Rule 1] O corpo da confirmação da oficina também cita presenças**
- O corpo da UI-SPEC para oficina fala só das inscrições em “A receber”. Uma oficina com presença
  marcada também perde essa presença ao cancelar. O corpo ganhou a frase das presenças e “Desfazer
  o cancelamento não as devolve.” (`corpoConfirmarCancelarOficina`).

**4. [Rule 3] Testes de esquema num arquivo novo**
- `tests/unit/agenda-esquemas.test.ts` não estava na lista de arquivos do plano. O `<behavior>` da
  Tarefa 1 pede esses casos, e eles não cabem em `agenda-abas.test.ts`.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nada foi aplicado em banco
nenhum fora do efêmero.

1. **Desempate do dia por título.** A ordem passa a ser fechado → início → título (`Intl.Collator`
   pt-BR, sem caixa nem acento) → tipo → id. É o que a UI-SPEC e a verdade do plano 03 dizem, e
   revoga o Decidido 11 do 05-01. *Desfazer:* tirar o bloco `porTitulo` de `comparar` em
   `lib/agenda/semana.ts` e o caso novo de `agenda-semana.test.ts`.
2. **“Hoje” na vista Mês leva ao mês de hoje** e mantém a vista, em vez de levar à semana de hoje. A
   UI-SPEC só define o “Hoje” da semana. *Desfazer:* em `VistaDoMes` (page.tsx), `hrefHoje` aponta
   para `semana=${hoje}#dia-${hoje}`.
3. **Rolagem até hoje ao abrir sem `?semana=`: instantânea sempre** (`behavior: "instant"`). O
   “Hoje” e o `#dia-` usam o `scroll-behavior` do `:root`: suave, salvo com
   `prefers-reduced-motion`. *Desfazer:* tirar o `behavior` do `scrollIntoView` em
   `semana-da-agenda.tsx`.
4. **Esqueleto do mês num `Suspense` da página**, porque o `loading.tsx` não recebe a URL e não sabe
   a vista. O `loading.tsx` continua sendo a semana. *Desfazer:* tirar o `Suspense` de `VistaDoMes`.
5. **Alternador “Semana · Mês” como links `role="tab"`**, no molde de `abas-financeiro.tsx`, e não
   como botões. A semana aponta para o mês dela: o de hoje, se a semana contém hoje; senão o da
   quinta-feira. O mês aponta para a semana de hoje, se for o mês de hoje; senão a do dia 1.
   *Desfazer:* `hrefsDaVista` em page.tsx.
6. **A folha do evento continua aberta depois de cancelar.** Ela mostra “· cancelada”, a lista só de
   leitura e “Desfazer cancelamento”, e “Pronto” fecha. A UI-SPEC não diz se ela fecha. *Desfazer:*
   chamar `aoFechar` em `avisarCancelada`.
7. **Frases que a UI-SPEC não fixa:** “O nome pode ter até 120 caracteres.”, “O motivo pode ter até
   120 caracteres.”, “Não deu para cancelar a data. …”, “Não deu para desfazer o cancelamento. …”,
   “Não deu para tirar o bloqueio. …”, “Tirando…”, “Desfazendo…”, e “O dia fechado não se cancela —
   use “Tirar o bloqueio”.” (esta só aparece com chamada forjada; a tela nunca oferece cancelar um
   fechado). *Desfazer:* trocar em `lib/agenda/textos.ts`.
8. **`tirarBloqueio` com id que não é de fechado responde “Isso já tinha sido removido.”.** É a
   mesma resposta de 0 linhas, sem revelar o tipo. *Desfazer:* ler o tipo antes e dar outra frase.
9. **Dias reservados nos e2e:** 300+ na `agenda lancamento`, 330+ na `agenda cancelamento`, e 10-13
   dias à frente na `agenda vistas`, com +1 no projeto celular. Assim o resumo e o aviso, que contam
   o que há no dia, não disputam o mesmo dia entre desktop e celular.

## Para o dono olhar no portão (plano 16)

Itens da verificação de reserva (backstop), não automatizados:
- E2·overflow: a semana 28/12/2026 a 03/01/2027 a 320px. O e2e confere que não há rolagem lateral e
  que o “›” fica visível. Falta o olho.
- E3·overflow: um dia com 8 lançamentos no mês a 320px. Os pontos quebram em linhas e a célula
  cresce além de 52px, sem vazar. O `aria-label` conta os 8, o que está provado no unitário.
- E10·overflow e long-text: a folha do fechado a 320px, com motivo de 120 caracteres.
- E29: tocar duas vezes rápido no “Desfazer” do toast; derrubar a rede e tocar “Desfazer”.

## Known Stubs

Nenhum. A folha grava e o mês lê o banco de verdade. As pílulas “Turma fixa” e “Uso livre” **não**
existem ainda, de propósito: entram nos planos 06 e 09 com o formulário inteiro. `lerDiaParaLancar`
e `lerMes` ainda não contam usos livres (plano 09), e os comentários dizem isso.

## Threat Flags

Nenhuma superfície além do `threat_model`. T-05-13: cinco ações novas, todas com `exigirUsuario()`
primeiro (91 no portão). T-05-14: Zod no servidor, centavos inteiros e os checks do banco. T-05-15: o
`delete` condiciona o tipo na própria instrução, e não existe `delete` de turma ou avulsa. T-05-16:
`cancelado_por` vem da sessão. T-05-17: aceito, porque o motivo só aparece na gestão.

## TDD Gate Compliance

- Tarefa 1: `test(05-03)` `8f344ec` (RED, 22 falhas) → `feat(05-03)` `c47bf02` (GREEN).
- Tarefa 2: não era `tdd`, commit único `ef66c6f`.
- Tarefa 3: `test(05-03)` `19a8a03` (RED, 14 falhas) → `feat(05-03)` `a7348b5` (GREEN).

## Self-Check: PASSED

- Os 10 arquivos novos estão presentes. Conferi as folhas, a barra, a grade, as duas confirmações, as
  três specs e `agenda-esquemas.test.ts`.
- Os commits `8f344ec`, `c47bf02`, `ef66c6f`, `19a8a03` e `a7348b5` estão no branch
  `gsd/phase-05-agenda`. Não houve push nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff d9a4f00..HEAD` nesses
  três arquivos não lista nada.
