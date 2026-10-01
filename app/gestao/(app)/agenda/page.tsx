import { Suspense } from "react";

import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { idDaUrl, mesDaUrl, semanaDaUrl, vistaDaUrl, type VistaDaAgenda } from "@/lib/agenda/abas";
import { lerMes, lerSemana, obterEvento } from "@/lib/agenda/consultas";
import {
  agruparPorDia,
  gradeDoMes,
  mesVizinho,
  pontosDoDia,
  resumoDoDia,
  rotuloDaCelulaDoMes,
  rotuloDoDia,
  segundaDaSemana,
  tituloDaSemana,
  tituloDoMes,
} from "@/lib/agenda/semana";
import {
  ROTULO_MES_ANTERIOR,
  ROTULO_PROXIMA_SEMANA,
  ROTULO_PROXIMO_MES,
  ROTULO_SEMANA_ANTERIOR,
  TITULO_AGENDA,
} from "@/lib/agenda/textos";
import { hojeEmBrasilia } from "@/lib/financeiro/formato";
import { somarDias } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { BarraDaAgenda } from "@/components/amassa/agenda/barra-da-agenda";
import { FolhaLancar } from "@/components/amassa/agenda/folha-lancar";
import { EsqueletoDoMes, GradeDoMes } from "@/components/amassa/agenda/grade-do-mes";
import { SemanaDaAgenda } from "@/components/amassa/agenda/semana-da-agenda";

type ParametrosDaAgenda = {
  vista?: string | string[];
  semana?: string | string[];
  mes?: string | string[];
  evento?: string | string[];
  lancar?: string | string[];
  dia?: string | string[];
};

function urlDaAgenda(consulta: string): string {
  return rotaDeGestao(`/agenda?${consulta}`);
}

// `/gestao/agenda` — a semana (padrão) ou o mês. `exigirUsuario()` como PRIMEIRA instrução — regra
// do CLAUDE.md, verificada por `npm run verificar-acoes`. "Hoje" é decidido AQUI, no servidor
// (Brasília), e passado ao módulo puro — o cliente nunca decide o dia. A URL manda (normalizada por
// `lib/agenda/abas.ts`, parâmetro estranho cai no padrão, nunca em erro): `?vista=semana|mes`,
// `?semana=` (qualquer dia; vira a segunda dela), `?mes=AAAA-MM`, `?evento=` (a folha aberta).
// `?lancar=1&dia=` (a folha "Lançar na agenda") é lido pelo cliente (`FolhaLancar`), que abre e
// fecha por `pushState`. As abas chegam nos planos seguintes.
export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaAgenda>;
}) {
  await exigirUsuario();
  const hoje = hojeEmBrasilia(new Date());
  const parametros = await searchParams;
  const vista = vistaDaUrl(parametros.vista);

  return (
    <>
      <CabecalhoPagina titulo={TITULO_AGENDA} />
      <div className="flex max-w-3xl flex-col gap-4 px-6 pt-4 pb-6 md:px-8">
        {vista === "mes" ? (
          <VistaDoMes mes={mesDaUrl(parametros.mes, hoje)} hoje={hoje} />
        ) : (
          <VistaDaSemana parametros={parametros} hoje={hoje} />
        )}
        <FolhaLancar hoje={hoje} />
      </div>
    </>
  );
}

// O endereço de cada vista para o alternador: a semana leva ao mês dela (o de hoje, quando ela
// contém hoje; senão o da quinta-feira — o mês que tem mais dias dela); o mês leva à semana de
// hoje, quando é o mês de hoje, ou à semana do dia 1.
function hrefsDaVista(semanaNaTela: string, mesNaTela: string): Record<VistaDaAgenda, string> {
  return {
    semana: urlDaAgenda(`semana=${semanaNaTela}`),
    mes: urlDaAgenda(`vista=mes&mes=${mesNaTela}`),
  };
}

async function VistaDaSemana({ parametros, hoje }: { parametros: ParametrosDaAgenda; hoje: string }) {
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
  const contemHoje = segunda === segundaDaSemana(hoje);
  const mesDaSemana = contemHoje ? hoje.slice(0, 7) : somarDias(segunda, 3).slice(0, 7);

  return (
    <>
      <BarraDaAgenda
        vista="semana"
        titulo={tituloDaSemana(segunda)}
        rotuloAnterior={ROTULO_SEMANA_ANTERIOR}
        rotuloProximo={ROTULO_PROXIMA_SEMANA}
        hrefAnterior={urlDaAgenda(`semana=${somarDias(segunda, -7)}`)}
        hrefProximo={urlDaAgenda(`semana=${somarDias(segunda, 7)}`)}
        hrefDaVista={hrefsDaVista(segunda, mesDaSemana)}
        hrefHoje={`${urlDaAgenda(`semana=${hoje}`)}#dia-${hoje}`}
        hoje={hoje}
      />
      <SemanaDaAgenda
        dias={dias}
        eventoAberto={eventoAberto}
        eventoInexistente={idDoEvento !== null && eventoAberto === null}
        rolarAte={parametros.semana === undefined && contemHoje ? hoje : null}
      />
    </>
  );
}

function VistaDoMes({ mes, hoje }: { mes: string; hoje: string }) {
  const semanaDoMes = mes === hoje.slice(0, 7) ? segundaDaSemana(hoje) : segundaDaSemana(`${mes}-01`);
  return (
    <>
      <BarraDaAgenda
        vista="mes"
        titulo={tituloDoMes(mes)}
        rotuloAnterior={ROTULO_MES_ANTERIOR}
        rotuloProximo={ROTULO_PROXIMO_MES}
        hrefAnterior={urlDaAgenda(`vista=mes&mes=${mesVizinho(mes, -1)}`)}
        hrefProximo={urlDaAgenda(`vista=mes&mes=${mesVizinho(mes, 1)}`)}
        hrefDaVista={hrefsDaVista(semanaDoMes, mes)}
        hrefHoje={urlDaAgenda(`vista=mes&mes=${hoje.slice(0, 7)}`)}
        hoje={hoje}
      />
      {/* A grade espera o banco atrás do esqueleto do MÊS (o \`loading.tsx\` da rota não sabe a
          vista e desenha a semana). */}
      <Suspense key={mes} fallback={<EsqueletoDoMes />}>
        <MesCarregado mes={mes} hoje={hoje} />
      </Suspense>
    </>
  );
}

async function MesCarregado({ mes, hoje }: { mes: string; hoje: string }) {
  const lancamentos = await lerMes(mes);
  const porDia = new Map<string, { tipo: (typeof lancamentos)[number]["tipo"] }[]>();
  for (const lancamento of lancamentos) {
    const doDia = porDia.get(lancamento.data) ?? [];
    doDia.push({ tipo: lancamento.tipo });
    porDia.set(lancamento.data, doDia);
  }
  const celulas = gradeDoMes(mes).map((celula) => {
    const doDia = porDia.get(celula.data) ?? [];
    return {
      data: celula.data,
      doMes: celula.doMes,
      ehHoje: celula.data === hoje,
      pontos: pontosDoDia(doDia),
      rotulo: rotuloDaCelulaDoMes(celula.data, resumoDoDia(doDia), hoje),
    };
  });
  const vazio = !lancamentos.some((lancamento) => lancamento.data.startsWith(mes));
  return <GradeDoMes celulas={celulas} vazio={vazio} />;
}
