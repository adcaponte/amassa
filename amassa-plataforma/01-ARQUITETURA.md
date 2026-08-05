# 01 — Arquitetura, Infraestrutura e Decisões Técnicas

> **Versão 2.2 — arquitetura autossuficiente.** O Supabase foi removido. Tudo roda no VPS
> Contabo que já está pago. **Custo recorrente adicional: ~€2/mês**, só o Auto Backup da
> Contabo.
>
> Referência para o Claude Code. Toda decisão vem com a razão junto — se durante a execução
> alguma se mostrar errada, mude-a conscientemente e registre a mudança.

---

## 1. O que mudou e por quê

A versão anterior deste plano usava Supabase. A restrição de custo zero elimina essa opção
por um motivo específico: o **plano gratuito do Supabase não faz backup nenhum**, e o plano
que faz custa US$ 25/mês. Construir a operação do ateliê sobre um banco sem backup seria
irresponsável, e pagar não é opção.

A saída é usar o servidor que já está contratado. O VPS Contabo roda o banco, a aplicação e
o proxy. Backups vão para um armazenamento externo gratuito.

**O que se ganha:** custo zero, controle total dos dados, nada que possa ser pausado,
encarecido ou descontinuado por terceiros.

**O que se perde, e é preciso dizer com clareza:** o banco de dados passa a ser sua
responsabilidade. Se o VPS morrer, o que salva a operação é o backup — e o backup só existe
se estiver funcionando e tiver sido testado. É por isso que o backup automático saiu da
última milestone e virou parte da **M1**, junto com o login. Não é preciosismo: é a única
coisa nesse plano que, se faltar, custa o negócio inteiro.

---

## 2. Stack

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Framework | **Next.js 15+, App Router, TypeScript** | Backend e frontend no mesmo projeto, um deploy só. Para quem não programa, "duas aplicações para manter" é o caminho mais curto para o abandono. |
| UI | **React 19 + Tailwind CSS v4 + shadcn/ui** | shadcn instala o código dos componentes no seu repositório, em vez de uma dependência opaca. Acessibilidade (Radix) de graça e customização visual total. |
| Gráficos | **Recharts** | Já é o que o protótipo do Contador de Queima usa. Portar é copiar. |
| Banco | **PostgreSQL, em Docker, no próprio VPS** | Consome ~250 MB de RAM. Guarda tudo o que o Supabase guardaria, sem mensalidade e sem limite de linhas. Use a versão estável mais recente disponível na imagem oficial — nada aqui depende de versão específica; o mínimo é 15, por causa de `generate_series` com `date` e das expressões usadas nas views. |
| Acesso ao banco | **Drizzle ORM + drizzle-kit** | Consultas com tipagem completa e migrações versionadas. |
| Autenticação | **Auth.js v5 (NextAuth), provedor Credentials** | E-mail e senha, sem serviço externo. |
| Senhas | **argon2id** (`@node-rs/argon2`) | Padrão atual para hash de senha. Não use bcrypt novo em 2026, nem invente esquema próprio. |
| Mutações | **Server Actions + Zod** | Sem camada de API REST para manter. Validação e autorização no servidor por construção. |
| Dados no cliente | **TanStack Query**, só onde há interação otimista | Marcar presença, dar baixa em estoque e registrar queima precisam responder na hora, no celular. O resto usa Server Components. Não instale Redux/Zustand. |
| Datas | **date-fns** + `date-fns-tz` | Fuso `America/Sao_Paulo` fixo. |
| Formulários | **react-hook-form** + resolver Zod | O mesmo schema valida no cliente e no servidor. |
| Ícones | **lucide-react** | Já é o padrão do shadcn. |
| Testes unitários | **Vitest** | |
| Testes ponta a ponta | **Playwright** | Roda os fluxos críticos em Chrome e no viewport de celular. |
| Lint/format | **ESLint + Prettier**, `--max-warnings=0` no CI | |

### Reversão consciente: agora **usamos** um ORM

