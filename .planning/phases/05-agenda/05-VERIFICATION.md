---
phase: 05-agenda
verified: 2026-10-03T13:01:00Z
status: passed
score: 9/9 critérios de sucesso do ROADMAP verificados; AGE-01..20 todos satisfeitos (20/20)
behavior_unverified: 0
overrides_applied: 0
evidencia_humana: "Aprovação do dono no chat em 03/10/2026 ('finalizei a verificação humana da agenda'), sem anotação por item e sem o tempo do C.1; caminhada independente do Cowork em produção (Claude outputs/agenda/VERIFICACAO-COWORK-05.md, 22 passos, nenhum 🔴); Roteiro 17 feito pelo dono em 02/10 (run 36959745229, 0026 aplicada ~10h30 UTC, /api/health/agenda 200); correções da revisão no ar (run 37013475323); eac0203 no ar (run 37061857675)."
nao_rodado_por_mim: "npm run verificar, npm run test:migracoes e npm run test:e2e — outro processo usava o Postgres efêmero do Docker. O resultado de verificar/test:migracoes é da sessão principal. As provas de corrida (scripts/provar-corridas-da-agenda.ts) e conferirAgenda rodam dentro de test:migracoes."
pendente_conhecido:
  - "0027 (quick 261002-sdt, 'Dispensar' do uso livre) e o /api/health/agenda que passa a exigi-la estão no main local, não publicados: sai pelo Roteiro 19 (com o 18 de carona). Não é lacuna da fase — é publicação do dono."
---

# Fase 5: Agenda — Relatório de Verificação

**Objetivo da fase (ROADMAP.md):** "Um calendário só, onde o Theo e a Andressa lançam turmas fixas, aulas e
oficinas avulsas, uso livre do ateliê e dias fechados; marcam quem veio, controlam reposições e o que falta
receber — sem guardar dinheiro (toda cobrança vira Venda no Financeiro), dando baixa no Estoque do material do
uso livre, sem controle de lotação — e o site mostra só o que for marcado como público."
**Verificado:** 03/10/2026, 13h01 UTC, no `main` local em `6a20ee6` (merge das 06.2/06.3; `origin/main` = `eac0203`)
**Status:** passed
**Re-verificação:** não — verificação inicial (não havia `05-VERIFICATION.md`)

## O que li

- **Na íntegra:** a seção da Fase 5 do `ROADMAP.md`; AGE-01..20 no `REQUIREMENTS.md`; `05-CONTEXT.md` (D-01..D-18 e
  os ajustes do dono de 02/10); `05-16-SUMMARY.md`; `Claude outputs/agenda/VERIFICACAO-COWORK-05.md` (quadro dos 22
  passos); o modelo `06.1-VERIFICATION.md`.
- **Em parte:** `05-VERIFICACAO-HUMANA.md` (cabeçalho e resultados da Parte 0); `05-REVIEW-FIX.md` (frontmatter e
  CR-01); `05-UI-SPEC.md` (linhas do lote); `STATE.md` (frontmatter).
- **Código lido:** `lib/agenda/acoes.ts` (as 27 Server Actions — cabeçalho de todas, corpo de `definirPresenca`,
  `cancelarData`, `tirarBloqueio`, `tirarDaLista`, `cancelarReserva`, `tirarMaterial`, `receberAgora`),
  `lib/clientes/acoes.ts` (2 ações), os módulos puros `uso-livre.ts`, `mensalidade.ts`, `reposicao.ts`, `vagas.ts`,
  `presenca.ts`, `turma.ts`, `seletor.ts`, `tipos.ts`, `receber.ts` (`situacaoDaCobranca`), `lib/agenda/publico/*`,
  `lib/agenda/gravacao.ts` (datas futuras, sair da turma, baixa do material), `app/api/health/agenda/route.ts`,
  `db/migrations/0026_agenda.sql` (FKs, semente, `revoke`), `TABELAS_ESPERADAS` em `scripts/testar-migracoes.mjs`.
