import type { Metadata } from "next";

import { Abertura } from "@/components/site/abertura";
import { AgendaPublica } from "@/components/site/agenda-publica";
import { BarraInferiorFixa } from "@/components/site/barra-inferior-fixa";
import { BarraSuperior } from "@/components/site/barra-superior";
import { Encomendas } from "@/components/site/encomendas";
import { FaixaDaFachada } from "@/components/site/faixa-da-fachada";
import { FaixaEmConstrucao } from "@/components/site/faixa-em-construcao";
import { OEspaco } from "@/components/site/o-espaco";
import { OndeFica } from "@/components/site/onde-fica";
import { PularParaOConteudo } from "@/components/site/pular-para-o-conteudo";
import { Rodape } from "@/components/site/rodape";
import { SLOTS_DE_IMAGEM } from "@/conteudo/site";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";

// D-15/T-04.6-14: renderização estática, EXPLÍCITA — é isto que faz a raiz sobreviver ao
// Postgres cair (prova de fora: scripts/testar-site-sem-banco.mjs). Sem cookies(), sem headers(),
// sem sessão: o HTML sai pronto do cache, e pedir "/" duas vezes devolve o mesmo HTML.
//
// Fase 5, plano 15 (AGE-18, SIT-02): a seção `#agenda` lê a agenda pública — por ISR, nunca a cada
// visita: o `revalidate` abaixo (5 min) regenera no máximo a cada 5 minutos, e as ações da Agenda que mudam o que
// é público revalidam "/" na hora (`revalidarTelasDaAgenda`, lib/agenda/acoes.ts). Sem banco, a
// seção cai no estado da 04.6 (`AgendaPublica`, try/catch) e a raiz continua 200.
export const dynamic = "force-static";
export const revalidate = 300;

const TITULO_DO_SITE = "AMASSA CERRADO — ateliê de cerâmica, café e loja em Pirenópolis";
const DESCRICAO_DO_SITE =
  "Ateliê de cerâmica artesanal de alta temperatura em Pirenópolis: aulas, uso livre do espaço, café e encomendas. Abrimos em dezembro de 2026.";

// SEO básico (SIT-08): a URL base abaixo resolve o Open Graph para caminho absoluto a partir de
// um relativo (`/site/abertura.jpg`); o critério do dono é aparecer no Google para "amassa
// cerrado pirenópolis" — `app/robots.ts` libera a raiz para isso, `app/sitemap.ts` (Tarefa 3)
// lista só ela. `width`/`height` são as dimensões REAIS do arquivo (conferidas com
// `sharp(...).metadata()`, não inventadas); o `alt` vem de `SLOTS_DE_IMAGEM.abertura.alt` — uma
// verdade, um lugar, nunca reescrita aqui.
export const metadata: Metadata = {
  title: TITULO_DO_SITE,
  description: DESCRICAO_DO_SITE,
  metadataBase: new URL("https://amassacerrado.com.br"),
  openGraph: {
    title: TITULO_DO_SITE,
    description: DESCRICAO_DO_SITE,
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/site/abertura.jpg",
        width: 666,
        height: 1000,
        alt: SLOTS_DE_IMAGEM.abertura.alt,
      },
    ],
  },
};

// A página inteira do site público (D-03/D-15): NENHUM import daqui alcança sessão, e o banco só
// é alcançado por UMA exceção nomeada — a leitura pública da Agenda (lib/agenda/publico/consultas.ts).
// tests/unit/site-isolamento.test.ts prova isso percorrendo o grafo de import a partir daqui, e
// confere que components/site/ só importa da Agenda pela pasta lib/agenda/publico/.
export default function PaginaDoSite() {
  return (
    <div className="min-h-screen bg-site-fundo pt-[var(--altura-barra-site)] pb-[84px] text-site-tinta md:pb-0">
      {/* D-29 (Fase 06.5): o "Pular para o conteúdo" é o primeiro elemento focável da página, e o
          `<main>` envolve só o conteúdo — da abertura até "Onde fica". A faixa "em construção", as
          duas barras fixas e o rodapé ficam fora: são a moldura que o link existe para pular. */}
      <PularParaOConteudo />
      <FaixaEmConstrucao />
      <BarraSuperior />
      <main id="conteudo" tabIndex={-1} className="scroll-mt-[var(--altura-barra-site)] outline-none">
        <Abertura />
        <OEspaco />
        <AgendaPublica hoje={hojeEmBrasilia(new Date())} />
        <Encomendas />
        <FaixaDaFachada />
        <OndeFica />
      </main>
      <Rodape />
      <BarraInferiorFixa />
    </div>
  );
}
