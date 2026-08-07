# Phase 2: Login, Banco Base e Casca da Aplicação - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Entrega **a porta de entrada do sistema e a rede de proteção dos dados**: primeira migração real
(funções de base, papel `amassa_app`, tabela `usuarios`), autenticação com Auth.js v5 e argon2id,
`exigirUsuario()` como única porta de autorização, os scripts de linha de comando que criam e
redefinem contas, a tela de login, e o **backup automático do banco** com envio para armazenamento
externo.

Corresponde à **M1** de `amassa-plataforma/03-ROADMAP.md`.

> **ESTA FASE FOI DIVIDIDA — ver `<decisions>` D-01.** O que está descrito acima é a **Fase 2a**.
> O design system, a casca de navegação e o painel inicial passam para a **Fase 2b**.

**Fora da 2a:** tokens de cor, mapeamento `@theme inline`, instalação de componentes shadcn, barra
lateral, barra inferior, painel inicial. Tudo isso é 2b.

**Fora do milestone inteiro:** qualquer módulo de produto (encomendas, agenda, queimas, estoque).

</domain>

<decisions>
## Implementation Decisions

### Estrutura da fase

- **D-01: A Fase 2 é dividida em 2a e 2b.** São 28 requisitos e três assuntos distintos numa fase
  só — quase o triplo da Fase 1. O corte:
  - **2a — Login, banco base e backup:** `AUTH-01` a `AUTH-10`, `BKP-01` a `BKP-07`.
    Migração base, `usuarios`, Auth.js, `exigirUsuario()`, scripts de CLI, tela de login, e o
    backup automático.
  - **2b — Design system e casca:** `UI-01` a `UI-11`. Tokens, mapeamento shadcn, navegação,
    painel inicial com espaços reservados, e as regras transversais de estado vazio, confirmação
    de exclusão e acessibilidade.
  — **Reversibility:** costly — desfazer exige reescrever o ROADMAP e remapear a rastreabilidade
  dos requisitos. Mas dividir agora é mais barato do que descobrir na metade que a fase não fecha.
- **D-02: Dentro da 2a, o backup vem DEPOIS do login**, mantendo a ordem da M1 original
  (`03-ROADMAP.md` lista o backup como fase 8 de 9). O dono avaliou antecipá-lo e preferiu manter.
  — **Reversibility:** reversible — é ordenação de planos.
- **D-03: A tela de login da 2a usa estilo mínimo, sem o design system.** Os tokens e o mapeamento
  `@theme inline` são da 2b, e `04-DESIGN-SYSTEM.md` §2 é explícito que o mapeamento precisa vir
  **antes** de qualquer componente shadcn ser instalado. A 2a portanto **não instala nenhum
  componente shadcn** — a tela de login usa HTML e classes utilitárias, como a página da Fase 1.
  A 2b reestiliza. — **Reversibility:** reversible — a tela é pequena e será revisitada de qualquer
  forma na 2b.

### Tipografia — a decisão que estava pendente desde o início

- **D-04: A Vinila é usada APENAS no logo, como SVG desenhado — nunca como fonte carregada.**
  O dono confirmou que **não tem licença de webfont**, só a fonte para desktop. Servir uma fonte
  licenciada como webfont num repositório **público** seria redistribuição, que a maioria das
  licenças proíbe explicitamente.
- **D-05: Títulos em Archivo Narrow, corpo em Inter** (opção A de `04-DESIGN-SYSTEM.md` §4).
  Ambas do Google Fonts, gratuitas, sem risco jurídico. Archivo Narrow é condensada e se aproxima
  da Vinila.
  — **Reversibility:** reversible — se a licença web for confirmada um dia, trocar são duas linhas,
  e o logo em SVG continua valendo por ser mais nítido e mais leve que texto renderizado.
- **D-06: Nenhum arquivo de fonte licenciada entra no repositório ou é servido pelo VPS.**
  Vale como regra permanente do projeto, não só desta fase.

### Contas de gestor

- **D-07: A 2a cria a conta do dono mais 2 a 4 gestoras.** Os nomes e e-mails são informados
  **na hora de rodar o script, no servidor** — nunca no repositório, nunca no chat. É a mesma
  regra que valeu para as senhas na Fase 1.
