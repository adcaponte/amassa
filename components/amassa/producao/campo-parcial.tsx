"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { registrarParcial } from "@/lib/producao/acoes";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  FRASE_FALHA_AO_SALVAR_PARCIAL,
  ROTULO_JA_PASSARAM,
  ROTULO_SALVANDO,
  ariaLabelParcial,
  textoDeTotal,
} from "@/lib/producao/textos";

export type CampoParcialProps = {
  ordemId: string;
  tipo: TipoOrdem;
  // A etapa ATUAL que a tela mostra — vai ao servidor como `etapaEsperada` (Pitfall 7).
  etapa: EtapaProducao;
  // Σ (quantidade + a mais) das peças.
  total: number;
  passaram: number | null;
};

// "Já passaram [ ] de {total}" (UI-SPEC §"Página da ordem" → Trilha; PRD-06): informativo — nunca
// move a ordem. Quem desenha só o põe na etapa atual de ordem ativa, que não é a última, com mais de
// uma peça. Grava ao sair do campo ou no Enter (o Enter chama `blur()` — um só caminho de gravação),
// e só se o número mudou. Vazio = sem parcial. Em voo: "Salvando…" ao lado (`aria-live`). Erro:
// embaixo, `role="alert"`, com o número digitado preservado. Nenhum toast: o número fica no campo
// e o cartão do quadro acompanha.
export function CampoParcial({ ordemId, tipo, etapa, total, passaram }: CampoParcialProps) {
  const router = useRouter();
  const idDoErro = useId();
  const emVoo = useRef(false);
  const inicial = passaram === null ? "" : String(passaram);
  const [texto, setTexto] = useState(inicial);
  // O último valor que o servidor confirmou — sair do campo sem mudar nada não grava.
  const [gravado, setGravado] = useState(inicial);
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
      const resultado = await registrarParcial({
        ordemId,
        etapaEsperada: etapa,
        passaramTexto: texto,
      });
      if (resultado.ok) {
        const confirmado =
          resultado.dados.passaram === null ? "" : String(resultado.dados.passaram);
        setGravado(confirmado);
        setTexto(confirmado);
      } else {
        setErro(resultado.erro);
      }
    } catch {
      setErro(FRASE_FALHA_AO_SALVAR_PARCIAL);
    } finally {
      emVoo.current = false;
      setSalvando(false);
      router.refresh();
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-apoio text-tinta-media flex flex-wrap items-center gap-2">
          {ROTULO_JA_PASSARAM}
          <input
            data-testid="ordem-parcial"
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            aria-label={ariaLabelParcial(rotuloDaEtapa(etapa, tipo), total)}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? idDoErro : undefined}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onBlur={() => void salvar()}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                evento.currentTarget.blur();
              }
            }}
            className="border-borda-forte bg-superficie text-tinta focus-visible:ring-ring h-11 w-20 rounded-md border px-2 text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none"
          />
          {textoDeTotal(total)}
        </label>
        <span aria-live="polite" className="text-apoio text-tinta-fraca">
          {salvando ? (
            <span data-testid="ordem-parcial-salvando">{ROTULO_SALVANDO}</span>
          ) : null}
        </span>
      </div>
      {erro ? (
        <p id={idDoErro} data-testid="ordem-parcial-erro" role="alert" className="text-apoio text-erro">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
