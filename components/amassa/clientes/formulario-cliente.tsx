"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";

import { criarCliente, editarCliente, type Homonimo } from "@/lib/clientes/acoes";
import type { ClienteDaLista } from "@/lib/clientes/consultas";
import {
  DICA_NOME,
  DICA_TELEFONE,
  FRASE_FALHA_AO_SALVAR,
  ROTULO_FECHAR,
  ROTULO_NOME,
  ROTULO_SALVANDO,
  ROTULO_SALVAR_CLIENTE,
  ROTULO_SALVAR_MESMO_ASSIM,
  ROTULO_SALVAR_PESSOA,
  ROTULO_TELEFONE,
  ROTULO_VOLTAR,
  TITULO_NOVO_CLIENTE,
  TITULO_PESSOA_NOVA,
  tituloEditarPessoa,
  type ContextoDoCadastro,
} from "@/lib/clientes/textos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { AvisoHomonimo } from "./aviso-homonimo";

type Campo = "nome" | "telefone";

const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

const TEXTOS_DO_CONTEXTO: Record<ContextoDoCadastro, { tituloNovo: string; salvar: string }> = {
  agenda: { tituloNovo: TITULO_PESSOA_NOVA, salvar: ROTULO_SALVAR_PESSOA },
  cadastros: { tituloNovo: TITULO_NOVO_CLIENTE, salvar: ROTULO_SALVAR_CLIENTE },
};

export type ClienteSalvo = { id: string; nome: string; criado: boolean };

export type FormularioClienteProps = {
  // "agenda": "Pessoa nova" / "Salvar pessoa"; "cadastros": "Novo cliente" / "Salvar cliente".
  // Editando, o título é "Editar {nome}" nos dois.
  contexto: ContextoDoCadastro;
  // `null` = cadastrar; um cliente = editar nome e telefone.
  clienteParaEditar: ClienteDaLista | null;
  // "Cadastrar “{busca}”" abre o formulário com o nome já escrito.
  nomeInicial?: string;
  aoFechar: () => void;
  aoSalvar: (salvo: ClienteSalvo) => void;
  // "Usar {nome} que já existe" — quem abriu decide: Cadastros filtra a lista, a Agenda abre a ficha,
  // o seletor de pessoa (plano 05) escolhe a pessoa.
  aoUsarExistente: (homonimo: Homonimo) => void;
};

