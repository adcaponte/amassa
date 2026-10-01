import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { idDaUrl, semanaDaUrl } from "@/lib/agenda/abas";
import { lerSemana, obterEvento } from "@/lib/agenda/consultas";
import { agruparPorDia, rotuloDoDia, tituloDaSemana } from "@/lib/agenda/semana";
import { TITULO_AGENDA } from "@/lib/agenda/textos";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { somarDias } from "@/lib/producao/calendario";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { SemanaDaAgenda } from "@/components/amassa/agenda/semana-da-agenda";

// `/gestao/agenda` — a semana (Fase 5, plano 01: o traçador). `exigirUsuario()` como PRIMEIRA
// instrução — regra do CLAUDE.md, verificada por `npm run verificar-acoes`. "Hoje" é decidido AQUI,
// no servidor (Brasília), e passado ao módulo puro — o cliente nunca decide o dia. A URL manda:
// `?semana=` (qualquer dia; vira a segunda dela) e `?evento=` (a folha aberta). Parâmetro estranho
// cai no padrão, nunca em erro. As abas, o "+ Lançar na agenda" e a vista mês chegam nos planos
// seguintes.
export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string | string[]; evento?: string | string[] }>;
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
      <div className="max-w-3xl px-6 pt-4 pb-6 md:px-8">
        <SemanaDaAgenda
          titulo={tituloDaSemana(segunda)}
          semanaAnterior={somarDias(segunda, -7)}
          proximaSemana={somarDias(segunda, 7)}
          dias={dias}
          eventoAberto={eventoAberto}
          eventoInexistente={idDoEvento !== null && eventoAberto === null}
        />
      </div>
    </>
  );
}
