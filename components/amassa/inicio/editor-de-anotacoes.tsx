"use client";

import { useEffect, useRef, useState } from "react";

import { salvarAnotacoes } from "@/lib/anotacoes/acoes";
import { textoDaAutoria } from "@/lib/anotacoes/folha";
import {
  CONVITE_DA_CAIXA_VAZIA,
  FRASE_AVISO_DE_CONFLITO,
  FRASE_DE_APOIO,
  FRASE_VER_O_DELA_VAI_TROCAR,
  ROTULO_INDICADOR_SALVANDO,
  ROTULO_INDICADOR_SALVO,
  ROTULO_MANTER_O_MEU,
  ROTULO_VER_O_DELA,
} from "@/lib/anotacoes/textos";
import { Button } from "@/components/ui/button";

export type EditorDeAnotacoesProps = {
  textoInicial: string;
  salvoPorNomeInicial: string | null;
  // Instante ISO do `atualizado_em` que veio junto da leitura do servidor — a marca de versão
  // inicial (`vistoEm`). Só chega vazio (`""`) se `lerFolhaDaCasa()` falhou — mas nesse caso
  // `BlocoAnotacoes` nem chega a montar este componente (mostra `EstadoErro` no lugar).
  atualizadoEmInicial: string;
};

// A pausa de digitação que dispara o salvamento automático (D-08). O protótipo
// (`prototipo-gestao.html`) usa 600ms para gravar em armazenamento LOCAL (`localStorage`, sem
// ida à rede) — uma ida ao SERVIDOR merece mais folga: 1200ms dá espaço para uma pausa curta de
// raciocínio sem disparar uma requisição a cada poucas teclas, e ainda é curto o bastante para a
// pessoa não perder o texto se trancar o celular logo depois de parar de digitar.
const PAUSA_DE_DIGITACAO_MS = 1200;

type Indicador = "parado" | "salvando" | "salvo" | "erro";

type Conflito = {
  textoDoServidor: string;
  salvoPorNome: string | null;
  atualizadoEm: string;
};

