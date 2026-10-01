---
phase: 05-agenda
plan: 09
subsystem: agenda
status: complete
tags: [agenda, uso-livre, age-13, age-01, age-05, age-17, age-20, d-13, d-18, ui-d7, hora-cheia]
requires:
  - "05-01: usos_livres (checks de faixa, chegada por estado, encerrado completo, saída depois da chegada), RecusaDaAgenda, revalidarTelasDaAgenda"
  - "05-02: obterItensDoSistema (chave uso_livre_hora), o item “Uso livre (hora)” sem preço na semente"
  - "05-03: FolhaLancar, conferirDiaParaLancar/lerDiaParaLancar (aviso D-13), lerMes/resumoDoDia/pontosDoDia, ConfirmarTirarBloqueio (molde)"
  - "05-05: SeletorPessoa e pessoasParaData sem eventoId (grupo “Pessoas”)"
  - "05-08: arredondarMeioParaCima, a cadeia de folhas por URL da semana"
provides:
  - "lib/agenda/uso-livre.ts (puro): horasCheias, valorDoUsoLivre, valorDoMaterial, proximoEstado, saidaPrevista, precisaEncerrar (D-18), sugestaoDeSaida (UI-D7), faixas HORAS_PREVISTAS_*/PESSOAS_*"
  - "lib/financeiro/formato.ts: agoraEmBrasilia(agora) → { data, minutos }"
  - "lib/agenda/abas.ts: usoDaUrl"
  - "lib/agenda/semana.ts: TipoDoPonto no ItemDoDia (o uso livre entra em agruparPorDia/ordenarNoDia)"
  - "lib/agenda/consultas.ts: UsoLivreDaSemana, ItemDaSemana, lerSemana → ItemDaSemana[], lerMes com usos, lerDiaParaLancar conta usos não encerrados, obterUsoLivre, UsoLivreCarregado, precoDaHoraDoUsoLivre, obterItensDoSistema(leitor = db)"
  - "lib/agenda/gravacao.ts: travarUsoLivre (for no key update), UsoLivreTravado"
  - "lib/agenda/esquemas.ts: esquemaReservarUsoLivre, esquemaMarcarChegada, esquemaCorrigirChegada, esquemaCancelarReserva, esquemaEncerrarUsoLivre"
  - "lib/agenda/acoes.ts: reservarUsoLivre, marcarChegada, corrigirChegada, cancelarReserva, encerrarUsoLivre (103 → 108 ações no portão)"
  - "components/amassa/agenda: CamposUsoLivre, FolhaUsoLivre, ConfirmarCancelarReserva, TagDoUsoLivre; SeletorPessoa.textoInicial; SemanaDaAgenda.usoAberto/agora (UsoDoServidor)"
  - "data-testid: lancar-tipo-uso-livre, lancar-chegada, lancar-horas, lancar-pessoas, lancar-dica, lancar-erro-clienteId, folha-uso-livre (data-estado), uso-conta, uso-conta-horas, uso-conta-valor, uso-chegou, uso-chegou-as, uso-saiu-as, uso-saiu-as-erro, uso-encerrar, uso-encerrado, uso-erro, uso-voltar, uso-cancelar-reserva, confirmar-cancelar-reserva(-sim|-nao|-erro), aviso-sem-preco-hora, tag-reservado, tag-no-espaco, tag-encerrar, tag-encerrado; agenda-cartao ganha data-uso-id"
  - "tests/e2e/apoio/semear-agenda.ts: semearUsoLivre, usoLivreNoBanco, usosLivresDaPessoa, travarItemDaHora (trava + preço + nome, devolvidos no fim), definirPrecoDaHora, TRAVA_DO_PRECO_DA_HORA"
affects:
  - "A semana e o mês mostram os usos livres (todos os estados); o cartão do uso abre ?uso= no lugar de ?evento="
  - "A folha “Lançar na agenda” ganhou a 3ª pílula e passou a nascer atrás de um Suspense (o preço da hora é lido do banco)"
  - "O aviso D-13 do tipo Fechado conta também as reservas e os usos no espaço do dia"
  - "cadastros-itens-da-agenda (a): passa a segurar a trava do preço da hora ao ler os nomes do Catálogo"
