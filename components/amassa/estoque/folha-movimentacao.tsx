"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { registrarMovimentacao } from "@/lib/estoque/acoes";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { DESTINOS_DE_SAIDA, type DestinoDeSaida } from "@/lib/estoque/destinos";
import { textoParaMilesimos } from "@/lib/estoque/esquemas";
import {
  DICA_CUSTO,
  DICA_DESTINO,
  FRASE_CUSTO_OBRIGATORIO,
  FRASE_DESTINO_OBRIGATORIO,
  FRASE_FALHA_AO_REGISTRAR,
  ROTULO_CUSTO,
  ROTULO_DESTINO,
  ROTULO_ENTRADA,
  ROTULO_O_QUE_ACONTECEU,
  ROTULO_QUANTIDADE,
  ROTULO_REGISTRANDO,
  ROTULO_REGISTRAR_BAIXA,
  ROTULO_REGISTRAR_ENTRADA,
  ROTULO_REGISTRAR_MOVIMENTACAO,
  ROTULO_SAIDA,
  dicaDaQuantidade,
  textoToastBaixa,
  textoToastEntrada,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { formatarMilesimos } from "./cartao-saldo";

type TipoDaFolha = "entrada" | "saida";

// Um erro por vez, embaixo do campo a que se refere (UI-D9 — nunca toast); o `geral` fica logo
// acima do botão de gravar (falha do servidor, material desativado no meio do caminho).
type ErroDaFolha = { campo: "quantidade" | "custo" | "destino" | "geral"; mensagem: string };

// Quem abre a folha a monta com `key` do item (`AbaSaldos`): cada abertura nasce limpa, em Saída,
// sem efeito que zere estado à mão.
export type FolhaMovimentacaoProps = {
  saldo: SaldoDoItem;
  aoFechar: () => void;
};

const TIPOS: readonly { valor: TipoDaFolha; rotulo: string }[] = [
  { valor: "entrada", rotulo: ROTULO_ENTRADA },
  { valor: "saida", rotulo: ROTULO_SAIDA },
];

// A folha de movimentação no caminho do traçador (UI-SPEC §"Folha de movimentação"): segmentado
// Entrada · Saída, campo grande de quantidade, "Quanto custou ao todo" na entrada, a grade dos cinco
// destinos na saída, e o rodapé preso com o botão que diz o que vai gravar. Abre em Saída ("Dar
// baixa"). O Ajuste, os atalhos de quantidade, o vínculo do destino e a pré-visualização "o saldo
// passa de X para Y" entram nos planos seguintes da fase — esta folha já nasce com o contrato de
// `data-testid` que eles preservam.
//
// Contêiner: o `Dialog` do projeto (padrão de `formulario-forno.tsx`) — tela toda no celular
// (`h-[100dvh]`), modal centralizado a partir de `md`. Fechar próprio de 44×44 (UI-D10). Nenhum foco
// automático abaixo de 768px (UI-D13): o teclado não sobe sozinho por cima da folha.
export function FolhaMovimentacao({ saldo, aoFechar }: FolhaMovimentacaoProps) {
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDaFolha>("saida");
  const [quantidadeTexto, setQuantidadeTexto] = useState("");
  const [custoTexto, setCustoTexto] = useState("");
  const [destino, setDestino] = useState<DestinoDeSaida | null>(null);
  const [erro, setErro] = useState<ErroDaFolha | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Guarda síncrona contra o toque duplo (EST-01 idempotency): o `disabled` do botão só vale depois
  // do próximo desenho; a referência vale já no segundo clique do mesmo gesto.
  const emVoo = useRef(false);
  const campoQuantidade = useRef<HTMLInputElement>(null);
  const botoesDeTipo = useRef<Record<TipoDaFolha, HTMLButtonElement | null>>({
    entrada: null,
    saida: null,
  });

  const unidade = ROTULO_UNIDADE[saldo.unidade];
  const rotuloGravar = tipo === "saida" ? ROTULO_REGISTRAR_BAIXA : ROTULO_REGISTRAR_ENTRADA;

  function escolherTipo(novo: TipoDaFolha) {
    setTipo(novo);
    setErro(null);
  }

  // Setas do teclado movem a escolha no segmentado (padrão de `radiogroup`).
  function aoTeclarNoTipo(evento: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(evento.key)) {
      return;
    }
    evento.preventDefault();
    const novo: TipoDaFolha = tipo === "entrada" ? "saida" : "entrada";
    escolherTipo(novo);
    botoesDeTipo.current[novo]?.focus();
  }

  function validarNoCliente(): ErroDaFolha | null {
    const quantidade = textoParaMilesimos(quantidadeTexto);
    if (!quantidade.ok) {
      return { campo: "quantidade", mensagem: quantidade.erro };
    }
    if (tipo === "entrada") {
      const custo = converterReaisParaCentavos(custoTexto);
      if (!custo.ok) {
        return { campo: "custo", mensagem: custo.erro };
      }
      if (custo.centavos === null) {
        return { campo: "custo", mensagem: FRASE_CUSTO_OBRIGATORIO };
      }
    } else if (destino === null) {
      return { campo: "destino", mensagem: FRASE_DESTINO_OBRIGATORIO };
    }
    return null;
  }

  async function registrar() {
    if (emVoo.current) {
      return;
    }
    const erroDoCliente = validarNoCliente();
    if (erroDoCliente) {
      setErro(erroDoCliente);
      return;
    }

    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await registrarMovimentacao(
        tipo === "entrada"
          ? { tipo, itemId: saldo.id, quantidadeTexto, custoTexto }
          : { tipo, itemId: saldo.id, quantidadeTexto, destino },
      );
      if (!resposta.ok) {
        // A folha continua aberta e preenchida — nada do que foi digitado se perde.
        setErro({ campo: "geral", mensagem: resposta.erro });
        return;
      }

      const gravada = resposta.dados;
      const quantidade = formatarMilesimos(Math.abs(gravada.quantidadeMilesimos));
      const unidadeGravada = ROTULO_UNIDADE[gravada.unidade];
      toast.success(
        gravada.tipo === "saida"
          ? textoToastBaixa({
              quantidade,
              unidade: unidadeGravada,
              nome: gravada.nome,
              saldoNegativo:
                gravada.saldoDepoisMilesimos < 0
                  ? formatarMilesimos(gravada.saldoDepoisMilesimos)
                  : null,
            })
          : textoToastEntrada({ quantidade, unidade: unidadeGravada, nome: gravada.nome }),
      );
      aoFechar();
      router.refresh();
    } catch (falha) {
      console.error("Falha ao registrar movimentação:", falha);
      setErro({ campo: "geral", mensagem: FRASE_FALHA_AO_REGISTRAR });
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function mensagemDe(campo: ErroDaFolha["campo"]) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        role="alert"
        aria-live="assertive"
        data-testid="folha-erro"
        className="text-apoio text-erro"
      >
        {erro.mensagem}
      </p>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(novoValor) => {
        if (!novoValor && !enviando) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-movimentacao"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          if (window.matchMedia("(min-width: 768px)").matches) {
            campoQuantidade.current?.focus();
          }
        }}
        className={cn(
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
        )}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta">
              {ROTULO_REGISTRAR_MOVIMENTACAO}
            </DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca break-words">
              {saldo.nome} · saldo de agora: {formatarMilesimos(saldo.saldoMilesimos)} {unidade}
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="folha-fechar"
            disabled={enviando}
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            void registrar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
            <fieldset className="flex flex-col gap-2">
              <legend id="folha-tipo-rotulo" className="text-corpo text-tinta mb-2 font-semibold">
                {ROTULO_O_QUE_ACONTECEU}
              </legend>
              <div
                role="radiogroup"
                aria-labelledby="folha-tipo-rotulo"
                className="grid grid-cols-2 gap-2"
              >
                {TIPOS.map((opcao) => {
                  const marcado = tipo === opcao.valor;
                  return (
                    <button
                      key={opcao.valor}
                      ref={(elemento) => {
                        botoesDeTipo.current[opcao.valor] = elemento;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={marcado}
                      tabIndex={marcado ? 0 : -1}
                      data-testid={`folha-tipo-${opcao.valor}`}
                      onClick={() => escolherTipo(opcao.valor)}
                      onKeyDown={aoTeclarNoTipo}
                      className={cn(
                        "text-corpo min-h-[52px] rounded-md border px-2 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                        marcado
                          ? "bg-acento border-acento text-white"
                          : "bg-superficie border-borda-forte text-tinta-media",
                      )}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <label htmlFor="folha-quantidade" className="text-corpo text-tinta font-semibold">
                {ROTULO_QUANTIDADE}
              </label>
              <p id="folha-quantidade-dica" className="text-apoio text-tinta-fraca">
                {dicaDaQuantidade(unidade)}
              </p>
              <Input
                id="folha-quantidade"
                ref={campoQuantidade}
                data-testid="folha-quantidade"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                aria-describedby="folha-quantidade-dica"
                aria-invalid={erro?.campo === "quantidade"}
                value={quantidadeTexto}
                onChange={(evento) => {
                  setQuantidadeTexto(evento.target.value);
                  if (erro?.campo === "quantidade") setErro(null);
                }}
                className="text-display md:text-display h-[60px] text-center tabular-nums"
              />
              {mensagemDe("quantidade")}
            </div>

            {tipo === "entrada" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="folha-custo" className="text-corpo text-tinta font-semibold">
                  {ROTULO_CUSTO}
                </label>
                <p id="folha-custo-dica" className="text-apoio text-tinta-fraca">
                  {DICA_CUSTO}
                </p>
                <Input
                  id="folha-custo"
                  data-testid="folha-custo"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="R$ 0,00"
                  aria-describedby="folha-custo-dica"
                  aria-invalid={erro?.campo === "custo"}
                  value={custoTexto}
                  onChange={(evento) => {
                    setCustoTexto(evento.target.value);
                    if (erro?.campo === "custo") setErro(null);
                  }}
                  className="text-corpo md:text-corpo min-h-[44px] tabular-nums"
                />
                {mensagemDe("custo")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p id="folha-destino-rotulo" className="text-corpo text-tinta font-semibold">
                  {ROTULO_DESTINO}
                </p>
                <p id="folha-destino-dica" className="text-apoio text-tinta-fraca">
                  {DICA_DESTINO}
                </p>
                <div
                  role="group"
                  aria-labelledby="folha-destino-rotulo"
                  aria-describedby="folha-destino-dica"
                  className="grid grid-cols-2 gap-2"
                >
                  {DESTINOS_DE_SAIDA.map((opcao) => {
                    const marcado = destino === opcao.valor;
                    return (
                      <button
                        key={opcao.valor}
                        type="button"
                        aria-pressed={marcado}
                        data-testid={`folha-destino-${opcao.valor}`}
                        onClick={() => {
                          // Tocar de novo no marcado desmarca (herdado do protótipo).
                          setDestino(marcado ? null : opcao.valor);
                          if (erro?.campo === "destino") setErro(null);
                        }}
                        className={cn(
                          "flex min-h-[52px] flex-col items-start justify-center rounded-md border px-3 py-2 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                          marcado
                            ? "bg-acento-fundo border-acento text-acento"
                            : "bg-superficie border-borda-forte text-tinta",
                        )}
                      >
                        <span className={cn("text-corpo", marcado && "font-semibold")}>
                          {opcao.rotulo}
                        </span>
                        <span
                          className={cn("text-apoio", marcado ? "text-acento" : "text-tinta-fraca")}
                        >
                          {ROTULO_AREA[opcao.area]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {mensagemDe("destino")}
              </div>
            )}
          </div>

          {/* Rodapé preso por FLEX, fora da área rolável, nunca `position: sticky` (G-03-1). */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {mensagemDe("geral")}
            <button
              type="submit"
              data-testid="folha-registrar"
              disabled={enviando}
              aria-busy={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[52px] w-full items-center justify-center rounded-md px-4 font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? ROTULO_REGISTRANDO : rotuloGravar}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
