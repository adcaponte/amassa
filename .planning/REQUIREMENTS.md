# Requirements: AMASSA — Plataforma de Gestão do Ateliê

**Defined:** 2026-08-05
**Core Value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.

> Derivados dos critérios de aceite de `amassa-plataforma/03-ROADMAP.md`. A regra do documento
> fonte vale aqui: **se um critério não puder ser testado clicando, ele está mal escrito.**

## v1 Requirements

### Infraestrutura e Deploy

- [x] **INFRA-01**: O sistema abre em `https://` no domínio próprio, com cadeado e sem aviso de segurança
- [x] **INFRA-02**: Alterar um texto e dar `git push` na `main` publica a mudança sozinho em poucos minutos
- [x] **INFRA-03**: `/api/health` responde `ok` e confirma uma consulta real ao banco
- [x] **INFRA-04**: A porta 5432 do IP do VPS não aceita conexão de fora — o banco não está exposto
- [x] **INFRA-05**: Reiniciar o VPS traz a aplicação de volta sozinha, com os dados intactos
- [x] **INFRA-06**: Um deploy publica a aplicação sem recriar o container do Postgres
- [x] **INFRA-07**: Um deploy com teste quebrado é barrado pelo pipeline e não vai ao ar
- [x] **INFRA-08**: Nenhum arquivo `.env` com valores reais existe no histórico do repositório público
- [x] **INFRA-09**: Migrações podem ser aplicadas à mão no servidor, com um comando, fora do pipeline
- [x] **INFRA-10**: O Auto Backup da Contabo aparece ativo no painel

### Backup e Recuperação

- [x] **BKP-01**: Um dump do banco é gerado automaticamente todo dia, sem intervenção
- [x] **BKP-02**: O dump do dia aparece também no armazenamento externo, fora do VPS
- [x] **BKP-03**: Os dumps são rotacionados em 14 dias e o do dia 1º é guardado em retenção mensal permanente
- [x] **BKP-04**: `/api/health/backup` só responde `ok` se o último backup tiver menos de 26 horas, e é monitorado externamente
- [x] **BKP-05**: Um backup pode ser disparado sob demanda antes de qualquer migração
- [x] **BKP-06**: Um dump do armazenamento externo é restaurado de verdade num Postgres limpo e os dados conferem
- [x] **BKP-07**: Existe um documento em português que permite repetir a restauração sozinho num dia ruim

### Autenticação e Acesso

- [x] **AUTH-01**: Abrir qualquer endereço sem estar logado leva para `/login`
- [x] **AUTH-02**: Entrar com e-mail e senha dá acesso ao sistema
- [x] **AUTH-03**: Senha errada mostra uma mensagem clara em português, igual à de e-mail inexistente
- [x] **AUTH-04**: Errar a senha 5 vezes no mesmo e-mail em 15 minutos bloqueia por 15 minutos
- [x] **AUTH-05**: A sessão persiste por 30 dias ao fechar e reabrir o navegador
- [x] **AUTH-06**: Sair encerra a sessão de verdade — voltar no histórico não devolve o acesso
- [x] **AUTH-07**: Criar um usuário por linha de comando no servidor funciona e imprime uma senha forte uma única vez
- [x] **AUTH-08**: Redefinir a senha de um usuário por linha de comando funciona
- [x] **AUTH-09**: Desativar um usuário (`ativo = false`) tira o acesso dele sem apagar o histórico de autoria
- [x] **AUTH-10**: Nenhuma Server Action toca o banco sem passar por `exigirUsuario()` na primeira linha

### Casca e Design System

- [x] **UI-01**: As cores e fontes são as do AMASSA, não o padrão do Tailwind, em todo componente shadcn instalado
- [ ] **UI-02**: No celular, a barra inferior tem 5 itens (Início, Encomendas, Agenda, Queimas, Estoque), cada um abrindo a sua tela
- [ ] **UI-03**: No desktop, a barra lateral de 240px tem os mesmos itens mais o menu do usuário no rodapé
- [ ] **UI-04**: Orçamentos aparece no menu do usuário, não na navegação principal
- [ ] **UI-05**: A navegação funciona confortavelmente com o polegar, no celular
- [ ] **UI-06**: Nenhuma tela exige rolagem horizontal no celular
- [ ] **UI-07**: Toda tela tem estado vazio com frase de contexto e botão, estado de carregamento com esqueleto, e estado de erro em linguagem humana
- [ ] **UI-08**: Toda remoção pede confirmação nomeando o que será perdido
- [x] **UI-09**: Alvos de toque têm no mínimo 44px, contraste passa em AA, formulários navegam por teclado e botões só com ícone têm `aria-label`
- [ ] **UI-10**: Nenhum erro aparece no console do navegador em uso normal
- [ ] **UI-11**: O sistema carrega em menos de 3 segundos em 4G