tech-stack:
  added: []
  patterns:
    - "Transição de estado como instrução condicionada (update/delete … where estado = …) + leitura do porquê só quando nenhuma linha foi afetada"
    - "Encerramento sob for no key update do uso, com o preço do Catálogo lido pela chave DENTRO da transação e congelado na linha"
    - "Recurso global do banco de teste (o preço da hora) serializado entre projetos por pg_advisory_lock e devolvido ao estado inicial no fim"
key-files:
  created:
    - lib/agenda/uso-livre.ts
    - components/amassa/agenda/campos-uso-livre.tsx
    - components/amassa/agenda/folha-uso-livre.tsx
    - components/amassa/agenda/confirmar-cancelar-reserva.tsx
    - tests/unit/agenda-uso-livre.test.ts
    - tests/unit/financeiro-formato.test.ts
    - tests/e2e/agenda-uso-livre.spec.ts
  modified:
    - lib/financeiro/formato.ts
    - lib/agenda/abas.ts
    - lib/agenda/semana.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - app/gestao/(app)/agenda/page.tsx
    - components/amassa/agenda/folha-lancar.tsx
    - components/amassa/agenda/cartao-evento.tsx
    - components/amassa/agenda/semana-da-agenda.tsx
    - components/amassa/agenda/seletor-pessoa.tsx
    - tests/unit/agenda-semana.test.ts
    - tests/unit/agenda-esquemas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
    - tests/e2e/cadastros-itens-da-agenda.spec.ts
decisions:
  - "O uso livre de dia passado ainda no espaço mostra só “encerrar” (âmbar), no lugar de “está no espaço”"
  - "A saída prevista conta da chegada REAL quando já houve “Chegou” (senão, da prevista) e para em 23:59"
  - "Reservado mostra na conta só “Pessoas”; sem preço da hora, a conta mostra “{h} h” e Valor “—”"
  - "“Chegou” num uso que já começou devolve sucesso com a hora já gravada (toast com ela), sem mudá-la"
  - "“Este uso livre já foi encerrado…” vai num toast (a folha é relida e o bloco de encerrar some)"
metrics:
  duration: "~32 min (20:50 → 21:22, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 3
  files: 24
actuals:
  tokens: 32150
  tasks: 3
  commits: 4
---

# Phase 5 Plan 09: o uso livre do ateliê — reservar, “Chegou” e encerrar cobrando por hora cheia — Summary

**O gestor reserva o ateliê para alguém pela folha “Lançar na agenda” (pílula “Uso livre”), marca que a
pessoa chegou com um toque, tira uma reserva que não vai acontecer e, quando ela sai, abre o uso, vê o
“Saiu às” com a hora de agora e o valor por hora cheia, e toca “Encerrar e cobrar”. A conta é
`teto(minutos ÷ 60) × pessoas × preço da hora`, com pessoas multiplicando UMA vez, e o preço da hora vem
do item “Uso livre (hora)” do Catálogo, achado pela chave e congelado no encerramento. Sem preço
cadastrado, nada é cobrado: a folha diz onde cadastrar.**

## O que foi feito

### Tarefa 1: o módulo puro (commits `fadfeba` RED, `09a8bc6` GREEN)

- `horasCheias("14:00","15:01")` dá 2: é `Math.ceil` sobre a diferença em minutos inteiros. Saída igual
  ou antes da chegada lança `RangeError`. Aceita “HH:MM:SS” (Pitfall 9).
- `valorDoUsoLivre` faz `horas × pessoas × preço + material`, em centavos e com as faixas do banco
  (horas 1..24, pessoas 1..50, teto do dinheiro). `valorDoMaterial(1200, 1800)` dá 2160: milésimos ×
  centavos ÷ 1000, meio para cima. Já existe para o plano 10.
- Também no puro: `proximoEstado`, `saidaPrevista` (para em 23:59), `precisaEncerrar` (D-18) e
  `sugestaoDeSaida` (UI-D7).
