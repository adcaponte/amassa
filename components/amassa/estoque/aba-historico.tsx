import Link from "next/link";

import {
  LIMITE_MAXIMO_DO_HISTORICO,
  PASSO_DO_HISTORICO,
  type TipoDoHistorico,
} from "@/lib/estoque/abas";
import type { LinhaDoHistorico } from "@/lib/estoque/consultas";
import {
  CORPO_HISTORICO_TIPO_VAZIO,
  CORPO_HISTORICO_VAZIO,
  NOTA_FINANCEIRO_ANTES_DO_ESTORNO,
  NOTA_FINANCEIRO_DEPOIS_DO_ESTORNO,
  NOTA_FINANCEIRO_DESTAQUE,
  NOTA_FINANCEIRO_ESTORNO,
  NOTA_HISTORICO_AJUSTE,
  NOTA_HISTORICO_ANTES_DO_AJUSTE,
  NOTA_HISTORICO_DEPOIS_DO_AJUSTE,
  NOTA_HISTORICO_DESTAQUE,
  ROTULO_FILTRAR_HISTORICO,
  ROTULO_MOSTRAR_MAIS,
  ROTULO_PILULA_AJUSTES,
  ROTULO_PILULA_ENTRADAS,
  ROTULO_PILULA_HISTORICO_TUDO,
  ROTULO_PILULA_SAIDAS,
  ROTULO_VER_TUDO,
  TITULO_HISTORICO_TIPO_VAZIO,
  TITULO_HISTORICO_VAZIO,
  textoContadorDoHistorico,
} from "@/lib/estoque/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/amassa/estado-vazio";

import { LinhaMovimentacao } from "./linha-movimentacao";

// Pílula de filtro como LINK (o filtro mora na URL, a consulta é do servidor): marcada = fundo
// `acento-fundo`, borda e texto `acento` (P5), peso 600, `aria-current`; desmarcada, peso 400 — o
// estado nunca depende só de cor. 44px. Mesmo desenho das pílulas da aba Saldos. Usada também pelo
// "Para onde foi" (períodos).
export function PilulaDeFiltro({
  href,
  marcada,
  testId,
  rotulo,
}: {
  href: string;
  marcada: boolean;
  testId: string;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={marcada ? "true" : undefined}
      data-testid={testId}
      className={cn(
        "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
        marcada
          ? "border-acento bg-acento-fundo text-acento font-semibold"
          : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
      )}
    >
      {rotulo}
    </Link>
  );
}

const PILULAS: readonly { valor: TipoDoHistorico; rotulo: string }[] = [
  { valor: "tudo", rotulo: ROTULO_PILULA_HISTORICO_TUDO },
  { valor: "entrada", rotulo: ROTULO_PILULA_ENTRADAS },
  { valor: "saida", rotulo: ROTULO_PILULA_SAIDAS },
  { valor: "ajuste", rotulo: ROTULO_PILULA_AJUSTES },
];

function rotaDoHistorico(tipo: TipoDoHistorico, limite?: number): string {
  const parametros = new URLSearchParams({ aba: "historico" });
  if (tipo !== "tudo") {
    parametros.set("tipo", tipo);
  }
  if (limite !== undefined) {
    parametros.set("limite", String(limite));
  }
  return rotaDeGestao(`/estoque?${parametros.toString()}`);
}

export type AbaHistoricoProps = {
  tipo: TipoDoHistorico;
  limite: number;
  linhas: readonly LinhaDoHistorico[];
  haMais: boolean;
  // Quantas movimentações o livro tem no tipo escolhido.
  total: number;
  agora: Date;
};

// A aba Histórico (UI-SPEC §Aba Histórico): as pílulas Tudo · Entradas · Saídas · Ajustes + o
// contador, a lista num painel (`superficie`, `max-w-3xl` a partir de 980px) com as 50 mais
// recentes pela ordem de gravação (UI-D15), "Mostrar mais 50" só quando há mais, os dois vazios e as
// duas notas de rodapé. Nenhum estado de cliente: o filtro e a página são parâmetros de URL lidos
// pelo servidor (`lib/estoque/abas.ts`).
//
// "Mostrar mais 50" some no teto de 1000 (T-06-28): o que passa disso fica fora desta tela.
export function AbaHistorico({ tipo, limite, linhas, haMais, total, agora }: AbaHistoricoProps) {
  const podeMostrarMais = haMais && limite < LIMITE_MAXIMO_DO_HISTORICO;

  return (
    <div className="flex flex-col gap-4 px-6 py-8 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label={ROTULO_FILTRAR_HISTORICO} className="flex flex-wrap gap-2">
          {PILULAS.map((pilula) => (
            <PilulaDeFiltro
              key={pilula.valor}
              href={rotaDoHistorico(pilula.valor)}
              marcada={pilula.valor === tipo}
              testId={`historico-pilula-${pilula.valor}`}
              rotulo={pilula.rotulo}
            />
          ))}
        </nav>
        <span
          data-testid="historico-contador"
          className="text-apoio text-tinta-fraca tabular-nums min-[980px]:ml-auto"
        >
          {textoContadorDoHistorico(total)}
        </span>
      </div>

      {linhas.length === 0 ? (
        tipo === "tudo" ? (
          <EstadoVazio
            titulo={TITULO_HISTORICO_VAZIO}
            corpo={CORPO_HISTORICO_VAZIO}
            testId="historico-vazio"
          />
        ) : (
          <EstadoVazio
            titulo={TITULO_HISTORICO_TIPO_VAZIO}
            corpo={CORPO_HISTORICO_TIPO_VAZIO}
            testId="historico-vazio"
            botao={
              <Button asChild variant="outline" className="text-corpo min-h-[44px] px-4 font-semibold">
                <Link href={rotaDoHistorico("tudo")} scroll={false}>
                  {ROTULO_VER_TUDO}
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* A lista é texto: nenhum botão, link ou menu dentro dela (EST-06). */}
          <ol
            data-testid="historico-lista"
            aria-label="Movimentações do estoque"
            className="bg-superficie border-borda divide-borda flex flex-col divide-y rounded-lg border min-[980px]:max-w-3xl"
          >
            {linhas.map((linha) => (
              <li key={linha.id}>
                <LinhaMovimentacao linha={linha} comNome agora={agora} />
              </li>
            ))}
          </ol>

          {podeMostrarMais ? (
            <div>
              <Button asChild variant="outline" className="text-corpo min-h-[44px] px-4 font-semibold">
                <Link
                  href={rotaDoHistorico(tipo, limite + PASSO_DO_HISTORICO)}
                  scroll={false}
                  data-testid="historico-mais"
                >
                  {ROTULO_MOSTRAR_MAIS}
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}

      <p className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-4 min-[980px]:max-w-3xl">
        <strong className="font-semibold">{NOTA_HISTORICO_DESTAQUE}</strong>
        {NOTA_HISTORICO_ANTES_DO_AJUSTE}
        <em>{NOTA_HISTORICO_AJUSTE}</em>
        {NOTA_HISTORICO_DEPOIS_DO_AJUSTE}
      </p>
      <p className="text-apoio text-tinta-media bg-superficie-2 rounded-lg p-4 min-[980px]:max-w-3xl">
        <strong className="font-semibold">{NOTA_FINANCEIRO_DESTAQUE}</strong>
        {NOTA_FINANCEIRO_ANTES_DO_ESTORNO}
        <em>{NOTA_FINANCEIRO_ESTORNO}</em>
        {NOTA_FINANCEIRO_DEPOIS_DO_ESTORNO}
      </p>
    </div>
  );
}
