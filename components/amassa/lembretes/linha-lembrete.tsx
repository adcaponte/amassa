"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { editarLembrete } from "@/lib/lembretes/acoes";
import type { LembreteDaTela, PessoaDaCasa } from "@/lib/lembretes/consultas";
import { LIMITE_DO_TEXTO } from "@/lib/lembretes/esquemas";
import {
  corDaPessoa,
  instanteCurto,
  primeiroNome,
  rotuloDoPrazo,
  situacaoDoPrazo,
} from "@/lib/lembretes/lista";
import {
  FRASE_EDICAO_VAZIA,
  FRASE_FALHA_AO_SALVAR_EDICAO,
  FRASE_LEMBRETE_NAO_EXISTE,
  ROTULO_CANCELAR,
  ROTULO_EDITAR,
  ROTULO_EXCLUIR,
  ROTULO_SALVANDO,
  ROTULO_SALVAR,
  ROTULO_TEXTO_DO_LEMBRETE,
  TOAST_ATUALIZADO,
  rotuloDesfazerFeito,
  rotuloEditar,
  rotuloExcluir,
  rotuloMarcarFeito,
  textoFeitoPor,
  textoPor,
} from "@/lib/lembretes/textos";
import { cn } from "@/lib/utils";

import { manterExclusaoNaFrente } from "./avisos";
import { PilulaDeData, PilulasDePessoa } from "./opcoes-do-lembrete";

// As ações de texto da linha ("editar", "excluir"): neutras — nunca vermelhas (06.3-UI-SPEC.md
// §Color) —, 44 px de altura, sem gap entre elas (os 44 px já separam).
const CLASSE_DA_ACAO =
  "text-apoio text-tinta-fraca hover:bg-superficie-2 hover:text-tinta focus-visible:ring-ring min-h-[44px] rounded-md px-2 font-normal focus-visible:ring-2 focus-visible:outline-none";

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
  // A edição na linha (LMB-07). Quem guarda QUAL linha está em edição é a lista — só uma por vez
  // (UI-D12): abrir outra cancela a atual sem perguntar. "editar" só existe nos abertos.
  emEdicao?: boolean;
  aoAbrirEdicao?: () => void;
  // "cancelar" ou Esc: nada é gravado.
  aoCancelarEdicao?: () => void;
  // A linha que o servidor gravou.
  aoSalvarEdicao?: (linha: LembreteDaTela) => void;
  // O lembrete não existe mais no banco (outra pessoa o excluiu): a lista tira a linha.
  aoSumir?: (id: string) => void;
  // "excluir" — em todo lembrete, aberto ou feito. Quem decide o que acontece é a lista (a exclusão
  // adiada até o toast expirar, D-03); a linha só avisa o toque.
  aoExcluir?: () => void;
};

