"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { entrarNaTurma, type EntradaNaTurma } from "@/lib/agenda/acoes";
import type { TurmaDaPessoa } from "@/lib/agenda/consultas";
import { mesVizinho, nomeDoMes } from "@/lib/agenda/semana";
import {
  ariaVerTurma,
  FRASE_FALHA_AO_ENTRAR_NA_TURMA,
  FRASE_NENHUMA_TURMA_FIXA,
  ROTULO_ENTRANDO_NA_TURMA,
  ROTULO_VER_TURMA,
  rotuloDaTurmaNaFicha,
  TITULO_TURMAS_FIXAS,
  TOAST_ENTROU_MENSALIDADE_CHEIA,
  toastEntrouMensalidadeJaExistia,
  toastEntrouProporcional,
  toastEntrouSemAulaNoMes,
} from "@/lib/agenda/textos";
import { NOMES_DOS_DIAS } from "@/lib/agenda/turma";
import { formatarReais } from "@/lib/financeiro/formato";
import { Checkbox } from "@/components/ui/checkbox";

import { ConfirmarSairDaTurma, type TurmaParaSair } from "./confirmar-sair-da-turma";

// O toast da entrada (05-UI-SPEC.md §Toasts "Entrar na turma"), pelo caso que o servidor decidiu.
function toastDaEntrada(entrada: EntradaNaTurma): string {
  const mes = nomeDoMes(entrada.mes);
  switch (entrada.mensalidade.caso) {
    case "proporcional":
      return toastEntrouProporcional(
        mes,
        entrada.mensalidade.restantes,
        entrada.mensalidade.noMes,
        formatarReais(entrada.mensalidade.valorCentavos),
      );
    case "cheia":
      return TOAST_ENTROU_MENSALIDADE_CHEIA;
    case "nenhuma":
      return toastEntrouSemAulaNoMes(mes, nomeDoMes(mesVizinho(entrada.mes, 1)));
    case "ja-existia":
      return toastEntrouMensalidadeJaExistia(mes);
  }
}

export type TurmasDaPessoaProps = {
  pessoa: { id: string; nome: string };
  turmas: TurmaDaPessoa[];
  // "AAAA-MM" — o mês de hoje (a confirmação de sair fala da mensalidade dele).
  mes: string;
  aoAbrirTurma: (turmaId: string, nome: string) => void;
};

// "Turmas fixas" na ficha da pessoa (AGE-07; 05-UI-SPEC.md §"Ficha da pessoa"): uma caixa de 44px por
// turma ATIVA do sistema, marcada quando a pessoa é aluna dela. Marcar grava NA HORA ("Entrando…" na
// linha) e o toast diz o que aconteceu com a mensalidade do mês; desmarcar abre a confirmação "Sair
// da turma" — a caixa só desmarca depois do "Tirar da turma". "ver turma" (na turma marcada) abre a
// folha da turma no lugar da ficha. Sem turma ativa no sistema: "Nenhuma turma fixa lançada ainda.".
export function TurmasDaPessoa({
  pessoa,
  turmas,
  mes,
  aoAbrirTurma,
}: TurmasDaPessoaProps) {
  const router = useRouter();
  const emVoo = useRef(false);
  // A turma em que a pessoa está entrando agora (sair grava dentro da confirmação, com "Tirando…").
  const [gravando, setGravando] = useState<string | null>(null);
  // O estado que o servidor já confirmou mas a ficha ainda não releu — a caixa não pisca de volta
  // entre a resposta da ação e a leitura nova. Some quando a leitura nova chega.
  const [confirmadas, setConfirmadas] = useState<Record<string, boolean>>({});
  const [saindo, setSaindo] = useState<TurmaParaSair | null>(null);

  useEffect(() => {
    setConfirmadas({});
  }, [turmas]);

  async function entrar(turma: TurmaDaPessoa) {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setGravando(turma.id);
    try {
      const resposta = await entrarNaTurma({ turmaId: turma.id, clienteId: pessoa.id });
      if (!resposta.ok) {
        toast.error(resposta.erro);
        router.refresh();
        return;
      }
      setConfirmadas((atuais) => ({ ...atuais, [turma.id]: true }));
      toast.success(toastDaEntrada(resposta.dados));
    } catch {
      toast.error(FRASE_FALHA_AO_ENTRAR_NA_TURMA);
    } finally {
      emVoo.current = false;
      setGravando(null);
    }
  }

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="ficha-turmas-fixas"
      data-testid="turmas-da-pessoa"
    >
      <h3
        id="ficha-turmas-fixas"
        className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
      >
        {TITULO_TURMAS_FIXAS}
      </h3>
      {turmas.length === 0 ? (
        <p className="text-corpo text-tinta-fraca" data-testid="ficha-sem-turmas">
          {FRASE_NENHUMA_TURMA_FIXA}
        </p>
      ) : (
        <ul className="flex flex-col">
          {turmas.map((turma) => {
            const marcada = confirmadas[turma.id] ?? turma.marcada;
            const entrando = gravando === turma.id;
            const idDoRotulo = `turma-da-pessoa-${turma.id}`;
            return (
              <li
                key={turma.id}
                data-testid="turma-da-pessoa"
                data-turma-id={turma.id}
                className="flex flex-wrap items-center justify-between gap-x-3 py-1"
              >
                <label className="text-corpo text-tinta flex min-h-[44px] min-w-0 flex-1 items-center gap-3 py-1">
                  <Checkbox
                    data-testid="turma-da-pessoa-caixa"
                    aria-labelledby={idDoRotulo}
                    checked={marcada}
                    disabled={gravando !== null || saindo !== null}
                    aria-busy={entrando ? "true" : undefined}
                    onCheckedChange={(valor) => {
                      if (valor === true) {
                        void entrar(turma);
                      } else {
                        setSaindo({
                          id: turma.id,
                          nome: turma.nome,
                          aulasFuturas: turma.aulasFuturas,
                          mensalidadeDoMesAReceber: turma.mensalidadeDoMesAReceber,
                        });
                      }
                    }}
                    className="size-5 shrink-0"
                  />
                  <span id={idDoRotulo} className="min-w-0 break-words">
                    {rotuloDaTurmaNaFicha({
                      nome: turma.nome,
                      dia: NOMES_DOS_DIAS[turma.diaSemana],
                      inicio: turma.inicio,
                      mensalidade: formatarReais(turma.mensalidadeCentavos),
                      diaVencimento: turma.diaVencimento,
                    })}
                  </span>
                </label>
                {entrando ? (
                  <span
                    className="text-apoio text-tinta-fraca shrink-0"
                    role="status"
                    data-testid="turma-da-pessoa-gravando"
                  >
                    {ROTULO_ENTRANDO_NA_TURMA}
                  </span>
                ) : marcada ? (
                  <button
                    type="button"
                    data-testid="ver-turma"
                    aria-label={ariaVerTurma(turma.nome)}
                    onClick={() => aoAbrirTurma(turma.id, turma.nome)}
                    className="text-apoio text-tinta-media inline-flex min-h-[44px] shrink-0 items-center rounded-md px-1 underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {ROTULO_VER_TURMA}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmarSairDaTurma
        turma={saindo}
        pessoa={pessoa}
        mes={mes}
        aoFechar={() => setSaindo(null)}
        aoTirar={() => {
          if (saindo !== null) {
            setConfirmadas((atuais) => ({ ...atuais, [saindo.id]: false }));
          }
          setSaindo(null);
        }}
      />
    </section>
  );
}
