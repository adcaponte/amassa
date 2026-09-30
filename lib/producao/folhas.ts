// Módulo puro da Produção (Fase 06.1, plano 13 — PRD-19, PRD-20) — o CONTEÚDO das duas folhas A4 da
// bancada: a folha da ordem (a que fica junto das peças na prateleira) e a folha geral (o quadro no
// papel, por etapa). Nenhuma linha alcança React, Next, drizzle-orm, pg ou `@/db`; "hoje" é sempre
// argumento (`YYYY-MM-DD`). As frases ficam em `textos.ts`; aqui só os dados de cada linha.
//
// A folha da ordem é folha de bancada: o tipo `FolhaDaOrdem` NÃO TEM campo de dinheiro — nem
// opcional. A defesa é por construção (a consulta não seleciona dinheiro e o tipo não o carrega),
// nunca por esconder na tela; `tests/unit/producao-folhas.test.ts` percorre todas as chaves.
//
// Nenhuma regra reescrita: etapa atual, dias nesta etapa e previsto vêm de `leitura.ts`; o
// material previsto de `material.ts` (esmalte zerado no caminho biscoito); rótulos de `etapas.ts`;
// a ordem dentro da seção de `quadro.ts`; o peso ("850 g" / "1,25 kg") é o MESMO texto do bloco da
// tela — `textoDePeso` (`./peso`, regra do dono de 30/09/2026).
import {
  rotuloDaColuna,
  rotuloDaEtapa,
  type CaminhoOrdem,
  type EtapaProducao,
  type StatusOrdem,
  type TipoOrdem,
} from "./etapas";
import { etapasOrdenadas, leituraDaOrdem, type EtapaDaOrdem, type OrdemParaLeitura } from "./leitura";
import { materialPrevisto } from "./material";
import { textoDePeso } from "./peso";
import { colunasDoQuadro, ordenarNaColuna } from "./quadro";
import { formatarDataCompleta } from "./textos";

// ---------------------------------------------------------------------------------------------
// A folha da ordem (PRD-19).
// ---------------------------------------------------------------------------------------------

// A ficha da peça no que a bancada precisa: as gramas e as medidas — lidas AO VIVO pela
// `ficha_id`. `null` = peça sem ficha (D-04).
export type FichaParaAFolha = {
  argilaMiligramas: number;
  esmalteMiligramas: number;
  larguraMm: number;
  profundidadeMm: number;
  alturaMm: number;
};

export type PecaParaAFolha = {
  posicao: number;
  descricao: string;
  quantidade: number;
  aMais: number;
  cor: string | null;
  personalizacao: string | null;
  ficha: FichaParaAFolha | null;
};

// O que `ordemParaAFolha` (consultas.ts) carrega — só as colunas que a folha usa.
export type OrdemParaAFolha = OrdemParaLeitura & {
  numero: number;
  nome: string;
  clienteNome: string | null;
  // "ORC-2026-014" do orçamento que abriu a ordem; `null` sem orçamento.
  orcamentoNumero: string | null;
  // Os ids de `orcamento_fotos`, na ordem do orçamento.
  fotos: readonly string[];
  pecas: readonly PecaParaAFolha[];
};

export type EstadoNaRegua = "feita" | "atual" | "futura";

export type EtapaNaRegua = { etapa: EtapaProducao; rotulo: string; estado: EstadoNaRegua };

export type PecaDaFolha = {
  descricao: string;
  cor: string | null;
  personalizacao: string | null;
  // Casa: "—" (não há pedido de cliente).
  pedido: number | "—";
  aMais: number;
  // Pedido + a mais: o que a bancada faz.
  fazer: number;
  // "350 g" de argila por peça ("1,2 kg" a partir de 1 000 g — `textoDePeso`); sem ficha "—".
  argila: string;
  // "9,5 × 8 × 10,5" (cm); sem ficha ou sem medida "—".
  medidas: string;
};

export type EtapaDaFolha = {
  etapa: EtapaProducao;
  rotulo: string;
  diasPrevistos: number;
  feita: boolean;
  // "05/10/2026" nas feitas; `null` nas outras (a folha mostra a linha de escrever).
  feitaEm: string | null;
};

export type MaterialDaFolha =
  | { tipo: "sem-ficha" }
  | {
      tipo: "previsto";
      // "4,2 kg" / "850 g", com a unidade (`textoDePeso`, 30/09/2026).
      argila: string;
      // `null` no caminho biscoito e quando o previsto é 0 — a linha some.
      esmalte: string | null;
      // Peças FEITAS (pedido + a mais) sem ficha, fora do previsto.
      pecasSemFicha: number;
    };

