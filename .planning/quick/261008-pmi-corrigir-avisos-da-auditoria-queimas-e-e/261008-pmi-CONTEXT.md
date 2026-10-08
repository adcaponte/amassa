# Quick Task 261008-pmi: corrigir três avisos da auditoria (Queimas e Estoque) - Context

**Gathered:** 2026-10-08
**Status:** Ready for planning

<domain>
## Task Boundary

Corrigir três avisos confirmados da auditoria de 08/10/2026 (`Claude outputs/auditoria/ACOMPANHAMENTO.md`, com o
detalhe em `agenda-queimas.md` e `estoque.md` na mesma pasta). Autorizado pelo Theo no chat em 08/10/2026 ("pode
rodar"). **Fora do escopo:** o AVISO-01 do Financeiro ("Corrigir" com mudança de data troca a taxa do cartão) —
espera decisão do Theo; a nota da Agenda (mensalidade de mês sem visita); as NOTAS. Sistema em produção com os
dados recém-limpos (item 10 feito em 08/10): nada de migração que dependa de dado antigo; se precisar de migração,
PARAR e perguntar (migração é aplicada à mão pelo Theo).

</domain>

<decisions>
## Os três defeitos (comportamento esperado — travado)

### 1. Queimas › "Lançar na Venda" cobra duas vezes num reenvio depois de resposta perdida
- Hoje: `lancarVenda` (`lib/financeiro/acoes.ts`, ramo `!ehOrigemDaAgenda(origem)` → `vincularQueimaNaVenda`,
  `lib/queimas/gravacao.ts`) só confere que a quantidade cabe no que falta; a tela (`components/amassa/financeiro/painel-venda.tsx`,
  `catch` do envio) diz "nada foi gravado" mesmo quando a venda já foi gravada e só a resposta se perdeu. Reenviar
  cria uma segunda venda para a mesma pessoa.
- Esperado: o mesmo padrão já usado no "Recebi agora" (correção `a866128`, `vendasVistas` + `vendasAtivasMudaram` +
  `RecusaDasQueimas` com `telaMudou`): a Venda aberta pelas Queimas leva o retrato das vendas ativas da queima que a
  tela viu; sob a trava, se mudou, recusa com frase humana e a tela se atualiza — o segundo toque depois de uma
  resposta perdida é recusado em vez de gravar outra venda. Reusar as peças existentes; não inventar mecanismo novo.
- A frase do `catch` não pode afirmar "nada foi gravado" quando não sabe — avaliar se cabe ajustar só para a
  origem Queimas ou em geral (a mesma raiz vale para a Venda manual; se a mudança geral for pequena e segura,
  pode; senão, registrar como pendência).

### 2. Estoque › entrada "sem custo" (R$ 0) vira a "última entrada com preço"
- Hoje: `lib/estoque/custo.ts` (~158-162) atualiza `ultimaEntradaComPreco` com `pagoCentavos` 0; com o saldo zerado,
  a próxima saída sai a R$ 0 e a tela mostra "R$ 0,00/kg" em vez de "—". As leituras em `gravacao.ts`/`consultas.ts`
  que reconstroem a última entrada com preço do banco precisam seguir a mesma regra.
- Esperado: entrada com valor 0 continua somando quantidade (e dilui o médio, como hoje, quando há saldo), mas
  **não** substitui a última entrada com preço de verdade (> 0). Teste para o cenário do auditor: compra 5 kg R$ 21
  → doação 1 kg sem custo → baixa 6 kg → venda de 1 kg vale R$ 4,20, não R$ 0.

### 3. Estoque › material com baixa manual antes da primeira contagem nunca pergunta "Custou ao todo"
- Hoje: `lib/estoque/gravacao.ts` (~511-519) e `consultas.ts` decidem `modoDoMaterial` por existir QUALQUER linha
  `origem = 'manual'` — uma saída para aula antes da primeira contagem põe o material em "conferência", e a primeira
  contagem grava ajuste a taxa 0 (material valendo R$ 0).
- Esperado: o material só sai do modo "primeira" quando já tem custo de verdade estabelecido ou já foi contado —
  o planejador define o critério exato lendo `contagem.ts`, `saldo.ts`, `pedidos.ts` e os testes existentes (ex.:
  "primeira" enquanto não houver contagem anterior nem entrada com preço > 0), e mantém tela e servidor decidindo
  igual. Teste para o cenário do auditor: saída manual 0,5 kg → contagem 10 kg pergunta "Custou ao todo".

### Discricionário do Code
- Forma exata das correções, frases (português do Brasil, humanas, dizendo o que fazer), nomes de teste.
- Regras do CLAUDE.md valem: `exigirUsuario()` na primeira linha, Zod no servidor, regra em módulo puro testado,
  `npm run verificar` antes de concluir, **no máximo uma invocação de e2e, com `--grep`** no que mudou.
- Não dar push. Não rodar nada em produção.

</decisions>

<canonical_refs>
## Canonical References

- `Claude outputs/auditoria/ACOMPANHAMENTO.md`, `agenda-queimas.md` (AVISO 1), `estoque.md` (AVISOS 1 e 2)
- Correção modelo: commit `a866128` (Queimas: `vendasVistas` no "Recebi agora")
- `.claude/CLAUDE.md`

</canonical_refs>
