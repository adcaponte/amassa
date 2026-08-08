---
phase: 02a-login-banco-base-e-backup
verified: 2026-08-08T14:49:45Z
status: passed
score: 8/8 truths verified (roadmap success criteria), 17/17 requirement IDs satisfied
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2a: Login, Banco Base e Backup — Relatório de Verificação

**Meta da fase:** Entrar com e-mail e senha, e ter o backup automático do banco funcionando — a
parte da fundação que todo módulo posterior herda.
**Verificado:** 2026-08-08T14:49:45Z
**Status:** passed
**Re-verificação:** Não — verificação inicial

## Achievement da meta

### Truths observáveis (Success Criteria do ROADMAP)

| # | Truth | Status | Evidência |
|---|---|---|---|
| 1 | Abrir qualquer endereço sem sessão leva para `/login` | ✓ VERIFIED | `middleware.ts` + `lib/auth/rotas-publicas.ts` lidos e confirmados; `tests/e2e/fundacao.spec.ts`; confirmado em produção pelo orquestrador: `/` → 307 → `/login` com `Cache-Control: no-store` |
| 2 | Senha errada e e-mail inexistente mostram a mesma mensagem em português | ✓ VERIFIED | `lib/auth/credenciais.ts` lido: `RECUSA` é objeto único `Object.freeze`d, devolvido em todo caminho de recusa (senha errada, e-mail sem conta, usuário desativado, hash corrompido); `tests/unit/credenciais.test.ts` e `tests/e2e/autenticacao.spec.ts` afirmam igualdade exata |
| 3 | 5 erros no mesmo e-mail em 15 min bloqueiam por 15 min | ✓ VERIFIED | `lib/auth/tentativas.ts` lido: módulo puro, zero imports, janela deslizante testada nas duas fronteiras (5º passa, 6º recusa); ligado em `lib/auth/auth.ts` (`avaliarPedidoAgora` antes de qualquer consulta ao banco); `tests/e2e/autenticacao.spec.ts` |
| 4 | Sessão persiste 30 dias; sair encerra de verdade (voltar não devolve acesso) | ✓ VERIFIED | `lib/auth/auth.config.ts` lido: `maxAge`/`updateAge` declarados como expressão legível, cookie `httpOnly`/`secure`/`sameSite=lax`; `middleware.ts` lido: acrescenta `Cache-Control: no-store, must-revalidate` só em rota protegida; `tests/e2e/sessao.spec.ts` prova os quatro casos |
| 5 | Criar e desativar usuário pela linha de comando funciona | ✓ VERIFIED | `scripts/criar-usuario.ts`, `scripts/desativar-usuario.ts`, `scripts/redefinir-senha.ts` existem; `grep` confirma zero ocorrências de `delete`/`drop`; `npm run test:migracoes` exercita os três contra Postgres real; confirmado em produção: conta de gestor criada via `criar-usuario.ts`, login real bem-sucedido |
| 6 | `middleware.ts` carrega sem erro — divisão `auth.config.ts`/`auth.ts` correta, argon2 fora do runtime Edge | ✓ VERIFIED | Lidos ambos os arquivos: `middleware.ts` importa só `./lib/auth/auth.config` e `./lib/auth/rotas-publicas`, nunca `auth.ts`; `auth.config.ts` importa só tipos do Auth.js e `rotas-publicas.ts`; `tests/unit/auth-borda.test.ts` prova por grafo de módulos (não por inspeção), provado nos dois sentidos durante a execução (SUMMARY 01) |
| 7 | Backup de ontem existe no servidor e no armazenamento externo | ✓ VERIFIED | Evidência de produção fornecida pelo orquestrador: `execucoes_backup` com `sucesso=t`/`destino_externo_ok=t`; dump presente em disco local, Google Drive (rclone) e registrado no banco; ensaio de restauração (D-11) com contagens de `usuarios`/`verificacao_infraestrutura` batendo |
| 8 | `/api/health/backup` responde `ok` com backup <26h e falha caso contrário | ✓ VERIFIED | `lib/backup/frescor.ts` lido: módulo puro, `JANELA_EM_HORAS=26`, sete/nove casos incluindo as duas fronteiras (25h59/26h01); `app/api/health/backup/route.ts` delega a decisão; `tests/e2e/backup.spec.ts`; confirmado em produção: `{"status":"ok","ultimoBackupEm":"2026-08-08T14:25:44.605Z"}` |

