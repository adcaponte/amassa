"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

import type { EventoCarregado, EventoDaSemana } from "@/lib/agenda/consultas";
import { dataAindaNaoChegou } from "@/lib/agenda/presenca";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  caixaDataDeTurmaEmDiaFechado,
  DICA_FIM_OFICINA,
  DICA_FIM_TURMA,
  fraseDataAindaNaoChegou,
  FRASE_NINGUEM_INSCRITO,
  ROTULO_ABRIR_A_TURMA,
  FRASE_ERRO_CARREGAR_AULA,
  ROTULO_AULA_AVULSA,
  ROTULO_CANCELADA,
  ROTULO_FECHAR,
  ROTULO_PRONTO,
  ROTULO_TENTAR_DE_NOVO,
  ROTULO_TURMA_FIXA,
  TAG_MARCAR_PRESENCA,
  tituloQuemVem,
} from "@/lib/agenda/textos";
import { PRECO_GRATUITO } from "@/lib/agenda/publico/agenda";
import { diaDaSemanaDe, NOMES_CURTOS_DOS_DIAS } from "@/lib/agenda/turma";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { ColocarAlguem } from "./colocar-alguem";
import { CancelarEstaData } from "./confirmar-cancelar-data";
import { LinhaInscrito } from "./linha-inscrito";
import { naoFecharComOSeletorAberto } from "./seletor-pessoa";

const PONTO_DO_TIPO = {
  turma: "bg-area-espaco",
  avulsa: "bg-ouro outline outline-1 outline-tinta-fraca",
  fechado: "bg-area-geral",
} as const;

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;

// "{Turma fixa | Aula ou oficina avulsa} · {dia da semana}, {dd/mm} · {hh:mm} às {hh:mm}" +
// " · cancelada" + avulsa: " · {R$} por pessoa" (05-UI-SPEC.md §"Folha do evento — linhas de leitura").
function subTitulo(evento: EventoDaSemana, precoCentavos: number | null): string {
  const partes = [
    evento.tipo === "turma" ? ROTULO_TURMA_FIXA : ROTULO_AULA_AVULSA,
    `${diaDaSemanaPorExtenso(evento.data)}, ${formatarDiaMes(evento.data)}`,
  ];
  if (evento.inicio !== null && evento.fim !== null) {
    partes.push(`${evento.inicio} às ${evento.fim}`);
  }
  if (evento.cancelado) {
    partes.push(ROTULO_CANCELADA);
  }
  if (evento.tipo === "avulsa" && precoCentavos !== null) {
    // IN-04 da revisão B: preço zero é a oficina gratuita.
    partes.push(
      precoCentavos === 0 ? PRECO_GRATUITO : `${formatarReais(precoCentavos)} por pessoa`,
    );
  }
  return partes.join(" · ");
}

// "qui, 07/10" — o dia curto do aviso de presença antes do dia (D-05), com os formatadores que a Agenda
// já tem (o dia abreviado da lista de Pessoas e o dd/mm do sub-título).
function diaCurto(data: string): string {
  return `${NOMES_CURTOS_DOS_DIAS[diaDaSemanaDe(data)]}, ${formatarDiaMes(data)}`;
}

export type FolhaEventoProps = {
  // O que o cartão já sabia no toque — o cabeçalho real aparece antes de o servidor responder.
  cabecalho: EventoDaSemana;
  // A lista, quando o servidor já respondeu; `null` enquanto carrega.
  carregado: EventoCarregado | null;
  // O "hoje" de Brasília, decidido no servidor (a semana já o recebe) — D-05: a data depois de hoje avisa
  // antes do "Veio · Faltou".
  hoje: string;
  // A leitura falhou (WR-04 da revisão B): no lugar do esqueleto, a frase e "Tentar de novo".
  erroAoCarregar?: boolean;
  aoFechar: () => void;
  // "Abrir a turma" (D-03): a folha da turma abre NO LUGAR desta, com "Voltar à data" (UI-D25).
  aoAbrirTurma: (turmaId: string, nome: string) => void;
};