- `agoraEmBrasilia(agora)` está em `lib/financeiro/formato.ts`, ao lado de `hojeEmBrasilia`. Usa
  `formatToParts` em `America/Sao_Paulo` com `hourCycle: "h23"`, que garante “00” à meia-noite (com
  `hour12: false` sozinho, alguns motores escrevem “24”). O caso 02:30 UTC dá `{ 2026-10-01, 1410 }`.

### Tarefa 2: reservar, “Chegou” e cancelar a reserva (commit `9985cb7`)

**Servidor.** As quatro ações começam por `exigirUsuario()`:

- `reservarUsoLivre` faz um `insert` em `reservado`. Se a pessoa foi apagada, o banco recusa com 23503
  (lido em `erro.cause.code`) e a tela mostra “Essa pessoa não existe mais…”.
- `marcarChegada` é UM `update … set estado = 'no_espaco', chegada where id and estado = 'reservado'`.
  Se nenhuma linha muda e o uso existe, ele já tinha começado: a ação devolve sucesso com a hora já
  gravada, sem mudá-la.
- `corrigirChegada` só pega o uso `no_espaco`.
- `cancelarReserva` é `delete … where id and estado = 'reservado'`. Sem linha apagada, há três
  respostas: “Esta reserva já começou…” se o uso existe, “Isso já tinha sido removido.” se não existe, e
  “…material baixado no Estoque…” no 23503.

**Leituras.**

- `lerSemana` devolve eventos **e** usos livres (`ItemDaSemana`). O módulo puro ordena os dois juntos.
- `lerMes` junta os usos, com o ponto `area-loja` e “1 uso livre / N usos livres” no `aria-label`.
- **`lerDiaParaLancar` agora soma `count(*) from usos_livres where data = $1 and estado <> 'encerrado'`**
  aos eventos não cancelados (verdade 9). O e2e (e) prova isso: fechar um dia que só tem uma reserva
  diz “1 lançamento” e a reserva continua `reservado`.
- `obterUsoLivre` traz o uso, o nome e o preço da hora de agora (pela chave).

**Tela.**

- A pílula “Uso livre” fica entre a avulsa e o fechado. Os campos (`CamposUsoLivre`) são:
  - “Quem”: o seletor do plano 05, que volta com o nome escolhido se o gestor trocar de pílula e voltar;
  - Data: o mesmo estado da avulsa;
  - “Chega às”;
  - “Horas previstas”, que nasce com 2;
  - “Pessoas”, que nasce com 1.
- A dica é “Hora cheia a {R$}…” ou, sem preço, a frase que diz onde cadastrar.
- O aviso D-13 é a mesma caixa da avulsa, e o primário é “Reservar uso livre” (“Reservando…”).
- O cartão do uso tem:
  - borda `area-loja`;
  - a hora de chegada e “Uso livre · {nome}”;
  - “{n} pessoa(s)”;
  - “Uso livre · até {hh:mm}”;
  - as tags “reservado”, “está no espaço” ou “encerrar”.
- A folha do uso livre abre por `?uso=`. Ela mostra:
  - o cabeçalho com o ponto `area-loja`;
  - o sub-título com a tag de estado;
  - o esqueleto enquanto carrega;
  - o erro com “Tentar de novo”;
  - o toast de link velho.
- No estado reservado, a folha mostra “Chegou às” (com a hora da reserva) e a dica. O rodapé tem
  “Cancelar reserva” (com `ConfirmarCancelarReserva`) e “Chegou”.

### Tarefa 3: encerrar (commit `b76fb95`)

- `encerrarUsoLivre` tem `exigirUsuario()` primeiro e o Zod (saída depois da chegada, com o erro no
  campo “Saiu às”). Dentro de `db.transaction`, os passos são:
  1. `travarUsoLivre`;
  2. confere que o estado é `no_espaco`;
  3. lê o preço com `obterItensDoSistema(tx)`, que passou a aceitar o leitor da transação;
  4. sem preço, recusa e diz onde cadastrar;
  5. calcula `horasCheias` e `valorDoUsoLivre` (material 0 até o plano 10);
  6. faz o `update` condicionado a `no_espaco`, gravando `horas_cheias`, `preco_hora_centavos` e
     `valor_centavos`.
