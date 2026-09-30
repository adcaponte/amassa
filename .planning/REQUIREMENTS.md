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
  > 🔁 **Substituído pela Fase 04.6 (GES-12), commit `c3b4493` (plano 04.6-05), 2026-09-28.** A
  > barra provisória de 5 itens deu lugar a Início · Financeiro · Produção · Agenda (4 itens no
  > celular). O texto acima **continua verdadeiro como registro histórico do que esteve no ar
  > entre a Fase 04.4 e a Fase 04.6** — não é apagado, só deixa de descrever o presente.

- [x] **UI-03**: No desktop, a barra lateral de 240px tem os mesmos itens mais o menu do usuário no rodapé
- [x] **UI-04**: Orçamentos aparece no menu do usuário, não na navegação principal
  > **Verdadeiro entre 2026-09-26 e 2026-09-28** — conferido em `components/amassa/menu-usuario.tsx`: o item ficou no menu, apontando para `/financeiro?aba=orcamentos` desde a Fase 04.5 (ORC-17).
  > 🔁 **Substituído pela Fase 04.6 (GES-13), commit `79429b4` (plano 04.6-05), 2026-09-28.** O
  > menu do usuário enxugou para Abertura do Espaço · Trocar senha · Sair — Orçamentos saiu dele
  > porque já vive dentro do Financeiro (ORC-17 continua valendo).

- [x] **UI-05**: A navegação funciona confortavelmente com o polegar, no celular
- [x] **UI-06**: Nenhuma tela exige rolagem horizontal no celular
- [x] **UI-07**: Toda tela tem estado vazio com frase de contexto e botão, estado de carregamento com esqueleto, e estado de erro em linguagem humana
- [x] **UI-08**: Toda remoção pede confirmação nomeando o que será perdido
- [x] **UI-09**: Alvos de toque têm no mínimo 44px, contraste passa em AA, formulários navegam por teclado e botões só com ícone têm `aria-label`
- [ ] **UI-10**: Nenhum erro aparece no console do navegador em uso normal
- [ ] **UI-11**: O sistema carrega em menos de 3 segundos em 4G

### Encomendas

> *29/09/2026:* os ENC-* abaixo descrevem o modelo por calendário (Fases 3 e 04.1) e continuam
> como registro do que foi entregue. **A Fase 06.1 (Produção) os substitui** pelos PRD-01..20 — etapa
> marcada como feita em vez de deduzida da data, quadro por etapa, folhas A4 novas (PRD-19/20 no lugar
> do ENC-14). Nenhum ENC-* foi desmarcado: eram verdade no modelo antigo.

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

### Produção — redesenho das Encomendas (Fase 06.1)

> Transcrição do `BRIEFING.md` de 20/09/2026 e do `prototipo.html` aprovado ("Produção AMASSA"),
> copiados para `.planning/phases/06.1-producao/` em 29/09/2026. O protótipo vence sobre a interface;
> o briefing vence sobre regra de dado que a tela não mostra. Substituem o modelo por calendário dos
> ENC-* (Fase 3 e 04.1), que ficam acima como registro.

