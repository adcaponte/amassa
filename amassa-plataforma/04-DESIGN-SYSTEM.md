# 04 — Design System e UX

> Os três protótipos têm paletas próximas mas não idênticas. Este arquivo unifica as três,
> ancorando na identidade real do AMASSA. É a fonte única de verdade visual.

---

## 1. De onde vêm as cores

| Origem | O que trouxe |
|--------|--------------|
| Site do AMASSA | `#1d2221` (verde-preto), `#5b2916` e `#894025` (terracota), `#f6f7f6`, `#b8b4a3`, `#303b24`, `#ffbd59` |
| Protótipo Agenda | fundo `#F6F3F0`, acento `#6B4B3E`, bordas `#E8E2DC` / `#D8CFC7` |
| Protótipo Encomendas | as 6 cores de etapa e a paleta quente de papel |
| Protótipo Fornos | os 3 tipos de queima e os 3 níveis do contador |

A unificação usa o **fundo e as bordas da Agenda** (mais claros, melhores em celular),
o **terracota do site** como cor de ação, e mantém **intocadas** as cores que carregam
significado — as 6 de etapa, as 3 de modalidade, as 3 de tipo de queima e as 3 de nível.

> **O protótipo de Fornos usa uma base cinza** (`#F5F5F4`, bordas `#E7E5E4`, texto
> `#1C1917`) e acento âmbar `#D97706`, em vez da base quente dos outros dois. **Descarte a
> base cinza** e use a paleta unificada abaixo — só as cores semânticas do módulo (tipos e
> níveis) são preservadas. Caso contrário o sistema tem duas identidades visuais.

---

## 2. Tokens

```css
@theme {
  /* superfícies */
  --color-fundo:        #F6F3F0;
  --color-superficie:   #FFFFFF;
  --color-superficie-2: #EFEAE5;

  /* linhas */
  --color-borda:        #E8E2DC;
  --color-borda-forte:  #D8CFC7;

  /* texto */
  --color-tinta:        #1D2221;   /* 14.6:1 sobre o fundo */
  --color-tinta-media:  #5A4C44;   /*  7.4:1 — aprovado AA */
  --color-tinta-fraca:  #6E5F56;   /*  5.4:1 — aprovado AA */

  /* ação — terracota AMASSA */
  --color-acento:       #894025;
  --color-acento-hover: #5B2916;
  --color-acento-fundo: #F3EDE9;
  --color-destaque:     #FFBD59;

  /* etapas da encomenda — NÃO ALTERAR */
  --color-producao:     #8B6F47;
  --color-secagem:      #C9B896;
  --color-queima1:      #C2451B;
  --color-esmaltacao:   #2E7D8C;
  --color-queima2:      #7A3527;
  --color-entrega:      #5B7553;

  /* modalidades de aula — NÃO ALTERAR */
  --color-modelagem:    #92400E;
  --color-torno:        #115E59;
  --color-pintura:      #1D4ED8;

  /* tipos de queima — NÃO ALTERAR */
  --color-biscoito:     #9A3412;
  --color-esmalte:      #155E75;
  --color-ouro:         #CA8A04;

  /* níveis do contador de forno — NÃO ALTERAR */
  --color-forno-ok:      #D97706;  --color-forno-ok-fundo:      #FFFBEB;  --color-forno-ok-texto:      #92400E;
  --color-forno-atencao: #CA8A04;  --color-forno-atencao-fundo: #FEF9C3;  --color-forno-atencao-texto: #854D0E;
  --color-forno-critico: #DC2626;  --color-forno-critico-fundo: #FEE2E2;  --color-forno-critico-texto: #991B1B;

  /* semânticas */
  --color-sucesso:      #15803D;   --color-sucesso-fundo: #DCFCE7;
  --color-atencao:      #B45309;   --color-atencao-fundo: #FEF3C7;
  --color-erro:         #B91C1C;   --color-erro-fundo:    #FEE2E2;

  /* raio — no Tailwind v4 o namespace É "--radius-*".
     Um token chamado só "--radius" não gera nenhum utilitário rounded-*. */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;   /* Card e Dialog do shadcn usam rounded-xl */
}
```

