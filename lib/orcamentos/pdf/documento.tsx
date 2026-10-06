// O `<Document>` do PDF do cliente — consome `DocumentoDoCliente` e NADA além dele (D-24/D-29):
// nenhuma chamada a `contasDoOrcamento`/`resultadoDaFicha`/`calcularPeca`, nenhum dado de custo,
// mínimo, margem, sobra, hora ou fornada. A folha reproduz o layout do protótipo aprovado
// (`prototipo.html`, função `papel`) com a tipografia de papel do 04.5-UI-SPEC.md §Typography.
//
// 🔴 Este componente NÃO É elemento de página — `View`/`Text`/`Image` do `@react-pdf/renderer`
// não são `<div>`/`<span>`/`<img>` do DOM. Não existe forma de reaproveitar
// `components/amassa/orcamentos/ver-como-o-cliente-ve.tsx` aqui, e tentar isso falharia em tempo
// de execução — o que os dois compartilham é `lib/orcamentos/documento-cliente.ts`, nunca a
// marcação (ver o comentário no topo daquele arquivo).
//
// A quebra de página da tabela é automática: cada linha (`wrap={false}`) nunca é cortada ao
// meio, mas o CONTÊINER da tabela pode continuar na próxima página — o motor de layout do
// `@react-pdf/renderer` decide onde cortar, este componente nunca calcula posição/altura à mão.
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { DocumentoDoCliente } from "@/lib/orcamentos/documento-cliente";
import {
  ROTULO_COLUNA_CADA,
  ROTULO_COLUNA_PECA,
  ROTULO_COLUNA_QUANTIDADE,
  ROTULO_TOTAL,
  TITULO_DOCUMENTO_OBSERVACOES,
  TITULO_DOCUMENTO_PAGAMENTO,
  TITULO_DOCUMENTO_PRAZO,
  TITULO_DOCUMENTO_REFERENCIAS,
} from "@/lib/orcamentos/textos";

import { FAMILIA_CORPO, FAMILIA_TITULO } from "./fontes";

const CORTINA = "#894025";
const TINTA = "#1D2221";
const TINTA_FRACA = "#5A4C44";
const TINTA_MAIS_FRACA = "#6E5F56";
const BORDA = "#E8E2DC";
const BORDA_FOTO = "#D8CFC7";

const estilos = StyleSheet.create({
  pagina: {
    padding: 32,
    fontFamily: FAMILIA_CORPO,
    fontSize: 14.5,
    color: TINTA,
    lineHeight: 1.4,
  },
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: CORTINA,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logo: { width: 96, height: 44, objectFit: "contain" },
  nomeDoAtelie: { fontFamily: FAMILIA_TITULO, fontSize: 28, color: CORTINA },
  cabecalhoDireita: { alignItems: "flex-end" },
  numero: { fontSize: 14, fontWeight: "bold" },
  dataTexto: { fontSize: 11, color: TINTA_FRACA, marginTop: 2 },
  para: { fontSize: 14, marginBottom: 12 },
  cabecalhoTabela: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: TINTA,
    paddingBottom: 4,
    marginBottom: 2,
  },
  linhaTabela: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDA,
    paddingVertical: 4,
  },
  colunaPeca: { flex: 2 },
  // As três colunas numéricas com recuo à esquerda: o número de uma nunca encosta no da outra — o
  // mesmo efeito do `px-4` da tela (“Ver como o cliente vê”). Até 06/10/2026 a quantidade e o preço
  // unitário podiam se ler “1R$ 70,00” (D-14, achado 23). 12 pt ≈ 16 px.
  colunaNumero: { flex: 1, textAlign: "right", paddingLeft: 12 },
  // “Qtd.” nunca mais estreita que 36 pt (≈ `min-w-12`, 48 px, da tela).
  colunaQuantidade: { minWidth: 36 },
  small: { fontSize: 10, color: TINTA_MAIS_FRACA },
  totalLinha: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: TINTA,
    paddingTop: 6,
    marginTop: 4,
  },
  totalTexto: { fontSize: 17, fontWeight: "bold" },
  tituloSecao: {
    fontSize: 11,
    fontWeight: "bold",
    color: CORTINA,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 4,
  },
  duasColunas: { flexDirection: "row", gap: 24, marginTop: 4 },
  coluna: { flex: 1 },
  fotos: { flexDirection: "row", gap: 8, marginTop: 4 },
  fotoBloco: { width: 96 },
  foto: {
    width: 96,
    height: 96,
    objectFit: "cover",
    borderWidth: 1,
    borderColor: BORDA_FOTO,
    borderRadius: 4,
  },
  legendaFoto: { fontSize: 10, marginTop: 2 },
  confirmacao: { marginTop: 14, fontSize: 14.5 },
  rodape: {
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDA,
    fontSize: 12.5,
    color: TINTA_FRACA,
    fontStyle: "italic",
  },
});

export type FotoBufferParaPdf = {
  id: string;
  buffer: Buffer;
};

export type DocumentoOrcamentoPdfProps = {
  documento: DocumentoDoCliente;
  // `null` quando a logo (D-09) ainda não existe — o nome do ateliê aparece em texto.
  logo: Buffer | null;
  // Os bytes de cada foto, resolvidos pela ROTA (nunca por este componente — `documento.tsx`
  // nunca toca disco; ver `app/api/orcamentos/[id]/pdf/route.ts`).
  fotos: FotoBufferParaPdf[];
};

