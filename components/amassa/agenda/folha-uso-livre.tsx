"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { corrigirChegada, marcarChegada } from "@/lib/agenda/acoes";
import type { UsoLivreCarregado, UsoLivreDaSemana } from "@/lib/agenda/consultas";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  DICA_RESERVADO,
  FRASE_ERRO_CARREGAR_USO_LIVRE,
  FRASE_FALHA_AO_CORRIGIR_CHEGADA,
  FRASE_FALHA_AO_MARCAR_CHEGADA,
  FRASE_HORA_DE_CHEGADA,
  LEGENDA_USO_LIVRE,
  ROTULO_CHEGOU,
  ROTULO_CHEGOU_AS,
  ROTULO_CONTA_PESSOAS,
  ROTULO_FECHAR,
  ROTULO_MARCANDO,
  ROTULO_TENTAR_DE_NOVO,
  ROTULO_VOLTAR_A_AGENDA,
  subTituloDoUsoLivre,
  toastChegadaMarcada,
  tituloDoUsoLivre,
} from "@/lib/agenda/textos";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { TagDoUsoLivre } from "./cartao-evento";
import { CLASSE_DO_CAMPO_DA_AGENDA } from "./campos-turma";
import { ConfirmarCancelarReserva } from "./confirmar-cancelar-reserva";

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FolhaUsoLivreProps = {
  // O que o cartão já sabia no toque — o cabeçalho real aparece antes de o servidor responder. `null`
  // quando a folha abriu direto por link e o servidor ainda não respondeu (ou falhou).
  cabecalho: UsoLivreDaSemana | null;
  // O uso, quando o servidor já respondeu; `null` enquanto carrega ou quando a leitura falhou.
  carregado: UsoLivreCarregado | null;
  erroAoCarregar: boolean;
  // Chamado antes de cancelar a reserva (a semana não deve avisar "não existe mais" do que a própria
  // folha removeu).
  aoComecarARemover: () => void;
  aoFechar: () => void;
};

// Uma linha da conta (`justify-between`, Corpo, divisória — 05-UI-SPEC.md §"Folha do uso livre").
function LinhaDaConta({ rotulo, valor, testId }: { rotulo: string; valor: string; testId?: string }) {
  return (
    <div className="border-borda flex items-baseline justify-between gap-4 border-b py-2">
      <span className="text-corpo text-tinta-media">{rotulo}</span>
      <span data-testid={testId} className="text-corpo text-tinta text-right tabular-nums [overflow-wrap:anywhere]">
        {valor}
      </span>
    </div>
  );
}

