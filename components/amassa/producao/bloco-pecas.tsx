import { hrefDoCaixa, hrefDoOrcamento } from "@/lib/financeiro/navegacao";
import type { OrigemDaOrdem, PecaDaOrdem } from "@/lib/producao/consultas";
import { horasDaOrdem, horasDaPeca } from "@/lib/producao/horas";
import {
  TEXTO_NO_FINANCEIRO,
  TEXTO_SEM_ESTIMATIVA,
  TEXTO_TRABALHO_ESTIMADO,
  TEXTO_VEIO_DO,
  TITULO_PECAS,
  altDaFotoDeReferencia,
  textoAMais,
  textoHoras,
  textoLinhaDaPeca,
  textoOrcamentoDaOrigem,
  textoSubLinhaDaPeca,
  textoVendaDaOrigem,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CampoAMais } from "./campo-a-mais";

export type BlocoPecasProps = {
  ordemId: string;
  // O campo "fazer a mais, de segurança" só existe em encomenda aguardando o sinal ou ativa (D-15;
  // na casa todas as boas vão para o estoque). Quem decide é a página; o servidor confere de novo.
  podeDefinirAMais: boolean;
  pecas: PecaDaOrdem[];
  // Ids de `orcamento_fotos` — a foto sai pela rota autenticada que já existe; nada é copiado.
  fotos: string[];
  origem: OrigemDaOrdem | null;
};

const CLASSE_LINK = "text-acento font-semibold underline underline-offset-2";

// O bloco "Peças" da página da ordem (UI-SPEC §"Página da ordem → Coluna da direita"): uma linha por
// peça com as horas à direita — o ÚNICO lugar da fase com horas (PRD-05) —, a sub-linha (cor,
// personalização, exclusiva, sem ficha), as fotos de referência do orçamento (72×72, cada uma abre a
// foto inteira em nova aba por `/gestao/api/orcamentos/fotos/{id}` — a rota que já existe, com
// `exigirUsuario()`; nenhum arquivo copiado) e a linha de origem com os links para o orçamento e
// para a venda.
export function BlocoPecas({ ordemId, podeDefinirAMais, pecas, fotos, origem }: BlocoPecasProps) {
  // Horas da ficha × (pedido + a mais) — as a mais dão o mesmo trabalho (`lib/producao/horas.ts`).
  const horasPorPeca = pecas.map(horasDaPeca);
  const horasDaOrdemToda = horasDaOrdem(pecas);

  return (
    <section
      aria-labelledby="ordem-pecas-titulo"
      data-testid="ordem-pecas"
      className="bg-superficie border-borda flex flex-col gap-2 rounded-lg border p-4"
    >
      <h2 id="ordem-pecas-titulo" className="text-titulo text-tinta">
        {TITULO_PECAS}
      </h2>
      <ul className="flex flex-col">
        {pecas.map((peca, indice) => {
          const horas = horasPorPeca[indice];
          return (
            <li
              key={peca.id}
              data-testid="ordem-peca"
              data-peca-id={peca.id}
              className="border-borda flex flex-col gap-1 border-b py-4 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-corpo text-tinta flex min-w-0 flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere]">
                  {textoLinhaDaPeca(peca.quantidade, peca.descricao)}
                  {peca.aMais > 0 ? (
                    <span
                      data-testid="ordem-a-mais-chip"
                      className="text-apoio bg-superficie-2 text-tinta-media rounded-full px-2 py-1 font-semibold whitespace-nowrap"
                    >
                      {textoAMais(peca.aMais)}
                    </span>
                  ) : null}
                </span>
                {horas !== null ? (
                  <span
                    data-testid="ordem-peca-horas"
                    className="text-apoio text-tinta-fraca shrink-0 whitespace-nowrap tabular-nums"
                  >
                    {textoHoras(horas)}
                  </span>
                ) : null}
              </div>
              <span
                data-testid="ordem-peca-sub-linha"
                className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]"
              >
                {textoSubLinhaDaPeca({
                  cor: peca.cor,
                  personalizacao: peca.personalizacao,
                  temFicha: peca.fichaId !== null,
                  exclusiva: peca.exclusiva === true,
                })}
              </span>
              {podeDefinirAMais ? (
                <CampoAMais
                  ordemId={ordemId}
                  pecaId={peca.id}
                  nomeDaPeca={peca.descricao}
                  aMais={peca.aMais}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {fotos.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-2">
          {fotos.map((fotoId, indice) => (
            <a
              key={fotoId}
              data-testid="ordem-foto"
              href={`${rotaDeGestao("/api/orcamentos/fotos")}/${fotoId}`}
              target="_blank"
              rel="noopener"
              className="focus-visible:ring-ring block rounded-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {/* `<img>` puro, como em `fotos-de-referencia.tsx`: a rota autenticada já serve o
                  arquivo no tamanho certo; o otimizador do `next/image` não ajudaria. Tamanho fixo
                  e `overflow-hidden`: foto que não carrega mostra o `alt` dentro da mesma borda. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${rotaDeGestao("/api/orcamentos/fotos")}/${fotoId}`}
                alt={altDaFotoDeReferencia(indice + 1, fotos.length)}
                width={72}
                height={72}
                loading="lazy"
                className="border-borda-forte text-apoio text-tinta-fraca block h-[72px] w-[72px] overflow-hidden rounded-sm border object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}

      <p data-testid="ordem-origem" className="text-apoio text-tinta-fraca pt-2 [overflow-wrap:anywhere]">
        {TEXTO_TRABALHO_ESTIMADO}{" "}
        {horasDaOrdemToda === null ? (
          TEXTO_SEM_ESTIMATIVA
        ) : (
          <span className="text-tinta font-semibold tabular-nums">{textoHoras(horasDaOrdemToda)}</span>
        )}
        {origem ? (
          <>
            {" · "}
            {TEXTO_VEIO_DO}{" "}
            <a
              data-testid="ordem-origem-orcamento"
              href={hrefDoOrcamento(origem.orcamentoId)}
              className={CLASSE_LINK}
            >
              {textoOrcamentoDaOrigem(origem.orcamentoNumero)}
            </a>
            {origem.documentoNumero !== null ? (
              <>
                {" · "}
                <a
                  data-testid="ordem-origem-venda"
                  href={hrefDoCaixa({ parcelaFoco: origem.parcelaDoSinalId })}
                  className={CLASSE_LINK}
                >
                  {textoVendaDaOrigem(origem.documentoNumero)}
                </a>{" "}
                {TEXTO_NO_FINANCEIRO}
              </>
            ) : null}
          </>
        ) : null}
      </p>
    </section>
  );
}
