"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { pessoaDaUrl, turmaDaUrl } from "@/lib/agenda/abas";
import {
  DICA_PESSOAS,
  FRASE_LANCAMENTO_NAO_EXISTE,
  FRASE_VAZIO_PESSOAS_CORPO,
  FRASE_VAZIO_PESSOAS_TITULO,
  ROTULO_ABRIR,
  ROTULO_MAIS_PESSOA,
  TITULO_PESSOAS,
  ariaAbrirFicha,
  tagARepor,
} from "@/lib/agenda/textos";
import type { ClienteDaLista } from "@/lib/clientes/consultas";
import { QUANTOS_POR_VEZ, subLinhaDaPessoa, type TurmaDaSubLinha } from "@/lib/clientes/lista";
import {
  ARIA_BUSCAR_PESSOA,
  FRASE_NINGUEM_COM_ESSE_NOME,
  PLACEHOLDER_BUSCA,
  ROTULO_MOSTRAR_MAIS,
  TOAST_CADASTRO_SALVO,
  TOAST_PESSOA_CADASTRADA,
  rotuloCadastrarBusca,
} from "@/lib/clientes/textos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { FormularioCliente, type ClienteSalvo } from "@/components/amassa/clientes/formulario-cliente";
import { useBuscaNaUrl } from "@/components/amassa/clientes/usar-busca-na-url";

import { FichaPessoa, type ConteudoDaFicha } from "./ficha-pessoa";
import { FolhaTurma } from "./folha-turma";
import type { TurmaDoServidor } from "./semana-da-agenda";

// A ficha de `?pessoa=`, como o servidor a leu.
export type FichaDoServidor =
  | { estado: "nenhuma" }
  | { estado: "carregada"; pessoa: ClienteDaLista; conteudo: ConteudoDaFicha }
  | { estado: "inexistente"; id: string }
  | { estado: "erro"; id: string; pessoa: ClienteDaLista | null };

export type ListaPessoasProps = {
  pessoas: ClienteDaLista[];
  haMais: boolean;
  busca: string;
  quantos: number;
  ficha: FichaDoServidor;
  // As turmas ativas de cada pessoa da lista, para a sub-linha (quem não tem turma não aparece).
  turmasPorPessoa: Record<string, TurmaDaSubLinha[]>;
  // As aulas a repor de cada pessoa da lista (só quem tem — saldo > 0): a tag âmbar "{n} a repor".
  aReporPorPessoa: Record<string, number>;
  // A turma de `?turma=` ("ver turma" na ficha), como o servidor a leu.
  turmaAberta: TurmaDoServidor;
  // O "hoje" de Brasília, decidido no servidor (a folha da turma o usa).
  hoje: string;
};

type Formulario = { tipo: "novo"; nomeInicial?: string } | { tipo: "editar"; pessoa: ClienteDaLista };