// A folha do uso livre (05-UI-SPEC.md §"Folha do uso livre (diálogo)"), aberta por `?uso={id}`: ponto
// `area-loja` + "Uso livre · {nome}", o sub-título com o dia e o horário e a tag de estado, a conta e,
// por estado, o que se faz: reservado → "Chegou às" (a hora da reserva, editável) + "Cancelar reserva" ·
// "Chegou"; no espaço → "Chegou às" editável até encerrar. Toda gravação decide no servidor, condicionada
// ao estado (dois celulares nunca gravam por cima um do outro).
export function FolhaUsoLivre({ cabecalho, carregado, erroAoCarregar, aoComecarARemover, aoFechar }: FolhaUsoLivreProps) {
  const router = useRouter();
  const uso = carregado ?? cabecalho;

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
        data-testid="folha-uso-livre"
        data-uso-id={uso?.id}
        data-estado={carregado?.estado}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta flex items-start gap-2 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="bg-area-loja mt-[10px] inline-block size-2 shrink-0 rounded-full" />
              <span className="min-w-0">{uso ? tituloDoUsoLivre(uso.titulo) : LEGENDA_USO_LIVRE}</span>
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-apoio text-tinta-fraca flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
                {uso ? (
                  <>
                    <span>
                      {subTituloDoUsoLivre(diaDaSemanaPorExtenso(uso.data), formatarDiaMes(uso.data), uso.inicio, uso.fim)}
                    </span>
                    <TagDoUsoLivre uso={uso} comEncerrado />
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-uso-livre-fechar"
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        {carregado === null ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
              {erroAoCarregar ? (
                <div className="flex flex-col items-start gap-3" data-testid="folha-uso-livre-erro">
                  <p role="alert" className="text-corpo text-erro">
                    {FRASE_ERRO_CARREGAR_USO_LIVRE}
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
              ) : (
                <div aria-busy="true" className="flex flex-col gap-3" data-testid="folha-uso-livre-carregando">
                  {LINHAS_DO_ESQUELETO.map((linha) => (
                    <Skeleton key={linha} className="h-11 w-full" />
                  ))}
                </div>
              )}
            </div>
            <div className="border-border bg-popover flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR_A_AGENDA}
              </Button>
            </div>
          </>
        ) : carregado.estado === "reservado" ? (
          <Reservado
            key={`${carregado.id}-reservado`}
            uso={carregado}
            aoComecarARemover={aoComecarARemover}
            aoFechar={aoFechar}
          />
        ) : (
          <UsoIniciado key={`${carregado.id}-${carregado.estado}`} uso={carregado} aoFechar={aoFechar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type CampoDeHoraProps = {
  id: string;
  testId: string;
  rotulo: string;
  valor: string;
  erro: string | null;
  desabilitado?: boolean;
  aoMudar: (valor: string) => void;
  aoSair?: () => void;
};

function CampoDeHora({ id, testId, rotulo, valor, erro, desabilitado = false, aoMudar, aoSair }: CampoDeHoraProps) {
  const idDoErro = `${id}-erro`;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-apoio text-tinta font-semibold">
        {rotulo}
      </label>
      <Input
        id={id}
        type="time"
        step={60}
        data-testid={testId}
        disabled={desabilitado}
        aria-invalid={erro !== null}
        aria-describedby={erro === null ? undefined : idDoErro}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        onBlur={aoSair}
        className={`${CLASSE_DO_CAMPO_DA_AGENDA} w-40 tabular-nums`}
      />
      {erro === null ? null : (
        <p id={idDoErro} role="alert" data-testid={`${testId}-erro`} className="text-apoio text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

// Reservado (AGE-13): "Chegou às" já com a hora da reserva (editável) e a dica; rodapé "Cancelar
// reserva" (`outline` de erro, com confirmação) · "Chegou" (primário, "Marcando…").
function Reservado({
  uso,
  aoComecarARemover,
  aoFechar,
}: {
  uso: UsoLivreCarregado;
  aoComecarARemover: () => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [chegada, setChegada] = useState(uso.chegadaPrevista);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function marcar() {
    if (emVoo.current) {
      return;
    }
    if (!FORMATO_HORA.test(chegada)) {
      setErro(FRASE_HORA_DE_CHEGADA);
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await marcarChegada({ usoLivreId: uso.id, chegada });
      if (!resposta.ok) {
        setErro(resposta.erro);
        router.refresh();
        return;
      }
      toast.success(toastChegadaMarcada(resposta.dados.chegada));
      // A ação revalidou a Agenda: a folha chega com o estado "no espaço" (a chave muda e este bloco sai).
    } catch {
      setErro(FRASE_FALHA_AO_MARCAR_CHEGADA);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="flex flex-col" data-testid="uso-conta">
          <LinhaDaConta rotulo={ROTULO_CONTA_PESSOAS} valor={String(uso.pessoas)} />
        </div>
        <CampoDeHora
          id="uso-chegou-as"
          testId="uso-chegou-as"
          rotulo={ROTULO_CHEGOU_AS}
          valor={chegada}
          erro={erro}
          desabilitado={enviando}
          aoMudar={(valor) => {
            setChegada(valor);
            setErro(null);
          }}
        />
        <p className="text-apoio text-tinta-fraca">{DICA_RESERVADO}</p>
      </div>
      <div className="border-border bg-popover flex flex-wrap items-start justify-between gap-2 border-t px-6 py-4">
        <ConfirmarCancelarReserva
          usoLivreId={uso.id}
          nome={uso.titulo}
          data={uso.data}
          desabilitado={enviando}
          aoComecar={aoComecarARemover}
          aoCancelar={aoFechar}
          aoFecharDepoisDaRecusa={() => router.refresh()}
        />
        <Button
          type="button"
          data-testid="uso-chegou"
          disabled={enviando}
          aria-busy={enviando ? "true" : undefined}
          onClick={() => void marcar()}
          className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
        >
          {enviando ? ROTULO_MARCANDO : ROTULO_CHEGOU}
        </Button>
      </div>
    </>
  );
}

// No espaço (e, no plano 09 Tarefa 3, o encerramento): "Chegou às" editável até encerrar — corrigido ao
// sair do campo (`corrigirChegada`, condicionado a `no_espaco`).
function UsoIniciado({ uso, aoFechar }: { uso: UsoLivreCarregado; aoFechar: () => void }) {
  const router = useRouter();
  const [chegada, setChegada] = useState(uso.chegada ?? uso.chegadaPrevista);
  const gravada = useRef(uso.chegada ?? uso.chegadaPrevista);
  const [erroDaChegada, setErroDaChegada] = useState<string | null>(null);

  async function corrigir() {
    if (chegada === gravada.current) {
      return;
    }
    if (!FORMATO_HORA.test(chegada)) {
      setErroDaChegada(FRASE_HORA_DE_CHEGADA);
      return;
    }
    const pedida = chegada;
    try {
      const resposta = await corrigirChegada({ usoLivreId: uso.id, chegada: pedida });
      if (!resposta.ok) {
        setErroDaChegada(resposta.erro);
        router.refresh();
        return;
      }
      gravada.current = resposta.dados.chegada;
      setErroDaChegada(null);
    } catch {
      setErroDaChegada(FRASE_FALHA_AO_CORRIGIR_CHEGADA);
    }
  }

  const noEspaco = uso.estado === "no_espaco";
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="flex flex-col" data-testid="uso-conta">
          <LinhaDaConta rotulo={ROTULO_CONTA_PESSOAS} valor={String(uso.pessoas)} />
        </div>
        {noEspaco ? (
          <CampoDeHora
            id="uso-chegou-as"
            testId="uso-chegou-as"
            rotulo={ROTULO_CHEGOU_AS}
            valor={chegada}
            erro={erroDaChegada}
            aoMudar={(valor) => {
              setChegada(valor);
              setErroDaChegada(null);
            }}
            aoSair={() => void corrigir()}
          />
        ) : null}
      </div>
      <div className="border-border bg-popover flex flex-wrap justify-end gap-2 border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          data-testid="uso-voltar"
          onClick={aoFechar}
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
        >
          {ROTULO_VOLTAR_A_AGENDA}
        </Button>
      </div>
    </>
  );
}
