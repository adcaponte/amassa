"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { ROTULO_CHIP_DESATIVADO } from "@/lib/cadastros/textos";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import {
  areasDoFiltro,
  contarDesativados,
  estadoDaLista,
  filtrarFornecedores,
  normalizar,
  type FiltrosDaLista,
} from "@/lib/fornecedores/busca";
import type { FornecedorDaLista } from "@/lib/fornecedores/consultas";
import type { AreaDoFornecedor } from "@/lib/fornecedores/esquemas";
import {
  FRASE_NENHUM_ATIVO,
  FRASE_VAZIO_CORPO,
  FRASE_VAZIO_TITULO,
  fraseSemResultado,
  fraseSemResultadoDaArea,
  PLACEHOLDER_BUSCA,
  ROTULO_BUSCA,
  ROTULO_CADASTRAR_UM_AGORA,
  ROTULO_FILTRAR_POR_AREA,
  ROTULO_NOVO_FORNECEDOR,
  ROTULO_TUDO,
  rotuloDosAnexos,
  rotuloDosDesativados,
  textoDoRodape,
  TITULO_LISTA,
  TOAST_FORNECEDOR_CADASTRADO,
} from "@/lib/fornecedores/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { FolhaFornecedor } from "./folha-fornecedor";
import { focarFicha, marcarFichaEscolhida } from "./navegacao-da-ficha";

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

// Pílula de filtro (06.2-UI-SPEC.md §Color, item 3) — cópia sem mudança de `classeDaPilula` de
// `components/amassa/estoque/barra-ferramentas-saldos.tsx` (como as outras quatro cópias; o Estoque não
// muda): marcada = fundo `acento-fundo`, borda e texto `acento` (6,41:1), peso 600; desmarcada, 400 —
// o estado nunca depende só de cor (`aria-pressed`). 44 px.
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

// O selo "Desativado": as cores e o peso do chip do Catálogo (`lista-catalogo.tsx`), com o padding
// da escala (UI-D17, UI-D26). Neutro: desativar é reversível, não é erro. A ficha (Server Component) usa o mesmo.
export function SeloDesativado({ testId }: { testId: string }) {
  return (
    <span
      data-testid={testId}
      className="text-apoio bg-superficie-2 text-tinta-fraca inline-flex shrink-0 items-center rounded-full px-2 py-1 font-semibold"
    >
      {ROTULO_CHIP_DESATIVADO}
    </span>
  );
}

// Links de texto da lista ("mostrar/esconder N desativados", "Cadastrar um agora"): acento, 44 px.
const CLASSE_DO_LINK =
  "text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";

