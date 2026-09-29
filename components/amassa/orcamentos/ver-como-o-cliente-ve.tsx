"use client";

// A folha A4 na tela — pré-visualização INSTANTÂNEA, montada do `DocumentoDoCliente` que o
// servidor já calculou junto com o resto do editor (04.5-11-PLAN.md, Tarefa 3): nenhuma chamada
// nova ao servidor para abrir esta tela. `EditorOrcamento` monta este componente SEMPRE (ao lado
// do editor normal); este componente decide, sozinho, por `useSearchParams()`, se deve aparecer
// — o mesmo mecanismo de `?atualizarPrecos=1` já usado por `DialogoAtualizarPrecos`
// (`irParaSemNavegar`, `window.history.pushState`), que nunca dispara uma transição RSC e nunca
// esbarra no defeito de confirmação de transição já documentado em
// `.planning/debug/abertura-navegacao-trava.md`.
import { useSearchParams } from "next/navigation";

import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import type { DocumentoDoCliente } from "@/lib/orcamentos/documento-cliente";
import {
  ROTULO_COLUNA_CADA,
  ROTULO_COLUNA_PECA,
  ROTULO_COLUNA_QUANTIDADE,
  ROTULO_TOTAL,
  ROTULO_VOLTAR,
  TITULO_DOCUMENTO_OBSERVACOES,
  TITULO_DOCUMENTO_PAGAMENTO,
  TITULO_DOCUMENTO_PRAZO,
  TITULO_DOCUMENTO_REFERENCIAS,
} from "@/lib/orcamentos/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";

import { BaixarPdf } from "./baixar-pdf";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type VerComoOClienteVeProps = {
  orcamentoId: string;
  documento: DocumentoDoCliente;
};

export function VerComoOClienteVe({ orcamentoId, documento }: VerComoOClienteVeProps) {
  const searchParams = useSearchParams();
  const ativo = searchParams.get("documento") === "1";

  if (!ativo) {
    return null;
  }

  function voltar() {
    irParaSemNavegar(hrefDoOrcamento(orcamentoId));
  }

  return (
    <div className="bg-background fixed inset-0 z-50 overflow-y-auto">
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={voltar}
            className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3"
          >
            {ROTULO_VOLTAR}
          </button>
          <BaixarPdf orcamentoId={orcamentoId} />
        </div>

        <div className="w-full overflow-x-auto">
          <article
            data-testid="folha-a4"
            className="mx-auto flex max-w-[760px] flex-col bg-white p-[clamp(20px,6vw,56px)] text-[14.5px] leading-[1.55] text-[#1D2221] shadow-[0_2px_14px_rgba(0,0,0,.12)]"
          >
            <header className="mb-[18px] flex flex-wrap justify-between gap-4 border-b-2 border-[#894025] pb-[14px]">
              <div className="text-[28px] font-semibold tracking-[0.02em] text-[#894025]">
                AMASSA CERRADO
              </div>
              <div className="text-right">
                <p className="font-bold">{documento.numeroCompleto}</p>
                <p className="text-[13px] text-[#5A4C44]">
                  {documento.dataFormatada}
                  <br />
                  {documento.validoAteTexto}
                </p>
              </div>
            </header>

            <p className="mb-[14px] text-[16px]">{documento.paraTexto}</p>

            <table data-testid="folha-tabela-peca" className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="text-left">{ROTULO_COLUNA_PECA}</th>
                  <th className="text-right">{ROTULO_COLUNA_QUANTIDADE}</th>
                  <th className="text-right">{ROTULO_COLUNA_CADA}</th>
                  <th className="text-right">{ROTULO_TOTAL}</th>
                </tr>
              </thead>
              <tbody>
                {documento.linhas.map((linha, indice) => (
                  <tr key={indice}>
                    <td className="whitespace-normal">
                      {linha.nome}
                      {linha.cor ? (
                        <small className="block text-[12.5px] text-[#6E5F56]">{linha.cor}</small>
                      ) : null}
                      {linha.personalizacao ? (
                        <small className="block text-[12.5px] text-[#6E5F56]">
                          {linha.personalizacao}
                        </small>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{linha.quantidadeTexto}</td>
                    <td className="text-right tabular-nums">{linha.precoUnitarioFormatado}</td>
                    <td className="text-right tabular-nums">{linha.totalFormatado}</td>
                  </tr>
                ))}
                {documento.projeto.map((item, indice) => (
                  <tr key={`projeto-${indice}`}>
                    <td>{item.descricao}</td>
                    <td></td>
                    <td></td>
                    <td className="text-right tabular-nums">{item.valorFormatado}</td>
                  </tr>
                ))}
                {documento.freteFormatado ? (
                  <tr>
                    <td>Frete</td>
                    <td></td>
                    <td></td>
                    <td className="text-right tabular-nums">{documento.freteFormatado}</td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#1D2221] text-[17px]">
                  <td colSpan={3}>{ROTULO_TOTAL}</td>
                  <td data-testid="folha-total" className="text-right tabular-nums">
                    {documento.totalFormatado}
                  </td>
                </tr>
              </tfoot>
            </table>

            {documento.referencias.length > 0 ? (
              <>
                <h2 className="mt-[18px] mb-1 text-[14px] tracking-[0.06em] text-[#894025] uppercase">
                  {TITULO_DOCUMENTO_REFERENCIAS}
                </h2>
                <div data-testid="folha-referencia" className="grid grid-cols-3 gap-2">
                  {documento.referencias.map((referencia) => (
                    <figure key={referencia.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- foto de referência
                          servida por rota autenticada (não é asset otimizável do next/image). */}
                      <img
                        src={`${rotaDeGestao("/api/orcamentos/fotos")}/${referencia.id}`}
                        alt={referencia.legenda ?? "referência"}
                        className="aspect-square w-full rounded border border-[#D8CFC7] object-cover"
                      />
                      {referencia.legenda ? (
                        <figcaption className="text-[12.5px]">{referencia.legenda}</figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              </>
            ) : null}

            <div className="mt-[18px] grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-x-7">
              <div>
                <h2 className="mb-1 text-[14px] tracking-[0.06em] text-[#894025] uppercase">
                  {TITULO_DOCUMENTO_PAGAMENTO}
                </h2>
                {documento.pagamento.map((parcela, indice) => (
                  <p key={indice}>
                    {parcela.rotulo}: <b>{parcela.valorFormatado}</b>
                  </p>
                ))}
              </div>
              <div>
                <h2 className="mb-1 text-[14px] tracking-[0.06em] text-[#894025] uppercase">
                  {TITULO_DOCUMENTO_PRAZO}
                </h2>
                <p>{documento.prazoTexto}</p>
              </div>
            </div>

            {documento.observacoes ? (
              <>
                <h2 className="mt-[18px] mb-1 text-[14px] tracking-[0.06em] text-[#894025] uppercase">
                  {TITULO_DOCUMENTO_OBSERVACOES}
                </h2>
                <p>{documento.observacoes}</p>
              </>
            ) : null}

            <p className="mt-[14px]">{documento.fraseConfirmacao}</p>

            <footer className="mt-[26px] border-t border-[#E8E2DC] pt-3 text-[12.5px] text-[#5A4C44] italic">
              {documento.notaFeitoAMao}
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
