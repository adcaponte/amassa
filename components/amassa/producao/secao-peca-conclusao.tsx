"use client";

import { useRef, type KeyboardEvent, type Ref } from "react";

import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  derivarPeca,
  destinoSugerido,
  distribuirExtras,
  type DestinoDasExtras,
  type PecaDerivada,
} from "@/lib/producao/conclusao";
import type { PecaParaConcluir } from "@/lib/producao/consultas";
import type { TipoOrdem } from "@/lib/producao/etapas";
import {
  DICA_CUSTO_FICHA_NAO_CALCULA,
  DICA_CUSTO_SEM_FICHA,
  ROTULO_BOAS,
  ROTULO_CUSTO_DE_CADA_PECA,
  ROTULO_ENTRAM_NO_ESTOQUE,
  ROTULO_ENTREGUES_AO_CLIENTE,
  ROTULO_EXTRAS_BOAS,
  ROTULO_PERDIDAS,
  ROTULO_QUANTAS_SE_PERDERAM,
  ROTULO_SEM_DESTINO,
  TEXTO_EXCLUSIVA_NAO_VOU_VENDER,
  TEXTO_NAO_VOU_VENDER,
  TEXTO_VOCE_DIZ_O_CUSTO,
  ariaQuantasSePerderam,
  rotuloDestinoDasExtras,
  textoCustoPelaFicha,
  textoParteDeTotal,
  textoExtrasSemFicha,
  textoFaltamParaCompletar,
  textoFeitas,
  textoItemVaiControlarEstoque,
  textoPedidoEFeitas,
  textoPerdidasDeFeitas,
  textoPreviaDoCusto,
} from "@/lib/producao/textos";
import { cn } from "@/lib/utils";

// O que a pessoa digitou/escolheu numa peça. `destino` nulo = a sugestão (`destinoSugerido`).
export type ValoresDaPeca = {
  perdidasTexto: string;
  destino: DestinoDasExtras | null;
  custoTexto: string;
};

// A leitura da peça pelo MESMO módulo puro que o servidor roda de novo sob a trava
// (`lib/producao/conclusao.ts`, briefing §7). Vazio conta como 0 (o padrão); qualquer coisa que não
// seja só dígitos vira `NaN`, que `derivarPeca` recusa com "Diga um número de 0 a {feitas}.".
export function lerPeca(
  peca: PecaParaConcluir,
  tipo: TipoOrdem,
  valores: ValoresDaPeca,
): {
  derivada: PecaDerivada | { ok: false; frase: string };
  destino: DestinoDasExtras;
  paraEstoque: number;
  semDestino: number;
  faltam: number;
  precisaDeCusto: boolean;
} {
  const limpo = valores.perdidasTexto.trim();
  const perdidas = limpo === "" ? 0 : /^\d{1,9}$/.test(limpo) ? Number(limpo) : Number.NaN;
  const derivada = derivarPeca({ tipo, pedido: peca.quantidade, aMais: peca.aMais, perdidas });
  const temFicha = peca.fichaId !== null;
  const exclusiva = peca.exclusiva === true;
  const sugerido = destinoSugerido({ tipo, exclusiva, temFicha });
  // Sem ficha e exclusiva (até o plano 12) só vão a "sem destino"; na casa, sempre ao Estoque.
  const destino: DestinoDasExtras =
    tipo === "casa" ? "estoque" : !temFicha || exclusiva ? "sem_destino" : (valores.destino ?? sugerido);
  if (!derivada.ok) {
    return { derivada, destino, paraEstoque: 0, semDestino: 0, faltam: 0, precisaDeCusto: false };
  }
  const { paraEstoque, semDestino } = distribuirExtras(derivada, destino, tipo);
  return {
    derivada,
    destino,
    paraEstoque,
    semDestino,
    faltam: derivada.faltam,
    precisaDeCusto: paraEstoque > 0 && peca.custoPelaFichaCentavos === null,
  };
}

export type SecaoPecaConclusaoProps = {
  peca: PecaParaConcluir;
  tipo: TipoOrdem;
  valores: ValoresDaPeca;
  aoMudar: (valores: ValoresDaPeca) => void;
  // As frases de erro desta peça (do servidor ou da conferência antes de enviar).
  erros: { perdidas?: string; destino?: string; custo?: string };
  desabilitado: boolean;
  campoPerdidasRef: Ref<HTMLInputElement>;
  // O Enter do "Quantas se perderam" leva à próxima peça (`enterKeyHint="next"`).
  aoAvancar: () => void;
};

