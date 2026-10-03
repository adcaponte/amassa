---
quick: 261003-bkp
title: Backup tratava pasta ilegível como vazia
status: complete
date: 2026-10-03
subsystem: backup
tags: [backup, permissao, roteiro-12, roteiro-19, test-backup]
key-files:
  modified:
    - scripts/backup.sh
    - scripts/testar-backup.mjs
    - docs/operacao/12-fotos-volume-e-backup.md
    - docs/operacao/19-migracao-fornecedores.md
    - .planning/phases/04.5-financeiro-parte-2/04.5-VERIFICACAO-HUMANA.md
    - .planning/phases/06.2-fornecedores/06.2-VERIFICACAO-HUMANA.md
    - .planning/STATE.md
    - .planning/PROXIMA-SESSAO.md
  outside-git:
    - Claude outputs/ROTEIRO-MIGRACOES-03-10.md
    - Claude outputs/fornecedores/19-migracao-fornecedores.md
    - Claude outputs/RETOMAR-AQUI.md
    - ESTADO-ATUAL.md
decisions:
  - "Pasta ilegível grava *_bytes NULO (não 0): não houve como contar, e 0 era exatamente a mentira de produção."
  - "O caso segue o caminho do 'envio falhou' (MENSAGEM_ERRO + CODIGO_SAIDA=1, linha com sucesso=true do dump), não o da armadilha: o dump íntegro continua registrado."
  - "restaurar.sh sem mudança: lá o padrão silencioso não existe — a cópia para uma pasta sem permissão falha e já cai no AVISO existente."
actuals:
  commits: 3
  tasks: 5
---

# Quick 261003-bkp: o backup tratava pasta ilegível como vazia

**Resumo:** quando a pasta das fotos ou dos anexos existe mas o usuário do backup não consegue lê-la, o `backup.sh` agora grava `*_destino_externo_ok = false`, bytes nulo e uma mensagem em português que cita a permissão e o Roteiro, e sai diferente de zero. Antes ele gravava `0` / `true`. Com isso `/api/health/backup` responde 503. O caso foi provado pelo `test:backup`, rodando como o usuário sem privilégio `postgres`: RED no script antigo, GREEN depois da correção.

## O que aconteceu (medido pelo dono, 03/10/2026)

O backup roda pelo crontab de `theo`. As duas pastas estavam com `chown 100:101` e `chmod 750`. O `find ... 2>/dev/null` do script não via nada, e a execução era gravada como `fotos_bytes = 0, t` e `anexos_bytes = 0, t`, com 4 fotos (488 929 bytes) e um PDF de 17 761 518 bytes dentro das pastas. O dono corrigiu no servidor com `sudo chmod 755`. O backup seguinte gravou `488929`/`t` e `17761518`/`t`, e o `rclone lsl` listou os arquivos.

## Tarefas

1. **`scripts/backup.sh`** (`9f5c73c`). Ganhou a função `pasta_ilegivel()`, que testa `[ -d "$1" ] && { [ ! -r "$1" ] || [ ! -x "$1" ]; }` (POSIX). Os Passos 6b (fotos) e 6c (anexos) passam por ela antes de contar. Se a pasta for ilegível: bytes `""`, que vira NULL pelo `nullif`; destino `false`; a mensagem é acrescentada a `MENSAGEM_ERRO` e `CODIGO_SAIDA=1`; o envio é pulado. É o mesmo caminho do "envio falhou". Uma pasta ausente continua sendo estado normal.
   **`scripts/restaurar.sh`** foi lido e não mudou. Ali a pasta é **destino**: se não houver permissão, o `$BACKUP_ENVIO_CMD` falha e cai no `AVISO` que já existe. A contagem com `2>/dev/null` só roda depois de uma cópia bem-sucedida, ou seja, numa pasta onde já foi possível escrever.
2. **`scripts/testar-backup.mjs`** (`9f5c73c`). Ganhou as Etapas 10 e 11. As antigas 10–13 viraram 12–15, e o total passou de 13 para 15 etapas. O `docker exec` roda como root por padrão, e root ignora a permissão de pasta. Por isso as duas etapas rodam o `backup.sh` com `-u postgres`, o usuário sem privilégio da imagem `postgres:17-alpine` (o psql e o pg_dump entram pelo socket local em `trust`). A pasta é criada por root com modo `root:root 750` e um arquivo `644` dentro. **Antes de afirmar qualquer coisa**, a etapa confirma que `postgres` de fato não consegue listar a pasta (`id -u && ls`); se conseguir, a etapa falha com essa explicação. As duas etapas usam pasta de backup, destino falso e dia do mês (15) próprios, para não esbarrar em pastas de root das etapas anteriores.
   - Etapa 10 (fotos): saída ≠ 0, `fotos_destino_externo_ok = false`, `fotos_bytes` nulo, mensagem com "foto" e "permiss", e o dump ainda registrado (`sucesso = true`, `bytes > 0`).
   - Etapa 11 (anexos): saída ≠ 0, `anexos_destino_externo_ok = false`, `anexos_bytes` nulo, fotos legíveis `true` com 3000 bytes, e mensagem com "anexos" e "permiss" e sem "foto".
