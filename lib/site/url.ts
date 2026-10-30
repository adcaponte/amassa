import { MARCA } from "@/conteudo/marca";

// A URL EFETIVA do site público (quick 261030-n01, 30/10/2026): a origem que vira `metadataBase`
// (canonical, og:url, og:image absolutos), as entradas do sitemap e o domínio citado na página de
// privacidade.
//
// A variável vence o padrão. `NEXT_PUBLIC_SITE_URL` chega ao `next build` como build-arg
// (`vars.NEXT_PUBLIC_SITE_URL` do GitHub → entrega.yml → docker/Dockerfile ARG/ENV) e, até a virada
// de domínio (Passo 2, depois do DNS), aponta para o domínio de hoje — então o site publicado segue
// se anunciando onde ele de fato responde. Sem variável, o padrão é `MARCA.url`, o domínio novo.
// `process.env.NEXT_PUBLIC_SITE_URL` está escrito literalmente no padrão do parâmetro para o Next
// embutir o valor no build.
//
// Valor malformado LANÇA em vez de cair no padrão: um canonical para o lugar errado publicado em
// silêncio é pior que um build que para dizendo o que corrigir. Só `http:`/`https:`, e só a origem
// (sem caminho nem barra final), para as rotas montadas com `${urlDoSite()}/...` saírem certas.
//
// Módulo puro, como `lib/site/whatsapp.ts`: nenhum React, nenhum banco, só a marca.

const ERRO_DE_FORMATO =
  "NEXT_PUBLIC_SITE_URL não é um endereço válido: use a origem completa, como https://exemplo.com.br.";

export function urlDoSite(valor: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const aparado = (valor ?? "").trim();
  if (aparado.length === 0) return MARCA.url;

  let endereco: URL;
  try {
    endereco = new URL(aparado);
  } catch {
    throw new Error(ERRO_DE_FORMATO);
  }

  if (endereco.protocol !== "http:" && endereco.protocol !== "https:") {
    throw new Error(ERRO_DE_FORMATO);
  }

  return endereco.origin;
}

export function dominioDoSite(valor: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return new URL(urlDoSite(valor)).host;
}
