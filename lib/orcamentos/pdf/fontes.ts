// Registra, uma vez só por processo, as fontes que o PDF do orçamento embute.
//
// 🔴 SEM ISTO, OS ACENTOS SAEM ERRADOS. As 14 fontes padrão do formato PDF (Helvetica,
// Times-Roman etc.) cobrem só o alfabeto ASCII básico — "Orçamento", "José" e "Conceição"
// sairiam quebrados ou ausentes (04.5-RESEARCH.md, Pitfall 1). `@react-pdf/renderer` precisa dos
// BYTES de um arquivo de fonte real via `Font.register({ src })` — não existe integração com
// `next/font` (o mecanismo que `app/layout.tsx` usa para a INTERFACE): são dois mecanismos
// diferentes, um serve CSS/WOFF2 para o navegador, o outro embute o glifo dentro do PDF. Não há
// caminho que reaproveite a fonte da interface para o PDF.
//
// 🔴 Os `.ttf` em `assets/fontes/` são a única forma de dar ao `@react-pdf/renderer` os bytes que
// ele exige. Quando entraram (26/09/2026) eram exceção à convenção de então de `app/layout.tsx`,
// "nenhum arquivo de fonte é versionado"; desde 02/10/2026 a interface também versiona as suas
// (`.woff2` em `app/_fontes/`, janela 60) e essa convenção deixou de existir. Ver `assets/fontes/README.md` para a
// proveniência e a licença (SIL Open Font License 1.1 — permite redistribuição, inclusive em
// repositório público e uso comercial).
import path from "node:path";

import { Font } from "@react-pdf/renderer";

export const FAMILIA_CORPO = "Inter";
export const FAMILIA_TITULO = "Archivo Narrow";

let registrada = false;

function caminhoDaFonte(nomeDoArquivo: string): string {
  return path.join(process.cwd(), "assets", "fontes", nomeDoArquivo);
}

// Idempotente: `@react-pdf/renderer` mantém um registro global de fontes por processo Node —
// chamar `Font.register` duas vezes com a mesma família é inofensivo, mas o `if` evita I/O
// redundante a cada PDF gerado (a rota chama esta função em toda requisição).
export function registrarFontesDoPdf(): void {
  if (registrada) return;

  Font.register({
    family: FAMILIA_CORPO,
    fonts: [
      { src: caminhoDaFonte("Inter-Regular.ttf") },
      { src: caminhoDaFonte("Inter-Bold.ttf"), fontWeight: "bold" },
      // A nota do feito à mão (rodapé) é itálica na tipografia de papel do documento
      // (04.5-UI-SPEC.md §Typography) — sem este registro, `@react-pdf/renderer` lança
      // "Could not resolve font for Inter, fontWeight 400, fontStyle italic" na hora de
      // renderizar (erro real encontrado nesta execução, não hipotético).
      { src: caminhoDaFonte("Inter-Italic.ttf"), fontStyle: "italic" },
    ],
  });

  // Só o peso 700 (o título da folha, 28px, é sempre em negrito na tipografia de papel do
  // documento — 04.5-UI-SPEC.md §Typography) — nenhum uso em corpo de texto precisa desta
  // família em peso normal.
  Font.register({
    family: FAMILIA_TITULO,
    fonts: [{ src: caminhoDaFonte("ArchivoNarrow-Bold.ttf"), fontWeight: "bold" }],
  });

  registrada = true;
}
