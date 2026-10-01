---
phase: 05-agenda
plan: 10
subsystem: agenda
status: complete
tags: [agenda, uso-livre, material, estoque, age-14, age-13, age-20, d-06, d-14]
requires:
  - "05-01: usos_livres_material (checks incluso sem preço, preço junto, cobrado baixado tem preço, movimentacao_id único), destino uso_livre e movimentacoes_estoque.uso_livre_id com os dois checks em texto"
  - "05-09: travarUsoLivre, encerrarUsoLivre, FolhaUsoLivre, valorDoMaterial, travarItemDaHora"
  - "Fase 06: pedidoDeSaidaManual, gravarMovimentacoes, travarItens, textoParaMilesimos, SeletorMaterial, ProvedorDoEstoque/CarregadorDoSeletor"
provides:
  - "lib/estoque/pedidos.ts: PedidoDeMovimentacao.usoLivreId; pedidoDeSaidaManual({ …, usoLivreId }) — só no destino uso_livre, obrigatório nele (RangeError)"
  - "lib/estoque/gravacao.ts: gravarMovimentacoes grava uso_livre_id"
  - "lib/agenda/uso-livre.ts: valorDaLinhaDeMaterial, materialCobradoDaLista, LinhaDeMaterialNaConta"
  - "lib/agenda/consultas.ts: MaterialDoUso, materiaisDoUso(usoLivreId, leitor), precosDeVendaDoEstoque(); UsoLivreCarregado.materiais e .precosDeVenda"
  - "lib/agenda/gravacao.ts: baixarMaterialDoUso(tx, uso, materiais, registradoPor), MaterialParaBaixar, MaterialBaixado"
  - "lib/agenda/esquemas.ts: esquemaAcrescentarMaterial, esquemaDefinirCobrancaDoMaterial, esquemaTirarMaterial"
  - "lib/agenda/acoes.ts: acrescentarMaterial, definirCobrancaDoMaterial, tirarMaterial; encerrarUsoLivre com material (UsoEncerrado ganha materialCobradoCentavos e materiaisBaixados) — 108 → 111 ações no portão"
  - "lib/agenda/textos.ts: as frases do material; toastUsoEncerrado(h, valor, { cobrado, baixado }); linhaEncerrado(h, materiais); contagemDeMateriais"
  - "components/amassa/agenda: MaterialDoUsoLivre, ConfirmarTirarMaterial"
  - "data-testid: material-do-uso, material-nenhum, material-linha (data-material-id), material-valor, material-linha-erro, material-acrescentar, escolher-material, material-escolhido, trocar-material, material-quanto, material-cobrar, material-incluso, material-sem-preco, material-erro, mais-material, tirar-material, confirmar-tirar-material(-sim|-nao|-erro), uso-conta-material"
  - "tests/e2e/apoio/semear-agenda.ts: semearMaterialDoUso, definirPrecoDeVendaDoItem, semearMaterialNoUso, materiaisDoUsoNoBanco, saidasDoUsoNoBanco"
affects:
  - "A semana da Agenda passa a ficar dentro de um ProvedorDoEstoque; o CarregadorDoSeletor só roda com um uso NO ESPAÇO aberto"
  - "O Estoque recebe saídas no destino uso_livre (área Espaço): a barra “Uso livre do espaço” do “Para onde foi” e a linha do histórico passam a ter dado"
tech-stack:
  added: []
  patterns:
    - "A baixa de outro módulo pela porta única do livro: pedidoDeSaidaManual + gravarMovimentacoes na transação de quem chama, ordem USO LIVRE → ITENS"
    - "O seletor “Qual material?” da 06 aberto POR CIMA da folha (diálogo aninhado), para a folha não perder o que foi digitado"
