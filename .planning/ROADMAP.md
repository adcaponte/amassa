# Roadmap: AMASSA — Plataforma de Gestão do Ateliê

## Overview

Este roadmap traduz, fase a fase, o roadmap de milestones já escrito por Theo Restivo em
`amassa-plataforma/03-ROADMAP.md` — documento autoritativo, não reinventado aqui. Cada
**milestone** do documento fonte (M0–M7) vira uma **fase** do GSD; as "fases" internas de cada
milestone no documento fonte tornam-se os **planos** dentro da fase GSD correspondente.

A jornada: primeiro um endereço no ar sem nenhuma funcionalidade (Fase 1), depois login, banco
base, casca visual e — crucialmente — o backup automático do banco (Fase 2), porque sem serviço
gerenciado o backup é a única rede de proteção que existe. A partir daí, os módulos que já têm
protótipo funcional entram na ordem deliberada **Encomendas → Fornos → Agenda** (Fases 3, 4, 5):
Fornos foi antecipado para antes da Agenda porque é o módulo menor, depende só do login e entrega
o fluxo mais usado do sistema inteiro (registrar queima, dois toques); a Agenda é a mais complexa
do projeto e ganha em ser enfrentada depois de o sistema já estar em uso real. Em seguida, Estoque
(Fase 6) fecha os módulos operacionais. Por fim, o Polimento (Fase 7) transforma algo que funciona
em algo em que se pode confiar — painel inicial de verdade, simulacro de restauração de backup,
manual e documento de operação.

**M6 (Calculadora de Orçamento) não aparece como fase.** Está bloqueada até as planilhas de
precificação do Theo existirem; seus requisitos vivem em `REQUIREMENTS.md` (seção v2). A Fase 7
não espera por ela — se dependesse, o projeto nunca fecharia.

**Granularidade:** o projeto está configurado como `standard`, mas por instrução explícita do
dono do projeto cada milestone do documento fonte mapeia 1:1 para uma fase GSD, preservando a
estrutura e a ordem já decididas — não uma estrutura nova derivada do zero.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Fundação e Primeiro Deploy** - Endereço `https://` no ar com deploy automático, sem nenhuma funcionalidade (completed 2026-08-08)
- [x] **Phase 2a: Login, Banco Base e Backup** - Entrar com e-mail/senha, contas por linha de comando, e backup automático rodando (completed 2026-08-08)
- [x] **Phase 2b: Design System e Casca da Aplicação** - Navegar por telas vazias já com a identidade visual do AMASSA, no celular e no desktop (completed 2026-08-09)
- [ ] **Phase 3: Gestor de Encomendas** - Módulo real e multiusuário substituindo o protótipo HTML, com itens e cronograma em cascata
- [ ] **Phase 4: Contador de Queima** - Controle de vida útil das resistências dos fornos, registro de queima em dois toques
- [ ] **Phase 5: Agenda de Aulas** - Turmas recorrentes materializam aulas com data real e presença por aluna
- [ ] **Phase 6: Estoque** - Materiais por categoria com saldo sempre derivado das movimentações
- [ ] **Phase 7: Polimento e Entrega** - Painel inicial de verdade, restauração de backup testada, manual e documento de operação

## Phase Details

### Phase 1: Fundação e Primeiro Deploy

**Goal**: Ter um endereço `https://` no ar, com deploy automático funcionando — sem nenhuma
funcionalidade, só o caminho do código até a internet. Resolvendo isso primeiro, cada milestone
seguinte já nasce publicada.
**Corresponde a**: M0 do `03-ROADMAP.md`. As 9 fases do milestone (projeto Next.js, repositório
público com higiene de segredos, preparação do VPS, `compose.yml` multi-estágio, DNS/HTTPS,
Drizzle, banco de testes, GitHub Actions, `/api/health`) tornam-se os planos desta fase.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-10
**Success Criteria** (what must be TRUE):

  1. Nenhum arquivo `.env` com valores reais aparece no repositório público (`git log --all --full-history -- .env` não mostra nada)
  2. `https://seudominio.com.br` abre com cadeado e sem aviso de segurança
  3. Alterar um texto, dar `git push` na `main`, e a mudança aparece sozinha em poucos minutos
  4. `https://seudominio.com.br/api/health` responde `ok` e confirma uma consulta real ao banco
  5. A porta 5432 do IP do VPS não aceita conexão de fora (`nmap`/`telnet` não conectam) — o banco não está exposto
  6. Reiniciar o VPS traz a aplicação de volta sozinha, com os dados intactos
  7. O Auto Backup da Contabo aparece ativo no painel
  8. Um deploy não recria o container do Postgres
  9. Um deploy com teste quebrado é barrado pelo pipeline e não vai ao ar
  10. Migrações podem ser aplicadas à mão no servidor, com um comando, fora do pipeline automático

