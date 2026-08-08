# Deferred Items — Fase 2b

Descobertas fora do escopo de arquivos do plano em execução no momento em que apareceram —
registradas aqui em vez de corrigidas na hora (regra de fronteira de escopo do executor).

## 1. `tests/e2e/autenticacao.spec.ts` — "a sexta tentativa..." trava/estoura o timeout mesmo
   sozinha, sem nenhuma mudança da 02b-03

**Descoberto em:** 02b-03, Tarefa 3, ao rodar `npm run test:e2e` de ponta a ponta depois de
acrescentar `tests/e2e/casca.spec.ts`.

**Sintoma:** o caso `autenticação — mensagem única e limite de tentativas › a sexta tentativa
seguida no mesmo e-mail mostra a mensagem de bloqueio com os minutos` (`tests/e2e/autenticacao.spec.ts:72`)
estoura o timeout de `page.waitForResponse` esperando a resposta de uma das seis tentativas de
login reais — não é "lento", é uma resposta que nunca chega dentro da janela testada (60s, 90s e
120s foram tentados; nenhum devolveu diferença de comportamento, só adiou o mesmo estouro).
Acontece de forma reprodutível no projeto `desktop` e, às vezes, também no `celular`.

**Isolamento feito, provando que não é causado por este plano:**

```
npm run test:e2e -- --grep-invert "casca de nave"
```

Com `tests/e2e/casca.spec.ts` inteiramente excluído da corrida (nenhum arquivo novo desta fase
participando), o mesmo caso falhou exatamente da mesma forma, no mesmo projeto (`desktop`),
com o mesmo sintoma. Repetido em múltiplas corridas completas (com e sem `casca.spec.ts`
presente) com o mesmo resultado — não é uma variação de carga introduzida pela 02b-03.

**Por que não foi corrigido agora:** o próprio comentário original do teste (herdado de
`02a-03-PLAN.md`, T-02a-14) já reconhece que seis conferências reais de hash argon2id "podem
ultrapassar o timeout padrão de 30s só por contenção de CPU" — o autor original já sabia que este
teste é sensível ao ambiente de execução. Investigar a causa raiz (possíveis candidatos: o
tamanho padrão do pool do `pg.Pool` em `db/index.ts`, que este plano não toca; o
`UV_THREADPOOL_SIZE` padrão do Node sob a carga de várias verificações de senha concorrentes; ou
uma característica específica desta máquina/contêiner de execução) está em território de
`lib/auth/` e `db/index.ts` — fora de `files_modified` da 02b-03 (design system e casca de
navegação, não autenticação).

**Por que não bloqueia o fechamento deste plano por si só:** todos os 14 casos de
`tests/e2e/casca.spec.ts` (a prova de UI-02, UI-03, UI-04, UI-06 e UI-07 desta fase) passam de
forma consistente e repetida, nos dois projetos. As outras 3 specs herdadas
(`fundacao.spec.ts`, `sessao.spec.ts`, `design-system.spec.ts`) e os outros 3 casos de
`autenticacao.spec.ts` também passam de forma consistente. Só este único caso, já
documentadamente sensível a timing antes desta fase, permanece instável neste ambiente de
execução.

**Próximo passo sugerido:** investigar se o tamanho do pool de conexões do Postgres
(`db/index.ts`, hoje sem `max` explícito — usa o padrão do `pg.Pool`, 10) ou o
`UV_THREADPOOL_SIZE` padrão do Node estão sendo exauridos sob a carga combinada de várias specs
de e2e fazendo login ao mesmo tempo. Uma tarefa dedicada de infraestrutura de teste (não de
produto) resolveria isso sem tocar em código de aplicação.
