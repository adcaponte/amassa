"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { removerAnexo } from "@/lib/fornecedores/acoes";
import { ehAbertoNaAba } from "@/lib/fornecedores/cabecalhos";
import type { EfeitoDeTirar } from "@/lib/fornecedores/tabela-vigente";
import {
  FRASE_ANEXO_JA_TIRADO,
  FRASE_DESATIVADO_SEM_ENVIO,
  FRASE_FALHA_AO_TIRAR,
  FRASE_SEM_ANEXOS,
  ROTULO_ABRIR_ANEXO,
  ROTULO_BAIXAR_ANEXO,
  ROTULO_NOVO_ANEXO,
  ROTULO_TIRAR,
  SELO_VIGENTE,
  TITULO_ANEXOS,
  TOAST_ANEXO_REMOVIDO,
  ariaAbrirAnexo,
  ariaBaixarAnexo,
  ariaTirarAnexo,
  toastAnexoGuardado,
} from "@/lib/fornecedores/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { ConfirmarTirarAnexo } from "./confirmar-tirar-anexo";
import { FolhaAnexo } from "./folha-anexo";

// Um anexo como a linha o desenha — tudo já formatado pela ficha (Server Component): a 2ª linha chega
// em duas partes, o rótulo do tipo e o resto (" · vale desde … · {EXT} · {tamanho} · {quem},
// {dd/mm/aa}"), para o selo "vigente" entrar entre as duas; sem `Date` atravessando para o cliente. O
// caminho no disco nunca vem: o link é a rota, pelo id. `vigente` e `efeito` (o que muda ao tirar) vêm
// dos módulos puros de `lib/fornecedores/tabela-vigente.ts`, calculados no servidor.
export type AnexoNaFicha = {
  id: string;
  nome: string;
  extensao: string;
  tipoRotulo: string;
  restoDaMeta: string;
  nota: string | null;
  tamanho: string;
  vigente: boolean;
  efeito: EfeitoDeTirar;
};

// O selo "vigente" (neutro, `tinta-fraca` sobre `superficie-2`, 5,12:1): a borda dourada da linha é
// decorativa (ouro sobre branco 2,94:1), então o texto é a pista que não depende de cor (UI-D19).
const CLASSE_DO_SELO_VIGENTE =
  "text-apoio bg-superficie-2 text-tinta-fraca inline-flex items-center rounded-full px-2 py-1 font-semibold";

// O "tirar" da linha: botão de texto em `--color-erro` (6,47:1 sobre `superficie`), 44 px.
const CLASSE_DO_TIRAR =
  "text-corpo text-erro focus-visible:ring-ring inline-flex min-h-[44px] items-center px-2 font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none";

// O tile 44×44 por família (06.2-UI-SPEC.md §Color, "Tiles de tipo de anexo"): a cor é decorativa — a
// extensão está escrita no tile e de novo na linha de meta. Texto branco Apoio 600 (pares F1–F3).
function corDoTile(extensao: string): string {
  if (extensao === "pdf") {
    return "bg-queima1";
  }
  if (extensao === "jpg") {
    return "bg-esmaltacao";
  }
  if (extensao === "xlsx" || extensao === "xls" || extensao === "csv") {
    return "bg-entrega";
  }
  return "bg-tinta-fraca";
}

