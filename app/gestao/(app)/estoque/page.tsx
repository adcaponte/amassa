import { Suspense } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EsqueletoSaldos } from "@/components/amassa/estoque/esqueleto-saldos";
import { SecaoSaldos } from "@/components/amassa/estoque/secao-saldos";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de toda página da plataforma (T-06-18).
//
// O cabeçalho sai na hora; a seção de saldos (lista, banner, contador) carrega dentro de um
// `Suspense` com o esqueleto no formato dela, e cuida do próprio erro (`SecaoSaldos`). O saldo de
// cada material é a SOMA do livro, lida por `listarSaldos` na hora — nunca uma coluna gravada
// (EST-02).
//
// `?acabando=1` é o único parâmetro lido (T-06-19): liga a pílula "Acabando" no cliente, nenhuma
// consulta muda por ele; qualquer outro valor é ignorado. As ações do cabeçalho ("Registrar
// movimentação", "+ Novo material", "Contar estoque") entram cada uma no plano que constrói o
// destino dela (06-06, 06-09, 06-10) — botão sem destino é defeito.
export default async function PaginaEstoque({
  searchParams,
}: {
  searchParams: Promise<{ acabando?: string | string[] }>;
}) {
  await exigirUsuario();

  const { acabando } = await searchParams;
  const acabandoInicial = acabando === "1";

  return (
    <>
      <CabecalhoPagina titulo="Estoque" />
      <Suspense fallback={<EsqueletoSaldos />}>
        <SecaoSaldos acabandoInicial={acabandoInicial} />
      </Suspense>
    </>
  );
}
