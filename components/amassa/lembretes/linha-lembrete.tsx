"use client";

import type { LembreteDaTela, PessoaDaCasa } from "@/lib/lembretes/consultas";
import {
  corDaPessoa,
  instanteCurto,
  primeiroNome,
  rotuloDoPrazo,
  situacaoDoPrazo,
} from "@/lib/lembretes/lista";
import {
  rotuloDesfazerFeito,
  rotuloMarcarFeito,
  textoFeitoPor,
  textoPor,
} from "@/lib/lembretes/textos";
import { cn } from "@/lib/utils";

export type LinhaLembreteProps = {
  lembrete: LembreteDaTela;
  // O dia civil de Brasília, calculado na PÁGINA (`hojeEmBrasilia`) e descido por prop — esta linha
  // nunca lê o relógio do navegador para decidir vencido/hoje/amanhã.
  hoje: string;
  // As pessoas ATIVAS na ordem de cadastro: a POSIÇÃO de `quem` nesta lista decide a cor do chip
  // (UI-D2) — nunca o nome.
  pessoas: readonly PessoaDaCasa[];
  // Quem decide se a linha é um feito é a LISTA (em qual das duas ela está), não `feitoEm`: a linha
  // otimista de um feito chega com `feitoEm: null` (o cliente não inventa o instante). Omitida,
  // vale `lembrete.feitoEm !== null` — o que "ver todos" (plano 05) usa sem passar nada.
  feito?: boolean;
  // "por {nome} · {dd/mm hh:mm}" na meta dos abertos — desligada no Início, ligada em "ver todos".
  mostrarAutoria?: boolean;
  // O toque na caixa (marcar feito, ou reabrir quando a linha é um feito).
  aoAlternarFeito?: () => void;
};

// Uma linha de lembrete (06.3-UI-SPEC.md §"A linha do lembrete"). Grade de três colunas no
// contêiner ≥ 340 px (caixa · texto e meta · ações), duas abaixo disso. Plano 03: o texto e a meta
// (rótulo de prazo · chip da pessoa). Plano 04: a caixa de feito na 1ª coluna, o feito riscado com
// "feito por …" e a autoria opcional dos abertos.
//
// O texto e o nome saem SEMPRE como nós de texto do React (T-06.3-14) — nunca HTML cru.
export function LinhaLembrete({
  lembrete,
  hoje,
  pessoas,
  feito: feitoDaLista,
  mostrarAutoria = false,
  aoAlternarFeito,
}: LinhaLembreteProps) {
  const feito = feitoDaLista ?? lembrete.feitoEm !== null;
  const situacao = situacaoDoPrazo(lembrete.paraQuando, hoje);
  const rotulo = rotuloDoPrazo(lembrete.paraQuando, hoje);
  // O vencido e o "hoje" só pintam os abertos: um feito não está mais por fazer.
  const vencido = !feito && situacao === "vencido";
  // "geral" (`quem` nulo) não tem chip. Pessoa desativada (fora de `pessoas`, índice −1) mostra o
  // nome dela, com o chip neutro.
  const nomeNoChip =
    lembrete.quem === null
      ? null
      : (primeiroNome(lembrete.quemNome) ?? lembrete.quemNome);
  const indiceDaPessoa =
    lembrete.quem === null
      ? -1
      : pessoas.findIndex((pessoa) => pessoa.id === lembrete.quem);

  // A autoria. Feito: "feito por …" só com o instante e o autor que o SERVIDOR devolveu (a linha
  // otimista não tem nenhum dos dois). Aberto: "por …", só quando a tela pede.
  let autoria: string | null = null;
  if (feito) {
    const nome = primeiroNome(lembrete.feitoPorNome);
    if (lembrete.feitoEm !== null && nome !== null) {
      autoria = textoFeitoPor(nome, instanteCurto(lembrete.feitoEm));
    }
  } else if (mostrarAutoria) {
    const nome = primeiroNome(lembrete.criadoPorNome);
    if (nome !== null) {
      autoria = textoPor(nome, instanteCurto(lembrete.criadoEm));
    }
  }

  return (
    <li
      data-testid="lembrete-linha"
      data-id={lembrete.id}
      data-situacao={feito ? "feito" : situacao}
      className={cn(
        "grid grid-cols-[44px_1fr] items-start gap-2 rounded-md border border-transparent py-1 pr-2 hover:bg-fundo @min-[340px]:grid-cols-[44px_1fr_auto]",
        vencido && "border-erro-fundo bg-erro-fundo/50",
      )}
    >
      {/* A caixa (molde `caixa-marcacao.tsx`): botão de ALTERNAR de 44 × 44 (`aria-pressed`, nunca
          `role="checkbox"`), a caixa desenhada de 24 px dentro. Desmarcada com a borda
          `tinta-fraca` (UI-D4: o contorno de um controle pede 3:1 — a `border-border` do molde dá
          ~1,3:1). */}
      <button
        type="button"
        aria-pressed={feito}
        aria-label={
          feito
            ? rotuloDesfazerFeito(lembrete.texto)
            : rotuloMarcarFeito(lembrete.texto)
        }
        onClick={aoAlternarFeito}
        data-testid="lembrete-caixa"
        className="focus-visible:ring-ring flex h-11 w-11 flex-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 items-center justify-center rounded-[7px] border-2 transition-colors motion-reduce:transition-none",
            feito ? "border-sucesso bg-sucesso" : "border-tinta-fraca",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "size-3.5 stroke-white transition-opacity motion-reduce:transition-none",
              feito ? "opacity-100" : "opacity-0",
            )}
            strokeWidth={3.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </button>

      <div className="min-w-0 pt-2">
        <p
          data-testid="lembrete-texto"
          className={cn(
            "text-corpo font-normal [overflow-wrap:anywhere]",
            feito ? "text-tinta-fraca line-through" : "text-tinta",
          )}
        >
          {lembrete.texto}
        </p>
        {(rotulo !== null || nomeNoChip !== null || autoria !== null) && (
          <div className="text-apoio text-tinta-fraca mt-1 flex flex-wrap items-center gap-2 tabular-nums">
            {rotulo !== null && (
              <span
                data-testid="lembrete-prazo"
                className={cn(
                  vencido && "text-erro font-semibold",
                  !feito && situacao === "hoje" && "text-atencao font-semibold",
                )}
              >
                {rotulo}
              </span>
            )}
            {nomeNoChip !== null && (
              <span
                data-testid="lembrete-chip"
                className={cn(
                  "rounded-full px-2 font-semibold text-white [overflow-wrap:anywhere]",
                  corDaPessoa(indiceDaPessoa),
                )}
              >
                {nomeNoChip}
              </span>
            )}
            {autoria !== null && (
              <span data-testid="lembrete-autoria">{autoria}</span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
