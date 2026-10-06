"use client";

import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// A `Folha` comum (D-24, POL-11 · UI-SPEC §"`Folha` comum"): o miolo que dezenas de folhas
// repetiam à mão sobre o `Dialog` do shadcn — raiz, cabeçalho fixo, corpo que rola e rodapé
// fixo. O `Dialog` (aberto/fechado, `onOpenChange`) continua em cada folha; aqui só a casca.
// Refatoração sem mudança de comportamento: cada parte produz as MESMAS classes que as folhas
// escreviam, e aceita `className` (somado por `cn`) para os desvios que já existiam.
//
// As partes se identificam por `data-folha="raiz|cabecalho|corpo|rodape"`, não por testid:
// `folha-rodape` já é testid da folha de impressão da Produção, e cada folha mantém o seu.

// O contêiner das folhas: tela toda no celular (`h-[100dvh]`, desliza de baixo), modal
// centralizado `max-w-lg` a partir de `md`. Rodapé preso por flex, nunca `position: sticky`.
// Nasceu em `estoque/folha-movimentacao.tsx` (que o reexporta até o 06.5-26 tirar o último
// importador antigo).
export const CLASSE_DA_FOLHA = cn(
  "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
  "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
);

// `estreita` = o "Recebi agora" e afins, que já somavam `md:max-w-sm` à classe.
const CLASSE_DO_TAMANHO = {
  normal: "",
  estreita: "md:max-w-sm",
} as const;

export type FolhaProps = Omit<ComponentProps<typeof DialogContent>, "showCloseButton"> & {
  tamanho?: keyof typeof CLASSE_DO_TAMANHO;
};

// A raiz: o `DialogContent` sem o "X" do shadcn (o fechar mora no `FolhaCabecalho`). Repassa
// tudo o mais — `data-testid`, `onOpenAutoFocus`, `onEscapeKeyDown`, `aria-*`, `data-*`.
export function Folha({ tamanho = "normal", className, children, ...props }: FolhaProps) {
  return (
    <DialogContent
      showCloseButton={false}
      data-folha="raiz"
      {...props}
      className={cn(CLASSE_DA_FOLHA, CLASSE_DO_TAMANHO[tamanho], className)}
    >
      {children}
    </DialogContent>
  );
}

export type FolhaCabecalhoProps = {
  titulo: ReactNode;
  descricao: ReactNode;
  // Visível: a descrição vai embaixo do título (Apoio, `tinta-fraca`) e o fechar se alinha ao
  // topo. Escondida (padrão): só o leitor de tela a lê, e o título se centra com o fechar.
  descricaoVisivel?: boolean;
  aoFechar: () => void;
  rotuloFechar?: string;
  fecharDesabilitado?: boolean;
  dataTestIdFechar?: string;
  // O testid na própria descrição (a baixa da Produção marca o resumo do material).
  dataTestIdDescricao?: string;
  // Desvios que já existiam (quebra de nome longo, ponto da área na descrição).
  classeTitulo?: string;
  classeDescricao?: string;
  className?: string;
  // Extras à direita, antes do fechar.
  children?: ReactNode;
};

// O cabeçalho fixo: título `text-titulo`, descrição e o fechar só ícone de 44 px.
export function FolhaCabecalho({
  titulo,
  descricao,
  descricaoVisivel = false,
  aoFechar,
  rotuloFechar = "Fechar",
  fecharDesabilitado,
  dataTestIdFechar,
  dataTestIdDescricao,
  classeTitulo,
  classeDescricao,
  className,
  children,
}: FolhaCabecalhoProps) {
  const tituloEDescricao = descricaoVisivel ? (
    <div className="flex min-w-0 flex-col gap-1">
      <DialogTitle className={cn("text-titulo text-tinta", classeTitulo)}>{titulo}</DialogTitle>
      <DialogDescription
        data-testid={dataTestIdDescricao}
        className={cn("text-apoio text-tinta-fraca", classeDescricao)}
      >
        {descricao}
      </DialogDescription>
    </div>
  ) : (
    <>
      <DialogTitle className={cn("text-titulo text-tinta", classeTitulo)}>{titulo}</DialogTitle>
      <DialogDescription data-testid={dataTestIdDescricao} className={cn("sr-only", classeDescricao)}>
        {descricao}
      </DialogDescription>
    </>
  );

  const fechar = (
    <button
      type="button"
      aria-label={rotuloFechar}
      data-testid={dataTestIdFechar}
      disabled={fecharDesabilitado}
      onClick={aoFechar}
      className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
    >
      <X aria-hidden="true" />
    </button>
  );

  return (
    <DialogHeader
      data-folha="cabecalho"
      className={cn(
        "border-border flex flex-row justify-between gap-4 border-b px-6 py-4",
        descricaoVisivel ? "items-start" : "items-center",
        className,
      )}
    >
      {tituloEDescricao}
      {children ? (
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {fechar}
        </div>
      ) : (
        fechar
      )}
    </DialogHeader>
  );
}

// O corpo: o ÚNICO que rola. `ref` repassado (React 19: `ref` é prop).
export function FolhaCorpo({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-folha="corpo"
      {...props}
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4", className)}
    />
  );
}

export type FolhaRodapeProps = ComponentProps<"div"> & {
  // O erro da folha (falha ao gravar etc.), acima dos botões, lido na hora (`role="alert"`).
  erro?: string | null;
  idErro?: string;
  dataTestIdErro?: string;
};

// O rodapé fixo, preso por FLEX fora da área rolável — nunca `position: sticky` (G-03-1). O
// `gap-3` é herdado (UI-SPEC, Spacing → Exceções).
export function FolhaRodape({
  erro,
  idErro,
  dataTestIdErro,
  className,
  children,
  ...props
}: FolhaRodapeProps) {
  return (
    <div
      data-folha="rodape"
      {...props}
      className={cn("border-border bg-popover flex flex-col gap-3 border-t px-6 py-4", className)}
    >
      {erro ? (
        <p id={idErro} role="alert" data-testid={dataTestIdErro} className="text-apoio text-erro">
          {erro}
        </p>
      ) : null}
      {children}
    </div>
  );
}
