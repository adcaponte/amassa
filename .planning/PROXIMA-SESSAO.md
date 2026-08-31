# Próxima sessão — Fase 6: Estoque

> Escrito em 2026-09-01, ao fim da sessão que subiu a Fase 4.2 (Abertura do Espaço) para produção.
> Leia isto antes de qualquer comando.

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
