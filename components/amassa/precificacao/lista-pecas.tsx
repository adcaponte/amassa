import Link from "next/link";

import {
  calcularPeca,
  farolDoPreco,
  type FarolDoPreco,
  type ParametrosDoCalculo,
} from "@/lib/precificacao/calculo";
import type { FichaDaLista, ParametrosVigentesResultado } from "@/lib/precificacao/consultas";
import {
  paraContagemInformada,
  paraFichaDeCalculo,
  paraMedidasDaPeca,
  resultadoDaFicha,
  type FichaEmEdicao,
} from "@/lib/precificacao/ficha";
import { quantasCabem, type MedidasUteisDoForno } from "@/lib/precificacao/forno";
import { formatarReais } from "@/lib/financeiro/formato";
import { hrefDaAbaPecas } from "@/lib/precificacao/navegacao";
import {
  DICA_RODAPE_PECAS,
  ETIQUETA_EXCLUSIVA,
  FRASE_ERRO_CORPO,
  FRASE_ERRO_TITULO,
  FRASE_VAZIO_PECAS_CORPO,
  FRASE_VAZIO_PECAS_TITULO,
  ROTULO_ABRIR_PECA,
  ROTULO_NOVA_PECA,
  ROTULO_TENTAR_DE_NOVO,
  TEXTO_FAROL,
  TEXTO_SEM_PRECO_DEFINIDO,
  TITULO_LISTA_PECAS,
  linhaDeApoioDaPeca,
  rotuloAlternarExclusivas,
} from "@/lib/precificacao/textos";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { ConfirmarApagarPeca } from "./confirmar-apagar-peca";

export type ListaPecasProps = {
  // TODAS as fichas (exclusivas inclusas) — quem decide o que aparece é este componente
  // (`mostrarExclusivas`), nunca uma segunda consulta ao alternar (D-19).
  fichas: FichaDaLista[];
  mostrarExclusivas: boolean;
  parametros: ParametrosVigentesResultado;
};

const HREF_NOVA_PECA = "/financeiro?aba=pecas&peca=novo";

// Mesma paleta de `components/amassa/precificacao/selo-de-preco.tsx::CLASSE_DO_FAROL`,
// redeclarada aqui (D-15 do projeto: cada módulo tem sua própria cópia) — o selo da LISTA é um
// selo compacto (`peca-selo`), diferente do bloco cheio (`ficha-selo`) do diálogo.
const CLASSE_DO_FAROL: Record<Exclude<FarolDoPreco, null>, string> = {
  verde: "bg-sucesso-fundo text-sucesso",
  amarelo: "bg-atencao-fundo text-atencao",
  vermelho: "bg-erro-fundo text-erro",
};

type LinhaResolvida = {
  custoCentavos: number | null;
  minimoCentavos: number | null;
  farol: FarolDoPreco;
};

