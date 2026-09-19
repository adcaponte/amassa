-- O Drizzle não gera trigger nenhum, nem função, nem revoke (02-MODELO-DE-DADOS.md §6) — este
-- arquivo faz as três coisas que a migração 0014 (só tabelas) deixou de fora, seguindo o mesmo
-- molde de 0006/0008/0011/0013:
--
-- (1) os oito gatilhos `tocar_atualizado_em_<tabela>`, ligando cada tabela nova à função
--     tocar_atualizado_em() que já existe desde a migração 0002;
-- (2) a restrição de soma do documento (FNC-03 no banco) — defesa em profundidade além do
--     `lancarVenda` do servidor: mesmo um bug do próprio servidor não grava um documento cuja
--     soma das parcelas não fecha com a soma das linhas, nem um documento sem linha ou sem
--     parcela;
-- (3) a trava de grupo/área de categoria depois de lançamento (FNC-12);
-- (4) o `revoke delete` que faz nada lançado se apagar (FNC-10) valer alguma coisa — um revoke
--     contra o dono da tabela (amassa_owner) não vale nada, é o mesmo raciocínio do comentário de
--     0003_papel-amassa-app-e-grants.sql.
--
-- Recriação condicional em tudo (`create or replace function`, `drop trigger if exists`):
-- reaplicar este arquivo num banco parcialmente migrado não deve explodir.

-- (1) Gatilhos de atualizado_em — um drop + um create por tabela, nas oito tabelas de 0014.
drop trigger if exists tocar_atualizado_em_categorias on categorias;
--> statement-breakpoint
create trigger tocar_atualizado_em_categorias
  before update on categorias
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_itens_catalogo on itens_catalogo;
--> statement-breakpoint
create trigger tocar_atualizado_em_itens_catalogo
  before update on itens_catalogo
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_ficha_tecnica on ficha_tecnica;
--> statement-breakpoint
create trigger tocar_atualizado_em_ficha_tecnica
  before update on ficha_tecnica
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_documentos on documentos;
--> statement-breakpoint
create trigger tocar_atualizado_em_documentos
  before update on documentos
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_documento_linhas on documento_linhas;
--> statement-breakpoint
create trigger tocar_atualizado_em_documento_linhas
  before update on documento_linhas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_parcelas on parcelas;
--> statement-breakpoint
create trigger tocar_atualizado_em_parcelas
  before update on parcelas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_contas_fixas on contas_fixas;
--> statement-breakpoint
create trigger tocar_atualizado_em_contas_fixas
  before update on contas_fixas
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

drop trigger if exists tocar_atualizado_em_configuracao_financeira on configuracao_financeira;
--> statement-breakpoint
create trigger tocar_atualizado_em_configuracao_financeira
  before update on configuracao_financeira
  for each row execute function tocar_atualizado_em();
--> statement-breakpoint

-- (2) Restrição de soma do documento (FNC-03 no banco). `deferrable initially deferred`: a
-- conferência só acontece no fim da transação, depois que TODAS as linhas e parcelas do
-- documento já foram inseridas — inserir linha por linha dentro da mesma transação não dispara
-- uma recusa prematura no meio do caminho.
create or replace function conferir_soma_do_documento()
returns trigger
language plpgsql
as $$
declare
  v_documento_id uuid;
  v_soma_linhas bigint;
  v_soma_parcelas bigint;
  v_qtd_linhas bigint;
  v_qtd_parcelas bigint;
begin
  -- O gatilho dispara em documento_linhas/parcelas (insert/update/delete, usa NEW ou OLD
  -- conforme a operação) e em documentos (só insert, usa NEW.id) — resolve o id do documento
  -- que precisa ser conferido em cada caso.
  if tg_table_name = 'documentos' then
    v_documento_id := new.id;
  elsif tg_op = 'DELETE' then
    v_documento_id := old.documento_id;
  else
    v_documento_id := new.documento_id;
  end if;

  select coalesce(sum(valor_centavos), 0), count(*)
    into v_soma_linhas, v_qtd_linhas
    from documento_linhas
    where documento_id = v_documento_id;

  select coalesce(sum(valor_centavos), 0), count(*)
    into v_soma_parcelas, v_qtd_parcelas
    from parcelas
    where documento_id = v_documento_id;

  if v_qtd_linhas = 0 then
    raise exception 'O documento % não tem nenhuma linha lançada.', v_documento_id;
  end if;

  if v_qtd_parcelas = 0 then
    raise exception 'O documento % não tem nenhuma parcela lançada.', v_documento_id;
  end if;

  if v_soma_linhas <> v_soma_parcelas then
    raise exception
      'A soma das parcelas do documento % (% centavos) não fecha com a soma das linhas (% centavos).',
      v_documento_id, v_soma_parcelas, v_soma_linhas;
  end if;

  return null;
end;
$$;
--> statement-breakpoint

drop trigger if exists conferir_soma_apos_linha on documento_linhas;
--> statement-breakpoint
create constraint trigger conferir_soma_apos_linha
  after insert or update or delete on documento_linhas
  deferrable initially deferred
  for each row execute function conferir_soma_do_documento();
--> statement-breakpoint

drop trigger if exists conferir_soma_apos_parcela on parcelas;
--> statement-breakpoint
create constraint trigger conferir_soma_apos_parcela
  after insert or update or delete on parcelas
  deferrable initially deferred
  for each row execute function conferir_soma_do_documento();
--> statement-breakpoint

drop trigger if exists conferir_soma_apos_documento on documentos;
--> statement-breakpoint
create constraint trigger conferir_soma_apos_documento
  after insert on documentos
  deferrable initially deferred
  for each row execute function conferir_soma_do_documento();
--> statement-breakpoint

-- (3) Trava de grupo/área de categoria depois de lançamento (FNC-12). Categoria com
-- chave_do_sistema (a "diferença", D-02) também nunca muda de grupo/área — ela é achada por
-- código, mudar isso quebraria a lógica de desfazer (D-03).
create or replace function travar_grupo_e_area_da_categoria()
returns trigger
language plpgsql
as $$
declare
  v_tem_lancamento boolean;
begin
  if new.grupo = old.grupo and new.area = old.area then
    return new;
  end if;

  if old.chave_do_sistema is not null then
    raise exception
      'A categoria "%" é usada pelo sistema (chave "%") — grupo e área não podem mudar.',
      old.nome, old.chave_do_sistema;
  end if;

  select exists(
    select 1 from documento_linhas where categoria_id = old.id
  ) into v_tem_lancamento;

  if v_tem_lancamento then
    raise exception
      'A categoria "%" já tem lançamento — grupo e área não podem mudar depois disso.',
      old.nome;
  end if;

  return new;
end;
$$;
--> statement-breakpoint

drop trigger if exists travar_grupo_e_area_da_categoria on categorias;
--> statement-breakpoint
create trigger travar_grupo_e_area_da_categoria
  before update on categorias
  for each row execute function travar_grupo_e_area_da_categoria();
--> statement-breakpoint

-- (4) Nada lançado se apaga (FNC-10). `documento_linhas` e `ficha_tecnica` MANTÊM delete —
-- desfazer uma diferença (D-03) e tirar um insumo da ficha técnica continuam possíveis.
revoke delete on documentos, parcelas, categorias, itens_catalogo, contas_fixas, configuracao_financeira
  from amassa_app;