// Uma peça da folha de conclusão (UI-SPEC §"Folha de conclusão"): o nome (Corpo 600, quebra livre) e,
// à direita, "pedido {q} · fez {f}" (casa: "fez {f}"); o campo "Quantas se perderam" (padrão 0); as
// contas derivadas numa lista `aria-live`; a caixa "Faltam…"; o destino das extras (encomenda com
// extras boas); o "Custo de cada peça" quando a ficha não dá custo (D-14); a caixa do D-13.
export function SecaoPecaConclusao({
  peca,
  tipo,
  valores,
  aoMudar,
  erros,
  desabilitado,
  campoPerdidasRef,
  aoAvancar,
}: SecaoPecaConclusaoProps) {
  const botoesDoDestino = useRef<Record<DestinoDasExtras, HTMLButtonElement | null>>({
    estoque: null,
    sem_destino: null,
  });
  const lida = lerPeca(peca, tipo, valores);
  const feitas = peca.quantidade + peca.aMais;
  const idBase = `conclusao-${peca.id}`;
  const temFicha = peca.fichaId !== null;
  const exclusiva = peca.exclusiva === true;
  const derivada = lida.derivada.ok ? lida.derivada : null;
  const erroDasPerdidas = erros.perdidas ?? (lida.derivada.ok ? undefined : lida.derivada.frase);

  const custo = converterReaisParaCentavos(valores.custoTexto);
  const custoDigitado = custo.ok && custo.centavos !== null && custo.centavos > 0 ? custo.centavos : null;

  // Setas movem a escolha do destino (padrão de `radiogroup`).
  function aoTeclarNoDestino(evento: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(evento.key)) {
      return;
    }
    evento.preventDefault();
    const novo: DestinoDasExtras = lida.destino === "estoque" ? "sem_destino" : "estoque";
    aoMudar({ ...valores, destino: novo });
    botoesDoDestino.current[novo]?.focus();
  }

  function opcaoDoDestino(valor: DestinoDasExtras, rotulo: string, linhaDeBaixo: string) {
    const marcado = lida.destino === valor;
    return (
      <button
        key={valor}
        ref={(elemento) => {
          botoesDoDestino.current[valor] = elemento;
        }}
        type="button"
        role="radio"
        aria-checked={marcado}
        tabIndex={marcado ? 0 : -1}
        disabled={desabilitado}
        data-testid={`conclusao-destino-${peca.id}-${valor}`}
        onClick={() => aoMudar({ ...valores, destino: valor })}
        onKeyDown={aoTeclarNoDestino}
        className={cn(
          "flex min-h-[52px] flex-col items-start justify-center gap-0.5 rounded-md border px-4 py-2 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
          marcado
            ? "bg-acento border-acento text-white"
            : "bg-superficie border-borda-forte text-tinta",
        )}
      >
        <span className="text-corpo font-semibold">{rotulo}</span>
        <span className={cn("text-apoio", marcado ? "text-white" : "text-tinta-media")}>
          {linhaDeBaixo}
        </span>
      </button>
    );
  }

  const mostrarDestino = tipo === "encomenda" && derivada !== null && derivada.extrasBoas > 0;

  return (
    <section
      data-testid={`conclusao-peca-${peca.id}`}
      data-custo-pela-ficha={peca.custoPelaFichaCentavos ?? ""}
      aria-labelledby={`${idBase}-nome`}
      className="border-borda flex flex-col gap-3 border-b py-4 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          id={`${idBase}-nome`}
          className="text-corpo text-tinta min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]"
        >
          {peca.descricao}
        </h3>
        <span className="text-apoio text-tinta-fraca shrink-0 whitespace-nowrap tabular-nums">
          {tipo === "encomenda"
            ? textoPedidoEFeitas(peca.quantidade, feitas)
            : textoFeitas(feitas)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${idBase}-perdidas`} className="text-corpo text-tinta">
            {ROTULO_QUANTAS_SE_PERDERAM}
          </label>
          <input
            id={`${idBase}-perdidas`}
            ref={campoPerdidasRef}
            data-testid={`conclusao-perdidas-${peca.id}`}
            type="text"
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            aria-label={ariaQuantasSePerderam(peca.descricao)}
            aria-invalid={erroDasPerdidas !== undefined}
            aria-describedby={erroDasPerdidas ? `${idBase}-erro-perdidas` : undefined}
            disabled={desabilitado}
            value={valores.perdidasTexto}
            placeholder="0"
            onChange={(evento) => aoMudar({ ...valores, perdidasTexto: evento.target.value })}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                // Nunca conclui pelo Enter (não se desfaz): leva à próxima peça.
                evento.preventDefault();
                aoAvancar();
              }
            }}
            className="border-borda-forte bg-superficie text-tinta focus-visible:ring-ring h-11 w-24 rounded-md border px-2 text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none aria-invalid:border-erro"
          />
        </div>
        {erroDasPerdidas ? (
          <p
            id={`${idBase}-erro-perdidas`}
            role="alert"
            data-testid={`conclusao-erro-perdidas-${peca.id}`}
            className="text-apoio text-erro"
          >
            {erroDasPerdidas}
          </p>
        ) : null}
      </div>

      <ul
        aria-live="polite"
        data-testid={`conclusao-contas-${peca.id}`}
        className="text-apoio text-tinta-media flex flex-col gap-1"
      >
        {derivada ? (
          tipo === "encomenda" ? (
            <>
              <li>
                {ROTULO_ENTREGUES_AO_CLIENTE}{" "}
                <strong className="text-tinta font-semibold">
                  {textoParteDeTotal(derivada.entregues, peca.quantidade)}
                </strong>
              </li>
              <li>
                {ROTULO_EXTRAS_BOAS}{" "}
                <strong className="text-tinta font-semibold">{derivada.extrasBoas}</strong>
              </li>
              <li>
                {ROTULO_PERDIDAS} {textoPerdidasDeFeitas(derivada.perdidas, derivada.feitas)}
              </li>
            </>
          ) : (
            <>
              <li>
                {ROTULO_BOAS} <strong className="text-tinta font-semibold">{derivada.boas}</strong>
              </li>
              <li>
                {ROTULO_PERDIDAS} {textoPerdidasDeFeitas(derivada.perdidas, derivada.feitas)}
              </li>
            </>
          )
        ) : null}
      </ul>

      {derivada && derivada.faltam > 0 ? (
        <p
          data-testid="conclusao-faltam"
          className="bg-erro-fundo text-erro text-apoio rounded-md p-3 font-semibold"
        >
          {textoFaltamParaCompletar(derivada.faltam)}
        </p>
      ) : null}

      {mostrarDestino && derivada ? (
        !temFicha ? (
          <p data-testid={`conclusao-sem-ficha-${peca.id}`} className="text-apoio text-tinta-media">
            {textoExtrasSemFicha(derivada.extrasBoas)}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p id={`${idBase}-destino-rotulo`} className="text-corpo text-tinta font-semibold">
              {rotuloDestinoDasExtras(derivada.extrasBoas)}
            </p>
            <div
              role="radiogroup"
              aria-labelledby={`${idBase}-destino-rotulo`}
              aria-describedby={erros.destino ? `${idBase}-erro-destino` : undefined}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {exclusiva
                ? // A opção "Entram no Estoque" da exclusiva chega com o passo "Transformar em peça
                  // de linha" (plano 12, D-12). Até lá, só "sem destino".
                  opcaoDoDestino("sem_destino", ROTULO_SEM_DESTINO, TEXTO_EXCLUSIVA_NAO_VOU_VENDER)
                : [
                    opcaoDoDestino(
                      "estoque",
                      ROTULO_ENTRAM_NO_ESTOQUE,
                      peca.custoPelaFichaCentavos !== null
                        ? textoCustoPelaFicha(formatarReais(peca.custoPelaFichaCentavos))
                        : TEXTO_VOCE_DIZ_O_CUSTO,
                    ),
                    opcaoDoDestino("sem_destino", ROTULO_SEM_DESTINO, TEXTO_NAO_VOU_VENDER),
                  ]}
            </div>
            {erros.destino ? (
              <p id={`${idBase}-erro-destino`} role="alert" className="text-apoio text-erro">
                {erros.destino}
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {lida.precisaDeCusto ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-custo`} className="text-corpo text-tinta font-semibold">
            {ROTULO_CUSTO_DE_CADA_PECA}
          </label>
          <p id={`${idBase}-custo-dica`} className="text-apoio text-tinta-fraca">
            {temFicha ? DICA_CUSTO_FICHA_NAO_CALCULA : DICA_CUSTO_SEM_FICHA}
          </p>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-corpo text-tinta-media">
              R$
            </span>
            <input
              id={`${idBase}-custo`}
              data-testid={`conclusao-custo-${peca.id}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-required="true"
              aria-invalid={erros.custo !== undefined}
              aria-describedby={[`${idBase}-custo-dica`, erros.custo ? `${idBase}-erro-custo` : null]
                .filter(Boolean)
                .join(" ")}
              disabled={desabilitado}
              value={valores.custoTexto}
              onChange={(evento) => aoMudar({ ...valores, custoTexto: evento.target.value })}
              className="border-borda-forte bg-superficie text-tinta focus-visible:ring-ring h-11 w-36 rounded-md border px-2 text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none aria-invalid:border-erro"
            />
          </div>
          <p
            aria-live="polite"
            data-testid={`conclusao-custo-previa-${peca.id}`}
            className="text-apoio text-tinta-media"
          >
            {custoDigitado !== null
              ? textoPreviaDoCusto(
                  lida.paraEstoque,
                  formatarReais(custoDigitado),
                  formatarReais(custoDigitado * lida.paraEstoque),
                )
              : null}
          </p>
          {erros.custo ? (
            <p
              id={`${idBase}-erro-custo`}
              role="alert"
              data-testid={`conclusao-erro-custo-${peca.id}`}
              className="text-apoio text-erro"
            >
              {erros.custo}
            </p>
          ) : null}
        </div>
      ) : null}

      {lida.paraEstoque > 0 && peca.item !== null && !peca.item.controlaEstoque ? (
        <p
          data-testid={`conclusao-liga-estoque-${peca.id}`}
          className="bg-superficie-2 text-tinta-media text-apoio rounded-md p-3 [overflow-wrap:anywhere]"
        >
          {textoItemVaiControlarEstoque(peca.item.nome)}
        </p>
      ) : null}
    </section>
  );
}