- [ ] **PRD-01**: O módulo se chama **Produção** e a tela principal responde "o que está em produção e em que etapa está" (§1, §2.3). *A rota — `/gestao/producao` com redirecionamento ou manter `/gestao/encomendas` — é a única questão aberta do briefing (§9) e fica para a discussão da fase.* **Decidido na discussão (29–30/09/2026, `06.1-CONTEXT.md` D-03 e D-17):** `/gestao/producao`, com `/gestao/encomendas*` redirecionando por 6 meses.
- [ ] **PRD-02**: O esquema de Encomendas é refeito do jeito que servir à Produção; os dados de teste são apagados, sem migração de dados (§1 — confirmado pelo dono em 20/09 e de novo em 29/09/2026: "pode sim zerar todos os dados. nada é real ainda."). Apagar tabela em produção é migração aplicada pelo dono, à mão, depois de backup
- [ ] **PRD-03**: Etapa se marca como feita — "Terminei: {etapa}" — em um toque, guardando a data real, com "Desfazer a última"; a situação deixa de ser deduzida da data (§2.1)
- [ ] **PRD-04**: Dois caminhos: **completo** (produção → secagem → queima de biscoito → esmaltação → queima de esmalte → entrega/guardar) e **termina no biscoito** (produção → secagem → queima de biscoito → fim) (§2.2)
- [ ] **PRD-05**: Quadro por etapa — seis colunas no computador, seções empilhadas no celular — com filtros Tudo · Encomendas · Da casa; horas de trabalho **não** aparecem no quadro, só dentro da ordem (§2.3, §5)
- [ ] **PRD-06**: A ordem anda inteira: a etapa só termina quando todas as peças passaram; o parcial ("já passaram 18 de 30") é campo opcional que aparece no cartão e não move a ordem (§2.4)
- [ ] **PRD-07**: Linha do tempo como segunda vista (alternador Quadro | Linha do tempo que lembra a escolha): uma linha por ordem, trecho cheio = aconteceu, listrado = previsto, linha de hoje, traço da entrega prometida, nome fixo à esquerda e barras que rolam de lado no celular; ordem aguardando o sinal não aparece (§2.5, §5)
- [ ] **PRD-08**: Peças a mais, de segurança, por peça da ordem; o cliente não vê nem paga as peças a mais (§2.6, §2.7). *Refinado pelo dono em 30/09/2026 (`06.1-CONTEXT.md` D-15): só em **encomenda**, como no protótipo e no §2.6 ("por peça da encomenda"); na produção da casa todas as boas vão para o estoque.*
- [ ] **PRD-09**: Dois tipos de ordem: **Encomenda** (nasce de orçamento aprovado ou de "Nova ordem", tem cliente, termina em Entrega) e **Produção da casa** (nasce de "Nova ordem", sem cliente, termina em Guardar no estoque) (§3)
- [ ] **PRD-10**: A ordem vinda de orçamento carrega título, cliente, peças com quantidade, cor, personalização, fotos de referência (as do orçamento, sem duplicar arquivo), a ficha de cada peça (gramas, medidas, horas, custo) e os vínculos orçamento ↔ venda ↔ ordem, navegáveis nos dois sentidos; substitui a criação provisória de encomenda da Fase 04.5 (§3)
- [ ] **PRD-11**: A ordem vinda de orçamento nasce **aguardando o sinal**, fora do quadro e sem contar prazo; a liberação é manual, na própria Produção ("Sinal recebido — começar" / "Começar assim mesmo"), e o início passa a ser a data da ativação; a tela só mostra, para consulta, se a parcela do sinal já consta como recebida no Caixa (§3)
- [ ] **PRD-12**: Prazos: cada etapa tem dias previstos (os padrões atuais — *refinado pelo dono em 30/09/2026, `06.1-CONTEXT.md` D-10: os atuais com a espera somada à etapa seguinte, 5 · 15 · 1 · 1 · 4 · 6*) e, quando feita, data real; os previstos só se ajustam nas etapas futuras (− / +); "dias nesta etapa", "previsão de conclusão" e o selo na prioridade *aguardando o sinal* · *vai atrasar N dias* · *+N dias nesta etapa* · *no ritmo*; a regra dos marcos e da espera da Fase 04.1 deixa de existir; tudo em módulo puro `lib/producao/`, testado, que recebe "hoje" (§4)
- [ ] **PRD-13**: Três números no topo — em produção (ordens e peças) · esperando o forno · aguardando sinal — e a fila **esperando o forno**: ordens cuja etapa atual é uma queima, com fornadas estimadas = Σ peças que ainda não passaram ÷ quantas cabem (da precificação, pelas medidas), dita como estimativa (§5)
- [ ] **PRD-14**: Material usado: previsto por ordem = Σ (gramas da ficha × peças feitas, com as a mais) para argila e esmalte, "baixado X de Y kg" e aviso quando passa do previsto; Baixa total (preenchida com o que falta) · Baixa parcial · "+ Dar baixa de outro material", perguntando qual item do Estoque; cada baixa é movimentação do Estoque com origem `manual`, destino "consumo em encomenda" e vínculo real com a ordem; baixa é opcional; cancelar a ordem não devolve material (a tela avisa) (§6)
- [ ] **PRD-15**: Conclusão: a tela pergunta só **quantas se perderam** por peça e deriva o resto — feitas = pedido + a mais; boas = feitas − perdidas; entregues = mín(pedido, boas); extras boas = máx(0, boas − pedido) (na produção da casa, todas as boas); faltam = máx(0, pedido − boas), que permite "Concluir como entrega parcial", com aviso (§7)
- [ ] **PRD-16**: Destino das extras boas: entram no Estoque como pronta entrega (origem `producao`, custo da ficha de precificação) ou ficam sem destino; sugestão automática — peça exclusiva → sem destino, peça de linha → Estoque —, sempre trocável; peça exclusiva que for para o estoque vira item do catálogo, conduzida pela tela (§7). *Fecha a pendência do EST-21: a entrada de peça pronta deixa de ser só manual.*
- [ ] **PRD-17**: Perda técnica (perdidas ÷ feitas) e extras sem destino guardados **separados**, por ordem e por peça; a Precificação mostra o acumulado ("perda medida nos últimos N meses: X%") ao lado do parâmetro "perda", e trocar o parâmetro continua manual (§7)
- [ ] **PRD-18**: Concluir uma encomenda não mexe em parcela — o saldo a receber continua no Caixa; cancelar a ordem **não** cancela a venda, e a tela diz isso e manda decidir o sinal no Financeiro (§7)
- [ ] **PRD-19**: **Folha da ordem** A4, de bancada: nome, cliente, número, início e entrega; peças com pedido · a mais · fazer, argila por peça e medidas; cor e personalização; fotos de referência; etapas com caixa de marcar, "feita em" e "quantas passaram" em branco (as feitas vêm marcadas); material previsto; "perdidas / extras boas"; pauta de anotações; **sem preço nem custo** (§7.1)
- [ ] **PRD-20**: **Folha geral** A4 — o quadro no papel, ordens por etapa com peças, dias na etapa, entrega e caixa de "feito", aguardando sinal no fim; as duas folhas com rodapé "folha impressa em {data} · o que vale é o que está na plataforma", por CSS de impressão, sem PDF no servidor; substitui a folha A4 do ENC-14 (§7.1)

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

