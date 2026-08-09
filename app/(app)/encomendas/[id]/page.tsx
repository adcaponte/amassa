import { notFound } from "next/navigation";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { DIAS_PADRAO, calcularCronograma, situacaoEm } from "@/lib/encomendas/cronograma";
import { hojeEmBrasilia } from "@/lib/encomendas/formato";
import { buscarEncomenda } from "@/lib/encomendas/consultas";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { AcoesEncomenda } from "@/components/amassa/encomendas/acoes-encomenda";
import { TrilhaEtapas } from "@/components/amassa/encomendas/trilha-etapas";

// `exigirUsuario()` como PRIMEIRA instrução — regra do CLAUDE.md, verificada por
// `npm run verificar-acoes`. `params` é `Promise` no Next.js 15 (precisa de `await`). A
// encomenda tem endereço próprio (D-01): URL compartilhável, botão voltar do celular
// funcionando de verdade, sem disputar espaço com o Gantt do índice.
export default async function PaginaDetalheEncomenda({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirUsuario();
  const { id } = await params;

  const encomenda = await buscarEncomenda(id);
  if (!encomenda) {
    // T-03-29: um `id` malformado e um `id` que nunca existiu respondem igual — sem mensagem
    // diferenciada entre os dois casos (03-CONTEXT.md, disposition "accept"). Sobe para
    // `app/(app)/not-found.tsx`, o 404 do grupo protegido.
    notFound();
  }

  // `hoje` calculado no SERVIDOR (Brasília) e passado para baixo como string — o cliente nunca
  // decide qual é o dia de hoje (03-CONTEXT.md, canonical refs).
  const hoje = hojeEmBrasilia(new Date());
  const cronograma = calcularCronograma(
    encomenda.dataInicio,
    encomenda.etapas.length > 0
      ? encomenda.etapas.map((etapa) => ({ etapa: etapa.etapa, dias: etapa.dias }))
      : DIAS_PADRAO,
  );
  const situacao = situacaoEm(cronograma, encomenda.status, hoje);

  return (
    <>
      <CabecalhoPagina titulo={encomenda.nome}>
        <AcoesEncomenda
          id={encomenda.id}
          nome={encomenda.nome}
          quantidadeDeItens={encomenda.itens.length}
        />
      </CabecalhoPagina>

      <div className="flex flex-col gap-8 px-6 py-6 md:px-8">
        <TrilhaEtapas
          encomendaId={encomenda.id}
          status={encomenda.status}
          cronograma={cronograma}
          situacao={situacao}
        />

        <section aria-label="Itens da encomenda">
          <h2 className="text-titulo text-foreground mb-3">Itens</h2>
          <ul className="flex flex-col gap-2">
            {encomenda.itens.map((item) => (
              <li
                key={item.id}
                className="text-corpo text-foreground border-border flex items-start justify-between gap-4 border-b py-2 last:border-b-0"
              >
                <span className="break-words">{item.descricao}</span>
                <span className="text-mono text-muted-foreground tabular-nums shrink-0">
                  {item.quantidade}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
