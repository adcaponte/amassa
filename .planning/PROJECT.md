# AMASSA — Plataforma de Gestão do Ateliê

> **Documentos fonte:** `amassa-plataforma/00-BRIEFING.md` (escopo e regras de negócio),
> `01-ARQUITETURA.md` (stack e infraestrutura), `02-MODELO-DE-DADOS.md` (schema),
> `03-ROADMAP.md` (milestones e critérios de aceite), `04-DESIGN-SYSTEM.md` (tokens e UX).
> Todo executor deve lê-los antes de planejar a fase correspondente.

## What This Is

Plataforma web interna, privada e responsiva, para os 3 a 5 gestores do **AMASSA** — ateliê de
cerâmica artesanal de alta temperatura em Goiânia — administrarem a operação do dia a dia em um
único lugar, substituindo planilhas e controles espalhados. Cinco módulos: Encomendas, Agenda de
Aulas, Contador de Queima, Estoque e Calculadora de Orçamento.

Não é um site institucional nem uma loja. O site público (amassaceramica.com.br) e a loja Shopify
continuam existindo separadamente e estão **fora do escopo**.

## Core Value

**Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a
mão suja, num celular** — se registrar uma queima em dois toques, marcar presença de uma turma ou
dar baixa em material não for confortável no celular, o sistema não é usado e nada mais importa.

## Business Context

- **Customer**: uso interno — 3 a 5 gestores do AMASSA, todos com acesso total. Sem cadastro público.
- **Revenue model**: não monetizado. É ferramenta de operação, não produto.
- **Success metric**: os módulos passam a ser usados com **dados reais do ateliê**, e as planilhas
  paralelas deixam de ser abertas.
- **Strategy notes**: `amassa-plataforma/00-BRIEFING.md`

## Requirements

### Validated

(Nenhum ainda — só depois de estar no ar e em uso real)

### Active

**Fundação e operação**

- [ ] Aplicação no ar em `https://` próprio, com deploy automático a partir de `git push` na `main`
- [ ] Postgres próprio no VPS Contabo, sem porta publicada, acessível só pela aplicação
- [ ] Backup diário do banco com envio para armazenamento externo gratuito, verificado por endpoint
- [ ] Login por e-mail e senha (argon2id), sessão de 30 dias, sem tela de cadastro
- [ ] Contas criadas e senhas redefinidas por linha de comando no servidor
- [ ] Casca da aplicação com identidade visual do AMASSA: barra lateral no desktop, barra inferior no celular

**Módulo 1 — Gestor de Encomendas**

- [ ] Encomenda com nome, cliente (texto livre), data de início e lista de itens (descrição + quantidade)
- [ ] Seis etapas com datas calculadas em cascata a partir de uma única data de início
- [ ] Gantt no desktop (18 px/dia, quinzenas, linha de "Hoje") e lista vertical no celular
- [ ] Status explícito (rascunho · em produção · concluída · cancelada) e etapa atual derivada de hoje

**Módulo 3 — Contador de Queima**

- [ ] Controle de vida útil das resistências: contador de queimas desde a última manutenção, por forno
- [ ] Registro de queima em **dois toques**, com "Desfazer" por 7 segundos
- [ ] Três tipos de queima: biscoito, esmalte e **ouro**
- [ ] Manutenção zera o contador sem apagar o histórico
- [ ] Relatórios com Recharts (8 semanas / 6 meses, por forno, por tipo)

**Módulo 2 — Agenda de Aulas**

- [ ] Grade semanal de turmas recorrentes com modalidade, horário, vagas e alunas
- [ ] Aulas com data concreta geradas por **materialização preguiçosa** ao abrir a semana
- [ ] Presença por aluna: presente · falta · falta justificada · reposição
- [ ] Cancelamento de aula com motivo e histórico de presenças por aluna

**Módulo 4 — Estoque**

- [ ] Materiais em três categorias (cerâmica, pintura, bordado) com unidade e estoque mínimo
- [ ] Saldo **sempre derivado** das movimentações, nunca uma coluna editável
- [ ] Movimentações imutáveis (entrada, saída-consumo, saída-venda, ajuste, perda)
- [ ] Alerta de estoque abaixo do mínimo no painel inicial