**Plans**: 7/7 plans executed

Plans:

- [x] 01-01-PLAN.md — Traçado ponta a ponta: página mínima da marca, `/api/health` com consulta real e Postgres em contêiner
- [x] 01-02-PLAN.md — Repositório público `amassa` com higiene de segredos ligada antes do primeiro push
- [x] 01-03-PLAN.md — Imagem de produção: Dockerfile em quatro estágios, compose completo, Caddy no apex e migração pelo `ferramentas`
- [x] 01-04-PLAN.md — Postgres de teste separado e efêmero + testes ponta a ponta no desktop e no celular
- [x] 01-05-PLAN.md — Pipeline no GitHub Actions: qualidade → E2E → imagem no GHCR → deploy por SSH
- [x] 01-06-PLAN.md — Roteiros comentados do servidor: endurecimento do VPS, DNS, HTTPS, Auto Backup e monitor
- [x] 01-07-PLAN.md — Theo executa os roteiros e o ciclo completo de publicação é provado no domínio público

**UI hint**: no (nenhuma tela de usuário nesta fase — só infraestrutura)

### Phase 2a: Login, Banco Base e Backup

**Goal**: Entrar com e-mail e senha, e ter o backup automático do banco funcionando — a parte
mais importante deste milestone, porque sem serviço gerenciado o dump é a única rede de proteção
que existe.
**Corresponde a**: M1 do `03-ROADMAP.md`, fases 1 a 4 e 8 (migração base + `usuarios`,
Auth.js/argon2id, `exigirUsuario()` + scripts de linha de comando, tela de login, backup
automático via `cron` do host).
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, BKP-01, BKP-02, BKP-03, BKP-04, BKP-05, BKP-06, BKP-07
**Success Criteria** (what must be TRUE):

  1. Abrir qualquer endereço sem estar logado leva para `/login`
  2. Login com senha errada mostra uma mensagem clara em português, igual à de e-mail inexistente
  3. Errar a senha 5 vezes no mesmo e-mail em 15 minutos bloqueia por 15 minutos
  4. Depois de entrar, a sessão persiste por 30 dias ao fechar e reabrir o navegador, e sair encerra a sessão de verdade (voltar no histórico não devolve o acesso)
  5. Criar e desativar um usuário pela linha de comando funciona
  6. O `middleware.ts` carrega sem erro em produção — a divisão `auth.config.ts` / `auth.ts` está correta e o argon2 não é importado no runtime Edge
  7. O backup de ontem existe no servidor e também no armazenamento externo
  8. `/api/health/backup` responde `ok` quando o último backup tem menos de 26 horas, e falha quando não tem

**Plans**: 8/8 plans executed

Plans:

- [x] 02a-01-PLAN.md — Tracer: da migração ao login que abre uma rota protegida (onda 1)
- [x] 02a-02-PLAN.md — Base comum do banco e os dois papéis de banco (onda 2)
- [x] 02a-03-PLAN.md — Proteções de login: mensagem única, hash sempre, limite de tentativas (onda 2)
- [x] 02a-04-PLAN.md — Sessão de 30 dias, sair de verdade e `exigirUsuario()` (onda 3)
- [x] 02a-05-PLAN.md — Scripts de conta e o portão de máquina do `exigirUsuario()` (onda 3)
- [x] 02a-06-PLAN.md — Vigia do backup: `execucoes_backup` e `/api/health/backup` (onda 4)
- [x] 02a-07-PLAN.md — `backup.sh` e `restaurar.sh` provados sem servidor (onda 5)
- [x] 02a-08-PLAN.md — Roteiro 3 e a virada no servidor, com restauração real (onda 6)

