# Financeiro — parte 2: Precificação e Orçamento

> Briefing fechado com o Theo no Cowork em **19/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Orçamentos AMASSA"). **O protótipo vence sobre a interface; este documento vence
> sobre regra de dado que a tela não mostra.** Todos os números do protótipo são inventados.
> Depende da Fase 04.4 (Financeiro parte 1) concluída: usa `documentos`/`parcelas`, categorias,
> `itens_catalogo` e a taxa do cartão de lá. **Seguir as convenções que a 04.4 fixou** — em especial:
> dinheiro em centavos inteiros, forma de pagamento por parcela, Cadastros em `/cadastros`.

## 1. O que esta fase entrega

- **Peças** — ficha de precificação: argila, esmalte, horas, **medidas em cm**, embalagem, preço
  praticado, preço de mercado opcional. Mostra de onde vem o custo, o preço mínimo (venda direta e
  galeria) e o selo do preço praticado.
- **Parâmetros** — os números do cálculo, cada um com data e selo **estimado | medido**; inclui as
  medidas úteis do forno e "Calcular minha hora".
- **Orçamentos** — rascunho → enviado → aprovado | recusado (e expirado, derivado da validade);
  documento para o cliente em PDF; revisões; aprovação que cria a venda e a encomenda.

Substitui a casca vazia `/orcamentos`. Fora da fase: redesenho da Produção (a aprovação liga no módulo
de Encomendas **como ele é hoje**), aviso de capacidade, cadastro de Pessoas, assinatura eletrônica,
envio por e-mail/WhatsApp pelo sistema (o Theo baixa o PDF e envia ele mesmo).

## 2. O cálculo — módulo puro `lib/precificacao/`, com Vitest

```
material   = argila_g/1000 × R$/kg argila + esmalte_g/1000 × R$/kg esmalte
trabalho   = horas × valor da hora
fornada_X  = kWh_X × tarifa + desgaste por fornada            (X = biscoito, esmalte)
queima     = fornada_biscoito ÷ cabem_biscoito + fornada_esmalte ÷ cabem_esmalte
direto     = material + trabalho + queima + embalagem
custo      = direto ÷ (1 − perda)
mínimo     = custo ÷ (1 − lucro − folga − imposto − taxa_cartão − comissão_do_canal)
zero       = custo ÷ (1 − imposto − taxa_cartão)              (abaixo disso, paga para trabalhar)
```

Percentual do preço entra **dividindo**, nunca somando (fórmula do Sebrae; auditada em agosto).
Canais: venda direta/encomenda (comissão 0) e galeria/consignado. Divisor ≤ 0 é erro de parâmetro:
a tela avisa, não calcula. Selo do preço praticado: ≥ mínimo verde · ≥ zero amarelo · abaixo vermelho.

**Quantas cabem no forno — pelas medidas** (decisão do Theo: a maioria das encomendas é peça
exclusiva, e ninguém sabe de antemão quantas cabem; as medidas ele sempre tem):

```
por_prateleira = máx( ⌊(L+f)/(l+f)⌋ × ⌊(P+f)/(p+f)⌋ ,  o mesmo com l e p trocados )
níveis         = ⌊ A ÷ (altura_da_peça + prateleira_e_pilar) ⌋
cabem_esmalte  = por_prateleira × níveis
cabem_biscoito = ⌊ cabem_esmalte × fator_biscoito ⌋
```

L, P, A = medidas úteis do forno; f = folga entre peças esmaltadas. **Não usar volume** (erra ~2× em
peça plana — diagnóstico de agosto). "Já contei" (dois campos opcionais na ficha) substitui o
calculado. Peça que não cabe → aviso, sem número. ✅ **Respondido pelo Theo (19/09):** o forno é
**cúbico, entre 30 e 40 cm por dentro** (medida exata ainda por tirar) e é **um só** para o cálculo
— os dois fornos que aparecem no site são dado de teste. Forno pequeno: um prato de 27 cm ocupa uma
prateleira inteira; o aviso "não cabe" e a conta por prateleira importam de verdade.

**Perda única** (um percentual), por decisão de simplicidade. "Calcular minha hora" = (retirada
desejada + parte dos custos da casa que a produção paga) ÷ horas realmente produzindo; é assim que
custo fixo entra no preço — **não há rateio no Financeiro**.

## 3. Parâmetros

Tabela de parâmetros **com histórico**: mudar um valor cria registro novo com data; nunca
sobrescreve. Campos: chave, valor, medido (bool), vigente_desde. A taxa do cartão **não é
duplicada**: lê a da parte 1. Todos nascem "estimado". 🔴 **Nenhum valor real em seed versionado** — a
planilha antiga de precificação era esboço; não há número confiável a importar. Em produção os
parâmetros nascem com valores ilustrativos marcados "estimado", e o orçamento avisa quantos
estimados entraram no cálculo.

## 4. Peças (fichas)

- Ficha **de linha** ↔ `itens_catalogo`: o **preço praticado é o `preco_venda` do item** (uma
  verdade só, não dois campos sincronizados) e o **custo calculado é o valor com que a peça pronta
  entra no Estoque** (fase futura; a Loja aplica margem). Criar ficha de linha cria ou vincula o
  item do catálogo, na categoria de venda escolhida.
- Ficha **exclusiva de um pedido**: não aparece na lista nem no catálogo; pode nascer copiando uma
  ficha existente ("começar a partir de"). Desmarcar "exclusiva" a promove a peça de linha.
- Ficha usada em orçamento não se apaga (a tela diz em quantos está).

## 5. Orçamento