A versão 1.0 deste plano dizia para não usar ORM. O motivo era que o Supabase gerava os
tipos e cuidava das migrações. Sem Supabase, esse trabalho fica órfão — e escrever SQL cru
com tipos mantidos à mão é exatamente o tipo de tarefa que se degrada em silêncio.

**Drizzle** cobre os dois buracos de uma vez: o schema em TypeScript é a fonte de verdade,
os tipos saem dele, e `drizzle-kit generate` produz as migrações SQL. A sintaxe é próxima
de SQL, então o que já está desenhado no arquivo `02` se traduz quase linha a linha.

### O que **não** usar

- Nenhuma biblioteca de Gantt pronta. O protótipo já resolve com CSS puro (18 px/dia,
  posicionamento absoluto). Portar é mais barato e mais fiel do que dobrar uma biblioteca.
- Nenhum sistema de tema claro/escuro na v1.
- **Não use `pgAdmin`, Adminer ou similar exposto na web.** É uma porta a mais para o banco,
  sem ganho: `docker compose exec postgres psql` faz o mesmo, e só de dentro do servidor.

---

## 3. Estrutura de pastas

```
amassa/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (app)/                      # tudo aqui exige sessão
│  │  ├─ layout.tsx               # nav lateral (desktop) + barra inferior (mobile)
│  │  ├─ page.tsx                 # painel inicial
│  │  ├─ encomendas/
│  │  ├─ agenda/
│  │  ├─ queimas/
│  │  ├─ estoque/
│  │  └─ orcamentos/
│  ├─ api/health/route.ts
│  └─ layout.tsx
├─ components/
│  ├─ ui/                         # shadcn
│  └─ amassa/                     # componentes do domínio
├─ db/
│  ├─ schema.ts                   # fonte de verdade do banco
│  ├─ index.ts                    # conexão (pool)
│  └─ migrations/                 # gerado por drizzle-kit, versionado
├─ lib/
│  ├─ auth/                       # config do Auth.js, sessão, guarda
│  ├─ encomendas/cronograma.ts    # ⚠ módulo puro
│  ├─ agenda/semana.ts            # ⚠ módulo puro
│  ├─ queimas/contador.ts         # ⚠ módulo puro
│  ├─ estoque/saldo.ts            # ⚠ módulo puro
│  └─ validacao/                  # schemas Zod compartilhados
├─ scripts/
│  ├─ criar-usuario.ts
│  ├─ redefinir-senha.ts
│  └─ backup.sh
├─ tests/
├─ docker/ (Dockerfile, compose.yml, Caddyfile)
└─ middleware.ts
```

**A regra da pasta `lib/`:** os quatro módulos marcados com ⚠ concentram as regras de
negócio que mais doem se estiverem erradas. Não importam React nem o cliente do banco.
Recebem dados, devolvem dados. Testáveis sem subir nada.

---

## 4. Autenticação sem serviço externo

- **Auth.js v5**, provedor `Credentials`, estratégia de sessão **JWT** em cookie
  `httpOnly` + `secure` + `sameSite=lax`.

  > Duas ressalvas honestas. A estratégia JWT não é uma escolha: com `Credentials`, o
  > Auth.js **não** oferece sessão em banco. E a v5 passou muito tempo em *beta* — é a opção
  > certa mesmo assim (a alternativa é escrever autenticação à mão, o que é pior), mas fixe
  > a versão exata no `package.json` e não atualize sem ler o changelog.

- Senhas com **argon2id** (`@node-rs/argon2`). O hash fica em `usuarios.senha_hash`.

  > argon2id é a recomendação atual da OWASP. Isso não quer dizer que bcrypt seja inseguro —
  > continua aceitável. Para um projeto novo, argon2id é a escolha melhor, sem drama.

