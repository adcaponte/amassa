---
phase: 05-agenda
plan: 04
subsystem: agenda
status: complete
tags: [agenda, clientes, cadastros, pessoas, homonimo, d-01, d-16, age-06]
requires:
  - "05-01: a tabela clientes, nome_normalizado() e o índice não único da 0026; lib/agenda/{abas,textos,consultas}"
  - "05-03: a página /gestao/agenda com semana/mês, BarraDaAgenda, FolhaLancar e loading.tsx"
provides:
  - "lib/clientes/ (o cadastro transversal, D-01): esquemas (esquemaCliente, esquemaEdicaoDeCliente), textos, lista (puro: escaparPadraoDeBusca, quantosDaUrl, buscaDaUrl, subLinhaDaPessoa, QUANTOS_POR_VEZ), consultas (listarClientes, obterCliente, buscarHomonimos), acoes (criarCliente, editarCliente, ResultadoDoCadastro, Homonimo)"
  - "Cadastros → Clientes (?sub=clientes): ListaClientes, EsqueletoDosClientes; SubCadastros com clientes; ROTULO_SUB_CLIENTES"
  - "FormularioCliente (contexto agenda|cadastros, aoUsarExistente) e AvisoHomonimo — o formulário que o seletor de pessoa do plano 05 reaproveita"
  - "useBuscaNaUrl (components/amassa/clientes/usar-busca-na-url.ts) — a busca de 300 ms pela URL das duas telas"
  - "lib/agenda: abaDaAgendaDaUrl (agenda|pessoas), buscaDaUrl, pessoaDaUrl, ABAS_DA_AGENDA; ultimasVindas(clienteId, hoje); frases de Pessoas e da ficha"
  - "AbasDaAgenda, ListaPessoas (FichaDoServidor), EsqueletoDasPessoas, FichaPessoa (ConteudoDaFicha)"
  - "clientesComNome (tests/e2e/apoio/semear-agenda.ts)"
  - "data-testid: abas-da-agenda, aba-{agenda|pessoas}, lista-pessoas, pessoa-linha (data-cliente-id), pessoa-sub-linha, busca-pessoa, mais-pessoa, pessoas-vazio, pessoas-sem-resultado, pessoas-carregando, ficha-pessoa (data-cliente-id), ficha-telefone, ficha-editar, ficha-vinda, ficha-sem-vindas, ficha-erro, ficha-carregando, ficha-pronto, formulario-cliente, cliente-{nome|telefone|salvar|voltar}, cliente-erro-{nome|telefone|geral}, aviso-homonimo, homonimo, criar-outra-pessoa, lista-clientes, cliente-linha (data-cliente-id), cliente-linha-telefone, novo-cliente, busca-cliente, clientes-vazio, clientes-sem-resultado, clientes-carregando, cadastros-sub-clientes"
affects:
  - "Cadastros: seis sub-abas (3 + 3 abaixo de 768px), contêiner md:max-w-xl; loading.tsx de Cadastros redesenhado 3 + 3"
  - "Agenda: as abas aparecem acima de toda a página; o conteúdo da aba Agenda desceu de pt-4 para pt-6 (24px abaixo das abas)"
tech-stack:
  added: []
  patterns:
    - "Ação que devolve uma PERGUNTA sem gravar ({ ok: false, erro: null, homonimos }) — a tela decide e manda de novo com a confirmação"
    - "Lista do servidor com Suspense sem key: digitar na busca é transição, a lista velha fica até a nova chegar e o campo não perde o foco"
key-files:
  created:
    - lib/clientes/esquemas.ts
    - lib/clientes/textos.ts
    - lib/clientes/lista.ts
    - lib/clientes/consultas.ts
    - lib/clientes/acoes.ts
    - components/amassa/clientes/formulario-cliente.tsx
    - components/amassa/clientes/aviso-homonimo.tsx
    - components/amassa/clientes/usar-busca-na-url.ts
    - components/amassa/cadastros/lista-clientes.tsx
    - components/amassa/agenda/abas-da-agenda.tsx
    - components/amassa/agenda/lista-pessoas.tsx
    - components/amassa/agenda/ficha-pessoa.tsx
    - tests/unit/clientes-esquemas.test.ts
    - tests/unit/clientes-lista.test.ts
    - tests/e2e/cadastros-clientes.spec.ts
    - tests/e2e/agenda-pessoas.spec.ts
  modified:
    - lib/cadastros/abas.ts
    - lib/cadastros/textos.ts
    - app/gestao/(app)/cadastros/page.tsx
    - app/gestao/(app)/cadastros/loading.tsx
    - components/amassa/cadastros/sub-abas-cadastros.tsx
    - lib/agenda/abas.ts
    - lib/agenda/textos.ts
    - lib/agenda/consultas.ts
    - app/gestao/(app)/agenda/page.tsx
    - app/gestao/(app)/agenda/loading.tsx
    - tests/unit/cadastros-abas.test.ts
    - tests/unit/agenda-abas.test.ts
    - tests/e2e/apoio/semear-agenda.ts
