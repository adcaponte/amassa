# 05 — Guia de execução para o Theo

> Este arquivo é para você, não para o agente. Sem jargão. Se em algum ponto travar,
> copie o passo e pergunte — a ideia não é que você resolva sozinho, é que você entenda
> o que está acontecendo.

---

## Antes de começar: o que você precisa ter

| # | Item | Onde | Custo |
|---|------|------|-------|
| 1 | **Domínio** registrado | Registro.br, Namecheap, etc. | ~R$ 40/ano |
| 2 | **VPS na Contabo** | contabo.com — 4 GB de RAM sobra | ~€6/mês |
| 3 | **Auto Backup da Contabo** | marcar no painel, junto com o VPS | ~€2/mês |
| 4 | **Conta no GitHub** | github.com | grátis |
| 5 | **Um armazenamento para o backup** | Cloudflare R2, Backblaze B2 **ou Google Drive** | grátis |
| 6 | **Claude Code** instalado | no seu computador | assinatura Claude |

**Custo recorrente adicional: cerca de €2/mês** — só o Auto Backup. O resto é o VPS e o
domínio que você já ia pagar de qualquer forma.

### Como você fica protegido — e onde ainda está exposto

Sem serviço de banco gerenciado, **o banco de dados passa a ser seu**. Ele roda no seu VPS,
ao lado da aplicação. Por isso o backup não ficou para o fim: é uma das fases da **M1**,
junto com o login, antes de qualquer módulo. São quatro camadas:

1. **Auto Backup da Contabo** — cópia da máquina inteira, guardada fora do servidor,
   10 dias de retenção. É o que te salva se o servidor morrer
2. Uma cópia do banco é gerada todo dia de madrugada
3. Essa cópia é enviada para fora do servidor (item 5 da tabela acima)
4. No dia 1º de cada mês, uma cópia é guardada para sempre

**Qual usar quando:** para recuperar *dados* (alguém apagou algo, uma turma sumiu), use a
cópia do banco. Para recuperar o *servidor* (a máquina não liga mais), use o Auto Backup.
São ferramentas diferentes para problemas diferentes.

E, na última milestone, a gente **restaura um backup de verdade** para provar que funciona.
Um backup nunca testado não é um backup — é uma suposição. Não migre a operação do ateliê
para a plataforma antes dessa prova.

### O que continua exposto, e você aceitou conscientemente

**Você pode perder até 24 horas de trabalho.** Se o servidor morrer às 23h de uma terça, o
que foi lançado naquele dia se perde — a última cópia é da madrugada.

Para um ateliê isso é recuperável: são poucos lançamentos por dia, e todos estão na cabeça
de alguém ou no caderno. Mas é bom saber disso agora, e não no dia.

**Se um dia incomodar, a correção é barata:** rodar a cópia de hora em hora em vez de uma
vez por dia. É uma linha de configuração, custo zero, e a perda máxima cai de 24 horas para
1 hora. Dá para fazer a qualquer momento, sem mexer em mais nada. É só me pedir.

### Sobre o armazenamento externo (item 5)

Qualquer uma das três serve, e todas são gratuitas nesse volume — os arquivos vão ter
poucos megabytes. Se você já usa Google Drive, é a de menos trabalho. Se quiser a mais
limpa tecnicamente, Cloudflare R2.

---

## Passo 1 — Instalar o GSD Core

No terminal, dentro da pasta onde o projeto vai ficar:

```bash
npx @opengsd/gsd-core@latest
```

Ele vai perguntar qual ferramenta você usa — responda **Claude Code** — e se quer instalar
globalmente ou só nesse projeto. Local é suficiente.

> Se esse comando não funcionar, confira o nome do pacote no README do repositório
> (github.com/open-gsd/gsd-core). Não confirmei a publicação no npm, e é o primeiro comando
> de tudo — melhor descobrir agora do que travar aqui.

**O que o GSD é, em uma frase:** não é um sistema pronto que você personaliza. É um método
que obriga o Claude Code a discutir, planejar, executar e conferir antes de dizer que
terminou — em vez de sair escrevendo código e você descobrir os problemas depois.

