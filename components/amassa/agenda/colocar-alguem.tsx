"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { colocarNaData } from "@/lib/agenda/acoes";
import type { EventoCarregado } from "@/lib/agenda/consultas";
import type { PessoaDoSeletor } from "@/lib/agenda/seletor";
import {
  AVISO_LISTA_CHEIA,
  faixaInscricaoNaOficina,
  FRASE_FALHA_AO_COLOCAR,
  ROTULO_COLOCANDO,
  ROTULO_COLOCAR_ALGUEM,
  ROTULO_COLOCAR_NA_LISTA,
  TOAST_INSCRITO_NA_OFICINA,
} from "@/lib/agenda/textos";
import { listaCheia } from "@/lib/agenda/vagas";
import { formatarReais } from "@/lib/financeiro/formato";
import { Button } from "@/components/ui/button";

import { SeletorPessoa } from "./seletor-pessoa";

export type ColocarAlguemProps = {
  // A data (aula ou oficina avulsa, não cancelada) como o servidor a leu.
  evento: EventoCarregado;
};

// "Colocar alguém" na folha de uma aula ou oficina avulsa (05-UI-SPEC.md §"Folha do evento", item 5;
// AGE-10, AGE-12): o seletor de pessoa e, escolhida a pessoa, a faixa de confirmação (`aria-live`) e
// "Colocar na lista" (`outline` — o primário da folha continua "Pronto"). O preço da faixa é o que a
// folha mostra; o que vale é o que o servidor lê do evento sob a trava ao gravar.
//
// Lista cheia (AGE-11, UI-D16): a caixa âmbar acima do botão AVISA e não bloqueia — o botão continua
// igual, e o servidor não confere vagas. A contagem é a de TODAS as inscrições da data.
export function ColocarAlguem({ evento }: ColocarAlguemProps) {
  const emVoo = useRef(false);
  const [escolhida, setEscolhida] = useState<PessoaDoSeletor | null>(null);
  const [colocando, setColocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Trocar a chave remonta o seletor limpo — depois de colocar, o campo volta vazio.
  const [chaveDoSeletor, setChaveDoSeletor] = useState(0);

  const cheia = evento.vagas !== null && listaCheia(evento.vagas, evento.inscricoes.length);

  function recomecar() {
    setEscolhida(null);
    setChaveDoSeletor((atual) => atual + 1);
  }

  async function colocar() {
    if (escolhida === null || emVoo.current) {
      return;
    }
    emVoo.current = true;
    setColocando(true);
    setErro(null);
    try {
      const resposta = await colocarNaData({ eventoId: evento.id, clienteId: escolhida.id });
      if (resposta.ok) {
        toast.success(TOAST_INSCRITO_NA_OFICINA);
        recomecar();
        return;
      }
      setErro(resposta.erro);
      // A tela estava velha (a pessoa já está na lista, a data mudou): o servidor já mandou a folha
      // atualizada, e a escolha não vale mais. Uma falha de rede mantém a escolha para tentar de novo.
      if (resposta.erro !== FRASE_FALHA_AO_COLOCAR) {
        recomecar();
      }
    } catch {
      setErro(FRASE_FALHA_AO_COLOCAR);
    } finally {
      emVoo.current = false;
      setColocando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="colocar-alguem">
      <SeletorPessoa
        key={chaveDoSeletor}
        rotulo={ROTULO_COLOCAR_ALGUEM}
        eventoId={evento.id}
        desabilitado={colocando}
        aoEscolher={(pessoa) => {
          setErro(null);
          setEscolhida(pessoa);
        }}
        aoDigitar={() => setEscolhida(null)}
      />

      {cheia ? (
        <p
          data-testid="aviso-lista-cheia"
          className="text-apoio bg-atencao-fundo text-atencao flex items-start gap-2 rounded-md px-3 py-2 font-semibold"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{AVISO_LISTA_CHEIA}</span>
        </p>
      ) : null}

      {/* A faixa de confirmação: a região existe sempre, para o leitor de tela anunciar a escolha. */}
      <div aria-live="polite" data-testid="faixa-colocar" className="text-corpo text-tinta [overflow-wrap:anywhere]">
        {escolhida !== null && evento.precoCentavos !== null
          ? faixaInscricaoNaOficina(escolhida.nome, formatarReais(evento.precoCentavos))
          : null}
      </div>

      {escolhida !== null ? (
        <Button
          type="button"
          variant="outline"
          data-testid="colocar-na-lista"
          disabled={colocando}
          aria-busy={colocando ? "true" : undefined}
          onClick={() => void colocar()}
          className="text-corpo h-auto min-h-[44px] self-start px-4 font-semibold whitespace-normal"
        >
          {colocando ? ROTULO_COLOCANDO : ROTULO_COLOCAR_NA_LISTA}
        </Button>
      ) : null}

      {erro ? (
        <p role="alert" data-testid="colocar-erro" className="text-apoio text-erro [overflow-wrap:anywhere]">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
