# Verificação Humana — Fase 2b: Design System e Casca da Aplicação

**Gerado por:** execução do plano `02b-05-PLAN.md`, Tarefa 3.
**Por que existe:** três coisas que nenhuma ferramenta mede — conforto do polegar, a voz de uma
frase e "isto parece o AMASSA" — foram deixadas de fora da automação de propósito, em vez de
viraram um item de checklist que alguém aprova sem olhar. Tudo o que uma medição real conseguia
provar já foi convertido em teste e está passando (ver rodapé "O que já está automatizado").

**Quando fazer:** assim que o dono estiver disponível. Não bloqueia o fechamento técnico deste
plano — a SUMMARY registra estes itens como pendentes de conferência do dono, não como reprovados
nem como aprovados por presunção.

---

## Item 1 — UI-05: a navegação é confortável com o polegar?

**Dispositivo:** um celular de verdade (Android ou iPhone), não o simulador de celular do
navegador do desktop. Este é o único item da fase que exige isso — é literalmente o Core Value
do projeto (`PROJECT.md`): "funciona de pé, no ateliê, com a mão suja, num celular".

**O que fazer:**
1. Abra o endereço público do sistema no celular, em pé, segurando o aparelho com uma mão só
   (a mão que normalmente seguraria o telefone ao trabalhar no ateliê).
2. Entre com a sua conta.
3. Sem reposicionar o aparelho nem usar a outra mão, alcance com o polegar, em ordem: Início,
   Encomendas, Agenda, Queimas, Estoque (os cinco itens da barra inferior).
4. Abra o menu do usuário pelo avatar (canto superior direito do cabeçalho) e alcance "Sair".

**O que conta como aprovado:** todo alcance é confortável — o polegar chega sem esticar, sem
precisar reposicionar a pega do aparelho, sem "ginástica". Se algum item exigir esticar até
doer ou trocar a pega da mão, anote **qual item** e **em que aparelho** (tamanho de tela
importa aqui).

**Resultado:** _(a preencher pelo dono)_

---

## Item 2 — D-05: a voz das frases soa como o AMASSA?

Só a frase de Encomendas ("A roda ainda não gira.") veio pronta do documento de design
(`04-DESIGN-SYSTEM.md` §8). As demais abaixo foram escritas pelo executor seguindo a voz da §9
(afetiva, sensorial, direta, nunca corporativa) e precisam da leitura do dono antes de ficarem
definitivas.

| Tela | Título | Corpo |
|------|--------|-------|
| `/agenda` | "Nenhuma turma na grade ainda." | "Cadastre a primeira turma e as aulas da semana aparecem aqui, com data e presença por aluna." |
| `/queimas` | "Nenhum forno cadastrado ainda." | "Cadastre o primeiro forno para começar a contar as queimas em dois toques." |
| `/estoque` | "Nada no estoque ainda." | "Cadastre o primeiro material — cerâmica, pintura ou bordado — para começar a controlar o saldo." |
| `/orcamentos` | "A calculadora ainda não existe." | "Ela depende das planilhas de precificação do ateliê. Assim que estiverem prontas, o orçamento sai daqui." |

**O que fazer:** ler as quatro linhas em voz alta (ou como se estivesse explicando para alguém
no ateliê). Perguntar: isso soa afetivo, direto, sensorial — como "A roda ainda não gira." — ou
soa corporativo, tipo "Nenhum registro encontrado no sistema."?

**O que conta como aprovado:** as quatro frases soam como o AMASSA. Qualquer uma que não soar,
reescrever — não precisa ser nesta sessão; anotar a frase nova é suficiente para a próxima
execução aplicar.

**Resultado:** _(a preencher pelo dono)_

---

## Item 3 — Olhada geral nas dez telas

**Dispositivo:** celular real (o mesmo do Item 1) e desktop.

**O que fazer:** percorrer as dez telas (`/login`, `/`, `/encomendas`, `/agenda`, `/queimas`,
`/estoque`, `/orcamentos`, mais os estados de erro/404 se for prático de disparar) e conferir:

- As cores são as do AMASSA — areia (`#F6F3F0`) de fundo, terracota (`#894025`) só no único
  botão/ação principal de cada tela, nunca decoração solta.
- O título de cada tela usa a fonte condensada (Archivo Narrow) — deve parecer visivelmente mais
  estreita que o corpo do texto, não uma fonte genérica do sistema.
- O corpo do texto é legível **sob luz forte** — o teste real é abrir o celular do lado de fora,
  ou perto de uma janela com sol direto, e ver se o texto cinza-claro (`--color-tinta-fraca`,
  usado em notas e legendas) ainda se lê sem esforço. (O contraste numérico já foi confirmado por
  ferramenta — ver rodapé; este item é sobre a experiência real de luz ambiente, que uma
  ferramenta não simula.)

**O que conta como aprovado:** as cores, a tipografia e a legibilidade batem com o que o dono
esperava ao aprovar `04-DESIGN-SYSTEM.md`. Qualquer estranheza, anotar a tela e o que incomodou.

**Resultado:** _(a preencher pelo dono)_

---

## O que já está automatizado (não precisa ser reconferido aqui)

Para não duplicar esforço — tudo abaixo já tem prova de máquina em `tests/e2e/acessibilidade.spec.ts`,
rodando nos dois projetos (desktop e celular) e passando:

- Alvo de toque ≥ 44px em todos os itens da barra inferior, no botão de avatar e em todos os
  itens da barra lateral.
- Nome acessível do avatar (`aria-label="Abrir menu do usuário"`) único e correto no celular.
- Contraste AA das quatro regras (`color-contrast`, `button-name`, `link-name`,
  `aria-allowed-attr`) varrido por `axe-core` nas sete rotas da fase — **zero violações
  encontradas** na execução real deste plano.
- Navegação completa só por teclado: do e-mail até "Entrar" no login, e do corpo da página até
  o menu do usuário depois de logado.
- Nenhuma das sete rotas exige rolagem horizontal a 320px de largura.
- **O truncamento do nome de usuário longo** (rodapé da barra lateral no desktop, menu do
  usuário no celular) — item que nasceu como "backstop" (verificação manual) no
  `02b-UI-SPEC.md` e foi convertido em asserção automatizada real nesta execução: uma conta de
  nome longo é criada de verdade (`scripts/criar-usuario.ts`), o truncamento é medido por CSS
  computado (`scrollWidth > clientWidth`, `text-overflow: ellipsis`) e a conta é desativada ao
  final. **Achado real:** o nome de exemplo de 43 caracteres do Item 1 desta verificação (se o
  dono quiser repeti-lo manualmente) cabe justo dentro do menu do celular sem cortar — só nomes
  mais longos (~50+ caracteres) exercitam o corte visualmente nesse aparelho. Isso não é um
  defeito: o comportamento de truncar continua correto, só o limiar em que ele aparece é maior
  do que a intuição sugeriria.
