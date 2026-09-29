import { Suspense } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import {
  BarraAcaoFixa,
  BotaoRegistrarMovimentacao,
} from "@/components/amassa/estoque/barra-acao-fixa";
import { EsqueletoSaldos } from "@/components/amassa/estoque/esqueleto-saldos";
import { ProvedorDoEstoque } from "@/components/amassa/estoque/provedor-estoque";
import { SecaoSaldos } from "@/components/amassa/estoque/secao-saldos";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de toda página da plataforma (T-06-18).
//
// O cabeçalho sai na hora; a seção de saldos (lista, banner, contador) carrega dentro de um
// `Suspense` com o esqueleto no formato dela, e cuida do próprio erro (`SecaoSaldos`). O saldo de
// cada material é a SOMA do livro, lida por `listarSaldos` na hora — nunca uma coluna gravada
// (EST-02).
//
// Tudo fica dentro do `ProvedorDoEstoque` (plano 06-06), o único que abre a folha de movimentação
// e o seletor "Qual material?". "Registrar movimentação" existe em dois lugares, cada um numa
// largura: no cabeçalho a partir de 768px e na barra de ação fixa abaixo dele — os dois pintam na
// primeira renderização, sem esperar a lista (a lista chega ao provedor quando a seção resolve).
// A página reserva embaixo a altura da barra fixa + 16px no celular: o último cartão e a nota de
// rodapé nunca ficam atrás dela. "+ Novo material" e "Contar estoque" entram nos planos que
// constroem o destino deles (06-09, 06-10) — botão sem destino é defeito.
//
// `?acabando=1` é o único parâmetro lido (T-06-19): liga a pílula "Acabando" no cliente, nenhuma
// consulta muda por ele; qualquer outro valor é ignorado.
export default async function PaginaEstoque({
  searchParams,
}: {
  searchParams: Promise<{ acabando?: string | string[] }>;
}) {
  await exigirUsuario();

  const { acabando } = await searchParams;
  const acabandoInicial = acabando === "1";

  return (
    <ProvedorDoEstoque>
      <div className="pb-[calc(var(--altura-acao-fixa)+16px)] md:pb-0">
        <CabecalhoPagina titulo="Estoque">
          <BotaoRegistrarMovimentacao />
        </CabecalhoPagina>
        <Suspense fallback={<EsqueletoSaldos />}>
          <SecaoSaldos acabandoInicial={acabandoInicial} />
        </Suspense>
      </div>
      <BarraAcaoFixa />
    </ProvedorDoEstoque>
  );
}
