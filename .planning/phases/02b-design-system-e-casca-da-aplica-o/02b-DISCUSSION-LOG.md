# Phase 2b: Design System e Casca da Aplicação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 2b-Design System e Casca da Aplicação
**Areas discussed:** Profundidade das telas vazias; Kit shadcn a instalar agora; Casca, marca e login

**Áreas oferecidas e não selecionadas:** Regras transversais UI-07/08/09 — caíram na discrição do
executor, registradas em `02b-CONTEXT.md` §"Claude's Discretion".

---

## Profundidade das telas vazias

### Quanto de estrutura cada tela de módulo já mostra

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Cabeçalho + estado vazio + botão inerte | Título, frase de contexto e botão principal desabilitado com nota "chega na Fase N". Prova UI-07 de verdade. | ✓ |
| Só a frase de estado vazio | Tela mínima, sem cabeçalho nem botão. Fecha UI-02 com o menor esforço, mas UI-07 fica sem prova. | |
| Estrutura completa com dados falsos | Lista/grade/cartões com dados de mentira. Cria código descartável e arrisca dado falso vazar. | |

**Notas:** a moldura escolhida é a que as Fases 3 a 6 iam construir de qualquer forma — elas trocam
o miolo e mantêm cabeçalho e botão.

### Como o painel inicial apresenta os espaços reservados

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| 4 cartões nomeados, cada um com seu vazio | Encomendas por etapa, Aulas de hoje, Fornos em atenção, Estoque baixo. O leiaute da Fase 7 já nasce aqui. | ✓ |
| Uma saudação e nada mais | Honesto e baratíssimo, mas a Fase 7 desenha o painel do zero. | |
| Cartões com esqueleto permanente | Mostra o formato do conteúdo futuro, mas esqueleto que nunca resolve parece defeito. | |

**Notas:** os quatro cartões são exatamente as quatro fontes que PNL-01 (Fase 7) exige.

### O que Orçamentos faz quando clicado

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Abre tela dizendo que está por vir | Rota `/orcamentos` real, com frase honesta sobre a dependência das planilhas de precificação. | ✓ |
| Item desabilitado no menu | Cumpre UI-04 sem criar tela, mas item inerte convida a clicar de novo. | |
| Não entra agora | Menos ruído, mas descumpre UI-04 e o critério 2 do ROADMAP. | |

### Origem das frases de estado vazio

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Só a de Encomendas está escrita; Claude escreve as outras | "A roda ainda não gira" é a única já decidida (§8). As demais seguem a voz da §9 e o dono revisa na verificação. | ✓ |
| O dono escreve as 5 agora | Fica exatamente na voz dele, mas segura a fase no texto. | |
| Frase genérica única para todas | Consistente e barato, mas perde o tom da §9 e a de Encomendas viraria exceção. | |

---

## Kit shadcn a instalar agora

### Quais componentes entram nesta fase

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Só o que a casca usa | button, card, sidebar, sheet, skeleton, dropdown-menu, separator. Zero código sem uso. | ✓ |
| Casca + o que UI-07/UI-08 exigem | Acrescenta alert-dialog e sonner, fechando as regras transversais com componente real. | |
| Kit completo das Fases 3–6 | form, input, select, dialog, table, tabs, badge, tooltip, popover, calendar. Prova o mapeamento em mais componentes, mas entrega código que envelhece sem uso. | |

**Notas:** consequência aceita — `alert-dialog` e `sonner` ficam de fora, e UI-08 vira convenção
documentada que a Fase 3 implementa. Registrada como D-07 no CONTEXT.md.

### Como UI-01 vira prova

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Teste que lê a cor computada no navegador | Playwright confere #894025 no botão primário, #F6F3F0 no fundo e Archivo Narrow no título. Barra regressão. | ✓ |
| Página interna de amostra, conferida a olho | Boa para revisar visualmente, mas não barra regressão nenhuma. | |
| As duas coisas | Amostra para o olho e teste para o portão. Mais trabalho. | |

**Notas:** mesma lógica que a Fase 1 aplicou verificando de fora, não pelo relato de quem executou.
A página de amostra ficou como ideia adiada.