key-files:
  created:
    - components/amassa/agenda/material-do-uso-livre.tsx
    - components/amassa/agenda/confirmar-tirar-material.tsx
    - tests/e2e/agenda-material.spec.ts
  modified:
    - lib/estoque/pedidos.ts
    - lib/estoque/gravacao.ts
    - tests/unit/estoque-pedidos.test.ts
    - lib/agenda/textos.ts
    - lib/agenda/esquemas.ts
    - lib/agenda/consultas.ts
    - lib/agenda/gravacao.ts
    - lib/agenda/acoes.ts
    - lib/agenda/uso-livre.ts
    - tests/unit/agenda-uso-livre.test.ts
    - components/amassa/agenda/folha-uso-livre.tsx
    - app/gestao/(app)/agenda/page.tsx
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "A linha de acrescentar nasce em “Incluso”: cobrar é sempre um toque de quem decide"
  - "“ + material” no toast só quando há material COBRADO; “ Estoque baixado.” quando alguma linha saiu do Estoque"
  - "A linha “Horas cheias” mostra só a parte das horas no “= {R$}”; o “Valor” soma o material"
  - "A nota congelada corta o NOME (não a data) para caber nos 160 caracteres do check"
  - "O seletor de material abre por cima da folha do uso, não no lugar dela"
metrics:
  duration: "~20 min (21:25 → 21:45, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 2
  files: 16
actuals:
  tokens: 27500
  tasks: 2
  commits: 4
---

# Phase 5 Plan 10: o material do uso livre sai do Estoque ao encerrar — Summary

**Na folha do uso livre, o gestor lista o material que a pessoa usou: escolhe o item pelo seletor
“Qual material?” do Estoque, diz quanto e marca “Cobrar” ou “Incluso”. “Cobrar” só aparece se o item
tem preço de venda. Nada sai do Estoque antes de encerrar. Ao encerrar, cada linha vira uma saída no
livro do Estoque, numa só transação com o encerramento. Isso vale também para as linhas “incluso”. O
destino é “Uso livre do espaço”, a área é o Espaço, e a saída fica ligada ao uso. O preço de venda das
linhas cobradas fica congelado e entra no valor.**

## O que foi feito

### Tarefa 1: o livro do Estoque aceita a saída do uso livre (commits `769ce54` RED, `266efa0` GREEN)

- `PedidoDeMovimentacao` ganhou `usoLivreId`. `pedidoDeSaidaManual` só o põe no destino `uso_livre`
  e o descarta nos outros, como faz com o `encomendaId`. No destino `uso_livre`, o vínculo é
  obrigatório: sem ele, a função lança `RangeError` antes do check
  `movimentacoes_estoque_destino_uso_livre_com_vinculo` da 0026.
- `gravarMovimentacoes` grava `uso_livre_id`. A área sai de `areaDoDestino` (`espaco`).
- 4 testes novos em `estoque-pedidos.test.ts`:
  - o pedido completo;
  - o descarte fora do destino `uso_livre`;
  - o `RangeError` sem vínculo (ausente ou nulo);
  - a encomenda e o `materialDaOrdem` nunca entram no destino `uso_livre`.

### Tarefa 2: o material na folha e a baixa no encerramento (commit `7eb09c9`)

**Servidor.** As quatro ações começam por `exigirUsuario()`. O portão passou de 108 para 111 ações,
com 0 violações.

- **`acrescentarMaterial`**:
  1. trava o uso (`for no key update`) e só aceita um uso `no_espaco`;
  2. confere o item: precisa existir com estoque próprio e estar ativo; para cobrar, precisa ter preço
     de venda, senão volta a frase da D-14;
  3. insere a linha.

  A quantidade passa pela mesma `textoParaMilesimos` da saída manual da Fase 06. O mesmo item pode
  entrar em duas linhas.
- **`definirCobrancaDoMaterial`** grava o estado desejado, sem toast, e segue a mesma regra de preço.
- **`tirarMaterial`** trava o uso e apaga a linha com
  `delete … where id and uso_livre_id and movimentacao_id is null`. Linha já baixada nunca se apaga.
