import Link from "next/link";

import {
  FRASE_ORIGEM_NAO_ACHADA,
  FRASE_VENDA_EM_MONTAGEM_GUARDADA,
  ROTULO_VER_NO_CAIXA,
  ROTULO_VOLTAR_A_AGENDA_DA_VENDA,
  faixaDaAgenda,
  fraseOrigemJaLancada,
} from "@/lib/agenda/textos";
import { hrefDoCaixa } from "@/lib/financeiro/navegacao";
import {
  FRASE_ORIGEM_QUEIMA_NAO_ACHADA,
  LINHA2_FAIXA_DAS_QUEIMAS,
  ROTULO_ABRIR_O_CATALOGO,
  ROTULO_VOLTAR_AS_QUEIMAS,
  fraseOrigemQueimaTudoLancado,
} from "@/lib/queimas/textos";
import { rotaDeGestao } from "@/lib/rotas/gestao";

const CLASSE_DO_LINK =
  "text-acento inline-flex min-h-[44px] items-center font-semibold underline-offset-4 hover:underline";

export type FaixaDaOrigemProps = {
  titulo: string;
  // A 2ª linha fixa da faixa (as Queimas dizem que o que sair da venda continua em “a cobrar”).
  linha2?: string;
  rotuloVoltar: string;
  hrefVoltar: string;
  // Havia uma venda em montagem no rascunho comum (Pitfall 10): ela continua guardada e a faixa diz.
  haviaVendaEmMontagem: boolean;
  // `{dataTestId}` no bloco e `{dataTestId}-texto` no título — os da Agenda são os de sempre.
  dataTestId: string;
  dataTestIdVoltar: string;
};

// A faixa no topo da Venda aberta por outro módulo (05-UI-SPEC.md §“Venda aberta pela Agenda”, UI-D26;
// 06.4-UI-SPEC.md §““Lançar na Venda” — a Venda aberta pelas Queimas”; contraste A10: `tinta` sobre
// `acento-fundo`, 13,89:1; o link é A9, `acento`, 6,41:1). O texto quebra livre — a 320px, com um nome
// longo, ele desce em quantas linhas precisar — e o “voltar” continua com 44px. Voltar não lança nada: a
// origem fica onde estava (“A receber” da Agenda, “a cobrar” das Queimas). Generalizada na Fase 06.4
// (plano 05): texto, 2ª linha, rótulo e destino do “voltar” por prop; `FaixaDaAgenda` e `FaixaDasQueimas`
// são os dois invólucros.
export function FaixaDaOrigem({
  titulo,
  linha2,
  rotuloVoltar,
  hrefVoltar,
  haviaVendaEmMontagem,
  dataTestId,
  dataTestIdVoltar,
}: FaixaDaOrigemProps) {
  return (
    <div
      data-testid={dataTestId}
      className="bg-acento-fundo text-tinta text-apoio flex flex-col gap-1 rounded-md px-4 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p data-testid={`${dataTestId}-texto`} className="min-w-0 [overflow-wrap:anywhere]">
          {titulo}
        </p>
        <Link data-testid={dataTestIdVoltar} href={hrefVoltar} className={CLASSE_DO_LINK}>
          {rotuloVoltar}
        </Link>
      </div>
      {linha2 ? (
        <p data-testid={`${dataTestId}-linha2`} className="[overflow-wrap:anywhere]">
          {linha2}
        </p>
      ) : null}
      {haviaVendaEmMontagem ? (
        <p data-testid="faixa-em-montagem" className="[overflow-wrap:anywhere]">
          {FRASE_VENDA_EM_MONTAGEM_GUARDADA}
        </p>
      ) : null}
    </div>
  );
}

export type FaixaDaAgendaProps = {
  descricao: string;
  nome: string;
  haviaVendaEmMontagem: boolean;
};

// A faixa “Da Agenda” — igual a antes da Fase 06.4: o mesmo texto, os mesmos `data-testid`
// (`faixa-da-agenda`, `faixa-da-agenda-texto`, `voltar-a-agenda`) e a volta a “A receber”.
export function FaixaDaAgenda({ descricao, nome, haviaVendaEmMontagem }: FaixaDaAgendaProps) {
  return (
    <FaixaDaOrigem
      titulo={faixaDaAgenda(descricao, nome)}
      rotuloVoltar={ROTULO_VOLTAR_A_AGENDA_DA_VENDA}
      hrefVoltar={rotaDeGestao("/agenda?aba=receber")}
      haviaVendaEmMontagem={haviaVendaEmMontagem}
      dataTestId="faixa-da-agenda"
      dataTestIdVoltar="voltar-a-agenda"
    />
  );
}

