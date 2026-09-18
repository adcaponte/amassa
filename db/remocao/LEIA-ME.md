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

## O que ele NÃO apaga (D-03, deliberado)

O **Comparador de Compras** (Fase 4.3) mora dentro da mesma aba `/abertura`, mas as duas tabelas
dele — `cotacao_categorias` e `cotacoes` — e o tipo de enum `situacao_cotacao` **não** entram
nesta remoção. A decisão do dono foi **arquivar, não apagar**: quando a Abertura sair do sistema,
o comparador some da interface, mas os dados de cotação continuam no banco (`04.3-CONTEXT.md`,
D-03). É por isso que essas duas tabelas nasceram **sem** o prefixo `abertura_` em
`db/schema.ts` — nesse projeto, o prefixo `abertura_` significa "sai quando o módulo for
desmontado", e uma tabela arquivada com esse nome mentiria sobre o próprio ciclo de vida. A
verificação automatizada (abaixo) prova a sobrevivência delas com dado real, não só a ausência
delas desta lista.

## Como a verificação automatizada prova este arquivo

`npm run test:migracoes` (parte de `npm run verificar`) sobe um Postgres efêmero, aplica todas as
migrações normais, semeia um item, uma tarefa ligada a ele, a linha de configuração da Abertura E
uma categoria com duas cotações do Comparador de Compras (uma com preço, uma com preço nulo —
D-07), aplica `remover-abertura-do-espaco.sql` e confere: as três tabelas e os três tipos da
Abertura sumiram; nada mais sumiu (`usuarios` mantém as linhas, as funções e o gatilho de outro
módulo continuam existindo); **as duas tabelas e o tipo de enum do Comparador de Compras
continuam existindo, com as três linhas semeadas ainda legíveis e o preço nulo ainda nulo**
(D-03/D-26); e a verificação se recusa a rodar se o banco conectado não for o de teste. A função
que faz essa prova é `conferirRemocaoDoModuloAbertura`, em `scripts/testar-migracoes.mjs`, rodada
em banco PRÓPRIO por `provarRemocaoEmBancoProprio` (D-26) e chamada por último dentro dele — ela
destrói tabelas, e qualquer verificação depois dela estaria olhando um banco mutilado.

## O procedimento do dia

O passo a passo completo — mover este arquivo, atualizar `db/schema.ts` e
`TABELAS_ESPERADAS`, remover o código do módulo, a rota e o item de menu — está no
**Roteiro 8** (`docs/operacao/08-remover-abertura-do-espaco.md`). Este `LEIA-ME.md` não repete
aquele roteiro; ele só explica por que esta pasta existe.

**Decisão do dono de 2026-09-18, mais nova que este arquivo:** o Roteiro 8 tem, no topo, um aviso
dizendo que o dono decidiu arquivar o módulo Abertura **inteiro** — nenhuma tabela é apagada mais,
nem as três da Abertura. O SQL deste diretório (`remover-abertura-do-espaco.sql`) ainda reflete o
desenho antigo e **não deve ser movido para `db/migrations/` nem executado** até esse roteiro ser
reescrito numa tarefa separada.
