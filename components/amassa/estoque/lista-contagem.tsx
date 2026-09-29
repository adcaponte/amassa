"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { ROTULO_AREA, type AreaFinanceira } from "@/lib/financeiro/textos";
import type { MaterialDaContagem } from "@/lib/estoque/consultas";
import { agruparContagem, progressoDaContagem, type ModoDaContagem } from "@/lib/estoque/contagem";
import { areasComMaterial } from "@/lib/estoque/saldo";
import {
  CORPO_NADA_COM_FILTRO_CONTAGEM,
  CORPO_NADA_PARA_CONTAR,
  FRASE_GRUPO_CONFERENCIA,
  FRASE_GRUPO_PRIMEIRA,
  NOTA_PARAR_NO_MEIO,
  PLACEHOLDER_BUSCA,
  ROTULO_BUSCA_CONTAGEM,
  ROTULO_FILTRAR_POR_AREA,
  ROTULO_PILULA_TUDO,
  ROTULO_VOLTAR_AO_ESTOQUE,
  TITULO_GRUPO_CONFERENCIA,
  TITULO_GRUPO_PRIMEIRA,
  TITULO_NADA_COM_FILTRO,
  TITULO_NADA_PARA_CONTAR,
  textoQuantosMateriais,
} from "@/lib/estoque/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { BotaoNovoMaterialNaLista } from "./barra-acao-fixa";
import { PontoDaArea } from "./cartao-saldo";
import { LinhaContagem } from "./linha-contagem";

const TEXTO_DO_GRUPO: Record<ModoDaContagem, { titulo: string; frase: string; testId: string }> = {
  primeira: {
    titulo: TITULO_GRUPO_PRIMEIRA,
    frase: FRASE_GRUPO_PRIMEIRA,
    testId: "contagem-grupo-primeira",
  },
  conferencia: {
    titulo: TITULO_GRUPO_CONFERENCIA,
    frase: FRASE_GRUPO_CONFERENCIA,
    testId: "contagem-grupo-conferencia",
  },
};

function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

export type ListaContagemProps = {
  itens: MaterialDaContagem[];
};