// Uma linha de lembrete (06.3-UI-SPEC.md §"A linha do lembrete"). Grade de três colunas no
// contêiner ≥ 340 px (caixa · texto e meta · ações), duas abaixo disso — aí as ações descem para
// baixo da meta, na 2ª coluna (UI-D5, container query). Plano 03: o texto e a meta (rótulo de prazo
// · chip da pessoa). Plano 04: a caixa de feito na 1ª coluna, o feito riscado com "feito por …", a
// autoria opcional dos abertos, "editar" com a edição na própria linha e "excluir".
//
// O texto e o nome saem SEMPRE como nós de texto do React (T-06.3-14) — nunca HTML cru.
export function LinhaLembrete({
  lembrete,
  hoje,
  pessoas,
  feito: feitoDaLista,
  mostrarAutoria = false,
  aoAlternarFeito,
  emEdicao = false,
  aoAbrirEdicao,
  aoCancelarEdicao,
  aoSalvarEdicao,
  aoSumir,
  aoExcluir,
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

  // "editar" só nos abertos (como no protótipo).
  const podeEditar = !feito && aoAbrirEdicao !== undefined;
  const editando = emEdicao && !feito;

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
          ~1,3:1). Em edição, `disabled` (protótipo). */}
      <button
        type="button"
        aria-pressed={feito}
        aria-label={
          feito ? rotuloDesfazerFeito(lembrete.texto) : rotuloMarcarFeito(lembrete.texto)
        }
        disabled={editando}
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

      {editando ? (
        <EdicaoNaLinha
          lembrete={lembrete}
          pessoas={pessoas}
          aoCancelar={() => aoCancelarEdicao?.()}
          aoSalvar={(linha) => aoSalvarEdicao?.(linha)}
          aoSumir={() => aoSumir?.(lembrete.id)}
        />
      ) : (
        <>
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
              <div
                data-testid="lembrete-meta"
                className="text-apoio text-tinta-fraca mt-1 flex flex-wrap items-center gap-2 tabular-nums"
              >
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

          {/* As ações: 3ª coluna num contêiner ≥ 340 px; abaixo disso, na 2ª coluna sob a meta, com
              `-ml-2` para o texto do botão alinhar com o do lembrete (UI-D5). */}
          {(podeEditar || aoExcluir !== undefined) && (
            <div className="col-start-2 -ml-2 flex flex-wrap @min-[340px]:col-start-3 @min-[340px]:row-start-1 @min-[340px]:ml-0">
              {podeEditar && (
                <button
                  type="button"
                  aria-label={rotuloEditar(lembrete.texto)}
                  onClick={aoAbrirEdicao}
                  data-testid="lembrete-editar"
                  className={CLASSE_DA_ACAO}
                >
                  {ROTULO_EDITAR}
                </button>
              )}
              {aoExcluir !== undefined && (
                <button
                  type="button"
                  aria-label={rotuloExcluir(lembrete.texto)}
                  onClick={aoExcluir}
                  data-testid="lembrete-excluir"
                  className={CLASSE_DA_ACAO}
                >
                  {ROTULO_EXCLUIR}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

type EdicaoNaLinhaProps = {
  lembrete: LembreteDaTela;
  pessoas: readonly PessoaDaCasa[];
  aoCancelar: () => void;
  aoSalvar: (linha: LembreteDaTela) => void;
  aoSumir: () => void;
};

// A edição na própria linha (LMB-07; 06.3-UI-SPEC.md §"Edição na linha"): o campo com o texto e o
// foco no fim; embaixo, a `PilulaDeData` e as `PilulasDePessoa` da linha de criar (o mesmo
// componente), "Salvar" (`outline` — UI-D7: com "Guardar" na tela, seriam dois terracotas) e
// "cancelar". Enter salva (é `<form>`); Esc cancela (UI-D12). Nada é gravado até "Salvar".
//
// - Vazio: a frase embaixo do campo, nada vai ao servidor.
// - Recusa do servidor (a pessoa nova foi desativada antes de salvar) ou exceção: a frase embaixo,
//   e a edição continua aberta e preenchida.
// - O lembrete sumiu do banco: toast de erro e a lista tira a linha.
// - A pessoa DESATIVADA que já estava gravada aparece como uma pílula a mais, já marcada: salvar sem
//   trocar mantém o `quem` (o servidor aceita a pessoa que já estava gravada).
function EdicaoNaLinha({
  lembrete,
  pessoas,
  aoCancelar,
  aoSalvar,
  aoSumir,
}: EdicaoNaLinhaProps) {
  const [texto, setTexto] = useState(lembrete.texto);
  // `""` = sem data (o valor do `<input type="date">` vazio).
  const [paraQuando, setParaQuando] = useState(lembrete.paraQuando ?? "");
  // `null` = "geral".
  const [quem, setQuem] = useState<string | null>(lembrete.quem);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);
  const campoRef = useRef<HTMLInputElement>(null);
  const idDoErro = useId();

  // Foco ao abrir, com o cursor no fim do texto.
  useEffect(() => {
    const campo = campoRef.current;
    if (campo === null) {
      return;
    }
    campo.focus();
    const fim = campo.value.length;
    campo.setSelectionRange(fim, fim);
  }, []);

  const extra =
    lembrete.quem !== null && !pessoas.some((pessoa) => pessoa.id === lembrete.quem)
      ? { id: lembrete.quem, nome: lembrete.quemNome ?? "" }
      : null;

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current) {
      return;
    }
    if (texto.trim() === "") {
      setErro(FRASE_EDICAO_VAZIA);
      campoRef.current?.focus();
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await editarLembrete({
        id: lembrete.id,
        texto,
        paraQuando: paraQuando || null,
        quem,
      });
      if (resposta.ok) {
        toast.success(TOAST_ATUALIZADO);
        // A exclusão pendente volta para a frente da pilha (06.3-WR-01, quick 261005-2yu).
        manterExclusaoNaFrente();
        aoSalvar(resposta.dados);
      } else if (resposta.naoExiste) {
        toast.error(FRASE_LEMBRETE_NAO_EXISTE);
        manterExclusaoNaFrente();
        aoSumir();
      } else {
        setErro(resposta.erro);
      }
    } catch {
      setErro(FRASE_FALHA_AO_SALVAR_EDICAO);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={(evento) => void salvar(evento)}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          aoCancelar();
        }
      }}
      className="col-start-2 flex min-w-0 flex-col gap-2 @min-[340px]:col-span-2"
    >
      <input
        ref={campoRef}
        value={texto}
        onChange={(evento) => {
          setTexto(evento.target.value);
          if (erro !== null) setErro(null);
        }}
        maxLength={LIMITE_DO_TEXTO}
        aria-label={ROTULO_TEXTO_DO_LEMBRETE}
        aria-invalid={erro !== null}
        aria-describedby={erro !== null ? idDoErro : undefined}
        data-testid="lembrete-edicao-texto"
        className="border-input bg-superficie text-tinta focus-visible:ring-ring text-corpo md:text-corpo min-h-[44px] w-full rounded-md border px-2 focus-visible:ring-2 focus-visible:outline-none"
      />
      {erro !== null && (
        <p
          id={idDoErro}
          role="alert"
          data-testid="lembrete-edicao-erro"
          className="text-apoio text-erro font-normal"
        >
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <PilulaDeData valor={paraQuando} aoMudar={setParaQuando} />
        <PilulasDePessoa pessoas={pessoas} valor={quem} aoMudar={setQuem} extra={extra} />
        <Button
          type="submit"
          variant="outline"
          disabled={enviando}
          aria-busy={enviando}
          data-testid="lembrete-edicao-salvar"
          className="min-h-[44px] px-4 font-semibold"
        >
          {enviando ? ROTULO_SALVANDO : ROTULO_SALVAR}
        </Button>
        <button
          type="button"
          onClick={aoCancelar}
          data-testid="lembrete-edicao-cancelar"
          className="text-apoio text-acento focus-visible:ring-ring min-h-[44px] rounded-md px-2 font-normal underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          {ROTULO_CANCELAR}
        </button>
      </div>
    </form>
  );
}
