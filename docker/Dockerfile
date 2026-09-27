# syntax=docker/dockerfile:1
#
# Quatro estágios sobre a mesma imagem base (Node 24 LTS alpine, versão fixada — a mesma
# do ambiente de desenvolvimento). Dois produtos saem daqui:
#
#   `app`         — a saída `standalone` do Next.js. Serve o site. Não tem `devDependencies`,
#                   não tem `drizzle-kit`, não tem `tsx`, não tem os scripts do `package.json`.
#   `ferramentas` — dependências completas + `db/`. Nunca fica rodando; é invocado sob
#                   demanda com `docker compose run --rm ferramentas ...` para migrar o
#                   banco e (a partir da Fase 2) criar/redefinir usuário.
#
# Ver amassa-plataforma/01-ARQUITETURA.md §4 — por que o estágio `ferramentas` existe.

FROM node:24.19.0-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------------------
FROM dependencias AS construtor
WORKDIR /app
COPY . .

# NEXT_PUBLIC_SITE_URL é embutida no JavaScript durante o `next build`, não lida em tempo
# de execução — por isso entra como ARG de build, não como variável de runtime do compose.
# DATABASE_URL e AUTH_SECRET são segredos de verdade: NUNCA entram aqui como ARG, só
# existem em tempo de execução no serviço `app` (ver docker/compose.yml).
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN npm run build

# ---------------------------------------------------------------------------------------
# Estágio `app` — parte da imagem base limpa, não de `dependencias`. Só a saída
# `standalone` entra aqui: sem devDependencies, sem drizzle-kit, sem tsx, sem scripts do
# package.json. É intencionalmente mínima.
FROM node:24.19.0-alpine AS app
WORKDIR /app
ENV NODE_ENV=production
# Sem acesso à internet e sem devDependencies, `npx <pacote-nao-instalado>` deve falhar
# aqui, não tentar baixar o pacote do registro — a imagem de produção nunca instala nada
# em tempo de execução. É essa a diferença que prova a existência do estágio `ferramentas`.
ENV NPM_CONFIG_OFFLINE=true

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=construtor --chown=nextjs:nodejs /app/public ./public
COPY --from=construtor --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=construtor --chown=nextjs:nodejs /app/.next/static ./.next/static

# Fontes do PDF do orçamento (Fase 04.5, D-32) — lidas em tempo de EXECUÇÃO
# (`path.join(process.cwd(), "assets", ...)`, lib/orcamentos/pdf/fontes.ts), não por
# `import`/`require` estático: o rastreador de arquivos do `next build` (o mesmo mecanismo do
# Pitfall 3 do binário do sharp, 04.5-RESEARCH.md) NÃO enxerga essa leitura e NÃO copia
# `assets/` para `.next/standalone` sozinho. Sem esta linha, o primeiro PDF gerado em produção
# falharia com "arquivo não encontrado" — um defeito que não aparece em `npm run dev` (roda do
# próprio diretório do repositório, onde `assets/` sempre existe). O logo (D-09), quando a arte
# da Andressa chegar, entra no mesmo diretório e é coberto pela mesma linha.
COPY --from=construtor --chown=nextjs:nodejs /app/assets ./assets

# Diretório das fotos de orçamento (Fase 04.5, D-27/D-30), já com o dono certo. Duas razões:
# (1) sem bind mount nenhum, a imagem continua funcional — é o que faz o contêiner do e2e do CI
# escrever foto sem precisar de mudança no workflow (.github/workflows/entrega.yml não monta
# volume nenhum no `docker run` do job e2e); (2) em produção o `docker/compose.yml` cobre este
# caminho com um bind mount, e a posse passa a ser a do diretório do HOST — daí o
# `chown 100:101` do roteiro do servidor (docs/operacao/12-fotos-volume-e-backup.md).
RUN mkdir -p /dados/fotos-orcamentos && chown -R nextjs:nodejs /dados

USER nextjs
EXPOSE 3000
ENV PORT=3000
# O server.js da saída `standalone` faz listen(PORT, process.env.HOSTNAME || '0.0.0.0'), e o
# Docker define HOSTNAME dentro do contêiner (o ID dele, ou o nome da máquina quando se usa
# --network host). Sem esta linha a aplicação escuta só no endereço daquele nome, e tanto o
# healthcheck do compose (wget em localhost:3000) quanto o curl do job de E2E falham sem
# nenhum erro visível no log — o processo sobe normalmente, só não atende onde se procura.
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------------------
# Estágio `ferramentas` — parte de `dependencias` (dependências completas, inclusive
# drizzle-kit e tsx). Não define processo de longa duração; é invocado sob demanda com
# `docker compose run --rm ferramentas npm run db:migrate`.
FROM dependencias AS ferramentas
WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY db ./db
COPY scripts ./scripts
# `lib` entra porque os scripts de conta dependem dele: `criar-usuario.ts` e
# `redefinir-senha.ts` importam `gerarHash`/`gerarSenhaForte` de `../lib/auth/senha`. Sem esta
# linha a imagem sobe normalmente, `db:migrate` funciona (db/ não depende de lib/) e a falha só
# aparece na hora de criar a primeira conta no servidor, como MODULE_NOT_FOUND — longe da causa.
COPY lib ./lib
CMD ["sh"]
