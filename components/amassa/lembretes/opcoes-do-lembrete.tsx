"use client";

import type { PessoaDaCasa } from "@/lib/lembretes/consultas";
import { primeiroNome } from "@/lib/lembretes/lista";
import {
  ROTULO_DE_QUEM,
  ROTULO_GERAL,
  ROTULO_PARA,
  ROTULO_PARA_QUANDO,
} from "@/lib/lembretes/textos";
import { cn } from "@/lib/utils";

// As opções de um lembrete — "para [data]" e "De quem é o lembrete" (06.3-UI-SPEC.md §"Início — o
// bloco duplo", item 2). Escritas UMA vez para a linha de criar (plano 03) E para a edição na linha
// (plano 04): o mesmo componente, não uma cópia.

// Pílula da casa (06.3-UI-SPEC.md §Color, item 3): marcada = fundo `acento-fundo`, borda e texto
// `acento` (C11 = P5 do Estoque, 6,41:1), peso 600; desmarcada, peso 400 — o estado nunca depende só
// de cor. 44 px. Cópia de `classeDaPilula` (`barra-ferramentas-saldos.tsx`), como as outras cópias
// do projeto.
function classeDaPilula(marcada: boolean): string {
  return cn(
    "text-apoio focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1 rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
    marcada
      ? "border-acento bg-acento-fundo text-acento font-semibold"
      : "border-borda bg-superficie text-tinta hover:bg-superficie-2 font-normal",
  );
}

export type PilulaDeDataProps = {
  // `AAAA-MM-DD`, ou `""` para "sem data" (o valor do seletor de data vazio).
  valor: string;
  aoMudar: (valor: string) => void;
  testId?: string;
};

// "para [data]": um `<label>` em forma de pílula em volta do seletor nativo — no celular ele abre o
// calendário do sistema, e dá para limpar a data. O campo é Corpo 16 px (`text-corpo md:text-corpo`):
// abaixo disso o iOS dá zoom ao focar (CLAUDE.md §Acessibilidade).
export function PilulaDeData({ valor, aoMudar, testId }: PilulaDeDataProps) {
  return (
    <label className="border-borda bg-superficie text-apoio text-tinta focus-within:ring-ring inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border px-4 font-normal focus-within:ring-2">
      <span>{ROTULO_PARA}</span>
      <input
        type="date"
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        aria-label={ROTULO_PARA_QUANDO}
        data-testid={testId}
        className="text-corpo md:text-corpo text-tinta min-w-0 border-0 bg-transparent p-0 tabular-nums focus:outline-none"
      />
    </label>
  );
}

export type PilulasDePessoaProps = {
  // As pessoas ATIVAS, na ordem de cadastro (`listarPessoasDaCasa`) — nunca nomes no código.
  pessoas: readonly PessoaDaCasa[];
  // O id da pessoa, ou `null` para "geral".
  valor: string | null;
  aoMudar: (valor: string | null) => void;
  // A pílula a mais da pessoa DESATIVADA que já está gravada no lembrete (a edição do plano 04):
  // aparece marcada ao lado das ativas, para salvar sem trocar manter o `quem`.
  extra?: PessoaDaCasa | null;
};

// "De quem é o lembrete": "geral" + o primeiro nome de cada pessoa ativa (UI-D3). `flex-wrap`: com
// muitas pessoas as pílulas quebram linha, nunca rolam para o lado (320 px).
export function PilulasDePessoa({
  pessoas,
  valor,
  aoMudar,
  extra,
}: PilulasDePessoaProps) {
  const todas =
    extra && !pessoas.some((pessoa) => pessoa.id === extra.id)
      ? [...pessoas, extra]
      : pessoas;

  return (
    <div role="group" aria-label={ROTULO_DE_QUEM} className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={valor === null}
        data-testid="lembretes-pessoa"
        data-pessoa="geral"
        onClick={() => aoMudar(null)}
        className={classeDaPilula(valor === null)}
      >
        {ROTULO_GERAL}
      </button>
      {todas.map((pessoa) => (
        <button
          key={pessoa.id}
          type="button"
          aria-pressed={valor === pessoa.id}
          data-testid="lembretes-pessoa"
          data-pessoa={pessoa.id}
          onClick={() => aoMudar(pessoa.id)}
          className={classeDaPilula(valor === pessoa.id)}
        >
          {primeiroNome(pessoa.nome) ?? pessoa.nome}
        </button>
      ))}
    </div>
  );
}
