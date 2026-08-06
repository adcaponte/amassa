# Roteiro 1 — Preparar o servidor (VPS)

Este roteiro leva o VPS da Contabo do estado "recém-entregue" a "endurecido, com Docker, com
`/opt/amassa` pronto e com a chave de deploy cadastrada no GitHub". É para você, Theo, executar
sozinho — comando a comando, numa sessão de terminal.

**Como ler cada passo:** todo bloco de comando vem acompanhado de duas linhas — **o que faz** e
**o que você deve ver** de volta. Se o que aparecer na sua tela for muito diferente do descrito,
pare e não siga para o próximo passo — é assim que um problema fica localizável no passo em que
aconteceu, em vez de aparecer três passos depois sem explicação.

**Marcadores usados neste documento** (substitua pelos valores reais na hora de rodar, nunca
grave o valor real de volta num arquivo do repositório):

- `<IP_DO_SEU_VPS>` — o endereço que a Contabo te mandou por e-mail
- `<SUA_CHAVE_SSH_PUBLICA>` — o conteúdo do arquivo de chave pública da sua máquina (o que
  termina em `.pub`, nunca o arquivo sem essa extensão — esse é o privado e nunca sai da sua
  máquina)

Este roteiro usa `theo` como nome do usuário comum (o usuário do deploy) e `amassa_owner` /
`amassa` como nome de usuário e nome do banco no Postgres — são convenções, não segredos, e o
Roteiro 2 vai usar os mesmos nomes. As senhas de verdade (do Postgres e da aplicação) são geradas
no passo 8, na hora, e nunca aparecem neste documento.

---

## 1. Primeira e única entrada como root

> **Isso é feito uma única vez.** A senha de root que a Contabo mandou por e-mail é usada agora,
> nesta sessão, para criar o seu usuário comum e instalar sua chave SSH — e depois disso nunca
> mais. Ela não vai para nenhum arquivo, nenhuma variável de ambiente e nenhuma conversa. Se você
> já tiver cadastrado uma chave SSH no painel da Contabo antes de criar o servidor, o servidor já
> nasce só com login por chave e você pode pular direto para o comando de criar o usuário comum,
> abaixo.

Na sua própria máquina, conecte no servidor como root:

```bash
ssh root@<IP_DO_SEU_VPS>
```

**O que faz:** abre uma sessão remota como root, usando a senha que a Contabo enviou por e-mail.

**O que você deve ver:** um pedido de senha e, depois de digitá-la, um prompt parecido com
`root@nome-do-servidor:~#`.

Agora, já dentro do servidor, crie o usuário comum:

```bash
adduser theo
```

**O que faz:** cria o usuário `theo`, com pasta pessoal própria, e pede para você definir uma
senha nova para ele (essa senha é só um segundo fator local — o acesso remoto vai ser sempre por
chave, nunca por ela).

**O que você deve ver:** perguntas de senha (digite uma senha forte, guarde num gerenciador de
senhas) e algumas perguntas opcionais (nome completo etc. — pode deixar tudo em branco e
confirmar com `Y` no final).

Coloque o `theo` no grupo `sudo`:

```bash
usermod -aG sudo theo
```

**O que você deve ver:** nenhuma saída — silêncio aqui é sucesso.

Instale sua chave pública para o usuário `theo`:

```bash
mkdir -p /home/theo/.ssh
chmod 700 /home/theo/.ssh
nano /home/theo/.ssh/authorized_keys
```

Cole o conteúdo do seu arquivo `.pub` (uma linha só, começa com `ssh-ed25519` ou `ssh-rsa`),
salve com `Ctrl+O`, `Enter`, e saia com `Ctrl+X`. Depois ajuste o dono e a permissão:

```bash
chown -R theo:theo /home/theo/.ssh
chmod 600 /home/theo/.ssh/authorized_keys
```

**O que você deve ver:** nenhuma saída nos dois comandos acima — sucesso silencioso.

---

## 2. Abrir uma segunda sessão como o usuário comum, antes de desligar o root

