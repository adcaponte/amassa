# Requirements: AMASSA — Plataforma de Gestão do Ateliê

**Defined:** 2026-08-05
**Core Value:** Substituir os controles espalhados do ateliê por um sistema que funciona de pé, no ateliê, com a mão suja, num celular.

> Derivados dos critérios de aceite de `amassa-plataforma/03-ROADMAP.md`. A regra do documento
> fonte vale aqui: **se um critério não puder ser testado clicando, ele está mal escrito.**

## v1 Requirements

### Infraestrutura e Deploy

- [x] **INFRA-01**: O sistema abre em `https://` no domínio próprio, com cadeado e sem aviso de segurança
- [x] **INFRA-02**: Alterar um texto e dar `git push` na `main` publica a mudança sozinho em poucos minutos
- [x] **INFRA-03**: `/api/health` responde `ok` e confirma uma consulta real ao banco
- [x] **INFRA-04**: A porta 5432 do IP do VPS não aceita conexão de fora — o banco não está exposto
- [x] **INFRA-05**: Reiniciar o VPS traz a aplicação de volta sozinha, com os dados intactos
- [x] **INFRA-06**: Um deploy publica a aplicação sem recriar o container do Postgres
- [x] **INFRA-07**: Um deploy com teste quebrado é barrado pelo pipeline e não vai ao ar
- [x] **INFRA-08**: Nenhum arquivo `.env` com valores reais existe no histórico do repositório público
- [x] **INFRA-09**: Migrações podem ser aplicadas à mão no servidor, com um comando, fora do pipeline
- [x] **INFRA-10**: O Auto Backup da Contabo aparece ativo no painel

### Backup e Recuperação

- [x] **BKP-01**: Um dump do banco é gerado automaticamente todo dia, sem intervenção
- [x] **BKP-02**: O dump do dia aparece também no armazenamento externo, fora do VPS
- [x] **BKP-03**: Os dumps são rotacionados em 14 dias e o do dia 1º é guardado em retenção mensal permanente
- [x] **BKP-04**: `/api/health/backup` só responde `ok` se o último backup tiver menos de 26 horas, e é monitorado externamente
- [x] **BKP-05**: Um backup pode ser disparado sob demanda antes de qualquer migração
- [x] **BKP-06**: Um dump do armazenamento externo é restaurado de verdade num Postgres limpo e os dados conferem
- [x] **BKP-07**: Existe um documento em português que permite repetir a restauração sozinho num dia ruim

### Autenticação e Acesso

- [x] **AUTH-01**: Abrir qualquer endereço sem estar logado leva para `/login`
- [x] **AUTH-02**: Entrar com e-mail e senha dá acesso ao sistema
- [x] **AUTH-03**: Senha errada mostra uma mensagem clara em português, igual à de e-mail inexistente
- [x] **AUTH-04**: Errar a senha 5 vezes no mesmo e-mail em 15 minutos bloqueia por 15 minutos
- [x] **AUTH-05**: A sessão persiste por 30 dias ao fechar e reabrir o navegador
- [x] **AUTH-06**: Sair encerra a sessão de verdade — voltar no histórico não devolve o acesso
- [x] **AUTH-07**: Criar um usuário por linha de comando no servidor funciona e imprime uma senha forte uma única vez
- [x] **AUTH-08**: Redefinir a senha de um usuário por linha de comando funciona
- [x] **AUTH-09**: Desativar um usuário (`ativo = false`) tira o acesso dele sem apagar o histórico de autoria
- [x] **AUTH-10**: Nenhuma Server Action toca o banco sem passar por `exigirUsuario()` na primeira linha

### Casca e Design System

- [x] **UI-01**: As cores e fontes são as do AMASSA, não o padrão do Tailwind, em todo componente shadcn instalado
- [x] **UI-02**: No celular, a barra inferior tem 5 itens (Início, Encomendas, Financeiro, Agenda, Queimas); no desktop, a barra lateral tem esses cinco mais Estoque (Fase 04.4, D-04/D-05)
  > **Atualizado na Fase 04.4:** o texto original tinha Estoque no lugar de Financeiro na barra do celular, e as duas barras eram idênticas. Desde D-04/D-05, elas divergem: o Financeiro entrou nas duas, mas o Estoque só saiu da barra do celular (tela vazia até a Fase 6) — no desktop ele continua.

