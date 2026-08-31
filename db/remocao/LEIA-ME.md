# `db/remocao/` — SQL escrita e testada que ainda não deve rodar

Esta pasta existe para guardar SQL de remoção **pronta e provada**, mas **deliberadamente fora**
do caminho automático de migração. O Drizzle não a enxerga: nada aqui está em `db/migrations/`,
e nenhum arquivo desta pasta tem entrada em `db/migrations/meta/_journal.json`. `npm run
db:migrate` nunca alcança o que está aqui, em ambiente nenhum (desenvolvimento, CI ou produção).

## Por quê

O módulo **Abertura do Espaço** tem data de morte (D-01/ABE-15,
`.planning/phases/04.2-abertura-do-espaco/04.2-CONTEXT.md`): quando o espaço abrir, ele sai do
sistema — tabelas, código, rota e item de navegação. Escrever a remoção **agora**, com o módulo
fresco na cabeça, custa uma fração de reconstruí-la meses depois com o ateliê já abrindo. Mas ela
não deve rodar agora — só no dia da abertura, por decisão explícita do dono.

## O que existe aqui hoje

- **`remover-abertura-do-espaco.sql`** — apaga as três tabelas (`abertura_itens`,
  `abertura_tarefas`, `abertura_configuracao`) e os três tipos de enum
  (`categoria_item_abertura`, `forma_pagamento_abertura`, `grupo_tarefa_abertura`) do módulo
  Abertura do Espaço. Escrito no formato de migração do Drizzle (`--> statement-breakpoint` entre
  instruções), para no dia da abertura ser **movido** para `db/migrations/` como a próxima
  migração numerada, e não reescrito.

## Como a verificação automatizada prova este arquivo

`npm run test:migracoes` (parte de `npm run verificar`) sobe um Postgres efêmero, aplica todas as
migrações normais, semeia um item, uma tarefa ligada a ele e a linha de configuração, aplica
`remover-abertura-do-espaco.sql` e confere: as três tabelas e os três tipos sumiram; nada mais
sumiu (`usuarios` mantém as linhas, as funções e o gatilho de outro módulo continuam existindo); e
a verificação se recusa a rodar se o banco conectado não for o de teste. A função que faz essa
prova é `conferirRemocaoDoModuloAbertura`, em `scripts/testar-migracoes.mjs`, chamada por último
em `conferirBanco()` — ela destrói tabelas, e qualquer verificação depois dela estaria olhando um
banco mutilado.

## O procedimento do dia

O passo a passo completo — mover este arquivo, atualizar `db/schema.ts` e
`TABELAS_ESPERADAS`, remover o código do módulo, a rota e o item de menu — está no
**Roteiro 8** (`docs/operacao/08-remover-abertura-do-espaco.md`). Este `LEIA-ME.md` não repete
aquele roteiro; ele só explica por que esta pasta existe.
