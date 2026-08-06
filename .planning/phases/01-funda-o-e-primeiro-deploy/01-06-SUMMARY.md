---
phase: 01-funda-o-e-primeiro-deploy
plan: 06
subsystem: infra
tags: [runbook, vps, ssh, dns, https, uptimerobot, contabo, documentation]

requires:
  - phase: 01-funda-o-e-primeiro-deploy (01-01, 01-02, 01-03, 01-05)
    provides: Next.js standalone com /api/health real, docker/compose.yml e docker/Caddyfile
      de produção, .env.example com os nomes de variável, .github/workflows/entrega.yml com
      os quatro jobs e os nomes exatos de secret/variável (VPS_HOST, VPS_USUARIO,
      VPS_SSH_CHAVE, NEXT_PUBLIC_SITE_URL, DEPLOY_ATIVO)
provides:
  - "docs/operacao/01-preparar-servidor.md — roteiro comentado de 11 passos: primeiro e
    único acesso como root, segunda sessão confirmada antes de desligar senha/root,
    unattended-upgrades, UFW (só 22/80/443), fail2ban, Docker Engine + plugin do Compose,
    /opt/amassa com .env gerado no servidor (permissão 600), chave de deploy dedicada e
    cadastro dos secrets no GitHub, pacote GHCR tornado público, Auto Backup da Contabo"
  - "docs/operacao/02-publicar-e-dominio.md — roteiro comentado de 9 passos: DNS do apex e
    do www com confirmação por dig, a única subida completa da pilha, migração à mão pelo
    ferramentas com linha de prova, HTTPS e redirecionamento do www, /api/health, porta 5432
    fechada conferida de fora, reinício do VPS com dados intactos, publicação nomeando app
    sem recriar o Postgres, monitor UptimeRobot; fecha com os dez critérios de aceite da
    fase em caixas de conferência"
  - "README.md apontando para os dois roteiros de docs/operacao/"
affects: [01-07 (o dono executa os dois roteiros, ponta a ponta, e o ciclo completo de
  publicação é provado no domínio público)]

actuals:
  tokens: 6400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Roteiro comentado (não script): cada bloco de comando é seguido por 'O que faz' e
      'O que você deve ver', para que uma falha seja localizável no passo em que aconteceu"
    - "Convenção de nomes não secretos fixada no roteiro (usuário theo, POSTGRES_USER
      amassa_owner, banco amassa) para que o Roteiro 2 possa referenciar esses nomes sem
      reintroduzir nenhum valor real de senha, chave ou IP"
    - "Segredos gerados no servidor com openssl, na hora, nunca digitados nem colados de
      fora — o roteiro instrui a guardar em gerenciador de senhas e nunca recuperar, só
      regenerar"

key-files:
  created:
    - docs/operacao/01-preparar-servidor.md
    - docs/operacao/02-publicar-e-dominio.md
  modified:
    - README.md

key-decisions:
  - "POSTGRES_USER=amassa_owner e POSTGRES_DB=amassa fixados como convenção nos dois
    roteiros (não são segredo, seguem o exemplo de 01-ARQUITETURA.md §6), permitindo que o
    Roteiro 2 rode `psql -U amassa_owner -d amassa` sem precisar reintroduzir um valor
    variável ou um placeholder a cada passo"
  - "Uma linha de prova é gravada na tabela verificacao_infraestrutura durante a migração
    (Roteiro 2, passo 3) especificamente para ser reconferida depois do reinício do VPS
    (passo 7) — sem isso, o critério INFRA-05 ('dados intactos') não teria um dado concreto
    para apontar"
  - "Verificação da porta 5432 (INFRA-04) e a de PermitRootLogin/PasswordAuthentication
    seguem a exigência do <verify> mais rígida do plano: nmap/telnet rodados da máquina do
    Theo, nunca de dentro do servidor — dentro do servidor o teste não prova nada"
  - "Nenhum IP, senha, chave privada ou token aparece em nenhum dos dois documentos —
    confirmado por gate automatizado (grep de padrão de IP e de cabeçalho de chave privada,
    devolvendo 0 nos dois arquivos), não só por revisão visual"

patterns-established:
  - "Todo roteiro de operação futuro (Fase 2 em diante: restauração de backup, criação de
    usuário) segue o mesmo contrato: comando, 'O que faz', 'O que você deve ver',
    marcadores em vez de valor real"

requirements-completed: [INFRA-01, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-10]

