"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { ROTULO_UNIDADE, type Unidade } from "@/lib/cadastros/catalogo";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { criarMaterial, type MaterialCadastrado } from "@/lib/estoque/acoes";
import type { CampoDoMaterial } from "@/lib/estoque/esquemas";
import {
  DICA_ESTOQUE_MINIMO,
  DICA_OBSERVACOES,
  DICA_UNIDADE_DO_MATERIAL,
  FRASE_ERRO_CARREGAR_SALDOS,
  FRASE_FALHA_AO_CADASTRAR,
  FRASE_SEM_CATEGORIA_DE_COMPRA_ANTES,
  LINHA_O_RESTO_FICA_NO_CATALOGO,
  MOTIVO_SEM_CATEGORIA_DE_COMPRA,
  NOTA_NOVO_MATERIAL_ANTES,
  NOTA_NOVO_MATERIAL_DEPOIS,
  NOTA_NOVO_MATERIAL_DESTAQUE,
  OPCAO_ESCOLHA,
  ROTULO_CADASTRANDO,
  ROTULO_CADASTRAR_MATERIAL,
  ROTULO_CATEGORIA_DA_COMPRA,
  ROTULO_ESTOQUE_MINIMO,
  ROTULO_LINK_CATEGORIAS,
  ROTULO_NOME_DO_MATERIAL,
  ROTULO_OBSERVACOES,
  ROTULO_UNIDADE_DO_MATERIAL,
  ROTULO_VOLTAR_AO_ESTOQUE,
  SUB_NOVO_MATERIAL,
  TITULO_ERRO,
  TITULO_NOVO_MATERIAL,
  dicaCategoriaDaCompra,
  opcaoCategoriaDaCompra,
} from "@/lib/estoque/textos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EstadoErro } from "@/components/amassa/estado-erro";

import { CLASSE_DA_FOLHA } from "./folha-movimentacao";
import type { ListaDoEstoque } from "./provedor-estoque";

// As unidades na ordem da UI-SPEC (un, g, kg, ml, L, m) — o valor é o do banco, o rótulo o da tela.
const UNIDADES: readonly Unidade[] = ["un", "g", "kg", "ml", "l", "m"];

type ErroDoMaterial = { campo: CampoDoMaterial; mensagem: string };

export type FolhaNovoMaterialProps = {
  // A lista da página: as categorias de compra ativas chegam com ela (`lerDadosDoEstoque`).
  lista: ListaDoEstoque;
  aoCadastrar: (material: MaterialCadastrado) => void;
  aoFechar: () => void;
};

