"use client";

import { useState } from "react";

import type { CategoriaParaEscolha } from "@/lib/financeiro/consultas";
import { formatarReais } from "@/lib/financeiro/formato";
import {
  FRASE_VAZIO_VENDA,
  ROTULO_FORMA,
  ROTULO_LANCAR_VENDA,
  ROTULO_VALOR_LIVRE,
  type FormaDePagamento,
} from "@/lib/financeiro/textos";
import { lancarVenda } from "@/lib/financeiro/acoes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogoValorLivre, type LinhaDeValorLivre } from "./dialogo-valor-livre";

type LinhaDeVendaLocal = {
  chave: string;
  descricao: string;
  categoriaId: string;
  area: string;
  valorCentavos: number;
};

const FORMAS_EM_ORDEM: readonly FormaDePagamento[] = ["dinheiro", "pix", "cartao"];

// Um valor em reais/centavos vira texto com vírgula decimal — o mesmo formato que
// `converterReaisParaCentavos` (lib/financeiro/dinheiro.ts) sabe ler de volta no servidor, sem
// depender de agrupamento de milhar.
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export type PainelVendaProps = {
  hoje: string;
  categorias: CategoriaParaEscolha[];
};

// O painel de venda mínimo do traçado (04.4-01-PLAN.md, Tarefa 1): só "valor livre", à vista,
// UMA parcela paga na data. O catálogo de itens (grade de atalhos) entra no plano 03.
export function PainelVenda({ hoje, categorias }: PainelVendaProps) {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [linhas, setLinhas] = useState<LinhaDeVendaLocal[]>([]);
  const [data, setData] = useState(hoje);
  const [pessoa, setPessoa] = useState("");
  const [forma, setForma] = useState<FormaDePagamento>("pix");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const totalCentavos = linhas.reduce((total, linha) => total + linha.valorCentavos, 0);
  const podeLancar = totalCentavos > 0 && !enviando;

  function adicionarLinha(linha: LinhaDeValorLivre) {
    setLinhas((atual) => [
      ...atual,
      {
        chave: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        descricao: linha.descricao,
        categoriaId: linha.categoriaId,
        area: linha.area,
        valorCentavos: linha.valorCentavos,
      },
    ]);
    setDialogoAberto(false);
  }

  function tirarLinha(chave: string) {
    setLinhas((atual) => atual.filter((linha) => linha.chave !== chave));
  }

  async function aoLancar() {
    setErro(null);
    setEnviando(true);

    const resposta = await lancarVenda({
      data,
      pessoa: pessoa.trim() === "" ? undefined : pessoa,
      linhas: linhas.map((linha) => ({
        tipo: "livre",
        descricao: linha.descricao,
        categoriaId: linha.categoriaId,
        valorTexto: centavosParaTexto(linha.valorCentavos),
      })),
      // À vista: UMA parcela, paga na data do documento (04.4-01-PLAN.md, Tarefa 1).
      parcelas: [
        {
          vencimento: data,
          valorTexto: centavosParaTexto(totalCentavos),
          forma,
          pago: true,
        },
      ],
    });

    setEnviando(false);

    if (!resposta.ok) {
      // Nada do que foi digitado se perde — só o banner de erro aparece dentro do bloco.
      setErro(resposta.erro);
      return;
    }

    // Navegação completa de propósito (nunca `router.push`/`router.refresh`) — a página resolve
    // o aviso no servidor a partir de `?aviso=lancado&documento=<id>`.
    window.location.assign(`/financeiro?aba=venda&aviso=lancado&documento=${resposta.dados.id}`);
  }

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1.15fr_1fr] md:px-8">
      <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-titulo text-foreground">O que foi vendido</h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full md:w-auto"
          onClick={() => setDialogoAberto(true)}
        >
          {ROTULO_VALOR_LIVRE}
        </Button>
      </section>

      <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-titulo text-foreground">Esta venda</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            Data
            <Input
              type="date"
              value={data}
              onChange={(evento) => setData(evento.target.value)}
              className="text-corpo min-h-[44px]"
            />
          </label>
          <label className="text-apoio text-muted-foreground flex flex-col gap-1">
            Pessoa (opcional)
            <Input
              value={pessoa}
              onChange={(evento) => setPessoa(evento.target.value)}
              placeholder="quem comprou"
              className="text-corpo min-h-[44px]"
            />
          </label>
        </div>

        {linhas.length === 0 ? (
          <p className="text-corpo text-muted-foreground">{FRASE_VAZIO_VENDA}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linhas.map((linha) => (
              <li
                key={linha.chave}
                data-testid="venda-linha"
                className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="text-corpo flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(--color-area-${linha.area})` }}
                  />
                  <span className="truncate">{linha.descricao}</span>
                </span>
                <span className="text-corpo tabular-nums">{formatarReais(linha.valorCentavos)}</span>
                <button
                  type="button"
                  onClick={() => tirarLinha(linha.chave)}
                  className="text-apoio text-muted-foreground hover:text-foreground min-h-[44px] shrink-0 px-2"
                >
                  tirar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-border flex items-center justify-between border-t pt-3">
          <span className="text-titulo text-foreground">Total</span>
          <span data-testid="venda-total" className="text-display text-foreground tabular-nums">
            {formatarReais(totalCentavos)}
          </span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-apoio text-muted-foreground">Forma</legend>
          <div className="flex gap-2">
            {FORMAS_EM_ORDEM.map((valor) => (
              <button
                key={valor}
                type="button"
                aria-pressed={forma === valor}
                onClick={() => setForma(valor)}
                className={cn(
                  "text-corpo min-h-[44px] flex-1 rounded-md border px-3",
                  forma === valor
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-secondary text-secondary-foreground",
                )}
              >
                {ROTULO_FORMA[valor]}
              </button>
            ))}
          </div>
        </fieldset>

        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}

        <Button
          type="button"
          variant="default"
          disabled={!podeLancar}
          className="min-h-[44px]"
          onClick={() => void aoLancar()}
        >
          {ROTULO_LANCAR_VENDA}
        </Button>
      </section>

      <DialogoValorLivre
        aberto={dialogoAberto}
        categorias={categorias}
        aoFechar={() => setDialogoAberto(false)}
        aoConfirmar={adicionarLinha}
      />
    </div>
  );
}