decisions:
  - "O aviso de homônimo ao EDITAR só aparece quando o nome normalizado muda — corrigir o telefone de quem tem homônimo não pergunta de novo"
  - "“Usar {nome} que já existe” em Cadastros fecha o formulário e filtra a lista por aquele nome (a decisão que o plano pedia)"
  - "Últimas vindas = inscrições de hoje para trás, em datas não canceladas; data futura não é vinda"
  - "A validação do formulário de pessoa é só do servidor (uma ida), para o e2e provar a recusa do servidor"
metrics:
  duration: "~20 min (18:32 → 18:52, 01/10/2026, relógio desta máquina)"
  completed: 2026-10-01
  tasks: 2
  files: 29
actuals:
  tokens: 27750
  tasks: 2
  commits: 3
---

# Phase 5 Plan 04: o cadastro de clientes e a aba Pessoas — Summary

**O cadastro de pessoas que a §4 do briefing pressupunha agora existe, num lugar só (`lib/clientes/`),
com duas telas. Em Cadastros → Clientes e na Agenda → Pessoas, a mesma tabela `clientes` e o mesmo
formulário. A busca acha “João” digitando “joao”, por pedaço do nome, com o termo escapado e passado
como parâmetro. Cadastrar um nome que já existe não grava: o formulário mostra quem já existe, com o
telefone, e o gestor escolhe “Usar … que já existe” ou “Criar outra pessoa”. Nada se apaga. A Agenda
ganhou as abas (Agenda · Pessoas) e a ficha da pessoa com as últimas vindas.**

## O que foi feito

### Tarefa 1: o cadastro de clientes em Cadastros (commits `41483e5` RED, `a0e6058` GREEN)

- **`lib/clientes/` (D-01).**
  - `esquemas.ts`: nome aparado de 1 a 160 caracteres, contados em pontos de código. Telefone
    opcional de até 40, e vazio vira `null`. `confirmarHomonimo` é opcional, e a edição exige o id
    em uuid.
  - `lista.ts` é puro, e um teste lê o arquivo para provar que não tem import.
  - `consultas.ts` não tem a diretiva de Server Action.
    - `listarClientes` filtra com `nome_normalizado(nome) like '%' || nome_normalizado($1) || '%'
      escape '\'`. Ordena por nome normalizado, desempata pelo id e pede `limit quantos + 1` para
      saber se há mais.
    - `buscarHomonimos` compara por igualdade e aceita uma transação.
  - `acoes.ts`: `criarCliente` e `editarCliente`, cada uma com `exigirUsuario()` primeiro. O
    `verificar-acoes` passou de 91 para 93 ações.
    - Havendo homônimo sem confirmação, a ação devolve `{ ok: false, erro: null, homonimos }` e não
      grava nada.
    - `editarCliente` trava a linha com `for no key update`. Se o cadastro sumiu, responde “Esse
      cadastro não existe mais…”.
    - As duas revalidam `/gestao/cadastros` e `/gestao/agenda`. Nenhuma ação apaga cliente.
- **Cadastros.**
  - `subDaUrl("clientes")`. “Clientes” é a terceira pílula da primeira fileira (3 + 3), e o
    contêiner é `md:max-w-xl`. Corrigi o comentário do componente, que ainda falava em cinco
    pílulas.
  - A sub-aba carrega num `Suspense` próprio, com o esqueleto dela (busca + 6 linhas). Ela tem
    também um `try` próprio: se a leitura falhar, só a sub-aba mostra “Não deu para carregar os
    clientes…” + “Tentar de novo”.
- **`FormularioCliente`** é um diálogo de tela toda no celular. A prop `contexto` (`agenda` ou
  `cadastros`) escolhe o título e o botão: “Pessoa nova”/“Salvar pessoa” ou “Novo cliente”/“Salvar
  cliente”; editando, “Editar {nome}” nos dois.
  - O erro aparece embaixo do campo e o foco vai para o primeiro campo com erro.
  - “Salvando…” fica `disabled`, e uma guarda síncrona impede o toque duplo.
