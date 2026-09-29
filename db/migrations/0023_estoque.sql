-- APLICADA À MÃO, pelo dono, depois de backup — nunca pelo pipeline. Roteiro 15 (plano 06-11).
-- ORDEM OBRIGATÓRIA (D-33): backup → esta migração → conferência de fora → só então o código.
-- A migração só ACRESCENTA (tabela nova, colunas com padrão), por isso o código antigo roda com ela.
--
-- Gerada pelo plano 06-01 (Fase 06 — Estoque, o traçador). O bloco de tipos, tabela, colunas,
-- chaves e índices abaixo saiu de `drizzle-kit generate`, direto do schema (`db/schema.ts`,
-- `movimentacoesEstoque` e as três colunas novas de `itensCatalogo`). O resto deste arquivo foi
-- ACRESCENTADO À MÃO — o Drizzle não gera trigger, função nem grant/revoke (02-MODELO-DE-DADOS.md
-- §6), no MESMO molde de 0015/0022:
--
-- (1) `revoke update, delete` em `movimentacoes_estoque` para `amassa_app` — o livro é imutável:
--     correção é ajuste, cancelamento é estorno, nunca edição nem exclusão (EST-06);
-- (2) a função e o gatilho `travar_unidade_do_item_com_movimentacao` em `itens_catalogo`: item que
--     já tem movimentação não muda de unidade nem deixa de controlar estoque (Pitfall 6 — 5 kg
--     virariam 5 g, ou o item sumiria do Estoque com saldo).
--
-- Recriação condicional (`create or replace function`, `drop trigger if exists` antes de
-- `create trigger`): reaplicar os blocos à mão num banco parcialmente migrado não deve explodir.
--
-- Esta migração é aplicada à mão, e NÃO por nenhum executor: as únicas bases que ela toca antes
-- do dono são o Postgres efêmero de `npm run test:migracoes` e de `npm run test:e2e`. Nunca
-- `drizzle-kit push`.

