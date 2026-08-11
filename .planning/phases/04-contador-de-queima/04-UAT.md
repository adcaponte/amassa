---
status: complete
phase: 04-contador-de-queima
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md, 04-06-SUMMARY.md, 04-07-SUMMARY.md]
started: 2026-08-11T19:04:32Z
updated: 2026-08-11T20:50:00Z
---

## Current Test

[testing complete]

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
result: pass
coverage_id: 04-03/D4

### 8. Excluir queima entre irmãs e exclusão repetida
expected: Com duas queimas do mesmo instante, excluir uma remove exatamente a confirmada, nunca a irmã. Excluir a mesma queima de novo (duas abas) devolve "Essa queima não existe mais.", não um erro cru.
result: pass
coverage_id: 04-03/D5

### 9. Manutenção duas vezes seguidas
expected: Registrar manutenção zera o contador. Registrar de novo mostra "O contador vai de 0 para 0.", grava uma segunda linha no histórico, e o histórico de queimas não muda. O botão de confirmar fica desabilitado enquanto grava — duplo-toque não registra duas.
result: pass
coverage_id: 04-04/D4

### 10. Editar forno
expected: Na página do forno, menu ⋮ Mais ações → Editar forno abre o formulário com nome, descrição e limite preenchidos. Salvar altera e a mudança aparece no índice.
result: pass
coverage_id: 04-04/D6

### 11. Forno desativado
expected: Um forno desativado aparece esmaecido no índice e sem o botão "Queimar". A página dele continua abrindo, com todo o histórico intacto. O esmaecido ainda é legível.
result: pass
coverage_id: 04-04/D8

### 12. Transição já feita
expected: Desativar um forno que já está desativado (ou reativar um já ativo — ex.: duas abas abertas) devolve uma mensagem em português dizendo o que aconteceu, nunca um sucesso mudo.
result: pass
coverage_id: 04-04/D10

### 13. Painel inicial com falha
expected: Se a consulta de fornos do painel inicial falhar, aquele cartão mostra o estado de erro. Os outros cartões do painel continuam de pé, e nunca parece "tudo em dia" silenciosamente.
result: pass
coverage_id: 04-05/D7

### 14. Banner com nomes longos (backstop E5)
expected: Com 5 fornos em atenção, três deles com nomes de 80 caracteres, o banner mostra os 3 primeiros mais "· e mais 2", mantém altura previsível, e não empurra os cartões para baixo da dobra num celular estreito (375px).
result: pass
coverage_id: 04-05/D8

### 15. Relatórios no celular
expected: Em viewport de celular, as quatro estatísticas vêm empilhadas primeiro, os gráficos abaixo. Cada gráfico rola na horizontal dentro do próprio contêiner — a página nunca rola de lado. Os dados são os mesmos do desktop.
result: pass
coverage_id: 04-06/D6

### 16. Relatórios sem nenhuma queima
expected: Sem nenhuma queima registrada, /queimas/relatorios mostra "Nenhuma queima registrada ainda." com o botão "Ver fornos", no lugar dos gráficos. O item "Relatórios" continua visível no seletor.
result: pass
coverage_id: 04-06/D7

### 17. A checklist de fim de fase
expected: 04-VERIFICACAO-HUMANA.md tem os 26 itens (9 critérios do ROADMAP, 3 backstops do UI-SPEC, 14 herdados), cada um com passos de reprodução e critério de aprovação claros o suficiente para percorrer sem reler os SUMMARYs.
result: pass
coverage_id: 04-07/D4

## Summary

total: 17
passed: 16
issues: 1
pending: 0
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
  truth: "Uma falha em exigirUsuario() (layout de rota protegida) cai num estado de erro em linguagem humana, não na tela padrão do Next.js"
  status: resolved
  resolvido_em: ".planning/quick/260811-uiy-fronteira-de-erro-global-acima-do-layout/ — app/error.tsx (fronteira mais próxima ACIMA de app/(app)/layout.tsx, captura o throw de exigirUsuario(), verificada por lint/tsc/estrutura e pela mesma disciplina já provada de app/(app)/error.tsx) resolve o gap; app/global-error.tsx entra como último recurso com prova ESTRUTURAL, não comportamental — não é observável em next dev. Ambos consomem lib/erro/textos.ts (voz única, com teste anti-deriva). A prova comportamental automatizada com o Postgres local parado não pôde rodar nesta sessão (E2E_EMAIL_TESTE/E2E_SENHA_TESTE ausentes em .env.local para login fora do pipeline de teste) — escalada ao roteiro manual do dono, registrado no SUMMARY do plano."
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
    - "Criar app/global-error.tsx (e/ou app/error.tsx) com a voz de erro do projeto, para que a falha do layout protegido não caia no handler padrão do Next.js — RESOLVIDO pelo quick task 260811-uiy (ver resolvido_em acima)."
    - "Reconferir se os demais estados de erro da fase (E11/painel inicial, teste 13) sofrem do mesmo caminho — a mesma exceção do layout precede todos eles — RESPONDIDO no teste 13 (ver nota_de_metodo abaixo): não sofrem, as fronteiras de página funcionam."
  escopo: "Pré-existente à Fase 4 — app/(app)/layout.tsx é da Fase 2b. Os error.tsx de Fornos estão corretos para o escopo deles."
  decisao_do_dono: "Corrigir fora da Fase 4, como tarefa própria (decidido em 2026-08-11, no fechamento do UAT). O defeito é da Fase 2b (app/(app)/layout.tsx) e atinge TODOS os módulos — Encomendas, Agenda, Estoque, Orçamentos —, não só Fornos. Fechar como gap_closure da Fase 4 atribuiria a ela um problema que ela apenas encontrou. NENHUM plano de correção foi gerado nesta fase, deliberadamente."
  registrado_em: ".planning/WINDOWS.md"
  nota_de_metodo: "REVISADO no teste 13. Derrubar o banco inteiro atingia o layout primeiro e nunca alcançava as fronteiras de página. Refeito com um método cirúrgico (renomear só a tabela fornos, deixando usuarios legível): app/(app)/queimas/error.tsx e o EstadoErro do cartão de Fornos no painel inicial FUNCIONAM — provados nesta sessão, testes 5 (segunda metade) e 13. O defeito é estritamente a ausência de fronteira ACIMA do layout de (app)."