### Encomendas

- [ ] **ENC-01**: Criar uma encomenda com nome, cliente, data de início e as 6 etapas mostra as datas calculadas em cascata
- [ ] **ENC-02**: Mudar a duração de uma etapa desloca todas as etapas seguintes
- [ ] **ENC-03**: Os três marcos (queima 1, queima 2, entrega) aparecem como losango e são um interruptor, nunca um campo numérico
- [ ] **ENC-04**: Desligar a etapa "Entrega" faz o losango sumir e encurta a encomenda
- [ ] **ENC-05**: Uma encomenda guarda e mostra vários itens com descrição e quantidade (ex.: 40 canecas e 12 bowls)
- [ ] **ENC-06**: No desktop, o Gantt usa 18px/dia, cabeçalho em quinzenas, coluna fixa e linha de "Hoje" na posição certa
- [ ] **ENC-07**: A timeline abre já rolada até deixar o "Hoje" mais ou menos centralizado
- [ ] **ENC-08**: No celular, dá para ler o andamento de todas as encomendas como lista vertical, sem rolagem horizontal
- [ ] **ENC-09**: O sistema mostra em qual etapa cada encomenda está hoje e quantos dias faltam para a próxima
- [ ] **ENC-10**: Encomendas podem ser filtradas por status, ordenadas e buscadas por nome ou cliente
- [ ] **ENC-11**: O rodapé do formulário mostra duração total e data de conclusão, atualizando conforme se digita
- [ ] **ENC-12**: Uma encomenda criada num dispositivo aparece no outro ao recarregar a página
- [ ] **ENC-13**: O estado vazio mostra "A roda ainda não gira"

### Contador de Queima

- [ ] **FOR-01**: Registrar uma queima leva **dois toques** e menos de 5 segundos no celular
- [ ] **FOR-02**: O aviso com "Desfazer", por 7 segundos, remove a queima registrada por engano
- [ ] **FOR-03**: Os três tipos aparecem: biscoito, esmalte e **ouro**
- [ ] **FOR-04**: Chegando a 90 de 100 o cartão fica em atenção e mostra "Manutenção próxima"; em 100 fica em crítico e mostra "Manutenção vencida"
- [ ] **FOR-05**: O medidor do cartão tem entalhes a cada 10 queimas, marca no limiar de atenção e rótulos `0 / atenção N / limite N`
- [ ] **FOR-06**: O banner no topo lista os fornos que precisam de atenção, com o contador de cada um
- [ ] **FOR-07**: Registrar manutenção mostra "o contador vai de N para 0", aceita responsável e observações opcionais, e zera o contador **sem apagar** o histórico
- [ ] **FOR-08**: O cartão mostra quantas queimas o forno já fez na vida, além do contador desde a última manutenção
- [ ] **FOR-09**: O detalhe do forno mostra o histórico de manutenções e as últimas 25 queimas
- [ ] **FOR-10**: Remover uma queima lançada por engano no histórico pede confirmação
- [ ] **FOR-11**: Fornos podem ser cadastrados e desativados, mas nunca excluídos
- [ ] **FOR-12**: Os gráficos batem com a contagem manual do histórico, alternam entre 8 semanas e 6 meses, e a semana começa na segunda
- [ ] **FOR-13**: Cada queima registra quem a lançou (usuário logado), sem pedir nada a mais no fluxo

### Agenda de Aulas