CREATE TYPE "public"."destino_saida" AS ENUM('aula', 'encomenda', 'cafeteria', 'atelie', 'perda');--> statement-breakpoint
CREATE TYPE "public"."motivo_movimentacao" AS ENUM('saldo_inicial', 'peca_pronta');--> statement-breakpoint
CREATE TYPE "public"."origem_movimentacao" AS ENUM('venda', 'compra', 'producao', 'manual');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimentacao" AS ENUM('entrada', 'saida', 'ajuste');--> statement-breakpoint
CREATE TABLE "movimentacoes_estoque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" bigint GENERATED ALWAYS AS IDENTITY (sequence name "movimentacoes_estoque_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_id" uuid NOT NULL,
	"origem" "origem_movimentacao" NOT NULL,
	"tipo" "tipo_movimentacao" NOT NULL,
	"motivo" "motivo_movimentacao",
	"destino" "destino_saida",
	"area" "area_financeira",
	"quantidade_milesimos" bigint NOT NULL,
	"valor_centavos" bigint NOT NULL,
	"valor_informado_centavos" bigint,
	"saldo_contado_milesimos" bigint,
	"documento_id" uuid,
	"documento_linha_id" uuid,
	"encomenda_id" uuid,
	"nota" text,
	"estorno_de_id" uuid,
	"registrado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimentacoes_estoque_numero_uk" UNIQUE("numero"),
	CONSTRAINT "movimentacoes_estoque_estorno_de_uk" UNIQUE("estorno_de_id"),
	CONSTRAINT "movimentacoes_estoque_quantidade_nao_zero" CHECK ("movimentacoes_estoque"."quantidade_milesimos" <> 0),
	CONSTRAINT "movimentacoes_estoque_sinal_do_tipo" CHECK (("movimentacoes_estoque"."tipo" = 'entrada' and "movimentacoes_estoque"."quantidade_milesimos" > 0) or ("movimentacoes_estoque"."tipo" = 'saida' and "movimentacoes_estoque"."quantidade_milesimos" < 0) or "movimentacoes_estoque"."tipo" = 'ajuste'),
	CONSTRAINT "movimentacoes_estoque_origem_tipo_estorno" CHECK (("movimentacoes_estoque"."origem" = 'venda' and (("movimentacoes_estoque"."tipo" = 'saida' and "movimentacoes_estoque"."estorno_de_id" is null) or ("movimentacoes_estoque"."tipo" = 'entrada' and "movimentacoes_estoque"."estorno_de_id" is not null))) or ("movimentacoes_estoque"."origem" = 'compra' and (("movimentacoes_estoque"."tipo" = 'entrada' and "movimentacoes_estoque"."estorno_de_id" is null) or ("movimentacoes_estoque"."tipo" = 'saida' and "movimentacoes_estoque"."estorno_de_id" is not null))) or ("movimentacoes_estoque"."origem" = 'producao' and "movimentacoes_estoque"."tipo" = 'entrada' and "movimentacoes_estoque"."estorno_de_id" is null) or ("movimentacoes_estoque"."origem" = 'manual' and "movimentacoes_estoque"."estorno_de_id" is null)),
	CONSTRAINT "movimentacoes_estoque_documento_da_origem" CHECK (("movimentacoes_estoque"."documento_id" is not null) = ("movimentacoes_estoque"."origem" in ('venda', 'compra'))),
	CONSTRAINT "movimentacoes_estoque_destino_da_saida_manual" CHECK (("movimentacoes_estoque"."destino" is not null) = ("movimentacoes_estoque"."origem" = 'manual' and "movimentacoes_estoque"."tipo" = 'saida')),
	CONSTRAINT "movimentacoes_estoque_destino_exige_area" CHECK ("movimentacoes_estoque"."destino" is null or "movimentacoes_estoque"."area" is not null),
	CONSTRAINT "movimentacoes_estoque_venda_exige_area" CHECK ("movimentacoes_estoque"."origem" <> 'venda' or "movimentacoes_estoque"."area" is not null),
	CONSTRAINT "movimentacoes_estoque_encomenda_so_no_destino_encomenda" CHECK ("movimentacoes_estoque"."encomenda_id" is null or "movimentacoes_estoque"."destino" = 'encomenda'),
	CONSTRAINT "movimentacoes_estoque_valor_informado_da_entrada" CHECK (("movimentacoes_estoque"."valor_informado_centavos" is not null) = ("movimentacoes_estoque"."tipo" = 'entrada')),
	CONSTRAINT "movimentacoes_estoque_valor_informado_nao_negativo" CHECK ("movimentacoes_estoque"."valor_informado_centavos" is null or "movimentacoes_estoque"."valor_informado_centavos" >= 0),
	CONSTRAINT "movimentacoes_estoque_saldo_contado_nao_negativo" CHECK ("movimentacoes_estoque"."saldo_contado_milesimos" is null or "movimentacoes_estoque"."saldo_contado_milesimos" >= 0),
	CONSTRAINT "movimentacoes_estoque_ajuste_exige_saldo_contado" CHECK ("movimentacoes_estoque"."tipo" <> 'ajuste' or "movimentacoes_estoque"."saldo_contado_milesimos" is not null),
	CONSTRAINT "movimentacoes_estoque_saldo_contado_so_ajuste_ou_inicial" CHECK ("movimentacoes_estoque"."saldo_contado_milesimos" is null or "movimentacoes_estoque"."tipo" = 'ajuste' or "movimentacoes_estoque"."motivo" = 'saldo_inicial'),
	CONSTRAINT "movimentacoes_estoque_motivo_so_manual" CHECK ("movimentacoes_estoque"."motivo" is null or "movimentacoes_estoque"."origem" = 'manual'),
	CONSTRAINT "movimentacoes_estoque_motivo_do_tipo" CHECK ("movimentacoes_estoque"."motivo" is null or ("movimentacoes_estoque"."motivo" = 'saldo_inicial' and "movimentacoes_estoque"."tipo" in ('entrada', 'ajuste')) or ("movimentacoes_estoque"."motivo" = 'peca_pronta' and "movimentacoes_estoque"."tipo" = 'entrada')),
	CONSTRAINT "movimentacoes_estoque_nota_comprimento" CHECK ("movimentacoes_estoque"."nota" is null or length(trim("movimentacoes_estoque"."nota")) between 1 and 160)
);
--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD COLUMN "estoque_minimo_milesimos" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_item_id_itens_catalogo_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."itens_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_documento_linha_id_documento_linhas_id_fk" FOREIGN KEY ("documento_linha_id") REFERENCES "public"."documento_linhas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_encomenda_id_encomendas_id_fk" FOREIGN KEY ("encomenda_id") REFERENCES "public"."encomendas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_estorno_de_id_movimentacoes_estoque_id_fk" FOREIGN KEY ("estorno_de_id") REFERENCES "public"."movimentacoes_estoque"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimentacoes_estoque_item_numero_idx" ON "movimentacoes_estoque" USING btree ("item_id","numero");--> statement-breakpoint
CREATE INDEX "movimentacoes_estoque_documento_idx" ON "movimentacoes_estoque" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "movimentacoes_estoque_criado_em_idx" ON "movimentacoes_estoque" USING btree ("criado_em");--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_minimo_nao_negativo" CHECK ("itens_catalogo"."estoque_minimo_milesimos" >= 0);--> statement-breakpoint
ALTER TABLE "itens_catalogo" ADD CONSTRAINT "itens_catalogo_observacoes_comprimento" CHECK ("itens_catalogo"."observacoes" is null or length(trim("itens_catalogo"."observacoes")) between 1 and 500);
--> statement-breakpoint

