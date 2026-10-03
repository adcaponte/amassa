import type { ReactNode } from "react";

import { ROTULO_AREA } from "@/lib/financeiro/textos";
import { formatarDataCurta, formatarInstanteCurto, hojeEmBrasilia } from "@/lib/financeiro/formato";
import { textoDoTamanho } from "@/lib/fornecedores/arquivo";
import { itensDeVende } from "@/lib/fornecedores/busca";
import { anexosDoFornecedor, type AnexoDaFicha, type FichaDoFornecedor } from "@/lib/fornecedores/consultas";
import type { AreaDoFornecedor } from "@/lib/fornecedores/esquemas";
import { efeitoDeTirar, seloDaTabela, tabelaVigente } from "@/lib/fornecedores/tabela-vigente";
import {
  FRASE_ERRO_CARREGAR_FICHA,
  FRASE_SEM_OBSERVACAO,
  ROTULO_OBSERVACOES,
  ROTULO_TIPO_DE_ANEXO,
  restoDaMetaDoAnexo,
  rodapeDaFicha,
  trechoEnviadaEm,
  trechoValeDesde,
} from "@/lib/fornecedores/textos";
import { cn } from "@/lib/utils";

import { TentarDeNovo } from "@/components/amassa/inicio/tentar-de-novo";

import { AcoesDaFicha, type FornecedorDaFicha } from "./acoes-da-ficha";
import { AnexosFornecedor, type AnexoNaFicha } from "./anexos-fornecedor";
import { ContatosFornecedor } from "./contatos-fornecedor";
import { SeloDesativado } from "./lista-fornecedores";
import { NavegacaoDaFicha } from "./navegacao-da-ficha";
import { TabelaVigente, type TabelaVigenteDaFicha } from "./tabela-vigente";

// O ponto de cor da etiqueta de área (`--color-area-*`, tokens existentes; decorativo — o nome da
// área está escrito ao lado). Classes inteiras, para o Tailwind achar cada uma.
const PONTO_DA_AREA: Record<AreaDoFornecedor, string> = {
  pecas: "bg-area-pecas",
  cafeteria: "bg-area-cafeteria",
  loja: "bg-area-loja",
  espaco: "bg-area-espaco",
  geral: "bg-area-geral",
};

// Etiquetas e selo: Apoio, `rounded-full`, `py-1 px-2` (4 × 8 — UI-D26).
const CLASSE_DA_ETIQUETA = "text-apoio bg-superficie-2 text-tinta-media inline-flex items-center gap-1 rounded-full px-2 py-1";

// O que os botões da ficha recebem (componente de cliente): os valores atuais como a folha "Editar
// fornecedor" os mostra — texto, nunca `null` — mais o id e o estado. Só campos simples: nada de `Date`
// atravessando para o cliente.
function paraAsAcoes(fornecedor: FichaDoFornecedor): FornecedorDaFicha {
  return {
    id: fornecedor.id,
    ativo: fornecedor.ativo,
    nome: fornecedor.nome,
    vende: fornecedor.vende ?? "",
    area: fornecedor.area,
    cidadeEntrega: fornecedor.cidadeEntrega ?? "",
    whatsapp: fornecedor.whatsapp ?? "",
    pessoaContato: fornecedor.pessoaContato ?? "",
    email: fornecedor.email ?? "",
    site: fornecedor.site ?? "",
    pagamentoPrazo: fornecedor.pagamentoPrazo ?? "",
    observacoes: fornecedor.observacoes ?? "",
  };
}

