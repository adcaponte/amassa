# Próxima sessão — ATUALIZADO em 2026-09-28

> **A porta de entrada de qualquer sessão agora é `ESTADO-ATUAL.md`, na raiz do projeto** (mora só
> neste computador; está no `.gitignore`). Ele tem o negócio, o que está no ar, a ordem de trabalho e
> as pendências. Este arquivo continua valendo pelas **lições técnicas** da seção "O que a Fase 4.2
> ensinou". Se os dois divergirem sobre prioridade, o `ESTADO-ATUAL.md` vence.

## Ordem atual

> ⚠️ **A lista de 2026-09-17 abaixo está cumprida ou superada.** Atualizada em 2026-09-28. A ordem
> de trabalho de verdade mora em `Claude outputs/FILA-DO-CODE.md`, mantida pelo Cowork; esta seção
> só a espelha.

1. ~~**Fase 04.3 — Comparador de Compras**~~ — **concluída em 2026-09-18.** Depois dela vieram a
   **04.4** (Financeiro, parte 1, concluída em 26/09, verificada 9/9 + 17/17) e a **04.5**
   (Financeiro, parte 2 — Precificação e Orçamento, **concluída em 27/09**, 14 planos, 23 dos 25
   itens da verificação humana passando de primeira e os dois outros corrigidos no plano 14).

2. **Fase 04.6 — plataforma em `/gestao`, Início novo, navegação e site público.** **Executada em
   28/09** — 8 planos, o portão (plano 08, Tarefa 1) já rodou a última varredura completa (798
   passed · 13 failed, todas com veredito — nove janelas conhecidas, uma contenção nova confirmada
   isolada, três correções reais achadas e feitas nesta mesma execução), escreveu o Roteiro 14
   (`docs/operacao/14-gestao-e-site-publico.md`) e `04.6-VERIFICACAO-HUMANA.md`. **Falta o dono:**
   as Tarefas 2 (push, Roteiro 14 no servidor, migração `0022` depois de backup, GES-04 conferida
   em produção no celular) e 3 (a caminhada dos 8 critérios) do plano `04.6-08-PLAN.md` — portões
   humanos bloqueantes, nunca automatizáveis. **A fase não fecha por contagem de planos** — fecha
   quando `04.6-VERIFICACAO-HUMANA.md` for percorrido, como a 04.4 e a 04.5 antes dela.

   **Corrigido em 28/09 (execução do plano 08):** este arquivo dizia "falta executar
   `/gsd-execute-phase 04.6`". Os 8 planos executaram no mesmo dia (28/09) — o texto acima descrevia
   o estado ANTES da execução, preservado como registro logo abaixo. **A metade "não dar push sem
   confirmar" continua valendo:** o plano 08 é `autonomous: false` e põe o push, a migração `0022`
   e GES-04 em produção nas mãos dele — nada foi publicado nem migrado em produção até aqui.

   **Correção do que este arquivo dizia antes:** o planejamento do site **não** está mais fora do
   repositório, e **não há mais "Em breve"**. O dono aprovou o protótipo do site inteiro em
   26/09 (`Claude outputs/site/`), que substituiu a página provisória; o marco "M8 — Página Em
   breve" do `amassa-cerrado` foi superado por essa decisão. Continua valendo o resto: não apague
   nem altere nada em `C:\Users\Andre\amassa-cerrado`.

3. **Fase 6 — Estoque**, com protótipo antes da execução — 🔒 depois da 04.6 estar no ar (item 4
   da fila). O protótipo já foi aprovado em 18/09 e revisto em 20/09, e o **adendo**
   (`Claude outputs/estoque/ADENDO.md`) vence o briefing antigo. O restante deste arquivo, a
   partir de "Como começar", foi escrito para ela e continua valendo nas lições técnicas.

---

# Fase 6: Estoque (instruções originais de 2026-09-01)

## Como começar

O dono pediu, explicitamente, **protótipo antes da execução** — o mesmo caminho que deu certo na
Abertura do Espaço:

1. **Protótipo primeiro.** Um HTML interativo, publicado como Artifact (nunca arquivo estático: um
   arquivo fora da pasta do projeto vira captura sem interação, e os botões não funcionam). Iterar
   com o dono até ele dizer "vamos levar isso para a plataforma".
2. **Versionar o protótipo aprovado** em `.planning/phases/06-estoque/prototipo.html`. Na 4.2 ele
   virou a especificação: onde a prosa e o protótipo divergiam, **o protótipo vencia**.
3. Só então `/gsd-discuss-phase 6`, `/gsd-plan-phase 6`, `/gsd-execute-phase 6`.

