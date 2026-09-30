import { AlertTriangle } from "lucide-react";

import { textoAvisoVendaCancelada } from "@/lib/producao/textos";
import { cn } from "@/lib/utils";

import { ConfirmarCancelarOrdem } from "./confirmar-cancelar-ordem";

export type AvisoVendaCanceladaProps = {
  ordemId: string;
  nome: string;
  vendaNumero: number;
  baixasFeitas: number;
  // A caixa aparece só na ordem LIBERADA cuja venda foi cancelada no Caixa (D-07). A página monta o
  // componente também depois que a ordem foi cancelada, com a caixa escondida: a recusa de um
  // segundo "Cancelar ordem" (outro celular) continua no diálogo depois que a tela recarrega.
  visivel: boolean;
};

// O aviso de venda cancelada (D-07, UI-SPEC §"Página da ordem"): a venda do orçamento foi cancelada
// no Financeiro com a ordem já liberada — nada mudou na ordem (o aviso é derivado na leitura), e o
// dono decide se ela segue ou se cancela. Caixa `atencao-fundo`/`atencao`, Apoio, `AlertTriangle`
// 20px, `role="status"`, com o "Cancelar ordem" DENTRO — enquanto o aviso está visível, o bloco
// "Cancelar ordem" de baixo não aparece (nunca dois botões iguais na mesma tela). A confirmação diz
// que a venda "já foi cancelada no Financeiro".
export function AvisoVendaCancelada({
  ordemId,
  nome,
  vendaNumero,
  baixasFeitas,
  visivel,
}: AvisoVendaCanceladaProps) {
  // A mesma árvore nos dois estados — só a caixa se esconde. Trocar a estrutura desmontaria a
  // confirmação (e a frase da recusa) no meio do `router.refresh()`.
  return (
    <div
      data-testid={visivel ? "ordem-aviso-venda-cancelada" : undefined}
      role={visivel ? "status" : undefined}
      className={cn(
        "bg-atencao-fundo text-atencao text-apoio flex flex-col gap-3 rounded-md p-4 [overflow-wrap:anywhere]",
        !visivel && "hidden",
      )}
    >
      <p className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>{textoAvisoVendaCancelada(vendaNumero)}</span>
      </p>
      <ConfirmarCancelarOrdem
        ordemId={ordemId}
        nome={nome}
        baixasFeitas={baixasFeitas}
        vendaNumero={vendaNumero}
        vendaCancelada
        podeCancelar={visivel}
        className="bg-superficie self-start"
      />
    </div>
  );
}