- **`encerrarUsoLivre`**: depois de calcular as horas, e ainda sob a trava do uso, lê as linhas sem
  baixa e chama `baixarMaterialDoUso`. Essa função fica em `gravacao.ts`, sem a diretiva `"use server"`,
  e faz quatro coisas:
  1. trava os ITENS;
  2. recusa item que sumiu, foi desativado ou é cobrado e perdeu o preço;
  3. monta um `pedidoDeSaidaManual({ destino: "uso_livre", usoLivreId, nota: "{nome} · {dd/mm}" })` por
     linha;
  4. chama `gravarMovimentacoes`.

  Depois disso, `encerrarUsoLivre`:
  - grava `valor = horas × pessoas × preço da hora + Σ material cobrado`;
  - preenche `movimentacao_id`, o preço congelado e o valor de cada linha;
  - revalida também `/estoque`.

  Se qualquer passo falhar, nada é gravado.
- `obterUsoLivre` passou a trazer `materiais` (com o preço de venda de agora, para a prévia) e
  `precosDeVenda` (que decide se a linha de acrescentar mostra “Cobrar”).

**Tela.**

- `MaterialDoUsoLivre` aparece na folha entre “Chegou às” e “Saiu às”. Tem:
  - o `h3` “Material usado”;
  - as linhas “{q} {un} · {nome}” … “{R$}” ou “incluso”, com o segmentado “Cobrar · Incluso” por linha
    e o “tirar” de 44px;
  - “nenhum” quando a lista está vazia;
  - a linha de acrescentar, que quebra em linhas no celular: “Escolher material” (52px), “Quanto”
    (`inputmode=decimal`, “em {un}”), “Cobrar · Incluso” e “+ Material”;
  - a dica da D-06.
- `ConfirmarTirarMaterial` usa os textos da UI-SPEC.
- A conta ganhou “Material cobrado” (só quando existe), e o “Valor” passou a somá-lo.
- No uso encerrado aparecem “Encerrado · {h} h · estoque baixado (1 material / {n} materiais)” e a
  lista só de leitura.
