---
phase: 01-funda-o-e-primeiro-deploy
plan: 02
subsystem: infra
tags: [git, github, secrets, readme, secret-scanning, push-protection]

requires:
  - phase: 01-funda-o-e-primeiro-deploy (plano 01-01/01-03)
    provides: projeto Next.js, docker/, .gitignore, .env.example criados antes do primeiro push
provides:
  - repositório público github.com/adcaponte/amassa com branch padrão main
  - remote origin configurado e histórico completo empurrado
  - README.md documentando produção, variáveis de ambiente e nomes de secrets do pipeline
affects: ["01-05 (GitHub Actions)", "01-06/01-07 (preparo do VPS e secrets)"]

actuals:
  tokens: 1200
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns: ["repositório público com higiene de segredos auditada antes de cada push"]

key-files:
  created: []
  modified: [README.md]

key-decisions:
  - "Repositório já existia (criado pelo dono via GitHub UI, público, secret scanning e push protection habilitados) — a Task 2 do plano, escrita para o gh CLI, foi adaptada para usar git puro: git remote add + git push, sem gh e sem tocar em configurações de segurança já ligadas"
  - "Proteção de branch (bloquear force-push e exclusão da main) não foi configurada — exige a API do GitHub e não há gh CLI nem credenciais disponíveis nesta execução; documentada abaixo como ação pendente do dono"

patterns-established:
  - "Auditoria de segredos (git log --all --full-history -- .env/.env.local, varredura de token/chave privada, PASSWORD/SECRET com valor) roda manualmente antes de qualquer push para o remoto público"

requirements-completed: [INFRA-08]

coverage:
  - id: D1
    description: "Histórico local auditado sem nenhum segredo antes do primeiro push (.env/.env.local nunca commitados, nenhuma chave privada, nenhum PASSWORD/SECRET com valor em arquivo rastreado)"
    requirement: "INFRA-08"
    verification:
      - kind: manual_procedural
        ref: "git log --all --full-history -- .env / .env.local; git grep de padroes de token e chave privada"
        status: pass
    human_judgment: false
  - id: D2
    description: "Branch local renomeada de master para main"
    verification:
      - kind: manual_procedural
        ref: "git branch --show-current"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md documenta produção (amassacerrado.com.br), variáveis de ambiente por nome (via .env.example) e os nomes dos secrets do pipeline (VPS_HOST, VPS_USUARIO, VPS_SSH_CHAVE, NEXT_PUBLIC_SITE_URL, DEPLOY_ATIVO), sem nenhum valor"
    requirement: "INFRA-08"
    verification:
      - kind: manual_procedural
        ref: "grep dos 5 nomes de secret + amassacerrado.com.br em README.md"
        status: pass
    human_judgment: false
  - id: D4
    description: "Repositório público github.com/adcaponte/amassa recebeu o push completo de main com o remote origin configurado; secret scanning e push protection já estavam habilitados pelo dono antes do push"
    requirement: "INFRA-08"
    verification:
      - kind: manual_procedural
        ref: "git push -u origin main (exit 0); git ls-remote origin main"
        status: pass
    human_judgment: false
  - id: D5
    description: "Proteção da branch main contra force-push e exclusão"
    verification: []
    human_judgment: true
    rationale: "Requer chamada à API do GitHub (gh api ou REST direto); não há gh CLI instalado nem credenciais disponíveis nesta execução. Fica registrado como ação pendente do dono (ver User Setup Required)."

duration: 20min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 2: Publicação do repositório público Summary

**Push do repositório `amassa` para `github.com/adcaponte/amassa` com histórico auditado, branch renomeada para `main`, e README documentando produção e nomes de secrets do pipeline — sem gh CLI, usando apenas git puro sobre um repositório que o dono já havia criado com secret scanning e push protection ligados.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-06 (sessão de execução)
- **Completed:** 2026-08-06T17:43:04Z
- **Tasks:** 2 (adaptada: Task 2 do plano usava `gh` CLI para criar o repositório e ligar segurança; repositório já existia e segurança já estava ligada pelo dono, então a Task 2 executou apenas a parte de git puro — remote + push)
- **Files modified:** 1 (`README.md`)

## Accomplishments
- Auditoria de segredos rodada e observada pessoalmente: `git log --all --full-history -- .env` e `-- .env.local` vazios, nenhum padrão de token/chave privada em arquivo rastreado, nenhum `PASSWORD`/`SECRET` com valor atribuído fora de `.md` e `.env.example`
- Branch local renomeada de `master` para `main`
- `README.md` estendido (não recriado — já tinha conteúdo operacional do plano 01-03) com seção de produção (`amassacerrado.com.br`), seção de variáveis de ambiente apontando para `.env.example` e explicando os dois únicos lugares onde valor real vive, e seção com os 5 nomes de secret/variável que o pipeline vai esperar
- Remote `origin` configurado para `https://github.com/adcaponte/amassa.git` e `git push -u origin main` executado com sucesso — repositório público agora contém todo o histórico local, incluindo `amassa-plataforma/` (D-08)

