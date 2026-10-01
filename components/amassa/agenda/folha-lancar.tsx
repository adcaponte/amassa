"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import { diaDaUrl, lancarDaUrl } from "@/lib/agenda/abas";
import { conferirDiaParaLancar, fecharDia, lancarAvulsa, lancarTurma } from "@/lib/agenda/acoes";
import type { DiaParaLancar } from "@/lib/agenda/consultas";
import { esquemaFecharDia, esquemaLancarAvulsa, esquemaLancarTurma } from "@/lib/agenda/esquemas";
import {
  ARIA_O_QUE_LANCAR,
  avisoDiaComLancamentos,
  avisoDiaFechado,
  avisoTurmaEmDiaFechado,
  DICA_MOTIVO,
  DICA_TIPO_AULA,
  DICA_TIPO_FECHADO,
  DICA_TIPO_TURMA,
  FRASE_FALHA_AO_LANCAR,
  PLACEHOLDER_MOTIVO,
  PLACEHOLDER_NOME_AULA,
  ROTULO_AULA_AVULSA,
  ROTULO_COMECA,
  ROTULO_DATA,
  ROTULO_FECHADO_BLOQUEIO,
  ROTULO_FECHANDO,
  ROTULO_FECHAR,
  ROTULO_FECHAR_O_DIA,
  ROTULO_LANCANDO,
  ROTULO_LANCAR_AULA,
  ROTULO_LANCAR_TURMA,
  ROTULO_MOSTRAR_NO_SITE,
  ROTULO_MOTIVO,
  ROTULO_NOME,
  ROTULO_PRECO_POR_PESSOA,
  ROTULO_TERMINA,
  ROTULO_TURMA_FIXA,
  ROTULO_VAGAS,
  ROTULO_VOLTAR,
  SEMANAS_PADRAO,
  TITULO_LANCAR_NA_AGENDA,
  TOAST_LANCADO,
  toastDiaFechado,
  toastTurmaLancada,
  VAGAS_PADRAO,
  VENCIMENTO_PADRAO,
} from "@/lib/agenda/textos";
import { datasDaTurma, datasEmDiaFechado, diaDaSemanaDe, SEMANAS_MAXIMAS } from "@/lib/agenda/turma";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { irParaSemNavegar } from "@/components/amassa/abertura/url-sem-navegar";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { CamposTurma, type CampoControlado } from "./campos-turma";
import { enderecoDaAgendaCom } from "./url-da-agenda";

// Os tipos que a folha lança, na ordem herdada do protótipo (05-UI-SPEC.md: "Turma fixa" · "Aula ou
// oficina avulsa" · "Uso livre" · "Fechado / bloqueio"); o uso livre entra entre a avulsa e o fechado
// no plano 09 — com o formulário inteiro, nunca uma pílula sem destino.
export type TipoDeLancamento = "turma" | "avulsa" | "fechado";

const TIPOS: readonly { valor: TipoDeLancamento; rotulo: string }[] = [
  { valor: "turma", rotulo: ROTULO_TURMA_FIXA },
  { valor: "avulsa", rotulo: ROTULO_AULA_AVULSA },
  { valor: "fechado", rotulo: ROTULO_FECHADO_BLOQUEIO },
];

const ROTULO_DE_GRAVAR: Record<TipoDeLancamento, { parado: string; gravando: string }> = {
  turma: { parado: ROTULO_LANCAR_TURMA, gravando: ROTULO_LANCANDO },
  avulsa: { parado: ROTULO_LANCAR_AULA, gravando: ROTULO_LANCANDO },
  fechado: { parado: ROTULO_FECHAR_O_DIA, gravando: ROTULO_FECHANDO },
};

type Campo =
  | "titulo"
  | "data"
  | "inicio"
  | "fim"
  | "vagas"
  | "preco"
  | "motivo"
  | "diaSemana"
  | "mensalidade"
  | "semanas"
  | "diaVencimento";

// A ordem em que o foco procura o primeiro erro — a ordem dos campos na tela.
const ORDEM_DOS_CAMPOS: Record<TipoDeLancamento, readonly Campo[]> = {
  turma: ["titulo", "diaSemana", "data", "inicio", "fim", "vagas", "mensalidade", "semanas", "diaVencimento"],
  avulsa: ["titulo", "data", "inicio", "fim", "vagas", "preco"],
  fechado: ["data", "motivo"],
};

