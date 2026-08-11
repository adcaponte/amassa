import { notFound } from "next/navigation";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { buscarForno } from "@/lib/queimas/consultas";
import { medirForno } from "@/lib/queimas/contador";
import { formatarInstanteCurto } from "@/lib/queimas/formato";
import {
  ROTULO_HISTORICO_MANUTENCOES,
  ROTULO_HISTORICO_QUEIMAS,
  fraseDoRodape,
} from "@/lib/queimas/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { HistoricoManutencoes } from "@/components/amassa/queimas/historico-manutencoes";
import { HistoricoQueimas } from "@/components/amassa/queimas/historico-queimas";
import { Medidor } from "@/components/amassa/queimas/medidor";

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

  const forno = await buscarForno(id);
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
      <CabecalhoPagina titulo={forno.nome} />

      <div className="flex flex-col gap-8 px-6 py-6 md:px-8">
        <section aria-label="Medidor do forno" className="flex flex-col gap-3">
          <Medidor
            contador={medida.contador}
            limite={medida.limite}
            atencao={medida.atencao}
            nivel={medida.nivel}
          />
          <p className="text-apoio text-muted-foreground break-words" data-testid="rodape-forno">
            {rodape}
          </p>
          {forno.descricao && (
            <p className="text-corpo text-muted-foreground break-words">{forno.descricao}</p>
          )}
        </section>

        {/* Manutenções primeiro (é o histórico de vida útil, o propósito do módulo), queimas
            depois. As duas crescem na rolagem vertical da página; nenhuma rolagem horizontal. */}
        <section aria-label={ROTULO_HISTORICO_MANUTENCOES}>
          <h2 className="text-titulo text-foreground mb-3">{ROTULO_HISTORICO_MANUTENCOES}</h2>
          <HistoricoManutencoes manutencoes={forno.manutencoes} />
        </section>

        <section aria-label={ROTULO_HISTORICO_QUEIMAS}>
          <h2 className="text-titulo text-foreground mb-3">{ROTULO_HISTORICO_QUEIMAS}</h2>
          <HistoricoQueimas queimas={forno.queimasRecentes} />
        </section>
      </div>
    </>
  );
}
