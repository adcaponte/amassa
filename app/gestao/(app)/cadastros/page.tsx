import { Suspense } from "react";

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
import { idDaUrl } from "@/lib/agenda/abas";
import { listarClientes } from "@/lib/clientes/consultas";
import { buscaDaUrl, quantosDaUrl } from "@/lib/clientes/lista";
import { FRASE_ERRO_CARREGAR_CLIENTES, TITULO_ERRO } from "@/lib/clientes/textos";
import { hojeEmBrasilia, nomeDoMes } from "@/lib/financeiro/formato";
import { listarFornecedores, obterFornecedor } from "@/lib/fornecedores/consultas";
import {
  FRASE_ERRO_CARREGAR_FICHA,
  FRASE_ERRO_CARREGAR_LISTA,
  FRASE_FICHA_NAO_EXISTE,
  TITULO_ERRO as TITULO_ERRO_FORNECEDORES,
} from "@/lib/fornecedores/textos";
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
import { EsqueletoDosClientes, ListaClientes } from "@/components/amassa/cadastros/lista-clientes";
import { ListaContasFixas } from "@/components/amassa/cadastros/lista-contas-fixas";
import { ListaParametros } from "@/components/amassa/cadastros/lista-parametros";
import { SubAbasCadastros } from "@/components/amassa/cadastros/sub-abas-cadastros";
import {
  EsqueletoDaFicha,
  EsqueletoDosFornecedores,
} from "@/components/amassa/cadastros/fornecedores/esqueleto-fornecedores";
import {
  FichaFornecedor,
  FichaSemFornecedor,
} from "@/components/amassa/cadastros/fornecedores/ficha-fornecedor";
import { ListaFornecedores } from "@/components/amassa/cadastros/fornecedores/lista-fornecedores";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/financeiro/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?sub=` decide qual das SETE sub-abas aparece (D-03,
// 04.5-02-PLAN.md acrescentou "parametros"; a Fase 5, D-01, acrescentou "clientes", que lê também
// `?busca=`/`?quantos=`; a Fase 06.2 acrescentou "fornecedores", que lê `?fornecedor=`); o aviso pós-navegação é resolvido AQUI, no servidor,
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

// Clientes (Fase 5, D-01): a lista carrega dentro de um `Suspense` PRÓPRIO, com o esqueleto no
// formato dela (busca + 6 linhas), e com um `try` próprio — se a leitura falhar, só a sub-aba mostra
// o erro, com a frase dela (backstops E22·loading e E22·error, decisões do 05-04: a UI-SPEC não
// desenhava). O `Suspense` NÃO leva `key` da busca: digitar não troca a lista pelo esqueleto (a
// navegação é transição, a lista velha fica até a nova chegar) e o campo de busca não perde o foco.
async function ClientesCarregados({ busca, quantos }: { busca: string; quantos: number }) {
  let lista: Awaited<ReturnType<typeof listarClientes>>;
  try {
    lista = await listarClientes({ busca, quantos });
  } catch (erro) {
    console.error("Falha ao carregar os clientes:", erro);
    return <EstadoErro titulo={TITULO_ERRO} corpo={FRASE_ERRO_CARREGAR_CLIENTES} acao={<TentarDeNovo />} />;
  }
  return <ListaClientes clientes={lista.clientes} haMais={lista.haMais} busca={busca} quantos={quantos} />;
}

// Fornecedores (Fase 06.2, plano 02 — o traçador): a lista carrega dentro de um `Suspense` PRÓPRIO,
// com o esqueleto no formato da sub-aba e um `try` próprio — se a leitura falhar, só a sub-aba mostra
// o erro (UI E2·error), e as pílulas continuam clicáveis.
//
// Qual ficha abre (06.2-UI-SPEC.md, "Onde o protótipo não vale mais" e §Erros):
//   - sem `?fornecedor=` → o primeiro ATIVO na ordem da lista (alfabética pt-BR, `listarFornecedores`);
//   - `?fornecedor=` com um uuid → aquele (ativo ou desativado); fora do cadastro → a frase de id ruim;
//   - `?fornecedor=` que não é uuid (`idDaUrl`, o mesmo validador da Agenda) → a frase de id ruim,
//     sem consulta nenhuma com o texto da URL (T-06.2-08).
// A ficha carrega num `Suspense` com `key` = id: trocar de fornecedor vira esqueleto SÓ na ficha, e
// a lista (componente de cliente) não remonta.
async function FornecedoresCarregados({ pedido }: { pedido: string | string[] | undefined }) {
  let lista: Awaited<ReturnType<typeof listarFornecedores>>;
  try {
    lista = await listarFornecedores();
  } catch (erro) {
    console.error("Falha ao carregar os fornecedores:", erro);
    return (
      <EstadoErro titulo={TITULO_ERRO_FORNECEDORES} corpo={FRASE_ERRO_CARREGAR_LISTA} acao={<TentarDeNovo />} />
    );
  }

  const semPedido = pedido === undefined || pedido === "";
  const idPedido = semPedido ? null : idDaUrl(pedido);
  const abertoId = semPedido ? (lista.find((fornecedor) => fornecedor.ativo)?.id ?? null) : idPedido;

  if (lista.length === 0) {
    return (
      <div className="mx-6 mt-6 pb-12 md:mx-8">
        <ListaFornecedores fornecedores={lista} abertoId={null} />
      </div>
    );
  }

  return (
    <div className="mx-6 mt-6 grid items-start gap-4 pb-12 md:mx-8 lg:grid-cols-[minmax(300px,0.9fr)_1.4fr]">
      <ListaFornecedores fornecedores={lista} abertoId={abertoId} />
      {abertoId !== null ? (
        <Suspense key={abertoId} fallback={<EsqueletoDaFicha />}>
          <FichaCarregada id={abertoId} />
        </Suspense>
      ) : !semPedido ? (
        <FichaSemFornecedor frase={FRASE_FICHA_NAO_EXISTE} />
      ) : null}
    </div>
  );
}

async function FichaCarregada({ id }: { id: string }) {
  let fornecedor: Awaited<ReturnType<typeof obterFornecedor>>;
  try {
    fornecedor = await obterFornecedor(id);
  } catch (erro) {
    console.error("Falha ao carregar a ficha do fornecedor:", erro);
    return <FichaSemFornecedor frase={FRASE_ERRO_CARREGAR_FICHA} acao={<TentarDeNovo />} />;
  }
  if (fornecedor === null) {
    return <FichaSemFornecedor frase={FRASE_FICHA_NAO_EXISTE} />;
  }
  return <FichaFornecedor fornecedor={fornecedor} />;
}

export default async function PaginaCadastros({
  searchParams,
}: {
  searchParams: Promise<{
    sub?: string;
    aviso?: string;
    quantidade?: string;
    mes?: string;
    busca?: string | string[];
    quantos?: string | string[];
    fornecedor?: string | string[];
  }>;
}) {
  await exigirUsuario();

  const { sub, aviso, quantidade, mes, busca, quantos, fornecedor } = await searchParams;
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

      {subAtual === "fornecedores" ? (
        <Suspense fallback={<EsqueletoDosFornecedores />}>
          <FornecedoresCarregados pedido={fornecedor} />
        </Suspense>
      ) : subAtual === "clientes" ? (
        <Suspense fallback={<EsqueletoDosClientes />}>
          <ClientesCarregados busca={buscaDaUrl(busca)} quantos={quantosDaUrl(quantos)} />
        </Suspense>
      ) : subAtual === "taxas" ? (
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
