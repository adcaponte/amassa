"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Search, X } from "lucide-react";

import { casaComBusca } from "@/lib/busca/casa-com-busca";
import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { ROTULO_AREA, type AreaFinanceira } from "@/lib/financeiro/textos";
import type { SaldoDoItem } from "@/lib/estoque/consultas";
import { alertaDoItem, areasComMaterial } from "@/lib/estoque/saldo";
import {
  CORPO_SELETOR_SEM_ATIVOS,
  CORPO_SELETOR_SEM_RESULTADO,
  FRASE_ERRO_CARREGAR_SALDOS,
  PLACEHOLDER_BUSCA_SELETOR,
  ROTULO_FILTRAR_POR_AREA,
  ROTULO_PILULA_TUDO,
  SEM_CATEGORIA,
  SUB_SELETOR,
  TEXTO_OCULTO_DO_SELO,
  TITULO_ERRO,
  TITULO_SELETOR,
  TITULO_SELETOR_SEM_ATIVOS,
  TITULO_SELETOR_SEM_RESULTADO,
  textoMateriaisEncontrados,
} from "@/lib/estoque/textos";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EstadoErro } from "@/components/amassa/estado-erro";
import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { ChipDoSaldo, PontoDaArea, formatarMilesimos } from "./cartao-saldo";
import { CLASSE_DA_FOLHA } from "./folha-movimentacao";
import type { ListaDoEstoque } from "./provedor-estoque";

export type SeletorMaterialProps = {
  lista: ListaDoEstoque;
  // A área escolhida — lembrada pelo provedor enquanto a página está aberta (`null` = "Tudo").
  area: AreaFinanceira | null;
  aoMudarArea: (area: AreaFinanceira | null) => void;
  aoEscolher: (itemId: string) => void;
  aoFechar: () => void;
};

function compararPorNome(a: SaldoDoItem, b: SaldoDoItem): number {
  return a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id);
}

function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

// O chevron da sanfona: gira 90° aberto; sem transição com `prefers-reduced-motion`.
function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn(
        "text-tinta-fraca size-4 shrink-0 motion-safe:transition-transform",
        aberto && "rotate-90",
      )}
    />
  );
}

// O selo "⚠ {n}" — materiais acabando ou com saldo negativo. Morava no nível de área; desde a 06.5
// (UI-D15) vai no cabeçalho da categoria, o novo 1º nível. O texto oculto faz o leitor de tela ler
// "3 acabando"; só aparece com n ≥ 1.
function SeloAcabando({ quantos }: { quantos: number }) {
  if (quantos < 1) {
    return null;
  }
  return (
    <span
      data-testid="seletor-selo"
      className="text-apoio bg-atencao-fundo text-atencao inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-semibold tabular-nums"
    >
      <AlertTriangle aria-hidden="true" className="size-3.5" />
      {quantos}
      <span className="sr-only">{TEXTO_OCULTO_DO_SELO}</span>
    </span>
  );
}

// Uma linha de material: 56px, nome (quebra em duas linhas e a linha cresce — nunca reticências),
// o chip de alerta e o saldo à direita, que nunca quebra.
function LinhaDeMaterial({ saldo, aoEscolher }: { saldo: SaldoDoItem; aoEscolher: () => void }) {
  return (
    <li>
      <button
        type="button"
        data-testid="seletor-linha"
        data-item-id={saldo.id}
        onClick={aoEscolher}
        className="hover:bg-superficie-2 focus-visible:ring-ring flex min-h-[56px] w-full items-center gap-3 rounded-md px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-corpo text-tinta min-w-0 [overflow-wrap:anywhere]">
            {saldo.nome}
          </span>
          <ChipDoSaldo saldo={saldo} />
        </span>
        <span className="text-corpo text-tinta-media shrink-0 whitespace-nowrap tabular-nums">
          {formatarMilesimos(saldo.saldoMilesimos)} {ROTULO_UNIDADE[saldo.unidade]}
        </span>
      </button>
    </li>
  );
}

type GrupoDeCategoria = {
  // `null` = material sem categoria de compra ("Sem categoria", sempre por último).
  categoria: string | null;
  itens: SaldoDoItem[];
  // A área de TODOS os materiais do grupo, quando é uma só — o ponto dela vai antes do nome.
  areaUnica: AreaFinanceira | null;
};

