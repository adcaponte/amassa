"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { definirPresenca } from "@/lib/agenda/acoes";
import type { InscritoCarregado } from "@/lib/agenda/consultas";
import {
  fraseFalhaAoMarcarPresenca,
  fraseJaVirouVenda,
  ROTULO_FALTOU,
  ROTULO_VEIO,
  ROTULO_VER_NO_CAIXA,
  rotuloPresencaDe,
  TAG_EXPERIMENTAL,
  TAG_REPOSICAO,
} from "@/lib/agenda/textos";
import type { Presenca } from "@/lib/agenda/tipos";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { cn } from "@/lib/utils";

import { ConfirmarTirarDaLista } from "./confirmar-tirar-da-lista";

export type LinhaInscritoProps = {
  inscrito: InscritoCarregado;
  // Data cancelada: lista só de leitura (sem Veio/Faltou).
  somenteLeitura: boolean;
};

// Uma pessoa na lista "Quem vem" (05-UI-SPEC.md §"Folha do evento", item 4): o nome com quebra
// livre + as tags, e à direita o segmentado "Veio · Faltou". Grava NA HORA e é OTIMISTA (UI-D11):
// `useOptimistic` muda o segmento no toque; enquanto grava, `aria-busy` no grupo; se falhar, o
// otimista se desfaz sozinho ao fim da transição (volta ao que o servidor tem) e a frase de erro
// aparece embaixo da linha. Cada linha tem a sua transição — toques em outras linhas não esperam.
// Tocar no segmento já marcado manda `null` (desmarcar): o cliente manda sempre o estado DESEJADO.
export function LinhaInscrito({ inscrito, somenteLeitura }: LinhaInscritoProps) {
  const [presenca, definirPresencaOtimista] = useOptimistic<Presenca | null, Presenca | null>(
    inscrito.presenca,
    (_atual, desejada) => desejada,
  );
  const [gravando, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function marcar(alvo: Presenca) {
    const desejada = presenca === alvo ? null : alvo;
    setErro(null);
    iniciarTransicao(async () => {
      definirPresencaOtimista(desejada);
      const resultado = await definirPresenca({ inscricaoId: inscrito.id, presenca: desejada });
      if (!resultado.ok) {
        setErro(fraseFalhaAoMarcarPresenca(inscrito.nome));
      }
    });
  }

  const tag =
    inscrito.tipo === "reposicao" ? TAG_REPOSICAO : inscrito.tipo === "experimental" ? TAG_EXPERIMENTAL : null;

  return (
    <li
      data-testid="inscrito"
      data-inscricao-id={inscrito.id}
      className="border-borda grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b py-2"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-corpo text-tinta font-semibold break-words">{inscrito.nome}</span>
        {tag ? (
          <span className="flex flex-wrap gap-1">
            <span
              className={cn(
                "text-apoio rounded-sm px-2 font-semibold",
                inscrito.tipo === "reposicao"
                  ? "bg-atencao-fundo text-atencao"
                  : "bg-superficie-2 text-tinta-media",
              )}
            >
              {tag}
            </span>
          </span>
        ) : null}
      </div>
      {somenteLeitura ? null : (
        <div
          role="group"
          aria-label={rotuloPresencaDe(inscrito.nome)}
          aria-busy={gravando}
          className="flex"
        >
          <BotaoDoSegmento
            testId="presenca-veio"
            rotulo={ROTULO_VEIO}
            marcado={presenca === "veio"}
            classeMarcado="bg-sucesso-fundo text-sucesso"
            Icone={Check}
            posicao="primeiro"
            aoTocar={() => marcar("veio")}
          />
          <BotaoDoSegmento
            testId="presenca-faltou"
            rotulo={ROTULO_FALTOU}
            marcado={presenca === "faltou"}
            classeMarcado="bg-erro-fundo text-erro"
            Icone={X}
            posicao="ultimo"
            aoTocar={() => marcar("faltou")}
          />
        </div>
      )}
      {/* A linha de baixo (coluna inteira) da inscrição de oficina: "tirar da lista" ou, com a venda
          ativa, a frase da UI-D14 + "ver no Caixa" — um botão que só existiria para ser recusado não
          aparece (o servidor recusa do mesmo jeito se a tela estiver velha). As tags da situação do
          pagamento chegam no plano 11; reposição e experimental, no plano 08. */}
      {!somenteLeitura && inscrito.tipo === "oficina" ? (
        <div className="col-span-2 flex flex-col">
          {inscrito.venda !== null && !inscrito.venda.cancelada ? (
            <p data-testid="venda-ativa" className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">
              {fraseJaVirouVenda(inscrito.venda.numero)}{" "}
              <Link
                href={hrefDoCaixa()}
                className="text-tinta-media inline-flex min-h-[44px] items-center underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              >
                {ROTULO_VER_NO_CAIXA}
              </Link>
            </p>
          ) : (
            <ConfirmarTirarDaLista inscricaoId={inscrito.id} nome={inscrito.nome} />
          )}
        </div>
      ) : null}
      {erro ? (
        <p role="alert" className="text-apoio text-erro col-span-2">
          {erro}
        </p>
      ) : null}
    </li>
  );
}

function BotaoDoSegmento({
  testId,
  rotulo,
  marcado,
  classeMarcado,
  Icone,
  posicao,
  aoTocar,
}: {
  testId: string;
  rotulo: string;
  marcado: boolean;
  classeMarcado: string;
  Icone: typeof Check;
  posicao: "primeiro" | "ultimo";
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={marcado}
      onClick={aoTocar}
      className={cn(
        "border-borda-forte text-corpo inline-flex min-h-[44px] items-center gap-1 border px-4",
        "focus-visible:ring-ring focus-visible:relative focus-visible:ring-2 focus-visible:outline-none",
        posicao === "primeiro" ? "rounded-l-sm" : "-ml-px rounded-r-sm",
        marcado ? cn(classeMarcado, "font-semibold") : "bg-superficie text-tinta-media font-normal",
      )}
    >
      {marcado ? <Icone aria-hidden="true" className="size-4" /> : null}
      {rotulo}
    </button>
  );
}
