"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { colocarNaData } from "@/lib/agenda/acoes";
import type { EventoCarregado } from "@/lib/agenda/consultas";
import type { PessoaDoSeletor } from "@/lib/agenda/seletor";
import {
  AVISO_LISTA_CHEIA,
  complementoToastExperimentalCobrada,
  faixaExperimental,
  faixaInscricaoNaOficina,
  faixaReposicao,
  FRASE_EXPERIMENTAL_SEM_ESCOLHA,
  FRASE_EXPERIMENTAL_VALOR,
  FRASE_FALHA_AO_COLOCAR,
  ROTULO_COLOCANDO,
  ROTULO_COLOCAR_ALGUEM,
  ROTULO_COLOCAR_NA_LISTA,
  TOAST_ENTROU_COMO_REPOSICAO,
  TOAST_ENTROU_EXPERIMENTAL,
  TOAST_INSCRITO_NA_OFICINA,
} from "@/lib/agenda/textos";
import { listaCheia } from "@/lib/agenda/vagas";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { formatarReais } from "@/lib/financeiro/formato";
import { Button } from "@/components/ui/button";

import { centavosParaCampo, EscolhaExperimental } from "./escolha-experimental";
import { SeletorPessoa } from "./seletor-pessoa";

// Recusas que dizem o que corrigir na própria escolha — a pessoa continua escolhida para tentar de novo.
const ERROS_QUE_MANTEM_A_ESCOLHA = new Set([
  FRASE_FALHA_AO_COLOCAR,
  FRASE_EXPERIMENTAL_SEM_ESCOLHA,
  FRASE_EXPERIMENTAL_VALOR,
]);

export type ColocarAlguemProps = {
  // A data (aula ou oficina avulsa, ou data de turma — não cancelada) como o servidor a leu.
  evento: EventoCarregado;
};

// Como a pessoa escolhida entra: quem veio do grupo "Tem aula a repor" (o servidor mandou o saldo) entra
// como reposição, em qualquer data; os demais, na oficina, como inscrição paga; na data de turma, como
// aula experimental — só nesta data, cobrada ou gratuita, decidido na hora (D-07).
function modoDaEscolha(pessoa: PessoaDoSeletor, evento: EventoCarregado): "reposicao" | "oficina" | "experimental" {
  if (pessoa.aRepor !== undefined && pessoa.aRepor > 0) {
    return "reposicao";
  }
  return evento.tipo === "turma" ? "experimental" : "oficina";
}

// "Colocar alguém" na folha de uma aula ou oficina avulsa ou de uma data de turma (05-UI-SPEC.md §"Folha
// do evento", item 5; AGE-10, AGE-12): o seletor de pessoa e, escolhida a pessoa, a faixa de
// confirmação (`aria-live`) e "Colocar na lista" (`outline` — o primário da folha continua "Pronto"). O
// preço da faixa é o que a folha mostra; o que vale é o que o servidor lê do evento sob a trava ao
// gravar. A reposição: a faixa diz quantas aulas a repor a pessoa tem; o servidor recalcula o crédito
// sob a trava do cliente e recusa se ele acabou (outro celular).
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
  // A experimental: nada escolhido de início (UI-D6); o valor já vem com a sugestão do servidor.
  const [cobrar, setCobrar] = useState<boolean | null>(null);
  const valorSugerido = evento.sugestaoDaAula === null ? "" : centavosParaCampo(evento.sugestaoDaAula.valorCentavos);
  const [valor, setValor] = useState(valorSugerido);
  const [erroDoValor, setErroDoValor] = useState<string | null>(null);
  const idDaFraseSemEscolha = useId();

  const cheia = evento.vagas !== null && listaCheia(evento.vagas, evento.inscricoes.length);
  const modo = escolhida === null ? null : modoDaEscolha(escolhida, evento);
  const faltaEscolher = modo === "experimental" && cobrar === null;

  function escolherPessoa(pessoa: PessoaDoSeletor | null) {
    setEscolhida(pessoa);
    setCobrar(null);
    setValor(valorSugerido);
    setErroDoValor(null);
  }

  function recomecar() {
    escolherPessoa(null);
    setChaveDoSeletor((atual) => atual + 1);
  }

  async function colocar() {
    if (escolhida === null || modo === null || faltaEscolher || emVoo.current) {
      return;
    }
    // A conversão no cliente é conveniência (o servidor converte de novo): o erro aparece embaixo do
    // campo, sem ida ao servidor.
    if (modo === "experimental" && cobrar === true) {
      const convertido = converterReaisParaCentavos(valor);
      if (!convertido.ok || convertido.centavos === null || convertido.centavos < 1) {
        setErroDoValor(FRASE_EXPERIMENTAL_VALOR);
        return;
      }
    }
    emVoo.current = true;
    setColocando(true);
    setErro(null);
    setErroDoValor(null);
    try {
      const resposta = await colocarNaData({
        eventoId: evento.id,
        clienteId: escolhida.id,
        modo,
        ...(modo === "experimental" ? { cobrar, valor: cobrar === true ? valor : null } : {}),
      });
      if (resposta.ok) {
        toast.success(
          modo === "reposicao"
            ? TOAST_ENTROU_COMO_REPOSICAO
            : modo === "experimental"
              ? TOAST_ENTROU_EXPERIMENTAL +
                (resposta.dados.cobradoCentavos !== null
                  ? complementoToastExperimentalCobrada(formatarReais(resposta.dados.cobradoCentavos))
                  : "")
              : TOAST_INSCRITO_NA_OFICINA,
        );
        recomecar();
        return;
      }
      if (resposta.erro === FRASE_EXPERIMENTAL_VALOR) {
        setErroDoValor(resposta.erro);
        return;
      }
      setErro(resposta.erro);
      // A tela estava velha (a pessoa já está na lista, a data mudou, o crédito acabou): o servidor já
      // mandou a folha atualizada, e a escolha não vale mais. Falha de rede ou de validação mantém a
      // escolha para tentar de novo.
      if (!ERROS_QUE_MANTEM_A_ESCOLHA.has(resposta.erro)) {
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
          escolherPessoa(pessoa);
        }}
        aoDigitar={() => escolherPessoa(null)}
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
        {escolhida !== null && modo === "reposicao"
          ? faixaReposicao(escolhida.nome, escolhida.aRepor ?? 0)
          : escolhida !== null && modo === "experimental"
            ? faixaExperimental(escolhida.nome)
            : escolhida !== null && modo === "oficina" && evento.precoCentavos !== null
              ? faixaInscricaoNaOficina(escolhida.nome, formatarReais(evento.precoCentavos))
              : null}
      </div>

      {escolhida !== null && modo === "experimental" ? (
        <EscolhaExperimental
          cobrar={cobrar}
          aoEscolher={(escolha) => {
            setCobrar(escolha);
            setErroDoValor(null);
          }}
          valor={valor}
          aoMudarValor={(novo) => {
            setValor(novo);
            setErroDoValor(null);
          }}
          sugestao={evento.sugestaoDaAula}
          erroDoValor={erroDoValor}
          desabilitado={colocando}
          idDaFraseSemEscolha={idDaFraseSemEscolha}
        />
      ) : null}

      {escolhida !== null && modo !== null ? (
        <Button
          type="button"
          variant="outline"
          data-testid="colocar-na-lista"
          disabled={colocando || faltaEscolher}
          aria-busy={colocando ? "true" : undefined}
          aria-describedby={faltaEscolher ? idDaFraseSemEscolha : undefined}
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
