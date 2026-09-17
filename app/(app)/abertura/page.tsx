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
import {
  contarCotacoesPorCategoria,
  listarCategoriasDeCotacao,
  listarCotacoesDaCategoria,
  obterCategoriaDeCotacao,
  obterCotacao,
  type CategoriaDeCotacao,
} from "@/lib/cotacoes/consultas";
import { FRASE_VAZIO_SEM_CATEGORIA_CORPO, FRASE_VAZIO_SEM_CATEGORIA_TITULO, ROTULO_NOVA_CATEGORIA } from "@/lib/cotacoes/textos";
import { AbasAbertura } from "@/components/amassa/abertura/abas-abertura";
import { FormularioItem } from "@/components/amassa/abertura/formulario-item";
import { FormularioTarefa } from "@/components/amassa/abertura/formulario-tarefa";
import { ListaItens } from "@/components/amassa/abertura/lista-itens";
import { ListaMeses } from "@/components/amassa/abertura/lista-meses";
import { ListaTarefas } from "@/components/amassa/abertura/lista-tarefas";
import { PainelResumo } from "@/components/amassa/abertura/painel-resumo";
import { BotaoVazioCotacoes } from "@/components/amassa/cotacoes/botao-vazio-cotacoes";
import { ConfirmarRemoverCategoria } from "@/components/amassa/cotacoes/confirmar-remover-categoria";
import { ProvedorNavegacaoCotacoes } from "@/components/amassa/cotacoes/contexto-cotacoes";
import { DialogoCategoria } from "@/components/amassa/cotacoes/dialogo-categoria";
import { FormularioCotacao } from "@/components/amassa/cotacoes/formulario-cotacao";
import { PainelCotacoes } from "@/components/amassa/cotacoes/painel-cotacoes";
import { SubAbasCategorias } from "@/components/amassa/cotacoes/sub-abas-categorias";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// Categoria ativa da aba Cotações: a da URL, OU a primeira por ordem de criação (UI-SPEC
// §"Sub-abas de categoria") — um identificador que não corresponde a nenhuma linha cai na
// primeira em vez de quebrar a página. `null` só quando não existe categoria nenhuma (o
// comparador sobe vazio, D-18 a D-21 retiradas).
function resolverCategoriaAtiva(
  categorias: CategoriaDeCotacao[],
  idDaUrl: string | undefined,
): CategoriaDeCotacao | null {
  if (idDaUrl) {
    const encontrada = categorias.find((categoria) => categoria.id === idDaUrl);
    if (encontrada) {
      return encontrada;
    }
  }
  return categorias[0] ?? null;
}

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
  searchParams: Promise<{
    aba?: string;
    item?: string;
    tarefa?: string;
    categoria?: string;
    cotacao?: string;
    categoriaDialogo?: string;
  }>;
}) {
  await exigirUsuario();
  const {
    aba,
    item: itemParam,
    tarefa: tarefaParam,
    categoria: categoriaParam,
    cotacao: cotacaoParam,
    categoriaDialogo: categoriaDialogoParam,
  } = await searchParams;
  const abaTarefas = aba === "tarefas";
  const abaMeses = aba === "meses";
  const abaCotacoes = aba === "cotacoes";

  // O dia civil de Brasília é calculado UMA VEZ, aqui, na borda — nenhuma função pura abaixo lê
  // o relógio por conta própria (`lib/abertura/prazos.ts`/`lib/abertura/parcelas.ts`).
  const hoje = hojeEmBrasilia(new Date());

  // D-18/ABE-11 (Tarefa 2, 04.2-03-PLAN.md): busca a linha em edição só quando o parâmetro NÃO
  // é o sentinela de criação ("novo"/"nova") — passar isso para `obterItemDeAbertura` faria o
  // `where id = 'novo'` estourar (a coluna é `uuid`). Um identificador que não corresponde a
  // nenhuma linha devolve `null`, e o formulário abre vazio em vez de quebrar a página.
  const idDoItemParaEditar = itemParam && itemParam !== "novo" ? itemParam : null;
  const idDaTarefaParaEditar = tarefaParam && tarefaParam !== "nova" ? tarefaParam : null;
  const idDaCotacaoParaEditar = cotacaoParam && cotacaoParam !== "novo" ? cotacaoParam : null;
  // Tarefa 1 (04.3-02): o mesmo sentinela "nova"/"novo" das outras entidades — "nova" abre
  // `DialogoCategoria` em modo de criação; qualquer outro valor é o identificador da categoria a
  // renomear.
  const idDaCategoriaParaEditar =
    categoriaDialogoParam && categoriaDialogoParam !== "nova" ? categoriaDialogoParam : null;

  // Uma leitura por lista, nunca uma consulta por linha (T-04.2-11) — itens, tarefas, a lista de
  // gestores ativos (D-11) e, quando aplicável, a linha em edição chegam juntos. A data de
  // inauguração (D-17) é lida em `layout.tsx`, não aqui. As categorias e a contagem de cotações
  // (Comparador de Compras, D-02) só são buscadas na aba Cotações — nenhuma leitura a mais nas
  // outras três abas.
  const [
    itens,
    tarefas,
    gestores,
    itemParaEditar,
    tarefaParaEditar,
    categoriasDeCotacao,
    contagemPorCategoria,
    categoriaParaEditar,
  ] = await Promise.all([
    listarItensDaAbertura(),
    listarTarefasDaAbertura(),
    listarGestoresAtivos(),
    idDoItemParaEditar ? obterItemDeAbertura(idDoItemParaEditar) : Promise.resolve(null),
    idDaTarefaParaEditar ? obterTarefaDeAbertura(idDaTarefaParaEditar) : Promise.resolve(null),
    abaCotacoes ? listarCategoriasDeCotacao() : Promise.resolve([]),
    abaCotacoes ? contarCotacoesPorCategoria() : Promise.resolve(new Map<string, number>()),
    abaCotacoes && idDaCategoriaParaEditar
      ? obterCategoriaDeCotacao(idDaCategoriaParaEditar)
      : Promise.resolve(null),
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

  // Categoria ativa e as cotações dela — só quando a aba Cotações está ativa E existe pelo menos
  // uma categoria (o comparador pode subir vazio, D-18 a D-21 retiradas).
  const categoriaAtiva = abaCotacoes ? resolverCategoriaAtiva(categoriasDeCotacao, categoriaParam) : null;
  const [cotacoesDaCategoria, cotacaoParaEditar] =
    abaCotacoes && categoriaAtiva
      ? await Promise.all([
          listarCotacoesDaCategoria(categoriaAtiva.id),
          idDaCotacaoParaEditar ? obterCotacao(idDaCotacaoParaEditar) : Promise.resolve(null),
        ])
      : [[], null];

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

      {abaCotacoes ? (
        // Provedor PRÓPRIO da aba Cotações (D-23), montado SÓ neste ramo — nunca no layout, que
        // serve às outras três abas.
        <ProvedorNavegacaoCotacoes>
          {/* Montados SEMPRE, mesmo sem nenhuma categoria — o botão do estado vazio "+ Nova
              categoria" abre este mesmo diálogo, e a confirmação de remoção só fica alcançável a
              partir de uma categoria que já existe. */}
          <DialogoCategoria categoriaParaEditar={categoriaParaEditar} />
          <ConfirmarRemoverCategoria
            categorias={categoriasDeCotacao}
            contagemPorCategoria={contagemPorCategoria}
          />

          {categoriaAtiva ? (
            <>
              {/* Montado SEMPRE dentro de uma categoria, mesmo com a lista de cotações vazia
                  (achado do 03-06, replicado em toda esta base). */}
              <FormularioCotacao categoriaId={categoriaAtiva.id} cotacaoParaEditar={cotacaoParaEditar} />

              <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
                <SubAbasCategorias
                  categorias={categoriasDeCotacao}
                  categoriaAtiva={categoriaAtiva}
                  contagemPorCategoria={contagemPorCategoria}
                />

                {/* `key` pela categoria: a marcação para comparar (estado de cliente) zera ao
                    trocar de categoria, mesmo comportamento do protótipo. */}
                <PainelCotacoes
                  key={categoriaAtiva.id}
                  categoriaId={categoriaAtiva.id}
                  categoriaNome={categoriaAtiva.nome}
                  cotacoes={cotacoesDaCategoria}
                />
              </div>
            </>
          ) : (
            <EstadoVazio
              testId="cotacoes-vazio-categorias"
              titulo={FRASE_VAZIO_SEM_CATEGORIA_TITULO}
              corpo={FRASE_VAZIO_SEM_CATEGORIA_CORPO}
              botao={<BotaoVazioCotacoes tipo="categoria" rotulo={ROTULO_NOVA_CATEGORIA} />}
            />
          )}
        </ProvedorNavegacaoCotacoes>
      ) : abaMeses ? (
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