**UI hint**: no (a tela de login usa estilo mínimo; nenhum componente shadcn é instalado — ver D-03 do 02a-CONTEXT.md)

### Phase 2b: Design System e Casca da Aplicação

**Goal**: Navegar por telas vazias de todos os módulos já com a identidade visual do AMASSA
aplicada, no celular e no desktop.
**Corresponde a**: M1 do `03-ROADMAP.md`, fases 5 a 7 (design system + mapeamento shadcn, casca
de navegação, painel inicial com espaços reservados).
**Depends on**: Phase 2a
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09
**Success Criteria** (what must be TRUE):

  1. As cores e fontes são as do AMASSA, não o padrão do Tailwind, em todo componente shadcn instalado
  2. Os 5 itens da barra inferior (Início, Encomendas, Agenda, Queimas, Estoque) abrem cada um a sua tela no celular; no desktop a barra lateral de 240px tem os mesmos itens mais o menu do usuário no rodapé; Orçamentos aparece só no menu do usuário
  3. A navegação funciona confortavelmente com o polegar no celular, e nenhuma tela exige rolagem horizontal
  4. Toda tela (mesmo vazia, como as deste milestone) tem estado vazio com frase de contexto e botão, estado de carregamento com esqueleto e estado de erro em linguagem humana; toda remoção pede confirmação nomeando o que será perdido
  5. Alvos de toque têm no mínimo 44px, contraste passa em AA, formulários navegam por teclado e botões só com ícone têm `aria-label`