coverage:
  - id: D1
    description: "docs/operacao/01-preparar-servidor.md existe, com 11 passos numerados,
      cada bloco de comando seguido de uma linha 'O que você deve ver', cobrindo
      endurecimento do VPS (usuário sudo, chave SSH, PermitRootLogin/PasswordAuthentication,
      UFW, fail2ban, unattended-upgrades), Docker, /opt/amassa/.env em modo 600, chave de
      deploy e Auto Backup da Contabo"
    requirement: "INFRA-10"
    verification:
      - kind: other
        ref: "grep -c 'você deve ver' = 28 (gate exige >= 10); grep -q 'ufw status',
          'VPS_SSH_CHAVE' e 'Auto Backup' todos presentes; grep -cE
          'BEGIN (RSA |OPENSSH )?PRIVATE KEY|[0-9]{1,3}(\\.[0-9]{1,3}){3}' = 0; grep -c
          'chmod 600' = 2, aplicado a /opt/amassa/.env; grep -c 'PermitRootLogin' e
          'PasswordAuthentication' = 1 cada; grep -c 'uma única vez' = 1, no contexto da
          senha de root; npm run lint saiu com código 0 depois da mudança"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/operacao/02-publicar-e-dominio.md existe, com 9 passos numerados,
      cobrindo DNS, a única subida completa da pilha, migração à mão com linha de prova,
      HTTPS, /api/health, porta 5432 fechada, reinício do VPS, publicação sem recriar o
      Postgres e monitor UptimeRobot, terminando com as dez caixas de conferência copiadas
      do ROADMAP.md"
    requirement: "INFRA-01"
    verification:
      - kind: other
        ref: "grep -c 'amassacerrado.com.br/api/health' = 4; grep -c 'UptimeRobot' = 2 (com
          '5 minutos' e 'e-mail' no texto); grep -c 'compose up -d' = 3, 'compose up -d app'
          = 1, 'ferramentas npm run db:migrate' = 1; grep -cE '\\bnmap\\b|\\btelnet\\b' = 4;
          grep -c 'www.amassacerrado.com.br' = 3; grep -c '^- \\[ \\]' = 10 exatos; grep -cE
          '[0-9]{1,3}(\\.[0-9]{1,3}){3}' = 0; grep -c 'você deve ver' = 19 (gate exige >= 8)"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md aponta para os dois roteiros de docs/operacao/"
    verification:
      - kind: other
        ref: "grep -c 'docs/operacao' README.md = 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "Os passos de servidor descritos nos dois roteiros de fato funcionam
      quando executados num VPS real (endurecimento, DNS, HTTPS, migração, reinício,
      publicação sem recriar o Postgres, monitor externo)"
    verification: []
    human_judgment: true
    rationale: "Este plano é documentação apenas — por decisão do dono (D-02/D-03), o
      agente não entra por SSH em servidor nenhum, não altera DNS e não cria secrets no
      GitHub. Cada nome de serviço, arquivo, variável e script citado foi conferido contra
      o repositório real (docker/compose.yml, docker/Caddyfile, .env.example,
      .github/workflows/entrega.yml, db/schema.ts, lib/saude.ts, package.json), mas a
      execução de ponta a ponta num servidor real é o plano 01-07, do dono."

duration: ~35min
completed: 2026-08-06
status: complete
---

# Phase 1 Plan 6: Roteiros de Servidor Summary

**Dois roteiros comentados em português (`docs/operacao/01-preparar-servidor.md` e
`docs/operacao/02-publicar-e-dominio.md`) que levam o VPS Contabo de "recém-entregue" a "site
no ar em `https://amassacerrado.com.br`, com HTTPS, banco migrado e monitor externo ativo" —
cada comando com o que faz e o que se deve ver de volta, sem nenhum valor real de senha, chave
ou IP em nenhum dos dois documentos.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2
- **Files modified:** 3 (2 criados, 1 modificado)

## Accomplishments

- `docs/operacao/01-preparar-servidor.md`: 11 passos numerados, do primeiro e único acesso
  como root (com a senha da Contabo usada uma única vez, em destaque) até o pacote GHCR
  tornado público e o Auto Backup da Contabo habilitado — passando por segunda sessão
  confirmada antes de desligar `PasswordAuthentication`, UFW restrito a 22/80/443,
  `fail2ban`, `unattended-upgrades`, Docker Engine pelo repositório oficial, `/opt/amassa`
  com `.env` gerado no próprio servidor (senhas via `openssl`, permissão `600`) e uma chave
  SSH dedicada ao deploy, com os nomes exatos de secret que `.github/workflows/entrega.yml`
  espera (`VPS_HOST`, `VPS_USUARIO`, `VPS_SSH_CHAVE`) e a variável `DEPLOY_ATIVO`
