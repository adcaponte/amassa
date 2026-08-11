---
phase: 04
phase_name: "Contador de Queima"
project: "AMASSA — Plataforma de Gestão do Ateliê"
generated: "2026-08-11"
counts:
  decisions: 9
  lessons: 8
  patterns: 7
  surprises: 6
missing_artifacts: []
---

# Phase 04 Learnings: Contador de Queima

Extraído dos 7 PLAN.md, 7 SUMMARY.md, `04-VERIFICATION.md`, `04-UAT.md`, `04-VERIFICACAO-HUMANA.md`
e `STATE.md`. Os dois quick tasks disparados por esta fase (`260811-2jb` e `260811-uiy`) entram com
atribuição explícita — nasceram dela e carregam parte das lições mais caras.

## Decisions

### Migração aplicada só no fechamento da fase, nunca durante
A migração `0007_queimas`/`0008_gatilhos-queimas` foi gerada e commitada no primeiro plano, mas só
aplicada num banco de produção real no plano de fechamento, à mão, depois de um backup.

**Rationale:** qualquer correção de schema surgida nos planos 02–06 se dobra na mesma migração, em
vez de virar uma segunda migração aplicada à mão em produção, com segundo backup e segunda janela de
risco. `npm run test:migracoes` e o e2e já exercitam as migrações contra um Postgres efêmero a cada
execução, então a fase inteira rodou testada contra o schema real mesmo sem produção tê-lo.
**Source:** 04-01-SUMMARY.md (checkpoint da Tarefa 1), 04-07-SUMMARY.md

### A consulta devolve dado bruto; o módulo puro decide o contador
`consultas.ts` expõe `ocorrenciasDeQueima: string[]` e `ultimaManutencaoEm`, e `medirForno()` calcula
contador, total e nível. Nunca SQL e TypeScript com a mesma regra em dois lugares.

**Rationale:** o corte por manutenção é a regra central do módulo. Duplicá-la num `left join lateral`
e num módulo puro criaria duas fontes de verdade que divergem em silêncio. Implementado com duas
consultas e agrupamento em memória, no molde de `anexarItensEEtapas` — sem `db.execute(sql\`...\`)`
cru, que não tem precedente no projeto.
**Source:** 04-01-SUMMARY.md

### A view `fornos_medidos` NÃO foi criada
O `04-CONTEXT.md` pedia uma decisão consciente sobre criá-la ou não. Não foi criada.

**Rationale:** o módulo puro já calcula o nível, `consultas.ts` carrega o mesmo join, e uma view
ficaria fora de `TABELAS_ESPERADAS` — invisível ao `test:migracoes`, que é o portão que pegou a
omissão equivalente na Fase 3.
**Source:** 04-01-SUMMARY.md, 04-01-PLAN.md

### `recharts@3.10.1`, não `2.15.4`
A linha 2.x tinha a forma de dependências que o plano esperava (sem Redux), mas o 3.x foi escolhido.

**Rationale:** o 2.x embute `lodash` inteiro (o 3.x usa `es-toolkit`, tree-shakeable), é linha de
manutenção, e sua API diverge da documentação atual. O peso extra do Redux Toolkit do 3.x foi aceito
porque os gráficos vivem em `/queimas/relatorios`, rota separada — o code-splitting por rota do App
Router garante que esse peso nunca chega em `/queimas`, o caminho de dois toques que o Core Value
protege.
**Source:** 04-06-SUMMARY.md (checkpoint de legitimidade de pacote)

### Truncagem do banner em 3 fornos mais "e mais N"
Decisão do dono na sondagem de considerações do UI-SPEC.

**Rationale:** altura previsível, o banner nunca empurra os cartões para baixo da dobra no celular, e
os nomes completos estão nos cartões logo abaixo. As alternativas — quebrar em várias linhas, ou
rolagem horizontal — custavam meia tela ou exigiam gesto com a mão suja.
**Source:** 04-UI-SPEC.md (§ UI Considerations, E5), 04-05-SUMMARY.md

### Falha pós-toast substitui o toast e reverte o contador
No fluxo de dois toques, se a gravação otimista falhar depois do toast de sucesso, o toast vira erro
e o contador volta ao valor anterior.

**Rationale:** perda silenciosa é o modo de falha central desta fase — um contador um a menos faz a
resistência estourar antes do previsto. Decisão do dono na sondagem do UI-SPEC.
**Source:** 04-UI-SPEC.md (§ UI Considerations, E3), 04-CONTEXT.md (D-04)

### Períodos sem queima plotam zero, não desaparecem
Nos relatórios, as 8 semanas (ou 6 meses) são sempre plotadas por inteiro.