> ### ⚠️ A divisão de configuração que todo mundo esquece
>
> O `middleware.ts` do Next.js roda no **runtime Edge** por padrão, e `@node-rs/argon2` é um
> módulo nativo que **não carrega lá**. Se a configuração do Auth.js for uma só, o
> middleware quebra na inicialização.
>
> **Solução, e ela é obrigatória:** dividir em dois arquivos.
> - `auth.config.ts` — sem o `authorize`, sem argon2, sem acesso ao banco. É o que o
>   middleware importa.
> - `auth.ts` — importa o anterior e acrescenta o provedor `Credentials` com o `authorize`
>   que consulta o banco e verifica o hash. É o que as rotas e Server Actions importam.
>
> Este é o erro mais provável da M1. Ele aparece logo, então é barato — mas só se você
> souber que ele existe.

- **Não existe tela de cadastro.** Usuários são criados por linha de comando:

```bash
docker compose run --rm ferramentas npm run criar-usuario -- --nome "Fernanda" --email "..."
docker compose run --rm ferramentas npm run redefinir-senha -- --email "..."
```

Os dois scripts geram uma senha aleatória forte e a imprimem uma única vez no terminal.

> ### Por que existe um serviço `ferramentas` no `compose.yml`
>
> A imagem de produção usa a saída **`standalone`** do Next.js — um pacote mínimo, sem
> `devDependencies`, sem `drizzle-kit`, sem `tsx` e sem os scripts do `package.json`.
> É ótimo para rodar o site e **inútil** para operar o sistema.
>
> Rodar `docker compose exec app npm run db:migrate` nessa imagem falha. Como migração,
> criação de usuário e redefinição de senha são justamente as três operações que você mais
> vai executar, isso precisa estar resolvido desde a M0.
>
> **Solução:** o mesmo Dockerfile expõe um estágio `ferramentas`, com as dependências
> completas e a pasta `db/`, publicado junto. Ele não fica rodando — só é invocado sob
> demanda com `docker compose run --rm`.

> **Por que linha de comando em vez de "esqueci minha senha" por e-mail:** enviar e-mail
> exige um serviço de SMTP, configuração de domínio e uma conta a mais para manter. Com 3 a
> 5 pessoas que se conhecem, um comando resolve em 10 segundos e não adiciona nada ao
> sistema. Se um dia houver 30 usuários, aí vale a pena — não antes.

- `middleware.ts` protege toda rota fora de `/login` e `/api/health`.
- Sessão longa (30 dias, renovada a cada uso). Ninguém quer digitar senha com barro na mão.
- **Desativar alguém é marcar `ativo = false`**, nunca apagar — apagar quebraria o histórico
  de quem registrou cada queima e cada movimentação.
- Toda Server Action começa pela mesma função `exigirUsuario()`, que devolve o usuário
  autenticado e ativo ou lança. Uma única porta.

### Proteções mínimas de login

- **Limite de tentativas**: 5 erros no mesmo e-mail em 15 minutos bloqueiam por 15 minutos.
  Contador em memória basta — é uma instância só.
- Mesma mensagem de erro para e-mail inexistente e senha errada.
- Comparação de hash sempre executada, mesmo com e-mail inexistente, para não vazar quais
  e-mails existem pelo tempo de resposta.

---

## 5. Segurança do banco

O Supabase publicava o banco numa API HTTP, e por isso a versão anterior insistia em RLS.
**Aqui o Postgres não é acessível de fora**: ele vive numa rede interna do Docker, sem porta
publicada no host. O único processo que fala com ele é a aplicação Next.js.

Consequência: **não usamos RLS.** A autorização vive na camada de servidor, com um único
ponto de entrada (`exigirUsuario()`).

> Isso não é abrir mão de segurança — é ajustar a defesa à ameaça real. RLS protegia contra
> uma API pública que deixou de existir. Mantê-la aqui seria cerimônia: trabalho e
> complexidade sem nada do outro lado. O que substitui a proteção é a regra de que **nenhuma
> Server Action toca o banco sem passar por `exigirUsuario()` primeiro** — e isso é
> verificável em revisão de código.

Em compensação, estas passam a ser inegociáveis:

- Postgres **sem porta publicada** no `compose.yml`. Nada de `ports: "5432:5432"`.
- Senha do banco forte, gerada aleatoriamente, só no `.env` do servidor.
- Um usuário de aplicação com permissão apenas no schema da aplicação — não o superusuário.
- Toda entrada validada com Zod antes de chegar ao banco.
- Drizzle parametriza as consultas. Se em algum ponto for preciso SQL cru, use
  `sql` com placeholders — **nunca** concatene texto.

---

## 6. Infraestrutura no VPS Contabo

### Topologia

```
Internet
   │
   ▼
[ Caddy ]  ← HTTPS automático (Let's Encrypt), renovação sozinha
   │
   ▼
[ container Next.js ]
   │  (rede interna do Docker, sem porta exposta)
   ▼
[ container Postgres ]  ──▶ volume de dados
   │
   └──▶ [ backup diário ] ──▶ armazenamento externo gratuito
```

### Consumo estimado

| Container | RAM |
|-----------|-----|
| Postgres | ~250 MB |
| Next.js | ~300 MB |
| Caddy | ~20 MB |
| Sistema | ~400 MB |
| **Total** | **~1 GB** |

Qualquer VPS Contabo com 4 GB de RAM roda isso com folga grande. Não é um sistema pesado —
são cinco módulos internos para cinco pessoas.

### Componentes

| Componente | Função |
|-----------|--------|
| **Docker + Docker Compose** | Empacota tudo. Atualizar é trocar uma imagem. |
| **Caddy** | Proxy reverso e HTTPS. Escolhido no lugar do Nginx porque **obtém e renova o certificado sozinho** — sem certbot, sem cron esquecido que derruba o site. Para quem não é técnico, isso é decisivo. |
| **Postgres** | Banco. Volume nomeado do Docker, nunca *bind mount* de diretório do host. |
| **UFW** | Firewall. Só 22, 80 e 443. |
| **fail2ban** | Bloqueia tentativas repetidas de SSH. |
| **unattended-upgrades** | Atualizações de segurança do sistema, automáticas. |

### Endurecimento obrigatório

- Login SSH **só por chave**. Login direto como root desabilitado.
- Um usuário comum com `sudo` — **este é o usuário do deploy**.

> A Contabo entrega o servidor com senha de root por e-mail. Ela é usada **uma única vez**,
> no primeiro passo da M0, para criar o usuário comum, instalar a chave pública e desligar
> o acesso por senha. Depois disso não é usada nunca mais — nem em arquivo, nem em variável,
> nem em conversa. (Se você tiver cadastrado uma chave SSH no painel da Contabo antes de
> criar o servidor, nem essa vez é necessária.)

### Deploy

1. `git push` na branch `main`
2. GitHub Actions: **lint → unitários → build da imagem (com as `NEXT_PUBLIC_*` como
   build-args) → E2E → publica no GHCR**
3. Actions conecta por SSH e roda `docker compose pull && docker compose up -d app`
4. As migrações são aplicadas **à mão**, por uma pessoa que está olhando (seção 8)

> **Por que não construir no servidor:** um `npm run build` do Next.js consome bastante RAM.
> Se estourar a memória do VPS durante um deploy, o site cai — e cai junto com o banco, que
> agora mora na mesma máquina. Construindo no GitHub Actions, o servidor só baixa um
> artefato pronto.

**Três armadilhas do deploy, todas fáceis de não perceber a tempo:**

1. **`docker compose up -d` não faz *rolling update*.** Ele para o container antigo e sobe o
   novo — alguns segundos fora do ar. Para 5 usuários internos isso é aceitável. Só não
   parta do princípio de que existe uma rede de proteção que não existe.
2. **Sempre `up -d app`, nunca `up -d` sozinho** no deploy. Assim o container do Postgres não
   é recriado a cada publicação.
3. **O `docker compose pull` do GHCR exige autenticação no VPS.** Ou torne o *package*
   público, ou rode um `docker login ghcr.io` uma vez no servidor com um token de escopo
   `read:packages`. Sem isso o primeiro deploy trava sem mensagem óbvia.

### Variáveis de ambiente