export function DocumentoOrcamentoPdf({
  documento,
  logo,
  fotos,
}: DocumentoOrcamentoPdfProps) {
  return (
    <Document>
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.cabecalho}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf/renderer (não do DOM): sem prop `alt` no tipo, PDF não tem árvore de acessibilidade de tela.
            <Image src={logo} style={estilos.logo} />
          ) : (
            <Text style={estilos.nomeDoAtelie}>AMASSA CERRADO</Text>
          )}
          <View style={estilos.cabecalhoDireita}>
            <Text style={estilos.numero}>{documento.numeroCompleto}</Text>
            <Text style={estilos.dataTexto}>{documento.dataFormatada}</Text>
            <Text style={estilos.dataTexto}>{documento.validoAteTexto}</Text>
          </View>
        </View>

        <Text style={estilos.para}>{documento.paraTexto}</Text>

        <View>
          <View style={estilos.cabecalhoTabela}>
            <Text style={estilos.colunaPeca}>{ROTULO_COLUNA_PECA}</Text>
            <Text style={[estilos.colunaNumero, estilos.colunaQuantidade]}>
              {ROTULO_COLUNA_QUANTIDADE}
            </Text>
            <Text style={estilos.colunaNumero}>{ROTULO_COLUNA_CADA}</Text>
            <Text style={estilos.colunaNumero}>{ROTULO_TOTAL}</Text>
          </View>

          {documento.linhas.map((linha, indice) => (
            <View key={indice} style={estilos.linhaTabela} wrap={false}>
              <View style={estilos.colunaPeca}>
                <Text>{linha.nome}</Text>
                {linha.cor ? <Text style={estilos.small}>{linha.cor}</Text> : null}
                {linha.personalizacao ? (
                  <Text style={estilos.small}>{linha.personalizacao}</Text>
                ) : null}
              </View>
              <Text style={[estilos.colunaNumero, estilos.colunaQuantidade]}>
                {linha.quantidadeTexto}
              </Text>
              <Text style={estilos.colunaNumero}>{linha.precoUnitarioFormatado}</Text>
              <Text style={estilos.colunaNumero}>{linha.totalFormatado}</Text>
            </View>
          ))}

          {documento.projeto.map((item, indice) => (
            <View key={`projeto-${indice}`} style={estilos.linhaTabela} wrap={false}>
              <Text style={estilos.colunaPeca}>{item.descricao}</Text>
              <Text style={[estilos.colunaNumero, estilos.colunaQuantidade]} />
              <Text style={estilos.colunaNumero} />
              <Text style={estilos.colunaNumero}>{item.valorFormatado}</Text>
            </View>
          ))}

          {documento.freteFormatado ? (
            <View style={estilos.linhaTabela} wrap={false}>
              <Text style={estilos.colunaPeca}>Frete</Text>
              <Text style={[estilos.colunaNumero, estilos.colunaQuantidade]} />
              <Text style={estilos.colunaNumero} />
              <Text style={estilos.colunaNumero}>{documento.freteFormatado}</Text>
            </View>
          ) : null}

          <View style={estilos.totalLinha} wrap={false}>
            <Text style={[estilos.colunaPeca, estilos.totalTexto]}>{ROTULO_TOTAL}</Text>
            <Text style={[estilos.colunaNumero, estilos.colunaQuantidade]} />
            <Text style={estilos.colunaNumero} />
            <Text style={[estilos.colunaNumero, estilos.totalTexto]}>
              {documento.totalFormatado}
            </Text>
          </View>
        </View>

        {documento.referencias.length > 0 ? (
          <View wrap={false}>
            <Text style={estilos.tituloSecao}>{TITULO_DOCUMENTO_REFERENCIAS}</Text>
            <View style={estilos.fotos}>
              {documento.referencias.map((referencia) => {
                const bufferDaFoto = fotos.find(
                  (foto) => foto.id === referencia.id,
                )?.buffer;
                if (!bufferDaFoto) return null;
                return (
                  <View key={referencia.id} style={estilos.fotoBloco}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- ver comentário acima. */}
                    <Image src={bufferDaFoto} style={estilos.foto} />
                    {referencia.legenda ? (
                      <Text style={estilos.legendaFoto}>{referencia.legenda}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={estilos.duasColunas} wrap={false}>
          <View style={estilos.coluna}>
            <Text style={estilos.tituloSecao}>{TITULO_DOCUMENTO_PAGAMENTO}</Text>
            {documento.pagamento.map((parcela, indice) => (
              <Text key={indice}>
                {parcela.rotulo}: {parcela.valorFormatado}
              </Text>
            ))}
          </View>
          <View style={estilos.coluna}>
            <Text style={estilos.tituloSecao}>{TITULO_DOCUMENTO_PRAZO}</Text>
            <Text>{documento.prazoTexto}</Text>
          </View>
        </View>

        {documento.observacoes ? (
          <View wrap={false}>
            <Text style={estilos.tituloSecao}>{TITULO_DOCUMENTO_OBSERVACOES}</Text>
            <Text>{documento.observacoes}</Text>
          </View>
        ) : null}

        <Text style={estilos.confirmacao}>{documento.fraseConfirmacao}</Text>

        <Text style={estilos.rodape}>{documento.notaFeitoAMao}</Text>
      </Page>
    </Document>
  );
}