- **Não li:** os 16 PLAN e 15 SUMMARY dos planos 01–15 por inteiro, `05-RESEARCH.md`, `05-PATTERNS.md`, as REVIEW-A/B
  além do citado, `BRIEFING.md` e `prototipo.html`. Conferi pelo código e pelos documentos que os citam.

## O que rodei

| Comando | Resultado |
|---|---|
| `npm run lint` | **EXIT=0** (`--max-warnings=0`) |
| `npx tsc --noEmit` | **EXIT=0** (sem TS2307 — não precisei apagar `.next/types`) |
| `npm run verificar-acoes` | **EXIT=0** — `122 ação(ões) conferida(s), 0 violações` (a "1 violação" que aparece no log é a fixture `tests/fixtures/acoes/violando-transitivo.ts`, do teste do próprio verificador) |
| `npm test` (Vitest) | **EXIT=0** — **131 arquivos / 2825 testes passaram** (inclui os 17 `tests/unit/agenda-*.test.ts`) |
| `npm run verificar`, `npm run test:migracoes`, `npm run test:e2e` | **Não rodados por mim** — outro processo usava o Postgres efêmero. O resultado é da sessão principal. |
| `git log origin/main..main` | 105 commits locais; os da Agenda são `c008b1d`, `5e91ab3`, `534afd2` (0027 — Roteiro 19) |
| Greps de código | ver as tabelas abaixo |

Para o e2e cito a evidência registrada: a varredura completa da fase em `f82261f` (02/10, 00h48–01h03 UTC):
**1127 passed · 19 failed · 9 skipped · 52 did not run, nenhuma falha da Agenda (215 `ok` nos 25 specs novos)**; 4
falhas causadas pela fase corrigidas em `d4fc10a` e reverificadas (104 passed); `test:site-sem-banco` verde (commit
`d19cc14`, `PROXIMA-SESSAO.md`). Há 116 `test(` nos specs da Agenda/site/Início/Cadastros da fase.

## Objetivo — Critérios de Sucesso do ROADMAP (o contrato)

