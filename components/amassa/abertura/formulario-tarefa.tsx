"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { criarTarefaDeAbertura } from "@/lib/abertura/acoes";
import type { GestorAtivo } from "@/lib/abertura/consultas";
import { esquemaTarefaBase } from "@/lib/abertura/esquemas";
import {
  ORDEM_DOS_GRUPOS,
  ROTULO_GRUPO,
  ROTULO_SALVAR_TAREFA,
  ROTULO_SEM_RESPONSAVEL,
} from "@/lib/abertura/textos";
import { cn } from "@/lib/utils";
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
// (CLAUDE.md §Validação) — `criarTarefaDeAbertura` revalida no servidor com
// `esquemaTarefaDeAbertura`. Reaproveita `esquemaTarefaBase.shape` (mesma regra do servidor),
// nunca uma segunda cópia. `responsavelId`/`itemId` ficam como texto simples aqui — a
// normalização para `null` que o schema do servidor faz só importa no momento de gravar.
const esquemaFormulario = z.object({
  descricao: esquemaTarefaBase.shape.descricao,
  grupo: esquemaTarefaBase.shape.grupo,
  prazoEm: esquemaTarefaBase.shape.prazoEm,
  responsavelId: z.string(),
  itemId: z.string(),
});

type ValoresDoFormulario = z.infer<typeof esquemaFormulario>;

// `components/ui/input.tsx` tem `md:text-sm` embutido (14px) — repetir `text-corpo` no
// breakpoint `md` explicitamente é o que mantém o campo em 16px também no desktop (regra do
// zoom do iOS, CLAUDE.md §Acessibilidade), mesma classe de `formulario-item.tsx`.
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

// O `<Select>` do Radix não aceita `value=""` num `SelectItem` (lança em tempo de execução) —
// por isso as duas opções "nenhum" do formulário usam um valor sentinela só de exibição,
// convertido para cadeia vazia no `onValueChange`. O schema do servidor trata cadeia vazia (e
// qualquer texto em branco) como `null` — "ninguém ainda" (D-11) e "tarefa solta" (D-13) são
// estados válidos, nunca campo não preenchido.
const SEM_RESPONSAVEL = "__sem_responsavel__";
const SEM_VINCULO = "__sem_vinculo__";

export type ItemParaVinculo = { id: string; nome: string };

export type FormularioTarefaProps = {
  // O dia civil de Brasília, calculado UMA VEZ na borda (`app/(app)/abertura/page.tsx`) — o
  // formulário nunca lê o relógio por conta própria, só usa este valor como padrão do campo de
  // prazo quando a tarefa nasce.
  hoje: string;
  // A lista de gestores ativos (D-11) — vem do banco, nunca de um vetor no código.
  gestores: GestorAtivo[];
  // Os itens existentes, para o vínculo opcional (D-13) — na mesma ordem em que aparecem na
  // lista de itens.
  itens: ItemParaVinculo[];
};

function valoresIniciais(hoje: string): ValoresDoFormulario {
  return {
    descricao: "",
    grupo: ORDEM_DOS_GRUPOS[0],
    prazoEm: hoje,
    responsavelId: "",
    itemId: "",
  };
}