**Rationale:** eixo estável, o buraco de produção fica visível, e a soma bate com a contagem manual do
histórico — que é literalmente o critério de sucesso 8 do ROADMAP.
**Source:** 04-UI-SPEC.md (§ UI Considerations, E9), 04-06-SUMMARY.md

### "Últimos 30 dias" é janela civil inclusiva `[hoje-29, hoje]`
Nem `[hoje-30, hoje]` (31 dias) nem exclusiva.

**Rationale:** não havia edge probe travado para esse recorte no plano; a escolha e o motivo ficaram
documentados no próprio módulo, com teste provando a fronteira dos dois lados (29 dias atrás entra,
30 não).
**Source:** 04-06-SUMMARY.md

### G-04-5 corrigido FORA da fase, como tarefa própria
O defeito da fronteira de erro ausente acima do layout protegido foi encontrado no UAT desta fase,
mas corrigido no quick `260811-uiy`, não como plano de gap-closure da Fase 4.

**Rationale:** o defeito é de `app/(app)/layout.tsx`, da Fase 2b, e atinge todos os módulos —
Encomendas, Agenda, Estoque, Orçamentos. Fechar como gap da Fase 4 atribuiria a ela um problema que
ela apenas encontrou.
**Source:** 04-UAT.md (§ Gaps, G-04-5), .planning/quick/260811-uiy-*/260811-uiy-SUMMARY.md

---

## Lessons

### `--grep` durante a fase paga em velocidade e cobra no fechamento
A varredura completa do último plano achou **quatro** testes quebrados que os `--grep` escondiam. O
mais ilustrativo: `queimas-manutencao.spec.ts` foi escrito no plano 04-04 checando um forno
desativado sob o filtro padrão, e o filtro que passou a escondê-lo nasceu no 04-05 — os dois nunca
tinham rodado juntos até a varredura.

**Context:** a convenção de orçamento de e2e do `CLAUDE.md` é correta e economizou tempo real, mas o
custo dela é concentrado no fim. Vale planejar o último plano da fase contando com esse acerto.
**Source:** 04-07-SUMMARY.md

### `retries` só ajuda em teste sem estado; em teste com estado, ele GARANTE a falha
O teste de bloqueio de login usava um e-mail fixo por projeto. Quando a primeira tentativa falhava,
o contador daquele e-mail ficava esgotado e as duas retentativas herdavam o estado sujo — falhando
em segundos, por um motivo diferente do original.

**Context:** custou uma reprovação de CI e uma sessão de diagnóstico. A correção foi incluir
`testInfo.retry` no e-mail, dando a cada tentativa um contador virgem.
**Source:** 04-07-SUMMARY.md, .planning/quick/260811-2jb-*/260811-2jb-SUMMARY.md

### O `.env` do servidor é lido com `sh` por um único consumidor — o `backup.sh`
A aplicação e as migrações passam pelo Docker Compose, que é tolerante a espaços em volta do `=`. O
`backup.sh` carrega o mesmo arquivo com `sh`, que não é. Uma linha malformada fica invisível até
alguém rodar justamente o passo que protege a migração.

**Context:** o `CLAUDE.md` já avisava que o `.env` envelhece em silêncio por não vir do pipeline;
esta fase deu o exemplo concreto e o modo de falha exato.
**Source:** 04-07-SUMMARY.md, STATE.md

### `error.tsx` não captura erro do layout do PRÓPRIO segmento
`app/(app)/error.tsx` é irmão de `app/(app)/layout.tsx`. Quando o layout lança — e ele lança, porque
chama `exigirUsuario()`, que consulta o banco —, a fronteira mais próxima é `app/error.tsx`, que não
existia. Toda rota autenticada caía na tela padrão do Next.js.

**Context:** `(app)` é grupo de rotas sem segmento de URL, então o layout é filho direto do layout
raiz. Defeito latente desde a Fase 2b, encontrado só quando alguém derrubou o banco de propósito.
**Source:** 04-UAT.md (teste 5), .planning/quick/260811-uiy-*/260811-uiy-PLAN.md

### O servidor de e2e local não fica lento — ele morre
`next start` roda contra `output: "standalone"`, combinação que o próprio Next declara não suportada
e avisa em toda execução. Em 3 de 7 varreduras o servidor caiu no meio e derrubou tudo depois em
cascata (46, 46 e 299 testes com `ERR_CONNECTION_REFUSED`).

