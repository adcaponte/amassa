"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";

import { definirItemAtivo } from "@/lib/cadastros/acoes";
import { ROTULO_UNIDADE } from "@/lib/cadastros/catalogo";
import { FRASE_FALHA_AO_SALVAR, textoMaterialDesativado } from "@/lib/cadastros/textos";
import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";
import { salvarMaterial } from "@/lib/estoque/acoes";
import type { ResumoDoMaterial } from "@/lib/estoque/consultas";
import type { CampoDoMaterial } from "@/lib/estoque/esquemas";
import {
  DICA_OBSERVACOES,
  FRASE_FALHA_AO_SALVAR_MATERIAL,
  ROTULO_CAMPOS_DO_CATALOGO,
  ROTULO_CATEGORIA_DA_COMPRA,
  ROTULO_DESATIVAR_MATERIAL,
  ROTULO_ESTOQUE_MINIMO,
  ROTULO_NOME_DO_MATERIAL,
  ROTULO_OBSERVACOES,
  ROTULO_SALVANDO,
  ROTULO_SALVAR_MATERIAL,
  ROTULO_UNIDADE_DO_MATERIAL,
  TITULO_EDITAR_MATERIAL,
  TOAST_MATERIAL_ATUALIZADO,
  dicaEstoqueMinimoEm,
  opcaoCategoriaDaCompra,
} from "@/lib/estoque/textos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmarDesativacao } from "@/components/amassa/cadastros/confirmar-desativacao";

import { formatarMilesimos } from "./cartao-saldo";
import { CLASSE_DA_FOLHA, milesimosParaCampo } from "./folha-movimentacao";

type ErroDoMaterial = { campo: CampoDoMaterial; mensagem: string };

export type FolhaEditarMaterialProps = {
  // O resumo que a folha do material acabou de ler (`lerFolhaDoMaterial`).
  resumo: ResumoDoMaterial;
  aoFechar: () => void;
};

