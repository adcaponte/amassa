---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 06
current_phase_name: Estoque
status: executing
stopped_at: "Fase 06 Estoque: plano 06-05 concluido em 29/09 no branch gsd/phase-06-estoque. Proximo: 06-06."
last_updated: "2026-09-29T05:57:16.692Z"
progress:
  total_phases: 12
  completed_phases: 11
  total_plans: 97
  completed_plans: 91
last_activity: 2026-09-29
last_activity_desc: "Fase 04.6, PLANO 08 (o portao da fase) CONCLUIDO em 29/09/2026: Tarefas 2 e 3 percorridas pelo dono. Migracao 0022 aplicada por ele e conferida de fora (tabela, semente de 1 linha, gatilho, delete revogado para amassa_app). Deploy: run 36443052672, 2a tentativa verde, commit 72b8881 (a 1a caiu na busca de fonte do Google, transitorio — janela 60 segue aberta). GES-04 medida de fora em 29/09 por curl: /gestao -> 307 para /gestao/login com callbackUrl no dominio publico. Caminhada: 16 de 16 itens respondidos, nenhum reprovado; decisoes: D-06 mantida, espaco sem capacidade fixa (223748a), textos do site sobem como estao (pendencia declarada do dono). Varredura final: 798 passed - 13 failed - 37 skipped - 74 did not run; os 74 NAO executaram (cadeia parametros-*, estrutural e anterior a fase). Detalhe: 04.6-08-SUMMARY.md."
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-05)

**Core value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.
**Current focus:** Fase **06 — Estoque** — contexto, pesquisa, validação e contrato de UI prontos em 29/09 (`8d3d310`); planejando. A **04.6 fechou em 29/09/2026**: `phase.complete` depois da verificação `passed` 9 de 9 (commit `e3527e4`), com revisão de código e as correções dela no caminho.

## Sessão noturna de 29/09/2026 — autorização e decisões tomadas sem o dono

**A autorização, nas palavras dele, em chat:** às ~02h40 — fechar a 04.6 e preparar o Estoque; às
~04h, ampliada — *"vai seguindo. jaja eu acordo. roda o maximo que puder em opçoes recomendadas."*
Leitura adotada: seguir o mais longe possível; onde houver decisão com opção recomendada, tomar a
recomendada e registrá-la aqui, com o porquê e como desfazer.

**Limites que continuam valendo mesmo com isso** (regra permanente do dono para execução sem ele):
nada de `git push`; nada de servidor, `.env` ou migração APLICADA (migração só escrita e versionada);
parar em checkpoint de verificação humana; parar em decisão que contrarie briefing, adendo ou
protótipo, ou que mude regra de dinheiro, saldo ou cancelamento que ele ainda não decidiu; parar se a
mesma falha resistir três vezes.

### Decidido sem o Theo (cada item é reversível)

1. **Os links de seção do site entram em 880px, não em 768px** (`ddfecfd`). Em 768px a marca, os
   quatro links e os dois botões não cabem e "Encomendas" cortava na borda. O próprio protótipo
   aprovado tem o mesmo defeito na virada dele (760px). 880px é um ponto de quebra que o protótipo já
   usa em três seções. **Desfazer:** em `components/site/barra-superior.tsx`, voltar
   `min-[880px]:flex` para `md:flex` — e aceitar o botão cortado entre 768 e ~795px.
2. **Entre 880 e ~900px, três links do site quebram em duas linhas** ("O / espaço") — deixado assim,
   classificado como cosmético pelo verificador. Nada corta. `whitespace-nowrap` sozinho
   reintroduziria o corte; a correção de verdade seria subir o ponto de quebra para ~920px.
3. **Três falhas novas da varredura foram classificadas como contenção de carga, não regressão:**
   `rotas.spec.ts:168`, `sessao.spec.ts:111`, `financeiro-venda.spec.ts:495` (desktop). Evidência:
   rodadas isoladas passaram nos dois viewports (`42 passed`). Ressalva registrada: "passa isolado"
   prova que não é defeito determinístico, não prova que as correções não deixaram as páginas um pouco
   mais pesadas sob carga.
4. **Aviso de conflito das Anotações mudou de comportamento** (parte da correção do CR-03,
   `af5383e`): com o aviso na tela, digitar não o esconde mais nem grava por cima — ele espera "manter
   o meu" ou "ver o dela". O comportamento antigo entrava em laço (a próxima gravação ia com a versão
   velha e reabria o conflito). **Desfazer** exigiria reintroduzir o laço; o caminho seria outro desenho.
5. **A revisão de código olhou 135 arquivos de produção, não os 253 do escopo automático** — ficaram
   fora 79 arquivos de teste (já exercitados por duas varreduras completas), 32 movidos sem mudar uma
   linha, 5 fotos, 1 markdown, 1 apagado. O workflow manda estreitar acima de 50. **Desfazer:**
   `/gsd-code-review 04.6 --files=<os testes>` revisa o que ficou de fora.
6. **O texto do GES-07 foi corrigido** (`0f29a99`): dizia que as pílulas de atalho vinham depois dos
   blocos; o protótipo, o plano 06 e o código as põem antes. O protótipo vence sobre a interface.
7. **Discussão da Fase 06 (Estoque) feita em `--auto`** (`5ad73a0`): sete decisões `[auto]` em
   `.planning/phases/06-estoque/06-CONTEXT.md` — D-13, D-14 e D-16 a D-22 —, cada uma com o porquê e a
   alternativa descartada, e o registro opção por opção em `06-DISCUSSION-LOG.md`. As mais
   consequentes: **uma tela de contagem geral** (D-16 — a primeira abertura tem de contar tudo, pelo §3
   do adendo, e o protótipo não desenha esse fluxo) e **a coluna `ativo` no catálogo** (D-20 — para
   desativar em vez de apagar, no padrão de `categorias.ativa`). As decisões travadas pelo `ADENDO.md`
   de 20/09 não foram rediscutidas.
8. **Passo 1 do Estoque** (`0f03508`): EST-02/03/04/11/12 corrigidos e EST-13 a EST-21 acrescentados,
   um por decisão nova do adendo, e a entrada da Fase 6 no ROADMAP corrigida — ela ainda prometia a
   tabela de materiais que o adendo proíbe. É transcrição do adendo, mas a forma (quais requisitos
   novos, com que texto) é escolha minha. **"Fornada" saiu do EST-11** porque o adendo não a lista.
9. **A pesquisa da Fase 06 rodou mesmo com `workflow.research: false`** (`b09d7a3`). A fase grava
   movimentação dentro da transação da venda e da compra e mexe em custo médio — risco alto demais
   para planejar sem ler o Financeiro linha a linha. Ela **refinou três decisões `[auto]`** (D-17,
   D-20, D-21) e acrescentou D-23 a D-33 em `06-CONTEXT.md`. **Desfazer:** apagar
   `06-RESEARCH.md` e replanejar só pelo contexto — não recomendado.
10. 🔴 **D-23 e D-24 — o valor do estorno** (as únicas decisões da fase que tocam cancelamento):
    venda cancelada devolve o material ao custo que a venda levou; compra cancelada sai ao custo
    médio de agora (ao custo original, o estoque pode ficar com valor negativo e quantidade
    positiva — contraexemplo na pesquisa, Pergunta 3). Adotadas porque nada da fase chega à
    produção sem ele: o código fica no branch `gsd/phase-06-estoque` e a migração só ele aplica.
    **Confirmar antes do merge.** Desfazer é um ramo de `lib/estoque/custo.ts`.
11. **Contrato de UI da Fase 06 aprovado sem o dono** (`8d3d310`): 16 decisões de interface UI-D1 a
    UI-D16 em `06-UI-SPEC.md`, cada uma com a alternativa descartada — as mais visíveis: barra de
    abas neutra (UI-D1), contagem em tela própria (UI-D2), primeira abertura só com o painel de
    contagem (UI-D3), contagem às cegas (UI-D16). Achado para o projeto, **não corrigido**: o fechar
    padrão de `dialog.tsx`/`sheet.tsx` diz "Close" em inglês e tem menos de 44px — fica para a
    Fase 7; o Estoque não o usa.
12. **As sondagens de bordas e de estado da interface rodaram com tipos declarados por mim.** Os
    classificadores do GSD só leem pistas em inglês e devolveram os requisitos e as superfícies em
    português como "sem classificação". Declarei a forma de cada requisito (EST-01..EST-21: 84 bordas)
    e o tipo de cada superfície (E1..E12: 74 pares) — a cobertura depende dessa leitura minha.
13. **Os planos da Fase 06 não param para decisões "de mão única"** (`REVERSIBILITY_GATES=false`).
    Nada da fase é de mão única antes de o próprio dono aplicar a migração e fazer o merge, e o
    último plano já é o portão dele. As classificações continuam anotadas nas tarefas.
14. **06-01 e o antigo 06-04 foram divididos** (recomendação do verificador de planos: passavam do
    orçamento de contexto) — a fase tem 11 planos, não 9.
15. **O roteiro do dono ganhou um passo antes do backup: publicar só a migração.** A migração em
    produção roda pela imagem `ferramentas`, que o pipeline só constrói a partir de `main`; sem esse
    passo a `0023` não chega ao servidor antes do código. O branch `gsd/phase-06-estoque-migracao`
    leva só o SQL da `0023`, o `meta/` dela e `scripts/testar-migracoes.mjs` — **não** leva
    `db/schema.ts`, e o app que sobe com esse push é o de hoje. Entre esse push e o merge da fase,
    ninguém roda `db:generate` em `main` (geraria uma migração que desfaz a `0023`). Está no plano
    06-11, Passo 2.


## Decisões do dono durante a execução da Fase 04.6

- **D-18 ("sem preço no site") vale também para a chave `agLivre`** — confirmado pelo dono em
  28/09/2026, respondendo ao orquestrador durante a onda 5: "a decisão D-18 pode manter assim.
  nenhum preço no site agora". O plano 03 havia estendido a decisão por conta própria (a regra
  enunciada é mais ampla que as três chaves que ela nomeava) e deixado a confirmação pendente;
  **não está mais pendente**. Nenhuma das quatro chaves de conteúdo leva número de preço.

- **"Paguei"/"Recebi" continuam levando ao Caixa, sem pagar do Início (D-06 mantida)** — dono,
  29/09/2026, portão de verificação humana, item 12: "pode manter assim. eu confirmo la no caixa
  corretamente para nao lançar nada errado."

- **O espaço não tem capacidade fixa** — dono, 29/09/2026, item 13: "no espaço em si pode ser que
  caiba mais, pode ser que eu coloque umas mesas a mais na parte externa". `LUGARES_DO_ESPACO = 10`
  saiu; a linha do Início é uma contagem ("N pessoas"). Implementado em `223748a`. **Não afeta o
  limite por turma (AGD-02/03/04, Fase 5)** — a frase dele sobre "remover os avisos de lotação na
  agenda" era ambígua entre os dois níveis; voltar à mesa na discussão da Fase 5.

- **Os textos do site sobem como estão; o acabamento é dele** — dono, 29/09/2026, item 14: "esses
  textos eu vou alterando, estou fazendo um pacote de alteração para rodar de uma vez so". Pendência
  declarada, não defeito; registrada em `WINDOWS.md`.

## Current Position

Phase: 06 — Estoque — **em execução desde 29/09/2026** (sessão noturna, sem o dono), no branch
`gsd/phase-06-estoque` — o `main` só recebe documentos. **Planos concluídos: 06-01, 06-02, 06-03, 06-04, 06-05** (traçador:
`2e6fd2b`; `npm run verificar` verde e um e2e com `--grep "estoque tracador"`, 44 passed, segundo
`06-01-SUMMARY.md`; 06-02: custo médio e o livro provados — sete casos, invariantes, D-23/D-24, 42501/23514/23505/P0001 e duas vendas sem impasse no Postgres efêmero (`7e99910`, `7bac218`); 06-03: venda baixa, compra dá entrada e cancelar estorna, na transação do documento (`d8c043f`, `19a3053`); dois e2e com `--grep`, 108 e 82 passed; 06-04: aba Saldos com a regra do alerta pura em `lib/estoque/saldo.ts` (`862dd53`, `13c17b4`); um e2e com `--grep`, 80 passed; 06-05: regras e servidor da folha — ajuste pelo contado sob a trava, vínculos, custo da peça pronta pela ficha, prévia (`303229a`); sem e2e, como planejado). Antes:
**planejada** (29/09/2026, sessão noturna, sem o dono):
**11 planos** em 11 ondas seguidas, aprovados pelo `gsd-plan-checker` na 2ª rodada — requisitos
21/21, decisões 33/33, análise de lacunas limpa. Feito antes do
plano: contexto (`5ad73a0`), pesquisa (`b09d7a3`), estratégia de validação (`67177bc`) e o
contrato de UI aprovado pelo `gsd-ui-checker` (`8d3d310`, `06-UI-SPEC.md`). **Como sei:**
`git log --oneline` em 29/09.

**Em produção é `ecdca87`** — medido em 29/09/2026: `git log origin/main` aponta para ele,
`gh run list` mostra o run `36509335475` verde para esse commit, e
`curl -s https://amassacerrado.com.br/ | grep -c 'hidden gap-2 md:flex'` devolve **0**: a correção
da barra de cima do site (SIT-10, `ddfecfd`) **não está no ar**. `git log origin/main..main`
mostrava 14 commits locais nessa hora — a correção do SIT-10 e o fechamento da 04.6 entre eles.
O `git push` é do dono.

### Fase 04.6 — registro (concluída em 29/09/2026)

*(Os parágrafos abaixo são o registro da 04.6 como foi escrito durante a execução; valem como
história. A fase fechou em 29/09: `phase.complete` em `598fbc7`, verificação `passed` 9 de 9 em
`e3527e4`.)*

#### Plano 08 — fechamento (29/09/2026)

**Tarefa 2 (o dono, no servidor) — feita.** Migração `0022` aplicada depois de backup; quatro
conferências de fora batendo com a migração: tabela `anotacoes_da_casa` existe; semente de
exatamente 1 linha (`texto = ''`, `salvo_por` nulo); gatilho `tocar_atualizado_em_anotacoes_da_casa`;
privilégios de `amassa_app` select/insert/update `t` e **delete `f`** (o banco recusa apagar a
folha). Caddy inalterado: `sha256sum /opt/amassa/Caddyfile` = `ef7cf139…e2ec2e`, igual ao
`docker/Caddyfile` do repositório. `AUTH_URL` sem linha no `.env` do servidor, vale o padrão sem
caminho do `compose.yml`. **GES-04 fechada** — evidência: `/gestao` → 307 para
`/gestao/login?callbackUrl=https%3A%2F%2Famassacerrado.com.br%2Fgestao` (a classe do defeito de
17/09, `WINDOWS #2`, fechada em produção), e o cookie sobreviveu à mudança de rota (editar a URL
para `/gestao` abriu logado, sem credencial).

**Tarefa 3 (o dono, no celular) — feita.** 16 de 16 itens respondidos, nenhum reprovado. Decisões:
D-06 mantida (item 12); **o espaço não tem capacidade fixa** (item 13, já implementado em
`223748a`; **não** afeta o limite por turma, AGD-02/03/04, cuja ambiguidade fica para a discussão
da Fase 5); textos do site sobem como estão e o acabamento é pendência declarada do dono (item 14,
registrada em `WINDOWS.md`); Google ainda não indexou, consultado em 29/09/2026 (item 15).

**A última varredura e2e NÃO exercitou tudo.** `798 passed · 13 failed · 37 skipped · 74 did not
run` — os ~74 que não rodaram são a cadeia `parametros-*`, que o Playwright não inicia enquanto
`desktop`/`celular` tiverem falha; estrutural e anterior à fase. Contagem por linha (tabela do
retrato): 8 conhecidas iguais + 1 da mesma classe de contenção + 4 linhas de 3 defeitos causados
pela fase (corrigidos em `4858846`).

**Pipeline:** o run `36443052672` falhou na 1ª tentativa no build da imagem (busca de fonte do
Google) e passou na 2ª sem mudança de código — transitório, mas a janela 60 do `WINDOWS.md`
**continua aberta** (a dependência de rede do build é real). O bloqueio de "pipeline vermelho" que
este arquivo registrava desde 28/09 17h05 **acabou**.

**Plano 01 (rotas — o traçador da fase, o mais arriscado) entregou:** a plataforma inteira desceu
de `/` para `/gestao` — `app/(app)`/`app/(auth)`/`app/api/orcamentos` viraram `app/gestao/...`
(git mv, histórico preservado); `middleware.ts` estreitou `config.matcher` para
`["/gestao/:path*"]`, e `lib/rotas/gestao.ts` (novo, puro) é a fonte única do prefixo que o resto
da fase importa; os 13 endereços antigos redirecionam por `lib/rotas/redirecionamentos-antigos.ts`
(sem curinga, `permanent: false`, comentário com a data literal `2027-03-28`); `app/robots.ts`
bloqueia `/gestao` e libera a raiz; os dois 404 (`app/not-found.tsx` público,
`app/gestao/(app)/not-found.tsx` com casca, alcançável pelo novo catch-all
`[...naoEncontrado]/page.tsx`) diferenciados por `data-testid`; `tests/unit/arvore-de-rotas.test.ts`
é o portão estrutural contra o novo modelo "erra aberto" esconder uma regressão. Quatro commits:
`ccfe41f` (Tarefa 1), `2739716` (correção de um `git add` que falhou silenciosamente numa
pathspec já renomeada — identificado pelo coordenador, não pelo executor), `e206a90` (Tarefa 2),
`84ad637` (Tarefa 3, a suíte e2e sob o prefixo novo + `tests/e2e/rotas.spec.ts` novo, 12 casos).
`npm run verificar` limpo (lint, `tsc --noEmit`, `verificar-acoes`, 1175 testes unitários,
`test:migracoes`). 🔴 **A única invocação de e2e autorizada do plano
(`npm run test:e2e -- --grep "rotas /gestao"`) não completou** — 5 tentativas, sempre o
`webServer` do Playwright estourando o timeout de 180s sem nunca reportar pronto. O executor
registrou isso como problema desta máquina; **o orquestrador desmentiu no mesmo dia, 28/09/2026,
e corrigiu.** A causa é código desta fase: a sonda de prontidão do Playwright
(`isURLAvailable`, em `playwright-core/lib/coreBundle.js:8514`) devolve pronto só para status
`>= 200 && < 404`; `playwright.config.ts` sondava `http://127.0.0.1:3000/`, que funcionava por
acidente enquanto o middleware respondia 302 ali, e passou a devolver **404** quando a árvore
desceu para `/gestao` (não há `app/page.tsx` na raiz até o site do plano 03 existir). Corrigido
em `playwright.config.ts`: `webServer.url` passa a ser `http://127.0.0.1:3000/api/health` —
rota pública, fora de `/gestao`, que só responde 200 após consulta real ao banco. `use.baseURL`
não mudou. **Ainda não provado, no momento em que este parágrafo foi escrito (28/09/2026, plano
01):** que a suíte passa; isso é a varredura completa do plano 04.6-02, que também fecha os 12
casos de `tests/e2e/rotas.spec.ts` deixados com `status: unknown`. **Provado em seguida, mesmo
dia, pelo plano 02 (ver parágrafo abaixo): a sonda subiu, e a varredura rodou.**
Detalhe completo em `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-01-SUMMARY.md`,
seção "Issues Encountered" → "Correção do diagnóstico". **Continua aberto, e não é desta fase:**
`.planning/WINDOWS.md` tem inconsistência de contagem no frontmatter que bloqueia
`gsd-tools windows append` (causa raiz identificada pelo plano 02: a tabela markdown do arquivo
termina no id 58, mas o espelho JSON ao final já tem um id 59 — nunca sincronizados).
**[Resolvido em 28/09/2026, commit `3db167c`; medido em 29/09/2026 — `gsd-tools windows append`
gravou uma entrada nova sem erro (o ledger foi de 60 para 61 entradas). O diagnóstico do "pipe sem
escape" acima estava errado: os pipes já estavam escapados e o que barrava era a aritmética do
frontmatter.]**