**Context:** o diagnóstico registrado no plano 04-02 ("lentidão transitória do servidor
compartilhado") estava errado em dois pontos: não são 4 workers, são 8 (a máquina tem 16 núcleos e o
Playwright usa núcleos/2, sem limite no config), e o servidor morre em vez de degradar.
**Source:** .planning/quick/260811-2jb-*/260811-2jb-SUMMARY.md

### O `globalSetup` do Playwright tinha uma corrida que matava a suíte antes do primeiro teste
`preparar-usuario.ts` não era idempotente: `criar-usuario` rodava mais de uma vez na mesma execução e
falhava alternando entre "Já existe uma conta" e `DrizzleQueryError` no índice único. Aconteceu em 4
de 7 varreduras.

**Context:** nenhuma retentativa de spec poderia consertar isso — a falha é anterior a qualquer spec.
Era o candidato mais forte à "instabilidade" que o plano 04-02 tentou resolver com retry. Corrigido
com `pg_advisory_lock` em volta de "conferir e então gravar".
**Source:** .planning/quick/260811-2jb-*/260811-2jb-SUMMARY.md

### Derrubar o banco inteiro é a reprodução ERRADA para fronteiras de erro de página
O layout falha primeiro, então o `error.tsx` da página nunca chega a rodar. O que parece "a fronteira
de página está quebrada" é na verdade "a fronteira de página nunca foi alcançada".

**Context:** o método correto é cirúrgico — renomear só a tabela que a página consulta, deixando
`usuarios` legível para `exigirUsuario()` sobreviver. Com isso, as fronteiras de página se provaram
funcionando.
**Source:** 04-UAT.md (testes 5 e 13, campo `retestado_como`)

### Um agente não deve marcar completo um requisito que entregou pela metade
O plano 04-01 lista FOR-11 no frontmatter mas não o marcou como concluído: entregou o cadastro, e
desativar/reativar era escopo do 04-04.

**Context:** marcar completo teria deixado a matriz de rastreabilidade de `REQUIREMENTS.md`
incorreta por três planos. A disciplina de deixar aberto é o que faz a matriz valer alguma coisa.
**Source:** 04-01-SUMMARY.md

---

## Patterns

### Sondagem de estados com override de tipo autorado
O motor de sondagem (`ui-consideration-probe`, `edge-probe`) classifica por regex em inglês. Contra
prosa em português ele devolveu `unclassified` para 9 de 11 superfícies e 12 de 13 requisitos.

**When to use:** sempre que a sondagem rodar sobre artefatos em outro idioma. Autore o array
`elements`/`shapes` explicitamente e re-rode — de 0 para 65 considerações e de 14 para 47 arestas
aplicáveis, sem inventar nada.
**Source:** 04-UI-SPEC.md (§ UI Considerations, nota de override), 04-07-SUMMARY.md

### `--workers=2` para diferenciar bug real de ambiente saturado
A máquina local (16 núcleos, ~8 workers padrão) sob varreduras seguidas no mesmo dia fica
visivelmente mais lenta que numa execução isolada. `--workers=2` — a concorrência real do runner de
CI — foi o que separou o sinal do ruído.

**When to use:** em todo diagnóstico de flake antes de concluir que existe defeito de lógica.
**Source:** 04-07-SUMMARY.md (§ patterns-established)

### Sincronizar por transição observável, nunca por valor que não muda
O teste de manutenção esperava o contador para sincronizar com o refresh. Depois da PRIMEIRA
manutenção o contador vai de `3/50` para `0/50` — observável. Depois da SEGUNDA ele continua `0/50`,
e reconferir esse texto não sincroniza com nada.

**When to use:** sempre que um teste precisar esperar um write assíncrono. Se o valor esperado é
igual ao anterior, use `page.reload()` ou outro portão real — nunca alargue o timeout.
**Source:** 04-07-SUMMARY.md

### Copy interpolada é função, não constante
`fraseDoRodape`, `corpoExcluirQueima` e `fraseDoBanner` são funções em `textos.ts`, não constantes com
placeholder manual.

**When to use:** toda copy que interpola dado. Evita o template solto com `{nome}` substituído na mão
no componente, que é onde a voz do produto se perde.
**Source:** 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-05-SUMMARY.md

### `textos.ts` nunca importa VALOR de outro módulo do domínio
Só `import type`. `fraseDoRodape` recebe a data já formatada (`data: string | null`), não o
`timestamptz` bruto; o componente chama `formatarInstanteCurto()` e passa o resultado.

**When to use:** em todo módulo de copy. É a mesma disciplina que `lib/encomendas/textos.ts` já
seguia com `gantt.ts` — duplicar em vez de importar.
**Source:** 04-02-SUMMARY.md

