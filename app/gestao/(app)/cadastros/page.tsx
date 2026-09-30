import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { subDaUrl } from "@/lib/cadastros/abas";
import { avisoDaUrl } from "@/lib/cadastros/avisos";
import {
  listarCatalogoCompleto,
  listarCategoriasComUso,
  listarCategoriasParaContaFixa,
  listarCategoriasParaItem,
  listarContasFixas,
  listarInsumosDisponiveis,
  obterTaxaDoCartao,
} from "@/lib/cadastros/consultas";
import {
  TOAST_CATEGORIA_DESATIVADA,
  TOAST_CATEGORIA_REATIVADA,
  TOAST_CONTA_FIXA_DESATIVADA,
  TOAST_CONTA_FIXA_REATIVADA,
  textoContasGeradas,
} from "@/lib/cadastros/textos";
import { mesDaGeracao, mesesParaGeracao } from "@/lib/cadastros/contas-fixas";
import { hojeEmBrasilia, nomeDoMes } from "@/lib/financeiro/formato";
import { parametrosVigentes } from "@/lib/precificacao/consultas";
import { TOAST_HORA_ATUALIZADA } from "@/lib/precificacao/textos";
import { subtrairMeses } from "@/lib/producao/calendario";
import { conclusoesParaAPerda } from "@/lib/producao/consultas";
import { perdaMedida, type PerdaMedida } from "@/lib/producao/perda";
import { AvisoCadastros } from "@/components/amassa/cadastros/aviso-cadastros";
import { BotaoGerarContas } from "@/components/amassa/cadastros/botao-gerar-contas";
import { FormularioTaxa } from "@/components/amassa/cadastros/formulario-taxa";
import { ListaCatalogo } from "@/components/amassa/cadastros/lista-catalogo";
import { ListaCategorias } from "@/components/amassa/cadastros/lista-categorias";
import { ListaContasFixas } from "@/components/amassa/cadastros/lista-contas-fixas";
import { ListaParametros } from "@/components/amassa/cadastros/lista-parametros";
import { SubAbasCadastros } from "@/components/amassa/cadastros/sub-abas-cadastros";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/financeiro/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?sub=` decide qual das CINCO sub-abas aparece (D-03,
// 04.5-02-PLAN.md acrescentou "parametros"); o aviso pós-navegação é resolvido AQUI, no servidor,
// a partir de `?aviso=`/`?quantidade=`/`?mes=` — o texto pronto desce para `AvisoCadastros`, que
// só mostra o toast, nunca monta a frase sozinho.
//
// Catálogo (plano 05) carrega `listarCatalogoCompleto()`/`listarCategoriasParaItem()`/
// `listarInsumosDisponiveis()`, Contas fixas (plano 10) carrega
// `listarContasFixas()`/`listarCategoriasParaContaFixa()`, e Parâmetros (04.5-02) carrega
// `parametrosVigentes(hoje)` — cada uma só na própria sub-aba, mesma disciplina de
// `app/(app)/financeiro/page.tsx` (uma leitura por lista, nunca a mais que a aba atual precisa).
// A perda medida dos últimos 6 meses (D-08, Fase 06.1 plano 12), calculada AQUI, no servidor, e
// passada pronta a `ListaParametros`. Num `try` próprio: se a leitura falhar, só a linha dela mostra
// o erro — os parâmetros continuam na tela (UI-SPEC §Erros).
const MESES_DA_PERDA_MEDIDA = 6;
async function lerPerdaMedida(hoje: string): Promise<PerdaMedida | "erro"> {
  try {
    const conclusoes = await conclusoesParaAPerda(subtrairMeses(hoje, MESES_DA_PERDA_MEDIDA));
    return perdaMedida(conclusoes, hoje, MESES_DA_PERDA_MEDIDA);
  } catch (erro) {
    console.error("Falha ao carregar a perda medida:", erro);
    return "erro";
  }
}

export default async function PaginaCadastros({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; aviso?: string; quantidade?: string; mes?: string }>;
}) {
  await exigirUsuario();

  const { sub, aviso, quantidade, mes } = await searchParams;
  const subAtual = subDaUrl(sub);
  const avisoResolvido = avisoDaUrl({ aviso, quantidade, mes });
  // A faixa que "Gerar as contas de {mês}" oferece (resposta do dono, 2026-09-20): o mês corrente
  // e os onze seguintes, já formatados por extenso — o componente nunca formata data sozinho. O
  // mês PRÉ-SELECIONADO continua o seguinte ao de hoje (`mesDaGeracao`), mantendo o uso de sempre
  // em um toque só.
  const hoje = hojeEmBrasilia(new Date());
  const mesesParaGerar = mesesParaGeracao(hoje).map((chave) => ({ chave, rotulo: nomeDoMes(chave) }));
  const mesInicialParaGerar = mesDaGeracao(hoje);

  const textoDoAviso =
    avisoResolvido?.tipo === "categoria-desativada"
      ? TOAST_CATEGORIA_DESATIVADA
      : avisoResolvido?.tipo === "categoria-reativada"
        ? TOAST_CATEGORIA_REATIVADA
        : avisoResolvido?.tipo === "conta-fixa-desativada"
          ? TOAST_CONTA_FIXA_DESATIVADA
          : avisoResolvido?.tipo === "conta-fixa-reativada"
            ? TOAST_CONTA_FIXA_REATIVADA
            : avisoResolvido?.tipo === "contas-geradas"
              ? textoContasGeradas(avisoResolvido.quantidade, nomeDoMes(avisoResolvido.mes))
              : avisoResolvido?.tipo === "hora-atualizada"
                ? TOAST_HORA_ATUALIZADA
                : null;

  const [
    taxaAtual,
    categorias,
    catalogo,
    categoriasParaItem,
    insumosDisponiveis,
    contasFixas,
    categoriasParaContaFixa,
    parametros,
    perdaMedidaDosParametros,
  ] = await Promise.all([
    subAtual === "taxas" ? obterTaxaDoCartao() : Promise.resolve(null),
    subAtual === "categorias" ? listarCategoriasComUso() : Promise.resolve([]),
    subAtual === "catalogo" ? listarCatalogoCompleto() : Promise.resolve([]),
    subAtual === "catalogo"
      ? listarCategoriasParaItem()
      : Promise.resolve({ vendaveis: [], compraveis: [] }),
    subAtual === "catalogo" ? listarInsumosDisponiveis() : Promise.resolve([]),
    subAtual === "fixas" ? listarContasFixas() : Promise.resolve([]),
    subAtual === "fixas" ? listarCategoriasParaContaFixa() : Promise.resolve([]),
    // "hoje" já calculado acima (`hojeEmBrasilia`) — nunca uma segunda leitura do relógio.
    subAtual === "parametros" ? parametrosVigentes(hoje) : Promise.resolve(null),
    subAtual === "parametros" ? lerPerdaMedida(hoje) : Promise.resolve(null),
  ]);

  return (
    <>
      <AvisoCadastros texto={textoDoAviso} />

      <div className="pt-6">
        <SubAbasCadastros subAtual={subAtual} />
      </div>

      {subAtual === "taxas" ? (
        <FormularioTaxa pontosBaseAtuais={taxaAtual ?? 0} />
      ) : subAtual === "categorias" ? (
        <ListaCategorias categorias={categorias} />
      ) : subAtual === "fixas" ? (
        <ListaContasFixas
          contasFixas={contasFixas}
          categoriasParaContaFixa={categoriasParaContaFixa}
          botaoGerar={
            <BotaoGerarContas
              meses={mesesParaGerar}
              mesInicial={mesInicialParaGerar}
              existeContaAtiva={contasFixas.some((conta) => conta.ativa)}
            />
          }
        />
      ) : subAtual === "parametros" ? (
        // Não-nulo: `parametrosVigentes(hoje)` só é chamada quando `subAtual === "parametros"`,
        // a MESMA condição deste ramo — `Promise.resolve(null)` nunca é o valor aqui.
        <ListaParametros
          resultado={parametros as NonNullable<typeof parametros>}
          perdaMedida={perdaMedidaDosParametros ?? "erro"}
        />
      ) : (
        <ListaCatalogo
          catalogo={catalogo}
          categoriasParaItem={categoriasParaItem}
          insumosDisponiveis={insumosDisponiveis}
        />
      )}
    </>
  );
}
