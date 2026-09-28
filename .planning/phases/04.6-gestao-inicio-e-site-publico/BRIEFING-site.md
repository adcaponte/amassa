# Site público — amassacerrado.com.br

> Briefing escrito com o Theo no Cowork em **26/09/2026**, junto com o protótipo (`prototipo.html`,
> nesta pasta — "AMASSA CERRADO", **aprovado pelo Theo em 26/09/2026** para subir como está).
> **O protótipo vence sobre a interface; este documento vence sobre regra de dado.**
> Substitui a página "Em breve": ✅ **decisão do Theo (26/09): não haverá "Em breve" — sobe este
> site, com os dados entre colchetes, e uma faixa "em construção" no topo.**

## 1. O que é

Página única (rolagem), pública, sem login, na raiz do domínio. Seções, nesta ordem: **faixa "em
construção"** · abertura · o espaço (café · uso livre · loja física) · aulas e oficinas (agenda
pública) · encomendas · foto da fachada (faixa) · onde fica / contato · rodapé.

- **Botões fixos** "Agenda" e "Encomendas": na barra superior fixa (computador) e numa barra fixa no
  rodapé (celular). Rolam até a seção. Sempre visíveis.
- Fontes: Fraunces (títulos) + Inter. Cores do protótipo (`--barro`, `--cerrado`, `--sol`…), as
  mesmas famílias da plataforma. Sem JS além do calendário.
- **Nenhum link para `/gestao`.** Acesso à plataforma só por endereço (decisão antiga, mantida).

## 2. Conteúdo: textos e imagens em arquivo, no repositório (decisão do Theo, 26/09)

✅ **Modelo simples para a abertura.** O site é uma página estática do Next: os textos ficam num
arquivo de conteúdo (`conteudo/site.json` ou `.md`, um campo por trecho — as 24 chaves `data-t`
do protótipo) e as imagens em `public/site/` (os 6 slots nomeados: `abertura`, `cafe`, `uso-livre`,
`loja`, `encomendas`, `fachada`, mais a logo). Trocar texto ou foto = commit + deploy automático.
**Nenhum dado real no repositório além do que já é público no site** (endereço, horário, telefone
comercial e Instagram são públicos por natureza; nada de dado de cliente).

- **Sobe com colchetes**: onde falta dado real ("Rua [nome da rua]", "(62) 9 0000-0000"…) fica
  como está; o Theo manda os valores e o Code troca. Os textos do protótipo são a versão inicial.
- Fotos atuais: as da pasta `imagens/` desta pasta (o protótipo as carrega embutidas; no site
  viram arquivos otimizados).
- **Botões de WhatsApp — agora reais no protótipo (28/09)**: um único número no arquivo de
  conteúdo (`ZAP`, só dígitos com 55 e DDD; no protótipo é o placeholder `5562900000000`), e cada
  botão leva a sua mensagem por `https://wa.me/<número>?text=<mensagem>`, em nova aba. As mensagens
  estão no HTML, em `data-zap` ou montadas no cartão do evento: "Oi! Quero pedir um orçamento de
  peças." · "Oi! Vim pelo site do ateliê." (contato e rodapé) · "Oi! Quero saber das próximas aulas e
  oficinas." · "Oi! Quero saber a disponibilidade do uso livre." · "Oi! Quero reservar: <nome>
  (<toda terça | dd/mm>)." (cartão de evento, quando o calendário existir). O Instagram é link
  direto; "Abrir no mapa" abre o Google Maps com a busca pelo nome até o endereço existir.
- Mapa: embed do Google Maps a partir do endereço; enquanto não houver endereço, o placeholder.
- **Cadastro editável pelo `/gestao` fica para depois** (Polimento, ou quando o Theo e a Andressa
  sentirem falta de editar sozinhos). Já tem protótipo — `prototipo-cadastro.html`, "Cadastro do
  Site AMASSA" — e é um acréscimo, não um refazer: o arquivo de conteúdo vira o valor inicial da
  tabela, e a página passa a ler de lá.

## 3. Agenda pública (a parte viva)

Lê o módulo **Agenda** (`lib/agenda/consultas`), só eventos com **"Mostrar no calendário público"**
marcado, não cancelados, a partir de hoje. Duas vistas: **Próximas** (turma fixa aparece uma vez,
como "toda terça, 19h às 21h"; oficinas por data) e **Calendário mensal** (ponto por evento na cor
do tipo; cinza = esgotado; dia fechado marcado; toque no dia lista os eventos; navegação por mês).
Cartão: nome, quando, preço (mês ou por pessoa), "material incluso", **vagas restantes** (n vagas ·
últimas 2 · última vaga · esgotado) e "Reservar pelo WhatsApp" (some quando esgotado). **Sem nome de
aluno, sem reserva online.** Bloco fixo "Uso livre" com texto e "Consulte disponibilidade".

⚠️ **Enquanto a Agenda não existir — e é este o estado que vai ao ar em dezembro — a seção tem
desenho próprio, no protótipo desde 28/09** (é o estado padrão ao abrir; o botão "protótipo: ver
como fica quando a Agenda existir" alterna para o calendário): título e texto da seção; **três
cartões de texto** (Turmas fixas · Oficinas de uma tarde · Uso livre do ateliê, cada um editável no
arquivo de conteúdo); **dois botões de WhatsApp** — "Quero saber das próximas aulas" e
"Disponibilidade do uso livre" — e a frase "O calendário com as datas e vagas entra aqui em breve."
Nada de dado inventado, nada de calendário vazio. Quando a Agenda entrar, os três cartões saem e o
calendário entra no lugar; os botões continuam. Renderização no servidor, cache curto (minutos).

## 4. Técnica

- Rota `/` pública no mesmo Next; layout próprio (sem a barra da plataforma). 🔴 **Isolamento:** a
  página é estática (os textos vêm de arquivo); só a seção da agenda lê o banco, gerada e guardada
  em cache com revalidação por tempo, nunca a cada visita; nada lê sessão — **se o Postgres cair, o site continua no ar** com a
  última versão (regra do ESTADO-ATUAL, mantida). SEO básico: título,
  descrição, Open Graph com a foto de abertura, `robots` liberado, sitemap. Critério do Theo:
  aparecer no Google para "amassa cerrado pirenópolis".
- Acessibilidade e mobile como o resto: alvos de 44px, sem rolagem lateral a 320px, contraste AA
  (a faixa amarela `--sol` com texto `--tinta` passa; conferir).
- Imagens servidas otimizadas (next/image ou equivalente), com `alt` no arquivo de conteúdo.
- e2e: página abre sem login, botões fixos rolam, calendário navega e filtra por dia, agenda vazia
  não quebra.

## 5. Fora desta fase

Ilustrações de fundo (a Andressa vai produzir; entram como imagens do cadastro quando existirem —
prever slots "decoração por seção" opcionais) · loja online · blog · reserva online · página
"quem somos" separada (por ora é o rodapé).
