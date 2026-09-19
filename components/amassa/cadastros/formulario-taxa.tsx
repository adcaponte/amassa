"use client";

import { type FormEvent, useState } from "react";

import { definirTaxaDoCartao } from "@/lib/cadastros/acoes";
import {
  DICA_TAXA,
  ROTULO_CAMPO_TAXA,
  ROTULO_SALVAR_TAXA,
  TITULO_TAXA,
} from "@/lib/cadastros/textos";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type FormularioTaxaProps = {
  // Pontos-base atuais (0-10000), lidos no servidor por `obterTaxaDoCartao()` — 0 quando a
  // configuração ainda não existe.
  pontosBaseAtuais: number;
};

// "350" pontos-base → "3,5" — a mesma mão inversa de `converterPercentualParaPontosBase`
// (lib/financeiro/dinheiro.ts), só para MOSTRAR o valor atual no campo; a conversão de volta
// (texto → pontos-base) continua sendo feita no servidor, dentro de `esquemaTaxa`.
function pontosBaseParaTexto(pontosBase: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(pontosBase / 100);
}

// Único elemento interativo da sub-aba Taxas (04.4-UI-SPEC.md §Foco Visual Principal). Salvar
// termina em NAVEGAÇÃO COMPLETA para `/cadastros?sub=taxas` — nunca um hook de roteador do Next:
// o valor mostrado precisa vir do servidor (outro gestor pode ter salvado uma taxa diferente
// entre a abertura da tela e este envio), nunca de um estado otimista.
export function FormularioTaxa({ pontosBaseAtuais }: FormularioTaxaProps) {
  const [valor, setValor] = useState(() => pontosBaseParaTexto(pontosBaseAtuais));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) {
      return;
    }
    setErro(null);
    setEnviando(true);

    const resposta = await definirTaxaDoCartao({ percentualTexto: valor });

    setEnviando(false);

    if (!resposta.ok) {
      // Banner inline, campo preenchido — nada do que foi digitado se perde.
      setErro(resposta.erro);
      return;
    }

    window.location.assign("/cadastros?sub=taxas");
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-titulo text-foreground">{TITULO_TAXA}</h2>
        <p className="text-apoio text-muted-foreground max-w-prose">{DICA_TAXA}</p>
      </div>

      <form onSubmit={(evento) => void salvar(evento)} className="flex flex-col gap-3">
        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}

        <Field data-invalid={!!erro}>
          <FieldLabel htmlFor="taxa-cartao">{ROTULO_CAMPO_TAXA}</FieldLabel>
          <Input
            id="taxa-cartao"
            data-testid="taxa-campo"
            inputMode="decimal"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            className="text-corpo md:text-corpo min-h-[44px] max-w-[220px]"
          />
        </Field>

        <Button
          type="submit"
          disabled={enviando}
          aria-busy={enviando}
          className="min-h-[44px] w-fit"
        >
          {enviando ? "Salvando…" : ROTULO_SALVAR_TAXA}
        </Button>
      </form>
    </div>
  );
}
