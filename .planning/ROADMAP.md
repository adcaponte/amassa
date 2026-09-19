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

**M6 (Calculadora de Orçamento) virou o módulo Financeiro, em duas partes, e deixou de estar
bloqueada.** As planilhas de precificação existem desde 18/09 (feitas e auditadas no Cowork). A
revisão do projeto de 2026-09-19 pôs o Financeiro **na frente de tudo o que falta**: a parte 1
(Venda, Compra, Caixa, Mês e Cadastros) é a **Fase 04.4**; a parte 2 (Precificação + Orçamento com
PDF, que absorve os ORC-*) ainda não tem fase — o protótipo dela está sendo feito no Cowork.

**Ordem de execução desde 2026-09-19:** 04.4 (Financeiro 1) → Financeiro 2 → `/gestao` + site
público + navegação nova → 6 (Estoque) → Produção (Encomendas renomeada) → 5 (Agenda) → Queimas e
7 (Polimento). As fases sem número ainda serão criadas; a Agenda será reavaliada em novembro.

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
- [x] **Phase 3: Gestor de Encomendas** - Módulo real e multiusuário substituindo o protótipo HTML, com itens e cronograma em cascata (completed 2026-08)
- [x] **Phase 4: Contador de Queima** - Controle de vida útil das resistências dos fornos, registro de queima em dois toques (completed 2026-08)
- [x] **Phase 04.1: Datas dos Marcos da Encomenda** (INSERTED) - Correção das datas dos marcos no cronograma (completed 2026-08-22)
- [x] **Phase 4.2: Abertura do Espaço** (INSERTED, temporário) - Organizador da abertura do novo espaço: itens a comprar com parcelas e entrega, e tarefas até a inauguração
- [x] **Phase 04.3: Comparador de Compras** (INSERTED) - Aba do módulo Abertura para comparar cotações de equipamentos lado a lado, compartilhada entre os gestores; arquivada (não apagada) quando a Abertura for desmontada (completed 2026-09-18)
- [ ] **Phase 04.4: Financeiro — parte 1** (INSERTED) - Venda, Compra, Caixa, Mês e Cadastros; a próxima a executar
- [ ] **Phase 5: Agenda de Aulas** (em espera) - Turmas recorrentes materializam aulas com data real e presença por aluna
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
  3. Os três marcos (queima 1, queima 2, entrega) aparecem como losango, sempre acontecem e sempre duram 1 dia; o campo numérico ao lado de cada um é a espera **antes** do marco, nunca a duração dele. *(Corrigido na Fase 04.1 — o critério original acima passou nas duas rodadas de verificação da Fase 3: a implementação estava certa, o que estava errado era a especificação sobre como o ateliê funciona, achado registrado em `.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md` §"Achado de produto — ENC-03 está errado sobre o ateliê".)*
  4. No desktop, o Gantt usa 18px/dia, cabeçalho em células semanais começando na segunda-feira, coluna fixa e a linha de "Hoje" na posição certa, e a timeline abre em hoje, na borda esquerda
  5. Uma encomenda guarda e mostra vários itens com descrição e quantidade (ex.: 40 canecas e 12 bowls)
  6. No celular, dá para ler o andamento de todas as encomendas como lista vertical, sem rolagem horizontal
  7. Encomendas podem ser filtradas por status, ordenadas e buscadas por nome ou cliente
  8. O rodapé do formulário mostra duração total e data de conclusão, atualizando conforme se digita
  9. Uma encomenda criada em um dispositivo aparece no outro ao recarregar a página (sem atualização em tempo real, deliberadamente)
  10. Excluir uma encomenda pede confirmação
  11. O estado vazio mostra "A roda ainda não gira"
  12. Um botão de imprimir produz uma folha A4 com as encomendas ativas — nome, cliente, etapa atual e data de conclusão — legível e cabendo em uma página no volume atual do ateliê
  13. No desktop, clicar no nome de uma encomenda no Gantt abre a encomenda

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

