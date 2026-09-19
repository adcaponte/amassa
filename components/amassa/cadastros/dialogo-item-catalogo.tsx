"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { criarItem, editarItem } from "@/lib/cadastros/acoes";
import {
  ROTULO_UNIDADE,
  podeDeixarDeTerEstoque,
  validarItem,
  type Unidade,
} from "@/lib/cadastros/catalogo";
import type {
  CategoriaParaItem,
  CategoriaResumida,
  InsumoParaFicha,
  ItemDoCatalogoCompleto,
} from "@/lib/cadastros/consultas";
import {
  PLACEHOLDER_PRECO,
  ROTULO_APARECE_NA_VENDA,
  ROTULO_CANCELAR,
  ROTULO_CATEGORIA_DA_COMPRA,
  ROTULO_CATEGORIA_DE_VENDA,
  ROTULO_NOME,
  ROTULO_NOS_ATALHOS_DA_COMPRA,
  ROTULO_NOS_MAIS_USADOS,
  ROTULO_PRECO_DE_VENDA,
  ROTULO_SALVAR_ITEM,
  ROTULO_TEM_ESTOQUE_PROPRIO,
  ROTULO_UNIDADE_CAMPO,
  TITULO_DIALOGO_EDITAR_ITEM,
  TITULO_DIALOGO_NOVO_ITEM,
} from "@/lib/cadastros/textos";
import { converterQuantidade, converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Checkbox } from "@/components/ui/checkbox";
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

import { FichaTecnica, type LinhaDeFichaEmEdicao } from "./ficha-tecnica";

export type DialogoItemCatalogoProps = {
  aberto: boolean;
  // `null` = modo de criação; um item = modo de edição, já com as categorias carregadas (a
  // MESMA lista que `ListaCatalogo` já tem — nunca uma segunda consulta disparada por este
  // diálogo).
  itemParaEditar: ItemDoCatalogoCompleto | null;
  categoriasParaItem: { vendaveis: CategoriaParaItem[]; compraveis: CategoriaParaItem[] };
  insumosDisponiveis: readonly InsumoParaFicha[];
  // O catálogo INTEIRO já carregado pela tela (`ListaCatalogo`) — usado só para calcular quem
  // usa o item em edição como insumo (`podeDeixarDeTerEstoque`), nunca uma segunda consulta.
  catalogo: readonly ItemDoCatalogoCompleto[];
  onFechar: () => void;
};

const UNIDADES: readonly Unidade[] = ["un", "g", "kg", "ml", "l", "m"];

// Junta as categorias ATIVAS com a categoria ATUAL do item, mesmo desativada — a opção atual
// nunca some do formulário (04.4-UI-SPEC.md).
function opcoesComAtual(
  ativas: readonly { id: string; nome: string }[],
  atual: CategoriaResumida | null,
): { id: string; nome: string }[] {
  if (!atual || atual.ativa || ativas.some((categoria) => categoria.id === atual.id)) {
    return [...ativas];
  }
  return [...ativas, { id: atual.id, nome: atual.nome }];
}

