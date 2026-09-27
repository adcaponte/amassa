"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { acrescentarLinha } from "@/lib/orcamentos/acoes";
import { criarFicha, editarFicha } from "@/lib/precificacao/acoes";
import { hrefDaAbaPecas } from "@/lib/precificacao/navegacao";
import { calcularPeca, farolDoPreco, type ParametrosDoCalculo } from "@/lib/precificacao/calculo";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import type { CategoriaDeVenda, FichaParaCopiar, FichaParaEdicao } from "@/lib/precificacao/consultas";
import {
  converterContagemDaFicha,
  converterMedidaDaFicha,
} from "@/lib/precificacao/esquemas";
import {
  camposCopiaveisDaFicha,
  paraContagemInformada,
  paraFichaDeCalculo,
  paraMedidasDaPeca,
  resultadoDaFicha,
  validarFicha,
  type FichaEmEdicao,
} from "@/lib/precificacao/ficha";
import { quantasCabem, type MedidasUteisDoForno } from "@/lib/precificacao/forno";
import {
  ROTULO_ALTURA,
  ROTULO_APAGAR_PECA,
  ROTULO_ARGILA,
  ROTULO_CABEM_BISCOITO,
  ROTULO_CABEM_ESMALTE,
  ROTULO_CANCELAR,
  ROTULO_CATEGORIA_DE_VENDA_FICHA,
  ROTULO_COMECAR_A_PARTIR_DE,
  ROTULO_DO_ZERO,
  ROTULO_EMBALAGEM,
  ROTULO_ESMALTE,
  ROTULO_EXCLUSIVA,
  ROTULO_HORAS_DE_TRABALHO,
  ROTULO_LARGURA,
  ROTULO_NOME_DA_PECA,
  ROTULO_PRECO_MERCADO,
  ROTULO_PRECO_PRATICADO,
  ROTULO_PROFUNDIDADE,
  ROTULO_SALVAR_FICHA,
  TITULO_DIALOGO_FICHA_EDITAR,
  TITULO_DIALOGO_FICHA_NOVA,
} from "@/lib/precificacao/textos";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ResultadoDaFicha } from "./resultado-da-ficha";

export type DialogoFichaProps = {
  // `null` = fechado; `"novo"` = criar do zero; a ficha carregada = editar (D-18: o campo de
  // preço já vem com o preço EFETIVO — o do item quando de linha, o da própria ficha quando
  // exclusiva — `obterFichaParaEdicao` resolve isso, nunca o diálogo).
  abrirComo: "novo" | FichaParaEdicao | null;
  categoriasDeVenda: readonly CategoriaDeVenda[];
  // Só usado no modo de CRIAÇÃO ("Começar a partir de uma peça parecida", D-19) — já vem com os
  // campos copiáveis prontos (lib/precificacao/consultas.ts::listarFichasParaCopiar), nenhuma
  // consulta nova ao trocar o `<select>`.
  fichasParaCopiar: readonly FichaParaCopiar[];
  parametros: ParametrosDoCalculo;
  forno: MedidasUteisDoForno;
  taxaCartaoPontosBase: number;
  // Presente quando o diálogo foi aberto de DENTRO do editor de um orçamento (04.5-06-PLAN.md,
  // "+ Peça exclusiva deste pedido" / "ver cálculo") — muda para onde "Cancelar"/"Salvar" voltam,
  // e faz "Salvar" (só na CRIAÇÃO) acrescentar a peça recém-criada ao orçamento na mesma ida (um
  // caminho só, nenhuma segunda busca). `null`/ausente = comportamento de sempre (aba Peças).
  vindoDoOrcamentoId?: string | null;
};

// Radix não aceita `value=""` num `SelectItem` (reservado para "nenhuma seleção") — sentinela não
// vazia para "— do zero —", nunca confundível com um id de ficha de verdade (UUID).
const SENTINELA_DO_ZERO = "__do-zero__";

type CamposDeTexto = {
  nome: string;
  argilaTexto: string;
  esmalteTexto: string;
  horasTexto: string;
  larguraTexto: string;
  profundidadeTexto: string;
  alturaTexto: string;
  embalagemTexto: string;
  precoPraticadoTexto: string;
  precoMercadoTexto: string;
  cabemBiscoitoTexto: string;
  cabemEsmalteTexto: string;
};

