"use client";

import { useState, type ChangeEvent } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  anexarFotoDeOrcamento,
  definirLegendaDaFoto,
  removerFotoDeOrcamento,
} from "@/lib/orcamentos/acoes";
import type { FotoDoOrcamento } from "@/lib/orcamentos/consultas";
import {
  CORPO_CONFIRMAR_REMOVER_FOTO,
  FRASE_ARQUIVO_MUITO_GRANDE,
  FRASE_ARQUIVO_NAO_E_IMAGEM,
  FRASE_LIMITE_DE_FOTOS,
  FRASE_VAZIO_FOTOS,
  PLACEHOLDER_LEGENDA_FOTO,
  ROTULO_ENVIANDO_FOTO,
  ROTULO_MAIS_FOTO_DE_REFERENCIA,
  ROTULO_TENTAR_DE_NOVO,
  ROTULO_TIRAR,
  TITULO_CONFIRMAR_REMOVER_FOTO,
  TOAST_FOTO_ANEXADA,
  TOAST_FOTO_REMOVIDA,
  rotuloContagemDeFotos,
  rotuloReferenciaGenerica,
} from "@/lib/orcamentos/textos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export type FotosDeReferenciaProps = {
  orcamentoId: string;
  // `false` fora de rascunho — a mesma disciplina de "congelamento visual" do resto do editor
  // (`LinhaDeOrcamento`/`CustosDoProjeto`): sem botão de upload, sem legenda editável, sem
  // "tirar". Fotos não fazem parte do que "Marcar como enviado" trava no banco (04.5-UI-SPEC.md,
  // ponto 8) — é só a TELA que deixa de oferecer edição fora de rascunho.
  vivo: boolean;
  fotosIniciais: FotoDoOrcamento[];
};

const LIMITE_DE_FOTOS = 3;

// Frases que significam "o ARQUIVO em si é o problema" (D-26: tipo real inválido ou tamanho
// acima do teto) — a célula de espera SOME e a mensagem aparece junto do botão; a tentativa
// falhada nunca ocupa uma das 3 vagas (04.5-UI-SPEC.md, ponto 5). Qualquer OUTRO erro (rede,
// servidor, limite atingido entre o clique e a resposta) vira uma célula de erro PRÓPRIA, com
// "Tentar de novo" reenviando o MESMO arquivo (ponto 6) — as duas mensagens distintas que o
// Copywriting da fase nomeia.
const ERROS_DE_ARQUIVO_INVALIDO: ReadonlySet<string> = new Set([
  FRASE_ARQUIVO_NAO_E_IMAGEM,
  FRASE_ARQUIVO_MUITO_GRANDE,
]);

type CelulaPronta = { status: "pronta"; id: string; legenda: string | null };
type CelulaEnviando = { status: "enviando"; chave: string; arquivo: File };
type CelulaComErro = { status: "erro"; chave: string; arquivo: File; mensagem: string };
type Celula = CelulaPronta | CelulaEnviando | CelulaComErro;

