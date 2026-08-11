---
status: testing
phase: 04-contador-de-queima
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md]
started: 2026-08-11T19:04:32Z
updated: 2026-08-11T19:50:00Z
---

## Current Test

number: 7
name: Forno inexistente
expected: |
  Abrir /queimas/00000000-0000-4000-8000-000000000000 mostra a tela de "não
  encontrado" do sistema, na voz do projeto — não uma tela em branco, nem uma
  exceção crua, nem um cartão vazio.
awaiting: user response

## Tests

### 1. Partida a frio
expected: Derrube servidor e contêineres, suba tudo do zero. O servidor boota sem erro, as migrações aplicam, e /queimas carrega mostrando os fornos existentes.
result: pass
coverage_id: smoke

### 2. Os três tipos de queima
expected: No cartão de um forno, tocar "Queimar" abre o seletor com exatamente três opções, na ordem Biscoito · Esmalte · Ouro. Registrar uma queima de **ouro** funciona e o contador sobe.
result: pass
coverage_id: 04-01/D4

### 3. Autor da queima vem da sessão
expected: Depois de registrar uma queima, a página do forno mostra o seu nome como quem lançou. Nenhum campo de autor aparece no fluxo de dois toques.
result: pass
coverage_id: 04-01/D5

### 4. O medidor lê como instrumento
expected: No Forno 01 (88/100, semeado): o medidor tem entalhes visíveis a cada 10 queimas, uma marca vertical no limiar de atenção (90), e os rótulos 0 / atenção 90 / limite 100 sob a barra. Bate o olho e dá para ver o desgaste — não é uma barra lisa.
result: pass
coverage_id: 04-02/D4

### 5. Carregando e erro na tela de fornos
expected: Ao abrir /queimas, um esqueleto na forma dos cartões aparece antes do conteúdo (não uma tela branca). Se a carga falhar, aparece "Algo não funcionou." com o texto dizendo o que fazer.
result: issue
reported: "a pagina em branco com Application error: a server-side exception has occurred while loading localhost (see the server logs for more information). Digest: 743233016 — Failed query em exigirUsuario (lib/auth/exigir-usuario.ts:75) chamado por LayoutApp (app/(app)/layout.tsx:15)"
severity: major
coverage_id: 04-02/D6

### 6. Duas queimas no mesmo instante
expected: Duas queimas gravadas no mesmo instante aparecem como duas linhas separadas no histórico, sem fundir, em ordem estável entre recargas.
result: pass
coverage_id: 04-03/D2

### 7. Forno inexistente
expected: Abrir /queimas/<um-uuid-qualquer-inventado> mostra a tela de "não encontrado" do sistema, não uma tela em branco nem um erro cru.
result: [pending]
coverage_id: 04-03/D4

### 8. Excluir queima entre irmãs e exclusão repetida
expected: Com duas queimas do mesmo instante, excluir uma remove exatamente a confirmada, nunca a irmã. Excluir a mesma queima de novo (duas abas) devolve "Essa queima não existe mais.", não um erro cru.
result: [pending]
coverage_id: 04-03/D5

### 9. Manutenção duas vezes seguidas
expected: Registrar manutenção zera o contador. Registrar de novo mostra "O contador vai de 0 para 0.", grava uma segunda linha no histórico, e o histórico de queimas não muda. O botão de confirmar fica desabilitado enquanto grava — duplo-toque não registra duas.
result: [pending]
coverage_id: 04-04/D4

### 10. Editar forno
expected: Na página do forno, menu ⋮ Mais ações → Editar forno abre o formulário com nome, descrição e limite preenchidos. Salvar altera e a mudança aparece no índice.
result: [pending]
coverage_id: 04-04/D6

### 11. Forno desativado
expected: Um forno desativado aparece esmaecido no índice e sem o botão "Queimar". A página dele continua abrindo, com todo o histórico intacto. O esmaecido ainda é legível.
result: [pending]
coverage_id: 04-04/D8

### 12. Transição já feita
expected: Desativar um forno que já está desativado (ou reativar um já ativo — ex.: duas abas abertas) devolve uma mensagem em português dizendo o que aconteceu, nunca um sucesso mudo.
result: [pending]
coverage_id: 04-04/D10