// Um anexo como a linha da ficha o mostra: a 2ª linha montada AQUI, no servidor — "vale desde" é dia
// civil (`formatarDataCurta`, sem fuso); "enviado em" é instante, no fuso de Brasília
// (`formatarInstanteCurto`), nunca o do processo. `vigenteId` marca a tabela vigente (plano 08), e
// `efeito` diz o que a confirmação de tirar precisa contar.
function paraALinha(anexo: AnexoDaFicha, anexos: readonly AnexoDaFicha[], vigenteId: string | null): AnexoNaFicha {
  const tamanho = textoDoTamanho(anexo.arquivoBytes);
  return {
    id: anexo.id,
    nome: anexo.nome,
    extensao: anexo.extensao,
    nota: anexo.nota,
    tipoRotulo: ROTULO_TIPO_DE_ANEXO[anexo.tipo],
    restoDaMeta: restoDaMetaDoAnexo({
      valeDesde: anexo.valeDesde === null ? null : formatarDataCurta(anexo.valeDesde),
      extensao: anexo.extensao,
      tamanho,
      quem: anexo.criadoPorNome,
      enviadoEm: formatarInstanteCurto(anexo.criadoEm),
    }),
    tamanho,
    vigente: anexo.id === vigenteId,
    efeito: efeitoDeTirar(anexos, anexo.id),
  };
}

// A linha "Última tabela de preços" (plano 08; FRN-11): a vigente pelos módulos puros, com o "hoje" de
// Brasília. Sem "vale desde", a data mostrada é a do envio — a mesma de que o selo conta.
function paraATabelaVigente(vigente: AnexoDaFicha | null, hoje: string): TabelaVigenteDaFicha | null {
  if (vigente === null) {
    return null;
  }
  return {
    id: vigente.id,
    nome: vigente.nome,
    extensao: vigente.extensao,
    trechoDaData:
      vigente.valeDesde !== null
        ? trechoValeDesde(formatarDataCurta(vigente.valeDesde))
        : trechoEnviadaEm(formatarDataCurta(vigente.enviadoEm)),
    selo: seloDaTabela(vigente, hoje),
  };
}

