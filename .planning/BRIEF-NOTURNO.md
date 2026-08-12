# Brief — Ajustes de Encomendas + tela de trocar senha

Trabalho já totalmente decidido. Nenhuma decisão de produto ficou em aberto: as respostas do dono
estão marcadas como **DECIDIDO** em cada item. Não reabra nenhuma delas; se algo parecer ambíguo,
escolha a opção que respeita a decisão registrada e siga.

**Ordem obrigatória:** Lote A inteiro (A1 → A2 → A3), depois Lote C. Commit atômico por item.
Rode `npm run verificar` ao fim de cada lote.

**Orçamento de e2e (CLAUDE.md):** `npm run test:e2e` custa ~53s antes do primeiro teste.
No máximo **uma** invocação por item, sempre com `--grep`. Nunca `npm run build` separado.
Uma varredura completa sem `--grep` no fim de tudo, uma vez só.

---

## LOTE A — índice de Encomendas

### A1 — Encomenda clicável no Gantt do desktop

**Defeito.** `components/amassa/encomendas/gantt.tsx:166` desenha o nome da encomenda num `<span>`.
Não existe `<Link>` em lugar nenhum do componente. No celular,
`components/amassa/encomendas/cartao-encomenda.tsx:23` envolve o cartão num
`<Link href={/encomendas/${id}}>`. Por isso abre no celular e não abre no desktop.

**Correção.** Envolver o **conteúdo da coluna fixa** (nome + cliente) num `<Link>` para
`/encomendas/{id}`.

Restrições:
- **Não** envolver a linha inteira. Ela contém a área rolável horizontal e as barras com
  `role="img"`; um link por cima quebra a semântica e atrapalha a rolagem por gesto.
- A coluna é `sticky left-0 z-10` — o link não pode escapar do `sticky`.
- Anel de foco visível (`focus-visible:ring-2 focus-visible:ring-ring`), igual ao do cartão.
- Preservar `data-testid={gantt-linha-${id}}` — o e2e depende dele.
- A linha tem 64px (`ALTURA_LINHA`), acima do mínimo de 44px de toque.

**Aceite.** Novo teste em `tests/e2e/encomendas-indice.spec.ts`, projeto `desktop`: clicar no nome
de uma encomenda no Gantt navega para `/encomendas/{id}`. Esse teste não existe hoje — a ausência
dele é o que deixou o defeito passar.

### A2 — Eixo de tempo na barra do celular

**Defeito.** `components/amassa/encomendas/trilha-segmentos.tsx:52` calcula cada segmento como
`faixa.dias / duracaoTotal * 100`. É uma barra **proporcional pura**: sem marca de hoje, sem data,
sem escala. Como toda encomenda nasce com o mesmo `DIAS_PADRAO` (3/6/1/1/1/1 —
`lib/encomendas/cronograma.ts:35`), duas encomendas em fases diferentes desenham barras quase
idênticas. É por isso que o dono disse que "não informa exatamente nada".

**DECIDIDO:** enriquecer a barra atual. **NÃO** trocar pela timeline rolável — isso reverteria uma
decisão travada da Fase 3 (`03-UI-SPEC.md` decidiu que 18px/dia "não cabe no celular"), e o que
falta na barra é informação, não escala.

**Correção.** Acrescentar à `TrilhaSegmentos`:
- **Marca de "hoje"**: traço vertical sobre a barra, na mesma proporção que os segmentos usam
  (dias decorridos desde o início ÷ duração total). Fora do intervalo (não começou / já acabou),
  **não desenhar** — nunca grudar numa ponta, o que mentiria a posição.
- **Datas nas duas pontas**, abaixo da barra, em `text-micro`: início à esquerda, entrega à direita.
- A marca é decorativa (`aria-hidden`). A informação já existe em texto no cartão
  ("Etapa atual: … · faltam N dias para …") — não duplicar em leitor de tela.

**Armadilha.** `TrilhaSegmentos` é Server Component puro e recebe `faixas` + `situacao`. Para
posicionar "hoje" ele precisa da data de hoje: **passar por prop, nunca ler o relógio dentro do
componente.** É a mesma disciplina que `Gantt` já segue (`hoje: string` como prop).

### A3 — Timeline começa hoje, agrupada por semana

**Defeito.** `lib/encomendas/gantt.ts:171` — `calcularIntervalo` abre em
`quinzenaAnterior(menorInicio)`: uma quinzena antes da encomenda **mais antiga**, que pode estar
bem no passado. E `celulasDeQuinzena` (:198) desenha células de 1–15 / 16–fim do mês.

Este é o item mais pesado do lote: muda o contrato de um módulo puro testado. Faça com cuidado.

**(a) Início = hoje, com corte marcado.**
**DECIDIDO:** a timeline começa hoje; a parte passada de uma encomenda em curso fica de fora, com
uma marca na borda esquerda indicando que ela começou antes.

- `calcularIntervalo` passa a usar `hoje` como `primeiroDia`, arredondado ao início da semana (ver b).
- `retanguloDaEtapa` hoje devolve `esquerda` possivelmente **negativo** para uma faixa iniciada
  antes do `primeiroDia`. Isso vira recorte explícito: a faixa é cortada em `esquerda: 0` com
  largura reduzida, e o retângulo ganha um campo novo (ex.: `cortadaNaEsquerda: boolean`) para o
  componente desenhar a marca de corte. **Nunca deixar `esquerda` negativo** — a barra vazaria da
  linha, que não tem `overflow-hidden`.
