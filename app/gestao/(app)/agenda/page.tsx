import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { idDaUrl, semanaDaUrl } from "@/lib/agenda/abas";
import { lerSemana, obterEvento } from "@/lib/agenda/consultas";
import { agruparPorDia, rotuloDoDia, tituloDaSemana } from "@/lib/agenda/semana";
import { ROTULO_PROXIMA_SEMANA, ROTULO_SEMANA_ANTERIOR, TITULO_AGENDA } from "@/lib/agenda/textos";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { somarDias } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { BarraDaAgenda } from "@/components/amassa/agenda/barra-da-agenda";
import { FolhaLancar } from "@/components/amassa/agenda/folha-lancar";
import { SemanaDaAgenda } from "@/components/amassa/agenda/semana-da-agenda";

// `/gestao/agenda` — a semana (Fase 5, plano 01: o traçador). `exigirUsuario()` como PRIMEIRA
// instrução — regra do CLAUDE.md, verificada por `npm run verificar-acoes`. "Hoje" é decidido AQUI,
// no servidor (Brasília), e passado ao módulo puro — o cliente nunca decide o dia. A URL manda:
// `?semana=` (qualquer dia; vira a segunda dela) e `?evento=` (a folha aberta). Parâmetro estranho
// cai no padrão, nunca em erro. `?lancar=1&dia=` (a folha "Lançar na agenda") é lido pelo cliente
// (`FolhaLancar`), que abre e fecha por `pushState`. As abas chegam nos planos seguintes.
export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{
    semana?: string | string[];
    evento?: string | string[];
    lancar?: string | string[];
    dia?: string | string[];
  }>;
}) {
  await exigirUsuario();
  const hoje = hojeEmBrasilia(new Date());
  const parametros = await searchParams;
  const segunda = semanaDaUrl(parametros.semana, hoje);
  const idDoEvento = idDaUrl(parametros.evento);

  const [eventos, eventoAberto] = await Promise.all([
    lerSemana(segunda),
    idDoEvento === null ? Promise.resolve(null) : obterEvento(idDoEvento),
  ]);

  const dias = agruparPorDia(segunda, eventos).map((grupo) => ({
    data: grupo.data,
    rotulo: rotuloDoDia(grupo.data, hoje),
    ehHoje: grupo.data === hoje,
    eventos: grupo.itens,
  }));

  return (
    <>
      <CabecalhoPagina titulo={TITULO_AGENDA} />
      <div className="flex max-w-3xl flex-col gap-4 px-6 pt-4 pb-6 md:px-8">
        <BarraDaAgenda
          titulo={tituloDaSemana(segunda)}
          rotuloAnterior={ROTULO_SEMANA_ANTERIOR}
          rotuloProximo={ROTULO_PROXIMA_SEMANA}
          hrefAnterior={rotaDeGestao(`/agenda?semana=${somarDias(segunda, -7)}`)}
          hrefProximo={rotaDeGestao(`/agenda?semana=${somarDias(segunda, 7)}`)}
          hrefHoje={rotaDeGestao(`/agenda?semana=${hoje}#dia-${hoje}`)}
        />
        <SemanaDaAgenda
          dias={dias}
          eventoAberto={eventoAberto}
          eventoInexistente={idDoEvento !== null && eventoAberto === null}
        />
        <FolhaLancar hoje={hoje} />
      </div>
    </>
  );
}
