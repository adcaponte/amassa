import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/abertura/formato";
import {
  listarGestoresAtivos,
  listarItensDaAbertura,
  listarTarefasDaAbertura,
  obterItemDeAbertura,
  obterTarefaDeAbertura,
} from "@/lib/abertura/consultas";
import { fluxoMensal, resumoDoPainel } from "@/lib/abertura/parcelas";
import { contarTarefasAbertasPorItem, contarTarefasLigadasPorItem } from "@/lib/abertura/prazos";
import { AbasAbertura } from "@/components/amassa/abertura/abas-abertura";
import { FormularioItem } from "@/components/amassa/abertura/formulario-item";
import { FormularioTarefa } from "@/components/amassa/abertura/formulario-tarefa";
import { ListaItens } from "@/components/amassa/abertura/lista-itens";
import { ListaMeses } from "@/components/amassa/abertura/lista-meses";
import { ListaTarefas } from "@/components/amassa/abertura/lista-tarefas";
import { PainelResumo } from "@/components/amassa/abertura/painel-resumo";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/queimas/page.tsx`.
// `searchParams` é `Promise` no Next.js 15 (precisa de `await`, mesmo padrão de
// `app/(app)/encomendas/page.tsx`). `?aba=` decide qual das três listas aparece (padrão
// "itens"); todas continuam calculadas no MESMO carregamento (`Promise.all`), o que mantém a
// troca de aba uma navegação de servidor real — nunca dado escondido no cliente — e a URL
// sempre compartilhável.
//
// Cabeçalho, botão "+ Adicionar item/tarefa" e data de inauguração vivem em
// `app/(app)/abertura/layout.tsx`, não aqui — ver o comentário lá e
// .planning/debug/abertura-navegacao-trava.md (o achado quantitativo por trás dessa divisão).
export default async function PaginaAbertura({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; item?: string; tarefa?: string }>;
}) {
  await exigirUsuario();
  const { aba, item: itemParam, tarefa: tarefaParam } = await searchParams;
  const abaTarefas = aba === "tarefas";
  const abaMeses = aba === "meses";

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
  // gestores ativos (D-11) e, quando aplicável, a linha em edição chegam juntos. A data de
  // inauguração (D-17) é lida em `layout.tsx`, não aqui.
  const [itens, tarefas, gestores, itemParaEditar, tarefaParaEditar] = await Promise.all([
    listarItensDaAbertura(),
    listarTarefasDaAbertura(),
    listarGestoresAtivos(),
    idDoItemParaEditar ? obterItemDeAbertura(idDoItemParaEditar) : Promise.resolve(null),
    idDaTarefaParaEditar ? obterTarefaDeAbertura(idDaTarefaParaEditar) : Promise.resolve(null),
  ]);
  // Contagem de tarefas abertas por item (D-13) a partir das tarefas JÁ carregadas acima —
  // nunca uma segunda consulta por item.
  const contagemDeTarefasAbertas = contarTarefasAbertasPorItem(tarefas);
  // Contagem de TODAS as tarefas ligadas por item (D-14, Tarefa 3) — a que a confirmação de
  // remoção mostra ANTES de confirmar, a partir das mesmas tarefas já carregadas.
  const contagemDeTarefasLigadas = contarTarefasLigadasPorItem(tarefas);
  // A visão "Por mês" (D-16, Tarefa 1) e os três blocos do painel (D-15, Tarefa 2) — a MESMA
  // função (`fluxoMensal`) alimenta as duas leituras, nunca uma segunda soma por mês.
  const meses = fluxoMensal(itens, hoje);
  const resumo = resumoDoPainel(itens, tarefas, hoje);

  return (
    <>
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

      <PainelResumo resumo={resumo} />

      <div className="pt-6">
        <AbasAbertura />
      </div>

      {abaMeses ? (
        <ListaMeses meses={meses} />
      ) : abaTarefas ? (
        <ListaTarefas tarefas={tarefas} hoje={hoje} />
      ) : (
        <ListaItens
          itens={itens}
          hoje={hoje}
          contagemDeTarefasAbertas={contagemDeTarefasAbertas}
          contagemDeTarefasLigadas={contagemDeTarefasLigadas}
        />
      )}
    </>
  );
}
