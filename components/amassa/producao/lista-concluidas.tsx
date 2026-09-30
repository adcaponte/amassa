"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { carregarMaisConcluidas } from "@/lib/producao/acoes";
import { diasEntre } from "@/lib/producao/calendario";
import type { OrdemEncerrada } from "@/lib/producao/consultas";
import {
  ARIA_LISTA_CONCLUIDAS,
  CHIP_CANCELADA,
  CHIP_DA_CASA,
  CHIP_ENTREGA_PARCIAL,
  FRASE_ERRO_CARREGAR_MAIS,
  ROTULO_ABRIR,
  ROTULO_CARREGANDO,
  ROTULO_MOSTRAR_MAIS_50,
  ROTULO_TENTAR_DE_NOVO,
  ariaLabelAbrirOrdem,
  dias,
  textoSubLinhaCancelada,
  textoSubLinhaConcluida,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { Button } from "@/components/ui/button";

const CLASSE_CHIP =
  "text-apoio inline-flex rounded-full px-2 py-1 font-semibold whitespace-nowrap";

function LinhaEncerrada({ ordem }: { ordem: OrdemEncerrada }) {
  const quem = ordem.tipo === "casa" ? CHIP_DA_CASA : (ordem.clienteNome ?? "");
  const concluida = ordem.status === "concluida";
  // "{N} dias" do início ao fim — só a concluída (a cancelada leva o chip no lugar).
  const levou =
    concluida && ordem.inicio !== null && ordem.concluidaEm !== null
      ? Math.max(0, diasEntre(ordem.inicio, ordem.concluidaEm))
      : null;
  return (
    <li
      data-testid="concluidas-linha"
      data-ordem-id={ordem.id}
      data-status={ordem.status}
      className="border-borda flex flex-col gap-3 border-b p-4 last:border-b-0 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <span className="text-corpo text-tinta min-w-0 font-semibold [overflow-wrap:anywhere]">
            {ordem.nome}
          </span>
          {concluida ? (
            levou !== null ? (
              <span
                data-testid="concluidas-dias"
                className="text-corpo text-tinta shrink-0 font-semibold tabular-nums"
              >
                {dias(levou)}
              </span>
            ) : null
          ) : (
            <span className={`${CLASSE_CHIP} bg-superficie-2 text-tinta-media shrink-0`}>
              {CHIP_CANCELADA}
            </span>
          )}
        </div>
        <p className="text-apoio text-tinta-fraca flex flex-wrap items-center gap-x-2 gap-y-1 [overflow-wrap:anywhere]">
          <span data-testid="concluidas-sub-linha" className="tabular-nums">
            {concluida
              ? textoSubLinhaConcluida({
                  quem,
                  boas: ordem.boas,
                  feitas: ordem.feitas,
                  concluidaEm: ordem.concluidaEm ?? "",
                })
              : textoSubLinhaCancelada({
                  quem,
                  canceladaEm: ordem.canceladaEm ?? "",
                  pelaVenda: ordem.canceladaPelaVenda,
                })}
          </span>
          {concluida && ordem.entregaParcial ? (
            <span
              data-testid="concluidas-entrega-parcial"
              className={`${CLASSE_CHIP} bg-atencao-fundo text-atencao`}
            >
              {CHIP_ENTREGA_PARCIAL}
            </span>
          ) : null}
        </p>
      </div>
      <Button
        asChild
        variant="outline"
        className="text-corpo h-auto min-h-[44px] self-start px-4 font-semibold sm:self-center"
      >
        <Link
          href={rotaDeGestao(`/producao/${ordem.id}`)}
          aria-label={ariaLabelAbrirOrdem(ordem.nome)}
          data-testid="concluidas-abrir"
        >
          {ROTULO_ABRIR}
        </Link>
      </Button>
    </li>
  );
}

// A lista das Concluídas e canceladas (UI-SPEC §"Concluídas e canceladas"; UI-D8): as primeiras 50
// chegam do Server Component; "Mostrar mais 50" (só quando há mais) pede as seguintes a
// `carregarMaisConcluidas`. Falhou: a frase de erro com "Tentar de novo" NO LUGAR do botão — as
// linhas já mostradas ficam. A guarda síncrona `emVoo` impede que um toque duplo peça a mesma
// página duas vezes. Sem filtro nesta tela.
export function ListaConcluidas({
  iniciais,
  total,
}: {
  iniciais: OrdemEncerrada[];
  total: number;
}) {
  const [ordens, setOrdens] = useState<OrdemEncerrada[]>(iniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  // Uma página que volta vazia (as encerradas não somem, mas o total é da hora em que a página
  // abriu) encerra a lista — nunca um botão que não traz nada.
  const [acabou, setAcabou] = useState(false);
  const emVoo = useRef(false);

  async function carregarMais() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setCarregando(true);
    setErro(false);
    try {
      const resultado = await carregarMaisConcluidas({ deslocamento: ordens.length });
      if (!resultado.ok) {
        setErro(true);
        return;
      }
      if (resultado.dados.length === 0) {
        setAcabou(true);
        return;
      }
      setOrdens((atuais) => {
        const vistas = new Set(atuais.map((ordem) => ordem.id));
        return [...atuais, ...resultado.dados.filter((ordem) => !vistas.has(ordem.id))];
      });
    } catch {
      setErro(true);
    } finally {
      emVoo.current = false;
      setCarregando(false);
    }
  }

  const haMais = !acabou && ordens.length < total;

  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-label={ARIA_LISTA_CONCLUIDAS}
        data-testid="concluidas-lista"
        className="bg-superficie border-borda flex flex-col rounded-lg border"
      >
        {ordens.map((ordem) => (
          <LinhaEncerrada key={ordem.id} ordem={ordem} />
        ))}
      </ul>
      {erro ? (
        <div
          data-testid="concluidas-erro"
          className="flex flex-col items-start gap-2"
        >
          <p role="alert" className="text-apoio text-erro">
            {FRASE_ERRO_CARREGAR_MAIS}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={carregarMais}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
          >
            {ROTULO_TENTAR_DE_NOVO}
          </Button>
        </div>
      ) : haMais ? (
        <Button
          type="button"
          variant="outline"
          data-testid="concluidas-mais"
          onClick={carregarMais}
          disabled={carregando}
          aria-busy={carregando}
          className="text-corpo h-auto min-h-[44px] self-start px-4 font-semibold"
        >
          {carregando ? ROTULO_CARREGANDO : ROTULO_MOSTRAR_MAIS_50}
        </Button>
      ) : null}
    </div>
  );
}