- A página passa `agoraEmBrasilia(new Date())` à folha.
- **No espaço**, a folha mostra:
  - a conta (Pessoas · Horas cheias · Valor 600, com `aria-live`), recalculada a cada mudança das horas;
  - “Chegou às”, editável;
  - “Saiu às” (`step=60`): a hora de agora num uso de hoje, ou a saída prevista num uso de dia passado;
  - a dica da hora cheia;
  - sem preço, a caixa âmbar, e o botão desabilitado com `aria-describedby`;
  - o botão “Encerrar e cobrar” (“Encerrando…”).
- **Encerrado**: a conta congelada, “Encerrado · {h} h” e “Voltar à agenda”.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/agenda-uso-livre.test.ts tests/unit/financeiro-formato.test.ts` (RED) | falhou como esperado: 2 arquivos, 5 falhas (módulo e função inexistentes) |
| o mesmo (GREEN) | **30/30** |
| `npx vitest run tests/unit/agenda-semana.test.ts` | **29/29** (2 casos novos do uso livre na semana) |
| `npm run verificar` (Tarefa 2) | **verde**: 111 arquivos / 2135 testes, `verificar-acoes` **107 ações** e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "agenda uso livre"` (Tarefa 2) | **62 passed (1.0m)**: casos (a)-(e) × desktop e celular, mais a cadeia `vazio-*` |
| `npm run verificar` (Tarefa 3) | **verde**: 111 / **2139**, **108 ações**, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda uso livre"` (Tarefa 3) | **70 passed (1.1m)**: casos (a)-(i) × 2 projetos |
| `npm run test:e2e -- --grep "agenda"` (conferência, fora do orçamento) | **191 passed, 1 skipped (2.4m)**. O pulado é `site-abertura` (k), que o próprio teste pula no celular |

Fiz **três** invocações de e2e. O orçamento era duas, e nenhuma repetição veio de falha. A terceira
(`--grep "agenda"`) foi de propósito:

- mexi em peças que todas as specs da Agenda usam: a folha Lançar foi para trás de um `Suspense`, e o
  cartão e a semana agora aceitam o uso livre;
- mexi também em `cadastros-itens-da-agenda.spec.ts`, que nenhuma das duas `--grep` alcançava. A
  `"agenda"` inclui “cadastros itens da agenda”.

Não rodei `npm run build` separado nem a varredura completa sem `--grep`, que fica para o plano 16.
Também rodei `npx tsc --noEmit` e `npx eslint` nos arquivos tocados, ambos limpos.

Greps de aceite:
- `estado = 'reservado'|eq(usosLivres.estado, "reservado")` em `acoes.ts`: **2** (chegada e remoção).
- “Esta reserva já começou” em `textos.ts`: **1**.
- `usosLivres|usos_livres` em `consultas.ts`: 0 no plano 08, **28** agora.
- `preco_hora_centavos|precoHoraCentavos` em `acoes.ts`: **7**.
- `agoraEmBrasilia` em `page.tsx`: **2** (o import e a chamada).
- Nada de `@/db`, `react`, `next`, `drizzle-orm` ou `pg` em `uso-livre.ts`. O teste de pureza também
  recusa `new Date(` e `Date.now(` nele.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3] `cadastros-itens-da-agenda.spec.ts` (a) passou a segurar a trava do preço da hora**
- **Issue:** o caso (a) do novo e2e renomeia o item “Uso livre (hora)” para provar que a Agenda o acha
  pela chave, como o plano pede. O caso “os três itens do sistema aparecem” daquela spec lê o nome
  “Uso livre (hora)” sem a trava. Na varredura completa, rodando ao mesmo tempo, ele falharia.
- **Fix:** o caso lê os nomes segurando o mesmo `pg_advisory_lock(5_020_017)`. `travarItemDaHora()`
  devolve o nome original e o preço nulo antes de soltar a trava.