const CAMPOS_EM_BRANCO: CamposDeTexto = {
  nome: "",
  argilaTexto: "",
  esmalteTexto: "",
  horasTexto: "",
  larguraTexto: "",
  profundidadeTexto: "",
  alturaTexto: "",
  embalagemTexto: "",
  precoPraticadoTexto: "",
  precoMercadoTexto: "",
  cabemBiscoitoTexto: "",
  cabemEsmalteTexto: "",
};

// "450 000 mg" → "450"; aceita zero. Inverso de `converterMedidaDaFicha`
// (lib/precificacao/esquemas.ts) para preencher o formulário ao abrir para edição.
function textoDeMedida(valorInteiro: number, escala: number): string {
  if (valorInteiro === 0) {
    return "";
  }
  return String(valorInteiro / escala).replace(".", ",");
}

// "350" centavos → "3,50". Mesma técnica de
// `components/amassa/cadastros/dialogo-item-catalogo.tsx` para o campo de preço.
function textoDeCentavos(valorCentavos: number | null): string {
  if (valorCentavos === null) {
    return "";
  }
  return (valorCentavos / 100).toFixed(2).replace(".", ",");
}

function camposDeTextoDaFicha(ficha: FichaParaEdicao): CamposDeTexto {
  return {
    nome: ficha.nome,
    argilaTexto: textoDeMedida(ficha.argilaMiligramas, 1000),
    esmalteTexto: textoDeMedida(ficha.esmalteMiligramas, 1000),
    horasTexto: textoDeMedida(ficha.horasMilesimos, 1000),
    larguraTexto: textoDeMedida(ficha.larguraMm, 10),
    profundidadeTexto: textoDeMedida(ficha.profundidadeMm, 10),
    alturaTexto: textoDeMedida(ficha.alturaMm, 10),
    embalagemTexto: textoDeCentavos(ficha.embalagemCentavos),
    precoPraticadoTexto: textoDeCentavos(ficha.precoPraticadoEfetivoCentavos),
    precoMercadoTexto: textoDeCentavos(ficha.precoMercadoCentavos),
    cabemBiscoitoTexto: ficha.cabemBiscoitoInformado !== null ? String(ficha.cabemBiscoitoInformado) : "",
    cabemEsmalteTexto: ficha.cabemEsmalteInformado !== null ? String(ficha.cabemEsmalteInformado) : "",
  };
}

// Junta as categorias ATIVAS com a categoria ATUAL da ficha, mesmo desativada — mesma técnica de
// `dialogo-item-catalogo.tsx::opcoesComAtual` (a opção atual nunca some do formulário).
function opcoesDeCategoria(
  ativas: readonly CategoriaDeVenda[],
  atual: { id: string; nome: string | null } | null,
): CategoriaDeVenda[] {
  if (!atual || ativas.some((categoria) => categoria.id === atual.id)) {
    return [...ativas];
  }
  return [...ativas, { id: atual.id, nome: atual.nome ?? "—" }];
}