- [x] **UI-03**: No desktop, a barra lateral de 240px tem os mesmos itens mais o menu do usuário no rodapé
- [x] **UI-04**: Orçamentos aparece no menu do usuário, não na navegação principal
- [x] **UI-05**: A navegação funciona confortavelmente com o polegar, no celular
- [x] **UI-06**: Nenhuma tela exige rolagem horizontal no celular
- [x] **UI-07**: Toda tela tem estado vazio com frase de contexto e botão, estado de carregamento com esqueleto, e estado de erro em linguagem humana
- [x] **UI-08**: Toda remoção pede confirmação nomeando o que será perdido
- [x] **UI-09**: Alvos de toque têm no mínimo 44px, contraste passa em AA, formulários navegam por teclado e botões só com ícone têm `aria-label`
- [ ] **UI-10**: Nenhum erro aparece no console do navegador em uso normal
- [ ] **UI-11**: O sistema carrega em menos de 3 segundos em 4G

### Encomendas

- [x] **ENC-01**: Criar uma encomenda com nome, cliente, data de início e as 6 etapas mostra as datas calculadas em cascata
- [x] **ENC-02**: Mudar a duração de uma etapa desloca todas as etapas seguintes
- [x] **ENC-03**: Os três marcos (queima 1, queima 2, entrega) aparecem como losango, sempre acontecem e sempre duram 1 dia — o campo numérico ao lado de cada um é a espera **antes** do marco, nunca a duração dele.
  > **Por que não é regressão (D-07, Fase 04.1):** a proibição original existia para o gestor não digitar a *duração* de algo que sempre dura 1 dia. O número novo mede outra coisa — a espera antes do marco — e por isso o campo numérico não contradiz o espírito do requisito original. Reaberto a partir da caminhada do dono em produção em 2026-08-20 (`.planning/phases/03-gestor-de-encomendas/03-VERIFICATION.md` §"Achado de produto — ENC-03 está errado sobre o ateliê"), nas palavras dele: *"as queimas e entregas sempre acontecem"*.

- [ ] ~~**ENC-04**: Desligar a etapa "Entrega" faz o losango sumir e encurta a encomenda~~ — **Retirado na Fase 04.1**: o interruptor liga/desliga saiu dos três marcos (D-06); não existe mais o que desligar, então a capacidade descrita aqui deixou de existir. Este requisito passou nas duas rodadas de verificação da Fase 3 (`03-VERIFICATION.md`); a linha permanece, tachada, para não apagar esse histórico.
- [x] **ENC-05**: Uma encomenda guarda e mostra vários itens com descrição e quantidade (ex.: 40 canecas e 12 bowls)
- [x] **ENC-06**: No desktop, o Gantt usa 18px/dia, cabeçalho em quinzenas, coluna fixa e linha de "Hoje" na posição certa
- [x] **ENC-07**: A timeline abre já rolada até deixar o "Hoje" mais ou menos centralizado
- [x] **ENC-08**: No celular, dá para ler o andamento de todas as encomendas como lista vertical, sem rolagem horizontal
- [x] **ENC-09**: O sistema mostra em qual etapa cada encomenda está hoje e quantos dias faltam para a próxima
- [x] **ENC-10**: Encomendas podem ser filtradas por status, ordenadas e buscadas por nome ou cliente
- [x] **ENC-11**: O rodapé do formulário mostra duração total e data de conclusão, atualizando conforme se digita
- [x] **ENC-12**: Uma encomenda criada num dispositivo aparece no outro ao recarregar a página
- [x] **ENC-13**: O estado vazio mostra "A roda ainda não gira"
- [x] **ENC-14**: Um botão de imprimir produz uma folha A4 com as encomendas ativas — nome, cliente, etapa atual e data de conclusão — legível e cabendo em uma página no volume atual do ateliê
- [x] **ENC-15** (Fase 04.1): O gestor diz quantos dias a peça fica parada antes de cada um dos três marcos (queima de biscoito, queima de esmalte, entrega), digitando o número num campo com o sufixo "dias depois"; a espera desloca o marco e todas as etapas seguintes na cascata, e **nenhuma data é armazenada** — a espera é um contador relativo de dias, e `data_inicio` continua sendo a única âncora gravada (D-01). Padrões dados pelo dono: espera 0 na queima de biscoito, 3 na queima de esmalte e 5 na entrega (D-05).

### Contador de Queima