3. **Documentação** (`1b9da54`).
   - Roteiro 12, Passo 4, e Roteiro 19, Passo 3: `chmod 755`, `drwxr-xr-x` e `100 101 755`, com nota datada de 03/10 e a evidência (488929, 17761518, `rclone lsl`). O texto do `750` ficou como registro histórico.
   - Roteiro 12, Passo 8: novo item 4, para 503 por permissão.
   - Roteiro 19, Passos 6 e 9: o novo tamanho do `backup.sh` (15 911 bytes, contra os 13 605 de 03/10, mantidos como registro), o `grep -c pasta_ilegivel` e como ler "`anexos_bytes` vazio com destino `f`".
   - As cópias fora do git: `Claude outputs/fornecedores/19-...` é cópia idêntica, e o `ROTEIRO-MIGRACOES-03-10.md` recebeu as mesmas trocas, resumidas.
   - Nota datada ao lado do `750` histórico em `04.5-VERIFICACAO-HUMANA.md` e no checklist do `06.2-VERIFICACAO-HUMANA.md`.
4. **Estado.** `STATE.md` foi editado à mão. Nos Pending Todos entraram quatro itens: este achado (corrigido no repositório, não publicado, com a re-extração dos scripts do host pendente); 🔴 `client_id` próprio do Drive no `rclone`; dividir o job `e2e` da CI por projeto; o trace do `caminho-anexos.ts:47` pelo Turbopack. Também ganhou uma linha na tabela de quick tasks e o Current focus corrigido. O Current focus dizia "nada publicado", mas `main` está publicado até `213cb15`: o `gh run list` mostra o run `37133630212` com `success`. A linha antiga foi preservada com data. Bloco datado no topo de `.planning/PROXIMA-SESSAO.md`, `ESTADO-ATUAL.md` e `Claude outputs/RETOMAR-AQUI.md`. A `FILA-DO-CODE.md` não foi alterada, porque este quick não é item dela.
5. **Verificação**: abaixo.

## Comandos que rodaram de fato

| Comando | Resultado |
|---|---|
| `npm run test:backup` com o teste novo e o `backup.sh` antigo (**RED**) | `test:backup falhou: Etapa 10: scripts/backup.sh deveria sair diferente de zero quando a pasta das fotos existe mas não pode ser lida — saiu 0.` (a sonda de permissão passou: `postgres` não lia a pasta) |
| `npm run test:backup` só com as fotos corrigidas (**RED dos anexos**) | `test:backup falhou: Etapa 11: ... a pasta dos anexos existe mas não pode ser lida — saiu 0.` |
| `npm run test:backup` com as duas correções (**GREEN**) | Etapas 1/15 a 15/15 — "Todas as etapas passaram." |
| `sh -n scripts/backup.sh` | sem erro |
| `npx eslint scripts/testar-backup.mjs` | sem erro |
| `npm run verificar` | exit 0: lint, `tsc --noEmit`, `verificar-acoes`, 132 arquivos / 2826 testes, e `test:migracoes` "Todas as afirmações passaram." |
| `git fetch` + `git log origin/main..main`, `gh run list` | medição do estado publicado (acima) |

O e2e não rodou, porque nenhum código da aplicação mudou: `lib/backup/frescor.ts` já transforma `*_destino_externo_ok === false` em 503. Não houve push, e o servidor não foi tocado.

## Deviations from Plan

- **[Rule 2] `fotos_bytes`/`anexos_bytes` gravados como NULO, não 0, quando a pasta é ilegível.** O pedido falava só do destino `false`. Mas gravar `0` repetiria a afirmação falsa de produção ("não há nada"). O nulo é o mesmo valor que a armadilha `ao_sair` já usa para "não houve como contar", e nenhuma tela lê esses bytes (`/api/health/backup` ignora os dois).
- **[Rule 2] Roteiro 19, Passo 6: o tamanho esperado do `backup.sh` foi atualizado.** O dono re-extrai o script depois do próximo deploy e compara o tamanho. Os 13 605 bytes antigos o fariam desconfiar de um arquivo certo.
- **[Rule 2] Notas datadas em `04.5-VERIFICACAO-HUMANA.md`, `06.2-VERIFICACAO-HUMANA.md` e na linha `260927-r12` da tabela de quicks.** Fora da lista do pedido, mas eram afirmações do `750` que podiam ser lidas como corretas no presente (regra de documentação do CLAUDE.md).
- **[CLAUDE.md] Current focus do STATE e os documentos de estado fora do git** foram corrigidos com evidência medida, pela regra "documento de estado desatualizado é defeito".

## Self-Check: PASSED

- `scripts/backup.sh`, `scripts/testar-backup.mjs`, os dois roteiros e as duas cópias fora do git existem e foram conferidos por `grep` (`750` só sobra em notas históricas datadas).
- Os commits `9f5c73c` e `1b9da54` estão no `git log`.
