# Itens fora do escopo — 04.6-03

Achados durante a execução do plano 03, fora do escopo das tarefas deste plano (SCOPE
BOUNDARY): não fixados aqui, só registrados.

## `next build` acusa "Dynamic filesystem access" em `lib/orcamentos/pdf/logo.ts` e `lib/orcamentos/caminho-fotos.ts`

Aparece em toda invocação de `next build` (inclusive `npm run test:site-sem-banco` e
`npm run test:e2e` deste plano) — pré-existente, não introduzido por nada deste plano. O aviso
é do Next.js/Turbopack: `fs.readFile(caminhoDaLogo())`/`path.join(diretorioDeFotos(), arquivo)`
usam um caminho montado em tempo de execução, o que faz o rastreamento estático incluir o
projeto inteiro no output de produção (mais lento de implantar, sem quebrar nada hoje). Fora do
grupo de arquivos deste plano (`conteudo/`, `lib/site/`, `app/page.tsx`, `components/site/`,
`scripts/testar-site-sem-banco.mjs`) — não fixado aqui.
