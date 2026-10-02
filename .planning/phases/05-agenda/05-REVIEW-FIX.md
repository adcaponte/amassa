---
phase: 05-agenda
fixed_at: 2026-10-02T00:00:00Z
review_path:
  - .planning/phases/05-agenda/05-REVIEW-A.md
  - .planning/phases/05-agenda/05-REVIEW-B.md
iteration: 1
findings_in_scope: 14
fixed: 14
skipped: 0
info_fixed: 9
info_skipped: 4
status: all_fixed
---

# Fase 05 (Agenda): relatório das correções da revisão de código

**Corrigido em:** 02/10/2026, na cópia principal (`main`, `workflow.use_worktrees: false`), a partir de `aa84289`.
**Revisões de origem:** `05-REVIEW-A.md` (servidor) e `05-REVIEW-B.md` (telas).
**Escopo pedido:** todos os BLOQUEIOS e AVISOS das duas; dos INFO, só os baratos e claramente certos.

**Resumo**
- Bloqueios e avisos no escopo: 14 (A: CR-01, WR-01..WR-04; B: CR-01, CR-02, WR-01..WR-07). **Corrigidos: 14. Pulados: 0.**
- INFO: 9 corrigidos (A: IN-02, IN-03, IN-04; B: IN-01, IN-02, IN-04, IN-06, IN-07, IN-08), 4 pulados com motivo (abaixo).
- **Nenhuma migração nova.** Tudo o que foi corrigido funciona no banco que está em produção (0026 aplicada).
- Nada foi publicado, nenhum `push`, nenhum acesso ao servidor ou a banco real. STATE/ROADMAP/REQUIREMENTS não foram tocados.

## Correções — revisão A (servidor)

