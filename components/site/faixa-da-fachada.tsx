import { ImagemDoSite } from "@/components/site/imagem-do-site";
import { SLOTS_DE_IMAGEM } from "@/conteudo/site";

// D-20 — o ponto central da decisão. Duas regras DIFERENTES para dado faltando, e não podem se
// confundir: colchete em TEXTO ("Rua [nome da rua]") fica e lê como obra em andamento, coerente
// com a faixa "em construção" (SIT-04, componente `onde-fica.tsx`); já um SLOT DE IMAGEM sem
// foto não é texto — é um retângulo tracejado com legenda "foto ainda não recebida" no meio da
// página, e ISSO lê como defeito. (06/10/2026, D-32 da Fase 06.5: o colchete em texto também
// saiu — campo de texto vazio agora não renderiza, a mesma regra desta imagem.) A regra aqui é para a segunda categoria: a faixa da fachada
// devolve `null` INTEIRO — nenhum `<section>`, nenhum `padding` reservando espaço, nenhum
// retângulo, nenhuma legenda, nenhum `<img>` — enquanto `SLOTS_DE_IMAGEM.fachada.arquivo` for
// nulo. `ImagemDoSite` já devolve `null` para o `<Image>` interno; este componente confere o
// MESMO dado ANTES de montar qualquer envelope, porque um `<section>` vazio (mesmo sem
// conteúdo visível) ainda seria uma marca no HTML que este plano proíbe.
//
// O dia em que a foto da fachada chegar: (1) trocar `SLOTS_DE_IMAGEM.fachada.arquivo` de `null`
// para o nome do arquivo em `conteudo/site.ts`, (2) colocar o arquivo em `public/site/`. Nenhum
// componente muda.
export function FaixaDaFachada() {
  if (!SLOTS_DE_IMAGEM.fachada.arquivo) return null;

  return (
    <section
      data-testid="site-faixa-fachada"
      className="relative aspect-[21/9] w-full overflow-hidden md:aspect-[3/1]"
    >
      <ImagemDoSite slot="fachada" sizes="100vw" className="h-full w-full" />
    </section>
  );
}