// A seção de anexos da ficha (06.2-UI-SPEC.md §"Bloco Ficha", item 6; FRN-06, FRN-09, UI-D6, UI-D9,
// UI-D24): "ANEXOS · {n}" + "Novo anexo" (`outline` — o terracota da tela é o "Novo fornecedor") ou,
// com o fornecedor desativado, a frase no lugar do botão; o vazio; e a lista, do mais recente ao mais
// antigo (a ordem vem de `anexosDoFornecedor`).
//
// Plano 08: a linha da tabela vigente ganha a borda esquerda de 4 px `ouro` E o selo "vigente" (UI-D19);
// cada linha ganha "tirar", que abre a confirmação (`ConfirmarTirarAnexo`) — o único "apagar" do
// módulo, que também vale para fornecedor desativado (UI-D24). Depois de tirar: a confirmação fecha, a
// ficha se atualiza (`router.refresh`, sem recarregar a página) e o toast "Anexo removido." aparece; se
// outra aba já tinha tirado, a frase própria vira o toast. A falha fica DENTRO do diálogo, aberto.
//
// Cada linha: grade `44px 1fr auto`; abaixo de 400 px as ações descem para baixo do texto
// (`grid-cols-[44px_1fr]` + ações em `col-span-2`) — nunca espremem o nome, que quebra livre. "Abrir"
// (PDF e foto, aba nova, `rel="noopener"` — T-06.2-51) ou "Baixar" (planilha, sem `target`): um `<a>`
// para a rota sob `/gestao/api/`, atrás da sessão — nenhum anexo tem URL pública.
export function AnexosFornecedor({
  fornecedorId,
  fornecedorNome,
  ativo,
  hoje,
  anexos,
}: {
  fornecedorId: string;
  fornecedorNome: string;
  ativo: boolean;
  hoje: string;
  anexos: AnexoNaFicha[];
}) {
  const router = useRouter();
  const [folhaAberta, setFolhaAberta] = useState(false);
  // O anexo da confirmação de tirar: continua aqui enquanto o diálogo fecha (sem diálogo vazio).
  const [alvo, setAlvo] = useState<AnexoNaFicha | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [tirando, setTirando] = useState(false);
  const [erroDeTirar, setErroDeTirar] = useState<string | null>(null);
  // Guarda síncrona: um toque duplo em "Tirar anexo" chama a ação UMA vez.
  const tirandoAgora = useRef(false);

  function pedirParaTirar(anexo: AnexoNaFicha) {
    setAlvo(anexo);
    setErroDeTirar(null);
    setConfirmando(true);
  }

  async function tirar() {
    if (tirandoAgora.current || alvo === null) {
      return;
    }
    tirandoAgora.current = true;
    setTirando(true);
    setErroDeTirar(null);

    let resposta: Awaited<ReturnType<typeof removerAnexo>>;
    try {
      resposta = await removerAnexo({ id: alvo.id });
    } catch {
      resposta = { ok: false, erro: FRASE_FALHA_AO_TIRAR };
    }

    tirandoAgora.current = false;
    setTirando(false);

    if (!resposta.ok) {
      setErroDeTirar(resposta.erro);
      return;
    }
    setConfirmando(false);
    router.refresh();
    toast(resposta.dados.jaTirado ? FRASE_ANEXO_JA_TIRADO : TOAST_ANEXO_REMOVIDO);
  }

  function aoGuardar() {
    setFolhaAberta(false);
    router.refresh();
    toast(toastAnexoGuardado(fornecedorNome));
  }

  return (
    <section aria-labelledby="ficha-fornecedor-anexos" data-testid="fornecedor-anexos" className="flex flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 id="ficha-fornecedor-anexos" className="text-apoio text-tinta-media font-semibold tracking-[0.06em]">
          <span className="uppercase">{TITULO_ANEXOS}</span>
          <span className="font-normal tabular-nums" data-testid="fornecedor-anexos-contagem">
            {" "}
            · {anexos.length}
          </span>
        </h3>
        {ativo ? (
          <Button
            type="button"
            variant="outline"
            data-testid="fornecedor-novo-anexo"
            onClick={() => setFolhaAberta(true)}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
          >
            <Plus aria-hidden="true" />
            {ROTULO_NOVO_ANEXO}
          </Button>
        ) : (
          <p data-testid="fornecedor-anexo-desativado" className="text-apoio text-tinta-fraca">
            {FRASE_DESATIVADO_SEM_ENVIO}
          </p>
        )}
      </div>

      {anexos.length === 0 ? (
        <p data-testid="fornecedor-sem-anexos" className="text-corpo text-tinta-fraca">
          {FRASE_SEM_ANEXOS}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {anexos.map((anexo) => {
            const naAba = ehAbertoNaAba(anexo.extensao);
            const endereco = rotaDeGestao(`/api/fornecedores/anexos/${anexo.id}`);
            return (
              <li
                key={anexo.id}
                data-testid="anexo-linha"
                data-anexo-id={anexo.id}
                data-vigente={anexo.vigente ? "true" : undefined}
                className={cn(
                  "border-borda grid grid-cols-[44px_1fr_auto] items-center gap-2 rounded-lg border p-2 max-[399px]:grid-cols-[44px_1fr]",
                  anexo.vigente && "border-l-ouro border-l-4",
                )}
              >
                <span
                  aria-hidden="true"
                  data-testid="anexo-tile"
                  className={cn(
                    "text-apoio flex size-11 items-center justify-center self-start rounded-md font-semibold text-white",
                    corDoTile(anexo.extensao),
                  )}
                >
                  {anexo.extensao.toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">{anexo.nome}</p>
                  <p className="text-apoio text-tinta-fraca tabular-nums [overflow-wrap:anywhere]" data-testid="anexo-meta">
                    {anexo.tipoRotulo}
                    {anexo.vigente ? (
                      <>
                        {" · "}
                        <span data-testid="anexo-selo-vigente" className={CLASSE_DO_SELO_VIGENTE}>
                          {SELO_VIGENTE}
                        </span>
                      </>
                    ) : null}
                    {anexo.restoDaMeta}
                  </p>
                  {anexo.nota ? (
                    <p className="text-apoio text-tinta-media [overflow-wrap:anywhere]">{anexo.nota}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2 max-[399px]:col-span-2">
                  <Button asChild variant="outline" className="text-corpo h-auto min-h-[44px] px-4 font-semibold">
                    {naAba ? (
                      <a
                        href={endereco}
                        target="_blank"
                        rel="noopener"
                        aria-label={ariaAbrirAnexo(anexo.nome)}
                        data-testid="anexo-abrir"
                      >
                        {ROTULO_ABRIR_ANEXO}
                      </a>
                    ) : (
                      <a href={endereco} aria-label={ariaBaixarAnexo(anexo.nome)} data-testid="anexo-baixar">
                        {ROTULO_BAIXAR_ANEXO}
                      </a>
                    )}
                  </Button>
                  <button
                    type="button"
                    aria-label={ariaTirarAnexo(anexo.nome)}
                    data-testid="anexo-tirar"
                    onClick={() => pedirParaTirar(anexo)}
                    className={CLASSE_DO_TIRAR}
                  >
                    {ROTULO_TIRAR}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmarTirarAnexo
        aberto={confirmando}
        anexo={alvo}
        pendente={tirando}
        erro={erroDeTirar}
        aoConfirmar={() => void tirar()}
        aoVoltar={() => setConfirmando(false)}
      />

      {folhaAberta ? (
        <FolhaAnexo
          fornecedorId={fornecedorId}
          hoje={hoje}
          aoFechar={() => setFolhaAberta(false)}
          aoGuardar={aoGuardar}
        />
      ) : null}
    </section>
  );
}