- [ ] **AGD-01**: A grade semanal reproduz o protótipo: turnos nas linhas, dias nas colunas, cores por modalidade
- [ ] **AGD-02**: O indicador de assentos tem três níveis — aberta, completa e excedida
- [ ] **AGD-03**: Turma com mais alunas do que vagas aparece em vermelho e **continua permitida**
- [ ] **AGD-04**: As quatro estatísticas do topo mostram aulas, pessoas únicas, experimentais e vagas livres
- [ ] **AGD-05**: Passar uma aluna de experimental para matriculada funciona e some o aviso
- [ ] **AGD-06**: Adicionar alguém que já está em outra turma no mesmo dia e turno mostra um aviso
- [ ] **AGD-07**: Avançar para uma semana futura cria as aulas sozinho, sem duplicar ao recarregar
- [ ] **AGD-08**: Marcar presença da turma inteira leva menos de 30 segundos no celular, com toque único por aluna
- [ ] **AGD-09**: Os quatro estados de presença funcionam: presente, falta, falta justificada e reposição
- [ ] **AGD-10**: Uma aluna de outra turma pode ser adicionada a uma aula como reposição
- [ ] **AGD-11**: Encerrar a matrícula de uma aluna a remove das aulas seguintes, mas não das passadas
- [ ] **AGD-12**: Cancelar uma aula por feriado mantém o registro e o motivo
- [ ] **AGD-13**: O histórico de uma aluna mostra todas as presenças e faltas dela
- [ ] **AGD-14**: Alunas podem ser cadastradas e buscadas, com aviso de possível duplicata por nome normalizado
- [ ] **AGD-15**: No celular, a agenda mostra um dia por vez com navegação lateral
- [ ] **AGD-16**: Domingo pode ser incluído ou não na grade, por configuração

### Estoque

- [ ] **EST-01**: Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
- [ ] **EST-02**: Materiais são organizados em cerâmica, pintura e bordado, com unidade, estoque mínimo, custo, fornecedor e observações
- [ ] **EST-03**: Material abaixo do mínimo aparece destacado na lista e no painel inicial
- [ ] **EST-04**: Material com estoque mínimo zero nunca entra em alerta
- [ ] **EST-05**: O histórico mostra toda movimentação com autor, data e tipo
- [ ] **EST-06**: Não existe nenhuma forma de editar ou apagar uma movimentação pela interface — só registrar um ajuste
- [ ] **EST-07**: No tipo `ajuste`, a tela pede o saldo contado na prateleira, não a diferença
- [ ] **EST-08**: Um ajuste que dá diferença zero não grava nada e responde "Conferido. O saldo já estava correto."
- [ ] **EST-09**: Registrar uma baixa no celular leva menos de 15 segundos
- [ ] **EST-10**: O saldo mostrado bate com a soma manual do histórico
- [ ] **EST-11**: Uma movimentação pode referenciar opcionalmente uma aula, fornada ou encomenda de origem
- [ ] **EST-12**: A lista de saldos tem busca e filtro por categoria

### Painel Inicial e Entrega

- [ ] **PNL-01**: O painel inicial responde "o que preciso fazer hoje?" sem nenhum clique
- [ ] **PNL-02**: O painel mostra encomendas por etapa
- [ ] **PNL-03**: O painel mostra as aulas de hoje
- [ ] **PNL-04**: O painel mostra os fornos em atenção ou crítico
- [ ] **PNL-05**: O painel mostra os alertas de estoque baixo
- [ ] **PNL-06**: Existe um manual de uso curto, com imagens, que uma pessoa nova consegue seguir sozinha
- [ ] **PNL-07**: Existe um documento de operação cobrindo criar usuário, redefinir senha, restaurar backup e o que fazer se o site cair, deixando explícito qual backup usar em cada caso

## v2 Requirements

Reconhecidos e adiados. Não estão no roadmap atual.

### Calculadora de Orçamento 🔴 BLOQUEADO

- **ORC-01**: Calcular o preço de uma encomenda a partir das variáveis de entrada do ateliê
- **ORC-02**: Somar os custos de argila, esmalte, energia da fornada, mão de obra, embalagem e frete
- **ORC-03**: Aplicar margem conforme a regra das planilhas de precificação
- **ORC-04**: Escalonar desconto por volume
- **ORC-05**: Produzir a saída final (número, faixa ou documento de proposta)

> **Bloqueio de informação, não de planejamento.** Nenhum planejamento contorna a ausência das
> planilhas de precificação. O schema em `02-MODELO-DE-DADOS.md` reserva os nomes das tabelas
> (`parametros_precificacao`, `orcamentos`, `orcamento_itens`) sem defini-las.

### Financeiro da Escola

- **FIN-01**: Mensalidades, planos (mensal/trimestral/anual), taxa de matrícula e taxa de massa
- **FIN-02**: Controle de pagamento por aluna

> As regras estão bem documentadas e é um módulo natural e provavelmente valioso — mas foi
> conscientemente adiado. O schema de `alunas` e `matriculas` já suporta anexá-lo depois.

### Integrações entre módulos