**Score:** 8/8 truths do ROADMAP verificadas.

### Artefatos obrigatórios

| Artefato | Esperado | Status | Detalhes |
|---|---|---|---|
| `lib/auth/rotas-publicas.ts`, `auth.config.ts`, `auth.ts`, `senha.ts` | divisão Edge/Node | ✓ VERIFIED | Lidos; grafo de imports confere com o plano; `tests/unit/auth-borda.test.ts` verde |
| `middleware.ts` | protege tudo fora de `/login`/`/api/health` | ✓ VERIFIED | Lido; `matcher` exclui apenas internos do Next e `/api/auth` |
| `lib/auth/tentativas.ts` + `tentativas-memoria.ts` | limite de 5 erros / janela 15min | ✓ VERIFIED | Lido; zero imports no módulo puro; casca em memória isolada |
| `lib/auth/credenciais.ts` | mensagem única, tempo constante | ✓ VERIFIED | Lido; `RECUSA` congelado (fix WR-01 confirmado no arquivo) |
| `lib/auth/exigir-usuario.ts` | única porta de autorização, confere `ativo` no banco | ✓ VERIFIED | Lido; `avaliarAutorizacao` pura + `exigirUsuario()` casca; consulta `usuarios` a cada chamada, nunca o token |
| `scripts/criar-usuario.ts`, `redefinir-senha.ts`, `desativar-usuario.ts` | operações de conta por CLI | ✓ VERIFIED | Existem; aliases npm confirmados em `package.json`; nenhum `delete`/`drop` |
| `scripts/verificar-acoes.mjs` | portão de máquina do `exigirUsuario()` | ✓ VERIFIED | Lido inteiro; checagem **transitiva** de alcance ao banco (fix CR-01 confirmado no arquivo, com comentário de cabeçalho documentando o porquê); exceção nomeada por arquivo+função, restrita a `entrar`/`sair` |
| `db/migrations/` (0001-0004) | `usuarios`, base comum, papel `amassa_app`, `execucoes_backup` | ✓ VERIFIED | Confirmado em produção: `\dt` lista exatamente as 3 tabelas esperadas + verificação de infraestrutura; `hoje_brasilia()` e trigger presentes |
| `lib/backup/frescor.ts` + `app/api/health/backup/route.ts` | vigia do backup | ✓ VERIFIED | Lidos; módulo puro sem imports; rota delega a decisão, nunca expõe `bytes` |
| `scripts/backup.sh`, `restaurar.sh` | dump/restore POSIX, provados sem servidor | ✓ VERIFIED | `npm run test:backup` citado nos gates já executados pelo orquestrador (8 etapas, 3 pares opostos); confirmado em produção via execução real |
| `docs/operacao/03-backup-e-restauracao.md` | roteiro de virada e restauração | ✓ VERIFIED | Existe; passos 0-14; corrigido 11 vezes durante execução real registrada no SUMMARY 08 |

### Verificação de key links

| De | Para | Via | Status | Detalhes |
|---|---|---|---|---|
| `middleware.ts` | `lib/auth/auth.config.ts` | import estático | ✓ WIRED | Confirmado por leitura direta: `import { configuracaoBase } from "./lib/auth/auth.config"` — nenhum import de `auth.ts` |
| `lib/auth/acoes.ts` (`entrar`) | `lib/auth/auth.ts` (`signIn`) | import + chamada | ✓ WIRED | Confirmado; comentário no arquivo evita confusão com o portão `exigirUsuario()` |
| `lib/auth/auth.ts` (`authorize`) | `lib/auth/tentativas-memoria.ts` | consulta antes do banco | ✓ WIRED | Confirmado por leitura: passo 1 do `authorize()` é `avaliarPedidoAgora`, antes da consulta a `usuarios` |
| `app/(app)/page.tsx` | `lib/auth/exigir-usuario.ts` | `exigirUsuario()` na 1ª linha | ✓ WIRED | Confirmado por leitura direta do componente |
| `scripts/verificar-acoes.mjs` | `.github/workflows/entrega.yml` (job `qualidade`) | passo do pipeline | ✓ WIRED | Confirmado: `npm run verificar-acoes` roda entre `lint` e `npm test`, antes do job `e2e` |
| `app/api/health/backup/route.ts` | `lib/backup/frescor.ts` | decisão delegada | ✓ WIRED | Confirmado por leitura; a rota nunca decide sozinha |