```env
# Precisam existir TAMBÉM no momento do build (build-args)
NEXT_PUBLIC_SITE_URL=https://seudominio.com.br

# Banco — serviço postgres
POSTGRES_USER=amassa_owner
POSTGRES_PASSWORD=
POSTGRES_DB=amassa

# Aplicação — serviço app (runtime, nunca na imagem)
DATABASE_URL=postgresql://amassa_app:SENHA_APP@postgres:5432/amassa
SENHA_APP=
AUTH_SECRET=                      # openssl rand -base64 32
AUTH_TRUST_HOST=true              # OBRIGATÓRIO atrás do Caddy — ver abaixo
TZ=America/Sao_Paulo              # SÓ no serviço app, nunca no postgres

# Backup — usado pelo cron do host
RCLONE_REMOTE=amassa-backup:amassa/
```

> **`AUTH_TRUST_HOST=true` não é opcional.** O Auth.js v5 ignora os cabeçalhos
> `X-Forwarded-*` por padrão, e atrás de um proxy reverso — que é exatamente o papel do
> Caddy aqui — ele monta as URLs de callback erradas. Sem essa variável o login funciona em
> `localhost` e falha em produção: o modo de falha mais caro que existe, e o mesmo que a
> caixa abaixo descreve.

> **Não aplique `TZ` ao container do Postgres.** Se a variável alcançar o `initdb`, o
> `timezone` do banco deixa de ser UTC e toda a lógica de datas do arquivo `02` sai do
> lugar. Declare as variáveis serviço a serviço no `compose.yml`, em vez de um `env_file`
> global aplicado a todos.

> ### ⚠️ A armadilha mais provável do projeto
>
> Variáveis `NEXT_PUBLIC_*` são **embutidas no JavaScript durante o `next build`**, não lidas
> em tempo de execução. Como a imagem é construída no GitHub Actions e o `.env` vive no VPS,
> elas não chegam ao navegador se forem tratadas só como variáveis de runtime.
>
> Sintoma: tudo funciona em `localhost` e falha em produção. Consome horas justamente porque
> a máquina de desenvolvimento continua saudável.
>
> **Solução:** passar as `NEXT_PUBLIC_*` como `build-args` no job de build do Docker.
> Nesta arquitetura há só uma delas, e ela não é secreta. `DATABASE_URL` e `AUTH_SECRET`
> são segredos de verdade, ficam **só** em tempo de execução e **nunca** entram na imagem.

O `.env` do VPS fica em `/opt/amassa/.env` com permissão `600`. Um `.env.example`
**sem valores** fica versionado.

---

## 7. Backups — a parte que não pode falhar

Sem Supabase, ninguém faz backup por você. Esta seção é a mais importante do documento.

### Quatro camadas

**0. Contabo Auto Backup — €1,15 a €3/mês, conforme o plano do VPS.** Habilitar no painel da
Contabo, na M0. Faz uma cópia **da máquina inteira**, guardada fora do servidor, com 10 dias
de retenção.

> **O que ela cobre e o que não cobre — a distinção importa.** Ela protege contra o servidor
> morrer: em vez de reconstruir tudo do zero, você restaura a máquina. Ela **não** substitui
> as camadas 1 a 3, por dois motivos: a retenção é curta (10 dias), e uma cópia de disco de
> um Postgres em execução é *crash-consistent* — o banco se recupera dela como se recuperaria
> de uma queda de energia, com replay de WAL, o que funciona mas não é o mesmo que um dump
> limpo. **Para restaurar dados, use o dump. Para restaurar o servidor, use o Auto Backup.**
>
> Disponível apenas para Cloud VPS, não para Storage VPS.

**1. Dump diário no próprio servidor.**

```
pg_dump → gzip → /opt/amassa/backups/amassa-AAAA-MM-DD.sql.gz
```

Mantém os últimos 14 dias e apaga o resto. Um ateliê gera poucos megabytes por ano —
14 dias de histórico ocupam menos que uma foto.