- [x] **EST-01**: Cadastrar 5 kg de argila, dar baixa de 2 kg, e o saldo mostrar exatamente 3 kg
- [x] **EST-02**: **Não existe cadastro próprio de materiais.** O Estoque trabalha sobre os itens de `itens_catalogo` (Fase 04.4) com `controla_estoque`: unidade e categoria vêm do item; o Estoque acrescenta ao item só o que é dele — **mínimo** e **observações**. Saldo e custo médio são **derivados** das movimentações, nunca campo editável *(corrigido em 29/09/2026 pela §6 do `ADENDO.md` de 20/09 — o texto anterior está no histórico do git)* — o texto antigo pedia organização em cerâmica, pintura e bordado, com custo e fornecedor como campos do material
- [x] **EST-03**: Item abaixo do mínimo aparece destacado na lista e no bloco **"Estoque acabando" do Início** (alimentado por `lib/estoque/consultas`, ADENDO §4) *(corrigido em 29/09/2026 pela §6 do `ADENDO.md` de 20/09 — o texto anterior está no histórico do git)*
- [x] **EST-04**: Item com estoque mínimo zero nunca entra em alerta *(corrigido em 29/09/2026 pela §6 do `ADENDO.md` de 20/09 — o texto anterior está no histórico do git)*
- [x] **EST-05**: O histórico mostra toda movimentação com autor, data e tipo
- [x] **EST-06**: Não existe nenhuma forma de editar ou apagar uma movimentação pela interface — só registrar um ajuste
- [x] **EST-07**: No tipo `ajuste`, a tela pede o saldo contado na prateleira, não a diferença
- [x] **EST-08**: Um ajuste que dá diferença zero não grava nada e responde "Conferido. O saldo já estava correto."
- [x] **EST-09**: Registrar uma baixa no celular leva menos de 15 segundos *(aprovado pelo dono em 29/09/2026 sem o tempo medido registrado — o e2e da 06-06 prova os 4 toques a partir de Saldos, não o tempo)*
- [x] **EST-10**: O saldo mostrado bate com a soma manual do histórico
- [x] **EST-11**: A origem de toda movimentação é `venda`, `compra`, `producao` ou `manual`. As saídas manuais são: consumo em aula (**texto livre** até a Agenda existir) · consumo em encomenda (**referência opcional à encomenda real**, não texto livre) · consumo na cafeteria (só o que não passa por venda — degustação, consumo interno) · uso do ateliê · perda ou quebra. **"Venda na loja" não é saída manual**: venda só nasce no Financeiro (ADENDO §3) *(corrigido em 29/09/2026 pela §6 do `ADENDO.md` de 20/09 — o texto anterior está no histórico do git)* — o texto antigo previa vínculo com aula, **fornada** ou encomenda; o adendo não lista fornada entre os destinos
- [x] **EST-12**: A lista de saldos tem busca e filtro por **área do Financeiro** (Cafeteria · Espaço · Peças · Loja · Geral), herdada da categoria de compra do item e, na falta, da de venda — não uma segunda classificação do Estoque (ADENDO §2) *(corrigido em 29/09/2026 pela §6 do `ADENDO.md` de 20/09 — o texto anterior está no histórico do git)*
- [x] **EST-13**: "Novo material" no Estoque cria um item de `itens_catalogo` com `controla_estoque = true`, com a mesma validação do Cadastros; e item criado pelo Cadastros com `controla_estoque` aparece no Estoque sozinho (ADENDO §1)
- [x] **EST-14**: Lançar uma venda no Financeiro grava a movimentação de estoque **na mesma transação do documento** — item com estoque baixa ele mesmo; item com ficha técnica baixa cada insumo — usando o cálculo que `lib/financeiro/efeito-estoque.ts` já faz, **sem recalcular por outro caminho** (a Fase 04.4 só *mostra* esse efeito; a Fase 6 passa a *gravá-lo*) (ADENDO §3)
- [x] **EST-15**: Uma compra de material no Financeiro dá entrada no estoque na mesma transação, com custo = valor da linha ÷ quantidade (ADENDO §3)
- [x] **EST-16**: Cancelar uma venda ou uma compra gera **movimentação de estorno** com a mesma referência; nenhuma movimentação é apagada (ADENDO §3)
- [x] **EST-17**: Vendas e compras lançadas antes de o Estoque existir **não** geram movimentação retroativa. O Estoque começa por **contagem**: saldo inicial por item, como entrada manual com custo, e a primeira abertura da tela conduz essa contagem (ADENDO §3 e §6 — o estoque inicial não vem mais de importação da Abertura)
- [x] **EST-18**: Saldo negativo é permitido **com aviso** e **nunca bloqueia uma venda** (ADENDO §3)
- [x] **EST-19**: Cada saída grava o **custo médio do instante** do lançamento; no cálculo, dinheiro em centavos inteiros e quantidade em milésimos inteiros, como a Fase 04.4 já faz (ADENDO §4)
- [x] **EST-20**: O item-insumo mostra onde é gasto pela ficha técnica ("gasto por: Café 200 ml (15 g), …"); editar a ficha continua em Cadastros → Catálogo (ADENDO §4)
- [x] **EST-21**: Categoria **"Peça pronta"** (área Peças): itens vendáveis com estoque. Até a Produção ser redesenhada, a entrada é manual, informando o custo — o da ficha de precificação, quando houver (ADENDO §4)