export function DialogoItemCatalogo({
  aberto,
  itemParaEditar,
  categoriasParaItem,
  insumosDisponiveis,
  catalogo,
  onFechar,
}: DialogoItemCatalogoProps) {
  const modoEdicao = itemParaEditar !== null;

  const [nome, setNome] = useState("");
  const [categoriaVendaId, setCategoriaVendaId] = useState<string | null>(null);
  const [precoTexto, setPrecoTexto] = useState("");
  const [aparecenaVenda, setAparecenaVenda] = useState(false);
  const [atalhoVenda, setAtalhoVenda] = useState(false);
  const [controlaEstoque, setControlaEstoque] = useState(false);
  const [atalhoCompra, setAtalhoCompra] = useState(false);
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [categoriaCompraId, setCategoriaCompraId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<LinhaDeFichaEmEdicao[]>([]);
  const [erroDoServidor, setErroDoServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      setNome(itemParaEditar?.nome ?? "");
      setCategoriaVendaId(itemParaEditar?.categoriaVendaId ?? null);
      setPrecoTexto(
        itemParaEditar?.precoVendaCentavos != null
          ? (itemParaEditar.precoVendaCentavos / 100).toFixed(2).replace(".", ",")
          : "",
      );
      setAparecenaVenda(itemParaEditar?.aparecenaVenda ?? false);
      setAtalhoVenda(itemParaEditar?.atalhoVenda ?? false);
      setControlaEstoque(itemParaEditar?.controlaEstoque ?? false);
      setAtalhoCompra(itemParaEditar?.atalhoCompra ?? false);
      setUnidade(itemParaEditar?.unidade ?? null);
      setCategoriaCompraId(itemParaEditar?.categoriaCompraId ?? null);
      setFicha(
        itemParaEditar?.ficha.map((linha) => ({
          insumoId: linha.insumoId,
          // "15.000" (numeric(12,3) do banco) vira "15"; "0.040" vira "0,04" — sem zeros à
          // direita, no formato que `converterQuantidade` também aceita de volta.
          quantidadeTexto: String(Number(linha.quantidade)).replace(".", ","),
        })) ?? [],
      );
      setErroDoServidor(null);
      const idDoTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(idDoTimer);
    }
  }, [aberto, itemParaEditar]);

  const insumosPorId = useMemo(
    () => new Map(insumosDisponiveis.map((insumo) => [insumo.id, insumo])),
    [insumosDisponiveis],
  );

  // Só itens com estoque próprio, sem o próprio item — mesma regra do protótipo
  // (`S.catalogo.filter(x=>x.estoque&&x.id!==id)`).
  const insumosCandidatos = useMemo(
    () =>
      insumosDisponiveis.filter(
        (insumo) => insumo.controlaEstoque && insumo.id !== itemParaEditar?.id,
      ),
    [insumosDisponiveis, itemParaEditar],
  );

  const opcoesDeVenda = useMemo(
    () => opcoesComAtual(categoriasParaItem.vendaveis, itemParaEditar?.categoriaVenda ?? null),
    [categoriasParaItem.vendaveis, itemParaEditar],
  );
  const opcoesDeCompra = useMemo(
    () => opcoesComAtual(categoriasParaItem.compraveis, itemParaEditar?.categoriaCompra ?? null),
    [categoriasParaItem.compraveis, itemParaEditar],
  );

  // Quem usa este item como insumo — computado do catálogo já carregado, nunca uma segunda
  // consulta. Só importa em edição.
  const usosComoInsumo = useMemo(() => {
    if (!itemParaEditar) {
      return [];
    }
    return catalogo.flatMap((outro) =>
      outro.ficha
        .filter((linha) => linha.insumoId === itemParaEditar.id)
        .map(() => ({ itemNome: outro.nome, insumoId: itemParaEditar.id })),
    );
  }, [catalogo, itemParaEditar]);

  // Validação ao vivo — a MESMA `validarItem` que a Server Action chama, com o retrato de
  // insumos já carregado na tela (nunca uma segunda regra escrita no componente).
  const erroAoVivo = useMemo(() => {
    // Deixar de ter estoque próprio tem PRIORIDADE sobre a regra estrutural genérica: um item
    // que só existe como insumo (sem `aparecenaVenda`) também violaria "marque venda ou
    // estoque" ao perder `controlaEstoque` — "esse item é insumo de {nome}" é a frase mais
    // acionável das duas, e é o que a Server Action confere primeiro (lib/cadastros/acoes.ts).
    if (itemParaEditar?.controlaEstoque && !controlaEstoque) {
      const podeDeixar = podeDeixarDeTerEstoque(itemParaEditar.id, usosComoInsumo);
      if (!podeDeixar.ok) {
        return podeDeixar.erro;
      }
    }

    const preco = converterReaisParaCentavos(precoTexto);
    if (!preco.ok) {
      return preco.erro;
    }

    const fichaConvertida: { insumoId: string; quantidade: number }[] = [];
    for (const linha of ficha) {
      const resultado = converterQuantidade(linha.quantidadeTexto);
      if (!resultado.ok) {
        return resultado.erro;
      }
      fichaConvertida.push({ insumoId: linha.insumoId, quantidade: Number(resultado.quantidade) });
    }

    const resultado = validarItem(
      {
        id: itemParaEditar?.id ?? null,
        categoriaVendaId,
        precoVendaCentavos: preco.centavos,
        aparecenaVenda,
        atalhoVenda,
        controlaEstoque,
        atalhoCompra,
        unidade,
        categoriaCompraId,
        ficha: fichaConvertida,
      },
      insumosPorId,
    );
    return resultado.ok ? null : resultado.erro;
  }, [
    precoTexto,
    ficha,
    itemParaEditar,
    categoriaVendaId,
    aparecenaVenda,
    atalhoVenda,
    controlaEstoque,
    atalhoCompra,
    unidade,
    categoriaCompraId,
    insumosPorId,
    usosComoInsumo,
  ]);

  const nomeValido = nome.trim().length > 0;
  const erroExibido = erroDoServidor ?? (nomeValido ? erroAoVivo : null);

  function alternarControlaEstoque(valor: boolean) {
    setControlaEstoque(valor);
    if (!valor) {
      setUnidade(null);
      setCategoriaCompraId(null);
      setAtalhoCompra(false);
    }
  }

  function alternarAparecenaVenda(valor: boolean) {
    setAparecenaVenda(valor);
    if (!valor) {
      setAtalhoVenda(false);
    }
  }

  function adicionarNaFicha(insumoId: string, quantidadeTexto: string) {
    setFicha((atual) => [...atual, { insumoId, quantidadeTexto }]);
  }

  function tirarDaFicha(indice: number) {
    setFicha((atual) => atual.filter((_, i) => i !== indice));
  }

  async function salvar() {
    if (enviando || !nomeValido || erroAoVivo) {
      return;
    }
    setErroDoServidor(null);
    setEnviando(true);

    const entrada = {
      nome,
      categoriaVendaId,
      precoTexto,
      aparecenaVenda,
      atalhoVenda,
      controlaEstoque,
      atalhoCompra,
      unidade,
      categoriaCompraId,
      ficha: ficha.map((linha) => ({ insumoId: linha.insumoId, quantidadeTexto: linha.quantidadeTexto })),
    };

    const resposta =
      modoEdicao && itemParaEditar
        ? await editarItem({ id: itemParaEditar.id, ...entrada })
        : await criarItem(entrada);

    setEnviando(false);

    if (!resposta.ok) {
      setErroDoServidor(resposta.erro);
      return;
    }

    // Navegação COMPLETA, nunca um hook de roteador do Next (04.4-UI-SPEC.md) — só o servidor
    // sabe a lista atualizada do catálogo.
    window.location.assign("/cadastros?sub=catalogo");
  }

  const titulo = modoEdicao ? TITULO_DIALOGO_EDITAR_ITEM : TITULO_DIALOGO_NOVO_ITEM;

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && onFechar()}>
      <DialogContent aria-label={titulo} className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-lg">
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
          {erroExibido && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erroExibido}
            </p>
          )}

          <Field data-invalid={!nomeValido && nome.length > 0}>
            <FieldLabel htmlFor="item-nome">{ROTULO_NOME}</FieldLabel>
            <Input
              id="item-nome"
              ref={inputRef}
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              className="text-corpo min-h-[44px]"
            />
          </Field>

          <div className="flex flex-wrap gap-4">
            <Field className="min-w-[200px] flex-1">
              <FieldLabel htmlFor="item-categoria-venda">{ROTULO_CATEGORIA_DE_VENDA}</FieldLabel>
              <Select
                value={categoriaVendaId ?? ""}
                onValueChange={(valor) => setCategoriaVendaId(valor || null)}
              >
                <SelectTrigger
                  id="item-categoria-venda"
                  aria-label={ROTULO_CATEGORIA_DE_VENDA}
                  className="min-h-[44px] w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoesDeVenda.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field className="min-w-[140px] flex-1">
              <FieldLabel htmlFor="item-preco">{ROTULO_PRECO_DE_VENDA}</FieldLabel>
              <Input
                id="item-preco"
                inputMode="decimal"
                placeholder={PLACEHOLDER_PRECO}
                value={precoTexto}
                onChange={(evento) => setPrecoTexto(evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
          </div>

          <label className="flex min-h-[44px] items-center gap-2">
            <Checkbox
              checked={aparecenaVenda}
              onCheckedChange={(valor) => alternarAparecenaVenda(valor === true)}
            />
            <span className="text-corpo">{ROTULO_APARECE_NA_VENDA}</span>
          </label>

          <label className="flex min-h-[44px] items-center gap-2">
            <Checkbox
              checked={atalhoVenda}
              onCheckedChange={(valor) => setAtalhoVenda(valor === true)}
            />
            <span className="text-corpo">{ROTULO_NOS_MAIS_USADOS}</span>
          </label>

          <label className="flex min-h-[44px] items-center gap-2">
            <Checkbox
              checked={controlaEstoque}
              onCheckedChange={(valor) => alternarControlaEstoque(valor === true)}
            />
            <span className="text-corpo">{ROTULO_TEM_ESTOQUE_PROPRIO}</span>
          </label>

          {controlaEstoque && (
            <div className="flex flex-col gap-4 border-l-2 border-border pl-4">
              <div className="flex flex-wrap gap-4">
                <Field className="min-w-[120px] flex-1">
                  <FieldLabel htmlFor="item-unidade">{ROTULO_UNIDADE_CAMPO}</FieldLabel>
                  <Select
                    value={unidade ?? ""}
                    onValueChange={(valor) => setUnidade(valor as Unidade)}
                  >
                    <SelectTrigger
                      id="item-unidade"
                      aria-label={ROTULO_UNIDADE_CAMPO}
                      className="min-h-[44px] w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((valorDeUnidade) => (
                        <SelectItem key={valorDeUnidade} value={valorDeUnidade}>
                          {ROTULO_UNIDADE[valorDeUnidade]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="min-w-[200px] flex-1">
                  <FieldLabel htmlFor="item-categoria-compra">{ROTULO_CATEGORIA_DA_COMPRA}</FieldLabel>
                  <Select
                    value={categoriaCompraId ?? ""}
                    onValueChange={(valor) => setCategoriaCompraId(valor || null)}
                  >
                    <SelectTrigger
                      id="item-categoria-compra"
                      aria-label={ROTULO_CATEGORIA_DA_COMPRA}
                      className="min-h-[44px] w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesDeCompra.map((categoria) => (
                        <SelectItem key={categoria.id} value={categoria.id}>
                          {categoria.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <label className="flex min-h-[44px] items-center gap-2">
                <Checkbox
                  checked={atalhoCompra}
                  onCheckedChange={(valor) => setAtalhoCompra(valor === true)}
                />
                <span className="text-corpo">{ROTULO_NOS_ATALHOS_DA_COMPRA}</span>
              </label>
            </div>
          )}

          <FichaTecnica
            linhas={ficha}
            insumosCandidatos={insumosCandidatos}
            aoAdicionar={adicionarNaFicha}
            aoTirar={tirarDaFicha}
            erro={null}
          />

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
              disabled={enviando || !nomeValido || !!erroAoVivo}
              aria-busy={enviando}
              className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Salvando…" : ROTULO_SALVAR_ITEM}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