Não comece pelo `/gsd-discuss-phase`. O dono decide melhor olhando uma tela do que respondendo
perguntas sobre uma tela.

## O que o ROADMAP já fixa (não reabra sem motivo)

**Objetivo**: saber o que existe, o que está acabando e para onde o material foi — **saldo sempre
derivado das movimentações, nunca uma coluna editável**.

Critérios de sucesso, verbatim:
1. Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
2. Material abaixo do mínimo aparece destacado na lista e no painel inicial
3. O histórico mostra toda movimentação com autor e data
4. **Não existe nenhuma forma de editar ou apagar uma movimentação pela interface** — só registrar um ajuste
5. Registrar uma baixa no celular leva menos de 15 segundos
6. O saldo mostrado bate com a soma manual do histórico

Requisitos: EST-01 a EST-12. Depende só da Fase 2b. `UI hint: yes` (tem fase de UI-SPEC).

## O que a Fase 4.2 ensinou e vale para o Estoque

Isto não é história — é o que vai economizar horas.

**1. Atualização de tela depois de gravar.** Existe um defeito de agendamento do React/Next em
produção: a confirmação de uma transição falha em silêncio numa fração dos toques. Medido no
servidor `standalone` (o mesmo do VPS): marcar um item não atualizava a tela em **83%** dos toques.
O padrão que resolveu, e que o Estoque deve nascer com ele:

- **Abrir diálogo, marcar, editar, fechar**: nunca dependem do servidor. A URL é escrita por
  `window.history.pushState` (ver `components/amassa/abertura/url-sem-navegar.ts`), que não dispara
  transição, e o estado que a tela mostra vem do cliente, que já o tem no instante do toque.
- **Gravar**: usa navegação COMPLETA (`window.location.assign`), porque só o servidor sabe o
  resultado. Custa um carregamento numa ação pouco frequente e sempre mostra a verdade.
- **`router.refresh()` depois de Server Action é o antipadrão.** O módulo Abertura não tem nenhum.

**Registro aberto nº 26**: Queimas e Encomendas ainda usam esse padrão. `queimas-registro.spec.ts:84`
("Desfazer") já falhou por isso numa varredura. Tem menos testes batendo nele, não é menos real.

**2. Prova destrutiva tem banco próprio.** `scripts/testar-migracoes.mjs` prova a migração de
remoção com `drop table` de verdade. Ela recebia o banco compartilhado; localmente era inofensivo
(Postgres efêmero próprio), mas em CI apagava as tabelas que o e2e ia usar em seguida — pipeline
vermelho sem defeito nenhum no módulo. Hoje ela cria `<banco>_remocao`, prova e apaga. **Se o
Estoque acrescentar qualquer verificação destrutiva, ela nasce com banco próprio.**

**3. O pipeline agora enxerga.** Quando o e2e reprova, ele guarda o log do contêiner e os artefatos
do Playwright (`error-context.md` traz o retrato da página no instante da falha). Foi isso que deu a
causa raiz em uma linha depois de horas de adivinhação. **Use os artefatos antes de tentar
reproduzir o ambiente do runner.**

**4. Rodapé de diálogo é preso por flex, nunca por `position: sticky`.** Ver
`.planning/debug/resolved/rodape-formulario-desktop.md`. Já reincidiu uma vez.

**5. Orçamento de e2e.** `npm run test:e2e` custa ~53s de imposto fixo. No máximo uma invocação por
tarefa, com `--grep`. A varredura completa roda uma vez por fase, no último plano. Na 4.2 ela rodou
oito vezes — foi necessário por causa do defeito, mas não é o padrão.

## Estado do projeto

- Fase 4.2 **completa e no ar**. Migrações 0010/0011 aplicadas à mão em produção em 2026-09-01,
  verificadas pelo psql (3 tabelas, 12 grants, 3 gatilhos). O dono testou no celular real.
- Pipeline verde nos quatro jobs. 385 testes passando.
- Ordem de execução: **4.2 (feita) → 6 (Estoque) → 5 (Agenda) → 7 (Polimento)**. A Agenda está em
  espera por decisão do dono.
- Registro de defeitos: 17 abertos em `.planning/WINDOWS.md`. O nº 26 é o mais relevante para quem
  for mexer em Queimas ou Encomendas.

## O que só o dono faz

- Aplicar migração em produção, à mão, depois de backup verificado. Nunca o agente, nunca o pipeline.
- Editar o `.env` do servidor.
- Testar no celular de verdade. Todos os números do agente vêm de navegador automatizado; a mão
  suja no ateliê é o único teste que decide.
