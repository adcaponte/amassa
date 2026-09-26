-- MIGRAÇÃO DE DADO (D-17, 🔴 nenhum valor real de parâmetro em seed versionado), no molde de
-- 0016_categorias-iniciais.sql: aplicada À MÃO pelo dono, como as outras migrações — nunca pelo
-- pipeline automático (CLAUDE.md §Migrações). Semeia os 18 parâmetros de
-- `lib/precificacao/parametros.ts::CATALOGO_DE_PARAMETROS` com os valores ILUSTRATIVOS do
-- protótipo (`prototipo.html`, `PDEF`) — a planilha de precificação v2 teve a LÓGICA auditada,
-- mas os NÚMEROS eram esboço: não há nada confiável a importar. Todos nascem `medido = false`
-- ("estimado"); a tela avisa quantos estimados entraram em cada cálculo.
--
-- `criado_por` fica NULO (nenhum usuário no momento da semente) e `vigente_desde` é
-- `current_date` — a migração é aplicada por alguém, num dia conhecido, e essa é a data a partir
-- da qual estes valores valem. `insert ... on conflict (chave, vigente_desde) do nothing` sobre
-- a restrição única de `parametros_precificacao`: reaplicar esta migração não duplica nenhuma
-- linha (mesma disciplina de 0016).
--
-- Os valores entram já na escala inteira do catálogo (centavos para dinheiro, pontos-base para
-- percentual, milésimos para medida/kWh/fator) — cada linha comenta o valor humano
-- correspondente, para quem ler o SQL não precisar fazer a conta de cabeça.

insert into parametros_precificacao (chave, valor_inteiro, medido, vigente_desde) values
  ('material_argila', 1000, false, current_date),             -- R$ 10,00/kg
  ('material_esmalte', 8400, false, current_date),            -- R$ 84,00/kg
  ('trabalho_hora', 3500, false, current_date),                -- R$ 35,00/h
  ('forno_tarifa_energia', 78, false, current_date),           -- R$ 0,78/kWh
  ('forno_kwh_biscoito', 18000, false, current_date),          -- 18 kWh
  ('forno_kwh_esmalte', 28000, false, current_date),           -- 28 kWh
  ('forno_largura_util', 35000, false, current_date),          -- 35 cm
  ('forno_profundidade_util', 35000, false, current_date),     -- 35 cm
  ('forno_altura_util', 35000, false, current_date),           -- 35 cm
  ('forno_folga_entre_pecas', 1500, false, current_date),      -- 1,5 cm
  ('forno_prateleira_e_pilar', 3000, false, current_date),     -- 3 cm
  ('forno_fator_biscoito', 1800, false, current_date),         -- 1,8 ×
  ('forno_desgaste_por_fornada', 1200, false, current_date),   -- R$ 12,00
  ('perda_unica', 1500, false, current_date),                  -- 15 %
  ('preco_lucro', 1500, false, current_date),                  -- 15 %
  ('preco_folga_negociacao', 1000, false, current_date),       -- 10 %
  ('preco_imposto_sobre_venda', 0, false, current_date),       -- 0 % (D-10: MEI, DAS é conta fixa)
  ('preco_comissao_galeria', 4000, false, current_date)        -- 40 %
on conflict (chave, vigente_desde) do nothing;
