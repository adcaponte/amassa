import type { Metadata } from "next";

import { Abertura } from "@/components/site/abertura";
import { BarraInferiorFixa } from "@/components/site/barra-inferior-fixa";
import { BarraSuperior } from "@/components/site/barra-superior";
import { FaixaEmConstrucao } from "@/components/site/faixa-em-construcao";
import { Rodape } from "@/components/site/rodape";

// D-15/T-04.6-14: renderização estática, EXPLÍCITA — é isto que faz a raiz sobreviver ao
// Postgres cair (prova de fora: scripts/testar-site-sem-banco.mjs, Tarefa 3 deste plano). Sem
// nada dinâmico (sem cookies(), sem headers(), sem leitura de banco), o HTML sai inteiro da
// build; pedir "/" duas vezes devolve exatamente o mesmo HTML, sem recalcular nada.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "AMASSA CERRADO — ateliê de cerâmica, café e loja em Pirenópolis",
  description:
    "Ateliê de cerâmica artesanal de alta temperatura em Pirenópolis: aulas, uso livre do espaço, café e encomendas. Abrimos em dezembro de 2026.",
};

// A página inteira do site público (D-03/D-15): NENHUM import daqui alcança sessão ou banco —
// tests/unit/site-isolamento.test.ts prova isso percorrendo o grafo de import a partir daqui.
// As seções (âncoras de rolagem) "espaco", "agenda", "encomendas" e "onde" AINDA NÃO EXISTEM
// neste plano — só a faixa, a abertura, as duas barras fixas e o rodapé (o traçador da fase).
// Os botões fixos já apontam para as âncoras que o próximo plano cria; até lá, os dois links
// não rolam para lugar nenhum, o que é esperado e não é exercitado pelo e2e desta tarefa.
export default function PaginaDoSite() {
  return (
    <div className="min-h-screen bg-site-fundo pt-[var(--altura-barra-site)] pb-[84px] text-site-tinta md:pb-0">
      <FaixaEmConstrucao />
      <BarraSuperior />
      <Abertura />
      <Rodape />
      <BarraInferiorFixa />
    </div>
  );
}
