import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import {
  contarConcluidasECanceladas,
  listarConcluidasECanceladas,
} from "@/lib/producao/consultas";
import {
  CORPO_CONCLUIDAS_VAZIA,
  ROTULO_VOLTAR_PRODUCAO,
  TITULO_CONCLUIDAS,
  TITULO_CONCLUIDAS_VAZIA,
} from "@/lib/producao/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { ListaConcluidas } from "@/components/amassa/producao/lista-concluidas";

// `/gestao/producao/concluidas` — as ordens concluídas e canceladas (Fase 06.1, plano 08; UI-D8):
// rota própria, que sobrevive a recarregar e tem o voltar do navegador. `exigirUsuario()` como
// PRIMEIRA instrução — regra do CLAUDE.md, verificada por `npm run verificar-acoes`. As primeiras 50
// e o total saem daqui; as seguintes, de `carregarMaisConcluidas`. Sem filtro nesta tela.
export default async function PaginaConcluidas() {
  await exigirUsuario();

  const [iniciais, total] = await Promise.all([
    listarConcluidasECanceladas({ deslocamento: 0 }),
    contarConcluidasECanceladas(),
  ]);

  return (
    <>
      <CabecalhoPagina
        titulo={TITULO_CONCLUIDAS}
        voltar={{ href: rotaDeGestao("/producao"), rotulo: ROTULO_VOLTAR_PRODUCAO }}
      />
      {iniciais.length === 0 ? (
        <EstadoVazio
          titulo={TITULO_CONCLUIDAS_VAZIA}
          corpo={CORPO_CONCLUIDAS_VAZIA}
          testId="concluidas-vazio"
        />
      ) : (
        <div className="px-6 py-6 md:px-8">
          <ListaConcluidas iniciais={iniciais} total={total} />
        </div>
      )}
    </>
  );
}