function chaveLocalUnica(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// A grade de fotos do editor do orçamento (04.5-UI-SPEC.md §"Upload de fotos de referência") —
// Client Component porque precisa de estado de envio POR CÉLULA (nenhum analógo no resto do
// projeto: é o primeiro upload de arquivo da plataforma). Nunca navega de página (sem
// `router.push`/`router.refresh`, sem `window.location.assign`) — mesma disciplina de
// `components/amassa/cadastros/valor-conta-fixa.tsx` para uma edição de valor isolado: anexar,
// legendar e remover uma foto não mudam nenhum total do orçamento, então um `toast` local é
// suficiente, sem recarregar a tela inteira.
export function FotosDeReferencia({ orcamentoId, vivo, fotosIniciais }: FotosDeReferenciaProps) {
  const [celulas, setCelulas] = useState<Celula[]>(
    fotosIniciais.map((foto) => ({ status: "pronta" as const, id: foto.id, legenda: foto.legenda })),
  );
  const [erroDeArquivo, setErroDeArquivo] = useState<string | null>(null);

  // Conta "pronta" e "enviando" como vaga ocupada — um upload em andamento já reserva o lugar
  // que vai virar a foto definitiva (04.5-UI-SPEC.md, ponto 2). Uma célula "erro" NÃO ocupa
  // vaga: a tentativa não chegou a ser anexada de verdade, e a ação do servidor é quem decide o
  // limite de qualquer forma no "Tentar de novo".
  const vagasOcupadas = celulas.filter((celula) => celula.status !== "erro").length;
  const podeAdicionar = vivo && vagasOcupadas < LIMITE_DE_FOTOS;

  async function enviar(chave: string, arquivo: File) {
    const formData = new FormData();
    formData.set("orcamentoId", orcamentoId);
    formData.set("arquivo", arquivo);

    const resposta = await anexarFotoDeOrcamento(formData);

    if (!resposta.ok) {
      if (ERROS_DE_ARQUIVO_INVALIDO.has(resposta.erro)) {
        setCelulas((atual) => atual.filter((celula) => !("chave" in celula) || celula.chave !== chave));
        setErroDeArquivo(resposta.erro);
        return;
      }
      setCelulas((atual) =>
        atual.map((celula) =>
          "chave" in celula && celula.chave === chave
            ? { status: "erro", chave, arquivo, mensagem: resposta.erro }
            : celula,
        ),
      );
      return;
    }

    setCelulas((atual) =>
      atual.map((celula) =>
        "chave" in celula && celula.chave === chave
          ? { status: "pronta", id: resposta.dados.id, legenda: resposta.dados.legenda }
          : celula,
      ),
    );
    toast.success(TOAST_FOTO_ANEXADA);
  }

  function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Limpa o valor do input SEMPRE — é o que permite escolher o MESMO arquivo de novo se o
    // dono cancelar e tentar outra vez (o navegador não dispara `change` para o mesmo arquivo
    // duas vezes seguidas sem isto).
    evento.target.value = "";
    if (!arquivo) {
      return;
    }

    setErroDeArquivo(null);
    const chave = chaveLocalUnica();
    setCelulas((atual) => [...atual, { status: "enviando", chave, arquivo }]);
    void enviar(chave, arquivo);
  }

  function tentarDeNovo(chave: string, arquivo: File) {
    setCelulas((atual) =>
      atual.map((celula) => (celula.status === "erro" && celula.chave === chave ? { status: "enviando", chave, arquivo } : celula)),
    );
    void enviar(chave, arquivo);
  }

  function aoRemover(id: string) {
    setCelulas((atual) => atual.filter((celula) => !(celula.status === "pronta" && celula.id === id)));
    toast.success(TOAST_FOTO_REMOVIDA);
  }

  const semNenhumaFoto = celulas.length === 0;
  let numeroDaProximaPronta = 0;

  return (
    <div className="flex flex-col gap-2">
      {!vivo && semNenhumaFoto ? (
        <p className="text-apoio text-muted-foreground">{FRASE_VAZIO_FOTOS}</p>
      ) : (
        <div
          data-testid="fotos-grade"
          className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5"
        >
          {celulas.map((celula) => {
            if (celula.status === "enviando") {
              return (
                <div
                  key={celula.chave}
                  data-testid="foto-celula"
                  className="bg-superficie-2 flex aspect-square flex-col items-center justify-center gap-1 rounded-md p-1 text-center"
                >
                  <div data-testid="foto-enviando" className="flex flex-col items-center gap-1">
                    <Loader2 aria-hidden="true" className="text-muted-foreground size-5 animate-spin" />
                    <span className="text-micro text-muted-foreground">{ROTULO_ENVIANDO_FOTO}</span>
                  </div>
                </div>
              );
            }

            if (celula.status === "erro") {
              return (
                <div
                  key={celula.chave}
                  data-testid="foto-celula"
                  className="bg-erro-fundo flex aspect-square flex-col items-center justify-center gap-1 rounded-md p-1 text-center"
                >
                  <div data-testid="foto-erro" className="flex flex-col items-center gap-1">
                    <TriangleAlert aria-hidden="true" className="text-erro size-5" />
                    <span className="text-micro text-erro">{celula.mensagem}</span>
                    <button
                      type="button"
                      onClick={() => tentarDeNovo(celula.chave, celula.arquivo)}
                      className="text-micro text-erro min-h-[24px] underline"
                    >
                      {ROTULO_TENTAR_DE_NOVO}
                    </button>
                  </div>
                </div>
              );
            }

            numeroDaProximaPronta += 1;
            return (
              <CelulaDeFotoExistente
                key={celula.id}
                orcamentoId={orcamentoId}
                vivo={vivo}
                foto={celula}
                numero={numeroDaProximaPronta}
                aoRemover={aoRemover}
              />
            );
          })}
        </div>
      )}

      {podeAdicionar ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* Mesma técnica `.arq` do protótipo: um botão puramente visual com o `<input
              type="file">` nativo sobreposto e transparente — o sistema operacional do celular
              continua oferecendo Câmera ou Galeria à escolha do dono, sem uma segunda tela
              nossa no meio. */}
          <span className="relative inline-flex min-h-[44px] items-center overflow-hidden rounded-md">
            <Button type="button" variant="outline" className="pointer-events-none min-h-[44px]">
              {ROTULO_MAIS_FOTO_DE_REFERENCIA}
            </Button>
            <input
              type="file"
              accept="image/*"
              aria-label="adicionar foto de referência"
              onChange={aoEscolherArquivo}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </span>
          <span data-testid="fotos-contagem" className="text-apoio text-muted-foreground">
            {rotuloContagemDeFotos(vagasOcupadas)}
          </span>
        </div>
      ) : vivo ? (
        <p data-testid="fotos-limite" className="text-apoio text-muted-foreground">
          {FRASE_LIMITE_DE_FOTOS}
        </p>
      ) : null}

      {erroDeArquivo ? (
        <p role="alert" className="text-apoio text-destructive">
          {erroDeArquivo}
        </p>
      ) : null}
    </div>
  );
}