-- (1) O livro nasce sem porta de edição. A migração 0003 concede select/insert/update/delete a
-- `amassa_app` por `alter default privileges` em TODA tabela nova — por isso este revoke
-- precisa ser explícito. É exatamente o revoke que o comentário do topo da 0003 antecipava
-- ("é o que faz o `revoke update, delete on movimentacoes_estoque` da Fase 6 valer alguma
-- coisa"): contra o dono da tabela ele não valeria nada; contra o papel de aplicação, vale.
-- Ficam só select e insert.
revoke update, delete on movimentacoes_estoque from amassa_app;
--> statement-breakpoint

-- (2) Trava de unidade e de estoque próprio depois da primeira movimentação (Pitfall 6), no molde
-- de `travar_grupo_e_area_da_categoria` (0015): qualquer outra mudança no item passa; mudar a
-- `unidade`, ou passar `controla_estoque` de verdadeiro para falso, com linha no livro, é
-- recusado com SQLSTATE P0001 (raise exception) — a frase chega ao gestor pelo tratamento que
-- `lib/cadastros/acoes.ts` já faz de P0001.
create or replace function travar_unidade_do_item_com_movimentacao()
returns trigger
language plpgsql
as $$
declare
  v_tem_movimentacao boolean;
begin
  if new.unidade is not distinct from old.unidade
     and not (old.controla_estoque and not new.controla_estoque) then
    return new;
  end if;

  select exists(
    select 1 from movimentacoes_estoque where item_id = old.id
  ) into v_tem_movimentacao;

  if v_tem_movimentacao then
    raise exception
      'O item "%" já tem movimentação de estoque — a unidade e o estoque próprio não mudam mais.',
      old.nome;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

drop trigger if exists travar_unidade_do_item_com_movimentacao on itens_catalogo;
--> statement-breakpoint
create trigger travar_unidade_do_item_com_movimentacao
  before update on itens_catalogo
  for each row execute function travar_unidade_do_item_com_movimentacao();