- **D-08: Os scripts imprimem a senha gerada uma única vez, no terminal.** Sem envio por e-mail,
  sem recuperação — perder significa rodar `redefinir-senha`, não recuperar. Já decidido em
  `01-ARQUITETURA.md` §4; registrado aqui porque a 2a é quem implementa.

### Backup

- **D-09: Conta de Google Drive SEPARADA, dedicada ao ateliê** — não a conta pessoal do dono.
  Se um dia outra pessoa precisar restaurar o banco, ela precisa desse acesso, e entregar a conta
  pessoal junto não é opção. Também isola o backup de qualquer coisa que aconteça com a conta
  pessoal. **A conta ainda não existe** — é pré-requisito da 2a.
  — **Reversibility:** costly — trocar a conta depois exige reconfigurar o `rclone` no servidor e
  mover ou reenviar o histórico de dumps.
- **D-10: O incidente aberto no Auto Backup da Contabo eleva a urgência desta fase.** No
  encerramento da Fase 1 a Contabo reportava backups atrasados e restores indisponíveis. Hoje o
  ateliê tem **uma camada só de proteção, e degradada**. Reconferir o painel durante a 2a.
- **D-11: Nenhum dado real do ateliê entra no sistema antes de o dump existir E ter sido
  restaurado uma vez.** A restauração de teste é da M7 no plano original, mas a regra de não
  migrar antes vale desde já.

### Decisões já fechadas nos documentos fonte — não reabrir

Listadas para que o pesquisador e o planejador não as tratem como abertas:

- **Auth.js v5**, provedor `Credentials`, sessão **JWT** em cookie `httpOnly` + `secure` +
  `sameSite=lax`, 30 dias renovados a cada uso. A estratégia JWT não é escolha: com `Credentials`
  o Auth.js **não** oferece sessão em banco. Fixar a versão exata no `package.json`.
- **A configuração dividida em dois arquivos é obrigatória.** `auth.config.ts` sem `authorize`,
  sem argon2 e sem banco — é o que o `middleware.ts` importa, porque ele roda no runtime Edge e
  `@node-rs/argon2` é módulo nativo que não carrega lá. `auth.ts` importa o anterior e acrescenta
  o `authorize`. **É o erro mais provável desta fase** (`01-ARQUITETURA.md` §4).
- **argon2id** via `@node-rs/argon2`. Hash em `usuarios.senha_hash`. Nunca senha em texto.
- **Sem tela de cadastro e sem "esqueci a senha" por e-mail.** Enviar e-mail exigiria SMTP,
  configuração de domínio e mais uma conta para manter. Com 3 a 5 pessoas que se conhecem, um
  comando resolve em 10 segundos.
- **Limite de tentativas:** 5 erros no mesmo e-mail em 15 minutos bloqueiam por 15 minutos.
  Contador **em memória** basta — é uma instância só.
- **Mesma mensagem de erro** para e-mail inexistente e senha errada, e **comparação de hash sempre
  executada** mesmo com e-mail inexistente, para não vazar quais e-mails existem pelo tempo de
  resposta.
- **`middleware.ts` protege toda rota** fora de `/login` e `/api/health`.
- **Desativar é `ativo = false`**, nunca apagar — apagar quebraria o histórico de autoria.
- **Papel `amassa_app` separado do `amassa_owner`** na primeira migração, com os `grant` da
  seção 0 de `02-MODELO-DE-DADOS.md`. É o que faz o `revoke` da Fase 5 valer alguma coisa.
- **`hoje_brasilia()`, `tocar_atualizado_em()` com trigger em cada tabela**, e a extensão
  `unaccent`. Funções e triggers o Drizzle **não** gera — vão em migração custom
  (`drizzle-kit generate --custom`).
- **Backup disparado pelo `cron` do host**, nunca pelo Compose, que não tem agendador.
  `pg_dump` → `gzip` → `/opt/amassa/backups/`, rotação de 14 dias, retenção mensal no dia 1º,
  envio por `rclone`, resultado gravado em `execucoes_backup`, e `/api/health/backup` que só
  responde `ok` se o último backup tiver menos de 26 horas.
- **Migrações continuam sendo aplicadas à mão**, depois de backup, por alguém que está olhando.

### Claude's Discretion