| # | Critério (ROADMAP, literal) | Status | Evidência |
|---|---|---|---|
| 1 | Os quatro tipos (turma fixa, aula/oficina avulsa, uso livre, fechado) são lançados pela mesma folha "Lançar na agenda" e aparecem nas vistas semana (padrão no celular) e mês | ✓ VERIFICADO | `folha-lancar.tsx:77-83`: `TipoDeLancamento = "turma" \| "avulsa" \| "uso_livre" \| "fechado"`, quatro opções numa folha só, que chamam `lancarTurma`, `lancarAvulsa`, `reservarUsoLivre`, `fecharDia`. Vistas: `semana-da-agenda.tsx`, `grade-do-mes.tsx`, `lib/agenda/semana.ts` (puro, "hoje" por argumento). e2e `agenda-lancamento`, `agenda-vistas`. Cowork passos 1, 6, 13, 18, 19 (semana e mês com pontos por tipo e legenda). |
| 2 | Lançar uma turma fixa já marca as N semanas pedidas (padrão 8); cada data tem lista própria e pode ser cancelada sozinha, sem contar falta para ninguém | ✓ VERIFICADO | `SEMANAS_PADRAO = "8"` (`textos.ts:410`), usado em `folha-lancar.tsx:239` e `folha-turma.tsx:262`; `datasDaTurma` (`turma.ts`) gera uma data por semana, de 1 a 52. `lancarTurma` cria turma e datas numa transação. `cancelarData` (`acoes.ts:533-612`) grava só `cancelado_em`/`cancelado_por` e, na mesma transação, limpa `presenca` e `direito_a_repor` das inscrições da data. O crédito é derivado só de datas não canceladas (`reposicao.ts`, cabeçalho). Cowork passo 21: a ficha da Ana voltou a "A REPOR 1 aula". |
| 3 | Marcar Veio/Faltou de uma turma inteira no celular é um toque por pessoa; falta com "tem direito a repor" gera um crédito que aparece primeiro ao colocar alguém numa data | ✓ VERIFICADO (tempo do C.1 não anotado) | `definirPresenca` usa estado desejado (`planejarPresenca`, `presenca.ts`): um toque, e tocar de novo manda `null`. `definirDireitoARepor` só vale em data de turma, para aluno/experimental, com "faltou" (`acoes.ts:299-303`; check `inscricoes_direito_so_com_falta`, 0026:113). `gruposDoSeletor` (`seletor.ts`) põe "Tem aula a repor" primeiro, só com saldo > 0. Cowork passos 5 e 6 ("[teste cowork] Ana — reposição · 1 a repor", `aria-pressed` certo). O dono aprovou a caminhada, mas não deu o tempo nem a contagem de toques do C.1. |
| 4 | Quem faz aula é o mesmo cliente do Financeiro — nenhum cadastro paralelo de pessoas | ✓ VERIFICADO | D-01: tabela `clientes` (0026:58) e `documentos.cliente_id` (FK, 0026:267). Inscrições, matrículas, mensalidades e usos livres apontam para `clientes`. A venda grava `pessoaNome` e `clienteId` (`acoes.ts`, `receberAgora`). Cadastro único em `lib/clientes/acoes.ts` (`criarCliente`/`editarCliente`), visível em Cadastros e na aba Pessoas. Não existe outra tabela de pessoas. Cowork passos 2–4 (aviso de homônimo da D-16). |
| 5 | "Recebi agora" cria a Venda já paga, que aparece no Caixa do dia; "Lançar na Venda" abre o rascunho preenchido; nos dois casos o item sai de "A receber" e o "pago" passa a vir do Financeiro | ✓ VERIFICADO | `receberAgora` (`acoes.ts:1841-1916`) monta as linhas a partir do banco, sob trava; parcela `{ vencimento: hoje, pago: true }`; grava pelo mesmo `gravarVenda` do Financeiro e chama `vincularVenda` na mesma transação; revalida `/financeiro`. "Lançar na Venda": `lib/financeiro/acoes.ts:21,243-276` (`vincularCobranca`, o servidor sobrescreve as linhas). "Pago" derivado: `situacaoDaCobranca` (`receber.ts:44-64`) — venda ativa com parcela aberta = lançado, sem parcela aberta = pago, venda cancelada = volta (D-08). Corridas CR-01/WR-01 provadas por `scripts/provar-corridas-da-agenda.ts`, dentro de `test:migracoes`. Cowork passos 7–11 (venda nº 25 no Caixa em Pix; o lote; a venda preenchida; a cancelada que volta com a etiqueta). |
| 6 | Encerrar um uso livre cobra horas cheias × pessoas × preço da hora + material cobrado, e cada material vira saída no Estoque com vínculo ao uso, mesmo quando "incluso" | ✓ VERIFICADO | `horasCheias` = `Math.ceil(minutos/60)` e `valorDoUsoLivre` = `horas × pessoas × precoHora + material` — pessoas multiplica uma vez, como diz a nota do AGE-13 (`uso-livre.ts`). `baixarMaterialDoUso` (`gravacao.ts:~744-789`) gera um pedido para cada linha, cobrada ou inclusa, com `destino: "uso_livre"` e `usoLivreId: uso.id`, e grava por `gravarMovimentacoes` (a porta única do livro). FK `movimentacoes_estoque.uso_livre_id` (0026:268). O preço da hora é lido do item do sistema; sem preço, recusa. Cowork passo 15: 65 min = 2 h × R$ 30 = R$ 60; Estoque "−0,2 kg · Uso livre do espaço · … Ana". |
| 7 | Lista cheia avisa e não bloqueia; nenhum aviso de lotação do espaço ou de sobreposição | ✓ VERIFICADO | `listaCheia` só é usada em `colocar-alguem.tsx:79,166` (caixa âmbar `aviso-lista-cheia`; o botão continua). `colocarNaData` não confere vagas (grep de `vaga\|cheia\|lotac` no corpo = só um comentário). O banco não tem check de inscritos ≤ vagas (só a faixa 1..999). Não há "sobrepos"/"lotação" no código da Agenda. Cowork passo 6: "2 de 1", "A lista já está cheia — dá para colocar mesmo assim, é só um aviso." |
| 8 | O site mostra só aulas e oficinas públicas e não canceladas, com vagas restantes e "Reservar pelo WhatsApp", sem nome de ninguém | ✓ VERIFICADO (lado positivo só em e2e) | `lib/agenda/publico/consultas.ts` filtra `eventos.publico = true`, turma pública agora (WR-02), `cancelado_em is null`, tipo turma/avulsa e `data >= hoje`. Não seleciona `clientes`, telefone, presença, uso livre nem o motivo do fechado (só a data). `publico/agenda.ts` monta cada objeto campo a campo, e `agenda-publico.test.ts` afirma a lista branca de chaves. `app/page.tsx`: ISR `revalidate = 300`, "hoje" calculado no servidor. e2e `site-agenda` (a)–(e): preço, "últimas 2 vagas", esgotado, WhatsApp, a privada ausente e nenhum nome ou telefone no HTML. Cowork passo 17: sem evento público, o texto da 04.6 (D-11) e nenhum "[teste cowork]". **O lado positivo em produção (uma oficina pública real) não foi visto** — depende de o ateliê publicar uma; o 05-16-SUMMARY registra isso como fora da fase. |
| 9 | Cancelar nunca apaga: fica riscado; venda e movimentação de estoque já geradas nunca são apagadas pela Agenda | ✓ VERIFICADO | `cancelarData` faz só `update` e tem "Desfazer". Os `delete` da Agenda são cinco, todos permitidos: o fechado (`acoes.ts:627`, só `tipo = 'fechado'`, AGE-05); a reserva não iniciada (`:1445`, só `estado = 'reservado'`; com material baixado, a FK recusa — 23503); tirar da lista (`:833`, recusa aluno e venda ativa, D-08); o material ainda não baixado (`:1799`, `movimentacao_id is null`); e as datas futuras / inscrições futuras de aluno ao desativar ou sair da turma (`gravacao.ts:534-537,597`), que antes travam e recusam se houver venda ativa (WR-01). Nenhum `delete` de `documentos`, `parcelas` ou `movimentacoes_estoque` no repositório (grep vazio). No banco: `revoke delete on documentos, parcelas…` (0015:199), `revoke update, delete on movimentacoes_estoque` (0023:92), `revoke delete on clientes, turmas, turma_alunos, mensalidades` (0026:425). Os vínculos da Agenda com a venda são FKs `on delete no action`. Cowork passos 20 e 21. |

