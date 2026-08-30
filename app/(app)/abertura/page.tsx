import Link from "next/link";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { formatarReais, hojeEmBrasilia } from "@/lib/abertura/formato";
import {
  listarGestoresAtivos,
  listarItensDaAbertura,
  listarTarefasDaAbertura,
  obterItemDeAbertura,
  obterTarefaDeAbertura,
} from "@/lib/abertura/consultas";
import { totaisComprometidos } from "@/lib/abertura/parcelas";
import { contarTarefasAbertasPorItem } from "@/lib/abertura/prazos";
import {
  ROTULO_COMPROMETIDO,
  ROTULO_NOVA_TAREFA,
  ROTULO_NOVO_ITEM,
  TITULO_MODULO,
} from "@/lib/abertura/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { AbasAbertura } from "@/components/amassa/abertura/abas-abertura";
import { FormularioItem } from "@/components/amassa/abertura/formulario-item";
import { FormularioTarefa } from "@/components/amassa/abertura/formulario-tarefa";
import { ListaItens } from "@/components/amassa/abertura/lista-itens";
import { ListaTarefas } from "@/components/amassa/abertura/lista-tarefas";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/queimas/page.tsx`.
// `searchParams` é `Promise` no Next.js 15 (precisa de `await`, mesmo padrão de
// `app/(app)/encomendas/page.tsx`). `?aba=` decide qual das duas listas aparece (padrão
// "itens"); as duas continuam calculadas no MESMO carregamento (`Promise.all`), o que mantém a
// troca de aba uma navegação de servidor real — nunca dado escondido no cliente — e a URL
// sempre compartilhável.
export default async function PaginaAbertura({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; item?: string; tarefa?: string }>;
}) {
  await exigirUsuario();
  const { aba, item: itemParam, tarefa: tarefaParam } = await searchParams;
  const abaTarefas = aba === "tarefas";

  // O dia civil de Brasília é calculado UMA VEZ, aqui, na borda — nenhuma função pura abaixo lê
  // o relógio por conta própria (`lib/abertura/prazos.ts`/`lib/abertura/parcelas.ts`).
  const hoje = hojeEmBrasilia(new Date());

  // D-18/ABE-11 (Tarefa 2, 04.2-03-PLAN.md): busca a linha em edição só quando o parâmetro NÃO
  // é o sentinela de criação ("novo"/"nova") — passar isso para `obterItemDeAbertura` faria o
  // `where id = 'novo'` estourar (a coluna é `uuid`). Um identificador que não corresponde a
  // nenhuma linha devolve `null`, e o formulário abre vazio em vez de quebrar a página.
  const idDoItemParaEditar = itemParam && itemParam !== "novo" ? itemParam : null;
  const idDaTarefaParaEditar = tarefaParam && tarefaParam !== "nova" ? tarefaParam : null;

  // Uma leitura por lista, nunca uma consulta por linha (T-04.2-11) — itens, tarefas, a lista de
  // gestores ativos (D-11) e, quando aplicável, a linha em edição chegam juntos.
  const [itens, tarefas, gestores, itemParaEditar, tarefaParaEditar] = await Promise.all([
    listarItensDaAbertura(),
    listarTarefasDaAbertura(),
    listarGestoresAtivos(),
    idDoItemParaEditar ? obterItemDeAbertura(idDoItemParaEditar) : Promise.resolve(null),
    idDaTarefaParaEditar ? obterTarefaDeAbertura(idDaTarefaParaEditar) : Promise.resolve(null),
  ]);
  const totais = totaisComprometidos(itens);
  // Contagem de tarefas abertas por item (D-13) a partir das tarefas JÁ carregadas acima —
  // nunca uma segunda consulta por item.
  const contagemDeTarefasAbertas = contarTarefasAbertasPorItem(tarefas);

  return (
    <>
      <CabecalhoPagina titulo={TITULO_MODULO}>
        <Button asChild variant="default" className="min-h-[44px]">
          <Link
            href={abaTarefas ? "/abertura?aba=tarefas&tarefa=nova" : "/abertura?item=novo"}
          >
            {abaTarefas ? ROTULO_NOVA_TAREFA : ROTULO_NOVO_ITEM}
          </Link>
        </Button>
      </CabecalhoPagina>

      {/* Montados SEMPRE — mesmo com a lista vazia, o botão do `EstadoVazio` de cada aba precisa
          abrir o formulário certo a partir do primeiríssimo item/primeiríssima tarefa (achado do
          03-06, replicado em Queimas e nesta fase). */}
      <FormularioItem hoje={hoje} itemParaEditar={itemParaEditar} />
      <FormularioTarefa
        hoje={hoje}
        gestores={gestores}
        itens={itens.map((item) => ({ id: item.id, nome: item.nome }))}
        tarefaParaEditar={tarefaParaEditar}
      />

      <div className="px-6 pt-6 md:px-8" data-testid="abertura-bloco-comprometido">
        <div className="border-border bg-card rounded-lg border p-4 shadow-sm">
          <div className="text-micro text-muted-foreground font-semibold tracking-wide uppercase">
            {ROTULO_COMPROMETIDO}
          </div>
          <div className="text-titulo mt-1 font-bold tabular-nums">
            {formatarReais(totais.comprometidoEmCentavos)}
          </div>
          <div className="text-apoio text-muted-foreground mt-1 tabular-nums">
            <strong className="font-semibold">{formatarReais(totais.aVistaEmCentavos)}</strong> à
            vista ·{" "}
            <strong className="font-semibold">{formatarReais(totais.aPrazoEmCentavos)}</strong> a
            prazo
          </div>
        </div>
      </div>

      <div className="pt-6">
        <AbasAbertura />
      </div>

      {abaTarefas ? (
        <ListaTarefas tarefas={tarefas} hoje={hoje} />
      ) : (
        <ListaItens
          itens={itens}
          hoje={hoje}
          contagemDeTarefasAbertas={contagemDeTarefasAbertas}
        />
      )}
    </>
  );
}
