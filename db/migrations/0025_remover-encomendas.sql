-- APLICADA À MÃO, pelo dono, depois de backup, na MESMA sessão de `db:migrate` que a `0024` (D-09)
-- — só apaga as tabelas de Encomendas; a função `tocar_atualizado_em()` fica. Nunca pelo pipeline,
-- nunca `drizzle-kit push`. Roteiro 16 (plano 06.1-15).
--
-- Gerada pelo plano 06.1-14 com `npm run db:generate -- --name remover-encomendas`, depois que o
-- módulo de Encomendas saiu do código e as tabelas `encomendas`, `encomenda_itens` e
-- `encomenda_etapas` e os tipos `status_encomenda` e `etapa_encomenda` saíram de `db/schema.ts`
-- (D-01: "pode zerar todos os dados, nada é real ainda" — o dono). O `drizzle-kit` rodou sem pergunta
-- nenhuma: o diff contra o snapshot da `0024` só REMOVE (06.1-RESEARCH.md, Pitfall 3). O corpo abaixo
-- é o que o gerador escreveu, sem mudança — inclusive o `CASCADE` que ele sempre põe.
--
-- Por que o `CASCADE` não leva mais nada junto: desde a `0024`, nenhuma tabela de fora aponta para
-- estas três (`orcamentos.encomenda_id` e `movimentacoes_estoque.encomenda_id` apontam para
-- `ordens_producao`); os gatilhos `tocar_atualizado_em_encomenda*` da `0006` somem com a própria
-- tabela, e a função compartilhada continua servindo as outras. `npm run test:migracoes` prova
-- isso num banco próprio com dado (`provarMigracaoDaProducaoEmBancoProprio`): depois desta
-- migração, as três tabelas e os dois tipos não existem, as chaves estrangeiras das outras tabelas
-- são as mesmas de antes, a função existe e a ordem migrada, as etapas e as peças dela continuam
-- iguais.
--
-- Roda na mesma transação da `0024` (o migrador do Drizzle aplica todas as pendentes numa só): se
-- qualquer coisa falhar, nenhuma das duas fica pela metade.

DROP TABLE "encomenda_etapas" CASCADE;--> statement-breakpoint
DROP TABLE "encomenda_itens" CASCADE;--> statement-breakpoint
DROP TABLE "encomendas" CASCADE;--> statement-breakpoint
DROP TYPE "public"."etapa_encomenda";--> statement-breakpoint
DROP TYPE "public"."status_encomenda";