- [x] **FOR-01**: Registrar uma queima leva **dois toques** e menos de 5 segundos no celular
- [x] **FOR-02**: O aviso com "Desfazer", por 7 segundos, remove a queima registrada por engano
- [x] **FOR-03**: Os três tipos aparecem: biscoito, esmalte e **ouro**
- [x] **FOR-04**: Chegando a 90 de 100 o cartão fica em atenção e mostra "Manutenção próxima"; em 100 fica em crítico e mostra "Manutenção vencida"
- [x] **FOR-05**: O medidor do cartão tem entalhes a cada 10 queimas, marca no limiar de atenção e rótulos `0 / atenção N / limite N`
- [x] **FOR-06**: O banner no topo lista os fornos que precisam de atenção, com o contador de cada um
- [x] **FOR-07**: Registrar manutenção mostra "o contador vai de N para 0", aceita responsável e observações opcionais, e zera o contador **sem apagar** o histórico
- [x] **FOR-08**: O cartão mostra quantas queimas o forno já fez na vida, além do contador desde a última manutenção
- [x] **FOR-09**: O detalhe do forno mostra o histórico de manutenções e as últimas 25 queimas
- [x] **FOR-10**: Remover uma queima lançada por engano no histórico pede confirmação
- [x] **FOR-11**: Fornos podem ser cadastrados e desativados, mas nunca excluídos
- [x] **FOR-12**: Os gráficos batem com a contagem manual do histórico, alternam entre 8 semanas e 6 meses, e a semana começa na segunda
- [x] **FOR-13**: Cada queima registra quem a lançou (usuário logado), sem pedir nada a mais no fluxo

### Agenda de Aulas

- [ ] **AGD-01**: A grade semanal reproduz o protótipo: turnos nas linhas, dias nas colunas, cores por modalidade
- [ ] **AGD-02**: O indicador de assentos tem três níveis — aberta, completa e excedida
- [ ] **AGD-03**: Turma com mais alunas do que vagas aparece em vermelho e **continua permitida**
- [ ] **AGD-04**: As quatro estatísticas do topo mostram aulas, pessoas únicas, experimentais e vagas livres
- [ ] **AGD-05**: Passar uma aluna de experimental para matriculada funciona e some o aviso
- [ ] **AGD-06**: Adicionar alguém que já está em outra turma no mesmo dia e turno mostra um aviso
- [ ] **AGD-07**: Avançar para uma semana futura cria as aulas sozinho, sem duplicar ao recarregar
- [ ] **AGD-08**: Marcar presença da turma inteira leva menos de 30 segundos no celular, com toque único por aluna
- [ ] **AGD-09**: Os quatro estados de presença funcionam: presente, falta, falta justificada e reposição
- [ ] **AGD-10**: Uma aluna de outra turma pode ser adicionada a uma aula como reposição
- [ ] **AGD-11**: Encerrar a matrícula de uma aluna a remove das aulas seguintes, mas não das passadas
- [ ] **AGD-12**: Cancelar uma aula por feriado mantém o registro e o motivo
- [ ] **AGD-13**: O histórico de uma aluna mostra todas as presenças e faltas dela
- [ ] **AGD-14**: Alunas podem ser cadastradas e buscadas, com aviso de possível duplicata por nome normalizado
- [ ] **AGD-15**: No celular, a agenda mostra um dia por vez com navegação lateral
- [ ] **AGD-16**: Domingo pode ser incluído ou não na grade, por configuração

### Estoque

- [ ] **EST-01**: Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
- [ ] **EST-02**: Materiais são organizados em cerâmica, pintura e bordado, com unidade, estoque mínimo, custo, fornecedor e observações
- [ ] **EST-03**: Material abaixo do mínimo aparece destacado na lista e no painel inicial
- [ ] **EST-04**: Material com estoque mínimo zero nunca entra em alerta
- [ ] **EST-05**: O histórico mostra toda movimentação com autor, data e tipo
- [ ] **EST-06**: Não existe nenhuma forma de editar ou apagar uma movimentação pela interface — só registrar um ajuste
- [ ] **EST-07**: No tipo `ajuste`, a tela pede o saldo contado na prateleira, não a diferença
- [ ] **EST-08**: Um ajuste que dá diferença zero não grava nada e responde "Conferido. O saldo já estava correto."
- [ ] **EST-09**: Registrar uma baixa no celular leva menos de 15 segundos
- [ ] **EST-10**: O saldo mostrado bate com a soma manual do histórico
- [ ] **EST-11**: Uma movimentação pode referenciar opcionalmente uma aula, fornada ou encomenda de origem
- [ ] **EST-12**: A lista de saldos tem busca e filtro por categoria

### Abertura do Espaço (módulo temporário)

> Módulo com prazo de validade: existe para organizar a abertura do novo espaço e é **removido
> quando o espaço abrir**. Validado por protótipo antes de virar código.