// O formulário de pessoa — UM componente para o mesmo cadastro (D-01), em Cadastros → Clientes, na
// Agenda → Pessoas (e na ficha, "Editar" — UI-D24) e no seletor de pessoa do plano 05: o aviso de
// homônimo (D-16) vale nos três lugares. Diálogo de tela toda no celular, `max-w-lg` a partir de `md`
// (o contêiner das folhas). A validação é do servidor (Zod em `criarCliente`/`editarCliente`); o erro
// aparece embaixo do campo, com o foco no primeiro campo com erro. Enquanto grava: "Salvando…" e
// `disabled`, com uma guarda síncrona — um toque duplo cria UMA pessoa.
//
// Quem usa monta o componente para abrir e o desmonta para fechar: cada abertura nasce limpa.
export function FormularioCliente({
  contexto,
  clienteParaEditar,
  nomeInicial,
  aoFechar,
  aoSalvar,
  aoUsarExistente,
}: FormularioClienteProps) {
  const editando = clienteParaEditar !== null;
  const textos = TEXTOS_DO_CONTEXTO[contexto];
  const titulo = editando ? tituloEditarPessoa(clienteParaEditar.nome) : textos.tituloNovo;

  const [nome, setNome] = useState(clienteParaEditar?.nome ?? nomeInicial ?? "");
  const [telefone, setTelefone] = useState(clienteParaEditar?.telefone ?? "");
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [homonimos, setHomonimos] = useState<Homonimo[]>([]);
  const [gravando, setGravando] = useState(false);
  const gravandoAgora = useRef(false);
  const campos = useRef<Partial<Record<Campo, HTMLInputElement | null>>>({});

  // Editando com o aviso na tela, o primário grava mesmo assim (D-16 — "Salvar mesmo assim").
  const confirmarPeloPrimario = editando && homonimos.length > 0;

  async function gravar(confirmarHomonimo: boolean) {
    if (gravandoAgora.current) {
      return;
    }
    gravandoAgora.current = true;
    setGravando(true);
    setErroGeral(null);

    const dados = { nome, telefone, confirmarHomonimo };
    let resposta: Awaited<ReturnType<typeof criarCliente>>;
    try {
      resposta = editando
        ? await editarCliente({ id: clienteParaEditar.id, ...dados })
        : await criarCliente(dados);
    } catch {
      resposta = { ok: false, erro: FRASE_FALHA_AO_SALVAR };
    }

    gravandoAgora.current = false;
    setGravando(false);

    if (resposta.ok) {
      aoSalvar({ ...resposta.dados, criado: !editando });
      return;
    }
    if (resposta.homonimos && resposta.homonimos.length > 0) {
      setErros({});
      setHomonimos(resposta.homonimos);
      return;
    }
    const errosDosCampos = resposta.campos ?? {};
    setErros(errosDosCampos);
    const primeiro = (["nome", "telefone"] as const).find((campo) => errosDosCampos[campo] !== undefined);
    if (primeiro) {
      campos.current[primeiro]?.focus();
    } else {
      setErroGeral(resposta.erro ?? FRASE_FALHA_AO_SALVAR);
    }
  }

  function erroDe(campo: Campo) {
    const mensagem = erros[campo];
    if (mensagem === undefined) {
      return null;
    }
    return (
      <p id={`cliente-erro-${campo}`} role="alert" data-testid={`cliente-erro-${campo}`} className="text-apoio text-erro">
        {mensagem}
      </p>
    );
  }

  function descricaoDe(campo: Campo): string {
    return erros[campo] === undefined ? `cliente-dica-${campo}` : `cliente-dica-${campo} cliente-erro-${campo}`;
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !gravandoAgora.current) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="formulario-cliente"
        aria-describedby={undefined}
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          // Foco inicial só a partir de 768px — no celular o teclado não sobe sozinho tapando a folha.
          if (window.matchMedia("(min-width: 768px)").matches) {
            campos.current.nome?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <DialogTitle className="text-titulo text-tinta min-w-0 break-words">{titulo}</DialogTitle>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="formulario-cliente-fechar"
            disabled={gravando}
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
            void gravar(confirmarPeloPrimario);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="cliente-nome" className="text-apoio text-tinta font-semibold">
                {ROTULO_NOME}
              </label>
              <Input
                id="cliente-nome"
                ref={(elemento) => {
                  campos.current.nome = elemento;
                }}
                data-testid="cliente-nome"
                autoComplete="off"
                aria-describedby={descricaoDe("nome")}
                aria-invalid={erros.nome !== undefined}
                value={nome}
                onChange={(evento) => {
                  setNome(evento.target.value);
                  setErros((anteriores) => ({ ...anteriores, nome: undefined }));
                  // Outro nome, outra pergunta: o aviso de homônimo era do nome anterior.
                  setHomonimos([]);
                }}
                className={CLASSE_DO_CAMPO}
              />
              <p id="cliente-dica-nome" className="text-apoio text-tinta-fraca">
                {DICA_NOME}
              </p>
              {erroDe("nome")}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="cliente-telefone" className="text-apoio text-tinta font-semibold">
                {ROTULO_TELEFONE}
              </label>
              <Input
                id="cliente-telefone"
                ref={(elemento) => {
                  campos.current.telefone = elemento;
                }}
                data-testid="cliente-telefone"
                type="text"
                inputMode="tel"
                autoComplete="off"
                aria-describedby={descricaoDe("telefone")}
                aria-invalid={erros.telefone !== undefined}
                value={telefone}
                onChange={(evento) => {
                  setTelefone(evento.target.value);
                  setErros((anteriores) => ({ ...anteriores, telefone: undefined }));
                }}
                className={CLASSE_DO_CAMPO}
              />
              <p id="cliente-dica-telefone" className="text-apoio text-tinta-fraca">
                {DICA_TELEFONE}
              </p>
              {erroDe("telefone")}
            </div>

            <AvisoHomonimo
              homonimos={homonimos}
              modo={editando ? "editar" : "criar"}
              gravando={gravando}
              aoUsarExistente={aoUsarExistente}
              aoCriarOutra={() => void gravar(true)}
            />
          </div>

          {/* Rodapé preso por flex, fora da área rolável: "Voltar" · o primário. */}
          <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
            {erroGeral ? (
              <p role="alert" data-testid="cliente-erro-geral" className="text-apoio text-erro">
                {erroGeral}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="cliente-voltar"
                disabled={gravando}
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
              <Button
                type="submit"
                data-testid="cliente-salvar"
                disabled={gravando}
                aria-busy={gravando ? "true" : undefined}
                className="text-corpo h-auto min-h-[52px] flex-1 px-6 font-semibold whitespace-normal"
              >
                {gravando ? ROTULO_SALVANDO : confirmarPeloPrimario ? ROTULO_SALVAR_MESMO_ASSIM : textos.salvar}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
