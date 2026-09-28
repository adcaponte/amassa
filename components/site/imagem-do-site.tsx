import Image from "next/image";

import { SLOTS_DE_IMAGEM, type SlotDeImagem } from "@/conteudo/site";

// D-20: slot de imagem sem foto NÃO RENDERIZA — nenhum retângulo, nenhuma moldura, nenhuma
// legenda "foto ainda não recebida" no lugar. Colchete em TEXTO ("Rua [nome da rua]") lê como
// obra em andamento, coerente com a faixa "em construção"; um retângulo tracejado no meio da
// página lê como defeito — as duas coisas seguem regras diferentes, e o vazio deste componente
// é a regra do retângulo. `fachada` e `mapa` sobem com `arquivo: null` neste plano; o plano 04
// é quem exercita este caminho de verdade.
type ImagemDoSiteProps = {
  slot: SlotDeImagem;
  sizes?: string;
  className?: string;
};

export function ImagemDoSite({
  slot,
  sizes = "(min-width: 768px) 45vw, 100vw",
  className,
}: ImagemDoSiteProps) {
  const dados = SLOTS_DE_IMAGEM[slot];

  if (!dados.arquivo) return null;

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      <Image src={`/site/${dados.arquivo}`} alt={dados.alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}
