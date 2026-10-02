"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { definirFornecedorAtivo, editarFornecedor } from "@/lib/fornecedores/acoes";
import {
  FRASE_FALHA_AO_DESATIVAR,
  FRASE_FALHA_AO_REATIVAR,
  ROTULO_DESATIVAR,
  ROTULO_EDITAR,
  ROTULO_REATIVANDO,
  ROTULO_REATIVAR,
  TOAST_FORNECEDOR_ATUALIZADO,
  TOAST_FORNECEDOR_DESATIVADO,
  TOAST_FORNECEDOR_REATIVADO,
  ariaDesativar,
  ariaEditar,
  ariaReativar,
} from "@/lib/fornecedores/textos";
import { Button } from "@/components/ui/button";

import { ConfirmarDesativarFornecedor } from "./confirmar-desativar-fornecedor";
import { FolhaFornecedor, type ValoresDoFornecedor } from "./folha-fornecedor";
import { enderecoDoFornecedor } from "./lista-fornecedores";

export type FornecedorDaFicha = ValoresDoFornecedor & { id: string; ativo: boolean };

// Os dois botões do cabeçalho da ficha (06.2-UI-SPEC.md §Copywriting → Ações; FRN-03): "Editar" e
// "Desativar" (num ativo) ou "Reativar" (num desativado) — verbo curto visível, o nome no
// `aria-label` (UI-D27). `outline`, peso 600, 44 px; `flex-wrap`: a 320 px descem para a linha de
// baixo do nome.
//
// - "Editar" abre a folha do plano 02 no modo "Editar fornecedor", com os valores atuais.
// - "Desativar" abre a confirmação, que diz o que some e o que fica; só fecha com a resposta.
// - "Reativar" chama a ação direto, sem confirmação (UI-D21 — nada se perde); a frase de erro,
//   inclusive a do nome que hoje é de outro ativo (Pitfall 11), aparece embaixo dos botões.
//
// Depois de desativar a ficha CONTINUA aberta mostrando o desativado (06.2-UI-SPEC.md §"Seleção e
// foco"): se a URL ainda não aponta para ele (a página abriu "o primeiro ativo" sem `?fornecedor=`),
// ela passa a apontar — senão a ficha pularia para outro fornecedor.
//
// Desativar e Reativar são o MESMO botão (mesma posição na árvore): ao fechar a confirmação o foco
// volta a ele, que depois do `refresh` já diz "Reativar".
export function AcoesDaFicha({ fornecedor }: { fornecedor: FornecedorDaFicha }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [erroDaConfirmacao, setErroDaConfirmacao] = useState<string | null>(null);
  const [reativando, setReativando] = useState(false);
  const [erroDeReativar, setErroDeReativar] = useState<string | null>(null);
  // Guarda síncrona: um toque duplo dispara UMA ação.
  const gravandoAgora = useRef(false);

  const { id, nome, ativo } = fornecedor;

  function manterFichaAberta() {
    const aberto = new URLSearchParams(window.location.search).get("fornecedor");
    if (aberto !== id) {
      router.replace(enderecoDoFornecedor(id), { scroll: false });
    }
    router.refresh();
  }

  async function desativar() {
    if (gravandoAgora.current) {
      return;
    }
    gravandoAgora.current = true;
    setDesativando(true);
    setErroDaConfirmacao(null);

    let resposta: Awaited<ReturnType<typeof definirFornecedorAtivo>>;
    try {
      resposta = await definirFornecedorAtivo({ id, ativo: false });
    } catch {
      resposta = { ok: false, erro: FRASE_FALHA_AO_DESATIVAR };
    }

    gravandoAgora.current = false;
    setDesativando(false);

    if (!resposta.ok) {
      setErroDaConfirmacao(resposta.erro);
      return;
    }
    setConfirmando(false);
    toast(TOAST_FORNECEDOR_DESATIVADO);
    manterFichaAberta();
  }

  async function reativar() {
    if (gravandoAgora.current) {
      return;
    }
    gravandoAgora.current = true;
    setReativando(true);
    setErroDeReativar(null);

    let resposta: Awaited<ReturnType<typeof definirFornecedorAtivo>>;
    try {
      resposta = await definirFornecedorAtivo({ id, ativo: true });
    } catch {
      resposta = { ok: false, erro: FRASE_FALHA_AO_REATIVAR };
    }

    gravandoAgora.current = false;
    setReativando(false);

    if (!resposta.ok) {
      setErroDeReativar(resposta.erro);
      return;
    }
    toast(TOAST_FORNECEDOR_REATIVADO);
    router.refresh();
  }

  const ocupado = desativando || reativando;

  return (
    <div className="flex max-w-full flex-col gap-2 sm:max-w-xs" data-testid="fornecedor-acoes">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="fornecedor-editar"
          aria-label={ariaEditar(nome)}
          disabled={ocupado}
          onClick={() => setEditando(true)}
          className="text-corpo min-h-[44px] px-4 font-semibold"
        >
          {ROTULO_EDITAR}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid={ativo ? "fornecedor-desativar" : "fornecedor-reativar"}
          aria-label={ativo ? ariaDesativar(nome) : ariaReativar(nome)}
          disabled={ocupado}
          aria-busy={reativando ? "true" : undefined}
          onClick={() => {
            if (ativo) {
              setErroDaConfirmacao(null);
              setConfirmando(true);
            } else {
              void reativar();
            }
          }}
          className="text-corpo min-h-[44px] px-4 font-semibold"
        >
          {ativo ? ROTULO_DESATIVAR : reativando ? ROTULO_REATIVANDO : ROTULO_REATIVAR}
        </Button>
      </div>

      {erroDeReativar && !ativo ? (
        <p role="alert" data-testid="fornecedor-erro-reativar" className="text-apoio text-erro">
          {erroDeReativar}
        </p>
      ) : null}

      <ConfirmarDesativarFornecedor
        aberto={confirmando}
        nome={nome}
        pendente={desativando}
        erro={erroDaConfirmacao}
        aoConfirmar={() => void desativar()}
        aoVoltar={() => {
          setConfirmando(false);
          setErroDaConfirmacao(null);
        }}
      />

      {editando ? (
        <FolhaFornecedor
          modo="editar"
          inicial={fornecedor}
          acao={(dados) => editarFornecedor({ ...dados, id })}
          aoFechar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
            toast(TOAST_FORNECEDOR_ATUALIZADO);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
