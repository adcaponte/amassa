"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { terminarEtapa } from "@/lib/producao/acoes";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  FRASE_FALHA_AO_MARCAR,
  ROTULO_MARCANDO,
  rotuloTerminei,
  textoToastTerminei,
} from "@/lib/producao/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// O botão novo ("Terminei: {próxima}") só aceita toque 1 s depois de aparecer — dois toques
// rápidos nunca marcam duas etapas (UI-SPEC §"Orçamento de toques").
const ESPERA_DEPOIS_DE_MUDAR_MS = 1000;

// Depois de marcar, o botão velho fica travado até a tela trazer a etapa nova (revisão 06.1,
// WR-103). Se ela não chegar neste tempo (rede lenta, resposta perdida), pede a recarga de novo e
// solta o botão — um toque a mais ali só recebe a recusa "já tinha sido marcada", nunca marca duas.
const LIMITE_DA_ESPERA_PELA_TELA_MS = 10000;

export type BotaoTermineiProps = {
  ordemId: string;
  tipo: TipoOrdem;
  // A etapa atual que a tela MOSTRA — vai para o servidor como `etapaEsperada` (Pitfall 7). `null`
  // quando não há o que terminar (a Entrega se conclui; a ordem saiu do andamento): sem botão, só a
  // frase da última recusa — quem desenha o mantém montado (revisão 06.1, WR-104).
  etapa: EtapaProducao | null;
};

// "Terminei: {Etapa}" (UI-SPEC §Ações): primário, sem confirmação, sem campo, sem teclado — o
// segundo toque do caminho do quadro à etapa marcada (Valor central). Mora na fileira do fim do
// bloco "Etapas" (`FileiraDeAcoes`, UI-D3 — sem barra fixa desde 30/09/2026, troca do dono): no
// celular `flex-1`, 52px no mínimo, quebra em duas linhas a 320px, nunca reticências. Enquanto grava: "Marcando…", `disabled`, `aria-busy`. Sucesso: toast "Feito: X.
// Agora: Y." — SEM botão de desfazer (UI-D16: desfazer só pela confirmação que diz a data que se
// perde); a resposta da ação traz a página revalidada. Recusa ("já tinha sido marcada", outro
// celular) ou falha: a frase embaixo do botão, `role="alert"`, e
// a tela recarrega o estado — mesmo que a recarga tire o botão (a ordem chegou à Entrega, ou saiu do
// andamento), a frase fica (WR-104).
//
// As travas: (1) depois de marcar AQUI, o botão fica travado enquanto ainda mostra a etapa que foi
// marcada — até a tela trazer a nova (ou 10 s, com uma recarga de novo) —, e não por um tempo fixo
// que pode acabar antes da tela nova chegar (revisão 06.1, WR-103); (2) quando a etapa mostrada
// muda (marcada aqui, desfeita, ou mudada noutro celular e trazida por uma recarga), o botão novo
// ignora toques por 1000 ms. O componente NÃO muda de chave quando a etapa muda: a frase de erro e
// as travas sobrevivem.
export function BotaoTerminei({ ordemId, tipo, etapa }: BotaoTermineiProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  // Cada início de espera ganha um número novo — o temporizador recomeça do zero a cada mudança.
  const [inicioDaEspera, setInicioDaEspera] = useState(0);
  const [etapaVista, setEtapaVista] = useState(etapa);
  const [erro, setErro] = useState<string | null>(null);
  // A etapa que ESTE botão acabou de marcar, enquanto a tela ainda não trouxe a seguinte. Guardar a
  // etapa (e não um "sim/não") resolve a ordem incerta entre a resposta da ação e o desenho novo: se
  // a tela nova chegou antes do `await` voltar, a etapa mostrada já é outra e nada fica travado.
  const [aguardandoDe, setAguardandoDe] = useState<EtapaProducao | null>(null);
  const aguardandoTela = aguardandoDe !== null && aguardandoDe === etapa;

  // A etapa mudou desde o último desenho: o botão novo acabou de aparecer.
  if (etapaVista !== etapa) {
    setEtapaVista(etapa);
    setAguardandoDe(null);
    setEsperando(true);
    setInicioDaEspera((anterior) => anterior + 1);
  }

  useEffect(() => {
    if (!aguardandoTela) {
      return;
    }
    const temporizador = window.setTimeout(() => {
      router.refresh();
      setAguardandoDe(null);
    }, LIMITE_DA_ESPERA_PELA_TELA_MS);
    return () => window.clearTimeout(temporizador);
  }, [aguardandoTela, router]);

  useEffect(() => {
    if (inicioDaEspera === 0) {
      return;
    }
    const temporizador = window.setTimeout(() => setEsperando(false), ESPERA_DEPOIS_DE_MUDAR_MS);
    return () => window.clearTimeout(temporizador);
  }, [inicioDaEspera]);

  async function aoTocar() {
    if (etapa === null || emVoo.current || esperando || aguardandoTela) {
      return;
    }
    emVoo.current = true;
    setGravando(true);
    setErro(null);
    try {
      const resultado = await terminarEtapa({ ordemId, etapaEsperada: etapa });
      if (resultado.ok) {
        toast.success(
          textoToastTerminei(
            rotuloDaEtapa(resultado.dados.etapa, tipo),
            rotuloDaEtapa(resultado.dados.proxima, tipo),
          ),
        );
        // Até a tela trazer a etapa nova, o botão velho não aceita toque.
        setAguardandoDe(etapa);
      } else {
        setErro(resultado.erro);
        // A recusa volta antes de qualquer `revalidatePath`: a recarga do estado é daqui. No
        // sucesso, não — a ação já revalida esta página e a resposta dela traz a árvore nova
        // (revisão 06.1, WR-106; `.planning/debug/abertura-navegacao-trava.md`).
        router.refresh();
      }
    } catch {
      setErro(FRASE_FALHA_AO_MARCAR);
      router.refresh();
    } finally {
      emVoo.current = false;
      setGravando(false);
    }
  }

  // A frase fica no fluxo, embaixo do botão (sem barra fixa, não há bolha a ancorar). Com o botão,
  // segue a coluna dele (à direita no desktop); sem botão, `w-full` — na fileira, que quebra linha,
  // ela ganha a própria linha depois dos botões.
  const frase = erro ? (
    <p
      data-testid="ordem-terminei-erro"
      role="alert"
      className={cn("text-apoio text-erro", etapa === null ? "w-full" : "md:text-right")}
    >
      {erro}
    </p>
  ) : null;

  if (etapa === null) {
    // Sem botão: só a frase da última recusa, se houver (WR-104).
    return frase;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 md:flex-none md:items-end">
      <Button
        type="button"
        data-testid="ordem-terminei"
        className="text-corpo h-auto min-h-[52px] px-6 font-semibold leading-tight whitespace-normal"
        disabled={gravando || esperando || aguardandoTela}
        aria-busy={gravando ? "true" : undefined}
        onClick={aoTocar}
      >
        {gravando ? ROTULO_MARCANDO : rotuloTerminei(rotuloDaEtapa(etapa, tipo))}
      </Button>
      {frase}
    </div>
  );
}