**Plano 02 (a varredura completa, e o veredito de cada divergência) entregou:** a primeira prova
real de que o `webServer` do Playwright sobe depois da mudança de rotas — `npm run test:e2e`, sem
`--grep`, sem `--no-deps`, contra o commit `482870d`: `734 passed · 9 failed · 0 flaky · 20 skipped
· 79 did not run` em 9,7 minutos. Comparado spec a spec com `Claude outputs/RETRATO-DA-SUITE.md`:
5 das 9 falhas são as conhecidas do retrato, inalteradas (#3/#34, #58, #50 ×2); as outras 4 eram
novas e causadas pelo plano 01 — `href`s montados como literal cru (`/encomendas/${id}`,
`/financeiro?aba=...`) que a varredura mecânica de ~45 arquivos do plano 01 não pegou (buscava um
padrão específico; esses ficaram fora dele). Consertadas as 4, e mais 11 ocorrências do mesmo
padrão que nenhum teste pegava (porque o Playwright segue o redirect 307 automaticamente ao
clicar) mas que quebrariam de vez depois de `2027-03-28` (a remoção dos redirecionamentos antigos)
— todos os 15 migrados para `rotaDeGestao(...)`. Duas janelas conhecidas (#51, #57) e a instável
(`queimas-relatorios.spec.ts:96`) não reproduziram nesta execução — não fechadas, contenção de
servidor único sob carga não é determinística. Commit único: `58b4da2`. `npm run verificar` limpo.
`Claude outputs/RETRATO-DA-SUITE.md` atualizado com a seção "A medição do depois". Detalhe
completo: `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-02-SUMMARY.md`.

**Plano 03 (o traçador do site público) entregou:** `conteudo/site.ts` com os 29 trechos do
protótipo v11 estruturados (os nove com marcação viraram campos, nunca string HTML), zero
import, sem preço nas quatro chaves que D-18 manda esvaziar; `lib/site/whatsapp.ts::hrefDoWhatsapp`
como única porta para `wa.me`; `app/page.tsx` + `components/site/` (`secao`, `barra-superior`,
`barra-inferior-fixa`, `faixa-em-construcao`, `abertura`, `rodape`, `imagem-do-site`,
`decoracao`, `botao-whatsapp`) com `export const dynamic = "force-static"` — provado sem
sessão nem banco por `tests/unit/site-isolamento.test.ts`, que percorre o grafo de import
inteiro a partir de `app/page.tsx` e nomeia a cadeia completa numa violação; bloco `@theme`
do site em `app/globals.css` (D-19: 6 hex literais + 7 `var(...)` que tornam os acentos
idênticos aos da plataforma por construção, não cópia) + Fraunces em `app/layout.tsx` (D-14).
`scripts/testar-site-sem-banco.mjs` (`npm run test:site-sem-banco`, **não** encadeado em
`verificar`) prova DE FORA — subindo o app de verdade e parando o contêiner do Postgres no
meio — que a raiz continua respondendo 200 com o MESMO HTML (D-15/SIT-02), e que
`/gestao/financeiro` não vaza tela de módulo sem banco. `tests/e2e/site-abertura.spec.ts`
(10 casos, a-j) passa nos dois viewports (50 passed, 2 skipped por viewport). Quatro commits:
`ea9d546` (Tarefa 1), `d70b2d0` (Tarefa 2, RED — teste de isolamento antes de `app/page.tsx`
existir), `8faf5e1` (Tarefa 2, GREEN), `e158662` (Tarefa 3). `npm run verificar` limpo.
🔧 **Três bugs Rule 1, achados e corrigidos durante a própria validação da Tarefa 3, nenhum no
app:** (1) `processoDoApp.kill()` não derrubava a árvore de processos no Windows — `spawn`
com `shell: true` cria `cmd.exe -> npm -> next`, e só `taskkill /pid <pid> /T /F` mata a árvore
inteira; (2) o mesmo `spawn` usava array de args com `shell: true`, o padrão que o Node avisa
como depreciado (DEP0190) — trocado por uma única string de comando; (3) dois seletores do
e2e colidiam com texto de OUTRO elemento da página, não com defeito do app — o filtro por
regex dos botões fixos também casava com o link de navegação rotulado "Encomendas", e
`getByRole` por nome faz correspondência por SUBSTRING sem `exact: true` (então "O espaço"
casava com o botão "Conhecer o espaço"). Duas invocações de `--grep "site abertura"` nesta
tarefa (a primeira achou os dois bugs de seletor) — acima do orçamento de uma por tarefa do
CLAUDE.md, registrado como o próprio CLAUDE.md pede quando o `--grep` falha e precisa ser
corrigido e reverificado. **Pendente de confirmação do dono:** D-18 foi estendida a uma quarta
chave (`agLivre`, "uso livre do ateliê" também perdeu o preço) — a regra que D-18 enuncia é
mais ampla que a lista original de três chaves. **SIT-01 não foi marcada como concluída**
apesar de estar nos `requirements` do plano: `04.6-04-PLAN.md` também a reclama e é quem
constrói as seções (`#espaco`, `#agenda`, `#encomendas`, `#onde`) que a página ainda não tem.
Detalhe completo: `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-03-SUMMARY.md`.

**Plano 04 (as cinco seções que faltavam, o SEO e o contraste medido) entregou:** a página
pública fica com as seis seções da versão 11 do protótipo, na ordem — `components/site/
{o-espaco,aulas-e-oficinas,encomendas,faixa-da-fachada,onde-fica}.tsx`, mais `cartao-do-site.tsx`
(compartilhado, cor do marcador sempre por token CSS, nunca hex). D-20 provado nos dois lugares
que o exigem: `faixa-da-fachada.tsx` devolve `null` inteiro enquanto `SLOTS_DE_IMAGEM.fachada.
arquivo` for nulo; `onde-fica.tsx` aplica a mesma regra ao slot do mapa com um `if` em volta do
ENVELOPE da imagem, não só do `<Image>` — sem isso, o envelope sozinho ainda seria o "buraco
desenhado" que D-20 proíbe. A seção de aulas (`#agenda`) mostra o estado sem Agenda (D-16) —
três cartões de texto, dois botões de WhatsApp, a frase de aviso verbatim — e uma nova asserção
em `tests/unit/site-isolamento.test.ts` prova que nenhum arquivo de `components/site/` importa
do módulo Agenda. `lib/acessibilidade/contraste.ts` (`razaoDeContraste`/`luminanciaRelativa`,
WCAG 2.1, puro) mede o contraste da faixa amarela e mais cinco pares do site, lidos do CSS real
por `node:fs`. `app/sitemap.ts` (uma entrada, sem sessão nem banco) e `metadataBase`/`openGraph`
em `app/page.tsx` (dimensões reais da foto, medidas com `sharp`, não inventadas) fecham o SEO
básico (SIT-08). `tests/e2e/site-secoes.spec.ts` (10 casos) passa 52/52 nos dois viewports.
`npm run verificar` limpo. Quatro commits: `8812e3e` (Tarefa 1), `6e9a518` (Tarefa 2), `1bf629f`
(Tarefa 3, RED), `a9f3654` (Tarefa 3, GREEN).
🔧 **Achado real de acessibilidade, corrigido nesta execução (Rule 1):** `--color-site-tinta-
fraca` media 4,47:1 de contraste contra `--color-site-fundo` — abaixo do 4,5:1 que WCAG AA
exige. O briefing já mandava CONFERIR esse par (não afirmá-lo), e a conferência (o próprio
propósito deste plano) encontrou a reprovação. Corrigido para `#786858` (4,77:1), mesma família
de tom quente do site; `app/globals.css` e `tests/unit/tokens.test.ts` atualizados juntos —
nenhum dos dois estava na lista de arquivos do plano, mas a correção do achado exige os dois,
senão o teste de tokens reprovaria sozinho. Também achado nesta execução: os links de WhatsApp/
Instagram do bloco de contato (`onde-fica.tsx`) não tinham altura mínima de 44px (Rule 2) —
corrigido com `min-h-11` antes do primeiro commit chegar a fechar a tarefa.
**Duas invocações de `npm run test:e2e -- --grep "site secoes"` nesta tarefa** (acima do
orçamento de uma por tarefa do CLAUDE.md): a primeira achou um bug de raciocínio no PRÓPRIO
teste (o caso da âncora comparava a posição na viewport, que por design é igual para duas
seções diferentes — a prova certa é a rolagem absoluta do documento); a segunda, corrigida,
passou limpa. Registrado como o CLAUDE.md pede quando o `--grep` falha e precisa ser corrigido e
reverificado. SIT-01, SIT-04, SIT-07, SIT-08, SIT-09 e SIT-10 marcadas como concluídas — a
extensão de D-18 à chave `agLivre` (plano 03) continua **pendente de confirmação do dono**, sem
nenhuma decisão nova deste plano sobre ela.
Detalhe completo: `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-04-SUMMARY.md`.

**Plano 05 (a navegação final) entregou:** `lib/navegacao/itens.ts` com as duas listas
independentes de propósito — `ITENS_NAVEGACAO_CELULAR` caiu de 5 para **4** itens (Início ·
Financeiro · Produção · Agenda) e `ITENS_NAVEGACAO_LATERAL` subiu de 6 para **7** (ganhou
Cadastros pela primeira vez) — nenhuma derivada da outra por `filter`/`slice` (D-11); `ChaveDeIcone`
ganhou a sétima chave (`cadastros`) e os dois mapas `ICONES` (`barra-inferior.tsx`,
`barra-lateral.tsx`) ganharam `SlidersHorizontal` no mesmo commit, cobrados pelo
`Record<ChaveDeIcone, LucideIcon>`; "Produção" é só o rótulo novo de Encomendas (D-13/GES-14) —
`href` e `icone` continuam `/gestao/encomendas`/`encomendas`, nenhuma rota mudou, e o título da
tela móvel (`derivarTituloDaTela`) pega o rótulo novo sozinho, sem edição própria; `menu-usuario.tsx`
perdeu Orçamentos nas DUAS variantes (celular e desktop) — ficam Abertura do Espaço, Trocar senha e
Sair (D-12/GES-13), com a porta `?aba=orcamentos` continuando aberta dentro do Financeiro (ORC-17).
`tests/unit/navegacao.test.ts` reescrito (27 testes) e `tests/e2e/casca.spec.ts` reescrito (62
casos, 31 por projeto) provam as 8 arestas de GES-12/13/14. Dois commits: `c3b4493` (Tarefa 1),
`79429b4` (Tarefa 2). `npm run verificar` limpo (1236 testes unitários).
🔧 **Duas invocações de `npm run test:e2e -- --grep "casca"` nesta tarefa** (acima do orçamento de
uma por tarefa do CLAUDE.md): a primeira achou dois bugs de raciocínio no PRÓPRIO teste novo, não
no código do app — (1) o caso de `/gestao/conta/senha` usava `getByRole("navigation", ...)` para
provar que a barra oculta por CSS continua no DOM, mas `getByRole` exclui elementos ocultos da
árvore de acessibilidade por padrão (corrigido para um `locator` CSS direto); (2) o caso de 320px
terminava navegando para `/gestao/login` (sem casca) e tentava contar ali os itens da barra de
baixo (corrigido navegando de volta para `/gestao` antes de medir). A segunda invocação passou
limpa, 62/62. GES-12, GES-13 e GES-14 marcadas como concluídas — UI-02/UI-04 **não** foram
reescritas, como o plano manda (a nota de sucessor fica para o plano 08).
Detalhe completo: `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-05-SUMMARY.md`.

**Plano 06 (o Início de verdade) entregou:** o painel de quatro cartões vazios da Fase 2 virou a
tela real. `lib/inicio/saudacao.ts` (`saudacaoDe`, `dataLongaEmPortugues` — só `Intl` nativo,
**não** `date-fns` apesar do PLAN.md pedir isso citando `lib/queimas/formato.ts` como molde: esse
próprio arquivo documenta ter dispensado `date-fns` conscientemente, e o pacote nem está
instalado) e `lib/inicio/textos.ts` (quatro frases de erro próprias, uma por bloco, D-09).
`lib/agenda/espaco.ts` fixa `LUGARES_DO_ESPACO = 10` — 🔴 **veio do protótipo aprovado, não de
medição do espaço; pede confirmação do dono.** O mecanismo de esqueleto/erro/retentativa
(`BlocoDoInicio`/`BlocoEsqueleto`/`TentarDeNovo`) nasceu provado com um bloco só (Agenda de hoje,
com a linha permanente "Agora no espaço: N de 10 lugares", D-07) antes de existirem quatro
(Tarefa 1, traçador). `lib/financeiro/vencimentos.ts` (`contasQueVencem`, sete dias, D-05) e
`lib/financeiro/navegacao.ts` (`hrefDoCaixa`) resolvem D-06: "Paguei"/"Recebi" são links para o
Caixa NA PARCELA (`?parcelaFoco=<uuid>`, novo em `financeiro/page.tsx`/`listas-caixa.tsx`, com
destaque e rolagem até a linha), nunca uma confirmação — o briefing venceu o protótipo aqui, por
ser regra de dado. `lib/encomendas/producao-em-andamento.ts` torna o estado que o redesenho da
Produção ainda vai decidir (D-10) irrepresentável POR TIPO — `LinhaDeProducao.etapaAtual` só
aceita as seis etapas reais do módulo, não um `if` que testa e pula. Três commits: `fbdecb2`
(Tarefa 1), `2faca5b` (Tarefa 2), `3f84cca` (Tarefa 3).
🔧 **Quatro invocações de `npm run test:e2e -- --grep "inicio"`** (acima do orçamento de uma por
tarefa do CLAUDE.md, mesma exceção documentada no plano 05): as três primeiras corrigiram bugs no
PRÓPRIO teste novo — ordem dos blocos lida antes do streaming do `Suspense` resolver (faltava
`toHaveCount` antes do `evaluateAll`), `toHaveText` exato onde precisava de `toContainText`
(o testid cobre o contêiner inteiro da linha de ocupação, não só o número), e um `strict mode
violation` porque desktop/celular rodam em paralelo contra o mesmo banco e criam duas contas
concorrentes com o mesmo texto "Paguei" (corrigido com `data-testid="inicio-vence-linha"` novo
por linha, não previsto na tabela de artefatos do plano). Quarta invocação: 46/46 (23 casos × 2
projetos). Três testes e2e existentes ajustados por consequência DIRETA da remoção do painel
antigo — `design-system.spec.ts` (âncora de fonte trocada de "Encomendas por etapa" para "Agenda
de hoje"; a correção "Encomendas"→"Produção" no Ponto 3 já vinha quebrada desde o plano 05,
descoberta e corrigida no caminho), `queimas-banner.spec.ts` (as duas linhas que liam o cartão
"Fornos em atenção" do painel removidas — PNL-04 fica fora do Início por decisão do CONTEXT.md),
`sessao.spec.ts` (âncora trocada de "SEU DIA HOJE" para o heading da saudação). GES-07, GES-08 e
GES-09 e GES-11 marcadas como concluídas. `npm run verificar` limpo (1267 testes unitários).
Detalhe completo: `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-06-SUMMARY.md`.

**Plano 07 (Anotações da casa, o quinto e último bloco do Início) entregou:**
`db/schema.ts::anotacoesDaCasa` — linha única garantida no BANCO (`unique`+`check` de
`linha_unica`, mesmo molde de `aberturaConfiguracao`/`configuracaoFinanceira`), `salvo_por`
anulável, `check` de comprimento de texto espelhando o limite do Zod. A migração
`0022_anotacoes-da-casa.sql` foi **gerada por `drizzle-kit generate` e complementada à mão**
(gatilho `tocar_atualizado_em_anotacoes_da_casa`, grants/revoke, semente) — 🔴 **NÃO aplicada em
produção**: fica para o Roteiro 14 do plano 08, pelo dono, depois de backup.
`lib/anotacoes/folha.ts::decidirGravacao` é a **primeira detecção de escrita velha concorrente do
projeto** — zero precedente antes deste plano (mapa de padrões da fase confirmou) — provada não
só por unidade mas contra Postgres de verdade: `scripts/testar-migracoes.mjs::
conferirAnotacoesDaCasa` abre duas transações reais disputando a mesma linha, e confirma que a
segunda (que viu a marca velha) é obrigada a avisar, nunca sobrescrevendo em silêncio.
`lib/anotacoes/{esquemas,textos,consultas,acoes}.ts` fecham o módulo: NFC + limite de 10.000
pontos de código (nunca `texto.length`), `salvarAnotacoes` com `select ... for update` dentro da
transação. `components/amassa/inicio/{bloco-anotacoes,editor-de-anotacoes}.tsx` — o quinto bloco,
com debounce de 1200ms, indicador salvando/salvo, linha de autoria ("‹nome› salvou às ‹HH›h‹MM›")
e o aviso de conflito **na mesma linha**, com "manter o meu"/"ver o dela" — nunca um diálogo, nunca
edição colaborativa em tempo real (D-08). Três commits: `9dff7c5` (Tarefa 1), `2e01121`
(Tarefa 2), `f664a51` (Tarefa 3).
🔧 **Dois bugs pré-existentes achados e corrigidos no caminho (Rule 1), nenhum no comportamento da
aplicação:** `rodarNpm` em `scripts/testar-e2e.mjs` só escapava argumento com ESPAÇO — um `--grep`
com alternância (`"anotacoes|inicio"`, exigido pelo orçamento de e2e do CLAUDE.md para rodar dois
arquivos numa invocação só) não tem espaço, chegava cru ao `cmd.exe` do Windows, que interpretava
`|` como pipe de shell de verdade (corrigido: a checagem agora cobre `[\s|&<>^]`). E
`ordemDosBlocos()` em `tests/e2e/inicio.spec.ts` contava o esqueleto de carregamento
(`data-testid="inicio-bloco-esqueleto"`, MESMO prefixo `inicio-bloco-` do seletor) como se fosse
um bloco resolvido — inofensivo com quatro blocos (04.6-06), exposto agora que o quinto bloco
(consulta própria ao banco) variou o tempo de resolução; corrigido esperando a ausência de
qualquer esqueleto antes de ler a ordem. `npm run test:e2e -- --grep "anotacoes|inicio"`: 66/66
(desktop + celular), depois de 4 invocações (as duas primeiras batendo nos dois bugs acima; uma
terceira achando que o estado transiente "salvando…" era rápido demais para o polling capturar,
corrigida com a mesma técnica de segurar a requisição de propósito já usada em
`orcamentos-fotos.spec.ts`). GES-10 marcada como concluída. `npm run verificar` limpo (1295 testes
unitários, `test:migracoes` com as quatro conferências novas de `anotacoes_da_casa`).
Detalhe completo: `.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-07-SUMMARY.md`.

**Plano 08 (o portão da fase), Tarefa 1 (a última varredura, o Roteiro 14, a caminhada, e os
documentos de estado) entregou, em 28/09:** medido antes de escrever qualquer coisa sobre produção
— `git log origin/main..main` mostrou **35 commits locais não publicados** (o mais antigo,
`8ca6e3b`, de antes desta fase começar; o mais recente até aqui, `80d26e3`, o fechamento do plano
07); `gh run list` mostrou o último pipeline (`36361455093`) verde em 28/09, mas rodou ANTES de
qualquer commit desta fase — **nenhum código da Fase 04.6 passou pelo CI ainda**, porque nada foi
publicado. **A segunda e última varredura e2e completa da fase** (`npm run test:e2e`, sem `--grep`,
sem `--no-deps`) rodou: `798 passed · 13 failed · 37 skipped · 74 did not run` (9,6min), comparada
spec a spec com `Claude outputs/RETRATO-DA-SUITE.md` (a medição "do depois" do plano 02, a única
referência válida — as rotas não mudam mais entre um plano e outro). Das 13: **9 são janelas já
conhecidas e abertas**, todas contenção de servidor Next único sob carga, cada uma com o próprio
número no `WINDOWS.md` — `autenticacao.spec.ts:84` (desktop+celular, #3/#34, defeito real de
segurança pré-existente, fora do escopo desta fase), `cadastros-contas-fixas.spec.ts:112` (#58,
fragilidade de teste), `orcamentos-fotos.spec.ts:175` (desktop+celular, #50),
`orcamentos-aprovacao.spec.ts:364` (#57), `orcamentos-tracador.spec.ts:63` (#35); **1 é nova mas
confirmada da MESMA classe** por reexecução isolada (`orcamentos-editor.spec.ts:85`, `--workers=1`,
passou limpa — contenção, não regressão); **3 eram causadas por planos anteriores desta MESMA
fase e foram corrigidas aqui** (Rule 1, mesmo padrão do plano 02 com os `href`s perdidos):
`encomendas-detalhe.spec.ts:304` e `abertura-tracador.spec.ts:111` ainda esperavam o rótulo
"Encomendas" e a contagem de 5 itens da barra de baixo, que os planos 05/06 já tinham mudado para
"Produção" (D-13/GES-14) e 4 itens (GES-12); e `components/amassa/inicio/bloco-producao.tsx`
(plano 06) não reaproveitava a correção de contraste que `gantt.tsx` já tem para o token
`--color-secagem` (1,94:1 medido pelo axe-core, abaixo do 4,5:1 de AA) — corrigido com o mesmo
`corDoTexto` condicional. **Nenhuma falha nova ficou sem veredito.** `npm run verificar` (lint,
`tsc --noEmit`, `verificar-acoes`, 1281 testes unitários, `test:migracoes`) e
`npm run test:site-sem-banco` saíram `0`. `docs/operacao/14-gestao-e-site-publico.md` (Roteiro 14,
novo) escrito — guarda de banco, backup, migração `0022`, conferência de fora, o Caddy que NÃO
muda (mesmo processo Next servindo `/` e `/gestao`), `AUTH_URL` que continua sem caminho no fim
(a classe exata do defeito de 17/09), e o atalho do celular. `04.6-VERIFICACAO-HUMANA.md` (novo)
cobre os 8 critérios do ROADMAP, GES-04 (registrado para fechar só depois da Tarefa 2, em
produção), a pergunta sobre `LUGARES_DO_ESPACO = 10`, e as três perguntas de julgamento da Tarefa 3
— D-18/`agLivre` **não** entrou como pergunta nova, porque o dono já confirmou em 28/09 (ver
"Decisões do dono" acima) que a extensão vale e nenhum documento mais a chama de pendente.
`REQUIREMENTS.md` corrigido: GES-05/GES-06 destravados na tabela de rastreio (já estavam `[x]`
desde o plano 01, a tabela dizia "Not Started" — mesma classe de gap da `WINDOWS.md #43`, achada e
corrigida aqui); UI-02/UI-04 substituídos por GES-12/GES-13 com data e commit; a decisão sobre
PNL-01..05 escrita em prosa (quatro cumpridos na prática pelo Início, PNL-04 fica para a Phase 7);
SIT-02 com nota de deferimento explícito (a metade estática cumprida e provada; a leitura da
agenda com cache fica para a Fase Agenda). **GES-04 continua `[ ]` de propósito** — só fecha
depois da Parte C da Tarefa 2, em produção; nenhum requisito foi marcado por este plano sem a
caminhada confirmar. Dois commits: um `fix` (as três correções Rule 1 achadas pela varredura) e um
`docs` (Roteiro 14, caminhada, REQUIREMENTS, e os documentos de estado). 🔴 **Tarefas 2 e 3 são
portões humanos bloqueantes** — Parte A (`git push`, do dono) e Parte B (Roteiro 14 no servidor,
migração `0022`, depois de backup) e Parte C (GES-04 em produção, no celular) da Tarefa 2; a
caminhada dos 8 critérios na Tarefa 3. **Nada foi publicado, nenhuma migração foi aplicada em
banco nenhum além do efêmero de teste.** Detalhe completo, quando escrito ao final desta sessão:
`.planning/phases/04.6-gestao-inicio-e-site-publico/04.6-08-SUMMARY.md`.

> **Nota de 29/09/2026 sobre o parágrafo acima — é o retrato de 28/09, da Tarefa 1, e três frases
> dele não descrevem mais o presente:** "GES-04 continua `[ ]`" (agora `[x]`, ver "Plano 08 —
> fechamento" no topo desta seção); "Tarefas 2 e 3 são portões humanos bloqueantes" (ambas
> percorridas); "nenhuma migração foi aplicada" (a `0022` foi, pelo dono, e está conferida de
> fora). O `04.6-08-SUMMARY.md` agora existe. E uma correção de contagem: "9 conhecidas + 1 nova + 3
> causadas pela fase" soma 13, mas a tabela por linha do retrato dá **8 + 1 + 4** (as "3" são três
> defeitos que geram quatro linhas de teste falhando; as conhecidas são 8 linhas de 6 janelas).
> Uso a tabela por linha porque cada linha pode ser conferida.

**Planejamento concluído em 2026-09-28, commit `c0fe5ff`** (histórico, anterior à execução do plano
01, preservado abaixo):

não executada**, em 2026-09-28. É o item 3 de `Claude outputs/FILA-DO-CODE.md`, destravado quando
a 04.5 fechou.

**Planejamento concluído em 2026-09-28, commit `c0fe5ff`:** 8 planos em 8 ondas sequenciais, na
ordem que D-21 travou — rotas (01, 02) → site (03, 04) → navegação (05) → Início (06, 07) → portão
(08). O plano 08 é `autonomous: false`: aplicar a migração `0022` à mão depois de backup, conferir
GES-04 em produção no celular, e a caminhada dos 8 critérios.

**Como sei que os gates passaram** (medido, não afirmado): `check.decision-coverage-plan` devolveu
`{"passed":true,"total":21,"covered":21}`; as 24 IDs de requisito aparecem no `requirements` do
frontmatter dos planos (conferido por `grep` id a id); as 78 arestas do probe reconciliam
74 covered + 4 backstop + 0 descartadas na tabela do plano 08; há exatamente **duas** varreduras e2e
completas (plano 02 linha 139 e plano 08 linha 245) e nenhum `npm run build` como passo separado.

**Corrigido no caminho:** a seção da Fase 04.6 no `ROADMAP.md` era a única das 14 sem linha
`**Requirements**:`. Sem ela `phase_req_ids` vinha `null` e o gate de cobertura de requisitos
pulava calado. As 24 IDs foram acrescentadas — a matriz de rastreabilidade do `REQUIREMENTS.md`
já as atribuía a esta fase.

**O que ficou pronto (passo 1 do item da fila, commit `129e3a0`):** a fase existe no ROADMAP entre
a 04.5 e a Phase 5, com objetivo, decisões já tomadas, riscos e 8 critérios de sucesso; os dois
protótipos e os dois briefings estão em `.planning/phases/04.6-gestao-inicio-e-site-publico/`,
com as 12 imagens; o `REQUIREMENTS.md` ganhou **GES-01..14** (endereço, Início, navegação) e
**SIT-01..10** (site público), com rastreio e cobertura de 136 para 160.

**Histórico — a parada do passo 2, resolvida em 28/09.** A fila era explícita: *"não planeje nem
execute antes de o Theo responder"*. Ele respondeu em 28/09; o `04.6-CONTEXT.md` registra as 21
decisões travadas e o `04.6-DISCUSSION-LOG.md` a conversa. O parágrafo abaixo é o retrato de
**antes** dessa resposta, guardado como registro. As perguntas estavam em
`Claude outputs/gestao/DISCUSSAO-PREPARADA.md`, cada uma com recomendação. **Restavam quatro que
precisavam dele** (todas respondidas em 28/09) — para onde "Paguei/Recebi" leva, se os
neutros diferentes entre site e plataforma são intenção, os dois buracos de conteúdo (foto da
fachada e logo), e quem é a fonte de verdade do preço público — mais uma quinta que eu comecei a
consertar e revertí (item 10: salvar peça devolve à lista ou reabre a peça?).

**O bloqueador que existia foi resolvido pelo próprio dono, durante a sessão:** a versão 11 do
protótipo do site desenhou o estado "sem Agenda" — que é o que efetivamente vai ao ar — e ligou
o WhatsApp de verdade. A cópia da fase foi ressincronizada (commit `c2c8999`).

---

## Posição anterior (Fase 04.5, concluída)

Phase: **04.5 (Financeiro — parte 2: Precificação e Orçamento)** — **CONCLUÍDA em 2026-09-27**,
com **14 de 14 planos**. A fase nunca fechou por contagem de planos: o portão era
`.planning/phases/04.5-financeiro-parte-2/04.5-VERIFICACAO-HUMANA.md`, e o dono o percorreu no
celular em 27/09/2026. **23 dos 25 itens passaram de primeira.** Os dois que não passaram eram
critério do ROADMAP desta fase, e o plano 14 os consertou:

- **Item 8** — o botão "Apagar" de uma peça **exclusiva** não fazia nada. O diálogo de confirmação
  era montado só para as fichas visíveis, e a exclusiva não é visível sem `?exclusivas=1`; a
  Server Action `apagarFicha` sempre esteve correta, só nunca rodava. Commit `e5daf10`.

- **Item 14** — o veredito do orçamento aprovado seguia verde dizendo "ordem aberta na Produção"
  com a encomenda já cancelada. `textoVeredito` recebia "o id existe?" no lugar de "a ordem está
  aberta?", e `encomendas.status` não era lido em ponto nenhum daquele caminho. Lacuna, não
  regressão. Commit `fcc072a`. A outra metade do item (aviso de venda cancelada) **passou**.

As migrações `0017`-`0021` foram aplicadas em produção em 27/09/2026, antes da caminhada; a
`0017` está provada de fora pela rota `/api/health/backup`. **O código do plano 14 ainda NÃO foi
publicado** — são commits locais, e o `git push` é decisão do dono.

**Plano 01 (o traçador) entregou:** migrações `0017`/`0018`/`0019` (8 tabelas novas, gatilhos,
semente ilustrativa) versionadas — **não aplicadas em produção**, ficam para o plano 13, depois de
backup; `lib/precificacao/` puro e testado (parâmetros, forno, cálculo — divisor ≤ 0 recusa, nunca
aplica piso; quantas cabem sai das medidas, nunca do volume); `lib/orcamentos/numero.ts`
(`ORC-2026-001`, seguro sob concorrência real); a aba Orçamentos dentro do Financeiro, barra em
duas fileiras (7 pílulas), casca vazia `/orcamentos` removida. `npm run verificar` limpo; e2e do
traçador provado (uma falha de contenção de servidor sob 8 workers, confirmada flaky isolada —
WINDOWS #35). Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-01-SUMMARY.md`.

**Plano 02 (Parâmetros dentro de Cadastros, D-03) entregou:** a quinta sub-aba de Cadastros — os
18 parâmetros do cálculo, cada um com valor na unidade humana, data "desde" e o selo estimado |
medido (verde-sucesso, nunca terracota); `lib/precificacao/{hora,consultas,esquemas,acoes,textos}.ts`
(`parametrosVigentes` é agora a única porta de leitura de parâmetro do sistema); "Calcular minha
hora" (ORC-04) gravando `trabalho_hora`; o aviso vermelho do divisor que não fecha (D-11). **Achado
real, corrigido nesta execução:** o gatilho de histórico de 0018 recusava corrigir o valor de um
parâmetro no MESMO DIA — migração `0020` corrige isso sem tocar 0017/0018/0019. e2e 42/42 (desktop

+ celular). Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-02-SUMMARY.md`.

**Plano 03 (o volume das fotos, o backup que cobre e o roteiro do servidor) entregou:** bind
mount `/opt/amassa/dados/fotos-orcamentos` → `/dados/fotos-orcamentos` (D-30, respondido pelo
dono durante a execução), declarado em `docker/compose.yml` com `CAMINHO_FOTOS` de valor padrão
no próprio arquivo; `lib/orcamentos/caminho-fotos.ts` como porta única de travessia de caminho
de foto; `scripts/backup.sh`/`scripts/restaurar.sh` estendidos para cobrir as fotos com o mesmo
`rclone` do dump, sem ferramenta nova; `/api/health/backup` cobrindo a cópia externa das fotos
sem expor bytes. Nenhuma migração nova (as colunas já existiam desde o plano 01). Roteiro 12
(`docs/operacao/12-fotos-volume-e-backup.md`) pronto para o dono rodar no plano 13. `npm run
verificar`, `npm run test:backup` (10 etapas) e `npm run test:e2e -- --grep "backup"` (44/44,
uma única invocação) limpos. Detalhe completo, inclusive a nota de honestidade sobre o que o
ambiente de teste NÃO pode provar (restauração de arquivo de foto real via `rclone`):
`.planning/phases/04.5-financeiro-parte-2/04.5-03-SUMMARY.md`.

**Plano 04 (a ficha de peça — o cálculo puro, o preço que mora no Catálogo, e o diálogo) entregou:**
`lib/precificacao/ficha.ts` (puro, 37 testes) — `validarFicha` espelha os `check`s de
`fichas_precificacao`, `resultadoDaFicha` monta as cinco fatias/três preços/farol/contagens do
forno sem chamar `calcularPeca`/`quantasCabem` sozinho (só `import type`, mesmo desenho de
`CabemNoForno`); `criarFicha`/`editarFicha` gravam a ficha e o item do Catálogo na mesma transação
com um preço só (D-18); o diálogo (`DialogoFicha`) recalcula ao vivo a cada tecla chamando as
MESMAS funções que o servidor chamaria, com os dois avisos (não cabe/divisor inválido) no lugar de
qualquer preço. **Achado real, corrigido nesta execução:** o forno estava sendo lido em
cm-milésimos em vez de milímetros em `parametrosVigentes` — uma peça de 40 cm "cabia" num forno que
parecia ter 3,5 km. e2e 46/46 (desktop + celular). Detalhe completo:
`.planning/phases/04.5-financeiro-parte-2/04.5-04-SUMMARY.md`.

**Plano 05 (a lista de Peças, o "começar a partir de", e a exclusão que se recusa) entregou:**
`ListaPecas` (self-contida, molde de `ListaOrcamentos`) — linha por peça com selo compacto,
etiqueta "exclusiva", alternador `?exclusivas=1` (D-19); `camposCopiaveisDaFicha` e o `<select>`
"Começar a partir de uma peça parecida" no diálogo (só na criação); `apagarFicha` — trava a linha,
conta os orçamentos que a usam DENTRO da transação, só apaga se zero, nunca toca `itens_catalogo`
(D-20); `ConfirmarApagarPeca`, montado por linha, nomeando a peça, nunca mostrando uma contagem
pré-carregada (só a frase que o servidor devolve). **Achado real, corrigido nesta execução:** o
nome de uma peça exclusiva vivia no MESMO `<span>` da etiqueta "exclusiva", e qualquer busca de
texto exato pelo nome sozinho nunca batia — isolado em spans irmãos, mesmo molde de
`lista-catalogo.tsx`. e2e 44/44 (desktop + celular). **Pendente para o plano 06:** o caso de
recusa por peça EM USO só pode ser provado de ponta a ponta quando existir linha de orçamento
criada pela interface — este plano entregou a regra e a recusa do servidor, o plano 06 acrescenta
o e2e. Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-05-SUMMARY.md`.

**Plano 06 (o editor do orçamento — para quem, para quando, e quais peças) entregou:**
`lib/orcamentos/contas.ts::contasDoOrcamento` (puro, TDD, 6 testes) — a fonte única do total, que
nunca contamina a soma com uma linha sem cálculo (D-11/D-12); as quatro ações de edição
(`atualizarCabecalhoDoOrcamento`/`acrescentarLinha`/`atualizarLinha`/`removerLinha`) com a guarda de
rascunho (`travarOrcamentoRascunho`, `select ... for update`) escrita uma vez; `EditorOrcamento` +
`CabecalhoDoOrcamento` + `LinhaDeOrcamento` + `EscolherPeca` na tela, com as duas portas de entrada
de peça ("+ Peça da lista"/"+ Peça exclusiva deste pedido", esta última acrescentando a linha na
MESMA ida via `DialogoFicha.vindoDoOrcamentoId`); `ListaOrcamentos` mostra o total agregado de cada
orçamento. **Fecha o item pendente do plano 05:** a recusa de apagar peça em uso (D-20) provada de
ponta a ponta (`precificacao-pecas.spec.ts`, caso h). e2e 60/60 (desktop + celular, dois arquivos).
Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-06-SUMMARY.md`.

**Plano 07 (total, pagamento e o painel que o cliente nunca vê) entregou:**
`lib/orcamentos/plano.ts::parcelasDoPlano` (puro, TDD) — à vista/sinal/3x fecham ao centavo por
construção, a MESMA função que o documento do cliente (plano 11) e a aprovação (plano 12) vão
reaproveitar; `contasDoOrcamento` completa (projeto, frete, imposto+taxa, sobra podendo ser
negativa, estimados por argumento); cinco ações novas (`acrescentarCustoDeProjeto`/
`atualizarCustoDeProjeto`/`removerCustoDeProjeto`/`definirPlanoDePagamento`/`definirObservacoes`),
reaproveitando a guarda de rascunho do plano 06; os três blocos que fecham o editor —
`CustosDoProjeto`, `TotalEPagamento` (Display 28px) e `SoParaVoce` (fundo `--color-acento-fundo`,
Server Component sem estado, estruturalmente isolado do documento do cliente). e2e 44/44 (desktop

+ celular). Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-07-SUMMARY.md`.

**Plano 08 (congelando o orçamento, e o ciclo de vida) entregou:**
`lib/orcamentos/snapshot.ts::montarSnapshot/lerDoSnapshot` (puro, TDD) — o contrato de
persistência do congelamento (D-21), retrocompatível com formato antigo (campo ausente vira zero +
`camposFaltantes`); `lib/orcamentos/situacao.ts::situacaoDoOrcamento` — a única função que deriva
o chip, "expirado" nunca gravado (D-22); as quatro transições (`marcarComoEnviado`/
`recusarOrcamento`/`voltarParaRascunho`/`duplicarOrcamento`) com `select ... for update` antes de
decidir e `garantirTransicaoValida` como guarda comum (a frase do "aprovado" sempre aponta para
Duplicar); `ChipDeSituacao`/`AcoesDoOrcamento` na tela, com os três botões dos planos 09/11/12
visíveis e honestamente desabilitados. **Achado real, corrigido nesta execução (Regra 2):** a
linha de peça do orçamento continuava editável mesmo depois de "Marcar como enviado" — gap herdado
dos planos 06/07, fechado agora (`LinhaDeOrcamento` ganhou `vivo`). e2e 14/14 (desktop + celular,
7 casos), incluindo o coração do plano: mudar um parâmetro DEPOIS de enviado não altera nenhum
número congelado, e um rascunho novo já usa o valor novo. **Executado com o dono ausente** (3
portões pré-autorizados: pacotes, fonte do PDF, migrações 0017-0020) — sem checkpoint bloqueante
neste plano (nenhum pacote novo, nenhuma migração nova). Detalhe completo:
`.planning/phases/04.5-financeiro-parte-2/04.5-08-SUMMARY.md`.

**Plano 09 ("Atualizar preços" e revisões) entregou:** `lib/orcamentos/atualizacao.ts::
sugerirPrecos/algoMudou` (puro, TDD, 16 testes incluindo as quatro fronteiras do arredondamento no
cano inteiro razão+`arredondarBonito`) — preserva a razão preço ÷ mínimo da época (congelado) ou só
respeita o piso de hoje (rascunho), nunca divide por zero; `atualizarPrecos` grava a revisão
anterior em `orcamento_revisoes` ANTES de apagar o snapshot, sobe `revisao`, volta a rascunho com
`data = hoje` (congelado) ou só grava os preços (rascunho), nunca toca projeto/frete/número;
`DialogoAtualizarPrecos` (diálogo único responsivo, aberto por URL sem transição) com o histórico
de revisões agora aparecendo em "Só para você". **Executado com o dono ausente**, sem checkpoint
bloqueante (nenhum pacote novo, nenhuma migração nova — `orcamento_revisoes` já existia do plano
01, sem nenhuma linha até este plano gravar a primeira). e2e 44/44 (desktop + celular, 7 casos, 2
`test.skip` documentados — o caso "aprovado sem o botão" não tem caminho de UI até o plano 12
existir, registrado em WINDOWS.md #42). Detalhe completo:
`.planning/phases/04.5-financeiro-parte-2/04.5-09-SUMMARY.md`.

**Plano 10 (fotos: upload, EXIF/GPS removido, rota autenticada) entregou:** `sharp`/`file-type`
instalados (checkpoint pré-autorizado pelo dono em 2026-09-26, D-31); `lib/orcamentos/fotos.ts`
(`validarTipoRealDaFoto` por magic bytes, `tratarFotoDeOrcamento` — `.rotate()` sem argumento +
resize 1600px + jpeg, **nenhuma chamada a `.withMetadata()`**, D-26) — `TIPOS_ACEITOS` construído
na carga do módulo a partir do que o `sharp` instalado realmente decodifica (resolve a Assumption
A1 da pesquisa sem foto de iPhone real: nesta instalação, suporta HEIC/HEIF); fixture sintética
com GPS/orientação genuínos (`sharp` não escreve GPS real via `withMetadata` — confirmado nesta
sessão) provando que o RESULTADO não tem metadado, não só que ficou menor; `anexarFotoDeOrcamento`
grava a linha e o arquivo na MESMA transação (arquivo escrito por último, revertendo os dois numa
falha); `GET /api/orcamentos/fotos/[id]` atrás de `exigirUsuario()`, caminho só por
`caminhoDaFoto()` (plano 03); `FotosDeReferencia` na tela (espera, erro com "Tentar de novo",
limite de 3, remoção com confirmação). **Achado real, corrigido nesta execução:** a rota de foto
sem sessão caía num REDIRECT do middleware para `/login` (200, nunca um 401) — `middleware.ts`
ganhou a regra geral "rota de API não pública responde 401, nunca redirect" (T-04.5-48). e2e
14/14 (desktop + celular, 7 casos, incluindo o 401 sem sessão). Detalhe completo, inclusive um
achado de ambiente fora do escopo deste plano (a semente de parâmetros usa `current_date` do
Postgres em UTC contra `hojeEmBrasilia`, discrepando por ~3h todo dia perto da meia-noite —
WINDOWS #44): `.planning/phases/04.5-financeiro-parte-2/04.5-10-SUMMARY.md`.

**Plano 11 (o documento do cliente — a folha A4 na tela e o PDF do servidor) entregou:**
`lib/orcamentos/documento-cliente.ts::montarDocumentoDoCliente/DocumentoDoCliente/
textosDoDocumento` — a ÚNICA fonte de conteúdo do documento; tipo fechado, sem nenhum campo de
custo/mínimo/margem/hora, provado por teste unitário que varre a estrutura por nome de chave
(D-24/D-29); `VerComoOClienteVe` — a folha A4, um overlay auto-gerenciado por `useSearchParams()`
(`?documento=1`), sem chamada nova ao servidor para abrir; `@react-pdf/renderer@4.9.0` instalado
(o pacote SUS aprovado pelo dono no checkpoint, D-31, escopo `@react-pdf/` conferido) —
`GET /api/orcamentos/[id]/pdf` gera o PDF no servidor a partir do MESMO `DocumentoDoCliente`,
com Inter (regular/negrito/itálico) + Archivo Narrow (negrito) versionadas em `assets/fontes/`
(SIL OFL 1.1, licença ao lado, D-32); `BaixarPdf` — `fetch`+`blob`, nunca `<a href>`, com o
contrato de espera/erro do UI-SPEC. **Achado real, corrigido nesta execução:** `@react-pdf/
renderer` não resolvia a fonte itálica do rodapé (`Inter-Italic.ttf` acrescentado depois do
primeiro e2e). **Decisão sem o dono:** `pdfjs-dist` (a biblioteca de extração de texto oferecida
no mesmo checkpoint) NÃO foi instalada — a resposta do dono confirma três pacotes para a fase
inteira e não confirma explicitamente essa quarta; cobertura de acentuação/ausência-de-custo
DENTRO do arquivo PDF final fica como verificação humana pendente para o plano 13 (WINDOWS
#45/#46) — a estrutura de dados é provada por construção. `docker/Dockerfile` ganhou `COPY
.../assets ./assets` (achado real, fora da lista de arquivos do plano — sem isso o primeiro PDF
em produção falharia com arquivo não encontrado). e2e 46/46 (desktop + celular, 7 casos,
incluindo a cadeia `@vazio-global` completa — bloqueada na primeira tentativa por WINDOWS #44,
contornada com o mesmo workaround temporário do plano 10, revertido antes de qualquer commit).
Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-11-SUMMARY.md`.

**Plano 12 (a aprovação — a venda e a encomenda, numa transação só) entregou:**
`lib/orcamentos/aprovacao.ts::planejarAprovacao` (puro, TDD) — a única função que decide o que a
aprovação cria, com DOIS consumidores (o diálogo mostra, a transação grava); `aprovarOrcamento`
(`lib/orcamentos/acoes.ts`) — UMA `db.transaction` que trava o orçamento, exige "enviado" e
validade não vencida, carrega a categoria "Encomendas" do banco, confere a soma com
`conferirParcelas` (a mesma de `lancarVenda`), grava o documento de venda com o sinal EM ABERTO
vencendo hoje e, se marcado, a encomenda — `status=aprovado`+`documentoId`+`encomendaId` na mesma
instrução. Os vínculos (D-25) ficam navegáveis nos dois sentidos: "Ver venda no
Financeiro"/"Ver encomenda na Produção" no orçamento aprovado, "Criado a partir do orçamento
{número}" no documento e na encomenda. Cancelar a venda depois não apaga nem reabre o orçamento —
só acrescenta um aviso. **Achado real, corrigido nesta execução:** os links "Ver venda no
Financeiro"/o toast com o número da venda não tinham canalização técnica nenhuma (nenhum arquivo
do plano cobria isso) — `app/(app)/financeiro/page.tsx`/`lib/financeiro/avisos.ts`/
`listas-caixa.tsx` ganharam o mínimo necessário (`?documentoId=` abre o documento sozinho na aba
Caixa; um aviso novo carrega o número real da venda). e2e 50/50 (desktop + celular, 9 casos,
incluindo a cadeia `@vazio-global` completa — bloqueada na primeira tentativa por WINDOWS #44,
contornada com o mesmo workaround temporário dos planos 10/11, revertido antes de qualquer commit).
Detalhe completo: `.planning/phases/04.5-financeiro-parte-2/04.5-12-SUMMARY.md`.

**Pendente para o plano 13:** os roteiros de produção (migrações `0017`-`0020`, o volume das fotos,
depois de backup) e a verificação humana final (`04.5-VERIFICACAO-HUMANA.md`, no celular).

Artefatos da fase, em `.planning/phases/04.5-financeiro-parte-2/`:

  - `04.5-CONTEXT.md` — D-01..D-29. A discussão está fechada; **não rodar `/gsd-discuss-phase`**.

  - `04.5-RESEARCH.md` — as quatro escolhas técnicas que o briefing adiava, com **tamanhos medidos
    contra a imagem Docker real do projeto, não estimados**: `@react-pdf/renderer` +37,3 MB (contra
    Chromium +762 MB, descartado), `sharp` +19,8 MB, bind mount com `rclone` reaproveitado do
    backup do Postgres, e tabela contadora com `ON CONFLICT DO UPDATE ... RETURNING` para o número.

  - `04.5-UI-SPEC.md` — aprovado 6/6 pelo `gsd-ui-checker`. Contém o contrato das 7 telas.

  - `04.5-PATTERNS.md` — o análogo de cada arquivo novo, e os quatro pontos onde a fase pisa em
    terreno virgem (PDF no servidor, upload de foto, rota que serve arquivo, backup de arquivo).

  - `04.5-01-PLAN.md` a `04.5-13-PLAN.md` — 13 planos em 12 ondas.

  - `04.5-PLAN-CHECK.md` — a verificação dos planos e o julgamento dela.

**Seis checkpoints bloqueantes esperam pelo dono** (o executor para em cada um):

  1. ~~Plano 03 — bind mount vs. volume nomeado~~ **respondido pelo dono durante a execução**
     (bind mount, D-30). O `chown 100:101` continua sendo dele — vira o Passo 4 do Roteiro 12
     (`docs/operacao/12-fotos-volume-e-backup.md`), executado no plano 13, junto das migrações.

  2. ~~Plano 10 — instalar `sharp` + `file-type`~~ **respondido pelo dono em 2026-09-26, antes de
     se ausentar** (D-31 do CONTEXT, dentro do próprio 04.5-10-PLAN.md) — instalados, executados.

  3. ~~Plano 11 — instalar `@react-pdf/renderer`~~ **respondido pelo dono em 2026-09-26, antes de
     se ausentar** (D-31 do CONTEXT, dentro do próprio 04.5-11-PLAN.md) — o selo SUS julgado
     falso-positivo pela pesquisa; instalado, escopo `@react-pdf/` conferido, executado.

  4. ~~Plano 11 — versionar um arquivo TTF num repositório público~~ **respondido pelo dono em
     2026-09-26** (D-32 do CONTEXT) — Inter + Archivo Narrow, SIL OFL 1.1, versionadas em
     `assets/fontes/` com a licença ao lado.

  5. ~~Plano 13 — Roteiros 12 e 13 em produção, depois de backup.~~ **feito em 27/09/2026**
     (E2/E3/E4: pipeline com sucesso no commit `3a31c55`; migração `0017` provada por
     `/api/health/backup`; Roteiro 12 rodado, registrado no commit `a43ee6a`).

  6. ~~Plano 13 — `04.5-VERIFICACAO-HUMANA.md` no celular.~~ **percorrida pelo dono em
     27/09/2026** — 23 dos 25 itens de primeira; os dois achados (8 e 14) corrigidos no plano 14.
     Era esse o portão da fase, e ele está cumprido.

Duas coisas para ele olhar:

  - **A barra do Financeiro já tem sete abas** (Venda · Despesa · Caixa · Mês · Orçamentos · Peças
    · Cadastros), em duas fileiras 4+3 — **implementado no plano 01**, desviando de propósito da
    regra "flex-wrap nunca" da 04.4. É a mudança que ele sente ao abrir `/financeiro` pela
    primeira vez depois desta fase — vale ele olhar no celular de verdade.

  - **D-25, os "vínculos nos dois sentidos":** implementado no plano 12. O planejador os pôs uma
    vez só, em `orcamentos.documento_id`/`encomenda_id`, sem coluna espelho no Financeiro (espelho
    criaria chave circular e uma segunda verdade). As duas telas provam a navegação nos dois
    sentidos ("Ver venda no Financeiro"/"Ver encomenda na Produção" no orçamento; "Criado a partir
    do orçamento {número}" nos dois lados). É interpretação de regra dele — vale conferir quando
    chegar (as migrações foram aplicadas em 27/09).

Não houve `git push` até então. Tudo em commits locais (`9bd48db` a `c391925`, planos 01-03 da 04.5
incluídos). **Os commits foram publicados em 27/09/2026** (`git log origin/main..main` = 1 commit
restante, `docs(04.5)`).

O QUE FICOU ABERTO (nada bloqueia a fase; detalhe em `04.4-VERIFICATION.md`):

  - **Pedidos do dono adiados para a parte 2:** somar quanto de desconto foi dado no mês; saldo do
    Caixa considerando o mês anterior e aportes de capital de giro.

  - **WINDOWS #32** — `financeiro-extrato.spec.ts:212` instável só na varredura completa; isolado
    passa 32/32.

  - **WINDOWS #3** — bloqueio de login instável sob carga. A hipótese do custo do argon2id foi
    MEDIDA e REFUTADA (25-150ms por tentativa); a suspeita que sobra é o pool sem limite de espera,
    já mitigado (`connectionTimeoutMillis`), sem reprodução direta. Fase 2a/02b, fora do escopo.

  - **WINDOWS #34** — o contador de tentativas de login NÃO é compartilhado entre a rota REST do
    Auth.js e a Server Action nesta build: quem bater direto na rota ganha uma contagem própria.
    Fato real sobre a proteção, medido, ainda sem correção.

  - **Varredura completa do e2e não fica 100% verde** por causa de #3 e #32 — a repetição do CI
    absorve; nunca foi um teste do Financeiro.

Progress: [██████████] 98% (64 de 64 planos da 04.4 executados, verificados e no ar) — retrato
congelado de quando a Fase 04.4 fechou; `gsd_run query state.update-progress` da execução do
plano 04.6-03 encontrou esta linha (a única "Progress:" do arquivo, dentro da seção histórica)
e a bumpou por engano para 94% — revertido aqui de propósito, porque este parágrafo é um
retrato de 2026-09-27, não a posição atual do projeto (essa vive em "## Current Position",
sem uma linha "Progress:" própria).

## Performance Metrics

**Velocity:**

- Total plans completed: 39
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 7 | - | - |
| 02a | 8 | - | - |
| 2b | 5 | - | - |
| 04.1 | 6 | - | - |
| 04.3 | 5 | - | - |
| 04.6 | 8 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 45min | 2 tasks | 26 files |
| Phase 01 P03 | 45min | 3 tasks | 8 files |
| Phase 01-funda-o-e-primeiro-deploy P02 | 20min | 2 tasks | 1 files |
| Phase 01 P04 | 45min | 2 tasks | 7 files |
| Phase 01 P05 | ~50min | 2 tasks | 3 files |
| Phase 01-funda-o-e-primeiro-deploy P06 | 35min | 2 tasks | 3 files |
| Phase 02a P01 | 32min | 3 tasks | 23 files |
| Phase 02a P02 | 50min | 3 tasks | 11 files |
| Phase 02a P03 | 31min | 3 tasks | 11 files |
| Phase 02a P04 | 38min | 3 tasks | 10 files |
| Phase 02a P05 | 45min | 3 tasks | 11 files |
| Phase 02a P06 | 55min | 3 tasks | 11 files |
| Phase 02a P07 | ~100min | 3 tasks | 8 files |
| Phase 02a P08 | ~4h50min (execucao real) + autoria | 3 tasks | 8 files |
| Phase 02b P01 | ~55min | 3 tasks | 12 files |
| Phase 02b P02 | ~2h | 4 tasks | 18 files |
| Phase 02b P03 | ~55min | 3 tasks | 14 files |
| Phase 02b P04 | ~50min | 3 tasks | 7 files |
| Phase 02b P05 | ~40min | 3 tasks | 6 files |
| Phase 03 P01 | 36min | 3 tasks | 27 files |
| Phase 03 P02 | 16min | 3 tasks | 8 files |
| Phase 03 P03 | 14min | 3 tasks | 4 files |
| Phase 03 P04 | 100min | 3 tasks | 10 files |
| Phase 03 P05 | ~110min | 3 tasks | 9 files |
| Phase 03 P06 | ~100min | 3 tasks | 14 files |
| Phase 03 P07 | ~65min | 3 tasks | 10 files |
| Phase 03 P08 | ~40min (agente) + execucao real em producao | 4 tasks | 20 files |
| Phase 04 P01 | ~55min | 3 tasks | 18 files |
| Phase 04 P02 | ~75min | 3 tasks | 12 files |
| Phase 04 P03 | ~50min | 3 tasks | 10 files |
| Phase 04 P04 | ~40min | 3 tasks | 10 files |
| Phase 04 P05 | ~2h10min | 3 tasks | 12 files |
| Phase 04 P06 | ~3h | 3 tasks | 16 files |
| Phase 04 P07 | ~5h (span) | 3 tasks | 8 files |
| Phase 04.1 P01 | 55min | 3 tasks | 17 files |
| Phase 04.1 P02 | ~45min | 3 tasks | 8 files |
| Phase 04.1 P03 | ~25min | 2 tasks | 4 files |
| Phase 04.1 P04 | ~15min (Tarefa 1) + execucao real da migracao pelo dono | 2 tasks | 4 files |
| Phase 04.1 P05 | ~15min | 2 tasks | 7 files |
| Phase 04.1 P06 | ~35min | 3 tasks | 8 files |
| Phase 4.2 P01 | 55min | 4 tasks | 22 files |
| Phase 04.2 P02 | 70min | 3 tasks | 14 files |
| Phase 04.2 P03 | ~3h | 3 tasks | 16 files |
| Phase 04.2 P04 | 1h10min | 3 tasks | 16 files |
| Phase 04.2 P05 | 100min | 2 tasks | 6 files |
| Phase 04.3 P01 | ~65min | 3 tasks | 33 files |
| Phase 04.3 P02 | ~70min | 3 tasks | 16 files |
| Phase 04.3 P03 | ~2h | 3 tasks | 14 files |
| Phase 04.3 P04 | ~2h | 3 tasks | 14 files |
| Phase 04.3 P05 | ~3h35min | 3 tasks | 9 files |
| Phase 04.4 P01 | ~2h40min | 4 tasks | 34 files |
| Phase 04.4 P02 | ~1h10min | 3 tasks | 28 files |
| Phase 04.4 P03 | ~50min | 3 tasks | 22 files |
| Phase 04.4 P04 | ~50min | 3 tasks | 7 files |
| Phase 04.4 P05 | ~2h | 2 tasks | 14 files |
| Phase 04.4 P06 | ~1h20min | 2 tasks | 16 files |
| Phase 04.4 P07 | ~1h40min | 2 tasks | 14 files |
| Phase 04.4 P08 | ~2h50min | 3 tasks | 18 files |
| Phase 04.4 P09 | ~3h20min | 3 tasks | 17 files |
| Phase 04.4 P10 | ~30min | 2 tasks | 14 files |
| Phase 04.4 P11 | ~2h30min | 2 tasks | 6 files |
| Phase 04.4 P12 | ~2h15min | 3 tasks | 19 files |
| Phase 04.4 P13 | ~2h30min | 3 tasks | 22 files |
| Phase 04.5 P01 | ~2h30min | 4 tasks | 32 files |
| Phase 04.5 P02 | 75min | 3 tasks | 22 files |
| Phase 04.5 P03 | ~2h | 3 tasks | 15 files |
| Phase 04.5 P04 | ~2h30min | 3 tasks | 14 files |
| Phase 04.5 P05 | ~1h30min | 2 tasks | 10 files |
| Phase 04.5 P06 | ~2h | 3 tasks | 15 files |
| Phase 04.5 P07 | 1h30 | 3 tasks | 15 files |
| Phase 04.5 P08 | ~2h30min | 3 tasks | 17 files |
| Phase 04.5 P09 | 50min | 3 tasks | 14 files |
| Phase 04.5 P10 | ~3h | 4 tasks | 15 files |
| Phase 04.5 P11 | ~2h30 | 4 tasks | 23 files |
| Phase 04.5 P12 | ~3h30 | 3 tasks | 18 files |
| Phase 04.5 P13 | ~3h30min | 2 tasks | 14 files |
| Phase 04.5 P14 | ~2h15min | 5 tasks | 13 files |
| Phase 04.6 P01 | ~2h | 3 tasks | 152 files |
| Phase 04.6 P02 | 26min | 2 tasks | 16 files |
| Phase 04.6 P03 | 55min | 3 tasks | 33 files |
| Phase 04.6 P04 | ~65min | 3 tasks | 19 files |
| Phase 04.6 P05 | 17min | 2 tasks | 8 files |
| Phase 04.6 P07 | 75min | 3 tasks | 18 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: ordem de execução M0→M1→M2→**M4**→M3→M5→M7 preservada do documento fonte (Fornos antecipado por ser o menor módulo e o fluxo mais usado; Agenda deslocada por ser a mais complexa)
- Roadmap: backup automático (BKP-01..07) mapeado para a Fase 2 (M1), não para a fase de polimento final — é a única rede de proteção sem serviço gerenciado
- Roadmap: M6 (Calculadora de Orçamento) excluída do roadmap ativo — bloqueada por planilhas de precificação ausentes; requisitos ORC-01..05 vivem em REQUIREMENTS.md v2
- Roadmap: M0 e M1 mantidas como fases separadas (não fundidas) — decisão estrutural do documento fonte para isolar toda a dor de infraestrutura antes dos módulos de produto
- [Phase ?]: FRASE_NO_AR vive em app/frase-no-ar.ts (nao em app/page.tsx) porque o Next.js 15 rejeita exports extras em arquivos de pagina
- [Phase ?]: db/migrate.ts e drizzle.config.ts carregam .env.local via process.loadEnvFile() quando o arquivo existe, ja que scripts soltos nao herdam o .env do runtime do Next.js
- [Phase ?]: node:24.19.0-alpine fixado como imagem base do Dockerfile — mesma versao exata do Node local, confirmado por digest identico ao de node:24-alpine
- [Phase ?]: NPM_CONFIG_OFFLINE=true na imagem app — garante que a falha do drizzle-kit na imagem de producao seja deterministica mesmo com rede disponivel no container
- [Phase ?]: Repositorio ja existia (criado pelo dono, publico, secret scanning e push protection ligados); Task 2 adaptada para git puro (remote add + push) sem gh CLI
- [Phase ?]: Protecao de branch main (force-push/exclusao) nao configurada nesta execucao por falta de gh CLI e credenciais de API; registrada como acao pendente do dono
- [Phase ?]: docker/compose.teste.yml sem ports: (D-09 ao pe da letra); scripts/testar-e2e.mjs publica porta so via CLI (docker compose run -p) durante a execucao do teste
- [Phase ?]: Projeto celular do Playwright usa preset Pixel 7 (Chromium) em vez de iPhone (WebKit), para nao instalar um segundo motor
- [Phase ?]: E2E de CI constroi e roda a imagem Docker real (alvo app), nunca next start — corrige lacuna entre o que o gate testa e o que sobe em producao
- [Phase ?]: Migracao do banco de teste em CI chama db/migrate.ts diretamente, nao npm run db:migrate, para manter o workflow livre de qualquer mencao ao comando reservado a migracao de producao
- [Phase ?]: Deploy por SSH sem action de terceiro — cliente ssh nativo do runner, para respeitar a mitigacao do threat model (so actions oficiais do GitHub/Docker)
- [Phase ?]: POSTGRES_USER=amassa_owner e POSTGRES_DB=amassa fixados como convenção nos roteiros de servidor (não são segredo), permitindo que o Roteiro 2 referencie esses nomes diretamente
- [Phase ?]: Linha de prova gravada na tabela verificacao_infraestrutura durante a migração do Roteiro 2, reconferida depois do reinício do VPS, como prova concreta de dados intactos (INFRA-05)
- [Phase ?]: 02a-01: next-auth fixado em 5.0.0-beta.32 (maior 5.x publicada; a tag latest do npm ainda aponta para a linha 4.x) — aprovado no portao de legitimidade de pacote
- [Phase ?]: 02a-01: @node-rs/argon2 fixado em 2.0.2 apesar de ~20 meses sem publicacao — avaliado e aceito pelo dono (ligacao nativa fina e estavel sobre a crate Rust argon2, monorepo napi-rs/node-rs ainda ativo)
- [Phase ?]: 02a-01: playwright.config.ts usa baseURL http://localhost:3000, nao 127.0.0.1 — o NextURL do Next.js normaliza qualquer host 127.x.x.x para 'localhost' ao montar URLs, o que trocaria a origem no meio do redirect de login e descartaria o cookie de sessao
- [Phase ?]: 02a-01: divisao de borda do Auth.js (auth.config.ts sem argon2/banco/authorize x auth.ts com tudo isso) provada por teste de grafo de modulos, nao so por inspecao — tests/unit/auth-borda.test.ts falha se a divisao for desfeita
- [Phase ?]: 02a-02: amassa_app nasce sem senha na migracao (login sem password) — o metodo de autenticacao da imagem exige senha para conexao por rede, entao nao ha janela de acesso entre a migracao e a definicao da senha no servidor (roteiro do plano 08)
- [Phase ?]: 02a-02: grant connect usa current_database() dinamico via bloco do $$ ... execute format(...) $$, nao o nome literal 'amassa' — a mesma migracao vale tambem contra o banco de teste efemero (amassa_teste)
- [Phase ?]: 02a-02: scripts/testar-migracoes.mjs calcula a data de Brasilia com Intl.DateTimeFormat nativo do Node, sem instalar date-fns-tz so para a conferencia de teste
- [Phase ?]: 02a-03: ErroBloqueado (subclasse de CredentialsSignin) carrega segundosParaLiberar intacto ate lib/auth/acoes.ts sem serializacao, confirmado nas fontes de @auth/core
- [Phase ?]: 02a-03: avaliarCredenciais compara contra usuario.senhaHash quando o usuario existe (mesmo desativado) e contra um hashDeReferencia gerado no boot so quando nao existe, igualando o tempo de resposta
- [Phase ?]: 02a-03: tests/e2e/autenticacao.spec.ts roda em modo serial (test.describe.configure) para eliminar contencao de recursos entre os quatro testes e a corrida teorica sobre a conta compartilhada
- [Phase ?]: 02a-04: exigirUsuario() busca usuario pelo e-mail da sessao (indice funcional lower(email)), nao por id de token — o callback session padrao do Auth.js remove id do objeto de sessao, e adiciona-lo exigiria module augmentation so para isso
- [Phase ?]: 02a-04: cookies.sessionToken.options.secure=true estatico em auth.config.ts funciona em http://localhost porque o Chrome trata localhost como contexto seguro (aceita cookies Secure sem TLS)
- [Phase ?]: 02a-04: auth.ts e importado de forma dinamica dentro de exigirUsuario() (nao no topo do arquivo) para manter avaliarAutorizacao() testavel no Vitest sem herdar a resolucao de next/server que so o bundler do Next.js resolve
- [Phase ?]: 02a-04: testes e2e que MUTAM estado compartilhado (ativo de um usuario) usam conta dedicada criada na hora, exclusiva por projeto Playwright — reaproveitar a conta global de login so e seguro para leitura
- [Phase ?]: 02a-05: verificar-acoes.mjs decide por arvore sintatica do compilador do TypeScript (nunca regex) se uma acao de servidor toca o banco sem exigirUsuario() na primeira instrucao
- [Phase ?]: 02a-05: verificar-acoes.mjs aceita arquivo ou diretorio no mesmo argumento de linha de comando, permitindo o teste unitario apontar fixtures individuais sem subpasta so de aprovados
- [Phase ?]: 02a-05: scripts/testar-migracoes.mjs roda redefinir-senha e desativar-usuario como processo filho de verdade (nao reimplementa a logica) para provar o comando que a pessoa vai digitar
- [Phase ?]: 02a-06: execucoes_backup nasce sem atualizado_em/trigger — segunda tabela do sistema na excecao 'so insercao' de 02-MODELO-DE-DADOS.md §0
- [Phase ?]: 02a-06: decidirFrescorDoBackup() checa relogio no futuro antes de sucesso/destino_externo_ok — timestamp inconsistente invalida a leitura inteira
- [Phase ?]: 02a-06: /api/health/backup nunca expoe bytes no corpo — o tamanho absoluto do dump revelaria o volume de dados do atelie a qualquer pessoa na internet (T-02a-28)
- [Phase ?]: 02a-06: advisory lock do Postgres (pg_advisory_lock) serializa backup.spec.ts entre os dois projetos do Playwright — execucoes_backup nao tem chave natural de particionamento como usuarios tem por e-mail
- [Phase ?]: 02a-07: pg_dump gerado sempre com --clean --if-exists — o mesmo dump restaura sobre banco vazio ou sobre o mesmo banco de onde saiu, sem 'relation already exists'
- [Phase ?]: 02a-07: mensagem de registro entra no psql pela entrada padrao (stdin), nunca por -c — psql -c nao substitui variaveis :'nome' nesta versao (17.10)
- [Phase ?]: 02a-07: .gitattributes novo forcando LF em *.sh — CRLF quebraria os scripts POSIX no servidor Linux independente do core.autocrlf de quem commita
- [Phase ?]: 02a-07: scripts/testar-backup.mjs descobre o container do Postgres de teste em CI pela imagem (docker ps --filter ancestor=postgres:17-alpine), nao por nome fixo
- [Phase ?]: 02a-08: teste comprimido do disparo do cron (linha temporaria, poucos minutos a frente) em vez de esperar 24h — descobriu que o daemon do cron nao releu o fuso apos a normalizacao do servidor para UTC, sem nenhuma mensagem de erro em crontab -l/systemctl/journal
- [Phase ?]: 02a-08: servidor normalizado para Etc/UTC em vez de compensar o fuso de Brasilia dentro da linha do cron; reiniciar o cron apos qualquer mudanca de fuso do sistema, ja que ele so le TZ na inicializacao
- [Phase ?]: 02a-08: execucoes_backup diverge por construcao entre o banco do ensaio de restauracao e a producao (o backup.sh registra a propria execucao DEPOIS do dump) — so usuarios e verificacao_infraestrutura precisam bater exatamente na conferencia
- [Phase ?]: 02a-08: bug de callbackUrl vazando https://0.0.0.0:3000 no redirecionamento nao autenticado registrado em WINDOWS.md (id 2) e nao corrigido — fora de files_modified deste plano, causa provavel em lib/auth/auth.config.ts das fases 02a-03/02a-04
- [Phase ?]: 02b-01: shadcn CLI fixada em 3.8.5 (nao @latest) para init/add button — a versao mais recente usaria o preset padrao 'Nova' com @base-ui/react em vez de primitivas Radix, contrariando o Component library: Radix UI do 02b-UI-SPEC.md
- [Phase ?]: 02b-01: registro do shadcn resolve radix-ui (pacote unificado) no lugar de @radix-ui/react-slot, e lucide-react numa linha 1.x — nao e artefato de versao da CLI, e o registro do lado do servidor; aprovado apos novo portao de legitimidade com lucide-react fixado em 1.28.0 (nao 1.30.0, por higiene de cadeia de suprimentos)
- [Phase ?]: 02b-01: @theme do Tailwind v4 resolve no escopo :root — variavel de fonte do next/font/google declarada so no <body> nao e enxergada la; as classes .variable precisam ir no <html>. Achado no portao de retorno do tracer via getComputedStyle, nao por lint/tsc/build
- [Phase ?]: 02b-01: next/font/google com a opcao variable produz o nome legivel da familia (Archivo Narrow, com espaco), nao o nome com hash (__Archivo_Narrow_hash) — este ultimo so aparece no padrao de uso via .className direto. Testes futuros de font-family devem usar o nome medido
- [Phase ?]: 02b-02: shadcn CLI mantida em 3.8.5 (nao @latest), repetindo a 02b-01, por consistencia com components.json (radix-nova) e button.tsx ja commitados
- [Phase ?]: 02b-02: zero pacote npm novo na instalacao de card/sidebar/sheet/skeleton/dropdown-menu/separator — os quatro primitivos Radix necessarios ja vinham vendidos por radix-ui@1.6.7 aprovado na 02b-01, confirmado por diff vazio de package.json/package-lock.json
- [Phase ?]: 02b-02: DropdownMenuItem do Radix com asChild aplica role=menuitem no elemento raiz e nao submete <form> aninhado de verdade — quando role=button precisa ser preservado, o alvo do asChild e um <div> neutro com o <button real dentro chamando a Server Action direto no onClick
- [Phase ?]: 02b-03: CabecalhoPagina nao recebe children em nenhuma das seis telas — o botao desabilitado de cada modulo vive dentro de EstadoVazio, seguindo o esqueleto literal do texto de acao em vez do diagrama do 02b-UI-SPEC.md; componente continua pronto para children (flex-wrap ja resolvido)
- [Phase ?]: 02b-03: tests/e2e/casca.spec.ts roda em serie (mesma convencao de autenticacao/sessao.spec.ts) por prudencia de carga — cada caso faz login com hash argon2id real
- [Phase ?]: 02b-03: locator de navegacao por visibilidade (nunca por nome de projeto Playwright) — barra lateral e barra inferior sempre coexistem no DOM, so uma fica oculta por CSS; :visible filtra a metade oculta em checagens de aria-current
- [Phase ?]: 02b-04: app/not-found.tsx (raiz) confirmado em execucao real como quem sempre responde a URL sem casamento (mesmo sub-rota de modulo existente), nunca app/(app)/not-found.tsx, que fica pronto para a primeira notFound() de rota dinamica da Fase 3
- [Phase ?]: 02b-04: tests/e2e/estados.spec.ts prova que a navegacao NAO aparece no 404 alcancavel por URL (ausencia estrutural, fora da casca) - correcao da suposicao original do plano, documentada com achado em execucao real
- [Phase ?]: 02b-05: gate de legitimidade da Tarefa 1 resolvido pela verificacao independente do orquestrador (npm view confirmou axe-core@4.13.0 e @axe-core/playwright@4.12.1 do repositorio oficial dequelabs/axe-core-npm) sob autorizacao permanente do dono
- [Phase ?]: 02b-05: NOME_ACESSIVEL_MENU_USUARIO vive em lib/acessibilidade/rotulos.ts (modulo puro) em vez de cabecalho-movel.tsx — importar direto do componente quebrava o carregador de teste do Playwright (cadeia ate next-auth/next-server)
- [Phase ?]: 02b-05: backstop de nome longo do UI-SPEC convertido em teste automatizado real com 53 caracteres (nao os 43 do exemplo do checklist humano, que nao forca corte no Sheet do celular)
- [Phase ?]: 02b-05: checkpoint bloqueante da Tarefa 3 (UI-05, D-05, olhada geral) nao respondido nem auto-aprovado — registrado em 02b-VERIFICACAO-HUMANA.md, pendente do dono
- [Phase ?]: Formatação de data por split/reverse/join direto em page.tsx (sem Date), adiando lib/encomendas/formato.ts (PD-04) para quando mais de um lugar precisar formatar
- [Phase ?]: criarEncomenda usa assinatura pronta para useActionState (estadoAnterior, FormData), chamada hoje via .bind(null, null) a partir de Server Component
- [Phase ?]: shadcn 'form' (radix-nova/CLI 3.8.5) não instala nenhum arquivo — decisão de field vs wrapper próprio vs react-hook-form direto fica em aberto para o plano 06 (WINDOWS.md #4)
- [Phase ?]: celulasDeQuinzena recebe formatarMes por injeção de parâmetro para manter gantt.ts sem import
- [Phase ?]: situacaoEm ordena cancelada -> concluida -> sem-etapas -> nao-comecou -> atrasada -> busca de etapa, cada if com retorno próprio
- [Phase ?]: textoDaSituacao(semCor:true) troca a frase de atrasada para uma forma sem depender de --color-atencao, revisável no plano 08
- [Phase ?]: 03-03: select ... for update dentro de db.transaction (PD-02) — o novo valor do ajuste rápido nasce da linha travada, nunca de um número vindo do cliente
- [Phase ?]: 03-03: entrada de objeto tipado (não FormData) nas seis ações novas — nenhuma UI as consome ainda; criarEncomenda continua com FormData/useActionState
- [Phase ?]: 03-03: esquemaAtualizacaoDeEncomenda local a acoes.ts via esquemaEncomenda.extend() — reusa nome/cliente/data/etapas sem reimplementar, só acrescenta id + itens com id opcional para reconciliação
- [Phase ?]: Gantt e lista mobile compartilham o mesmo conjunto filtrado (rascunho+em_producao, D-06) ate o plano 07 trazer filtro/historico de verdade
- [Phase ?]: Coluna fixa do Gantt via position:sticky dentro do unico container rolavel, nao dois containers sincronizados por scroll
- [Phase ?]: estado-vazio.tsx ganhou hrefBotao?: string aditivo — botao vira Link habilitado quando presente, mantem o disabled de sempre quando ausente
- [Phase ?]: 03-05: Switch/botao do ajuste rapido usam style inline (nao classe) para o alvo de toque de 44px — o Switch do shadcn tem data-[size=default] embutido, que vence qualquer classe solta por especificidade CSS
- [Phase ?]: 03-05: AlertDialogAction com event.preventDefault() + open/onOpenChange controlado é o padrao para dialogo que nao fecha ate a resposta do servidor — vale para qualquer acao destrutiva futura do projeto
- [Phase ?]: 03-05: D-06 (Gantt/lista so mostra rascunho/em_producao) provado com dado real pela primeira vez, ja que este plano criou os unicos caminhos de escrita que alcancam concluida/cancelada
- [Phase ?]: 03-06: FormularioEncomenda montado em page.tsx, nao em lista-encomendas.tsx — o vazio precisa abrir ?nova antes de existir qualquer encomenda
- [Phase ?]: 03-06: Dialog unico com conteudo responsivo por CSS em vez de Dialog+Sheet simultaneos — dois Root modais abertos ao mesmo tempo levam o proprio Radix a marcar ambos aria-hidden, provado por teste real
- [Phase ?]: 03-06: criarEncomenda migrado de (estadoAnterior, FormData) para (entradaBruta: unknown), mesmo formato das outras seis acoes; useActionState deixou de ser necessario
- [Phase ?]: 03-07: filtros.ts é o quarto módulo puro sem import da fase — redeclara estruturalmente o Situacao de cronograma.ts (SituacaoDeUrgencia) em vez de import type, porque o grep de aceite exige zero linhas de import no arquivo
- [Phase ?]: 03-07: compararPorUrgencia usa um único número de proximidade por Situacao (atrasada mais negativo = mais urgente, marco=0, as três proximidades em dias, sem-próxima-etapa sempre no fim) — fórmula não especificada no plano, decisão do executor
- [Phase ?]: 03-07: estado-vazio.tsx ganhou aoClicar?: () => void aditivo (ação de cliente) ao lado de hrefBotao (navegação) — Limpar filtros usa aoClicar, Nova encomenda continua usando hrefBotao
- [Phase ?]: 03-07: e2e — page.waitForLoadState('networkidle') depois de navegar para uma rota antes de clicar num botão que acabou de aparecer, para evitar clique perdido por hidratação do React ainda não ter anexado o onClick (achado real, não suposição)
- [Phase ?]: 03-08: textoDaSituacao(semCor:true) reaproveitado verbatim na folha impressa, sem estender Situacao com campo etapa no ramo atrasada
- [Phase ?]: 03-08: listarEncomendasAtivas() e listarEncomendasDoIndice(hoje) compartilham anexarItensEEtapas (join), nunca o WHERE — escopos permanecem distintos
- [Phase ?]: 03-08: roteiro de migracao corrigido para 'docker compose run --rm ferramentas', nao 'docker compose exec app' — a imagem app nao tem drizzle-kit/tsx/db/
- [Phase ?]: 03-08: Fase 3 completa e migrada em producao (2026-08-10) — ENC-01 a ENC-14 entregues; verificacao humana de fim de fase PARCIAL (criacao+celular confirmados, 12 criterios nao percorridos item a item, ajustes de desktop mencionados sem detalhe, ver SUMMARY)
- [Phase ?]: 04-01: aplicar-no-fim-da-fase — migracao 0007/0008 gerada agora, aplicada em producao so no plano de fechamento 04-07, apos backup, a mao
- [Phase ?]: 04-01: consultas.ts devolve dado bruto (ocorrenciasDeQueima/ultimaManutencaoEm), nunca contador/total pre-agregados em SQL — cartao-forno.tsx chama medirForno() (lib/queimas/contador.ts), unico lugar que decide a regra
- [Phase ?]: 04-01: FOR-11 nao marcado completo apesar de listado no frontmatter do plano — so o cadastro (criarForno) foi entregue; desativar/reativar forno e escopo do plano 04-04
- [Phase ?]: 04-01: erro de FK (forno inexistente) traduzido via erro.code === '23503' (SQLSTATE foreign_key_violation) — primeira vez que o projeto checa codigo de erro do Postgres diretamente
- [Phase ?]: 04-02: fraseDoRodape recebe data ja formatada (nao timestamptz bruto) para preservar textos.ts nunca importar valor de formato.ts
- [Phase ?]: 04-02: queimas-cartao.spec.ts prova as tres fronteiras de FOR-04 com forno de limite 10 (piso Math.max(1,limite-10)=1), 10 registros reais em vez de 100
- [Phase ?]: 04-02: specs de Queimas ganharam retries:2 local + timeouts alargados — servidor Next unico compartilhado por todos os workers da suite, confirmado deterministico isolado (--workers=1)
- [Phase ?]: 04-03: buscarForno reaproveita a consulta de manutencoes (desc) para dois propositos — ultimaManutencao e o historico completo exibido
- [Phase ?]: 04-03: ocorrenciasDeQueima de buscarForno traz TODAS as queimas (sem limite) — so queimasRecentes e limitada a 25; medirForno precisa do total real
- [Phase ?]: 04-03: excluirQueima passou a revalidar tambem /queimas/[id], nao so /queimas — gap do plano 04-01 frente ao padrao ja documentado em 04-PATTERNS.md
- [Phase ?]: 04-03: historico-queimas.tsx virou client component (estado local de qual linha tem o dialog de exclusao aberto); historico-manutencoes.tsx continua Server Component
- [Phase ?]: registrarManutencao usa db.transaction + select...for update para serializar manutenções concorrentes; desativarForno/reativarForno filtram o WHERE pelo valor oposto de ativo em vez de checar-e-decidir
- [Phase ?]: lib/queimas/consultas.ts não precisou de mudança neste plano — FornoMedido/FornoComHistorico já expunham ativo desde 04-01/04-02
- [Phase ?]: 04-05: fraseDoBanner/prefixoDoBanner e ordenarParaBanner (lib/queimas/filtros.ts) sao o unico par que produz a copy do aviso agregado, reaproveitado pelo banner de /queimas e pelo cartao do painel inicial
- [Phase ?]: 04-05: CartaoPainel ganhou children opcional (aditivo) em vez de um segundo componente - os outros tres cartoes do painel nao mudaram de assinatura
- [Phase ?]: 04-05: scripts/testar-e2e.mjs passou a esperar conectividade TCP real na porta do Postgres de teste (nao so o Health.Status do Docker) apos ECONNREFUSED intermitente sob troca rapida de conteineres no Windows/WSL2
- [Phase ?]: recharts fixado em 3.10.1 (linha 3.x, não 2.x) apesar do Redux Toolkit transitivo — rota própria isola o peso do caminho de dois toques
- [Phase ?]: estatisticas-queimas.spec: teste de total GLOBAL roda só no projeto desktop (test.skip no celular), delta tolerante ao único escritor concorrente conhecido do arquivo
- [Phase ?]: 04-07: migração 0007_queimas/0008_gatilhos-queimas aplicada em producao e verificada no banco (pg_trigger, atualizado_em provado por edição real) — Tarefa 2 concluída
- [Phase ?]: 04-07: 04-VERIFICACAO-HUMANA.md produzido com 26 itens, todos em aberto — Tarefa 3 redefinida em tempo real para 'produzir, não completar' porque o dono estava indisponível (decisão do coordenador)
- [Phase ?]: 04-07: duas causas raiz de falha real de CI corrigidas (autenticacao.spec.ts sem testInfo.retry no e-mail de bloqueio; queimas-manutencao.spec.ts sincronizando por um valor que não muda) — confirmadas com --workers=2 e CI run #46 verde
- [Phase ?]: D-06 confirmado pelo humano (2026-08-21): substituir marcos_zero_ou_um por marcos_sempre_um_dia (dias=1 fixo nos tres marcos), nao apenas remover a restricao
- [Phase ?]: diasAteProxima de em-etapa-intervalo corrigido para contar ate o inicio da proxima faixa desenhada, nunca ate o fimExclusivo da atual (mentia quando havia vao de espera)
- [Phase ?]: 04.1-02: posicaoDeHojeNaTrilha passou a medir extensao de calendario (fimExclusivo da ultima faixa desenhada menos inicio da primeira), nao soma de duracoes - o 27o dia de uma encomenda de 32 dias caia num vao de espera e sumia com null
- [Phase ?]: 04.1-02: segmentosDaTrilha(faixas) novo em lib/encomendas/trilha.ts - geometria proporcional de etapas + vaos discriminada por tipo, consumida por trilha-segmentos.tsx sem nenhuma aritmetica de calendario no componente
- [Phase ?]: 04.1-02: vao do Gantt provado por medida de pixel (54px/90px/0px) em vez de inspecao visual - nenhuma linha de codigo nova em gantt.ts/gantt.tsx, confirmando D-09 (o vao sai de graca do deslocamento de inicio do plano 01)
- [Phase ?]: 04.1-02: corrigido bug latente do plano 01 - teste e2e da fronteira producao/secagem assumia producao com 3 dias (valor anterior a DIAS_PADRAO da fase 04.1); dataEmDias(-3) virou dataEmDias(-5), nao reverificado por e2e nesta sessao (fora do --grep desta tarefa), confirmado na varredura completa do plano 04.1-04
- [Phase ?]: ENC-03 reescrito, ENC-04 retirado (nao apagado) e ENC-15 criado em REQUIREMENTS.md; criterio de sucesso 3 da Fase 3 corrigido com nota apontando a Fase 04.1
- [Phase ?]: 02-MODELO-DE-DADOS.md e 00-BRIEFING.md nao mencionam mais marco como interruptor; DDL de encomenda_etapas espelha db/schema.ts
- [Phase ?]: Migracao 0009_espera-dos-marcos aplicada em producao (D-10 conferido, backup verificado, coluna/tres restricoes lidas do banco, insert invalido rejeitado) — fecha a Fase 04.1
- [Phase ?]: Esmaltacao mantida em 1 dia — pendencia nao bloqueante carregada para o dono decidir depois
- [Phase ?]: O caminhador de arvore sintatica decide pelo texto do no do topo da cadeia de chamadas, nunca sobre o arquivo inteiro — evita falso positivo de orderBy em outra consulta do mesmo arquivo.
- [Phase ?]: inverterOrdemFisicaDasEtapas usa delete+reinsert, nunca UPDATE — HOT update preservaria o ponteiro fisico e nao provaria a divergencia de ordem.
- [Phase ?]: duracaoTotalEmDias/dataDeConclusao invariantes a ordem sob as restricoes atuais foi documentado como acidente, nao garantia.
- [Phase ?]: 04.1-06: AjusteInvalido (molde de EncomendaNaoEncontrada) fecha o gap 17/CR-02 — teto de 365 dias devolve { ok: false, erro } em vez de exceção não tratada; try/catch/finally no cliente garante saída do estado pendente em todo caminho
- [Phase ?]: 04.1-06: WR-02 resolvido com região viva (aria-live=polite + sr-only) ao lado do número aria-hidden, não aria-label no span — anuncia valor atual e valor novo sem tocar em rótulo de botão já testado
- [Phase ?]: 04.1-06: roteiro de migração ganhou guarda que confere dias<>1 em linha de marco (WR-01); WR-03 (datas conflitantes em TrilhaEtapas) registrado como adiado em 04.1-CONTEXT.md, sem código, aguardando o dono
- [Phase ?]: D-19 consultada e confirmada (04.2-01): parcela cujo dia nao existe no mes seguinte cai no ultimo dia daquele mes; ja decidida pelo dono em 2026-08-30, sem novo portao
- [Phase ?]: 04.2-01: calcularParcelas usa soma por prefixo telescopico (nao total/n repetido) para a soma das parcelas fechar exata com o total mesmo em divisao nao exata
- [Phase ?]: T-04.2-07 verificado com a corrida real: gestor escolhido no formulário é desativado depois de escolhido e antes do envio, provando que o servidor decide no instante do salvamento, não o formulário.
- [Phase ?]: Contas de gestor DEDICADAS (nunca a global E2E_EMAIL_TESTE) para qualquer teste e2e que mute ativo — mesmo padrão de tests/e2e/sessao.spec.ts.
- [Phase ?]: Diálogo de remoção montado por LINHA (não por página), cada instância lendo o próprio useSearchParams() e abrindo só quando ?removerItem=<este id> bate — evita promover as listas inteiras a Client Component
- [Phase ?]: removerItemDeAbertura conta as tarefas ligadas DENTRO da mesma transação que apaga a linha, e nunca toca abertura_tarefas — quem solta é a restrição on delete set null da migração 0010
- [Phase ?]: CaixaMarcacao recebe o estado desejado, nunca inverter — duas chamadas com o mesmo valor convergem sempre, o que torna o salvamento otimista seguro sob concorrência (T-04.2-13)
- [Phase ?]: fluxoMensal e a fonte unica do fluxo mensal - resumoDoPainel e a aba Por mes leem dela, nunca uma segunda soma
- [Phase ?]: Empate no topo do pico marca TODOS os meses empatados (nunca so o primeiro), para o resultado nao depender da ordem de iteracao de um Map
- [Phase ?]: definirDataDeInauguracao usa insert...on conflict sobre a restricao de linha unica - nunca select seguido de insert/update
- [Phase ?]: Fase 4.2 fecha com a ressalva registrada: a suite e2e nao esta 100% verde (defeito de framework React/Next.js, mitigado nos fluxos criticos, tambem presente em Queimas/Encomendas).
- [Phase ?]: conferirRemocaoDoModuloAbertura semeia dado LIGADO (item_id nao nulo) antes do drop, provando a FK em uso, nao so linha solta.
- [Phase ?]: 04.3-01: shadcn CLI 3.8.5 (textarea/checkbox) importa cn de pacote npm de terceiro em vez de @/lib/utils — corrigido, dependencia revertida
- [Phase ?]: 04.3-01: pilula 'editar categoria' (D-15) nao construida no plano 01 — sem Server Action de update/delete; registrado em WINDOWS.md #28 para plano seguinte
- [Phase ?]: 04.3-02: canal local abrirCategoriaParaEditar no abridor de cotacoes - history.pushState nao busca dado novo do servidor, achado real pelo e2e
- [Phase ?]: 04.3-02: Excluir categoria troca categoriaDialogo por categoriaRemover na URL (Dialog e AlertDialog nunca abertos ao mesmo tempo)
- [Phase ?]: 04.3-03: atualizarCotacao/removerCotacao nunca apagam e recriam a linha; categoriaId nunca entra no UPDATE embora o esquema o exija por composicao
- [Phase ?]: 04.3-03: botao de remover de cotacao nao usa canal local no abridor (ao contrario do de editar) - confirmacao acha a linha na lista ja carregada, so a presenca de ?cotacaoRemover= na URL importa
- [Phase ?]: 04.3-03: LinhaCotacao/CartaoCotacao extraidos de lista-cotacoes.tsx, com o icone TriangleAlert (D-12) visivel antes do nome da empresa quando ha alertas
- [Phase ?]: 04.3-04: ordenarCotacoes generalizada (T extends CotacaoParaOrdenar) para devolver o tipo completo de Cotacao, sem segunda passagem de dados
- [Phase ?]: 04.3-04: CamposLongos compartilhado por DetalheCotacao e ComparacaoCotacoes - um so lugar para o rotulo/tratamento de alerta dos seis campos longos
- [Phase ?]: 04.3-04: MarcarCotacao usa zona de toque REAL de 44x44 (span externo) + hit-slop maior no Checkbox, nunca so um hit-slop invisivel
- [Phase ?]: 04.3-05: migracoes 0012/0013 aplicadas em producao pelo dono em 2026-09-18 (Roteiro 9); passo 4 do roteiro corrigido antes (0c690d4, sintaxe \gset invalida em psql -c); evidencia colada para tabelas/gatilhos/enum/privilegios/restricao, backup pos-deploy e residuo relatados sem saida colada (lacuna registrada no SUMMARY)
- [Phase ?]: 04.4-01: numeração de documentos = opção A (sequência única venda+despesa), decisão do dono na Tarefa 0 (checkpoint pré-respondido)
- [Phase ?]: 04.4-01: textoVendaLancada recebe o total já formatado (string), nunca centavos — textos.ts nunca importa formato.ts (mesma disciplina de lib/queimas/textos.ts)
- [Phase ?]: 04.4-01: DialogoValorLivre sem aria-label redundante no DialogContent — colidia com getByLabel('Valor') do Playwright via o aria-labelledby automático do Radix ("Valor livre" contém "Valor")
- [Phase ?]: 04.4-02: ITENS_NAVEGACAO dividido em ITENS_NAVEGACAO_CELULAR (5, Financeiro no lugar do Estoque)/ITENS_NAVEGACAO_LATERAL (6, ganhou o Financeiro) — D-04/D-05
- [Phase ?]: 04.4-02: AbasFinanceiro virou Client Component (usePathname) para saber se está em /cadastros; memo com comparador próprio sobre (aba, emCadastros)
- [Phase ?]: 04.4-02: lib/cadastros/categorias.ts nem import de tipo (grep de aceite do plano) — enums grupo/área redeclarados como literais, não importados de db/schema.ts
- [Phase ?]: 04.4-02: codigoDoErroPostgres() em lib/cadastros/acoes.ts olha erro.code E erro.cause.code — drizzle-orm/node-postgres embrulha o SQLSTATE real em .cause; mesmo padrão quebrado suspeito em ehViolacaoDeChaveEstrangeira de outros módulos, não corrigido (fora do escopo)
- [Phase ?]: 04.4-03: repartirDesconto (D-09/D-10) chamada idêntica no cliente e no servidor — piso inteiro, sobra na maior linha (empate: a primeira), recusa de repartição impossível
- [Phase ?]: 04.4-03: efeitoNoEstoque faz toda conta em milésimos inteiros (nunca ponto flutuante acumulado) — contrato estável que a Fase 6 troca de mostrar para gravar
- [Phase ?]: 04.4-03: DialogoValorLivre agrupa por GRUPO (Receitas/Fora do resultado), não por área — evita esconder a distinção sob o rótulo 'Geral' compartilhado
- [Phase ?]: 04.4-03: lancarVenda resolve item de catálogo no servidor (descrição/categoria/existência nunca vêm do cliente); mudar preço depois não reescreve venda já lançada
- [Phase ?]: 04.4-04: parcelasInteirasDoItem chama calcularParcelas e só acrescenta arredondamento de prefixo em centavos inteiros — lib/abertura/parcelas.ts continua a fonte única da data/valor de cada parcela
- [Phase ?]: 04.4-04: a data do documento importado é a da COMPRA (item.primeiraParcelaEm original), nunca a da primeira parcela ainda em aberto — suposição 2 do plano
- [Phase ?]: 04.4-04: lib/virada/ é o único módulo fora de lib/abertura que importa lib/abertura/parcelas.ts, por caminho relativo — sai junto com o código da Abertura (Roteiro 8), só depois de o Roteiro 11 já ter rodado
- [Phase ?]: 04.4-05: esquemaItem/esquemaEdicaoDeItem viram fábricas (recebem o mapa de insumos) — validarItem precisa desse retrato do banco, que só existe depois de uma leitura
- [Phase ?]: 04.4-05: podeDeixarDeTerEstoque roda ANTES da regra estrutural genérica (cliente e servidor) — quando as duas seriam verdade ao mesmo tempo, 'esse item é insumo de X' é a frase mais acionável
- [Phase ?]: 04.4-05: FichaTecnica sempre visível no diálogo do item, independente de 'Tem estoque próprio' — a ficha pertence ao item vendido, não ao insumo
- [Phase ?]: 04.4-06: gerarPlano usa divisão inteira (floor) com o resto do arredondamento na PRIMEIRA parcela (Nx) e metade arredondada para cima na primeira (sinal) — diferente do prefixo telescópico de lib/abertura/parcelas.ts, por exigência explícita do must_have da fase
- [Phase ?]: 04.4-06: BlocoPagamento decide só rótulos e o aviso do cartão (tipo venda|despesa); o painel hospedeiro chama gerarPlano/dividirEmDuasFormas e guarda o estado — mesmo componente para Venda e Despesa (plano 07)
- [Phase ?]: 04.4-06: conferirParcelas chamada duas vezes do lado do cliente (BlocoPagamento para mostrar, painel-venda.tsx para gatear o botão) — duplicação deliberada de função pura, exigida pelo grep de aceite do plano
- [Phase ?]: 04.4-07: GradeCatalogo/ListaCompleta generalizados com uma prop 'modo' (venda|compra) via generics — o mesmo componente, painel-venda.tsx continua sem mudança
- [Phase ?]: 04.4-07: categoria de compra nunca conferida quanto a 'ativa' em lancarDespesa (só controlaEstoque do item) — só a categoria de 'outra despesa' recusa quando desativada, como o must_have pede
- [Phase ?]: 04.4-07: lancarDespesa nunca grava taxaPontosBase, mesmo com forma 'cartao' — despesa no cartão entra pelo valor cheio
- [Phase ?]: 04.4-08: planejarDesfazer decide por temLinhaDeDiferenca + previsto/pago, nunca recontando linhas/parcelas isoladamente — a decisão vem do que aconteceu, não de uma nova contagem
- [Phase ?]: 04.4-08: ordem fixa de trava (documento primeiro, parcela depois) repetida em cancelarDocumento/registrarPagamento/desfazerPagamento — evita deadlock entre qualquer par delas
- [Phase ?]: 04.4-08: formatarInstanteCurto (novo, lib/financeiro/formato.ts) formata timestamptz com fuso America/Sao_Paulo explícito — nunca confundir com formatarDataCurta (dia civil puro)
- [Phase ?]: 04.4-09: resumoDoMes cobre a linha de diferença (D-02) sem caso especial — a categoria 'Juros, multas e descontos' já nasce grupo geral
- [Phase ?]: 04.4-09: filtrarExtrato nunca recalcula saldoDepoisCentavos (D-12) — recebe as linhas já com o saldo global de montarExtrato
- [Phase ?]: 04.4-09: mes-reservado.ts com nove meses espaçados de 3 em 3 — o mês anterior de qualquer chave é garantidamente vazio sob desktop/celular em paralelo
- [Phase ?]: 04.4-09: e2e do extrato compara saldo depois por diferença RELATIVA entre linhas, não valor absoluto entre leituras — saldo depois é acumulado global (D-12), vulnerável ao próprio projeto irmão em comparações absolutas
- [Phase ?]: 04.4-10: contas-fixas.ts com formato próprio de mês curto (janeiro/2027) para o título gerado, distinto de nomeDoMes (janeiro de 2027) do rótulo/aviso — os dois exemplos do plano usam grafias diferentes
- [Phase ?]: 04.4-10: avisoDaUrl (lib/cadastros/avisos.ts) migrado de string para objeto {aviso,quantidade,mes} para caber o aviso contas-geradas — teste unitário existente atualizado, não deixado quebrado
- [Phase ?]: 04.4-10: gerarContasDoMes idempotente por insert...on conflict(conta_fixa_id, mes_referencia) do nothing dentro de uma transação — o banco decide, nunca uma leitura prévia de já existe?
- [Phase ?]: 04.4-11: Roteiro 10 e verificação humana produzidos (Tarefas 1-2); Tarefas 3 (migração em produção) e 4 (verificação humana) pendentes do dono — checkpoints não resolvidos por regra do projeto
- [Phase ?]: pagaAVista/pagas movidos para o módulo puro lib/financeiro/parcelas.ts (não a tela) porque o painel regenera o plano do zero a cada mudança de carrinho/data/plano
- [Phase ?]: mesPermitidoParaGeracao(hoje, mes) substitui a igualdade fixa com o mês seguinte — a única porta que o servidor usa para aceitar um mês em gerarContasDoMes
- [Phase ?]: vencimentoAvistaAberto (estado próprio do painel) preserva a data Vence em através da regeneração do plano — achado necessário pelo próprio caso de e2e do plano (Rule 1, corrigido antes do commit)
- [Phase ?]: 04.4-13: token unico --deslocamento-aviso deriva o deslocamento do toast da altura real da barra, lido pelas duas portas do sonner (offset/mobileOffset), trocando de valor no breakpoint md (768px) para cobrir a faixa 601-767px
- [Phase ?]: 04.4-13: etiqueta do carrinho separa TEXTO por motivo - tabela R$ X so para preco editado, - R$ X de desconto para qualquer linha atingida pelo desconto (item comum, valor na hora, valor livre)
- [Phase ?]: 04.4-13: filtrarExtrato soma sempre (tipo deixa de aceitar null); a politica de esconder a linha do total quando nao ha movimento passou para a tela
- [Phase ?]: 04.5-01: os 18 nomes de chave de parametro (material_argila, forno_tarifa_energia, preco_lucro...) sao invencao desta execucao, estaveis entre schema.ts/CATALOGO_DE_PARAMETROS/semente 0019
- [Phase ?]: parametrosVigentes devolve porChave + calculo (ParametrosDoCalculo) + taxaCartaoPontosBase numa consulta só; nenhum outro módulo monta o agregado na mão
- [Phase ?]: Migração 0020 corrige o gatilho de parametros_precificacao (0018): a linha de HOJE pode ter o valor corrigido, só uma linha de dia anterior fica congelada — achado real ao rodar o e2e contra Postgres
- [Phase ?]: 'Uma fornada de biscoito/esmalte custa' do protótipo foi omitida da tela de Parâmetros (não é must_have, exigiria expor cálculo interno de calculo.ts)
- [Phase ?]: [04.5-03]: Nenhuma migracao nova — fotosBytes/fotosDestinoExternoOk ja existiam desde a migracao 0017 (plano 01); este plano so passou a ler/escrever essas colunas de verdade
- [Phase ?]: [04.5-03]: RCLONE_REMOTE_FOTOS deriva de RCLONE_REMOTE quando nao configurado por conta propria — nenhuma edicao de .env obrigatoria para a cobertura de fotos entrar em producao
- [Phase ?]: [04.5-03]: scripts/testar-backup.mjs virou 10 etapas (era 8) — as duas novas isolam o comportamento das fotos do dump, com um script de mentira no lugar de rclone real
- [Phase ?]: [04.5-04]: lib/precificacao/ficha.ts só usa `import type` de ./calculo e ./forno — resultadoDaFicha recebe cabem/resultadoDireto/resultadoGaleria/farol JÁ calculados pelo caller (o diálogo), nunca chama calcularPeca/quantasCabem/farolDoPreco sozinho; mesmo desenho que calculo.ts já usa para CabemNoForno
- [Phase ?]: [04.5-04]: ficha não-exclusiva sempre cria um item NOVO do Catálogo — "vincular a um item existente" (mencionado no BRIEFING) não foi implementado, porque nenhuma tela desta fase oferece esse seletor
- [Phase ?]: [04.5-04]: **bug real corrigido** — `parametrosVigentes().forno` lia o forno em cm-milésimos (escala do CATALOGO_DE_PARAMETROS) em vez de milímetros; `MedidasUteisDoForno.larguraMm` valia 35000 em vez de 350, e nenhuma peça jamais seria recusada por não caber. Achado pelo próprio e2e (caso "prato grande demais")
- [Phase ?]: [04.5-05]: listarFichas() sempre traz TODAS as fichas (sem parametro incluirExclusivas) - ListaPecas filtra em memoria, para o alternador saber a contagem de exclusivas mesmo escondidas
- [Phase ?]: [04.5-05]: cabecalho da aba Pecas saiu de page.tsx e entrou em ListaPecas (self-contida, molde de ListaOrcamentos); TITULO_PECAS morto foi removido
- [Phase ?]: [04.5-05]: ConfirmarApagarPeca nunca mostra contagem de uso pre-carregada - a frase de recusa (D-20) so existe quando o servidor devolve ok:false
- [Phase ?]: [04.5-06]: esquemaLinhaDeOrcamento identifica a linha a editar pelo PROPRIO id da linha (orcamentoLinhas.id), nao por (orcamentoId, fichaId) - a mesma ficha pode aparecer em mais de uma linha do mesmo orcamento com cor/personalizacao diferentes
- [Phase ?]: [04.5-06]: components/amassa/orcamentos/cabecalho-do-orcamento.tsx e um arquivo novo, fora da lista do plano - necessario porque um Server Component nao pode conter um sub-componente "use client" no MESMO arquivo (a fronteira e por arquivo no Next.js)
- [Phase ?]: [04.5-06]: "+ Peca exclusiva deste pedido" e "ver calculo" usam navegacao COMPLETA (nao pushState) - DialogoFicha precisa de dado fresco do servidor (categorias/parametros/ficha), mesma convencao ja usada por "Nova peca"/"editar peca" desde os planos 04/05
- [Phase ?]: [04.5-06]: acrescentarLinha nunca recebe preco do cliente - resolve sozinho (preco efetivo da ficha, ou minimo de hoje arredondado) pela mesma funcao para as duas portas de entrada de peca
- [Phase ?]: [04.5-06]: "quantas" e um input numerico simples, sem botoes -/+ - o prototipo.html nao tem stepper nessa linha, apesar de uma nota do UI-SPEC sugerir o contrario
- [Phase ?]: [04.5-08]: linha de orcamento congelada sem calculo valido (nao cabia no forno no instante do envio) e reconstruida na leitura como recusa generica ("divisor-invalido") - o snapshot guarda so os seis campos do briefing, nunca um setimo campo "motivo"
- [Phase ?]: [04.5-08]: duplicarOrcamento copia cliente/titulo/entrega prevista/observacoes alem do que o texto do plano enumera (pecas/precos/custos de projeto/frete) - duplicar e "refazer com precos novos" do MESMO pedido (D-07), nao recomecar do zero
- [Phase ?]: [04.5-08]: components/amassa/orcamentos/linha-de-orcamento.tsx e so-para-voce.tsx ganharam props fora da lista de arquivos do plano (vivo/avisoCongelado) - necessario para o congelamento visual e o aviso "Calculado com os parametros de..." realmente aparecerem na tela
- [Phase ?]: [04.5-08]: script de aceitacao da Tarefa 2 (checagem "for update" via new RegExp com escape quadruplo) quebra ao atravessar plano->bash->JS->RegExp - confirmado com o mesmo regex corrigido que as quatro transicoes tem a guarda real (WINDOWS #40)
- [Phase ?]: parcelasDoPlano (lib/orcamentos/plano.ts) e a MESMA fonte que o documento do cliente (plano 11) e a aprovacao (plano 12) vao reaproveitar para a forma das parcelas
- [Phase ?]: SoParaVoce e Server Component sem estado nenhum, reforcando que o painel nunca e importado fora do editor do dono (separacao estrutural do documento do cliente)
- [Phase ?]: 04.5-09: totalDeAgora/somaDoQueNaoEhPeca isolado de atualizarPrecos para o script de aceitação (le projeto/frete so para o historico, nunca altera)
- [Phase ?]: Rota de foto responde 401 real (nao redirect) para chamada de API sem sessao — middleware.ts ganhou o caso geral, nao so a rota de fotos
- [Phase ?]: 04.5-11: pdfjs-dist NAO instalado (sem confirmacao explicita do dono para um quarto pacote) — cobertura de acentuacao/no-leak do PDF fica reduzida ao nivel de estrutura de dados, registrada em WINDOWS.md #45/#46
- [Phase ?]: 04.5-11: docker/Dockerfile ganhou COPY .../assets ./assets no estagio app — as fontes do PDF sao lidas em tempo de execucao e o rastreador de arquivos do next build nao as enxerga sozinho (mesma classe do Pitfall 3 do sharp)
- [Phase ?]: Plano 12: categoria 'Encomendas' achada pelo nome (não por chave_do_sistema, que só aceita 'diferenca') — renomear a categoria em Cadastros faz a aprovação falhar com a frase genérica de D-25, nunca uma venda pela metade.
- [Phase ?]: Plano 12: 'Ver venda no Financeiro'/o toast com o número da venda exigiram tocar app/(app)/financeiro/page.tsx, lib/financeiro/avisos.ts e listas-caixa.tsx — fora do files_modified do plano, mas necessários para os dois links do veredito navegarem de verdade (Regra 2).
- [Phase ?]: WINDOWS #44 corrigido com migração nova 0021 (nunca editando 0019/D-33), recriando também o gatilho de 0020 para usar hoje_brasilia() em vez de current_date
- [Phase ?]: Tres specs de e2e mutavam parametro global de precificacao sem restaurar (poluicao real entre arquivos); corrigido com test.afterAll restaurando direto no banco em cada um
- [Phase ?]: 04.6-01: redirecionamentos-antigos.ts usa literal proprio do prefixo /gestao (zero import de valor), nunca importado de lib/rotas/gestao.ts
- [Phase ?]: 04.6-02: corrigidos 15 literais de rota sem prefixo /gestao (4 causavam falha e2e, 11 funcionavam so por indirecao via redirect ate 2027-03-28)
- [Phase ?]: D-18 estendida a agLivre (preco de uso livre) sem numero no site — pendente de confirmacao do dono (04.6-03)
- [Phase ?]: conteudo/site.ts não precisou de nenhuma mudança no plano 04 — o plano 03 já tinha escrito todos os textos das seções novas
- [Phase ?]: components/site/secao.tsx ganhou um prop testId (data-testid do <section>) — aditivo, fora da lista de arquivos do plano, necessário para os testid site-espaco/site-agenda/site-encomendas/site-onde
- [Phase ?]: Achado real: --color-site-tinta-fraca media 4,47:1 contra --color-site-fundo (abaixo de 4,5 AA); corrigido para #786858 (4,77:1) em app/globals.css e tests/unit/tokens.test.ts
- [Phase ?]: GES-12/13/14: navegação final — barra de baixo com 4 itens, lateral com 7 (Cadastros incluído), menu do usuário com 3 itens sem Orçamentos, e Produção como rótulo novo de Encomendas com rota/ícone intactos (D-11/D-12/D-13)
- [Phase ?]: 04.6-07: pausa de digitação de 1200ms (não os 600ms do protótipo, que grava em localStorage) — uma ida ao servidor merece mais folga

### Pending Todos

None yet.

### Blockers/Concerns

- **04.4-11 bloqueado na Tarefa 3 (checkpoint:human-action, `gate="blocking"`) — migração 0014/0015/0016 em produção.** O dono precisa abrir a sessão SSH, dizer "pode enviar" (para os commits desta fase serem enviados e o pipeline publicar), e seguir `docs/operacao/10-migracao-financeiro.md` do passo 1 ao 5. A Tarefa 4 (verificação humana, `04.4-VERIFICACAO-HUMANA.md`, 17 itens + 8 perguntas do planejador) segue depois. Só então a Fase 04.4 fecha de fato.
- M6 (Calculadora de Orçamento) permanece bloqueada até as planilhas de precificação do Theo existirem. Não afeta a Fase 7 (Polimento), que não depende de M6.
- Fonte de títulos (Vinila Condensed vs. Archivo Narrow) é decisão pendente do Theo — usar Archivo Narrow até lá (ver `04-DESIGN-SYSTEM.md`).
- Lista real de materiais do ateliê precisa ser levantada durante a Fase 6 (Estoque), senão o módulo nasce vazio.
- Pré-requisitos de conta (domínio, VPS Contabo, GitHub, armazenamento externo de backup) precisam existir antes de a Fase 1 poder começar de fato.
- Protecao da branch main (bloquear force-push e exclusao) pendente de configuracao manual pelo dono via GitHub Settings > Branches
- 01-05 Task 2 parcial: falta cadastrar NEXT_PUBLIC_SITE_URL e DEPLOY_ATIVO no repositorio GitHub, observar a primeira execucao real do workflow e provar o portao com um PR de teste quebrado — requer gh CLI/credenciais que a sessao de execucao nao tinha (ver 01-05-SUMMARY.md User Setup Required)
- callbackUrl do redirecionamento nao autenticado vaza https://0.0.0.0:3000 em vez do dominio publico (WINDOWS.md id 2, deferred-items.md da fase 02a) — bloqueia /gsd-ship ate resolvido ou dispensado; causa provavel em lib/auth/auth.config.ts/middleware.ts, fora do escopo do plano 02a-08
- tests/e2e/autenticacao.spec.ts:72 (sexta tentativa de bloqueio) trava/estoura timeout de forma pre-existente e independente da 02b-03 — WINDOWS.md id 3 continua aberto, mas o diagnostico avançou (quick 260920-jxb, .planning/debug/auth-bloqueio-timeout-e2e.md): hipotese do custo do argon2id REFUTADA por medicao; connectionTimeoutMillis (hipotese lider) corrigido em db/index.ts (5s, testado), mas a falha intermitente original nunca foi reproduzida localmente para fechar o ciclo RED/GREEN. WINDOWS.md id 34 (novo, aberto): o contador de tentativas em memoria nao e compartilhado entre a rota REST do Auth.js e a Server Action de login nesta build (Next.js 16.3.5 + Turbopack + output standalone) — investigacao propria necessaria antes de tentar de novo encurtar este teste.
- Verificacao humana de fim de fase (02b) pendente: 02b-VERIFICACAO-HUMANA.md — UI-05 (polegar em celular real), voz das frases D-05 (Agenda/Queimas/Estoque/Orcamentos) e olhada geral de cor/tipografia/legibilidade sob luz forte. Dono indisponivel no momento da execucao do 02b-05.
- Dois gaps de infraestrutura abertos (WINDOWS.md ids 13, 14): pipeline nao puxa imagem :ferramentas no deploy; compose.yml do servidor nao e ressincronizado apos o Roteiro 1 — candidatos a fase futura de polimento de CI/roteiros
- Ajustes necessarios no desktop mencionados pelo dono apos a verificacao em producao (03-08), sem detalhamento — capturar no backlog em separado antes de assumir a experiencia desktop pronta
- ~~Verificação humana de fim de fase (04)~~ — **RESOLVIDO em 2026-08-11**: 26/26 percorridos (22 por transferência de evidência do UAT com rastro por item, 4 confirmados pelo dono numa resposta única). `04-VERIFICATION.md` passou a `passed`.
- Tela de login não distingue banco indisponível de credencial errada: com o Postgres fora do ar, responde "Confira o e-mail e a senha e tente de novo" e manda o gestor conferir uma senha que está certa. A mensagem anti-enumeração está funcionando como projetada; o problema é que ela também absorve falha de infraestrutura. Mesma família do G-04-5 (falha de infra vestida de erro do usuário). Achado durante a verificação do quick 260811-uiy; mexer nisso exige cuidado para não virar oráculo de contas.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260811-2jb | Avaliar retries e custo do teste de fronteira (04-02) | 2026-08-11 | 65ec17e | [260811-2jb-avaliar-retries-e-custo-do-teste-de-fron](./quick/260811-2jb-avaliar-retries-e-custo-do-teste-de-fron/) |
| 260811-uiy | Fronteira de erro global acima do layout de rota protegida (G-04-5) | 2026-08-11 | b5bf62b | [260811-uiy-fronteira-de-erro-global-acima-do-layout](./quick/260811-uiy-fronteira-de-erro-global-acima-do-layout/) |
| 260812-2et | BRIEF-NOTURNO: Lote A (Gantt clicável, eixo de tempo na barra do celular, timeline semanal desde hoje) + Lote C (tela de trocar senha) | 2026-08-12 | c3adfa2, aa5a720, bc0d790, b91accc | [260812-2et-executa-brief-noturno-lote-a-gantt-clica](./quick/260812-2et-executa-brief-noturno-lote-a-gantt-clica/) |
| 260820-uot | Fecha os gaps da Fase 3: interruptor dos marcos legivel, botao de voltar na encomenda e contagem de itens no indice | 2026-08-20 | 9a3beca, 274aa72, 0ff1b46 | [260820-uot-fechar-os-gaps-da-fase-3-interruptor-dos](./quick/260820-uot-fechar-os-gaps-da-fase-3-interruptor-dos/) |
| 260821-3af | Hachura de rascunho vira teste automatizado, fechando a verificacao manual C da Fase 3 | 2026-08-21 | 8446d48 | [260821-3af-hachura-de-rascunho-vira-teste-automatiz](./quick/260821-3af-hachura-de-rascunho-vira-teste-automatiz/) |
| 6 | callbackUrl do login apontava para 0.0.0.0:3000; AUTH_URL com padrao no compose.yml (d9fdc2b), conferido em producao | 2026-09-17 | d9fdc2b | — |
| 7 | Roteiro 9: corrige o teste de restrição do passo 4 (\\gset em psql -c dava syntax error) e acrescenta 'Quando rodar' — commit 0c690d4 | 2026-09-18 | 0c690d4 | — |
| 8 | Caixinha de marcar para comparar sem fundo terracota (CR-01 do 04.3-REVIEW): data-checked -> data-[state=checked] em components/ui/checkbox.tsx, medido na build de producao — commit 2e33c5f | 2026-09-18 | 2e33c5f | — |
| 9 | casca.spec.ts:124 contava aria-current na página inteira; em /queimas o submenu também marca — conta só no menu principal (reprovação do pipeline 35432168671 após Next 16) | 2026-09-19 | e7aecb7 | — |
| 10 | Fecha a sessão de debug e2e-toque-nao-navega-ci após conferência do dono no celular; WINDOWS #12 #29 #30 #31 corrigidos | 2026-09-19 | 8666291 | — |
| 260919-e4n | Cartões do painel da Abertura por aba: Comprometido e Sai neste mês só em Por mês; Precisa de atenção só em Itens; nenhum em Tarefas e Cotações | 2026-09-19 | cefee93 | [260919-e4n-cartoes-do-painel-da-abertura-por-aba](./quick/260919-e4n-cartoes-do-painel-da-abertura-por-aba/) |
| 260919-ou8 | Ignorar `Claude outputs/` e versionar o protótipo aprovado do Estoque | 2026-09-19 | 93ef4e2 | [260919-ou8-gitignore-claude-outputs-e-prototipo-do-](./quick/260919-ou8-gitignore-claude-outputs-e-prototipo-do-/) |
| 260920-dx9 | Detectar SQLSTATE embrulhado pelo Drizzle em Abertura, Cotações e Queimas — a mensagem humana de chave estrangeira voltou a aparecer nos três módulos em produção | 2026-09-20 | 6288f67, b23b81e, fcbb3c3, 865e338, cc399ae | [260920-dx9-detectar-sqlstate-embrulhado-pelo-drizzl](./quick/260920-dx9-detectar-sqlstate-embrulhado-pelo-drizzl/) |
| 260920-fk9 | Unificar o detector de SQLSTATE em Financeiro e Cadastros (pendência do 260920-dx9) — os dois módulos passam a importar de lib/erro/postgres.ts, prova e2e nova cobrindo a corrida real do Financeiro com par RED/GREEN | 2026-09-20 | 638d372, c19126b, 035c570 | [260920-fk9-detector-sqlstate-financeiro-e-cadastr](./quick/260920-fk9-detector-sqlstate-financeiro-e-cadastr/) |
| 260920-wcg | Corrige a violação de contraste AA (axe-core) que barrou o deploy da fase 04.4-12: `opacity-70` diluía `--color-tinta-fraca` para 2.99:1 numa conta fixa desativada — causa raiz é a técnica (composição alfa sobre texto), não o token; corrigido o mesmo padrão em mais oito componentes (Categorias, Cotações, Queimas, Abertura), com par RED/GREEN provado por axe | 2026-09-20 | 48a8676, cf4a94d, 4e22cf6, a492da8 | [260920-wcg-contraste-aa-conta-fixa-desativada](./quick/260920-wcg-contraste-aa-conta-fixa-desativada/) |
| 260920-jxb | connectionTimeoutMillis=5000 no pool do pg (db/index.ts, com teste de regressão) — corrige o risco real de espera infinita apontado pelo debug de auth-bloqueio-timeout-e2e.md; a segunda mudança aprovada (semear tentativas via API) foi revertida ao descobrir que a rota REST e a Server Action não compartilham o contador de tentativas em memória nesta build (achado novo, WINDOWS #34) | 2026-09-20 | c7b13e1 | [260920-jxb-aplicar-timeout-do-pool-de-conexoes-do-b](./quick/260920-jxb-aplicar-timeout-do-pool-de-conexoes-do-b/) |
| 260926-ijl | Corrige o toast do sonner sem fundo (transparente sobre os cartões do Caixa, achado do dono fotografado em 26/09/2026): as quatro variáveis CSS (--normal-bg/-text/-border, --border-radius) apontavam para nomes inexistentes neste projeto; remapeadas para os tokens reais (--color-popover/-popover-foreground/-border, --radius-xl), cn-toast (classe morta) removida, com par RED/GREEN provando a asserção de fundo opaco em tests/e2e/financeiro-caixa.spec.ts | 2026-09-26 | 22166e8, ef898ee | [260926-ijl-toast-do-sonner-sem-fundo-transparente-s](./quick/260926-ijl-toast-do-sonner-sem-fundo-transparente-s/) |
| 260926-qpv | Remove o atalho "Pagar conta que já existe" da Despesa (decisão do dono, 26/09/2026, depois de usar o módulo no celular: o botão pareceu inútil e grande) — a Despesa fica com as duas escolhas de verdade (Compra de material/Outra despesa); BRIEFING.md, REQUIREMENTS.md (FNC-06), 04.4-UI-SPEC.md e 04.4-CONTEXT.md registram a decisão datada e a consequência (pagar uma conta existente passa a ser só por Caixa → "A pagar" → "Paguei"); passe adicional alinhou três comentários de código (acoes.ts/textos.ts/painel-despesa.tsx) que ainda descreviam o atalho no presente | 2026-09-26 | 366cfcd, 64f6b46, 2082e32 | [260926-qpv-remove-atalho-pagar-conta-da-despesa](./quick/260926-qpv-remove-atalho-pagar-conta-da-despesa/) |
| 260927-n3d | Corrige os três documentos de planejamento que ainda afirmavam, no presente, que a Fase 04.5 aguardava o dono publicar os commits e aplicar as migrações — já feito em 27/09/2026. O erro não era cosmético: uma sessão posterior leu esses documentos como estado atual e disse ao dono que Peças/Orçamentos/Parâmetros não estavam no ar, quando estavam. Cada afirmação nova carrega a evidência (pipeline com sucesso no commit 3a31c55; migração 0017 provada pela rota /api/health/backup, que faz select de uma coluna criada por ela e devolveria 503 sem a migração; Roteiro 12 provado pelo commit a43ee6a, que só se escreve depois de tropeçar nele). Narrativa histórica preservada; 0018-0021 e a pasta das fotos no host continuam sem afirmação, porque não foram provadas | 2026-09-27 | 4bf1bb4, a27e672, 02a4020, 7eb639b | [260927-n3d-corrigir-os-documentos-de-planejamento-d](./quick/260927-n3d-corrigir-os-documentos-de-planejamento-d/) |
| 260927-r12 | Roteiro 12 conferido inteiro no servidor (stat 100 101 750 no diretorio das fotos + escrita de dentro do conteiner sem erro de permissao, colados pelo dono em 27/09/2026) — a ressalva de 04.5-VERIFICACAO-HUMANA.md dizendo que a pasta nao tinha sido conferida virou registro da prova | 2026-09-27 | 94d8135 | — |

### Roadmap Evolution

- Phase 3 edited: ENC-14 (botao de imprimir folha A4) adicionado aos requisitos e criterios de sucesso
- Phase 3 edited: criterios 4 e 13 reconciliados com o quick 260812-2et (BRIEF-NOTURNO): Gantt passou de celulas quinzenais para semanais (segunda a domingo), a timeline deixou de abrir centralizada para abrir em hoje na borda esquerda, e o nome da encomenda virou link. Supersessao deliberada, nao regressao — os 18px/dia do 03-UI-SPEC.md continuam valendo
- Phase 04.1 inserted after Phase 4: Datas dos Marcos da Encomenda — nasceu da caminhada humana do dono, reabre ENC-03, precisa de migracao. Executa antes da Fase 5 (URGENT)
- Phase 04.2 inserted after Phase 04.1: Abertura do Espaço — módulo TEMPORÁRIO (data de morte, ABE-15) para organizar a abertura do novo espaço do ateliê; protótipo validado com o dono em cinco rodadas antes do planejamento. Ordem de execução revista: 4.2 → 6 (Estoque) → 5 (Agenda) → 7 (Polimento), por decisão do dono em 2026-08-22
- Phase 04.3 inserted after Phase 4.2: Comparador de Compras — aba do módulo Abertura para comparar cotações lado a lado; protótipo do dono é a especificação; preço numérico, independente dos itens, sem mudança de permissão (URGENT)
- Phase 04.4 inserted after Phase 04.3: Financeiro — parte 1: Venda, Compra, Caixa, Mês e Cadastros. Revisão do projeto de 2026-09-19: executa antes das Fases 5 e 6; Estoque deixa de ser a próxima (URGENT)
- Phase 04.5 inserted after Phase 04.4: Financeiro — parte 2: Precificação e Orçamento (protótipo e briefing aprovados; discussão já fechada)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | Calculadora de Orçamento (M6) — ORC-01..05 | Bloqueado (planilhas de precificação) | Definição do roadmap |
| v2 | Financeiro da Escola — FIN-01, FIN-02 | Adiado conscientemente | Definição do roadmap |
| v2 | Integração Encomenda↔Queima (INT-01), Módulo Experiências (INT-02) | Adiado conscientemente | Definição do roadmap |
| Produto | Encomenda "rascunho" não é alcançável pela interface — só por SQL direto. Decidir se deve existir um caminho na UI ou se o status rascunho sai do produto | Pergunta aberta | Fase 3, verificação humana |
| Produto | Os tres marcos SEMPRE acontecem — o interruptor liga/desliga nunca foi o modelo certo. Queima de biscoito nao precisa de interruptor (a duracao da secagem ja a posiciona); queima de esmalte e entrega precisam de QUANDO, porque nao vem logo apos a etapa anterior. E o nucleo do lote de datas; repensar o modelo de marco antes de virar plano | Pergunta aberta — reabre ENC-03 | Fase 3, segunda rodada 2026-08-20 |
| Tecnico | router.refresh() e um canal com perda (~6% medido): a resposta chega 200 e a arvore nunca e aplicada. Outros DEZ pontos de chamada carregam a mesma exposicao — o mais gemeo e confirmar-cancelar.tsx, mesma tela e mesma transicao final; o caminho de cancelar ainda nao tem trava de estado confirmado | Aberto — merece plano proprio | Debug refresh-nao-chega-no-celular, 2026-08-21 |
| Tecnico | staleTimes.dynamic: 0 provoca tempestade de prefetch, custando servidor e dados moveis sem beneficio. Achado de carona na mesma sessao | Aberto | Debug refresh-nao-chega-no-celular, 2026-08-21 |
| Produto | Depois de concluir ou cancelar, os ajustes rapidos das seis etapas continuam ativos: mexer num deles faz o rodape mostrar uma Conclusao prevista nova enquanto a linha de situacao mantem a data gravada — duas datas na mesma tela. DONO DECIDIU DEIXAR COMO ESTA (2026-08-21), para nao perder a chance de corrigir duracao depois de fechar | Divida conhecida, aceita | Debug refresh-nao-chega-no-celular, 2026-08-21 |

## Session Continuity

Last session: 2026-09-28T10:59:48.242Z
Stopped at: Concluido 04.6-07-PLAN.md
Resume file: None
