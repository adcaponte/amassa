import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

// `exigirUsuario()` como PRIMEIRA instrução — a rota não entra em ROTAS_PUBLICAS, então fica
// protegida sem nenhuma configuração adicional (T-02b-02). Não é um estado vazio (D-04): é um
// aviso definitivo sobre um módulo bloqueado, por isso `EstadoVazio` é usado SEM
// `rotuloBotao`/`notaBotao` — um botão desabilitado sugeriria uma ação que vai existir em
// breve, e não é o caso enquanto as planilhas de precificação não existirem.
export default async function PaginaOrcamentos() {
  await exigirUsuario();

  return (
    <>
      <CabecalhoPagina titulo="Orçamentos" />
      <EstadoVazio
        titulo="A calculadora ainda não existe."
        corpo="Ela depende das planilhas de precificação do ateliê. Assim que estiverem prontas, o orçamento sai daqui."
      />
    </>
  );
}
