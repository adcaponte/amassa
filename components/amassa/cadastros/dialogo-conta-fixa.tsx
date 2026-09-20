"use client";

import { useEffect, useRef, useState } from "react";

import { criarContaFixa } from "@/lib/cadastros/acoes";
import type { CategoriaParaContaFixa } from "@/lib/cadastros/consultas";
import {
  ROTULO_CANCELAR,
  ROTULO_CATEGORIA_DA_CONTA_FIXA,
  ROTULO_DIA_VENCIMENTO,
  ROTULO_GRUPO,
  ROTULO_NOME,
  ROTULO_SALVAR,
  ROTULO_VALOR_ESPERADO,
  TITULO_DIALOGO_NOVA_CONTA_FIXA,
} from "@/lib/cadastros/textos";
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

export type DialogoContaFixaProps = {
  aberto: boolean;
  // "Nova conta fixa" só CRIA (04.4-UI-SPEC.md) — sem modo de edição do registro inteiro; o valor
  // esperado é editado direto na linha (`ValorContaFixa`), nunca por este diálogo.
  categorias: CategoriaParaContaFixa[];
  onFechar: () => void;
};

// A ordem fixa dos três grupos que "Nova conta fixa" aceita (`geral`, `custo`, `fora` — must_have
// do plano), usada só para agrupar o `<select>` em `optgroup`; `receita` nunca aparece aqui.
const GRUPOS_DE_CONTA_FIXA = ["geral", "custo", "fora"] as const;

// Diálogo único de criação (mesmo molde de `DialogoCategoria`, mas sem modo de edição): nome,
// categoria (agrupada por Geral / Custos diretos de uma área / Fora do resultado), valor esperado
// e dia de vencimento. Estado local simples (sem URL/history) — UI-SPEC não exige um link
// compartilhável para "abrir o diálogo de nova conta fixa".
export function DialogoContaFixa({ aberto, categorias, onFechar }: DialogoContaFixaProps) {
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [diaTexto, setDiaTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setNome("");
      setCategoriaId("");
      setValorTexto("");
      setDiaTexto("");
      setErro(null);
      const idDoTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(idDoTimer);
    }
  }, [aberto]);

  const gruposComCategorias = GRUPOS_DE_CONTA_FIXA.map((grupo) => ({
    grupo,
    itens: categorias.filter((categoria) => categoria.grupo === grupo),
  })).filter((bloco) => bloco.itens.length > 0);

  async function salvar() {
    if (enviando) {
      return;
    }
    setErro(null);
    setEnviando(true);

    const resposta = await criarContaFixa({
      nome,
      categoriaId,
      valorTexto,
      diaVencimento: Number(diaTexto),
    });

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA, nunca um hook de roteador do Next (04.4-UI-SPEC.md): só o servidor
    // sabe a lista atualizada de contas fixas.
    window.location.assign("/cadastros?sub=fixas");
  }

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && onFechar()}>
      <DialogContent aria-label={TITULO_DIALOGO_NOVA_CONTA_FIXA} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-titulo">{TITULO_DIALOGO_NOVA_CONTA_FIXA}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
          className="flex flex-col gap-4"
        >
          {erro && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erro}
            </p>
          )}

          <Field data-invalid={!!erro}>
            <FieldLabel htmlFor="nome-conta-fixa">{ROTULO_NOME}</FieldLabel>
            <Input
              id="nome-conta-fixa"
              ref={inputRef}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="categoria-conta-fixa">{ROTULO_CATEGORIA_DA_CONTA_FIXA}</FieldLabel>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger
                id="categoria-conta-fixa"
                aria-label={ROTULO_CATEGORIA_DA_CONTA_FIXA}
                className="min-h-[44px] w-full"
              >
                <SelectValue placeholder="Escolha uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {gruposComCategorias.map((bloco) => (
                  <SelectGroup key={bloco.grupo}>
                    <SelectLabel>{ROTULO_GRUPO[bloco.grupo]}</SelectLabel>
                    {bloco.itens.map((categoria) => (
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
            <FieldLabel htmlFor="valor-nova-conta-fixa">{ROTULO_VALOR_ESPERADO}</FieldLabel>
            <Input
              id="valor-nova-conta-fixa"
              inputMode="decimal"
              value={valorTexto}
              onChange={(evento) => setValorTexto(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="dia-conta-fixa">{ROTULO_DIA_VENCIMENTO}</FieldLabel>
            <Input
              id="dia-conta-fixa"
              inputMode="numeric"
              value={diaTexto}
              onChange={(evento) => setDiaTexto(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

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
              disabled={enviando}
              aria-busy={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Salvando…" : ROTULO_SALVAR}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
