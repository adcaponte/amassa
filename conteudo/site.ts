// O CONTEÚDO INTEIRO do site público, num arquivo só, versionado, zero import (D-15/D-17):
// trocar um texto, o número do WhatsApp ou o placeholder de uma cor é editar este arquivo,
// commit e deploy — nenhuma tabela nova, nenhuma leitura de banco na página pública.
//
// Os textos são os do protótipo v11 (prototipo-site.html), palavra por palavra — nenhum foi
// gerado, encurtado ou "melhorado" por quem implementou. Onde falta dado real (endereço,
// telefone), o texto sobe com colchete, como o protótipo já trazia — o dono manda o valor e
// vira uma troca de uma linha aqui.
//
// Nove trechos que no protótipo traziam marcação (`<b>`, `<span>`) viram ESTRUTURA aqui, nunca
// string com HTML: guardar marcação em conteúdo obrigaria `dangerouslySetInnerHTML` na única
// página pública do projeto — abrindo uma porta de injeção que não precisa existir. A estrutura
// (`{ destaque, resto }`, `{ linha1, linha2 }`...) também é o esquema que o cadastro editável
// adiado (prototipo-site-cadastro.html, fora desta fase) vai herdar como valor inicial da
// tabela — por isso o nome dos campos importa mais que o formato do arquivo.
//
// D-18 e a quarta chave. D-18 nomeia `c1-preco`, `c2-preco` e `c3-preco` como as três chaves
// que perdem o número: "sem preço no site", texto redirecionando para o WhatsApp. O protótipo
// v11 também trazia preço em `ag-livre` ("R$ 35 por hora") — a REGRA que D-18 enuncia é "sem
// preço no site", não uma lista fechada de três chaves, então `agLivre` foi reescrita pelo
// mesmo motivo. Isso é uma chave A MAIS do que a decisão original listou; o SUMMARY deste plano
// registra essa extensão para o dono confirmar. Se ele quiser o valor de volta no site, é editar
// esta linha.

export const CONTEUDO_SITE = {
  // Faixa "em construção" — primeiro elemento do corpo, sem botão de fechar (D-14).
  obra: {
    destaque: "Nosso site ainda está em construção",
    resto: " — mas pode ir xeretando aí.",
  },

  // Abertura (`#topo`).
  heroEyebrow: "Ateliê de cerâmica · café · Pirenópolis",
  heroTitulo: {
    linha1: "Um lugar para",
    linha2: "amassar barro.",
  },
  heroLead:
    "Ateliê aberto, aulas com a Andressa, café para ficar o tempo que quiser e peças feitas " +
    "aqui, no Cerrado. Abrimos em dezembro de 2026.",

  // O espaço (`#espaco`) — três cartões: café, uso livre, loja.
  espacoTitulo: "Três jeitos de passar um tempo aqui",
  espacoLead:
    "Você pode só tomar um café, pode sentar para fazer uma peça, pode levar uma pronta. Tudo " +
    "no mesmo lugar, sem pressa.",

  c1Titulo: "Café",
  c1Corpo:
    "Café coado, bolo do dia e uma mesa para ficar. Se der vontade, tem peça em biscoito para " +
    "você pintar enquanto o café esfria — a gente queima e avisa quando ficar pronta.",
  // D-18: preço original do protótipo era "Pintura em biscoito a partir de R$ 45, com a queima
  // inclusa." — o número sai, o texto vira o que a decisão manda.
  c1Preco: "Pintura em biscoito, com a queima inclusa. Consulte o valor pelo WhatsApp.",

  c2Titulo: "Uso livre do ateliê",
  c2Corpo:
    "Já sabe modelar e quer um lugar com bancada, ferramentas e forno? Venha no seu ritmo. " +
    "Ferramentas e utensílios estão inclusos; a queima das suas peças também.",
  // D-18: preço original era "R$ 35 por hora. Consulte disponibilidade pelo WhatsApp." —
  // mesmo tratamento das outras duas chaves de preço.
  c2Preco: "Consulte o valor e a disponibilidade pelo WhatsApp.",

  c3Titulo: "Loja",
  c3Corpo:
    "Em nossa loja temos peças prontas de diversas formas assim como materiais artisticos e " +
    "de papelaria.",
  // Já sem número no protótipo — nenhuma mudança de conteúdo aqui, só o lugar no arquivo.
  c3Preco: "A loja fica dentro do ateliê. Passe para ver.",

  // Aulas e oficinas (`#agenda`) — estado sem Agenda (D-16): três cartões de texto, sem
  // calendário nem dado inventado.
  agendaTitulo: "Agenda do ateliê",
  agendaLead:
    "Turmas fixas para quem quer aprender de verdade, e oficinas de uma tarde para quem quer " +
    "só experimentar. Material sempre incluso. Para reservar, é pelo WhatsApp.",
  agTurmas:
    "Aula toda semana, no mesmo dia e horário, com a Andressa. Torno e modelagem manual, do " +
    "zero ao esmalte. Mensalidade com material incluso.",
  agOficinas:
    "Uma data, um tema, poucas vagas: pintura em biscoito, xícaras, enfeites de fim de ano. " +
    "Para quem quer só experimentar.",
  // D-18 (extensão sinalizada acima): preço original era "R$ 35 por hora, ferramentas e queima
  // inclusas." — mesmo tratamento das três chaves nomeadas pela decisão.
  agLivre: "Já sabe modelar? Venha no seu ritmo: ferramentas e queima inclusas. Consulte o valor pelo WhatsApp.",
  agAviso: "O calendário com as datas e vagas entra aqui em breve.",

  // Encomendas (`#encomendas`).
  encomendasTitulo: "Peças feitas para você",
  encomendasLead:
    "Canecas para o seu café, um jogo de pratos para a pousada, lembranças para o casamento, " +
    "uma peça só. Contamos a gente como funciona e mandamos um orçamento.",
  passo1: {
    titulo: "Conta a ideia",
    corpo: "Quantas peças, para quê, cor, tamanho. Foto de referência ajuda muito.",
  },
  passo2: {
    titulo: "A gente manda o orçamento",
    corpo: "Preço, prazo e como fica. Você aprova quando quiser.",
  },
  passo3: {
    titulo: "Sinal, produção e entrega",
    corpo: "Metade no início; o resto na retirada. Cerâmica leva tempo: conte com 4 a 8 semanas.",
  },

  // Onde fica (`#onde`) — endereço e telefone sobem com colchete até o dono mandar o valor
  // real (D-14, "sobe com colchetes").
  ondeTitulo: "No centro de Pirenópolis",
  contato: {
    endereco: "Rua [nome da rua], nº [00] — Centro Histórico, Pirenópolis, GO",
    horario: "Quarta a domingo, 9h às 18h. Segunda e terça fechado.",
    whatsappRotulo: "(62) 9 0000-0000",
    instagramUsuario: "@amassacerrado",
    instagramUrl: "https://instagram.com/amassacerrado",
  },

  // Rodapé.
  rodape: {
    linha: "AMASSA CERRADO · Pirenópolis, GO",
    quemSomos: "Quem somos: Theo e Andressa. [texto curto sobre vocês entra aqui]",
  },

  // D-17: o número de WhatsApp mora aqui, num lugar só — só dígitos, com 55 e DDD. É o número
  // real do ateliê, dado pelo dono na Parte 0 da Fase 5 (02/10/2026). Até então era o placeholder
  // do protótipo, 5562900000000. Todo link do site (o botão geral e cada "Reservar pelo WhatsApp")
  // sai daqui; os testes leem esta constante, nunca um número escrito à mão.
  zap: "5562994817661",
} as const;

