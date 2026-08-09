---
status: secured
phase: 02b-design-system-e-casca-da-aplica-o
asvs_level: 1
block_on: high
threats_total: 14
threats_closed: 14
threats_open: 0
audited: 2026-08-09
---

# Fase 2b — Revisão de Segurança

**Fase:** 2b — Design System e Casca da Aplicação
**Ameaças fechadas:** 14/14
**Nível ASVS:** 1 (verificação elevada a leitura de código e execução real onde o risco era alto)

Auditoria feita contra o código em disco e o histórico do git — não contra o que as SUMMARYs
afirmam. Onde a mitigação era um comando, o comando foi executado e a saída real registrada.

## Superfície real desta fase

Nenhuma Server Action nova, nenhuma tabela, nenhuma migração, nenhum caminho novo de entrada de
usuário e nenhuma rota de API nova. É uma fase de interface: tokens, casca de navegação, telas
vazias, estados de erro e 404, e testes. O modelo de ameaça foi auditado contra essa superfície, e
não contra uma lista genérica de aplicação web.

## Verificação por ameaça

| ID | Categoria | Severidade | Disposição | Evidência |
|----|-----------|------------|------------|-----------|
| T-02b-01 | Elevation of Privilege | high | mitigate | `app/(app)/layout.tsx:15` e as seis páginas (`page.tsx`, `encomendas/`, `agenda/`, `queimas/`, `estoque/`, `orcamentos/`) chamam `exigirUsuario()` como primeira instrução — confirmado por leitura direta de cada arquivo, porque `verificar-acoes` só inspeciona funções `"use server"` e **não** cobre páginas. `app/not-found.tsx` renderiza só copy estática, sem dado de sessão. `git diff --exit-code lib/auth/ middleware.ts` → 0, e `git log` confirma que o último commit a tocar esses arquivos (`124b6bc`) é da Fase 2a |
| T-02b-02 | Elevation of Privilege | high | mitigate | `lib/auth/rotas-publicas.ts:5` → `ROTAS_PUBLICAS = ["/login", "/api/health"]`; `/orcamentos` ausente. Matcher do `middleware.ts` inalterado. 73/73 testes unitários relevantes passando, incluindo `rotas-publicas.test.ts` |
| T-02b-03 | Information Disclosure | medium | mitigate | `components/amassa/menu-usuario.tsx` — `MenuUsuarioProps = { nome, variante }`. O único dado de usuário que chega ao cliente é o nome |
| T-02b-04 | Information Disclosure | high | mitigate | `app/(auth)/login/page.tsx` — `mensagemDeErro()` intacta. `MENSAGEM_CREDENCIAIS_INVALIDAS` (constante compartilhada) serve senha errada **e** e-mail inexistente; mensagem de bloqueio preservada; `role="alert" aria-live="assertive"` preservado; nenhum campo é identificado na mensagem. A reestilização não tocou a mecânica |
| T-02b-05 | Denial of Service | medium | mitigate | `app/(auth)/login/botao-entrar.tsx` — `disabled={pending}`, `aria-busy={pending}`, `useFormStatus` intactos |
| T-02b-06-SC | Tampering | high | mitigate | Todas as dependências desta fase fixadas em versão exata, sem `^`/`~`: `radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `@axe-core/playwright`, `axe-core`. CLI `shadcn` ausente de `devDependencies` (roda só por `npx`). `git log -- docker/Dockerfile .github/workflows/` sem nenhum commit de 2b. `docker/Dockerfile` confirma `npm ci` e saída `standalone` sem `devDependencies` |
| T-02b-07 | Tampering | medium | accept | Aceito e documentado (D-11: `components/ui/` é território gerado; o diff é a revisão). Verificado: nenhum arquivo em `components/ui/` importa módulo específico do projeto — sem sinal de edição manual |
| T-02b-08 | Information Disclosure | low | accept | Aceito e documentado. `app/layout.tsx` usa `next/font/google` com `variable`; download só em tempo de build, nunca `<link>` de CDN em runtime |
| T-02b-09 | Information Disclosure | medium | mitigate | `app/(app)/error.tsx` — `grep -c 'error.message\|error.stack\|error.digest'` → 0. Só `console.error(error)` dentro de `useEffect` |
| T-02b-10 | Information Disclosure | low | mitigate | As seis telas usam copy fixa e fictícia — nenhum nome real de aluna, cliente ou gestor |
| T-02b-11 | Spoofing | low | accept | `estado-vazio.tsx` — botão `type="button" disabled aria-disabled="true"`, sem `formAction`, sem caminho de execução |
| T-02b-12 | Information Disclosure | low | mitigate | `app/not-found.tsx` e `app/(app)/not-found.tsx` renderizam a mesma copy para qualquer caminho, sem diferenciar existência de rota interna |
| T-02b-13 | Spoofing | medium | mitigate | `tests/e2e/acessibilidade.spec.ts` — conta de nome longo usa domínio `exemplo.test`, criada por `scripts/criar-usuario.ts` e desativada em `finally` por `scripts/desativar-usuario.ts`; nunca apagada |
| T-02b-14 | Information Disclosure | low | accept | Aceito e documentado. O relatório do axe-core em log de CI cita só copy fixa e pública |

## Commits posteriores aos planos

Três commits entraram depois de os planos e a verificação existirem, e foram auditados junto:

- **`90ca3f2` — logo do AMASSA em SVG.** É conteúdo fornecido pelo dono, agora renderizado na rota
  **pública** `/login`, então foi auditado byte a byte em vez de olhado por cima:
  `grep -inE '<script|on[a-z]+\s*=|xlink:href|foreignObject|data:|href='` → **0 ocorrências**.
  Só `<g>` e `<path>` com `fill="currentColor"` e `transform`, mais `role="img"`,
  `aria-label="AMASSA"` e `focusable="false"`. Sem script, sem manipulador de evento, sem
  referência a recurso remoto.
- **`f73a7ef` — `app/globals.css`** e **`f503dc3` — `lib/utils.ts` + `tests/unit/cn.test.ts`:**
  mudanças puramente tipográficas (família nos papéis e registro dos papéis no `twMerge`). Não
  tocam autenticação, dado de usuário, nem renderização de HTML não sanitizado.

## Sinalizações não registradas (informacionais, não bloqueantes)

1. **O logo em SVG não tem entrada no modelo de ameaça de nenhum plano** — os cinco planos foram
   escritos antes de o ativo existir. Auditado diretamente e confirmado seguro. Fica o aprendizado:
   ativo binário ou vetorial fornecido de fora, renderizado em rota pública, merece um Threat ID
   próprio nas próximas fases.
2. **Contas de verificação ad hoc em banco de desenvolvimento** (`verificacao.02b02@exemplo.test`,
   `verificacao.02b04@exemplo.test`, `verificacao.02b04b@exemplo.test`) seguem o mesmo padrão seguro
   de T-02b-13 — nome e domínio fictícios, desativadas e nunca apagadas — mas não têm ID próprio.
   Recomendação: registrar o padrão explicitamente nas próximas fases, em vez de deixá-lo como nota
   lateral.

## Método

- Cada página e layout sob `app/(app)/` lido diretamente, depois de confirmar na fonte do
  `verificar-acoes` que ele só varre funções `"use server"` — a mesma armadilha que a fase já havia
  documentado.
- `git log` usado para provar que nenhum commit, dentro ou depois dos cinco planos, tocou
  `lib/auth/` ou `middleware.ts`; e `git diff --exit-code` para a confirmação ao vivo.
- `npm run verificar-acoes` (0 violações) e `npx vitest run` sobre os arquivos relevantes (73/73)
  executados de verdade, em vez de citados a partir das SUMMARYs.
- `package.json` conferido item a item quanto à fixação exata de versão.

---

*Auditado: 2026-08-09*
*Auditor: gsd-security-auditor · persistido pelo orquestrador (contrato de escritor único)*
