# Roteiro 8 — O dia da abertura: remover o módulo Abertura do Espaço inteiro

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

## 2. As tabelas — mover a remoção de `db/remocao/` para `db/migrations/`

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

## 3. O código — a lista dos arquivos que saem

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

---

## 4. A rota e o item de navegação

Remova a entrada **"Abertura do Espaço"** das duas variantes de
`components/amassa/menu-usuario.tsx` (a variante `celular`, dentro do `Sheet`, e a variante
desktop, dentro do `DropdownMenuContent`) — cada uma é um bloco `<Link href="/abertura">` com o
ícone `Store` e o texto "Abertura do Espaço".

`lib/navegacao/itens.ts` **nunca foi tocado** por este módulo (a entrada vivia só no menu do
usuário, não na navegação principal) — não precisa de nenhuma mudança.

---

## 5. `TABELAS_ESPERADAS` e a verificação da remoção

Em `scripts/testar-migracoes.mjs`:

1. Remova as três linhas de `abertura_itens`, `abertura_tarefas`, `abertura_configuracao` da
   constante `TABELAS_ESPERADAS`.
2. Remova a constante `TABELAS_DA_REMOCAO_ABERTURA` e a constante `TIPOS_DA_REMOCAO_ABERTURA`.
3. Remova a função `conferirRemocaoDoModuloAbertura` inteira e a chamada a ela em
   `conferirBanco()` — ela não tem mais o que verificar (as tabelas já não existem), e deixada
   para trás faria `npm run test:migracoes` falhar procurando tabela que não está mais lá.

---

## 6. Conferir de fora

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
