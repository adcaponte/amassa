import type { Metadata } from "next";
import Link from "next/link";

import { MARCA } from "@/conteudo/marca";
import { CONTEUDO_SITE, SLOTS_DE_IMAGEM } from "@/conteudo/site";
import { PularParaOConteudo } from "@/components/site/pular-para-o-conteudo";
import { Rodape } from "@/components/site/rodape";
import { dominioDoSite, urlDoSite } from "@/lib/site/url";
import { rotuloTelefoneDoZap } from "@/lib/site/whatsapp";

// Política de privacidade do site público (04/10/2026). Nasceu de uma exigência do Google: para
// publicar o app OAuth `amassa-backup` (o `client_id` próprio do `rclone`, que leva as cópias de
// segurança ao Google Drive), a tela de consentimento pede o URL de uma política de privacidade no
// domínio autorizado. Estática como a raiz (D-15): sem banco, sem sessão — nada daqui importa de
// `lib/` com acesso a dados. O texto descreve o que o sistema faz HOJE; se isso mudar (formulário no
// site, analytics, outro destino de backup), esta página muda junto.
export const dynamic = "force-static";

// Quick 261030-n01 (30/10/2026): o nome sai de `MARCA`, a origem e o domínio citado de `urlDoSite()`
// (o domínio em que o site de fato responde; até a virada, o de hoje). O texto ancora o artigo em
// "ateliê" — "o ateliê {nome}", "a equipe do ateliê" — porque o gênero do nome novo não foi definido.
const TITULO = `Privacidade — ${MARCA.nome}`;
const DESCRICAO = `Como o ateliê ${MARCA.nome} trata os dados de quem visita o site e de quem é atendido por ele.`;

// D-29 (Fase 06.5, 06/10/2026): canonical e `og:url` próprios desta página. O Open Graph de uma
// página não herda o da raiz (são irmãs, não layout e filha), então o título, a descrição e a
// imagem de compartilhamento — o mesmo recorte 1200×630 da foto de abertura — estão escritos aqui.
export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  metadataBase: new URL(urlDoSite()),
  alternates: { canonical: "/privacidade" },
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: "/privacidade",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/site/abertura-og.jpg",
        width: 1200,
        height: 630,
        alt: SLOTS_DE_IMAGEM.abertura.alt,
      },
    ],
  },
};

// Até 30/10/2026: "4 de outubro de 2026". Mudou porque o texto mudou (nome e e-mail de contato).
const ATUALIZADA_EM = "30 de outubro de 2026";

export default function PaginaDePrivacidade() {
  // D-28 (06/10/2026): o telefone sai do `zap`, o mesmo do "Onde fica" — vazio se o `zap` estiver
  // fora do formato, e então a frase termina no e-mail (quick 261030-n01; até 30/10, no Instagram).
  const telefone = rotuloTelefoneDoZap(CONTEUDO_SITE.zap);

  return (
    <div className="min-h-screen bg-site-fundo text-site-tinta">
      {/* D-29 (Fase 06.5): o mesmo "Pular para o conteúdo" da raiz, primeiro elemento focável. */}
      <PularParaOConteudo />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[68ch] px-4 py-14 outline-none md:py-20">
        <Link href="/" className="text-sm text-site-tinta-fraca underline">
          ← {MARCA.nome}
        </Link>
        <p className="mt-8 mb-3 text-xs font-semibold tracking-[0.14em] text-site-barro uppercase">
          Atualizada em {ATUALIZADA_EM}
        </p>
        <h1 className="font-titulo-site text-[28px] font-semibold md:text-[40px]">Privacidade</h1>

        <div className="mt-6 flex flex-col gap-6 text-lg text-site-tinta-media">
          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Este site</h2>
            <p>
              O site {dominioDoSite()} não tem formulário, não pede cadastro e não usa cookies de rastreamento
              nem ferramentas de análise de visitas. Os botões de WhatsApp e Instagram levam a esses serviços, que
              seguem as políticas de privacidade deles.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Quando você é atendido pelo ateliê</h2>
            <p>
              Para combinar uma encomenda, uma aula ou o uso do espaço, guardamos o que você nos passa: nome, telefone,
              o que foi combinado e os pagamentos. Esses dados ficam num sistema interno do ateliê, em servidor
              contratado por nós, e só a equipe do ateliê tem acesso. Não vendemos nem compartilhamos seus dados
              com ninguém.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Cópias de segurança</h2>
            <p>
              Uma vez por dia, o sistema faz uma cópia de segurança e a guarda numa conta do Google Drive do próprio
              ateliê. O aplicativo “amassa-backup” existe só para isso: ele acessa apenas essa conta, para
              gravar e, se preciso, recuperar as cópias. Não acessa dados de nenhuma outra pessoa.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-titulo-site text-xl font-semibold text-site-tinta">Seus direitos</h2>
            <p>
              Pela Lei Geral de Proteção de Dados (LGPD), você pode pedir para ver, corrigir ou apagar os dados que
              temos sobre você. Fale com a gente pelo Instagram{" "}
              <a href={MARCA.instagramUrl} target="_blank" rel="noopener" className="text-site-tinta underline">
                {MARCA.instagramUsuario}
              </a>
              {telefone ? ", pelo e-mail " : " ou pelo e-mail "}
              <a href={`mailto:${MARCA.email}`} className="text-site-tinta underline">
                {MARCA.email}
              </a>
              {telefone ? ` ou pelo WhatsApp ${telefone}` : null}.
            </p>
          </section>
        </div>
      </main>
      <Rodape />
    </div>
  );
}
