// A MARCA do negócio, num arquivo só (quick 261030-n01, 30/10/2026; briefing da troca de nome
// §2.1). Nome, nome curto, descrição, cidade, domínio, Instagram, e-mail e WhatsApp moram AQUI e
// em nenhum outro lugar: o site, a gestão, a folha da Produção e o PDF do orçamento leem deste
// objeto, e trocar um contato é editar uma linha. `tests/unit/marca-fonte-unica.test.ts` prova
// que o nome por extenso e o usuário do Instagram não estão escritos à mão em outro arquivo.
//
// "amassa" continua o CODINOME TÉCNICO do sistema — pastas (`components/amassa/`), banco,
// contêineres, imagens, variáveis de ambiente e o app OAuth de backup. Isso é identificador, não
// nome, e não se troca aqui (briefing §1).
//
// `url`/`dominio` são o domínio NOVO. A URL EFETIVA do site não é esta: é `urlDoSite()`
// (lib/site/url.ts), que prefere `NEXT_PUBLIC_SITE_URL` e só cai em `MARCA.url` quando a variável
// está vazia — é isso que mantém o site publicado no domínio de hoje até a virada (Passo 2).
//
// Dado puro: zero import, nenhum `let`/`var` — o mesmo padrão de `conteudo/site.ts`.

export const MARCA = {
  // Como aparece em títulos, rodapé, folha da Produção e textos alternativos.
  nome: "AMULETO ARTE E CAFÉ",
  // Logo em texto, cabeçalho da gestão, PDF do orçamento.
  nomeCurto: "AMULETO",
  descricao: "Ateliê de cerâmica, café e loja em Pirenópolis.",
  cidade: "Pirenópolis, GO",
  dominio: "amuleto.art.br",
  url: "https://amuleto.art.br",
  instagramUsuario: "@amuletoartecafe",
  instagramUrl: "https://www.instagram.com/amuletoartecafe/",
  email: "amuletoartecafe@gmail.com",
  // 55 + DDD + celular, sem espaço nem sinal: é o formato de `wa.me/`. O telefone exibido no site
  // é derivado deste número (`rotuloTelefoneDoZap`, lib/site/whatsapp.ts).
  whatsapp: "5562994817661",
} as const;

export type Marca = typeof MARCA;