// O diálogo único da ficha de peça (04.5-04-PLAN.md) — os 12 campos do protótipo mais a categoria
// de venda (D-18) e a caixa "exclusiva" (D-19), com o resultado recalculado AO VIVO a cada tecla
// chamando `calcularPeca`/`quantasCabem`/`farolDoPreco` diretamente (as MESMAS funções que
// qualquer servidor chamaria) — nunca uma segunda fórmula escrita aqui.
export function DialogoFicha({
  abrirComo,
  categoriasDeVenda,
  fichasParaCopiar,
  parametros,
  forno,
  taxaCartaoPontosBase,
  vindoDoOrcamentoId = null,
}: DialogoFichaProps) {
  const aberto = abrirComo !== null;
  const modoEdicao = abrirComo !== null && abrirComo !== "novo";
  // Só para PRESERVAR o filtro da lista ao navegar daqui de volta (fechar) ou para a confirmação
  // de exclusão — o diálogo em si nunca decide o que a lista mostra (mesma leitura que
  // `ConfirmarApagarPeca` já faz).
  const mostrandoExclusivas = useSearchParams().get("exclusivas") === "1";

  // Fechar é sempre navegação COMPLETA — para o editor do orçamento que abriu este diálogo,
  // quando existir; para a aba Peças, do contrário. Este componente é montado direto pela página
  // (Server Component), então não recebe um `onFechar` de fora: nenhuma função cruza a fronteira
  // servidor→cliente.
  const urlDeVolta = vindoDoOrcamentoId
    ? `/financeiro?aba=orcamentos&orcamento=${vindoDoOrcamentoId}`
    : hrefDaAbaPecas({ mostrarExclusivas: mostrandoExclusivas });
  function fechar() {
    window.location.assign(urlDeVolta);
  }
  const fichaParaEditar = modoEdicao ? (abrirComo as FichaParaEdicao) : null;

  const [campos, setCampos] = useState<CamposDeTexto>(CAMPOS_EM_BRANCO);
  const [exclusiva, setExclusiva] = useState(false);
  const [categoriaVendaId, setCategoriaVendaId] = useState<string | null>(null);
  const [idParaCopiar, setIdParaCopiar] = useState(SENTINELA_DO_ZERO);
  const [erroDoServidor, setErroDoServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputNomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) {
      return;
    }
    if (fichaParaEditar) {
      setCampos(camposDeTextoDaFicha(fichaParaEditar));
      setExclusiva(fichaParaEditar.exclusiva);
      setCategoriaVendaId(fichaParaEditar.categoriaVendaId);
    } else {
      setCampos(CAMPOS_EM_BRANCO);
      // "+ Peça exclusiva deste pedido" (must_have): a ficha nasce já marcada como exclusiva —
      // o dono ainda pode desmarcar se preferir uma peça de linha, mas o padrão poupa um toque.
      setExclusiva(vindoDoOrcamentoId !== null);
      setCategoriaVendaId(null);
      setIdParaCopiar(SENTINELA_DO_ZERO);
    }
    setErroDoServidor(null);
    const idDoTimer = window.setTimeout(() => inputNomeRef.current?.focus(), 0);
    return () => window.clearTimeout(idDoTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, fichaParaEditar?.id]);

  function atualizarCampo<K extends keyof CamposDeTexto>(chave: K, valor: CamposDeTexto[K]) {
    setCampos((atual) => ({ ...atual, [chave]: valor }));
  }

  // "Começar a partir de uma peça parecida" (D-19, só no modo de criação): a ORIGEM já está no
  // array recebido (nenhuma consulta nova) — `camposCopiaveisDaFicha` (lib/precificacao/ficha.ts)
  // decide o que se copia; nome, preço praticado, preço de mercado e `exclusiva` ficam intocados.
  function copiarDe(idEscolhido: string) {
    setIdParaCopiar(idEscolhido);
    if (idEscolhido === SENTINELA_DO_ZERO) {
      return;
    }
    const origem = fichasParaCopiar.find((ficha) => ficha.id === idEscolhido) ?? null;
    const copiados = camposCopiaveisDaFicha(origem);
    setCampos((atual) => ({
      ...atual,
      argilaTexto: textoDeMedida(copiados.argilaMiligramas, 1000),
      esmalteTexto: textoDeMedida(copiados.esmalteMiligramas, 1000),
      horasTexto: textoDeMedida(copiados.horasMilesimos, 1000),
      larguraTexto: textoDeMedida(copiados.larguraMm, 10),
      profundidadeTexto: textoDeMedida(copiados.profundidadeMm, 10),
      alturaTexto: textoDeMedida(copiados.alturaMm, 10),
      embalagemTexto: textoDeCentavos(copiados.embalagemCentavos),
      cabemBiscoitoTexto:
        copiados.cabemBiscoitoInformado !== null ? String(copiados.cabemBiscoitoInformado) : "",
      cabemEsmalteTexto:
        copiados.cabemEsmalteInformado !== null ? String(copiados.cabemEsmalteInformado) : "",
    }));
  }

  const opcoes = useMemo(
    () =>
      opcoesDeCategoria(
        categoriasDeVenda,
        fichaParaEditar
          ? { id: fichaParaEditar.categoriaVendaId ?? "", nome: fichaParaEditar.categoriaVendaNome }
          : null,
      ),
    [categoriasDeVenda, fichaParaEditar],
  );

  // O resultado ao vivo — a MESMA cadeia que o servidor chamaria: quantasCabem → calcularPeca
  // (duas vezes, canal direto e galeria) → farolDoPreco → resultadoDaFicha para montar o que a
  // tela mostra. `lib/precificacao/ficha.ts` nunca chama estas funções sozinho (só `import type`),
  // então é este componente quem faz a ponte de verdade.
  const { resultado, fichaConvertida, mensagemDeConversao } = useMemo(() => {
    const argila = converterMedidaDaFicha(campos.argilaTexto, 1000);
    const esmalte = converterMedidaDaFicha(campos.esmalteTexto, 1000);
    const horas = converterMedidaDaFicha(campos.horasTexto, 1000);
    const largura = converterMedidaDaFicha(campos.larguraTexto, 10);
    const profundidade = converterMedidaDaFicha(campos.profundidadeTexto, 10);
    const altura = converterMedidaDaFicha(campos.alturaTexto, 10);
    // Dinheiro usa `converterReaisParaCentavos` — a MESMA conversão de `esquemas.ts` (aceita
    // "R$", separador de milhar por ponto e vazio = nulo). `converterMedidaDaFicha` NÃO serve
    // aqui: ela lê "3.500" como 3,5 (três casas decimais), enquanto dinheiro lê como R$ 3.500,00.
    const embalagem = converterReaisParaCentavos(campos.embalagemTexto);
    const precoPraticado = converterReaisParaCentavos(campos.precoPraticadoTexto);
    const precoMercado = converterReaisParaCentavos(campos.precoMercadoTexto);
    const cabemBiscoito = converterContagemDaFicha(campos.cabemBiscoitoTexto);
    const cabemEsmalte = converterContagemDaFicha(campos.cabemEsmalteTexto);

    const primeiroErro = [
      argila,
      esmalte,
      horas,
      largura,
      profundidade,
      altura,
      embalagem,
      precoPraticado,
      precoMercado,
      cabemBiscoito,
      cabemEsmalte,
    ].find((item) => !item.ok);

    if (primeiroErro && !primeiroErro.ok) {
      return { resultado: null, fichaConvertida: null, mensagemDeConversao: primeiroErro.erro };
    }
    if (
      !argila.ok ||
      !esmalte.ok ||
      !horas.ok ||
      !largura.ok ||
      !profundidade.ok ||
      !altura.ok ||
      !embalagem.ok ||
      !precoPraticado.ok ||
      !precoMercado.ok ||
      !cabemBiscoito.ok ||
      !cabemEsmalte.ok
    ) {
      return { resultado: null, fichaConvertida: null, mensagemDeConversao: null };
    }

    const ficha: FichaEmEdicao = {
      nome: campos.nome,
      argilaMiligramas: argila.valorInteiro,
      esmalteMiligramas: esmalte.valorInteiro,
      horasMilesimos: horas.valorInteiro,
      larguraMm: largura.valorInteiro,
      profundidadeMm: profundidade.valorInteiro,
      alturaMm: altura.valorInteiro,
      embalagemCentavos: embalagem.centavos ?? 0,
      precoPraticadoCentavos: precoPraticado.centavos,
      precoMercadoCentavos: precoMercado.centavos,
      cabemBiscoitoInformado: cabemBiscoito.valorInteiro,
      cabemEsmalteInformado: cabemEsmalte.valorInteiro,
      exclusiva,
      categoriaVendaId,
    };

    const cabem = quantasCabem(paraMedidasDaPeca(ficha), forno, paraContagemInformada(ficha));
    const fichaParaCalculo = paraFichaDeCalculo(ficha);
    const resultadoDireto = calcularPeca({
      ficha: fichaParaCalculo,
      cabem,
      parametros,
      taxaCartaoPontosBase,
      canal: "direto",
    });
    const resultadoGaleria = calcularPeca({
      ficha: fichaParaCalculo,
      cabem,
      parametros,
      taxaCartaoPontosBase,
      canal: "galeria",
    });
    const farol = resultadoDireto.ok
      ? farolDoPreco(ficha.precoPraticadoCentavos, resultadoDireto.minimoCentavos, resultadoDireto.zeroCentavos)
      : null;

    return {
      resultado: resultadoDaFicha({ cabem, resultadoDireto, resultadoGaleria, farol }),
      fichaConvertida: ficha,
      mensagemDeConversao: null,
    };
  }, [campos, exclusiva, categoriaVendaId, forno, parametros, taxaCartaoPontosBase]);

  const nomeValido = campos.nome.trim().length > 0;

  // A MESMA `validarFicha` que a Server Action chama, com o retrato já convertido pelo useMemo
  // acima — nenhuma regra escrita duas vezes. Só aparece depois que o nome é preenchido (mesma
  // disciplina de `dialogo-item-catalogo.tsx`): o "Dê um nome à peça." de verdade, exigido pelo
  // e2e, vem do SERVIDOR quando o dono tenta salvar com o nome em branco — este aviso ao vivo é
  // conveniência para as outras regras (categoria de venda, medidas), nunca a única porta.
  const erroDeRegra = useMemo(() => {
    if (!fichaConvertida) {
      return null;
    }
    const resultado = validarFicha(fichaConvertida);
    return resultado.ok ? null : resultado.erro;
  }, [fichaConvertida]);

  // Guarda o id da ficha já criada quando "Salvar" veio de dentro de um orçamento e a criação da
  // ficha deu certo, mas acrescentá-la ao orçamento falhou (rede) — uma nova tentativa de
  // "Salvar" NÃO cria uma segunda ficha, só tenta `acrescentarLinha` de novo com o mesmo id.
  const fichaCriadaIdRef = useRef<string | null>(null);

  async function salvar() {
    if (enviando) {
      return;
    }
    setErroDoServidor(null);
    setEnviando(true);

    const entrada = {
      nome: campos.nome,
      argilaTexto: campos.argilaTexto,
      esmalteTexto: campos.esmalteTexto,
      horasTexto: campos.horasTexto,
      larguraTexto: campos.larguraTexto,
      profundidadeTexto: campos.profundidadeTexto,
      alturaTexto: campos.alturaTexto,
      embalagemTexto: campos.embalagemTexto,
      precoMercadoTexto: campos.precoMercadoTexto,
      precoPraticadoTexto: campos.precoPraticadoTexto,
      cabemBiscoitoTexto: campos.cabemBiscoitoTexto,
      cabemEsmalteTexto: campos.cabemEsmalteTexto,
      exclusiva,
      categoriaVendaId: exclusiva ? null : categoriaVendaId,
    };

    if (modoEdicao && fichaParaEditar) {
      const resposta = await editarFicha({ id: fichaParaEditar.id, ...entrada });
      setEnviando(false);
      if (!resposta.ok) {
        setErroDoServidor(resposta.erro);
        return;
      }
      // Navegação COMPLETA — nunca a atualização client-side do roteador do Next — o servidor é
      // quem sabe a peça salva. Editada de dentro de um orçamento ("ver cálculo"), volta para o
      // editor; editada pela aba Peças, volta para a lista de peças com o aviso de sempre.
      window.location.assign(
        vindoDoOrcamentoId
          ? `/financeiro?aba=orcamentos&orcamento=${vindoDoOrcamentoId}`
          : `/financeiro?aba=pecas&peca=${resposta.dados.id}&aviso=peca-salva`,
      );
      return;
    }

    // Criação. Se uma tentativa anterior já criou a ficha (e só falhou ao acrescentar a linha ao
    // orçamento, abaixo), não cria uma segunda — reusa o id guardado.
    if (!fichaCriadaIdRef.current) {
      const resposta = await criarFicha(entrada);
      if (!resposta.ok) {
        setEnviando(false);
        setErroDoServidor(resposta.erro);
        return;
      }
      fichaCriadaIdRef.current = resposta.dados.id;
    }
    const idDaFicha = fichaCriadaIdRef.current;

    if (!vindoDoOrcamentoId) {
      setEnviando(false);
      window.location.assign(`/financeiro?aba=pecas&peca=${idDaFicha}&aviso=peca-salva`);
      return;
    }

    // "+ Peça exclusiva deste pedido" (must_have): a peça nasce E entra no orçamento na MESMA
    // ida — um caminho só, nenhuma segunda busca pelo dono.
    const respostaLinha = await acrescentarLinha({ orcamentoId: vindoDoOrcamentoId, fichaId: idDaFicha });
    setEnviando(false);
    if (!respostaLinha.ok) {
      setErroDoServidor(`A peça foi criada, mas não entrou no orçamento: ${respostaLinha.erro}`);
      return;
    }
    window.location.assign(`/financeiro?aba=orcamentos&orcamento=${vindoDoOrcamentoId}`);
  }

  const titulo = modoEdicao ? TITULO_DIALOGO_FICHA_EDITAR : TITULO_DIALOGO_FICHA_NOVA;
  const erroExibido = erroDoServidor ?? mensagemDeConversao ?? (nomeValido ? erroDeRegra : null);

  return (
    <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
      <DialogContent aria-label={titulo} className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-titulo">{titulo}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void salvar();
          }}
          className="flex flex-col gap-4"
        >
          {erroExibido && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {erroExibido}
            </p>
          )}

          {!modoEdicao && (
            <Field>
              <FieldLabel htmlFor="ficha-copiar-de">{ROTULO_COMECAR_A_PARTIR_DE}</FieldLabel>
              <Select value={idParaCopiar} onValueChange={copiarDe}>
                <SelectTrigger
                  id="ficha-copiar-de"
                  data-testid="ficha-copiar-de"
                  aria-label={ROTULO_COMECAR_A_PARTIR_DE}
                  className="min-h-[44px] w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINELA_DO_ZERO}>{ROTULO_DO_ZERO}</SelectItem>
                  {fichasParaCopiar.map((ficha) => (
                    <SelectItem key={ficha.id} value={ficha.id}>
                      {ficha.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="ficha-nome">{ROTULO_NOME_DA_PECA}</FieldLabel>
            <Input
              id="ficha-nome"
              data-testid="ficha-campo-nome"
              ref={inputNomeRef}
              value={campos.nome}
              onChange={(evento) => atualizarCampo("nome", evento.target.value)}
              className="text-corpo min-h-[44px]"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ficha-argila">{ROTULO_ARGILA}</FieldLabel>
              <Input
                id="ficha-argila"
                data-testid="ficha-campo-argila"
                inputMode="decimal"
                value={campos.argilaTexto}
                onChange={(evento) => atualizarCampo("argilaTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-esmalte">{ROTULO_ESMALTE}</FieldLabel>
              <Input
                id="ficha-esmalte"
                data-testid="ficha-campo-esmalte"
                inputMode="decimal"
                value={campos.esmalteTexto}
                onChange={(evento) => atualizarCampo("esmalteTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="ficha-horas">{ROTULO_HORAS_DE_TRABALHO}</FieldLabel>
              <Input
                id="ficha-horas"
                data-testid="ficha-campo-horas"
                inputMode="decimal"
                value={campos.horasTexto}
                onChange={(evento) => atualizarCampo("horasTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-largura">{ROTULO_LARGURA}</FieldLabel>
              <Input
                id="ficha-largura"
                data-testid="ficha-campo-largura"
                inputMode="decimal"
                value={campos.larguraTexto}
                onChange={(evento) => atualizarCampo("larguraTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-profundidade">{ROTULO_PROFUNDIDADE}</FieldLabel>
              <Input
                id="ficha-profundidade"
                data-testid="ficha-campo-profundidade"
                inputMode="decimal"
                value={campos.profundidadeTexto}
                onChange={(evento) => atualizarCampo("profundidadeTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-altura">{ROTULO_ALTURA}</FieldLabel>
              <Input
                id="ficha-altura"
                data-testid="ficha-campo-altura"
                inputMode="decimal"
                value={campos.alturaTexto}
                onChange={(evento) => atualizarCampo("alturaTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-embalagem">{ROTULO_EMBALAGEM}</FieldLabel>
              <Input
                id="ficha-embalagem"
                data-testid="ficha-campo-embalagem"
                inputMode="decimal"
                value={campos.embalagemTexto}
                onChange={(evento) => atualizarCampo("embalagemTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-preco-praticado">{ROTULO_PRECO_PRATICADO}</FieldLabel>
              <Input
                id="ficha-preco-praticado"
                data-testid="ficha-campo-preco-praticado"
                inputMode="decimal"
                value={campos.precoPraticadoTexto}
                onChange={(evento) => atualizarCampo("precoPraticadoTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-preco-mercado">{ROTULO_PRECO_MERCADO}</FieldLabel>
              <Input
                id="ficha-preco-mercado"
                data-testid="ficha-campo-preco-mercado"
                inputMode="decimal"
                value={campos.precoMercadoTexto}
                onChange={(evento) => atualizarCampo("precoMercadoTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-cabem-biscoito">{ROTULO_CABEM_BISCOITO}</FieldLabel>
              <Input
                id="ficha-cabem-biscoito"
                data-testid="ficha-campo-cabem-biscoito"
                inputMode="numeric"
                value={campos.cabemBiscoitoTexto}
                onChange={(evento) => atualizarCampo("cabemBiscoitoTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ficha-cabem-esmalte">{ROTULO_CABEM_ESMALTE}</FieldLabel>
              <Input
                id="ficha-cabem-esmalte"
                data-testid="ficha-campo-cabem-esmalte"
                inputMode="numeric"
                value={campos.cabemEsmalteTexto}
                onChange={(evento) => atualizarCampo("cabemEsmalteTexto", evento.target.value)}
                className="text-corpo min-h-[44px]"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2">
            <span
              data-testid="ficha-campo-exclusiva"
              className="flex size-11 flex-none items-center justify-center"
            >
              <Checkbox
                className="size-5 after:-inset-y-3"
                checked={exclusiva}
                onCheckedChange={(valor) => setExclusiva(valor === true)}
              />
            </span>
            <span className="text-corpo">{ROTULO_EXCLUSIVA}</span>
          </label>

          {!exclusiva && (
            <Field>
              <FieldLabel htmlFor="ficha-categoria-venda">{ROTULO_CATEGORIA_DE_VENDA_FICHA}</FieldLabel>
              <Select
                value={categoriaVendaId ?? ""}
                onValueChange={(valor) => setCategoriaVendaId(valor || null)}
              >
                <SelectTrigger
                  id="ficha-categoria-venda"
                  data-testid="ficha-campo-categoria-venda"
                  aria-label={ROTULO_CATEGORIA_DE_VENDA_FICHA}
                  className="min-h-[44px] w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoes.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div data-testid="ficha-resultado-container" className="border-border rounded-lg border p-4">
            {resultado ? (
              <ResultadoDaFicha
                resultado={resultado}
                precoPraticadoCentavos={fichaConvertida?.precoPraticadoCentavos ?? null}
                precoMercadoCentavos={fichaConvertida?.precoMercadoCentavos ?? null}
              />
            ) : (
              <p className="text-apoio text-muted-foreground">
                Confira os números digitados para ver o custo.
              </p>
            )}
          </div>

          <div className={modoEdicao ? "flex items-center justify-between gap-3" : "flex justify-end gap-3"}>
            {/* "Apagar" só existe no modo de edição (uma ficha nova não tem o que apagar) — o
                único elemento destrutivo desta tela (04.5-UI-SPEC.md §Color). Só NAVEGA: quem
                decide se apaga de verdade é `ConfirmarApagarPeca`, montado por linha na Lista de
                Peças, que já tem o `nome` sem consulta extra — por isso o botão só aparece vindo
                da aba Peças; vindo de dentro de um orçamento, a peça está em uso por definição
                (D-20), e `ConfirmarApagarPeca` nem está montado nessa tela. */}
            {modoEdicao && fichaParaEditar && !vindoDoOrcamentoId && (
              <button
                type="button"
                onClick={() =>
                  window.location.assign(
                    hrefDaAbaPecas({
                      apagarPeca: fichaParaEditar.id,
                      // Preserva o filtro atual E garante o modo exclusivas quando a ficha é
                      // exclusiva: a lista atrás do diálogo precisa ser a que contém a peça
                      // sendo apagada, venha o dono de onde vier (achado 8, 04.5-14).
                      mostrarExclusivas: mostrandoExclusivas || fichaParaEditar.exclusiva,
                    }),
                  )
                }
                className="text-corpo text-destructive hover:bg-destructive/10 flex min-h-[44px] items-center rounded-md px-3 font-medium"
              >
                {ROTULO_APAGAR_PECA}
              </button>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={fechar}
                className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
              >
                {ROTULO_CANCELAR}
              </button>
              <button
                type="submit"
                disabled={enviando}
                aria-busy={enviando}
                className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Salvando…" : ROTULO_SALVAR_FICHA}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