// Molde de `classeDaPilula` (Estoque, barra de saldos): pílula marcada em `acento-fundo` com
// borda e texto `acento`, 600 — o marcado não depende só da cor (peso e `aria-checked`).
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

// O esquema da turma fala a língua do banco (`nome`, `aPartirDe`); a folha guarda esses dois nos
// MESMOS estados da aula avulsa (`titulo`, `data`) — é o que mantém o digitado ao trocar de pílula.
const CAMPO_DA_FOLHA: Record<string, Campo> = { nome: "titulo", aPartirDe: "data" };

// As datas que a turma vai marcar com o que está digitado agora — vazio enquanto falta algo.
function datasPrevistas(diaSemana: string, aPartirDe: string, semanas: string): string[] {
  const quantas = Number(semanas.trim());
  if (
    !esquemaFecharDia.shape.data.safeParse(aPartirDe).success ||
    !/^\d{1,2}$/.test(semanas.trim()) ||
    quantas < 1 ||
    quantas > SEMANAS_MAXIMAS ||
    !/^[0-6]$/.test(diaSemana)
  ) {
    return [];
  }
  return datasDaTurma({ diaDaSemana: Number(diaSemana), aPartirDe, semanas: quantas });
}

function juntarIds(...ids: (string | undefined)[]): string | undefined {
  const juntos = ids.filter(Boolean).join(" ");
  return juntos === "" ? undefined : juntos;
}

export type FolhaLancarProps = {
  // O "hoje" de Brasília, decidido no servidor — a data da folha aberta por "+ Lançar na agenda".
  hoje: string;
};

// A folha "Lançar na agenda" (05-UI-SPEC.md §"Folha "Lançar na agenda" (diálogo)"), aberta por
// `?lancar=1&dia=AAAA-MM-DD` (UI-D8): "+ Lançar na agenda" abre com hoje, o "+ lançar" de cada dia
// abre com o dia. Abrir e fechar mexem só na URL (`pushState`) — a folha não precisa de nada do
// servidor para nascer. A ÚLTIMA pílula escolhida vale enquanto a página estiver aberta (herdado):
// este componente fica montado e guarda a escolha; o formulário nasce limpo a cada abertura.
export function FolhaLancar({ hoje }: FolhaLancarProps) {
  const parametros = useSearchParams();
  const [ultimoTipo, setUltimoTipo] = useState<TipoDeLancamento>("avulsa");

  if (!lancarDaUrl(parametros.get("lancar") ?? undefined)) {
    return null;
  }
  const diaTocado = diaDaUrl(parametros.get("dia") ?? undefined);
  const dia = diaTocado ?? hoje;

  return (
    <FormularioLancar
      dataInicial={dia}
      // O dia da semana da turma: o da data tocada no "+ lançar", ou segunda (1).
      diaSemanaInicial={diaTocado === null ? "1" : String(diaDaSemanaDe(diaTocado))}
      tipoInicial={ultimoTipo}
      aoMudarTipo={setUltimoTipo}
      aoFechar={() => irParaSemNavegar(enderecoDaAgendaCom({ lancar: null, dia: null }))}
    />
  );
}

type FormularioLancarProps = {
  dataInicial: string;
  diaSemanaInicial: string;
  tipoInicial: TipoDeLancamento;
  aoMudarTipo: (tipo: TipoDeLancamento) => void;
  aoFechar: () => void;
};