type CelulaDeFotoExistenteProps = {
  orcamentoId: string;
  vivo: boolean;
  foto: { id: string; legenda: string | null };
  numero: number;
  aoRemover: (id: string) => void;
};

// Uma foto JÁ GRAVADA (Client Component POR FOTO, mesma disciplina de "diálogo/estado montado
// por linha" já usada em `LinhaDeOrcamento`/`ConfirmarApagarPeca") — cada instância tem seu
// próprio campo de legenda e seu próprio diálogo de confirmação de remoção.
function CelulaDeFotoExistente({ orcamentoId, vivo, foto, numero, aoRemover }: CelulaDeFotoExistenteProps) {
  const [legendaTexto, setLegendaTexto] = useState(foto.legenda ?? "");
  const [erroDeLegenda, setErroDeLegenda] = useState<string | null>(null);
  const [confirmandoTirar, setConfirmandoTirar] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  async function salvarLegendaSeMudou() {
    if (legendaTexto.trim() === (foto.legenda ?? "").trim()) {
      return;
    }
    setErroDeLegenda(null);
    const resposta = await definirLegendaDaFoto({ orcamentoId, id: foto.id, legendaTexto });
    if (!resposta.ok) {
      setErroDeLegenda(resposta.erro);
    }
  }

  async function confirmarTirar(evento: { preventDefault: () => void }) {
    // Radix fecha o AlertDialog sozinho ao clicar em Action, a menos que `preventDefault()` seja
    // chamado — é isso que impede o diálogo de fechar antes da resposta do servidor (mesma
    // disciplina de `LinhaDeOrcamento`/`ConfirmarApagarPeca`).
    evento.preventDefault();
    setRemovendo(true);

    const resposta = await removerFotoDeOrcamento({ orcamentoId, id: foto.id });

    setRemovendo(false);

    if (!resposta.ok) {
      toast.error(resposta.erro);
      return;
    }

    setConfirmandoTirar(false);
    aoRemover(foto.id);
  }

  const legendaAtual = foto.legenda?.trim() ? foto.legenda : null;
  const textoAlternativo = legendaAtual ?? rotuloReferenciaGenerica(numero);

  return (
    <figure data-testid="foto-celula" className="m-0 flex flex-col gap-1">
      {/* `<img>` puro, de propósito: o arquivo servido por `/api/orcamentos/fotos/[id]` JÁ
          passou pelo pipeline de `lib/orcamentos/fotos.ts` (no máximo 1600px, JPEG qualidade
          82) — o otimizador do `next/image` reprocessaria uma imagem autenticada que já está
          no tamanho certo, sem ganho, e exigiria configuração extra para uma rota que não é um
          arquivo estático. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/orcamentos/fotos/${foto.id}`}
        alt={textoAlternativo}
        className="border-border aspect-square w-full rounded-md border object-cover"
      />

      {vivo ? (
        <>
          <input
            value={legendaTexto}
            placeholder={PLACEHOLDER_LEGENDA_FOTO}
            onChange={(evento) => setLegendaTexto(evento.target.value)}
            onBlur={() => void salvarLegendaSeMudou()}
            className="border-border text-corpo min-h-[40px] rounded-md border px-2 text-base"
          />
          {erroDeLegenda ? (
            <p role="alert" className="text-micro text-destructive">
              {erroDeLegenda}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="foto-tirar"
            onClick={() => setConfirmandoTirar(true)}
            className="text-apoio text-destructive hover:bg-destructive/10 flex min-h-[44px] items-center justify-center rounded-md underline"
          >
            {ROTULO_TIRAR}
          </button>
        </>
      ) : legendaAtual ? (
        <figcaption className="text-apoio text-muted-foreground">{legendaAtual}</figcaption>
      ) : null}

      <AlertDialog
        open={confirmandoTirar}
        onOpenChange={(novoValor) => {
          if (!removendo) {
            setConfirmandoTirar(novoValor);
          }
        }}
      >
        <AlertDialogContent data-testid="dialogo-remover-foto" className="max-h-[85svh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{TITULO_CONFIRMAR_REMOVER_FOTO}</AlertDialogTitle>
            <AlertDialogDescription>{CORPO_CONFIRMAR_REMOVER_FOTO}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={removendo} onClick={confirmarTirar}>
              {removendo ? "Removendo…" : ROTULO_TIRAR}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </figure>
  );
}