### 13. Painel inicial com falha
expected: Se a consulta de fornos do painel inicial falhar, aquele cartão mostra o estado de erro. Os outros cartões do painel continuam de pé, e nunca parece "tudo em dia" silenciosamente.
result: [pending]
coverage_id: 04-05/D7

### 14. Banner com nomes longos (backstop E5)
expected: Com 5 fornos em atenção, três deles com nomes de 80 caracteres, o banner mostra os 3 primeiros mais "· e mais 2", mantém altura previsível, e não empurra os cartões para baixo da dobra num celular estreito (375px).
result: [pending]
coverage_id: 04-05/D8

### 15. Relatórios no celular
expected: Em viewport de celular, as quatro estatísticas vêm empilhadas primeiro, os gráficos abaixo. Cada gráfico rola na horizontal dentro do próprio contêiner — a página nunca rola de lado. Os dados são os mesmos do desktop.
result: [pending]
coverage_id: 04-06/D6

### 16. Relatórios sem nenhuma queima
expected: Sem nenhuma queima registrada, /queimas/relatorios mostra "Nenhuma queima registrada ainda." com o botão "Ver fornos", no lugar dos gráficos. O item "Relatórios" continua visível no seletor.
result: [pending]
coverage_id: 04-06/D7

### 17. A checklist de fim de fase
expected: 04-VERIFICACAO-HUMANA.md tem os 26 itens (9 critérios do ROADMAP, 3 backstops do UI-SPEC, 14 herdados), cada um com passos de reprodução e critério de aprovação claros o suficiente para percorrer sem reler os SUMMARYs.
result: [pending]
coverage_id: 04-07/D4

## Summary

total: 17
passed: 5
issues: 1
pending: 11
skipped: 0
blocked: 0

## Auto-Covered (não apresentados)

31 entregáveis dos 47 foram classificados como cobertos deterministicamente pelos
testes que passam (`uat.classify-coverage`, mode: coverage, 0 erros de bloco).
Não são apresentados como checkpoint — a evidência já existe.

| Plano | total | auto | humano |
|-------|-------|------|--------|
| 04-01 | 6  | 4 | 2 |
| 04-02 | 6  | 4 | 2 |
| 04-03 | 5  | 2 | 3 |
| 04-04 | 10 | 6 | 4 |
| 04-05 | 8  | 6 | 2 |
| 04-06 | 8  | 6 | 2 |
| 04-07 | 4  | 3 | 1 |
| **total** | **47** | **31** | **16** |

## Gaps

- gap_id: G-04-5
  truth: "Toda tela autenticada mostra um estado de erro em linguagem humana quando o banco está fora do ar, nunca uma tela em branco com exceção crua"
  status: failed
  reason: "User reported: página em branco com \"Application error: a server-side exception has occurred\". A falha vem de exigirUsuario() em app/(app)/layout.tsx:15, não da página."
  severity: major
  test: 5
  root_cause: "app/(app)/layout.tsx chama exigirUsuario() (consulta ao banco). No App Router, error.tsx NÃO captura erro lançado pelo layout do PRÓPRIO segmento — app/(app)/error.tsx existe mas é irmão do layout que falha. Não existe app/error.tsx nem app/global-error.tsx acima dele, então o erro sobe até o handler padrão do Next.js."
  artifacts:
    - path: "app/(app)/layout.tsx"
      issue: "linha 15: exigirUsuario() no layout — qualquer falha de banco derruba toda rota protegida antes de qualquer error.tsx de página"
    - path: "app/error.tsx"
      issue: "não existe — é a fronteira que capturaria a falha do layout de (app)"
    - path: "app/global-error.tsx"
      issue: "não existe — último recurso, capturaria inclusive falha no layout raiz"
  missing:
    - "Criar app/global-error.tsx (e/ou app/error.tsx) com a voz de erro do projeto, para que a falha do layout protegido não caia no handler padrão do Next.js"
    - "Reconferir se os demais estados de erro da fase (E11/painel inicial, teste 13) sofrem do mesmo caminho — a mesma exceção do layout precede todos eles"
  escopo: "Pré-existente à Fase 4 — app/(app)/layout.tsx é da Fase 2b. Os error.tsx de Fornos estão corretos para o escopo deles."
  nota_de_metodo: "Derrubar o banco inteiro atinge o layout primeiro, então NÃO exercita o error.tsx de /queimas. Esse continua sem prova — precisa de uma falha que atinja só a consulta da página."