// "Editar material" (UI-SPEC §"Folha Editar material", D-01, EST-02): o Estoque acrescenta ao item
// só o que é dele. Nome, unidade e categoria da compra (com a área) aparecem SÓ para leitura, com o
// caminho para mudar — dois lugares editando o mesmo campo seriam duas verdades. Os campos são o
// estoque mínimo (em {un}, ≥ 0) e as observações (até 500). Nenhum campo de saldo (D-17).
//
// "Desativar material" (à esquerda, `outline`, texto na cor da tinta — é reversível) abre a
// confirmação ÚNICA da fase (`ConfirmarDesativacao`, `substantivo="material"`), com o número de
// movimentações e o saldo que continuam guardados, e chama a ação ÚNICA do Cadastros
// (`definirItemAtivo`, D-20): o Estoque nunca grava `ativo` por conta própria. Insumo de ficha de
// produto ativo é recusado DENTRO do diálogo, com o link para o Catálogo.
export function FolhaEditarMaterial({ resumo, aoFechar }: FolhaEditarMaterialProps) {
  const router = useRouter();
  const [minimoTexto, setMinimoTexto] = useState(milesimosParaCampo(resumo.estoqueMinimoMilesimos));
  const [observacoesTexto, setObservacoesTexto] = useState(resumo.observacoes ?? "");
  const [erro, setErro] = useState<ErroDoMaterial | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [erroDaDesativacao, setErroDaDesativacao] = useState<string | null>(null);
  // Guarda síncrona contra o toque duplo nos dois botões que gravam.
  const emVoo = useRef(false);
  const campos = useRef<Partial<Record<CampoDoMaterial, HTMLElement | null>>>({});

  const unidade = ROTULO_UNIDADE[resumo.unidade];
  const ocupado = salvando || desativando;
  const categoriaTexto = resumo.categoriaCompraNome
    ? opcaoCategoriaDaCompra(resumo.categoriaCompraNome, ROTULO_AREA[resumo.area])
    : ROTULO_AREA[resumo.area];

  function limparErroDe(campo: CampoDoMaterial) {
    setErro((atual) => (atual?.campo === campo ? null : atual));
  }

  async function salvar() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await salvarMaterial({
        itemId: resumo.id,
        minimoTexto,
        observacoesTexto,
      });
      if (!resposta.ok) {
        setErro({ campo: resposta.campo, mensagem: resposta.erro });
        campos.current[resposta.campo]?.focus();
        return;
      }
      toast.success(TOAST_MATERIAL_ATUALIZADO);
      aoFechar();
      router.refresh();
    } catch (falha) {
      console.error("Falha ao salvar material:", falha);
      setErro({ campo: "geral", mensagem: FRASE_FALHA_AO_SALVAR_MATERIAL });
    } finally {
      emVoo.current = false;
      setSalvando(false);
    }
  }

  async function desativar() {
    if (emVoo.current) {
      return;
    }
    emVoo.current = true;
    setDesativando(true);
    setErroDaDesativacao(null);
    try {
      const resposta = await definirItemAtivo({ id: resumo.id, ativo: false });
      if (!resposta.ok) {
        // Insumo de ficha de produto ativo: a frase do Cadastros, DENTRO do diálogo.
        setErroDaDesativacao(resposta.erro);
        return;
      }
      toast.success(textoMaterialDesativado(resposta.dados.nome));
      setConfirmando(false);
      aoFechar();
      router.refresh();
    } catch (falha) {
      console.error("Falha ao desativar material:", falha);
      setErroDaDesativacao(FRASE_FALHA_AO_SALVAR);
    } finally {
      emVoo.current = false;
      setDesativando(false);
    }
  }

  function mensagemDe(campo: CampoDoMaterial) {
    if (erro?.campo !== campo) {
      return null;
    }
    return (
      <p
        id={`editar-material-erro-${campo}`}
        role="alert"
        data-testid="material-erro"
        data-campo={campo}
        className="text-apoio text-erro"
      >
        {erro.mensagem}
      </p>
    );
  }

  function descritoPor(dica: string, campo: CampoDoMaterial) {
    return erro?.campo === campo ? `${dica} editar-material-erro-${campo}` : dica;
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(novoValor) => {
          if (!novoValor && !ocupado && !confirmando) {
            aoFechar();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          data-testid="folha-editar-material"
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            if (window.matchMedia("(min-width: 768px)").matches) {
              campos.current.minimo?.focus();
            }
          }}
          className={CLASSE_DA_FOLHA}
        >
          <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-titulo text-tinta">{TITULO_EDITAR_MATERIAL}</DialogTitle>
              <DialogDescription className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">
                {resumo.nome}
              </DialogDescription>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              disabled={ocupado}
              onClick={aoFechar}
              className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              <X aria-hidden="true" />
            </button>
          </DialogHeader>

          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault();
              void salvar();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
              {/* O que é do Cadastros: só leitura, com o caminho para mudar (D-01). */}
              <div
                data-testid="editar-material-catalogo"
                className="bg-superficie-2 border-borda flex flex-col gap-3 rounded-lg border p-4"
              >
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-apoio text-tinta-fraca">{ROTULO_NOME_DO_MATERIAL}</dt>
                  <dd className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">
                    {resumo.nome}
                  </dd>
                  <dt className="text-apoio text-tinta-fraca">{ROTULO_UNIDADE_DO_MATERIAL}</dt>
                  <dd className="text-corpo text-tinta">{unidade}</dd>
                  <dt className="text-apoio text-tinta-fraca">{ROTULO_CATEGORIA_DA_COMPRA}</dt>
                  <dd className="text-corpo text-tinta [overflow-wrap:anywhere]">{categoriaTexto}</dd>
                </dl>
                <Link
                  href={rotaDeGestao("/cadastros?sub=catalogo")}
                  className="text-apoio text-acento inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                >
                  {ROTULO_CAMPOS_DO_CATALOGO}
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="editar-material-minimo"
                  className="text-corpo text-tinta font-semibold"
                >
                  {ROTULO_ESTOQUE_MINIMO}
                </label>
                <p id="editar-material-minimo-dica" className="text-apoio text-tinta-fraca">
                  {dicaEstoqueMinimoEm(unidade)}
                </p>
                <Input
                  id="editar-material-minimo"
                  ref={(elemento) => {
                    campos.current.minimo = elemento;
                  }}
                  data-testid="editar-material-minimo"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-describedby={descritoPor("editar-material-minimo-dica", "minimo")}
                  aria-invalid={erro?.campo === "minimo"}
                  value={minimoTexto}
                  onChange={(evento) => {
                    setMinimoTexto(evento.target.value);
                    limparErroDe("minimo");
                  }}
                  className="text-corpo md:text-corpo min-h-[44px] tabular-nums"
                />
                {mensagemDe("minimo")}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="editar-material-observacoes"
                  className="text-corpo text-tinta font-semibold"
                >
                  {ROTULO_OBSERVACOES}
                </label>
                <p id="editar-material-observacoes-dica" className="text-apoio text-tinta-fraca">
                  {DICA_OBSERVACOES}
                </p>
                <Textarea
                  id="editar-material-observacoes"
                  ref={(elemento) => {
                    campos.current.observacoes = elemento;
                  }}
                  data-testid="editar-material-observacoes"
                  aria-describedby={descritoPor("editar-material-observacoes-dica", "observacoes")}
                  aria-invalid={erro?.campo === "observacoes"}
                  value={observacoesTexto}
                  onChange={(evento) => {
                    setObservacoesTexto(evento.target.value);
                    limparErroDe("observacoes");
                  }}
                  className="text-corpo md:text-corpo min-h-[88px]"
                />
                {mensagemDe("observacoes")}
              </div>
            </div>

            {/* Rodapé preso por flex: "Desativar material" à esquerda · "Salvar material". */}
            <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
              {mensagemDe("geral")}
              <div className="flex gap-2">
                {resumo.ativo ? (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="editar-material-desativar"
                    disabled={ocupado}
                    onClick={() => {
                      setErroDaDesativacao(null);
                      setConfirmando(true);
                    }}
                    className="text-corpo text-tinta h-auto min-h-[52px] max-w-[45%] min-w-0 shrink px-4 font-semibold leading-tight whitespace-normal"
                  >
                    {ROTULO_DESATIVAR_MATERIAL}
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  data-testid="editar-material-salvar"
                  disabled={ocupado}
                  aria-busy={salvando ? "true" : undefined}
                  className="text-corpo h-auto min-h-[52px] flex-1 px-4 font-semibold leading-tight whitespace-normal"
                >
                  {salvando ? ROTULO_SALVANDO : ROTULO_SALVAR_MATERIAL}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmarDesativacao
        aberto={confirmando}
        substantivo="material"
        nome={resumo.nome}
        movimentacoes={resumo.movimentacoes}
        saldoTexto={
          resumo.movimentacoes > 0 ? `${formatarMilesimos(resumo.saldoMilesimos)} ${unidade}` : null
        }
        pendente={desativando}
        erro={erroDaDesativacao}
        aoConfirmar={() => void desativar()}
        aoVoltar={() => {
          setConfirmando(false);
          setErroDaDesativacao(null);
        }}
      />
    </>
  );
}