// A tela de contagem (UI-SPEC §Contagem do estoque, UI-D2): progresso, busca + pílulas de área (as
// mesmas da aba Saldos, para dividir o trabalho por prateleira), os dois grupos — "Ainda sem
// contagem" antes de "Conferência" —, dentro de cada um por área na ordem fixa e por nome, a nota
// "Dá para parar no meio…" e "Voltar ao estoque". Nenhum botão terracota: cada linha confirma com o
// seu `outline`.
//
// O GRUPO de cada material é o da carga da página, guardado no primeiro render: confirmar uma
// primeira contagem revalida a rota (o material passa a ter movimentação manual), e sem isso a
// linha pularia de grupo — e perderia a linha compacta — no meio da contagem. Material que chega
// depois (cadastrado nesta tela) entra pelo que o servidor disser.
export function ListaContagem({ itens }: ListaContagemProps) {
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState<AreaFinanceira | null>(null);
  const [confirmadosAgora, setConfirmadosAgora] = useState<ReadonlySet<string>>(() => new Set());
  const [manualNaCarga] = useState(() => new Map(itens.map((item) => [item.id, item.temManual])));

  const estaveis = useMemo(
    () => itens.map((item) => ({ ...item, temManual: manualNaCarga.get(item.id) ?? item.temManual })),
    [itens, manualNaCarga],
  );
  const grupos = useMemo(() => agruparContagem(estaveis, { busca, area }), [estaveis, busca, area]);
  const areas = useMemo(() => areasComMaterial(itens), [itens]);

  // "{c} de {t} contados hoje": o que o banco já tem de hoje, mais o que foi confirmado nesta visita
  // (inclusive o "já estava certo", que não grava nada).
  const contadosHoje = itens.filter(
    (item) => item.contadoHojeEm !== null || confirmadosAgora.has(item.id),
  ).length;

  const aoConfirmar = useCallback((itemId: string) => {
    setConfirmadosAgora((anteriores) => new Set(anteriores).add(itemId));
  }, []);

  if (itens.length === 0) {
    return (
      <EstadoVazio
        titulo={TITULO_NADA_PARA_CONTAR}
        corpo={CORPO_NADA_PARA_CONTAR}
        testId="contagem-vazio"
        botao={<BotaoNovoMaterialNaLista testId="contagem-vazio-novo-material" />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6 md:px-8">
      <p data-testid="contagem-progresso" aria-live="polite" className="text-apoio text-tinta tabular-nums">
        {progressoDaContagem({ contadosHoje, total: itens.length })}
      </p>

      <div className="flex flex-col gap-3 min-[980px]:flex-row min-[980px]:flex-wrap min-[980px]:items-center">
        <div className="relative w-full min-[980px]:max-w-sm">
          <Search
            aria-hidden="true"
            className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
          />
          <Input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder={PLACEHOLDER_BUSCA}
            aria-label={ROTULO_BUSCA_CONTAGEM}
            data-testid="contagem-busca"
            className="text-corpo md:text-corpo bg-superficie min-h-[44px] pl-10"
          />
        </div>
        <div role="group" aria-label={ROTULO_FILTRAR_POR_AREA} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={area === null}
            onClick={() => setArea(null)}
            data-testid="contagem-pilula-tudo"
            className={classeDaPilula(area === null)}
          >
            {ROTULO_PILULA_TUDO}
          </button>
          {areas.map((umaArea) => (
            <button
              key={umaArea}
              type="button"
              aria-pressed={area === umaArea}
              onClick={() => setArea(umaArea)}
              data-testid={`contagem-pilula-area-${umaArea}`}
              className={classeDaPilula(area === umaArea)}
            >
              <PontoDaArea area={umaArea} />
              {ROTULO_AREA[umaArea]}
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <div data-testid="contagem-vazio-filtro" className="flex flex-col gap-1 py-8 text-center">
          <p className="text-titulo text-foreground">{TITULO_NADA_COM_FILTRO}</p>
          <p className="text-corpo text-muted-foreground">{CORPO_NADA_COM_FILTRO_CONTAGEM}</p>
        </div>
      ) : (
        grupos.map((grupo) => {
          const texto = TEXTO_DO_GRUPO[grupo.modo];
          const idTitulo = `${texto.testId}-titulo`;
          return (
            <section
              key={grupo.modo}
              data-testid={texto.testId}
              aria-labelledby={idTitulo}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <h2
                  id={idTitulo}
                  className="text-apoio text-tinta flex flex-wrap items-baseline gap-2 font-semibold tracking-[0.06em] uppercase"
                >
                  {texto.titulo}
                  <span className="text-tinta-fraca tracking-normal normal-case tabular-nums">
                    {textoQuantosMateriais(grupo.quantos)}
                  </span>
                </h2>
                <p className="text-apoio text-muted-foreground">{texto.frase}</p>
              </div>
              {grupo.areas.map((daArea) => (
                <div key={daArea.area} className="flex flex-col">
                  <h3 className="text-apoio text-tinta-fraca border-borda flex items-center gap-2 border-b pb-2 font-semibold tracking-[0.06em] uppercase">
                    <PontoDaArea area={daArea.area} />
                    {ROTULO_AREA[daArea.area]}
                  </h3>
                  <ul className="flex flex-col">
                    {daArea.itens.map((item) => (
                      <LinhaContagem key={item.id} item={item} aoConfirmar={aoConfirmar} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })
      )}

      <div className="border-borda flex flex-col items-start gap-3 border-t pt-6">
        <p className="text-apoio text-muted-foreground">{NOTA_PARAR_NO_MEIO}</p>
        <Button asChild variant="outline" className="text-corpo min-h-[44px] px-4 font-semibold">
          <Link href={rotaDeGestao("/estoque")} data-testid="contagem-voltar">
            {ROTULO_VOLTAR_AO_ESTOQUE}
          </Link>
        </Button>
      </div>
    </div>
  );
}
