# Fontes do PDF do orçamento

> **Atualização de 02/10/2026 (janela 60):** a interface deixou o `next/font/google` e passou a
> versionar as próprias fontes — `.woff2` em `app/_fontes/` (README lá), via `next/font/local`.
> A convenção "nenhum arquivo de fonte é versionado" citada abaixo **não existe mais**; o texto
> abaixo fica como registro de por que este diretório nasceu como exceção. O motivo de os `.ttf`
> do PDF serem arquivos separados dos `.woff2` da interface continua valendo: são dois mecanismos.

**Por que existe este diretório**, apesar de `app/layout.tsx` documentar (até 02/10/2026)
"nenhum arquivo de fonte é versionado, nenhuma requisição a CDN em produção": essa convenção
descrevia como a **interface** (navegador) recebia fonte — via `next/font/google`, que baixava e
cacheava o CSS/WOFF2 em tempo de build. O gerador de PDF (`@react-pdf/renderer`, `lib/orcamentos/pdf/fontes.ts`) é um
mecanismo **completamente diferente**: ele embute os BYTES de um arquivo `.ttf` real dentro do
PDF, e não existe integração com `next/font`. Sem um arquivo de fonte físico, os acentos do
português (`ç ã é õ â`) saem incorretos ou ausentes no PDF (as 14 fontes padrão do formato PDF só
cobrem ASCII básico).

Isto é uma **exceção deliberada e documentada** à convenção de `app/layout.tsx` — decidida pelo
dono em 2026-09-26 (D-32 do `04.5-CONTEXT.md`), não um esquecimento.

## De onde vieram os arquivos, e qual versão

Todos os três arquivos são as MESMAS famílias que a plataforma já usa na interface
(`app/layout.tsx` — via `next/font/google` quando isto foi escrito, `next/font/local` desde
02/10/2026: Inter para corpo, Archivo Narrow para título) — o
documento do cliente fica visualmente igual ao resto do sistema.

| Arquivo | Fonte | Versão | Baixado de |
|---|---|---|---|
| `Inter-Regular.ttf` | Inter, peso 400 | v20 (Google Fonts) | `fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf` |
| `Inter-Bold.ttf` | Inter, peso 700 | v20 (Google Fonts) | `fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf` |
| `Inter-Italic.ttf` | Inter, peso 400 itálico | v20 (Google Fonts) | `fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dtRipWA.ttf` |
| `ArchivoNarrow-Bold.ttf` | Archivo Narrow, peso 700 | v35 (Google Fonts) | `fonts.gstatic.com/s/archivonarrow/v35/tss5ApVBdCYD5Q7hcxTE1ArZ0Zz8oY2KRmwvKhhvy1a6o3mp.ttf` |

Baixados em 2026-09-27, resolvendo a URL real do arquivo TTF por trás da API do Google Fonts (a
mesma que `next/font/google` consome por baixo — o pacote `google/fonts` no GitHub, de onde
`fonts.gstatic.com` é servido, é o espelho oficial das fontes livres do Google, incluindo Inter e
Archivo Narrow sob OFL). Só os pesos/estilos que o documento usa entraram — corpo em Inter
(regular, negrito e o itálico da nota do rodapé — "Cada peça é feita à mão...", §Typography), título
em Archivo Narrow (só negrito, o único peso que a folha A4 usa para "AMASSA CERRADO"). O itálico
foi acrescentado depois do primeiro `npm run test:e2e` desta fase: sem ele,
`@react-pdf/renderer` lança "Could not resolve font for Inter, fontWeight 400, fontStyle italic"
ao tentar desenhar o rodapé — erro real, não hipotético.

## Licença

As duas famílias são distribuídas sob a **SIL Open Font License, Version 1.1**, que **permite
expressamente** o uso, estudo, modificação e redistribuição das fontes, inclusive embutidas em
documentos e em repositórios públicos, e inclusive em contexto comercial — a única restrição
relevante é não vender a fonte SOZINHA, separada de um trabalho maior, o que não é o caso aqui.

- `OFL-Inter.txt` — copyright 2020 The Inter Project Authors (`github.com/rsms/inter`).
- `OFL-ArchivoNarrow.txt` — copyright 2019 The Archivo Narrow Project Authors
  (`github.com/Omnibus-Type/ArchivoNarrow`).

Os dois arquivos de licença são commitados **ao lado** dos `.ttf` porque a OFL **exige** que a
licença viaje com a fonte — sem isso, versionar a fonte num repositório público seria violação.

## Onde isto é usado

`lib/orcamentos/pdf/fontes.ts::registrarFontesDoPdf()` — chamada uma vez por processo (Node),
antes de qualquer `renderToBuffer()` em `app/api/orcamentos/[id]/pdf/route.ts`.

**Docker:** os arquivos são copiados para a imagem `app` explicitamente (`docker/Dockerfile`,
`COPY --from=construtor .../app/assets ./assets`) porque são lidos em tempo de EXECUÇÃO
(`path.join(process.cwd(), "assets", ...)`), não por `import`/`require` estático — o rastreador
de arquivos do `next build` não os encontraria sozinho (mesma classe de defeito do Pitfall 3 do
binário do `sharp`, 04.5-RESEARCH.md). **Plano 13 deve conferir, depois de um `docker build`, que
`/app/assets/fontes/*.ttf` existem dentro da imagem final** antes de fechar a fase.

## O logo (D-09)

A logo do documento (`assets/logo/amassa.png`, lida por `lib/orcamentos/pdf/logo.ts`) é um
arquivo **trocável**, não versionado ainda — a arte da Andressa não chegou. Enquanto o arquivo não
existir, o documento mostra "AMASSA CERRADO" em texto (Archivo Narrow). Quando a arte chegar,
basta colocar o arquivo em `assets/logo/amassa.png` (ou apontar `CAMINHO_LOGO` para outro
caminho) — nenhuma mudança de código é necessária.
