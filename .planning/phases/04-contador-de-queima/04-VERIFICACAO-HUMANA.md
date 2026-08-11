# Verificação Humana — Fase 4: Contador de Queima

**Gerado por:** execução do plano `04-07-PLAN.md`, Tarefa 3.
**Status:** Migração já aplicada em produção (Tarefa 2, ver rodapé "Migração — evidência"). Este
documento ainda **não foi percorrido** — todo item abaixo começa **sem marcar**. Nenhuma linha foi
observada por um ser humano até agora; nada aqui foi presumido como aprovado.

**Por que existe.** A Fase 3 fechou com verificação humana **parcial** — doze critérios nunca
percorridos item a item, e "ajustes de desktop" mencionados pelo dono sem detalhamento
(`03-08-SUMMARY.md`). Esta fase existe justamente para não repetir isso: os nove critérios do
`ROADMAP.md`, os três backstops do `04-UI-SPEC.md` e todo item que os seis planos anteriores
deixaram como "verificado só por revisão de código" ficam registrados aqui, um a um, para você
percorrer com calma — no celular de verdade, como o Core Value do projeto pede.

**Como preencher:** para cada item, marque a caixa (`- [x]`) e escreva o resultado na linha
"Resultado" — mesmo que seja só "ok" ou uma frase curta. Se algo não passar, descreva exatamente o
que você viu, não precisa ser técnico. Um item marcado sem o campo Resultado preenchido não conta
como percorrido.

**Nenhum dado real de aluna ou cliente do ateliê deve aparecer em nenhum forno de teste que você
criar aqui** — o repositório é público, e este documento também. Use nomes claramente marcados
(ex.: `[verificação] Forno teste`) e desative-os ao final se quiser deixar o índice limpo (nunca
exclua — a aplicação não oferece isso, por desenho, FOR-11).

---

## Seção A — Os nove critérios de sucesso do ROADMAP

Copiados de `.planning/ROADMAP.md` §"Phase 4". Percorra no celular de verdade quando o item disser
"no celular"; os demais valem em qualquer tamanho de tela, mas prefira o celular sempre que possível
— é onde o sistema precisa funcionar de pé, com a mão suja.

### 1. Registrar uma queima leva dois toques e menos de 5 segundos no celular

- **O que fazer:** no celular, abra um forno qualquer (ou cadastre um de teste). Cronometre do
  primeiro toque em "Queimar" até o toast "Queima registrada." aparecer. Conte os toques: deve ser
  exatamente dois — "Queimar", depois o tipo (biscoito/esmalte/ouro). Nenhum formulário, nenhum
  campo para preencher.
- **O que conta como aprovado:** dois toques, menos de 5 segundos, nenhum indicador de
  carregamento entre os dois toques (ver também Backstop A, mais detalhado, na Seção B).
- [ ] **Resultado:** _____________________________________________

### 2. O aviso com "Desfazer", por 7 segundos, remove a queima registrada por engano

- **O que fazer:** registre uma queima. No toast que aparece, toque "Desfazer" antes de 7 segundos
  passarem. Confirme que o contador do forno volta ao valor de antes. Recarregue a página e
  confirme que a queima realmente sumiu (não é só a tela que mudou).
- **O que conta como aprovado:** a queima some de verdade (sobrevive a um recarregamento), o
  contador volta exato, e o "Desfazer" fica disponível por cerca de 7 segundos — mais que o padrão
  de 5s do resto do sistema.
- [ ] **Resultado:** _____________________________________________

### 3. Os três tipos aparecem: biscoito, esmalte e ouro

- **O que fazer:** toque "Queimar" em qualquer forno e confira o seletor de tipo. Registre uma
  queima do tipo **ouro** especificamente (é o tipo menos testado até agora — ver item da Seção C)
  e confirme que ela aparece corretamente no histórico do forno, com a cor certa.
