# AMASSA — Plataforma de Gestão do Ateliê

Plataforma web interna, privada e responsiva, para os gestores do **AMASSA** — ateliê de
cerâmica artesanal de alta temperatura em Goiânia — administrarem a operação do dia a dia em
um único lugar. Cinco módulos: Encomendas, Agenda de Aulas, Contador de Queima, Estoque e
Calculadora de Orçamento.

Este não é o site institucional (`amassaceramica.com.br`) nem a loja Shopify — os dois
continuam existindo separadamente e estão fora do escopo deste repositório.

A documentação completa de arquitetura, modelo de dados, roadmap e design system vive em
[`amassa-plataforma/`](./amassa-plataforma). Este README cobre só o que é preciso para rodar
e operar o sistema no dia a dia.

## Stack

Next.js 15+ (App Router, TypeScript estrito), React 19, Tailwind CSS v4, PostgreSQL em
Docker, Drizzle ORM, Vitest. Ver `amassa-plataforma/01-ARQUITETURA.md` §2 para a lista
completa e a razão de cada escolha.

## Desenvolvimento local

```bash
cp .env.example .env.local   # preencher com valores de desenvolvimento
docker compose -f docker/compose.yml -f docker/compose.dev.yml up -d postgres
npm install
npm run db:migrate
npm run dev
```

`docker/compose.dev.yml` é uma sobreposição só de desenvolvimento — publica o Postgres em
`127.0.0.1:5433` e sabe construir as imagens `app`/`ferramentas` localmente a partir do
`docker/Dockerfile`. Ela nunca vai para o servidor.

### Portões de qualidade

```bash
npm run lint    # ESLint, --max-warnings=0
npm test        # Vitest
npm run build   # next build
```

## Operação em produção

A topologia de produção (`docker/compose.yml`) tem quatro serviços: `postgres`, `app`,
`caddy` e `ferramentas`. `ferramentas` fica sob um profile e nunca sobe sozinho — é invocado
sob demanda com `docker compose run --rm`. Ver a caixa "Por que existe um serviço
`ferramentas`" em `amassa-plataforma/01-ARQUITETURA.md` §4: a imagem `app` usa a saída
`standalone` do Next.js e não carrega `drizzle-kit`, `tsx` nem os scripts do
`package.json` — só a imagem `ferramentas` consegue migrar o banco ou (a partir da Fase 2)
criar e redefinir usuário.

### Aplicar migração

**Migração é aplicada à mão, depois de um backup, por alguém que está olhando o resultado —
nunca pelo pipeline automático.**

```bash
docker compose run --rm ferramentas npm run db:migrate
```

Esperado: a saída termina com `Migrações aplicadas com sucesso.` e sai com código `0`. É
seguro rodar mais de uma vez — o Drizzle pula o que já foi aplicado.

Rodar o mesmo comando contra o serviço `app` (`docker compose exec app npm run db:migrate`)
falha — não é um defeito, é o motivo de o estágio `ferramentas` existir.

### Publicar uma nova versão

```bash
docker compose pull app
docker compose up -d app
```

**Sempre nomeando o serviço `app`.** Rodar `docker compose up -d` sem nomear o serviço
recria todos os contêineres declarados, inclusive o `postgres` — e por isso o comando de
publicação, tanto no pipeline quanto no roteiro do servidor, nomeia sempre `app`.

### Reiniciar a máquina

```bash
docker compose restart
```

`postgres`, `app` e `caddy` têm `restart: unless-stopped` — voltam sozinhos, com os dados
intactos, sem intervenção manual.

## Estrutura do repositório

```
app/            rotas e páginas do Next.js (App Router)
db/             schema, migrações e conexão com o Postgres (Drizzle)
docker/         Dockerfile, compose.yml, compose.dev.yml, Caddyfile
lib/            regras de negócio puras e testadas
scripts/        comandos de linha de comando invocados via ferramentas (Fase 2 em diante)
tests/          testes unitários e (a partir da Fase 2) E2E
amassa-plataforma/  documentação de arquitetura, modelo de dados e roadmap
```
