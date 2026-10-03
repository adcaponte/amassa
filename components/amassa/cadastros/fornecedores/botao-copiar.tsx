"use client";

import { toast } from "sonner";

import { ROTULO_COPIAR, toastCopiado, toastNaoDeuParaCopiar } from "@/lib/fornecedores/textos";

// "copiar" dos cartões de contato: escreve o valor na área de transferência e confirma com o toast
// "Copiado: {valor}". Sem área de transferência (navegador antigo, página sem permissão, contexto sem
// HTTPS), o toast mostra o valor para a pessoa copiar à mão: "Não deu para copiar. Está aqui:
// {valor}" — nunca um erro mudo.
//
// A classe vem de quem chama (`contatos-fornecedor.tsx`, a mesma dos links "abrir"): uma constante
// exportada deste arquivo de cliente chegaria ao Server Component como referência, não como texto.
export function BotaoCopiar({
  valor,
  rotuloAcessivel,
  className,
}: {
  valor: string;
  rotuloAcessivel: string;
  className: string;
}) {
  async function copiar() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Sem área de transferência neste navegador.");
      }
      await navigator.clipboard.writeText(valor);
      toast(toastCopiado(valor));
    } catch {
      toast(toastNaoDeuParaCopiar(valor));
    }
  }

  return (
    <button type="button" aria-label={rotuloAcessivel} onClick={copiar} className={className}>
      {ROTULO_COPIAR}
    </button>
  );
}
