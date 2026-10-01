---
phase: 05
slug: agenda
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-01
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from the "Validation
> Architecture" section of `05-RESEARCH.md`, with the owner's decisions of 01/10/2026 applied
> (D-01..D-07 from the discussion, D-08..D-18 from the research's open questions, `05-CONTEXT.md`) —
> notably D-15: code and migration go out together and the owner applies the migration right after
> the deploy, accepting the window in which every sale and stock write fails.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (unit) · Playwright ^1.62.1 (e2e) · `scripts/testar-migracoes.mjs` (ephemeral Postgres) · `scripts/testar-site-sem-banco.mjs` (root page without Postgres) |
| **Config file** | `vitest.config.ts` (`include: ["tests/unit/**/*.test.ts"]`), `playwright.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/agenda-*.test.ts tests/unit/clientes-*.test.ts` |
| **Full suite command** | `npm run verificar` (lint, `tsc --noEmit`, `verificar-acoes`, `npm test`, `test:migracoes`) |
| **Estimated runtime** | ~5 s quick · ~3–4 min `verificar` (includes the ephemeral Postgres of `test:migracoes`) |

`npm run test:e2e` costs ~53 s of fixed tax before the first test (15 s Postgres + 38 s `next build`).
Per `.claude/CLAUDE.md`: at most ONE invocation per task, always with `--grep` on what the task
touched; never `npm run build` as a separate step; the un-grepped full sweep runs ONCE per phase, in
the last plan, together with `npm run test:site-sem-banco`. If a `--grep` fails and the full suite is
needed to diagnose, run it and record it in the SUMMARY.

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/unit/agenda-*.test.ts` + `npx tsc --noEmit`
- **After every plan wave:** `npm run verificar`
- **Before `/gsd-verify-work`:** `npm run verificar` green + one full `npm run test:e2e` sweep + `npm run test:site-sem-banco` (last plan)
- **Max feedback latency:** ~10 s for the quick run

---

## Per-Task Verification Map

Requirement → test map from the research; the planner assigns Task IDs and waves.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| AGE-01 | Folha "Lançar" cria os 4 tipos; só autenticado | e2e | `npm run test:e2e -- --grep "agenda lancar"` | ❌ W0 | ⬜ pending |
| AGE-02 | Semana (padrão no celular, Hoje, + lançar) e mês (pontos; toque abre a semana) | unit + e2e | `npx vitest run tests/unit/agenda-semana.test.ts`; `--grep "agenda vistas"` | ❌ W0 | ⬜ pending |
| AGE-03 | Turma marca N semanas (padrão 8); "mais N semanas" sem duplicar; folha da turma (D-03) | unit + migration + e2e | `tests/unit/agenda-turma.test.ts`; `test:migracoes` (unique, 23505); `--grep "agenda turma"` | ❌ W0 | ⬜ pending |
| AGE-04 | Data cancelada pelo ateliê não conta falta; lista própria por data | unit + e2e | `tests/unit/agenda-reposicao.test.ts`; `--grep "agenda cancelar data"` | ❌ | ⬜ pending |
| AGE-05 | Cancelar risca e desfaz; remover só fechado e reserva não iniciada, com confirmação | e2e + migration | `--grep "agenda remover"`; `test:migracoes` (delete revogado onde não se apaga, 42501) | ❌ | ⬜ pending |
| AGE-06 | Pessoas = clientes (D-01); busca sem acento; tags; ficha; Cadastros → Clientes | unit + migration + e2e | `tests/unit/clientes-esquemas.test.ts`; `test:migracoes` (`nome_normalizado`); `--grep "agenda pessoas"` | ❌ | ⬜ pending |
| AGE-07 | Entrar (proporcional) / sair (só futuras) | unit + e2e | `tests/unit/agenda-mensalidade.test.ts`; `--grep "agenda entrar na turma"` | ❌ W0 | ⬜ pending |
| AGE-08 | Veio/Faltou em um toque, desmarca; "marcar presença" em data passada | unit + e2e (celular) | `tests/unit/agenda-presenca.test.ts`; `--grep "agenda presenca"` | ❌ | ⬜ pending |
| AGE-09 | Crédito = faltas com direito − reposições; dois celulares não estouram | unit + e2e | `agenda-reposicao.test.ts`; `--grep "agenda reposicao"` | ❌ | ⬜ pending |
| AGE-10 | Colocar: a repor primeiro; experimental cobrar/gratuita com valor sugerido (D-07); tirar da lista | unit + e2e | `agenda-mensalidade.test.ts` (valor da aula); `--grep "agenda colocar"` | ❌ | ⬜ pending |
| AGE-11 | n / vagas; lista cheia avisa e não bloqueia | unit + e2e | `tests/unit/agenda-vagas.test.ts`; `--grep "agenda lista cheia"` | ❌ | ⬜ pending |
| AGE-12 | Avulsa com preço; inscrição vai para "A receber" | e2e | `--grep "agenda oficina"` | ❌ | ⬜ pending |
| AGE-13 | Reservado → Chegou → Encerrado; horas cheias × pessoas × preço da hora | unit + e2e | `tests/unit/agenda-uso-livre.test.ts`; `--grep "agenda uso livre"` | ❌ W0 | ⬜ pending |
| AGE-14 | Cada material vira saída "Uso livre do espaço" com vínculo e área Espaço, inclusive o incluso (D-06) | unit + migration + e2e | `tests/unit/estoque-pedidos.test.ts`, `estoque-destinos.test.ts`; `test:migracoes` (checks em texto); `--grep "agenda material estoque"` | ✅ estender / ❌ | ⬜ pending |
| AGE-15 | "Recebi agora" (paga hoje, no Caixa) e "Lançar na Venda" (rascunho preenchido); vínculo; "pago" derivado | unit + e2e | `tests/unit/agenda-receber.test.ts`, `financeiro-gravacao.test.ts`; `--grep "agenda receber"` | ❌ | ⬜ pending |
| AGE-16 | Lote: uma venda por aluno, parcela no vencimento; D-02 idempotente | unit + migration + e2e | `test:migracoes` (inserção da D-02 duas vezes = mesma contagem); `--grep "agenda mensalidades lote"` | ❌ | ⬜ pending |
| AGE-17 | Três itens semeados, editáveis, protegidos (D-17), sem preço no código | migration + e2e | `test:migracoes` (semente, chave, gatilho); `--grep "cadastros itens da agenda"` | ❌ | ⬜ pending |
| AGE-18 | Site: só público, não cancelado, de hoje em diante; vagas (D-12); preço só nos cartões (D-10); sem nome; sem evento = três cartões (D-11); cai no "sem Agenda" sem banco | unit + e2e + script | `tests/unit/agenda-publico.test.ts`, `site-isolamento.test.ts` (cerca reescrita); `--grep "site agenda"`; `npm run test:site-sem-banco` | ✅ reescrever / ❌ | ⬜ pending |
| AGE-19 | Números do mês até hoje | unit + e2e (`@vazio-historico` serial) | `tests/unit/agenda-numeros.test.ts`; `--grep "agenda numeros"` | ❌ | ⬜ pending |
| AGE-20 | Pureza de `lib/agenda/`; centavos e milésimos; cancelar não apaga venda nem baixa | unit + migration | teste de pureza por leitura; `test:migracoes` (FK impede apagar uso com baixa, 23503) | ❌ W0 | ⬜ pending |
| D-05 / D-18 | "Agora no espaço": uso livre de hoje com "Chegou" + aula em curso sem "Faltou"; o de ontem ganha "encerrar" | unit + e2e (`@vazio-historico`) | `tests/unit/agenda-espaco.test.ts`; `--grep "inicio agenda de hoje"` | ✅ estender / ❌ | ⬜ pending |
| D-08 | Venda cancelada no Caixa → cobrança volta a "A receber" (derivado); "tirar da lista" recusado com venda ativa | unit + e2e | `agenda-receber.test.ts`; `--grep "agenda venda cancelada"` | ❌ | ⬜ pending |
| D-09 | "Dispensar" marca e desfaz; só cobrança não lançada ou com venda cancelada | unit + migration + e2e | `agenda-receber.test.ts`; `test:migracoes`; `--grep "agenda dispensar"` | ❌ | ⬜ pending |
| D-13 | Dia fechado avisa e não bloqueia; datas de turma nele ganham "dia fechado" | unit + e2e | `agenda-semana.test.ts`; `--grep "agenda dia fechado"` | ❌ | ⬜ pending |
| D-14 | "Cobrar" só com preço de venda; linha livre na categoria do "Uso livre (hora)"; preço congelado | unit + e2e | `agenda-uso-livre.test.ts`; `--grep "agenda material cobrar"` | ❌ | ⬜ pending |
| D-16 | Homônimo: aviso por nome normalizado, sem impedir | unit + e2e | `clientes-esquemas.test.ts`; `--grep "clientes homonimo"` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Onde cada linha aterrissa nos planos (planejador, 01/10/2026)

Os nomes de `--grep` da tabela acima eram a proposta da pesquisa; **valem os dos planos** (nomes escolhidos
para nenhum `--grep` pegar o spec de outro plano por acidente — “agenda lancar” pegaria “agenda lancar na
venda”):

| Linha | Plano · tarefa | `--grep` / comando real |
|---|---|---|
| AGE-01 | 05-03 T1; 05-06 T2; 05-09 T2 | `agenda lancamento`; `agenda turma`; `agenda uso livre` |
| AGE-02 | 05-01 T2; 05-03 T3 | `agenda tracador`; `agenda vistas` |
| AGE-03 / D-03 | 05-06 T1-T3 | `tests/unit/agenda-turma.test.ts`; `agenda turma` |
| AGE-04 | 05-03 T2; 05-08 T3 | `agenda cancelamento`; `agenda presenca` |
| AGE-05 | 05-02 T1; 05-03 T2; 05-09 T2 | `test:migracoes`; `agenda cancelamento`; `agenda uso livre` |
| AGE-06 / D-01 / D-16 | 05-04 T1-T2; 05-07 T2; 05-13 T2 | `cadastros clientes`; `agenda pessoas`; `agenda entrar na turma`; `agenda pagamento` |
| AGE-07 / D-02 | 05-07 T1-T3 | `tests/unit/agenda-mensalidade.test.ts`; `agenda entrar na turma` |
| AGE-08 | 05-01 T2; 05-08 T3; 05-14 T2 | `agenda tracador`; `agenda presenca`; `inicio` |
| AGE-09 | 05-08 T1-T2 | `tests/unit/agenda-reposicao.test.ts`; `agenda reposicao` |
| AGE-10 / D-07 | 05-05 T2; 05-08 T2-T3 | `agenda colocar`; `agenda reposicao`; `agenda presenca` |
| AGE-11 | 05-05 T2; 05-08 T3 | `tests/unit/agenda-vagas.test.ts`; `agenda colocar`; `agenda presenca` |
| AGE-12 | 05-03 T1; 05-05 T2 | `agenda lancamento`; `agenda colocar` |
| AGE-13 / D-18 | 05-09 T1-T3 | `tests/unit/agenda-uso-livre.test.ts`; `agenda uso livre` |
| AGE-14 / D-06 / D-14 | 05-01 T1; 05-10 T1-T2 | `tests/unit/agenda-paridade.test.ts`, `tests/unit/estoque-pedidos.test.ts`; `agenda material` |
| AGE-15 / D-08 | 05-11 T1-T3; 05-12 T1-T2; 05-13 T2-T3 | `financeiro venda|financeiro tracador`; `agenda receber`; `agenda venda preenchida`; `agenda pagamento`; `agenda venda cancelada` |
| AGE-16 | 05-07 T3; 05-12 T3 | `agenda entrar na turma`; `agenda mensalidades lote` |
| AGE-17 / D-04 / D-17 | 05-02 T1-T2; 05-09 T2-T3 | `test:migracoes`; `cadastros itens da agenda`; `agenda uso livre` |
| AGE-18 / D-10 / D-11 / D-12 | 05-15 T1-T3 | `tests/unit/agenda-publico.test.ts`; `site agenda|site secoes`; `agenda no site`; `npm run test:site-sem-banco` |
| AGE-19 | 05-14 T1, T3 | `tests/unit/agenda-numeros.test.ts`; `agenda numeros` |
| AGE-20 | 05-01 T1-T2; 05-02 T1; 05-07 T1; 05-13 T3 | pureza por leitura; `test:migracoes`; `agenda venda cancelada` |
| D-05 / D-18 | 05-14 T1-T2 | `tests/unit/agenda-espaco.test.ts`; `inicio` |
| D-09 | 05-13 T1 | `agenda dispensar` |
| D-13 | 05-03 T1; 05-06 T2; 05-08 T3; 05-09 T2 | `agenda lancamento`; `agenda turma`; `agenda presenca`; `agenda uso livre` |
| Valor central | 05-08 T3 (medição automática); 05-16 T3 (humana) | `agenda presenca`; caminhada |
| Migração aplicada (D-15) | 05-16 T1, T3 | `agenda saude`; Roteiro 17 |

Varredura completa sem `--grep` e `test:site-sem-banco`: só no 05-16 T2 (o `test:site-sem-banco` também roda
no 05-15 T2, que muda a raiz).

---

## Wave 0 Requirements

- [ ] `tests/unit/agenda-semana.test.ts`, `agenda-horario.test.ts`, `agenda-turma.test.ts`
- [ ] `tests/unit/agenda-mensalidade.test.ts` — proporcional, vencimento, valor da aula (D-07)
- [ ] `tests/unit/agenda-uso-livre.test.ts` — horas cheias, valor, material (D-14), transições
- [ ] `tests/unit/agenda-reposicao.test.ts`, `agenda-presenca.test.ts`, `agenda-vagas.test.ts`
- [ ] `tests/unit/agenda-receber.test.ts` (D-08, D-09), `agenda-espaco.test.ts` (D-05, D-18), `agenda-numeros.test.ts`, `agenda-publico.test.ts` (D-10..D-12), `agenda-abas.test.ts`
- [ ] `tests/unit/agenda-paridade.test.ts` — uniões × `db/schema.ts` (enums novos e `destino_saida`)
- [ ] `tests/unit/clientes-esquemas.test.ts` (D-01, D-16)
- [ ] `tests/unit/financeiro-gravacao.test.ts` (se o escritor compartilhado tiver parte pura) e `estoque-destinos.test.ts` atualizado
- [ ] `scripts/testar-migracoes.mjs` — `TABELAS_ESPERADAS` com as tabelas novas e a conferência da Agenda (D-02 idempotente, checks em texto do enum, gatilho dos itens do sistema, delete revogado)
- [ ] `tests/unit/site-isolamento.test.ts` — cerca reescrita com exceção nomeada
- [ ] `tests/e2e/apoio/semear-agenda.ts` (+ "agora" do ateliê no fuso de Brasília, nunca `toISOString()`), `tests/e2e/agenda-*.spec.ts`; `casca.spec.ts` sem o placeholder da Agenda

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Presença de uma turma inteira no celular, um toque por pessoa, de pé | Core Value / AGE-08 | Mão real, celular real, no ateliê — o Core Value do projeto | Caminhada de verificação humana do último plano, com o tempo medido |
| A migração aplicada pelo dono, depois de backup, logo depois do deploy (D-15) | Critérios 5, 6 e 9 / AGE-14..AGE-17 | Migração é aplicada à mão pelo dono (CLAUDE.md) | Roteiro escrito pelo último plano: conferir que a plataforma segue fora de uso real → backup → merge + push → esperar o `implantar` terminar → `db:migrate` → `curl /api/health/agenda` 200 → SQL depois |
| O site público no celular de quem não está logado: só eventos públicos, sem nome, WhatsApp abrindo | AGE-18 / D-10..D-12 | O e2e prova o HTML; o dono confere o site de verdade, de fora | Abrir `https://amassacerrado.com.br/` numa janela anônima depois da publicação |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 s for the quick run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
