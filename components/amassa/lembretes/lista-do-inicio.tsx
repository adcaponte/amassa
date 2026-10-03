"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarLembrete } from "@/lib/lembretes/acoes";
import type { LembreteDaTela, LembretesDoInicio } from "@/lib/lembretes/consultas";
import { LIMITE_DO_TEXTO } from "@/lib/lembretes/esquemas";
import { resumoDoInicio } from "@/lib/lembretes/lista";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import {
  FRASE_FALHA_AO_GUARDAR,
  FRASE_NADA_PARA_FAZER,
  PLACEHOLDER_NOVO_LEMBRETE,
  ROTULO_GUARDANDO,
  ROTULO_GUARDAR,
  ROTULO_NOVO_LEMBRETE,
  TITULO_PARA_FAZER,
  TOAST_LEMBRETE_GUARDADO,
  textoEMaisN,
} from "@/lib/lembretes/textos";
import { LinhaLembrete } from "./linha-lembrete";

export type ListaDoInicioProps = {
  // O objeto inteiro de `lerLembretesDoInicio()` — os planos 03 e 04 acrescentam campos a ele sem
  // mexer na assinatura do bloco.
  inicio: LembretesDoInicio;
  // O dia civil de Brasília, da PÁGINA (`hojeEmBrasilia`, o mesmo instante da saudação). Nenhum
  // componente desta pasta lê o relógio para decidir vencido/hoje/amanhã.
  hoje: string;
};

// A coluna "Para fazer" do Início (Fase 06.3). Plano 01 (o traçador): a linha de criar e a lista
// dos abertos. Plano 03: o título com a contagem ao lado (desenhado AQUI, no cliente, porque a
// contagem muda com os toques), no máximo 6 abertos na ordem do briefing, "e mais N — ver todos" e
// a frase do vazio — tudo de `resumoDoInicio` (puro, `lib/lembretes/lista.ts`) sobre o estado local.
// A caixa de feito, editar, excluir e os feitos são do plano 04.
//
// O resultado de um toque NUNCA espera o redesenho do servidor: a re-renderização depois de uma
// Server Action às vezes não chega à tela (debug da Abertura, ~54% medido). A lista mora num estado
// local, semeado das props e re-semeado quando o servidor manda props novas (o padrão do React de
// guardar a prop anterior no estado e comparar durante a renderização — sem efeito). Nenhum
// refresh do roteador depois da ação (molde `caixa-marcacao.tsx`): `criarLembrete` já revalida.
export function ListaDoInicio({ inicio, hoje }: ListaDoInicioProps) {
  const [inicioAnterior, setInicioAnterior] = useState(inicio);
  const [abertos, setAbertos] = useState<LembreteDaTela[]>(inicio.abertos);
  if (inicio !== inicioAnterior) {
    setInicioAnterior(inicio);
    setAbertos(inicio.abertos);
  }

  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O estado `guardando` só vale na próxima renderização; o ref fecha a porta já no mesmo tique —
  // Enter repetido não grava duas vezes.
  const enviandoRef = useRef(false);
  const campoRef = useRef<HTMLInputElement>(null);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current) {
      return;
    }
    // Só espaços não vai ao servidor; o foco volta ao campo. (A frase do vazio é do plano 03.)
    if (texto.trim() === "") {
      campoRef.current?.focus();
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setErro(null);
    try {
      const resposta = await criarLembrete({ texto, paraQuando: null, quem: null });
      if (resposta.ok) {
        // A ordem sai de `resumoDoInicio` (que ordena por `compararAbertos`) — sem esperar o servidor.
        setAbertos((atuais) => [
          ...atuais.filter((l) => l.id !== resposta.dados.id),
          resposta.dados,
        ]);
        setTexto("");
        toast.success(TOAST_LEMBRETE_GUARDADO);
      } else {
        // O texto FICA no campo.
        setErro(resposta.erro);
      }
    } catch {
      setErro(FRASE_FALHA_AO_GUARDAR);
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
      campoRef.current?.focus();
    }
  }

  const { visiveis, restantes, contagem } = resumoDoInicio(abertos, hoje);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-apoio text-muted-foreground font-semibold tracking-[0.05em] uppercase">
          {TITULO_PARA_FAZER}
        </h3>
        <span
          data-testid="lembretes-contagem"
          aria-live="polite"
          className="text-apoio text-tinta-fraca font-normal tabular-nums"
        >
          {contagem}
        </span>
      </div>

      <form onSubmit={(evento) => void guardar(evento)} className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={campoRef}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              if (erro !== null) setErro(null);
            }}
            aria-label={ROTULO_NOVO_LEMBRETE}
            placeholder={PLACEHOLDER_NOVO_LEMBRETE}
            maxLength={LIMITE_DO_TEXTO}
            aria-invalid={erro !== null}
            aria-describedby={erro !== null ? "lembretes-novo-erro" : undefined}
            data-testid="lembretes-novo-texto"
            className="text-corpo md:text-corpo min-h-[44px] min-w-0 flex-[1_1_200px] rounded-full px-4"
          />
          <Button
            type="submit"
            disabled={guardando}
            aria-busy={guardando}
            data-testid="lembretes-novo-guardar"
            className="min-h-[44px] rounded-full px-4 font-semibold"
          >
            {guardando ? ROTULO_GUARDANDO : ROTULO_GUARDAR}
          </Button>
        </div>
        {erro !== null && (
          <p
            id="lembretes-novo-erro"
            role="alert"
            data-testid="lembretes-novo-erro"
            className="text-apoio text-erro"
          >
            {erro}
          </p>
        )}
      </form>

      {visiveis.length > 0 ? (
        <ul data-testid="lembretes-lista" className="flex flex-col gap-1">
          {visiveis.map((lembrete) => (
            <LinhaLembrete key={lembrete.id} lembrete={lembrete} hoje={hoje} />
          ))}
        </ul>
      ) : (
        <p
          data-testid="lembretes-vazio"
          className="text-apoio text-tinta-fraca border-borda rounded-md border border-dashed p-4"
        >
          {FRASE_NADA_PARA_FAZER}
        </p>
      )}

      {restantes > 0 && (
        <Link
          href={rotaDeGestao("/lembretes")}
          data-testid="lembretes-mais"
          className="text-apoio text-acento focus-visible:ring-ring inline-flex min-h-[44px] items-center self-start rounded-md font-normal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {textoEMaisN(restantes)}
        </Link>
      )}
    </div>
  );
}