**Score: 9/9 critérios de sucesso verificados.**

## Regras do projeto conferidas no código

| Regra | Status | Evidência |
|---|---|---|
| Toda Server Action começa por `exigirUsuario()` | ✓ | As 27 de `lib/agenda/acoes.ts` e as 2 de `lib/clientes/acoes.ts`, conferidas uma a uma por `grep -A4 "^export async function"`: a primeira instrução de todas é `exigirUsuario()` (em `definirPresenca`, depois de um comentário). Só `lib/agenda/acoes.ts` tem a diretiva `"use server"` dentro de `lib/agenda`. `verificar-acoes`: 122 conferidas, 0 violações. A página `/gestao/agenda` também começa por `exigirUsuario()` (`page.tsx:129`). |
| Zod no servidor | ✓ | Toda ação faz `esquema….safeParse(entradaBruta)` logo depois do `exigirUsuario()`. Os esquemas estão em `lib/agenda/esquemas.ts` (531 linhas), com teste em `agenda-esquemas.test.ts`. |
| Regras em módulos puros de `lib/agenda/`, testadas, com "hoje" por parâmetro | ✓ | `abas, espaco, horario, mensalidade, numeros, presenca, receber, reposicao, seletor, semana, tipos, turma, uso-livre, vagas, publico/agenda`. Os imports são só de puros (`lib/producao/calendario`, `lib/financeiro/dinheiro`/`formato`, `lib/estoque/saldo`, `lib/cadastros/catalogo`); nenhum importa React, `@/db` ou drizzle. `new Date`/`Date.now` não aparecem nesses módulos (só em comentários). Os testes de cada um estão em `tests/unit/agenda-*.test.ts` e passaram. Horas cheias, proporcional (`valorProporcional`, aritmética inteira), créditos, geração das datas e vagas restantes estão cobertos. |
| Nenhum preço no código (AGE-17) | ✓ | A semente da 0026 (linhas 302-317) cria "Mensalidade", "Inscrição em oficina" e "Uso livre (hora)" com `preco_venda_centavos = null` e `chave_do_sistema`. O gatilho `travar_item_do_sistema` (D-17) impede desativar. O preço da hora vem do item em Cadastros; mensalidade e oficina vêm do valor digitado na turma ou no evento. O grep de literais de centavos em `lib/agenda` deu vazio. |
| `TABELAS_ESPERADAS` com as tabelas da Agenda | ✓ | `scripts/testar-migracoes.mjs:87-98`: `clientes, turmas, turma_alunos, eventos, inscricoes, mensalidades, usos_livres, usos_livres_material` (as oito da 0026), com `conferirAgenda` (linha 4958) e `provar-corridas-da-agenda.ts` (linha 6405) registrados. |
| Estados de carregamento e erro | ✓ | `app/gestao/(app)/agenda/{loading,error}.tsx`; `EsqueletoDosNumeros` para a aba Números. |