> **Não feche a sessão de root ainda.** Abrir uma segunda sessão e confirmar que ela funciona
> antes de desabilitar o acesso do root é o que evita o erro clássico deste passo: desligar a
> porta enquanto você ainda está do lado de fora, o que só se resolve com um resgate pelo console
> da Contabo.

Numa **janela de terminal nova**, na sua máquina:

```bash
ssh theo@<IP_DO_SEU_VPS>
```

**O que faz:** abre uma segunda conexão, agora como `theo`, usando a chave que você acabou de
instalar.

**O que você deve ver:** conexão feita sem pedir a senha da Contabo (a chave já autentica
sozinha) e um prompt `theo@nome-do-servidor:~$`. Mantenha essa janela aberta — ela é a prova de
que o acesso por chave já funciona antes de qualquer coisa ser desligada.

---

## 3. Desligar login de root e autenticação por senha

Volte para a **primeira sessão** (a de root) e edite a configuração do SSH:

```bash
nano /etc/ssh/sshd_config
```

Encontre (ou adicione) estas duas linhas e deixe exatamente assim:

```
PermitRootLogin no
PasswordAuthentication no
```

Salve (`Ctrl+O`, `Enter`) e saia (`Ctrl+X`). Recarregue o serviço:

```bash
systemctl reload sshd
```

**O que você deve ver:** nenhuma saída — sucesso silencioso.

Agora confirme, **pela segunda sessão** (a do `theo`, ainda aberta), que ela continua viva:

```bash
whoami
```

**O que você deve ver:** `theo`. Se essa sessão respondeu, o SSH recarregou sem derrubar quem já
estava conectado.

Para ter certeza total de que uma conexão **nova** também funciona com a configuração já
endurecida, abra uma **terceira janela** e repita `ssh theo@<IP_DO_SEU_VPS>`.

**O que você deve ver:** conexão feita normalmente, por chave, sem pedir senha nenhuma. Se
funcionar, pode fechar a primeira sessão (a de root) — ela não será mais necessária.

---

## 4. Atualizações de segurança automáticas

Na sessão do `theo`:

```bash
sudo apt update && sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**O que faz:** instala o pacote que aplica sozinho as atualizações de segurança do Ubuntu, e a
segunda linha abre uma tela pedindo para confirmar que isso fique ativado — escolha "Sim"/"Yes".

**O que você deve ver:** o pacote instalado sem erro, e depois de confirmar, o arquivo
`/etc/apt/apt.conf.d/20auto-upgrades` criado com as automatizações ligadas. Confira com:

```bash
systemctl status unattended-upgrades.service
```

**O que você deve ver:** uma linha com `Active: active (running)` (ou `active (exited)`,
dependendo da versão do Ubuntu — o que importa é não ver `failed` nem `inactive`).

---

## 5. Firewall — apenas 22, 80 e 443

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**O que faz:** libera só as três portas que este sistema precisa (SSH, HTTP e HTTPS) e liga o
firewall. Ele vai perguntar se você tem certeza, porque isso pode derrubar conexões SSH ativas —
responda `y` (você já confirmou no passo 3 que a porta 22 está liberada).

Confira o resultado:

```bash
sudo ufw status
```

**O que você deve ver:** uma listagem parecida com esta, com **exatamente** estas três portas em
`ALLOW` e nada além delas:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

Se aparecer qualquer porta além dessas três, pare e revise antes de seguir.

---

## 6. `fail2ban` contra tentativas repetidas de SSH

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

**O que você deve ver:** o pacote instalado, e ao rodar o comando abaixo, o serviço ativo:

```bash
sudo fail2ban-client status sshd
```

**O que você deve ver:** um bloco com `Status for the jail: sshd`, mostrando o filtro e a ação
ativos (a lista de IPs banidos começa vazia — é normal, o servidor é novo).

---

## 7. Docker Engine e o plugin do Compose

Instale pelo repositório oficial do Docker (não pelo pacote `docker.io` do Ubuntu, que costuma
ficar desatualizado):

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**O que faz:** cadastra o repositório oficial da Docker e instala o motor do Docker mais o
plugin do Compose (o comando `docker compose`, sem hífen).

Coloque o `theo` no grupo `docker`, para não precisar de `sudo` em todo comando:

```bash
sudo usermod -aG docker theo
```

**O que você deve ver:** nenhuma saída. Esse grupo só passa a valer numa sessão nova — feche a
janela atual, abra outra e reconecte (`ssh theo@<IP_DO_SEU_VPS>`).

Teste a instalação:

```bash
docker run hello-world
```

**O que você deve ver:** um texto começando com `Hello from Docker!`, confirmando que o motor, o
download de imagem e a execução de contêiner funcionam.

Confirme o plugin do Compose:

```bash
docker compose version
```

**O que você deve ver:** uma linha com `Docker Compose version v2...` (a versão exata varia, o
que importa é o comando responder e o `v2` no começo).

---

## 8. Criar `/opt/amassa` e o arquivo de ambiente do servidor

```bash
sudo mkdir -p /opt/amassa
sudo chown theo:theo /opt/amassa
```

**O que você deve ver:** nenhuma saída.

Agora, **na sua própria máquina** (onde o repositório está clonado), copie os dois arquivos de
infraestrutura e o `.env.example` para o servidor:

```bash
scp docker/compose.yml docker/Caddyfile .env.example theo@<IP_DO_SEU_VPS>:/opt/amassa/
```

**O que você deve ver:** três linhas de progresso terminando em `100%`, uma para cada arquivo.

De volta no servidor, renomeie o exemplo para o arquivo de verdade:

```bash
cd /opt/amassa
mv .env.example .env
```

Gere as duas senhas aleatórias, **aqui mesmo no servidor** — elas nunca devem ser digitadas à
mão nem vir de outro lugar:

```bash
openssl rand -base64 32   # use o resultado como POSTGRES_PASSWORD
openssl rand -base64 32   # use o resultado como AUTH_SECRET
```

**O que você deve ver:** duas linhas de texto aleatório, uma para cada comando. Copie cada uma
para um gerenciador de senhas antes de continuar — **se você perder esses valores depois de
preenchidos, a saída é gerar novos, não recuperar os antigos.**

Edite o arquivo de ambiente:

```bash
nano /opt/amassa/.env
```

Preencha cada variável (os nomes já estão lá, vindos do `.env.example`):

```env
NEXT_PUBLIC_SITE_URL=https://amassacerrado.com.br

IMAGEM_APP=ghcr.io/adcaponte/amassa:latest
IMAGEM_FERRAMENTAS=ghcr.io/adcaponte/amassa:ferramentas

POSTGRES_USER=amassa_owner
POSTGRES_PASSWORD=<COLE_AQUI_O_PRIMEIRO_VALOR_GERADO_PELO_OPENSSL>
POSTGRES_DB=amassa

DATABASE_URL=postgresql://amassa_owner:<A_MESMA_SENHA_DE_POSTGRES_PASSWORD>@postgres:5432/amassa
DATABASE_URL_TESTE=
AUTH_SECRET=<COLE_AQUI_O_SEGUNDO_VALOR_GERADO_PELO_OPENSSL>
AUTH_TRUST_HOST=true
TZ=America/Sao_Paulo