- **O que conta como aprovado:** os três tipos sempre aparecem, na ordem Biscoito · Esmalte ·
  Ouro, e uma queima de ouro se comporta exatamente como as outras (conta no contador, aparece no
  histórico, pode ser desfeita/excluída).
- [ ] **Resultado:** _____________________________________________

### 4. Chegando a 90 de 100 o cartão fica em atenção; em 100, crítico

- **O que fazer:** cadastre um forno de teste com limite **10** (mais rápido de esgotar que o
  padrão 100). Registre queimas uma a uma e observe o cartão: em **1** (o limiar de atenção deste
  forno pequeno) deve aparecer o selo "Manutenção próxima"; em **10** (o limite), o selo
  "Manutenção vencida" com um ícone de alerta ao lado. Repare no medidor: ele deve ter marcas a
  cada 10% do limite (entalhes), não ser uma barra lisa.
- **O que conta como aprovado:** os dois selos aparecem nos pontos certos, o ícone de alerta só
  aparece no crítico, e o medidor tem entalhes visíveis — não uma barra de progresso genérica.
- [ ] **Resultado:** _____________________________________________

### 5. O banner no topo lista os fornos que precisam de atenção, com o contador de cada um

- **O que fazer:** com pelo menos um forno em atenção ou crítico (do item 4), volte para `/queimas`
  e confira o banner no topo da lista. Deve nomear o(s) forno(s) e mostrar `contador/limite` de
  cada um.
- **O que conta como aprovado:** o banner aparece quando há forno em atenção/crítico, some quando
  não há nenhum, e o texto bate com o que você registrou.
- [ ] **Resultado:** _____________________________________________

### 6. Registrar manutenção mostra "o contador vai de N para 0", aceita responsável e observações opcionais, e zera sem apagar o histórico

- **O que fazer:** na página de um forno com queimas registradas, toque "Registrar manutenção".
  Confira a frase exata "O contador vai de **N** para **0**." com o N certo. Deixe Responsável e
  Observações em branco e confirme — deve aceitar. Depois de confirmar, veja que o contador zerou
  **mas** as queimas antigas continuam na lista do histórico, e o total "na vida" do forno não
  mudou.
- **O que conta como aprovado:** a frase está certa, o envio vazio funciona, o contador zera, e
  nenhuma queima do histórico desaparece.
- [ ] **Resultado:** _____________________________________________

### 7. O cartão mostra quantas queimas o forno já fez na vida, além do contador desde a última manutenção

- **O que fazer:** olhe o rodapé do cartão de um forno com pelo menos uma manutenção registrada.
  Deve mostrar as DUAS contagens: uma frase tipo "Última manutenção em {data} · {responsável}" (ou
  "Sem manutenção registrada") seguida de "· {total} no total".
- **O que conta como aprovado:** as duas contagens aparecem juntas e são números diferentes quando
  fizer sentido (contador desde a manutenção ≠ total na vida).
- [ ] **Resultado:** _____________________________________________

### 8. Os gráficos batem com a contagem manual do histórico, alternam entre 8 semanas e 6 meses, e a semana começa na segunda

- **O que fazer:** em `/queimas/relatorios`, conte manualmente as queimas de um forno específico no
  histórico dele (`/queimas/{id}`) e compare com o que os gráficos mostram para o mesmo período.
  Alterne entre "Semana" e "Mês" e confirme que os números das quatro estatísticas do topo **não
  mudam** (são um total do ateliê, independente da granularidade do gráfico). Confira que a
  primeira coluna de cada semana corresponde a uma segunda-feira.
- **O que conta como aprovado:** a soma bate com a contagem manual, o alternador não mexe nas
  quatro estatísticas, e a semana visivelmente começa na segunda-feira.
- [ ] **Resultado:** _____________________________________________

### 9. Um forno em atenção ou crítico aparece no painel inicial

- **O que fazer:** com um forno em atenção/crítico (do item 4), vá para `/` (painel inicial) e
  confira o cartão "Fornos em atenção".
