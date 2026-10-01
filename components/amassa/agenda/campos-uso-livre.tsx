"use client";

import type { PessoaDoSeletor } from "@/lib/agenda/seletor";
import {
  ROTULO_CHEGA_AS,
  ROTULO_DATA,
  ROTULO_HORAS_PREVISTAS,
  ROTULO_PESSOAS,
  ROTULO_QUEM,
} from "@/lib/agenda/textos";

import { CampoDeTexto, type CampoControlado } from "./campos-turma";
import { SeletorPessoa } from "./seletor-pessoa";

export type CampoQuem = {
  // O nome da pessoa já escolhida (o seletor volta com ele ao trocar de pílula e voltar).
  nomeEscolhido: string;
  erro?: string;
  // Recebe o campo de busca do seletor — é ele que ganha o foco quando "Escolha quem vem." aparece.
  registrar: (elemento: HTMLElement | null) => void;
  aoEscolher: (pessoa: PessoaDoSeletor) => void;
  aoDigitar: () => void;
};

export type CamposUsoLivreProps = {
  quem: CampoQuem;
  data: CampoControlado;
  chegadaPrevista: CampoControlado;
  horasPrevistas: CampoControlado;
  pessoas: CampoControlado;
};

// Os campos da pílula "Uso livre" (05-UI-SPEC.md §"Folha "Lançar na agenda"", §"Rótulos e dicas de
// campo", AGE-13): Quem (o seletor de pessoa do plano 05, sem data — o grupo é "Pessoas") · Data ·
// Chega às (`time`, `step=300`) · Horas previstas (padrão 2, 1..12) · Pessoas (padrão 1, 1..50). O estado é
// da folha: trocar de pílula não apaga nada (a data é a MESMA da aula avulsa). A dica com o preço da
// hora e o aviso de dia fechado (D-13) são da folha, como nos outros tipos.
export function CamposUsoLivre({ quem, data, chegadaPrevista, horasPrevistas, pessoas }: CamposUsoLivreProps) {
  return (
    <div className="flex flex-wrap gap-4" data-testid="campos-uso-livre">
      <div
        className="flex w-full min-w-0 flex-col gap-2"
        ref={(caixa) => quem.registrar(caixa?.querySelector<HTMLInputElement>('input[role="combobox"]') ?? null)}
      >
        <SeletorPessoa
          rotulo={ROTULO_QUEM}
          textoInicial={quem.nomeEscolhido}
          aoEscolher={quem.aoEscolher}
          aoDigitar={quem.aoDigitar}
        />
        {quem.erro === undefined ? null : (
          <p id="lancar-erro-clienteId" role="alert" data-testid="lancar-erro-clienteId" className="text-apoio text-erro">
            {quem.erro}
          </p>
        )}
      </div>
      <CampoDeTexto chave="data" id="lancar-data" testId="lancar-data" rotulo={ROTULO_DATA} tipo="date" campo={data} />
      <CampoDeTexto
        chave="chegadaPrevista"
        id="lancar-chegada"
        testId="lancar-chegada"
        rotulo={ROTULO_CHEGA_AS}
        tipo="time"
        campo={chegadaPrevista}
      />
      <CampoDeTexto
        chave="horasPrevistas"
        id="lancar-horas"
        testId="lancar-horas"
        rotulo={ROTULO_HORAS_PREVISTAS}
        modoDeEntrada="numeric"
        numerico
        campo={horasPrevistas}
      />
      <CampoDeTexto
        chave="pessoas"
        id="lancar-pessoas"
        testId="lancar-pessoas"
        rotulo={ROTULO_PESSOAS}
        modoDeEntrada="numeric"
        numerico
        campo={pessoas}
      />
    </div>
  );
}
