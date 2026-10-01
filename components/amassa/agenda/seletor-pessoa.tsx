"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { buscarPessoasParaData } from "@/lib/agenda/acoes";
import type { PessoasParaData } from "@/lib/agenda/consultas";
import type { PessoaDoSeletor } from "@/lib/agenda/seletor";
import {
  FRASE_DIGITE_PARA_BUSCAR,
  FRASE_ERRO_CARREGAR_PESSOAS,
  FRASE_HA_MAIS_PESSOAS,
  FRASE_NINGUEM_CADASTRADO_NO_SELETOR,
  FRASE_NINGUEM_COM_ESSE_NOME,
  PLACEHOLDER_BUSCAR_PELO_NOME,
  ROTULO_TENTAR_DE_NOVO,
  rotuloCadastrarTexto,
} from "@/lib/agenda/textos";
import { TOAST_PESSOA_CADASTRADA } from "@/lib/clientes/textos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormularioCliente } from "@/components/amassa/clientes/formulario-cliente";

// A espera depois da última tecla antes de buscar (a mesma da busca de Pessoas).
const ESPERA_DA_BUSCA_MS = 300;
const LINHAS_DO_ESQUELETO = [0, 1, 2] as const;

type Estado =
  | { tipo: "carregando" }
  | { tipo: "erro" }
  | { tipo: "pronto"; busca: string; dados: PessoasParaData };

// O que as setas percorrem, na ordem da tela: as pessoas de cada grupo e, com texto digitado,
// "Cadastrar “{texto}”" no fim.
type Opcao = { tipo: "pessoa"; pessoa: PessoaDoSeletor } | { tipo: "cadastrar"; texto: string };

// Esc com a lista aberta fecha SÓ a lista (05-UI-SPEC.md §"Teclado e leitor de tela"). O Radix ouve
// o Esc no documento, na captura, antes do campo: a folha que contém o seletor passa esta função no
// `onEscapeKeyDown` do `DialogContent`, e o Esc que nasceu num combobox aberto não a fecha.
export function naoFecharComOSeletorAberto(evento: globalThis.KeyboardEvent): void {
  const alvo = evento.target;
  if (
    alvo instanceof HTMLElement &&
    alvo.getAttribute("role") === "combobox" &&
    alvo.getAttribute("aria-expanded") === "true"
  ) {
    evento.preventDefault();
  }
}

export type SeletorPessoaProps = {
  // "Colocar alguém" (folha do evento) ou "Quem" (uso livre, plano 09).
  rotulo: string;
  // A data em que o seletor está — quem já está inscrito nela não aparece. Sem data: ninguém sai.
  eventoId?: string;
  // A pessoa escolhida numa linha, cadastrada pelo "Cadastrar “…”" ou o homônimo que já existia.
  aoEscolher: (pessoa: PessoaDoSeletor) => void;
  // A pessoa voltou a digitar: a escolha anterior deixa de valer.
  aoDigitar?: () => void;
  desabilitado?: boolean;
};