- **INT-01**: Ligar uma encomenda a uma queima concreta do módulo de fornos
- **INT-02**: Módulo de Experiências (oficinas pontuais, 4 a 8 pessoas, em datas específicas)

> A INT-01 é possível e provavelmente desejável, mas fica fora da v1 para não acoplar dois módulos
> antes de os dois estarem em uso real.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Site institucional e loja Shopify | Continuam existindo separadamente. Nunca entram na plataforma. |
| Estoque de peças acabadas | Vive no Shopify. Só matéria-prima entra aqui. |
| Portal para as alunas | O sistema é só para gestores (3 a 5 pessoas, todas com acesso total). |
| Cadastro público de usuários | Contas são criadas por linha de comando no servidor. |
| "Esqueci minha senha" por e-mail | Exigiria SMTP, configuração de domínio e mais uma conta para manter. Com 3 a 5 pessoas que se conhecem, um comando resolve em 10 segundos. |
| Ficha de cadastro de cliente nas encomendas | Cliente permanece texto livre. `cliente_nome` vira `cliente_id` no futuro sem migração destrutiva. |
| Valores, sinal e controle de pagamento nas encomendas | Avaliado e recusado nesta versão. |
| Fotos e anexos nas encomendas | Avaliado e recusado nesta versão. |
| RLS no Postgres | O banco não tem porta publicada; só a aplicação o alcança. RLS protegia contra uma API pública que deixou de existir. `exigirUsuario()` ocupa o lugar e é verificável em revisão. |
| Tema claro/escuro | Não na v1. |
| Biblioteca de Gantt pronta | O protótipo já resolve com CSS puro (18px/dia, posicionamento absoluto). Portar é mais barato e mais fiel do que dobrar uma biblioteca. |
| pgAdmin, Adminer ou similar exposto na web | É uma porta a mais para o banco sem ganho. `docker compose exec postgres psql` faz o mesmo, só de dentro do servidor. |
| Redux, Zustand ou outro gerenciador de estado global | TanStack Query só onde há interação otimista; o resto usa Server Components. |
| Sentry, APM, analytics | Todos custam ou viram ruído. Monitoramento que ninguém lê é só custo. |
| Atualização em tempo real entre dispositivos | Para 5 pessoas, sincronização ao vivo é complexidade sem benefício. Recarregar a página basta — e isso é deliberado. |
| `cron`, `pg_cron` ou worker em background na aplicação | As aulas usam materialização preguiçosa. O único agendamento do sistema é o `cron` do host, para o backup. |
| Conversão de unidades no estoque | Cada material vive na unidade em que foi cadastrado. Conversão é fonte clássica de erro silencioso de fator mil. |
| Ponto de venda, custo médio ponderado, relatórios de margem | Fora do escopo do módulo de estoque. |
| Bloqueio de turma com excesso de alunas | Na prática do ateliê, encaixar alguém acontece. É estado visual, não erro. |
| Exclusão de fornos | Destruiria o histórico de vida útil do equipamento, que é justamente o propósito do módulo. Fornos são desativados. |
| Exclusão de usuários | Quebraria o histórico de quem registrou cada queima e cada movimentação. Usuários são desativados. |
| Migração automática pelo pipeline | Uma migração ruim aplicada por um `git push` acidental não tem desfazer, e o banco agora é nosso. |
| Build do Next.js no servidor | Consome bastante RAM. Se estourar a memória do VPS durante um deploy, o site cai — e cai junto com o banco, que mora na mesma máquina. |

## Traceability