```
orcamentos        id, numero (sequencial visível), revisao, status, cliente_nome, titulo, data,
                  validade_dias, entrega_prevista, plano (sinal|avista|3x), sinal_percentual,
                  frete, observacoes, congelado_em, snapshot (jsonb), documento_id, encomenda_id
orcamento_linhas  orcamento_id, ficha_id, quantidade, preco_unitario, cor, personalizacao
orcamento_projeto orcamento_id, descricao, valor          (molde, protótipo, carimbo…)
orcamento_fotos   orcamento_id, ordem, caminho, legenda   (máx. 3)
orcamento_revisoes orcamento_id, revisao, enviado_em, total, snapshot
```

- **Rascunho** calcula ao vivo. **"Marcar como enviado" congela**: grava no snapshot, por linha,
  nome, custo, mínimo, zero, horas e quantas cabem, mais imposto+taxa e a contagem de estimados.
  Depois disso, mudar parâmetro ou ficha **não altera** o orçamento. Exige cliente e ≥ 1 peça.
- **"Atualizar preços"**: em enviado/expirado/recusado compara mínimo congelado × mínimo de hoje por
  peça (mudança de parâmetro **ou** de ficha conta), sugere preço **mantendo a razão preço÷mínimo**
  da época, arredondado (até R$ 50: inteiro acima; acima: múltiplo de 5), editável. Confirmar →
  guarda a revisão anterior em `orcamento_revisoes`, `revisao+1`, volta a rascunho, data = hoje
  (validade renova). Projeto e frete não mudam sozinhos. No rascunho, o mesmo botão confere cada
  preço contra o mínimo de hoje e sobe o que estiver abaixo.
- **Aprovado trava** (virou venda). Refazer = **Duplicar** (rascunho novo, número novo).
- **Expirado** é derivado (data + validade < hoje), não um status gravado.
- Painel **"Só para você"** (nunca no PDF): custo, sobra depois de imposto e taxa, horas de trabalho,
  fornadas ocupadas (Σ qtd ÷ cabem), aviso de estimados, histórico de revisões.

**Aprovação — uma transação:**
1. Cria a **venda** na parte 1: uma linha por peça (descrição com cor), linhas de projeto e frete;
   categoria "Encomendas"; parcelas conforme o plano. 🔴 **O sinal nasce em aberto, vencendo hoje**
   (o Theo confirma no Caixa quando o dinheiro cair); o saldo vence na entrega prevista.
2. Se marcado, cria a **encomenda** no módulo atual: nome = título, cliente, itens com quantidade,
   cronograma padrão; cor, personalização, fotos e ficha ficam **alcançáveis a partir dela**.
3. Guarda os vínculos nos dois sentidos (orçamento ↔ venda ↔ encomenda). Cancelar a venda **não**
   apaga nem reabre o orçamento: só mostra o aviso nos dois lados.

## 6. Documento do cliente (PDF)

✅ **Respondido pelo Theo (19/09):** o PDF leva a **logo no topo** (arte da Andressa, ainda por
chegar — até lá, o nome em texto; a logo é um arquivo trocável, não constante no código). **Sem
endereço, sem contato e sem chave Pix** — o pagamento pode ser de outra forma.

Conteúdo = o do protótipo: cabeçalho, número **e revisão**, data, validade, cliente, tabela de peças
(nome, cor, personalização, quantidade, unitário, total), projeto, frete, total, **Referências** (até
3 fotos com legenda), pagamento, prazo ("a produção começa quando o sinal entra"), observações, a
frase de confirmação ("Ao aprovar, você confirma as peças, as cores e as referências…") e a nota do
feito à mão. 🔴 **Nenhum custo, mínimo, margem ou hora aparece.** Gerado no servidor, A4, com o mesmo
conteúdo da tela "Ver como o cliente vê". Técnica de geração fica para a pesquisa da fase, com duas
restrições: custo recorrente zero e funcionar dentro da imagem Docker atual (medir o peso antes de
adotar um Chromium embutido).

## 7. Fotos — a primeira vez que o projeto guarda arquivo

- Aceitar a foto como vem do celular (até ~15 MB), **reduzir no servidor** para no máximo 1600 px no
  lado maior, JPEG, e guardar **só a versão reduzida**; descartar metadados (EXIF/GPS).
- Arquivos em **volume Docker próprio**, fora do banco e **fora do repositório**; o banco guarda o
  caminho. Servidos só por rota autenticada (`exigirUsuario()`), nunca por pasta pública.
- 🔴 **Backup**: o volume de fotos entra na rotina diária com cópia externa (incremental), e
  `/api/health/backup` passa a cobrir também as fotos. Roteiro de restauração atualizado.
- Disco do VPS: 80 GB. Estimativa: ~1,2 MB por orçamento → irrelevante por muitos anos.
- Validar tipo real do arquivo no servidor (não confiar na extensão); remover foto pede confirmação.

## 8. Em aberto para a discussão da fase

1. ~~Dois fornos / forno redondo~~ — respondido (§2).
2. Onde a Precificação mora na navegação: proposta — **Orçamentos** e **Peças** dentro do
   Financeiro; **Parâmetros** dentro de `/cadastros`.
3. Numeração do orçamento: sequencial simples ou por ano (ex.: 2026-014).
4. ~~Texto fixo do PDF~~ — respondido (§6): só a logo.
5. ✅ **Imposto — respondido:** o negócio será **MEI**, no nome da Andressa. O MEI paga um valor
   **fixo mensal (DAS)**, não um percentual por venda: o parâmetro "imposto sobre a venda" nasce em
   **0%** e o DAS entra como **conta fixa** na parte 1. O parâmetro continua existindo para o dia em
   que o regime mudar. (Teto de faturamento e atividades permitidas do MEI: assunto do contador.)
