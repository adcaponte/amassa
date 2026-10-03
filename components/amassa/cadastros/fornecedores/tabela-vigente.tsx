"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ehAbertoNaAba } from "@/lib/fornecedores/cabecalhos";
import type { SeloDaTabela } from "@/lib/fornecedores/tabela-vigente";
import {
  FRASE_SEM_TABELA,
  PREFIXO_TABELA_VIGENTE,
  ROTULO_ABRIR_TABELA,
  ROTULO_SUBIR_A_PRIMEIRA,
  SELO_TABELA_RECENTE,
  SELO_TABELA_VELHA,
  ariaAbrirAnexo,
  toastAnexoGuardado,
} from "@/lib/fornecedores/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";

import { FolhaAnexo } from "./folha-anexo";

// A vigente como a linha a desenha — tudo calculado pela ficha (Server Component) com os módulos puros
// (`tabelaVigente`, `seloDaTabela`) e o "hoje" de Brasília: o trecho da data já vem formatado
// (" · vale desde dd/mm/aa" ou, sem "vale desde", " · enviada em dd/mm/aa").
export type TabelaVigenteDaFicha = {
  id: string;
  nome: string;
  extensao: string;
  trechoDaData: string;
  selo: SeloDaTabela;
};

// Links de texto da ficha ("abrir", "Subir a primeira"): acento, 600, 44 px (06.2-UI-SPEC.md §Color,
// item 6) — a mesma classe dos links de texto da lista.
const CLASSE_DO_LINK =
  "text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";

// Os selos (Apoio 600, `py-1 px-2`, `rounded-full`): "recente" em `sucesso` sobre `sucesso-fundo`
// (4,57:1), "tem mais de 4 meses — pedir a nova?" em `atencao` sobre `atencao-fundo` (4,51:1).
const CLASSE_DO_SELO = "text-apoio inline-flex items-center rounded-full px-2 py-1 font-semibold";
const SELOS: Record<SeloDaTabela, { texto: string; classe: string }> = {
  recente: { texto: SELO_TABELA_RECENTE, classe: "bg-sucesso-fundo text-sucesso" },
  velha: { texto: SELO_TABELA_VELHA, classe: "bg-atencao-fundo text-atencao" },
};

// A linha "Última tabela de preços" logo abaixo do cabeçalho da ficha (06.2-UI-SPEC.md, Bloco Ficha
// item 3; FRN-11): responde "a tabela dele está em dia?". Com vigente: o nome em 600, a data, o link
// "abrir" (a rota sob `/gestao/api/`, atrás da sessão; PDF e foto numa aba nova com `rel="noopener"`,
// planilha baixa — UI-D9) e o selo de idade. Sem vigente: "Sem tabela de preços ainda." + "Subir a
// primeira", que abre a SUA folha "Novo anexo" já com Tipo = Tabela de preços (nenhuma folha vai para a
// URL). Com o fornecedor desativado o "Subir a primeira" não aparece (UI-D24: o PUT recusa desativado);
// o "abrir" continua.
//
// Nada aqui vira número: o selo é só a idade do arquivo, e nenhum lembrete nasce dele.
export function TabelaVigente({
  fornecedorId,
  fornecedorNome,
  ativo,
  hoje,
  vigente,
}: {
  fornecedorId: string;
  fornecedorNome: string;
  ativo: boolean;
  hoje: string;
  vigente: TabelaVigenteDaFicha | null;
}) {
  const router = useRouter();
  const [folhaAberta, setFolhaAberta] = useState(false);

  function aoGuardar() {
    setFolhaAberta(false);
    router.refresh();
    toast(toastAnexoGuardado(fornecedorNome));
  }

  if (vigente !== null) {
    const selo = SELOS[vigente.selo];
    const naAba = ehAbertoNaAba(vigente.extensao);
    return (
      <p
        data-testid="fornecedor-tabela-vigente"
        className="text-apoio text-tinta-media flex min-w-0 flex-wrap items-center gap-x-2 tabular-nums"
      >
        <span className="min-w-0 [overflow-wrap:anywhere]">
          {PREFIXO_TABELA_VIGENTE}
          <span className="text-tinta font-semibold">{vigente.nome}</span>
          {vigente.trechoDaData}
          {" · "}
        </span>
        <a
          href={rotaDeGestao(`/api/fornecedores/anexos/${vigente.id}`)}
          target={naAba ? "_blank" : undefined}
          rel={naAba ? "noopener" : undefined}
          aria-label={ariaAbrirAnexo(vigente.nome)}
          data-testid="fornecedor-tabela-abrir"
          className={CLASSE_DO_LINK}
        >
          {ROTULO_ABRIR_TABELA}
        </a>
        <span data-testid="fornecedor-selo-tabela" className={cn(CLASSE_DO_SELO, selo.classe)}>
          {selo.texto}
        </span>
      </p>
    );
  }

  return (
    <div
      data-testid="fornecedor-tabela-vigente"
      className="text-apoio text-tinta-media flex min-w-0 flex-wrap items-center gap-x-2"
    >
      <p>{FRASE_SEM_TABELA}</p>
      {ativo ? (
        <button
          type="button"
          data-testid="fornecedor-subir-primeira"
          onClick={() => setFolhaAberta(true)}
          className={CLASSE_DO_LINK}
        >
          {ROTULO_SUBIR_A_PRIMEIRA}
        </button>
      ) : null}
      {folhaAberta ? (
        <FolhaAnexo
          fornecedorId={fornecedorId}
          hoje={hoje}
          tipoInicial="tabela"
          aoFechar={() => setFolhaAberta(false)}
          aoGuardar={aoGuardar}
        />
      ) : null}
    </div>
  );
}