## Requisitos (AGE-01..20)

Todos os 20 estão no `REQUIREMENTS.md` como Phase 5 e nos planos; nenhum órfão.

| Req | Status | Evidência principal |
|---|---|---|
| AGE-01 | ✓ | Critério 1. Só o ateliê lança: todas as ações exigem sessão; o site só lê. |
| AGE-02 | ✓ | Semana (padrão) e mês; Cowork 18. |
| AGE-03 | ✓ | Critério 2. A folha da turma (D-03): `editarTurma`, `marcarMaisSemanas` (`aPartirDeParaEstender`), `desativarTurma`. Caixa pública desmarcada por padrão (`folha-lancar.tsx:234`, `eac0203`, no ar). |
| AGE-04 | ✓ | Critério 2. |
| AGE-05 | ✓ | Critério 9. Remoção só do fechado e da reserva não iniciada, com diálogo (`confirmar-tirar-bloqueio.tsx`, `confirmar-cancelar-reserva.tsx`). |
| AGE-06 | ✓ | Critério 4. `lista-pessoas.tsx`, `ficha-pessoa.tsx`; Cowork 3–4. |
| AGE-07 | ✓ | `entrarNaTurma`/`sairDaTurma`; `valorProporcional`; `tirarAlunoDasDatasFuturas` só tira `data > hoje`, aluno sem presença. |
| AGE-08 | ✓ | Critério 3; `precisaMarcarPresenca(evento, hoje)`. |
| AGE-09 | ✓ | `creditosDeReposicao` derivado dos dois lados; oficina não gera (`evento.tipo !== "turma"` recusa). |
| AGE-10 | ✓ | `gruposDoSeletor` com reposição primeiro; experimental com "cobrar/gratuita" (D-07, `escolha-experimental.tsx`). |
| AGE-11 | ✓ | Critério 7. |
| AGE-12 | ✓ | `lancarAvulsa` com vagas, preço e público; inscrição paga à parte (`tipo = 'oficina'`). |
| AGE-13 | ✓ | Critério 6; `proximoEstado` só permite Reservado → No espaço → Encerrado. |
| AGE-14 | ✓ | Critério 6; D-14: "cobrar" só com preço de venda; preço congelado no encerramento. |
| AGE-15 | ✓ | Critério 5; D-08 e D-09 (`definirDispensa`, `dispensadas.tsx`). |
| AGE-16 | ✓ | `lancarMensalidadesEmLote` (uma venda por mensalidade, parcela em aberto no vencimento); `<details open>` (`lote-de-mensalidades.tsx:28-29`); confirmação "Lançar N vendas?" (`confirmar-lancar-lote.tsx`, `eac0203`). Mensalidade ao abrir a tela (D-02): `garantirMensalidadesDoMes` chamado em `agenda/page.tsx:221,234,284,325`, com chave única e `on conflict do nothing`; "sem aula, sem mensalidade" (WR-03) provado em `provar-corridas-da-agenda.ts`. |
| AGE-17 | ✓ | Regra "nenhum preço no código", acima. |
| AGE-18 | ✓ | Critério 8; D-10 (preço nos cartões), D-11 (sem evento → texto da 04.6), D-12 (vagas da turma − alunos ativos). O WhatsApp fica em `conteudo/site.ts` (discrição, Parte 0: `5562994817661`, `6dc5417`). |
| AGE-19 | ✓ | `lib/agenda/numeros.ts` (puro) + `numeros-da-agenda.tsx` na aba `numeros`; Cowork 16. |
| AGE-20 | ✓ | Regra dos módulos puros e critério 9. Dinheiro em centavos inteiros (`arredondarMeioParaCima`); quantidade em milésimos. Início lendo a Agenda (§11.4/D-05/D-18): `bloco-agenda-de-hoje.tsx`, `lib/agenda/espaco.ts`; Cowork 14 ("Agora no espaço 1 pessoa"). |

