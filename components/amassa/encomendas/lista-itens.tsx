"use client";

import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { reordenarItemEncomenda } from "@/lib/encomendas/acoes";
import { FRASE_FALHA_AO_SALVAR } from "@/lib/encomendas/textos";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ValoresDoFormulario } from "./formulario-encomenda";

export type ListaItensProps = {
  // Na CRIAÇÃO não existe linha no banco para reordenar: a seta só muda a ordem do array local
  // e a `ordem` correta viaja junto no `criarEncomenda`. Na EDIÇÃO, um item que já existe no
  // banco (tem `idDoBanco`) grava a nova ordem na hora via `reordenarItemEncomenda`; um item
  // recém-adicionado nesta mesma sessão de edição (ainda sem `idDoBanco`) só reordena local,
  // porque não há linha no banco para apontar ainda.
  modoEdicao: boolean;
};

// Setas de 44×44px (D-16), nunca escondidas nas pontas — só `disabled`, porque sumir o botão
// muda o leiaute e engana quem navega por teclado. A lista nasce com uma linha em branco na
// criação (decisão do dono, `valoresIniciais` em formulario-encomenda.tsx); a última linha não
// pode ser removida — o botão de remover fica `disabled` quando só resta um item. Nenhuma
// biblioteca de arrastar-e-soltar entra no projeto (D-16).
export function ListaItens({ modoEdicao }: ListaItensProps) {
  const { control, register, formState, setFocus } = useFormContext<ValoresDoFormulario>();
  const { fields, append, remove, move } = useFieldArray({ control, name: "itens" });
  const [indicePendente, setIndicePendente] = useState<number | null>(null);

  // `fields` (de `useFieldArray`) só reflete os valores de QUANDO a linha nasceu (append/move) —
  // nunca o que foi digitado depois, porque os campos são registrados via `register()`
  // (não controlados). O `aria-label` das setas/remover precisa da descrição AO VIVO
  // (03-UI-SPEC.md: "Mover {descrição} para cima"), então lê de `useWatch`, não de `fields`.
  const itensAoVivo = useWatch({ control, name: "itens" });

  async function moverItem(indice: number, direcao: "cima" | "baixo") {
    const vizinho = direcao === "cima" ? indice - 1 : indice + 1;
    if (vizinho < 0 || vizinho >= fields.length) {
      return;
    }

    const itemAtual = fields[indice];
    const itemVizinho = fields[vizinho];

    if (modoEdicao && itemAtual.idDoBanco && itemVizinho.idDoBanco) {
      setIndicePendente(indice);
      const resposta = await reordenarItemEncomenda({
        itemId: itemAtual.idDoBanco,
        direcao,
      });
      setIndicePendente(null);

      if (!resposta.ok) {
        // A ordem na tela não mudou ainda (só muda abaixo, em `move`) — nada a reverter além de
        // avisar (03-UI-SPEC.md "Reordenação de itens").
        toast.error(FRASE_FALHA_AO_SALVAR);
        return;
      }
    }

    move(indice, vizinho);
  }

  function adicionarItem() {
    const novoIndice = fields.length;
    append({ descricao: "", quantidade: 1 });
    // Foco na descrição da nova linha — próximo tick, depois de o DOM ganhar a linha nova.
    window.setTimeout(() => setFocus(`itens.${novoIndice}.descricao`), 0);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-micro text-tinta-media uppercase tracking-wide">Itens</span>
        <button
          type="button"
          onClick={adicionarItem}
          className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
        >
          Adicionar item
        </button>
      </div>

      <ul className="flex flex-col gap-3" data-testid="lista-itens">
        {fields.map((field, indice) => {
          const erroDescricao = formState.errors.itens?.[indice]?.descricao;
          const somenteUmItem = fields.length === 1;
          const pendente = indicePendente === indice;
          const descricaoAtual = itensAoVivo?.[indice]?.descricao?.trim() || `item ${indice + 1}`;

          return (
            <li
              key={field.id}
              className="border-border flex items-start gap-2 rounded-md border p-3"
              data-testid={`item-linha-${indice}`}
            >
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <Field className="flex-1" data-invalid={!!erroDescricao}>
                  <Label htmlFor={`item-descricao-${indice}`} className="sr-only">
                    Descrição do item {indice + 1}
                  </Label>
                  <Input
                    id={`item-descricao-${indice}`}
                    className="text-corpo md:text-corpo min-h-[44px] break-words"
                    {...register(`itens.${indice}.descricao`)}
                  />
                  <FieldError errors={erroDescricao ? [erroDescricao] : undefined} />
                </Field>

                <Field className="w-full sm:w-28">
                  <Label htmlFor={`item-quantidade-${indice}`} className="sr-only">
                    Quantidade do item {indice + 1}
                  </Label>
                  <Input
                    id={`item-quantidade-${indice}`}
                    type="number"
                    min={1}
                    step={1}
                    className="text-corpo md:text-corpo min-h-[44px]"
                    {...register(`itens.${indice}.quantidade`, { valueAsNumber: true })}
                  />
                </Field>
              </div>

              <div className="flex shrink-0 flex-col gap-1" data-pendente={pendente}>
                <button
                  type="button"
                  aria-label={`Mover ${descricaoAtual} para cima`}
                  disabled={indice === 0 || pendente}
                  onClick={() => void moverItem(indice, "cima")}
                  className="flex items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ width: 44, height: 44 }}
                >
                  <ChevronUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${descricaoAtual} para baixo`}
                  disabled={indice === fields.length - 1 || pendente}
                  onClick={() => void moverItem(indice, "baixo")}
                  className="flex items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ width: 44, height: 44 }}
                >
                  <ChevronDown className="size-4" aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                aria-label={`Remover ${descricaoAtual}`}
                disabled={somenteUmItem}
                onClick={() => remove(indice)}
                className="flex shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
                style={{ width: 44, height: 44 }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
