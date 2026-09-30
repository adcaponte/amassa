"use client";

import { useState } from "react";

import type { DadosDaConclusao } from "@/lib/producao/consultas";
import { rotuloDaEtapa, type EtapaProducao, type TipoOrdem } from "@/lib/producao/etapas";
import {
  ROTULO_DESFAZER,
  ROTULO_DESFAZER_A_ULTIMA,
  ariaLabelDesfazerNaBarra,
  rotuloDoConcluir,
} from "@/lib/producao/textos";
import { Button } from "@/components/ui/button";

import { BarraAcaoFixa, RotuloDesfazer } from "./barra-acao-fixa";
import { BotaoTerminei } from "./botao-terminei";
import { ConfirmarDesfazer, type AlvoDoDesfazer } from "./confirmar-desfazer";
import { FolhaConclusao } from "./folha-conclusao";

export type AcoesDaOrdemProps = {
  ordemId: string;
  // A ordem está em andamento? A página monta este componente SEMPRE, no mesmo lugar (revisão 06.1,
  // WR-104 — o molde de `CaixaAguardando`): quando outro celular conclui ou cancela a ordem, a recarga
  // a tira do estado ativo e a barra some, mas o componente continua montado e a frase da recusa
  // (do "Terminei" ou do "Desfazer") fica na tela.
  ativa: boolean;
  tipo: TipoOrdem;
  // A etapa atual quando ela ainda se "termina"; `null` na última (a Entrega se CONCLUI: o botão
  // vira "Entreguei" / "Guardar no estoque" e abre a folha de conclusão — plano 11).
  etapaParaTerminar: EtapaProducao | null;
  // O que a folha de conclusão precisa — só quando a etapa atual é a última (`null` antes).
  conclusao: (DadosDaConclusao & { vendaNumero: number | null }) | null;
  // A última etapa feita, com a data que o desfazer apaga; `null` sem nenhuma feita.
  ultimaFeita: AlvoDoDesfazer | null;
};

// As ações da ordem ATIVA (fora dela, só a frase da última recusa — ver `ativa`): "Desfazer a última" (`outline`,
// desabilitado sem nenhuma etapa feita) e "Terminei: {Etapa}" (primário) — na última etapa,
// "Entreguei" / "Guardar no estoque", que abre a folha de conclusão (plano 11). No celular, na barra de
// ação fixa acima da navegação; no desktop, a fileira à direita (ver `BarraAcaoFixa`). "Desfazer"
// abre a confirmação com a etapa e a data FOTOGRAFADAS no toque (UI-D4).
export function AcoesDaOrdem({
  ordemId,
  ativa,
  tipo,
  etapaParaTerminar,
  conclusao,
  ultimaFeita,
}: AcoesDaOrdemProps) {
  const [alvo, setAlvo] = useState<AlvoDoDesfazer | null>(null);
  const [aberto, setAberto] = useState(false);
  // Cada abertura da folha de conclusão ganha uma chave nova: ela nasce limpa.
  const [aberturaDaConclusao, setAberturaDaConclusao] = useState<number | null>(null);

  return (
    <>
      <BarraAcaoFixa escondida={!ativa}>
        {ativa ? (
          <Button
            type="button"
            variant="outline"
            data-testid="ordem-desfazer"
            disabled={ultimaFeita === null}
            aria-label={
              ultimaFeita
                ? ariaLabelDesfazerNaBarra(rotuloDaEtapa(ultimaFeita.etapa, tipo))
                : undefined
            }
            onClick={() => {
              if (ultimaFeita) {
                setAlvo(ultimaFeita);
                setAberto(true);
              }
            }}
            className="text-corpo h-auto min-h-[52px] shrink-0 px-4 font-semibold"
          >
            <RotuloDesfazer curto={ROTULO_DESFAZER} longo={ROTULO_DESFAZER_A_ULTIMA} />
          </Button>
        ) : null}
        {/* Montado sempre, no mesmo lugar (WR-104): na Entrega, ou com a ordem fora do andamento, ele
            não tem botão — só a frase da recusa, se houver, que assim sobrevive à recarga. */}
        <BotaoTerminei
          ordemId={ordemId}
          tipo={tipo}
          etapa={ativa ? etapaParaTerminar : null}
          naBarra={ativa}
        />
        {ativa && etapaParaTerminar === null && conclusao ? (
          // A última etapa: "Entreguei" (encomenda) / "Guardar no estoque" (casa) abre a conclusão —
          // sem campo parcial, sem gravar nada no toque (UI-SPEC §Ações).
          <Button
            type="button"
            data-testid="ordem-concluir"
            onClick={() => setAberturaDaConclusao((anterior) => (anterior ?? 0) + 1)}
            className="text-corpo h-auto min-h-[52px] min-w-0 flex-1 px-6 leading-tight font-semibold whitespace-normal md:flex-none"
          >
            {rotuloDoConcluir(tipo)}
          </Button>
        ) : null}
      </BarraAcaoFixa>
      {conclusao && aberturaDaConclusao !== null ? (
        <FolhaConclusao
          key={aberturaDaConclusao}
          ordemId={ordemId}
          tipo={tipo}
          vendaNumero={conclusao.vendaNumero}
          pecas={conclusao.pecas}
          categoriasDeVenda={conclusao.categoriasDeVenda}
          categoriaPecasProntasId={conclusao.categoriaPecasProntasId}
          aoFechar={() => setAberturaDaConclusao(null)}
        />
      ) : null}
      <ConfirmarDesfazer
        ordemId={ordemId}
        tipo={tipo}
        alvo={alvo}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
      />
    </>
  );
}
