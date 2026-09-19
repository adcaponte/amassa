"use client";

import { useState } from "react";
import { toast } from "sonner";

import { definirCategoriaAtiva } from "@/lib/cadastros/acoes";
import { ordemDosGrupos } from "@/lib/cadastros/categorias";
import type { CategoriaComUso } from "@/lib/cadastros/consultas";
import {
  DICA_CATEGORIAS,
  FRASE_VAZIO_CATEGORIAS_CORPO,
  FRASE_VAZIO_CATEGORIAS_TITULO,
  ROTULO_AREA,
  ROTULO_DESATIVAR_CATEGORIA,
  ROTULO_EDITAR_CATEGORIA,
  ROTULO_GRUPO,
  ROTULO_NOVA_CATEGORIA,
  ROTULO_REATIVAR_CATEGORIA,
  rotuloLancamentos,
} from "@/lib/cadastros/textos";
import { cn } from "@/lib/utils";
import { DialogoCategoria } from "@/components/amassa/cadastros/dialogo-categoria";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

export type ListaCategoriasProps = {
  categorias: CategoriaComUso[];
};

type AlvoDoDialogo = "nova" | CategoriaComUso;

// Único componente de cliente da sub-aba Categorias — dono do estado local de "qual diálogo está
// aberto" (sem URL/history: UI-SPEC não exige um link compartilhável para isto) e do toggle
// direto de ativa/inativa (sem `AlertDialog`, reversível — "Categorias — sempre desativa, nunca
// apaga de verdade").
export function ListaCategorias({ categorias }: ListaCategoriasProps) {
  const [alvoDoDialogo, setAlvoDoDialogo] = useState<AlvoDoDialogo | null>(null);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function alternarAtiva(categoria: CategoriaComUso) {
    if (alternandoId) {
      return;
    }
    setAlternandoId(categoria.id);
    const novoEstado = !categoria.ativa;

    const resposta = await definirCategoriaAtiva({ id: categoria.id, ativa: novoEstado });

    setAlternandoId(null);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    // Navegação COMPLETA com o aviso na URL — o servidor resolve o texto do toast a partir dele
    // (`avisoDaUrl`/`AvisoCadastros`), nunca um `toast` disparado aqui antes de a lista real
    // (com a linha riscada) ter carregado.
    window.location.assign(
      `/cadastros?sub=categorias&aviso=${novoEstado ? "categoria-reativada" : "categoria-desativada"}`,
    );
  }

  const dialogo = (
    <DialogoCategoria
      aberto={alvoDoDialogo !== null}
      categoriaParaEditar={alvoDoDialogo === "nova" ? null : alvoDoDialogo}
      onFechar={() => setAlvoDoDialogo(null)}
    />
  );

  if (categorias.length === 0) {
    // Estado alcançável só em banco de teste/desenvolvimento — a migração 0016 semeia 24
    // categorias em produção e nada se apaga (D-14).
    return (
      <>
        <EstadoVazio
          testId="cadastros-vazio-categorias"
          titulo={FRASE_VAZIO_CATEGORIAS_TITULO}
          corpo={FRASE_VAZIO_CATEGORIAS_CORPO}
          botao={
            <button
              type="button"
              onClick={() => setAlvoDoDialogo("nova")}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
            >
              {ROTULO_NOVA_CATEGORIA}
            </button>
          }
        />
        {dialogo}
      </>
    );
  }

  const blocosPorGrupo = ordemDosGrupos
    .map((grupo) => ({ grupo, itens: categorias.filter((categoria) => categoria.grupo === grupo) }))
    .filter((bloco) => bloco.itens.length > 0);

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-apoio text-muted-foreground max-w-prose">{DICA_CATEGORIAS}</p>
        <button
          type="button"
          onClick={() => setAlvoDoDialogo("nova")}
          data-testid="nova-categoria"
          className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium"
        >
          {ROTULO_NOVA_CATEGORIA}
        </button>
      </div>

      {blocosPorGrupo.map((bloco) => (
        <div key={bloco.grupo} className="flex flex-col gap-2">
          <h3 className="text-apoio font-semibold text-muted-foreground uppercase tracking-wide">
            {ROTULO_GRUPO[bloco.grupo]}
          </h3>
          <ul className="flex flex-col gap-1">
            {bloco.itens.map((categoria) => (
              <li
                key={categoria.id}
                data-testid="categoria-linha"
                className={cn(
                  "border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3",
                  !categoria.ativa && "opacity-70",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  {/* `break-words` (overflow-wrap: break-word) — sem isso, um nome sem espaço
                      correndo (ex.: um sufixo gerado sem espaço) não tem ponto de quebra e
                      força a linha inteira a exceder 320px, mesmo com `min-w-0` no pai (achado
                      real do e2e "cadastros base": um nome de teste gerado dinamicamente
                      estourou 3px a 320px antes desta classe). Cobre o backstop do plano: nome
                      de categoria de até 120 caracteres não quebra o layout a 320px. */}
                  <span
                    className={cn(
                      "text-corpo text-foreground break-words",
                      !categoria.ativa && "line-through",
                    )}
                  >
                    {categoria.nome}
                  </span>
                  <span className="text-apoio text-muted-foreground break-words">
                    {ROTULO_AREA[categoria.area]} ·{" "}
                    <span data-testid="categoria-uso">{rotuloLancamentos(categoria.lancamentos)}</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAlvoDoDialogo(categoria)}
                    className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3 font-medium"
                  >
                    {ROTULO_EDITAR_CATEGORIA}
                  </button>
                  <button
                    type="button"
                    disabled={alternandoId === categoria.id}
                    onClick={() => void alternarAtiva(categoria)}
                    className="text-corpo hover:bg-muted flex min-h-[44px] items-center rounded-md px-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {categoria.ativa ? ROTULO_DESATIVAR_CATEGORIA : ROTULO_REATIVAR_CATEGORIA}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {dialogo}
    </div>
  );
}