// Client Component — a única forma de ter debounce de digitação, indicador que muda sozinho e o
// aviso de conflito sem recarregar a página. Nada de edição colaborativa em tempo real (D-08):
// nenhum canal aberto, nenhum sinal de digitação de outra pessoa, nenhuma fusão de texto — o que
// existe aqui é só o par salvar/avisar por cima de `salvarAnotacoes`.
export function EditorDeAnotacoes({
  textoInicial,
  salvoPorNomeInicial,
  atualizadoEmInicial,
}: EditorDeAnotacoesProps) {
  const [texto, setTexto] = useState(textoInicial);
  // `vistoEm` é a marca que ESTA aba tem na tela — o que ela vai mandar na próxima gravação como
  // "o que eu vi por último". Começa igual a `atualizadoEm` (a leitura inicial já é uma marca
  // vista) e só muda depois de uma gravação bem-sucedida OU de aceitar "ver o dela".
  const [vistoEm, setVistoEm] = useState<string | null>(atualizadoEmInicial || null);
  const [salvoPorNome, setSalvoPorNome] = useState<string | null>(salvoPorNomeInicial);
  const [atualizadoEm, setAtualizadoEm] = useState<string>(atualizadoEmInicial);
  const [indicador, setIndicador] = useState<Indicador>("parado");
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<Conflito | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o timer pendente se o bloco desmontar no meio da pausa — nunca chamar setState depois
  // de desmontado.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function salvar(textoParaSalvar: string, vistoEmParaSalvar: string | null) {
    setIndicador("salvando");
    setMensagemDeErro(null);

    const resposta = await salvarAnotacoes({ texto: textoParaSalvar, vistoEm: vistoEmParaSalvar });

    if (resposta.ok) {
      setVistoEm(resposta.atualizadoEm);
      setAtualizadoEm(resposta.atualizadoEm);
      setSalvoPorNome(resposta.salvoPorNome);
      setConflito(null);
      setIndicador("salvo");
      return;
    }

    if (resposta.motivo === "mudou-no-servidor") {
      // O texto digitado NUNCA é descartado por causa de um conflito — a caixa continua com o
      // que a pessoa escreveu; só o aviso aparece, na mesma linha do cabeçalho (D-08).
      setConflito({
        textoDoServidor: resposta.textoDoServidor,
        salvoPorNome: resposta.salvoPorNome,
        atualizadoEm: resposta.atualizadoEm,
      });
      setIndicador("parado");
      return;
    }

    // Erro de servidor (T-04.6-39): o texto digitado também nunca é descartado.
    setMensagemDeErro(resposta.erro);
    setIndicador("erro");
  }

  function aoDigitar(valor: string) {
    setTexto(valor);
    // Uma nova tecla depois de um aviso de conflito ainda visível não faz sentido mostrar — a
    // pessoa está decidindo escrever por cima, o que a próxima gravação automática já resolve.
    setConflito(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      void salvar(valor, vistoEm);
    }, PAUSA_DE_DIGITACAO_MS);
  }

  // "manter o meu": a MESMA porta (`salvarAnotacoes`), chamada de novo com o `vistoEm` que o
  // servidor acabou de devolver no aviso — nunca uma segunda ação (key_link do plano).
  function manterOMeu() {
    if (!conflito) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    void salvar(texto, conflito.atualizadoEm);
  }

  // "ver o dela": troca o texto da caixa pelo do servidor — já dito ANTES, na frase do próprio
  // aviso (`FRASE_VER_O_DELA_VAI_TROCAR`), o que será perdido (CLAUDE.md §Exclusão: nenhuma
  // remoção silenciosa). O texto do servidor já está salvo — não precisa de uma nova gravação.
  function verODela() {
    if (!conflito) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setTexto(conflito.textoDoServidor);
    setVistoEm(conflito.atualizadoEm);
    setAtualizadoEm(conflito.atualizadoEm);
    setSalvoPorNome(conflito.salvoPorNome);
    setConflito(null);
    setIndicador("salvo");
  }

  const autoria = textoDaAutoria({ nome: salvoPorNome, atualizadoEm });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-[24px] flex-wrap items-center justify-end gap-2">
        {conflito ? (
          <div
            data-testid="anotacoes-aviso-conflito"
            role="status"
            className="bg-atencao-fundo text-atencao flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-apoio"
          >
            <span className="flex-1">
              {FRASE_AVISO_DE_CONFLITO} {FRASE_VER_O_DELA_VAI_TROCAR}
            </span>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              data-testid="anotacoes-manter-o-meu"
              onClick={manterOMeu}
            >
              {ROTULO_MANTER_O_MEU}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              data-testid="anotacoes-ver-o-dela"
              onClick={verODela}
            >
              {ROTULO_VER_O_DELA}
            </Button>
          </div>
        ) : (
          <span
            data-testid="anotacoes-indicador"
            role={indicador === "erro" ? "alert" : undefined}
            className={
              indicador === "erro"
                ? "text-apoio text-destructive"
                : "text-apoio text-muted-foreground"
            }
          >
            {indicador === "salvando"
              ? ROTULO_INDICADOR_SALVANDO
              : indicador === "salvo"
                ? ROTULO_INDICADOR_SALVO
                : indicador === "erro"
                  ? mensagemDeErro
                  : ""}
          </span>
        )}
      </div>

      {/* `text-corpo` já é 16px (globals.css) — nunca menor, senão o iOS dá zoom ao focar
          (CLAUDE.md §Acessibilidade). `min-h-[120px]`: altura confortável para um recado curto
          sem rolagem imediata. */}
      <textarea
        data-testid="anotacoes-caixa"
        aria-label="Anotações da casa"
        placeholder={CONVITE_DA_CAIXA_VAZIA}
        value={texto}
        onChange={(evento) => aoDigitar(evento.target.value)}
        rows={5}
        className="border-border text-corpo min-h-[120px] w-full rounded-md border px-3 py-2"
      />

      <p className="text-apoio text-muted-foreground">{FRASE_DE_APOIO}</p>

      {autoria && (
        <p data-testid="anotacoes-autoria" className="text-apoio text-muted-foreground">
          {autoria}
        </p>
      )}
    </div>
  );
}