- [x] **ABE-01**: Cadastrar um item a comprar com nome, categoria, valor total e forma de pagamento
- [x] **ABE-02**: No pagamento a prazo, informar o número de parcelas e a data da primeira; as demais caem no mesmo dia dos meses seguintes
- [x] **ABE-03**: Informar opcionalmente a data prevista de entrega de um item
- [x] **ABE-04**: Um item cuja entrega venceu e que não foi resolvido aparece destacado como "não chegou"
- [x] **ABE-05**: Itens são agrupados por categoria, com contagem e soma por grupo
- [x] **ABE-06**: Cadastrar uma tarefa com descrição, prazo, grupo e responsável escolhido entre os gestores ativos da plataforma
- [x] **ABE-07**: Uma tarefa pode ficar sem responsável — "ninguém ainda" é um estado válido
- [x] **ABE-08**: Tarefas são agrupadas por área, ordenadas por urgência dentro de cada grupo, e o cabeçalho do grupo mostra quantas estão atrasadas
- [x] **ABE-09**: Uma tarefa pode ser ligada opcionalmente a um item; a tarefa mostra de qual item veio e o item mostra quantas tarefas abertas ainda carrega
- [x] **ABE-10**: Remover um item não apaga as tarefas ligadas a ele — elas ficam soltas, e a confirmação diz quantas são
- [x] **ABE-11**: Itens e tarefas podem ser editados no lugar, sem apagar e recriar
- [x] **ABE-12**: O painel mostra o total comprometido separado em à vista e a prazo, quanto sai neste mês e no próximo, e quantas tarefas estão atrasadas somadas às entregas vencidas
- [x] **ABE-13**: Uma visão mês a mês mostra quanto sai em cada mês, de quais itens e parcelas, com o mês mais pesado identificado
- [x] **ABE-14**: A data de inauguração é editável e a contagem regressiva acompanha, inclusive quando a data já passou
- [x] **ABE-15**: O módulo pode ser removido por completo — tabelas, rota e item de navegação — sem deixar resíduo no resto do sistema

### Comparador de Compras (aba da Abertura, dado arquivado)

> Aba dentro de `/abertura` para comparar cotações de fornecedor lado a lado, compartilhada entre os
> gestores. A **interface** morre junto com a Abertura; as **tabelas e os dados ficam** no banco
> (D-03 de `.planning/phases/04.3-comparador-de-compras/04.3-CONTEXT.md`). Validado por protótipo
> antes de virar código.

- [x] **CMP-01**: Categorias de cotação aparecem como abas dentro de `/abertura`; criar uma leva menos de 10 segundos; renomear funciona; remover pede confirmação dizendo quantas cotações se perdem
- [x] **CMP-02**: Cada cotação guarda empresa, produto, preço (ou "sob consulta") e os seis campos longos: diferenciais, assistência técnica, condições de pagamento, contato, observações e alertas
- [x] **CMP-03**: Clicar numa linha abre o detalhe completo, com os alertas destacados em vermelho
- [x] **CMP-04**: Ordenar por preço funciona, e as cotações sem preço vão para o fim nos dois sentidos
- [x] **CMP-05**: Uma cotação descartada continua visível, apagada — nunca some da lista
- [x] **CMP-06**: Marcar duas ou mais cotações mostra a comparação lado a lado, com os campos alinhados em colunas
- [x] **CMP-07**: Uma segunda conta de gestor vê e edita os mesmos dados — a razão de isto sair do navegador do dono
- [x] **CMP-08**: No celular: cartões empilhados, comparação com rolagem horizontal própria, alvos de 44px, sem rolagem horizontal da página
- [x] **CMP-09**: As tabelas do comparador sobrevivem à remoção do módulo Abertura, provado pelo `test:migracoes`

### Financeiro — parte 1: Venda, Compra, Caixa, Mês e Cadastros (Fase 04.4)

> Escrito a partir de `.planning/phases/04.4-financeiro-parte-1/BRIEFING.md`, do protótipo
> aprovado em 2026-09-19 e das decisões `D-01`..`D-14` de `04.4-CONTEXT.md`, que fecham os
> pontos que o rascunho original deixava em aberto (revisados na `/gsd-discuss-phase 04.4`,
> reescritos no plano 04.4-02). O prefixo é `FNC` porque `FIN-*` já nomeia o "Financeiro da
> Escola" da v2.