**Cuidado com o texto sobre `--color-secagem` (`#C9B896`):** é claro demais para texto
branco. Use `#3A331F` sobre ele, como o protótipo já faz.

**Contraste conferido.** `--color-tinta-fraca` foi escurecido de `#8A7A70` (3,7:1 — reprova
no AA) para `#6E5F56` (5,4:1). Como é justamente a cor dos metadados em 14px, o valor
original violaria o critério de acessibilidade declarado no briefing. Vale a pena verificar
o resto das combinações com uma ferramenta de contraste antes de fechar a M1 — "parece
legível na minha tela" não é o teste.

### Ligando os tokens ao shadcn/ui — passo obrigatório

Os componentes do shadcn não leem `--color-acento`. Eles esperam os nomes deles:
`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--input`.
**Sem esse mapeamento, todo componente instalado renderiza com a paleta padrão do Tailwind**
— e o critério de aceite da M1 é literalmente "as cores já são as do AMASSA".

```css
@theme inline {
  --color-background:         var(--color-fundo);
  --color-foreground:         var(--color-tinta);
  --color-card:               var(--color-superficie);
  --color-card-foreground:    var(--color-tinta);
  --color-popover:            var(--color-superficie);
  --color-popover-foreground: var(--color-tinta);
  --color-primary:            var(--color-acento);
  --color-primary-foreground: #FFFFFF;
  --color-secondary:          var(--color-superficie-2);
  --color-secondary-foreground: var(--color-tinta);
  --color-muted:              var(--color-superficie-2);
  --color-muted-foreground:   var(--color-tinta-fraca);
  --color-accent:             var(--color-acento-fundo);
  --color-accent-foreground:  var(--color-acento);
  --color-destructive:        var(--color-erro);
  --color-destructive-foreground: #FFFFFF;
  --color-border:             var(--color-borda);
  --color-input:              var(--color-borda-forte);
  --color-ring:               var(--color-acento);

  /* O componente Sidebar do shadcn tem namespace próprio.
     Sem estas seis, a barra lateral de 240px sai com a paleta padrão. */
  --color-sidebar:                    var(--color-superficie);
  --color-sidebar-foreground:         var(--color-tinta);
  --color-sidebar-primary:            var(--color-acento);
  --color-sidebar-primary-foreground: #FFFFFF;
  --color-sidebar-accent:             var(--color-acento-fundo);
  --color-sidebar-accent-foreground:  var(--color-acento);
  --color-sidebar-border:             var(--color-borda);
  --color-sidebar-ring:               var(--color-acento);
}
```

Se em algum momento entrar gráfico no painel inicial, o shadcn espera também
`--color-chart-1` a `--color-chart-5`. Não precisa agora.

Faça isso na **primeira fase de UI da M1**, antes de instalar qualquer componente. Ajustar
depois significa revisar tela por tela.

---

## 3. Significado das cores (não decorativo)

- **Terracota `#894025`** = ação principal. Um botão terracota por tela, no máximo.
- **Cores de etapa** = só na timeline de encomendas e na legenda. Nunca como decoração.
- **Cores de modalidade** = só na agenda.
- **Cores de tipo de queima** = só no módulo de fornos e nos gráficos dele.
- **Verde/âmbar/vermelho** = estado, nunca marca. Vermelho de "turma excedida" é
  informação, não erro — não use ícone de alerta junto.

