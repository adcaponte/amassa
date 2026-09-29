import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { listarSaldos } from "@/lib/estoque/consultas";
import { CORPO_ESTOQUE_VAZIO, TITULO_ESTOQUE_VAZIO } from "@/lib/estoque/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { AbaSaldos } from "@/components/amassa/estoque/aba-saldos";

// `exigirUsuario()` como PRIMEIRA instrução — mesmo padrão de toda página da plataforma.
//
// Fase 06, plano 01 (o traçador): o saldo de cada material é a SOMA do livro
// (`movimentacoes_estoque`), lida por `listarSaldos` na hora — nunca uma coluna gravada (EST-02).
// Sem nenhum item com estoque próprio, o estado vazio da UI-SPEC; o botão "+ Novo material" dele
// entra no plano 06-09, junto com a folha que ele abre — até lá o vazio não tem botão, porque botão
// sem destino é defeito. Erro ao carregar cai em `error.tsx`; carregando, em `loading.tsx`.
export default async function PaginaEstoque() {
  await exigirUsuario();

  const saldos = await listarSaldos();

  return (
    <>
      <CabecalhoPagina titulo="Estoque" />
      {saldos.length === 0 ? (
        <EstadoVazio
          titulo={TITULO_ESTOQUE_VAZIO}
          corpo={CORPO_ESTOQUE_VAZIO}
          testId="estoque-vazio"
        />
      ) : (
        <div className="px-6 py-8 md:px-8">
          <AbaSaldos saldos={saldos} />
        </div>
      )}
    </>
  );
}
