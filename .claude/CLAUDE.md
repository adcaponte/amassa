<!-- GSD:project-start source:PROJECT.md -->

## Project

**AMASSA — Plataforma de Gestão do Ateliê**

Plataforma web interna, privada e responsiva, para os 3 a 5 gestores do **AMASSA** — ateliê de
cerâmica artesanal de alta temperatura em Goiânia — administrarem a operação do dia a dia em um
único lugar, substituindo planilhas e controles espalhados. Cinco módulos: Encomendas, Agenda de
Aulas, Contador de Queima, Estoque e Calculadora de Orçamento.

Não é um site institucional nem uma loja. O site público (amassaceramica.com.br) e a loja Shopify
continuam existindo separadamente e estão **fora do escopo**.

**Core Value:** **Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a
mão suja, num celular** — se registrar uma queima em dois toques, marcar presença de uma turma ou
dar baixa em material não for confortável no celular, o sistema não é usado e nada mais importa.

### Constraints

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
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

- **`npm run verificar` antes de dar um plano por concluído.** Roda `lint`, `tsc --noEmit`,
  `verificar-acoes`, os testes unitários e **`test:migracoes`**. Esse último é o que escapou na
  Fase 3: ele não faz parte de `npm test` nem de `npm run test:e2e`, só do CI, e a lista
  `TABELAS_ESPERADAS` de `scripts/testar-migracoes.mjs` ficou desatualizada por oito planos até
  o pipeline barrar o deploy. **Toda fase que mexe em `db/schema.ts` atualiza essa constante.**

- **Teste não pode afirmar condição global do banco sem isolamento.** Um teste que exige "nenhuma
  encomenda existe" disputa esse estado com qualquer outro teste que crie dado, e sob
  `fullyParallel` ele passa isolado e falha na suíte. Isso não é instabilidade — é premissa
  falsa. Use a cadeia de `dependencies` do `playwright.config.ts` (`vazio-* → desktop/celular`),
  nunca `--grep` como muleta.

- **Artefatos do servidor que não vêm do pipeline envelhecem em silêncio.** `compose.yml` e a
  imagem `:ferramentas` são ressincronizados pelo job `implantar`. O `.env` **não** — ele é do
  dono, tem segredos, e é editado à mão no servidor.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
