# 03 — Roadmap de Milestones e Fases

> Cada **milestone** é um ciclo completo do GSD Core:
> `/gsd-discuss` → `/gsd-plan` → `/gsd-execute` → `/gsd-verify` → `/gsd-ship`.
> Cada **fase** dentro dela é uma unidade de execução com contexto próprio.
>
> Os critérios de aceite são escritos para o Theo conseguir verificar sozinho, sem ler
> código. Se um critério não puder ser testado clicando, ele está mal escrito.

**Ordem escolhida:** fundação → módulos que já existem em protótipo → o resto.
Você vê algo funcionando cedo, e o que vem antes é justamente o que já está mais definido.

---

## M0 — Fundação e primeiro deploy

**Objetivo:** ter um endereço `https://` no ar, com deploy automático funcionando.
Sem nenhuma funcionalidade. Só o caminho do código até a internet.

> Por que isso vem antes de tudo: se o deploy só for montado no fim, todo problema de
> infraestrutura aparece de uma vez, no pior momento, com o sistema inteiro por cima.
> Resolvendo agora, cada milestone seguinte já nasce publicada.

**Fases**

1. Projeto Next.js + TypeScript + Tailwind + shadcn, ESLint, Prettier, Vitest, Playwright
2. Repositório **público** no GitHub, com `.gitignore` cobrindo `.env*` (menos o
   `.env.example`), `backups/` e `*.sql.gz` **antes do primeiro commit**. Habilitar
   *secret scanning* e *push protection*. `.env.example` sem valores, `README`, proteção da
   branch `main` — ver seção 10 do arquivo `01`
3. Preparação do VPS: Docker, UFW (só 22/80/443), fail2ban, SSH por chave, root desabilitado,
   `unattended-upgrades`. **Habilitar o Auto Backup no painel da Contabo** (€1,15–3/mês) —
   protege a máquina inteira, com 10 dias de retenção
4. `compose.yml` com **postgres** (volume nomeado, **sem porta publicada**, `TZ` **não**
   injetado), **app**, **caddy**, e o serviço sob demanda **ferramentas**. Dockerfile em
   múltiplos estágios: saída *standalone* para o `app`, imagem completa (com `drizzle-kit` e
   os scripts) para o `ferramentas` — sem ela, migrar e criar usuário não funciona;
   ver seção 4 do arquivo `01`
5. DNS do domínio apontado, HTTPS válido pelo Caddy
6. Drizzle configurado, conexão com o banco, `npm run db:migrate` funcionando
7. Um **segundo banco Postgres, só para testes** (outro serviço no compose ou outro banco na
   mesma instância). O E2E do passo seguinte depende dele — não inverta a ordem
8. GitHub Actions: lint → unitários → build (**com as `NEXT_PUBLIC_*` como build-args**) →
   E2E → publica no GHCR → deploy por SSH com `docker compose up -d app`. Resolver o acesso
   ao GHCR no VPS (package público ou `docker login` com PAT)
9. Endpoint `/api/health` verificando app **e** uma consulta real ao banco + monitor externo

**Critérios de aceite**

- [ ] **Nenhum arquivo `.env` com valores reais aparece no repositório público** — conferir
      com `git log --all --full-history -- .env` antes de fechar a milestone
- [ ] `https://seudominio.com.br` abre com cadeado e sem aviso de segurança
- [ ] Alterar um texto, dar `git push`, e a mudança aparecer sozinha em poucos minutos
- [ ] `https://seudominio.com.br/api/health` responde `ok` e confirma o banco
- [ ] **`nmap` ou `telnet` na porta 5432 do IP do VPS não conecta** — o banco não está exposto
- [ ] Reiniciar o VPS e a aplicação voltar sozinha, com os dados intactos
- [ ] O Auto Backup da Contabo aparece ativo no painel
- [ ] Um deploy não recria o container do Postgres
- [ ] O site abre bem no celular
- [ ] Um deploy com teste quebrado é **barrado** e não vai ao ar

---

## M1 — Login, banco base e casca da aplicação

**Objetivo:** entrar com e-mail e senha e navegar por telas vazias de todos os módulos,
já com a identidade visual do AMASSA aplicada.

