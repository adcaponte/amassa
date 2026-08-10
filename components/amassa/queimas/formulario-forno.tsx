"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { criarForno } from "@/lib/queimas/acoes";
import { esquemaForno } from "@/lib/queimas/esquemas";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// D-02: não existe tela de cadastro dedicada — este componente é o ÚNICO caminho de criação de
// forno, aberto por `?novo` (masculino — "novo forno", mesma convenção de `?nova` em
// Encomendas). Contêiner responsivo com um único `Dialog` do Radix (nunca `Dialog` + `Sheet`
// simultâneos — dois `Root` modais abertos ao mesmo tempo levam o próprio Radix a marcar ambos
// `aria-hidden`, achado real do 03-06/`formulario-encomenda.tsx`): folha de baixo no celular,
// modal centralizado no desktop, resolvido só por classe CSS no breakpoint `md`.
// Reaproveita `nome` (mesma regra do servidor, via `.shape`) — nunca uma segunda cópia da regra,
// mesmo padrão de `formulario-encomenda.tsx` (D-15). `descricao` fica como texto simples aqui; a
// normalização para `null` que `esquemaForno` faz só importa no momento de gravar, no servidor.
// `limite` não reaproveita `esquemaForno.shape.limite` diretamente: o `.default(100)` do
// servidor tornaria o campo opcional no tipo inferido do formulário, que sempre envia um número
// (o campo nasce preenchido com 100) — mesma mensagem de erro, sem o `.default`.
const esquemaFormulario = z.object({
  nome: esquemaForno.shape.nome,
  descricao: z.string(),
  limite: z
    .number()
    .int("O limite precisa ser um número inteiro.")
    .min(10, "O limite de um forno não pode ser menor que 10."),
});

type ValoresDoFormulario = z.infer<typeof esquemaFormulario>;

const VALORES_INICIAIS: ValoresDoFormulario = { nome: "", descricao: "", limite: 100 };

// `components/ui/input.tsx` tem `md:text-sm` embutido (14px) — repetir `text-corpo` no
// breakpoint `md` explicitamente é o que mantém o campo em 16px também no desktop (regra do
// zoom do iOS, CLAUDE.md §Acessibilidade), mesma classe de `formulario-encomenda.tsx`.
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

export function FormularioForno() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aberto = searchParams.has("novo");

  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ValoresDoFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: VALORES_INICIAIS,
  });

  useEffect(() => {
    if (aberto) {
      form.reset(VALORES_INICIAIS);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function fechar() {
    setErro(null);
    router.push("/queimas");
  }

  async function aoSubmeter(valores: ValoresDoFormulario) {
    setErro(null);

    const resposta = await criarForno({
      nome: valores.nome,
      descricao: valores.descricao,
      limite: valores.limite,
    });

    if (!resposta.ok) {
      // Banner inline, formulário continua aberto — nada do que foi digitado se perde.
      setErro(resposta.erro);
      return;
    }

    toast.success("Forno cadastrado.");
    router.push("/queimas");
    router.refresh();
  }

  const { register, formState } = form;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        showCloseButton
        aria-label="Novo forno"
        className={cn(
          // Celular (base, mobile-first): folha de baixo, tela toda.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
        )}
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-display">Novo forno</DialogTitle>
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
              <FieldLabel htmlFor="nome">Nome</FieldLabel>
              <Input id="nome" className={CLASSE_DO_CAMPO} {...register("nome")} />
              <FieldError errors={formState.errors.nome ? [formState.errors.nome] : undefined} />
            </Field>

            <Field data-invalid={!!formState.errors.descricao}>
              <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
              <Input id="descricao" className={CLASSE_DO_CAMPO} {...register("descricao")} />
              <FieldError
                errors={formState.errors.descricao ? [formState.errors.descricao] : undefined}
              />
            </Field>

            <Field data-invalid={!!formState.errors.limite}>
              <FieldLabel htmlFor="limite">Limite</FieldLabel>
              <Input
                id="limite"
                type="number"
                min={10}
                step={1}
                className={CLASSE_DO_CAMPO}
                {...register("limite", { valueAsNumber: true })}
              />
              <FieldError
                errors={formState.errors.limite ? [formState.errors.limite] : undefined}
              />
            </Field>
          </div>

          <div className="border-border bg-popover sticky bottom-0 flex flex-col gap-3 border-t px-6 py-4">
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
                {formState.isSubmitting ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
