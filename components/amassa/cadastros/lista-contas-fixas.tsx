"use client";

import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { definirContaFixaAtiva } from "@/lib/cadastros/acoes";
import type { CategoriaParaContaFixa, ContaFixaResumida } from "@/lib/cadastros/consultas";
import {
  DICA_CONTAS_FIXAS,
  FRASE_VAZIO_FIXAS_CORPO,
  FRASE_VAZIO_FIXAS_TITULO,
  ROTULO_DESATIVAR_CONTA_FIXA,
  ROTULO_NOVA_CONTA_FIXA,
  ROTULO_REATIVAR_CONTA_FIXA,
  rotuloVencimentoDaContaFixa,
} from "@/lib/cadastros/textos";
import { cn } from "@/lib/utils";
import { DialogoContaFixa } from "@/components/amassa/cadastros/dialogo-conta-fixa";
import { ValorContaFixa } from "@/components/amassa/cadastros/valor-conta-fixa";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export type ListaContasFixasProps = {
  contasFixas: ContaFixaResumida[];
  categoriasParaContaFixa: CategoriaParaContaFixa[];
  // O botão "Gerar as contas de {mês}" (Tarefa 2, `BotaoGerarContas`) — passado pela página, que é
  // quem sabe o mês e as contas ativas. `undefined` na Tarefa 1 (a ação ainda não existe).
  botaoGerar?: ReactNode;
};

// Único componente de cliente da sub-aba Contas fixas — dono do estado local de "o diálogo de
// nova conta está aberto" e do toggle direto de ativa/inativa (sem `AlertDialog`, reversível —
// mesmo molde de `ListaCategorias`).
export function ListaContasFixas({
  contasFixas,
  categoriasParaContaFixa,
  botaoGerar,
}: ListaContasFixasProps) {
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function alternarAtiva(conta: ContaFixaResumida) {
    if (alternandoId) {
      return;
    }
    setAlternandoId(conta.id);
    const novoEstado = !conta.ativa;

    const resposta = await definirContaFixaAtiva({ id: conta.id, ativa: novoEstado });

    setAlternandoId(null);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    // Navegação COMPLETA com o aviso na URL — o servidor resolve o texto do toast a partir dele
    // (`avisoDaUrl`/`AvisoCadastros`), mesma disciplina de `ListaCategorias::alternarAtiva`.
    window.location.assign(
      `/cadastros?sub=fixas&aviso=${novoEstado ? "conta-fixa-reativada" : "conta-fixa-desativada"}`,
    );
  }

  const dialogo = (
    <DialogoContaFixa
      aberto={dialogoAberto}
      categorias={categoriasParaContaFixa}
      onFechar={() => setDialogoAberto(false)}
    />
  );

  const botaoNovaContaFixa = (
    <button
      type="button"
      onClick={() => setDialogoAberto(true)}
      data-testid="nova-conta-fixa"
      className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4 font-medium"
    >
      {ROTULO_NOVA_CONTA_FIXA}
    </button>
  );

  if (contasFixas.length === 0) {
    return (
      <>
        <EstadoVazio
          testId="cadastros-vazio-fixas"
          titulo={FRASE_VAZIO_FIXAS_TITULO}
          corpo={FRASE_VAZIO_FIXAS_CORPO}
          botao={
            <button
              type="button"
              onClick={() => setDialogoAberto(true)}
              className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4 font-medium"
            >
              {ROTULO_NOVA_CONTA_FIXA}
            </button>
          }
        />
        {dialogo}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
      <p className="text-apoio text-muted-foreground max-w-prose">{DICA_CONTAS_FIXAS}</p>

      <ul className="flex flex-col gap-1">
        {contasFixas.map((conta) => (
          <li
            key={conta.id}
            data-testid="conta-fixa-linha"
            className={cn(
              "border-border flex flex-wrap items-center justify-between gap-3 rounded-md border p-3",
              !conta.ativa && "opacity-70",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "text-corpo text-foreground break-words",
                  !conta.ativa && "line-through",
                )}
              >
                {conta.nome}
              </span>
              <span className="text-apoio text-muted-foreground break-words">
                {rotuloVencimentoDaContaFixa(conta.diaVencimento, conta.categoriaNome)}
              </span>
            </div>

            <ValorContaFixa
              id={conta.id}
              nome={conta.nome}
              valorCentavos={conta.valorEsperadoCentavos}
            />

            <button
              type="button"
              disabled={alternandoId === conta.id}
              onClick={() => void alternarAtiva(conta)}
              className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {conta.ativa ? ROTULO_DESATIVAR_CONTA_FIXA : ROTULO_REATIVAR_CONTA_FIXA}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {botaoNovaContaFixa}
        {botaoGerar}
      </div>

      {dialogo}
    </div>
  );
}
