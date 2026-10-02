# Fontes da interface

Arquivos `.woff2` que `app/layout.tsx` carrega por `next/font/local`. Pasta com `_` na frente
porque o App Router ignora pastas privadas — isto nunca vira rota.

## Por que estão no repositório

Até 02/10/2026 a interface usava `next/font/google`, que **baixa** as fontes do Google durante o
`next build`. O job "Publicar imagens no GHCR" (`.github/workflows/entrega.yml`) falhou por rede
pelo menos duas vezes — runs 36443052672 (28/09/2026) e 36802909361 (01/10/2026), ambas com
`Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` — e passou
no run seguinte sem mudança nenhuma. Registrado como janela 60 em `.planning/WINDOWS.md`.
Versionar os arquivos tira a rede do caminho do build: `next build` só lê disco.

## De onde vieram

Os arquivos são os **mesmos bytes** que o `next/font/google` servia. Baixados em 02/10/2026 das
URLs que `fonts.googleapis.com/css2` devolve para o mesmo pedido que o Next fazia (mesmo
User-Agent de Chrome que `next/font/google` usa), e conferidos com `cmp` contra os arquivos de
`.next/static/media` de um build anterior feito com `next/font/google` (Inter e Archivo Narrow;
Fraunces entrou depois daquele build).

| Arquivo | Família, pesos | Subset | Versão | URL de origem |
|---|---|---|---|---|
| `Inter-latin.woff2` | Inter 400, 500 (variável) | latin | v20 | `fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2` |
| `Inter-latin-ext.woff2` | Inter 400, 500 (variável) | latin-ext | v20 | `fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2` |
| `ArchivoNarrow-latin.woff2` | Archivo Narrow 600, 700 (variável) | latin | v35 | `fonts.gstatic.com/s/archivonarrow/v35/tss0ApVBdCYD5Q7hcxTE1ArZ0bbwiXxw2d8o.woff2` |
| `ArchivoNarrow-latin-ext.woff2` | Archivo Narrow 600, 700 (variável) | latin-ext | v35 | `fonts.gstatic.com/s/archivonarrow/v35/tss0ApVBdCYD5Q7hcxTE1ArZ0bb-iXxw2d8oBxk.woff2` |
| `Fraunces-latin.woff2` | Fraunces 400, 600, 700 (variável) | latin | v38 | `fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c7qv8oRcTn.woff2` |
| `Fraunces-latin-ext.woff2` | Fraunces 400, 600, 700 (variável) | latin-ext | v38 | `fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c1qv8oRcTnaIM.woff2` |

SHA-256 no momento do download:

```
c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4  Inter-latin.woff2
a28eb6d3ccb534ae0c94ca999371df024aab60b08c3c8a5720ee9e32fa0faaa2  Inter-latin-ext.woff2
728b32e94fd137eca605f80d3c34adeaeef0d312425c7a5a1ff743407b2d78f9  ArchivoNarrow-latin.woff2
db821b657f1d6b362a8bbddb4452073d156cea76854a157d3b33b4a999fcebfa  ArchivoNarrow-latin-ext.woff2
88e17be075f1be50ab67b057b99e3701b828f44ed28f9452df6c02645bb0cba9  Fraunces-latin.woff2
f1451edd6434085c4f9f3a8b4a674182dd7d6acccf53bfced19fd167f0705a06  Fraunces-latin-ext.woff2
```

**Subsets.** O CSS do Google declarava, além de `latin` (o único com preload) e `latin-ext`,
faces de cirílico, grego e vietnamita. Só `latin` e `latin-ext` entraram — cobrem português e
qualquer nome em alfabeto latino. Um caractere fora deles cai no "* Fallback".

**Para atualizar uma fonte:** pedir o CSS a
`https://fonts.googleapis.com/css2?family=<Família>:wght@<pesos>&display=swap` com um
User-Agent de Chrome, baixar as URLs dos blocos `/* latin */` e `/* latin-ext */`, trocar os
arquivos e esta tabela. As faixas `unicode-range` em `app/layout.tsx` vêm do mesmo CSS.

## Licença

As três famílias são distribuídas sob a **SIL Open Font License, Version 1.1**, que permite usar,
embutir e redistribuir as fontes — inclusive em repositório público e em contexto comercial; a
única restrição relevante aqui é não vender a fonte sozinha. A OFL exige que a licença viaje com
a fonte, por isso os arquivos ficam ao lado dos `.woff2`:

- `OFL-Inter.txt` — Copyright 2020 The Inter Project Authors (`github.com/rsms/inter`).
- `OFL-ArchivoNarrow.txt` — Copyright 2019 The Archivo Narrow Project Authors
  (`github.com/Omnibus-Type/ArchivoNarrow`).
- `OFL-Fraunces.txt` — Copyright 2018 The Fraunces Project Authors
  (`github.com/undercasetype/Fraunces`).

Os três textos foram baixados de `github.com/google/fonts` (`ofl/<família>/OFL.txt`), o
repositório de onde o Google Fonts serve essas famílias.

Os `.ttf` de `assets/fontes/` são outra coisa: servem ao gerador de PDF
(`lib/orcamentos/pdf/fontes.ts`), que precisa dos bytes de um arquivo TTF e não usa `next/font`.
