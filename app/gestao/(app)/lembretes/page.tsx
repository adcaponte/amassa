import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { listarLembretes, listarPessoasDaCasa } from "@/lib/lembretes/consultas";
import { filtrosDaUrl } from "@/lib/lembretes/lista";
import { TITULO_DA_PAGINA } from "@/lib/lembretes/textos";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { ListaCompleta } from "@/components/amassa/lembretes/lista-completa";

// "Ver todos" dos Lembretes (Fase 06.3, plano 05 — D-01, LMB-09): uma ROTA própria, que abre direto
// pela lateral, pela pílula de atalho e pelo índice do Início, e pelos links "ver todos" do bloco.
//
// `exigirUsuario()` é a PRIMEIRA instrução (T-06.3-21; o middleware também cerca `/gestao`). Os
// filtros vêm da URL por `filtrosDaUrl` (puro): valor fora da união, lista repetida ou `quantos`
// absurdo caem no padrão, nunca em erro (T-06.3-22/24). As duas leituras vão juntas; uma falha sobe
// para `error.tsx` (frase fixa, nunca a mensagem técnica). "Hoje" é o dia civil de Brasília, de um
// só instante — os componentes nunca leem o relógio para decidir vencido/hoje/amanhã.
export default async function PaginaLembretes({
  searchParams,
}: {
  searchParams: Promise<{
    situacao?: string | string[];
    quem?: string | string[];
    quantos?: string | string[];
  }>;
}) {
  await exigirUsuario();

  const filtros = filtrosDaUrl(await searchParams);
  const hoje = hojeEmBrasilia(new Date());
  const [{ linhas, haMais }, pessoas] = await Promise.all([
    listarLembretes(filtros),
    listarPessoasDaCasa(),
  ]);

  // O cabeçalho da casa ocupa a largura toda (com a borda de baixo, como nas outras páginas); o
  // conteúdo fica em `max-w-3xl` — a lista é de texto, e uma linha de 1000 px é difícil de ler
  // (UI-D15).
  return (
    <div className="flex flex-col">
      <CabecalhoPagina titulo={TITULO_DA_PAGINA} />
      <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
        <div className="w-full max-w-3xl">
          <ListaCompleta
            filtros={filtros}
            hoje={hoje}
            pessoas={pessoas}
            linhas={linhas}
            haMais={haMais}
          />
        </div>
      </div>
    </div>
  );
}
