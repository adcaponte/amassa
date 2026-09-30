"use client";

import { useRef, useState } from "react";

import { ROTULO_UNIDADE, type Unidade } from "@/lib/cadastros/catalogo";
import { textoDeMilesimos } from "@/lib/estoque/saldo";
import {
  baixadoEmMg,
  situacaoDoMaterial,
  type MaterialDaOrdem,
  type MaterialPrevisto,
  type SituacaoDoMaterial,
} from "@/lib/producao/material";
import { textoDePeso } from "@/lib/producao/peso";
import {
  DICA_MATERIAL,
  FRASE_SEM_MATERIAL_PREVISTO,
  ROTULO_BAIXA_DE_OUTRO_MATERIAL,
  ROTULO_BAIXA_PARCIAL,
  ROTULO_BAIXA_TOTAL,
  ROTULO_DO_MATERIAL,
  TEXTO_PREVISTO_TODO_BAIXADO,
  TITULO_BAIXAS_FEITAS,
  TITULO_MATERIAL,
  ariaLabelBaixa,
  textoBaixadoDoPrevisto,
  textoBaixasEmOutrasUnidades,
  textoFaltamDoPrevisto,
  textoGastouAMais,
  textoPecasSemFichaNoPrevisto,
  textoSubLinhaDaBaixa,
} from "@/lib/producao/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { FolhaBaixa, type PedidoDeBaixa } from "./folha-baixa";

// Uma baixa feita, pronta para a tela: o dia (`dd/mm`, Brasília) já vem calculado no servidor.
export type BaixaNaTela = {
  id: string;
  itemId: string;
  nome: string;
  unidade: Unidade;
  // Com sinal, como gravado (a saída é negativa).
  quantidadeMilesimos: number;
  material: MaterialDaOrdem | null;
  diaMes: string;
  registradoPorNome: string;
};

export type BlocoMaterialProps = {
  ordemId: string;
  // Aguardando ou ativa: os botões de baixa aparecem. Concluída e cancelada: só leitura.
  emAberto: boolean;
  previsto: MaterialPrevisto;
  algumaPecaComFicha: boolean;
  baixas: BaixaNaTela[];
  ultimoItem: Record<MaterialDaOrdem, string | null>;
};

const MATERIAIS: readonly MaterialDaOrdem[] = ["argila", "esmalte"];

const CLASSE_BOTAO = "text-corpo h-auto min-h-[44px] px-4 font-semibold";


function textoDaSituacao(situacao: SituacaoDoMaterial): string {
  if (situacao.tipo === "completo") {
    return TEXTO_PREVISTO_TODO_BAIXADO;
  }
  return situacao.tipo === "passou"
    ? textoGastouAMais(textoDePeso(situacao.diferencaMg))
    : textoFaltamDoPrevisto(textoDePeso(situacao.diferencaMg));
}