- Faixa que termina inteiramente antes de `hoje` devolve `null`, como já acontece com `dias === 0`.
- `rolagemInicial` não precisa mudar: com hoje na borda esquerda, o `Math.max(…, 0)` resolve para 0.

**(b) Células semanais, semana começando na SEGUNDA.**
- Substituir `quinzenaQueContem` / `quinzenaAnterior` / `quinzenaPosterior` pelo equivalente semanal.
- **Semana começa na segunda-feira** — a mesma convenção que a Fase 4 usa nos relatórios de queima
  (FOR-12). Duas definições de semana no mesmo sistema seria dívida imediata.
- A aritmética continua **sem `Date`**: o módulo usa `diasDesdeAEpoca`/`civilDesdeDias` (Howard
  Hinnant, :40 e :51) exatamente para isso. O dia da semana sai de `diasDesdeAEpoca % 7`
  (1970-01-01 foi quinta). **Não introduzir `Date.getDay()`.**
- Folga nas pontas: passa de uma quinzena para **uma semana no fim**. Na ponta inicial não há folga
  — a timeline começa hoje.
- Rótulo da célula: hoje é `1–15 ago` (:221); semanal fica `11–17 ago`. Mesmo formato.
- Renomear `celulasDeQuinzena` → `celulasDeSemana`, tipo `CelulaDeQuinzena` → `CelulaDeSemana`, e o
  `data-testid="gantt-celula-quinzena"` em `gantt.tsx:130` acompanha.

**Testes que quebram — é o contrato mudando, não regressão. Atualize, não contorne:**
- `lib/encomendas/gantt.test.ts` — toda asserção sobre quinzena, `primeiroDia` e largura do intervalo.
- `tests/e2e/encomendas-indice.spec.ts` — as asserções que recomputam a posição da linha de "Hoje" e
  a rolagem inicial a partir de `data-primeiro-dia` / `data-largura-em-pixels` (`gantt.tsx:102`).
  O mecanismo continua válido; os números mudam.
- **Caso de borda novo, obrigatório:** encomenda iniciada antes de hoje desenha barra cortada em
  `esquerda: 0`, nunca negativa.

---

## LOTE C — tela de trocar senha

**Estado atual.** `scripts/criar-usuario.ts` e `scripts/redefinir-senha.ts` sempre chamam
`gerarSenhaForte()` (20 caracteres, alfabeto sem os parecidos). **Não existe** nenhuma tela, rota ou
Server Action de trocar senha — confirmado por varredura. O login valida apenas
`senha: z.string().min(1)` (`lib/auth/entrada-credenciais.ts:16`), então não há política de senha.

**Motivo.** O Core Value é funcionar de pé, no ateliê, com a mão suja, num celular. Digitar 20
caracteres aleatórios num teclado de celular é atrito que faz desistir do sistema.

**DECIDIDO: troca voluntária, NÃO obrigatória.** A tela existe e quem quiser troca. **Não criar
coluna `senha_provisoria`, não criar migração, não forçar troca no primeiro acesso.** Trocar senha é
só um `UPDATE` em `senha_hash`, que já existe.

**Escopo:**
- Tela/diálogo de trocar senha, alcançável pelo menu do usuário (`components/amassa/menu-usuario.tsx`).
- Campos: senha atual, senha nova, confirmação. Todos `type="password"`, nunca abaixo de 16px
  (senão o iOS dá zoom ao focar).
- Server Action começando por `exigirUsuario()` na primeira linha, validação Zod no servidor.
  Confere a senha atual antes de trocar; senha atual errada devolve erro em linguagem humana.
- Troca só a própria senha. **Um gestor não pode trocar a senha de outro** — o id vem da sessão,
  nunca do cliente.
- Reaproveitar `gerarHash` de `lib/auth/senha.ts`. Não escrever segunda função de hash.

**Política de senha — comprimento, não regrinha de símbolo.** Mínimo de **12 caracteres**, sem
exigência de maiúscula/número/símbolo. Uma frase de quatro palavras (`panela-barro-forno-quente`) é
mais fácil de lembrar e mais difícil de quebrar que `Amassa@2026`. Coloque a dica em pt-BR abaixo do
campo, sugerindo a frase de palavras. A política nova vale só para a troca; **não** mexer na
validação do login (`min(1)`), que existe para não vazar informação na tela de entrada.

**Analogia para seguir:** `app/(auth)/login/page.tsx` e `lib/auth/acoes.ts` — mesma forma de
formulário, mesmo tratamento de erro, mesmas frases.

**Aceite:**
- Teste unitário da política (11 caracteres recusa, 12 aceita).
- Teste da Server Action: senha atual errada não troca; senha atual certa troca e a antiga para de
  funcionar.
- e2e: trocar a senha, sair, entrar com a nova.
- `npm run verificar-acoes` continua passando (a ação nova tem `exigirUsuario()` na primeira linha).

---

## Fechamento

1. `npm run verificar` — tem que passar limpo.
2. Uma varredura completa de `npm run test:e2e` **sem `--grep`**, uma vez só, no fim de tudo.
3. Se algum teste falhar e a causa for ambiente Windows já conhecido, consulte `WINDOWS.md` antes de
   tratar como regressão.
4. Registre no SUMMARY quais comandos de e2e rodou de fato.

## O que NÃO fazer nesta sessão

- **Não** mexer nas datas de queima/entrega da encomenda (escolher data de entrega, âncora
  invertida). Isso é outro lote, precisa de migração e tem uma pergunta de produto em aberto.
- **Não** criar migração nenhuma.
- **Não** iniciar a Fase 5 (Agenda de Aulas).
- **Não** trocar a barra do celular pela timeline rolável (ver A2).
