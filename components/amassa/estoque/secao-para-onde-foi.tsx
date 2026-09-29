import Link from "next/link";

import { diasDoPeriodo, type PeriodoDoParaOndeFoi } from "@/lib/estoque/abas";
import { saidasParaOndeFoi } from "@/lib/estoque/consultas";
import { DESTINOS_DE_SAIDA } from "@/lib/estoque/destinos";
import { agregarParaOndeFoi, inicioDoPeriodo, type ParaOndeFoi } from "@/lib/estoque/historico";
import {
  CORPO_DESTINO_VAZIO,
  FRASE_ERRO_CARREGAR_DESTINO,
  NOTA_DESTINO_RODAPE_ANTES,
  NOTA_DESTINO_RODAPE_DEPOIS,
  NOTA_DESTINO_RODAPE_DESTAQUE,
  NOTA_DESTINO_RODAPE_INSTANTE,
  NOTA_DESTINO_TOPO_ANTES,
  NOTA_DESTINO_TOPO_DEPOIS,
  NOTA_DESTINO_TOPO_DESTAQUE,
  ROTULO_FILTRAR_PERIODO,
  ROTULO_MATERIAL_CONSUMIDO,
  ROTULO_PERIODO_30,
  ROTULO_PERIODO_90,
  ROTULO_PERIODO_TUDO,
  ROTULO_VER_TUDO,
  TITULO_DESTINO_VAZIO,
  TITULO_ERRO,
  textoSaidasNoPeriodo,
} from "@/lib/estoque/textos";
import { formatarReais, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { PilulaDeFiltro } from "./aba-historico";
import { BarrasParaOndeFoi } from "./barras-para-onde-foi";

const PERIODOS: readonly { valor: PeriodoDoParaOndeFoi; rotulo: string }[] = [
  { valor: "30", rotulo: ROTULO_PERIODO_30 },
  { valor: "90", rotulo: ROTULO_PERIODO_90 },
  { valor: "tudo", rotulo: ROTULO_PERIODO_TUDO },
];

function rotaDoDestino(periodo: PeriodoDoParaOndeFoi): string {
  const sufixo = periodo === "30" ? "" : `&periodo=${periodo}`;
  return rotaDeGestao(`/estoque?aba=destino${sufixo}`);
}

// A seção da aba "Para onde foi" — Server Component `async`, dentro do próprio `Suspense` da página
// (esqueleto `EsqueletoParaOndeFoi`). Mesma disciplina de `secao-historico.tsx`: a leitura num
// `try`/`catch`, a falha no log do servidor e o `EstadoErro` com a frase própria da aba e "Tentar de
// novo"; a barra de abas e a barra fixa, fora daqui, continuam utilizáveis (UI · error · E4/E12).
//
// `saidasParaOndeFoi` lê as saídas do período (UMA consulta) e `agregarParaOndeFoi` faz a conta —
// a regra de que venda cancelada, estorno de compra e ajuste NÃO são consumo mora lá, testada
// (Pitfall 15, D-31). O início do período é a meia-noite, em Brasília, do primeiro dia civil
// (`inicioDoPeriodo` sobre `hojeEmBrasilia`), nunca o relógio do banco.
export async function SecaoParaOndeFoi({ periodo }: { periodo: PeriodoDoParaOndeFoi }) {
  const dias = diasDoPeriodo(periodo);
  const desde = dias === null ? null : inicioDoPeriodo(hojeEmBrasilia(new Date()), dias);

  let resultado: ParaOndeFoi;
  try {
    const saidas = await saidasParaOndeFoi({ desde });
    resultado = agregarParaOndeFoi(saidas, { destinos: DESTINOS_DE_SAIDA });
  } catch (erro) {
    console.error("Falha ao carregar o Para onde foi do Estoque:", erro);
    return (
      <EstadoErro
        titulo={TITULO_ERRO}
        corpo={FRASE_ERRO_CARREGAR_DESTINO}
        acao={<TentarDeNovo />}
        dataTestId="destino-erro"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-8 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label={ROTULO_FILTRAR_PERIODO} className="flex flex-wrap gap-2">
          {PERIODOS.map((opcao) => (
            <PilulaDeFiltro
              key={opcao.valor}
              href={rotaDoDestino(opcao.valor)}
              marcada={opcao.valor === periodo}
              testId={`destino-periodo-${opcao.valor}`}
              rotulo={opcao.rotulo}
            />
          ))}
        </nav>
        <span
          data-testid="destino-contador"
          className="text-apoio text-tinta-fraca tabular-nums min-[980px]:ml-auto"
        >
          {textoSaidasNoPeriodo(resultado.saidas)}
        </span>
      </div>

      <section
        aria-labelledby="destino-resumo-rotulo"
        className="bg-superficie border-borda flex flex-col gap-2 rounded-lg border p-4 min-[980px]:max-w-3xl"
      >
        <h2
          id="destino-resumo-rotulo"
          className="text-apoio text-tinta-fraca font-semibold tracking-[0.06em] uppercase"
        >
          {ROTULO_MATERIAL_CONSUMIDO}
        </h2>
        <p data-testid="destino-total" className="text-display text-tinta tabular-nums">
          {formatarReais(resultado.totalCentavos)}
        </p>
        <p className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-3">
          {NOTA_DESTINO_TOPO_ANTES}
          <strong className="font-semibold">{NOTA_DESTINO_TOPO_DESTAQUE}</strong>
          {NOTA_DESTINO_TOPO_DEPOIS}
        </p>
      </section>

      {resultado.saidas === 0 ? (
        <EstadoVazio
          titulo={TITULO_DESTINO_VAZIO}
          corpo={CORPO_DESTINO_VAZIO}
          testId="destino-vazio"
          botao={
            periodo === "tudo" ? undefined : (
              <Button asChild variant="outline" className="text-corpo min-h-[44px] px-4 font-semibold">
                <Link href={rotaDoDestino("tudo")} scroll={false}>
                  {ROTULO_VER_TUDO}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <BarrasParaOndeFoi barras={resultado.barras} />
      )}

      <p className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-4 min-[980px]:max-w-3xl">
        <strong className="font-semibold">{NOTA_DESTINO_RODAPE_DESTAQUE}</strong>
        {NOTA_DESTINO_RODAPE_ANTES}
        <strong className="font-semibold">{NOTA_DESTINO_RODAPE_INSTANTE}</strong>
        {NOTA_DESTINO_RODAPE_DEPOIS}
      </p>
    </div>
  );
}
