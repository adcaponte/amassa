import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { listarOrdensEmAndamento } from "@/lib/producao/consultas";
import { leituraDaOrdem, seloDaOrdem } from "@/lib/producao/leitura";
import { colunasDoQuadro } from "@/lib/producao/quadro";
import {
  CORPO_PRODUCAO_VAZIA,
  TITULO_PRODUCAO,
  TITULO_PRODUCAO_VAZIA,
} from "@/lib/producao/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import {
  QuadroProducao,
  type ColunaNoQuadro,
} from "@/components/amassa/producao/quadro-producao";

// `/gestao/producao` — o quadro por etapa (Fase 06.1, plano 01: o traçador). `exigirUsuario()` como
// PRIMEIRA instrução — regra do CLAUDE.md, verificada por `npm run verificar-acoes`. "Hoje" é
// decidido AQUI, no servidor (Brasília), e passado ao módulo puro — o cliente nunca decide o dia.
//
// Neste plano só o que o caminho do "Terminei" precisa: o cabeçalho e as seis colunas. Pílulas de
// filtro, três números, linha do tempo, "Aguardando o sinal", "Nova ordem" e "Imprimir folha geral"
// chegam nos planos seguintes. Falha ao carregar: `error.tsx` desta rota; carregando: `loading.tsx`.
export default async function PaginaProducao() {
  await exigirUsuario();
  const hoje = hojeEmBrasilia(new Date());

  const ordens = await listarOrdensEmAndamento();
  const ativas = ordens.filter((ordem) => ordem.status === "ativa");

  if (ativas.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo={TITULO_PRODUCAO} />
        <EstadoVazio
          titulo={TITULO_PRODUCAO_VAZIA}
          corpo={CORPO_PRODUCAO_VAZIA}
          testId="producao-vazia"
        />
      </>
    );
  }

  const colunas: ColunaNoQuadro[] = colunasDoQuadro(ativas).map((coluna) => ({
    etapa: coluna.etapa,
    ordens: coluna.ordens.flatMap((ordem) => {
      const leitura = leituraDaOrdem(ordem, hoje);
      if (leitura.tipo !== "em-andamento") {
        return [];
      }
      return [{ ordem, leitura, selo: seloDaOrdem(leitura) }];
    }),
  }));

  return (
    <>
      <CabecalhoPagina titulo={TITULO_PRODUCAO} />
      <div className="px-6 py-6 md:px-8">
        <QuadroProducao colunas={colunas} />
      </div>
    </>
  );
}
