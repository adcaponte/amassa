"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { definirAMais } from "@/lib/producao/acoes";
import {
  FRASE_FALHA_AO_SALVAR_A_MAIS,
  ROTULO_A_MAIS,
  ROTULO_SALVANDO,
  ariaLabelAMais,
} from "@/lib/producao/textos";

export type CampoAMaisProps = {
  ordemId: string;
  pecaId: string;
  nomeDaPeca: string;
  aMais: number;
};

// "Fazer a mais, de segurança" (UI-SPEC §"Bloco Peças"; plano 04, PRD-08): um número por peça, só em
// encomenda aguardando ou ativa (quem desenha decide; o servidor recusa o resto). Grava ao sair do
// campo ou no Enter — e só se o número mudou. Nenhum toast (UI-SPEC §Toasts): o número fica no campo
// e o chip e o cartão acompanham pela resposta da ação (que revalida a página). Em voo: "Salvando…" ao lado. Erro:
// embaixo do campo, `role="alert"`, com o número digitado preservado — nunca apagado pela
// atualização da tela (UI-SPEC §"Dois celulares ao mesmo tempo").
export function CampoAMais({ ordemId, pecaId, nomeDaPeca, aMais }: CampoAMaisProps) {
  const router = useRouter();
  const idDoErro = useId();
  const emVoo = useRef(false);
  const [texto, setTexto] = useState(String(aMais));
  // O último valor que o servidor confirmou — sair do campo sem mudar nada não grava.
  const [gravado, setGravado] = useState(String(aMais));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (emVoo.current || texto.trim() === gravado) {
      return;
    }
    emVoo.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await definirAMais({ ordemId, pecaId, aMaisTexto: texto });
      if (resultado.ok) {
        const confirmado = String(resultado.dados.aMais);
        setGravado(confirmado);
        setTexto(confirmado);
      } else {
        setErro(resultado.erro);
        // A recusa volta antes de qualquer `revalidatePath`: a recarga do estado é daqui. No
        // sucesso, não — a ação já revalida a página (revisão 06.1, WR-106).
        router.refresh();
      }
    } catch {
      setErro(FRASE_FALHA_AO_SALVAR_A_MAIS);
      router.refresh();
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-apoio text-tinta-media flex items-center gap-2">
          {ROTULO_A_MAIS}
          <input
            data-testid="ordem-a-mais"
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            aria-label={ariaLabelAMais(nomeDaPeca)}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? idDoErro : undefined}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onBlur={() => void salvar()}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                // Sair do campo grava (uma vez só — o `onBlur` é o único caminho da gravação).
                evento.currentTarget.blur();
              }
            }}
            className="border-borda-forte bg-superficie text-tinta focus-visible:ring-ring h-11 w-20 rounded-md border px-2 text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        {salvando ? (
          <span data-testid="ordem-a-mais-salvando" aria-live="polite" className="text-apoio text-tinta-fraca">
            {ROTULO_SALVANDO}
          </span>
        ) : null}
      </div>
      {erro ? (
        <p id={idDoErro} data-testid="ordem-a-mais-erro" role="alert" className="text-apoio text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
