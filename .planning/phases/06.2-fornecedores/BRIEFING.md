# Fornecedores — aba dos Cadastros com contatos, condições e anexos

> Briefing escrito com o Theo no Cowork em **01/10/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Fornecedores AMASSA", **aprovado pelo Theo em 01/10/2026**).
> **O protótipo vence sobre a interface; este documento vence sobre regra de dado.**
> É um módulo **pequeno e isolado**: não mexe em Estoque, Catálogo, Cotações nem Produção. O único
> vínculo é com a **despesa do Financeiro** (§4).

## 1. O que é, e por quê

Hoje tabela de preços, catálogo e nota de fornecedor andam pelo WhatsApp e se perdem. A aba
**Cadastros → Fornecedores** é o lugar único: quem vende para o ateliê, como falar com ele, em que
condições, e os arquivos dele. É **consulta** — nada aqui vira número em lugar nenhum. Uso pouco
frequente, mais pelo computador; a tela funciona no celular, mas sem esforço extra (sem
"compartilhar com…", sem câmera, sem versionamento de arquivo).

## 2. Fornecedor (dados)

Tabela `fornecedores`: `id`, `nome` (obrigatório, 1–120, único entre ativos, sem distinção de
caixa), `vende` (texto livre, "argila, esmalte, feldspato" — é o que a busca encontra), `area`
(enum já existente do Financeiro: cafeteria · espaco · pecas · loja · geral; é só para o filtro),
`cidade_entrega`, `whatsapp`, `pessoa_contato`, `email`, `site`, `pagamento_prazo` (todos texto
curto, opcionais), `observacoes` (texto livre, até 4000), `ativo` (default true),
`criado_em/por`, `atualizado_em/por`.

- **Não se apaga** (`revoke delete`, como tudo desde a 0015). Desativar tira da lista e dos
  seletores; os anexos e as despesas ligadas ficam. Reativar volta tudo.
- Busca por `nome`, `vende` e `cidade_entrega`, sem acento e sem caixa. Filtro por área. Lista em
  ordem alfabética; desativados escondidos por padrão com o link "mostrar N desativados".
- WhatsApp: mostrado como texto, com **copiar** e **abrir WhatsApp** (`wa.me/<dígitos>`, nova
  aba). Site: abre em nova aba. E-mail: copiar. Nenhum deles é obrigatório.

## 3. Anexos

Tabela `fornecedor_anexos`: `id`, `fornecedor_id`, `nome` (1–120), `tipo` (enum: tabela ·
catalogo · nota · outro), `vale_desde` (date, só faz sentido em `tabela`; opcional), `nota`
(até 160), `arquivo_caminho`, `arquivo_tipo` (mime), `arquivo_bytes`, `extensao`, `criado_em/por`.

- **Formatos:** PDF, foto (JPG, PNG, WebP, HEIC), planilha (XLSX, XLS, CSV). Nada mais.
- **Limites:** 🔴 **20 MB para PDF e planilha; 10 MB para foto.** Foto é reduzida e sem EXIF como
  nos orçamentos (`sharp`, lado maior 2000 px); PDF e planilha são guardados **como vieram**, com o
  tipo conferido pela assinatura do arquivo (magic bytes), não só pela extensão.
- **Onde fica:** pasta irmã das fotos de orçamento — `/opt/amassa/dados/anexos-fornecedores/<uuid>.<ext>`
  — no mesmo volume e **coberta pelo mesmo backup diário** (Roteiro 12). O roteiro desta fase cria a
  pasta e confere o backup, como o 12 fez. Nome do arquivo no disco é o uuid; o nome que a pessoa deu
  fica no banco.
- **Servir:** `/api/fornecedores/anexos/<uuid>` **atrás da sessão** (401 JSON sem login), com
  `Content-Disposition: inline` e o nome original; PDF abre na aba, imagem abre, planilha baixa.
  Nunca uma URL pública.
- **Subir:** `next.config` já tem `serverActions.bodySizeLimit: "20mb"` para as fotos. Para 20 MB de
  PDF mais o envelope do `multipart`, ou sobe o limite para `24mb` e mantém Server Action, ou faz um
  Route Handler de upload que grava em stream — decisão do Code na pesquisa; o critério é não
  segurar 20 MB inteiros na memória por requisição.
- **Remover:** tira a linha e o arquivo do disco (é o único "apagar" do módulo; anexo é cópia de
  algo que o fornecedor tem). Pede confirmação dizendo o nome.
