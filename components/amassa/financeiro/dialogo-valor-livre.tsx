"use client";

import { useEffect, useRef, useState } from "react";

import type { CategoriaParaEscolha } from "@/lib/financeiro/consultas";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import {
  PLACEHOLDER_DESCRICAO_VALOR_LIVRE,
  ROTULO_CATEGORIA,
  ROTULO_GRUPO,
  ROTULO_O_QUE_E,
  ROTULO_POR_NA_VENDA,
  ROTULO_VALOR,
  TITULO_DIALOGO_VALOR_LIVRE,
} from "@/lib/financeiro/textos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LinhaDeValorLivre = {
  descricao: string;
  categoriaId: string;
  // "geral" para categorias do grupo `fora` (a área nunca aparece na tela para essas — a linha
  // usa a cor de área "geral" no carrinho, mesma convenção do restante do módulo).
  area: string;
  valorCentavos: number;
};

export type DialogoValorLivreProps = {
  aberto: boolean;
  categorias: CategoriaParaEscolha[];
  aoFechar: () => void;
  aoConfirmar: (linha: LinhaDeValorLivre) => void;
};

// Diálogo ÚNICO responsivo por CSS (nunca `Dialog`+`Sheet` simultâneos), aberto por ESTADO LOCAL
// do painel de venda (não por `?query=`, ao contrário dos diálogos de Abertura/Comparador) —
// 04.4-01-PLAN.md, Tarefa 1. Categorias de receita agrupadas por área (04.4-UI-SPEC.md).
export function DialogoValorLivre({
  aberto,
  categorias,
  aoFechar,
  aoConfirmar,
}: DialogoValorLivreProps) {
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [valorTexto, setValorTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const primeiroCampoRef = useRef<HTMLInputElement>(null);

  // Auto-foco no primeiro campo ao abrir (mesmo padrão de `dialogo-categoria.tsx`) — também
  // limpa o formulário a cada abertura, para uma segunda venda livre não herdar o texto da
  // anterior.
  useEffect(() => {
    if (!aberto) {
      return;
    }
    setDescricao("");
    setCategoriaId(categorias[0]?.id ?? "");
    setValorTexto("");
    setErro(null);
    const identificador = window.setTimeout(() => primeiroCampoRef.current?.focus(), 0);
    return () => window.clearTimeout(identificador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Agrupado por GRUPO (Receitas · Fora do resultado), não por área — "Fora" é sempre área
  // "geral" (categorias_grupo_area_coerente), agrupar por área juntaria as duas debaixo do mesmo
  // rótulo "Geral" e escondería a distinção que a suposição 1 do plano 03 existe para mostrar.
  const categoriasPorGrupo = new Map<string, CategoriaParaEscolha[]>();
  for (const categoria of categorias) {
    const lista = categoriasPorGrupo.get(categoria.grupo) ?? [];
    lista.push(categoria);
    categoriasPorGrupo.set(categoria.grupo, lista);
  }

  function confirmar() {
    const descricaoNormalizada = descricao.trim();
    if (descricaoNormalizada === "") {
      setErro("Dê uma descrição para esta venda.");
      return;
    }
    const categoria = categorias.find((atual) => atual.id === categoriaId);
    if (!categoria) {
      setErro("Escolha uma categoria.");
      return;
    }
    const resultado = converterReaisParaCentavos(valorTexto);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    if (resultado.centavos === null || resultado.centavos <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }

    aoConfirmar({
      descricao: descricaoNormalizada,
      categoriaId: categoria.id,
      area: categoria.area,
      valorCentavos: resultado.centavos,
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && aoFechar()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[85svh] w-full max-w-lg flex-col gap-0 p-0"
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-display">{TITULO_DIALOGO_VALOR_LIVRE}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {erro && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erro}
            </p>
          )}

          <Field>
            <FieldLabel htmlFor="valor-livre-descricao">{ROTULO_O_QUE_E}</FieldLabel>
            <Input
              id="valor-livre-descricao"
              ref={primeiroCampoRef}
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder={PLACEHOLDER_DESCRICAO_VALOR_LIVRE}
              className="text-corpo min-h-[44px]"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="valor-livre-categoria">{ROTULO_CATEGORIA}</FieldLabel>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger
                id="valor-livre-categoria"
                aria-label={ROTULO_CATEGORIA}
                className="min-h-[44px] w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...categoriasPorGrupo.entries()].map(([grupo, categoriasDoGrupo]) => (
                  <SelectGroup key={grupo}>
                    <SelectLabel>{ROTULO_GRUPO[grupo as keyof typeof ROTULO_GRUPO]}</SelectLabel>
                    {categoriasDoGrupo.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="valor-livre-valor">{ROTULO_VALOR}</FieldLabel>
            <Input
              id="valor-livre-valor"
              inputMode="decimal"
              value={valorTexto}
              onChange={(evento) => setValorTexto(evento.target.value)}
              placeholder="R$"
              className="text-corpo min-h-[44px]"
            />
          </Field>
        </div>

        <div className="border-border bg-popover flex justify-end gap-3 border-t px-6 py-4">
          <Button type="button" variant="default" className="min-h-[44px]" onClick={confirmar}>
            {ROTULO_POR_NA_VENDA}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
