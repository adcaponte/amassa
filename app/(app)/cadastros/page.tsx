import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { subDaUrl } from "@/lib/cadastros/abas";
import { avisoDaUrl } from "@/lib/cadastros/avisos";
import {
  listarCatalogoCompleto,
  listarCategoriasComUso,
  listarCategoriasParaItem,
  listarInsumosDisponiveis,
  obterTaxaDoCartao,
} from "@/lib/cadastros/consultas";
import {
  FRASE_VAZIO_FIXAS_CORPO,
  FRASE_VAZIO_FIXAS_TITULO,
  TOAST_CATEGORIA_DESATIVADA,
  TOAST_CATEGORIA_REATIVADA,
} from "@/lib/cadastros/textos";
import { AvisoCadastros } from "@/components/amassa/cadastros/aviso-cadastros";
import { FormularioTaxa } from "@/components/amassa/cadastros/formulario-taxa";
import { ListaCatalogo } from "@/components/amassa/cadastros/lista-catalogo";
import { ListaCategorias } from "@/components/amassa/cadastros/lista-categorias";
import { SubAbasCadastros } from "@/components/amassa/cadastros/sub-abas-cadastros";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/financeiro/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?sub=` decide qual das quatro sub-abas aparece; o
// aviso pós-navegação é resolvido AQUI, no servidor, a partir de `?aviso=categoria-desativada`/
// `?aviso=categoria-reativada` — o texto pronto desce para `AvisoCadastros`, que só mostra o
// toast, nunca monta a frase sozinho.
//
// Catálogo (plano 05) carrega `listarCatalogoCompleto()`/`listarCategoriasParaItem()`/
// `listarInsumosDisponiveis()` — só nesta sub-aba, mesma disciplina de
// `app/(app)/financeiro/page.tsx` (uma leitura por lista, nunca a mais que a aba atual precisa).
// Contas fixas ainda não tem tela própria (plano 10) — mostra o estado vazio do §Copywriting
// SEM botão, porque a ação de criar ainda não existe.
export default async function PaginaCadastros({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; aviso?: string }>;
}) {
  await exigirUsuario();

  const { sub, aviso } = await searchParams;
  const subAtual = subDaUrl(sub);
  const avisoResolvido = avisoDaUrl(aviso);

  const textoDoAviso =
    avisoResolvido?.tipo === "categoria-desativada"
      ? TOAST_CATEGORIA_DESATIVADA
      : avisoResolvido?.tipo === "categoria-reativada"
        ? TOAST_CATEGORIA_REATIVADA
        : null;

  const [taxaAtual, categorias, catalogo, categoriasParaItem, insumosDisponiveis] = await Promise.all([
    subAtual === "taxas" ? obterTaxaDoCartao() : Promise.resolve(null),
    subAtual === "categorias" ? listarCategoriasComUso() : Promise.resolve([]),
    subAtual === "catalogo" ? listarCatalogoCompleto() : Promise.resolve([]),
    subAtual === "catalogo"
      ? listarCategoriasParaItem()
      : Promise.resolve({ vendaveis: [], compraveis: [] }),
    subAtual === "catalogo" ? listarInsumosDisponiveis() : Promise.resolve([]),
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
        <EstadoVazio
          testId="cadastros-vazio-fixas"
          titulo={FRASE_VAZIO_FIXAS_TITULO}
          corpo={FRASE_VAZIO_FIXAS_CORPO}
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
