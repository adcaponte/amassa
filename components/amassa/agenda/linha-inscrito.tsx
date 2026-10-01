"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { definirDireitoARepor, definirPresenca } from "@/lib/agenda/acoes";
import type { InscritoCarregado } from "@/lib/agenda/consultas";
import {
  fraseFalhaAoMarcarDireito,
  fraseFalhaAoMarcarPresenca,
  fraseJaVirouVenda,
  ROTULO_DIREITO_A_REPOR,
  ROTULO_FALTOU,
  ROTULO_VEIO,
  ROTULO_VER_NO_CAIXA,
  rotuloPresencaDe,
  TAG_EXPERIMENTAL,
  TAG_REPOSICAO,
} from "@/lib/agenda/textos";
import type { Presenca, TipoEvento } from "@/lib/agenda/tipos";
import { planejarPresenca } from "@/lib/agenda/presenca";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import { ConfirmarTirarDaLista } from "./confirmar-tirar-da-lista";

export type LinhaInscritoProps = {
  inscrito: InscritoCarregado;
  // O tipo da data: só a data de TURMA oferece "tem direito a repor esta aula" (falta em oficina avulsa
  // não gera reposição — BRIEFING §4).
  tipoDoEvento: TipoEvento;
  // Data cancelada: lista só de leitura (sem Veio/Faltou).
  somenteLeitura: boolean;
};

// O que a linha mostra marcado: a presença e o direito a repor, mudados juntos no toque (otimista).
type Marcacao = { presenca: Presenca | null; direito: boolean };

// Uma pessoa na lista "Quem vem" (05-UI-SPEC.md §"Folha do evento", item 4): o nome com quebra
// livre + as tags, e à direita o segmentado "Veio · Faltou". Grava NA HORA e é OTIMISTA (UI-D11):
// `useOptimistic` muda o segmento no toque; enquanto grava, `aria-busy` no grupo; se falhar, o
// otimista se desfaz sozinho ao fim da transição (volta ao que o servidor tem) e a frase de erro
// aparece embaixo da linha. Cada linha tem a sua transição — toques em outras linhas não esperam.
// Tocar no segmento já marcado manda `null` (desmarcar): o cliente manda sempre o estado DESEJADO.
//
// Plano 08: numa data de TURMA, quem está com "Faltou" e não é reposição ganha, na linha de baixo, a
// caixa "tem direito a repor esta aula" (`Checkbox` 20px dentro de `label` de 44px) — grava na hora pelo
// estado desejado, sem toast. Sair de "Faltou" tira a caixa e o direito junto (a mesma regra do servidor,
// `planejarPresenca`). Reposição (e, na Tarefa 3, experimental) ganha "tirar da lista".
export function LinhaInscrito({ inscrito, tipoDoEvento, somenteLeitura }: LinhaInscritoProps) {
  const [marcacao, aplicarOtimista] = useOptimistic<Marcacao, Marcacao>(
    { presenca: inscrito.presenca, direito: inscrito.direitoARepor },
    (_atual, desejada) => desejada,
  );
  const presenca = marcacao.presenca;
  const [gravando, iniciarTransicao] = useTransition();
  const [gravandoDireito, iniciarTransicaoDoDireito] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function marcar(alvo: Presenca) {
    const desejada = presenca === alvo ? null : alvo;
    const planejada = planejarPresenca({ presenca, direitoARepor: marcacao.direito }, desejada);
    setErro(null);
    iniciarTransicao(async () => {
      aplicarOtimista({ presenca: planejada.presenca, direito: planejada.direitoARepor });
      const resultado = await definirPresenca({ inscricaoId: inscrito.id, presenca: desejada });
      if (!resultado.ok) {
        setErro(fraseFalhaAoMarcarPresenca(inscrito.nome));
      }
    });
  }

  function marcarDireito(direito: boolean) {
    setErro(null);
    iniciarTransicaoDoDireito(async () => {
      aplicarOtimista({ presenca: "faltou", direito });
      const resultado = await definirDireitoARepor({ inscricaoId: inscrito.id, direito });
      if (!resultado.ok) {
        setErro(fraseFalhaAoMarcarDireito(inscrito.nome));
      }
    });
  }

  const tag =
    inscrito.tipo === "reposicao" ? TAG_REPOSICAO : inscrito.tipo === "experimental" ? TAG_EXPERIMENTAL : null;
  const mostraDireito =
    !somenteLeitura && tipoDoEvento === "turma" && inscrito.tipo !== "reposicao" && presenca === "faltou";
  const podeTirar = !somenteLeitura && (inscrito.tipo === "oficina" || inscrito.tipo === "reposicao");
  const idDoDireito = `direito-${inscrito.id}`;

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
              data-testid={inscrito.tipo === "reposicao" ? "tag-reposicao" : "tag-experimental"}
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
      {/* A linha de baixo (coluna inteira), numa data de turma, de quem faltou: "tem direito a repor
          esta aula". Marcar duas vezes vale um crédito; desmarcar o tira. */}
      {mostraDireito ? (
        <label
          htmlFor={idDoDireito}
          className="text-apoio text-tinta col-span-2 flex min-h-[44px] items-center gap-3 self-start"
        >
          <Checkbox
            id={idDoDireito}
            data-testid="direito-a-repor"
            checked={marcacao.direito}
            aria-busy={gravandoDireito ? "true" : undefined}
            onCheckedChange={(valor) => marcarDireito(valor === true)}
            className="size-5 shrink-0"
          />
          {ROTULO_DIREITO_A_REPOR}
        </label>
      ) : null}
      {/* A linha de baixo de quem pode sair só desta data (oficina, reposição): "tirar da lista" ou, com
          a venda ativa, a frase da UI-D14 + "ver no Caixa" — um botão que só existiria para ser recusado
          não aparece (o servidor recusa do mesmo jeito se a tela estiver velha). As tags da situação do
          pagamento chegam no plano 11. */}
      {podeTirar ? (
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
            <ConfirmarTirarDaLista
              inscricaoId={inscrito.id}
              nome={inscrito.nome}
              tipo={inscrito.tipo}
              aRepor={inscrito.aRepor}
            />
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
