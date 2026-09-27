// A logo do documento (D-09): um ARQUIVO trocável, nunca uma constante no código. Até a arte da
// Andressa chegar, `logoDoDocumento()` devolve `null` e o documento mostra o nome do ateliê em
// texto — exatamente como a tela e o PDF já fazem hoje sem nenhuma imagem.
import { promises as fs } from "node:fs";
import path from "node:path";

// Caminho configurável, com um padrão sensato (`assets/logo/amassa.png`) — o dono pode trocar o
// arquivo em produção sem precisar de deploy nenhum: só substitui o arquivo no caminho que
// `CAMINHO_LOGO` aponta (ou grava em `assets/logo/amassa.png`, o padrão).
function caminhoDaLogo(): string {
  return process.env.CAMINHO_LOGO || path.join(process.cwd(), "assets", "logo", "amassa.png");
}

// `null` quando o arquivo não existe (ENOENT) — o chamador (lib/orcamentos/pdf/documento.tsx)
// decide o que fazer no lugar (o nome do ateliê em texto). Qualquer outro erro de leitura (ex.:
// permissão) propaga — não é o caso "arquivo trocável ainda não chegou", é uma falha real que
// não deve ser escondida atrás de "sem logo".
export async function logoDoDocumento(): Promise<Buffer | null> {
  try {
    return await fs.readFile(caminhoDaLogo());
  } catch (erro) {
    if (erro instanceof Error && "code" in erro && erro.code === "ENOENT") {
      return null;
    }
    throw erro;
  }
}
