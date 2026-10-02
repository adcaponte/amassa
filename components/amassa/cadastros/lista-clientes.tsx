"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ClienteDaLista } from "@/lib/clientes/consultas";
import { QUANTOS_POR_VEZ } from "@/lib/clientes/lista";
import {
  ARIA_BUSCAR_PESSOA,
  DICA_CLIENTES,
  FRASE_NINGUEM_COM_ESSE_NOME,
  FRASE_VAZIO_CLIENTES_CORPO,
  FRASE_VAZIO_CLIENTES_TITULO,
  PLACEHOLDER_BUSCA,
  ROTULO_EDITAR,
  ROTULO_MOSTRAR_MAIS,
  ROTULO_NOVO_CLIENTE,
  TOAST_CADASTRO_SALVO,
  TOAST_PESSOA_CADASTRADA,
  ariaEditarCliente,
  rotuloCadastrarBusca,
} from "@/lib/clientes/textos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoVazio } from "@/components/amassa/estado-vazio";
import { FormularioCliente, type ClienteSalvo } from "@/components/amassa/clientes/formulario-cliente";
import { useBuscaNaUrl } from "@/components/amassa/clientes/usar-busca-na-url";

export type ListaClientesProps = {
  clientes: ClienteDaLista[];
  haMais: boolean;
  busca: string;
  quantos: number;
};

type AlvoDoFormulario = { tipo: "novo"; nomeInicial?: string } | { tipo: "editar"; cliente: ClienteDaLista };

// O endereço de Cadastros → Clientes com a busca e o "quantos" — a URL manda (`?busca=`, `?quantos=`).
function enderecoDosClientes(caminho: string, busca: string, quantos?: number): string {
  const parametros = new URLSearchParams({ sub: "clientes" });
  if (busca !== "") {
    parametros.set("busca", busca);
  }
  if (quantos !== undefined && quantos > QUANTOS_POR_VEZ) {
    parametros.set("quantos", String(quantos));
  }
  return `${caminho}?${parametros.toString()}`;
}

// Cadastros → Clientes (D-01, UI-D20): o MESMO cadastro das Pessoas da Agenda, com o MESMO formulário.
// "Novo cliente" é o primário da sub-aba; a busca é a de Pessoas (300 ms, sem acento, por pedaço do
// nome, no servidor); 50 por vez + "Mostrar mais 50". Nenhum "desativar" e nenhum "apagar": pessoa
// não se apaga (vendas, presenças e mensalidades apontam para ela).
export function ListaClientes({ clientes, haMais, busca, quantos }: ListaClientesProps) {
  const router = useRouter();
  const caminho = usePathname();
  const [alvo, setAlvo] = useState<AlvoDoFormulario | null>(null);
  const { texto, setTexto, buscarJa } = useBuscaNaUrl(busca, (termo) =>
    router.replace(enderecoDosClientes(caminho, termo), { scroll: false }),
  );

  function aoSalvar(salvo: ClienteSalvo) {
    setAlvo(null);
    toast(salvo.criado ? TOAST_PESSOA_CADASTRADA : TOAST_CADASTRO_SALVO);
    router.refresh();
  }

  const formulario =
    alvo === null ? null : (
      <FormularioCliente
        contexto="cadastros"
        clienteParaEditar={alvo.tipo === "editar" ? alvo.cliente : null}
        nomeInicial={alvo.tipo === "novo" ? alvo.nomeInicial : undefined}
        aoFechar={() => setAlvo(null)}
        aoSalvar={aoSalvar}
        // "Usar {nome} que já existe" em Cadastros: fecha o formulário e filtra a lista por aquele
        // nome (decisão do 05-04 — a UI-SPEC só define o "Usar" da Agenda e do seletor).
        aoUsarExistente={(homonimo) => {
          setAlvo(null);
          buscarJa(homonimo.nome);
        }}
      />
    );

  // Ninguém cadastrado (sem busca): o vazio da UI-SPEC, com "Novo cliente" — e nenhuma busca.
  if (clientes.length === 0 && busca === "") {
    return (
      <>
        <EstadoVazio
          testId="clientes-vazio"
          titulo={FRASE_VAZIO_CLIENTES_TITULO}
          corpo={FRASE_VAZIO_CLIENTES_CORPO}
          botao={
            <Button
              type="button"
              data-testid="novo-cliente"
              onClick={() => setAlvo({ tipo: "novo" })}
              className="text-corpo min-h-[44px] px-4 font-semibold"
            >
              {ROTULO_NOVO_CLIENTE}
            </Button>
          }
        />
        {formulario}
      </>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4 px-6 py-6 md:px-8" data-testid="lista-clientes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-apoio text-muted-foreground max-w-prose">{DICA_CLIENTES}</p>
        <Button
          type="button"
          data-testid="novo-cliente"
          onClick={() => setAlvo({ tipo: "novo" })}
          className="text-corpo min-h-[44px] px-4 font-semibold"
        >
          {ROTULO_NOVO_CLIENTE}
        </Button>
      </div>

      <Input
        type="search"
        data-testid="busca-cliente"
        aria-label={ARIA_BUSCAR_PESSOA}
        placeholder={PLACEHOLDER_BUSCA}
        autoComplete="off"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        className="text-corpo md:text-corpo min-h-[44px] w-full"
      />

      {clientes.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2" data-testid="clientes-sem-resultado">
          <p className="text-corpo text-tinta-fraca">{FRASE_NINGUEM_COM_ESSE_NOME}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAlvo({ tipo: "novo", nomeInicial: busca })}
            className="text-corpo h-auto min-h-[44px] px-4 text-left whitespace-normal break-words"
          >
            {rotuloCadastrarBusca(busca)}
          </Button>
        </div>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {clientes.map((cliente) => (
            <li
              key={cliente.id}
              data-testid="cliente-linha"
              data-cliente-id={cliente.id}
              className="flex items-center justify-between gap-3 py-4"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-corpo text-tinta break-words">{cliente.nome}</span>
                {cliente.telefone !== null ? (
                  <span className="text-apoio text-tinta-fraca break-words" data-testid="cliente-linha-telefone">
                    {cliente.telefone}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label={ariaEditarCliente(cliente.nome)}
                onClick={() => setAlvo({ tipo: "editar", cliente })}
                className="text-corpo min-h-[44px] shrink-0 px-4"
              >
                {ROTULO_EDITAR}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {haMais ? (
        <Button asChild variant="outline" className="text-corpo min-h-[44px] self-start px-4">
          <Link href={enderecoDosClientes(caminho, busca, quantos + QUANTOS_POR_VEZ)} scroll={false}>
            {ROTULO_MOSTRAR_MAIS}
          </Link>
        </Button>
      ) : null}

      {formulario}
    </div>
  );
}

// Backstop E22·loading (a UI-SPEC não desenhava): o esqueleto no formato da lista — o campo de busca
// e 6 linhas de 44px —, nunca a tela em branco.
const LINHAS_DO_ESQUELETO = [0, 1, 2, 3, 4, 5] as const;

export function EsqueletoDosClientes() {
  return (
    <div className="flex max-w-3xl flex-col gap-4 px-6 py-6 md:px-8" aria-busy="true" data-testid="clientes-carregando">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-11 w-36 rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-md" />
      {LINHAS_DO_ESQUELETO.map((linha) => (
        <Skeleton key={linha} className="h-11 w-full" />
      ))}
    </div>
  );
}