export type FaixaDasQueimasProps = {
  // “Das Queimas · {Tipo} de {dd/mm} · {forno}” — montado no servidor (`queimaParaVenda`).
  titulo: string;
  haviaVendaEmMontagem: boolean;
};

// A faixa “Das Queimas” (Fase 06.4, plano 05 — QMC-08, D-07): o título, a 2ª linha (o que sair desta
// venda continua em “a cobrar”) e “Voltar às Queimas”.
export function FaixaDasQueimas({ titulo, haviaVendaEmMontagem }: FaixaDasQueimasProps) {
  return (
    <FaixaDaOrigem
      titulo={titulo}
      linha2={LINHA2_FAIXA_DAS_QUEIMAS}
      rotuloVoltar={ROTULO_VOLTAR_AS_QUEIMAS}
      hrefVoltar={rotaDeGestao("/queimas")}
      haviaVendaEmMontagem={haviaVendaEmMontagem}
      dataTestId="faixa-das-queimas"
      dataTestIdVoltar="voltar-as-queimas"
    />
  );
}

export type OrigemIndisponivelProps = {
  // O módulo dono da origem — decide a frase e o link de volta.
  modulo: "agenda" | "queimas";
  // As vendas que a origem já virou (Agenda: uma; Queimas: as ATIVAS que levaram tudo); `null` = a
  // origem não foi achada (ou saiu de “A receber”/“a cobrar”).
  numerosDasVendas: readonly number[] | null;
  // Só nas Queimas: a frase de preço não cadastrado num tamanho que ainda falta (UI-D5).
  frasePreco?: string | null;
};

// No lugar do carrinho, quando a origem já virou venda, não foi achada ou (Queimas) não tem preço
// (05-UI-SPEC.md §Erros “Venda da Agenda — origem inválida”; 06.4-UI-SPEC.md §Erros “Venda — …”): NUNCA
// um carrinho preenchido com dado velho ou sem valor. A frase diz o que aconteceu e o link leva aonde
// resolver — o Caixa (a venda existe), o Catálogo (falta o preço) ou de volta ao módulo da origem.
export function OrigemIndisponivel({ modulo, numerosDasVendas, frasePreco = null }: OrigemIndisponivelProps) {
  const jaLancada = numerosDasVendas !== null && numerosDasVendas.length > 0;
  let frase: string;
  let link: { testId: string; href: string; rotulo: string };
  if (modulo === "agenda") {
    frase = jaLancada ? fraseOrigemJaLancada(numerosDasVendas[0]) : FRASE_ORIGEM_NAO_ACHADA;
    link = jaLancada
      ? { testId: "origem-ver-no-caixa", href: hrefDoCaixa(), rotulo: ROTULO_VER_NO_CAIXA }
      : { testId: "voltar-a-agenda", href: rotaDeGestao("/agenda?aba=receber"), rotulo: ROTULO_VOLTAR_A_AGENDA_DA_VENDA };
  } else if (frasePreco) {
    frase = frasePreco;
    link = {
      testId: "origem-abrir-catalogo",
      href: rotaDeGestao("/cadastros?sub=catalogo"),
      rotulo: ROTULO_ABRIR_O_CATALOGO,
    };
  } else if (jaLancada) {
    frase = fraseOrigemQueimaTudoLancado(numerosDasVendas);
    link = { testId: "origem-ver-no-caixa", href: hrefDoCaixa(), rotulo: ROTULO_VER_NO_CAIXA };
  } else {
    frase = FRASE_ORIGEM_QUEIMA_NAO_ACHADA;
    link = { testId: "voltar-as-queimas", href: rotaDeGestao("/queimas"), rotulo: ROTULO_VOLTAR_AS_QUEIMAS };
  }

  return (
    <div className="px-6 py-6 md:px-8">
      <div
        role="status"
        data-testid="origem-indisponivel"
        className="border-border bg-card flex flex-col items-start gap-2 rounded-lg border p-4"
      >
        <p className="text-corpo text-foreground [overflow-wrap:anywhere]">{frase}</p>
        <Link data-testid={link.testId} href={link.href} className={`${CLASSE_DO_LINK} text-corpo`}>
          {link.rotulo}
        </Link>
      </div>
    </div>
  );
}