---

## Passo 2 — Entregar o planejamento para o Claude Code

Copie a pasta `amassa-plataforma` inteira para dentro da pasta do projeto.
Abra o Claude Code e escreva:

```
Leia todos os arquivos da pasta amassa-plataforma/. Eles são o planejamento
completo deste projeto. Depois rode /gsd-new-project usando 00-BRIEFING.md
como documento fonte.
```

O GSD vai gerar os arquivos dele (`PROJECT.md`, `CONTEXT.md`, roadmap). **Confira se o
`CONTEXT.md` absorveu os 10 critérios de qualidade da seção 11 do briefing.** É esse
arquivo que todo executor vai herdar — se as regras não estiverem lá, elas se perdem.

---

## Passo 3 — O ciclo, milestone por milestone

Para cada milestone do arquivo `03-ROADMAP.md`, sempre nesta ordem:

```
/gsd-discuss     → ele levanta as dúvidas antes de planejar. Responda com calma.
/gsd-plan        → ele monta o plano detalhado. Leia. Se algo soar errado, diga.
/gsd-execute     → ele escreve o código.
/gsd-verify      → 👉 SUA VEZ. Abra o sistema e teste cada critério de aceite.
/gsd-ship        → fecha a milestone.
```

**O `/gsd-verify` é seu, não dele.** Abra o `03-ROADMAP.md`, pegue a lista de critérios da
milestone e teste um por um — no computador **e no celular**. Se algo não funcionar como
descrito, diga exatamente o que aconteceu. Não aceite "está pronto" sem ter testado.

Comece pela **M0**. Ela não entrega nenhuma funcionalidade, e é justamente por isso que
vem primeiro: você termina com o site no ar e o deploy automático funcionando, e todas as
milestones seguintes já nascem publicadas.

**Ordem recomendada:** M0 → M1 → M2 (Encomendas) → **M4 (Fornos)** → M3 (Agenda) →
M5 (Estoque) → M7 (polimento). O módulo de fornos subiu de posição: é o menor dos cinco,
não depende de nada além do login, e entrega o fluxo que vocês mais vão usar — a partir do
primeiro dia, ninguém mais conta queima no papel.

---

## Passo 4 — Quando ele pedir credenciais

Em algum momento vai precisar do IP do VPS, da senha do banco e da chave do armazenamento
de backup.

**Nunca cole segredo no chat.** Ele vai te orientar a colocar em um arquivo `.env`, que fica
só na sua máquina e no servidor, e nunca vai para o GitHub. Se alguma vez pedirem para você
colar uma chave direto na conversa, recuse e peça para usar variável de ambiente.

**Sobre a senha de root da Contabo:** ela chega por e-mail quando o servidor é criado. Use
uma única vez, no começo da M0, para criar seu usuário normal e instalar a chave SSH.
Depois disso o acesso por senha é desligado e **aquela senha não é usada nunca mais** —
nem em arquivo, nem em variável, nem em conversa. Se em algum momento parecer que ela é
necessária de novo, algo está errado no caminho.

**Sobre a senha do banco:** você nunca vai digitá-la. Ela é gerada aleatoriamente, guardada
no `.env` do servidor, e o banco não aceita conexão de fora do próprio servidor — nem sua,
nem de ninguém. Isso é proposital: a única coisa que fala com o banco é a aplicação.

**Suas senhas de acesso ao sistema** (a que você usa para entrar na plataforma) são criadas
por um comando no servidor, que imprime uma senha forte uma única vez. Anote num gerenciador
de senhas. Se perder, outro comando gera uma nova — não existe "esqueci minha senha" por
e-mail, e isso foi uma decisão, não um esquecimento: montar envio de e-mail para cinco
pessoas seria mais uma peça para manter sem ganho real.

---

## Repositório público — o que muda para você

Decidido. Isso mantém a automação gratuita e sem limite de uso. Duas coisas que passam a ser
regra, e uma que não é problema.

**O que é regra:**

1. **Nenhuma senha, chave ou token pode entrar no repositório.** Elas vivem em dois lugares:
   no cofre de segredos do GitHub e num arquivo no servidor que nunca é enviado. Isso já
   estava no plano — agora é crítico.