- **`AvisoHomonimo`** é uma região `role=status` `aria-live=polite` que existe sempre. Usa a caixa
  `atencao` sobre `atencao-fundo` (o par A1, já medido) e mostra uma linha por homônimo.
  - Ao criar: “Usar {nome} que já existe” em cada linha e “Criar outra pessoa” embaixo.
  - Ao editar: só o aviso, e o primário vira “Salvar mesmo assim”.

### Tarefa 2: a aba Pessoas da Agenda (commit `2a7034e`)

- **Abas e URL.**
  - `abaDaAgendaDaUrl` aceita só `agenda` e `pessoas`. `receber`, `numeros` e `site` caem em
    `agenda` até os planos 11, 14 e 15 os acrescentarem.
  - `buscaDaUrl` usa o mesmo normalizador de `lib/clientes`. `pessoaDaUrl` só aceita uuid.
  - `AbasDaAgenda` é neutra, no molde de `abas-financeiro.tsx`, com `Link` por `?aba=`, setas,
    Home e End.
  - O `loading.tsx` mostra as abas reais. Como ele não recebe a URL, a aba marcada vem do endereço.
- **`ListaPessoas`** é um bloco `superficie`.
  - Cabeçalho “Pessoas” e “+ Pessoa”, busca de 300 ms e 50 por vez.
  - Cada linha tem a sub-linha de `subLinhaDaPessoa`, com o telefone e “sem turma fixa”, e o
    “Abrir”.
  - A dica do fim diz que é o mesmo cadastro de Cadastros → Clientes.
  - Vazio: “+ Pessoa” vira o primário e o do cabeçalho some. Busca sem resultado: “Ninguém com esse
    nome.” + “Cadastrar “{busca}””.
  - Salvar uma pessoa nova mostra o toast “Pessoa cadastrada.” e abre a ficha dela. “Usar … que já
    existe” abre a ficha do homônimo.
- **`FichaPessoa`** abre por `?pessoa=`, na hora, com o cabeçalho da linha tocada. A lista de
  baixo chega quando o servidor responde.
  - Mostra o telefone ou “sem telefone”, e “Editar”, que troca a ficha pelo formulário: um diálogo
    por vez.
  - “Últimas vindas” lista até 8, as mais recentes primeiro, com “{dd/mm} · {título}” e a tag
    “veio” (A2) ou “faltou” (A3). Sem nenhuma: “Ainda não veio.”.
  - Enquanto carrega, esqueleto de 4 linhas. Se falhar, o erro aparece dentro da folha com
    “Tentar de novo”.
  - Link velho: o toast “Esse lançamento não existe mais…”, a folha não abre e o parâmetro sai da
    URL.
- `ultimasVindas(clienteId, hoje)` fica em `lib/agenda/consultas.ts`, porque é dado da Agenda e não
  do cadastro.

