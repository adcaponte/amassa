import { Suspense } from "react";
import { notFound } from "next/navigation";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { buscarForno, carregarDadosDaFolha } from "@/lib/queimas/consultas";
import { medirForno } from "@/lib/queimas/contador";
import { formatarInstanteCurto, hojeEmBrasilia } from "@/lib/queimas/formato";
import {
  ROTULO_HISTORICO_MANUTENCOES,
  ROTULO_HISTORICO_QUEIMAS,
  ROTULO_VER_OS_NUMEROS,
  fraseDaContagemAteManutencao,
  fraseDoRodape,
} from "@/lib/queimas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { AcoesForno } from "@/components/amassa/queimas/acoes-forno";
import { FormularioForno } from "@/components/amassa/queimas/formulario-forno";
import { HistoricoManutencoes } from "@/components/amassa/queimas/historico-manutencoes";
import { HistoricoQueimas } from "@/components/amassa/queimas/historico-queimas";
import { Medidor } from "@/components/amassa/queimas/medidor";
import {
  EsqueletoDosNumerosDoForno,
  NumerosDoForno,
} from "@/components/amassa/queimas/numeros-do-forno";
import { RegistrarManutencao } from "@/components/amassa/queimas/registrar-manutencao";
import { SeletorQueimas } from "@/components/amassa/queimas/seletor-queimas";

// `exigirUsuario()` como PRIMEIRA instrução — regra do CLAUDE.md, mesmo molde de
// `app/(app)/encomendas/[id]/page.tsx`. `params` é `Promise` no Next.js 15. O forno tem endereço
// próprio (D-01): URL compartilhável, botão voltar do celular funcionando de verdade — é também
// a rota que D-02/D-03 pressupõem (editar, desativar, reativar e registrar manutenção vão morar
// aqui, plano 04-04).
export default async function PaginaDetalheDoForno({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuario();
  const { id } = await params;

  // Fase 06.4: os dados da folha "O que queimou?" (régua vigente, se há mais de um forno), UMA vez por
  // carga, por `Promise.allSettled` — como no índice: se falharem, o Histórico continua e só os botões
  // de contar e corrigir somem (UI-D19).
  const hoje = hojeEmBrasilia(new Date());
  const [forno, [dados]] = await Promise.all([
    buscarForno(id),
    Promise.allSettled([carregarDadosDaFolha(hoje)]),
  ]);
  if (dados.status === "rejected") {
    console.error("Falha ao carregar os dados da folha de contagem no detalhe do forno:", dados.reason);
  }
  const dadosDaFolha = dados.status === "fulfilled" ? dados.value : null;
  if (!forno) {
    // Um `id` malformado e um `id` que nunca existiu respondem igual — sobe para
    // `app/(app)/not-found.tsx`, o 404 do grupo protegido (mesmo contrato de
    // `app/(app)/encomendas/[id]/page.tsx`).
    notFound();
  }

  // O medidor é o foco primário desta tela (04-UI-SPEC.md §"Visual Hierarchy") — decidido pelo
  // módulo puro `lib/queimas/contador.ts`, nunca por este componente nem pela consulta.
  const medida = medirForno({
    limite: forno.limite,
    ocorrenciasDeQueima: forno.ocorrenciasDeQueima,
    ultimaManutencaoEm: forno.ultimaManutencaoEm,
  });

  const dataDaUltimaManutencao = forno.ultimaManutencaoEm
    ? formatarInstanteCurto(forno.ultimaManutencaoEm)
    : null;
  const rodape = fraseDoRodape({
    data: dataDaUltimaManutencao,
    responsavel: forno.ultimaManutencaoResponsavel,
    total: medida.total,
  });

  return (
    <>
      <CabecalhoPagina titulo={forno.nome}>
        <AcoesForno id={forno.id} nome={forno.nome} ativo={forno.ativo} />
      </CabecalhoPagina>

      {/* Seletor de topo (D-01, plano 04-06) — "Fornos" fica ativo aqui também (o detalhe do
          forno é a mesma seção do índice, só "Relatórios" é a outra). */}
      <SeletorQueimas />

      {/* D-02: editar acontece nesta mesma página, aberto por `?editar` (AcoesForno) — nunca
          numa tela de cadastro separada. Montado sempre, mesmo fechado, no molde de
          `FormularioForno` em `/queimas` (achado do 03-06). */}
      <FormularioForno fornoParaEditar={forno} />

      <div className="flex flex-col gap-8 px-6 py-6 md:px-8">
        <section aria-label="Medidor do forno" className="flex flex-col gap-3">
          <Medidor
            contador={medida.contador}
            limite={medida.limite}
            atencao={medida.atencao}
            nivel={medida.nivel}
          />
          {/* Fase 06.4 (QMC-09, UI-D1/UI-D3): a mesma linha do cartão e, logo abaixo, o salto para os
              Números deste forno, no fim da página. */}
          <div className="flex flex-col items-start">
            <p data-testid="contagem-forno" className="text-apoio text-tinta-media break-words">
              {fraseDaContagemAteManutencao(medida.contador, medida.limite)}
            </p>
            <a
              href="#numeros-do-forno"
              data-testid="ver-os-numeros"
              className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {ROTULO_VER_OS_NUMEROS}
            </a>
          </div>
          <p className="text-apoio text-muted-foreground break-words" data-testid="rodape-forno">
            {rodape}
          </p>
          {forno.descricao && (
            <p className="text-corpo text-muted-foreground break-words">{forno.descricao}</p>
          )}

          {/* Foco secundário da tela (04-UI-SPEC.md §"Visual Hierarchy"), logo abaixo do
              medidor — único botão de acento (terracota) desta página (D-03: o cartão do índice
              nunca monta este componente, "Registrar manutenção" existe só aqui). */}
          <div>
            <RegistrarManutencao fornoId={forno.id} contadorAtual={medida.contador} />
          </div>
        </section>

        {/* Manutenções primeiro (é o histórico de vida útil, o propósito do módulo), queimas
            depois. As duas crescem na rolagem vertical da página; nenhuma rolagem horizontal. */}
        <section aria-label={ROTULO_HISTORICO_MANUTENCOES}>
          <h2 className="text-titulo text-foreground mb-3">{ROTULO_HISTORICO_MANUTENCOES}</h2>
          <HistoricoManutencoes manutencoes={forno.manutencoes} />
        </section>

        <section aria-label={ROTULO_HISTORICO_QUEIMAS}>
          <h2 className="text-titulo text-foreground mb-3">{ROTULO_HISTORICO_QUEIMAS}</h2>
          <HistoricoQueimas
            queimas={forno.queimasRecentes}
            nomeDoForno={forno.nome}
            fornoId={forno.id}
            dadosDaFolha={dadosDaFolha}
          />
        </section>

        {/* Fase 06.4, plano 06 — os Números deste forno (QMC-09, QMC-10; D-01), no fim. `Suspense` e
            `try` próprios: a leitura dos números nunca atrasa nem derruba o medidor, a manutenção e o
            Histórico acima (T-06.4-36). */}
        <Suspense fallback={<EsqueletoDosNumerosDoForno />}>
          <NumerosDoForno fornoId={forno.id} hoje={hoje} />
        </Suspense>
      </div>
    </>
  );
}