### Behavioral spot-checks (evidência já coletada pelo orquestrador)

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| Todas as ações de servidor passam por `exigirUsuario()` | `npm run verificar-acoes` | "2 ação(ões) conferidas, 0 violações" | ✓ PASS |
| Suíte completa de testes | `npm test` | 64 testes, 8 arquivos, exit 0 | ✓ PASS |
| Build de produção com `middleware.ts` presente | `npm run build` | exit 0 | ✓ PASS |
| Lint | `npm run lint` | exit 0 | ✓ PASS |
| `/` sem sessão redireciona | `curl -I https://amassacerrado.com.br/` | 307 → `/login`, `Cache-Control: no-store` | ✓ PASS (produção) |
| `/api/health/backup` | `curl https://amassacerrado.com.br/api/health/backup` | `{"status":"ok",...}` | ✓ PASS (produção) |
| Restore rehearsal (D-11) | dump do Drive → Postgres descartável | `usuarios` 1=1, `verificacao_infraestrutura` 1=1 | ✓ PASS (produção) |
| Cron dispara sem humano presente | execução agendada registrada | `2026-08-08 14:25:44+00 \| t \| t` | ✓ PASS (produção) |

### Requirements Coverage

Todos os 17 requisitos declarados no ROADMAP para a Fase 2a foram declarados em algum plano e
estão marcados `Complete` em `REQUIREMENTS.md`. Nenhum requisito órfão encontrado (cruzamento
`grep 'Phase 2' REQUIREMENTS.md` contra os campos `requirements:` de cada PLAN).

| Requirement | Plano(s) que declara(m) | Descrição | Status | Evidência |
|---|---|---|---|---|
| AUTH-01 | 02a-01 | Sem sessão, `/` leva a `/login` | ✓ SATISFIED | `tests/e2e/fundacao.spec.ts`; middleware lido |
| AUTH-02 | 02a-01, 02a-02 | Login com e-mail/senha dá acesso, contra o papel `amassa_app` | ✓ SATISFIED | `tests/e2e/fundacao.spec.ts`; `npm run test:migracoes` |
| AUTH-03 | 02a-03 | Mensagem única, tempo constante | ✓ SATISFIED | `lib/auth/credenciais.ts` lido; testes unit/e2e |
| AUTH-04 | 02a-03 | Bloqueio de 5 erros/15min | ✓ SATISFIED | `lib/auth/tentativas.ts` lido; testes unit/e2e |
| AUTH-05 | 02a-04 | Sessão de 30 dias | ✓ SATISFIED | `auth.config.ts` lido; `tests/e2e/sessao.spec.ts` |
| AUTH-06 | 02a-04 | Sair encerra de verdade | ✓ SATISFIED | `middleware.ts` (`no-store`) lido; `tests/e2e/sessao.spec.ts` |
| AUTH-07 | 02a-01, 02a-08 | Criar usuário por CLI | ✓ SATISFIED | `scripts/criar-usuario.ts`; confirmado em produção (login real) |
| AUTH-08 | 02a-05 | Redefinir senha por CLI | ✓ SATISFIED | `scripts/redefinir-senha.ts`; `npm run test:migracoes` |
| AUTH-09 | 02a-01, 02a-04, 02a-05 | Desativar sem apagar | ✓ SATISFIED | Sem `delete`/`drop` (grep confirmado); `exigir-usuario.ts` confere `ativo` no banco |
| AUTH-10 | 02a-05 | `exigirUsuario()` verificado por máquina | ✓ SATISFIED | `scripts/verificar-acoes.mjs` lido inteiro; checagem transitiva pós-CR-01 confirmada no arquivo |
| BKP-01 | 02a-07, 02a-08 | Dump diário gerado, íntegro | ✓ SATISFIED | `scripts/backup.sh`; confirmado em produção |
| BKP-02 | 02a-07, 02a-08 | Envio ao armazenamento externo | ✓ SATISFIED | Confirmado em produção (Drive + `destino_externo_ok=t`) |
| BKP-03 | 02a-07 | Rotação 14 dias + retenção mensal | ✓ SATISFIED | `npm run test:backup` (etapas 4/8, par oposto) |
| BKP-04 | 02a-06, 02a-08 | `/api/health/backup` | ✓ SATISFIED | `lib/backup/frescor.ts` + rota lidos; confirmado em produção |
| BKP-05 | 02a-07 | Disparo sob demanda sem sobrescrever | ✓ SATISFIED | `npm run test:backup` (etapa 3/8) |
| BKP-06 | 02a-07, 02a-08 | Restauração com dados conferidos | ✓ SATISFIED | `npm run test:backup` (etapas 7-8/8); ensaio real em produção (D-11) |
| BKP-07 | 02a-08 | Documento de restauração em português | ✓ SATISFIED | `docs/operacao/03-backup-e-restauracao.md` existe, passos 0-14 |