**Fases**

1. Primeira migração: `hoje_brasilia`, `tocar_atualizado_em` **com os triggers**,
   **papel `amassa_app` com os `grant`** (ver seção 0 do arquivo `02`), tabela `usuarios`
2. Autenticação: Auth.js v5 com provedor Credentials, senhas em **argon2id**, sessão JWT em
   cookie `httpOnly`, limite de tentativas de login. `middleware.ts` protegendo tudo.
   **Dividir a configuração em `auth.config.ts` (sem argon2, para o Edge) e `auth.ts`** —
   ver a caixa de aviso na seção 4 do arquivo `01`, é o erro mais provável desta milestone
3. `lib/auth/exigirUsuario()` — a única porta de autorização do sistema — e os scripts
   `criar-usuario` e `redefinir-senha`
4. Tela de login: erros em português, estado de carregando. **Sem "esqueci a senha"** —
   a redefinição é por linha de comando (ver seção 4 do arquivo `01`)
5. Design system: tokens do arquivo `04` **incluindo o mapeamento `@theme inline` para o
   shadcn**, tipografia, componentes base ajustados
6. Casca: navegação lateral no desktop, barra inferior no celular, menu do usuário, sair
7. Painel inicial com espaços reservados (os números chegam nas milestones seguintes)
8. **Backup automático do banco** — a fase mais importante desta milestone.
   `scripts/backup.sh` chamado pelo **`cron` do host** (o Compose não agenda nada):
   `pg_dump` diário, rotação de 14 dias, retenção mensal, envio por `rclone` para o
   armazenamento externo, registro do resultado na tabela `execucoes_backup` e o endpoint
   `/api/health/backup` monitorado externamente.
   **Este é o único backup que existe** — ver seção 7 do arquivo `01`
9. Teste ponta a ponta do login + teste de que rota protegida redireciona quem não entrou

**Critérios de aceite**

- [ ] Abrir qualquer endereço sem estar logado leva para `/login`
- [ ] Login com senha errada mostra uma mensagem clara, em português
- [ ] Errar a senha 5 vezes bloqueia temporariamente
- [ ] Depois de entrar, a sessão persiste ao fechar e reabrir o navegador
- [ ] Os 5 itens da barra inferior (Início, Encomendas, Agenda, Queimas, Estoque) abrem
      cada um a sua tela; Orçamentos aparece no menu do usuário
- [ ] A navegação funciona confortavelmente com o polegar, no celular
- [ ] Sair encerra a sessão de verdade (voltar no histórico não devolve o acesso)
- [ ] As cores e fontes já são as do AMASSA, não o padrão do Tailwind
- [ ] **O backup de ontem existe no servidor e também no armazenamento externo**
- [ ] Criar e desativar um usuário pela linha de comando funciona

---

## M2 — Gestor de Encomendas

**Objetivo:** substituir o protótipo HTML por um módulo real, multiusuário, com itens.

**Fases**

1. Migração `0002_encomendas.sql` + tipos
2. **`lib/encomendas/cronograma.ts`** — módulo puro, com testes escritos **antes** do código:
   cascata de datas, fim exclusivo, marcos valendo 0 ou 1 dia (nunca outro valor),
   etapas com 0 dias ignoradas no desenho, duração total, data de conclusão,
   etapa atual em relação a hoje, virada de mês e ano bissexto
3. Server Actions de CRUD com validação Zod (encomenda + itens + etapas em uma transação)
4. Gantt para desktop: 18 px/dia, cabeçalho em quinzenas, coluna fixa, linha de "Hoje",
   rolagem automática até o "Hoje" ao abrir
5. Lista vertical para celular: cada encomenda como cartão com trilha de etapas e destaque
   da etapa atual
6. Formulário de encomenda: dados, itens (adicionar/remover/reordenar), durações com
   pré-visualização das datas em tempo real — como no protótipo
7. Filtros por status, ordenação, busca por nome ou cliente
8. Estados vazio ("A roda ainda não gira"), carregando e erro
9. Teste ponta a ponta: criar → editar → excluir, em desktop e em viewport de celular