// "+ Novo material" (UI-SPEC §"Folha Novo material", EST-13): nome, unidade, categoria da compra
// (a área vem dela), estoque mínimo (começa em 0) e observações — nenhum campo de saldo (D-17): o
// saldo inicial entra pela contagem, com custo. Preço de venda, atalhos e ficha técnica ficam no
// Catálogo. O servidor valida pela MESMA fábrica do Cadastros (`criarMaterial` → `esquemaItem`), e
// cada frase volta para baixo do campo dela (UI-D9); a folha continua preenchida.
//
// Sem nenhuma categoria de compra ativa (ligado a D-29), o seletor dá lugar à frase com o link para
// Cadastros → Categorias, e "Cadastrar material" fica indisponível com o motivo à vista — nunca um
// seletor vazio. Sucesso: quem abriu (o provedor) mostra o toast e abre a folha de movimentação em
// Entrada para o material novo (UI-D12).
export function FolhaNovoMaterial({ lista, aoCadastrar, aoFechar }: FolhaNovoMaterialProps) {
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState<Unidade | "">("");
  const [categoriaId, setCategoriaId] = useState("");
  const [minimoTexto, setMinimoTexto] = useState("0");
  const [observacoesTexto, setObservacoesTexto] = useState("");
  const [erro, setErro] = useState<ErroDoMaterial | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Guarda síncrona contra o toque duplo (EST-13 · idempotency): o `disabled` só vale no próximo
  // desenho; a referência vale já no segundo clique do mesmo gesto.
  const emVoo = useRef(false);
  const campos = useRef<Partial<Record<CampoDoMaterial, HTMLElement | null>>>({});

  const categorias = lista.estado === "pronta" ? lista.categoriasDeCompra : [];
  const semCategoria = lista.estado === "pronta" && categorias.length === 0;
  const categoriaEscolhida = categorias.find((categoria) => categoria.id === categoriaId) ?? null;
  const podeCadastrar = lista.estado === "pronta" && !semCategoria && !enviando;

  function registrarCampo(campo: CampoDoMaterial) {
    return (elemento: HTMLElement | null) => {
      campos.current[campo] = elemento;
    };
  }

  function limparErroDe(campo: CampoDoMaterial) {
    setErro((atual) => (atual?.campo === campo ? null : atual));
  }

  async function cadastrar() {
    if (emVoo.current || !podeCadastrar) {
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await criarMaterial({
        nome,
        unidade: unidade === "" ? null : unidade,
        categoriaCompraId: categoriaId === "" ? null : categoriaId,
        minimoTexto,
        observacoesTexto,
      });
      if (!resposta.ok) {
        // A folha continua aberta e preenchida; o erro vai para baixo do campo e o foco até ele.
        setErro({ campo: resposta.campo, mensagem: resposta.erro });
        campos.current[resposta.campo]?.focus();
        return;
      }
      aoCadastrar(resposta.dados);
    } catch (falha) {
      console.error("Falha ao cadastrar material:", falha);
      setErro({ campo: "geral", mensagem: FRASE_FALHA_AO_CADASTRAR });
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  function idDoErro(campo: CampoDoMaterial) {
    return erro?.campo === campo ? `novo-material-erro-${campo}` : undefined;
  }

  function mensagemDe(campo: CampoDoMaterial) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        id={`novo-material-erro-${campo}`}
        role="alert"
        data-testid="material-erro"
        data-campo={campo}
        className="text-apoio text-erro"
      >
        {erro.mensagem}
      </p>
    );
  }

  function descritoPor(...ids: (string | undefined)[]) {
    return ids.filter(Boolean).join(" ") || undefined;
  }

  const classeDoCampo = "text-corpo md:text-corpo min-h-[44px]";
  const classeDoSeletor =
    "border-input bg-superficie text-corpo text-tinta min-h-[44px] w-full rounded-md border px-3 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none";

  return (
    <Dialog
      open
      onOpenChange={(novoValor) => {
        if (!novoValor && !enviando) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-novo-material"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          // Sem foco automático abaixo de 768px (o teclado cobriria a folha — UI-D13).
          if (window.matchMedia("(min-width: 768px)").matches) {
            campos.current.nome?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta">{TITULO_NOVO_MATERIAL}</DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca">
              {SUB_NOVO_MATERIAL}
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            disabled={enviando}
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        {lista.estado === "carregando" ? (
          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
            aria-busy="true"
          >
            <span className="sr-only">Carregando…</span>
            {[0, 1, 2, 3].map((indice) => (
              <Skeleton key={indice} className="h-16 w-full" />
            ))}
          </div>
        ) : lista.estado === "erro" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <EstadoErro titulo={TITULO_ERRO} corpo={FRASE_ERRO_CARREGAR_SALDOS} />
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault();
              void cadastrar();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="novo-material-nome" className="text-corpo text-tinta font-semibold">
                  {ROTULO_NOME_DO_MATERIAL}
                </label>
                <Input
                  id="novo-material-nome"
                  ref={registrarCampo("nome")}
                  data-testid="novo-material-nome"
                  autoComplete="off"
                  aria-describedby={idDoErro("nome")}
                  aria-invalid={erro?.campo === "nome"}
                  value={nome}
                  onChange={(evento) => {
                    setNome(evento.target.value);
                    limparErroDe("nome");
                  }}
                  className={classeDoCampo}
                />
                {mensagemDe("nome")}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="novo-material-unidade"
                  className="text-corpo text-tinta font-semibold"
                >
                  {ROTULO_UNIDADE_DO_MATERIAL}
                </label>
                <p id="novo-material-unidade-dica" className="text-apoio text-tinta-fraca">
                  {DICA_UNIDADE_DO_MATERIAL}
                </p>
                <select
                  id="novo-material-unidade"
                  ref={registrarCampo("unidade")}
                  data-testid="novo-material-unidade"
                  aria-describedby={descritoPor("novo-material-unidade-dica", idDoErro("unidade"))}
                  aria-invalid={erro?.campo === "unidade"}
                  value={unidade}
                  onChange={(evento) => {
                    setUnidade(evento.target.value as Unidade | "");
                    limparErroDe("unidade");
                  }}
                  className={classeDoSeletor}
                >
                  <option value="">{OPCAO_ESCOLHA}</option>
                  {UNIDADES.map((valor) => (
                    <option key={valor} value={valor}>
                      {ROTULO_UNIDADE[valor]}
                    </option>
                  ))}
                </select>
                {mensagemDe("unidade")}
              </div>

              <div className="flex flex-col gap-2">
                {semCategoria ? (
                  <>
                    <p className="text-corpo text-tinta font-semibold">
                      {ROTULO_CATEGORIA_DA_COMPRA}
                    </p>
                    <p
                      id="novo-material-sem-categoria"
                      data-testid="novo-material-sem-categoria"
                      className="text-apoio text-tinta-media bg-superficie-2 border-borda rounded-md border px-4 py-2"
                    >
                      {FRASE_SEM_CATEGORIA_DE_COMPRA_ANTES}
                      <Link
                        href={rotaDeGestao("/cadastros?sub=categorias")}
                        className="text-acento font-semibold underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {ROTULO_LINK_CATEGORIAS}
                      </Link>
                      .
                    </p>
                  </>
                ) : (
                  <>
                    <label
                      htmlFor="novo-material-categoria"
                      className="text-corpo text-tinta font-semibold"
                    >
                      {ROTULO_CATEGORIA_DA_COMPRA}
                    </label>
                    <p id="novo-material-categoria-dica" className="text-apoio text-tinta-fraca">
                      {dicaCategoriaDaCompra(
                        categoriaEscolhida ? ROTULO_AREA[categoriaEscolhida.area] : null,
                      )}
                    </p>
                    <select
                      id="novo-material-categoria"
                      ref={registrarCampo("categoria")}
                      data-testid="novo-material-categoria"
                      aria-describedby={descritoPor(
                        "novo-material-categoria-dica",
                        idDoErro("categoria"),
                      )}
                      aria-invalid={erro?.campo === "categoria"}
                      value={categoriaId}
                      onChange={(evento) => {
                        setCategoriaId(evento.target.value);
                        limparErroDe("categoria");
                      }}
                      className={classeDoSeletor}
                    >
                      <option value="">{OPCAO_ESCOLHA}</option>
                      {categorias.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {opcaoCategoriaDaCompra(categoria.nome, ROTULO_AREA[categoria.area])}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {mensagemDe("categoria")}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="novo-material-minimo"
                  className="text-corpo text-tinta font-semibold"
                >
                  {ROTULO_ESTOQUE_MINIMO}
                </label>
                <p id="novo-material-minimo-dica" className="text-apoio text-tinta-fraca">
                  {unidade === ""
                    ? DICA_ESTOQUE_MINIMO
                    : `em ${ROTULO_UNIDADE[unidade]} — ${DICA_ESTOQUE_MINIMO}`}
                </p>
                <Input
                  id="novo-material-minimo"
                  ref={registrarCampo("minimo")}
                  data-testid="novo-material-minimo"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-describedby={descritoPor("novo-material-minimo-dica", idDoErro("minimo"))}
                  aria-invalid={erro?.campo === "minimo"}
                  value={minimoTexto}
                  onChange={(evento) => {
                    setMinimoTexto(evento.target.value);
                    limparErroDe("minimo");
                  }}
                  className={`${classeDoCampo} tabular-nums`}
                />
                {mensagemDe("minimo")}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="novo-material-observacoes"
                  className="text-corpo text-tinta font-semibold"
                >
                  {ROTULO_OBSERVACOES}
                </label>
                <p id="novo-material-observacoes-dica" className="text-apoio text-tinta-fraca">
                  {DICA_OBSERVACOES}
                </p>
                <Textarea
                  id="novo-material-observacoes"
                  ref={registrarCampo("observacoes")}
                  data-testid="novo-material-observacoes"
                  aria-describedby={descritoPor(
                    "novo-material-observacoes-dica",
                    idDoErro("observacoes"),
                  )}
                  aria-invalid={erro?.campo === "observacoes"}
                  value={observacoesTexto}
                  onChange={(evento) => {
                    setObservacoesTexto(evento.target.value);
                    limparErroDe("observacoes");
                  }}
                  className="text-corpo md:text-corpo min-h-[88px]"
                />
                {mensagemDe("observacoes")}
              </div>

              <p className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-4">
                {NOTA_NOVO_MATERIAL_ANTES}
                <strong className="font-semibold">{NOTA_NOVO_MATERIAL_DESTAQUE}</strong>
                {NOTA_NOVO_MATERIAL_DEPOIS}
              </p>
              <p className="text-apoio text-tinta-fraca">{LINHA_O_RESTO_FICA_NO_CATALOGO}</p>
            </div>

            {/* Rodapé preso por flex, fora da área rolável. */}
            <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
              {mensagemDe("geral")}
              {semCategoria ? (
                <p
                  id="novo-material-motivo"
                  data-testid="novo-material-motivo"
                  className="text-apoio text-tinta-media"
                >
                  {MOTIVO_SEM_CATEGORIA_DE_COMPRA}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={enviando}
                  onClick={aoFechar}
                  className="text-corpo h-auto min-h-[52px] max-w-[45%] min-w-0 shrink px-4 font-semibold leading-tight whitespace-normal"
                >
                  {ROTULO_VOLTAR_AO_ESTOQUE}
                </Button>
                <Button
                  type="submit"
                  data-testid="novo-material-cadastrar"
                  disabled={!podeCadastrar}
                  aria-busy={enviando ? "true" : undefined}
                  aria-describedby={semCategoria ? "novo-material-motivo" : undefined}
                  className="text-corpo h-auto min-h-[52px] flex-1 px-4 font-semibold leading-tight whitespace-normal"
                >
                  {enviando ? ROTULO_CADASTRANDO : ROTULO_CADASTRAR_MATERIAL}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