- **O que conta como aprovado:** o forno aparece com o contador certo e um link "Ver fornos" que
  leva para `/queimas`. Se você reativar/zerar todos os fornos em atenção, o cartão inteiro some do
  painel (não fica vazio na tela).
- [ ] **Resultado:** _____________________________________________

---

## Seção B — Os três backstops do UI-SPEC

Estes três itens foram marcados `verification: backstop` desde o planejamento
(`04-UI-SPEC.md`) — a ferramenta de sondagem de estados não consegue provar sozinha, e nenhum
teste automatizado os cobre por desenho. **Nenhum dos três pode ser dado por bom sem olhar.**

### Backstop A — E3 `loading`: nenhum carregamento aparece entre os dois toques (FOR-01)

- **Statement:** o seletor de tipo abre imediatamente no primeiro toque, e a gravação acontece em
  segundo plano — nunca um spinner, esqueleto ou "carregando..." entre o primeiro e o segundo
  toque.
- **Como reproduzir:** no celular, com a tela de `/queimas` aberta, toque "Queimar" em qualquer
  cartão e observe atentamente a fração de segundo entre os dois toques. Repita 2-3 vezes para ter
  certeza (a rede pode variar).
- **O que conta como aprovado:** nenhum indicador de carregamento visível em nenhuma das
  repetições, e o fluxo inteiro (do primeiro toque ao toast) fica visivelmente abaixo de 5
  segundos.
- [ ] **Resultado:** _____________________________________________

### Backstop B — E5 `long-text`: altura do banner no pior caso realista

- **Statement:** o banner permanece em altura previsível mesmo com nomes de forno no limite do
  schema (80 caracteres) — nunca empurra os cartões para baixo da dobra no celular.
- **Como reproduzir:** cadastre **3 fornos** com nomes de **80 caracteres** cada (ex.: repita uma
  frase até bater 80 caracteres — o campo Nome recusa acima disso, então 80 exatos é o teto real) e
  leve os três a atenção ou crítico (queime até o limiar). Cadastre **mais 2 fornos** quaisquer e
  leve-os também a atenção. Abra `/queimas` num celular real, em pé, num viewport estreito (a
  maioria dos celulares atuais).
- **O que conta como aprovado:** o banner mostra os 3 primeiros nomes truncados de forma legível
  mais "· e mais 2", sem estourar a altura prevista nem empurrar o primeiro cartão de forno para
  fora da tela inicial (scroll mínimo até ver o primeiro cartão).
- [ ] **Resultado:** _____________________________________________

### Backstop C — E6 `zero-one-many`: a lista de queimas na página do forno (FOR-09)

- **Statement:** a lista de até 25 queimas recentes renderiza corretamente em 0, 1 e uma
  quantidade abaixo de 25 — sem preenchimento fantasma (linhas vazias) e sem quebra de layout.
- **Como reproduzir:** abra a página de um forno **recém-cadastrado, sem nenhuma queima** — confira
  o vazio ("Nenhuma queima registrada ainda."). Registre **uma** queima e confira a lista com um
  item só. Registre mais algumas (menos de 25 — 5 ou 6 já bastam para ver o padrão) e confira que a
  lista cresce normalmente, mais recente primeiro, sem linha em branco no fim nem no início.
- **O que conta como aprovado:** os três estados (0, 1, poucas) renderizam limpos, sem espaço
  vazio reservado para linhas que não existem.
- [ ] **Resultado:** _____________________________________________

---

## Seção C — Itens que os seis planos anteriores deixaram como "só revisão de código"

Cada linha abaixo veio de um item `human_judgment: true` num `SUMMARY.md` da fase, ou de uma
entrada aberta em `WINDOWS.md`. Nenhum foi verificado visualmente até agora — o código foi
revisado e os testes automatizados que existiam passaram, mas ninguém olhou a tela.

