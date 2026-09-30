"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { liberarOrdem } from "@/lib/producao/acoes";
import {
  FRASE_AGUARDANDO,
  FRASE_FALHA_AO_LIBERAR,
  ROTULO_COMECAR_ASSIM_MESMO,
  ROTULO_LIBERANDO,
  ROTULO_LIBERAR,
  ROTULO_VER_NO_CAIXA,
  TOAST_LIBERADA,
  textoSinal,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";

export type SinalNaCaixa = {
  // O plano de pagamento do orçamento — no à vista a parcela 1 é o pagamento inteiro.
  avista: boolean;
  parcelaId: string;
  // "dd/mm" já formatado no servidor, ou `null` quando ainda não consta como recebido.
  recebidoEmDiaMes: string | null;
};

export type CaixaAguardandoProps = {
  ordemId: string;
  // A ordem ainda aguarda o sinal? A página desenha este componente SEMPRE no mesmo lugar: depois do
  // `router.refresh()` de uma recusa (outro celular já liberou), a ordem deixa de aguardar e a caixa
  // some — mas o componente continua montado e a frase da recusa fica na tela.
  aguardando: boolean;
  // `null` para ordem sem orçamento: sem a linha do sinal, com os dois botões.
  sinal: SinalNaCaixa | null;
};

// A caixa âmbar da ordem aguardando o sinal (UI-SPEC §"Página da ordem"; plano 03, PRD-11): a frase
// principal, a linha do sinal lida do Caixa (só leitura, com o link "ver no Caixa") e os dois botões
// que liberam — "Sinal recebido — começar" (primário) e "Começar assim mesmo" (`outline`), que some
// quando o sinal já consta recebido (UI-D14). Os dois chamam `liberarOrdem`: o servidor decide
// status e data. Enquanto grava: "Liberando…", `disabled`, `aria-busy`. Sucesso: toast e
// `router.refresh()` (a caixa some, a ordem vai para o quadro). Recusa (liberada ou cancelada noutro
// celular) ou falha: a frase `role="alert"` e a tela recarrega o estado.
export function CaixaAguardando({ ordemId, aguardando, sinal }: CaixaAguardandoProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  // Qual dos dois botões foi tocado — o "Liberando…" aparece nele; os dois ficam desabilitados.
  const [gravando, setGravando] = useState<"sinal" | "assim-mesmo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aoLiberar(botao: "sinal" | "assim-mesmo") {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setGravando(botao);
    setErro(null);
    try {
      const resultado = await liberarOrdem({ ordemId });
      if (resultado.ok) {
        toast.success(TOAST_LIBERADA);
      } else {
        setErro(resultado.erro);
      }
    } catch {
      setErro(FRASE_FALHA_AO_LIBERAR);
    } finally {
      emVoo.current = false;
      setGravando(null);
      router.refresh();
    }
  }

  const sinalRecebido = sinal !== null && sinal.recebidoEmDiaMes !== null;
  const fraseDeErro = erro ? (
    <p data-testid="ordem-liberar-erro" role="alert" className="text-apoio text-erro">
      {erro}
    </p>
  ) : null;

  if (!aguardando) {
    return fraseDeErro;
  }

  return (
    <div
      data-testid="ordem-caixa-aguardando"
      className="bg-atencao-fundo text-atencao flex flex-col gap-3 rounded-md p-4"
    >
      <p className="text-apoio font-semibold">{FRASE_AGUARDANDO}</p>
      {sinal ? (
        <p data-testid="ordem-sinal" className="text-apoio">
          {textoSinal(sinal.avista, sinal.recebidoEmDiaMes)}{" "}
          <a
            href={hrefDoCaixa({ parcelaFoco: sinal.parcelaId })}
            className="text-atencao font-semibold underline underline-offset-2"
          >
            {ROTULO_VER_NO_CAIXA}
          </a>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          data-testid="ordem-liberar"
          className="text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal"
          disabled={gravando !== null}
          aria-busy={gravando === "sinal" ? "true" : undefined}
          onClick={() => void aoLiberar("sinal")}
        >
          {gravando === "sinal" ? ROTULO_LIBERANDO : ROTULO_LIBERAR}
        </Button>
        {sinalRecebido ? null : (
          <Button
            type="button"
            variant="outline"
            data-testid="ordem-comecar-assim-mesmo"
            className="text-corpo text-tinta h-auto min-h-[44px] px-4 whitespace-normal"
            disabled={gravando !== null}
            aria-busy={gravando === "assim-mesmo" ? "true" : undefined}
            onClick={() => void aoLiberar("assim-mesmo")}
          >
            {gravando === "assim-mesmo" ? ROTULO_LIBERANDO : ROTULO_COMECAR_ASSIM_MESMO}
          </Button>
        )}
      </div>
      {fraseDeErro}
    </div>
  );
}