// O bloco "Material usado" da ordem (UI-SPEC §"Coluna da direita — Bloco Material usado"): a dica,
// uma linha por material com previsto (esmalte só no caminho completo — o módulo puro já o zera no
// biscoito, Pitfall 9) com "{X} de {Y} kg" e a situação, as notas (peças sem ficha, baixas em outras
// unidades), "Baixas feitas" e os botões — "Baixa parcial" e "Baixa total" (`outline` os dois, UI-D5:
// o terracota da ordem ativa é o "Terminei"; "Baixa total" desabilitado quando nada falta) e
// "+ Dar baixa de outro material". Concluída e cancelada: só leitura.
export function BlocoMaterial({
  ordemId,
  emAberto,
  previsto,
  algumaPecaComFicha,
  baixas,
  ultimoItem,
}: BlocoMaterialProps) {
  const [folha, setFolha] = useState<{ pedido: PedidoDeBaixa; chave: number } | null>(null);
  const ultimaChave = useRef(0);

  const linhas = MATERIAIS.flatMap((material) => {
    const previstoMg = material === "argila" ? previsto.argilaMg : previsto.esmalteMg;
    if (previstoMg <= 0) {
      return [];
    }
    const baixado = baixadoEmMg(baixas, material);
    return [
      {
        material,
        previstoMg,
        baixadoMg: baixado.mg,
        foraDaConta: baixado.foraDaConta,
        situacao: situacaoDoMaterial(previstoMg, baixado.mg),
      },
    ];
  });
  const foraDaConta = linhas.reduce((total, linha) => total + linha.foraDaConta, 0);

  function abrir(pedido: PedidoDeBaixa) {
    ultimaChave.current += 1;
    setFolha({ pedido, chave: ultimaChave.current });
  }

  return (
    <section
      aria-labelledby="ordem-material-titulo"
      data-testid="ordem-material"
      className="bg-superficie border-borda flex flex-col gap-2 rounded-lg border p-4"
    >
      <h2 id="ordem-material-titulo" className="text-titulo text-tinta">
        {TITULO_MATERIAL}
      </h2>
      <p className="text-apoio text-tinta-fraca">{DICA_MATERIAL}</p>

      {linhas.length > 0 ? (
        <ul className="flex flex-col">
          {linhas.map((linha) => (
            <li
              key={linha.material}
              data-testid={`ordem-material-${linha.material}`}
              data-situacao={linha.situacao.tipo}
              className="border-borda flex flex-col gap-2 border-b py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-corpo text-tinta font-semibold">
                  {ROTULO_DO_MATERIAL[linha.material]}
                </span>
                <span
                  data-testid="ordem-material-conta"
                  className="text-corpo text-tinta font-semibold tabular-nums"
                >
                  {textoBaixadoDoPrevisto(textoDePeso(linha.baixadoMg), textoDePeso(linha.previstoMg))}
                </span>
              </div>
              <p
                data-testid="ordem-material-situacao"
                className={cn(
                  "text-apoio",
                  linha.situacao.tipo === "passou"
                    ? "text-atencao font-semibold"
                    : "text-tinta-media",
                )}
              >
                {textoDaSituacao(linha.situacao)}
              </p>
              {emAberto ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`ordem-baixa-parcial-${linha.material}`}
                    aria-label={ariaLabelBaixa(ROTULO_BAIXA_PARCIAL, linha.material)}
                    onClick={() =>
                      abrir({
                        modo: "parcial",
                        material: linha.material,
                        previstoMg: linha.previstoMg,
                        baixadoMg: linha.baixadoMg,
                        itemPreEscolhidoId: ultimoItem[linha.material],
                      })
                    }
                    className={CLASSE_BOTAO}
                  >
                    {ROTULO_BAIXA_PARCIAL}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid={`ordem-baixa-total-${linha.material}`}
                    aria-label={ariaLabelBaixa(ROTULO_BAIXA_TOTAL, linha.material)}
                    disabled={linha.situacao.tipo !== "faltam"}
                    onClick={() =>
                      abrir({
                        modo: "total",
                        material: linha.material,
                        previstoMg: linha.previstoMg,
                        baixadoMg: linha.baixadoMg,
                        itemPreEscolhidoId: ultimoItem[linha.material],
                      })
                    }
                    className={CLASSE_BOTAO}
                  >
                    {ROTULO_BAIXA_TOTAL}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!algumaPecaComFicha ? (
        <p data-testid="ordem-material-sem-previsto" className="text-apoio text-tinta-media">
          {FRASE_SEM_MATERIAL_PREVISTO}
        </p>
      ) : previsto.pecasSemFicha > 0 ? (
        <p data-testid="ordem-material-sem-ficha" className="text-apoio text-tinta-fraca">
          {textoPecasSemFichaNoPrevisto(previsto.pecasSemFicha)}
        </p>
      ) : null}
      {foraDaConta > 0 ? (
        <p data-testid="ordem-material-outras-unidades" className="text-apoio text-tinta-fraca">
          {textoBaixasEmOutrasUnidades(foraDaConta)}
        </p>
      ) : null}

      {baixas.length > 0 ? (
        <div className="flex flex-col gap-1 pt-2">
          <h3 className="text-apoio text-tinta-fraca font-semibold tracking-[0.06em] uppercase">
            {TITULO_BAIXAS_FEITAS}
          </h3>
          <ul data-testid="ordem-baixas-feitas" className="flex flex-col">
            {baixas.map((baixa) => (
              <li
                key={baixa.id}
                data-testid="ordem-baixa-feita"
                className="border-borda flex flex-col gap-1 border-b py-2 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-corpo text-tinta min-w-0 [overflow-wrap:anywhere]">
                    {baixa.nome}
                  </span>
                  <span className="text-corpo text-tinta shrink-0 whitespace-nowrap tabular-nums">
                    {textoDeMilesimos(Math.abs(baixa.quantidadeMilesimos))}{" "}
                    {ROTULO_UNIDADE[baixa.unidade]}
                  </span>
                </div>
                <span className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">
                  {textoSubLinhaDaBaixa(baixa.diaMes, baixa.registradoPorNome)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {emAberto ? (
        <div className="flex pt-2">
          <Button
            type="button"
            variant="outline"
            data-testid="ordem-baixa-outro"
            onClick={() =>
              abrir({
                modo: "outro",
                material: null,
                previstoMg: 0,
                baixadoMg: 0,
                itemPreEscolhidoId: null,
              })
            }
            className={cn(CLASSE_BOTAO, "whitespace-normal")}
          >
            {ROTULO_BAIXA_DE_OUTRO_MATERIAL}
          </Button>
        </div>
      ) : null}

      {folha ? (
        <FolhaBaixa
          key={folha.chave}
          ordemId={ordemId}
          pedido={folha.pedido}
          aoFechar={() => setFolha(null)}
        />
      ) : null}
    </section>
  );
}
