"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { desfazerPagamento } from "@/lib/financeiro/acoes";
import { FRASE_FALHA_AO_DESFAZER, ROTULO_DESFAZER } from "@/lib/financeiro/textos";

export type AvisoFinanceiroProps = {
  // O texto PRONTO, montado pela página no servidor a partir de `?aviso=...` — este componente
  // nunca lê a URL nem monta o texto sozinho (T-04.4-09 do threat model: nenhum texto refletido
  // da URL, sempre montado a partir do banco).
  texto: string | null;
  // Presente SÓ para o aviso `pago` ainda válido (a parcela confirmadamente paga com previsto
  // guardado) — habilita o "Desfazer" de 7 segundos (D-03), mesmo padrão de duração de
  // `registrar-queima.tsx`. Ausente/nulo para os demais avisos: toast simples, duração padrão.
  desfazer?: { parcelaId: string } | null;
};

// Mostra o toast UMA VEZ e limpa a query com `history.replaceState` — recarregar a página não
// repete o aviso (mesmo padrão de `registrar-queima.tsx`, sem o `router.refresh` de lá, que é o
// antipadrão que este módulo não copia). O "Desfazer" chama `desfazerPagamento` direto (sem
// abrir diálogo nenhum) e, dando certo, faz uma NAVEGAÇÃO COMPLETA para o aviso `desfeito`.
export function AvisoFinanceiro({ texto, desfazer }: AvisoFinanceiroProps) {
  useEffect(() => {
    if (!texto) {
      return;
    }

    if (desfazer) {
      const parcelaId = desfazer.parcelaId;
      toast.success(texto, {
        duration: 7000,
        action: {
          label: ROTULO_DESFAZER,
          onClick: () => {
            void (async () => {
              const resposta = await desfazerPagamento({ parcelaId });
              if (!resposta.ok) {
                toast.error(FRASE_FALHA_AO_DESFAZER);
                return;
              }
              window.location.assign(
                `/financeiro?aba=caixa&aviso=desfeito&parcela=${resposta.dados.parcelaId}`,
              );
            })();
          },
        },
      });
    } else {
      toast.success(texto);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("aviso");
    url.searchParams.delete("documento");
    url.searchParams.delete("parcela");
    window.history.replaceState(null, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return null;
}