// A MESMA cadeia que `DialogoFicha` chama ao vivo (quantasCabem → calcularPeca → farolDoPreco →
// resultadoDaFicha) — nunca uma segunda fórmula de preço escrita na lista. Os campos que essa
// cadeia não lê (nome, preço de mercado, exclusiva, categoria) recebem um valor qualquer: as
// funções puras de `lib/precificacao/ficha.ts` não os tocam (comentário delas mesmas).
function resolverLinha(
  ficha: FichaDaLista,
  parametros: ParametrosDoCalculo,
  forno: MedidasUteisDoForno,
  taxaCartaoPontosBase: number,
): LinhaResolvida {
  const fichaParaCalculo: FichaEmEdicao = {
    nome: ficha.nome,
    argilaMiligramas: ficha.argilaMiligramas,
    esmalteMiligramas: ficha.esmalteMiligramas,
    horasMilesimos: ficha.horasMilesimos,
    larguraMm: ficha.larguraMm,
    profundidadeMm: ficha.profundidadeMm,
    alturaMm: ficha.alturaMm,
    embalagemCentavos: ficha.embalagemCentavos,
    cabemBiscoitoInformado: ficha.cabemBiscoitoInformado,
    cabemEsmalteInformado: ficha.cabemEsmalteInformado,
    precoMercadoCentavos: null,
    precoPraticadoCentavos: ficha.precoPraticadoEfetivoCentavos,
    exclusiva: ficha.exclusiva,
    categoriaVendaId: null,
  };

  const cabem = quantasCabem(
    paraMedidasDaPeca(fichaParaCalculo),
    forno,
    paraContagemInformada(fichaParaCalculo),
  );
  const dadosParaCalculo = paraFichaDeCalculo(fichaParaCalculo);
  const resultadoDireto = calcularPeca({
    ficha: dadosParaCalculo,
    cabem,
    parametros,
    taxaCartaoPontosBase,
    canal: "direto",
  });
  const resultadoGaleria = calcularPeca({
    ficha: dadosParaCalculo,
    cabem,
    parametros,
    taxaCartaoPontosBase,
    canal: "galeria",
  });
  const farol = resultadoDireto.ok
    ? farolDoPreco(
        ficha.precoPraticadoEfetivoCentavos,
        resultadoDireto.minimoCentavos,
        resultadoDireto.zeroCentavos,
      )
    : null;

  const resultado = resultadoDaFicha({ cabem, resultadoDireto, resultadoGaleria, farol });

  if (!resultado.ok) {
    // Medidas gravadas que não cabem no forno de hoje, ou parâmetros que não fecham (D-11/D-12) —
    // a linha mostra "—" em vez de inventar um número, nunca trava a lista inteira por causa de
    // UMA peça.
    return { custoCentavos: null, minimoCentavos: null, farol: null };
  }
  return {
    custoCentavos: resultado.custoCentavos,
    minimoCentavos: resultado.minimoCentavos,
    farol: resultado.farol,
  };
}

function cabecalho() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-titulo text-foreground">{TITULO_LISTA_PECAS}</h2>
      <a
        href={HREF_NOVA_PECA}
        data-testid="nova-peca"
        className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
      >
        {ROTULO_NOVA_PECA}
      </a>
    </div>
  );
}

