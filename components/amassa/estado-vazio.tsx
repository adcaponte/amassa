import Link from "next/link";

import { Button } from "@/components/ui/button";

// Resolve UI-07 ("frase de contexto e botão") de forma reutilizável — as Fases 3 a 6 trocam
// só as strings passadas, nunca a moldura. Server Component puro: nenhum dado, nenhum efeito,
// nunca tem estado intermediário (nem carregando, nem erro — ver 02b-UI-SPEC.md "Contrato do
// componente de estado vazio").
export type EstadoVazioProps = {
  titulo: string;
  corpo: string;
  // Omitido = sem botão nenhum (caso `/orcamentos`, D-04) — não é um botão desabilitado a
  // menos, é a ausência da própria ideia de ação principal.
  rotuloBotao?: string;
  // Texto abaixo do botão desabilitado, sempre no documento — nunca só em `title`/tooltip,
  // porque precisa ser lido sem interação, inclusive por leitor de tela. Só faz sentido junto
  // de um botão inerte (sem `hrefBotao`) — `/orcamentos` depende dele continuar existindo.
  notaBotao?: string;
  // Presente = o botão vira um `Link` de verdade, habilitado, levando a esta URL — a primeira
  // vez que o botão do estado vazio faz alguma coisa (03-04, índice de Encomendas). Ausente =
  // o comportamento de sempre não muda em nada: botão `disabled` com `aria-disabled="true"`.
  // Mudança aditiva — Agenda, Queimas, Estoque e Orçamentos continuam com o botão inerte sem
  // tocar em uma linha deste arquivo.
  hrefBotao?: string;
  // Segunda forma de botão ativo (plano 07): uma AÇÃO de cliente ("Limpar filtros") em vez de
  // uma navegação — `hrefBotao` não serve porque zerar o filtro não muda de URL. Mutuamente
  // exclusivo com `hrefBotao` na prática (quem chama só passa um dos dois); se os dois vierem,
  // `hrefBotao` vence, por ser o caminho mais antigo e mais testado. Ausente = mesmo botão
  // inerte de sempre, igual à ausência de `hrefBotao`.
  aoClicar?: () => void;
};

export function EstadoVazio({
  titulo,
  corpo,
  rotuloBotao,
  notaBotao,
  hrefBotao,
  aoClicar,
}: EstadoVazioProps) {
  return (
    <div
      className="flex flex-1 items-center justify-center px-6 py-16"
      data-testid="estado-vazio"
    >
      {/* max-w-prose: o texto quebra em linhas, nunca estica a largura inteira da tela nem
          exige rolagem horizontal (UI-06). Sem ícone decorativo — o texto carrega a voz do
          produto (02b-UI-SPEC.md). */}
      <div className="flex max-w-prose flex-col items-center gap-3 text-center">
        <h2 className="text-titulo text-foreground">{titulo}</h2>
        <p className="text-corpo text-muted-foreground">{corpo}</p>

        {rotuloBotao && (
          <div className="mt-3 flex flex-col items-center gap-2">
            {hrefBotao ? (
              <Button asChild variant="default" className="min-h-[44px]">
                <Link href={hrefBotao}>{rotuloBotao}</Link>
              </Button>
            ) : aoClicar ? (
              <Button type="button" variant="default" className="min-h-[44px]" onClick={aoClicar}>
                {rotuloBotao}
              </Button>
            ) : (
              <Button type="button" variant="default" disabled aria-disabled="true">
                {rotuloBotao}
              </Button>
            )}
            {notaBotao && <p className="text-apoio text-muted-foreground">{notaBotao}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
