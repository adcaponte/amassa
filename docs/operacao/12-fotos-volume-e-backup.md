# Roteiro 12 — Volume das fotos de orçamento e a cobertura do backup

**Quando rodar:** **uma vez**, junto com a aplicação das migrações desta fase (Roteiro 13:
`docs/operacao/13-migracao-e-primeiro-envio-de-foto.md` ou o roteiro que a fase 04.5 definir para
migrar) — e **antes do primeiro envio de foto** de um orçamento de verdade. **Nunca pelo
pipeline**: o `docker/compose.yml` do servidor é ressincronizado sozinho pelo job `implantar` a
cada publicação, mas o diretório do host e a posse dele **não são** — quem cria e ajusta a
permissão é você, numa sessão SSH, com os comandos abaixo.

Continuação do Roteiro 3 (`docs/operacao/03-backup-e-restauracao.md`), que já deixou
`scripts/backup.sh`, `scripts/restaurar.sh` e `/api/health/backup` rodando para o dump do
Postgres. Este roteiro estende exatamente essa mesma rotina para cobrir também as fotos dos
orçamentos (D-28/ORC-16) — nenhuma ferramenta nova, nenhuma variável de ambiente nova é
obrigatória: `RCLONE_REMOTE_FOTOS` deriva sozinha de `RCLONE_REMOTE`, que já está configurado.

**Como ler cada passo:** o mesmo formato dos roteiros anteriores — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir muito do
descrito, pare naquele passo e não siga para o próximo.

Os comandos rodam todos **no servidor**, na sessão SSH como `theo` — o mesmo padrão dos roteiros
anteriores. Onde este roteiro escreve `/opt/amassa/dados/fotos-orcamentos`, é o caminho aprovado
na Tarefa 1 do plano 03 (`.planning/phases/04.5-financeiro-parte-2/04.5-CONTEXT.md`, D-30). Se o
caminho aprovado tiver sido outro, troque nos comandos abaixo — o resto do roteiro não muda.

---

## Passo 1 — Guarda de segurança: confirmar em qual servidor a sessão está

```bash
hostname
whoami
ls -d /opt/amassa
```

**O que faz:** confirma que você está na sessão SSH do servidor de produção, e não no seu
computador — os passos seguintes criam diretório e mudam posse de arquivo, e o comando errado no
lugar errado não tem desfazer fácil.

**O que você deve ver:** o nome do host do VPS (não o nome do seu computador), `theo`, e
`/opt/amassa` listado sem erro. Se `ls` disser "No such file or directory", você não está no
servidor certo — pare aqui.

---

## Passo 2 — Backup antes de mexer

Nenhuma migração deste projeto (e nenhum passo que mexe em diretório de dado) roda sem um backup
imediatamente antes — a mesma regra do Roteiro 3 e do Roteiro 10.

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso. Confira com `echo $?` (`0` é
sucesso).

Confira que a linha foi gravada:

```bash
docker compose exec postgres psql -U amassa_owner -d amassa -c "select quando, sucesso, destino_externo_ok from execucoes_backup order by quando desc limit 1;"
```

**O que você deve ver:** uma linha com `sucesso = t` e o horário de agora.

---

## Passo 3 — Criar o diretório

```bash
mkdir -p /opt/amassa/dados/fotos-orcamentos
```

**O que você deve ver:** nenhuma saída. Confira que existe:

```bash
ls -ld /opt/amassa/dados/fotos-orcamentos
```

**O que você deve ver:** uma linha começando com `drwxr-xr-x`, dono `theo` — a posse certa entra
no próximo passo.

---

## Passo 4 — Aplicar a posse

```bash
sudo chown 100:101 /opt/amassa/dados/fotos-orcamentos
chmod 750 /opt/amassa/dados/fotos-orcamentos
```

**O que faz:** `100` e `101` são o **uid** e o **gid** do usuário `nextjs` **dentro da imagem**
do contêiner `app` (medidos na pesquisa da fase, `04.5-RESEARCH.md`, Pitfall 4) — é esse usuário,
não root, que escreve a foto quando alguém envia uma pelo celular. `chown nextjs:nodejs` **por
nome** não funciona aqui: esse usuário existe só dentro do `/etc/passwd` da imagem, e o host não
o conhece — por isso o número, não o nome.

**O que você deve ver:** nenhuma saída nos dois comandos. Confira:

```bash
ls -ld /opt/amassa/dados/fotos-orcamentos
```

**O que você deve ver:** `drwxr-x---`, com o dono e o grupo aparecendo como `100`/`101` (números,
já que o host não tem usuário com esse uid/gid cadastrado — isso é esperado, não um erro).

---

## Passo 5 — Ressincronizar e subir

O `docker/compose.yml` do servidor é atualizado sozinho pelo job `implantar` a cada publicação —
confira que a versão com o volume já chegou:

```bash
grep -n "fotos-orcamentos" /opt/amassa/compose.yml
```

**O que você deve ver:** duas linhas — o bind mount (`/opt/amassa/dados/fotos-orcamentos:...`) e
a variável `CAMINHO_FOTOS`. Se não aparecer nada, a publicação com esta fase ainda não chegou ao
servidor — pare aqui e publique antes de continuar (`docs/operacao/02-publicar-e-dominio.md`,
passo de publicação).

Suba a versão com o volume:

```bash
docker compose pull app
docker compose up -d app
```

**O que você deve ver:** a imagem sendo baixada (ou "Image is up to date") e, em seguida, o
serviço `app` sendo recriado. Confirme:

```bash
docker compose ps app
```

**O que você deve ver:** `Up`, com um horário de início recente — a prova de que o contêiner que
está rodando agora já tem o bind mount montado.

---

## Passo 6 — Conferência de escrita

Grava e apaga um arquivo de teste **dentro do contêiner, como o usuário do contêiner** —
provando que a permissão da posse (Passo 4) está certa antes de qualquer foto de verdade
existir.

```bash
docker compose exec app sh -c 'echo teste-roteiro-12 > /dados/fotos-orcamentos/.teste-escrita && cat /dados/fotos-orcamentos/.teste-escrita && rm /dados/fotos-orcamentos/.teste-escrita'
```

**O que você deve ver:** a linha `teste-roteiro-12` impressa na tela, sem nenhum erro de
permissão. `docker compose exec` já roda como o usuário definido no `Dockerfile` (`nextjs`,
`USER nextjs`) — não é preciso (nem funcionaria) pedir root aqui.

**Se aparecer `Permission denied`:** o Passo 4 não foi aplicado, ou foi aplicado num caminho
diferente do que está no `compose.yml` (confira o Passo 5 de novo). Volte ao Passo 4 antes de
seguir — não adianta insistir neste passo sem corrigir a posse primeiro.

---

## Passo 7 — Conferência da cópia externa

```bash
./scripts/backup.sh --agora
```

**O que você deve ver:** nenhuma saída — sucesso silencioso.

Confira o destino externo:

```bash
rclone lsl amassa-backup:amassa/fotos/
```

**O que você deve ver:** provavelmente **nenhuma saída** — o diretório de fotos ainda está vazio
(nenhuma foto foi enviada de verdade; isso só acontece no plano 10) e `rclone` só cria a pasta
`fotos/` no destino quando há pelo menos um arquivo para copiar. Isso é esperado, não um erro —
compare com o Passo 8 se quiser confirmar a leitura no `/api/health/backup` de qualquer forma.

Confira a rota de saúde, pelo domínio público:

```bash
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"` — com o diretório de fotos vazio e o
destino externo configurado, a cópia é considerada confirmada por vacuidade (não há nada para
falhar em enviar). O dia em que a primeira foto for enviada e a cópia dela falhar, esta mesma
rota passa a responder `"status":"erro"` citando as fotos — é isso que o Passo 8 cobre.

---

## Passo 8 — O que fazer se der errado

Três erros prováveis, cada um com a causa e a correção:

1. **`Permission denied` na conferência do Passo 6.** Causa: o `chown 100:101` do Passo 4 não
   foi aplicado, foi aplicado no caminho errado, ou o contêiner subiu (Passo 5) **antes** do
   diretório existir com a posse certa (nesse caso o Docker cria o diretório sozinho, como
   `root`, na hora de montar o bind mount). Correção: refaça o Passo 4 e depois
   `docker compose up -d app` de novo — o bind mount reflete o dono atual do diretório do host
   sem precisar reconstruir a imagem.
2. **A pasta `fotos/` não aparece no destino externo, mesmo depois de fotos de verdade terem
   sido enviadas.** Causa mais provável: a autorização do `rclone` expirou (a mesma situação já
   documentada no Roteiro 3, passo 7). Correção: `rclone lsd amassa-backup:amassa` — se der erro
   de autenticação, refaça a autorização do `rclone` pela sua máquina, com a conta do Drive do
   ateliê; não é preciso mexer em `RCLONE_REMOTE_FOTOS` nem em `RCLONE_REMOTE`.
3. **`/api/health/backup` responde `503` citando as fotos.** Causa: a última execução do
   `backup.sh` tentou enviar fotos de verdade e o envio falhou. Correção: confira
   `cat /var/log/amassa-backup.log` e a mensagem da última linha de `execucoes_backup`
   (`select mensagem from execucoes_backup order by quando desc limit 1;`) — ela descreve o erro
   exato do `rclone`. As causas mais comuns são as mesmas do item 2 acima (autorização expirada)
   ou o disco do destino externo cheio.

---

## Restaurar as fotos

`scripts/restaurar.sh` (Roteiro 3, seções 12 e 13) agora tenta trazer as fotos de volta do
destino externo (`RCLONE_REMOTE_FOTOS`, derivada de `RCLONE_REMOTE`) para o diretório do host
(`BACKUP_FOTOS_DIR`, o mesmo `/opt/amassa/dados/fotos-orcamentos` deste roteiro), logo depois de
restaurar o banco. Isso acontece automaticamente, sem nenhuma opção nova de linha de comando: se
o destino externo estiver configurado, a tentativa acontece; se não estiver, o script avisa e
segue sem falhar.

**O que significa restaurar o banco sem as fotos.** É possível, e é um estado válido: o dump do
Postgres traz de volta a tabela `orcamento_fotos` inteira — as **referências** (qual orçamento
tem qual foto, com qual legenda) voltam normalmente. O que pode faltar são os **arquivos** em si,
se a cópia externa das fotos nunca chegou a rodar com sucesso ou se o passo de trazer de volta
falhar. Nesse caso, o orçamento continua íntegro (nome do cliente, preço, itens, tudo), só a foto
não aparece — a tela precisa aguentar isso mostrando um estado de erro na foto que falta, nunca
quebrando a página inteira. Confira manualmente com o Passo 6 deste roteiro (ou olhando o
diretório direto) se as fotos voltaram depois de uma restauração de verdade.