### Como as fontes chegam ao navegador

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| `next/font/google` | Baixadas no build, servidas pelo próprio domínio. Sem requisição ao Google em produção, sem FOUT. | ✓ |
| `.woff2` no repositório com `next/font/local` | Build offline, mas engorda o repositório público e exige atualizar à mão. | |
| `<link>` para o CDN do Google Fonts | Mais simples de escrever, mas dependência externa em runtime e envia o IP de quem usa ao Google. | |

### Onde vivem os componentes próprios

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| `components/ui/` shadcn, `components/amassa/` nosso | Fronteira por origem: o que o shadcn pode sobrescrever de um lado, o que nunca é sobrescrito do outro. | ✓ |
| `components/ui/` e `components/` na raiz | Padrão cru do shadcn, mas mistura tudo num nível só. | |
| Por domínio: `components/casca/`, `components/estados/` | Legível agora, mas com 5 módulos a raiz vira lista longa e a fronteira com o shadcn some. | |

---

## Casca, marca e login

### A barra lateral do desktop

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Fixa em 240px | UI-03 não pede recolher. Com 3 a 5 pessoas em tela de trabalho, 180px não pagam o estado a persistir. | ✓ |
| Recolhível com estado em cookie | O componente Sidebar do shadcn traz quase de graça, mais fiel à §5, mas um modo a mais em toda tela futura. | |
| Recolhível sem lembrar a escolha | O pior dos dois: modo extra para testar e frustra quem recolheu de propósito. | |

**Notas:** a §5 do documento de design diz "recolhível"; a simplificação é consciente e está
registrada como ideia adiada.

### O logo, que ainda não existe

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Dono entrega o SVG; enquanto isso, palavra em Archivo Narrow | Componente `Logo` isolado; trocar depois é um arquivo. A fase não fica bloqueada. | ✓ |
| Dono entrega o SVG antes do plano ser escrito | Mais fiel desde o primeiro commit, mas segura o planejamento. | |
| Claude desenha um SVG de aproximação | Rejeitada: imitar fonte licenciada em repositório público é o terreno que D-04/D-06 da 2a mandam evitar. | |

### A tela de login

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Sim — login e página de erro entram | A 2a registrou que "a 2b reestiliza". Login é a primeira tela que qualquer pessoa vê. | ✓ |
| Só o login | Deixa erro e 404 para a Fase 7. Menor escopo. | |
| Nada disso — só a casca | Deixa a tela mais vista com a aparência crua da Fase 1 e contradiz a 2a. | |

### O menu do usuário

| Opção | Descrição | Escolhida |
|-------|-----------|-----------|
| Nome + Orçamentos + Sair; no celular abre do cabeçalho | Preserva os 5 itens da barra inferior (UI-02) e mantém Sair alcançável com o polegar. | ✓ |
| Nome + Orçamentos + Sair; no celular sai da aba Início | Uma barra a menos, mas esconde o Sair atrás de navegação e rolagem. | |
| Adiciona "Contas e senhas" explicando o comando | Útil, mas é documentação — cabe no manual da Fase 7. | |

---

## Claude's Discretion

- **Regras transversais UI-07/08/09** — área oferecida e não selecionada. Caminho definido pelo
  executor: componentes compartilhados de estado vazio, erro e esqueleto em `components/amassa/`;
  verificação de alvos de toque, `aria-label` e navegação por teclado junto do teste de UI-01;
  contraste conferido com ferramenta.
- Estrutura de rotas dentro de `app/(app)/` e detecção do item ativo da navegação.
- Escolha dos ícones do `lucide-react` para os 5 módulos.
- Composição interna do componente `Logo`.
- Texto das frases de estado vazio dos módulos além de Encomendas.

## Deferred Ideas

- Barra lateral recolhível com estado persistido.
- Página interna de amostra (`/estilo`) com todos os componentes.
- `alert-dialog` e `sonner` — chegam na Fase 3, junto de UI-08.
- `--color-chart-1` a `--color-chart-5` — chegam na Fase 4, com os relatórios em Recharts.
- Logo em SVG a partir da Vinila, exportado do mídia kit pelo dono.
- Favicon e ícones de aplicação.
- Kit shadcn completo — cada fase instala o que usa.
