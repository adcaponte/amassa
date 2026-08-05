# Phase 1: Fundação e Primeiro Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 1-Fundação e Primeiro Deploy
**Areas discussed:** Pré-requisitos e acesso, Escolhas de infra em aberto, Banco de testes do E2E, O que a M0 mostra na tela

---

## Pré-requisitos e acesso

| Option | Description | Selected |
|--------|-------------|----------|
| Domínio registrado | Já comprado e com painel de DNS acessível | ✓ |
| VPS Contabo criado | Servidor provisionado, com IP e a senha de root que a Contabo mandou por e-mail | ✓ |
| Conta GitHub | Conta criada e pronta para receber o repositório público | ✓ |
| Nenhum ainda | Nada foi contratado | |

**User's choice:** Domínio, VPS e GitHub já existem. O armazenamento externo de backup não foi mencionado como existente.
**Notes:** O armazenamento externo só é usado na Fase 2 (backup), então não bloqueia a Fase 1.

### Sequenciamento

| Option | Description | Selected |
|--------|-------------|----------|
| Local primeiro, servidor depois | Executa o que roda na máquina e para num checkpoint antes dos passos que exigem VPS e DNS | ✓ |
| Só planejar, não executar | Gera o plano e espera tudo estar contratado | |
| Tudo pronto, pode ir até produção | Executa de ponta a ponta até o site no ar | |

**User's choice:** Local primeiro, servidor depois.
**Notes:** Mesmo com VPS e domínio existindo, o Theo prefere um checkpoint explícito antes dos passos de servidor.

---

## Escolhas de infra em aberto

### Armazenamento externo do backup

| Option | Description | Selected |
|--------|-------------|----------|
| Google Drive | 15 GB grátis, rclone fala nativamente, menos trabalho de configurar, fácil de conferir pelo celular | ✓ |
| Cloudflare R2 | 10 GB grátis, sem taxa de saída, a mais limpa tecnicamente | |
| Backblaze B2 | 10 GB grátis, simples e confiável | |

**User's choice:** Google Drive.
**Notes:** A implementação pertence à Fase 2. A decisão foi registrada aqui para não ser reaberta depois.

### Acesso ao GHCR no VPS

| Option | Description | Selected |
|--------|-------------|----------|
| Package público | Zero configuração no VPS, nada para expirar. A imagem não carrega segredo — eles ficam no `.env` em runtime | ✓ |
| docker login com PAT | Package privado, token de escopo `read:packages` no servidor | |

**User's choice:** Package público.
**Notes:** Remove o modo de falha "primeiro deploy trava sem mensagem óbvia" descrito em `01-ARQUITETURA.md` §6.

### Monitor externo

| Option | Description | Selected |
|--------|-------------|----------|
| UptimeRobot | Nível gratuito, checagem a cada 5 min, alerta por e-mail. É o citado no documento 01 | ✓ |
| Deixar para a Fase 2 | Configurar de uma vez só quando o `/api/health/backup` existir | |
| Outro serviço | BetterStack, Healthchecks.io, etc. | |

**User's choice:** UptimeRobot, já nesta fase, apontando para `/api/health`.

---

## Banco de testes do E2E

| Option | Description | Selected |
|--------|-------------|----------|
| Serviço separado no compose | Container `postgres-teste` com volume efêmero. Separação física, não convenção de nome | ✓ |
| Segundo banco na mesma instância | Database `amassa_teste` no mesmo Postgres. Economiza memória, mas um erro de config aponta o teste para produção | |

**User's choice:** Serviço separado.
**Notes:** A separação física é o que garante que um teste destrutivo não alcance o banco real.

### Onde o E2E roda

| Option | Description | Selected |
|--------|-------------|----------|
| Só no GitHub Actions | Postgres de teste como service container do runner. VPS sem peso extra | ✓ |
| No Actions e também no VPS | Serviço de teste também no compose do servidor | |
| Também na máquina local | Compose local com banco de teste, para rodar E2E antes do push | |

**User's choice:** Só no GitHub Actions.

---

## O que a M0 mostra na tela

| Option | Description | Selected |
|--------|-------------|----------|
| Página mínima com a marca | Fundo `#F6F3F0`, nome AMASSA e uma linha dizendo que está no ar. Prova o deploy e dá o que alterar no teste de push | ✓ |
| Página em branco literal | Default do Next.js, fiel ao "você termina com a sensação de não ter feito nada" do guia | |
| Já com o design system aplicado | Antecipa tokens e mapeamento shadcn da Fase 2 | |

**User's choice:** Página mínima com a marca.
**Notes:** Escolha resolve um problema concreto — o critério INFRA-02 exige "alterar um texto e dar push", e uma página em branco não tem texto para alterar.

---

## Domínio, repositório e entrega dos passos de servidor

| Pergunta | Resposta |
|----------|----------|
| Domínio | `amassacerrado.com.br` — dedicado à plataforma, separado do `amassaceramica.com.br` do site público |
| Nome do repositório | `amassa` |
| Passos de servidor | Roteiro comentado para o Theo rodar (recusadas: script único opaco, execução por SSH feita pelo agente) |

**Notes:** O agente registrou a decisão de servir no apex com redirecionamento de `www.`, por ser o
padrão convencional para um domínio dedicado e barato de mudar depois. Não foi perguntado
explicitamente — está marcado como reversível no CONTEXT.md (D-05).

---

## Claude's Discretion

- Estrutura interna do Dockerfile e ordem das camadas
- Nomes dos jobs e steps do workflow do GitHub Actions
- Forma exata do `healthcheck` do compose e do endpoint `/api/health`
- Organização dos arquivos em `docker/` e `scripts/`
- Quais testes mínimos existem nesta fase para provar que o pipeline barra build quebrado

## Deferred Ideas

- Implementação do backup no Google Drive via rclone — Fase 2
- `/api/health/backup` no painel do UptimeRobot — Fase 2
- Serviço de teste no `compose.yml` do servidor — descartado, reabrir só se necessário
- Tokens de cor e mapeamento `@theme inline` do shadcn — Fase 2, antes de instalar componentes
- Dump de hora em hora no lugar do diário — melhoria futura de custo zero
- Rolling update no deploy — não existe; alguns segundos fora do ar são aceitos conscientemente