### CR-01 (BLOQUEIO): duas requisições sobrepostas na mesma cobrança criavam duas vendas ativas
**Commits:** `664fe25`, `3e30bd9` (a prova não apaga a usuária de prova — AUTH-09)
**Arquivos:** `lib/agenda/gravacao.ts`, `lib/agenda/acoes.ts`, `scripts/provar-corridas-da-agenda.ts` (novo), `scripts/testar-migracoes.mjs`
**O que mudou:** `travarEReler` — trava numa instrução e RELÊ noutra (retrato novo de READ COMMITTED, com a trava
já garantida). Usado nas três leituras de cobrança sob trava (`lerMensalidadesCobradas`, `lerInscricoesCobradas`,
`lerUsosLivresCobrados` — logo `travarCobranca`, `vincularCobranca` e o lote) e em `travarInscricaoComVenda`
("Tirar da lista"). As guardas de `receberAgora`, `definirDispensa` e `vincularCobranca` agora recusam por
`situacao` lançada/paga **sempre**; o número só escolhe a frase.
**Teste que sobrepõe de verdade:** `scripts/provar-corridas-da-agenda.ts` (TypeScript, roda o código da aplicação —
`vincularCobranca`, `travarCobranca`, `travarInscricaoComVenda`, `gravarVenda`). A 1ª transação trava e para numa
barreira; a 2ª começa e fica esperando a trava (conferido em `pg_stat_activity`); só então a 1ª grava e confirma.
Três cenários: dois "Lançar na Venda" na mesma mensalidade; relançar venda cancelada × "Recebi agora"; lançamento ×
"Tirar da lista" na mesma inscrição. **Sem a correção, os três falham** (medido: "o segundo lançamento sobreposto
deveria ser RECUSADO… ele passou e gravou outra venda"; "viu documento …, número null"; "viu null"). Com ela, passam.
Chamado por `npm run test:migracoes` (`provarCorridasDaAgenda`), portanto pelo `npm run verificar` e pelo CI.

### WR-01: "Desativar turma" podia apagar uma inscrição que acabara de virar venda ativa
**Commit:** `7f20897` (estrutura final em `3b834db`)
**Arquivo:** `lib/agenda/gravacao.ts`
**O que mudou:** as inscrições das datas futuras são travadas (`for update`, ordem de id, depois das datas — ordem
TURMA → EVENTO → INSCRIÇÃO, sem ciclo com o lançamento) e `vendaAtivaEmDataFutura` é reconferida numa instrução nova;
venda achada → recusa com a frase da D-08, nada apagado.
**Teste:** cenário WR-01 de `provar-corridas-da-agenda.ts` (falha sem a correção: "ela apagou as datas"; passa com ela).

### WR-02: desfazer o cancelamento trazia horário/vagas/`publico` velhos; turma privada voltava ao site
**Commit:** `64113c5`
**Arquivos:** `lib/agenda/acoes.ts` (`editarTurma`), `lib/agenda/publico/consultas.ts`
**O que mudou:** `editarTurma` também atualiza as datas futuras **canceladas** (a contagem do toast continua sendo a das
de pé); `lerAgendaPublica` exige `turmas.publica` para data de turma — cobre também a data de hoje, que a edição não
muda (A9).
**Teste:** e2e "agenda turma (h)".

### WR-03: a D-02 cobrava mensalidade cheia em mês sem aula — decisão do dono: "sem aula, sem mensalidade"
**Commit:** `67c1cc3`
**Arquivos:** `lib/agenda/gravacao.ts` (`garantirMensalidadesDoMes`), `05-CONTEXT.md` (complemento datado da D-02),
três e2e que dependiam da D-02 com turma sem data no mês
**O que mudou:** o `insert … select` só cria a mensalidade se a turma tiver ao menos uma data **não cancelada** no mês
(`exists` em `eventos`, pelo índice `eventos_turma_data_uk`). `entrou_em < dia 1` e `on conflict do nothing` seguem.
**Teste:** cenário WR-03 de `provar-corridas-da-agenda.ts` — sem data, só data cancelada e data só no dia 1 do mês
seguinte → nenhuma; com uma aula → uma; de novo → nenhuma a mais; quem entrou NO dia 1 continua fora (falha sem a
correção: "mês sem data nenhuma não pode cobrar"). Os e2e `agenda entrar na turma (f)/(g)`, `agenda mensalidades lote`
e `agenda pagamento` ganharam uma aula no mês corrente na semente (a mesma afirmação de antes; sem isso dependeriam do
dia do mês).

### WR-04: a confirmação de "Desativar turma" não dizia tudo o que apagava
**Commit:** `3b834db`
**Arquivos:** `lib/agenda/gravacao.ts`, `lib/agenda/acoes.ts`, `lib/agenda/esquemas.ts`, `lib/agenda/textos.ts`,
`components/amassa/agenda/confirmar-desativar-turma.tsx`
**O que mudou:** `PerdasAoDesativar` ganhou `cobrancas` (cobram e não têm venda ativa), `presencas` e `creditos` (falta
com direito a repor), ditos em `corpoConfirmarDesativarTurma`. O diálogo manda o que MOSTROU; o servidor, com datas e
inscrições travadas, reconta e, se algo cresceu, não grava e devolve os números de agora (molde de `cancelarData`).
**Teste:** e2e "agenda turma (i)"; "(f)" segue com a frase de sempre.

## Correções — revisão B (telas)

### CR-01 (BLOQUEIO): "Salvar pessoa" dentro do seletor enviava a folha "Lançar na agenda"
**Commit:** `a1ad186`
**Arquivos:** `components/amassa/clientes/formulario-cliente.tsx` (`stopPropagation`),
`components/amassa/agenda/folha-lancar.tsx` e `folha-turma.tsx` (ignoram `submit` com `target !== currentTarget`)
**Teste:** e2e "agenda uso livre (j)" — escolhe uma pessoa, preenche a chegada, abre o cadastro pelo seletor sem digitar
na busca, corrige o nome no cadastro e salva: nenhuma reserva para ninguém; só "Reservar" grava, para a pessoa nova.

### CR-02, WR-01, WR-02: presença que falha (folha já fechada / rede caída / recusa) — um commit, os mesmos tratadores
**Commit:** `0481aef`
**Arquivos:** `components/amassa/agenda/linha-inscrito.tsx`, `lib/agenda/acoes.ts` (`definirPresenca` revalida na
recusa), `lib/agenda/textos.ts` (`fraseRecusaNaLinha`)
**O que mudou:** a promessa rejeitada é capturada (não sobe ao `error.tsx`); a recusa do servidor mostra o porquê e relê
a tela; com a linha já desmontada ("Pronto" sem esperar), a falha vira `toast.error` de 10 s com o nome.
**Testes:** e2e "agenda presenca (f)" (rede derrubada: frase E6 sob a linha, segmento volta, Agenda continua), "(g)"
(data cancelada em outro celular: `FRASE_DATA_CANCELADA` e a folha fica só de leitura), "(h)" (Veio + Pronto, a gravação
cai depois de a folha fechar: toast com o nome).

### WR-03: "Cancelar esta data" confirmado apagava mais do que a confirmação dizia
**Commit:** `258f89e`
**Arquivos:** `lib/agenda/esquemas.ts` (`confirmado` passa a ser as contagens vistas), `lib/agenda/acoes.ts`,
`components/amassa/agenda/confirmar-cancelar-data.tsx`, `lib/agenda/textos.ts`
**Teste:** e2e "agenda cancelamento — WR-03 da revisão B".

### WR-04: falha ao ler `?evento=` derrubava a semana inteira
**Commit:** `e262a1e`
**Arquivos:** `app/gestao/(app)/agenda/page.tsx` (`lerEvento`), `semana-da-agenda.tsx`, `folha-evento.tsx`
**O que mudou:** a falha volta como estado; a folha mostra `FRASE_ERRO_CARREGAR_AULA` + "Tentar de novo"; aberta por link
sem o cartão na semana, vira toast com "Tentar de novo".
**Teste:** nenhum automático — não há como provocar a falha só desta leitura sem um gancho de teste no servidor.
Coberto por `tsc`/lint e pelos e2e que abrem `?evento=` (caminho feliz inalterado).

### WR-05: tag de pagamento `whitespace-nowrap` estourava a linha de "Quem vem" a 320px
**Commit:** `31af507`
**Arquivo:** `components/amassa/agenda/cartao-evento.tsx` (o padrão de `TagDePagamento` quebra entre palavras)
**Teste:** "agenda vistas" — a régua de 320px agora mede também a folha aberta com "venda nº {10 dígitos} cancelada"
ao lado do Veio/Faltou (`estourosDaFolhaA320`).

### WR-06: resposta perdida em "Lançar turma/aula/reserva/fechar" criava duplicata ao tocar de novo
**Commits:** `b24172e`, `01bd31a` (o e2e passou a derrubar só a resposta do lançamento — a folha também chama `conferirDiaParaLancar`)
**Arquivos:** `lib/agenda/envios.ts` (novo), `lib/agenda/acoes.ts`, `components/amassa/agenda/folha-lancar.tsx`,
`lib/agenda/textos.ts`
**O que mudou:** a folha gera uma `chaveDeEnvio` (uuid) no primeiro toque e a manda em toda tentativa; o servidor, depois
de `exigirUsuario()` e do Zod, devolve o resultado já gravado para a mesma chave + pessoa + ação + dados (inclusive com a
primeira ainda no ar). Só o sucesso fica guardado. A frase da falha de rede deixou de afirmar "Nada foi gravado"
(`FRASE_SEM_RESPOSTA_AO_LANCAR`).
**Limite consciente:** sem migração — o registro vive na memória do processo do app, 10 minutos. Reiniciar o app
exatamente entre a resposta perdida e o novo toque esquece a chave. Uma coluna única no banco eliminaria isso, mas
exigiria migração aplicada à mão antes do deploy.
**Testes:** `tests/unit/agenda-envios.test.ts` e e2e "agenda turma (j)" (o servidor grava, a resposta é derrubada, o
segundo toque não cria a segunda turma).

### WR-07: `cobrancaParaVenda` como promessa sem dono na página da Venda
**Commit:** `4aa57f4` — `.catch` na criação; falha vira "não achada" (`OrigemIndisponivel`).

## INFO corrigidos

| Achado | Commit | O quê |
|---|---|---|
| A IN-02 | `efb4130` | Recusas de regra ("aluno sai pela ficha", "oficina só em aula avulsa com preço") não dizem mais "verifique a internet". |
| A IN-03 | `d9ed02e` | Item do sistema da Agenda: "Tem estoque próprio" some do diálogo e `editarItem` grava o estoque/unidade/categoria de compra que já estão no banco. |
| A IN-04 | `0fa163f` | "Chegou" num uso já encerrado devolve `FRASE_USO_JA_ENCERRADO`. |
| B IN-01 | `71c7534` | Enter com a lista do seletor aberta é da lista (escolhe a destacada ou a única), nunca envia a folha. |
| B IN-02 | `8fa4236` | Enter em "Marcar mais N semanas" marca as semanas. |
| B IN-04 | `0734077` | Preço zero: "Gratuita" no site e na folha (teste unitário novo em `agenda-publico.test.ts`). |
| B IN-06 | `929be75` | Esqueleto da rota desenha Pessoas na aba Pessoas. |
| B IN-07 | `cd6474c` | "Desfazer" em Dispensadas mostra o porquê da recusa e relê. |
| B IN-08 | `093f492` | Fechar "Tirar o bloqueio" depois de recusa relê a folha. |

## INFO pulados (com motivo)

- **A IN-01** (crédito de reposição serializado de um lado só): a correção pede travar o CLIENTE em `definirPresenca`,
  `definirDireitoARepor` e `cancelarData` (este, de todas as pessoas da data) respeitando EVENTO → CLIENTE → INSCRIÇÃO —
  mudança de travas em três ações, não "barata". O efeito é um saldo "excedido" visível, sem dinheiro envolvido.
- **B IN-03** (Cobrar/Incluso piscando em dois toques rápidos): cosmético, termina coerente (as ações são serializadas).
- **B IN-05** (ISR com o "hoje" de ontem para o primeiro visitante): aceito — a regeneração em segundo plano corrige no
  visitante seguinte; filtrar no cliente muda o contrato do site.
- **B IN-09** (formulário da turma remonta e perde o digitado): mudar a `key` muda o comportamento de "Salvar" (o
  formulário deixaria de recomeçar com o banco); precisa de desenho, não é barato.

## Verificação (onde rodou: cópia principal, `C:\Users\Andre\amassa`, branch `main`)

- `npm run verificar` — **verde** (lint 0 avisos; `tsc --noEmit` limpo depois de apagar `.next/types`; `verificar-acoes`
  114 ações, 0 violações; Vitest 116 arquivos / 2294 testes; `test:migracoes` "Todas as afirmações passaram", com
  `provarCorridasDaAgenda` e os 5 cenários). As "1 violação" no log são as das fixtures de propósito do próprio teste
  do portão (`tests/fixtures/acoes/violando*.ts`).
- E2E — **2 invocações** (o orçamento era ~3):
  1. `npm run test:e2e -- --grep agenda` → **286 passaram, 2 falharam, 1 pulado** (4,3 min de Playwright). As 2 falhas
     eram só o e2e novo do WR-06, desktop e celular: o `page.route` derrubava o PRIMEIRO POST de Server Action, que era
     o `conferirDiaParaLancar` da folha, e o lançamento passava normalmente (o toast de sucesso estava na tela). Defeito
     do teste, não do código; corrigido em `01bd31a` (derruba só o POST cujo corpo leva o nome da turma). Todos os outros
     e2e novos ou mexidos passaram nos dois projetos: agenda presenca (f)(g)(h), agenda uso livre (j), agenda cancelamento
     WR-03, agenda vistas 320px, agenda entrar na turma (f)(g), agenda mensalidades lote, agenda pagamento, agenda turma
     (d)(f)(h)(i), e as specs de receber/venda/dispensar/colocar/lançamento/no site.
  2. `npm run test:e2e -- --grep "agenda turma"` → **87 passaram, 0 falharam** (1,1 min), incluindo "(j) WR-06" nos dois
     projetos.
- A varredura completa sem `--grep` não foi rodada (a da fase já foi feita; a `--grep agenda` cobre todos os
  arquivos tocados). Os e2e novos de B CR-01, CR-02/WR-01/WR-02 e WR-03 **não** foram rodados contra o código antigo
  (custaria outra invocação); a prova "falha sem a correção" foi medida só para os cenários de
  `provar-corridas-da-agenda.ts` (A CR-01, WR-01, WR-03).

---

_Corrigido em: 02/10/2026_
_Corretor: Claude (gsd-code-fixer)_
_Iteração: 1_