## Task Commits

1. **Task 1: Conferir a higiene de segredos e escrever o README antes de existir remoto** - `cc2b2df` (docs)
2. **Task 2: Publicar no GitHub** - sem commit de arquivo versionado; produziu apenas `git remote add origin` (config local) e `git push -u origin main`. Repositório e configurações de segurança já existiam, criados pelo dono fora desta execução.

**Plan metadata:** commit final de docs pendente (ver rodapé)

## Files Created/Modified
- `README.md` - adicionadas as seções "Produção", "Variáveis de ambiente" e "Secrets e variáveis do pipeline"

## Decisions Made
- A Task 2 do plano foi escrita assumindo `gh` CLI disponível e o repositório inexistente (`gh repo create`, `gh api --method PATCH ... security_and_analysis`, proteção de branch via `gh api`). O contexto real desta execução informou que: o repositório já existia (criado pelo dono via UI do GitHub), já era público com branch padrão `main`, e secret scanning + push protection já estavam habilitados. Sem `gh` CLI instalado e sem credenciais para chamar a API REST diretamente, a Task 2 foi reduzida à parte que só depende de `git` puro: `git remote add origin` + `git push -u origin main`. Isso cumpre o objetivo do plano (repositório público com histórico auditado e higiene de segredos ligada antes do push) sem duplicar trabalho já feito pelo dono.
- Proteção de branch (`allow_force_pushes: false`, `allow_deletions: false`) **não foi configurada** nesta execução — depende da API do GitHub, que não está acessível sem `gh` CLI ou um token. Fica documentada abaixo como ação pendente do dono.

## Deviations from Plan

### Auto-fixed Issues

Nenhum desvio pela Rule 1/2/3 — o desvio existente é de escopo de ferramenta (ver acima), não de bug ou funcionalidade faltando, e está coberto pela instrução explícita do orquestrador nesta execução (ambiente sem `gh` CLI, repositório já criado pelo dono). Documentado aqui em vez de como Rule 1-3 porque altera o *como* da Task 2, não corrige um defeito.

---

**Total deviations:** 0 auto-fixed via Rule 1-3
**Impact on plan:** Nenhum — o objetivo e os critérios de aceite centrais (INFRA-08: nenhum segredo no histórico público, repositório público, branch `main`, secret scanning e push protection habilitados antes do push) foram todos cumpridos e verificados. A única lacuna é a proteção de branch, fora do alcance desta execução por falta de credenciais de API.

## Issues Encountered
Nenhum problema de execução. O push foi aceito de primeira, sem rejeição de push protection — confirmando que nenhum segredo estava presente no histórico empurrado.

## User Setup Required

**Ação pendente do dono (`adcaponte`), fora do alcance desta execução por falta de `gh` CLI e credenciais de API:**

Configurar a proteção da branch `main` em `github.com/adcaponte/amassa` → Settings → Branches → Add branch protection rule para `main`, marcando:
- **Bloquear force-push** (`Allow force pushes` desmarcado)
- **Bloquear exclusão da branch** (`Allow deletions` desmarcado)
- **NÃO exigir pull request para merge** — o critério de aceite INFRA-02 desta fase depende de `git push` direto na `main` disparar o deploy; exigir PR quebraria esse fluxo. Os portões de qualidade ficam no pipeline (plano 01-05), não numa exigência de revisão.

Verificação depois de configurado:
```
gh api repos/adcaponte/amassa/branches/main/protection -q .allow_force_pushes.enabled   # deve ser false
gh api repos/adcaponte/amassa/branches/main/protection -q .allow_deletions.enabled       # deve ser false
gh api repos/adcaponte/amassa/branches/main/protection -q .required_pull_request_reviews # deve ser null
```

## Next Phase Readiness
- O repositório público existe, com `main` publicada, `amassa-plataforma/` versionada (D-08), e `README.md` cobrindo o que a Fase seguinte (workflow do GitHub Actions, plano 01-05) vai precisar citar por nome.
- Bloqueio: proteção de branch ainda não configurada — não impede o plano 01-05 (que só cria o workflow), mas deveria ser resolvida antes do fim da Fase 1, já que é parte do critério "repositório público com higiene completa".

---
*Phase: 01-funda-o-e-primeiro-deploy*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: README.md
- FOUND: commit cc2b2df
- FOUND: 01-02-SUMMARY.md