## Ligações principais

| De | Para | Via | Status |
|---|---|---|---|
| `receberAgora` / lote | `gravarVenda` (Financeiro) | mesma transação + `vincularVenda` | ✓ LIGADO |
| `lancarVenda` (Financeiro) | `vincularCobranca` (`lib/agenda/gravacao.ts`) | `lib/financeiro/acoes.ts:21,243` | ✓ LIGADO |
| `encerrarUsoLivre` | `gravarMovimentacoes` (Estoque) | `baixarMaterialDoUso`, destino `uso_livre`, `usoLivreId` | ✓ LIGADO |
| `app/page.tsx` (site, ISR 300 s) | `lerAgendaPublica` | `AgendaPublica hoje={hojeEmBrasilia(new Date())}` | ✓ LIGADO |
| Página da Agenda | `garantirMensalidadesDoMes` (D-02) | ao abrir A receber, Pessoas e a ficha | ✓ LIGADO |
| Início | consultas da Agenda + `espaco.ts` | `bloco-agenda-de-hoje.tsx` | ✓ LIGADO |
| `/api/health/agenda` | `clientes`, `documentos.cliente_id`, `movimentacoes_estoque.uso_livre_id`, `usos_livres.dispensada_em` | `limit(1)`, corpo só `{status}` | ✓ LIGADO (ver Avisos: no `main` local, exige a 0027) |

## Avisos (não bloqueiam o objetivo)

1. **A 0027 e o health que a exige não estão no ar.** No `main` local, `/api/health/agenda` passa a pedir a coluna
   `usos_livres.dispensada_em` (`route.ts`), que só existe depois da 0027. No Roteiro 19, entre o `implantar` e o
   `db:migrate`, ela fica 503 — é o sinal esperado, descrito no Roteiro 18. Publicação do dono, já prevista; não é
   lacuna da fase.
