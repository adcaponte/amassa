# Roteiro 11 — A virada do Financeiro: as parcelas da Abertura viram contas a pagar

Este roteiro leva as parcelas que a Abertura do Espaço ainda tem em aberto — o que falta pagar de
móveis, equipamentos, material, utensílios e obra — para "A pagar" do módulo Financeiro, com o
rótulo de origem preservado ("7 de 10", por exemplo), e grava o saldo inicial do caixa no dia da
virada (BRIEFING.md §7, `04.4-04-PLAN.md`).

**O que este roteiro faz:** roda `scripts/importar-parcelas-abertura.ts` (já commitado, provado
contra um banco de teste próprio por `npm run test:migracoes` — a função
`conferirImportacaoDaVirada`) uma vez, na virada, e grava um documento de despesa por item da
Abertura com parcela ainda em aberto, mais o saldo inicial do caixa.

**O que este roteiro NÃO faz, e por quê:**

- **Não roda antes do dia certo, e não roda sozinho.** O script não faz parte de nenhuma migração
  nem do pipeline de deploy — ele é um comando que o dono digita, uma vez, no fim de novembro,
  quando o espaço físico abrir de verdade. Rodá-lo antes disso gravaria um saldo inicial e
  documentos de despesa que ainda não fazem sentido (a Abertura provavelmente ainda tem
  pagamentos pendentes que só serão feitos depois).
- **Não mexe na Abertura.** O script só lê `abertura_itens` — nenhuma linha das três tabelas da
  Abertura é criada, alterada ou apagada. A prova automatizada (`conferirImportacaoDaVirada`)
  confere que o conteúdo das três tabelas é idêntico antes e depois de cada execução.
- **Não lança de novo o que já foi pago antes da virada.** Só as parcelas com vencimento a partir
  do primeiro dia do mês da virada entram; o que já foi pago fica para trás, coberto pelo saldo
  inicial que você informa na hora.
- **Não roda mais de uma vez com efeito duplicado.** A `chave_de_importacao` de cada documento
  (`abertura:<id do item>`) é única — rodar o script de novo não duplica nada, mas também não
  refaz um item que precise de correção (ver o passo 5 abaixo).

**Quando rodar:** **uma vez**, na virada — depois do último pagamento da Abertura já registrado
(o dia em que o espaço físico abrir) e com o Financeiro já migrado em produção (Roteiro 10,
`docs/operacao/10-migracao-financeiro.md`, quando existir). Não há problema em rodar o ENSAIO
(sem `--aplicar`) quantas vezes quiser, antes disso, só para acompanhar como a lista está ficando
— o ensaio nunca grava nada.

**Como ler cada passo:** o mesmo formato dos roteiros anteriores — cada bloco de comando vem
acompanhado de **o que faz** e **o que você deve ver** de volta. Se a tela divergir do descrito,
**pare naquele passo** e não siga para o próximo.

Os marcadores entre `<` e `>` saem junto com o valor. Os comandos rodam todos **no servidor**, na
sessão SSH como `theo`. Use `docker compose run --rm ferramentas`, **nunca** `docker compose exec
app` — a imagem `app` não tem `tsx` nem a pasta `lib/`/`scripts/` completas para isto.

---

## 1. Backup, antes de qualquer coisa

Nenhum roteiro que grava dado novo no Financeiro roda sem um backup imediatamente antes.

```bash
cd /opt/amassa
./scripts/backup.sh --agora
```

**O que faz:** dispara o mesmo script que o `cron` roda sozinho todo dia às 3h15 de Brasília —
dump completo, comprimido, gravado localmente e enviado para o Drive do ateliê.

**O que você deve ver:** nenhuma saída — sucesso silencioso. Confira com `echo $?` (`0` é
sucesso).

Confira que o dump é recente, pelo domínio público:

```bash
curl -s https://amassacerrado.com.br/api/health/backup
```

**O que você deve ver:** um corpo com `"status":"ok"` e `"idadeEmHoras"` próximo de `0`. Se
`status` vier diferente de `ok`, **pare aqui** e resolva o backup antes de seguir
(`docs/operacao/03-backup-e-restauracao.md`). **Não siga para o Passo 2 sem isso.**

Antes de seguir, confira também no Caixa do Financeiro que não sobrou nenhum lançamento de teste
pago com data anterior à que você vai usar como data da virada — o script recusa aplicar se
encontrar um (Passo 3 explica a mensagem exata). E tenha em mãos o **saldo real do caixa físico no
dia** — é o número que vai para `--saldo-inicial`.

---

## 2. ENSAIO — ler antes de gravar

Pelo serviço `ferramentas`, sem `--aplicar`:

```bash
docker compose run --rm ferramentas npm run importar-parcelas-abertura -- \
  --data-da-virada "<AAAA-MM-01>" --autor "<SEU_EMAIL>"
```

`<AAAA-MM-01>` é o primeiro dia do mês da virada (por exemplo `2026-12-01`); `<SEU_EMAIL>` é o
e-mail da sua própria conta de gestor, ativa.