> **Dois conflitos de cor no módulo de fornos, herdados do protótipo. Nenhum é bug — mas os
> dois precisam de cuidado no desenho.**
>
> **1. Vermelho com dois significados no sistema.** No forno, `#DC2626` é urgência real
> ("resistência no fim da vida"); na agenda, o vermelho de "turma excedida" é só informação.
> Separe pelo ícone: o cartão do forno em crítico leva ícone de alerta, a turma excedida não.
>
> **2. `--color-ouro` e `--color-forno-atencao` são a mesma cor (`#CA8A04`)** — e as duas
> aparecem na mesma tela de relatórios. O que as distingue é o contexto: ouro só aparece
> como segmento de barra empilhada, sempre acompanhado da legenda; o âmbar de atenção só
> aparece em medidor, selo e banner. **Nunca coloque um selo de nível dentro de um gráfico**,
> e a ambiguidade não se materializa.
>
> Não "corrija" essas cores mudando os valores. Elas vêm dos protótipos e provavelmente já
> estão na cabeça de quem os viu; a solução é de composição, não de paleta.

---

## 4. Tipografia — decisão pendente do Theo

O mídia kit do AMASSA usa **Vinila Condensed**, uma fonte licenciada. Não dá para assumir
que ela pode ser usada na web sem verificar a licença.

Três caminhos:

| Opção | Títulos | Corpo | Comentário |
|-------|---------|-------|-----------|
| **A — recomendada** | **Archivo Narrow** (Google Fonts) | **Inter** | Archivo Narrow é condensada e se aproxima da Vinila. Inter é a fonte mais legível que existe para interface em tela pequena. Gratuitas, rápidas, sem risco jurídico. |
| **B — fiel à marca** | **Vinila Condensed** | **Inter** | Exige confirmar a licença web e hospedar o arquivo. Mais fiel, mais burocracia. |
| **C — mais quente** | **Fraunces** ou Georgia | **Inter** | Serifada, puxa o clima artesanal do protótipo de Encomendas. Menos alinhada ao mídia kit. |

**Enquanto o Theo não decidir, use a opção A.** Trocar depois é mudar duas linhas.

**Escala** (base 16px, generosa — o sistema é usado sob luz forte e com as mãos ocupadas):

```
display  28/32  700   títulos de página
título   20/28  600   títulos de seção
corpo    16/24  400   padrão — nunca menor que isto em campos de formulário
apoio    14/20  400   metadados
micro    12/16  500   rótulos em caixa alta, com letter-spacing 0.06em
mono     13/18  400   números, datas, quantidades
```

> Campo de formulário com fonte menor que 16px faz o iOS dar zoom sozinho ao focar.
> Isso não é preferência estética — é um defeito de usabilidade.

---

## 5. Navegação

**Celular** — barra fixa inferior, 5 itens, ícone + rótulo, altura mínima 56px:

```
[ Início ] [ Encomendas ] [ Agenda ] [ Queimas ] [ Estoque ]
```

Orçamentos entra pelo menu do usuário até virar um módulo real.

**Desktop** — barra lateral recolhível de 240px, com os mesmos itens, mais o menu do
usuário no rodapé.

---

## 6. Adaptações obrigatórias para celular

| Tela | Desktop | Celular |
|------|---------|---------|
| Encomendas | Gantt horizontal, 18px/dia | **Lista vertical de cartões.** Cada cartão: nome, cliente, trilha das 6 etapas como segmentos horizontais, etapa atual destacada, dias restantes |
| Agenda | Grade completa da semana | **Um dia por vez**, com setas e um seletor de dia no topo |
| Presença | Tabela | **Lista de linhas altas** (mínimo 56px), toque único alterna presente↔falta |
| Estoque | Tabela com colunas | **Cartões** com nome, saldo em destaque e faixa de alerta |
| Fornos | Grade de cartões | **Cartões empilhados**, botão "Queimar" ocupando a largura toda |
| Formulários | Modal centralizado | **Folha que sobe de baixo**, ocupando a tela toda |

**Regra dura:** nenhuma tela pode exigir rolagem horizontal no celular, com exceção do
Gantt no desktop — que no celular nem existe.

---