- Estrutura interna de `lib/auth/` e onde exatamente mora o contador de tentativas.
- Forma do esqueleto de carregamento e das mensagens de erro, desde que em linguagem humana.
- Organização dos scripts em `scripts/` e a biblioteca de parsing de argumentos.
- Como o `backup.sh` reporta para a tabela `execucoes_backup` (o `01-ARQUITETURA.md` §9 descreve
  o quê, não o como).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Autenticação — leitura obrigatória
- `amassa-plataforma/01-ARQUITETURA.md` §4 — Auth.js sem serviço externo, **a caixa de aviso sobre
  a divisão de configuração em dois arquivos**, os scripts de CLI, o serviço `ferramentas`, e as
  proteções mínimas de login.
- `amassa-plataforma/00-BRIEFING.md` §3 — usuários e acesso, e por que não existe recuperação de
  senha por e-mail.

### Banco
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §0 — base comum: `hoje_brasilia()`,
  `nome_normalizado()`, `tocar_atualizado_em()` com trigger por tabela, os **dois papéis de banco**
  e os `grant`, e a tabela `usuarios` com o índice funcional de e-mail.
- `amassa-plataforma/02-MODELO-DE-DADOS.md` §6 — ordem das migrações e o fluxo com Drizzle,
  incluindo o que precisa de `--custom` por o Drizzle não gerar.

### Backup — a parte que não pode falhar
- `amassa-plataforma/01-ARQUITETURA.md` §7 — as quatro camadas, o `cron` do host, a rotação, a
  retenção mensal, o `rclone`, e a declaração explícita de que a perda máxima aceita é de 24 horas.
- `amassa-plataforma/01-ARQUITETURA.md` §9 — `/api/health/backup`, a tabela `execucoes_backup`, e
  por que um backup que para em silêncio é pior que não ter backup.

### Design (só para a 2b — a 2a não toca nisso)
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §2 — tokens e o **mapeamento `@theme inline` obrigatório
  para o shadcn**, que precisa vir antes de qualquer componente instalado.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §4 — a escala tipográfica, e o aviso de que campo de
  formulário abaixo de 16px faz o iOS dar zoom sozinho.
- `amassa-plataforma/04-DESIGN-SYSTEM.md` §5 e §9 — navegação e voz da interface.

### Estado do projeto
- `.planning/ROADMAP.md` §"Phase 2" — os 11 critérios de sucesso.
- `.planning/REQUIREMENTS.md` — AUTH-01 a AUTH-10, BKP-01 a BKP-07 (2a); UI-01 a UI-11 (2b).
- `.planning/phases/01-funda-o-e-primeiro-deploy/01-CONTEXT.md` — decisões da Fase 1 que continuam
  valendo, em especial D-03 (roteiros executados pelo dono) e D-07 (GHCR público).
- `.planning/phases/01-funda-o-e-primeiro-deploy/01-07-SUMMARY.md` — o que a execução real da
  Fase 1 ensinou, incluindo os seis defeitos que só apareceram fora da máquina de desenvolvimento.