// O bloco Lista de Cadastros → Fornecedores (06.2-UI-SPEC.md §"Página — Cadastros → Fornecedores",
// itens 1-5; FRN-04). Cabeçalho com "Novo fornecedor" (o único terracota da tela), busca, pílulas de
// área, as linhas e o rodapé. Busca, área e "mostrar desativados" são estado DESTE componente: a
// lista não remonta ao trocar de ficha (o `Suspense` dela na página não tem `key`), então os filtros
// sobrevivem à troca e não sobrevivem a recarregar (UI-D15). Quem filtra, ordena e decide o estado é
// `lib/fornecedores/busca.ts` — aqui só se chama.
//
// A lista mostra o que o filtro diz, mesmo que esconda a linha aberta; a ficha aberta continua ao lado.
export function ListaFornecedores({ fornecedores, abertoId }: ListaFornecedoresProps) {
  const router = useRouter();
  const [folha, setFolha] = useState<{ nomeInicial: string } | null>(null);
  const [termo, setTermo] = useState("");
  const [areaEscolhida, setAreaEscolhida] = useState<AreaDoFornecedor | "tudo">("tudo");
  const [mostrarDesativados, setMostrarDesativados] = useState(false);

  function abrirFicha(id: string) {
    if (id === abertoId) {
      // Mesma URL: a ficha não remonta — o foco e a rolagem vêm direto.
      focarFicha();
      return;
    }
    marcarFichaEscolhida(id);
    router.push(enderecoDoFornecedor(id), { scroll: false });
  }

  function aoSalvar(id: string) {
    setFolha(null);
    toast(TOAST_FORNECEDOR_CADASTRADO);
    marcarFichaEscolhida(id);
    router.push(enderecoDoFornecedor(id), { scroll: false });
  }

  const folhaAberta =
    folha !== null ? (
      <FolhaFornecedor
        modo="novo"
        nomeInicial={folha.nomeInicial}
        aoFechar={() => setFolha(null)}
        aoSalvar={aoSalvar}
      />
    ) : null;

  const botaoNovo = (
    <Button
      type="button"
      data-testid="novo-fornecedor"
      onClick={() => setFolha({ nomeInicial: "" })}
      className="text-corpo min-h-[44px] gap-2 px-4 font-semibold"
    >
      <Plus aria-hidden="true" />
      {ROTULO_NOVO_FORNECEDOR}
    </Button>
  );

  // As áreas das pílulas; uma área escolhida que deixou de existir (desligar "mostrar desativados")
  // volta a "Tudo" sem perguntar — nunca um filtro invisível escondendo a lista.
  const areas = areasDoFiltro(fornecedores, mostrarDesativados);
  const area = areaEscolhida !== "tudo" && areas.includes(areaEscolhida) ? areaEscolhida : "tudo";
  const filtros: FiltrosDaLista = { termo, area, mostrarDesativados };
  const estado = estadoDaLista(fornecedores, filtros);

  // Nenhum fornecedor (nem ativo nem desativado): o vazio da UI-SPEC com o "Novo fornecedor" dentro
  // dele — e o cabeçalho do bloco fica sem o seu (um terracota por tela).
  if (estado === "vazio-total") {
    return (
      <section
        id="lista-fornecedores"
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
        {folhaAberta}
      </section>
    );
  }

  const visiveis = filtrarFornecedores(fornecedores, filtros);
  const desativados = contarDesativados(fornecedores);
  const total = mostrarDesativados ? fornecedores.length : fornecedores.length - desativados;
  const termoAparado = termo.trim();

  return (
    <section
      id="lista-fornecedores"
      aria-labelledby="fornecedores-titulo"
      data-testid="lista-fornecedores"
      className="bg-superficie border-borda flex min-w-0 scroll-mt-4 flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fornecedores-titulo" className="text-titulo text-tinta">
          {TITULO_LISTA}
        </h2>
        {botaoNovo}
      </div>

      <div className="relative w-full">
        <Search
          aria-hidden="true"
          className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder={PLACEHOLDER_BUSCA}
          aria-label={ROTULO_BUSCA}
          autoComplete="off"
          data-testid="fornecedores-busca"
          className="text-corpo md:text-corpo bg-superficie min-h-[44px] pl-10"
        />
      </div>

      {areas.length > 0 ? (
        <div role="group" aria-label={ROTULO_FILTRAR_POR_AREA} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={area === "tudo"}
            data-testid="fornecedores-area-tudo"
            onClick={() => setAreaEscolhida("tudo")}
            className={classeDaPilula(area === "tudo")}
          >
            {ROTULO_TUDO}
          </button>
          {areas.map((umaArea) => (
            <button
              key={umaArea}
              type="button"
              aria-pressed={area === umaArea}
              data-testid={`fornecedores-area-${umaArea}`}
              onClick={() => setAreaEscolhida(umaArea)}
              className={classeDaPilula(area === umaArea)}
            >
              {ROTULO_AREA[umaArea]}
            </button>
          ))}
        </div>
      ) : null}

      {estado === "so-desativados" ? (
        <p className="text-corpo text-tinta-media" data-testid="fornecedores-nenhum-ativo">
          {FRASE_NENHUM_ATIVO}
        </p>
      ) : estado === "sem-resultado" ? (
        <div className="flex flex-col items-start gap-1" data-testid="fornecedores-sem-resultado">
          <p className="text-corpo text-tinta-media [overflow-wrap:anywhere]">
            {normalizar(termo) !== ""
              ? fraseSemResultado(termoAparado)
              : fraseSemResultadoDaArea(area === "tudo" ? ROTULO_TUDO : ROTULO_AREA[area])}
          </p>
          <button
            type="button"
            onClick={() => setFolha({ nomeInicial: termoAparado })}
            className={CLASSE_DO_LINK}
          >
            {ROTULO_CADASTRAR_UM_AGORA}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((fornecedor) => {
            const aberto = fornecedor.id === abertoId;
            const segundaLinha = [fornecedor.vende?.trim(), fornecedor.cidadeEntrega?.trim()]
              .filter((parte): parte is string => Boolean(parte))
              .join(" · ");
            return (
              <li key={fornecedor.id}>
                <button
                  type="button"
                  data-testid="fornecedor-linha"
                  data-fornecedor-id={fornecedor.id}
                  aria-current={aberto ? "true" : undefined}
                  onClick={() => abrirFicha(fornecedor.id)}
                  className={cn(
                    "grid min-h-16 w-full grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 rounded-lg border p-3 text-left transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    aberto ? "border-acento bg-acento-fundo" : "border-borda bg-superficie hover:bg-superficie-2",
                  )}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-corpo min-w-0 font-semibold [overflow-wrap:anywhere]",
                        fornecedor.ativo ? "text-tinta" : "text-tinta-media",
                      )}
                    >
                      {fornecedor.nome}
                    </span>
                    {fornecedor.ativo ? null : <SeloDesativado testId="fornecedor-linha-selo" />}
                  </span>
                  <span className="text-apoio text-tinta-fraca pt-0.5 whitespace-nowrap tabular-nums">
                    {rotuloDosAnexos(fornecedor.quantosAnexos)}
                  </span>
                  {segundaLinha !== "" ? (
                    <span className="text-apoio text-tinta-fraca col-span-2 min-w-0 [overflow-wrap:anywhere]">
                      {segundaLinha}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p
        aria-live="polite"
        data-testid="fornecedores-rodape"
        className="text-apoio text-tinta-fraca flex flex-wrap items-center gap-x-1 tabular-nums"
      >
        <span>{textoDoRodape(visiveis.length, total)}</span>
        {desativados > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              data-testid="fornecedores-mostrar-desativados"
              aria-pressed={mostrarDesativados}
              onClick={() => setMostrarDesativados((atual) => !atual)}
              className={CLASSE_DO_LINK}
            >
              {rotuloDosDesativados(desativados, mostrarDesativados)}
            </button>
          </>
        ) : null}
      </p>

      {folhaAberta}
    </section>
  );
}
