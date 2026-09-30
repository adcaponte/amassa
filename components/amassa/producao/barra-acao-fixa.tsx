import type { ReactNode } from "react";

// As ações da ordem ativa (UI-SPEC §"Página da ordem" → Ações e §"Barra de ação fixa", UI-D3) — UM
// só elemento, que muda de forma com a largura:
//
// - **Celular (< 768px):** a barra de ação fixa, o mesmo desenho da Fase 06
//   (`components/amassa/estoque/barra-acao-fixa.tsx`): presa ACIMA da barra de navegação (`bottom`
//   = altura da barra inferior + faixa de gestos do iOS), altura `--altura-acao-fixa` (68px = 8 + 52
//   + 8), fundo `--color-fundo` a 94% com desfoque, borda de cima, padding 8px 24px, gap 8px. O
//   atributo de ação fixa (o `data-*` abaixo) faz o aviso (toast) subir acima dela — a regra de
//   `app/globals.css` só vale abaixo de 768px, então o atributo não mexe em nada no desktop.
// - **Desktop (≥ 768px):** deixa de ser fixa (`md:static`) e vira a fileira alinhada à direita no
//   fim do bloco "Etapas", sem fundo nem borda.
//
// Por que um elemento só, e não uma barra `md:hidden` mais uma fileira `hidden md:flex`: os dois
// botões existiriam duas vezes na página (um escondido) — dois `data-testid="ordem-terminei"`, duas
// travas de 1 s e duas frases de erro independentes. Aqui há um "Terminei" só, na ordem de
// tabulação que a UI-SPEC pede (trilha → ações → peças) nas duas larguras. Na última etapa o
// primário é "Entreguei" / "Guardar no estoque" (plano 11), que abre a folha de conclusão; na ordem
// concluída ou cancelada a barra não existe: `escondida` desenha o MESMO elemento sem nada de barra
// (nem fixa, nem `data-testid`), só para os filhos continuarem montados — a frase de uma recusa
// ("já tinha sido marcada", a ordem cancelada noutro celular) sobrevive à recarga que tira a ordem
// do estado ativo (revisão 06.1, WR-104; o molde de `CaixaAguardando`).
export function BarraAcaoFixa({
  children,
  escondida = false,
}: {
  children: ReactNode;
  escondida?: boolean;
}) {
  if (escondida) {
    // `contents`: sem caixa própria — vazio, não abre espaço na coluna da página; com a frase, ela
    // entra no fluxo como qualquer linha do bloco.
    return <div className="contents">{children}</div>;
  }
  return (
    <div
      data-acao-fixa=""
      data-testid="ordem-barra-fixa"
      className="border-borda bg-fundo/94 fixed inset-x-0 z-40 flex h-[var(--altura-acao-fixa)] items-center gap-2 border-t px-6 py-2 backdrop-blur md:static md:z-auto md:h-auto md:items-start md:justify-end md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      style={{ bottom: "calc(var(--altura-barra-inferior) + env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

// O rótulo do "Desfazer": curto na barra do celular, "Desfazer a última" na fileira do desktop. O
// nome acessível (`aria-label` "Desfazer a última etapa: {Etapa}") contém os dois (WCAG 2.5.3).
export function RotuloDesfazer({ curto, longo }: { curto: string; longo: string }) {
  return (
    <>
      <span className="md:hidden">{curto}</span>
      <span className="hidden md:inline">{longo}</span>
    </>
  );
}