- [x] **FNC-01**: Uma venda junta várias linhas, de áreas diferentes, num recebimento só — montada por atalhos do catálogo, busca, lista completa ou "valor livre". Cadastros é rota própria (`/cadastros`), alcançada por um link dentro do Financeiro, até o Início virar índice (D-06)
- [x] **FNC-02**: O preço vem do catálogo e é editável na linha; quando difere, a tela mostra "tabela R$ X" — reservado a ESSE motivo só. Um desconto no total, em R$ ou %, é repartido entre as linhas na proporção do valor de cada uma — a sobra de centavos do arredondamento vai para a maior linha, e o desconto nunca vira linha separada nem entra no Geral (D-09/D-10); toda linha atingida pelo desconto (item comum, item de "valor na hora" ou valor livre) mostra QUANTO ela perdeu, com etiqueta e texto próprios, distintos de "tabela R$ X" (04.4-13-PLAN.md, resposta ao item 11 da conferência do dono, 26/09/2026)
- [x] **FNC-03**: Venda e despesa aceitam à vista, sinal/entrada de 50% + saldo, ou 2x a 12x, com as parcelas editáveis — cada campo da grade tem rótulo visível ("vence"/"valor") e uma dica confirma que dá para mudar valor e data (04.4-13-PLAN.md, resposta ao item 4 da conferência do dono, 26/09/2026); se a soma não fecha com o total, a tela diz quanto falta ou sobra, o botão fica desabilitado e o servidor recusa. A forma de pagamento é por parcela, não por documento (D-07); no à vista, "+ outra forma" divide o recebimento em duas parcelas com formas diferentes, pagas na data do documento (D-08). No à vista de uma parcela só, a caixinha "já recebi"/"já paguei" aparece marcada por padrão — desmarcá-la lança a mesma conta em ABERTO, com uma parcela só, editável em "Vence em" (resposta do dono, 2026-09-20)
- [x] **FNC-04**: O documento aceita data retroativa — é como se fecha o dia da cafeteria numa venda só, com várias linhas e quantidade
- [x] **FNC-05**: No cartão, o preço não muda; a taxa é gravada na parcela quando ela é paga — só na parcela que escolheu Cartão, nunca nas outras formas de um pagamento misto (D-08) — e entra no caixa o valor menos a taxa, e a soma das taxas aparece como "Taxa do cartão" no Geral do mês; mudar a taxa em Cadastros não reescreve o passado
- [x] **FNC-06**: A despesa tem dois caminhos: compra de material (o que chegou, quantos e quanto custou ao todo) e outra despesa (descrição, categoria, valor). Uma conta a pagar depois é a própria despesa à vista lançada com a caixinha "já paguei" desmarcada; para pagar uma conta que já existe, o caminho é Caixa → "A pagar" → "Paguei" (resposta do dono, 2026-09-20). **Atualização de 2026-09-26 (quick task 260926-qpv):** este requisito descrevia originalmente TRÊS caminhos, com um atalho "pagar conta que já existe" (link para o Caixa) dentro da própria tela de Despesa; o dono removeu o atalho depois de usar o módulo no celular — pareceu inútil e grande no uso real. O comportamento de pagar uma conta (Caixa → "A pagar" → "Paguei") não mudou, só o atalho de dentro da Despesa saiu
- [x] **FNC-07**: O Caixa mostra saldo, a receber, a pagar e "se tudo se cumprir", e as listas a pagar e a receber com as vencidas marcadas. O extrato navega por mês, com filtro por forma (Todas · Dinheiro · Pix · Cartão), e o total somado aparece nas QUATRO pílulas do filtro, inclusive "Todas" (04.4-13-PLAN.md, resposta ao item 13 da conferência do dono, 26/09/2026) — o "saldo depois" de cada linha continua o saldo acumulado global, mesmo com o filtro aplicado (D-11/D-12). As contas em aberto incluem as vendas e despesas à vista lançadas com a caixinha desmarcada, não só sinal/Nx e contas fixas
- [x] **FNC-08**: "Paguei"/"Recebi" pede valor, data e forma, e pode ser desfeito se foi dado por engano. Quando o valor difere do previsto e o documento tem mais de uma linha ou parcela, o sistema acrescenta sozinho uma linha "diferença" na categoria "Juros, multas e descontos"; desfazer remove essa linha e devolve a parcela ao valor previsto original — o inverso exato (D-01/D-02/D-03)
- [x] **FNC-09**: O extrato mostra o saldo depois de cada movimento, em ordem de data de pagamento e número; um lançamento retroativo recalcula os saldos seguintes. A navegação é por mês, e o saldo depois de cada linha é sempre o acumulado global, mesmo com o filtro por forma aplicado — o filtro esconde linhas, não recalcula saldo (D-11/D-12). O total somado do mês aparece em todas as quatro pílulas do filtro, inclusive "Todas" ("Total de todas as formas neste mês", nunca confundido com o saldo do tile — 04.4-13-PLAN.md)
- [x] **FNC-10**: Cancelar uma venda ou despesa não apaga: ela fica riscada no extrato, sai do saldo e do Mês, e guarda quem cancelou e quando; a confirmação diz o que vai acontecer
- [x] **FNC-11**: O Mês mostra quanto cada área vendeu, custou e deixou (pela data do documento), o Geral num bloco só sem rateio, o veredito "sobrou/faltou", o dinheiro que entrou e saiu (pela data de pagamento) e o que ficou fora do resultado
- [x] **FNC-12**: Categoria é dado editável com grupo (receita, custo, geral, fora) e área; ninguém escolhe área ao lançar; categoria com lançamento só desativa, e grupo e área não mudam depois do primeiro lançamento. Categoria nunca é apagada de verdade — toda remoção é desativação, reversível por "Reativar"; em produção nascem prontas as 24 categorias (as 23 do protótipo mais "Juros, multas e descontos") (D-14)
- [x] **FNC-13**: O catálogo guarda o que se vende e o que se estoca: preço ou "valor na hora", atalhos de venda e de compra, estoque com unidade e ficha técnica de um nível — e é o cadastro único de itens que o Estoque vai usar
- [x] **FNC-14**: Contas fixas têm valor esperado e dia; "Gerar as contas de <mês>" cria as contas a pagar e, rodado duas vezes, não duplica. Contas fixas têm cadastro completo: "+ Nova conta fixa" (nome, categoria, valor esperado, dia de vencimento) e desativar/reativar; conta fixa desativada fica fora de "Gerar as contas de <mês>" (D-13). "Gerar as contas de {mês}" tem um seletor com o mês corrente e os onze seguintes, com o mês seguinte ao de hoje pré-escolhido (resposta do dono, 2026-09-20)
- [x] **FNC-15**: A venda mostra o que tira do estoque e a compra o que põe, calculado por módulo puro e testado, sem gravar movimentação
- [x] **FNC-16**: As parcelas da Abertura que vencem a partir da virada entram como contas a pagar por um script único, com o rótulo "n de N"; Material vira custo e o resto vira "Equipamento e obra"; a Abertura não é alterada; o saldo inicial é informado pelo dono
- [x] **FNC-17**: Todas as telas funcionam de pé no celular — alvos de 44px, campos de 16px, estados vazio, carregando e erro

