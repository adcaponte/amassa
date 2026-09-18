# Roteiro 8 — O dia da abertura: remover o módulo Abertura do Espaço inteiro

> **AVISO — decisão do dono de 2026-09-18, mais nova que o resto deste documento.** O dono
> decidiu **arquivar o módulo Abertura inteiro, em vez de apagá-lo**: quando a Abertura for
> desmontada, a rota, o item de menu, a interface e o código saem — mas **nenhuma tabela é
> apagada**. Isso vale para as três tabelas da Abertura (`abertura_itens`, `abertura_tarefas`,
> `abertura_configuracao`) tanto quanto já valia para as duas do Comparador de Compras (D-03).
> **Os passos de remoção de tabela abaixo — e `db/remocao/remover-abertura-do-espaco.sql` — ainda
> descrevem o desenho antigo e NÃO DEVEM SER EXECUTADOS.** Este roteiro será reescrito numa tarefa
> separada, antes de qualquer desmontagem real, para refletir a decisão de arquivamento total.
> Até lá, os passos de código, rota e item de navegação (3 e 4) continuam corretos — só a remoção
> de tabela (passo 2) e a lista de `TABELAS_ESPERADAS` (passo 5) estão desatualizados.

**Este roteiro NÃO roda hoje.** A Fase 4.2 o entrega pronto porque o custo de escrevê-lo agora,
com o módulo fresco na cabeça, é uma fração do custo de reconstruí-lo meses depois com o ateliê
já abrindo (D-01/ABE-15, `.planning/phases/04.2-abertura-do-espaco/04.2-CONTEXT.md`). Ele roda
no dia em que o espaço físico do AMASSA abrir de verdade, e o módulo **Abertura do Espaço**
deixar de ter propósito.

ABE-15 exige que o módulo saia **sem deixar resíduo no resto do sistema**: tabelas, código, rota
e item de navegação. Este roteiro cobre as quatro coisas, nesta ordem, mais a quinta que o
projeto exige (conferir de fora depois de remover).

Os comandos rodam todos **no servidor**, na sessão SSH como `theo`, salvo indicação contrária
(os passos 3 e 5 mexem no repositório, não no servidor). Use `docker compose run --rm
ferramentas`, **nunca** `docker compose exec app`.

---

## 1. Backup verificado antes de qualquer coisa

A mesma disciplina de todo roteiro de migração deste projeto — sem atalho:

```bash
cd /opt/amassa
./scripts/backup.sh --agora
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** o `backup.sh` sem saída (sucesso silencioso); o `curl` com
`"status":"ok"` e `"idadeEmHoras"` próximo de `0`. Se `status` vier diferente de `ok`, **pare
aqui** e resolva o backup antes de seguir (`docs/operacao/03-backup-e-restauracao.md`).

---

## 2. O que fica: o Comparador de Compras (D-03)

**Leia esta seção antes de executar a lista de remoção abaixo.**

O **Comparador de Compras** (Fase 4.3) mora dentro da mesma aba `/abertura`, mas as duas tabelas
dele — `cotacao_categorias` e `cotacoes` — e o tipo de enum `situacao_cotacao` **ficam no banco**.
D-03 decidiu **arquivar, não apagar**: quando a Abertura for desmontada, o comparador some da
interface, mas os dados de cotação continuam no banco, consultáveis por quem tiver acesso direto
ao Postgres.

**Por que os nomes delas não têm o prefixo `abertura_`:** foi de propósito. Neste projeto, o
prefixo `abertura_` significa "sai quando o módulo for desmontado" — é o que a lista de
`TABELAS_ESPERADAS` e a SQL de remoção usam para decidir o que apagar. Um nome como
`abertura_cotacao_categorias` mentiria sobre o ciclo de vida da tabela e convidaria alguém a
"completar" a remoção por prefixo, num dia corrido. Batizá-las sem o prefixo é a primeira camada
de proteção do dado arquivado; esta seção, lida antes de rodar qualquer coisa, é a segunda; e a
prova automatizada (`conferirRemocaoDoModuloAbertura`, `scripts/testar-migracoes.mjs`, desde o
plano 04.3-01) é a terceira.

**O que sai do comparador neste dia é só a interface:** a aba "Cotações" dentro de `/abertura`, o
código de `lib/cotacoes/` e de `components/amassa/cotacoes/` (listados na seção 3 abaixo, junto
com os arquivos da própria Abertura), e a rota que os hospeda. **O dado nunca sai daqui** — não
inclua `cotacao_categorias`, `cotacoes` nem `situacao_cotacao` em nenhum passo de remoção de
tabela, em nenhuma versão futura deste roteiro, sem uma decisão nova e explícita do dono
revogando D-03.

> Com a decisão de 2026-09-18 (aviso no topo deste documento), esta mesma lógica de arquivamento
> passou a valer também para as três tabelas da própria Abertura — mas a reescrita completa do
> passo 2 abaixo para refletir isso é tarefa separada, ainda não feita.

---

## 3. As tabelas — mover a remoção de `db/remocao/` para `db/migrations/`

> **⚠️ NÃO EXECUTE este passo** — ver o aviso no topo deste documento (decisão de 2026-09-18).
> Ele reflete o desenho antigo, em que a Abertura era apagada; hoje ela é arquivada, como o
> Comparador de Compras já é desde a Fase 4.3 (seção 2). Mantido aqui como referência histórica
> até a reescrita.

No repositório (não no servidor), como um commit normal:

1. Mova `db/remocao/remover-abertura-do-espaco.sql` para `db/migrations/`, renomeando com o
   próximo número de migração em sequência (ex.: se a última migração for `0011`, este arquivo
   vira `0012_remover-abertura-do-espaco.sql`).
2. Acrescente a entrada correspondente em `db/migrations/meta/_journal.json` — o mesmo formato
   das entradas já existentes (`idx`, `version`, `when`, `tag`, `breakpoints: true`), com `tag`
   igual ao nome do arquivo sem a extensão.
3. Em `db/schema.ts`, remova as três tabelas (`aberturaItens`, `aberturaTarefas`,
   `aberturaConfiguracao`) e os três `pgEnum` (`categoriaItemAbertura`,
   `formaPagamentoAbertura`, `grupoTarefaAbertura`) do módulo.
4. Rode `npm run test:migracoes` localmente — sem a verificação
   `conferirRemocaoDoModuloAbertura` (ela também sai neste passo, ver item 5 abaixo), a suíte
   deve continuar passando com o schema já sem o módulo.
5. Commit e deploy pelo pipeline normal (isto sobe o `app`; a migração em si só roda no passo
   seguinte, à mão, pelo `ferramentas`).
6. No servidor, depois do backup do Passo 1: `docker compose pull ferramentas` e `docker
   compose run --rm ferramentas npm run db:migrate`.

**O que você deve ver:** `Migrações aplicadas com sucesso.`, saindo com código `0`. Depois,
`docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'` não lista mais
`abertura_itens`, `abertura_tarefas` nem `abertura_configuracao`.

---

## 4. O código — a lista dos arquivos que saem

Enumerados pelo caminho, para a lista ser conferível item a item (não pela descrição):

**Módulo puro:**
- `lib/abertura/acoes.ts`
- `lib/abertura/consultas.ts`
- `lib/abertura/esquemas.ts`
- `lib/abertura/formato.ts`
- `lib/abertura/parcelas.ts`
- `lib/abertura/prazos.ts`
- `lib/abertura/textos.ts`

**Rota:**
- `app/(app)/abertura/error.tsx`
- `app/(app)/abertura/layout.tsx`
- `app/(app)/abertura/loading.tsx`
- `app/(app)/abertura/page.tsx`

