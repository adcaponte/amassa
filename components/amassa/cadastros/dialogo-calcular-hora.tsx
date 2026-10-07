"use client";

import { useEffect, useRef, useState } from "react";

import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { formatarReais } from "@/lib/financeiro/formato";
import { usarHoraCalculada } from "@/lib/precificacao/acoes";
import { calcularHora } from "@/lib/precificacao/hora";
import {
  DICA_CALCULAR_HORA,
  DICA_REFERENCIA_HORA,
  FRASE_INFORME_AS_HORAS,
  ROTULO_CANCELAR,
  ROTULO_HORAS_POR_MES,
  ROTULO_PARTE_DA_CASA,
  ROTULO_RETIRADA_DESEJADA,
  ROTULO_SUA_HORA,
  ROTULO_USAR_ESTA_HORA,
  TITULO_DIALOGO_CALCULAR_HORA,
} from "@/lib/precificacao/textos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type DialogoCalcularHoraProps = {
  aberto: boolean;
  onFechar: () => void;
};

// Valores iniciais do protótipo (`S.hora`, prototipo.html) — puramente ilustrativos, os mesmos
// três números que a semente de referência já usa como ponto de partida da conversa.
const RETIRADA_INICIAL = "3500";
const CASA_INICIAL = "1400";
const HORAS_INICIAL = "140";

// Conversão TOLERANTE, só para o PREVIEW ao vivo enquanto a pessoa digita — texto vazio ou
// inválido vira 0, que `calcularHora` já trata como "sem horas" (devolve `null`, mostrando
// "Informe as horas." sem lançar erro nenhum). A validação estrita de verdade
// (`esquemaCalculoDaHora`) só roda no SERVIDOR, ao enviar.
function paraMilesimosTolerante(texto: string): number {
  const numero = Number(texto.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 1000) : 0;
}

function paraCentavosTolerante(texto: string): number {
  const resultado = converterReaisParaCentavos(texto);
  return resultado.ok ? (resultado.centavos ?? 0) : 0;
}

// "Calcular minha hora" (ORC-04, D-13): retirada desejada + parte dos custos da casa que a
// produção paga, dividido pelas horas realmente produzindo — é por AQUI que custo fixo entra no
// preço, e por isso não há rateio separado no Financeiro. O resultado atualiza AO VIVO
// (`calcularHora`, módulo puro, chamado direto no cliente) enquanto a pessoa digita; "Usar esta
// hora" só então chama o servidor, que valida de novo e grava por histórico (D-15).
export function DialogoCalcularHora({ aberto, onFechar }: DialogoCalcularHoraProps) {
  const [retiradaTexto, setRetiradaTexto] = useState(RETIRADA_INICIAL);
  const [casaTexto, setCasaTexto] = useState(CASA_INICIAL);
  const [horasTexto, setHorasTexto] = useState(HORAS_INICIAL);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setRetiradaTexto(RETIRADA_INICIAL);
      setCasaTexto(CASA_INICIAL);
      setHorasTexto(HORAS_INICIAL);
      setErro(null);
      const idDoTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(idDoTimer);
    }
  }, [aberto]);

  const horaCentavos = calcularHora({
    retiradaCentavos: paraCentavosTolerante(retiradaTexto),
    casaCentavos: paraCentavosTolerante(casaTexto),
    horasMilesimos: paraMilesimosTolerante(horasTexto),
  });

  async function usar() {
    if (enviando) {
      return;
    }
    setErro(null);
    setEnviando(true);

    const resposta = await usarHoraCalculada({ retiradaTexto, casaTexto, horasTexto });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA, nunca a atualização client-side do roteador — a linha nova do
    // parâmetro `trabalho_hora` só existe depois desta ida ao servidor.
    window.location.assign("/gestao/cadastros?sub=parametros&aviso=hora-atualizada");
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && onFechar()}>
      <DialogContent
        aria-label={TITULO_DIALOGO_CALCULAR_HORA}
        className="flex max-h-[85svh] flex-col overflow-y-auto sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-titulo">{TITULO_DIALOGO_CALCULAR_HORA}</DialogTitle>
        </DialogHeader>

        <p className="text-apoio text-muted-foreground">{DICA_CALCULAR_HORA}</p>

        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void usar();
          }}
          className="flex flex-col gap-4"
        >
          {erro && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erro}
            </p>
          )}

          <Field>
            <FieldLabel htmlFor="hora-retirada">{ROTULO_RETIRADA_DESEJADA}</FieldLabel>
            <Input
              id="hora-retirada"
              ref={inputRef}
              inputMode="decimal"
              value={retiradaTexto}
              onChange={(evento) => setRetiradaTexto(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="hora-casa">{ROTULO_PARTE_DA_CASA}</FieldLabel>
            <Input
              id="hora-casa"
              inputMode="decimal"
              value={casaTexto}
              onChange={(evento) => setCasaTexto(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="hora-horas">{ROTULO_HORAS_POR_MES}</FieldLabel>
            <Input
              id="hora-horas"
              data-testid="hora-horas"
              inputMode="decimal"
              value={horasTexto}
              onChange={(evento) => setHorasTexto(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          <div data-testid="hora-resultado" className="flex flex-col gap-1">
            {horaCentavos === null ? (
              <p data-testid="hora-informe-as-horas" className="text-corpo text-muted-foreground">
                {FRASE_INFORME_AS_HORAS}
              </p>
            ) : (
              <div
                data-testid="hora-valor"
                className="text-display text-foreground flex items-baseline justify-between tabular-nums"
              >
                <span className="text-corpo text-muted-foreground">{ROTULO_SUA_HORA}</span>
                <span>{formatarReais(horaCentavos)}</span>
              </div>
            )}
            <p className="text-apoio text-muted-foreground">{DICA_REFERENCIA_HORA}</p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
            >
              {ROTULO_CANCELAR}
            </button>
            <button
              type="submit"
              disabled={enviando || horaCentavos === null}
              aria-busy={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Salvando…" : ROTULO_USAR_ESTA_HORA}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
