import type { ReactNode } from "react";

import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { formatarDataCurta, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { itensDeVende } from "@/lib/fornecedores/busca";
import type { FichaDoFornecedor } from "@/lib/fornecedores/consultas";
import type { AreaDoFornecedor } from "@/lib/fornecedores/esquemas";
import { FRASE_SEM_OBSERVACAO, ROTULO_OBSERVACOES, rodapeDaFicha } from "@/lib/fornecedores/textos";
import { cn } from "@/lib/utils";

import { AcoesDaFicha, type FornecedorDaFicha } from "./acoes-da-ficha";
import { ContatosFornecedor } from "./contatos-fornecedor";
import { SeloDesativado } from "./lista-fornecedores";
import { NavegacaoDaFicha } from "./navegacao-da-ficha";

// O ponto de cor da etiqueta de área (`--color-area-*`, tokens existentes; decorativo — o nome da
// área está escrito ao lado). Classes inteiras, para o Tailwind achar cada uma.
const PONTO_DA_AREA: Record<AreaDoFornecedor, string> = {
  pecas: "bg-area-pecas",
  cafeteria: "bg-area-cafeteria",
  loja: "bg-area-loja",
  espaco: "bg-area-espaco",
  geral: "bg-area-geral",
};

// Etiquetas e selo: Apoio, `rounded-full`, `py-1 px-2` (4 × 8 — UI-D26).
const CLASSE_DA_ETIQUETA = "text-apoio bg-superficie-2 text-tinta-media inline-flex items-center gap-1 rounded-full px-2 py-1";

// O que os botões da ficha recebem (componente de cliente): os valores atuais como a folha "Editar
// fornecedor" os mostra — texto, nunca `null` — mais o id e o estado. Só campos simples: nada de `Date`
// atravessando para o cliente.
function paraAsAcoes(fornecedor: FichaDoFornecedor): FornecedorDaFicha {
  return {
    id: fornecedor.id,
    ativo: fornecedor.ativo,
    nome: fornecedor.nome,
    vende: fornecedor.vende ?? "",
    area: fornecedor.area,
    cidadeEntrega: fornecedor.cidadeEntrega ?? "",
    whatsapp: fornecedor.whatsapp ?? "",
    pessoaContato: fornecedor.pessoaContato ?? "",
    email: fornecedor.email ?? "",
    site: fornecedor.site ?? "",
    pagamentoPrazo: fornecedor.pagamentoPrazo ?? "",
    observacoes: fornecedor.observacoes ?? "",
  };
}

// A ficha de leitura de um fornecedor (06.2-UI-SPEC.md §"Página — Cadastros → Fornecedores", Bloco
// Ficha). Server Component: só desenha o que a página leu. Plano 03: "Voltar à lista" (só abaixo de
// 1024 px), cabeçalho (nome + selo; etiquetas de "vende" e a de área com o ponto), contatos,
// observações e o rodapé do plano 02. Plano 04: "Editar" e "Desativar"/"Reativar" (`AcoesDaFicha`, à
// direita do cabeçalho). A tabela vigente e os anexos são do 06, as compras do 11.
//
// `aria-labelledby` = o `h2` do nome (`tabIndex={-1}`: o foco vai a ele ao trocar de ficha —
// `NavegacaoDaFicha`). O selo fica FORA do `h2`: o nome acessível do título é só o nome.
export function FichaFornecedor({ fornecedor }: { fornecedor: FichaDoFornecedor }) {
  // "Cadastrado em" é o dia CIVIL de Brasília do instante gravado — nunca o dia UTC.
  const cadastradoEm = formatarDataCurta(hojeEmBrasilia(fornecedor.criadoEm));
  const etiquetas = itensDeVende(fornecedor.vende);
  const observacoes = fornecedor.observacoes?.trim() ? fornecedor.observacoes : null;

  return (
    <section
      id="ficha-fornecedor"
      aria-labelledby="ficha-fornecedor-nome"
      data-testid="fornecedor-ficha"
      data-fornecedor-id={fornecedor.id}
      className="bg-superficie border-borda flex min-w-0 scroll-mt-4 flex-col gap-4 rounded-xl border p-4"
    >
      <NavegacaoDaFicha id={fornecedor.id} />

      {/* Cabeçalho (`flex-wrap`, `justify-between`): à esquerda o nome, o selo e as etiquetas; à direita
          "Editar" + "Desativar"/"Reativar". O lado do nome tem base de 16rem: a 320 px os botões descem
          para a linha de baixo e o nome de 120 caracteres quebra sem cortar (UI E3/E8). */}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2
              id="ficha-fornecedor-nome"
              tabIndex={-1}
              className="text-titulo text-tinta min-w-0 [overflow-wrap:anywhere] focus-visible:outline-none"
            >
              {fornecedor.nome}
            </h2>
            {fornecedor.ativo ? null : <SeloDesativado testId="fornecedor-selo-desativado" />}
          </div>

          <ul className="flex flex-wrap gap-2" data-testid="fornecedor-etiquetas">
            {etiquetas.map((item, indice) => (
              <li key={`${indice}-${item}`} className={cn(CLASSE_DA_ETIQUETA, "[overflow-wrap:anywhere]")}>
                {item}
              </li>
            ))}
            <li className={CLASSE_DA_ETIQUETA} data-testid="fornecedor-etiqueta-area">
              <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", PONTO_DA_AREA[fornecedor.area])} />
              {ROTULO_AREA[fornecedor.area]}
            </li>
          </ul>
        </div>

        <AcoesDaFicha fornecedor={paraAsAcoes(fornecedor)} />
      </div>

      <ContatosFornecedor fornecedor={fornecedor} />

      <section aria-labelledby="ficha-fornecedor-observacoes" className="flex flex-col gap-2">
        <h3
          id="ficha-fornecedor-observacoes"
          className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
        >
          {ROTULO_OBSERVACOES}
        </h3>
        {observacoes !== null ? (
          <p
            data-testid="fornecedor-observacoes"
            className="text-corpo text-tinta bg-superficie-2 rounded-lg p-3 [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {observacoes}
          </p>
        ) : (
          <p data-testid="fornecedor-sem-observacao" className="text-corpo text-tinta-fraca">
            {FRASE_SEM_OBSERVACAO}
          </p>
        )}
      </section>

      <p className="text-apoio text-tinta-fraca tabular-nums" data-testid="fornecedor-rodape-ficha">
        {rodapeDaFicha(cadastradoEm)}
      </p>
    </section>
  );
}

// A coluna da ficha quando ela não abre um fornecedor: id que não está no cadastro, a leitura que
// falhou (aí com "Tentar de novo"), ou nenhum escolhido ("Toque num fornecedor…", `tracejado` — o
// `vazio` do protótipo). A lista continua ao lado.
export function FichaSemFornecedor({
  frase,
  acao,
  tracejado = false,
}: {
  frase: string;
  acao?: ReactNode;
  tracejado?: boolean;
}) {
  return (
    <section
      role={acao ? "alert" : undefined}
      data-testid="fornecedor-ficha-aviso"
      className={cn(
        "border-borda flex min-w-0 flex-col items-start gap-4 rounded-xl border p-4",
        tracejado ? "border-dashed bg-transparent" : "bg-superficie",
      )}
    >
      <p className="text-corpo text-tinta-media">{frase}</p>
      {acao}
    </section>
  );
}