**Critérios de aceite**

- [ ] Criar uma encomenda com 6 etapas e ver as datas calculadas corretamente
- [ ] Mudar a duração de "secagem" desloca todas as etapas seguintes
- [ ] Os três marcos aparecem como losango e são um interruptor (acontece / não acontece),
      nunca um campo numérico
- [ ] Desligar a etapa "Entrega" faz o losango sumir e encurta a encomenda
- [ ] A linha "Hoje" está na posição certa e a timeline abre centralizada nela
- [ ] Uma encomenda com 40 canecas e 12 bowls guarda e mostra os dois itens
- [ ] No celular, dá para ler o andamento de todas as encomendas sem rolagem horizontal
- [ ] Uma encomenda criada em um dispositivo aparece no outro **ao recarregar a página**
      (não há atualização em tempo real, e isso é deliberado — para 5 pessoas, sincronização
      ao vivo é complexidade sem benefício)
- [ ] Excluir pede confirmação

---

## M3 — Agenda de Aulas

**Objetivo:** o protótipo da agenda + datas reais + presença.

**Fases**

1. Migração `0003_agenda.sql` + funções `garantir_aulas_da_semana` e `alunas_da_aula` + tipos
2. **`lib/agenda/semana.ts`** — módulo puro, testado: limites da semana, mapeamento
   dia/turno, `medirAula` (livre/completa/excedida), detecção de nome repetido no mesmo turno,
   vigência de matrícula na data (`fim` é **inclusivo**)
2b. Função `nome_normalizado` + índice de busca de alunas (a função precisa ser `immutable`;
   ver seção 0 do arquivo `02` — sem isso o `create index` falha e a migração trava)
3. CRUD de turmas + configuração "incluir domingo"
4. Cadastro de alunas (com deduplicação por nome normalizado) e matrículas
   (matriculada / experimental / efetivar)
5. Grade semanal no desktop, fiel ao protótipo: assentos, cores por modalidade, estatísticas
6. Grade no celular: um dia por vez, navegação lateral, cartões grandes
7. Navegação por semana + chamada da geração preguiçosa ao abrir cada semana
8. Tela de presença: lista grande vinda de `alunas_da_aula`, toque único para alternar
   estado, salvamento otimista, botão "adicionar aluna avulsa" para registrar **reposição**
9. Cancelar aula com motivo
10. Aba "Alunos": busca, filtro, e o histórico de presenças de cada aluna
11. Teste ponta a ponta: criar turma → matricular → abrir semana → marcar presença

**Critérios de aceite**

- [ ] A grade reproduz o protótipo: cores por modalidade, contagem de assentos, três níveis
- [ ] Passar uma aluna de experimental para matriculada funciona e some o aviso
- [ ] Turma com mais alunas do que vagas aparece em vermelho **e continua permitida**
- [ ] Avançar para uma semana futura cria as aulas sozinho, sem duplicar ao recarregar
- [ ] Marcar presença da turma inteira leva menos de 30 segundos no celular
- [ ] Uma aluna de outra turma pode ser adicionada a uma aula como **reposição**
- [ ] Encerrar a matrícula de uma aluna a remove das aulas seguintes, mas não das passadas
- [ ] Cancelar uma aula por feriado mantém o registro e o motivo
- [ ] O histórico de uma aluna mostra todas as presenças e faltas dela

---

## M4 — Contador de Queima

**Objetivo:** controlar a vida útil das resistências dos fornos — saber quantas queimas cada
um acumulou desde a última manutenção, e ser avisado antes de estourar.

> **Esta milestone vem antes da M3.** O módulo é menor e mais simples que a Agenda, o fluxo
> principal (registrar queima) é o mais usado do sistema inteiro, e entrega valor imediato —
> a partir do primeiro dia ninguém mais conta queima no papel. A M3 é a mais complexa do
> projeto; não há razão para enfrentá-la antes. A numeração das milestones foi mantida para
> não invalidar referências; só a ordem de execução mudou.

**Fases**