// A aba Pessoas da Agenda (AGE-06, 05-UI-SPEC.md §"Aba Pessoas"): o cadastro de clientes da AMASSA —
// o MESMO de Cadastros → Clientes (D-01), lido por `lib/clientes`. Busca no servidor sem acento e por
// pedaço do nome (300 ms, `?busca=`), ordem alfabética, 50 por vez (`?quantos=`, UI-D23). "+ Pessoa"
// abre o formulário de pessoa; salvar abre a ficha dela. "Abrir" abre a ficha por `?pessoa={id}`
// (UI-D8: o voltar do Android a fecha) NA HORA, com o cabeçalho que a linha já conhece, e a pede ao
// servidor — o resto chega quando ele responde. Um diálogo por vez: "Editar" na ficha troca a ficha
// pelo formulário, e "Voltar" devolve à ficha; "ver turma" troca a ficha pela folha da turma
// (`?turma=`, no lugar — UI-SPEC §"Folha da turma"), e fechar a folha devolve à ficha.
export function ListaPessoas({
  pessoas,
  haMais,
  busca,
  quantos,
  ficha,
  turmasPorPessoa,
  aReporPorPessoa,
  turmaAberta,
  hoje,
}: ListaPessoasProps) {
  const router = useRouter();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const idNaUrl = pessoaDaUrl(parametros.get("pessoa") ?? undefined);
  const idDaTurmaNaUrl = turmaDaUrl(parametros.get("turma") ?? undefined);

  const [aberta, setAberta] = useState<string | null>(idNaUrl);
  const [tocada, setTocada] = useState<ClienteDaLista | null>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);

  // A URL manda: o voltar do navegador tira o `?pessoa=` e a ficha fecha; um link com ele a abre.
  useEffect(() => {
    setAberta(idNaUrl);
  }, [idNaUrl]);

  // A folha da turma aberta pela ficha ("ver turma"): muda NA HORA do toque, com o nome tocado no
  // cabeçalho enquanto o servidor lê o resto, e segue a URL depois.
  const [turmaAbertaId, setTurmaAbertaId] = useState<string | null>(idDaTurmaNaUrl);
  const [turmaTocada, setTurmaTocada] = useState<{ id: string; nome: string } | null>(null);
  useEffect(() => {
    setTurmaAbertaId(idDaTurmaNaUrl);
  }, [idDaTurmaNaUrl]);

  function urlCom(mudancas: Record<string, string | null>): string {
    const novos = new URLSearchParams(parametros.toString());
    novos.set("aba", "pessoas");
    for (const [nome, valor] of Object.entries(mudancas)) {
      if (valor === null) {
        novos.delete(nome);
      } else {
        novos.set(nome, valor);
      }
    }
    return `${caminho}?${novos.toString()}`;
  }

  const { texto, setTexto } = useBuscaNaUrl(busca, (termo) =>
    router.replace(urlCom({ busca: termo === "" ? null : termo, quantos: null, pessoa: null }), { scroll: false }),
  );

  // Pessoa que não existe mais (link velho): o toast UMA vez, a folha não abre e o parâmetro sai.
  const avisado = useRef<string | null>(null);
  const idInexistente = ficha.estado === "inexistente" ? ficha.id : null;
  useEffect(() => {
    if (idInexistente !== null && idInexistente === idNaUrl && avisado.current !== idInexistente) {
      avisado.current = idInexistente;
      toast(FRASE_LANCAMENTO_NAO_EXISTE);
      router.replace(urlCom({ pessoa: null }), { scroll: false });
    }
    // `urlCom` lê os parâmetros atuais; o efeito só depende do aviso e do id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idInexistente, idNaUrl]);

  function abrir(pessoa: ClienteDaLista) {
    setTocada(pessoa);
    setAberta(pessoa.id);
    router.push(urlCom({ pessoa: pessoa.id }), { scroll: false });
  }

  function fechar() {
    setAberta(null);
    setTocada(null);
    router.push(urlCom({ pessoa: null, turma: null }), { scroll: false });
  }

  function abrirTurma(turmaId: string, nome: string) {
    setTurmaTocada({ id: turmaId, nome });
    setTurmaAbertaId(turmaId);
    router.push(urlCom({ turma: turmaId }), { scroll: false });
  }

  // Fechar a folha da turma (o "Voltar" ou o fechar) devolve à ficha de onde ela veio.
  function voltarAFicha() {
    setTurmaTocada(null);
    setTurmaAbertaId(null);
    router.push(urlCom({ turma: null }), { scroll: false });
  }

  // `?turma=` com um id que não existe (link velho): o toast, uma vez, e o parâmetro sai da URL.
  const turmaAvisada = useRef<string | null>(null);
  useEffect(() => {
    if (turmaAberta.estado === "inexistente" && turmaAvisada.current !== turmaAberta.id) {
      turmaAvisada.current = turmaAberta.id;
      toast(FRASE_LANCAMENTO_NAO_EXISTE);
      router.replace(urlCom({ turma: null }), { scroll: false });
    }
    // `urlCom` lê os parâmetros atuais; o efeito só depende da turma lida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaAberta]);

  const turmaCarregada =
    turmaAberta.estado === "carregada" && turmaAberta.turma.id === turmaAbertaId ? turmaAberta.turma : null;
  const erroDaTurma = turmaAberta.estado === "erro" && turmaAberta.id === turmaAbertaId;
  const cabecalhoDaTurma =
    turmaCarregada !== null
      ? { id: turmaCarregada.id, nome: turmaCarregada.nome }
      : turmaTocada !== null && turmaTocada.id === turmaAbertaId
        ? turmaTocada
        : erroDaTurma && turmaAbertaId !== null
          ? { id: turmaAbertaId, nome: "" }
          : null;

  function aoSalvar(salvo: ClienteSalvo) {
    setFormulario(null);
    if (salvo.criado) {
      toast(TOAST_PESSOA_CADASTRADA);
      // A pessoa nova: a ficha dela abre (05-UI-SPEC.md §"Aba Pessoas").
      abrir(salvo);
      return;
    }
    toast(TOAST_CADASTRO_SALVO);
    // Editada pela ficha: a ficha continua aberta e é relida, com o nome e o telefone novos — e a
    // lista também.
    setTocada(salvo);
    router.refresh();
  }

  // A ficha aberta: o cabeçalho é o do servidor quando ele já respondeu por esta pessoa; antes disso,
  // o da linha tocada (ou da pessoa recém-salva). A leitura falhou: o que se souber, ou nada.
  const carregada = ficha.estado === "carregada" && ficha.pessoa.id === aberta ? ficha : null;
  const falhou = ficha.estado === "erro" && ficha.id === aberta ? ficha : null;
  const cabecalho =
    carregada?.pessoa ?? (tocada !== null && tocada.id === aberta ? tocada : null) ?? falhou?.pessoa ?? null;
  const fichaVisivel = aberta !== null && (cabecalho !== null || falhou !== null);

  const dialogo =
    formulario !== null ? (
      <FormularioCliente
        contexto="agenda"
        clienteParaEditar={formulario.tipo === "editar" ? formulario.pessoa : null}
        nomeInicial={formulario.tipo === "novo" ? formulario.nomeInicial : undefined}
        aoFechar={() => setFormulario(null)}
        aoSalvar={aoSalvar}
        // "Usar {nome} que já existe" na Agenda: abre a ficha dela.
        aoUsarExistente={(homonimo) => {
          setFormulario(null);
          abrir(homonimo);
        }}
      />
    ) : turmaAbertaId !== null && cabecalhoDaTurma !== null ? (
      <FolhaTurma
        cabecalho={cabecalhoDaTurma}
        carregada={turmaCarregada}
        erroAoCarregar={erroDaTurma}
        hoje={hoje}
        aoVoltarAData={null}
        aoFechar={voltarAFicha}
      />
    ) : fichaVisivel ? (
      <FichaPessoa
        pessoa={cabecalho}
        conteudo={carregada?.conteudo ?? null}
        falhou={falhou !== null}
        aoFechar={fechar}
        aoEditar={(pessoa) => setFormulario({ tipo: "editar", pessoa })}
        aoTentarDeNovo={() => router.refresh()}
        aoAbrirTurma={abrirTurma}
      />
    ) : null;

  // Ninguém cadastrado (sem busca): o vazio, com "+ Pessoa" como primário — o do cabeçalho some (um
  // terracota por tela).
  if (pessoas.length === 0 && busca === "") {
    return (
      <section className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4" data-testid="lista-pessoas">
        <h2 className="text-titulo text-tinta">{TITULO_PESSOAS}</h2>
        <EstadoVazio
          testId="pessoas-vazio"
          titulo={FRASE_VAZIO_PESSOAS_TITULO}
          corpo={FRASE_VAZIO_PESSOAS_CORPO}
          botao={
            <Button
              type="button"
              data-testid="mais-pessoa"
              onClick={() => setFormulario({ tipo: "novo" })}
              className="text-corpo min-h-[44px] px-4 font-semibold"
            >
              {ROTULO_MAIS_PESSOA}
            </Button>
          }
        />
        {dialogo}
      </section>
    );
  }

  return (
    <section className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4" data-testid="lista-pessoas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-titulo text-tinta">{TITULO_PESSOAS}</h2>
        <Button
          type="button"
          variant="outline"
          data-testid="mais-pessoa"
          onClick={() => setFormulario({ tipo: "novo" })}
          className="text-corpo min-h-[44px] px-4"
        >
          {ROTULO_MAIS_PESSOA}
        </Button>
      </div>

      <Input
        type="search"
        data-testid="busca-pessoa"
        aria-label={ARIA_BUSCAR_PESSOA}
        placeholder={PLACEHOLDER_BUSCA}
        autoComplete="off"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        className="text-corpo md:text-corpo min-h-[44px] w-full"
      />

      {pessoas.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2" data-testid="pessoas-sem-resultado">
          <p className="text-corpo text-tinta-fraca">{FRASE_NINGUEM_COM_ESSE_NOME}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFormulario({ tipo: "novo", nomeInicial: busca })}
            className="text-corpo h-auto min-h-[44px] max-w-full px-4 text-left whitespace-normal break-words"
          >
            {rotuloCadastrarBusca(busca)}
          </Button>
        </div>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {pessoas.map((pessoa) => (
            <li
              key={pessoa.id}
              data-testid="pessoa-linha"
              data-cliente-id={pessoa.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-corpo text-tinta min-w-0 font-semibold break-words">{pessoa.nome}</span>
                {(aReporPorPessoa[pessoa.id] ?? 0) > 0 ? (
                  <span
                    data-testid="pessoa-a-repor"
                    className="text-apoio bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold whitespace-nowrap"
                  >
                    {tagARepor(aReporPorPessoa[pessoa.id] ?? 0)}
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="outline"
                aria-label={ariaAbrirFicha(pessoa.nome)}
                onClick={() => abrir(pessoa)}
                className="text-corpo row-span-2 min-h-[44px] shrink-0 px-4"
              >
                {ROTULO_ABRIR}
              </Button>
              <span className="text-apoio text-tinta-fraca min-w-0 break-words" data-testid="pessoa-sub-linha">
                {subLinhaDaPessoa({ telefone: pessoa.telefone, turmas: turmasPorPessoa[pessoa.id] ?? [] })}
              </span>
            </li>
          ))}
        </ul>
      )}

      {haMais ? (
        <Button asChild variant="outline" className="text-corpo min-h-[44px] self-start px-4">
          <Link href={urlCom({ quantos: String(quantos + QUANTOS_POR_VEZ), pessoa: null })} scroll={false}>
            {ROTULO_MOSTRAR_MAIS}
          </Link>
        </Button>
      ) : null}

      <p className="text-apoio text-tinta-fraca">{DICA_PESSOAS}</p>

      {dialogo}
    </section>
  );
}

// Pessoas carregando (05-UI-SPEC.md §Carregando): a busca + 6 linhas, dentro do bloco.
const LINHAS_DO_ESQUELETO = [0, 1, 2, 3, 4, 5] as const;

export function EsqueletoDasPessoas() {
  return (
    <div
      className="bg-superficie border-border flex flex-col gap-4 rounded-lg border p-4"
      aria-busy="true"
      data-testid="pessoas-carregando"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-11 w-28 rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
      {LINHAS_DO_ESQUELETO.map((linha) => (
        <Skeleton key={linha} className="h-11 w-full" />
      ))}
    </div>
  );
}
