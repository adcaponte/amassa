"use client";

import { useState } from "react";

import { atualizarCabecalhoDoOrcamento } from "@/lib/orcamentos/acoes";
import {
  PLACEHOLDER_TITULO_DO_PEDIDO,
  ROTULO_CLIENTE,
  ROTULO_ENTREGA_PREVISTA,
  ROTULO_LEITURA_PEDIDO,
  ROTULO_LEITURA_VALIDO_ATE,
  ROTULO_TITULO_DO_PEDIDO,
  ROTULO_VALIDADE_DIAS,
  TITULO_PARA_QUEM_E_QUANDO,
} from "@/lib/orcamentos/textos";
import { formatarDataCurta } from "@/lib/financeiro/formato";
import { hrefDoOrcamento } from "@/lib/financeiro/navegacao";

export type CabecalhoDoOrcamentoProps = {
  orcamentoId: string;
  // `false` fora de rascunho — os mesmos dados aparecem como texto simples, sem controle de
  // edição residual (04.5-UI-SPEC.md, "congelamento visual").
  vivo: boolean;
  clienteNome: string | null;
  titulo: string | null;
  entregaPrevista: string;
  validoAte: string;
  validadeDias: number;
};

// "Para quem e para quando" — Client Component (precisa de estado local para os quatro campos e
// de decidir a navegação a partir da resposta do servidor), separado de `EditorOrcamento` (Server
// Component) pela mesma razão de `LinhaDeOrcamento`/`NovoOrcamentoBotao`: um arquivo só tem UM
// limite servidor/cliente, e só este bloco precisa de estado.
export function CabecalhoDoOrcamento({
  orcamentoId,
  vivo,
  clienteNome,
  titulo,
  entregaPrevista,
  validoAte,
  validadeDias,
}: CabecalhoDoOrcamentoProps) {
  const [clienteTexto, setClienteTexto] = useState(clienteNome ?? "");
  const [tituloTexto, setTituloTexto] = useState(titulo ?? "");
  const [entregaTexto, setEntregaTexto] = useState(entregaPrevista);
  const [validadeTexto, setValidadeTexto] = useState(String(validadeDias));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(campos: {
    clienteTexto: string;
    tituloTexto: string;
    entregaTexto: string;
    validadeTexto: string;
  }) {
    setSalvando(true);
    setErro(null);

    const resposta = await atualizarCabecalhoDoOrcamento({
      id: orcamentoId,
      clienteTexto: campos.clienteTexto,
      tituloTexto: campos.tituloTexto,
      entregaTexto: campos.entregaTexto,
      validadeTexto: campos.validadeTexto,
    });

    setSalvando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA — mesma disciplina do resto do módulo.
    window.location.assign(hrefDoOrcamento(orcamentoId));
  }

  if (!vivo) {
    return (
      <section data-testid="orcamento-para-quem" className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-titulo text-foreground">{TITULO_PARA_QUEM_E_QUANDO}</h2>
        <dl className="flex flex-col gap-1">
          {[
            [ROTULO_CLIENTE, clienteNome ?? "—"],
            [ROTULO_LEITURA_PEDIDO, titulo ?? "—"],
            [ROTULO_ENTREGA_PREVISTA, formatarDataCurta(entregaPrevista)],
            [ROTULO_LEITURA_VALIDO_ATE, formatarDataCurta(validoAte)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-3">
              <dt className="text-apoio text-muted-foreground">{rotulo}</dt>
              <dd className="text-corpo text-foreground">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section data-testid="orcamento-para-quem" className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-titulo text-foreground">{TITULO_PARA_QUEM_E_QUANDO}</h2>

      {erro && (
        <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="text-apoio text-muted-foreground flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
          {ROTULO_CLIENTE}
          <input
            data-testid="orcamento-campo-cliente"
            value={clienteTexto}
            disabled={salvando}
            onChange={(evento) => setClienteTexto(evento.target.value)}
            onBlur={() =>
              void salvar({ clienteTexto, tituloTexto, entregaTexto, validadeTexto })
            }
            className="border-border text-corpo min-h-[44px] rounded-md border px-2"
          />
        </label>
        <label className="text-apoio text-muted-foreground flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
          {ROTULO_TITULO_DO_PEDIDO}
          <input
            data-testid="orcamento-campo-titulo"
            placeholder={PLACEHOLDER_TITULO_DO_PEDIDO}
            value={tituloTexto}
            disabled={salvando}
            onChange={(evento) => setTituloTexto(evento.target.value)}
            onBlur={() =>
              void salvar({ clienteTexto, tituloTexto, entregaTexto, validadeTexto })
            }
            className="border-border text-corpo min-h-[44px] rounded-md border px-2"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-apoio text-muted-foreground flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
          {ROTULO_ENTREGA_PREVISTA}
          <input
            data-testid="orcamento-campo-entrega"
            type="date"
            value={entregaTexto}
            disabled={salvando}
            onChange={(evento) => setEntregaTexto(evento.target.value)}
            onBlur={() =>
              void salvar({ clienteTexto, tituloTexto, entregaTexto, validadeTexto })
            }
            className="border-border text-corpo min-h-[44px] rounded-md border px-2"
          />
        </label>
        <label className="text-apoio text-muted-foreground flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
          {ROTULO_VALIDADE_DIAS}
          <input
            data-testid="orcamento-campo-validade"
            inputMode="numeric"
            value={validadeTexto}
            disabled={salvando}
            onChange={(evento) => setValidadeTexto(evento.target.value)}
            onBlur={() =>
              void salvar({ clienteTexto, tituloTexto, entregaTexto, validadeTexto })
            }
            className="border-border text-corpo min-h-[44px] rounded-md border px-2"
          />
        </label>
      </div>
    </section>
  );
}
