import Link from "next/link";

import { agendaDeHoje, type AgendaDeHoje, type LinhaDeHoje } from "@/lib/agenda/consultas";
import { ocupacaoDoEspaco } from "@/lib/agenda/espaco";
import {
  ESTADO_DO_USO_NO_INICIO,
  inscritosDeHoje,
  ROTULO_AGORA_NO_ESPACO,
  ROTULO_CANCELADA,
  ROTULO_DIA_TODO,
  SUB_LINHA_DO_FECHADO_DE_HOJE,
  TAG_MARCAR_PRESENCA,
  textoEMaisDeHoje,
  tituloDoFechadoDeHoje,
  tituloDoUsoLivre,
} from "@/lib/agenda/textos";
import { TEXTOS_DOS_BLOCOS } from "@/lib/inicio/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { BORDA_DO_TIPO } from "@/components/amassa/agenda/cartao-evento";
import { BlocoDoInicio } from "./bloco-do-inicio";
import { TentarDeNovo } from "./tentar-de-novo";

export type BlocoAgendaDeHojeProps = {
  // O dia e o agora do ateliê (Brasília), decididos pela página no MESMO instante.
  hoje: string;
  agora: { data: string; minutos: number };
};

const CLASSE_DA_TAG = "rounded-sm px-2 font-semibold";

// A folha que a linha abre (UI-D19): `?evento=` (turma, avulsa, fechado) ou `?uso=` — do Início à lista
// de presença em 2 toques.
function hrefDaLinha(segunda: string, linha: LinhaDeHoje): string {
  const folha = linha.tipo === "uso_livre" ? `uso=${linha.id}` : `evento=${linha.id}`;
  return rotaDeGestao(`/agenda?semana=${segunda}&${folha}`);
}

function tituloDaLinha(linha: LinhaDeHoje): string {
  if (linha.tipo === "fechado") {
    return tituloDoFechadoDeHoje(linha.titulo);
  }
  return linha.tipo === "uso_livre" ? tituloDoUsoLivre(linha.titulo) : linha.titulo;
}

function SubLinha({ linha }: { linha: LinhaDeHoje }) {
  if (linha.tipo === "fechado") {
    return <span>{SUB_LINHA_DO_FECHADO_DE_HOJE}</span>;
  }
  if (linha.tipo === "uso_livre") {
    return <span>{`${ocupacaoDoEspaco(linha.pessoas)} · ${ESTADO_DO_USO_NO_INICIO[linha.estado]}`}</span>;
  }
  return (
    <>
      <span>{inscritosDeHoje(linha.inscritos, linha.vagas)}</span>
      {linha.cancelado ? (
        <span data-testid="inicio-agenda-cancelada" className={cn(CLASSE_DA_TAG, "bg-erro-fundo text-erro")}>
          {ROTULO_CANCELADA}
        </span>
      ) : null}
      {linha.marcarPresenca ? (
        <span data-testid="inicio-agenda-marcar-presenca" className={cn(CLASSE_DA_TAG, "bg-atencao-fundo text-atencao")}>
          {TAG_MARCAR_PRESENCA}
        </span>
      ) : null}
    </>
  );
}