### Painel Inicial e Entrega

- [ ] **PNL-01**: O painel inicial responde "o que preciso fazer hoje?" sem nenhum clique
- [ ] **PNL-02**: O painel mostra encomendas por etapa
- [ ] **PNL-03**: O painel mostra as aulas de hoje
- [ ] **PNL-04**: O painel mostra os fornos em atenção ou crítico
- [ ] **PNL-05**: O painel mostra os alertas de estoque baixo
- [ ] **PNL-06**: Existe um manual de uso curto, com imagens, que uma pessoa nova consegue seguir sozinha
- [ ] **PNL-07**: Existe um documento de operação cobrindo criar usuário, redefinir senha, restaurar backup e o que fazer se o site cair, deixando explícito qual backup usar em cada caso

## v2 Requirements

Reconhecidos e adiados. Não estão no roadmap atual.

### Calculadora de Orçamento → Financeiro, parte 2 (desbloqueada em 2026-09-18)

- **ORC-01**: Calcular o preço de uma encomenda a partir das variáveis de entrada do ateliê
- **ORC-02**: Somar os custos de argila, esmalte, energia da fornada, mão de obra, embalagem e frete
- **ORC-03**: Aplicar margem conforme a regra das planilhas de precificação
- **ORC-04**: Escalonar desconto por volume
- **ORC-05**: Produzir a saída final (número, faixa ou documento de proposta)

> **Não está mais bloqueada.** As planilhas de precificação foram feitas e auditadas no Cowork em
> 2026-09-18. A calculadora virou a **parte 2 do Financeiro** (Precificação + Orçamento com PDF;
> orçamento aprovado cria a Venda), que vem logo depois da Fase 04.4 e ainda não tem fase. Os
> ORC-* serão reescritos a partir do protótipo da parte 2 quando a fase for criada.

### Financeiro da Escola

- **FIN-01**: Mensalidades, planos (mensal/trimestral/anual), taxa de matrícula e taxa de massa
- **FIN-02**: Controle de pagamento por aluna

> As regras estão bem documentadas e é um módulo natural e provavelmente valioso — mas foi
> conscientemente adiado. O schema de `alunas` e `matriculas` já suporta anexá-lo depois.

### Integrações entre módulos

- **INT-01**: Ligar uma encomenda a uma queima concreta do módulo de fornos
- **INT-02**: Módulo de Experiências (oficinas pontuais, 4 a 8 pessoas, em datas específicas)