export type ConteudoDoSite = typeof CONTEUDO_SITE;

// D-17: as quatro mensagens de WhatsApp por contexto, verbatim do protótipo. Cada botão do
// site recebe uma destas chaves — nunca uma string solta montada no componente.
export const MENSAGENS_DO_WHATSAPP = {
  orcamento: "Oi! Quero pedir um orçamento de peças.",
  site: "Oi! Vim pelo site do ateliê.",
  aulas: "Oi! Quero saber das próximas aulas e oficinas.",
  usoLivre: "Oi! Quero saber a disponibilidade do uso livre.",
} as const;

export type ChaveDeMensagemDoWhatsapp = keyof typeof MENSAGENS_DO_WHATSAPP;

// Fase 5, plano 15 (AGE-18, D-10): a mensagem de "Reservar pelo WhatsApp" de cada cartão de evento,
// herdada do protótipo do site — "Oi! Quero reservar: {nome} ({toda {dia} | {dd/mm}})." O modelo
// mora aqui, ao lado das outras mensagens; nenhum componente monta essa frase.
export function mensagemDeReserva(nome: string, quando: string): string {
  return `Oi! Quero reservar: ${nome} (${quando}).`;
}

// D-20: slot sem foto (`arquivo: null`) não renderiza — nenhum retângulo, nenhuma moldura,
// nenhuma legenda "foto ainda não recebida". `fachada` e `mapa` sobem vazios de propósito
// neste plano; o plano 04 é quem exercita o estado vazio de verdade.
export const SLOTS_DE_IMAGEM = {
  abertura: {
    arquivo: "abertura.jpg",
    alt: "Peças de cerâmica em exposição no ateliê AMASSA CERRADO.",
  },
  cafe: {
    arquivo: "cafe.jpg",
    alt: "Mesa do café do ateliê, com xícaras de cerâmica feitas à mão.",
  },
  usoLivre: {
    arquivo: "uso-livre.jpg",
    alt: "Bancada do ateliê preparada para o uso livre.",
  },
  loja: {
    arquivo: "loja.jpg",
    alt: "Peças de cerâmica prontas na loja do ateliê.",
  },
  encomendas: {
    arquivo: "encomendas.jpg",
    alt: "Peças de cerâmica feitas por encomenda.",
  },
  fachada: {
    arquivo: null,
    alt: "Fachada do ateliê AMASSA CERRADO.",
  },
  mapa: {
    arquivo: null,
    alt: "Mapa de localização do ateliê.",
  },
} as const;

export type SlotDeImagem = keyof typeof SLOTS_DE_IMAGEM;
