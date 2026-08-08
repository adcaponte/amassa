-- Base comum de datas e do carimbo de atualização — todas as fases seguintes herdam isto.
-- Ver amassa-plataforma/02-MODELO-DE-DADOS.md §0.

-- Extensão de normalização de texto. Pré-requisito de `nome_normalizado()`, que é da fase da
-- Agenda — não criada aqui, só a extensão de que ela depende.
create extension if not exists unaccent;
--> statement-breakpoint

-- O contêiner do Postgres roda em UTC; `current_date` cru devolveria o dia errado entre 21h e
-- meia-noite no fuso de Brasília. Toda coluna `date` com valor padrão usa esta função, nunca
-- `current_date` cru.
create or replace function hoje_brasilia()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
--> statement-breakpoint

-- Carimba `atualizado_em` da linha com o instante atual. A função sozinha não faz nada — cada
-- tabela precisa do próprio trigger `before update` chamando-a (ver o trigger logo abaixo).
create or replace function tocar_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;
--> statement-breakpoint

-- Liga a função acima a `usuarios`. Recriação condicional: reaplicar este arquivo num banco
-- parcialmente migrado não deve explodir.
drop trigger if exists tocar_atualizado_em_usuarios on usuarios;
--> statement-breakpoint
create trigger tocar_atualizado_em_usuarios
  before update on usuarios
  for each row execute function tocar_atualizado_em();