## Comandos que rodei (e o resultado)

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/clientes-esquemas.test.ts tests/unit/clientes-lista.test.ts tests/unit/cadastros-abas.test.ts` (RED) | falhou como esperado: 3 arquivos, porque os módulos não existiam e `subDaUrl("clientes")` dava `catalogo` |
| o mesmo depois de implementar | **53/53** |
| `npm run verificar` (Tarefa 1) | **verde**: 104 arquivos / 1976 testes, `verificar-acoes` 93 ações e 0 violações, `test:migracoes` “Todas as afirmações passaram.” |
| `npm run test:e2e -- --grep "cadastros clientes\|cadastros base"` | **69 passed, 1 failed (1.2m)**. O (d) falhou no desktop: o toast “Cadastro salvo.” da edição anterior ainda estava na tela, o teste esperou por ele e leu o banco antes de a segunda gravação terminar. Era defeito do teste. Corrigi esperando o formulário fechar, porque ele só fecha depois de o servidor gravar. `cadastros base` ficou verde nos dois projetos |
| `npx vitest run tests/unit/agenda-abas.test.ts` | **25/25** |
| `npm run verificar` (Tarefa 2) | **verde**: 104 arquivos / 1988 testes, 93 ações e 0 violações, `test:migracoes` verde. As linhas “1 violação” no log são dos testes do próprio `verificar-acoes` contra os fixtures |
| `npm run test:e2e -- --grep "agenda pessoas\|cadastros clientes\|agenda vistas\|/gestao/agenda não tem violação\|nenhuma das oito rotas exige rolagem"` | **86 passed (1.2m)**. Foram `agenda pessoas` (a)-(f), `cadastros clientes` (a)-(f) com a correção do (d), `agenda vistas`, o axe de `/gestao/agenda` e o 320px da casca, nos dois projetos, mais a cadeia `vazio-*` |

Fiz **duas** invocações de e2e, uma por tarefa, como o orçamento pedia. A segunda serviu também de
prova da correção do teste (d) da Tarefa 1, e aproveitou para cobrir as telas da Agenda que a
mudança de layout podia afetar: as abas novas acima de tudo e o conteúdo que desceu para `pt-6`. Não
rodei `npm run build` separado nem a varredura sem `--grep`, que é do plano 16. O log do servidor
repete `digest: '1591381167'` (“destination stream closed early”), o mesmo ruído que o 05-02 e o
05-03 registraram, e nenhum teste falhou por causa dele.

Greps de aceite:
- `insert(clientes)` em `lib/clientes/acoes.ts`: 1.
- `nome_normalizado` em `consultas.ts`: 4. `escaparPadraoDeBusca`: 2.
- `delete(clientes)|deletarCliente|apagarCliente` em `lib app components`: nada.
- “Partes da Agenda”: 1, em `lib/agenda/textos.ts`. O componente recebe a frase por constante.
- `from "@/lib/clientes` aparece na lista, na ficha e na página da Agenda.
- `insert(clientes)` em `lib/agenda` e `components`: nada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - defeito de teste] O caso (d) de `cadastros clientes` esperava por um toast velho**
- **Found during:** a primeira invocação de e2e da Tarefa 1, só no desktop.
- **Fix:** esperar o formulário fechar antes de ler o banco. A prova veio na segunda invocação, com
  86 passed.
- **Commit:** `2a7034e`. A linha corrigida foi no commit da Tarefa 1, `a0e6058`, antes de commitar.

**2. [Rule 3] Arquivos fora da lista do plano**
- `components/amassa/clientes/usar-busca-na-url.ts`: a busca de 300 ms pela URL aparecia igual nas
  duas listas, então virou um hook compartilhado em vez de cópia.
- `app/gestao/(app)/cadastros/loading.tsx`: o esqueleto e o comentário diziam cinco pílulas numa
  fileira. Agora são 3 + 3, como a tela. Era afirmação de estado desatualizada.
- `tests/e2e/apoio/semear-agenda.ts` ganhou `clientesComNome`, para provar que o aviso não grava e
  que o toque duplo cria uma pessoa só.

**3. [Rule 2] As ações devolvem também o telefone**
- Ao salvar uma pessoa nova, a ficha dela abre na hora com o cabeçalho. Sem o telefone, a ficha
  mostraria “sem telefone” de quem tem telefone até o servidor responder.

**4. `ultimasVindas(clienteId, hoje)` recebe o “hoje”**
- O plano escreve `ultimasVindas(clienteId)`. O “hoje” de Brasília é decidido na página e passado
  para a consulta, como já é feito no resto da Agenda (veja o Decidido 3).

## Decidido sem o Theo

Nada saiu da máquina: o branch é `gsd/phase-05-agenda`, sem push, sem banco nenhum fora do efêmero,
e a `0026` não mudou.

1. **Ao editar, o aviso de homônimo só aparece quando o nome muda** para o de outro cadastro. Corrigir
   o telefone de quem já tem homônimo grava direto. *Desfazer:* em `editarCliente`
   (`lib/clientes/acoes.ts`), tirar o `&& !atual.mesmoNome`.
2. **“Usar {nome} que já existe” em Cadastros fecha o formulário e filtra a lista por aquele nome.**
   O plano já registrava essa decisão; ela fica aqui para o dono ver. *Desfazer:* trocar o
   `aoUsarExistente` em `lista-clientes.tsx`.
3. **“Últimas vindas” só conta datas de hoje para trás**, não canceladas. Uma inscrição futura não
   é vinda, e inscrição sem presença marcada aparece sem tag. *Desfazer:* tirar o
   `lte(eventos.data, hoje)` de `ultimasVindas`.
