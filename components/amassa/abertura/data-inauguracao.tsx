"use client";

import { type KeyboardEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { definirDataDeInauguracao } from "@/lib/abertura/acoes";
import { formatarDataPorExtenso } from "@/lib/abertura/formato";
import { contagemRegressiva, type ContagemRegressiva } from "@/lib/abertura/prazos";
import {
  FRASE_DEFINIR_INAUGURACAO,
  ROTULO_ALTERAR_INAUGURACAO,
  rotuloContagemRegressiva,
} from "@/lib/abertura/textos";
import { Input } from "@/components/ui/input";

export type DataInauguracaoProps = {
  // `null` quando `abertura_configuracao` ainda está vazia (o estado logo depois da migração) —
  // nenhuma data é inventada em lugar nenhum: nem aqui, nem no banco, nem no valor inicial do
  // campo (D-17).
  inauguracaoEm: string | null;
  // O dia civil de Brasília, calculado UMA VEZ na borda (`app/(app)/abertura/page.tsx`) — este
  // componente nunca lê o relógio por conta própria.
  hoje: string;
};

// Client Component no cabeçalho, no molde do protótipo: em repouso, o texto da data (ou o pedido
// de defini-la) como botão discreto; ao acionar, dá lugar a um campo de data com Salvar/Cancelar.
// `Enter` salva e `Escape` cancela. À direita, a contagem regressiva — o número grande e, abaixo,
// o rótulo que muda com o tipo (D-17/ABE-14).
export function DataInauguracao({ inauguracaoEm, hoje }: DataInauguracaoProps) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(inauguracaoEm ?? hoje);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const contagem: ContagemRegressiva | null = contagemRegressiva(inauguracaoEm, hoje);

  function abrir() {
    setValor(inauguracaoEm ?? hoje);
    setErro(null);
    setEditando(true);
  }

  function cancelar() {
    setErro(null);
    setEditando(false);
  }

  async function salvar() {
    setEnviando(true);
    setErro(null);

    const resposta = await definirDataDeInauguracao({ inauguracaoEm: valor });

    setEnviando(false);

    if (!resposta.ok) {
      // Erro mostrado inline, o painel de edição continua aberto — nada do que foi escolhido se
      // perde.
      setErro(resposta.erro);
      return;
    }

    toast.success("Data de inauguração atualizada.");
    setEditando(false);
    router.refresh();
  }

  function aoTeclarNoCampo(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      void salvar();
    }
    if (evento.key === "Escape") {
      evento.preventDefault();
      cancelar();
    }
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-4 md:px-8">
      <div className="flex flex-col gap-2">
        {!editando ? (
          <button
            type="button"
            onClick={abrir}
            aria-label={ROTULO_ALTERAR_INAUGURACAO}
            data-testid="abertura-editar-inauguracao"
            className="text-apoio hover:text-acento w-fit border-b border-dashed border-border pb-0.5 text-left text-muted-foreground transition-colors"
          >
            {inauguracaoEm
              ? `Inauguração em ${formatarDataPorExtenso(inauguracaoEm)}`
              : FRASE_DEFINIR_INAUGURACAO}
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="inauguracaoEm"
                className="text-micro font-semibold tracking-wide text-muted-foreground uppercase"
              >
                Inauguração
              </label>
              <Input
                id="inauguracaoEm"
                type="date"
                value={valor}
                onChange={(evento) => setValor(evento.target.value)}
                onKeyDown={aoTeclarNoCampo}
                className="text-corpo md:text-corpo min-h-[44px] w-auto"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={cancelar}
              disabled={enviando}
              className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
            >
              Cancelar
            </button>
          </div>
        )}
        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}
      </div>

      <div className="flex-none text-right" data-testid="abertura-regressiva">
        <div className="text-display text-acento font-bold leading-none tabular-nums">
          {contagem ? contagem.dias : "—"}
        </div>
        {contagem && (
          <div className="text-micro mt-0.5 font-semibold tracking-wide text-muted-foreground uppercase">
            {rotuloContagemRegressiva(contagem)}
          </div>
        )}
      </div>
    </div>
  );
}
