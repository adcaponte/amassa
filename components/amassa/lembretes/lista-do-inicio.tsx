"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarLembrete } from "@/lib/lembretes/acoes";
import type { LembreteDaTela, LembretesDoInicio } from "@/lib/lembretes/consultas";
import { LIMITE_DO_TEXTO } from "@/lib/lembretes/esquemas";
import {
  FRASE_FALHA_AO_GUARDAR,
  PLACEHOLDER_NOVO_LEMBRETE,
  ROTULO_GUARDANDO,
  ROTULO_GUARDAR,
  ROTULO_NOVO_LEMBRETE,
  TOAST_LEMBRETE_GUARDADO,
} from "@/lib/lembretes/textos";

export type ListaDoInicioProps = {
  // O objeto inteiro de `lerLembretesDoInicio()` — os planos 03 e 04 acrescentam campos a ele sem
  // mexer na assinatura do bloco.
  inicio: LembretesDoInicio;
};

// A coluna "Para fazer" do Início (Fase 06.3). Plano 01 (o traçador): a linha de criar e a lista
// crua dos abertos. A linha completa (caixa, prazo, pessoa, editar, excluir), a contagem, o "e mais
// N", os feitos e a frase do vazio são dos planos 03 e 04.
//
// O resultado de um toque NUNCA espera o redesenho do servidor: a re-renderização depois de uma
// Server Action às vezes não chega à tela (debug da Abertura, ~54% medido). A lista mora num estado
// local, semeado das props e re-semeado quando o servidor manda props novas (o padrão do React de
// guardar a prop anterior no estado e comparar durante a renderização — sem efeito). Nenhum
// refresh do roteador depois da ação (molde `caixa-marcacao.tsx`): `criarLembrete` já revalida.
export function ListaDoInicio({ inicio }: ListaDoInicioProps) {
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
        // Um lembrete sem data criado agora é, pela ordem do briefing, o último dos sem data — o
        // fim da lista. (A ordenação geral, com data, é do plano 03.)
        setAbertos((atuais) => [...atuais.filter((l) => l.id !== resposta.dados.id), resposta.dados]);
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

  return (
    <div className="flex flex-col gap-3">
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

      <ul data-testid="lembretes-lista" className="flex flex-col gap-1">
        {abertos.map((lembrete) => (
          <li
            key={lembrete.id}
            data-testid="lembrete-linha"
            data-id={lembrete.id}
            className="text-corpo text-foreground [overflow-wrap:anywhere]"
          >
            {lembrete.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