// A folha do evento (turma ou avulsa), aberta por `?evento={id}` (UI-D8): diálogo de tela toda no
// celular, centrado `max-w-lg` a partir de `md` (o mesmo contêiner das folhas do Estoque), fechar
// 44×44 e rodapé preso por flex com "Pronto". Da folha aberta à presença marcada é UM toque por
// pessoa — nenhuma confirmação, campo ou teclado no caminho (Valor central).
export function FolhaEvento({
  cabecalho,
  carregado,
  hoje,
  erroAoCarregar = false,
  aoFechar,
  aoAbrirTurma,
}: FolhaEventoProps) {
  const router = useRouter();
  const evento = carregado ?? cabecalho;
  // D-13: data de turma (não cancelada) num dia fechado — o "Cancelar esta data" sobe para a caixa
  // do topo, visível sem rolar, e o rodapé fica só com "Pronto" (o botão existe uma vez só).
  const cancelarNaCaixa =
    carregado !== null &&
    carregado.tipo === "turma" &&
    !carregado.cancelado &&
    carregado.diaFechadoMotivo !== null;

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-evento"
        data-evento-id={evento.id}
        onOpenAutoFocus={(eventoDeFoco) => eventoDeFoco.preventDefault()}
        // Esc com a lista do seletor de pessoa aberta fecha só a lista, não a folha.
        onEscapeKeyDown={naoFecharComOSeletorAberto}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta flex items-center gap-2 break-words">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block size-2 shrink-0 rounded-full",
                  PONTO_DO_TIPO[evento.tipo],
                )}
              />
              {evento.titulo}
            </DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca break-words">
              {subTitulo(evento, carregado?.precoCentavos ?? null)}
              {evento.marcarPresenca ? (
                <>
                  {" "}
                  <span
                    data-testid="tag-marcar-presenca"
                    className="bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold whitespace-nowrap"
                  >
                    {TAG_MARCAR_PRESENCA}
                  </span>
                </>
              ) : null}
            </DialogDescription>
            {evento.tipo === "turma" && evento.turmaId !== null ? (
              <button
                type="button"
                data-testid="abrir-turma"
                onClick={() => aoAbrirTurma(evento.turmaId ?? "", evento.titulo)}
                className="text-apoio text-tinta-media inline-flex min-h-[44px] items-center self-start rounded-md font-semibold underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              >
                {ROTULO_ABRIR_A_TURMA}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-evento-fechar"
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {carregado === null && erroAoCarregar ? (
            <div
              className="flex flex-col items-start gap-3"
              data-testid="folha-evento-erro"
            >
              <p role="alert" className="text-corpo text-erro">
                {FRASE_ERRO_CARREGAR_AULA}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.refresh()}
                className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
              >
                {ROTULO_TENTAR_DE_NOVO}
              </Button>
            </div>
          ) : carregado === null ? (
            <div
              aria-busy="true"
              className="flex flex-col gap-3"
              data-testid="folha-evento-carregando"
            >
              <Skeleton className="h-4 w-40" />
              {LINHAS_DO_ESQUELETO.map((linha) => (
                <Skeleton key={linha} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <>
              {cancelarNaCaixa ? (
                <div
                  data-testid="caixa-dia-fechado"
                  role="status"
                  className="bg-atencao-fundo text-atencao flex flex-col gap-3 rounded-md p-4"
                >
                  <p className="text-apoio flex items-start gap-2 font-semibold [overflow-wrap:anywhere]">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    {caixaDataDeTurmaEmDiaFechado(carregado.diaFechadoMotivo ?? "")}
                  </p>
                  <CancelarEstaData key={carregado.id} evento={carregado} />
                </div>
              ) : null}
              {/* "{n} de {vagas}": n conta TODAS as inscrições da data (alunos, reposições,
                  experimentais, oficina — AGE-11); passar das vagas só avisa (UI-D16). */}
              <h3
                data-testid="quem-vem"
                className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
              >
                {tituloQuemVem(carregado.inscricoes.length, carregado.vagas ?? 0)}
              </h3>
              {carregado.inscricoes.length === 0 ? (
                <p
                  data-testid="folha-evento-vazia"
                  className="text-corpo text-tinta-fraca"
                >
                  {FRASE_NINGUEM_INSCRITO}
                </p>
              ) : (
                <>
                  {/* D-05 / UI-D13: data DEPOIS de hoje — avisa e deixa. Uma vez por data, acima do
                      "Veio · Faltou" de todos; o segmentado continua habilitado e nenhum toast novo. */}
                  {!carregado.cancelado && dataAindaNaoChegou(carregado.data, hoje) ? (
                    <div
                      data-testid="presenca-aviso-futuro"
                      role="status"
                      className="bg-atencao-fundo text-atencao text-apoio flex items-start gap-2 rounded-md p-4"
                    >
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>{fraseDataAindaNaoChegou(diaCurto(carregado.data))}</span>
                    </div>
                  ) : null}
                  <ul className="flex flex-col" data-testid="folha-evento-lista">
                    {carregado.inscricoes.map((inscrito) => (
                      <LinhaInscrito
                        key={inscrito.id}
                        inscrito={inscrito}
                        tipoDoEvento={carregado.tipo}
                        somenteLeitura={carregado.cancelado}
                      />
                    ))}
                  </ul>
                </>
              )}
              {/* "Colocar alguém" só em data não cancelada (UI E7·empty): na oficina (inscrição ou
                  reposição) e na data de turma (reposição ou experimental — plano 08). */}
              {!carregado.cancelado &&
              (carregado.tipo === "avulsa" || carregado.tipo === "turma") ? (
                <ColocarAlguem key={carregado.id} evento={carregado} />
              ) : null}
              <p className="text-apoio text-tinta-fraca">
                {carregado.tipo === "turma" ? DICA_FIM_TURMA : DICA_FIM_OFICINA}
              </p>
            </>
          )}
        </div>

        {/* Rodapé preso (`justify-between`): "Cancelar esta data" / "Desfazer cancelamento" à esquerda
            (só depois de a folha saber o que se perderia), "Pronto" à direita. `flex-wrap`: a 320px
            os dois quebram em duas linhas, cada um com 44px, nunca rolagem lateral. */}
        <div className="border-border bg-popover flex flex-wrap items-start justify-between gap-2 border-t px-6 py-4">
          {carregado !== null && !cancelarNaCaixa ? (
            <CancelarEstaData key={carregado.id} evento={carregado} />
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="default"
            data-testid="folha-evento-pronto"
            onClick={aoFechar}
            className="text-corpo min-h-[52px] px-6 font-semibold"
          >
            {ROTULO_PRONTO}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
