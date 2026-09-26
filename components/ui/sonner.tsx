"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          // As quatro variáveis abaixo, no arquivo padrão gerado pelo shadcn, apontavam para
          // --popover/--popover-foreground/--border/--radius — nenhuma delas existe neste
          // projeto. app/globals.css usa o namespace --color-* do Tailwind v4 (--color-popover,
          // --color-popover-foreground, --color-border) e o namespace de raio é --radius-sm/md/
          // lg/xl, sem um --radius puro. Um var() apontando pra nome inexistente, sem fallback,
          // resolve pra nada: o toast pintava `background: var(--normal-bg)` transparente,
          // desenhando "Pago: R$ X / Desfazer" por cima do cartão atrás dele, ilegível (achado
          // do dono, fotografado no celular, 26/09/2026 — só ficou visível quando o plano
          // 04.4-13 subiu o aviso para cima da barra inferior, sobre os cartões do Caixa; o
          // defeito é anterior, desde a instalação do componente na fase 03-01). Os quatro
          // tokens abaixo já existem e já são usados por dialog.tsx/dropdown-menu.tsx/select.tsx
          // com o mesmo padrão (bg-popover text-popover-foreground) — nenhum nome novo, nenhum
          // valor inventado. --radius-xl é o mesmo raio de Card/Dialog (rounded-xl, 18px). A
          // sombra e a borda do toast já vêm de graça do próprio CSS do sonner
          // (node_modules/sonner/dist/styles.css: border + box-shadow embutidos na regra
          // [data-sonner-toast][data-styled='true']) — nenhuma classe extra é necessária.
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-xl)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