> **Quem dispara isso: o `cron` do sistema no host, não o Docker.** O Compose não tem
> agendador — um serviço declarado nele roda uma vez e morre. As alternativas seriam um
> container em laço infinito com `sleep` (frágil: perde o horário a cada reinício) ou uma
> imagem de cron dedicada (mais uma peça). O `cron` do Ubuntu já existe, é confiável há
> décadas e é o que qualquer pessoa consegue inspecionar com `crontab -l`.
>
> ```cron
> 15 3 * * * /opt/amassa/scripts/backup.sh >> /var/log/amassa-backup.log 2>&1
> ```
>
> O script chama `docker compose exec -T postgres pg_dump ...`.

**2. Cópia externa, fora do VPS.** Um dump que só existe no servidor não protege contra a
perda do servidor. `rclone` envia o arquivo do dia para um armazenamento externo. Opções
genuinamente gratuitas, nesta ordem de preferência:

| Opção | Gratuito | Comentário |
|-------|----------|-----------|
| **Cloudflare R2** | 10 GB | Sem taxa de saída. A mais limpa tecnicamente. |
| **Backblaze B2** | 10 GB | Simples, confiável. |
| **Google Drive** | 15 GB | Você provavelmente já tem conta. `rclone` fala com ele nativamente. |

Qualquer uma resolve — o volume de dados aqui é ridículo perto do limite. Escolha a que for
menos trabalho de configurar.

**3. Retenção mensal.** No dia 1º, o dump é copiado para uma pasta `mensais/` que nunca é
limpa. Protege contra o caso em que um problema só é notado semanas depois.

### O que continua exposto, declarado por escrito

Com este desenho, a **perda máxima de dados é de até 24 horas** — o intervalo entre o último
dump e a falha. Se o servidor morrer às 23h, o trabalho do dia inteiro se perde.

Isso foi avaliado e aceito conscientemente. As alternativas eram arquivamento contínuo de WAL
(pgBackRest, ~R$5/mês, derruba a perda para ~1 minuto, mas acrescenta uma peça que ninguém
na equipe sabe depurar) ou banco gerenciado (~US$15/mês). Para o volume de um ateliê — poucos
lançamentos por dia, todos refazíveis de memória ou do caderno — 24 horas é uma perda
recuperável.

**Duas saídas baratas, se um dia isso incomodar:**

1. Rodar o dump **de hora em hora** em vez de uma vez por dia. Custo zero, uma linha no
   `cron`, e a perda máxima cai de 24h para 1h. É a mudança de melhor retorno do plano
   inteiro, e pode ser feita a qualquer momento.
2. Aí sim, pgBackRest ou banco gerenciado.

### Um backup nunca testado não é um backup

A M7 inclui uma **restauração real**: subir o dump em um banco vazio e confirmar que os
dados voltaram. Descobrir que o arquivo estava vazio no dia em que você precisa dele é o
pior momento possível.

O script de restauração fica em `scripts/` e é documentado em uma página só, em português,
para você conseguir seguir sozinho num dia ruim.

### Antes de qualquer migração

```bash
./scripts/backup.sh --agora
```

Trinta segundos que evitam um dia inteiro de dor.

---

## 8. Migrações do banco

Com Drizzle, o schema em `db/schema.ts` é a fonte de verdade:

```bash
npx drizzle-kit generate     # gera o SQL a partir do schema, na sua máquina
git commit                   # o SQL vai versionado
# no servidor, depois do deploy:
docker compose exec app npm run db:migrate
```

> **Não coloque a migração no pipeline automático.** Uma migração ruim aplicada por um
> `git push` acidental não tem desfazer, e agora o banco é seu. Migrações são aplicadas à
> mão, depois de um backup, por alguém que está olhando o resultado.

---

## 9. Observabilidade

Deliberadamente enxuta — monitoramento que ninguém lê é só custo.

- `/api/health` verificando aplicação **e** uma consulta real ao banco.
- Um monitor externo gratuito (UptimeRobot ou similar) pingando a cada 5 minutos, com
  alerta por e-mail.
