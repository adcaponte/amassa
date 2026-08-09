# Convenções de Interface

Documento operacional para quem for implementar as Fases 3 a 6 — não é peça de marketing, é
onde procurar antes de inventar um padrão novo. Cobre as convenções que a Fase 2b decidiu (design
system e casca da aplicação) e que toda tela nova segue. Os valores literais dos tokens (cores,
tipografia, espaçamento) vivem em `app/globals.css` e em `amassa-plataforma/04-DESIGN-SYSTEM.md`
§2 — não estão repetidos aqui.

---

## 1. Confirmação destrutiva (UI-08)

**Nenhuma remoção é silenciosa.** Toda exclusão pede confirmação, e o texto **sempre nomeia o
que se perde** — nunca "Tem certeza?" sozinho, que não diz nada sobre o que está em jogo.

**Formato obrigatório, literal:**

```
Excluir {item}? {o que é perdido, nomeado}.
```

**Exemplo da fonte** (`amassa-plataforma/04-DESIGN-SYSTEM.md` §7):

> "Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão apagados."

A implementação usa o `alert-dialog` do shadcn/ui. Ele **não foi instalado na Fase 2b** (D-07)
porque não havia nada para excluir ainda — nenhuma tabela de produto, nenhuma Server Action de
exclusão. **Implementado na Fase 3**, junto da primeira exclusão real do sistema (encomendas):
`components/amassa/encomendas/confirmar-excluir.tsx` é a referência do formato — título nomeando
a encomenda entre aspas «», corpo com a contagem real de itens (singular/plural), botão de
confirmação em `--color-erro` (`variant="destructive"`), e o par
`open`/`enviando`/`preventDefault()` que impede o diálogo de fechar sozinho antes da resposta do
servidor. `components/amassa/encomendas/confirmar-cancelar.tsx` é a variante **não-destrutiva**
do mesmo padrão (D-08): mesmo trio de estado em trânsito, botão em `outline` em vez de
`destructive`.

**PD-01 (decisão da Fase 3):** um nome de encomenda comprido e sem espaço nunca estoura a
largura do diálogo — o título usa `overflow-wrap: anywhere` e quebra em linha, nunca corta nem
força rolagem horizontal. Vale para qualquer `alert-dialog`/`dialog` futuro cujo título venha de
um dado do usuário sem garantia de tamanho.

---

## 2. Estados obrigatórios em toda tela (UI-07)

`CLAUDE.md` é explícito: estados vazios, de carregamento e de erro em **toda** tela — tela em
branco enquanto carrega é defeito, não detalhe. Três componentes compartilhados resolvem isso;
nenhuma tela nova reimplementa a moldura, só troca as strings:

- **`components/amassa/estado-vazio.tsx`** (`EstadoVazio`) — frase de contexto + botão principal
  (opcional; omitir `rotuloBotao` remove o botão inteiro, não só o desabilita) + nota junto do
  botão. Use para "ainda não existe nada aqui".
- **`components/amassa/estado-erro.tsx`** (`EstadoErro`) — título + corpo em linguagem humana +
  ação (`acao`, um `ReactNode` — botão de cliente com `reset()` ou link de servidor, dependendo
  de quem usa). `role="alert"` sempre no contêiner. Use para `error.tsx` e `not-found.tsx` de
  qualquer segmento novo.
- **Padrão de `loading.tsx` com `Skeleton`** — o esqueleto tem o **formato do conteúdo que
  substitui** (cabeçalho + área de conteúdo, ou o formato específico da lista/cartão que a tela
  mostra), nunca um "carregando..." solto. Ver `app/(app)/loading.tsx` como exemplo de referência.

**Regra de D-03, sempre válida:** um esqueleto de carregamento **nunca é espaço reservado
permanente** — só aparece enquanto algo carrega de verdade. Um esqueleto que nunca resolve lê
como travamento. Espaço reservado para "nada aqui ainda" é `EstadoVazio`, não `Skeleton`.

---

## 3. A fronteira `components/ui/` × `components/amassa/` (D-11)

A fronteira é por **origem**, não por assunto:

- **`components/ui/`** — território do `shadcn add`. Todo arquivo aqui foi gerado pela CLI e
  pode ser **sobrescrito** por uma atualização futura (`shadcn add` de novo, ou upgrade de
  versão). Nunca edite estes arquivos à mão — se precisar de uma variação, componha por cima em
  `components/amassa/`, não altere o gerado.
- **`components/amassa/`** — código nosso. Nunca é tocado pelo shadcn, nunca é sobrescrito por
  ele. É aqui que qualquer composição, convenção ou regra específica do AMASSA vive.
- **`lib/utils.ts`** também é território do shadcn (a função `cn()` que ele gera na
  inicialização) — mesma regra: não editar à mão além do que a CLI já escreveu.

---

## 4. O que cada fase instala

Cada fase instala os componentes shadcn que ela própria usa — kit completo antecipado vira pasta
de código não usado que envelhece antes de ser tocado (D-06).

**Instalados na Fase 2b:** `button`, `card`, `sidebar`, `sheet`, `skeleton`, `dropdown-menu`,
`separator`. (`tooltip` e `input` vieram arrastados pela dependência do `sidebar` no registro do
shadcn — não foram escolha da fase, mas também satisfazem D-06/D-07: nenhum componente extra por
decisão nossa.)

