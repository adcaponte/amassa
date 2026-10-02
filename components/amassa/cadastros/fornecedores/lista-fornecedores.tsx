"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { FornecedorDaLista } from "@/lib/fornecedores/consultas";
import {
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  ROTULO_NOVO_FORNECEDOR,
  TITULO_LISTA,
  TOAST_FORNECEDOR_CADASTRADO,
} from "@/lib/fornecedores/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { FolhaFornecedor } from "./folha-fornecedor";

export type ListaFornecedoresProps = {
  // Todos os fornecedores (ativos e desativados), já na ordem da tela (`listarFornecedores`).
  fornecedores: FornecedorDaLista[];
  // O id da ficha aberta ao lado — a linha dele leva `aria-current="true"`.
  abertoId: string | null;
};

// O endereço da ficha de um fornecedor — a URL manda (`?fornecedor=`), sobrevive a recarregar.
export function enderecoDoFornecedor(id: string): string {
  return rotaDeGestao(`/cadastros?sub=fornecedores&fornecedor=${encodeURIComponent(id)}`);
}

// O bloco Lista de Cadastros → Fornecedores (06.2-UI-SPEC.md §"Página — Cadastros → Fornecedores").
// Neste plano (o traçador, 06.2-02): o cabeçalho com "Novo fornecedor" (o único terracota da tela) e
// as linhas dos ATIVOS; a busca, as pílulas de área, o selo, os anexos, o rodapé e "mostrar
// desativados" são do plano 03. Cada linha é um `<button>` de linha inteira que navega para a ficha
// (`router.push`, sem rolar a página — o componente não remonta e a ficha troca ao lado).
export function ListaFornecedores({ fornecedores, abertoId }: ListaFornecedoresProps) {
  const router = useRouter();
  const [folhaAberta, setFolhaAberta] = useState(false);

  function aoSalvar(id: string) {
    setFolhaAberta(false);
    toast(TOAST_FORNECEDOR_CADASTRADO);
    router.push(enderecoDoFornecedor(id), { scroll: false });
  }

  const folha = folhaAberta ? (
    <FolhaFornecedor modo="novo" aoFechar={() => setFolhaAberta(false)} aoSalvar={aoSalvar} />
  ) : null;

  const botaoNovo = (
    <Button
      type="button"
      data-testid="novo-fornecedor"
      onClick={() => setFolhaAberta(true)}
      className="text-corpo min-h-[44px] gap-2 px-4 font-semibold"
    >
      <Plus aria-hidden="true" />
      {ROTULO_NOVO_FORNECEDOR}
    </Button>
  );

  // Nenhum fornecedor (nem ativo nem desativado): o vazio da UI-SPEC com o "Novo fornecedor" dentro
  // dele — e o cabeçalho do bloco fica sem o seu (um terracota por tela).
  if (fornecedores.length === 0) {
    return (
      <section
        aria-labelledby="fornecedores-titulo"
        data-testid="lista-fornecedores"
        className="bg-superficie border-borda flex min-w-0 flex-col gap-4 rounded-xl border p-4"
      >
        <h2 id="fornecedores-titulo" className="text-titulo text-tinta">
          {TITULO_LISTA}
        </h2>
        <EstadoVazio
          testId="fornecedores-vazio"
          titulo={FRASE_VAZIO_TITULO}
          corpo={FRASE_VAZIO_CORPO}
          botao={botaoNovo}
        />
        {folha}
      </section>
    );
  }

  const ativos = fornecedores.filter((fornecedor) => fornecedor.ativo);

  return (
    <section
      aria-labelledby="fornecedores-titulo"
      data-testid="lista-fornecedores"
      className="bg-superficie border-borda flex min-w-0 flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fornecedores-titulo" className="text-titulo text-tinta">
          {TITULO_LISTA}
        </h2>
        {botaoNovo}
      </div>

      <ul className="flex flex-col gap-2">
        {ativos.map((fornecedor) => {
          const aberto = fornecedor.id === abertoId;
          return (
            <li key={fornecedor.id}>
              <button
                type="button"
                data-testid="fornecedor-linha"
                data-fornecedor-id={fornecedor.id}
                aria-current={aberto ? "true" : undefined}
                onClick={() => router.push(enderecoDoFornecedor(fornecedor.id), { scroll: false })}
                className={cn(
                  "grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-1 rounded-lg border p-3 text-left transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  aberto ? "border-acento bg-acento-fundo" : "border-borda bg-superficie hover:bg-superficie-2",
                )}
              >
                <span className="text-corpo text-tinta min-w-0 font-semibold [overflow-wrap:anywhere]">
                  {fornecedor.nome}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {folha}
    </section>
  );
}