1. Migração `0004_queimas`: fornos, queimas, manutenções, view `fornos_medidos`
2. **`lib/queimas/contador.ts`** — módulo puro, testado: contador desde a última manutenção,
   `Math.max(1, limite - 10)`, nível ok/atenção/crítico, forno sem nenhuma manutenção, forno
   sem nenhuma queima, agregação por semana (**semana começa na segunda**, 8 baldes de 7
   dias) e por mês (6 meses civis), agregação por forno e por tipo
3. Cadastro de fornos (nome, descrição, limite mínimo 10, ativo). **Sem exclusão** — fornos
   são desativados, para não destruir o histórico de vida útil do equipamento
4. Cartão do forno: medidor com entalhes a cada 10 e marca no limiar de atenção, contador
   `atual / limite`, nível colorido, selo "Manutenção próxima"/"vencida", rodapé com a
   última manutenção (data e responsável) e o total histórico
5. **Registrar queima em dois toques** — abre a janela, escolhe o tipo, pronto. Salvamento
   otimista e aviso com **"Desfazer"** por 7 segundos
6. Registrar manutenção: mostra "o contador vai de N para 0", pede responsável e observações
   (ambos opcionais), grava as queimas acumuladas
7. Detalhe do forno: histórico de manutenções e das últimas 25 queimas, com remoção de queima
   lançada por engano — **com confirmação**
8. Banner no topo da aba Fornos listando os que precisam de atenção, com contador
9. Relatórios com Recharts: barras empilhadas por tipo (8 semanas / 6 meses), barras
   horizontais por forno, quatro estatísticas
10. Alerta de forno em atenção ou crítico no painel inicial
11. Teste ponta a ponta: cadastrar forno → registrar queimas até o crítico → manutenção →
    conferir que zerou

**Critérios de aceite**

- [ ] Registrar uma queima leva **dois toques** e menos de 5 segundos no celular
- [ ] O "Desfazer" do aviso remove a queima registrada por engano
- [ ] Chegando a 90 de 100, o cartão fica em atenção e mostra "Manutenção próxima";
      em 100, fica em crítico e mostra "Manutenção vencida"
- [ ] O banner no topo lista os fornos que precisam de atenção, com o contador de cada um
- [ ] Registrar manutenção zera o contador **sem apagar** o histórico de queimas
- [ ] O cartão mostra quantas queimas o forno já fez na vida, não só desde a manutenção
- [ ] Os três tipos aparecem: biscoito, esmalte e **ouro**
- [ ] Os gráficos batem com a contagem manual do histórico, e a semana começa na segunda
- [ ] Um forno em atenção ou crítico aparece no painel inicial

---

## M5 — Estoque

**Objetivo:** saber o que existe, o que está acabando e para onde o material foi.

**Fases**

1. Migração `0005_estoque.sql` + view `saldos_materiais` + tipos
2. **`lib/estoque/saldo.ts`** — módulo puro, testado: aplicação de sinal por tipo,
   cálculo da diferença no ajuste (`saldo_contado − saldo_atual`), soma de saldo,
   regra de alerta. **Sem conversão de unidades** — cada material vive na unidade em que
   foi cadastrado, por decisão (ver seção 4 do arquivo `02`)
3. CRUD de materiais, agrupados por categoria (cerâmica / pintura / bordado)
4. Registro de movimentação: fluxo curto, pensado para o celular — material, tipo,
   quantidade, motivo, salvar. **No tipo `ajuste`, a tela pede o saldo contado na
   prateleira, não a diferença**
5. Lista de saldos com busca, filtro por categoria e destaque para os que estão em alerta
6. Histórico por material, com quem registrou e quando
7. Bloco de alertas de estoque baixo no painel inicial
8. Vínculo opcional da movimentação com aula, fornada ou encomenda
9. Teste ponta a ponta: cadastrar material → entrada → saída → conferir o saldo

**Critérios de aceite**

- [ ] Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
- [ ] Material abaixo do mínimo aparece destacado na lista e no painel inicial
- [ ] O histórico mostra toda movimentação com autor e data
- [ ] Não existe nenhuma forma de editar ou apagar uma movimentação — só ajustar
- [ ] Registrar uma baixa no celular leva menos de 15 segundos
- [ ] O saldo bate com a soma manual do histórico

