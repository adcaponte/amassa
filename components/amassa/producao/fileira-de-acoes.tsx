import type { ReactNode } from "react";

// As ações da ordem ativa (UI-SPEC §"Página da ordem" → Ações, UI-D3) — uma fileira no FIM do bloco
// "Etapas", logo depois da trilha, em TODA largura. Trocado pelo dono em 30/09/2026 (Parte 0 da
// verificação humana): antes, no celular (< 768px), a fileira era uma barra de ação fixa acima da
// barra de navegação; agora o celular usa o mesmo lugar no fluxo que o desktop já usava.
//
// - **Celular (< 768px):** "Desfazer" à esquerda e o primário ("Terminei: {Etapa}" / "Entreguei" /
//   "Guardar no estoque") ocupando o resto da largura, 52px de altura mínima.
// - **Desktop (≥ 768px):** a mesma fileira alinhada à direita.
//
// Um elemento só, e não duas fileiras por largura: os botões existem uma vez na página — um
// `data-testid="ordem-terminei"`, uma trava, uma frase de erro —, na ordem de tabulação que a
// UI-SPEC pede (trilha → ações → peças). Na ordem concluída ou cancelada a fileira não existe:
// `escondida` desenha o MESMO elemento sem caixa (nem `data-testid`), só para os filhos continuarem
// montados — a frase de uma recusa ("já tinha sido marcada", a ordem cancelada noutro celular)
// sobrevive à recarga que tira a ordem do estado ativo (revisão 06.1, WR-104; o molde de
// `CaixaAguardando`).
export function FileiraDeAcoes({
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
    // `flex-wrap`: a frase de uma recusa sem botão (`w-full`) desce para a linha de baixo. Os
    // primários do celular são `flex-1` (base 0), então nunca quebram linha por causa do rótulo.
    <div data-testid="ordem-acoes" className="flex flex-wrap items-start gap-2 md:justify-end">
      {children}
    </div>
  );
}

// O rótulo do "Desfazer": curto no celular (a fileira divide a largura com o "Terminei"),
// "Desfazer a última" no desktop. O nome acessível (`aria-label` "Desfazer a última etapa:
// {Etapa}") contém os dois (WCAG 2.5.3).
export function RotuloDesfazer({ curto, longo }: { curto: string; longo: string }) {
  return (
    <>
      <span className="md:hidden">{curto}</span>
      <span className="hidden md:inline">{longo}</span>
    </>
  );
}
