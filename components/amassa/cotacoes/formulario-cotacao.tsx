"use client";

import { memo, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { criarCotacao } from "@/lib/cotacoes/acoes";
import type { Cotacao } from "@/lib/cotacoes/consultas";
import { esquemaCotacaoBase } from "@/lib/cotacoes/esquemas";
import {
  CAMPOS_LONGOS,
  ORDEM_DAS_SITUACOES,
  PLACEHOLDER_CAMPO_PRECO,
  ROTULO_CANCELAR,
  ROTULO_SALVAR_COTACAO,
  ROTULO_SITUACAO,
  TITULO_DIALOGO_EDITAR_COTACAO,
  TITULO_DIALOGO_NOVA_COTACAO,
} from "@/lib/cotacoes/textos";
import { cn } from "@/lib/utils";
import {
  useCotacaoAberta,
  useCotacaoParaEditarLocal,
} from "@/components/amassa/cotacoes/contexto-cotacoes";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Segundo caminho de escrita: o `zodResolver` no navegador é conveniência, nunca a verdade
// (CLAUDE.md §Validação) — `criarCotacao` revalida no servidor com `esquemaCotacao`, que é quem
// converte o texto do preço em centavos. Reaproveita `esquemaCotacaoBase.shape` campo a campo,
// nunca uma segunda cópia da regra — `preco` fica como TEXTO aqui, exatamente o formato que o
// campo produz.
// `produto` e os seis campos longos são `.optional()` no esquema do servidor (o texto ausente
// vira `""`, D-06) — o campo do formulário, porém, sempre existe e nunca é `undefined` (o
// `register` do react-hook-form garante isso). Reaproveitar o pedaço `.optional().transform(...)`
// aqui criaria um descompasso de tipo entre entrada e saída do resolvedor; por isso, para estes
// campos, o formulário usa `z.string()` simples — a normalização e o teto de comprimento
// continuam vindo do servidor (`esquemaCotacao`), a única verdade (CLAUDE.md §Validação). Mesmo
// precedente de `entregaPrevistaEm` em `formulario-item.tsx`.
const esquemaFormulario = z.object({
  empresa: esquemaCotacaoBase.shape.empresa,
  produto: z.string(),
  preco: esquemaCotacaoBase.shape.preco,
  situacao: esquemaCotacaoBase.shape.situacao,
  diferenciais: z.string(),
  assistencia: z.string(),
  pagamento: z.string(),
  contato: z.string(),
  observacoes: z.string(),
  alertas: z.string(),
});

type ValoresDoFormulario = z.infer<typeof esquemaFormulario>;

// `components/ui/input.tsx` tem `md:text-sm` embutido (14px) — repetir `text-corpo` no `md:`
// explicitamente mantém o campo em 16px também no desktop (regra do zoom do iOS), mesma classe
// de `formulario-item.tsx`.
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

export type FormularioCotacaoProps = {
  // A categoria ativa da aba — é para dentro dela que uma cotação NOVA nasce.
  categoriaId: string;
  // Não nulo abre o formulário JÁ PREENCHIDO em modo de edição. A edição de verdade (Server
  // Action de atualização) chega num plano seguinte desta fase — esta fatia só grava criação,
  // mas a forma do componente já é a única, para nunca existir dois lugares dizendo o que é uma
  // cotação válida.
  cotacaoParaEditar: Cotacao | null;
};

function valoresIniciais(cotacaoParaEditar: Cotacao | null): ValoresDoFormulario {
  if (cotacaoParaEditar) {
    return {
      empresa: cotacaoParaEditar.empresa,
      produto: cotacaoParaEditar.produto,
      preco:
        cotacaoParaEditar.precoCentavos === null
          ? ""
          : (cotacaoParaEditar.precoCentavos / 100).toString(),
      situacao: cotacaoParaEditar.situacao,
      diferenciais: cotacaoParaEditar.diferenciais,
      assistencia: cotacaoParaEditar.assistencia,
      pagamento: cotacaoParaEditar.pagamento,
      contato: cotacaoParaEditar.contato,
      observacoes: cotacaoParaEditar.observacoes,
      alertas: cotacaoParaEditar.alertas,
    };
  }

  return {
    empresa: "",
    produto: "",
    preco: "",
    situacao: "cotando",
    diferenciais: "",
    assistencia: "",
    pagamento: "",
    contato: "",
    observacoes: "",
    alertas: "",
  };
}

// Único formulário para criar E (no futuro) editar — montado SEMPRE, mesmo com a lista vazia,
// para o botão do estado vazio abrir o formulário da primeiríssima cotação (achado do 03-06,
// replicado em toda esta base). `memo()` com comparador próprio: ver `formulario-item.tsx` e
// `.planning/debug/abertura-navegacao-trava.md` — sem ele, o formulário (o Client Component mais
// caro da tela) re-renderizaria em toda navegação de `/abertura`, mesmo abrindo
// `?categoriaDialogo=nova` (nada aqui muda).
function FormularioCotacaoBase({
  categoriaId,
  cotacaoParaEditar: cotacaoDoServidor,
}: FormularioCotacaoProps) {
  // O local vence enquanto existir — garante o modo de EDIÇÃO mesmo se a navegação para
  // `?cotacao=<id>` não confirmar (mesma disciplina de `formulario-item.tsx`).
  const cotacaoLocal = useCotacaoParaEditarLocal();
  const cotacaoParaEditar = cotacaoLocal ?? cotacaoDoServidor;
  const aberto = useCotacaoAberta() !== null;
  const modoEdicao = cotacaoParaEditar !== null;

  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ValoresDoFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: valoresIniciais(cotacaoParaEditar),
  });

  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(cotacaoParaEditar));
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, cotacaoParaEditar]);

  // Devolve a URL de onde o diálogo foi aberto, só removendo `?cotacao=` — nunca uma URL fixa,
  // que perderia a categoria selecionada.
  function fechar() {
    setErro(null);
    const parametros = new URLSearchParams(window.location.search);
    parametros.delete("cotacao");
    const query = parametros.toString();
    irParaSemNavegar(`/abertura${query ? `?${query}` : ""}`);
  }

  async function aoSubmeter(valores: ValoresDoFormulario) {
    setErro(null);

    // Edição de verdade (`atualizarCotacao`) chega num plano seguinte — nesta fatia só existe
    // criação.
    const resposta = await criarCotacao({ categoriaId, ...valores });

    if (!resposta.ok) {
      // Banner inline, diálogo continua aberto — nada do que foi digitado se perde.
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA de propósito (D-23), nunca `router.push` + `router.refresh()`: a lista
    // precisa refletir o que só o servidor sabe (o identificador que a cotação nova recebeu).
    // Sem `toast` de sucesso: ele não sobrevive à navegação completa — a própria lista já
    // atualizada é a confirmação (divergência deliberada das linhas de aviso do §Copywriting
    // Contract do UI-SPEC, justificada por D-23 e pelo precedente de `formulario-item.tsx`).
    window.location.assign(`/abertura?aba=cotacoes&categoria=${resposta.dados.categoriaId}`);
  }

  const { register, control, formState } = form;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        showCloseButton
        aria-label={modoEdicao ? TITULO_DIALOGO_EDITAR_COTACAO : TITULO_DIALOGO_NOVA_COTACAO}
        className={cn(
          // Celular (base, mobile-first): folha de baixo, tela toda.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
        )}
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-titulo">
            {modoEdicao ? TITULO_DIALOGO_EDITAR_COTACAO : TITULO_DIALOGO_NOVA_COTACAO}
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

            <Field data-invalid={!!formState.errors.empresa}>
              <FieldLabel htmlFor="empresa">Empresa</FieldLabel>
              <Input
                id="empresa"
                placeholder="Nome do fornecedor"
                className={CLASSE_DO_CAMPO}
                {...register("empresa")}
              />
              <FieldError errors={formState.errors.empresa ? [formState.errors.empresa] : undefined} />
            </Field>

            <Field data-invalid={!!formState.errors.produto}>
              <FieldLabel htmlFor="produto">Especificação do produto</FieldLabel>
              <Input
                id="produto"
                placeholder="Ex.: JC 0613 · 180 L · 1300 °C"
                className={CLASSE_DO_CAMPO}
                {...register("produto")}
              />
              <FieldError errors={formState.errors.produto ? [formState.errors.produto] : undefined} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!formState.errors.preco}>
                <FieldLabel htmlFor="preco">Preço</FieldLabel>
                <Input
                  id="preco"
                  type="text"
                  placeholder={PLACEHOLDER_CAMPO_PRECO}
                  className={CLASSE_DO_CAMPO}
                  {...register("preco")}
                />
                <FieldError errors={formState.errors.preco ? [formState.errors.preco] : undefined} />
              </Field>

              <div className="flex flex-col gap-1.5">
                <span id="rotulo-situacao" className="text-corpo font-semibold">
                  Situação
                </span>
                {/* Três botões de alternância com `aria-pressed` — o ÚNICO lugar onde a situação
                    muda (D-23/UI-SPEC: não existe seletor rápido fora do formulário). */}
                <Controller
                  control={control}
                  name="situacao"
                  render={({ field }) => (
                    <div role="group" aria-labelledby="rotulo-situacao" className="flex flex-wrap gap-2">
                      {ORDEM_DAS_SITUACOES.map((situacao) => (
                        <button
                          key={situacao}
                          type="button"
                          aria-pressed={field.value === situacao}
                          onClick={() => field.onChange(situacao)}
                          className={cn(
                            "border-border text-corpo flex min-h-[44px] items-center rounded-md border px-3 font-medium capitalize",
                            field.value === situacao
                              ? "border-acento bg-acento-fundo text-acento"
                              : "bg-background hover:bg-muted",
                          )}
                        >
                          {ROTULO_SITUACAO[situacao]}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Os seis campos longos de D-06, rótulo e dica verbatim do protótipo. */}
            {CAMPOS_LONGOS.map((campo) => (
              <Field key={campo.id} data-invalid={!!formState.errors[campo.id]}>
                <FieldLabel htmlFor={campo.id}>
                  {campo.rotulo}
                  {campo.dica && (
                    <span className="text-apoio font-normal normal-case"> — {campo.dica}</span>
                  )}
                </FieldLabel>
                <Textarea
                  id={campo.id}
                  className="text-corpo md:text-corpo min-h-20"
                  {...register(campo.id)}
                />
                <FieldError
                  errors={formState.errors[campo.id] ? [formState.errors[campo.id]] : undefined}
                />
              </Field>
            ))}
          </div>

          {/* Rodapé preso ao pé do diálogo por FLEX, nunca por `position: sticky` (D-24) — irmão
              da área rolável, não filho dela (mesmo cuidado de `formulario-item.tsx`). */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={fechar}
                className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
              >
                {ROTULO_CANCELAR}
              </button>
              <button
                type="submit"
                disabled={formState.isSubmitting}
                aria-busy={formState.isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formState.isSubmitting ? "Salvando…" : ROTULO_SALVAR_COTACAO}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function propsIguais(anterior: FormularioCotacaoProps, atual: FormularioCotacaoProps): boolean {
  return (
    anterior.categoriaId === atual.categoriaId &&
    anterior.cotacaoParaEditar === atual.cotacaoParaEditar
  );
}

export const FormularioCotacao = memo(FormularioCotacaoBase, propsIguais);