export type FolhaDaOrdem = {
  tipo: TipoOrdem;
  caminho: CaminhoOrdem;
  numero: number;
  nome: string;
  clienteNome: string | null;
  orcamentoNumero: string | null;
  // "18/12/2026"; `null` sem entrega prometida (o selo some).
  entrega: string | null;
  // "01/10/2026"; `null` = "ainda não começou".
  inicio: string | null;
  regua: EtapaNaRegua[];
  pecas: PecaDaFolha[];
  fotos: string[];
  etapas: EtapaDaFolha[];
  material: MaterialDaFolha;
  // "No fim": encomenda "Perdidas ___ Extras boas ___"; casa "Perdidas ___ Boas ___".
  noFim: "extras" | "boas";
};

const TRACO = "—";

const CENTIMETRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

// "27 × 27 × 3" a partir de milímetros inteiros — uma casa decimal pt-BR, sem casa quando inteiro.
// Algum lado 0 (a ficha recém-criada é válida, mas sem medida): "—".
export function medidasEmCm(larguraMm: number, profundidadeMm: number, alturaMm: number): string {
  const lados = [larguraMm, profundidadeMm, alturaMm];
  if (lados.some((lado) => !(lado > 0))) {
    return TRACO;
  }
  return lados.map((lado) => CENTIMETRO.format(lado / 10)).join(" × ");
}

function reguaDaOrdem(status: StatusOrdem, etapas: readonly EtapaDaOrdem[]): EstadoNaRegua[] {
  // Só a ativa tem etapa atual; aguardando e cancelada param nas feitas, concluída tem todas.
  const indiceAtual = status === "ativa" ? etapas.findIndex((etapa) => etapa.feitaEm === null) : -1;
  return etapas.map((etapa, indice) =>
    etapa.feitaEm !== null ? "feita" : indice === indiceAtual ? "atual" : "futura",
  );
}

export function linhasDaFolhaDaOrdem(ordem: OrdemParaAFolha): FolhaDaOrdem {
  const daCasa = ordem.tipo === "casa";
  const etapas = etapasOrdenadas(ordem);
  const estados = reguaDaOrdem(ordem.status, etapas);
  const pecas = [...ordem.pecas].sort((a, b) => a.posicao - b.posicao);

  const previsto = materialPrevisto(pecas, ordem.caminho);
  const algumaComFicha = pecas.some((peca) => peca.ficha !== null);

  return {
    tipo: ordem.tipo,
    caminho: ordem.caminho,
    numero: ordem.numero,
    nome: ordem.nome,
    clienteNome: ordem.clienteNome,
    orcamentoNumero: ordem.orcamentoNumero,
    entrega: ordem.entregaPrometida === null ? null : formatarDataCompleta(ordem.entregaPrometida),
    inicio: ordem.inicio === null ? null : formatarDataCompleta(ordem.inicio),
    regua: etapas.map((etapa, indice) => ({
      etapa: etapa.etapa,
      rotulo: rotuloDaEtapa(etapa.etapa, ordem.tipo),
      estado: estados[indice],
    })),
    pecas: pecas.map((peca) => ({
      descricao: peca.descricao,
      cor: peca.cor,
      personalizacao: peca.personalizacao,
      pedido: daCasa ? TRACO : peca.quantidade,
      aMais: peca.aMais,
      fazer: peca.quantidade + peca.aMais,
      argila: peca.ficha === null ? TRACO : textoDePeso(peca.ficha.argilaMiligramas),
      medidas:
        peca.ficha === null
          ? TRACO
          : medidasEmCm(peca.ficha.larguraMm, peca.ficha.profundidadeMm, peca.ficha.alturaMm),
    })),
    fotos: [...ordem.fotos],
    etapas: etapas.map((etapa) => ({
      etapa: etapa.etapa,
      rotulo: rotuloDaEtapa(etapa.etapa, ordem.tipo),
      diasPrevistos: etapa.diasPrevistos,
      feita: etapa.feitaEm !== null,
      feitaEm: etapa.feitaEm === null ? null : formatarDataCompleta(etapa.feitaEm),
    })),
    material: algumaComFicha
      ? {
          tipo: "previsto",
          argila: textoDePeso(previsto.argilaMg),
          esmalte: previsto.esmalteMg > 0 ? textoDePeso(previsto.esmalteMg) : null,
          pecasSemFicha: previsto.pecasSemFicha,
        }
      : { tipo: "sem-ficha" },
    noFim: daCasa ? "boas" : "extras",
  };
}