2. **Documentos de estado com afirmação velha de presente** (regra do projeto — corrigir ao fechar a fase; não
   editei, por instrução):
   - `ROADMAP.md:53` ainda diz `- [ ] **Phase 5: Agenda** (▶ próxima …)`;
   - `ROADMAP.md:1110` diz `16/16 | In Progress`;
   - na seção da Fase 5, o parágrafo dos planos ainda diz "🔴 O código vive no branch `gsd/phase-05-agenda`, fora
     de `main` … Nada executado, nada publicado.", sem data;
   - `05-VERIFICACAO-HUMANA.md` continua com o frontmatter `status: awaiting-owner` e com "falta só a Parte 2, no
     seu celular" no cabeçalho, embora o dono tenha aprovado em 03/10;
   - `STATE.md:1714` diz "aguardando o dono — a caminhada da Agenda (Fase 5)".

   `ROADMAP.md` e `REQUIREMENTS.md` têm mudanças não comitadas, e o `05-16-SUMMARY.md` ainda não foi comitado — o
   orquestrador deve fechar isso.
3. **O registro da caminhada é fino:** aprovação no chat, sem Resultado por item (B.1–B.9, D.0, D.1–D.53) e sem o
   cronômetro do C.1 — o valor central do "um toque por pessoa". A caminhada do Cowork cobre os 9 critérios em
   produção, mas não cronometrou.
4. **O lado positivo do critério 8 em produção** (oficina pública real no site com vagas e WhatsApp) só foi provado
   em e2e. Em produção ainda não há evento público.
5. **Dado de teste em produção** (pessoas, turmas, matrículas e mensalidades "[teste cowork]"/"[teste]") fica, pela
   regra da 0026 (`revoke delete`). Está registrado no 05-16-SUMMARY e no Cowork §3.

## Anti-padrões

| Arquivo | Padrão | Severidade |
|---|---|---|
| `lib/agenda`, `lib/clientes`, `components/amassa/agenda`, `app/gestao/(app)/agenda`, `0026`/`0027`, `provar-corridas-da-agenda.ts` | `TBD`/`FIXME`/`XXX` | nenhum |
| `lib/agenda/textos.ts:108,117,317,405,1119` | "PLACEHOLDER_" | ℹ️ falso positivo — texto de exemplo dos campos (`placeholder=`), não pendência |
| — | "em breve" / "não implementado" | nenhum na Agenda (o "em breve" da D-11 é o texto aprovado da 04.6 no site) |

## Verificação humana

Coberta. Os itens que só um humano vê — toque no celular, Caixa real, site — estão cobertos por duas evidências:

- a **aprovação do dono** (chat, 03/10/2026);
- a **caminhada do Cowork em produção** (22 passos, nenhum 🔴, sobre `9b640e2` com a 0026 aplicada). Ela passa por
  todos os 9 critérios: "Recebi agora" no Caixa, o lote, "Lançar na Venda", a venda cancelada que volta, o uso livre
  com baixa no Estoque, a lista cheia, o site sem nome, desativar/cancelar sem apagar e 320 px sem rolagem lateral.

O que ficou sem número (C.1) e sem evento público real (critério 8) está em Avisos, sem bloquear.

## Resumo

Não há lacuna. Os 9 critérios e os 20 requisitos têm código substantivo e ligado:

- todas as 29 Server Actions da fase começam por `exigirUsuario()` e validam com Zod;
- as regras ficam em módulos puros testados (2825 testes verdes);
- a Agenda não apaga venda nem movimentação — o código não tem esse `delete`, e o banco o recusa;
- o site lê só eventos públicos e não cancelados, sem coluna de pessoa.

Produção: `0026` aplicada e health 200 pelo Roteiro 17. O que resta são documentos de estado a corrigir e a
publicação da `0027` pelo Roteiro 19, que é do dono.

`verificar`/`test:migracoes`/e2e não foram rodados por mim. O resultado de `npm run verificar` vem da sessão
principal.

---

_Verificado: 2026-10-03T13:01:00Z_
_Verificador: Claude (gsd-verifier)_


---

*Acréscimo do orquestrador, 03/10/2026: o `npm run verificar` que o verificador não pôde rodar (o Postgres efêmero estava em uso) rodou no `main` unido (Agenda + quick 261002-sdt + 06.2 + 06.3): **exit 0** — `verificar-acoes` 122 ações, 0 violações; 131 arquivos, 2825 testes; `test:migracoes` "Todas as afirmações passaram." (0027 incluída).*
