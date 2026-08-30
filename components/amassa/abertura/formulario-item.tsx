"use client";

import { memo, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { atualizarItemDeAbertura, criarItemDeAbertura } from "@/lib/abertura/acoes";
import type { ItemDaAbertura } from "@/lib/abertura/consultas";
import { esquemaItemBase } from "@/lib/abertura/esquemas";
import {
  ORDEM_DAS_CATEGORIAS,
  ROTULO_CATEGORIA,
  ROTULO_SALVAR_ALTERACOES,
  ROTULO_SALVAR_ITEM,
} from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
import { useItemAberto, useRouterAbertura } from "@/components/amassa/abertura/contexto-navegacao";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Segundo caminho de escrita: o `zodResolver` no navegador é conveniência, nunca a verdade
// (CLAUDE.md §Validação) — `criarItemDeAbertura` revalida no servidor com
// `esquemaItemDeAbertura`. Reaproveita os campos de `esquemaItemBase.shape` (mesma regra do
// servidor), nunca uma segunda cópia. `entregaPrevistaEm` fica como texto simples aqui — a
// normalização para `null` que o schema do servidor faz só importa no momento de gravar.
const esquemaFormulario = z
  .object({
    nome: esquemaItemBase.shape.nome,
    categoria: esquemaItemBase.shape.categoria,
    valorEmReais: esquemaItemBase.shape.valorEmReais,
    formaPagamento: esquemaItemBase.shape.formaPagamento,
    parcelas: z.number().int("O número de parcelas precisa ser inteiro.").min(1),
    primeiraParcelaEm: esquemaItemBase.shape.primeiraParcelaEm,
    entregaPrevistaEm: z.string(),
  })
  .refine((dados) => dados.formaPagamento !== "vista" || dados.parcelas === 1, {
    message: "Um item à vista tem exatamente 1 parcela.",
    path: ["parcelas"],
  })
  .refine(
    (dados) => dados.formaPagamento !== "prazo" || (dados.parcelas >= 2 && dados.parcelas <= 36),
    { message: "Um item a prazo precisa de 2 a 36 parcelas.", path: ["parcelas"] },
  );

type ValoresDoFormulario = z.infer<typeof esquemaFormulario>;

// `components/ui/input.tsx` tem `md:text-sm` embutido (14px) — repetir `text-corpo` no
// breakpoint `md` explicitamente é o que mantém o campo em 16px também no desktop (regra do
// zoom do iOS, CLAUDE.md §Acessibilidade), mesma classe de `formulario-forno.tsx`.
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

export type FormularioItemProps = {
  // O dia civil de Brasília, calculado UMA VEZ na borda (`app/(app)/abertura/page.tsx`) — o
  // formulário nunca lê o relógio por conta própria, só usa este valor como padrão do campo de
  // data quando o item nasce.
  hoje: string;
  // D-18/ABE-11 (Tarefa 2, 04.2-03-PLAN.md): não nulo abre o formulário JÁ PREENCHIDO em modo de
  // edição — buscado no SERVIDOR (`obterItemDeAbertura`, `app/(app)/abertura/page.tsx`) a partir
  // de `?item=<id>`. `null` com `?item=novo` na URL é criação; `null` com um identificador que
  // não corresponde a NENHUMA linha também abre vazio, em vez de quebrar a página.
  itemParaEditar: ItemDaAbertura | null;
};

function valoresIniciais(hoje: string, itemParaEditar: ItemDaAbertura | null): ValoresDoFormulario {
  if (itemParaEditar) {
    return {
      nome: itemParaEditar.nome,
      categoria: itemParaEditar.categoria,
      // `valorEmCentavos` só existe como múltiplo de 100 (o campo do formulário só aceita reais
      // inteiros, `esquemaItemBase.valorEmReais`) — a divisão nunca produz fração aqui.
      valorEmReais: itemParaEditar.valorEmCentavos / 100,
      formaPagamento: itemParaEditar.formaPagamento,
      parcelas: itemParaEditar.parcelas,
      primeiraParcelaEm: itemParaEditar.primeiraParcelaEm,
      entregaPrevistaEm: itemParaEditar.entregaPrevistaEm ?? "",
    };
  }

  return {
    nome: "",
    categoria: ORDEM_DAS_CATEGORIAS[0],
    valorEmReais: 0,
    formaPagamento: "vista",
    parcelas: 1,
    primeiraParcelaEm: hoje,
    entregaPrevistaEm: "",
  };
}

// Único formulário para criar E editar (D-18) — título e rótulo do botão trocam, o resto do
// código é literalmente o mesmo. Aberto por `?item=novo` (criação) OU `?item=<id>` (edição,
// existente ou não — um identificador que não bate com nenhuma linha abre vazio) na própria
// rota `/abertura` — montado SEMPRE (mesmo com a lista vazia), para o botão do `EstadoVazio`
// abrir o formulário do primeiríssimo item (achado do 03-06, replicado em Queimas e aqui).
//
// `memo()`: ver data-inauguracao.tsx e .planning/debug/abertura-navegacao-trava.md — sem ele,
// este componente (o mais caro da tela, com `useForm`/`zodResolver`) re-renderizaria em TODA
// navegação de /abertura, mesmo abrindo `?tarefa=nova` (nada aqui muda). `itemParaEditar` (prop
// do servidor) é `null` em toda navegação exceto `?item=<id existente>`, então a comparação rasa
// do `memo` funciona sem gambiarra.
function FormularioItemBase({ hoje, itemParaEditar }: FormularioItemProps) {
  const router = useRouterAbertura();
  // Contexto próprio de `?item=` (nunca o objeto agregado) — a presença do parâmetro (qualquer
  // valor) já abre o diálogo; o MODO (criar vs. editar) só depende de `itemParaEditar` ter
  // resolvido uma linha de verdade no servidor.
  const aberto = useItemAberto();
  const modoEdicao = itemParaEditar !== null;

  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ValoresDoFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: valoresIniciais(hoje, itemParaEditar),
  });

  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(hoje, itemParaEditar));
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, itemParaEditar]);

  function fechar() {
    setErro(null);
    router.push("/abertura");
  }

  const formaPagamento = form.watch("formaPagamento");
  const aPrazo = formaPagamento === "prazo";

  async function aoSubmeter(valores: ValoresDoFormulario) {
    setErro(null);

    const dados = {
      nome: valores.nome,
      categoria: valores.categoria,
      valorEmReais: valores.valorEmReais,
      formaPagamento: valores.formaPagamento,
      // À vista sempre grava 1 parcela — o campo "Em quantas vezes" nem aparece nesse caso
      // (D-05/D-06), então o valor do formulário pode ter sobrado de uma troca anterior.
      parcelas: valores.formaPagamento === "vista" ? 1 : valores.parcelas,
      primeiraParcelaEm: valores.primeiraParcelaEm,
      entregaPrevistaEm: valores.entregaPrevistaEm,
    };

    // Atualizar é SEMPRE `update` da linha existente (D-18) — nunca apagar e recriar, o que
    // soltaria as tarefas ligadas a este item.
    const resposta = modoEdicao
      ? await atualizarItemDeAbertura({ id: itemParaEditar.id, ...dados })
      : await criarItemDeAbertura(dados);

    if (!resposta.ok) {
      // Banner inline, formulário continua aberto — nada do que foi digitado se perde.
      setErro(resposta.erro);
      return;
    }

    toast.success(modoEdicao ? "Item atualizado." : "Item adicionado.");
    router.push("/abertura");
    router.refresh();
  }

  const { register, control, formState } = form;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        showCloseButton
        aria-label={modoEdicao ? "Editar item" : "Novo item"}
        className={cn(
          // Celular (base, mobile-first): folha de baixo, tela toda.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
        )}
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-display">
            {modoEdicao ? "Editar item" : "Novo item"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => {
            void form.handleSubmit(aoSubmeter)(evento);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
            {erro && (
              <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
                {erro}
              </p>
            )}

            <Field data-invalid={!!formState.errors.nome}>
              <FieldLabel htmlFor="nome">O que é</FieldLabel>
              <Input
                id="nome"
                placeholder="Bancada de trabalho"
                className={CLASSE_DO_CAMPO}
                {...register("nome")}
              />
              <FieldError errors={formState.errors.nome ? [formState.errors.nome] : undefined} />
            </Field>

            <Field data-invalid={!!formState.errors.categoria}>
              <FieldLabel htmlFor="categoria">Categoria</FieldLabel>
              <Controller
                control={control}
                name="categoria"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="categoria"
                      aria-label="Categoria"
                      className="min-h-[44px] w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEM_DAS_CATEGORIAS.map((categoria) => (
                        <SelectItem key={categoria} value={categoria}>
                          {ROTULO_CATEGORIA[categoria]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError
                errors={formState.errors.categoria ? [formState.errors.categoria] : undefined}
              />
            </Field>

            <Field data-invalid={!!formState.errors.valorEmReais}>
              <FieldLabel htmlFor="valorEmReais">Valor total</FieldLabel>
              <Input
                id="valorEmReais"
                type="number"
                min={0}
                step={1}
                placeholder="4800"
                className={CLASSE_DO_CAMPO}
                {...register("valorEmReais", { valueAsNumber: true })}
              />
              <FieldError
                errors={
                  formState.errors.valorEmReais ? [formState.errors.valorEmReais] : undefined
                }
              />
            </Field>

            <Field data-invalid={!!formState.errors.formaPagamento}>
              <FieldLabel htmlFor="formaPagamento">Pagamento</FieldLabel>
              <Controller
                control={control}
                name="formaPagamento"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(valor: "vista" | "prazo") => {
                      field.onChange(valor);
                      if (valor === "prazo" && form.getValues("parcelas") < 2) {
                        form.setValue("parcelas", 3);
                      }
                      if (valor === "vista") {
                        form.setValue("parcelas", 1);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="formaPagamento"
                      aria-label="Pagamento"
                      className="min-h-[44px] w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vista">À vista</SelectItem>
                      <SelectItem value="prazo">A prazo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {/* Só aparece a prazo (D-05/D-06) — à vista tem exatamente 1 parcela e nem mostra o
                campo, mesmo comportamento do protótipo. */}
            {aPrazo && (
              <Field data-invalid={!!formState.errors.parcelas}>
                <FieldLabel htmlFor="parcelas">Em quantas vezes</FieldLabel>
                <Input
                  id="parcelas"
                  type="number"
                  min={2}
                  max={36}
                  step={1}
                  className={CLASSE_DO_CAMPO}
                  {...register("parcelas", { valueAsNumber: true })}
                />
                <FieldError
                  errors={formState.errors.parcelas ? [formState.errors.parcelas] : undefined}
                />
              </Field>
            )}

            <Field data-invalid={!!formState.errors.primeiraParcelaEm}>
              {/* O rótulo troca conforme a forma de pagamento, igual ao protótipo. */}
              <FieldLabel htmlFor="primeiraParcelaEm">
                {aPrazo ? "Primeira parcela" : "Quando paga"}
              </FieldLabel>
              <Input
                id="primeiraParcelaEm"
                type="date"
                className={CLASSE_DO_CAMPO}
                {...register("primeiraParcelaEm")}
              />
              <FieldError
                errors={
                  formState.errors.primeiraParcelaEm
                    ? [formState.errors.primeiraParcelaEm]
                    : undefined
                }
              />
            </Field>

            <Field data-invalid={!!formState.errors.entregaPrevistaEm}>
              <FieldLabel htmlFor="entregaPrevistaEm">
                Chega em <span className="normal-case font-normal">(opcional)</span>
              </FieldLabel>
              <Input
                id="entregaPrevistaEm"
                type="date"
                className={CLASSE_DO_CAMPO}
                {...register("entregaPrevistaEm")}
              />
              <FieldError
                errors={
                  formState.errors.entregaPrevistaEm
                    ? [formState.errors.entregaPrevistaEm]
                    : undefined
                }
              />
            </Field>

            {/* A dica troca conforme a forma de pagamento, verbatim do protótipo. */}
            <p className="text-apoio text-muted-foreground">
              {aPrazo
                ? "As demais parcelas caem no mesmo dia dos meses seguintes. Deixe a entrega em branco se não houver."
                : "Deixe a entrega em branco se for algo que você leva na hora."}
            </p>
          </div>

          {/* Rodape preso ao pe do dialogo por FLEX, nunca por `position: sticky` (G-03-1).
              Este div e IRMAO da area de campos rolavel, nao filho dela: sem scrollport
              proprio, o `bottom: 0` se ancorava no pe da JANELA e, no desktop, subia o
              rodape para o meio da tela (medido: 280px a 1280x800, identico ao modelo de
              .planning/debug/resolved/rodape-formulario-desktop.md). O `flex-1` do form ja
              prende este rodape ao pe do dialogo sozinho, nos dois tamanhos de tela. */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={fechar}
                className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formState.isSubmitting}
                aria-busy={formState.isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formState.isSubmitting
                  ? "Salvando…"
                  : modoEdicao
                    ? ROTULO_SALVAR_ALTERACOES
                    : ROTULO_SALVAR_ITEM}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Comparador PRÓPRIO explícito (nunca o padrão do `memo` — achado quantitativo de
// .planning/debug/abertura-navegacao-trava.md: o comparador padrão não bastou para pular o
// re-render nesta árvore mesmo com props idênticas; um comparador explícito, ainda que
// semanticamente igual, bastou). Relevante quando `?tarefa=nova`/`?aba=`/etc. mudam e ESTE
// diálogo continua fechado.
function propsIguais(anterior: FormularioItemProps, atual: FormularioItemProps): boolean {
  return anterior.hoje === atual.hoje && anterior.itemParaEditar === atual.itemParaEditar;
}

export const FormularioItem = memo(FormularioItemBase, propsIguais);
