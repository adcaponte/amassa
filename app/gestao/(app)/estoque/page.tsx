import { Suspense } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import {
  abaDoEstoqueDaUrl,
  limiteDaUrl,
  periodoDaUrl,
  tipoDoHistoricoDaUrl,
} from "@/lib/estoque/abas";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { AbasEstoque } from "@/components/amassa/estoque/abas-estoque";
import { BannerDoEstoque } from "@/components/amassa/estoque/banner-estoque";
import {
  BarraAcaoFixa,
  BotaoRegistrarMovimentacao,
} from "@/components/amassa/estoque/barra-acao-fixa";
import { CarregadorDoSeletor } from "@/components/amassa/estoque/carregador-do-seletor";
import {
  EsqueletoHistorico,
  EsqueletoParaOndeFoi,
} from "@/components/amassa/estoque/esqueleto-abas";
import { EsqueletoSaldos } from "@/components/amassa/estoque/esqueleto-saldos";
import { ProvedorDoEstoque } from "@/components/amassa/estoque/provedor-estoque";
import { SecaoHistorico } from "@/components/amassa/estoque/secao-historico";
import { SecaoParaOndeFoi } from "@/components/amassa/estoque/secao-para-onde-foi";
import { SecaoSaldos } from "@/components/amassa/estoque/secao-saldos";

type ParametroDaUrl = string | string[] | undefined;

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de toda página da plataforma (T-06-18,
// T-06-32).
//
// De cima para baixo (UI-SPEC §Layout, página `/gestao/estoque`): o cabeçalho, o banner de alerta,
// a barra de abas Saldos · Histórico · Para onde foi (D-11, UI-D1), o conteúdo da aba — cada aba em
// seu próprio `Suspense`, com o esqueleto no formato dela — e a barra de ação fixa do celular. O
// cabeçalho, as abas e a barra fixa não dependem de dado: pintam na primeira renderização e
// continuam utilizáveis quando a consulta de uma aba falha (UI · error · E12).
//
// Tudo fica dentro do `ProvedorDoEstoque` (plano 06-06), o único que abre a folha de movimentação e
// o seletor "Qual material?". A lista de saldos chega a ele pela aba Saldos; nas outras abas, pelo
// `CarregadorDoSeletor` (a MESMA consulta em `cache` da requisição) — assim "Registrar movimentação"
// funciona em qualquer aba. O banner fica ACIMA das abas e é derivado dessa mesma lista: `null`
// enquanto ela não chegou ou quando falhou.
//
// Os parâmetros de URL passam TODOS por `lib/estoque/abas.ts` antes de qualquer consulta (T-06-28,
// T-06-29): aba inválida ou ausente → Saldos; `tipo`, `limite` e `periodo` só em uniões fechadas.
// `?acabando=1` só liga a pílula "Acabando" no cliente; nenhuma consulta muda por ele.
//
// A página reserva embaixo a altura da barra fixa + 16px no celular: a última linha e as notas de
// rodapé nunca ficam atrás dela. "+ Novo material" e "Contar estoque" entram nos planos que
// constroem o destino deles (06-09, 06-10) — botão sem destino é defeito.
export default async function PaginaEstoque({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: ParametroDaUrl;
    tipo?: ParametroDaUrl;
    limite?: ParametroDaUrl;
    periodo?: ParametroDaUrl;
    acabando?: ParametroDaUrl;
  }>;
}) {
  await exigirUsuario();

  const { aba, tipo, limite, periodo, acabando } = await searchParams;
  const abaAtual = abaDoEstoqueDaUrl(aba);

  return (
    <ProvedorDoEstoque>
      <div className="pb-[calc(var(--altura-acao-fixa)+16px)] md:pb-0">
        <CabecalhoPagina titulo="Estoque">
          <BotaoRegistrarMovimentacao />
        </CabecalhoPagina>

        <BannerDoEstoque />

        <div className="pt-6">
          <AbasEstoque abaAtual={abaAtual} />
        </div>

        {abaAtual === "saldos" ? (
          <Suspense fallback={<EsqueletoSaldos />}>
            <SecaoSaldos acabandoInicial={acabando === "1"} />
          </Suspense>
        ) : (
          <>
            <Suspense fallback={null}>
              <CarregadorDoSeletor />
            </Suspense>
            {abaAtual === "historico" ? (
              <Suspense fallback={<EsqueletoHistorico />}>
                <SecaoHistorico tipo={tipoDoHistoricoDaUrl(tipo)} limite={limiteDaUrl(limite)} />
              </Suspense>
            ) : (
              <Suspense fallback={<EsqueletoParaOndeFoi />}>
                <SecaoParaOndeFoi periodo={periodoDaUrl(periodo)} />
              </Suspense>
            )}
          </>
        )}
      </div>
      <BarraAcaoFixa />
    </ProvedorDoEstoque>
  );
}