// A ficha de leitura de um fornecedor (06.2-UI-SPEC.md §"Página — Cadastros → Fornecedores", Bloco
// Ficha). Server Component: só desenha o que a página leu. Plano 03: "Voltar à lista" (só abaixo de
// 1024 px), cabeçalho (nome + selo; etiquetas de "vende" e a de área com o ponto), contatos,
// observações e o rodapé do plano 02. Plano 04: "Editar" e "Desativar"/"Reativar" (`AcoesDaFicha`, à
// direita do cabeçalho). Plano 06: a seção de anexos (`AnexosFornecedor`), depois das Observações —
// os anexos são lidos AQUI, junto com a ficha; se a leitura falhar, a coluna mostra o erro de
// carregamento da ficha com "Tentar de novo" (a lista continua). As compras são do 11.
//
// `aria-labelledby` = o `h2` do nome (`tabIndex={-1}`: o foco vai a ele ao trocar de ficha —
// `NavegacaoDaFicha`). O selo fica FORA do `h2`: o nome acessível do título é só o nome.
export async function FichaFornecedor({ fornecedor }: { fornecedor: FichaDoFornecedor }) {
  let anexos: AnexoDaFicha[];
  try {
    anexos = await anexosDoFornecedor(fornecedor.id);
  } catch (erro) {
    console.error("Falha ao carregar os anexos do fornecedor:", erro);
    return <FichaSemFornecedor frase={FRASE_ERRO_CARREGAR_FICHA} acao={<TentarDeNovo />} />;
  }
  // O "hoje" da folha "Novo anexo" (o "Vale a partir de" do PDF) e do selo da tabela vigente: o dia
  // civil de Brasília calculado no servidor, nunca o dia UTC (nem o do navegador).
  const hoje = hojeEmBrasilia(new Date());
  const vigente = tabelaVigente(anexos);
  // "Cadastrado em" é o dia CIVIL de Brasília do instante gravado — nunca o dia UTC.
  const cadastradoEm = formatarDataCurta(hojeEmBrasilia(fornecedor.criadoEm));
  const etiquetas = itensDeVende(fornecedor.vende);
  const observacoes = fornecedor.observacoes?.trim() ? fornecedor.observacoes : null;

  return (
    <section
      id="ficha-fornecedor"
      aria-labelledby="ficha-fornecedor-nome"
      data-testid="fornecedor-ficha"
      data-fornecedor-id={fornecedor.id}
      className="bg-superficie border-borda flex min-w-0 scroll-mt-4 flex-col gap-4 rounded-xl border p-4"
    >
      <NavegacaoDaFicha id={fornecedor.id} />

      {/* Cabeçalho (`flex-wrap`, `justify-between`): à esquerda o nome, o selo e as etiquetas; à direita
          "Editar" + "Desativar"/"Reativar". O lado do nome tem base de 16rem: a 320 px os botões descem
          para a linha de baixo e o nome de 120 caracteres quebra sem cortar (UI E3/E8). */}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2
              id="ficha-fornecedor-nome"
              tabIndex={-1}
              className="text-titulo text-tinta min-w-0 [overflow-wrap:anywhere] focus-visible:outline-none"
            >
              {fornecedor.nome}
            </h2>
            {fornecedor.ativo ? null : <SeloDesativado testId="fornecedor-selo-desativado" />}
          </div>

          <ul className="flex flex-wrap gap-2" data-testid="fornecedor-etiquetas">
            {etiquetas.map((item, indice) => (
              <li key={`${indice}-${item}`} className={cn(CLASSE_DA_ETIQUETA, "[overflow-wrap:anywhere]")}>
                {item}
              </li>
            ))}
            <li className={CLASSE_DA_ETIQUETA} data-testid="fornecedor-etiqueta-area">
              <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", PONTO_DA_AREA[fornecedor.area])} />
              {ROTULO_AREA[fornecedor.area]}
            </li>
          </ul>
        </div>

        <AcoesDaFicha fornecedor={paraAsAcoes(fornecedor)} />
      </div>

      <TabelaVigente
        fornecedorId={fornecedor.id}
        fornecedorNome={fornecedor.nome}
        ativo={fornecedor.ativo}
        hoje={hoje}
        vigente={paraATabelaVigente(vigente, hoje)}
      />

      <ContatosFornecedor fornecedor={fornecedor} />

      <section aria-labelledby="ficha-fornecedor-observacoes" className="flex flex-col gap-2">
        <h3
          id="ficha-fornecedor-observacoes"
          className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
        >
          {ROTULO_OBSERVACOES}
        </h3>
        {observacoes !== null ? (
          <p
            data-testid="fornecedor-observacoes"
            className="text-corpo text-tinta bg-superficie-2 rounded-lg p-3 [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {observacoes}
          </p>
        ) : (
          <p data-testid="fornecedor-sem-observacao" className="text-corpo text-tinta-fraca">
            {FRASE_SEM_OBSERVACAO}
          </p>
        )}
      </section>

      <AnexosFornecedor
        fornecedorId={fornecedor.id}
        fornecedorNome={fornecedor.nome}
        ativo={fornecedor.ativo}
        hoje={hoje}
        anexos={anexos.map((anexo) => paraALinha(anexo, anexos, vigente?.id ?? null))}
      />

      <p className="text-apoio text-tinta-fraca tabular-nums" data-testid="fornecedor-rodape-ficha">
        {rodapeDaFicha(cadastradoEm)}
      </p>
    </section>
  );
}

// A coluna da ficha quando ela não abre um fornecedor: id que não está no cadastro, a leitura que
// falhou (aí com "Tentar de novo"), ou nenhum escolhido ("Toque num fornecedor…", `tracejado` — o
// `vazio` do protótipo). A lista continua ao lado.
export function FichaSemFornecedor({
  frase,
  acao,
  tracejado = false,
}: {
  frase: string;
  acao?: ReactNode;
  tracejado?: boolean;
}) {
  return (
    <section
      role={acao ? "alert" : undefined}
      data-testid="fornecedor-ficha-aviso"
      className={cn(
        "border-borda flex min-w-0 flex-col items-start gap-4 rounded-xl border p-4",
        tracejado ? "border-dashed bg-transparent" : "bg-superficie",
      )}
    >
      <p className="text-corpo text-tinta-media">{frase}</p>
      {acao}
    </section>
  );
}
