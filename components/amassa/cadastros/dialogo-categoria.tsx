"use client";

import { useEffect, useRef, useState } from "react";

import { criarCategoria, editarCategoria } from "@/lib/cadastros/acoes";
import {
  areaFixaDoGrupo,
  ordemDosGrupos,
  podeMudarGrupoEArea,
  type AreaFinanceira,
  type GrupoDeCategoria,
} from "@/lib/cadastros/categorias";
import type { CategoriaComUso } from "@/lib/cadastros/consultas";
import {
  DICA_TRAVADO_POR_USO,
  ROTULO_AREA,
  ROTULO_AREA_CAMPO,
  ROTULO_CANCELAR,
  ROTULO_GRUPO,
  ROTULO_NOME,
  ROTULO_SALVAR,
  ROTULO_TIPO,
  TITULO_DIALOGO_EDITAR_CATEGORIA,
  TITULO_DIALOGO_NOVA_CATEGORIA,
} from "@/lib/cadastros/textos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DialogoCategoriaProps = {
  aberto: boolean;
  // `null` = modo de criação; uma categoria = modo de edição, já com o uso carregado (a MESMA
  // lista que `ListaCategorias` já tem — nunca uma segunda consulta disparada por este diálogo).
  categoriaParaEditar: CategoriaComUso | null;
  onFechar: () => void;
};

// As quatro áreas de verdade — "geral" nunca aparece aqui como opção escolhível, só como texto
// fixo quando o grupo é geral/fora (04.4-UI-SPEC.md, "Área nunca é escolhida pelo usuário").
const AREAS_ESCOLHIVEIS: readonly AreaFinanceira[] = ["cafeteria", "espaco", "pecas", "loja"];

// Diálogo único para criar E editar (mesmo molde de `components/amassa/cotacoes/dialogo-categoria.tsx`),
// mas SEM diálogo de confirmação de remoção — Categorias nunca apaga, só desativa/reativa
// (ListaCategorias cuida disso com um botão direto). Estado local simples (sem URL/history):
// UI-SPEC não exige um link compartilhável para "abrir o diálogo de categoria", ao contrário do
// Comparador de Compras.
export function DialogoCategoria({ aberto, categoriaParaEditar, onFechar }: DialogoCategoriaProps) {
  const modoEdicao = categoriaParaEditar !== null;

  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState<GrupoDeCategoria>("receita");
  const [area, setArea] = useState<AreaFinanceira>("cafeteria");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setNome(categoriaParaEditar?.nome ?? "");
      setGrupo(categoriaParaEditar?.grupo ?? "receita");
      setArea(categoriaParaEditar?.area ?? "cafeteria");
      setErro(null);
      // Foco automático — depois de o diálogo montar de verdade.
      const idDoTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(idDoTimer);
    }
  }, [aberto, categoriaParaEditar]);

  // Travamento calculado do lado do cliente, a partir do MESMO `podeMudarGrupoEArea` que a ação
  // usa no servidor — nunca uma segunda regra reescrita aqui. O servidor confere de novo dentro
  // da transação (`editarCategoria`); isto aqui é só para desabilitar os campos na tela.
  const temUso = categoriaParaEditar
    ? !podeMudarGrupoEArea({
        lancamentos: categoriaParaEditar.lancamentos,
        itens: categoriaParaEditar.itens,
        contasFixas: categoriaParaEditar.contasFixas,
        chaveDoSistema: categoriaParaEditar.chaveDoSistema,
      })
    : false;

  const areaFixa = areaFixaDoGrupo(grupo);

  function aoMudarGrupo(novoGrupo: GrupoDeCategoria) {
    setGrupo(novoGrupo);
    const fixa = areaFixaDoGrupo(novoGrupo);
    if (fixa) {
      setArea(fixa);
    }
  }

  async function salvar() {
    if (enviando) {
      return;
    }
    setErro(null);
    setEnviando(true);

    const dados = { nome, grupo, area: areaFixaDoGrupo(grupo) ?? area };
    const resposta =
      modoEdicao && categoriaParaEditar
        ? await editarCategoria({ id: categoriaParaEditar.id, ...dados })
        : await criarCategoria(dados);

    setEnviando(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    // Navegação COMPLETA, nunca um hook de roteador do Next (04.4-UI-SPEC.md): só o servidor
    // sabe a lista atualizada de categorias.
    window.location.assign("/cadastros?sub=categorias");
  }

  const titulo = modoEdicao ? TITULO_DIALOGO_EDITAR_CATEGORIA : TITULO_DIALOGO_NOVA_CATEGORIA;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && onFechar()}>
      <DialogContent aria-label={titulo} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-titulo">{titulo}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
          className="flex flex-col gap-4"
        >
          {erro && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erro}
            </p>
          )}

          <Field data-invalid={!!erro}>
            <FieldLabel htmlFor="nome-categoria">{ROTULO_NOME}</FieldLabel>
            <Input
              id="nome-categoria"
              ref={inputRef}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              className="text-corpo md:text-corpo min-h-[44px]"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="tipo-categoria">{ROTULO_TIPO}</FieldLabel>
            <Select
              value={grupo}
              onValueChange={(valor) => aoMudarGrupo(valor as GrupoDeCategoria)}
              disabled={temUso}
            >
              <SelectTrigger
                id="tipo-categoria"
                aria-label={ROTULO_TIPO}
                className="min-h-[44px] w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ordemDosGrupos.map((valorDeGrupo) => (
                  <SelectItem key={valorDeGrupo} value={valorDeGrupo}>
                    {ROTULO_GRUPO[valorDeGrupo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {areaFixa ? (
            <Field>
              <FieldLabel>{ROTULO_AREA_CAMPO}</FieldLabel>
              <p className="text-corpo text-muted-foreground flex min-h-[44px] items-center">
                {ROTULO_AREA.geral}
              </p>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="area-categoria">{ROTULO_AREA_CAMPO}</FieldLabel>
              <Select
                value={area}
                onValueChange={(valor) => setArea(valor as AreaFinanceira)}
                disabled={temUso}
              >
                <SelectTrigger
                  id="area-categoria"
                  aria-label={ROTULO_AREA_CAMPO}
                  className="min-h-[44px] w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS_ESCOLHIVEIS.map((valorDeArea) => (
                    <SelectItem key={valorDeArea} value={valorDeArea}>
                      {ROTULO_AREA[valorDeArea]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {temUso && <p className="text-apoio text-muted-foreground">{DICA_TRAVADO_POR_USO}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
            >
              {ROTULO_CANCELAR}
            </button>
            <button
              type="submit"
              disabled={enviando}
              aria-busy={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Salvando…" : ROTULO_SALVAR}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