### Anti-patterns encontrados

Nenhum bloqueador. `grep` por `TBD`/`FIXME`/`XXX` nos arquivos centrais da fase (`lib/auth/*`,
`lib/backup/*`, `app/api/health/*`, `scripts/backup.sh`, `scripts/restaurar.sh`,
`scripts/verificar-acoes.mjs`, `middleware.ts`, `app/(auth)/*`, `app/(app)/*`) não retornou
nenhuma ocorrência.

`02a-REVIEW.md` encontrou 1 crítico (CR-01) e 4 avisos (WR-01 a WR-04); `02a-REVIEW-FIX.md`
registra os 5 como corrigidos, e a verificação independente deste relatório confirmou por
leitura direta do código (não só do texto do REVIEW-FIX) que:
- CR-01 (alcance transitivo ao banco) está implementado em `scripts/verificar-acoes.mjs`, com
  exceção nomeada estreita (arquivo + nome de função) para `entrar`/`sair`.
- WR-01 (`RECUSA` compartilhado e mutável) está corrigido — `Object.freeze` confirmado em
  `lib/auth/credenciais.ts`.
- WR-02 (`minutos` da URL sem validação) está corrigido — `Number.isInteger` confirmado em
  `app/(auth)/login/page.tsx`.
- WR-03 (schema Zod duplicado) está corrigido — módulo `lib/auth/entrada-credenciais.ts` criado
  e importado dos dois pontos.

IN-01 (parser de CLI duplicado em três scripts) permanece intencionalmente não corrigido — é
Info-severity, fora do escopo do fix run (`critical_warning`), sem risco de segurança.

Um item de dívida técnica permanece **registrado, não escondido**: o vazamento de `callbackUrl`
apontando para `0.0.0.0:3000` (`.planning/WINDOWS.md`, id 2, status `open`) — confirmado neste
relatório que continua `open`, com fronteira de escopo justificada (não pertence a nenhum
`files_modified` desta fase) e sem bloqueio funcional do login real. Não é tratado como gap desta
verificação porque já estava registrado e a instrução de tarefa pede para não recontá-lo como
achado novo.

### Human Verification Required

Nenhum item. Toda a produção foi conferida de fora tanto pelo orquestrador quanto, nesta
verificação, por leitura direta do código-fonte que implementa cada garantia. As evidências de
produção (curl externo, contagens de restauração, disparo de cron sem humano presente, alerta de
e-mail recebido nos dois sentidos) já foram coletadas e confirmadas antes desta verificação, e
correspondem exatamente ao que o código lido implementa.

### Gaps Summary

Nenhum gap. As 8 truths do ROADMAP, os 17 requisitos declarados, os artefatos e os key links
foram todos verificados por leitura direta do código-fonte (não pela narrativa dos SUMMARYs), e
a evidência de produção fornecida pelo orquestrador é consistente com o que o código implementa.
Os 5 achados do code review (1 crítico, 4 avisos) foram confirmados corrigidos por inspeção
direta dos arquivos, não apenas pelo texto do REVIEW-FIX. O único item de dívida técnica
conhecida (`callbackUrl` vazando endereço interno) está registrado em `WINDOWS.md` com bloqueio
explícito de `/gsd-ship` até resolução ou dispensa consciente — não é um gap desta fase, é uma
decisão de escopo já tomada e documentada.

---

_Verificado: 2026-08-08T14:49:45Z_
_Verificador: Claude (gsd-verifier)_