**Instalados na Fase 3** (os sete que 03-UI-SPEC.md "Design System" nomeava, nenhum a mais):
`alert-dialog`, `sonner`, `select`, `dialog`, `form`, `label`, `switch`. **Achado relevante para
a Fase 4 não reinstalar às cegas:** o item `form` do registro (preset `radix-nova`, CLI `3.8.5`)
**não tem nenhum arquivo para instalar** — `npx shadcn@3.8.5 add form` roda sem erro mas não cria
`components/ui/form.tsx`. A composição real usada pelo formulário de encomendas é
`react-hook-form` + `@hookform/resolvers/zod` diretos, com `field` (`Field`/`FieldLabel`/
`FieldError`) para a moldura de rótulo/erro — ver `components/amassa/encomendas/
formulario-encomenda.tsx` e `03-01-SUMMARY.md`/`03-06-SUMMARY.md` para o achado completo
(`WINDOWS.md` id 4, `fixed`).

**Ficam para depois:**

- **`--color-chart-1` a `--color-chart-5`** — Fase 4, quando o Recharts entrar para os relatórios
  de queima.

CLI do shadcn fixada em **`3.8.5`**, não `@latest` — consistência com `components.json`
(`style: radix-nova`) e os componentes já commitados. Trocar de versão no meio do projeto
arrisca gerar componentes novos com convenções diferentes dos já existentes.

---

## 5. Avisos temporários

Avisos (toast) duram **5 segundos**, no rodapé no celular e no canto no desktop.

**Exceção nomeada:** o toast com "Desfazer" do registro de queima dura **7 segundos** — ali o
aviso não é só informativo, é uma janela de ação (a pessoa pode decidir desfazer o registro).
Chega na Fase 4, com a implementação do contador de forno.

---

## 6. As regras duras herdadas — valem para toda tela nova

- **Um botão terracota (`--color-acento` / `bg-primary`) por tela, no máximo.** Cor é
  informação neste sistema, não decoração — mais de um botão primário por tela dilui o que a cor
  está dizendo.
- **Campo de formulário nunca abaixo de 16px de fonte.** Abaixo disso o iOS dá zoom sozinho ao
  focar — é defeito de usabilidade, não preferência estética.
- **Alvo de toque de no mínimo 44×44px** em todo botão, item de navegação e ícone clicável.
- **Nenhuma tela exige rolagem horizontal no celular** (UI-06) — única exceção em todo o sistema
  é o Gantt de Encomendas no desktop, que no celular nem existe (vira lista de cartões).
- **Erro sempre diz o que fazer.** "Verifique a internet e tente de novo", nunca "Erro 500" ou
  qualquer mensagem que não indique uma próxima ação para quem está lendo.
- **Voz afetiva, sensorial, direta — nunca corporativa** (`04-DESIGN-SYSTEM.md` §9): "Nada por
  aqui ainda. Cadastre o primeiro material.", nunca "Nenhum registro encontrado no sistema."
  Feminino ao falar de alunas; forma neutra para quem usa o sistema (gestores).

---

## 7. Escrita rápida NÃO-otimista (D-15, Fase 3)

`04-DESIGN-SYSTEM.md` §7 traça a linha: **presença de aula e movimentação de estoque são
otimistas** (a tela assume sucesso e reverte se o servidor discordar); **encomendas não são** —
mudar a duração de uma etapa ou o status de um marco precisa de confirmação do servidor antes de
qualquer número na tela virar definitivo. A referência de implementação é
`components/amassa/encomendas/ajuste-rapido-etapa.tsx` (D-15, segundo caminho de escrita de uma
encomenda, ao lado do formulário completo). As Fases 4 a 6 (Fornos, Agenda, Estoque) vão
precisar decidir, cada uma na sua vez, para qual lado do §7 cada escrita rápida cai — o padrão
abaixo é o modelo de referência para o lado não-otimista.

**Os quatro passos, sempre nesta ordem:**

1. **Mudança visual local imediata** — o número/estado muda na tela no mesmo clique, sem esperar
   rede. É o que faz o controle parecer responsivo.
2. **Indicador de "em voo" + `disabled`** — um spinner substitui o valor (ou o controle
   desabilita), e o PRÓPRIO `disabled` é a defesa contra um segundo toque disparar uma segunda
   escrita antes da primeira confirmar.
3. **Falha reverte, com aviso** — se o servidor devolver `{ ok: false }`, o valor volta ao que
   era ANTES do passo 1 (nunca fica preso no valor otimista), e um `toast.error` explica o que
   fazer.
4. **Sucesso adota o valor do SERVIDOR, nunca o do passo 1** — mesmo quando os dois batem na
   prática, o componente lê `resposta.dados`, não o valor local calculado no clique. É essa
   leitura, e não o passo 1, que decide o número final — o que torna "duas gravações quase
   simultâneas somam, a última não vence sozinha" uma garantia do servidor (`select ... for
   update` + delta relativo, nunca valor absoluto do cliente), não uma sorte da interface.

**Nunca envie um valor absoluto do que a tela mostra** — envie um delta (`+1`/`-1`) ou um
interruptor (`ligado: boolean`). É o servidor, com a linha travada, quem soma; a tela só pede a
operação.
