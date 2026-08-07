---
phase: 01-funda-o-e-primeiro-deploy
plan: 07
subsystem: infra
tags: [vps, ssh, dns, https, deploy, uptimerobot, contabo, execucao-manual]

requires:
  - phase: 01-funda-o-e-primeiro-deploy (01-01 a 01-06)
    provides: imagem publicada no GHCR, compose/Caddyfile de produção, pipeline de quatro
      jobs, e os dois roteiros comentados de docs/operacao/
provides:
  - "Servidor Contabo endurecido e em produção: SSH só por chave, root desabilitado, UFW
    com 22/80/443, fail2ban, unattended-upgrades, Docker Engine + Compose"
  - "https://amassacerrado.com.br no ar, com certificado emitido automaticamente pelo Caddy
    e www redirecionando para o apex"
  - "Banco migrado à mão pelo estágio ferramentas, com dados persistidos em volume nomeado"
  - "Ciclo completo de publicação provado: push na main → qualidade → e2e → imagem → deploy
    por SSH, sem intervenção humana"
  - "Monitor UptimeRobot ativo e com alerta confirmado por teste real de queda"
  - "Ruleset da branch main ativo (deletion + non_fast_forward), confirmado via API"
affects: [fase 2 — o servidor está pronto para receber usuarios, Auth.js e o backup do banco]

actuals:
  tokens: 0
  tasks: 3
  commits: 9
  nota: "Executado conversacionalmente pelo dono no servidor, com o orquestrador guiando e
    verificando de fora. Nenhum agente executor rodou este plano — daí tokens 0. Os 9 commits
    são as correções que a execução real produziu nos roteiros e no pipeline."

tech-stack:
  added: []
  patterns:
    - "Verificação de fora, não de dentro: todo critério observável externamente foi conferido
      pelo orquestrador contra o domínio público (HTTPS, /api/health, redirect do www, portas),
      nunca aceitando o relato de quem executou"
    - "Teste de porta em par: 5432 fechada E 443 aberta. Só a primeira seria ambíguo — um
      servidor desligado também falha nela"
    - "Linha de prova no banco antes do reinício, conferida depois: distingue 'a aplicação
      voltou' de 'a aplicação voltou com os dados'"

coverage:
  - id: D1
    description: "Nenhum arquivo .env com valores reais aparece no repositorio publico"
    requirement: "INFRA-08"
    verification:
      - kind: other
        ref: "git log --all --full-history -- .env devolveu vazio; GET contents/.env e
          contents/.env.local na API do GitHub devolveram 404; git ls-files nao lista
          .env.local; o .env.example publicado tem 11 variaveis e 0 linhas com valor;
          a push protection ativa nao rejeitou nenhum push"
        status: pass
    human_judgment: false
  - id: D2
    description: "https://amassacerrado.com.br abre com cadeado e sem aviso de seguranca"
    requirement: "INFRA-01"
    verification:
      - kind: other
        ref: "curl -I devolveu HTTP 200 com handshake TLS sem erro de certificado, conferido
          de fora do servidor; o certificado foi emitido automaticamente pelo Caddy via
          Let's Encrypt, sem configuracao manual de TLS; o www devolveu 301 com Location
          apontando para o apex"
        status: pass
    human_judgment: false
  - id: D3
    description: "Alterar um texto, dar push na main, e a mudanca aparece sozinha em producao"
    requirement: "INFRA-02"
    verification:
      - kind: other
        ref: "o commit 4da5326 alterou FRASE_NO_AR; a execucao disparada por push fechou os
          quatro jobs (qualidade, e2e, imagem, implantar) em success; o curl da pagina passou
          a servir a frase nova sem nenhum comando executado no servidor"
        status: pass
    human_judgment: false
  - id: D4
    description: "/api/health responde ok e confirma uma consulta real ao banco"
    requirement: "INFRA-03"
    verification:
      - kind: other
        ref: "curl devolveu status ok e banco ok com HTTP 200; com o container do Postgres
          parado a mesma rota devolveu status erro e banco erro com HTTP 503, provando que o
          ok vem de consulta real e nao de um literal no codigo"
        status: pass
    human_judgment: false
  - id: D5
    description: "A porta 5432 do VPS nao aceita conexao de fora"
    requirement: "INFRA-04"
    verification:
      - kind: other
        ref: "Test-NetConnection na 5432 devolveu TcpTestSucceeded False e na 443 devolveu
          True — o par distingue banco protegido de servidor fora do ar; docker compose ps
          postgres mostra 5432/tcp sem mapeamento 0.0.0.0; o grep de ports: e de 5432:5432
          no compose.yml de producao devolve 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Reiniciar o VPS traz a aplicacao de volta sozinha, com os dados intactos"
    requirement: "INFRA-05"
    verification:
      - kind: other
        ref: "sudo reboot executado; o curl de /api/health voltou a devolver banco ok sem
          nenhum comando manual no servidor; o select na tabela devolveu a linha
          roteiro-02-linha-de-prova gravada antes do reinicio, provando que os dados vivem no
          volume nomeado e nao no container"
        status: pass
    human_judgment: false
  - id: D7
    description: "O Auto Backup da Contabo aparece ativo no painel"
    requirement: "INFRA-10"
    verification:
      - kind: other
        ref: "painel de controle da Contabo — visivel apenas pelo dono da conta"
        status: pass
    human_judgment: true
    rationale: "So o dono ve o painel da Contabo; nao ha API publica que confirme o estado do
      Auto Backup de fora. Alem disso havia um incidente aberto na Contabo no momento da
      execucao (backups atrasados e restores temporariamente indisponiveis), o que torna esta
      camada ativa no papel e degradada na pratica — precisa ser reconferida no inicio da
      Fase 2, antes de qualquer dado real do atelie entrar no sistema."
  - id: D8
    description: "Um deploy nao recria o container do Postgres"
    requirement: "INFRA-06"
    verification:
      - kind: other
        ref: "docker compose ps -q postgres devolveu o mesmo identificador antes e depois de
          duas publicacoes consecutivas com up -d app; a recriacao unica observada logo apos
          o reboot foi investigada, confirmada como reconciliacao do Compose e documentada no
          roteiro; os dados foram conferidos intactos apos ela"
        status: pass
    human_judgment: false
  - id: D9
    description: "Um deploy com teste quebrado e barrado pelo pipeline e nao vai ao ar"
    requirement: "INFRA-07"
    verification:
      - kind: other
        ref: "observado em execucao real: o job e2e falhou no build da imagem e o job imagem
          ficou skipped, sem publicar nada no GHCR; o portao unitario tambem foi provado
          localmente invertendo uma assercao e observando exit code diferente de zero"
        status: pass
    human_judgment: false
  - id: D10
    description: "Migracoes podem ser aplicadas a mao no servidor, fora do pipeline"
    requirement: "INFRA-09"
    verification:
      - kind: other
        ref: "docker compose run --rm ferramentas npm run db:migrate concluiu com a mensagem
          de sucesso e a tabela verificacao_infraestrutura foi criada; o grep de db:migrate no
          workflow devolve 0 ocorrencias, confirmando que nenhuma migracao roda no pipeline"
        status: pass
    human_judgment: false
