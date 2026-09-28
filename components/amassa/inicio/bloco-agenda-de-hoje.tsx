import { ocupacaoDoEspaco } from "@/lib/agenda/espaco";
import { TEXTOS_DOS_BLOCOS } from "@/lib/inicio/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { BlocoDoInicio } from "./bloco-do-inicio";

// D-07: "Agora no espaço" é LINHA PERMANENTE — no protótipo a faixa some junto com os eventos do
// dia; aqui ela FICA, porque é a única informação que dá o número de relance, e um bloco que muda
// de forma conforme o dia é mais difícil de ler de relance.
//
// A linha mostra a CONTAGEM, não uma fração: o denominador ("de 10 lugares") saiu por decisão do
// dono em 29/09/2026, no portão da Fase 04.6 — o espaço não tem capacidade fixa, e o 10 vinha do
// protótipo, não de medição. O porquê está em `lib/agenda/espaco.ts`.
//
// GES-09: o módulo de consultas da Agenda ainda não existe — este bloco não consulta NADA,
// mostra só o estado vazio (verbatim do protótipo). Quando a Agenda entrar, esta função ganha a
// consulta real (e um `try`/`catch` próprio, D-09); nada mais muda de forma. Sem consulta, não
// há carregamento nem erro possíveis hoje — os três estados de D-09 se tornam aplicáveis junto
// da consulta real, não antes.
export function BlocoAgendaDeHoje() {
  return (
    <BlocoDoInicio
      titulo="Agenda de hoje"
      acaoRotulo="abrir agenda"
      acaoHref={rotaDeGestao("/agenda")}
      dataTestId="inicio-bloco-agenda"
    >
      <div
        data-testid="inicio-ocupacao"
        className="bg-acento-fundo flex items-center justify-between rounded-md px-3 py-2 text-apoio text-muted-foreground"
      >
        <span>Agora no espaço</span>
        <span className="font-semibold tabular-nums">{ocupacaoDoEspaco(0)}</span>
      </div>
      <p className="text-corpo text-muted-foreground">{TEXTOS_DOS_BLOCOS.agenda.vazio}</p>
    </BlocoDoInicio>
  );
}