**Componentes:**
- `components/amassa/abertura/abas-abertura.tsx`
- `components/amassa/abertura/botao-adicionar-abertura.tsx`
- `components/amassa/abertura/botao-vazio-abertura.tsx`
- `components/amassa/abertura/caixa-marcacao.tsx`
- `components/amassa/abertura/confirmar-remover-item.tsx`
- `components/amassa/abertura/confirmar-remover-tarefa.tsx`
- `components/amassa/abertura/contexto-navegacao.tsx`
- `components/amassa/abertura/data-inauguracao-skeleton.tsx`
- `components/amassa/abertura/data-inauguracao.tsx`
- `components/amassa/abertura/ferramentas-linha.tsx`
- `components/amassa/abertura/formulario-item.tsx`
- `components/amassa/abertura/formulario-tarefa.tsx`
- `components/amassa/abertura/linha-item.tsx`
- `components/amassa/abertura/linha-tarefa.tsx`
- `components/amassa/abertura/lista-itens.tsx`
- `components/amassa/abertura/lista-meses.tsx`
- `components/amassa/abertura/lista-tarefas.tsx`
- `components/amassa/abertura/painel-resumo.tsx`
- `components/amassa/abertura/url-sem-navegar.ts`

**Testes de unidade:**
- `tests/unit/abertura-parcelas.test.ts`
- `tests/unit/abertura-prazos.test.ts`

**Testes de ponta a ponta e auxiliar de semente:**
- `tests/e2e/abertura-edicao.spec.ts`
- `tests/e2e/abertura-painel.spec.ts`
- `tests/e2e/abertura-tarefas.spec.ts`
- `tests/e2e/abertura-tracador.spec.ts`
- `tests/e2e/apoio/semear-abertura.ts`

**A remoção do banco, já apagada com o Passo 2 concluído (ela não tem mais o que verificar):**
- `db/remocao/remover-abertura-do-espaco.sql` (já movido no Passo 2 — a pasta `db/remocao/`
  pode ficar vazia, ou sair inteira se nenhum outro módulo temporário estiver usando-a)
- `db/remocao/LEIA-ME.md`

Confira, depois de apagar, que nenhum arquivo do resto do sistema importa algo de
`lib/abertura/`, `components/amassa/abertura/` ou `app/(app)/abertura/` (`grep -rn "abertura" lib
app components --include="*.ts" --include="*.tsx" -l`, excluindo os próprios arquivos do módulo
já removidos, deve voltar vazio).

### Comparador de Compras — só a interface (D-03, seção 2 acima)

O código do Comparador de Compras sai **junto com a Abertura**, porque a aba dele só existe
dentro de `/abertura` — mas o **dado**, nas tabelas `cotacao_categorias`/`cotacoes`, não sai (ver
seção 2). Caminhos reais criados nos planos 04.3-01 a 04.3-04:

**Módulo puro (`lib/cotacoes/`):**
- `lib/cotacoes/preco.ts`
- `lib/cotacoes/ordenacao.ts`
- `lib/cotacoes/esquemas.ts`
- `lib/cotacoes/acoes.ts`
- `lib/cotacoes/consultas.ts`
- `lib/cotacoes/textos.ts`

**Componentes (`components/amassa/cotacoes/`):**
- `components/amassa/cotacoes/contexto-cotacoes.tsx`
- `components/amassa/cotacoes/painel-cotacoes.tsx`
- `components/amassa/cotacoes/lista-cotacoes.tsx`
- `components/amassa/cotacoes/formulario-cotacao.tsx`
- `components/amassa/cotacoes/sub-abas-categorias.tsx`
- `components/amassa/cotacoes/dialogo-categoria.tsx`
- `components/amassa/cotacoes/selo-situacao.tsx`
- `components/amassa/cotacoes/pilula-nova-categoria.tsx`
- `components/amassa/cotacoes/botao-vazio-cotacoes.tsx`
- `components/amassa/cotacoes/botao-editar-categoria.tsx`
- `components/amassa/cotacoes/confirmar-remover-categoria.tsx`
- `components/amassa/cotacoes/esqueleto-cotacoes.tsx`
- `components/amassa/cotacoes/ferramentas-cotacao.tsx`
- `components/amassa/cotacoes/confirmar-remover-cotacao.tsx`
- `components/amassa/cotacoes/linha-cotacao.tsx`
- `components/amassa/cotacoes/cartao-cotacao.tsx`
- `components/amassa/cotacoes/preco-cotacao.tsx`
- `components/amassa/cotacoes/campos-longos.tsx`
- `components/amassa/cotacoes/detalhe-cotacao.tsx`
- `components/amassa/cotacoes/marcar-cotacao.tsx`
- `components/amassa/cotacoes/comparacao-cotacoes.tsx`