---

## O que foi feito

O dono executou os dois roteiros de `docs/operacao/` no VPS Contabo, do primeiro acesso como
root até o site em produção com deploy automático. O orquestrador guiou passo a passo e
verificou de fora cada critério observável externamente.

**Roteiro 1 — preparar o servidor.** Chave SSH gerada na máquina do dono, usuário `theo` criado
com sudo, chave instalada, acesso por chave provado numa segunda sessão **antes** de desligar
root e senha. `unattended-upgrades`, UFW com apenas 22/80/443, `fail2ban`, Docker Engine e
plugin do Compose. `/opt/amassa` com `.env` gerado no próprio servidor (permissão 600, 12
variáveis, nenhuma senha tendo passado por chat). Chave de deploy dedicada e os três secrets
cadastrados no GitHub. Auto Backup da Contabo ativado.

**Roteiro 2 — DNS e publicação.** Registros A do apex e do www no registro.br, pilha completa
subida uma única vez, migração aplicada à mão pelo estágio `ferramentas`, HTTPS emitido
sozinho pelo Caddy, e as conferências dos critérios.

**Prova do ciclo completo.** Uma alteração de texto (`FRASE_NO_AR`) foi commitada e empurrada;
o pipeline rodou os quatro jobs e publicou no servidor por SSH; a frase mudou em produção sem
ninguém tocar no VPS.

## Desvios e descobertas

A execução real encontrou **quinze problemas** que nenhuma revisão de código teria pego. Seis
eram defeitos de código ou configuração, corrigidos e commitados:

1. **`public/` não versionado** — o Git não rastreia diretório vazio, e o `COPY` do Dockerfile
   falhava em checkout limpo. Reproduzido em clone limpo antes de corrigir (`b560dc2`).
2. **`HOSTNAME` ausente no Dockerfile** — o `server.js` da saída standalone escuta em
   `process.env.HOSTNAME`, que o Docker define. A aplicação atendia no endereço errado (`28d2b11`).
3. **`healthcheck` usando `localhost`** — dentro do contêiner resolve para `::1` (IPv6) enquanto
   o servidor escuta em IPv4. Falharia sempre, sem mensagem que apontasse a causa (`28d2b11`).
4. **`50-cloud-init.conf` sobrescrevendo o `sshd_config`** — arquivos em `sshd_config.d/` vencem
   o principal, e o da imagem trazia `PasswordAuthentication yes`. O servidor teria continuado
   aceitando senha enquanto o roteiro afirmava tê-la desligado (`1be0fc9`).
5. **Chave SSH corrompida na cópia** — produzia `error in libcrypto` no meio do deploy. O
   workflow passou a validar a chave antes de usar e a aceitar base64 em linha única (`8220dd2`).
6. **Teste E2E acoplado ao texto da página** — qualquer troca de copy quebraria o teste e
   barraria o próprio deploy que o critério INFRA-02 pede para observar (`4da5326`).

As outras nove foram correções nos roteiros, todas descobertas por alguém executando: chave SSH
inexistente, chaves angulares mantidas no comando, senha invisível ao ser digitada, `nano`
fechando sem gravar, paginador do `systemctl`, `dig`/`nmap`/`curl` que não existem no Windows,
`app` que não pode ficar saudável antes da migração, reconciliação do Compose após reboot, e a
visibilidade do pacote GHCR que já vinha resolvida.

## Pendências que atravessam para a Fase 2

- **Incidente no Auto Backup da Contabo** (restores temporariamente indisponíveis no momento da
  execução). Hoje é a única camada de proteção existente, e está degradada. Reconferir no início
  da Fase 2 — e não migrar dados reais do ateliê antes de o dump do banco existir.
- **Conta de armazenamento externo** (Google Drive, decisão D-01 do CONTEXT) ainda não criada.
  É pré-requisito do backup da Fase 2, não desta.