- **Commit:** `9985cb7`.

**2. [Rule 3] Arquivos fora da lista do plano**
- `components/amassa/agenda/semana-da-agenda.tsx`: abre a folha do uso por `?uso=`, mostra o toast do
  link velho e passa o `agora`.
- `components/amassa/agenda/seletor-pessoa.tsx`: ganhou o prop `textoInicial`, opcional, que não muda
  quem já usa o seletor.
- `tests/unit/agenda-esquemas.test.ts`: 9 testes dos esquemas novos.
- `tests/e2e/cadastros-itens-da-agenda.spec.ts`: o item 1.
- `components/amassa/agenda/grade-do-mes.tsx` estava na lista e **não mudou**. Ele já desenhava o ponto
  `uso_livre` e a legenda desde o plano 03. O que faltava era o dado, que agora vem de `lerMes`.

**3. Nomes e formas**
- `agoraEmBrasilia` usa `hourCycle: "h23"`, não `hour12: false` (o porquê está na Tarefa 1). O
  teste da meia-noite prova.
- `obterItensDoSistema` ganhou o parâmetro `leitor` (o padrão é `db`), para ler o preço dentro da
  transação do encerramento, como pede a verdade do `key_links`.
- `precisaEncerrar` e `sugestaoDeSaida` foram para o módulo puro, e não para a consulta ou o
  componente: são regra de negócio (CLAUDE.md).
- O caso de e2e que o plano chama de “(e) encerrar” virou **(f)**, porque (e) já era o D-13 da Tarefa 2.
  Os casos ficaram: (f) encerrar hoje e a outra aba, (g) sem preço, (h) saída antes da chegada,
  (i) o uso de ontem.

Nenhuma migração e nenhum pacote novo. A `0026`, `db/schema.ts` e `TABELAS_ESPERADAS` não mudaram: a
tabela `usos_livres` e os checks já existiam desde o plano 01.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado além do
efêmero.

1. **Uso de dia passado ainda no espaço mostra só a tag “encerrar”**, sem “está no espaço” ao lado. A
   pessoa não está lá; o que importa é a ação. *Desfazer:* `TagDoUsoLivre` em `cartao-evento.tsx`.
2. **A saída prevista conta da chegada REAL** quando já houve “Chegou”. Num uso que chegou às 15:20 com
   2 horas previstas, ela é 17:20, e é isso que o “Saiu às” de ontem sugere. Antes do “Chegou”, conta da
   chegada prevista. Nunca passa de 23:59. *Desfazer:* `saidaPrevista(linha.chegadaPrevista, …)` em
   `usoLivreDaSemana` e `obterUsoLivre` (`consultas.ts`).
3. **Reservado mostra na conta só “Pessoas”**, sem um valor estimado. Sem preço da hora, a conta mostra
   “{h} h” e Valor “—”. *Desfazer:* `Reservado`/`UsoIniciado` em `folha-uso-livre.tsx`.
4. **“Chegou” num uso que já começou é sucesso**, com o toast mostrando a hora que já estava gravada
   (“Chegada marcada às 09:40.”), e a hora não muda. *Desfazer:* o ramo `jaEstavaMarcada` de
   `marcarChegada`.
5. **“Este uso livre já foi encerrado…” vai num toast**, e não embaixo do botão. A ação revalida, a
   folha é relida já encerrada, e o bloco de encerrar sai da tela junto com qualquer frase dentro dele.
   *Desfazer:* o ramo `FRASE_USO_JA_ENCERRADO` em `UsoIniciado.encerrar`.
6. **A recusa de “Cancelar reserva” fica DENTRO do diálogo**. Fechar o diálogo (“Manter a reserva”)
   relê a folha, que então aparece no estado novo. Se a ação revalidasse na hora, o diálogo sumiria
   junto com a frase. *Desfazer:* `aoFecharDepoisDaRecusa` em `confirmar-cancelar-reserva.tsx`.