- `docs/operacao/02-publicar-e-dominio.md`: 9 passos numerados, do apontamento de DNS
  (apex + `www`, confirmado com `dig` antes de seguir) até o monitor UptimeRobot — passando
  pela única subida completa da pilha (`docker compose up -d`, marcada em destaque como
  única vez), migração à mão pelo `ferramentas` com uma linha de prova gravada e reconferida
  depois do reinício do VPS, conferência de HTTPS e do redirecionamento do `www`,
  `/api/health` respondendo com consulta real ao banco, a porta 5432 fechada conferida **da
  máquina do Theo** (nunca de dentro do servidor), e a prova de que uma publicação nomeando
  `app` não recria o contêiner do Postgres. Fecha com as dez caixas de conferência dos
  critérios de aceite da fase, copiadas de `.planning/ROADMAP.md` §"Phase 1"
- `README.md` ganhou um parágrafo apontando para os dois roteiros
- Todo nome de serviço, arquivo, variável de ambiente, script npm e secret citado nos dois
  roteiros foi conferido contra o repositório real antes de escrever — nenhum nome
  inventado

## Task Commits

1. **Task 1: Roteiro 1 — endurecer o VPS, Docker e /opt/amassa** - `8cf4e11` (docs)
2. **Task 2: Roteiro 2 — DNS, primeira publicação, HTTPS e monitor externo** - `5af1fba`
   (docs) — inclui a atualização do `README.md`

## Files Created/Modified

- `docs/operacao/01-preparar-servidor.md` (novo) - 11 passos, endurecimento do VPS até a
  chave de deploy e o Auto Backup
- `docs/operacao/02-publicar-e-dominio.md` (novo) - 9 passos, DNS até o monitor externo, mais
  as dez caixas de conferência
- `README.md` - parágrafo apontando para os dois roteiros de `docs/operacao/`

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo:

- `POSTGRES_USER=amassa_owner` e `POSTGRES_DB=amassa` fixados como convenção nos dois
  roteiros (não são segredo — seguem o exemplo de `01-ARQUITETURA.md` §6), permitindo que o
  Roteiro 2 referencie esses nomes diretamente nos comandos de `psql`
- Uma linha de prova gravada na tabela `verificacao_infraestrutura` durante a migração
  (Roteiro 2) para ser reconferida depois do reinício do VPS — prova concreta de "dados
  intactos" (INFRA-05), não só "o site voltou"
- Verificação da porta 5432 (INFRA-04) explicitamente rodada da máquina do Theo, nunca de
  dentro do servidor — o próprio texto do roteiro explica por quê

## Deviations from Plan

None - plan executed exactly as written. Os dois documentos, o formato de cada passo, os
nomes de arquivo e a lista de dez critérios de aceite seguem exatamente a estrutura pedida em
`<action>` de cada task.

## Issues Encountered

None.

## User Setup Required

None nesta sessão — este plano é só documentação. O `<scope_fence>` do prompt de execução
proíbe explicitamente SSH no servidor, alteração de DNS e criação de secrets/variáveis no
GitHub: essas ações pertencem ao dono, executando os dois roteiros no plano **01-07**.

## Next Phase Readiness

- Os dois roteiros estão prontos para o plano 01-07, onde o dono os executa de ponta a
  ponta, num VPS Contabo real, e observa o pipeline completo publicar de verdade.
- **Nenhuma claim deste SUMMARY afirma que os passos de servidor "funcionam" em produção.**
  Cada nome de serviço, arquivo, variável, script e secret citado nos roteiros foi conferido
  por leitura contra o repositório real (`docker/compose.yml`, `docker/Caddyfile`,
  `.env.example`, `.github/workflows/entrega.yml`, `db/schema.ts`, `lib/saude.ts`,
  `package.json`) e os gates automatizados de conteúdo passaram — mas a execução real dos
  comandos num servidor Ubuntu (endurecimento, DNS, HTTPS, migração, reinício, publicação,
  monitor) não foi observada nesta sessão, porque esta sessão não tem acesso a nenhum VPS.
  Isso é, por decisão do dono (D-02/D-03), exatamente o trabalho do plano 01-07.
- Nenhum bloqueio conhecido para o plano 01-07 começar.

---
*Phase: 01-funda-o-e-primeiro-deploy*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: docs/operacao/01-preparar-servidor.md
- FOUND: docs/operacao/02-publicar-e-dominio.md
- FOUND: .planning/phases/01-funda-o-e-primeiro-deploy/01-06-SUMMARY.md
- FOUND: README.md
- FOUND commit: 8cf4e11
- FOUND commit: 5af1fba
