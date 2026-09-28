// A arte decorativa em aquarela do protótipo — provisória até as ilustrações da Andressa
// existirem (fora desta fase). `aria-hidden` e `pointer-events: none`: é decoração, nunca
// conteúdo nem alvo de clique. Slot OPCIONAL por seção — nenhuma seção deste plano usa isto
// ainda; o plano 04 é quem preenche `#espaco`, `#agenda`, `#encomendas` e `#onde`.
type DecoracaoProps = {
  // Nome do arquivo dentro de `public/site/decoracao/` (ex.: "flor-a.svg").
  arquivo: string;
  className?: string;
  // A flor "e" do protótipo é BYTE A BYTE igual à flor "b", só espelhada horizontalmente — o
  // protótipo reaproveita o mesmo desenho em vez de um quinto arquivo, e este componente
  // reproduz o mesmo espelhamento por CSS em vez de duplicar o SVG.
  espelhar?: boolean;
};

export function Decoracao({ arquivo, className, espelhar }: DecoracaoProps) {
  return (
    // Arte vetorial decorativa (SVG puro em public/site/decoracao/) — next/image otimiza
    // JPEG/PNG por raster, não se aplica aqui, e o `next.config.ts` não libera SVG remoto.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/site/decoracao/${arquivo}`}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none absolute z-0 opacity-85 ${espelhar ? "-scale-x-100" : ""} ${className ?? ""}`}
    />
  );
}