---

## M6 — Calculadora de Orçamento 🔴 BLOQUEADO

**Não iniciar sem as planilhas de precificação.**

---

## M7 — Polimento e entrega

**Objetivo:** transformar algo que funciona em algo que se pode confiar.

**Fases**

1. Painel inicial de verdade: encomendas por etapa, aulas de hoje, fornos em atenção ou
   crítico, alertas de estoque
2. Revisão de acessibilidade: contraste, foco visível, alvos de toque, navegação por teclado
3. Desempenho: imagens, tamanho do JavaScript, tempo de carregamento em 4G
4. Revisão de todas as mensagens de erro e estados vazios
5. **Simulacro de desastre.** Não é "conferir se o arquivo existe" — é: subir um Postgres
   limpo, restaurar o dump do armazenamento externo, apontar a aplicação para ele e
   confirmar que os dados voltaram. Cronometrar. Documentar o passo a passo em português
6. Manual de uso curto, com imagens, para quem for usar o sistema
7. Documento de operação: criar usuário, redefinir senha, restaurar backup, o que fazer se
   o site cair. **Deixar explícito qual backup usar em cada caso** — o dump para recuperar
   dados, o Auto Backup da Contabo para recuperar o servidor

**Critérios de aceite**

- [ ] O painel inicial responde "o que preciso fazer hoje?" sem nenhum clique
- [ ] **Um backup foi restaurado de verdade, a partir do armazenamento externo, e os dados
      conferem** — e existe um documento que permite repetir isso num dia ruim
- [ ] Existe um manual que uma pessoa nova consegue seguir sozinha
- [ ] Nenhum erro no console do navegador em uso normal
- [ ] Carrega em menos de 3 segundos em 4G

---

## Panorama

| Milestone | Depende de | Situação |
|-----------|-----------|----------|
| M0 Fundação | domínio, VPS, GitHub, storage de backup | Pronta, assim que as contas existirem |
| M1 Login, backup e casca | M0 | Pronta |
| M2 Encomendas | M1 | Pronta |
| M4 Queima | M1 | Pronta — **considere fazer antes da M3** |
| M3 Agenda | M1 | Pronta |
| M5 Estoque | M1 | Pronta |
| M6 Orçamento | M2, M5 + **planilhas** | 🔴 Bloqueada por informação que falta |
| M7 Polimento | M0 a M5 (**não** espera a M6) | Última |

> **Ordem de execução:** M0 → M1 → M2 → **M4** → M3 → M5 → M7. A M4 subiu porque é pequena,
> entrega o fluxo mais usado do sistema e não depende de nada além do login. A M3 continua
> sendo a mais complexa e ganha em ser enfrentada depois de você já ter usado o sistema por
> algumas semanas.

> **A M7 não espera a M6.** Se dependesse, o projeto nunca fecharia enquanto as planilhas de
> precificação não existissem. O orçamento entra depois, como um módulo a mais, e ganha o
> seu próprio polimento.

> **Uma só coisa está bloqueada:** as planilhas de precificação, que travam a M6. Quatro dos
> cinco módulos podem ser construídos de ponta a ponta.

M2, M3 e M5 são independentes entre si — se em algum momento fizer sentido paralelizar,
é aqui.

---

## Como saber que uma milestone realmente terminou

O GSD tem uma etapa `/gsd-verify` e ela existe exatamente para isto. Não pule.
Uma milestone só está pronta quando:

1. Todos os critérios de aceite foram marcados **pelo Theo**, clicando, no celular e no desktop
2. Lint e testes passam com zero avisos
3. Está no ar, em produção, e não em `localhost`
4. Foi usada com **dados reais do ateliê**, não com dados de exemplo
5. **O backup rodou depois da migração e o arquivo do dia existe no armazenamento externo**

O item 4 é o que separa um sistema que funciona de um sistema que é usado — dados reais
sempre revelam algo que os dados de teste escondiam. O item 5 existe porque o banco agora é
seu: uma migração que corre bem e um backup que parou de rodar é a combinação que destrói
meses de trabalho sem ninguém perceber a tempo.
