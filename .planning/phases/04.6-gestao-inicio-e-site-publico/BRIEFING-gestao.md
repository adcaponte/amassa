# `/gestao` + Início novo + navegação + site público

> ⚠️ **ADENDO 26/09/2026 (vence este briefing onde falar de "Em breve"):** não haverá página "Em
> breve". No lugar dela entra o **site público inteiro**, especificado em `Claude outputs/site/`
> (`prototipo.html` + `BRIEFING.md`). O ponto 3 da §6 (cor e tipografia do "Em breve") cai.
> Tudo o mais deste briefing continua valendo.

> Briefing fechado com o Theo no Cowork em **20/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "Início AMASSA"). **O protótipo vence sobre a interface do Início e da navegação;
> este documento vence sobre o resto.** Dados do protótipo são inventados.
> Executar **depois** das duas partes do Financeiro. O site institucional completo **não** é desta
> fase: depende da arte da Andressa e dos textos do Theo, e terá fase e protótipo próprios.

## 1. O que esta fase entrega

1. **A plataforma muda de endereço**: tudo que hoje responde na raiz passa a responder em `/gestao`.
2. **A raiz vira pública**: página **"Em breve"** — o texto "Em breve" centralizado sobre a cor da
   marca. Sem ilustração, endereço, data ou rede social. Não elaborar.
3. **Início novo**: resumo do dia + anotações da casa + índice de todos os módulos.
4. **Navegação final**: barra de baixo fixa **Início · Financeiro · Produção · Agenda**; barra
   lateral completa no computador; menu do usuário enxuto.

## 2. Mudança para `/gestao` — a parte arriscada

Mexe em todas as rotas, no proxy/middleware e na suíte inteira de testes. Planejar como plano
próprio, o primeiro da fase, antes de qualquer tela nova.

- Todas as rotas autenticadas e o login passam para baixo de `/gestao` (`/gestao/login`,
  `/gestao/financeiro`, `/gestao/cadastros`…). `/api/health` e `/api/health/backup` **ficam onde
  estão** (monitoramento externo aponta para elas).
- O proxy (ex-`middleware.ts`; a pendência `middleware.ts → proxy.ts` do Next 16 pode ser resolvida
  aqui) protege **só `/gestao`**. A raiz e as futuras páginas do site não leem sessão nem banco.
- **Redirecionamento dos endereços antigos**: quem tem `/encomendas`, `/queimas` etc. salvo no
  celular precisa cair em `/gestao/...`. Redirecionar os caminhos antigos conhecidos por um período;
  o que não existir vai para o 404 público. Listar os caminhos explicitamente — sem coringa que
  engula rotas futuras do site.
- `AUTH_URL`, `callbackUrl` e cookies: conferir em produção que o login volta para dentro de
  `/gestao` (o defeito do `0.0.0.0:3000` de 17/09 é o precedente a não repetir).
- `robots.txt` bloqueia `/gestao`; páginas da plataforma com `noindex`. **Nenhum link para
  `/gestao` em página pública** — acesso só por endereço.
- O 404 da raiz é público e não pode revelar nada da plataforma; o 404 dentro de `/gestao` mantém a
  casca.
- Atalho na tela inicial do celular (ícone/manifest, se houver) aponta para `/gestao`.
- 🔴 Depois do deploy, o Theo e a Andressa precisam **refazer o atalho** no celular: escrever isso no
  roteiro de verificação humana.

## 3. Início novo

Ordem dos blocos, **decidida pelo Theo**:

1. **Agenda de hoje** — aulas e reservas com horário e lugares; no topo, "Agora no espaço: N de M
   lugares". Enquanto a Agenda não existir (fase futura), o bloco mostra só o estado vazio.
2. **O que vence** — parcelas a pagar e a receber de hoje e dos próximos 7 dias, mais as vencidas
   (marcadas). **Sem saldo** (decisão do Theo). "Paguei"/"Recebi" levam ao Caixa — não pagam dali.
3. **Produção** — ordens em andamento com etapa atual e o que vem depois. Hoje lê o módulo de
   Encomendas como está; "Aguardando sinal" só passa a existir no redesenho da Produção.
4. **Estoque acabando** — vazio até a fase do Estoque.
5. **Anotações** — caixa de texto livre.

Depois dos blocos: atalhos (pílulas) para os módulos **fora da barra** logo abaixo da saudação, e o
**índice de todos os módulos** no fim, com um cartão por módulo. Módulo novo entra no índice e na
barra lateral, **nunca na barra de baixo**.

- Todo bloco tem estado vazio próprio (frases no protótipo) e estado de carregamento.
- Cada bloco consulta o seu módulo por função de `lib/<modulo>/consultas`; o Início não tem regra
  de negócio própria. Bloco que falhar não derruba a página: mostra erro só naquele bloco.
- A saudação usa o nome do usuário logado.

### Anotações — regras
- **Uma folha só, da casa** (decisão do Theo): o que um escreve, o outro vê. Tabela de uma linha.
- Salva sozinha (debounce), com indicador "salvando… / salvo". Guarda quem salvou por último e quando.
- Duas pessoas ao mesmo tempo: **vence o último salvamento**, mas a tela avisa se o texto mudou no
  servidor desde que foi aberto, antes de sobrescrever. Sem edição colaborativa em tempo real.
- Texto puro, com limite de tamanho validado no servidor. Entra no backup por estar no banco.

## 4. Navegação

| Onde | O quê |
|---|---|
| Barra de baixo (celular) | **Início · Financeiro · Produção · Agenda** — fixa |
| Barra lateral (computador) | Início + todos os módulos |
| Índice no Início | todos os módulos, inclusive futuros |
| Menu do usuário | **Abertura do Espaço** (até ser arquivada) · Trocar senha · Sair |

- **Isto substitui a barra provisória da 04.4** (Início · Encomendas · Financeiro · Agenda ·
  Queimas, D-04 daquela fase). Não é contradição: aquela era a solução de passagem.
- "Financeiro" abre sempre na **Venda**. Orçamentos mora dentro do Financeiro (sai do menu do
  usuário). Cadastros fica fora da barra: chega-se pelo Início, pela lateral e pelo atalho dentro do
  Financeiro.
- **"Produção" é só o rótulo novo** do item que hoje se chama Encomendas. Nesta fase muda o nome no
  menu e nos títulos; a rota pode continuar `/gestao/encomendas` até o redesenho da Produção decidir.
  Não antecipar nada do redesenho.
- Queimas e Estoque saem da barra de baixo e continuam a um toque (atalhos do Início).
- Atualizar `lib/navegacao/itens.ts`, o requisito UI-02 do `REQUIREMENTS.md` e os testes da casca.

## 5. Fora desta fase

Site institucional (Home, Encomendas de peças, Loja, Espaço, calendário público de aulas) · redesenho
da Produção · Agenda · Estoque · qualquer mudança visual nos módulos existentes além do que a
navegação exige. Os defeitos visuais da vistoria de 19/09 (rótulos sobrepostos em Queimas; "12 a 12
set" nas Encomendas) são `/gsd-quick` à parte, não desta fase.

## 6. Em aberto para a discussão da fase

1. Por quanto tempo manter os redirecionamentos dos endereços antigos.
2. Se o bloco "O que vence" mostra 7 dias ou outro horizonte.
3. Cor exata e tipografia da página "Em breve" (proposta: cor de acento da marca, título na fonte
   de títulos atual; a fonte definitiva do site ainda é pendência do Theo).