> A INT-01 é possível e provavelmente desejável, mas fica fora da v1 para não acoplar dois módulos
> antes de os dois estarem em uso real.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Site institucional e loja Shopify | Continuam existindo separadamente. Nunca entram na plataforma. |
| ~~Estoque de peças acabadas~~ | **Retirado em 2026-09-19.** A regra ("vive no Shopify") era da AMASSA de Goiânia. Em Pirenópolis a peça pronta entra no Estoque, ao custo da precificação. |
| Portal para as alunas | O sistema é só para gestores (3 a 5 pessoas, todas com acesso total). |
| Cadastro público de usuários | Contas são criadas por linha de comando no servidor. |
| "Esqueci minha senha" por e-mail | Exigiria SMTP, configuração de domínio e mais uma conta para manter. Com 3 a 5 pessoas que se conhecem, um comando resolve em 10 segundos. |
| Ficha de cadastro de cliente nas encomendas | Cliente permanece texto livre. `cliente_nome` vira `cliente_id` no futuro sem migração destrutiva. |
| Valores, sinal e controle de pagamento nas encomendas | Avaliado e recusado nesta versão. |
| Fotos e anexos nas encomendas | Avaliado e recusado nesta versão. |
| RLS no Postgres | O banco não tem porta publicada; só a aplicação o alcança. RLS protegia contra uma API pública que deixou de existir. `exigirUsuario()` ocupa o lugar e é verificável em revisão. |
| Tema claro/escuro | Não na v1. |
| Biblioteca de Gantt pronta | O protótipo já resolve com CSS puro (18px/dia, posicionamento absoluto). Portar é mais barato e mais fiel do que dobrar uma biblioteca. |
| pgAdmin, Adminer ou similar exposto na web | É uma porta a mais para o banco sem ganho. `docker compose exec postgres psql` faz o mesmo, só de dentro do servidor. |
| Redux, Zustand ou outro gerenciador de estado global | TanStack Query só onde há interação otimista; o resto usa Server Components. |
| Sentry, APM, analytics | Todos custam ou viram ruído. Monitoramento que ninguém lê é só custo. |
| Atualização em tempo real entre dispositivos | Para 5 pessoas, sincronização ao vivo é complexidade sem benefício. Recarregar a página basta — e isso é deliberado. |
| `cron`, `pg_cron` ou worker em background na aplicação | As aulas usam materialização preguiçosa. O único agendamento do sistema é o `cron` do host, para o backup. |
| Conversão de unidades no estoque | Cada material vive na unidade em que foi cadastrado. Conversão é fonte clássica de erro silencioso de fator mil. |
| Ponto de venda, custo médio ponderado, relatórios de margem | Fora do escopo do módulo de estoque. |
| Bloqueio de turma com excesso de alunas | Na prática do ateliê, encaixar alguém acontece. É estado visual, não erro. |
| Exclusão de fornos | Destruiria o histórico de vida útil do equipamento, que é justamente o propósito do módulo. Fornos são desativados. |
| Exclusão de usuários | Quebraria o histórico de quem registrou cada queima e cada movimentação. Usuários são desativados. |
| Migração automática pelo pipeline | Uma migração ruim aplicada por um `git push` acidental não tem desfazer, e o banco agora é nosso. |
| Build do Next.js no servidor | Consome bastante RAM. Se estourar a memória do VPS durante um deploy, o site cai — e cai junto com o banco, que mora na mesma máquina. |

## Traceability

Preenchida durante a criação do roadmap (ver `.planning/ROADMAP.md`).

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-02 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-03 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-04 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-05 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-06 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-07 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-08 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-09 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| INFRA-10 | Phase 1 — Fundação e Primeiro Deploy | Complete |
| AUTH-01 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-02 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-03 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-04 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-05 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-06 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-07 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-08 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-09 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| AUTH-10 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-01 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-02 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-03 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-04 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-05 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-06 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| BKP-07 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-01 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-02 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-03 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-04 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-05 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-06 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-07 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-08 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| UI-09 | Phase 2 — Login, Banco Base e Casca da Aplicação | Complete |
| ENC-01 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-02 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-03 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-04 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-05 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-06 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-07 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-08 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-09 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-10 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-11 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-12 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-13 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-14 | Phase 3 — Gestor de Encomendas | Complete |
| ENC-03 | Phase 04.1 — Datas dos Marcos da Encomenda (reaberto) | Complete |
| ENC-04 | Phase 04.1 — Datas dos Marcos da Encomenda (reaberto) | Withdrawn |
| ENC-15 | Phase 04.1 — Datas dos Marcos da Encomenda | Complete |
| FOR-01 | Phase 4 — Contador de Queima | Complete |
| FOR-02 | Phase 4 — Contador de Queima | Complete |
| FOR-03 | Phase 4 — Contador de Queima | Complete |
| FOR-04 | Phase 4 — Contador de Queima | Complete |
| FOR-05 | Phase 4 — Contador de Queima | Complete |
| FOR-06 | Phase 4 — Contador de Queima | Complete |
| FOR-07 | Phase 4 — Contador de Queima | Complete |
| FOR-08 | Phase 4 — Contador de Queima | Complete |
| FOR-09 | Phase 4 — Contador de Queima | Complete |
| FOR-10 | Phase 4 — Contador de Queima | Complete |
| FOR-11 | Phase 4 — Contador de Queima | Complete |
| FOR-12 | Phase 4 — Contador de Queima | Complete |
| FOR-13 | Phase 4 — Contador de Queima | Complete |
| AGD-01 | Phase 5 — Agenda de Aulas | Pending |
| AGD-02 | Phase 5 — Agenda de Aulas | Pending |
| AGD-03 | Phase 5 — Agenda de Aulas | Pending |
| AGD-04 | Phase 5 — Agenda de Aulas | Pending |
| AGD-05 | Phase 5 — Agenda de Aulas | Pending |
| AGD-06 | Phase 5 — Agenda de Aulas | Pending |
| AGD-07 | Phase 5 — Agenda de Aulas | Pending |
| AGD-08 | Phase 5 — Agenda de Aulas | Pending |
| AGD-09 | Phase 5 — Agenda de Aulas | Pending |
| AGD-10 | Phase 5 — Agenda de Aulas | Pending |
| AGD-11 | Phase 5 — Agenda de Aulas | Pending |
| AGD-12 | Phase 5 — Agenda de Aulas | Pending |
| AGD-13 | Phase 5 — Agenda de Aulas | Pending |
| AGD-14 | Phase 5 — Agenda de Aulas | Pending |
| AGD-15 | Phase 5 — Agenda de Aulas | Pending |
| AGD-16 | Phase 5 — Agenda de Aulas | Pending |
| EST-01 | Phase 6 — Estoque | Pending |
| EST-02 | Phase 6 — Estoque | Pending |
| EST-03 | Phase 6 — Estoque | Pending |
| EST-04 | Phase 6 — Estoque | Pending |
| EST-05 | Phase 6 — Estoque | Pending |
| EST-06 | Phase 6 — Estoque | Pending |
| EST-07 | Phase 6 — Estoque | Pending |
| EST-08 | Phase 6 — Estoque | Pending |
| EST-09 | Phase 6 — Estoque | Pending |
| EST-10 | Phase 6 — Estoque | Pending |
| EST-11 | Phase 6 — Estoque | Pending |
| EST-12 | Phase 6 — Estoque | Pending |

