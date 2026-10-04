"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { excluirQueima, registrarQueima } from "@/lib/queimas/acoes";
import type { DadosDaFolha } from "@/lib/queimas/consultas";
import {
  FRASE_FALHA_AO_DESFAZER,
  ROTULO_DESFAZER,
  ROTULO_QUEIMAR,
  TOAST_QUEIMA_DESFEITA,
  TOAST_QUEIMA_DESFEITA_COM_CONTAGEM,
  TOAST_QUEIMA_REGISTRADA,
  rotuloDoTipo,
  toastContagemSalva,
  type TipoDeQueima,
} from "@/lib/queimas/textos";
import { Button } from "@/components/ui/button";

import { FolhaContagem, type QueimaParaContar } from "./folha-contagem";

// Ordem fixa e estável — Biscoito · Esmalte · Ouro — em qualquer largura de tela (04-01-PLAN.md
// Tarefa 3, edge probe FOR-03).
const TIPOS_EM_ORDEM: readonly TipoDeQueima[] = ["biscoito", "esmalte", "ouro"];

export type RegistrarQueimaProps = {
  fornoId: string;
  nomeDoForno: string;
  // `null` = os dados da folha não carregaram: o registro segue como na Fase 4 (só o aviso com
  // "Desfazer"), a folha não abre e a queima cai em "Sem contagem" (UI-D19).
  dadosDaFolha: DadosDaFolha | null;
};

// O aviso do registro, por registro: o `id` do sonner (para ATUALIZAR o aviso no lugar), se ele ainda
// está na tela ("vivo" = não fechou — os callbacks `onAutoClose`/`onDismiss` do sonner o marcam; nenhum
// relógio próprio) e se a contagem foi salva (o "Desfazer" escolhe a frase por isso).
type AvisoDoRegistro = { id: string | number; queimaId: string; vivo: boolean; contada: boolean };

const DURACAO_DO_DESFAZER = 7000;

