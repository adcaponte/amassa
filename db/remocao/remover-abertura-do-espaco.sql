-- MÓDULO TEMPORÁRIO (D-01/ABE-15, .planning/phases/04.2-abertura-do-espaco/04.2-CONTEXT.md).
-- Este arquivo NÃO é uma migração hoje: ele NÃO está em `db/migrations/` e NÃO tem entrada em
-- `db/migrations/meta/_journal.json`. Se estivesse, o próximo `npm run db:migrate` — em
-- desenvolvimento, em CI ou em produção — apagaria o módulo Abertura do Espaço recém-construído.
--
-- O que ele É: a SQL de remoção do módulo inteiro, escrita e provada por
-- `npm run test:migracoes` (`conferirRemocaoDoModuloAbertura`, `scripts/testar-migracoes.mjs`)
-- contra um banco de teste efêmero com dado real de item/tarefa/configuração semeado antes do
-- `drop`. Ela existe para o dia da abertura ser um comando, não um projeto.
--
-- O que fazer com ele no dia da abertura: ver `db/remocao/LEIA-ME.md` e o Roteiro 8
-- (`docs/operacao/08-remover-abertura-do-espaco.md`). Em resumo: mover este arquivo para
-- `db/migrations/` como a próxima migração numerada (ex.: `00NN_remover-abertura-do-espaco.sql`),
-- acrescentar a entrada correspondente em `meta/_journal.json`, remover as três tabelas e os três
-- `pgEnum` de `db/schema.ts`, e então aplicar pelo caminho normal, à mão, no servidor, pelo
-- serviço `ferramentas`.
--
-- Ordem das instruções: as tabelas primeiro (na ordem que respeita a chave estrangeira —
-- `abertura_tarefas` referencia `abertura_itens`, então ela sai primeiro), depois os três tipos
-- de enum. Os gatilhos de `atualizado_em` das três tabelas (migração 0011_gatilhos-abertura.sql)
-- morrem JUNTO com as tabelas — não são apagados em separado, um `drop table` já leva o trigger
-- que pende dela.
--
-- `drop table` NÃO apaga tipo de enum: os três `drop type` são o que separa "as tabelas
-- sumiram" de "o módulo sumiu". Um enum órfão em `pg_type` é exatamente o resíduo que ABE-15
-- proíbe.
--
-- O que este arquivo NUNCA apaga, porque é base comum de TODOS os módulos: a função
-- `tocar_atualizado_em()`, a função `hoje_brasilia()`, a extensão `unaccent`, o papel
-- `amassa_app` e qualquer `grant`/`revoke`. Apagar qualquer um destes derrubaria o sistema
-- inteiro, não só a Abertura do Espaço.
--
-- Nada de `begin`/`commit` aqui: o Drizzle envolve cada migração na própria transação quando
-- este arquivo virar uma migração de verdade.
--
-- AUSÊNCIA DELIBERADA (D-03, .planning/phases/04.3-comparador-de-compras/04.3-CONTEXT.md): as
-- duas tabelas do Comparador de Compras (`cotacao_categorias`, `cotacoes`) e o tipo de enum
-- `situacao_cotacao` NÃO entram nesta lista, e isso nunca deve ser "corrigido". Elas são
-- ARQUIVADAS, não apagadas — quando a Abertura for desmontada, o comparador some da interface e
-- os dados continuam no banco. É exatamente por isso que as duas tabelas nasceram SEM o prefixo
-- `abertura_` (db/schema.ts): esse prefixo, neste projeto, significa "sai quando o módulo for
-- desmontado", e uma tabela arquivada com esse nome mentiria sobre o próprio ciclo de vida e
-- convidaria alguém a "completar" esta lista por prefixo, num dia corrido. A prova de que elas
-- sobrevivem de verdade — com o dado ainda legível — roda em `conferirRemocaoDoModuloAbertura`
-- (`scripts/testar-migracoes.mjs`), não neste arquivo.

drop table if exists abertura_tarefas;
--> statement-breakpoint
drop table if exists abertura_itens;
--> statement-breakpoint
drop table if exists abertura_configuracao;
--> statement-breakpoint
drop type if exists grupo_tarefa_abertura;
--> statement-breakpoint
drop type if exists categoria_item_abertura;
--> statement-breakpoint
drop type if exists forma_pagamento_abertura;