- **`/api/health/backup`**, que só responde `ok` se o último backup tiver menos de 26 horas.
  Monitorado pelo mesmo serviço externo — assim, um backup que parou de rodar vira um e-mail
  em vez de uma descoberta tardia.

  > Como a aplicação sabe disso: ao final do `backup.sh`, o script grava o resultado numa
  > tabela `execucoes_backup` (`quando`, `sucesso`, `bytes`, `destino_externo_ok`). O
  > endpoint lê a última linha. É mais robusto que inspecionar arquivo, porque o dump é
  > escrito por outro container e porque assim o **envio externo** também é verificado, não
  > só a geração local.

- **Um backup que para em silêncio é pior do que não ter backup**, porque você acha que está
  protegido. Por isso essa verificação não é opcional.
- Logs via `docker compose logs`, com rotação configurada no Docker.
- **Sem Sentry, sem APM, sem analytics.** Todos custam ou viram ruído.

---

## 10. Custo final

| Item | Custo |
|------|-------|
| VPS Contabo | já contratado |
| Domínio | já em aquisição |
| **Contabo Auto Backup** | **€1,15 a €3/mês** |
| Postgres | R$ 0 |
| Autenticação | R$ 0 |
| Armazenamento de backup externo | R$ 0 (dentro do nível gratuito) |
| Monitoramento | R$ 0 |
| GitHub Actions | R$ 0 (repositório público, cota ilimitada) |
| **Adicional recorrente** | **~€2/mês** |

O único gasto novo é o Auto Backup da Contabo — algo em torno de dez reais por mês, pelo
seguro de não precisar reconstruir o servidor do zero. Todo o resto continua em zero.

### Repositório público — decisão tomada

O repositório é **público**. Isso dá Actions sem limite de minutos e proteção de branch
gratuita, o que mantém o custo zero sem nenhum aperto no pipeline.

**O que isso exige, e é inegociável:**

- **Nenhum segredo, em nenhum commit, nunca.** Toda credencial vive em duas casas: os
  *secrets* do GitHub (para o pipeline) e o `/opt/amassa/.env` do servidor (para a execução).
  O `.env` está no `.gitignore` desde o primeiro commit; o `.env.example` é versionado sem
  valores.
- **Um segredo que vaza para um repositório público é um segredo queimado**, mesmo que o
  commit seja removido depois — o histórico do Git guarda tudo, e há robôs varrendo o GitHub
  em tempo real justamente atrás disso. Se acontecer, o procedimento não é apagar o commit:
  é **trocar a credencial**.
- Habilitar **secret scanning** e **push protection** nas configurações do repositório
  (gratuitos em repositório público). Eles barram o push antes de o segredo chegar lá.
- `.gitignore` cobrindo `.env*` (menos `.env.example`), `*.sql.gz`, `backups/` e chaves.

**O que fica público e não é problema:** o código da aplicação, o schema do banco e as
migrações. Nada disso protege nada — a segurança do sistema está nas credenciais e no fato
de o Postgres não ser acessível de fora, não no sigilo do código.

**O que nunca pode entrar no repositório:** dados reais de alunas, clientes, dumps de banco,
capturas de tela com informação real, e o `.env`.

> Um detalhe fácil de esquecer: se algum dia você gerar dados de exemplo para testes, use
> nomes inventados. O `dadosExemplo()` dos protótipos já faz isso — mantenha o hábito.

---

## 11. Como isto se encaixa no GSD Core

O GSD Core **não é um template de aplicação** — não traz login, banco nem componentes. É um
sistema de desenvolvimento orientado a especificação que conduz o Claude Code por um ciclo
disciplinado: **Discutir → Planejar → Executar → Verificar → Enviar**, rodando as partes
pesadas em subagentes com contexto limpo.

Na prática:

- Todo o código é escrito do zero, guiado pelos documentos desta pasta.
- O `CONTEXT.md` gerado pelo GSD deve absorver as regras da seção 11 do briefing e as
  decisões deste arquivo. É o que todo executor herda.
- Cada milestone do roadmap (arquivo `03`) vira um ciclo completo do GSD.
- A etapa **Verificar** é onde o Theo testa de verdade, no celular. Não pular.