**Testes de unidade:**
- `tests/unit/cotacoes-preco.test.ts`
- `tests/unit/cotacoes-ordenacao.test.ts`

**Testes de ponta a ponta:**
- `tests/e2e/cotacoes-tracador.spec.ts`
- `tests/e2e/cotacoes-categorias.spec.ts`
- `tests/e2e/cotacoes-ciclo.spec.ts`
- `tests/e2e/cotacoes-comparar.spec.ts`

`components/ui/textarea.tsx` e `components/ui/checkbox.tsx` (instalados pelo shadcn na Fase 4.3
para o comparador) **não saem** — são primitivos genéricos do design system; confira antes de
apagar se nenhum outro módulo passou a usá-los.

Depois de apagar o código do comparador, confira que nenhum arquivo do resto do sistema importa
algo de `lib/cotacoes/` ou `components/amassa/cotacoes/` (mesmo `grep` acima, trocando
`abertura` por `cotac`).

---

## 5. A rota e o item de navegação

Remova a entrada **"Abertura do Espaço"** das duas variantes de
`components/amassa/menu-usuario.tsx` (a variante `celular`, dentro do `Sheet`, e a variante
desktop, dentro do `DropdownMenuContent`) — cada uma é um bloco `<Link href="/abertura">` com o
ícone `Store` e o texto "Abertura do Espaço".

`lib/navegacao/itens.ts` **nunca foi tocado** por este módulo (a entrada vivia só no menu do
usuário, não na navegação principal) — não precisa de nenhuma mudança.

---

## 6. `TABELAS_ESPERADAS` e a verificação da remoção

Em `scripts/testar-migracoes.mjs`:

1. Remova as três linhas de `abertura_itens`, `abertura_tarefas`, `abertura_configuracao` da
   constante `TABELAS_ESPERADAS`.
2. Remova a constante `TABELAS_DA_REMOCAO_ABERTURA` e a constante `TIPOS_DA_REMOCAO_ABERTURA`.
3. Remova a função `conferirRemocaoDoModuloAbertura` inteira e a chamada a ela em
   `conferirBanco()` — ela não tem mais o que verificar (as tabelas já não existem), e deixada
   para trás faria `npm run test:migracoes` falhar procurando tabela que não está mais lá.

---

## 7. Conferir de fora

```bash
npm run verificar
npm run test:e2e
```

**O que você deve ver:** os dois saindo com código `0` — nenhum teste do módulo Abertura resta
para rodar (foram todos apagados no Passo 3), e o resto do sistema continua passando sem ele.

Depois, no banco de produção, pelo `psql`:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c '\dt'
docker compose exec postgres psql -U amassa_owner -d amassa -c "select typname from pg_type where typname in ('categoria_item_abertura', 'forma_pagamento_abertura', 'grupo_tarefa_abertura');"
```

**O que você deve ver:** a primeira lista não traz nenhuma tabela `abertura_*`; a segunda não
traz nenhuma linha — os três tipos de enum saíram junto, e nenhum enum órfão ficou para trás em
`pg_type`.

Por fim, no navegador: o menu do usuário não mostra mais "Abertura do Espaço", e visitar
`/abertura` diretamente devolve a página de "não encontrado" do sistema (a rota já não existe).

---

Isto encerra a vida do módulo Abertura do Espaço. Ele nasceu na Fase 4.2 com uma data de morte
conhecida, e sai exatamente como planejado: um comando de cada vez, conferido de fora, sem
resíduo no resto do sistema.
