-- MIGRAÇÃO DE DADO (D-14, custly no 04.4-CONTEXT.md), aplicada à mão pelo dono como as outras
-- migrações — nunca pelo pipeline automático (CLAUDE.md §Migrações). Semeia as 24 categorias que
-- em produção nascem prontas: as 23 do protótipo (`semente()`, `prototipo.html`), com o mesmo
-- grupo e a mesma área de lá, mais "Juros, multas e descontos" (D-02), a única com
-- `chave_do_sistema`. Nenhum item de catálogo e nenhuma conta fixa nascem aqui — catálogo e
-- contas fixas sobem vazios (D-14): os preços e valores do protótipo são inventados.
--
-- `insert ... on conflict do nothing` sobre o índice único de nome normalizado
-- (`categorias_nome_normalizado_idx`) — rodar esta migração de novo não duplica nenhuma
-- categoria. Todas nascem editáveis e desativáveis pela tela (nenhuma trava de UI aqui, só a
-- trava de grupo/área depois de lançamento, migração 0015).

insert into categorias (nome, grupo, area) values
  ('Bebidas e comidas', 'receita', 'cafeteria'),
  ('Uso do espaço', 'receita', 'espaco'),
  ('Aulas e oficinas', 'receita', 'espaco'),
  ('Peças prontas', 'receita', 'pecas'),
  ('Peças para pintar', 'receita', 'pecas'),
  ('Encomendas', 'receita', 'pecas'),
  ('Queima externa', 'receita', 'pecas'),
  ('Materiais e papelaria', 'receita', 'loja'),
  ('Insumos da cafeteria', 'custo', 'cafeteria'),
  ('Material de aula', 'custo', 'espaco'),
  ('Argila, esmalte e insumos', 'custo', 'pecas'),
  ('Mercadoria para revenda', 'custo', 'loja'),
  ('Aluguel', 'geral', 'geral'),
  ('Água e luz', 'geral', 'geral'),
  ('Internet e sistemas', 'geral', 'geral'),
  ('Contabilidade', 'geral', 'geral'),
  ('Ferramentas e utensílios', 'geral', 'geral'),
  ('Divulgação', 'geral', 'geral'),
  ('Pró-labore', 'geral', 'geral'),
  ('Equipamento e obra', 'fora', 'geral'),
  ('Financiamento (parcela)', 'fora', 'geral'),
  ('Aporte dos sócios', 'fora', 'geral'),
  ('Retirada de lucro', 'fora', 'geral')
on conflict (lower(trim(nome))) do nothing;
--> statement-breakpoint

-- Juros, multas e descontos (D-02): a categoria da linha "diferença" (D-01), achada pelo banco
-- por `chave_do_sistema = 'diferenca'`, nunca pelo nome (que o dono pode editar, D-14).
insert into categorias (nome, grupo, area, chave_do_sistema) values
  ('Juros, multas e descontos', 'geral', 'geral', 'diferenca')
on conflict (lower(trim(nome))) do nothing;