- A página envolve a semana num `ProvedorDoEstoque`. O `CarregadorDoSeletor` da 06 só roda quando há um
  uso no espaço aberto.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/estoque-pedidos.test.ts` (RED) | falhou como esperado: 3 falhas em 36 |
| `npx vitest run tests/unit/estoque-pedidos.test.ts tests/unit/estoque-destinos.test.ts` (GREEN) | **42/42** |
| `npm run verificar` (Tarefa 1) | saiu 0 (`test:migracoes`: “Todas as afirmações passaram.”) |
| `npx vitest run tests/unit/agenda-uso-livre.test.ts` | **35/35** (5 casos novos da conta do material) |
| `npx tsc --noEmit`, `npx eslint` nos arquivos tocados, `npm run verificar-acoes` | limpos; **111 ações**, 0 violações |
| `npm run verificar` (Tarefa 2) | **saiu 0**: 111 arquivos / **2148** testes, 111 ações, `test:migracoes` verde |
| `npm run test:e2e -- --grep "agenda material"` (Tarefa 2) | **62 passed (1.1m)**: casos (a)-(e) × desktop e celular, mais a cadeia `vazio-*` |

Fiz **uma** invocação de e2e, dentro do orçamento. A Tarefa 1 é só de teste unitário. Não rodei
`npm run build` separado nem a varredura completa sem `--grep`, que fica para o plano 16. As linhas
`[WebServer] ⨯ Error: The destination stream closed early.` do log já aparecem nos logs de e2e do plano
08 e não vêm deste plano.

Greps de aceite:
- `usoLivreId` em `lib/estoque/pedidos.ts`: **6**; em `lib/estoque/gravacao.ts`: **1**. São 7 no total;
  o aceite pedia 4 ou mais.
- `insert(movimentacoesEstoque)` em `lib/agenda`: **0**.
- `gravarMovimentacoes` em `lib/agenda/gravacao.ts`: **5**; `pedidoDeSaidaManual`: **3**;
  `"use server"`: **0**.
- “Cadastre o preço de venda em Cadastros para poder cobrar” em `textos.ts`: **1**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2] A nota congelada podia passar dos 160 caracteres do check**
- **Issue:** a nota é “{nome} · {dd/mm}”. O nome da pessoa pode ter 160 caracteres, e o check
  `movimentacoes_estoque_nota_comprimento` aceita até 160. Com um nome longo, o encerramento falharia
  inteiro, e o backstop E30·long-text usa justamente um nome de 160 caracteres.
- **Fix:** `notaDoUsoLivre` corta o NOME em pontos de código, como conta o `length()` do Postgres, para
  a data sempre caber.
- **Commit:** `7eb09c9`.

**2. [Rule 3] Arquivos fora da lista do plano**
- `app/gestao/(app)/agenda/page.tsx`: precisava do `ProvedorDoEstoque` e do `CarregadorDoSeletor`. Sem
  eles, o seletor “Qual material?” da 06 não tem lista. É o mesmo molde da página da Produção.
- `lib/agenda/uso-livre.ts` e `tests/unit/agenda-uso-livre.test.ts`: `valorDaLinhaDeMaterial` e
  `materialCobradoDaLista` são regra de negócio. O CLAUDE.md as manda para o módulo puro e testado, e
  não para o componente.

**3. Nomes e formas**
- `UsoEncerrado` ganhou `materialCobradoCentavos` e `materiaisBaixados`, que o toast usa.
- `toastUsoEncerrado` e `linhaEncerrado` ganharam parâmetros opcionais. As chamadas e os e2e do plano 09
  (sem material) continuam iguais.
- `encerrarUsoLivre` captura `usuario` de `exigirUsuario()`, que continua sendo a primeira instrução,
  porque o livro grava `registrado_por`.

Nenhuma migração e nenhum pacote novo. A `0026`, `db/schema.ts` e `TABELAS_ESPERADAS` não mudaram: a
tabela `usos_livres_material`, o valor `uso_livre` e `uso_livre_id` já existiam desde o plano 01.

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, e nenhum banco foi usado além do
efêmero.

1. **A linha de acrescentar nasce em “Incluso”.** Nem a UI-SPEC nem o BRIEFING §6 dão padrão. Cobrar
   por descuido é pior que esquecer de cobrar, e cobrar custa um toque. *Desfazer:* `useState(false)` de
   `cobrar` em `LinhaDeAcrescentar` (`material-do-uso-livre.tsx`).
2. **O toast diz “ + material” só quando há material COBRADO** (é o que está dentro do valor), e diz
   “ Estoque baixado.” quando alguma linha saiu do Estoque, cobrada ou inclusa. *Desfazer:*
   `toastUsoEncerrado` em `textos.ts`.
3. **Na linha “Horas cheias”, o “= {R$}” é só a parte das horas**, e o “Valor” soma o material.
   Antes do material os dois números eram iguais. *Desfazer:* `valorDasHoras` em `folha-uso-livre.tsx`.
4. **O seletor “Qual material?” abre por cima da folha do uso, num diálogo aninhado.** Na Produção ele
   abre no lugar da folha. Aqui a folha guarda o “Chegou às” e o “Saiu às” digitados; trocar a folha
   pelo seletor desmontaria tudo isso. *Desfazer:* `seletorAberto` em `LinhaDeAcrescentar`.
5. **O `ProvedorDoEstoque` envolve sempre a semana, e o carregador só roda com um uso no espaço
   aberto.** Assim a árvore não muda de forma ao abrir e fechar a folha, e a Agenda não lê o Estoque à
   toa. *Desfazer:* `VistaDaSemana` em `page.tsx`.
6. **No servidor, a quantidade inválida volta com a frase da 06** (“Digite a quantidade — por
   exemplo, 2 ou 0,5.”). A tela, que conhece a unidade, troca pela frase “Digite a quantidade em {un} —
   …” da UI-SPEC, como faz a folha de baixa da Produção.
7. **Uma linha cobrada cujo item perdeu o preço mostra as duas opções**, para dar para voltar a
   “Incluso”. Ela mostra também a dica da D-14, e o encerramento recusa com a frase do plano.
8. **No uso encerrado, o bloco “Material usado” aparece mesmo sem material**, com “nenhum”.
9. **Frases que a UI-SPEC não fixa:**
   - “Não deu para acrescentar o material. Verifique a internet e tente de novo.”;
   - “Não deu para mudar a cobrança do material. Toque de novo.”;
   - “Não deu para tirar o material. Verifique a internet e tente de novo.”;
   - os rótulos “Acrescentando…”, “Tirando…” e “Trocar”;
   - `aria-label` “Cobrar este material?” no segmentado.

   Também sem frase própria na UI-SPEC: tirar ou mudar uma linha que já não existe dá “Isso já tinha
   sido removido.”, e tirar de um uso já encerrado dá “Este uso livre já foi encerrado…”. *Desfazer:*
   `lib/agenda/textos.ts` e `lib/agenda/acoes.ts`.
10. **O e2e semeia o saldo de partida com UMA entrada manual direto no banco** (`semearMaterialDoUso`).
    É a mesma exceção de `semearMovimentacoesEmMassa`, e serve para o custo médio do momento ser
    conhecido (1,2 kg a R$ 5,00 = R$ 6,00). A saída que se prova é a da tela.

## Para o dono olhar no portão (plano 16)

- Os quatro backstops do plano, conferidos a olho:
  - **E9 overflow:** 8 materiais a 320px, com a linha de acrescentar quebrando e o rodapé preso;
  - **E9 long-text:** nome de material com 120 caracteres;
  - **E30 long-text:** histórico do Estoque com um nome de 160 caracteres;
  - **E9 zero-one-many:** a regra “1 material”/“{n} materiais” já é provada no e2e (a) e (b), e “1 h ×
    R$” no (d).
- A dica de encerrar (“…matéria-prima é a lista acima.”) agora tem a lista acima dela.

## Known Stubs

Nenhum que impeça o objetivo do plano. Ficam para planos já marcados:
- a tag de pagamento na linha “Encerrado · …” (plano 11);
- “Recebi agora” e “Lançar na Venda”, com o material cobrado entrando como linha LIVRE na categoria do
  “Uso livre (hora)” (planos 11 e 12). Este plano não cria venda nenhuma.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-46:** as três ações novas e `encerrarUsoLivre` começam por `exigirUsuario()`. São 111 ações e
  0 violações.
- **T-05-47:** nenhum esquema aceita preço, valor ou custo. O preço é lido do Catálogo e congelado no
  servidor, e “cobrar” sem preço é recusado. O e2e (e) muda o preço depois e o valor gravado não muda.
- **T-05-48:** a trava do uso, o `update … and estado = 'no_espaco'` e o `movimentacao_id` único. O
  material cobrado nunca vira linha de item numa venda: este plano não toca na venda.
- **T-05-49:** `pedidoDeSaidaManual` exige o vínculo, a área vem de `areaDoDestino`, e há os checks em
  texto da 0026.
- **T-05-50:** nenhuma ação apaga movimentação, e `tirarMaterial` só apaga linha sem baixa.

## TDD Gate Compliance

- Tarefa 1: `test(05-10)` `769ce54` (RED, 3 falhas) → `feat(05-10)` `266efa0` (GREEN). Sem refatoração.
- Tarefa 2: não era `tdd`. Um commit, `7eb09c9`.

## Self-Check: PASSED

- Os três arquivos novos estão presentes: `material-do-uso-livre.tsx`, `confirmar-tirar-material.tsx` e
  `agenda-material.spec.ts`.
- Os commits `769ce54`, `266efa0` e `7eb09c9` estão no branch `gsd/phase-05-agenda`. Não houve push nem
  merge, e nenhum commit apagou arquivo: `git diff --diff-filter=D 8c5236a HEAD` não lista nada.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados.
