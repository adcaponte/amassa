import { Suspense } from "react";

import { db } from "@/db";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import {
  abaDaAgendaDaUrl,
  buscaDaUrl,
  idDaUrl,
  mesDaUrl,
  pessoaDaUrl,
  semanaDaUrl,
  turmaDaUrl,
  usoDaUrl,
  vistaDaUrl,
  type AbaDaAgenda,
  type VistaDaAgenda,
} from "@/lib/agenda/abas";
import {
  creditosDoCliente,
  lerAReceber,
  lerMes,
  lerSemana,
  obterEvento,
  obterTurma,
  obterUsoLivre,
  precoDaHoraDoUsoLivre,
  quantosAReceber,
  saldosDeReposicao,
  turmasDaPessoa,
  turmasPorCliente,
  ultimasVindas,
} from "@/lib/agenda/consultas";
import { garantirMensalidadesDoMes } from "@/lib/agenda/gravacao";
import { mesDaData } from "@/lib/agenda/mensalidade";
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
import { listarClientes, obterCliente, type ClienteDaLista } from "@/lib/clientes/consultas";
import { quantosDaUrl } from "@/lib/clientes/lista";
import { agoraEmBrasilia, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { somarDias } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { CabecalhoPagina } from "@/components/amassa/cabecalho-pagina";
import { CarregadorDoSeletor } from "@/components/amassa/estoque/carregador-do-seletor";
import { ProvedorDoEstoque } from "@/components/amassa/estoque/provedor-estoque";
import { AReceber, EsqueletoDoAReceber } from "@/components/amassa/agenda/a-receber";
import { AbasDaAgenda } from "@/components/amassa/agenda/abas-da-agenda";
import { BarraDaAgenda } from "@/components/amassa/agenda/barra-da-agenda";
import { FolhaLancar } from "@/components/amassa/agenda/folha-lancar";
import { EsqueletoDoMes, GradeDoMes } from "@/components/amassa/agenda/grade-do-mes";
import {
  EsqueletoDasPessoas,
  ListaPessoas,
  type FichaDoServidor,
} from "@/components/amassa/agenda/lista-pessoas";
import {
  SemanaDaAgenda,
  type TurmaDoServidor,
  type UsoDoServidor,
} from "@/components/amassa/agenda/semana-da-agenda";

type ParametrosDaAgenda = {
  aba?: string | string[];
  busca?: string | string[];
  quantos?: string | string[];
  pessoa?: string | string[];
  vista?: string | string[];
  semana?: string | string[];
  mes?: string | string[];
  evento?: string | string[];
  turma?: string | string[];
  uso?: string | string[];
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
// `?semana=` (qualquer dia; vira a segunda dela), `?mes=AAAA-MM`, `?evento=` (a folha aberta),
// `?turma=` (a folha da turma, no lugar da folha da data — D-03, UI-D25), `?uso=` (a folha do uso
// livre — plano 09).
// `?lancar=1&dia=` (a folha "Lançar na agenda") é lido pelo cliente (`FolhaLancar`), que abre e
// fecha por `pushState`. `?aba=` escolhe a aba (05-04): "agenda" (padrão — a semana ou o mês),
// "pessoas" (`?busca=`, `?quantos=`, `?pessoa=` — a ficha aberta) ou "receber" (plano 11 — o que
// falta receber e o "Recebi agora"). "Números" e "No site"
// entram nos planos 14 e 15.
export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<ParametrosDaAgenda>;
}) {
  await exigirUsuario();
  const hoje = hojeEmBrasilia(new Date());
  const parametros = await searchParams;
  const aba = abaDaAgendaDaUrl(parametros.aba);
  const vista = vistaDaUrl(parametros.vista);

  return (
    <>
      <CabecalhoPagina titulo={TITULO_AGENDA} />
      {/* As abas 16px abaixo do cabeçalho; o conteúdo da aba 24px abaixo delas (05-UI-SPEC.md
          §"Página /gestao/agenda"). */}
      <div className="pt-4">
        {/* O contador " · {N}" de "A receber" espera o banco sem segurar as abas: enquanto conta, elas
            aparecem sem ele (UI E15·zero-one-many). */}
        <Suspense fallback={<AbasDaAgenda abaAtual={aba} />}>
          <AbasComContagem aba={aba} hoje={hoje} />
        </Suspense>
      </div>
      <div className="flex max-w-3xl flex-col gap-4 px-6 pt-6 pb-6 md:px-8">
        {aba === "receber" ? (
          // "A receber" (AGE-15) espera o banco atrás do esqueleto DELA (cabeçalho + sanfona + 4 linhas).
          <Suspense fallback={<EsqueletoDoAReceber />}>
            <AReceberCarregado hoje={hoje} />
          </Suspense>
        ) : aba === "pessoas" ? (
          // A lista de Pessoas espera o banco atrás do esqueleto DELA (busca + 6 linhas). Sem `key`
          // da busca: digitar não troca a lista pelo esqueleto nem tira o foco do campo.
          <Suspense fallback={<EsqueletoDasPessoas />}>
            <PessoasCarregadas
              busca={buscaDaUrl(parametros.busca)}
              quantos={quantosDaUrl(parametros.quantos)}
              idDaPessoa={pessoaDaUrl(parametros.pessoa)}
              idDaTurma={turmaDaUrl(parametros.turma)}
              hoje={hoje}
            />
          </Suspense>
        ) : (
          <>
            {vista === "mes" ? (
              <VistaDoMes mes={mesDaUrl(parametros.mes, hoje)} hoje={hoje} />
            ) : (
              <VistaDaSemana parametros={parametros} hoje={hoje} />
            )}
            {/* O preço da hora (a dica do uso livre) espera o banco sem segurar a semana. */}
            <Suspense fallback={null}>
              <FolhaLancarCarregada hoje={hoje} />
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}

// As abas com o contador de "A receber". D-02: a mensalidade do mês nasce ANTES de contar (a mesma
// escrita idempotente da ficha e da aba — o porquê está em `garantirMensalidadesDoMes`), para o número
// da aba nunca ser menor que a lista. A conta que falha não derruba a página: as abas aparecem sem ela.
async function AbasComContagem({ aba, hoje }: { aba: AbaDaAgenda; hoje: string }) {
  let quantos = 0;
  try {
    await garantirMensalidadesDoMes(db, mesDaData(hoje));
    quantos = await quantosAReceber();
  } catch (erro) {
    console.error("Falha ao contar o que falta receber:", erro);
  }
  return <AbasDaAgenda abaAtual={aba} quantosAReceber={quantos} />;
}

// A aba "A receber" (AGE-15): D-02 — a mensalidade do mês de quem já era aluno nasce ANTES de ler, pela
// mesma escrita idempotente da ficha (a página já chamou `exigirUsuario()` na primeira linha). A leitura
// que falha cai no `error.tsx` da página, como a lista de Pessoas.
async function AReceberCarregado({ hoje }: { hoje: string }) {
  await garantirMensalidadesDoMes(db, mesDaData(hoje));
  const dados = await lerAReceber();
  return <AReceber dados={dados} />;
}

// A aba Pessoas (AGE-06): o cadastro de clientes (D-01), lido por `lib/clientes` — o mesmo de
// Cadastros → Clientes. A lista que falha cai no `error.tsx` da página (UI E12·error); a FICHA que
// falha mostra o erro dentro da folha (UI E13·error), por isso tem `try` próprio. `?turma=` ("ver turma"
// na ficha) abre a folha da turma no lugar da ficha (plano 07).
async function PessoasCarregadas({
  busca,
  quantos,
  idDaPessoa,
  idDaTurma,
  hoje,
}: {
  busca: string;
  quantos: number;
  idDaPessoa: string | null;
  idDaTurma: string | null;
  hoje: string;
}) {
  const [lista, ficha, turmaAberta] = await Promise.all([
    listarClientes({ busca, quantos }),
    lerFicha(idDaPessoa, hoje),
    lerTurma(idDaTurma, hoje),
  ]);
  const ids = lista.clientes.map((cliente) => cliente.id);
  const [turmasPorPessoa, aReporPorPessoa] = await Promise.all([turmasPorCliente(ids), saldosDeReposicao(ids)]);
  return (
    <ListaPessoas
      pessoas={lista.clientes}
      haMais={lista.haMais}
      busca={busca}
      quantos={quantos}
      ficha={ficha}
      turmasPorPessoa={turmasPorPessoa}
      aReporPorPessoa={aReporPorPessoa}
      turmaAberta={turmaAberta}
      hoje={hoje}
    />
  );
}

async function lerFicha(id: string | null, hoje: string): Promise<FichaDoServidor> {
  if (id === null) {
    return { estado: "nenhuma" };
  }
  let pessoa: ClienteDaLista | null = null;
  try {
    pessoa = await obterCliente(id);
    if (pessoa === null) {
      return { estado: "inexistente", id };
    }
    // D-02: a mensalidade do mês nasce ao abrir a ficha, ANTES de ler as turmas e as cobranças da
    // pessoa — escrita idempotente pela chave única (o porquê está em `garantirMensalidadesDoMes`). A
    // página já chamou `exigirUsuario()` na primeira linha (T-05-32).
    await garantirMensalidadesDoMes(db, mesDaData(hoje));
    const [vindas, turmas, creditos] = await Promise.all([
      ultimasVindas(id, hoje),
      turmasDaPessoa(id, hoje),
      creditosDoCliente(db, id),
    ]);
    return {
      estado: "carregada",
      pessoa,
      conteudo: { vindas, turmas, mes: mesDaData(hoje), aRepor: creditos.saldo },
    };
  } catch (erro) {
    console.error("Falha ao carregar a ficha da pessoa:", erro);
    return { estado: "erro", id, pessoa };
  }
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

// A folha "Lançar na agenda" com o preço da hora do uso livre (D-17: o item "Uso livre (hora)",
// achado pela chave). Sem o preço — ou sem conseguir lê-lo — a dica diz onde cadastrar.
async function FolhaLancarCarregada({ hoje }: { hoje: string }) {
  let precoDaHoraCentavos: number | null = null;
  try {
    precoDaHoraCentavos = await precoDaHoraDoUsoLivre();
  } catch (erro) {
    console.error("Falha ao ler o preço da hora do uso livre:", erro);
  }
  return <FolhaLancar hoje={hoje} precoDaHoraCentavos={precoDaHoraCentavos} />;
}

// O uso livre de `?uso=` (plano 09): a leitura que falha mostra o erro DENTRO da folha.
async function lerUsoLivre(id: string | null, hoje: string): Promise<UsoDoServidor> {
  if (id === null) {
    return { estado: "nenhum" };
  }
  try {
    const uso = await obterUsoLivre(id, hoje);
    return uso === null ? { estado: "inexistente", id } : { estado: "carregado", uso };
  } catch (erro) {
    console.error("Falha ao carregar o uso livre:", erro);
    return { estado: "erro", id };
  }
}

// A turma de `?turma=`: a leitura que falha mostra o erro DENTRO da folha (UI E11·error), não a
// página de erro.
async function lerTurma(id: string | null, hoje: string): Promise<TurmaDoServidor> {
  if (id === null) {
    return { estado: "nenhuma" };
  }
  try {
    const turma = await obterTurma(id, hoje);
    return turma === null ? { estado: "inexistente", id } : { estado: "carregada", turma };
  } catch (erro) {
    console.error("Falha ao carregar a turma:", erro);
    return { estado: "erro", id };
  }
}

async function VistaDaSemana({ parametros, hoje }: { parametros: ParametrosDaAgenda; hoje: string }) {
  const segunda = semanaDaUrl(parametros.semana, hoje);
  const idDoEvento = idDaUrl(parametros.evento);

  const [eventos, eventoAberto, turmaAberta, usoAberto] = await Promise.all([
    lerSemana(segunda, hoje),
    idDoEvento === null ? Promise.resolve(null) : obterEvento(idDoEvento, hoje),
    lerTurma(turmaDaUrl(parametros.turma), hoje),
    lerUsoLivre(usoDaUrl(parametros.uso), hoje),
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
      {/* O seletor "Qual material?" do uso livre (plano 10) lê a lista do Estoque pelo provedor da Fase 06,
          entregue pelo mesmo carregador da aba Saldos — só com um uso NO ESPAÇO aberto (fallback nulo: a
          folha aparece já, e o seletor mostra o esqueleto até a lista chegar). O provedor fica sempre, para a
          árvore da semana não trocar de forma ao abrir e fechar a folha. */}
      <ProvedorDoEstoque>
        {usoAberto.estado === "carregado" && usoAberto.uso.estado === "no_espaco" ? (
          <Suspense fallback={null}>
            <CarregadorDoSeletor />
          </Suspense>
        ) : null}
        <SemanaDaAgenda
          dias={dias}
          hoje={hoje}
          turmaAberta={turmaAberta}
          eventoAberto={eventoAberto}
          eventoInexistente={idDoEvento !== null && eventoAberto === null}
          usoAberto={usoAberto}
          // UI-D7: o "Saiu às" de um uso de hoje vem com a hora de AGORA, decidida aqui, no servidor (Brasília)
          // — nunca o relógio do celular.
          agora={agoraEmBrasilia(new Date())}
          rolarAte={parametros.semana === undefined && contemHoje ? hoje : null}
        />
      </ProvedorDoEstoque>
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
