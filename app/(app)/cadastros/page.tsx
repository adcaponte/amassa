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
import { nomeDoMes } from "@/lib/financeiro/formato";
import { AvisoCadastros } from "@/components/amassa/cadastros/aviso-cadastros";
import { FormularioTaxa } from "@/components/amassa/cadastros/formulario-taxa";
import { ListaCatalogo } from "@/components/amassa/cadastros/lista-catalogo";
import { ListaCategorias } from "@/components/amassa/cadastros/lista-categorias";
import { ListaContasFixas } from "@/components/amassa/cadastros/lista-contas-fixas";
import { SubAbasCadastros } from "@/components/amassa/cadastros/sub-abas-cadastros";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/financeiro/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?sub=` decide qual das quatro sub-abas aparece; o
// aviso pós-navegação é resolvido AQUI, no servidor, a partir de `?aviso=`/`?quantidade=`/`?mes=`
// — o texto pronto desce para `AvisoCadastros`, que só mostra o toast, nunca monta a frase
// sozinho.
//
// Catálogo (plano 05) carrega `listarCatalogoCompleto()`/`listarCategoriasParaItem()`/
// `listarInsumosDisponiveis()`, e Contas fixas (plano 10) carrega
// `listarContasFixas()`/`listarCategoriasParaContaFixa()` — cada uma só na própria sub-aba, mesma
// disciplina de `app/(app)/financeiro/page.tsx` (uma leitura por lista, nunca a mais que a aba
// atual precisa).
export default async function PaginaCadastros({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; aviso?: string; quantidade?: string; mes?: string }>;
}) {
  await exigirUsuario();

  const { sub, aviso, quantidade, mes } = await searchParams;
  const subAtual = subDaUrl(sub);
  const avisoResolvido = avisoDaUrl({ aviso, quantidade, mes });

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
              : null;

  const [taxaAtual, categorias, catalogo, categoriasParaItem, insumosDisponiveis, contasFixas, categoriasParaContaFixa] =
    await Promise.all([
      subAtual === "taxas" ? obterTaxaDoCartao() : Promise.resolve(null),
      subAtual === "categorias" ? listarCategoriasComUso() : Promise.resolve([]),
      subAtual === "catalogo" ? listarCatalogoCompleto() : Promise.resolve([]),
      subAtual === "catalogo"
        ? listarCategoriasParaItem()
        : Promise.resolve({ vendaveis: [], compraveis: [] }),
      subAtual === "catalogo" ? listarInsumosDisponiveis() : Promise.resolve([]),
      subAtual === "fixas" ? listarContasFixas() : Promise.resolve([]),
      subAtual === "fixas" ? listarCategoriasParaContaFixa() : Promise.resolve([]),
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