// O bloco "Agenda de hoje" do Início (D-05 refinada pela D-18; GES-09; 05-UI-SPEC.md §"Bloco “Agenda de
// hoje” do Início") — Server Component `async` com `try`/`catch` PRÓPRIO, no molde de `bloco-producao.tsx`
// (D-09 da 04.6): a falha da Agenda vira `EstadoErro` + "Tentar de novo" DENTRO do bloco, e o resto do
// Início continua; o esqueleto já está no `Suspense` da página. Lê SÓ `agendaDeHoje` (que faz nascer a
// mensalidade do mês antes — D-02) — nenhuma regra nasce aqui.
//
// D-07 da 04.6: "Agora no espaço" é LINHA PERMANENTE — no protótipo a faixa some junto com os eventos do
// dia; aqui ela FICA, porque é a única informação que dá o número de relance, e um bloco que muda de forma
// conforme o dia é mais difícil de ler de relance.
//
// A linha mostra a CONTAGEM, não uma fração: o denominador ("de 10 lugares") saiu por decisão do dono em
// 29/09/2026, no portão da Fase 04.6 — o espaço não tem capacidade fixa, e o 10 vinha do protótipo, não
// de medição. O porquê está em `lib/agenda/espaco.ts`, que também tem a regra de quem conta (D-05, D-18).
//
// Até 6 linhas (UI-D19), fechado primeiro, cada uma um link que abre a folha do evento ou do uso livre na
// semana de hoje; com mais, "e mais {N}" leva à semana.
export async function BlocoAgendaDeHoje({ hoje, agora }: BlocoAgendaDeHojeProps) {
  let resultado: AgendaDeHoje | null = null;

  try {
    resultado = await agendaDeHoje(hoje, agora);
  } catch (erro) {
    // `resultado` continua `null`: o bloco mostra o erro próprio.
    console.error("Falha ao carregar a agenda de hoje no Início:", erro);
  }
  const segunda = resultado?.segunda ?? hoje;

  return (
    <BlocoDoInicio
      titulo="Agenda de hoje"
      acaoRotulo="abrir agenda"
      acaoHref={rotaDeGestao("/agenda")}
      dataTestId="inicio-bloco-agenda"
    >
      {resultado === null ? (
        <EstadoErro
          titulo="Algo não funcionou."
          corpo={TEXTOS_DOS_BLOCOS.agenda.erro}
          acao={<TentarDeNovo />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div
            data-testid="inicio-ocupacao"
            className="bg-acento-fundo flex items-center justify-between rounded-md px-3 py-2 text-apoio text-muted-foreground"
          >
            <span>{ROTULO_AGORA_NO_ESPACO}</span>
            <span className="font-semibold tabular-nums">{ocupacaoDoEspaco(resultado.agoraNoEspaco)}</span>
          </div>
          {resultado.linhas.length === 0 ? (
            <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.agenda.vazio}</p>
          ) : (
            <div className="flex flex-col">
              {resultado.linhas.map((linha) => {
                const cancelado = linha.tipo !== "fechado" && linha.tipo !== "uso_livre" && linha.cancelado;
                return (
                  <Link
                    key={`${linha.tipo}-${linha.id}`}
                    href={hrefDaLinha(segunda, linha)}
                    data-testid="inicio-agenda-linha"
                    data-tipo={linha.tipo}
                    data-id={linha.id}
                    className={cn(
                      "border-borda grid min-h-[44px] grid-cols-[64px_1fr] items-start gap-x-2 border-b border-l-4 py-2 pr-2 pl-4 last:border-b-0",
                      "focus-visible:ring-ring md:hover:bg-superficie-2 focus-visible:ring-2 focus-visible:outline-none",
                      BORDA_DO_TIPO[linha.tipo],
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="text-apoio text-tinta-media font-semibold tabular-nums">
                        {linha.inicio ?? ROTULO_DIA_TODO}
                      </span>
                      {linha.fim !== null ? (
                        <span className="text-apoio text-tinta-fraca tabular-nums">{linha.fim}</span>
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          "text-corpo line-clamp-1 font-semibold break-words",
                          cancelado ? "text-tinta-fraca line-through" : "text-tinta",
                        )}
                      >
                        {tituloDaLinha(linha)}
                      </span>
                      <span className="text-apoio text-tinta-fraca flex flex-wrap gap-x-2 gap-y-1">
                        <SubLinha linha={linha} />
                      </span>
                    </span>
                  </Link>
                );
              })}
              {resultado.restantes > 0 ? (
                <Link
                  href={`${rotaDeGestao(`/agenda?semana=${hoje}`)}#dia-${hoje}`}
                  data-testid="inicio-agenda-mais"
                  className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center self-start rounded-md font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {textoEMaisDeHoje(resultado.restantes)}
                </Link>
              ) : null}
            </div>
          )}
        </div>
      )}
    </BlocoDoInicio>
  );
}