// Único caminho de criação de tarefa nesta fatia (D-18, edição no lugar, é do plano 04.2-03).
// Aberto por `?tarefa=nova` na própria rota `/abertura` — montado SEMPRE (mesmo com a lista
// vazia), para o botão do `EstadoVazio` da aba Tarefas abrir o formulário da primeiríssima
// tarefa (mesmo achado replicado de Itens/Fornos).
export function FormularioTarefa({ hoje, gestores, itens }: FormularioTarefaProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aberto = searchParams.get("tarefa") === "nova";

  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ValoresDoFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: valoresIniciais(hoje),
  });

  useEffect(() => {
    if (aberto) {
      form.reset(valoresIniciais(hoje));
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function fechar() {
    setErro(null);
    router.push("/abertura?aba=tarefas");
  }

  async function aoSubmeter(valores: ValoresDoFormulario) {
    setErro(null);

    const resposta = await criarTarefaDeAbertura({
      descricao: valores.descricao,
      grupo: valores.grupo,
      prazoEm: valores.prazoEm,
      responsavelId: valores.responsavelId,
      itemId: valores.itemId,
    });

    if (!resposta.ok) {
      // Banner inline, formulário continua aberto — nada do que foi digitado se perde.
      setErro(resposta.erro);
      return;
    }

    toast.success("Tarefa adicionada.");
    router.push("/abertura?aba=tarefas");
    router.refresh();
  }

  const { register, control, formState } = form;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent
        showCloseButton
        aria-label="Nova tarefa"
        className={cn(
          // Celular (base, mobile-first): folha de baixo, tela toda.
          "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
          // Desktop (`md:`): modal centralizado.
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
        )}
      >
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-display">Nova tarefa</DialogTitle>
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

            <Field data-invalid={!!formState.errors.descricao}>
              <FieldLabel htmlFor="descricao">O que fazer</FieldLabel>
              <Input
                id="descricao"
                placeholder="Orçar instalação elétrica"
                className={CLASSE_DO_CAMPO}
                {...register("descricao")}
              />
              <FieldError
                errors={formState.errors.descricao ? [formState.errors.descricao] : undefined}
              />
            </Field>

            <Field data-invalid={!!formState.errors.responsavelId}>
              <FieldLabel htmlFor="responsavelId">Quem</FieldLabel>
              <Controller
                control={control}
                name="responsavelId"
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? SEM_RESPONSAVEL : field.value}
                    onValueChange={(valor) =>
                      field.onChange(valor === SEM_RESPONSAVEL ? "" : valor)
                    }
                  >
                    <SelectTrigger id="responsavelId" aria-label="Quem" className="min-h-[44px] w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Primeira opção — "ninguém ainda" é um estado válido (D-11/ABE-07), não
                          um campo esquecido. */}
                      <SelectItem value={SEM_RESPONSAVEL}>{ROTULO_SEM_RESPONSAVEL}</SelectItem>
                      {gestores.map((gestor) => (
                        <SelectItem key={gestor.id} value={gestor.id}>
                          {gestor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={!!formState.errors.prazoEm}>
              <FieldLabel htmlFor="prazoEm">Até quando</FieldLabel>
              <Input
                id="prazoEm"
                type="date"
                className={CLASSE_DO_CAMPO}
                {...register("prazoEm")}
              />
              <FieldError
                errors={formState.errors.prazoEm ? [formState.errors.prazoEm] : undefined}
              />
            </Field>

            <Field data-invalid={!!formState.errors.grupo}>
              <FieldLabel htmlFor="grupo">Grupo</FieldLabel>
              <Controller
                control={control}
                name="grupo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="grupo" aria-label="Grupo" className="min-h-[44px] w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEM_DOS_GRUPOS.map((grupo) => (
                        <SelectItem key={grupo} value={grupo}>
                          {ROTULO_GRUPO[grupo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={!!formState.errors.itemId}>
              <FieldLabel htmlFor="itemId">Ligada a algum item?</FieldLabel>
              <Controller
                control={control}
                name="itemId"
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? SEM_VINCULO : field.value}
                    onValueChange={(valor) => field.onChange(valor === SEM_VINCULO ? "" : valor)}
                  >
                    <SelectTrigger id="itemId" aria-label="Ligada a algum item?" className="min-h-[44px] w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_VINCULO}>Nenhum — tarefa solta</SelectItem>
                      {itens.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <p className="text-apoio text-muted-foreground">
              Comprar o forno é uma coisa; instalar é outra. Ligar a tarefa ao item deixa isso
              visível.
            </p>
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
                {formState.isSubmitting ? "Salvando…" : ROTULO_SALVAR_TAREFA}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