2. **Nenhum dado real de aluna ou cliente.** Nem em arquivo de teste, nem em captura de tela.
   Se precisar de exemplos, nomes inventados.

Vou ligar duas proteções do GitHub que barram o envio automaticamente caso algo escape.
E se um segredo vazar um dia, a resposta certa **não** é apagar o commit — é trocar a senha.
O histórico do Git guarda tudo, e existem robôs varrendo o GitHub em tempo real atrás
exatamente disso.

**O que não é problema:** o código em si ficar visível. Ele não protege nada — a segurança
está nas senhas e no fato de o banco não ser acessível pela internet. Qualquer pessoa pode
ler como o sistema funciona e continuar sem conseguir entrar nele.

---

## O que fazer com as pendências

**Calculadora de Orçamento — a única coisa que ainda trava algo.**
Quando as planilhas ficarem prontas, me mande os arquivos.
Vou precisar entender cinco coisas (estão listadas na seção 9 do briefing): quais dados
entram, quais custos são somados, como a margem é aplicada, se há desconto por volume, e
o que sai no final — um número ou uma proposta.

**Fonte dos títulos.** Descubra se a **Vinila Condensed** tem licença para uso na web.
Se não tiver ou for complicado, a alternativa recomendada é **Archivo Narrow**, que é
gratuita e visualmente próxima.

**Lista de materiais.** Antes da M5, levante a lista real do que existe no ateliê — argilas,
esmaltes, óxidos, tintas, pincéis, linhas, tecidos — com unidade e o mínimo que você quer
ter em casa. Sem isso o módulo nasce vazio e ninguém alimenta.

---

## Expectativa realista

Não vou te dar prazo em semanas, porque isso depende de quanto tempo você consegue dedicar
e de quantas idas e vindas cada milestone tiver. O que dá para dizer com honestidade:

- **M0 é a mais chata e a menos gratificante.** Servidor, DNS, certificado, banco, deploy.
  Você vai terminar com uma página em branco no ar e a sensação de não ter feito nada.
  É a milestone mais importante do projeto.
- **M1 tem uma fase invisível que é a mais valiosa de todas**: o backup automático. Não
  aceite pular, não aceite "a gente faz depois". Depois é quando não se faz.
- **M2 é onde você finalmente vê o AMASSA na tela.** É a mais satisfatória.
- **M4 é a de melhor relação esforço/retorno.** Módulo pequeno, uso diário.
- **M3 é a mais complexa** — presença, datas, semanas. É onde vale mais a pena ir devagar
  no `/gsd-discuss`.
- **Coisas vão quebrar.** Isso é normal e não significa que o plano estava errado. Descreva
  o que você viu, com o máximo de detalhe, e siga.

---

## Uma sugestão sobre ordem

Depois de cada módulo, **use por uma ou duas semanas com dados de verdade antes de partir
para o próximo.** Você vai descobrir coisas que nenhum planejamento antecipa — um campo que
falta, uma etapa que na prática se sobrepõe a outra, um filtro que você procura toda hora.

Ajustar isso com um módulo pronto é barato. Descobrir no fim, com cinco módulos construídos
em cima da mesma suposição errada, é caro.

---

## Uma coisa em que discordo do caminho mais fácil

Você pediu custo zero, e o plano entrega isso. Mas quero ser direto sobre o que muda: até
aqui, o risco de perder os dados do ateliê era de outra empresa. Agora é seu.

Isso é perfeitamente administrável — o backup em três camadas resolve, e o volume de dados
de um ateliê é minúsculo. Mas depende de uma coisa que não é técnica: **você conferir, de
vez em quando, se o backup ainda está rodando.** Uma vez por mês, abrir a pasta no Drive (ou
no R2) e ver se o arquivo de ontem está lá. Trinta segundos.

Vou pedir para o sistema te avisar quando o backup falhar, e isso cobre a maior parte dos
casos. Mas alarme automático também quebra. Os trinta segundos por mês são o que separa
"tenho backup" de "achava que tinha".