- [ ] **Posição visual do medidor** (`WINDOWS.md` id 15, de `04-02`). Abra um forno com algumas
  queimas registradas e olhe o medidor de perto: os entalhes (marcas a cada 10% do limite) e a
  marca vertical do limiar de atenção precisam estar em posições que "leem" como um instrumento de
  desgaste — não uma barra lisa disfarçada, nem marcas na posição errada.
  **Resultado:** _____________________________________________

- [ ] **`error.tsx` de `/queimas` disparando de verdade** (`WINDOWS.md` id 16, de `04-02`). Difícil
  de forçar sozinho (exige que o servidor falhe de propósito); se você souber como simular uma
  queda momentânea de rede ou parar o servidor de teste no meio de um carregamento, confira que a
  tela mostra "Algo não funcionou." em vez de travar em branco ou mostrar erro técnico. Se não
  conseguir forçar, deixe em aberto — não é crítico para o uso diário.
  **Resultado:** _____________________________________________

- [ ] **Ramo de erro do cartão "Fornos em atenção" no painel inicial** (`WINDOWS.md` id 17, de
  `04-05`). Mesma dificuldade do item anterior — exige forçar uma falha real na consulta. Se
  conseguir, confirme que só o cartão de Fornos mostra erro (os outros três cartões do painel
  continuam de pé). Se não conseguir forçar, deixe em aberto.
  **Resultado:** _____________________________________________

- [ ] **D-08 — estado vazio de `/queimas/relatorios`** (`WINDOWS.md` id 19, de `04-06`). Precisa de
  um ateliê **sem nenhuma queima registrada** — mais fácil de testar logo depois de um `npm run
  db:migrate` limpo, ou peça para eu simular num banco separado. Se não for prático agora, deixe
  em aberto: o mecanismo foi revisado em código, só falta o olho humano confirmando a tela.
  **Resultado:** _____________________________________________

- [ ] **D-07 — ordem das estatísticas antes dos gráficos no celular** (`WINDOWS.md` id 20, de
  `04-06`). Em `/queimas/relatorios` no celular, confirme que as 4 estatísticas (total, últimos 30
  dias, biscoito, esmalte) aparecem **antes** dos gráficos, empilhadas e legíveis sem rolar para o
  lado. Compare com o desktop: os dois tamanhos de tela devem mostrar o **mesmo recorte de dados**
  (8 semanas / 6 meses) — nada reduzido no celular.
  **Resultado:** _____________________________________________

- [ ] **Tipo "ouro" nunca exercitado ponta a ponta** (de `04-01`, não escalado ao `WINDOWS.md`). Já
  coberto pelo item 3 da Seção A — se você já marcou aquele, pode repetir o resultado aqui.
  **Resultado:** _____________________________________________

- [ ] **Nome do autor mostrado no histórico bate com quem registrou** (de `04-01`). No histórico de
  queimas de um forno, confira que a queima que você acabou de registrar mostra o SEU nome (o da
  conta com que você entrou), não um valor genérico nem vazio.
  **Resultado:** _____________________________________________

- [ ] **Duas queimas no mesmo instante — desempate na lista** (de `04-03`, difícil de reproduzir
  sozinho — exigiria dois toques simultâneos de verdade). Se quiser tentar: peça para outra pessoa
  registrar uma queima no mesmo forno ao mesmo tempo que você. As duas devem aparecer na lista, sem
  se fundir numa só. Se não for prático, deixe em aberto — o código já garante isso por
  construção (ordenação por data e depois por id).
  **Resultado:** _____________________________________________

- [ ] **Um endereço de forno que não existe mostra 404** (de `04-03`). Troque o final do endereço
  de um forno de verdade por algo inventado (ex.: `/queimas/00000000-0000-0000-0000-000000000000`)
  e confirme que aparece a tela de "não encontrado", não uma tela em branco ou travada.
  **Resultado:** _____________________________________________