4. **A validação do formulário de pessoa é só do servidor.** São uma ida e volta e a frase embaixo
   do campo, o que deixa o e2e provar que o servidor recusa nome só com espaços. *Desfazer:* rodar
   `esquemaCliente.safeParse` no `gravar` do formulário antes de chamar a ação.
5. **Frases que a UI-SPEC não fixa:**
   - “Cadastro salvo.” (toast de editar);
   - as dicas “até 160 caracteres” e “até 40 caracteres, do jeito que você escreve”;
   - “Não deu para salvar. Verifique a internet e tente de novo.”;
   - “Ficha da pessoa”, título quando a ficha falha sem a tela saber quem é;
   - o par “Ninguém com esse nome.” + “Cadastrar “{busca}”” também em Cadastros → Clientes.

   *Desfazer:* `lib/clientes/textos.ts` e `lib/agenda/textos.ts`.
6. **O campo de busca de Cadastros usa o mesmo rótulo da Agenda** (`aria-label` “Buscar pessoa”,
   placeholder “Buscar pelo nome”), porque a UI-SPEC diz “busca igual à de Pessoas”. *Desfazer:*
   `ARIA_BUSCAR_PESSOA` em `lista-clientes.tsx`.
7. **No máximo 10 homônimos no aviso**, os mais antigos primeiro. *Desfazer:* `TETO_DE_HOMONIMOS`
   em `lib/clientes/consultas.ts`.
8. **As abas da Agenda são links:** as setas movem o foco e o Enter navega, porque trocar de aba é
   navegação de página. No alternador “Semana · Mês” do 05-03, a seta já navega. *Desfazer:*
   `aoTeclar` em `abas-da-agenda.tsx`.

## Para o dono olhar no portão (plano 16)

Itens da verificação de reserva (backstop), não automatizados:
- **E12/E13·long-text:** um nome de 160 caracteres a 320px, na lista de Pessoas e no título da
  ficha. O “Abrir”, o “Editar” e o fechar precisam continuar inteiros, com 44px.
- **E22·loading:** `?sub=clientes` com a rede lenta deve mostrar o esqueleto (busca + 6 linhas).
- **E22·error:** com o banco derrubado, deve aparecer “Não deu para carregar os clientes…” +
  “Tentar de novo”.
- **E22·zero-one-many:** com 50 e 51 clientes, “Mostrar mais 50” só pode aparecer no segundo caso.
- **E22·long-text:** a pílula “Clientes” a 320px. O e2e (f) já mede que ela fica numa linha só e na
  primeira fileira. “Categorias”, ao lado, também cabe? Vale olhar no Android real.

## Known Stubs

Nenhum que impeça o objetivo do plano. Três faltas são de propósito e cada uma já tem dono:
- A sub-linha sempre passa `turmas: []`, então mostra “sem turma fixa”. As turmas entram no plano 07.
- As tags “{n} a repor” e “{n} a receber” e os quadros A REPOR / A RECEBER da ficha entram nos
  planos 08 e 11.
- “Turmas fixas” na ficha entra no plano 07.

Os comentários do código dizem isso.

## Threat Flags

Nenhuma superfície além do `threat_model`:
- **T-05-18:** as duas ações novas têm `exigirUsuario()` primeiro (93 no portão), e as duas páginas
  chamam `exigirUsuario()` antes de ler.
- **T-05-19:** o termo vai como parâmetro, escapado por `escaparPadraoDeBusca` (testado), sem
  concatenação.
- **T-05-20:** `clientes` só é lido por rotas de `/gestao`.
- **T-05-21:** não há ação de apagar.
- **T-05-22:** aceito.

## TDD Gate Compliance

- Tarefa 1: `test(05-04)` `41483e5` (RED) → `feat(05-04)` `a0e6058` (GREEN).
- Tarefa 2: não era `tdd`. Os casos novos de `agenda-abas.test.ts` foram no commit único `2a7034e`.

## Self-Check: PASSED

- Os 16 arquivos novos estão presentes: `lib/clientes/*` (5), `components/amassa/clientes/*` (3),
  `lista-clientes.tsx`, `abas-da-agenda.tsx`, `lista-pessoas.tsx`, `ficha-pessoa.tsx`, os dois
  unitários e as duas specs.
- Os commits `41483e5`, `a0e6058` e `2a7034e` estão no branch `gsd/phase-05-agenda`. Não houve push
  nem merge.
- `STATE.md`, `ROADMAP.md` e `REQUIREMENTS.md` não foram tocados: `git diff 046cbde..HEAD` nesses três
  arquivos não lista nada.