// A categoria da compra é o 1º nível do "Tudo" (06.5, D-13, UI-D15): um grupo por categoria,
// juntando os materiais de todas as áreas, em ordem alfabética, com "Sem categoria" por último.
function gruposPorCategoria(itens: readonly SaldoDoItem[]): GrupoDeCategoria[] {
  const porCategoria = new Map<string | null, SaldoDoItem[]>();
  for (const item of itens) {
    const categoria = item.categoriaCompraNome ?? null;
    const grupo = porCategoria.get(categoria);
    if (grupo) {
      grupo.push(item);
    } else {
      porCategoria.set(categoria, [item]);
    }
  }
  return [...porCategoria.entries()]
    .map(([categoria, doGrupo]) => {
      const areas = new Set(doGrupo.map((item) => item.area));
      return {
        categoria,
        itens: [...doGrupo].sort(compararPorNome),
        areaUnica: areas.size === 1 ? doGrupo[0].area : null,
      };
    })
    .sort((a, b) => {
      if (a.categoria === null || b.categoria === null) {
        return a.categoria === null ? (b.categoria === null ? 0 : 1) : -1;
      }
      return a.categoria.localeCompare(b.categoria, "pt-BR");
    });
}

// O seletor "Qual material?" (UI-SPEC §Seletor): busca de 44px, pílulas de área com contagem e,
// sem busca, a sanfona categoria da compra → material (06.5, D-13/UI-D15: 2 toques até o material;
// a área deixou de ser o 1º nível e ficou nas pílulas, como filtro), TUDO FECHADO no início
// (herdado); com busca, a sanfona sai do caminho: lista plana alfabética "{N} materiais
// encontrados", por PALAVRAS e sem acento (`casaComBusca`, D-17). Só
// materiais ATIVOS (UI-D11). Usa a lista já carregada com a página — abre sem consulta nova e sem
// esqueleto quando ela já chegou; se a consulta falhou, o `EstadoErro` da aba Saldos com "Tentar de
// novo", nunca uma lista vazia que pareça "nenhum material".
//
// Mesma folha de tela toda da movimentação, com fechar próprio de 44×44 (UI-D10). No celular nada
// recebe foco ao abrir — o teclado cobriria a sanfona (UI-D13); a partir de 768px, a busca.
export function SeletorMaterial({
  lista,
  area,
  aoMudarArea,
  aoEscolher,
  aoFechar,
}: SeletorMaterialProps) {
  const idBase = useId();
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set());
  const campoBusca = useRef<HTMLInputElement>(null);

  const ativos = useMemo(
    () =>
      lista.estado === "pronta"
        ? lista.saldos.filter((saldo) => saldo.ativo).sort(compararPorNome)
        : [],
    [lista],
  );
  const areas = useMemo(() => areasComMaterial(ativos), [ativos]);
  // Uma área lembrada que ficou sem material ativo volta a "Tudo".
  const areaValida = area !== null && areas.includes(area) ? area : null;
  const temBusca = busca.trim() !== "";

  function alternar(chave: string) {
    setAbertos((atuais) => {
      const novos = new Set(atuais);
      if (novos.has(chave)) {
        novos.delete(chave);
      } else {
        novos.add(chave);
      }
      return novos;
    });
  }

  function doAreaSelecionada(umaArea: AreaFinanceira) {
    return ativos.filter((saldo) => saldo.area === umaArea);
  }

  // As sanfonas de categoria. `escopo` separa o que fica aberto no "Tudo" do que fica aberto
  // com uma área marcada; o ponto da área só aparece no "Tudo" (com a pílula, a área já está dita).
  function categorias(escopo: AreaFinanceira | "tudo", itens: readonly SaldoDoItem[]) {
    return (
      <ul className="flex flex-col gap-1">
        {gruposPorCategoria(itens).map((grupo, indice) => {
          const nome = grupo.categoria ?? SEM_CATEGORIA;
          const chave = `c:${escopo}:${grupo.categoria === null ? "" : "n:"}${nome}`;
          const aberto = abertos.has(chave);
          const idDoPainel = `${idBase}-c-${escopo}-${indice}`;
          return (
            <li key={chave}>
              <button
                type="button"
                aria-expanded={aberto}
                aria-controls={idDoPainel}
                data-testid="seletor-categoria"
                onClick={() => alternar(chave)}
                className={cn(
                  "focus-visible:ring-ring flex min-h-[48px] w-full items-center gap-2 rounded-md px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none",
                  aberto ? "bg-acento-fundo text-acento" : "hover:bg-superficie-2 text-tinta",
                )}
              >
                <Chevron aberto={aberto} />
                {escopo === "tudo" && grupo.areaUnica !== null ? (
                  <PontoDaArea area={grupo.areaUnica} />
                ) : null}
                <span className="text-corpo min-w-0 flex-1 [overflow-wrap:anywhere]">{nome}</span>
                <SeloAcabando
                  quantos={grupo.itens.filter((saldo) => alertaDoItem(saldo) !== "ok").length}
                />
                <span className="text-apoio text-tinta-fraca bg-superficie-2 shrink-0 rounded-full px-2 tabular-nums">
                  {grupo.itens.length}
                </span>
              </button>
              {aberto ? (
                <ul
                  id={idDoPainel}
                  className="border-borda-forte ml-5 flex flex-col gap-1 border-l-2 pl-4"
                >
                  {grupo.itens.map((saldo) => (
                    <LinhaDeMaterial
                      key={saldo.id}
                      saldo={saldo}
                      aoEscolher={() => aoEscolher(saldo.id)}
                    />
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  function conteudo() {
    if (lista.estado === "erro") {
      return (
        <EstadoErro
          titulo={TITULO_ERRO}
          corpo={FRASE_ERRO_CARREGAR_SALDOS}
          acao={<TentarDeNovo />}
          dataTestId="seletor-erro"
        />
      );
    }
    if (lista.estado === "carregando") {
      return (
        <div className="flex flex-col gap-2" aria-hidden="true" data-testid="seletor-carregando">
          {[0, 1, 2, 3, 4].map((indice) => (
            <Skeleton key={indice} className="h-[52px] w-full" />
          ))}
        </div>
      );
    }
    if (ativos.length === 0) {
      return (
        <div className="bg-superficie rounded-lg p-6 text-center" data-testid="seletor-vazio">
          <p className="text-titulo text-tinta">{TITULO_SELETOR_SEM_ATIVOS}</p>
          <p className="text-apoio text-tinta-media mt-2">{CORPO_SELETOR_SEM_ATIVOS}</p>
        </div>
      );
    }

    // Com busca: lista plana, alfabética, sobre TODOS os ativos (a área não filtra quem digita o
    // nome — herdado do protótipo).
    if (temBusca) {
      const achados = ativos.filter((saldo) =>
        casaComBusca(`${saldo.nome} ${saldo.categoriaCompraNome ?? ""}`, busca),
      );
      if (achados.length === 0) {
        return (
          <div className="bg-superficie rounded-lg p-6 text-center" data-testid="seletor-sem-resultado">
            <p className="text-titulo text-tinta">{TITULO_SELETOR_SEM_RESULTADO}</p>
            <p className="text-apoio text-tinta-media mt-2">{CORPO_SELETOR_SEM_RESULTADO}</p>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <p
            data-testid="seletor-contador"
            aria-live="polite"
            className="text-apoio text-tinta-fraca font-semibold tracking-[0.06em] uppercase"
          >
            {textoMateriaisEncontrados(achados.length)}
          </p>
          <ul className="flex flex-col gap-1">
            {achados.map((saldo) => (
              <LinhaDeMaterial key={saldo.id} saldo={saldo} aoEscolher={() => aoEscolher(saldo.id)} />
            ))}
          </ul>
        </div>
      );
    }

    // Uma área marcada: a sanfona começa no nível da categoria.
    if (areaValida !== null) {
      return categorias(areaValida, doAreaSelecionada(areaValida));
    }

    // "Tudo": nível 1 = a categoria da compra (06.5, UI-D15); o nível de área (52px) saiu daqui.
    return categorias("tudo", ativos);
  }

  return (
    <Dialog
      open
      onOpenChange={(novoValor) => {
        if (!novoValor) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="seletor-material"
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          if (window.matchMedia("(min-width: 768px)").matches) {
            campoBusca.current?.focus();
          }
        }}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta">{TITULO_SELETOR}</DialogTitle>
            <DialogDescription className="text-apoio text-tinta-fraca">{SUB_SELETOR}</DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            data-testid="seletor-fechar"
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        {/* Busca e pílulas presas no topo; só a lista rola (overflow E5). */}
        <div className="border-border flex flex-col gap-3 border-b px-6 py-4">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
            />
            <Input
              ref={campoBusca}
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder={PLACEHOLDER_BUSCA_SELETOR}
              aria-label={PLACEHOLDER_BUSCA_SELETOR}
              autoComplete="off"
              data-testid="seletor-busca"
              className="text-corpo md:text-corpo bg-superficie min-h-[44px] pl-10"
            />
          </div>
          {lista.estado === "pronta" && areas.length > 0 ? (
            <div role="group" aria-label={ROTULO_FILTRAR_POR_AREA} className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={areaValida === null}
                onClick={() => aoMudarArea(null)}
                data-testid="seletor-pilula-tudo"
                className={classeDaPilula(areaValida === null)}
              >
                {ROTULO_PILULA_TUDO}
              </button>
              {areas.map((umaArea) => (
                <button
                  key={umaArea}
                  type="button"
                  aria-pressed={areaValida === umaArea}
                  onClick={() => aoMudarArea(umaArea)}
                  data-testid={`seletor-pilula-area-${umaArea}`}
                  className={classeDaPilula(areaValida === umaArea)}
                >
                  <PontoDaArea area={umaArea} />
                  {ROTULO_AREA[umaArea]}
                  <span className="text-tinta-fraca font-normal tabular-nums">
                    {doAreaSelecionada(umaArea).length}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" data-testid="seletor-lista">
          {conteudo()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
