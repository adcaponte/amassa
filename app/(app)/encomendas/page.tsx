import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { DIAS_PADRAO, calcularCronograma } from "@/lib/encomendas/cronograma";
import { listarEncomendasDoIndice } from "@/lib/encomendas/consultas";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { Button } from "@/components/ui/button";
import { FormularioEncomenda } from "@/components/amassa/encomendas/formulario-encomenda";

// Converte uma data civil `YYYY-MM-DD` para o formato `DD/MM/YYYY` sem passar por `Date` —
// mesmo motivo de `lib/encomendas/cronograma.ts` (PD-05): um `Date` construído a partir da
// string cruzaria o fuso do runtime e poderia deslocar o dia.
function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// `exigirUsuario()` como PRIMEIRA instrução — regra do CLAUDE.md, verificada por
// `npm run verificar-acoes`. `searchParams` é `Promise` no Next.js 15 (precisa de `await`);
// `?nova` é o contrato de URL de D-03, e nasce aqui.
export default async function PaginaEncomendas({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  await exigirUsuario();
  const { nova } = await searchParams;

  const encomendasDoIndice = await listarEncomendasDoIndice();

  return (
    <>
      <CabecalhoPagina titulo="Encomendas">
        {/* Único botão terracota da tela (03-UI-SPEC.md §Color) — Link, não Button, porque a
            abertura do formulário é um estado endereçável da própria rota (D-03), não um
            diálogo controlado por estado de cliente. */}
        <Button asChild variant="default" className="min-h-[44px]">
          <Link href="/encomendas?nova">Nova encomenda</Link>
        </Button>
      </CabecalhoPagina>

      {nova !== undefined && <FormularioEncomenda />}

      {encomendasDoIndice.length === 0 ? (
        <EstadoVazio
          titulo="A roda ainda não gira."
          corpo="Quando a primeira encomenda entrar, o cronograma com as seis etapas aparece bem aqui."
          rotuloBotao="Nova encomenda"
        />
      ) : (
        // Lista simples desta fatia — nenhum Gantt, nenhum filtro (plano 02 e 04 trazem isso).
        <ul className="flex flex-col gap-3 px-6 py-6 md:px-8">
          {encomendasDoIndice.map((encomenda) => {
            const cronograma = calcularCronograma(
              encomenda.dataInicio,
              encomenda.etapas.length > 0
                ? encomenda.etapas.map((etapa) => ({ etapa: etapa.etapa, dias: etapa.dias }))
                : DIAS_PADRAO,
            );

            return (
              <li
                key={encomenda.id}
                className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4"
              >
                <span className="text-titulo text-foreground">{encomenda.nome}</span>
                <span className="text-apoio text-muted-foreground">
                  {encomenda.clienteNome ?? "Cliente não informado"} · {encomenda.itens.length}{" "}
                  {encomenda.itens.length === 1 ? "item" : "itens"}
                </span>
                <span className="text-apoio text-muted-foreground">
                  Conclusão prevista:{" "}
                  <span className="font-mono">
                    {cronograma.dataDeConclusao
                      ? formatarDataBr(cronograma.dataDeConclusao)
                      : "sem etapas ativas"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