> **EST-01..21 marcados `[x]` em 29/09/2026, no fechamento do plano 06-11 (portão aprovado pelo
> dono no chat: "repassei toda verificação. o cowork tambem verificou. Aprovado.").** A fase está
> no ar desde o merge `2345850` (run `36587755269` verde; `/api/health/estoque` 200). Evidência de
> cada um, além da aprovação: os e2e da fase (`tests/e2e/estoque-*.spec.ts`, verdes na varredura do
> 06-11 e no pipeline) e os testes unitários e de migração (`npm run verificar`, 1627 testes,
> `test:migracoes`), **e** a verificação do Cowork em produção (`Claude outputs/estoque/VERIFICACAO-COWORK-06.md`,
> fora do git), passo a passo: EST-01 (passos 3–4), EST-02 (1, 9), EST-03 (5), EST-04 (1: "sem
> mínimo", nenhum alerta), EST-05 (6), EST-06 (7–8), EST-07 (8), EST-08 (7 — o texto na tela é
> "O saldo já está certo. Nada será gravado." na prévia; o toast "Conferido. O saldo já estava
> correto." é o de `lib/estoque/textos.ts`), EST-10 (6), EST-11 (4), EST-12 (1: pílula "Peças"),
> EST-13 (1), EST-14 (10–11), EST-15 (a "Compra nº 21 · Boleira 25cm · 5 un · R$ 10,00" de alguém
> da casa entrou como "do Financeiro", R$ 2,00/un), EST-16 (13; compra cancelada só pelo e2e
> `estoque-financeiro` (g)), EST-17 (15, a contagem do dono e o Passo 5 do Roteiro 15 com 0
> movimentações logo depois da migração), EST-18 (12), EST-19 (leitura de `lib/estoque/custo.ts`
> contra as decisões; valores provados pelos unitários), EST-20 (10), EST-21 (só e2e
> `estoque-movimentacao` (g) e unitários — o Cowork não lançou peça pronta). **EST-09 é a exceção:** só
> a aprovação do dono, sem o tempo medido.

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

### Financeiro — parte 2: Precificação e Orçamento (Fase 04.5)

> Reescritos em 2026-09-26 a partir de `.planning/phases/04.5-financeiro-parte-2/BRIEFING.md` e do
> protótipo "Orçamentos AMASSA", aprovado pelo dono em 2026-09-19, mais as duas decisões dele de
> 2026-09-26 (navegação e numeração). **Substituem os ORC-01..05 da v2**, que eram uma frase cada,
> escritas antes de a planilha de precificação ser auditada. O prefixo continua `ORC`.

- [x] **ORC-01**: O cálculo mora em módulo puro (`lib/precificacao/`), testado com Vitest, sem importar React nem o cliente do banco: material (argila + esmalte), trabalho, queima, embalagem, custo com perda única, preço mínimo por canal e o "preço zero". Todo percentual do preço entra **dividindo**, nunca somando (fórmula do Sebrae, auditada em agosto); divisor de **5% ou menos** é erro de parâmetro — a tela avisa e não calcula (o texto original dizia "≤ 0"; corrigido em 2026-09-27 depois de o dono medir na tela e preferir a guarda mais larga do código)
- [x] **ORC-02**: Quantas peças cabem no forno sai das **medidas** — por prateleira (as duas orientações, com folga entre peças) × níveis (altura útil ÷ altura da peça + prateleira e pilar) —, **nunca do volume**, que erra cerca de 2× em peça plana. `cabem_biscoito` deriva de `cabem_esmalte` por um fator. Os dois campos "já contei" da ficha substituem o calculado, e peça que não cabe no forno dá aviso, sem número
- [x] **ORC-03**: Os parâmetros do cálculo têm **histórico**: mudar um valor cria registro novo com data, nunca sobrescreve (chave, valor, medido, vigente_desde). Cada um carrega o selo **estimado | medido**. A taxa do cartão **não é duplicada** — é lida da parte 1. Todos nascem "estimado", e 🔴 **nenhum valor real vai para seed versionado**: a planilha v2 teve a lógica auditada, mas os números eram esboço
- [x] **ORC-04**: "Calcular minha hora" transforma retirada desejada mais a parte dos custos da casa que a produção paga, dividida pelas horas realmente produzindo, no valor da hora — é assim que custo fixo entra no preço. **Não há rateio no Financeiro**
- [x] **ORC-05**: A ficha de uma peça **de linha** e o item do catálogo compartilham **um** preço praticado (o `preco_venda` do `itens_catalogo`), não dois campos a sincronizar; criar a ficha cria ou vincula o item, na categoria de venda escolhida, e o custo calculado é o valor com que a peça pronta entrará no Estoque (fase futura). A ficha **exclusiva de um pedido** não aparece na lista nem no catálogo, pode nascer copiando outra ("começar a partir de"), e desmarcar "exclusiva" a promove a peça de linha. Ficha usada em orçamento não se apaga — a tela diz em quantos ela está
- [x] **ORC-06**: A ficha mostra de onde vem cada parcela do custo e marca o preço praticado com um selo: **≥ mínimo verde · ≥ zero amarelo · abaixo vermelho**. Canais: venda direta/encomenda (comissão 0) e galeria/consignado
- [x] **ORC-07**: O orçamento percorre **rascunho → enviado → aprovado | recusado**. **Expirado é derivado** (data + validade < hoje), nunca um status gravado. Aprovado **trava**: refazer é **Duplicar**, que gera rascunho novo com número novo
- [x] **ORC-08**: O rascunho calcula ao vivo; **"Marcar como enviado" congela**. O snapshot guarda, por linha, nome, custo, mínimo, zero, horas e quantas cabem, mais imposto + taxa e a contagem de parâmetros estimados que entraram. Depois disso, mudar parâmetro ou ficha **não altera** o orçamento. Enviar exige cliente e pelo menos uma peça
- [x] **ORC-09**: "Atualizar preços" compara, peça a peça, o mínimo congelado com o mínimo de hoje (mudança de parâmetro **ou** de ficha conta) e sugere preço **mantendo a razão preço ÷ mínimo** da época, arredondado (até R$ 50: inteiro acima; acima disso: múltiplo de 5) e editável. Confirmar guarda a revisão anterior, sobe `revisao`, volta a rascunho e renova a validade com a data de hoje; projeto e frete não mudam sozinhos. No rascunho, o mesmo botão confere cada preço contra o mínimo de hoje e sobe o que estiver abaixo
- [x] **ORC-10**: O painel **"Só para você"** — custo, sobra depois de imposto e taxa, horas de trabalho, fornadas ocupadas, aviso de estimados e histórico de revisões — existe na tela e **nunca** no PDF
- [x] **ORC-11**: Aprovar executa **uma transação**: cria a venda na parte 1 (uma linha por peça com a cor na descrição, linhas de projeto e frete, categoria "Encomendas", parcelas conforme o plano), com o 🔴 **sinal nascendo em aberto e vencendo hoje** e o saldo vencendo na entrega prevista; e, se marcado, cria a encomenda no módulo atual (nome = título, cliente, itens com quantidade, cronograma padrão), com cor, personalização, fotos e ficha alcançáveis a partir dela. Os vínculos ficam gravados nos dois sentidos, e **cancelar a venda não apaga nem reabre o orçamento** — só mostra o aviso nos dois lados
- [x] **ORC-12**: O número é **`ORC-2026-001`, sequencial por ano e nunca reaproveitado** — orçamento cancelado mantém o número (decisão do dono, 2026-09-26). A revisão aparece junto do número no documento do cliente
- [x] **ORC-13**: O documento do cliente é gerado **no servidor**, em A4, com o mesmo conteúdo da tela "Ver como o cliente vê": logo no topo (arquivo trocável, não constante no código), número e revisão, data, validade, cliente, tabela de peças, projeto, frete, total, Referências, pagamento, prazo, observações, a frase de confirmação e a nota do feito à mão. **Sem endereço, contato ou chave Pix**, e 🔴 **nenhum custo, mínimo, margem ou hora**. A técnica de geração tem duas restrições: custo recorrente zero e caber na imagem Docker atual (medir o peso antes de adotar um Chromium embutido)
- [x] **ORC-14**: Até **3 fotos de referência** por orçamento, com legenda. A foto é aceita como vem do celular (até ~15 MB), **reduzida no servidor** para no máximo 1600 px no lado maior, gravada em JPEG **sem metadados** (EXIF/GPS), e **só a versão reduzida** fica em disco. O tipo real do arquivo é validado no servidor, não pela extensão; remover foto pede confirmação
- [x] **ORC-15**: Os arquivos ficam em **volume Docker próprio**, fora do banco e fora do repositório — o banco guarda só o caminho —, e são servidos **apenas por rota autenticada** que começa por `exigirUsuario()`, nunca por pasta pública
- [x] **ORC-16**: 🔴 O volume das fotos entra na **rotina diária de backup com cópia externa** (incremental), `/api/health/backup` passa a cobrir também as fotos, e o roteiro de restauração é atualizado e conferido
- [x] **ORC-17**: **Orçamentos** e **Peças** vivem dentro do Financeiro, como abas ao lado de Venda e Caixa; **Parâmetros** fica em `/cadastros` (decisão do dono, 2026-09-26). A casca vazia `/orcamentos` é substituída
- [x] **ORC-18**: Todas as telas da fase funcionam de pé no celular — alvos de 44px, campos de 16px, estados vazio, carregando e erro em cada uma

### Plataforma em `/gestao`, Início novo, navegação e site público (Fase 04.6)

> Escritos em 2026-09-28 a partir de `.planning/phases/04.6-gestao-inicio-e-site-publico/`:
> `BRIEFING-gestao.md` + `prototipo-gestao.html` ("Início AMASSA", aprovado pelo dono em
> 2026-09-20) e `BRIEFING-site.md` + `prototipo-site.html` ("AMASSA CERRADO", aprovado em
> 2026-09-26). **O protótipo vence sobre a interface; o briefing vence sobre regra de dado.**
> Nenhum destes requisitos foi planejado ainda — a fase espera a discussão com o dono
> (`Claude outputs/gestao/DISCUSSAO-PREPARADA.md`).
>
> **Não existia nenhum requisito de página "Em breve"** no `REQUIREMENTS.md` nem no `ROADMAP.md`
> — conferido por busca em 2026-09-28. A instrução da fila para derrubá-los não tinha alvo; a
> decisão do dono de 2026-09-26 (não há "Em breve") entra aqui como contexto, não como remoção.

**Endereço e isolamento**

- [x] **GES-01**: Tudo que hoje responde na raiz responde em `/gestao` — telas autenticadas e
  login. `/api/health` e `/api/health/backup` **ficam onde estão**, porque o monitoramento
  externo aponta para elas

- [x] **GES-02**: Os endereços antigos conhecidos (`/encomendas`, `/financeiro`, `/cadastros`,
  `/queimas`, `/abertura`…) redirecionam para `/gestao/...` por um período, **listados
  explicitamente** — nenhum coringa que engula rota futura do site. O que não existir cai no 404
  público

- [x] **GES-03**: O proxy protege **só** `/gestao`. A raiz e as páginas do site não leem sessão
  nem banco

- [x] **GES-04**: `AUTH_URL`, `callbackUrl` e cookies levam o login de volta para dentro de
  `/gestao`, conferido **em produção** — o defeito do `0.0.0.0:3000` de 2026-09-17 é o precedente
  a não repetir
  > **Cumprido em 29/09/2026, em produção — e só por isto.** Evidência: `curl` de fora em
  > 29/09/2026 — `/gestao` → 307 para
  > `https://amassacerrado.com.br/gestao/login?callbackUrl=https%3A%2F%2Famassacerrado.com.br%2Fgestao`
  > (o `callbackUrl` é o domínio público, não `0.0.0.0:3000`); o dono entrou, saiu, entrou de novo e
  > testou duas abas no celular, e editar a URL para `/gestao` abriu a plataforma ainda logado, sem
  > credencial (o cookie sobreviveu à mudança de rota). `AUTH_URL` no servidor: sem linha no
  > `.env`, vale o padrão sem caminho do `compose.yml`. `04.6-VERIFICACAO-HUMANA.md`, item 0.

- [x] **GES-05**: `robots.txt` bloqueia `/gestao`, as telas da plataforma trazem `noindex`, e
  **nenhuma página pública tem link para a plataforma** — acesso só por endereço

- [x] **GES-06**: O 404 da raiz é público e não revela nada da plataforma; o 404 dentro de
  `/gestao` mantém a casca

**Início**

- [x] **GES-07**: O Início mostra, de cima para baixo: a saudação; as **pílulas de atalho** para os
  módulos fora da barra; os cinco blocos, nesta ordem — Agenda de hoje (com "Agora no espaço: N
  pessoas"), O que vence, Produção, Estoque acabando e Anotações; e, **depois** deles, o índice de
  todos os módulos. **Sem saldo** (decisão do dono)
  — **Corrigido em 29/09/2026, pela verificação da fase:** este requisito dizia que as pílulas vinham
  "depois dos blocos". Não vêm, e nunca vieram: o protótipo aprovado as põe ANTES
  (`prototipo-gestao.html:217`, `telaInicio()`: saudação → `.pilulas` → `.dia` com os blocos), o plano 06
  seguiu o protótipo, e o código também (`app/gestao/(app)/page.tsx`: `<PilulasDeAtalho />` na linha 44,
  os blocos de 59 a 75, `<IndiceDosModulos />` na 80). O protótipo vence sobre a interface, então quem
  estava errado era o texto; o índice, esse sim, sempre esteve depois
  — **Alterado em 29/09/2026, no portão de verificação humana da própria fase (item 13):** este
  requisito dizia "Agora no espaço: N de **M lugares**". O denominador vinha do protótipo aprovado
  ("3 de 10 lugares"), nunca de uma medição do espaço. Perguntado quantos lugares o espaço tem, o
  dono respondeu que a pergunta não se aplica — "no espaço em si pode ser que caiba mais, pode ser
  que eu coloque umas mesas a mais na parte externa" — e que a gestão é dele, no dia, "de acordo
  com as pessoas que estão e o que estão fazendo". A linha permanece como CONTAGEM, que é o número
  que alimenta essa decisão; a fração saiu. **Não afeta o limite por turma**, que é outra coisa e
  segue valendo na Fase 5 (AGD-02/03/04)

- [x] **GES-08**: Cada bloco tem estado **vazio, de carregamento e de erro próprios**, com as
  frases do protótipo. Bloco que falha não derruba a página: o erro fica só naquele bloco

- [x] **GES-09**: Cada bloco consulta o seu módulo por `lib/<modulo>/consultas`; o Início **não
  tem regra de negócio própria**. Bloco de módulo que ainda não existe mostra só o estado vazio

- [x] **GES-10**: As anotações são **uma folha só, da casa** — tabela de uma linha, o que um
  escreve o outro vê. Salvam sozinhas com indicador, guardam **quem salvou por último e quando**,
  e avisam se o texto mudou no servidor antes de sobrescrever. Texto puro, tamanho validado no
  servidor, dentro do backup por estar no banco

- [x] **GES-11**: A saudação usa o nome do usuário logado e a data de hoje

**Navegação**

- [x] **GES-12**: A barra de baixo do celular tem **Início · Financeiro · Produção · Agenda**. A
  barra lateral do computador tem Início mais todos os módulos. Módulo novo entra no índice e na
  lateral, **nunca na barra de baixo**

- [x] **GES-13**: O menu do usuário fica com **Abertura do Espaço** (até ser arquivada), Trocar
  senha e Sair — Orçamentos sai dele, porque já vive dentro do Financeiro (ORC-17)

- [x] **GES-14**: "Produção" é **só o rótulo novo** de Encomendas nesta fase: muda o nome no menu
  e nos títulos; a rota pode continuar `/gestao/encomendas` até o redesenho decidir. Nada do
  redesenho é antecipado

**Site público**

- [x] **SIT-01**: A raiz serve uma página única pública, sem login, com as seções na ordem do
  protótipo: faixa "em construção" · abertura · o espaço · aulas e oficinas · encomendas · faixa
  da fachada · onde fica e contato · rodapé

- [x] **SIT-02**: 🔴 **A página é estática e continua no ar com o Postgres derrubado.** Os textos
  vêm de arquivo de conteúdo versionado e as imagens de `public/site/`; nada lê sessão. Só a
  seção da agenda lê o banco, com cache e revalidação por tempo, nunca a cada visita
  > **Deferimento explícito (plano 08, 2026-09-28) — não leia este `[x]` como cumprido por
  > inteiro.** A metade que sobe nesta fase — estática, sem sessão, provada de fora por
  > `npm run test:site-sem-banco` derrubando o Postgres de verdade (plano 03) — está cumprida e
  > provada. A segunda metade do enunciado original, "a seção da agenda lê o banco com cache e
  > revalidação", **não existe ainda**: enquanto a Agenda não existir, essa seção mostra o estado
  > "sem Agenda" (D-16, SIT-07), sem ler banco nenhum. Fica para a Fase Agenda, por D-03/D-15/D-16
  > e SIT-07 — deferimento registrado, não lacuna esquecida.

- [x] **SIT-03**: Trocar um texto ou uma foto é **commit e deploy** — nenhuma tabela nova. O
  cadastro editável pelo `/gestao` fica para depois, e o arquivo de conteúdo vira o valor inicial
  dele quando existir

- [x] **SIT-04**: O site sobe **com os colchetes** onde falta dado real, e com a faixa "em
  construção". **Nenhum dado de cliente** no repositório; endereço, horário, telefone comercial e
  Instagram são públicos por natureza

- [x] **SIT-05**: Os botões fixos "Agenda" e "Encomendas" ficam sempre visíveis — barra superior
  no computador, barra inferior no celular — e rolam até a seção, com a âncora **abaixo** da barra
  fixa, não escondida atrás dela

- [x] **SIT-06**: Os botões de WhatsApp apontam para `https://wa.me/55<número>` com mensagem
  pré-preenchida por contexto; o número é campo do arquivo de conteúdo

- [x] **SIT-07**: ⚠️ **Enquanto a Agenda não existir**, a seção de aulas mostra o texto de
  apresentação e o caminho do WhatsApp, **sem calendário** — não inventa dado nem expõe a agenda
  antiga. O calendário liga quando a fase Agenda entrar

- [x] **SIT-08**: SEO básico: título, descrição, Open Graph com a foto de abertura, `robots`
  liberado e sitemap. Critério do dono: aparecer no Google para "amassa cerrado pirenópolis"

- [x] **SIT-09**: Imagens servidas otimizadas, com `alt` vindo do arquivo de conteúdo
- [x] **SIT-10**: Acessibilidade e celular como no resto: alvos de 44px, sem rolagem lateral a
  320px, contraste AA

> **Relação com PNL-01..PNL-05 (Painel Inicial, Phase 7) — decisão registrada no plano 08,
> 2026-09-28, não subentendida.** O Início desta fase cumpre, **na prática**, quatro dos cinco:
> PNL-01 (responder "o que preciso fazer hoje" sem clique — os cinco blocos do Início fazem
> exatamente isso), PNL-02 (bloco "Produção" mostra encomendas por etapa), PNL-03 (bloco "Agenda de
> hoje" mostra o dia, ainda que estático até a Fase 5 existir) e PNL-05 (bloco "Estoque acabando").
> **PNL-04 (fornos em atenção ou crítico) fica de fora do Início por decisão** — não está entre os
> cinco blocos do protótipo aprovado (`prototipo-gestao.html`) nem do briefing, e não é antecipado
> aqui. PNL-04 **continua da Phase 7**, sem outro plano assumido. Os checkboxes de PNL-01..05
> permanecem `[ ]` na tabela abaixo — a decisão de que o Início desta fase os cumpre **na prática**
> é uma nota de rastreabilidade, não uma marcação de conclusão fora da fase dona do requisito
> (Phase 7); quando a Phase 7 for planejada, ela decide se reafirma PNL-01..03/05 como já
> resolvidos ou se ainda tem escopo próprio sobre eles (ex.: UI-10/UI-11, medidos sobre o sistema
> inteiro).

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

### Calculadora de Orçamento → Financeiro, parte 2 — **PROMOVIDA À v1 em 2026-09-26**

> Saiu da v2. As planilhas de precificação foram feitas e auditadas no Cowork em 2026-09-18, o
> protótipo "Orçamentos AMASSA" foi aprovado pelo dono em 2026-09-19 e a **Fase 04.5** foi criada
> em 2026-09-26. Os cinco ORC-* antigos (uma frase cada, escritos antes da auditoria) foram
> **reescritos como ORC-01..18 na v1** — ver a seção "Financeiro — parte 2: Precificação e
> Orçamento (Fase 04.5)". Nada aqui continua pendente.

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
| EST-01 | Phase 6 — Estoque | Complete |
| EST-02 | Phase 6 — Estoque | Complete |
| EST-03 | Phase 6 — Estoque | Complete |
| EST-04 | Phase 6 — Estoque | Complete |
| EST-05 | Phase 6 — Estoque | Complete |
| EST-06 | Phase 6 — Estoque | Complete |
| EST-07 | Phase 6 — Estoque | Complete |
| EST-08 | Phase 6 — Estoque | Complete |
| EST-09 | Phase 6 — Estoque | Complete |
| EST-10 | Phase 6 — Estoque | Complete |
| EST-11 | Phase 6 — Estoque | Complete |
| EST-12 | Phase 6 — Estoque | Complete |
| EST-13 | Phase 6 — Estoque | Complete |
| EST-14 | Phase 6 — Estoque | Complete |
| EST-15 | Phase 6 — Estoque | Complete |
| EST-16 | Phase 6 — Estoque | Complete |
| EST-17 | Phase 6 — Estoque | Complete |
| EST-18 | Phase 6 — Estoque | Complete |
| EST-19 | Phase 6 — Estoque | Complete |
| EST-20 | Phase 6 — Estoque | Complete |
| EST-21 | Phase 6 — Estoque | Complete |
| PRD-01 | Phase 06.1 — Produção | Pending |
| PRD-02 | Phase 06.1 — Produção | Pending |
| PRD-03 | Phase 06.1 — Produção | Pending |
| PRD-04 | Phase 06.1 — Produção | Pending |
| PRD-05 | Phase 06.1 — Produção | Pending |
| PRD-06 | Phase 06.1 — Produção | Pending |
| PRD-07 | Phase 06.1 — Produção | Pending |
| PRD-08 | Phase 06.1 — Produção | Pending |
| PRD-09 | Phase 06.1 — Produção | Pending |
| PRD-10 | Phase 06.1 — Produção | Pending |
| PRD-11 | Phase 06.1 — Produção | Pending |
| PRD-12 | Phase 06.1 — Produção | Pending |
| PRD-13 | Phase 06.1 — Produção | Pending |
| PRD-14 | Phase 06.1 — Produção | Pending |
| PRD-15 | Phase 06.1 — Produção | Pending |
| PRD-16 | Phase 06.1 — Produção | Pending |
| PRD-17 | Phase 06.1 — Produção | Pending |
| PRD-18 | Phase 06.1 — Produção | Pending |
| PRD-19 | Phase 06.1 — Produção | Pending |
| PRD-20 | Phase 06.1 — Produção | Pending |

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
| ORC-01 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-02 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-03 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-04 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-05 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-06 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-07 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-08 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-09 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-10 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-11 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-12 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-13 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-14 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-15 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-16 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-17 | Phase 04.5 — Financeiro, parte 2 | Complete |
| ORC-18 | Phase 04.5 — Financeiro, parte 2 | Complete |
| GES-01 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-02 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-03 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-04 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-05 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-06 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-07 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-08 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-09 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-10 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-11 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-12 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-13 | Phase 04.6 — /gestao, Início e site público | Complete |
| GES-14 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-01 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-02 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-03 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-04 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-05 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-06 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-07 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-08 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-09 | Phase 04.6 — /gestao, Início e site público | Complete |
| SIT-10 | Phase 04.6 — /gestao, Início e site público | Complete |

**Coverage:**

- v1 requirements: 189 total (PRD-01..20 acrescentados em 29/09/2026 para a Fase 06.1; ENC-15 acrescentado na Fase 04.1; FNC-01..17 acrescentados em 2026-09-19 para a Fase 04.4; ORC-01..18 promovidos da v2 e reescritos em 2026-09-26 para a Fase 04.5; GES-01..14 e SIT-01..10 acrescentados em 2026-09-28 para a Fase 04.6; EST-13..21 acrescentados em 2026-09-29 para a Fase 06 — até 29/09 esta linha dizia 160, sem eles)
- Mapped to phases: 189/189
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
| Phase 6 | M5 | EST-01..21 (13–21 acrescentados em 29/09 pelo ADENDO) | 21 |
| Phase 7 | M7 | UI-10..11, PNL-01..07 | 9 |
| Phase 04.4 | M6 → Financeiro, parte 1 | FNC-01..17 | 17 |
| Phase 04.5 | M6 → Financeiro, parte 2 | ORC-01..18 (reescritos, promovidos da v2) | 18 |
| Phase 04.6 | M6 → separação dos dois públicos | GES-01..14, SIT-01..10 | 24 |
| Phase 06.1 | Produção (redesenho das Encomendas) | PRD-01..20 (briefing de 20/09) | 20 |

---
*Requirements defined: 2026-08-05*
*Last updated: 2026-09-29, tarde (fechamento do plano 06-11) — **EST-01..21 passaram a `[x]`/Complete**,
com a evidência no bloco logo depois de EST-21 (EST-09 só pela aprovação do dono, sem o tempo
medido); a linha da Fase 6 na cobertura passou de "EST-01..12 · 12" para 21, e o total de 160 para
169 — os EST-13..21 tinham sido acrescentados em 29/09 sem atualizar essas contas.*
*Last updated antes: 2026-09-29 (fechamento do plano 04.6-08) — **GES-04 passou a `[x]`/Complete**, com a
evidência de produção anotada no próprio requisito; GES-07 já havia sido corrigido no commit
`223748a` (o espaço sem capacidade fixa, palavras do dono). Os 24 requisitos da Fase 04.6 estão
`[x]`; a nota de SIT-02 (metade da agenda deferida para a Fase Agenda) continua valendo.*
*Last updated antes (28/09/2026, plano 04.6-08, Tarefa 1; a frase "GES-04 continua Not Started" era
verdade naquele dia e não é mais) — corrigido o descompasso entre a tabela de rastreio e
os checkboxes de GES-05/GES-06 (ambos já `[x]` desde o plano 04.6-01, `e206a90`/`84ad637`; a
tabela dizia "Not Started" — a mesma classe de gap já registrada em `WINDOWS.md #43`, achada e
corrigida aqui). GES-04 continua "Not Started" de propósito: só fecha depois da Parte C da Tarefa
2 do plano 04.6-08, em produção. UI-02/UI-04 substituídos por GES-12/GES-13; decisão sobre
PNL-01..05 registrada; nota de deferimento explícito em SIT-02. 160/160 requisitos mapeados.*
*Last updated antes: 2026-09-26 — ORC-01..18 promovidos da v2 e reescritos para a Fase 04.5; 136/136 requisitos mapeados*