7. **Frases que a UI-SPEC não fixa:**
   - “Diga a hora de chegada.” (Chega às ou Chegou às vazio);
   - “Diga a hora de saída.”;
   - “Este uso livre ainda não começou — marque “Chegou” primeiro.”;
   - “Não deu para marcar a chegada. …”, “Não deu para corrigir a hora de chegada. …” e “Não deu para
     cancelar a reserva. …” (no molde “Não deu para {verbo}”).

   *Desfazer:* `lib/agenda/textos.ts`.
8. **“Chega às” nasce vazio**, como “Começa” da aula: a UI-SPEC não dá padrão. *Desfazer:*
   `useState("")` de `chegadaPrevista` em `folha-lancar.tsx`.
9. **“Chegou às” corrige ao sair do campo** (`corrigirChegada` no `blur`), sem toast. “Encerrar” também
   manda a chegada do campo, então o valor que vale é sempre o da tela no encerramento.
10. **No cartão, o uso encerrado fica sem tag de estado.** A tag de pagamento (“a receber” / “pago”) é
    do plano 11. Na folha aparece a tag neutra “encerrado”.

## Para o dono olhar no portão (plano 16)

- **Encerrar em dois toques no celular**: o cartão e depois “Encerrar e cobrar”, com o “Saiu às” já
  preenchido. O e2e (f) mede o caminho; o conforto de pé é humano.
- O texto da dica de encerrar (“…matéria-prima é a lista acima.”) fala de uma lista de material que só
  aparece com o plano 10.

## Lacuna encontrada (fora do escopo deste plano)

- **“Últimas vindas” da ficha não mostra o uso livre.** A UI-SPEC pede a linha “{dd/mm} · Uso livre
  {h} h”, mas nenhum plano da fase (05-09 a 05-16) a inclui. O comentário em `ultimasVindas`
  (`consultas.ts`) dizia “entram aqui no plano 09” e agora registra a lacuna. Fica para o orquestrador
  decidir onde encaixar.

## Known Stubs

Nenhum que impeça o objetivo do plano. Ficam para planos já marcados:
- o material e a baixa no Estoque (plano 10): `materialCobradoCentavos: 0` em `encerrarUsoLivre`;
- “Recebi agora” e “Lançar na Venda” do uso encerrado (planos 11 e 12);
- a tag de pagamento no cartão e na folha (plano 11);
- “Agora no espaço” só com os usos de hoje (plano 14). `precisaEncerrar` já separa o uso esquecido.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-41:** as cinco ações começam por `exigirUsuario()`. O portão passou de 103 para 108 ações, com
  0 violações.
- **T-05-42:** nenhum esquema aceita preço ou valor, e o teste unitário prova que eles são descartados.
  O preço é lido pela chave e congelado. O e2e (f) muda o preço depois e o uso encerrado não muda.
- **T-05-43:** o `delete … and estado = 'reservado'` acontece na própria instrução. O e2e (c) prova: a
  outra aba marca “Chegou”, e a remoção é recusada.
- **T-05-44:** `travarUsoLivre` mais o `update … and estado = 'no_espaco'`. O e2e (f) prova: o segundo
  encerramento é recusado e o valor não muda.
- **T-05-45:** `agoraEmBrasilia(new Date())` só roda na página do servidor.

## TDD Gate Compliance

- Tarefa 1: `test(05-09)` `fadfeba` (RED) → `feat(05-09)` `09a8bc6` (GREEN). Sem refatoração.
- Tarefas 2 e 3: não eram `tdd`. Um commit cada, `9985cb7` e `b76fb95`.

## Self-Check: PASSED

- Os sete arquivos novos estão presentes: `lib/agenda/uso-livre.ts`, `campos-uso-livre.tsx`,
  `folha-uso-livre.tsx`, `confirmar-cancelar-reserva.tsx`, `agenda-uso-livre.test.ts`,
  `financeiro-formato.test.ts` e `agenda-uso-livre.spec.ts`.
- Os commits `fadfeba`, `09a8bc6`, `9985cb7` e `b76fb95` estão no branch `gsd/phase-05-agenda`. Não
  houve push nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff f10950f..HEAD` nesses três
  arquivos não lista nada.