RCLONE_REMOTE=
```

`DATABASE_URL_TESTE` e `RCLONE_REMOTE` ficam em branco — a primeira só é usada pelo pipeline de
testes (nunca no servidor), a segunda é da Fase 2. Salve e saia.

Ajuste a permissão do arquivo e confira:

```bash
chmod 600 /opt/amassa/.env
ls -l /opt/amassa/.env
```

**O que você deve ver:** uma linha começando com `-rw-------`, confirmando que só o dono
(`theo`) consegue ler ou escrever esse arquivo. **Este arquivo nunca é copiado para lugar
nenhum e nunca entra em nenhum commit — ele existe só aqui, em `/opt/amassa/.env`.**

---

## 9. Chave de deploy dedicada e cadastro no GitHub

Gere, no servidor, um par de chaves SSH **só para o pipeline usar** — nunca reaproveite sua
chave pessoal aqui:

```bash
ssh-keygen -t ed25519 -C "deploy-amassa" -f ~/.ssh/deploy_amassa -N ""
cat ~/.ssh/deploy_amassa.pub >> ~/.ssh/authorized_keys
```

**O que você deve ver:** o `ssh-keygen` imprime o "fingerprint" e um desenho em ASCII da chave;
o `cat` não imprime nada (só acrescenta a linha no arquivo).

Mostre a chave privada, para copiar o conteúdo inteiro:

```bash
cat ~/.ssh/deploy_amassa
```

**O que você deve ver:** um bloco de texto de várias linhas. Copie o bloco inteiro, do começo ao
fim, sem cortar nenhuma linha — vai virar um secret no GitHub daqui a pouco.

No GitHub, vá em **Settings → Secrets and variables → Actions → Secrets** do repositório `amassa`
e cadastre três secrets, com estes nomes exatos (são os mesmos que
`.github/workflows/entrega.yml` já espera):

- `VPS_HOST` → o endereço do seu VPS (o mesmo que você usa em `<IP_DO_SEU_VPS>`)
- `VPS_USUARIO` → `theo`
- `VPS_SSH_CHAVE` → o bloco inteiro que você copiou do `cat` acima

**O que você deve ver:** depois de salvar cada um, o GitHub lista o nome do secret na página
(o valor nunca aparece de novo — se errar, apague e cadastre outra vez).

Agora, na mesma seção, aba **Variables**, mude `DEPLOY_ATIVO` de `false` para `true`.

**O que você deve ver:** a variável `DEPLOY_ATIVO` listada com o valor `true`. É essa mudança que
libera o job `implantar` do pipeline — antes disso ele aparecia como *skipped*, nunca vermelho.

---

## 10. Tornar o pacote do GHCR público

O VPS baixa a imagem do GitHub Container Registry **sem autenticar** — por isso o pacote
precisa estar público (sem essa configuração, o primeiro deploy trava sem mensagem clara).

Pela API do GitHub, usando o `gh` CLI autenticado na sua própria máquina:

```bash
gh api --method PATCH /user/packages/container/amassa/visibility -f visibility=public
```

**O que você deve ver:** uma resposta JSON com `"visibility":"public"`.

Se você não tiver o `gh` instalado ou preferir pela interface, o caminho equivalente:

1. Abra `https://github.com/adcaponte?tab=packages` e clique no pacote `amassa`
2. **Package settings** (barra lateral) → **Change visibility** → escolha **Public** → confirme
   digitando o nome do pacote

**O que você deve ver:** a etiqueta de visibilidade do pacote passa de "Private" para "Public"
no topo da página do pacote.

---

## 11. Ligar o Contabo Auto Backup

Esta é uma ação de painel, não um comando — entre no painel de controle da Contabo, na página do
seu VPS, e ative o **Auto Backup** (custa entre €1,15 e €3/mês, dependendo do plano do servidor).

O que ele cobre e o que não cobre, para não confundir depois: o Auto Backup protege contra o
**servidor inteiro morrer** — em vez de reconstruir tudo do zero, você restaura a máquina, com
dez dias de retenção. Ele **não substitui** o dump do banco: para restaurar dados, usa-se o
dump; para restaurar o servidor, usa-se o Auto Backup. O dump automático do banco em si (o
`cron`, o `rclone`, a cópia externa) é trabalho da **Fase 2** — este roteiro cuida só da camada
de máquina.

**O que você deve ver:** o VPS listado no painel da Contabo com o Auto Backup marcado como
ativo, geralmente com a data do próximo backup agendado ao lado.

---

O servidor está pronto: endurecido, com Docker, `/opt/amassa` preparado e a chave de deploy
cadastrada. O próximo passo é o **Roteiro 2**
(`docs/operacao/02-publicar-e-dominio.md`) — DNS, a primeira publicação, HTTPS, e a conferência
dos dez critérios de aceite da fase.
