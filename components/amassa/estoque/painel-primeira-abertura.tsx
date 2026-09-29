import Link from "next/link";

import { rotaDeGestao } from "@/lib/rotas/gestao";
import {
  CORPO_PRIMEIRA_ABERTURA,
  FRASE_FALTA_ALGUM_MATERIAL,
  ROTULO_COMECAR_CONTAGEM,
  TITULO_PRIMEIRA_ABERTURA,
} from "@/lib/estoque/textos";
import { Button } from "@/components/ui/button";

import { BotaoNovoMaterialNaLista } from "./barra-acao-fixa";

// O painel da primeira abertura (UI-D3, D-16, EST-17): há material e NENHUMA movimentação manual —
// a aba Saldos mostra só isto, no lugar da barra de ferramentas e da lista. Saldos e alertas, antes
// da contagem, seriam artefato de venda sem contagem. "Começar a contagem" é o ÚNICO terracota da
// tela (a página, nesse estado, não desenha banner, barra fixa nem ações do cabeçalho); "+ Novo
// material" fica só aqui, `outline`, depois de "Falta algum material?". Padding vertical 48px.
export function PainelPrimeiraAbertura() {
  return (
    <section
      data-testid="estoque-primeira-abertura"
      aria-labelledby="titulo-primeira-abertura"
      className="flex flex-col items-center gap-4 px-6 py-12 text-center md:px-8"
    >
      <h2 id="titulo-primeira-abertura" className="text-titulo text-foreground max-w-xl">
        {TITULO_PRIMEIRA_ABERTURA}
      </h2>
      <p className="text-corpo text-muted-foreground max-w-xl">{CORPO_PRIMEIRA_ABERTURA}</p>
      <Button asChild className="text-corpo min-h-[44px] px-4 font-semibold">
        <Link href={rotaDeGestao("/estoque/contagem")} data-testid="estoque-comecar-contagem">
          {ROTULO_COMECAR_CONTAGEM}
        </Link>
      </Button>
      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-apoio text-muted-foreground">{FRASE_FALTA_ALGUM_MATERIAL}</p>
        <BotaoNovoMaterialNaLista testId="estoque-primeira-abertura-novo-material" />
      </div>
    </section>
  );
}
