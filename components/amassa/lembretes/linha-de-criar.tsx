"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarLembrete } from "@/lib/lembretes/acoes";
import type { LembreteDaTela, PessoaDaCasa } from "@/lib/lembretes/consultas";
import { LIMITE_DO_TEXTO } from "@/lib/lembretes/esquemas";
import {
  FRASE_ESCREVA_ANTES_DE_GUARDAR,
  FRASE_FALHA_AO_GUARDAR,
  PLACEHOLDER_NOVO_LEMBRETE,
  ROTULO_GUARDANDO,
  ROTULO_GUARDAR,
  ROTULO_NOVO_LEMBRETE,
  TOAST_LEMBRETE_GUARDADO,
} from "@/lib/lembretes/textos";
import { cn } from "@/lib/utils";

import { manterExclusaoNaFrente } from "./avisos";
import { PilulaDeData, PilulasDePessoa } from "./opcoes-do-lembrete";

export type LinhaDeCriarProps = {
  pessoas: readonly PessoaDaCasa[];
  // Recebe a linha que o servidor gravou; quem chama a põe no estado local na hora.
  aoCriar: (lembrete: LembreteDaTela) => void;
};

// A linha de criar (06.3-UI-SPEC.md §"Início — o bloco duplo", item 2; LMB-03): o campo "+ lembrete",
// "Guardar" e, abaixo, a fileira de opções — "para [data]" e as pessoas da casa. A fileira aparece ao
// focar o campo ou digitar e só some depois de guardar (UI-D17). Padrão: sem data e "geral".
//
// - Vazio ou só espaços: NADA vai ao servidor; a frase "Escreva o lembrete antes de guardar." aparece
//   embaixo, o foco volta ao campo, e a frase some ao digitar (UI-D9).
// - Recusa do servidor (ex.: a pessoa foi desativada entre abrir a página e guardar) ou exceção: a
//   frase embaixo, e o texto, a data e a pessoa FICAM — nada some em silêncio.
// - Durante o envio: "Guardando…", `disabled`, `aria-busy`; o ref fecha a porta já no mesmo tique,
//   então Enter repetido não grava duas vezes.
//
// Nada aqui lê o relógio: o prazo é o dia escolhido no seletor, e quem decide vencido/hoje é a lista,
// com o `hoje` da página.
export function LinhaDeCriar({ pessoas, aoCriar }: LinhaDeCriarProps) {
  const [texto, setTexto] = useState("");
  // `""` = sem data (o valor do `<input type="date">` vazio).
  const [paraQuando, setParaQuando] = useState("");
  // `null` = "geral".
  const [quem, setQuem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoesAbertas, setOpcoesAbertas] = useState(false);
  const enviandoRef = useRef(false);
  const campoRef = useRef<HTMLInputElement>(null);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current) {
      return;
    }
    if (texto.trim() === "") {
      setErro(FRASE_ESCREVA_ANTES_DE_GUARDAR);
      campoRef.current?.focus();
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    let guardou = false;
    try {
      const resposta = await criarLembrete({
        texto,
        paraQuando: paraQuando || null,
        quem,
      });
      if (resposta.ok) {
        guardou = true;
        aoCriar(resposta.dados);
        setTexto("");
        setParaQuando("");
        setQuem(null);
        toast.success(TOAST_LEMBRETE_GUARDADO);
        // A exclusão pendente volta para a frente da pilha (06.3-WR-01, quick 261005-2yu).
        manterExclusaoNaFrente();
      } else {
        setErro(resposta.erro);
      }
    } catch {
      setErro(FRASE_FALHA_AO_GUARDAR);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
      // O foco volta ao campo (o "Guardar" fica `disabled` durante o envio e perde o foco). Focar
      // reabre a fileira pelo `onFocus` — por isso o fechamento depois de guardar vem DEPOIS.
      campoRef.current?.focus();
      if (guardou) {
        setOpcoesAbertas(false);
      }
    }
  }

  return (
    <form onSubmit={(evento) => void guardar(evento)} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={campoRef}
          value={texto}
          onFocus={() => setOpcoesAbertas(true)}
          onChange={(evento) => {
            setTexto(evento.target.value);
            setOpcoesAbertas(true);
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
          disabled={enviando}
          aria-busy={enviando}
          data-testid="lembretes-novo-guardar"
          className="min-h-[44px] rounded-full px-4 font-semibold"
        >
          {enviando ? ROTULO_GUARDANDO : ROTULO_GUARDAR}
        </Button>
      </div>
      {erro !== null && (
        <p
          id="lembretes-novo-erro"
          role="alert"
          data-testid="lembretes-novo-erro"
          className="text-apoio text-erro font-normal"
        >
          {erro}
        </p>
      )}
      <div className={cn("flex w-full flex-wrap gap-2", !opcoesAbertas && "hidden")}>
        <PilulaDeData
          valor={paraQuando}
          aoMudar={setParaQuando}
          testId="lembretes-novo-data"
        />
        <PilulasDePessoa pessoas={pessoas} valor={quem} aoMudar={setQuem} />
      </div>
    </form>
  );
}
