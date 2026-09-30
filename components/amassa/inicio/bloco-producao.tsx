import Link from "next/link";

import { listarOrdensEmAndamento, type OrdemEmAndamento } from "@/lib/producao/consultas";
import { rotuloDaEtapa } from "@/lib/producao/etapas";
import { linhasParaOInicio, type LinhasDoInicio } from "@/lib/producao/quadro";
import { CHIP_DA_CASA } from "@/lib/producao/textos";
import {
  TEXTOS_DOS_BLOCOS,
  textoAguardandoOSinal,
  textoEMaisOrdens,
} from "@/lib/inicio/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { ChipDoSelo } from "@/components/amassa/producao/cartao-ordem";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { TentarDeNovo } from "./tentar-de-novo";

export type BlocoProducaoProps = {
  hoje: string;
};

// "{nome} · {cliente}" na encomenda; "{nome} · da casa" na produção da casa; só o nome na encomenda
// sem cliente (pedido de boca).
function tituloDaOrdem(ordem: OrdemEmAndamento): string {
  if (ordem.tipo === "casa") {
    return `${ordem.nome} · ${CHIP_DA_CASA}`;
  }
  return ordem.clienteNome ? `${ordem.nome} · ${ordem.clienteNome}` : ordem.nome;
}

const CLASSE_DO_LINK =
  "text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none";

// O bloco "Produção" do Início (Fase 06.1, D-16) — Server Component `async` com `try`/`catch`
// PRÓPRIO (D-09 da 04.6): a falha da Produção vira `EstadoErro` + "Tentar de novo" DENTRO do bloco;
// o esqueleto já está no `Suspense` da página. Lê o modelo novo: as ordens liberadas, até 5, pela
// urgência do selo (`linhasParaOInicio`, módulo puro — nenhuma regra nasce aqui), cada uma um link
// para a ordem com a etapa e o selo; e quantas esperam o sinal, numa linha final.
export async function BlocoProducao({ hoje }: BlocoProducaoProps) {
  let resultado: LinhasDoInicio<OrdemEmAndamento> | null = null;

  try {
    resultado = linhasParaOInicio(await listarOrdensEmAndamento(), hoje);
  } catch (erro) {
    // `resultado` continua `null`: o bloco mostra o erro próprio.
    console.error("Falha ao carregar a produção no Início:", erro);
  }

  const linhaAguardando =
    resultado !== null && resultado.aguardando > 0 ? (
      <Link
        href={`${rotaDeGestao("/producao")}#aguardando-o-sinal`}
        data-testid="inicio-producao-aguardando"
        className="text-apoio text-tinta-media bg-superficie-2 focus-visible:ring-ring flex min-h-[44px] items-center rounded-md px-4 py-2 font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        {textoAguardandoOSinal(resultado.aguardando)}
      </Link>
    ) : null;

  return (
    <BlocoDoInicio
      titulo="Produção"
      acaoRotulo="abrir produção"
      acaoHref={rotaDeGestao("/producao")}
      dataTestId="inicio-bloco-producao"
    >
      {resultado === null ? (
        <EstadoErro
          titulo="Algo não funcionou."
          corpo={TEXTOS_DOS_BLOCOS.producao.erro}
          acao={<TentarDeNovo />}
        />
      ) : resultado.linhas.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.producao.vazio}</p>
            <p className="text-apoio text-muted-foreground">
              {resultado.aguardando > 0
                ? TEXTOS_DOS_BLOCOS.producao.vazioComAguardando
                : TEXTOS_DOS_BLOCOS.producao.vazioSemAguardando}
            </p>
          </div>
          {linhaAguardando}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {resultado.linhas.map(({ ordem, etapa, selo }) => (
            <Link
              key={ordem.id}
              href={rotaDeGestao(`/producao/${ordem.id}`)}
              data-testid="inicio-producao-linha"
              data-ordem-id={ordem.id}
              className="focus-visible:ring-ring flex min-h-[44px] flex-col gap-1 rounded-md border-b border-border pb-3 last:border-0 last:pb-0 focus-visible:ring-2 focus-visible:outline-none md:hover:bg-superficie-2"
            >
              <span className="text-corpo text-foreground line-clamp-1 font-semibold">
                {tituloDaOrdem(ordem)}
              </span>
              <span className="text-apoio flex flex-wrap items-center gap-2">
                <span
                  data-testid="inicio-producao-etapa"
                  data-etapa={etapa}
                  className="rounded px-1.5 py-0.5 font-semibold"
                  style={{
                    backgroundColor: `var(--color-${etapa})`,
                    // "secagem" (#C9B896) é claro demais para texto branco (1,94:1, abaixo do 4,5:1
                    // de AA) — a mesma regra do contador da folha geral (`folha-geral.tsx`); o par é
                    // medido em tests/unit/contraste.test.ts, que lê este arquivo.
                    color: etapa === "secagem" ? "#3A331F" : "#FFFFFF",
                  }}
                >
                  {rotuloDaEtapa(etapa, ordem.tipo)}
                </span>
                <ChipDoSelo selo={selo} />
              </span>
            </Link>
          ))}
          {resultado.maisN > 0 ? (
            <Link
              href={rotaDeGestao("/producao")}
              data-testid="inicio-producao-mais"
              className={`text-apoio ${CLASSE_DO_LINK}`}
            >
              {textoEMaisOrdens(resultado.maisN)}
            </Link>
          ) : null}
          {linhaAguardando}
        </div>
      )}
    </BlocoDoInicio>
  );
}