// ---------------------------------------------------------------------------------------------
// A folha geral (PRD-20).
// ---------------------------------------------------------------------------------------------

// O que `ordensParaAFolhaGeral` (consultas.ts) carrega: as ordens com etapas e os totais de peças.
export type OrdemParaAFolhaGeral = OrdemParaLeitura & {
  id: string;
  nome: string;
  clienteNome: string | null;
  totalPecas: number;
  totalAMais: number;
};

export type LinhaDaFolhaGeral = {
  id: string;
  nome: string;
  clienteNome: string | null;
  daCasa: boolean;
  // Feitas: pedido + a mais.
  pecas: number;
  // O parcial da etapa atual ("{x} já passaram"); `null` quando não há (nem 0).
  passaram: number | null;
  diasNestaEtapa: number;
  previsto: number;
  // "18/12/2026" ou `null` ("—").
  entrega: string | null;
};

export type LinhaAguardandoNaFolha = {
  id: string;
  nome: string;
  clienteNome: string | null;
  daCasa: boolean;
  pecas: number;
  entrega: string | null;
};

export type SecaoDaFolhaGeral = {
  etapa: EtapaProducao;
  // "Produção", …, "Entrega / estoque" — o nome da coluna do quadro.
  rotulo: string;
  linhas: LinhaDaFolhaGeral[];
};

export type FolhaGeral = {
  // Nenhuma ordem liberada nem aguardando: "Nada para imprimir."
  vazia: boolean;
  // Só as etapas que têm ordem, na ordem fixa das colunas.
  secoes: SecaoDaFolhaGeral[];
  // "Aguardando sinal", à parte — a folha a imprime no FIM.
  aguardando: LinhaAguardandoNaFolha[];
  // "{n} ordens · {p} peças" do cabeçalho: SÓ as liberadas.
  totalOrdens: number;
  totalPecas: number;
};

function feitasDa(ordem: OrdemParaAFolhaGeral): number {
  return ordem.totalPecas + ordem.totalAMais;
}

export function secoesDaFolhaGeral<T extends OrdemParaAFolhaGeral>(
  ordens: readonly T[],
  hoje: string,
): FolhaGeral {
  const ativas = ordens.filter((ordem) => ordem.status === "ativa");
  const aguardando = ordenarNaColuna(ordens.filter((ordem) => ordem.status === "aguardando_sinal"));

  const secoes = colunasDoQuadro(ativas)
    .filter((coluna) => coluna.ordens.length > 0)
    .map((coluna) => ({
      etapa: coluna.etapa,
      rotulo: rotuloDaColuna(coluna.etapa),
      linhas: coluna.ordens.map((ordem): LinhaDaFolhaGeral => {
        const leitura = leituraDaOrdem(ordem, hoje);
        // `colunasDoQuadro` só põe ordem ativa com etapa atual — a leitura é "em-andamento".
        const diasNestaEtapa = leitura.tipo === "em-andamento" ? leitura.diasNestaEtapa : 0;
        const atual = etapasOrdenadas(ordem).find((etapa) => etapa.etapa === coluna.etapa);
        const passaram = atual?.passaram ?? null;
        return {
          id: ordem.id,
          nome: ordem.nome,
          clienteNome: ordem.clienteNome,
          daCasa: ordem.tipo === "casa",
          pecas: feitasDa(ordem),
          passaram: passaram !== null && passaram > 0 ? passaram : null,
          diasNestaEtapa,
          previsto: atual?.diasPrevistos ?? 0,
          entrega:
            ordem.entregaPrometida === null ? null : formatarDataCompleta(ordem.entregaPrometida),
        };
      }),
    }));

  return {
    vazia: ativas.length === 0 && aguardando.length === 0,
    secoes,
    aguardando: aguardando.map((ordem) => ({
      id: ordem.id,
      nome: ordem.nome,
      clienteNome: ordem.clienteNome,
      daCasa: ordem.tipo === "casa",
      pecas: feitasDa(ordem),
      entrega:
        ordem.entregaPrometida === null ? null : formatarDataCompleta(ordem.entregaPrometida),
    })),
    totalOrdens: ativas.length,
    totalPecas: ativas.reduce((total, ordem) => total + feitasDa(ordem), 0),
  };
}
