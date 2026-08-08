# Deferred Items — Fase 2a

Descobertas fora do escopo de arquivos do plano em execução no momento em que apareceram —
registradas aqui em vez de corrigidas na hora (regra de fronteira de escopo do executor).

## 1. `callbackUrl` do redirecionamento não autenticado vaza o endereço interno do contêiner

**Descoberto em:** 02a-08, Tarefa 3, na conferência externa (curl, de fora do servidor) feita
depois de o dono relatar a execução real.

**Sintoma**, confirmado contra produção:

```
$ curl -sI https://amassacerrado.com.br/encomendas
HTTP/1.1 307 Temporary Redirect
Location: /login?callbackUrl=https%3A%2F%2F0.0.0.0%3A3000%2Fencomendas
```

O parâmetro `callbackUrl` deveria apontar para `https://amassacerrado.com.br/encomendas`, mas
aponta para `https://0.0.0.0:3000/encomendas` — o endereço interno do contêiner `app`
(`HOSTNAME=0.0.0.0`, `PORT=3000`, ver `docker/Dockerfile`), inalcançável de fora. Um usuário que
seguisse esse link depois de logar teria o navegador tentando abrir `0.0.0.0:3000`, que falha.

**O que já funciona certo, para contraste:** o cookie `__Secure-authjs.callback-url` da mesma
resposta resolve o domínio público corretamente (`https://amassacerrado.com.br`). Só o parâmetro
de query da própria `Location` do redirecionamento está errado — o mecanismo de resolução de
origem do Auth.js parece divergir entre os dois caminhos internos.

**Por que não foi corrigido agora:** o plano 02a-08 só tem `docs/operacao/03-backup-e-restauracao.md`
e `README.md` em `files_modified`. A causa provável mora em `lib/auth/auth.config.ts` /
`middleware.ts` (configuração do Auth.js v5, `trustHost`/`AUTH_TRUST_HOST`), território de
02a-03/02a-04 — fora da fronteira de escopo deste plano (regra do executor: só auto-corrigir o
que a mudança da tarefa atual causou).

**Por que não bloqueia o fechamento da fase 2a por si só:** o login manual funciona (a Server
Action de login redireciona para dentro da aplicação sem depender deste parâmetro de query — foi
assim que o dono conseguiu entrar de verdade na Tarefa 3). O defeito afeta especificamente quem
chega a uma rota protegida **sem sessão** e seria redirecionado de volta para ela **depois** de
logar — hoje esse retorno quebraria silenciosamente.

**Registrado em:** `.planning/WINDOWS.md`, id 2 (kind `deviation`, status `open`) — bloqueia
`/gsd-ship` até ser corrigido ou conscientemente dispensado (`gsd-tools windows waive`).

**Próximo passo sugerido:** uma tarefa dedicada, pequena, que investiga por que a resolução de
origem do Auth.js diverge entre o cookie `callback-url` e o parâmetro `callbackUrl` da `Location`
— provavelmente uma diferença entre como o `NextAuth(...).auth` monta o redirecionamento padrão e
como o restante do fluxo lê `AUTH_TRUST_HOST`/`X-Forwarded-Host` atrás do Caddy.