| ABE-01 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-02 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-03 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-04 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-05 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-06 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-07 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-08 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-09 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-10 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-11 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-12 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-13 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-14 | Phase 4.2 — Abertura do Espaço | Pending |
| ABE-15 | Phase 4.2 — Abertura do Espaço | Pending |

| CMP-01 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-02 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-03 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-04 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-05 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-06 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-07 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-08 | Phase 04.3 — Comparador de Compras | Complete |
| CMP-09 | Phase 04.3 — Comparador de Compras | Complete |
| UI-10 | Phase 7 — Polimento e Entrega | Pending |
| UI-11 | Phase 7 — Polimento e Entrega | Pending |
| PNL-01 | Phase 7 — Polimento e Entrega | Pending |
| PNL-02 | Phase 7 — Polimento e Entrega | Pending |
| PNL-03 | Phase 7 — Polimento e Entrega | Pending |
| PNL-04 | Phase 7 — Polimento e Entrega | Pending |
| PNL-05 | Phase 7 — Polimento e Entrega | Pending |
| PNL-06 | Phase 7 — Polimento e Entrega | Pending |
| PNL-07 | Phase 7 — Polimento e Entrega | Pending |
| FNC-01 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-02 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-03 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-04 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-05 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-06 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-07 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-08 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-09 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-10 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-11 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-12 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-13 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-14 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-15 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-16 | Phase 04.4 — Financeiro, parte 1 | Complete |
| FNC-17 | Phase 04.4 — Financeiro, parte 1 | Complete |

**Coverage:**

- v1 requirements: 118 total (ENC-15 acrescentado na Fase 04.1; FNC-01..17 acrescentados em 2026-09-19 para a Fase 04.4)
- Mapped to phases: 118/118
- Unmapped: 0

**Distribuição por fase:**

| Phase | Milestone fonte | Requisitos | Contagem |
|-------|------------------|------------|----------|
| Phase 1 | M0 | INFRA-01..10 | 10 |
| Phase 2 | M1 | AUTH-01..10, BKP-01..07, UI-01..09 | 26 |
| Phase 3 | M2 | ENC-01..14 | 14 |
| Phase 04.1 | M2 (reabertura) | ENC-15 (novo), ENC-03 (reaberto), ENC-04 (retirado) | 1 |
| Phase 4 | M4 | FOR-01..13 | 13 |
| Phase 5 | M3 | AGD-01..16 | 16 |
| Phase 6 | M5 | EST-01..12 | 12 |
| Phase 7 | M7 | UI-10..11, PNL-01..07 | 9 |
| Phase 04.4 | M6 → Financeiro, parte 1 | FNC-01..17 | 17 |
| — | M6 → Financeiro, parte 2 (sem fase ainda) | ORC-01..05 (v2, a reescrever) | 0 |

---
*Requirements defined: 2026-08-05*
*Last updated: 2026-08-05 after roadmap creation — traceability filled, 99/99 requirements mapped*