**Polimento**

- [ ] Painel inicial que responde "o que preciso fazer hoje?" sem nenhum clique
- [ ] **Restauração real de um backup**, cronometrada e documentada em português
- [ ] Manual de uso e documento de operação

### Out of Scope

- **Calculadora de Orçamento (Módulo 5)** — 🔴 bloqueada até as planilhas de precificação existirem.
  O schema reserva os nomes das tabelas sem defini-las.
- **Site institucional e loja Shopify** — continuam separados, nunca entram aqui.
- **Estoque de peças acabadas** — vive no Shopify. Só matéria-prima entra.
- **Mensalidades, planos e pagamentos da escola** — regras existem e são conhecidas, mas foram
  conscientemente adiadas. O schema de `alunas`/`matriculas` aceita anexá-las depois.
- **Portal para alunas** — o sistema é só para gestores.
- **Ficha de cadastro de cliente, valores, sinal e fotos nas encomendas** — avaliados e recusados
  nesta versão. `cliente_nome` vira `cliente_id` no futuro sem migração destrutiva.
- **"Esqueci minha senha" por e-mail** — exigiria SMTP, domínio e mais uma conta. Com 3 a 5 pessoas
  que se conhecem, um comando no servidor resolve em 10 segundos.
- **RLS no Postgres** — o banco não é exposto; a autorização vive em `exigirUsuario()`.
- **Tema claro/escuro** — não na v1.
- **Biblioteca de Gantt pronta** — o protótipo resolve com CSS puro; portar é mais fiel e barato.
- **Sentry, APM, analytics** — custam ou viram ruído.
- **Atualização em tempo real entre dispositivos** — para 5 pessoas, sincronização ao vivo é
  complexidade sem benefício. Recarregar a página basta.
- **Experiências (oficinas pontuais)** — possível módulo futuro, fora da v1.

## Context

**Origem das especificações.** Três dos cinco módulos já existem como protótipo funcional e devem
ser **lidos antes de planejar a fase correspondente**: `gestor-ceramica.html` (Encomendas),
`agenda-amassa.jsx` (Agenda) e `forno-controle.jsx` (Fornos). O que os protótipos já fazem está
listado item a item nos documentos 00 e 02 e deve ser **preservado literalmente** — cada detalhe é
uma decisão de produto já tomada.

**Vocabulário da cerâmica.** O ciclo de uma peça é a espinha dorsal do módulo de Encomendas:
argila plástica → modelagem → ponto de couro → acabamento → seco/verde → **queima 1** (biscoito,
800–1000 °C) → esmaltação → **queima 2** (alta temperatura, 1200–1300 °C) → peça pronta.
Termos como *biscoito*, *esmalte*, *fornada*, *cone pirométrico*, *retração*, *barbotina*,
*chamote*, *atmosfera oxidante/redutora* aparecem na interface e **nunca são traduzidos nem
simplificados** — é o vocabulário de quem vai usar o sistema.

**Quatro frentes do negócio.** Escola (aulas semanais, turmas de até 8 alunas, modalidades
modelagem/torno/pintura), Encomendas (produção sob medida, B2B), Experiências (oficinas pontuais,
fora do escopo) e Loja (Shopify + venda física, fora do escopo).

**Onde é usado.** Celular no ateliê é a prioridade real, não "responsivo por educação". Marcar
presença, dar baixa em estoque, registrar queima e consultar encomenda acontecem **em pé, numa tela
de 6 polegadas**. Gantt e grade semanal ganham versões mobile alternativas — não versões espremidas.
Alvos: iOS Safari e Android Chrome atuais; desktop Chrome, Safari, Firefox.

**Armadilhas conhecidas, todas documentadas no arquivo 01.** As três mais caras têm o mesmo modo de
falha — funcionam em `localhost` e quebram em produção:

1. A imagem `standalone` do Next.js não roda migração nem cria usuário → exige um estágio
   `ferramentas` no mesmo Dockerfile.