- `docs/operacao/01-preparar-servidor.md` e `02-publicar-e-dominio.md` — os roteiros existentes.
  O backup vai acrescentar um terceiro, e ele deve seguir o mesmo formato: cada comando com **o
  que faz** e **o que você deve ver**.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/saude.ts`** — o padrão de módulo puro já está estabelecido: zero imports, recebe dados e
  devolve dados, testado em `tests/unit/`. A lógica de autorização e a de contagem de tentativas
  devem seguir o mesmo formato.
- **`db/index.ts`** — `Pool` do `pg` e instância Drizzle exportada como `db`. A tabela `usuarios`
  entra em `db/schema.ts` ao lado de `verificacao_infraestrutura`.
- **`db/migrate.ts` + `drizzle.config.ts`** — o fluxo de migração já funciona e roda pelo estágio
  `ferramentas`. Ambos chamam `process.loadEnvFile()` (scripts fora do Next não herdam o
  carregamento de ambiente dele).
- **Estágio `ferramentas` no Dockerfile** — já carrega `drizzle-kit`, `tsx` e a pasta `db/`. É por
  ele que `criar-usuario` e `redefinir-senha` vão rodar. `scripts/` já está copiado para lá.
- **`docker/compose.yml`** — o serviço `app` já declara `AUTH_SECRET` e `AUTH_TRUST_HOST`, vindos
  do `.env`. Estão vazios hoje e passam a ser usados nesta fase.
- **`.env.example`** — já declara `AUTH_SECRET`, `AUTH_TRUST_HOST` e `RCLONE_REMOTE`, sem valor.
  Todas as três passam a ser usadas agora.
- **`tests/e2e/fundacao.spec.ts` + `scripts/testar-e2e.mjs`** — a infraestrutura de E2E já existe,
  com projetos desktop e celular, e o portão já foi provado nos dois sentidos.

### Established Patterns
- **Português nas tabelas e colunas, inglês nos identificadores de código.** Já valendo em
  `verificacao_infraestrutura` / `criado_em` / `nota`.
- **Roteiros de servidor comentados**, cada comando com "o que faz" e "o que você deve ver".
  Nove correções vieram da execução real da Fase 1 — o roteiro de backup nasce com esse aprendizado.
- **Segredos gerados no servidor, impressos uma vez, nunca no chat nem no repositório.**
- **Verificação de fora, não pelo relato de quem executou.**

### Integration Points
- `middleware.ts` é criado nesta fase, na raiz — hoje não existe.
- `app/(auth)/login/page.tsx` e o grupo `app/(app)/` da estrutura de `01-ARQUITETURA.md` §3 nascem
  aqui. Hoje só existe `app/page.tsx` na raiz.
- `/api/health` continua livre de autenticação; `/api/health/backup` nasce ao lado.
- O `compose.yml` ganha o volume ou bind para `/opt/amassa/backups/`, e o `cron` do host é
  configurado por roteiro, fora do Compose.

</code_context>

<specifics>
## Specific Ideas

- **A divisão de configuração do Auth.js é o ponto onde esta fase mais provavelmente quebra.**
  `01-ARQUITETURA.md` §4 chama isso de "o erro mais provável da M1". O sintoma é o middleware
  quebrar na inicialização, porque `@node-rs/argon2` é módulo nativo e não carrega no runtime Edge.
  Vale um teste que prove que o middleware carrega, não só que o login funciona.
- **O `AUTH_TRUST_HOST=true` já está no `.env` do servidor** desde a Fase 1, mas nunca foi
  exercitado — não havia autenticação. Sem ele o Auth.js monta URLs de callback erradas atrás do
  Caddy: funciona em `localhost` e falha em produção. É a mesma classe de defeito que a Fase 1
  encontrou três vezes.
- **O backup precisa ser verificável de fora.** O `/api/health/backup` monitorado pelo UptimeRobot
  é o mecanismo, e é o que transforma "o script diz que enviou" em "o arquivo está lá há menos de
  26 horas". Um backup que para em silêncio é pior que não ter backup.
- **A conta do Drive é pré-requisito**, como o domínio e o VPS foram da Fase 1. Vale confirmar
  que ela existe antes de o plano do backup ser escrito.

</specifics>

<deferred>
## Deferred Ideas

- **Fase 2b — design system e casca:** tokens, `@theme inline`, componentes shadcn, barra lateral,
  barra inferior, painel inicial com espaços reservados, e as regras transversais de estado vazio,
  confirmação de exclusão e acessibilidade (UI-01 a UI-11).
- **Restauração real do backup** — subir o dump num Postgres limpo e confirmar que os dados
  voltaram. É a M7 no plano original. Mas a regra de **não migrar dados reais antes dessa prova**
  vale desde já (D-11).
- **Dump de hora em hora** no lugar do diário. Derruba a perda máxima de 24h para 1h, custo zero,
  uma linha no `cron`. `01-ARQUITETURA.md` §7 a chama de "a mudança de melhor retorno do plano
  inteiro". Não fazer agora — mas saber que existe.
- **Vinila Condensed como webfont**, se a licença web for confirmada algum dia. Trocar são duas
  linhas, e o logo em SVG continua valendo de qualquer forma.
- **Papel de "professora" ou "aluna"** na tabela `usuarios`. A coluna `papel` já nasce nesta fase
  com o enum de um valor só, deliberadamente, para que adicionar depois seja mudança de regra de
  autorização e não reescrita. Ver a ressalva de `02-MODELO-DE-DADOS.md` §0 sobre `alter type` em
  migração.

</deferred>

---

*Phase: 2a-Login, Banco Base e Backup*
*Context gathered: 2026-08-08*