// O seletor de pessoa (UI-D5, confirmada pelo dono): um campo com busca (`role=combobox`) e a lista
// (`role=listbox`, um `role=group` com `aria-label` por grupo) logo abaixo, DENTRO da folha — nunca um
// `select` com todos. Acha sem acento e por pedaço do nome (a busca é do servidor, a mesma de
// Pessoas), mostra no máximo 8 por grupo (+ "Há mais pessoas…", backstop E8·overflow) e termina em
// "Cadastrar “{texto}”", que abre o formulário de pessoa do plano 04 por cima (com o aviso de
// homônimo, D-16) e, salvo, escolhe a pessoa.
//
// A lista só aparece com o campo em uso (`aria-expanded`): setas percorrem, Enter escolhe, Esc fecha
// a lista sem fechar a folha. Estados: esqueleto de 3 linhas enquanto busca; erro com "Tentar de
// novo"; os três vazios da UI-SPEC. Mensagens, esqueleto e erro ficam FORA do `listbox`, que só
// contém grupos e opções.
export function SeletorPessoa({ rotulo, eventoId, aoEscolher, aoDigitar, desabilitado = false }: SeletorPessoaProps) {
  const idBase = useId();
  const idDoCampo = `${idBase}-campo`;
  const idDaLista = `${idBase}-lista`;
  const campo = useRef<HTMLInputElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  // Depois de escolher, o foco que o Radix devolve ao campo (ao fechar o formulário de pessoa) não
  // reabre a lista; tocar no campo ou digitar, sim.
  const acabouDeEscolher = useRef(false);

  const [texto, setTexto] = useState("");
  const [expandido, setExpandido] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [ativa, setAtiva] = useState(-1);
  const [tentativa, setTentativa] = useState(0);
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  // Só a resposta da ÚLTIMA busca vale — uma lenta que chega depois não apaga a mais nova.
  const ultimaBusca = useRef(0);

  const busca = texto.trim();

  useEffect(() => {
    const numero = ++ultimaBusca.current;
    setEstado({ tipo: "carregando" });
    const espera = window.setTimeout(
      () => {
        void (async () => {
          let resposta: Awaited<ReturnType<typeof buscarPessoasParaData>>;
          try {
            resposta = await buscarPessoasParaData({ eventoId, busca });
          } catch {
            resposta = { ok: false, erro: FRASE_ERRO_CARREGAR_PESSOAS };
          }
          if (numero !== ultimaBusca.current) {
            return;
          }
          setEstado(resposta.ok ? { tipo: "pronto", busca, dados: resposta.dados } : { tipo: "erro" });
          setAtiva(-1);
        })();
      },
      // A primeira leitura (campo vazio) não espera.
      busca === "" ? 0 : ESPERA_DA_BUSCA_MS,
    );
    return () => window.clearTimeout(espera);
  }, [busca, eventoId, tentativa]);

  const opcoes: Opcao[] = [];
  if (estado.tipo === "pronto") {
    for (const grupo of estado.dados.grupos) {
      for (const pessoa of grupo.pessoas) {
        opcoes.push({ tipo: "pessoa", pessoa });
      }
    }
    if (estado.busca !== "") {
      opcoes.push({ tipo: "cadastrar", texto: estado.busca });
    }
  }

  function idDaOpcao(indice: number): string {
    return `${idBase}-opcao-${indice}`;
  }

  function fecharLista() {
    setExpandido(false);
    setAtiva(-1);
  }

  function escolher(pessoa: PessoaDoSeletor) {
    acabouDeEscolher.current = true;
    setTexto(pessoa.nome);
    fecharLista();
    aoEscolher(pessoa);
  }

  function ativar(opcao: Opcao) {
    if (opcao.tipo === "pessoa") {
      escolher(opcao.pessoa);
    } else {
      fecharLista();
      setCadastrando(opcao.texto);
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      if (expandido) {
        evento.preventDefault();
        fecharLista();
      }
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (!expandido) {
        setExpandido(true);
        return;
      }
      if (opcoes.length === 0) {
        return;
      }
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setAtiva((atual) =>
        atual === -1 ? (passo === 1 ? 0 : opcoes.length - 1) : (atual + passo + opcoes.length) % opcoes.length,
      );
      return;
    }
    if (evento.key === "Enter" && expandido && ativa >= 0 && ativa < opcoes.length) {
      evento.preventDefault();
      ativar(opcoes[ativa]);
    }
  }

  // Uma opção da lista: o toque não tira o foco do campo (`onMouseDown`), e o clique escolhe.
  function propsDaOpcao(indice: number, opcao: Opcao) {
    return {
      id: idDaOpcao(indice),
      role: "option" as const,
      "aria-selected": ativa === indice,
      tabIndex: -1,
      onMouseDown: (evento: { preventDefault: () => void }) => evento.preventDefault(),
      onClick: () => ativar(opcao),
      onMouseEnter: () => setAtiva(indice),
    };
  }

  // O que fica acima da lista: o esqueleto, o erro ou a mensagem do vazio.
  function situacao() {
    if (estado.tipo === "carregando") {
      return (
        <div aria-busy="true" className="flex flex-col gap-2 py-1" data-testid="seletor-carregando">
          {LINHAS_DO_ESQUELETO.map((linha) => (
            <Skeleton key={linha} className="h-11 w-full" />
          ))}
        </div>
      );
    }
    if (estado.tipo === "erro") {
      return (
        <div className="flex flex-col items-start gap-2 p-2" data-testid="seletor-erro">
          <p role="alert" className="text-apoio text-erro">
            {FRASE_ERRO_CARREGAR_PESSOAS}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTentativa((atual) => atual + 1)}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
          >
            {ROTULO_TENTAR_DE_NOVO}
          </Button>
        </div>
      );
    }
    const { grupos, ninguemCadastrado } = estado.dados;
    let mensagem: string | null = null;
    if (estado.busca === "") {
      mensagem = ninguemCadastrado ? FRASE_NINGUEM_CADASTRADO_NO_SELETOR : FRASE_DIGITE_PARA_BUSCAR;
    } else if (grupos.length === 0) {
      mensagem = FRASE_NINGUEM_COM_ESSE_NOME;
    }
    if (mensagem === null) {
      return null;
    }
    return (
      <p className="text-apoio text-tinta-fraca px-3 py-2" data-testid="seletor-mensagem">
        {mensagem}
      </p>
    );
  }

  // Os grupos e as opções — o único conteúdo do `listbox`.
  function itensDaLista() {
    if (estado.tipo !== "pronto") {
      return null;
    }
    let indice = 0;
    const grupos = estado.dados.grupos.map((grupo) => (
      <div key={grupo.chave} role="group" aria-label={grupo.rotulo} className="flex flex-col">
        <div
          role="presentation"
          className={cn(
            "text-apoio px-3 pt-2 pb-1 font-semibold",
            grupo.chave === "a_repor" ? "text-atencao" : "text-tinta-media",
          )}
        >
          {grupo.rotulo}
        </div>
        {grupo.pessoas.map((pessoa) => {
          const meu = indice++;
          return (
            <div
              key={pessoa.id}
              {...propsDaOpcao(meu, { tipo: "pessoa", pessoa })}
              data-testid="seletor-opcao"
              data-cliente-id={pessoa.id}
              className={cn(
                "flex min-h-[44px] cursor-pointer flex-col justify-center rounded-md px-3 py-2",
                ativa === meu ? "bg-superficie-2" : "hover:bg-superficie-2",
              )}
            >
              <span className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">{pessoa.nome}</span>
              {pessoa.telefone !== null ? (
                <span className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">{pessoa.telefone}</span>
              ) : null}
            </div>
          );
        })}
        {grupo.temMais ? (
          // Não selecionável: as setas pulam esta linha.
          <div
            role="option"
            aria-disabled="true"
            aria-selected={false}
            data-testid="seletor-ha-mais"
            className="text-apoio text-tinta-fraca px-3 py-2"
          >
            {FRASE_HA_MAIS_PESSOAS}
          </div>
        ) : null}
      </div>
    ));
    const busca = estado.busca;
    if (busca === "") {
      return grupos;
    }
    const meu = indice++;
    return (
      <>
        {grupos}
        <div
          {...propsDaOpcao(meu, { tipo: "cadastrar", texto: busca })}
          data-testid="seletor-cadastrar"
          className={cn(
            "text-corpo text-acento flex min-h-[44px] cursor-pointer items-center rounded-md px-3 py-2 font-semibold underline underline-offset-4 [overflow-wrap:anywhere]",
            ativa === meu ? "bg-superficie-2" : "hover:bg-superficie-2",
          )}
        >
          {rotuloCadastrarTexto(busca)}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="seletor-pessoa">
      <label htmlFor={idDoCampo} className="text-apoio text-tinta font-semibold">
        {rotulo}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <Input
          ref={campo}
          id={idDoCampo}
          type="text"
          role="combobox"
          aria-expanded={expandido}
          aria-controls={idDaLista}
          aria-autocomplete="list"
          aria-activedescendant={expandido && ativa >= 0 ? idDaOpcao(ativa) : undefined}
          autoComplete="off"
          placeholder={PLACEHOLDER_BUSCAR_PELO_NOME}
          disabled={desabilitado}
          value={texto}
          onChange={(evento) => {
            acabouDeEscolher.current = false;
            setTexto(evento.target.value);
            setExpandido(true);
            setAtiva(-1);
            aoDigitar?.();
          }}
          onFocus={() => {
            if (!acabouDeEscolher.current) {
              setExpandido(true);
            }
          }}
          onClick={() => setExpandido(true)}
          onBlur={(evento) => {
            // Tocar em "Tentar de novo" não fecha a lista (as opções nem tiram o foco do campo).
            if (!painel.current?.contains(evento.relatedTarget as Node | null)) {
              fecharLista();
            }
          }}
          onKeyDown={aoTeclar}
          data-testid="seletor-campo"
          className="text-corpo md:text-corpo bg-superficie min-h-[44px] pl-10"
        />
      </div>

      <div
        ref={painel}
        className={cn("border-borda bg-superficie flex-col rounded-md border p-1", expandido ? "flex" : "hidden")}
        data-testid="seletor-painel"
      >
        {expandido ? situacao() : null}
        <div
          id={idDaLista}
          role="listbox"
          aria-label={rotulo}
          className={cn("flex-col", expandido && opcoes.length > 0 ? "flex" : "hidden")}
        >
          {expandido ? itensDaLista() : null}
        </div>
      </div>

      {cadastrando !== null ? (
        <FormularioCliente
          contexto="agenda"
          clienteParaEditar={null}
          nomeInicial={cadastrando}
          aoFechar={() => {
            setCadastrando(null);
            campo.current?.focus();
          }}
          aoSalvar={(salva) => {
            setCadastrando(null);
            if (salva.criado) {
              toast.success(TOAST_PESSOA_CADASTRADA);
            }
            escolher({ id: salva.id, nome: salva.nome, telefone: salva.telefone });
          }}
          aoUsarExistente={(homonimo) => {
            setCadastrando(null);
            escolher({ id: homonimo.id, nome: homonimo.nome, telefone: homonimo.telefone });
          }}
        />
      ) : null}
    </div>
  );
}