2. Auth.js exige configuração **dividida em dois arquivos** (`auth.config.ts` sem argon2 para o
   Edge, `auth.ts` com o `authorize`), mais `AUTH_TRUST_HOST=true` atrás do Caddy.
3. Variáveis `NEXT_PUBLIC_*` são embutidas no `next build` → precisam ir como **build-args** no
   GitHub Actions.

Uma quarta não quebra nada e por isso ninguém percebe: `.gitignore` correto **antes do primeiro
commit**, porque o repositório é público.

**Armadilhas de banco.** O container do Postgres roda em UTC e `current_date` devolve o dia errado à
noite → usar sempre `hoje_brasilia()`. `unaccent()` não é imutável → precisa da função intermediária
`nome_normalizado()` senão o `create index` falha. `generate_series` sobre `date` precisa ser feito
somando inteiros, não com `interval`, senão `extract(dow ...)` passa a depender do fuso da sessão.

**Pendências que não bloqueiam.** Fonte de títulos (usar **Archivo Narrow** até o Theo confirmar a
licença web da Vinila Condensed — trocar depois são duas linhas). Lista real de materiais do ateliê
(levantar durante a fase de Estoque, senão o módulo nasce vazio).

**Pendência que bloqueia.** As planilhas de precificação. Enquanto não existirem, a Calculadora de
Orçamento não é planejada. Nada mais depende dela — o polimento final **não espera por ela**.

## Constraints

- **Custo**: custo recorrente adicional **próximo de zero**. Tudo roda no VPS Contabo já contratado.
  A única despesa nova é o Auto Backup da Contabo (~€2/mês). Nenhuma outra assinatura, nenhum
  "gratuito até certo volume" que um dia vira cobrança. Isso eliminou o Supabase — o plano gratuito
  não faz backup nenhum, e o que faz custa US$ 25/mês.
- **Idioma**: **português do Brasil** em toda a interface, mensagens de erro e nomes de tabela e
  coluna. Código (variáveis, funções, tipos) em inglês, seguindo a convenção da linguagem.
- **Tech stack**: Next.js 15+ (App Router, TypeScript estrito), React 19, Tailwind CSS v4,
  shadcn/ui, Recharts, PostgreSQL em Docker, Drizzle ORM, Auth.js v5 (Credentials + argon2id),
  Server Actions + Zod, TanStack Query só onde há interação otimista, date-fns, react-hook-form,
  lucide-react, Vitest, Playwright. Caddy como proxy reverso com HTTPS automático.
- **Segurança**: repositório **público**. Nenhum segredo em nenhum commit, nunca. Nenhum dado real
  de aluna ou cliente em nenhum arquivo. Secret scanning e push protection habilitados.
- **Autorização**: **toda Server Action começa por `exigirUsuario()`** na primeira linha. É a única
  porta do sistema — não há RLS por trás para salvar um esquecimento. Verificável em revisão.
- **Validação**: toda entrada do usuário validada com **Zod no servidor**. Validação no cliente é
  conveniência, não segurança.
- **Regras de negócio**: ficam em **módulos puros e testados** (`lib/encomendas/cronograma.ts`,
  `lib/agenda/semana.ts`, `lib/queimas/contador.ts`, `lib/estoque/saldo.ts`), nunca dentro de
  componente React. Não importam React nem o cliente do banco.
- **Fuso**: `America/Sao_Paulo` fixo. `TZ` **só no serviço app**, nunca no Postgres. Datas civis são
  `date`, momentos no tempo são `timestamptz`.
- **Acessibilidade**: alvos de toque de no mínimo 44 px, contraste AA, navegação por teclado nos
  formulários, `aria-label` em botões só com ícone. Campo de formulário nunca menor que 16px (senão
  o iOS dá zoom sozinho ao focar).
- **Estados**: estados vazios, de carregamento e de erro em **toda** tela. Tela em branco enquanto
  carrega é defeito, não detalhe.
- **Mensagens**: erro em linguagem humana, dizendo o que fazer. "Erro 500" não é mensagem.
- **Exclusão**: nada de exclusão silenciosa. Toda remoção pede confirmação e diz o que será perdido.
- **Migrações**: aplicadas **à mão**, depois de um backup, por alguém que está olhando. Nunca pelo
  pipeline automático.