Preenchida durante a criação do roadmap (ver `.planning/ROADMAP.md`).

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-02 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-03 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-04 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-05 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-06 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-07 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-08 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-09 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-10 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| AUTH-01 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-02 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-03 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-04 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-05 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-06 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-07 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-08 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-09 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-10 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-01 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-02 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-03 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-04 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-05 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-06 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-07 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-01 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-02 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-03 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-04 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-05 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-06 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-07 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-08 | Phase 2 — Login, Banco Base e Casca da Aplicação | Pending |
| UI-09 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| ENC-01 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-02 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-03 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-04 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-05 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-06 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-07 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-08 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-09 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-10 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-11 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-12 | Phase 3 — Gestor de Encomendas | Pending |
| ENC-13 | Phase 3 — Gestor de Encomendas | Pending |
| FOR-01 | Phase 4 — Contador de Queima | Pending |
| FOR-02 | Phase 4 — Contador de Queima | Pending |
| FOR-03 | Phase 4 — Contador de Queima | Pending |
| FOR-04 | Phase 4 — Contador de Queima | Pending |
| FOR-05 | Phase 4 — Contador de Queima | Pending |
| FOR-06 | Phase 4 — Contador de Queima | Pending |
| FOR-07 | Phase 4 — Contador de Queima | Pending |
| FOR-08 | Phase 4 — Contador de Queima | Pending |
| FOR-09 | Phase 4 — Contador de Queima | Pending |
| FOR-10 | Phase 4 — Contador de Queima | Pending |
| FOR-11 | Phase 4 — Contador de Queima | Pending |
| FOR-12 | Phase 4 — Contador de Queima | Pending |
| FOR-13 | Phase 4 — Contador de Queima | Pending |
| AGD-01 | Phase 5 — Agenda de Aulas | Pending |
| AGD-02 | Phase 5 — Agenda de Aulas | Pending |
| AGD-03 | Phase 5 — Agenda de Aulas | Pending |
| AGD-04 | Phase 5 — Agenda de Aulas | Pending |
| AGD-05 | Phase 5 — Agenda de Aulas | Pending |
| AGD-06 | Phase 5 — Agenda de Aulas | Pending |
| AGD-07 | Phase 5 — Agenda de Aulas | Pending |
| AGD-08 | Phase 5 — Agenda de Aulas | Pending |
| AGD-09 | Phase 5 — Agenda de Aulas | Pending |
| AGD-10 | Phase 5 — Agenda de Aulas | Pending |
| AGD-11 | Phase 5 — Agenda de Aulas | Pending |
| AGD-12 | Phase 5 — Agenda de Aulas | Pending |
| AGD-13 | Phase 5 — Agenda de Aulas | Pending |
| AGD-14 | Phase 5 — Agenda de Aulas | Pending |
| AGD-15 | Phase 5 — Agenda de Aulas | Pending |
| AGD-16 | Phase 5 — Agenda de Aulas | Pending |
| EST-01 | Phase 6 — Estoque | Pending |
| EST-02 | Phase 6 — Estoque | Pending |
| EST-03 | Phase 6 — Estoque | Pending |
| EST-04 | Phase 6 — Estoque | Pending |
| EST-05 | Phase 6 — Estoque | Pending |
| EST-06 | Phase 6 — Estoque | Pending |
| EST-07 | Phase 6 — Estoque | Pending |
| EST-08 | Phase 6 — Estoque | Pending |
| EST-09 | Phase 6 — Estoque | Pending |
| EST-10 | Phase 6 — Estoque | Pending |
| EST-11 | Phase 6 — Estoque | Pending |
| EST-12 | Phase 6 — Estoque | Pending |
| UI-10 | Phase 7 — Polimento e Entrega | Pending |
| UI-11 | Phase 7 — Polimento e Entrega | Pending |
| PNL-01 | Phase 7 — Polimento e Entrega | Pending |
| PNL-02 | Phase 7 — Polimento e Entrega | Pending |
| PNL-03 | Phase 7 — Polimento e Entrega | Pending |
| PNL-04 | Phase 7 — Polimento e Entrega | Pending |
| PNL-05 | Phase 7 — Polimento e Entrega | Pending |
| PNL-06 | Phase 7 — Polimento e Entrega | Pending |
| PNL-07 | Phase 7 — Polimento e Entrega | Pending |

**Coverage:**

- v1 requirements: 99 total
- Mapped to phases: 99/99
- Unmapped: 0

**Distribuição por fase:**

| Phase | Milestone fonte | Requisitos | Contagem |
|-------|------------------|------------|----------|
| Phase 1 | M0 | INFRA-01..10 | 10 |
| Phase 2 | M1 | AUTH-01..10, BKP-01..07, UI-01..09 | 26 |
| Phase 3 | M2 | ENC-01..13 | 13 |
| Phase 4 | M4 | FOR-01..13 | 13 |
| Phase 5 | M3 | AGD-01..16 | 16 |
| Phase 6 | M5 | EST-01..12 | 12 |
| Phase 7 | M7 | UI-10..11, PNL-01..07 | 9 |
| — | M6 (bloqueada, fora do roadmap) | ORC-01..05 (v2) | 0 |

---
*Requirements defined: 2026-08-05*
*Last updated: 2026-08-05 after roadmap creation — traceability filled, 99/99 requirements mapped*