## 7. Padrões de interação

- **Salvamento otimista** em presença e estoque: a interface responde na hora e reverte se
  o servidor recusar, com aviso. A conexão no ateliê pode ser ruim; esperar o servidor
  torna a marcação de presença insuportável.
- **Confirmação destrutiva** sempre nomeia o que será perdido:
  *"Excluir a encomenda «Coleção Verão»? Os 3 itens dela serão apagados."*
- **Avisos temporários** (toast) de 5 segundos, no rodapé no celular e no canto no desktop —
  como o protótipo da agenda já faz. **Exceção: o toast com "Desfazer" da queima dura 7
  segundos**, porque ali o aviso não é informativo, é uma janela de ação.
- **Estados vazios com ação**: sempre uma frase de contexto e um botão. Nunca uma tela
  em branco.
- **Carregamento** com esqueleto no formato do conteúdo, não com um "carregando..." solto.

---

## 8. O que preservar dos protótipos, literalmente

Estes detalhes são específicos e fáceis de perder em uma reescrita. Cada um deles é uma
decisão de produto que já foi tomada:

**Encomendas**
- 18px por dia, cabeçalho em quinzenas (1–15 e 16–fim do mês)
- Marcos como losango; barras como retângulo
- Rótulo da etapa só aparece se a barra tiver mais de 46px
- A timeline abre já rolada até o "Hoje"
- Estado vazio: *"A roda ainda não gira"*
- Rodapé do formulário mostrando duração total e data de conclusão, atualizando conforme
  você digita

**Agenda**
- Indicador de assentos com três níveis (aberta / completa / excedida)
- Aviso ao adicionar alguém que já está em outra turma no mesmo dia e turno
- Alunas experimentais em âmbar, com nota, e o botão de efetivar matrícula
- Domingo como opção, não como padrão
- Quatro estatísticas no topo: aulas, pessoas, experimentais, vagas livres
- Autocompletar com nomes já conhecidos ao adicionar aluna

**Fornos**
- Registrar queima em **dois toques**: um no botão do cartão, outro no tipo. Sem formulário,
  sem campo obrigatório. É o fluxo mais usado do sistema inteiro
- Aviso com **"Desfazer"** por 7 segundos depois de registrar
- **Medidor** com entalhes a cada 10 queimas, marca vertical no limiar de atenção e rótulos
  `0 / atenção N / limite N` sob a barra. Contador `atual / limite` em números tabulares.
  Não simplifique para uma barra lisa — os entalhes são o que deixa o ritmo de desgaste
  legível de relance
- **Selo textual** no cartão: "Manutenção próxima" em atenção, "Manutenção vencida" em
  crítico, nada em ok
- **Banner agregado** no topo da aba: *"2 fornos precisam de atenção: Forno 01 (95/100) ·
  Forno 02 (103/100)"*
- Rodapé do cartão: *"Última manutenção em {data} · {responsável}"* ou *"Sem manutenção
  registrada"*, seguido de *"· {total} no total"*
- A janela de manutenção dizendo, em texto, "o contador vai de N para 0"
- Alternador de granularidade nos relatórios: **Semana / Mês**

---

## 9. Voz da interface

O AMASSA fala de forma afetiva, sensorial e direta — *"Faça cerâmica, é gostoso demais"*,
*"respeitando seu ritmo"*. A plataforma é uma ferramenta interna, então o registro é mais
sóbrio, mas nunca corporativo:

- **Sim:** "Nada por aqui ainda. Cadastre o primeiro material."
- **Não:** "Nenhum registro encontrado no sistema."
- **Sim:** "Não deu para salvar. Verifique a internet e tente de novo."
- **Não:** "Erro ao processar a requisição (500)."

Trate a usuária no feminino quando falar de alunas — o público do ateliê é
predominantemente feminino e o próprio material do AMASSA fala em "alunas".
Para quem usa o sistema (gestores), use forma neutra.
