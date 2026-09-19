import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { subDaUrl } from "@/lib/cadastros/abas";
import { avisoDaUrl } from "@/lib/cadastros/avisos";
import { obterTaxaDoCartao } from "@/lib/cadastros/consultas";
import {
  FRASE_VAZIO_CATALOGO_CORPO,
  FRASE_VAZIO_CATALOGO_TITULO,
  FRASE_VAZIO_CATEGORIAS_CORPO,
  FRASE_VAZIO_CATEGORIAS_TITULO,
  FRASE_VAZIO_FIXAS_CORPO,
  FRASE_VAZIO_FIXAS_TITULO,
  TOAST_CATEGORIA_DESATIVADA,
  TOAST_CATEGORIA_REATIVADA,
} from "@/lib/cadastros/textos";
import { AvisoCadastros } from "@/components/amassa/cadastros/aviso-cadastros";
import { FormularioTaxa } from "@/components/amassa/cadastros/formulario-taxa";
import { SubAbasCadastros } from "@/components/amassa/cadastros/sub-abas-cadastros";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de `app/(app)/financeiro/page.tsx`.
// `searchParams` é `Promise` no Next.js 15. `?sub=` decide qual das quatro sub-abas aparece; o
// aviso pós-navegação é resolvido AQUI, no servidor, a partir de `?aviso=categoria-desativada`/
// `?aviso=categoria-reativada` — o texto pronto desce para `AvisoCadastros`, que só mostra o
// toast, nunca monta a frase sozinho.
//
// Catálogo e Contas fixas ainda não têm tela própria (planos 05 e 10) — mostram o estado vazio
// do §Copywriting SEM botão, porque a ação de criar ainda não existe. Categorias é a Tarefa 3
// deste plano (04.4-02): até lá, mostra o mesmo tipo de placeholder — o estado vazio sem botão
// — nunca alcançável em produção de qualquer forma, porque a migração 0016 semeia 24 categorias
// e nada se apaga.
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

  const taxaAtual = subAtual === "taxas" ? await obterTaxaDoCartao() : null;

  return (
    <>
      <AvisoCadastros texto={textoDoAviso} />

      <div className="pt-6">
        <SubAbasCadastros subAtual={subAtual} />
      </div>

      {subAtual === "taxas" ? (
        <FormularioTaxa pontosBaseAtuais={taxaAtual ?? 0} />
      ) : subAtual === "categorias" ? (
        <EstadoVazio
          testId="cadastros-vazio-categorias"
          titulo={FRASE_VAZIO_CATEGORIAS_TITULO}
          corpo={FRASE_VAZIO_CATEGORIAS_CORPO}
        />
      ) : subAtual === "fixas" ? (
        <EstadoVazio
          testId="cadastros-vazio-fixas"
          titulo={FRASE_VAZIO_FIXAS_TITULO}
          corpo={FRASE_VAZIO_FIXAS_CORPO}
        />
      ) : (
        <EstadoVazio
          testId="cadastros-vazio-catalogo"
          titulo={FRASE_VAZIO_CATALOGO_TITULO}
          corpo={FRASE_VAZIO_CATALOGO_CORPO}
        />
      )}
    </>
  );
}
