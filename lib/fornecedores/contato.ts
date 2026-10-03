// Módulo puro de Fornecedores — os LINKS de contato da ficha (Fase 06.2, plano 03; FRN-05). Nenhum
// import: não alcança React, Next, drizzle-orm, pg nem `@/db`. É a única regra que transforma o que
// um gestor digitou num `href` — a ficha só chama.
//
// Os dois campos foram digitados à mão e viram link numa aba nova (fronteira banco → `href`,
// T-06.2-09 e T-06.2-11): o WhatsApp só com dígitos, o site só com esquema http(s). O que não passar
// continua na tela como texto — só não vira link.

// `https://wa.me/<dígitos>` (06.2-RESEARCH.md, Pitfall 9). Só os dígitos do texto contam:
//   - 10 ou 11 dígitos (DDD + número, fixo ou celular) → ganham o DDI 55 na frente;
//   - 12 ou 13 dígitos começando por 55 → já têm o DDI, ficam como estão;
//   - qualquer outra coisa (vazio, sem DDD, DDI de outro país, número a mais) → `null`: a ficha
//     mostra só "copiar", sem "abrir WhatsApp".
export function linkDoWhatsApp(texto: string | null | undefined): string | null {
  const digitos = (texto ?? "").replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) {
    return `https://wa.me/55${digitos}`;
  }
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return `https://wa.me/${digitos}`;
  }
  return null;
}

// Um esquema no começo do texto ("https:", "javascript:", "data:", "ftp:"…). "exemplo.com:8080" NÃO é
// esquema — é host com porta (o que vem depois dos dois-pontos são só dígitos).
const ESQUEMA = /^([a-z][a-z0-9+.-]*):(?!\d+(?:[/?#]|$))/i;

// O endereço do site, pronto para `href` (06.2-RESEARCH.md, Pitfall 10): apara; sem esquema, ganha
// `https://`; só vale `http:` ou `https:` com um host, conferido por `new URL`. `javascript:`,
// `data:`, `ftp:` e o que não for um endereço → `null`: a ficha mostra o texto sem botão.
export function urlDoSite(texto: string | null | undefined): string | null {
  const aparado = (texto ?? "").trim();
  if (aparado === "") {
    return null;
  }
  const comEsquema = ESQUEMA.test(aparado) ? aparado : `https://${aparado}`;
  let url: URL;
  try {
    url = new URL(comEsquema);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
    return null;
  }
  return url.href;
}