// Server Component (nenhum estado, nenhum efeito) — mesmo molde de `ListaOrcamentos`/
// `ListaCatalogo`: cabeçalho + botão quando populada, `EstadoVazio` + botão quando vazia, erro
// quando os parâmetros do cálculo não carregaram (04.5-UI-SPEC.md §Copywriting, "Error — carregar
// tela").
export function ListaPecas({ fichas, mostrarExclusivas, parametros }: ListaPecasProps) {
  if (!parametros.ok) {
    return (
      <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
        {cabecalho()}
        <div className="flex flex-col items-start gap-2">
          <p className="text-corpo text-foreground">{FRASE_ERRO_TITULO}</p>
          <p className="text-apoio text-muted-foreground">{FRASE_ERRO_CORPO}</p>
          <a
            href="/financeiro?aba=pecas"
            className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
          >
            {ROTULO_TENTAR_DE_NOVO}
          </a>
        </div>
      </div>
    );
  }

  if (fichas.length === 0) {
    return (
      <EstadoVazio
        testId="pecas-vazio"
        titulo={FRASE_VAZIO_PECAS_TITULO}
        corpo={FRASE_VAZIO_PECAS_CORPO}
        botao={
          <a
            href={HREF_NOVA_PECA}
            data-testid="nova-peca"
            className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
          >
            {ROTULO_NOVA_PECA}
          </a>
        }
      />
    );
  }

  const fichasExclusivas = fichas.filter((ficha) => ficha.exclusiva);
  const fichasVisiveis = mostrarExclusivas ? fichas : fichas.filter((ficha) => !ficha.exclusiva);
  const hrefAlternador = `/financeiro?aba=pecas&exclusivas=${mostrarExclusivas ? "0" : "1"}`;

  return (
    <div className="flex flex-col gap-4 px-6 py-6 md:px-8" data-testid="pecas-lista">
      {cabecalho()}

      <ul className="flex flex-col gap-1">
        {fichasVisiveis.map((ficha) => {
          const { custoCentavos, minimoCentavos, farol } = resolverLinha(
            ficha,
            parametros.calculo,
            parametros.forno,
            parametros.taxaCartaoPontosBase,
          );

          return (
            <li
              key={ficha.id}
              data-testid="peca-linha"
              className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  {/* `nome` isolado no PRÓPRIO `<span>` (nunca junto da etiqueta) — mesmo molde de
                      `lista-catalogo.tsx`: um `getByText(nome, { exact: true })` precisa achar um
                      elemento cujo texto seja SÓ o nome, nunca "{nome}exclusiva" concatenado. */}
                  <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <span className="text-corpo text-foreground break-words">{ficha.nome}</span>
                    {ficha.exclusiva && (
                      <span
                        data-testid="peca-etiqueta-exclusiva"
                        className="text-apoio bg-secondary text-secondary-foreground rounded-full px-2 py-0.5"
                      >
                        {ETIQUETA_EXCLUSIVA}
                      </span>
                    )}
                  </div>
                  <span className="text-apoio text-muted-foreground tabular-nums">
                    {ficha.precoPraticadoEfetivoCentavos !== null
                      ? formatarReais(ficha.precoPraticadoEfetivoCentavos)
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-apoio text-muted-foreground">
                    {linhaDeApoioDaPeca(
                      custoCentavos !== null ? formatarReais(custoCentavos) : "—",
                      minimoCentavos !== null ? formatarReais(minimoCentavos) : "—",
                    )}
                  </span>
                  <span
                    data-testid="peca-selo"
                    className={`text-apoio rounded-full px-2 py-0.5 ${
                      farol ? CLASSE_DO_FAROL[farol] : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {farol ? TEXTO_FAROL[farol] : TEXTO_SEM_PRECO_DEFINIDO}
                  </span>
                </div>
              </div>

              {/* `exclusivas` PRESERVADO: sem ele, abrir uma peça exclusiva já jogava a lista de
                  volta para o modo que a esconde (achado 8 da verificação humana, 04.5-14). */}
              <a
                href={hrefDaAbaPecas({ peca: ficha.id, mostrarExclusivas })}
                className="text-corpo hover:bg-muted flex min-h-[44px] flex-none items-center rounded-md px-3 font-medium"
              >
                {ROTULO_ABRIR_PECA}
              </a>
            </li>
          );
        })}
      </ul>

      {/* Os diálogos de confirmação são montados a partir de TODAS as fichas, nunca só das
          visíveis — "o que aparece na lista" e "o que tem diálogo montado" são coisas
          diferentes. Enquanto estavam dentro do `map` de `fichasVisiveis`, a ficha EXCLUSIVA
          não tinha diálogo no DOM sem `?exclusivas=1`, ninguém lia o `?apagarPeca=`, e o botão
          "Apagar" da ficha não fazia nada (achado 8 da verificação humana, 04.5-14).
          Montar sempre não mostra nada a mais: cada instância lê o PRÓPRIO `?apagarPeca=` e só
          abre quando o id bate (confirmar-apagar-peca.tsx). O gatilho de verdade continua sendo
          o botão "Apagar" dentro de `DialogoFicha`, que só navega. */}
      {fichas.map((ficha) => (
        <ConfirmarApagarPeca key={ficha.id} id={ficha.id} nome={ficha.nome} />
      ))}

      {fichasExclusivas.length > 0 && (
        <div className="flex justify-start">
          <Link
            href={hrefAlternador}
            data-testid="pecas-alternar-exclusivas"
            className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3 font-medium"
          >
            {rotuloAlternarExclusivas(mostrarExclusivas, fichasExclusivas.length)}
          </Link>
        </div>
      )}

      <p className="text-apoio text-muted-foreground">{DICA_RODAPE_PECAS}</p>
    </div>
  );
}