- [ ] **Duas exclusões da mesma queima ao mesmo tempo** (de `04-03`, backstop de concorrência).
  Difícil de reproduzir sozinho. Se tiver como abrir a mesma página em duas abas e clicar em
  "Excluir" na mesma queima quase ao mesmo tempo nas duas, uma deve funcionar e a outra mostrar uma
  mensagem de "essa queima não existe mais" — nunca um erro travado. Se não for prático, deixe em
  aberto.
  **Resultado:** _____________________________________________

- [ ] **Clique duplo no botão de confirmar manutenção** (de `04-04`). Ao abrir "Registrar
  manutenção", clique duas vezes bem rápido no botão de confirmar. Deve registrar **uma** vez só
  (o botão fica desabilitado durante o envio), não duas manutenções.
  **Resultado:** _____________________________________________

- [ ] **Editar um forno (nome, descrição, limite) de ponta a ponta** (de `04-04`, nunca testado
  automaticamente). Pelo menu "⋮ Mais ações" na página de um forno, escolha "Editar forno", mude o
  nome ou a descrição, salve, e confirme que a mudança aparece na tela sem precisar recarregar.
  **Resultado:** _____________________________________________

- [ ] **Contraste do cartão esmaecido (forno desativado)** (de `04-04`). Compare visualmente um
  forno ativo e um desativado lado a lado (filtro "Todos" em `/queimas`). O desativado deve estar
  visivelmente mais claro/esmaecido, mas o texto ainda precisa ser legível sem esforço, inclusive
  sob luz forte se possível testar fora ou perto de uma janela.
  **Resultado:** _____________________________________________

- [ ] **Desativar um forno já desativado (ou reativar um já ativo)** (de `04-04`, backstop de
  transição inválida). Difícil de disparar pela interface normal (o menu já esconde a opção
  errada), mas se você conseguir clicar duas vezes rápido em "Desativar forno" antes da tela
  atualizar, confirme que não aparece nenhum erro travado nem um segundo aviso de sucesso
  contraditório.
  **Resultado:** _____________________________________________

---

## Migração — evidência (Tarefa 2, já concluída)

Registrado aqui para o contexto ficar completo neste documento; a Tarefa 2 do plano já está
fechada e não precisa de nova ação.

- Backup sob demanda disparado antes de qualquer migração (`./scripts/backup.sh --agora`),
  conferido por `/api/health/backup` antes de seguir.
- `docker compose run --rm ferramentas npm run db:migrate` aplicou `0007_queimas` e
  `0008_gatilhos-queimas` em produção sem erro.
- `https://amassacerrado.com.br/queimas` está no ar e funcional — confirma as três tabelas e o
  tipo `tipo_queima` (a página não renderizaria sem eles).
- Consulta direta ao banco de produção confirmou os três gatilhos novos junto dos quatro que já
  existiam: `tocar_atualizado_em_{fornos,queimas,manutencoes}` presentes em `pg_trigger`, ao lado
  de `tocar_atualizado_em_{usuarios,encomendas,encomenda_itens,encomenda_etapas}`.
- `docs/operacao/05-migracao-queimas.md` corrigido depois da execução real (achado: `curl.exe` não
  existe no servidor Linux — a mesma correção foi aplicada em `docs/operacao/04-migracao-encomendas.md`,
  que carregava o mesmo engano).

---

## Depois de percorrer tudo

Quando todos os itens acima estiverem marcados com resultado escrito:

1. Para qualquer item que **não passou**, descreva o que aconteceu — isso vira um item aberto em
   `WINDOWS.md` ou uma correção, dependendo da gravidade.
2. Para os itens que vieram de uma entrada em `WINDOWS.md` (ids 15-20), essa entrada pode ser
   marcada `fixed` com `gsd-tools windows fixed <id>` depois de confirmado.
3. Só depois disso a Fase 4 pode ser considerada de fato fechada — este documento é o portão.
