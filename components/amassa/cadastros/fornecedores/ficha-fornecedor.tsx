import type { ReactNode } from "react";

import type { FichaDoFornecedor } from "@/lib/fornecedores/consultas";
import { rodapeDaFicha } from "@/lib/fornecedores/textos";
import { formatarDataCurta, hojeEmBrasilia } from "@/lib/financeiro/formato";

// A ficha de um fornecedor (06.2-UI-SPEC.md §"Página — Cadastros → Fornecedores", Bloco Ficha).
// Server Component: só desenha o que a página leu. Neste plano (o traçador, 06.2-02) a ficha tem o
// `h2` do nome e o rodapé "Cadastrado em…"; o cabeçalho com etiquetas, os contatos e as observações
// são do plano 03, os botões do plano 04, os anexos do 06 e as compras do 11.
//
// `aria-labelledby` = o `h2` do nome (`tabIndex={-1}`: o foco vai a ele ao trocar de ficha — plano
// 03). O nome quebra livre: um nome de 120 caracteres nunca é cortado.
export function FichaFornecedor({ fornecedor }: { fornecedor: FichaDoFornecedor }) {
  // "Cadastrado em" é o dia CIVIL de Brasília do instante gravado — nunca o dia UTC.
  const cadastradoEm = formatarDataCurta(hojeEmBrasilia(fornecedor.criadoEm));

  return (
    <section
      id="ficha-fornecedor"
      aria-labelledby="ficha-fornecedor-nome"
      data-testid="fornecedor-ficha"
      data-fornecedor-id={fornecedor.id}
      className="bg-superficie border-borda flex min-w-0 flex-col gap-4 rounded-xl border p-4"
    >
      <h2
        id="ficha-fornecedor-nome"
        tabIndex={-1}
        className="text-titulo text-tinta [overflow-wrap:anywhere] focus-visible:outline-none"
      >
        {fornecedor.nome}
      </h2>

      <p className="text-apoio text-tinta-fraca tabular-nums" data-testid="fornecedor-rodape-ficha">
        {rodapeDaFicha(cadastradoEm)}
      </p>
    </section>
  );
}

// A coluna da ficha quando ela não abre um fornecedor: id que não está no cadastro, ou a leitura que
// falhou (aí com "Tentar de novo"). A lista continua ao lado.
export function FichaSemFornecedor({ frase, acao }: { frase: string; acao?: ReactNode }) {
  return (
    <section
      role={acao ? "alert" : undefined}
      data-testid="fornecedor-ficha-aviso"
      className="bg-superficie border-borda flex min-w-0 flex-col items-start gap-4 rounded-xl border p-4"
    >
      <p className="text-corpo text-tinta-media">{frase}</p>
      {acao}
    </section>
  );
}