> **UI-10 (nenhum erro no console) e UI-11 (carrega em menos de 3s em 4G) não pertencem a esta
> fase.** São critérios de polimento, medidos sobre o sistema completo, e ficam na Fase 7 — onde
> já estavam mapeados. Cada requisito pertence a exatamente uma fase.

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 02b-01-PLAN.md — Traçado: tokens, mapeamento `@theme inline`, as duas fontes e o login com a identidade aplicada (onda 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02b-02-PLAN.md — A casca: barra lateral de 240px, barra inferior de 5 itens e menu do usuário (onda 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02b-03-PLAN.md — Telas dos módulos, painel inicial e a prova da navegação (onda 3)
- [x] 02b-04-PLAN.md — Estados de erro, 404, carregamento e a convenção de exclusão (onda 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02b-05-PLAN.md — Acessibilidade verificada com ferramenta e a conferência humana no celular (onda 4)

**UI hint**: yes

### Phase 3: Gestor de Encomendas

**Goal**: Substituir o protótipo HTML por um módulo real, multiusuário, com itens — cada
encomenda mostra suas 6 etapas com datas calculadas em cascata, em Gantt no desktop ou lista
vertical no celular.
**Corresponde a**: M2 do `03-ROADMAP.md`. As 9 fases do milestone (migração `0002_encomendas`,
`lib/encomendas/cronograma.ts` com testes escritos antes do código, Server Actions de CRUD
transacional, Gantt desktop, lista vertical mobile, formulário com pré-visualização, filtros,
estados vazio/carregando/erro, teste ponta a ponta) tornam-se os planos desta fase.
**Depends on**: Phase 2b
**Requirements**: ENC-01, ENC-02, ENC-03, ENC-04, ENC-05, ENC-06, ENC-07, ENC-08, ENC-09, ENC-10, ENC-11, ENC-12, ENC-13, ENC-14
**Success Criteria** (what must be TRUE):

  1. Criar uma encomenda com nome, cliente, data de início e as 6 etapas mostra as datas calculadas em cascata
  2. Mudar a duração de uma etapa (ex.: "secagem") desloca todas as etapas seguintes
  3. Os três marcos (queima 1, queima 2, entrega) aparecem como losango e são um interruptor (acontece / não acontece), nunca um campo numérico; desligar a etapa "Entrega" faz o losango sumir e encurta a encomenda
  4. No desktop, o Gantt usa 18px/dia, cabeçalho em quinzenas, coluna fixa e a linha de "Hoje" na posição certa, e a timeline abre já rolada até deixá-la centralizada
  5. Uma encomenda guarda e mostra vários itens com descrição e quantidade (ex.: 40 canecas e 12 bowls)
  6. No celular, dá para ler o andamento de todas as encomendas como lista vertical, sem rolagem horizontal
  7. Encomendas podem ser filtradas por status, ordenadas e buscadas por nome ou cliente
  8. O rodapé do formulário mostra duração total e data de conclusão, atualizando conforme se digita
  9. Uma encomenda criada em um dispositivo aparece no outro ao recarregar a página (sem atualização em tempo real, deliberadamente)
  10. Excluir uma encomenda pede confirmação
  11. O estado vazio mostra "A roda ainda não gira"
  12. Um botão de imprimir produz uma folha A4 com as encomendas ativas — nome, cliente, etapa atual e data de conclusão — legível e cabendo em uma página no volume atual do ateliê

**Plans**: 8/8 plans executed

Plans:

- [x] 03-01-PLAN.md — Traçado ponta a ponta: schema, migração, cascata, transação e a primeira encomenda na tela (onda 1)
- [x] 03-02-PLAN.md — Módulos puros: `cronograma.ts`, `gantt.ts`, `formato.ts` e `textos.ts`, com os testes antes do código (onda 2)
- [x] 03-03-PLAN.md — As sete Server Actions com Zod único e escrita rápida sem atualização perdida (onda 2)
- [x] 03-04-PLAN.md — Índice: Gantt desktop de 18px/dia, lista vertical no celular e os três estados (onda 3)
- [x] 03-05-PLAN.md — Detalhe: trilha vertical, ajuste rápido de etapa e os diálogos de cancelar/excluir/concluir (onda 3)
- [x] 03-06-PLAN.md — Formulário modal/folha com itens reordenáveis e rodapé ao vivo (onda 4)
- [x] 03-07-PLAN.md — Filtro, busca sem acento, ordenação e histórico em janela de 12 meses (onda 5)
- [x] 03-08-PLAN.md — Folha A4 de impressão, prova ponta a ponta e migração de produção à mão (onda 6)

**UI hint**: yes

### Phase 4: Contador de Queima

**Goal**: Controlar a vida útil das resistências dos fornos — saber quantas queimas cada um
acumulou desde a última manutenção, e ser avisado antes de estourar. Esta fase é antecipada para
antes da Agenda porque o módulo é menor e mais simples, o fluxo principal (registrar queima) é o
mais usado do sistema inteiro, e entrega valor imediato desde o primeiro dia.
**Corresponde a**: M4 do `03-ROADMAP.md` (numeração de milestone preservada; a ordem de execução
foi antecipada para logo após a M2 — ver Key Decision "Ordem de execução M0→M1→M2→M4→M3→M5→M7"
em `PROJECT.md`). As 11 fases do milestone (migração `0004_queimas`, `lib/queimas/contador.ts`
com testes, cadastro de fornos sem exclusão, cartão do forno com medidor, registro em dois
toques com "Desfazer", registro de manutenção, detalhe do forno, banner agregado, relatórios
Recharts, alerta no painel inicial, teste ponta a ponta) tornam-se os planos desta fase.
**Depends on**: Phase 2b (independente da Fase 3 — Encomendas e Fornos são módulos independentes
entre si; a sequência Fase 3 → Fase 4 é uma decisão de produto documentada, não uma dependência
técnica)
**Requirements**: FOR-01, FOR-02, FOR-03, FOR-04, FOR-05, FOR-06, FOR-07, FOR-08, FOR-09, FOR-10, FOR-11, FOR-12, FOR-13
**Success Criteria** (what must be TRUE):

  1. Registrar uma queima leva dois toques e menos de 5 segundos no celular
  2. O aviso com "Desfazer", por 7 segundos, remove a queima registrada por engano
  3. Os três tipos aparecem: biscoito, esmalte e ouro
  4. Chegando a 90 de 100 o cartão fica em atenção e mostra "Manutenção próxima"; em 100 fica em crítico e mostra "Manutenção vencida"
  5. O banner no topo lista os fornos que precisam de atenção, com o contador de cada um
  6. Registrar manutenção mostra "o contador vai de N para 0", aceita responsável e observações opcionais, e zera o contador sem apagar o histórico
  7. O cartão mostra quantas queimas o forno já fez na vida, além do contador desde a última manutenção
  8. Os gráficos batem com a contagem manual do histórico, alternam entre 8 semanas e 6 meses, e a semana começa na segunda
  9. Um forno em atenção ou crítico aparece no painel inicial

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Traçado ponta a ponta: três tabelas, contador puro, forno cadastrado, queima em dois toques com autor e o Desfazer de 7 segundos

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Medidor com entalhes, os três níveis com selo, rodapé com as duas contagens e os estados da tela

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Página do forno: últimas 25 queimas, histórico de manutenções e exclusão confirmada

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-04-PLAN.md — Registrar manutenção que zera sem apagar, e o ciclo editar/desativar/reativar

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-05-PLAN.md — Banner agregado, filtro Ativos/Desativados/Todos e o cartão do painel inicial

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 04-06-PLAN.md — Relatórios em Recharts: 8 semanas, 6 meses, quatro estatísticas e o seletor de topo

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 04-07-PLAN.md — Fechamento: varredura completa, migração aplicada em produção à mão e verificação humana

> A migração desta fase é `0007_queimas` + `0008_gatilhos-queimas`, não `0004_queimas` — o número
> acima reproduz a numeração do documento fonte, escrita antes de a ordem de execução ser
> antecipada; o repositório já tem `0000` a `0006` aplicados. Ver `04-01-PLAN.md` §Desvios.

**UI hint**: yes

### Phase 5: Agenda de Aulas

**Goal**: O protótipo da agenda + datas reais + presença — turmas recorrentes materializam
aulas com data concreta por materialização preguiçosa, e presença é marcada por aluna.
**Corresponde a**: M3 do `03-ROADMAP.md` (numeração de milestone preservada; a ordem de execução
foi deslocada para depois da M4 — é a milestone mais complexa do projeto e ganha em ser
enfrentada com o sistema já em uso real). As 11 fases do milestone (migração `0003_agenda` +
`garantir_aulas_da_semana`/`alunas_da_aula`, `lib/agenda/semana.ts` com testes, `nome_normalizado`

+ índice, CRUD de turmas, cadastro/matrícula de alunas, grade desktop, grade mobile, navegação

por semana com geração preguiçosa, tela de presença, cancelamento com motivo, aba Alunos, teste
ponta a ponta) tornam-se os planos desta fase.
**Depends on**: Phase 2b (independente das Fases 3 e 4)
**Requirements**: AGD-01, AGD-02, AGD-03, AGD-04, AGD-05, AGD-06, AGD-07, AGD-08, AGD-09, AGD-10, AGD-11, AGD-12, AGD-13, AGD-14, AGD-15, AGD-16
**Success Criteria** (what must be TRUE):

  1. A grade reproduz o protótipo: cores por modalidade, contagem de assentos, três níveis (aberta, completa, excedida)
  2. Turma com mais alunas do que vagas aparece em vermelho e continua permitida
  3. Passar uma aluna de experimental para matriculada funciona e some o aviso
  4. Avançar para uma semana futura cria as aulas sozinho, sem duplicar ao recarregar
  5. Marcar presença da turma inteira leva menos de 30 segundos no celular, com toque único por aluna
  6. Uma aluna de outra turma pode ser adicionada a uma aula como reposição
  7. Encerrar a matrícula de uma aluna a remove das aulas seguintes, mas não das passadas
  8. Cancelar uma aula por feriado mantém o registro e o motivo
  9. O histórico de uma aluna mostra todas as presenças e faltas dela

**Plans**: TBD
**UI hint**: yes

### Phase 6: Estoque

**Goal**: Saber o que existe, o que está acabando e para onde o material foi — saldo sempre
derivado das movimentações, nunca uma coluna editável.
**Corresponde a**: M5 do `03-ROADMAP.md`. As 9 fases do milestone (migração `0005_estoque` +
view `saldos_materiais`, `lib/estoque/saldo.ts` com testes, CRUD de materiais por categoria,
registro de movimentação pensado para celular, lista de saldos com busca/filtro, histórico por
material, bloco de alertas no painel inicial, vínculo opcional com aula/fornada/encomenda, teste
ponta a ponta) tornam-se os planos desta fase.
**Depends on**: Phase 2b (independente das Fases 3, 4 e 5)
**Requirements**: EST-01, EST-02, EST-03, EST-04, EST-05, EST-06, EST-07, EST-08, EST-09, EST-10, EST-11, EST-12
**Success Criteria** (what must be TRUE):

  1. Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
  2. Material abaixo do mínimo aparece destacado na lista e no painel inicial
  3. O histórico mostra toda movimentação com autor e data
  4. Não existe nenhuma forma de editar ou apagar uma movimentação pela interface — só registrar um ajuste
  5. Registrar uma baixa no celular leva menos de 15 segundos
  6. O saldo mostrado bate com a soma manual do histórico

**Plans**: TBD
**UI hint**: yes

### Phase 7: Polimento e Entrega

**Goal**: Transformar algo que funciona em algo que se pode confiar — painel inicial de
verdade, restauração de backup testada de ponta a ponta, e documentação para operar sozinho num
dia ruim.
**Corresponde a**: M7 do `03-ROADMAP.md`. As 7 fases do milestone (painel inicial real, revisão
de acessibilidade, revisão de desempenho, revisão de mensagens de erro e estados vazios,
simulacro de restauração de desastre cronometrado e documentado, manual de uso com imagens,
documento de operação) tornam-se os planos desta fase. Esta fase **não** espera pela M6
(Calculadora de Orçamento — bloqueada por planilhas de precificação ausentes e fora deste
roadmap).
**Depends on**: Phases 1-6 (M0 a M5 — não depende da M6)
**Requirements**: UI-10, UI-11, PNL-01, PNL-02, PNL-03, PNL-04, PNL-05, PNL-06, PNL-07
**Success Criteria** (what must be TRUE):

  1. O painel inicial responde "o que preciso fazer hoje?" sem nenhum clique, mostrando encomendas por etapa, aulas de hoje, fornos em atenção ou crítico e alertas de estoque baixo
  2. Um backup foi restaurado de verdade, a partir do armazenamento externo, num Postgres limpo, e os dados conferem — e existe um documento em português que permite repetir isso num dia ruim
  3. Existe um manual de uso curto, com imagens, que uma pessoa nova consegue seguir sozinha
  4. Existe um documento de operação cobrindo criar usuário, redefinir senha, restaurar backup e o que fazer se o site cair, deixando explícito qual backup usar em cada caso
  5. Nenhum erro aparece no console do navegador em uso normal
  6. O sistema carrega em menos de 3 segundos em 4G

**Plans**: TBD
**UI hint**: yes

## Milestone Correspondence

| Fase GSD | Milestone (`03-ROADMAP.md`) | Ordem de execução |
|----------|------------------------------|--------------------|
| Phase 1 | M0 — Fundação e primeiro deploy | 1ª |
| Phase 2a | M1 (fases 1–4 e 8) — Login, banco base e backup | 2ª |
| Phase 2b | M1 (fases 5–7) — Design system e casca | 3ª |
| Phase 3 | M2 — Gestor de Encomendas | 4ª |
| Phase 4 | M4 — Contador de Queima | 5ª (antecipada — ver nota na Fase 4) |
| Phase 5 | M3 — Agenda de Aulas | 6ª (deslocada — ver nota na Fase 5) |
| Phase 6 | M5 — Estoque | 7ª |
| Phase 7 | M7 — Polimento e entrega | 8ª (não espera M6) |
| — | M6 — Calculadora de Orçamento 🔴 | Excluída — bloqueada, requisitos em v2 |

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2a → 2b → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação e Primeiro Deploy | 7/7 | Complete    | 2026-08-08 |
| 2a. Login, Banco Base e Backup | 8/8 | Complete    | 2026-08-08 |
| 2b. Design System e Casca da Aplicação | 5/5 | Complete    | 2026-08-09 |
| 3. Gestor de Encomendas | 8/8 | In Progress|  |
| 4. Contador de Queima | 7/7 | Complete    | 2026-08-11 |
| 5. Agenda de Aulas | 0/TBD | Not started | - |
| 6. Estoque | 0/TBD | Not started | - |
| 7. Polimento e Entrega | 0/TBD | Not started | - |