// D-04, o fluxo mais usado do sistema inteiro: dois toques — "Queimar" no cartão, depois o
// tipo — sem formulário, sem campo, sem confirmação (proibição deste plano). Divergência
// DELIBERADA do análogo `AjusteRapidoEtapa` (`components/amassa/encomendas/ajuste-rapido-etapa.tsx`):
// NADA muda na tela antes da resposta do servidor — a queima existe porque o banco confirmou,
// nunca porque o cliente supôs. O seletor abre imediatamente no primeiro toque, sem nenhum
// indicador de carregamento entre os dois toques (E3/loading, backstop, FOR-01) — só o segundo
// toque (a escrita em si) desabilita os três botões enquanto está pendente.
//
// Fase 06.4 (QMC-01): a folha "O que queimou?" abre DEPOIS da resposta `ok` de `registrarQueima` —
// no mesmo ponto do aviso, só com o id, o tipo e o `ocorridaEm` devolvidos — e não muda os dois
// toques (a ação e o esquema de registrar são os mesmos de antes). O estado da folha mora AQUI e ela
// é renderizada nos dois ramos (botão "Queimar" ou seletor), sem `key` dinâmica: o
// `setSeletorAberto(false)` e o `router.refresh()` logo depois do registro não a desmontam
// (Pitfall 2). O "Desfazer" do aviso continua tocável com a folha aberta e, ao dar certo, fecha a
// folha sem gravar nada (UI-D12).
//
// Plano 02 (UI-D12 item 4): "Salvar" com o aviso do registro ainda vivo ATUALIZA esse aviso no lugar
// (mesmo `id`) para "Contagem salva: …", com o MESMO "Desfazer" e 7 s contados do salvar — nunca um
// segundo aviso empilhado escondendo o primeiro (o WR-01 da 06.3). Aviso já fechado → aviso novo, de
// 5 s, sem ação. O "Desfazer" depois disso apaga a queima e o cascade leva a contagem.
export function RegistrarQueima({ fornoId, nomeDoForno, dadosDaFolha }: RegistrarQueimaProps) {
  const router = useRouter();
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [folha, setFolha] = useState<QueimaParaContar | null>(null);
  const avisoDoRegistro = useRef<AvisoDoRegistro | null>(null);

  async function registrar(tipo: TipoDeQueima) {
    setPendente(true);

    const resposta = await registrarQueima({ fornoId, tipo });

    setPendente(false);
    setSeletorAberto(false);

    if (!resposta.ok) {
      // Nunca perda silenciosa: o contador do cartão permanece no valor anterior porque nada
      // mudou na tela antes desta resposta (fluxo não otimista, de propósito). A tela mostra a
      // frase que o servidor devolveu — inclusive a mensagem humana de chave estrangeira, quando
      // o forno deixou de existir entre o cartão aparecer e o segundo toque.
      toast.error(resposta.erro);
      return;
    }

    const { id, ocorridaEm } = resposta.dados;

    // Os 7 segundos são a única exceção aos 5s do resto do sistema — ali o aviso não é
    // informativo, é uma janela de ação (04-DESIGN-SYSTEM.md §7).
    const aviso: AvisoDoRegistro = { id: 0, queimaId: id, vivo: true, contada: false };
    const morreu = () => {
      aviso.vivo = false;
    };
    aviso.id = toast.success(TOAST_QUEIMA_REGISTRADA, {
      duration: DURACAO_DO_DESFAZER,
      action: {
        label: ROTULO_DESFAZER,
        onClick: () => {
          void desfazer(id, aviso);
        },
      },
      onAutoClose: morreu,
      onDismiss: morreu,
    });
    avisoDoRegistro.current = aviso;

    // Depois da resposta e do aviso, antes do refresh: a folha abre com o que a ação já devolveu —
    // só se os dados dela carregaram (UI-D19).
    if (dadosDaFolha !== null) {
      setFolha({ id, tipo, ocorridaEm });
    }

    router.refresh();
  }

  async function desfazer(idDaQueima: string, aviso: AvisoDoRegistro) {
    aviso.vivo = false;
    const resposta = await excluirQueima(idDaQueima);

    if (!resposta.ok) {
      // A queima permanece registrada — o que a tela mostra é sempre o estado real, nunca um
      // contador otimista órfão.
      toast.error(FRASE_FALHA_AO_DESFAZER);
      return;
    }

    // A queima sumiu: a folha (se aberta) fecha sem gravar nada; com a contagem salva, o cascade da
    // 0030 a levou junto — o aviso diz.
    setFolha(null);
    toast.success(aviso.contada ? TOAST_QUEIMA_DESFEITA_COM_CONTAGEM : TOAST_QUEIMA_DESFEITA);
    router.refresh();
  }

  // A contagem foi salva pela folha aberta logo depois do registro.
  function contagemSalva({ total }: { total: number; criada: boolean }) {
    const aviso = avisoDoRegistro.current;
    if (aviso === null || !aviso.vivo || aviso.queimaId !== folha?.id) {
      toast.success(toastContagemSalva(total));
      return;
    }
    aviso.contada = true;
    const idDaQueima = aviso.queimaId;
    toast.success(toastContagemSalva(total), {
      id: aviso.id,
      duration: DURACAO_DO_DESFAZER,
      action: {
        label: ROTULO_DESFAZER,
        onClick: () => {
          void desfazer(idDaQueima, aviso);
        },
      },
    });
  }

  const folhaDaContagem =
    dadosDaFolha === null ? null : (
      <FolhaContagem
        queima={folha}
        aoFechar={() => setFolha(null)}
        dados={dadosDaFolha}
        nomeDoForno={nomeDoForno}
        aoSalvar={contagemSalva}
      />
    );

  if (!seletorAberto) {
    return (
      <>
        <Button
          type="button"
          variant="default"
          className="min-h-[44px] w-full md:w-auto"
          onClick={() => setSeletorAberto(true)}
        >
          {ROTULO_QUEIMAR}
        </Button>
        {folhaDaContagem}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2" data-testid="seletor-tipo-queima">
        {TIPOS_EM_ORDEM.map((tipo) => (
          <Button
            key={tipo}
            type="button"
            variant="outline"
            disabled={pendente}
            className="min-h-[44px] w-full"
            data-testid={`tipo-queima-${tipo}`}
            onClick={() => {
              void registrar(tipo);
            }}
          >
            {rotuloDoTipo(tipo)}
          </Button>
        ))}

        <button
          type="button"
          disabled={pendente}
          onClick={() => setSeletorAberto(false)}
          className="text-apoio text-muted-foreground hover:text-foreground flex min-h-[44px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {folhaDaContagem}
    </>
  );
}