- **Tabela de preços vigente:** a mais recente por `vale_desde` (ou `criado_em` quando vazio) entre
  os anexos `tipo = tabela`. A ficha mostra "Última tabela de preços: <nome> · vale desde dd/mm/aa"
  e um selo **"tem mais de 4 meses — pedir a nova?"** quando passou de 120 dias; "recente" senão.
  Sem tabela: "Sem tabela de preços ainda. Subir a primeira".
- Ao escolher o arquivo, o nome do anexo vem do nome do arquivo (sem extensão) e PDF cai como
  `tabela` com `vale_desde = hoje`; a pessoa troca se quiser. Quem subiu e quando aparece na linha.

## 4. O único vínculo: a despesa do Financeiro

- `documentos` ganha `fornecedor_id` **anulável** (FK para `fornecedores`, `on delete` não se
  aplica porque não há delete). Na tela de **Despesa** (todos os modos, incluindo Compra de
  material), um campo **opcional "Fornecedor"** — seletor com busca, só ativos, "nenhum" por padrão.
  Despesa já lançada pode ganhar ou trocar o fornecedor pela edição que a despesa já tem (se tiver;
  se a despesa não é editável hoje, fica para o Polimento e o campo vale só no lançamento).
- A ficha do fornecedor mostra **"Compras dele"**: as despesas não canceladas com aquele
  `fornecedor_id`, mais recentes primeiro — descrição, data, tipo, itens (quando compra de
  material) e valor — e a linha "Total em <ano>: R$ X · N despesas". Lê do Financeiro; **nenhuma
  tabela nova, nenhum número novo.**
- Nada retroativo: despesas antigas ficam sem fornecedor. O Comparador de compras, o Estoque e o
  Catálogo **não** apontam para fornecedor nesta fase.

## 5. Interface (como no protótipo)

Sub-aba "Fornecedores" ao lado de Catálogo · Categorias · Contas fixas · Taxas · Parâmetros. No
computador, lista à esquerda e ficha à direita; no celular, a lista, e a ficha abre abaixo (rolagem)
ou como folha. Ficha: nome e selos (`vende` em etiquetas, área), "Última tabela de preços", cartões
de contato, Observações, Anexos (ícone por tipo, nome, tipo, vale desde, tamanho, quem/quando,
nota; "Abrir" e "tirar"), "Compras dele", rodapé "Cadastrado em … Fornecedor não se apaga".
Folhas: "Novo/Editar fornecedor" (campos da §2), "Novo anexo" (zona de escolher/arrastar, prévia de
foto, nome, tipo, vale desde, nota), confirmações de desativar e de tirar anexo. Toasts como o resto.
Alvos de 44 px; sem rolagem lateral a 320 px.

## 6. Técnica, no padrão da casa

Server Actions com Zod (ou o Route Handler do upload, §3), `verificar-acoes` passando, dinheiro
inteiro em centavos onde aparecer (só leitura), `revoke delete` na tabela de fornecedores,
e2e para: cadastrar, buscar por material, subir PDF e foto, limite de tamanho recusado, tipo
recusado, abrir anexo com e sem sessão (401), tirar anexo, desativar/reativar, despesa com
fornecedor aparecendo em "Compras dele". Testes unitários para "tabela vigente" e "mais de 4 meses".
Roteiro de operação curto: criar a pasta, permissões, conferir que o backup a inclui, `db:migrate`
(uma migração: duas tabelas + a coluna em `documentos`). `/api/health/fornecedores` opcional.

## 7. Fora desta fase

Compartilhar direto do celular · versionamento de arquivo · ler a tabela e virar preço · vínculo com
Estoque, Catálogo, Cotações ou Produção · fornecedor como "pessoa" do Financeiro · histórico de
preço por item · lembrete automático de tabela vencida (o selo basta).

## 8. Em aberto para o `/gsd-discuss-phase` (com recomendação)

1. Upload por Server Action com `bodySizeLimit` 24mb **ou** Route Handler em stream — recomendado o
   que for mais simples de testar no e2e; o critério é memória por requisição.
2. Despesa já lançada pode receber fornecedor depois? Recomendado: sim, se a edição de despesa já
   existir; senão, só no lançamento, e anotar no Polimento.
3. "Compras dele" soma por ano corrente ou por 12 meses? Recomendado: ano corrente, com o ano no
   texto.