function FormularioLancar({
  dataInicial,
  diaSemanaInicial,
  tipoInicial,
  aoMudarTipo,
  aoFechar,
}: FormularioLancarProps) {
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDeLancamento>(tipoInicial);
  // Um estado só para o formulário inteiro: trocar de pílula MANTÉM nome, data, horário e vagas.
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(dataInicial);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [vagas, setVagas] = useState(VAGAS_PADRAO);
  const [preco, setPreco] = useState("");
  const [publico, setPublico] = useState(true);
  const [motivo, setMotivo] = useState("");
  // Só da turma.
  const [diaSemana, setDiaSemana] = useState(diaSemanaInicial);
  const [mensalidade, setMensalidade] = useState("");
  const [semanas, setSemanas] = useState(SEMANAS_PADRAO);
  const [diaVencimento, setDiaVencimento] = useState(VENCIMENTO_PADRAO);

  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [dia, setDia] = useState<DiaParaLancar | null>(null);

  // Guarda síncrona contra o toque duplo (AGE-01 · idempotency): o `disabled` só vale depois do
  // próximo desenho; a referência vale já no segundo clique do mesmo gesto.
  const emVoo = useRef(false);
  const campos = useRef<Partial<Record<Campo, HTMLElement | null>>>({});
  const pilulas = useRef<Partial<Record<TipoDeLancamento, HTMLButtonElement | null>>>({});

  // Na turma, as datas que vão ser marcadas — o aviso D-13 olha todas, não só a primeira.
  const datasDaTurmaPrevistas = tipo === "turma" ? datasPrevistas(diaSemana, data, semanas) : [];
  const ate =
    datasDaTurmaPrevistas.length > 0 ? datasDaTurmaPrevistas[datasDaTurmaPrevistas.length - 1] : undefined;

  // O aviso da D-13: a cada data escolhida, o servidor diz se o dia está fechado e quantos
  // lançamentos ele já tem (e, na turma, os dias fechados até a última data). Só a resposta do
  // intervalo ATUAL vale (trocar rápido não mostra o aviso de outro). Nunca bloqueia: é só leitura.
  useEffect(() => {
    let valida = true;
    setDia(null);
    if (!esquemaFecharDia.shape.data.safeParse(data).success) {
      return;
    }
    conferirDiaParaLancar(ate === undefined ? { data } : { data, ate })
      .then((resposta) => {
        if (valida && resposta.ok) {
          setDia(resposta.dados);
        }
      })
      .catch(() => {
        // Sem o aviso a folha continua funcionando — ele não bloqueia nada.
      });
    return () => {
      valida = false;
    };
  }, [data, ate]);

  function registrar(campo: Campo) {
    return (elemento: HTMLElement | null) => {
      campos.current[campo] = elemento;
    };
  }

  function escolherTipo(novo: TipoDeLancamento) {
    setTipo(novo);
    aoMudarTipo(novo);
    setErros({});
    setErroGeral(null);
  }

  // Setas movem a escolha (padrão de `radiogroup`).
  function aoTeclarNaPilula(evento: KeyboardEvent<HTMLButtonElement>) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown"
        ? 1
        : evento.key === "ArrowLeft" || evento.key === "ArrowUp"
          ? -1
          : 0;
    if (passo === 0) {
      return;
    }
    evento.preventDefault();
    const indice = TIPOS.findIndex((opcao) => opcao.valor === tipo);
    const novo = TIPOS[(indice + passo + TIPOS.length) % TIPOS.length].valor;
    escolherTipo(novo);
    pilulas.current[novo]?.focus();
  }

  function limparErro(campo: Campo) {
    setErros((atuais) => {
      if (!(campo in atuais)) {
        return atuais;
      }
      const resto = { ...atuais };
      delete resto[campo];
      return resto;
    });
  }

  // Os erros vão para baixo de cada campo e o foco vai ao primeiro (nunca toast — UI-D9 da 06).
  function mostrarErros(novos: Partial<Record<Campo, string>>) {
    setErros(novos);
    const primeiro = ORDEM_DOS_CAMPOS[tipo].find((campo) => novos[campo] !== undefined);
    if (primeiro) {
      window.requestAnimationFrame(() => campos.current[primeiro]?.focus());
    }
  }

  function errosDoEsquema(problemas: readonly { path: PropertyKey[]; message: string }[]) {
    const novos: Partial<Record<Campo, string>> = {};
    for (const problema of problemas) {
      const chave = String(problema.path[0] ?? "");
      const campo = (CAMPO_DA_FOLHA[chave] ?? chave) as Campo;
      if (ORDEM_DOS_CAMPOS[tipo].includes(campo) && novos[campo] === undefined) {
        novos[campo] = problema.message;
      }
    }
    return novos;
  }

  async function gravar() {
    if (emVoo.current) {
      return;
    }
    setErroGeral(null);

    const entrada =
      tipo === "turma"
        ? {
            nome: titulo,
            diaSemana,
            aPartirDe: data,
            inicio,
            fim,
            vagas,
            mensalidade,
            semanas,
            diaVencimento,
            publica: publico,
          }
        : tipo === "avulsa"
          ? { titulo, data, inicio, fim, vagas, preco, publico }
          : { data, motivo };
    // A mesma regra do servidor, antes de gravar — o servidor confere de novo (a única que vale).
    const conferido =
      tipo === "turma"
        ? esquemaLancarTurma.safeParse(entrada)
        : tipo === "avulsa"
          ? esquemaLancarAvulsa.safeParse(entrada)
          : esquemaFecharDia.safeParse(entrada);
    if (!conferido.success) {
      mostrarErros(errosDoEsquema(conferido.error.issues));
      return;
    }
    setErros({});

    emVoo.current = true;
    setEnviando(true);
    try {
      const resposta =
        tipo === "turma"
          ? await lancarTurma(entrada)
          : tipo === "avulsa"
            ? await lancarAvulsa(entrada)
            : await fecharDia(entrada);
      if (!resposta.ok) {
        // A folha continua aberta e preenchida — nada do que foi digitado se perde.
        const porCampo = errosDoEsquema(
          Object.entries(resposta.campos ?? {}).map(([campo, message]) => ({ path: [campo], message })),
        );
        if (Object.keys(porCampo).length > 0) {
          mostrarErros(porCampo);
        } else {
          setErroGeral(resposta.erro);
        }
        emVoo.current = false;
        setEnviando(false);
        return;
      }
      // Sucesso: o toast diz o que foi gravado, a folha sai do histórico (voltar não a reabre) e
      // a agenda vai para a semana da data lançada. `emVoo` fica preso: nenhum segundo toque
      // cria outro lançamento.
      let semanaLancada: string;
      if ("turmaId" in resposta.dados) {
        const fechados = resposta.dados.emDiaFechado.map((fechado) => formatarDiaMes(fechado.data));
        // O toast longo (datas em dia fechado) fica mais tempo na tela (backstop E29·long-text).
        toast.success(toastTurmaLancada(resposta.dados.datas, fechados), {
          duration: fechados.length > 0 ? 8000 : undefined,
        });
        semanaLancada = resposta.dados.primeira;
      } else {
        toast.success(tipo === "avulsa" ? TOAST_LANCADO : toastDiaFechado(formatarDiaMes(resposta.dados.data)));
        semanaLancada = resposta.dados.data;
      }
      window.history.replaceState(null, "", enderecoDaAgendaCom({ lancar: null, dia: null }));
      router.push(rotaDeGestao(`/agenda?semana=${semanaLancada}`), { scroll: false });
    } catch (falha) {
      console.error("Falha ao lançar na agenda:", falha);
      setErroGeral(FRASE_FALHA_AO_LANCAR);
      emVoo.current = false;
      setEnviando(false);
    }
  }

  // O que `CamposTurma` recebe de cada campo: o valor e o erro DAQUI (o estado é da folha).
  function controlado(
    campo: Campo,
    valor: string,
    mudar: (valor: string) => void,
    tambemLimpar: readonly Campo[] = [],
  ): CampoControlado {
    return {
      valor,
      erro: erros[campo],
      registrar: registrar(campo),
      aoMudar: (novo) => {
        mudar(novo);
        limparErro(campo);
        for (const outro of tambemLimpar) {
          limparErro(outro);
        }
      },
    };
  }

  function idDoErro(campo: Campo): string | undefined {
    return erros[campo] === undefined ? undefined : `lancar-erro-${campo}`;
  }

  function erroDe(campo: Campo) {
    const mensagem = erros[campo];
    if (mensagem === undefined) {
      return null;
    }
    return (
      <p
        id={`lancar-erro-${campo}`}
        role="alert"
        data-testid={`lancar-erro-${campo}`}
        className="text-apoio text-erro"
      >
        {mensagem}
      </p>
    );
  }

  const avisos: string[] = [];
  if (tipo === "turma") {
    const emFechado = dia === null ? [] : datasEmDiaFechado(datasDaTurmaPrevistas, dia.fechados);
    if (emFechado.length > 0) {
      avisos.push(avisoTurmaEmDiaFechado(emFechado.map((fechado) => formatarDiaMes(fechado.data))));
    }
  } else if (dia?.fechadoMotivo != null) {
    avisos.push(avisoDiaFechado(dia.fechadoMotivo));
  }
  if (tipo === "fechado" && dia !== null && dia.lancamentos > 0) {
    avisos.push(avisoDiaComLancamentos(dia.lancamentos));
  }

  const campoData = (
    <div className="flex min-w-0 grow basis-40 flex-col gap-2">
      <label htmlFor="lancar-data" className="text-apoio text-tinta font-semibold">
        {ROTULO_DATA}
      </label>
      <Input
        id="lancar-data"
        ref={registrar("data")}
        type="date"
        data-testid="lancar-data"
        aria-describedby={idDoErro("data")}
        aria-invalid={erros.data !== undefined}
        value={data}
        onChange={(evento) => {
          setData(evento.target.value);
          limparErro("data");
        }}
        className={cn(CLASSE_DO_CAMPO, "tabular-nums")}
      />
      {erroDe("data")}
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !enviando) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-lancar"
        aria-describedby={undefined}
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          // Foco inicial só a partir de 768px — no celular, o teclado não sobe sozinho tapando a
          // folha (UI-D13 da 06).
          if (window.matchMedia("(min-width: 768px)").matches) {
            (tipo === "fechado" ? campos.current.data : campos.current.titulo)?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="text-titulo text-tinta break-words">{TITULO_LANCAR_NA_AGENDA}</DialogTitle>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-lancar-fechar"
            disabled={enviando}
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            void gravar();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div role="radiogroup" aria-label={ARIA_O_QUE_LANCAR} className="flex flex-wrap gap-2">
              {TIPOS.map((opcao) => {
                const marcada = opcao.valor === tipo;
                return (
                  <button
                    key={opcao.valor}
                    ref={(elemento) => {
                      pilulas.current[opcao.valor] = elemento;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={marcada}
                    tabIndex={marcada ? 0 : -1}
                    data-testid={`lancar-tipo-${opcao.valor}`}
                    onClick={() => escolherTipo(opcao.valor)}
                    onKeyDown={aoTeclarNaPilula}
                    className={classeDaPilula(marcada)}
                  >
                    {opcao.rotulo}
                  </button>
                );
              })}
            </div>

            {tipo === "turma" ? (
              <CamposTurma
                nome={controlado("titulo", titulo, setTitulo)}
                diaSemana={controlado("diaSemana", diaSemana, setDiaSemana)}
                aPartirDe={controlado("data", data, setData)}
                inicio={controlado("inicio", inicio, setInicio, ["fim"])}
                fim={controlado("fim", fim, setFim, ["inicio"])}
                vagas={controlado("vagas", vagas, setVagas)}
                mensalidade={controlado("mensalidade", mensalidade, setMensalidade)}
                semanas={controlado("semanas", semanas, setSemanas)}
                diaVencimento={controlado("diaVencimento", diaVencimento, setDiaVencimento)}
                publica={{ valor: publico, aoMudar: setPublico }}
              />
            ) : tipo === "avulsa" ? (
              <div className="flex flex-wrap gap-4">
                <div className="flex w-full min-w-0 flex-col gap-2">
                  <label htmlFor="lancar-nome" className="text-apoio text-tinta font-semibold">
                    {ROTULO_NOME}
                  </label>
                  <Input
                    id="lancar-nome"
                    ref={registrar("titulo")}
                    data-testid="lancar-nome"
                    autoComplete="off"
                    placeholder={PLACEHOLDER_NOME_AULA}
                    aria-describedby={idDoErro("titulo")}
                    aria-invalid={erros.titulo !== undefined}
                    value={titulo}
                    onChange={(evento) => {
                      setTitulo(evento.target.value);
                      limparErro("titulo");
                    }}
                    className={CLASSE_DO_CAMPO}
                  />
                  {erroDe("titulo")}
                </div>
                {campoData}
                <div className="flex min-w-0 grow basis-40 flex-col gap-2">
                  <label htmlFor="lancar-inicio" className="text-apoio text-tinta font-semibold">
                    {ROTULO_COMECA}
                  </label>
                  <Input
                    id="lancar-inicio"
                    ref={registrar("inicio")}
                    type="time"
                    step={300}
                    data-testid="lancar-inicio"
                    aria-describedby={idDoErro("inicio")}
                    aria-invalid={erros.inicio !== undefined}
                    value={inicio}
                    onChange={(evento) => {
                      setInicio(evento.target.value);
                      limparErro("inicio");
                      limparErro("fim");
                    }}
                    className={cn(CLASSE_DO_CAMPO, "tabular-nums")}
                  />
                  {erroDe("inicio")}
                </div>
                <div className="flex min-w-0 grow basis-40 flex-col gap-2">
                  <label htmlFor="lancar-fim" className="text-apoio text-tinta font-semibold">
                    {ROTULO_TERMINA}
                  </label>
                  <Input
                    id="lancar-fim"
                    ref={registrar("fim")}
                    type="time"
                    step={300}
                    data-testid="lancar-fim"
                    aria-describedby={idDoErro("fim")}
                    aria-invalid={erros.fim !== undefined}
                    value={fim}
                    onChange={(evento) => {
                      setFim(evento.target.value);
                      limparErro("fim");
                      limparErro("inicio");
                    }}
                    className={cn(CLASSE_DO_CAMPO, "tabular-nums")}
                  />
                  {erroDe("fim")}
                </div>
                <div className="flex min-w-0 grow basis-40 flex-col gap-2">
                  <label htmlFor="lancar-vagas" className="text-apoio text-tinta font-semibold">
                    {ROTULO_VAGAS}
                  </label>
                  <Input
                    id="lancar-vagas"
                    ref={registrar("vagas")}
                    inputMode="numeric"
                    data-testid="lancar-vagas"
                    autoComplete="off"
                    aria-describedby={idDoErro("vagas")}
                    aria-invalid={erros.vagas !== undefined}
                    value={vagas}
                    onChange={(evento) => {
                      setVagas(evento.target.value);
                      limparErro("vagas");
                    }}
                    className={cn(CLASSE_DO_CAMPO, "tabular-nums")}
                  />
                  {erroDe("vagas")}
                </div>
                <div className="flex min-w-0 grow basis-40 flex-col gap-2">
                  <label htmlFor="lancar-preco" className="text-apoio text-tinta font-semibold">
                    {ROTULO_PRECO_POR_PESSOA}
                  </label>
                  <Input
                    id="lancar-preco"
                    ref={registrar("preco")}
                    inputMode="decimal"
                    data-testid="lancar-preco"
                    autoComplete="off"
                    aria-describedby={idDoErro("preco")}
                    aria-invalid={erros.preco !== undefined}
                    value={preco}
                    onChange={(evento) => {
                      setPreco(evento.target.value);
                      limparErro("preco");
                    }}
                    className={cn(CLASSE_DO_CAMPO, "tabular-nums")}
                  />
                  {erroDe("preco")}
                </div>
                <label className="text-corpo text-tinta flex min-h-[44px] w-full items-center gap-3">
                  <Checkbox
                    data-testid="lancar-publico"
                    checked={publico}
                    onCheckedChange={(valor) => setPublico(valor === true)}
                    className="size-5"
                  />
                  {ROTULO_MOSTRAR_NO_SITE}
                </label>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {campoData}
                <div className="flex w-full min-w-0 flex-col gap-2">
                  <label htmlFor="lancar-motivo" className="text-apoio text-tinta font-semibold">
                    {ROTULO_MOTIVO}
                  </label>
                  <Input
                    id="lancar-motivo"
                    ref={registrar("motivo")}
                    data-testid="lancar-motivo"
                    autoComplete="off"
                    placeholder={PLACEHOLDER_MOTIVO}
                    aria-describedby={juntarIds("lancar-motivo-dica", idDoErro("motivo"))}
                    aria-invalid={erros.motivo !== undefined}
                    value={motivo}
                    onChange={(evento) => {
                      setMotivo(evento.target.value);
                      limparErro("motivo");
                    }}
                    className={CLASSE_DO_CAMPO}
                  />
                  <p id="lancar-motivo-dica" className="text-apoio text-tinta-fraca">
                    {DICA_MOTIVO}
                  </p>
                  {erroDe("motivo")}
                </div>
              </div>
            )}

            {/* D-13: a caixa avisa e o botão de gravar NÃO muda. A região viva existe sempre,
                para o leitor de tela anunciar quando o aviso aparece. */}
            <div role="status" aria-live="polite" data-testid="aviso-dia-fechado">
              {avisos.length > 0 ? (
                <div className="bg-atencao-fundo text-atencao flex items-start gap-2 rounded-md p-4">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <div className="text-apoio flex flex-col gap-1 font-semibold">
                    {avisos.map((aviso) => (
                      <p key={aviso}>{aviso}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <p className="text-apoio text-tinta-fraca">
              {tipo === "turma" ? DICA_TIPO_TURMA : tipo === "avulsa" ? DICA_TIPO_AULA : DICA_TIPO_FECHADO}
            </p>
          </div>

          {/* Rodapé preso por FLEX, fora da área rolável (G-03-1): o erro de gravação no topo. */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {erroGeral ? (
              <p role="alert" data-testid="lancar-erro-geral" className="text-apoio text-erro">
                {erroGeral}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="lancar-voltar"
                disabled={enviando}
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <Button
                type="submit"
                data-testid="lancar-gravar"
                disabled={enviando}
                aria-busy={enviando ? "true" : undefined}
                className="text-corpo h-auto min-h-[52px] flex-1 px-6 font-semibold whitespace-normal"
              >
                {enviando ? ROTULO_DE_GRAVAR[tipo].gravando : ROTULO_DE_GRAVAR[tipo].parado}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