### Erro de infraestrutura tratado localmente, sem derrubar a tela inteira
A falha de `fornosQuePrecisamDeAtencao()` é capturada por `try/catch` local ao bloco do cartão em
`app/(app)/page.tsx`, não deixando o erro subir para o `error.tsx` da rota.

**When to use:** em painéis compostos por blocos independentes. Os outros três cartões continuam de
pé mesmo se só um falhar — e um forno crítico nunca fica invisível por erro, parecendo "tudo em dia".
**Source:** 04-05-SUMMARY.md

### Transferência de evidência de UAT para checklist humana, com rastro por item
Os 26 itens da verificação humana foram fechados marcando **qual teste do UAT cobriu cada um e o que
foi observado**, deixando explicitamente abertos os que ninguém olhou.

**When to use:** quando um UAT conversacional e uma checklist de fim de fase cobrem o mesmo terreno.
Evita percorrer as mesmas telas duas vezes sem transformar a checklist em carimbo — a regra é que
nada seja marcado sem prova, e que confirmação coletiva seja registrada como coletiva.
**Source:** 04-VERIFICACAO-HUMANA.md, 04-UAT.md

---

## Surprises

### O limiar de atenção é `limite - 10`, não 90% do limite
As duas leituras coincidem em `limite = 100` (100−10 = 90 = 90%), que é o número que aparece no
critério do ROADMAP — o que escondeu a diferença durante todo o planejamento.

**Impact:** com `limite = 10`, o limiar cai em **1**, não em 9. Isso tornou o teste das transições de
selo muito mais barato do que o estimado (um toque em vez de nove), mas só depois de alguém ler a
função. Uma descrição de requisito baseada num único exemplo numérico pode esconder a regra.
**Source:** lib/queimas/contador.ts, 04-02-SUMMARY.md, 04-VERIFICACAO-HUMANA.md

### O plano descrevia a árvore de dependências de uma versão que não era a que seria instalada
A checagem de legitimidade do `recharts` no plano listava a forma da linha 2.x ("só d3-* e
victory-vendor"). A 3.x reescreveu o estado interno em Redux Toolkit.

**Impact:** o portão bloqueante funcionou exatamente como deveria — o executor parou, levantou a
evidência real e trouxe a divergência em vez de instalar e seguir. Mas mostra que uma checagem de
pacote escrita no planejamento envelhece entre o plano e a execução.
**Source:** 04-06-SUMMARY.md

### O e2e reprovou o CI num teste que a Fase 4 nunca tocou
`autenticacao.spec.ts` não recebeu um único commit da fase. Ainda assim foi ele que barrou o
pipeline, porque a Fase 4 dobrou o tamanho da suíte e a carga extra empurrou a primeira tentativa
além dos 60 segundos que o teste reservava.

**Impact:** um plano pode quebrar o CI sem tocar no arquivo que falha. O reflexo de procurar a causa
nos arquivos alterados teria custado tempo.
**Source:** 04-07-SUMMARY.md

### A tela de login absorve indisponibilidade de banco como credencial errada
Com o Postgres fora do ar, o login responde "Confira o e-mail e a senha e tente de novo" — a mensagem
anti-enumeração funcionando como projetada, mas mandando o gestor conferir uma senha que está certa.

**Impact:** achado de passagem durante a verificação do quick `260811-uiy`, mesma família do G-04-5
(falha de infraestrutura vestida de erro do usuário). Registrado em `STATE.md` como preocupação;
mexer nisso exige cuidado para não transformar a tela em oráculo de contas.
**Source:** .planning/quick/260811-uiy-*/260811-uiy-SUMMARY.md, STATE.md

### O UAT gerado por cobertura não cobria um dos três backstops do UI-SPEC
A lista de 17 testes derivada dos blocos `coverage:` dos SUMMARYs deixou o backstop E3 de fora — e
foi o `gsd-verifier` que apontou, ao recusar dar `passed` com um item nunca observado por ninguém.

**Impact:** virou o teste 18, respondido em trinta segundos. O portão de verificação pagou seu custo
numa única sessão.
**Source:** 04-VERIFICATION.md, 04-UAT.md (teste 18, campo `nota`)

### O tempo desta fase foi majoritariamente diagnóstico de infraestrutura, não código de produto
Os planos 04-05 (2h10) e 04-06 (3h) declaram explicitamente que a maior parte do tempo foi
diagnóstico de Docker/WSL2, corrida de e2e e contenção de servidor — não a lógica do módulo.

**Impact:** a estimativa de esforço de uma fase de produto neste projeto precisa contar o imposto de
infraestrutura local, que não aparece em nenhuma descrição de tarefa.
**Source:** 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md