**O que você deve ver:** a primeira linha diz o nome do banco conectado (nunca a URL — confira que
é o banco de produção, não um banco de teste esquecido); depois, item por item: o nome, a
categoria de origem na Abertura e a categoria de destino no Financeiro, quais parcelas entram
("parcelas 7 a 10 de 10", por exemplo), o valor e se o item estava marcado como resolvido; depois
a lista de itens ignorados (já quitados antes da virada) com o motivo; por fim os totais, e a
frase final `Nada foi gravado (ensaio). Rode de novo com --aplicar para gravar.`

**Confira, item por item, antes de aplicar:**

1. **A categoria de destino do Material** — o padrão é "Argila, esmalte e insumos" (a suposição do
   planejador foi essa, porque a Abertura não diz de que área é o material). Se algum item de
   material for de outra área, rode de novo com `--categoria-material "<Nome da categoria>"`.
2. **A data de cada documento** — é a data da COMPRA (a primeira parcela original do item na
   Abertura), não a data da primeira parcela ainda em aberto. Confira se isso está certo para os
   itens da lista.
3. **Os itens marcados "resolvido: não"** — eles entram do mesmo jeito (o compromisso já foi
   assumido); confira se algum deles não deveria mais existir (por exemplo, uma compra que acabou
   não acontecendo) — se for o caso, resolva isso na Abertura ANTES de aplicar.
4. **A categoria dos demais itens** (móveis, equipamentos, utensílios, obra) — o padrão é
   "Equipamento e obra". Se precisar de outra categoria, use `--categoria-demais "<Nome>"`.

Todas as parcelas importadas nascem com a forma prevista **Pix** (a Abertura não guarda forma de
pagamento) — o "Paguei" no Caixa escolhe a forma real quando o dinheiro sair de fato.

---

## 3. Aplicar

Só depois de conferir o ensaio inteiro:

```bash
docker compose run --rm ferramentas npm run importar-parcelas-abertura -- \
  --data-da-virada "<AAAA-MM-01>" --autor "<SEU_EMAIL>" \
  --saldo-inicial "<VALOR_DO_CAIXA_NO_DIA>" --aplicar
```

**O que você deve ver:** saída `0`, e a última linha diz quantos documentos foram criados e
quantos já existiam (0 e 0 numa primeira aplicação limpa), mais o saldo inicial e a data gravados.

**Se em vez disso aparecer uma lista de parcelas pagas antes da virada, com a frase "Cancele esses
lançamentos antes da virada — eles contariam duas vezes com o saldo inicial.":** o script recusou
aplicar de propósito (T-04.4-28) — alguma venda ou despesa no Caixa está paga numa data anterior à
da virada, e contá-la de novo dentro do saldo inicial duplicaria esse dinheiro. Cancele cada
lançamento listado no Caixa (nunca edite a data para "consertar" — cancele e, se for o caso, lance
de novo com a data certa) e rode o comando de aplicação de novo.

---

## 4. Conferir no celular

- [ ] Abra **Financeiro → Caixa**, aba "A pagar" — os itens da Abertura aparecem lá, cada um com o
      rótulo de origem ("7 de 10", etc.) no lugar de recontar.
- [ ] O tile **"Saldo em caixa"** mostra o saldo inicial que você acabou de informar.
- [ ] Abra a **Abertura do Espaço** — os itens, tarefas e a data de inauguração continuam
      exatamente como estavam antes (o script só leu, nunca escreveu lá).

---

## 5. Se algo sair errado com um item específico

Cada documento importado é um lançamento de despesa comum — pode ser **cancelado no Caixa** como
qualquer outro (a confirmação de cancelamento diz o que se perde antes de você confirmar). Depois
de cancelado, rodar o script de novo **não recria** aquele documento — a `chave_de_importacao`
(`abertura:<id do item>`) continua ocupada pelo documento cancelado, então a linha "esse item já
foi importado" permanece verdadeira mesmo cancelada.

**Para refazer a importação de um item específico** (por exemplo, porque a categoria de destino
saiu errada): cancele o documento no Caixa e avise o agente que vai reexecutar o roteiro nesta
sessão — reabrir a chave de importação para um item específico é uma operação de banco, feita à
mão, com backup antes, nunca por uma opção do próprio script (o script não tem — e não deveria
ter — nenhuma forma de apagar ou reescrever um documento já gravado).

---

## Regra de dono único (briefing §7)

Depois desta virada, **gasto que está na Abertura não é lançado de novo à mão** no Financeiro — o
script já trouxe todas as parcelas em aberto. Um lançamento manual duplicado é exatamente o defeito
que a `chave_de_importacao` única existe para prevenir do lado do banco; a disciplina de não
redigitar é a prevenção do lado de quem opera o dia a dia.

---

Isto encerra a virada do Financeiro. A partir daqui, "A pagar" do Financeiro é a fonte única do que
ainda falta pagar da Abertura — e o Roteiro 8 (`docs/operacao/08-remover-abertura-do-espaco.md`)
pode ser executado quando fizer sentido desmontar o módulo temporário, sem levar nenhum
compromisso financeiro pendente junto.
