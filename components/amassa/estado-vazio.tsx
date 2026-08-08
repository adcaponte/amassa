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
  // porque precisa ser lido sem interação, inclusive por leitor de tela.
  notaBotao?: string;
};

export function EstadoVazio({ titulo, corpo, rotuloBotao, notaBotao }: EstadoVazioProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      {/* max-w-prose: o texto quebra em linhas, nunca estica a largura inteira da tela nem
          exige rolagem horizontal (UI-06). Sem ícone decorativo — o texto carrega a voz do
          produto (02b-UI-SPEC.md). */}
      <div className="flex max-w-prose flex-col items-center gap-3 text-center">
        <h2 className="text-titulo text-foreground">{titulo}</h2>
        <p className="text-corpo text-muted-foreground">{corpo}</p>

        {rotuloBotao && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Button type="button" variant="default" disabled aria-disabled="true">
              {rotuloBotao}
            </Button>
            {notaBotao && <p className="text-apoio text-muted-foreground">{notaBotao}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