### Phase 04.1: Datas dos Marcos da Encomenda (INSERTED)

**Goal**: Deixar o gestor dizer **quando** a queima de esmalte e a entrega acontecem, em vez de
assumir que vêm logo depois da etapa anterior — e tirar o interruptor dos marcos, que sempre
acontecem. Hoje nenhuma data é armazenada: tudo nasce em cascata a partir de `dataInicio`
(`lib/encomendas/cronograma.ts`), e é essa premissa que muda.
**Origem**: caminhada humana do dono em produção (2026-08-20), registrada em
`.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md` §"Achado de produto". Não é
retrabalho da Fase 3 — é a especificação que estava errada sobre o ateliê.
**Depends on**: Phase 3
**Requirements**: ENC-15 (novo — a espera em dias antes de cada marco), ENC-03 (reaberto e
reescrito), ENC-04 (retirado — não há mais o que desligar)
**Migração**: sim — `0009_espera-dos-marcos` acrescenta a coluna `espera_dias` a
`encomenda_etapas` e substitui a restrição `marcos_zero_ou_um`
**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 04.1-01-PLAN.md — Traçado: a espera do marco, do `check` do Postgres ao campo "dias depois" (onda 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04.1-02-PLAN.md — O vão vazio: trilha proporcional, Gantt e a espera na tela de detalhe (onda 2)
- [x] 04.1-03-PLAN.md — ENC-03 reescrito, ENC-04 retirado, ENC-15 criado, e o critério da Fase 3 corrigido (onda 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04.1-04-PLAN.md — Varredura completa e a migração de produção à mão (onda 3)

**Wave 4** *(fechamento de lacunas — `04.1-VERIFICATION.md` voltou `gaps_found`, 15/17)*

- [x] 04.1-05-PLAN.md — A ordem das etapas: `order by ordem` nas duas leituras que alimentam a cascata, com portão estrutural e prova em Postgres real (onda 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04.1-06-PLAN.md — A mensagem em português chega ao gestor, os contadores viram acessíveis, a guarda certa no roteiro de migração e a varredura de reencerramento (onda 5)

### Phase 4.2: Abertura do Espaço (INSERTED — módulo temporário)

**Goal**: Organizar a abertura do novo espaço num lugar só — o que precisa ser comprado, quanto
custa, quando cada parcela cai, o que ainda não chegou, e o que precisa acontecer até a
inauguração. É o único módulo com data de morte: sai do sistema quando o espaço abrir.
**Corresponde a**: nada no `03-ROADMAP.md` — não existia no plano original. Entra por necessidade
real, com prazo real, e por isso é decimal (inserção fora da sequência planejada).
**Validado por protótipo**: o formato foi testado antes de virar código, com dados reais do dono.
Ver `.planning/phases/04.2-abertura-do-espaco/04.2-CONTEXT.md` — o protótipo **é** a especificação.
**Depends on**: Phase 2b (precisa da casca de navegação e do design system)
**Requirements**: ABE-01, ABE-02, ABE-03, ABE-04, ABE-05, ABE-06, ABE-07, ABE-08, ABE-09, ABE-10, ABE-11, ABE-12, ABE-13, ABE-14, ABE-15
**Success Criteria** (what must be TRUE):

  1. Cadastrar um item a prazo com 6 parcelas mostra o valor de cada uma e a data em que a próxima cai
  2. A visão "Por mês" soma o que sai em cada mês, diz de quais itens e parcelas, e identifica o mês mais pesado
  3. Um item com entrega vencida e não resolvido aparece destacado como "não chegou", e conta no bloco de atenção do topo
  4. Uma tarefa ligada a um item mostra de qual item veio, e o item mostra quantas tarefas abertas ainda carrega
  5. Remover um item com tarefas ligadas avisa quantas ficam soltas e não apaga nenhuma delas
  6. O responsável de uma tarefa é escolhido entre os gestores ativos da plataforma, e "ninguém ainda" é um estado válido
  7. Itens e tarefas são editados no lugar, sem apagar e recriar
  8. A data de inauguração é editável e a contagem regressiva acompanha, inclusive depois de a data passar
  9. Existe uma migração de remoção pronta e testada que apaga o módulo inteiro sem afetar o resto do sistema

**Plans**: 5/5 plans executed

Plans:

- [x] 04.2-01-PLAN.md — Traçador: o item existe ponta a ponta, da tabela ao grupo na tela, com as parcelas calculadas e nenhuma armazenada
- [x] 04.2-02-PLAN.md — Tarefas: grupos, urgência, responsável vindo dos gestores ativos e o vínculo com o item lido dos dois lados
- [x] 04.2-03-PLAN.md — Marcar como resolvido, o item que não chegou, editar no lugar e remover dizendo o que se perde
- [x] 04.2-04-PLAN.md — Painel de três blocos, visão mês a mês com escala nomeada, e a data de inauguração com a contagem regressiva
- [x] 04.2-05-PLAN.md — A migração de remoção escrita, testada e desarmada; varredura completa e conferência com o protótipo

**UI hint**: yes

### Phase 04.3: Comparador de Compras (INSERTED — aba do módulo Abertura; arquivada, não apagada)

**Goal**: Comparar as cotações de equipamentos e materiais da abertura lado a lado, num lugar que
todos os gestores veem — hoje isso vive num protótipo com `localStorage`, que só existe no
navegador de quem digitou. A Andressa precisa ver e editar os mesmos dados.
**Especificação**: `.planning/phases/04.3-comparador-de-compras/prototipo.html`, feito no Cowork e
validado pelo dono. Como na 4.2, **o protótipo é a especificação**: onde a prosa e o protótipo
divergirem, o protótipo vence — exceto nas melhorias listadas abaixo, decididas depois dele.
**Decisões do dono (2026-09-17)**:

- **Aba dentro de `/abertura`**, não módulo próprio em `/gestao/compras` como dizia o planejamento
  do Cowork (M10). Os equipamentos são todos comprados antes da inauguração.

- **Arquivar, não apagar.** Quando a Abertura for desmontada, o comparador some da interface mas
  **as tabelas e os dados ficam no banco**. As tabelas do comparador NÃO entram em
  `db/remocao/remover-abertura-do-espaco.sql`.

- **Preço é número anulável** (centavos). Nulo = "sob consulta", exibido como "—". O formulário
  aceita `24900` e `24.900,00`. As condições (parcelas, frete, desconto) seguem no texto.

- **Independente** dos itens da lista de compras nesta fase; virar item de compra pode vir depois.
- **Sem mudança de permissão**: a Andressa já tem conta.
- **Sem upload de arquivo**: só a informação que interessa, digitada.
- **Sobe vazio, sem importação:** o dono confirmou que não há dado cadastrado no protótipo.

**Depends on**: Phase 4.2
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06, CMP-07, CMP-08, CMP-09
**Success Criteria** (what must be TRUE):

  1. Categorias aparecem como abas dentro de `/abertura`; criar uma categoria nova leva menos de 10 segundos; renomear funciona; remover pede confirmação dizendo quantas cotações se perdem
  2. Cada cotação guarda empresa, produto, preço (ou "sob consulta"), situação (cotando, favorito, descartado) e os seis campos longos: diferenciais, assistência técnica, condições de pagamento, contato, observações e alertas
  3. Clicar numa linha abre o detalhe completo, com os alertas destacados em vermelho
  4. Ordenar por preço funciona, e itens sem preço vão para o fim
  5. Um item descartado continua visível, apagado — nunca some
  6. Marcar dois ou mais itens mostra a comparação lado a lado, com os campos alinhados em colunas
  7. **A Andressa entra com a conta dela e vê e edita os mesmos dados** — a razão de isto sair do navegador do dono
  8. No celular: cartões empilhados, comparação com rolagem horizontal própria, alvos de 44px, sem rolagem horizontal da página
  9. As tabelas do comparador sobrevivem à remoção do módulo Abertura, provado pelo `test:migracoes`

**Plans**: 5/5 plans executed

Plans:

- [x] 04.3-01-PLAN.md — Traçado ponta a ponta: migrações 0012/0013, as duas tabelas, os módulos puros de preço e ordenação, a quarta aba, a lista responsiva, o formulário completo de cotação, e a prova de que o comparador sobrevive à remoção da Abertura
- [x] 04.3-02-PLAN.md — Categorias: sub-abas com contagem, criar em menos de 10 segundos, renomear, remover dizendo quantas cotações se perdem, e os três estados (vazio, carregando, erro)
- [x] 04.3-03-PLAN.md — Ciclo de vida da cotação: editar no lugar (inclusive a situação), remover nomeando a empresa, o descartado que continua visível, o alerta que se vê na lista, e a prova de duas contas vendo os mesmos dados
- [x] 04.3-04-PLAN.md — Ler e comparar: ordenar por preço com o sem preço no fim, o detalhe completo ao clicar na linha, marcar para comparar e a comparação lado a lado com rolagem própria no celular
- [x] 04.3-05-PLAN.md — Fechamento: Roteiro 9 da migração, Roteiro 8 corrigido para o comparador não sair junto, varredura completa do e2e, conferência com o protótipo, e a migração em produção à mão

**UI hint**: yes

### Phase 04.4: Financeiro — parte 1: Venda, Compra, Caixa, Mês e Cadastros (INSERTED)

**Goal**: O financeiro do dia a dia, usado por duas pessoas no celular, de pé: lançar uma venda com
várias linhas num recebimento só, lançar despesa, ver o caixa e o que está a pagar e a receber, e
saber no fim do mês quanto cada área deixou e se o mês se pagou — substituindo planilha e caderno
antes da inauguração de dezembro.
**Especificação**: `.planning/phases/04.4-financeiro-parte-1/prototipo.html` ("Caixa e Vendas
AMASSA"), aprovado pelo dono em 2026-09-19, e `BRIEFING.md` na mesma pasta. **O protótipo vence
sobre a interface; o briefing vence sobre regra de dado que a tela não mostra** (§4 a §8 dele).
Os botões "Testar com as vendas/despesas que você descreveu" e "Voltar aos dados de exemplo" são
andaime do protótipo e não existem na plataforma.
**Decisões já tomadas (revisão de 2026-09-19 — não reabrir)**:

- **Sem** rateio, níveis de custo, partida dobrada, depreciação como lançamento, transferência
  interna ou subsídio. As palavras "competência" e "regime de caixa" não aparecem na tela.

- A **área** (Cafeteria · Espaço · Peças · Loja · Geral) vem da **categoria**; ninguém escolhe área
  ao lançar. Custos gerais num bloco só.

- Formas de pagamento: Dinheiro · Pix · Cartão. O preço não muda pela forma; a taxa do cartão sai
  do que entra no caixa e vira custo Geral.

- Compra de material conta como custo **no mês da compra**.
- `itens_catalogo` é o **cadastro único de itens da plataforma**: o Estoque (Fase 6) vai se ligar a
  ele, não criar tabela própria de materiais.

- Efeito no estoque só **exibido** (cálculo puro), sem gravar movimentação — isso é da Fase 6.
- A plataforma **não emite nota fiscal**, nunca.

**Fora desta fase**: precificação e orçamento com PDF (parte 2), baixa real de estoque (Fase 6),
cadastro de Pessoas, relatórios além do Mês, a navegação nova (fase do `/gestao`).
**Em aberto para `/gsd-discuss-phase`**: os cinco pontos da §9 do briefing.
**Depends on**: Phase 2b (casca e design system); Phase 4.2 só para o plano da virada, que lê as
parcelas da Abertura
**Requirements**: FNC-01, FNC-02, FNC-03, FNC-04, FNC-05, FNC-06, FNC-07, FNC-08, FNC-09, FNC-10, FNC-11, FNC-12, FNC-13, FNC-14, FNC-15, FNC-16, FNC-17
**Success Criteria** (what must be TRUE):

  1. No celular, uma venda com três itens de áreas diferentes, paga no Pix, é lançada em menos de 20 segundos, e o Mês mostra cada linha na sua área
  2. Uma venda em 3x lança as três parcelas; a primeira entra no saldo e as outras duas aparecem em "A receber"; parcelas que não fecham com o total impedem o lançamento, dizendo quanto falta ou sobra, também no servidor
  3. Uma venda no cartão entra no caixa pelo valor menos a taxa; mudar a taxa em Cadastros não muda o que já foi lançado, e a taxa aparece como custo Geral do mês
  4. "Paguei"/"Recebi" tira a conta da lista e move o saldo; dá para desfazer um dado por engano
  5. Cancelar um lançamento o deixa riscado no extrato, fora do saldo e do Mês, com quem cancelou e quando — nada é apagado
  6. "Gerar as contas do mês" rodado duas vezes cria as contas fixas uma vez só
  7. O saldo do Caixa bate com o saldo inicial mais a soma manual do extrato
  8. Categoria com lançamento não se apaga, só desativa, e continua nos relatórios
  9. As parcelas em aberto da Abertura viram contas a pagar por um script único, sem alterar a Abertura

**Plans**: 1/11 plans executed

Plans:
**Wave 1**

- [x] 04.4-01-PLAN.md — Traçado: o dono escolhe a numeração; o banco inteiro do financeiro (0014-0016, 24 categorias, travas e revoke delete) e uma venda de valor livre que chega ao extrato e ao saldo do Caixa

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04.4-02-PLAN.md — Financeiro na barra do celular e na lateral (D-04..D-06), `/cadastros` com Categorias e Taxas, e os FNC reescritos com o CONTEXT
- [ ] 04.4-03-PLAN.md — Venda pelo catálogo: atalhos, busca, lista completa, quantidade, preço de tabela, desconto (D-09/D-10), data retroativa e o que sai do estoque
- [ ] 04.4-04-PLAN.md — O script da virada (parcelas em aberto da Abertura viram contas a pagar), com ensaio, prova em banco próprio e o Roteiro 11 — não roda nesta fase

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04.4-05-PLAN.md — Catálogo em Cadastros: item vendável, insumo com estoque e unidade, ficha técnica de um nível
- [ ] 04.4-06-PLAN.md — Pagamento: à vista, sinal, 2x a 12x, "+ outra forma" (D-07/D-08), cartão com taxa congelada e a recusa no servidor

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04.4-07-PLAN.md — Despesa: compra de material, outra despesa e pagar conta que já existe

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 04.4-08-PLAN.md — Caixa: a pagar e a receber, "Paguei/Recebi" com linha de diferença (D-01/D-02), Desfazer exato (D-03), detalhe e cancelamento

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 04.4-09-PLAN.md — Extrato por mês e forma (D-11/D-12) e a tela Mês: áreas, Geral num bloco só, veredito, dinheiro que se mexeu, fora do resultado
- [ ] 04.4-10-PLAN.md — Contas fixas com cadastro completo (D-13) e "Gerar as contas de {mês}" que nunca duplica

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 04.4-11-PLAN.md — Fechamento: Roteiro 10, varredura completa, conferência com o protótipo, migração em produção pelo dono e verificação no celular e no computador

**UI hint**: yes

### Phase 5: Agenda de Aulas (em espera)

> **Adiada por decisão do dono em 2026-08-22.** O módulo de Abertura do Espaço tem prazo real
> (a inauguração) e o Estoque entra em seguida; a Agenda não tem urgência e continua sendo o
> módulo mais complexo do projeto, ganhando em ser enfrentado depois de o sistema já estar em uso.
> Ordem de execução revista: **4.2 → 6 (Estoque) → 5 (Agenda) → 7 (Polimento)**.
>
> **Revista de novo em 2026-09-17:** o Comparador de Compras (04.3) entra antes do Estoque — o dono
> precisa comparar as cotações da abertura já, com a Andressa acessando os mesmos dados. A mudança
> do site público para a raiz de `amassacerrado.com.br`, com a plataforma em `/gestao`, vem depois
> e ainda não tem fase (o planejamento dela está fora do repositório, ver PROXIMA-SESSAO.md).
> Ordem atual: **4.3 (Comparador) → 6 (Estoque) → 5 (Agenda) → 7 (Polimento)**.
>
> **Revista de novo em 2026-09-19** (revisão do projeto): o Financeiro passa à frente de tudo e o
> Estoque deixa de ser a próxima fase. Ordem: **04.4 (Financeiro 1) → Financeiro 2 → `/gestao` +
> site → 6 (Estoque) → Produção → 5 (Agenda) → Queimas e 7**. As regras de turma de Goiânia
> (turmas de 8) foram descartadas: a Agenda será redesenhada antes de ser planejada. O dono tinha
> a Agenda como indispensável na abertura — reavaliar em novembro se ela sobe.

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

> **Adiada pela revisão de 2026-09-19**: vem depois das duas partes do Financeiro e do `/gestao`.
> O protótipo aprovado em 18/09 continua valendo (`.planning/phases/06-estoque/prototipo.html`),
> com os ajustes da revisão: movimentação com origem manual · venda · compra · produção; ficha
> técnica plana; categoria "peça pronta"; e os itens vêm de `itens_catalogo`, criado na Fase 04.4.

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
documento de operação) tornam-se os planos desta fase.
**Depends on**: Phases 1-6 e o Financeiro (04.4 e a parte 2)
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
| Phase 04.4 | M6 — virou Financeiro, parte 1 | próxima (revisão de 2026-09-19) |
| — | M6 — Financeiro, parte 2 (Precificação + Orçamento) | sem fase ainda; ORC-* em v2 |
| Phase 7 | M7 — Polimento e entrega | última |

## Progress

**Execution Order:**
Ordem desde 2026-09-19 (não é a numérica): 1 → 2a → 2b → 3 → 4 → 04.1 → 04.2 → 04.3 → **04.4** → Financeiro 2 → `/gestao` + site → 6 → Produção → 5 → Queimas → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação e Primeiro Deploy | 7/7 | Complete    | 2026-08-08 |
| 2a. Login, Banco Base e Backup | 8/8 | Complete    | 2026-08-08 |
| 2b. Design System e Casca da Aplicação | 5/5 | Complete    | 2026-08-09 |
| 3. Gestor de Encomendas | 8/8 | Complete    | 2026-08-20 |
| 4. Contador de Queima | 7/7 | Complete    | 2026-08-11 |
| 04.1. Datas dos Marcos da Encomenda | 6/6 | Complete    | 2026-08-22 |
| 04.2. Abertura do Espaço | 5/5 | Complete | Migrações 0010/0011 aplicadas em produção em 2026-09-01, verificadas de fora (3 tabelas, 12 grants, 3 gatilhos) e o módulo conferido no celular do dono. |
| 04.3. Comparador de Compras | 5/5 | Complete    | 2026-09-18 |
| 04.4. Financeiro — parte 1 | 1/11 | In Progress|  |
| 5. Agenda de Aulas | 0/TBD | Not started | - |
| 6. Estoque | 0/TBD | Not started | - |
| 7. Polimento e Entrega | 0/TBD | Not started | - |
