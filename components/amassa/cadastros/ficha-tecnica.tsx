"use client";

import { useState } from "react";

import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import type { InsumoParaFicha } from "@/lib/cadastros/consultas";
import {
  DICA_FICHA_TECNICA,
  FRASE_ESCOLHA_INSUMO_E_QUANTIDADE,
  FRASE_VAZIO_FICHA_TECNICA,
  PLACEHOLDER_QUANTIDADE,
  ROTULO_ADICIONAR_INSUMO,
  ROTULO_INSUMO,
  ROTULO_QUANTIDADE,
  ROTULO_TIRAR_INSUMO,
  TITULO_FICHA_TECNICA,
} from "@/lib/cadastros/textos";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LinhaDeFichaEmEdicao = {
  insumoId: string;
  quantidadeTexto: string;
};

export type FichaTecnicaProps = {
  linhas: readonly LinhaDeFichaEmEdicao[];
  // Só itens com estoque próprio, sem o próprio item (já filtrado por quem chama —
  // `DialogoItemCatalogo`, que sabe o id do item em edição).
  insumosCandidatos: readonly InsumoParaFicha[];
  aoAdicionar: (insumoId: string, quantidadeTexto: string) => void;
  aoTirar: (indice: number) => void;
  erro: string | null;
};

// "O que gasta do estoque a cada venda" (04.4-05-PLAN.md) — um nível só: cada linha aponta um
// insumo (item com estoque próprio) e uma quantidade. Sempre visível no diálogo, independente de
// "Tem estoque próprio" — um item VENDÁVEL (o café) tem ficha técnica; quem TEM estoque próprio é
// o insumo (o grão), não necessariamente o item vendido.
export function FichaTecnica({
  linhas,
  insumosCandidatos,
  aoAdicionar,
  aoTirar,
  erro,
}: FichaTecnicaProps) {
  const [insumoId, setInsumoId] = useState("");
  const [quantidadeTexto, setQuantidadeTexto] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  function descricaoDoInsumo(id: string): string {
    const insumo = insumosCandidatos.find((candidato) => candidato.id === id);
    if (!insumo) {
      return "?";
    }
    return insumo.unidade ? `${ROTULO_UNIDADE[insumo.unidade]} de ${insumo.nome}` : insumo.nome;
  }

  function adicionar() {
    if (!insumoId || !quantidadeTexto.trim()) {
      setErroLocal(FRASE_ESCOLHA_INSUMO_E_QUANTIDADE);
      return;
    }
    setErroLocal(null);
    aoAdicionar(insumoId, quantidadeTexto);
    setQuantidadeTexto("");
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-titulo text-foreground">{TITULO_FICHA_TECNICA}</h3>

      {linhas.length === 0 ? (
        <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_FICHA_TECNICA}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {linhas.map((linha, indice) => (
            <li
              key={`${linha.insumoId}-${indice}`}
              data-testid="ficha-linha"
              className="border-border flex min-h-[44px] items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="text-corpo text-foreground break-words">
                {linha.quantidadeTexto} {descricaoDoInsumo(linha.insumoId)}
              </span>
              <button
                type="button"
                onClick={() => aoTirar(indice)}
                className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-2 font-medium"
              >
                {ROTULO_TIRAR_INSUMO}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(erro || erroLocal) && (
        <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
          {erro ?? erroLocal}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-[160px] flex-1">
          <FieldLabel htmlFor="ficha-insumo">{ROTULO_INSUMO}</FieldLabel>
          <Select value={insumoId} onValueChange={setInsumoId}>
            <SelectTrigger id="ficha-insumo" aria-label={ROTULO_INSUMO} className="min-h-[44px] w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {insumosCandidatos.map((insumo) => (
                <SelectItem key={insumo.id} value={insumo.id}>
                  {insumo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-28">
          <FieldLabel htmlFor="ficha-quantidade">{ROTULO_QUANTIDADE}</FieldLabel>
          <Input
            id="ficha-quantidade"
            inputMode="decimal"
            placeholder={PLACEHOLDER_QUANTIDADE}
            value={quantidadeTexto}
            onChange={(evento) => setQuantidadeTexto(evento.target.value)}
            className="text-corpo min-h-[44px]"
          />
        </Field>
        <button
          type="button"
          onClick={adicionar}
          className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4 font-medium"
        >
          {ROTULO_ADICIONAR_INSUMO}
        </button>
      </div>

      <p className="text-apoio text-muted-foreground">{DICA_FICHA_TECNICA}</p>
    </div>
  );
}
