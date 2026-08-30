"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { registrarManutencao } from "@/lib/queimas/acoes";
import {
  ROTULO_OBSERVACOES,
  ROTULO_REGISTRAR_MANUTENCAO,
  ROTULO_RESPONSAVEL,
  fraseDoContadorZerando,
} from "@/lib/queimas/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type RegistrarManutencaoProps = {
  fornoId: string;
  // O N que o contador tinha quando o dialog abriu — vem PRONTO do Server Component (a página do
  // forno), nunca recalculado no cliente (T-04-15-adjacent: o cliente só EXIBE o número que o
  // servidor já mediu, a mesma disciplina de `Medidor`).
  contadorAtual: number;
};

// Reaproveita `nome`/`descricao` só como forma (dois campos livres, sem regra de negócio no
// componente) — os limites de comprimento espelham `esquemaManutencao`
// (`lib/queimas/esquemas.ts`), a validação que vale de verdade é a do servidor (CLAUDE.md
// §Validação).
const esquemaFormulario = z.object({
  responsavel: z.string().max(120, "Responsável muito longo — no máximo 120 caracteres."),
  observacoes: z.string().max(500, "Observações muito longas — no máximo 500 caracteres."),
});

type ValoresDoFormulario = z.infer<typeof esquemaFormulario>;

const VALORES_INICIAIS: ValoresDoFormulario = { responsavel: "", observacoes: "" };

// `components/ui/input.tsx` tem `md:text-sm` embutido (14px) — repetir `text-corpo` no
// breakpoint `md` é o que mantém o campo em 16px também no desktop (regra do zoom do iOS),
// mesma classe de `formulario-forno.tsx`/`formulario-encomenda.tsx`.
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

// `textarea` que rola DENTRO da própria altura — não existe primitivo `Textarea` instalado
// (04-UI-SPEC.md lista os componentes shadcn já presentes e `textarea` não está entre eles);
// classe própria espelhando `input.tsx`, com `resize-none` + `overflow-y-auto` + altura máxima
// fixa, para o dialog nunca crescer indefinidamente no celular (E7/long-text).
const CLASSE_TEXTAREA =
  "text-corpo md:text-corpo min-h-[88px] max-h-40 w-full resize-none overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-2 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30";

// E7 (FOR-07, Tarefa 2 do plano 04-04) — "Registrar manutenção" é o ÚNICO botão de acento
// (terracota) desta tela (`04-UI-SPEC.md` §Color), aberto SÓ na página do próprio forno (D-03: o
// cartão do índice nunca importa este componente). Dialog único com conteúdo responsivo por CSS
// (nunca `Dialog` + `Sheet` simultâneos — achado do 03-06), abre por estado local próprio (não
// pela URL como `FormularioForno`, porque este componente é dono do seu próprio gatilho, não um
// deep-link compartilhado). O corpo do dialog abre com `fraseDoContadorZerando(contadorAtual)` —
// o N vem PRONTO por prop do servidor. Os dois campos são opcionais: o botão de confirmação
// NASCE habilitado (nenhum `required`/`min` bloqueia o envio vazio) — só fica desabilitado
// enquanto a gravação está em andamento (`formState.isSubmitting`), para o duplo toque não
// registrar duas manutenções.
export function RegistrarManutencao({ fornoId, contadorAtual }: RegistrarManutencaoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ValoresDoFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: VALORES_INICIAIS,
  });

  function abrir() {
    form.reset(VALORES_INICIAIS);
    setErro(null);
    setAberto(true);
  }

  function fechar() {
    if (form.formState.isSubmitting) {
      // Duplo toque no fechamento durante o envio não interrompe a gravação em andamento — o
      // dialog só fecha quando a resposta chegar (sucesso) ou o gestor tenta de novo (erro).
      return;
    }
    setErro(null);
    setAberto(false);
  }

  async function aoSubmeter(valores: ValoresDoFormulario) {
    setErro(null);

    const resposta = await registrarManutencao({
      fornoId,
      responsavel: valores.responsavel,
      observacoes: valores.observacoes,
    });

    if (!resposta.ok) {
      // Banner inline, dialog continua ABERTO com os campos preenchidos — o gestor não
      // reescreve nada (E7/error).
      setErro(resposta.erro);
      return;
    }

    toast.success("Manutenção registrada.");
    setAberto(false);
    router.refresh();
  }

  const { register, formState } = form;

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="min-h-[44px] w-full md:w-auto"
        onClick={abrir}
        data-testid="botao-registrar-manutencao"
      >
        {ROTULO_REGISTRAR_MANUTENCAO}
      </Button>

      <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
        <DialogContent
          showCloseButton
          aria-label={ROTULO_REGISTRAR_MANUTENCAO}
          data-testid="dialog-registrar-manutencao"
          className={cn(
            // Celular (base, mobile-first): folha de baixo, tela toda.
            "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
            // Desktop (`md:`): modal centralizado.
            "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
          )}
        >
          <DialogHeader className="border-border border-b px-6 py-4">
            <DialogTitle className="text-display">{ROTULO_REGISTRAR_MANUTENCAO}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(evento) => {
              void form.handleSubmit(aoSubmeter)(evento);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
              {/* Frase literal (`04-DESIGN-SYSTEM.md` §8, FOR-07) — o N já veio pronto do
                  servidor no momento em que este componente montou, nunca recalculado aqui. */}
              <p className="text-titulo text-foreground" data-testid="frase-contador-zerando">
                {fraseDoContadorZerando(contadorAtual)}
              </p>

              {erro && (
                <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
                  {erro}
                </p>
              )}

              <Field data-invalid={!!formState.errors.responsavel}>
                <FieldLabel htmlFor="responsavel">{ROTULO_RESPONSAVEL}</FieldLabel>
                <Input id="responsavel" className={CLASSE_DO_CAMPO} {...register("responsavel")} />
                <FieldError
                  errors={formState.errors.responsavel ? [formState.errors.responsavel] : undefined}
                />
              </Field>

              <Field data-invalid={!!formState.errors.observacoes}>
                <FieldLabel htmlFor="observacoes">{ROTULO_OBSERVACOES}</FieldLabel>
                <textarea
                  id="observacoes"
                  rows={4}
                  className={CLASSE_TEXTAREA}
                  {...register("observacoes")}
                />
                <FieldError
                  errors={formState.errors.observacoes ? [formState.errors.observacoes] : undefined}
                />
              </Field>
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
                  data-testid="confirmar-registrar-manutencao"
                >
                  {formState.isSubmitting ? "Registrando…" : ROTULO_REGISTRAR_MANUTENCAO}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
