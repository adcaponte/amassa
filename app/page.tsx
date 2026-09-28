import type { Metadata } from "next";

import { Abertura } from "@/components/site/abertura";
import { BarraInferiorFixa } from "@/components/site/barra-inferior-fixa";
import { BarraSuperior } from "@/components/site/barra-superior";
import { Encomendas } from "@/components/site/encomendas";
import { FaixaDaFachada } from "@/components/site/faixa-da-fachada";
import { FaixaEmConstrucao } from "@/components/site/faixa-em-construcao";
import { OEspaco } from "@/components/site/o-espaco";
import { OndeFica } from "@/components/site/onde-fica";
import { Rodape } from "@/components/site/rodape";
import { SLOTS_DE_IMAGEM } from "@/conteudo/site";

// D-15/T-04.6-14: renderização estática, EXPLÍCITA — é isto que faz a raiz sobreviver ao
// Postgres cair (prova de fora: scripts/testar-site-sem-banco.mjs, plano 03, Tarefa 3). Sem
// nada dinâmico (sem cookies(), sem headers(), sem leitura de banco), o HTML sai inteiro da
// build; pedir "/" duas vezes devolve exatamente o mesmo HTML, sem recalcular nada.
export const dynamic = "force-static";

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

// A página inteira do site público (D-03/D-15): NENHUM import daqui alcança sessão ou banco —
// tests/unit/site-isolamento.test.ts prova isso percorrendo o grafo de import a partir daqui.
// A seção "agenda" (Aulas e oficinas) AINDA NÃO EXISTE nesta tarefa — a Tarefa 2 deste mesmo
// plano a encaixa entre OEspaco e Encomendas; até lá, o botão fixo "Agenda" aponta para uma
// âncora sem destino, o que é esperado e não é exercitado pelo e2e desta tarefa.
export default function PaginaDoSite() {
  return (
    <div className="min-h-screen bg-site-fundo pt-[var(--altura-barra-site)] pb-[84px] text-site-tinta md:pb-0">
      <FaixaEmConstrucao />
      <BarraSuperior />
      <Abertura />
      <OEspaco />
      <Encomendas />
      <FaixaDaFachada />
      <OndeFica />
      <Rodape />
      <BarraInferiorFixa />
    </div>
  );
}
