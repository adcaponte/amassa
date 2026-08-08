-- O papel de aplicação, separado do dono do banco (`amassa_owner`, que roda as migrações).
-- É o que faz o `revoke update, delete on movimentacoes_estoque` da Fase 6 valer alguma
-- coisa: um `revoke` contra o dono da tabela não vale nada, porque dono retém privilégio
-- implícito e pode se reconceder. Ver amassa-plataforma/02-MODELO-DE-DADOS.md §0.

-- Bloco condicional: reaplicar esta migração num banco onde o papel já existe não deve
-- falhar. Nasce com `login` e SEM senha — o método de autenticação da imagem exige senha
-- para abrir conexão por rede, então não existe janela de acesso entre esta migração e o
-- momento em que o dono define a senha no servidor (roteiro do plano 08). Isso também
-- mantém o segredo fora deste arquivo versionado, que é o ponto.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'amassa_app') then
    create role amassa_app login;
  end if;
end $$;
--> statement-breakpoint

-- current_database() em vez do nome literal do banco de produção: esta mesma migração
-- também roda contra o banco de teste efêmero (nome diferente), e o grant precisa valer
-- para o banco em que ela estiver de fato rodando.
do $$
begin
  execute format('grant connect on database %I to amassa_app', current_database());
end $$;
--> statement-breakpoint

grant usage on schema public to amassa_app;
--> statement-breakpoint

grant select, insert, update, delete on all tables in schema public to amassa_app;
--> statement-breakpoint

grant usage, select on all sequences in schema public to amassa_app;
--> statement-breakpoint

-- Roda como amassa_owner (quem executa esta migração, e quem cria as tabelas nas migrações
-- seguintes) — é esta linha que faz as tabelas das Fases 3 a 6 nascerem visíveis para a
-- aplicação, sem exigir um grant manual toda vez que uma tabela nova é criada. Nenhum
-- privilégio de definição de estrutura é concedido: o papel de aplicação nunca cria, altera
-- nem remove tabela.
alter default privileges in schema public
  grant select, insert, update, delete on tables to amassa_app;
