import type { NumerosDoMes } from "@/lib/agenda/numeros";
import { nomeDoMes } from "@/lib/agenda/semana";
import {
  DICA_HORAS_PESSOA,
  ROTULO_QUADRO_AULAS_A_REPOR,
  ROTULO_QUADRO_PESSOAS_NO_ESPACO,
  ROTULO_QUADRO_PRESENCA,
  ROTULO_QUADRO_USO_LIVRE,
  SUB_QUADRO_AULAS_A_REPOR,
  SUB_QUADRO_PESSOAS_NO_ESPACO,
  TITULO_DIA_MAIS_USADO,
  horasNosNumeros,
  porcentoDaPresenca,
  subQuadroPresenca,
  tituloDosNumeros,
  visitasDoUsoLivre,
} from "@/lib/agenda/textos";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type NumerosDaAgendaProps = {
  numeros: NumerosDoMes;
  // "AAAA-MM" — o mês de hoje.
  mes: string;
};

const CLASSE_DO_BLOCO = "bg-superficie border-borda flex flex-col gap-4 rounded-lg border p-4";
const CLASSE_DO_TITULO = "text-titulo text-tinta";
// Os quadros: 2 × 2 abaixo de 640px, 4 colunas a partir de 640px (gap 8px / 16px).
const CLASSE_DA_GRADE = "grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4";

function Quadro({
  testId,
  rotulo,
  numero,
  sub,
  escuro = false,
}: {
  testId: string;
  rotulo: string;
  numero: string;
  sub: string;
  escuro?: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg p-4",
        escuro ? "bg-tinta text-white" : "border-borda bg-superficie border",
      )}
    >
      <span
        data-testid={`${testId}-rotulo`}
        className={cn(
          "text-apoio font-semibold tracking-[0.06em] break-words uppercase",
          escuro ? "text-borda-forte" : "text-tinta-fraca",
        )}
      >
        {rotulo}
      </span>
      <strong
        data-testid={`${testId}-numero`}
        className={cn("text-display tabular-nums break-words", escuro ? "text-white" : "text-tinta")}
      >
        {numero}
      </strong>
      <span
        data-testid={`${testId}-sub`}
        className={cn("text-apoio break-words", escuro ? "text-borda-forte" : "text-tinta-fraca")}
      >
        {sub}
      </span>
    </div>
  );
}

// A aba Números (AGE-19; 05-UI-SPEC.md §"Aba Números", §"Números"): só leitura, do dia 1 até hoje no
// fuso do ateliê. Quatro quadros não clicáveis — o quarto, "Pessoas no espaço", escuro como o saldo do
// Caixa (`tiles-caixa.tsx`; par A16) — e as sete barras "Em que dia o espaço é mais usado", de segunda
// a domingo, com o valor ESCRITO ao lado (a barra é `aria-hidden`; par A17). Nenhum valor em dinheiro
// (§8 do briefing). Os números vêm prontos do puro `numerosDoMes`; nenhuma conta nasce aqui.
export function NumerosDaAgenda({ numeros, mes }: NumerosDaAgendaProps) {
  const maior = Math.max(1, ...numeros.barras.map((barra) => barra.horas));
  return (
    <div data-testid="agenda-numeros" className="flex flex-col gap-6">
      <section className={CLASSE_DO_BLOCO} aria-labelledby="numeros-titulo-mes">
        <h2 id="numeros-titulo-mes" className={CLASSE_DO_TITULO}>
          {tituloDosNumeros(nomeDoMes(mes))}
        </h2>
        <div className={CLASSE_DA_GRADE}>
          <Quadro
            testId="numeros-quadro-uso"
            rotulo={ROTULO_QUADRO_USO_LIVRE}
            numero={horasNosNumeros(numeros.usoLivre.horas)}
            sub={visitasDoUsoLivre(numeros.usoLivre.visitas)}
          />
          <Quadro
            testId="numeros-quadro-presenca"
            rotulo={ROTULO_QUADRO_PRESENCA}
            numero={porcentoDaPresenca(numeros.presenca.porcento)}
            sub={subQuadroPresenca(numeros.presenca.porcento, numeros.presenca.faltas)}
          />
          <Quadro
            testId="numeros-quadro-repor"
            rotulo={ROTULO_QUADRO_AULAS_A_REPOR}
            numero={String(numeros.aRepor)}
            sub={SUB_QUADRO_AULAS_A_REPOR}
          />
          <Quadro
            testId="numeros-quadro-pessoas"
            rotulo={ROTULO_QUADRO_PESSOAS_NO_ESPACO}
            numero={String(numeros.pessoas)}
            sub={SUB_QUADRO_PESSOAS_NO_ESPACO}
            escuro
          />
        </div>
      </section>

      <section className={CLASSE_DO_BLOCO} aria-labelledby="numeros-titulo-dias">
        <h2 id="numeros-titulo-dias" className={CLASSE_DO_TITULO}>
          {TITULO_DIA_MAIS_USADO}
        </h2>
        <ul className="flex flex-col gap-2">
          {numeros.barras.map((barra) => (
            <li
              key={barra.dia}
              data-testid={`numeros-barra-${barra.dia}`}
              className="text-apoio grid grid-cols-[44px_1fr_auto] items-center gap-2"
            >
              <span className="text-tinta-media">{barra.dia}</span>
              <span aria-hidden="true" className="bg-superficie-2 h-4 overflow-hidden rounded-sm">
                <span
                  className="bg-area-espaco block h-full rounded-sm"
                  style={{ width: `${(barra.horas / maior) * 100}%` }}
                />
              </span>
              <span data-testid={`numeros-barra-${barra.dia}-valor`} className="text-tinta text-right tabular-nums">
                {horasNosNumeros(barra.horas)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-apoio text-tinta-fraca">{DICA_HORAS_PESSOA}</p>
      </section>
    </div>
  );
}

const QUADROS = [0, 1, 2, 3] as const;
const BARRAS = [0, 1, 2, 3, 4, 5, 6] as const;

// O esqueleto da aba (05-UI-SPEC.md §Carregando): 4 quadros + 7 barras.
export function EsqueletoDosNumeros() {
  return (
    <div data-testid="numeros-carregando" aria-busy="true" className="flex flex-col gap-6">
      <div className={CLASSE_DO_BLOCO}>
        <Skeleton className="h-6 w-40" />
        <div className={CLASSE_DA_GRADE}>
          {QUADROS.map((quadro) => (
            <Skeleton key={quadro} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
      <div className={CLASSE_DO_BLOCO}>
        <Skeleton className="h-6 w-64" />
        {BARRAS.map((barra) => (
          <Skeleton key={barra} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}