- **Perda de dados aceita**: até **24 horas** entre o último dump e uma falha. Avaliado e aceito
  conscientemente. Correção barata se um dia incomodar: dump de hora em hora, custo zero.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Postgres próprio no VPS, sem Supabase | O plano gratuito do Supabase não faz backup nenhum; o que faz custa US$ 25/mês. Construir a operação do ateliê sobre um banco sem backup seria irresponsável. | — Pendente |
| Backup é fase da M1, não do polimento final | Sem serviço gerenciado, o backup é a única rede de proteção que existe. É a única coisa no plano que, se faltar, custa o negócio inteiro. | — Pendente |
| Repositório público | Actions sem limite de minutos e proteção de branch gratuita, mantendo custo zero. Exige higiene absoluta de segredos. | — Pendente |
| Sem RLS | O Postgres não tem porta publicada; só a aplicação o alcança. RLS protegia contra uma API pública que deixou de existir. `exigirUsuario()` ocupa o lugar. | — Pendente |
| Dois papéis de banco (`amassa_owner` / `amassa_app`) | É o que faz o `revoke update, delete on movimentacoes_estoque` valer alguma coisa — dono retém privilégio implícito e pode se reconceder. | — Pendente |
| Drizzle ORM (revertendo o plano 1.0, que dizia "sem ORM") | Sem Supabase, tipos e migrações ficariam órfãos. SQL cru com tipos mantidos à mão degrada em silêncio. | — Pendente |
| Saldo de estoque derivado, nunca armazenado | Saldo armazenado e saldo real divergem — é questão de tempo, e quando divergem ninguém sabe qual está certo. No volume de um ateliê, o custo de performance é zero. | — Pendente |
| Datas de etapa calculadas, nunca armazenadas | Armazenadas, se desincronizam de `dias` na primeira edição, e passam a existir duas versões da verdade. | — Pendente |
| Aulas por materialização preguiçosa | Elimina `cron`, `pg_cron` e worker em background. Menos coisa para quebrar às 3 da manhã, e trivialmente testável. | — Pendente |
| Movimentações de estoque imutáveis | Mesmo princípio de um livro-caixa: rasurar destrói a auditabilidade. Errou? Registra um `ajuste`. | — Pendente |
| Ajuste de estoque pede o **saldo contado**, não a diferença | Ninguém que acabou de contar 3,2 kg sabe de cabeça que a diferença é −0,8. Erro de sinal aqui é invisível. | — Pendente |
| Fornos e usuários são desativados, nunca apagados | Apagar destrói o histórico de vida útil do equipamento e a autoria de cada registro. | — Pendente |
| Três tipos de queima, incluindo **ouro** | Correção sobre a versão anterior do plano, que só previa dois. A douração é uma terceira passagem pelo forno. | — Pendente |
| Caddy no lugar de Nginx | Obtém e renova o certificado sozinho — sem certbot, sem cron esquecido que derruba o site. | — Pendente |
| Build no GitHub Actions, nunca no servidor | Um `next build` consome bastante RAM. Se estourar a memória do VPS durante um deploy, o site cai — e cai junto com o banco, que agora mora na mesma máquina. | — Pendente |
| Excesso de alunas sobre as vagas é permitido | Na prática do ateliê, encaixar alguém acontece. É estado visual ("excedida", em vermelho), não erro. | — Pendente |
| Coluna `papel` na tabela `usuarios` mesmo com um único papel hoje | Adicionar "professora" ou "aluna" no futuro vira mudança de autorização, não reescrita. Custa quase nada agora. | — Pendente |
| Ordem de execução M0→M1→M2→**M4**→M3→M5→M7 | O módulo de fornos é o menor, não depende de nada além do login e entrega o fluxo mais usado do sistema. A Agenda é a mais complexa e ganha em ser enfrentada depois de o sistema já estar em uso. | — Pendente |
| Archivo Narrow + Inter até o Theo decidir | A Vinila Condensed do mídia kit é licenciada e não dá para assumir uso na web sem verificar. Trocar depois são duas linhas. | — Pendente |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-05 after initialization*
