// Fase 06.5, plano 21 (D-32, UI-D18): quais fotos entram na faixa do Instagram do site. Módulo puro —
// não importa React, nem o banco, nem `conteudo/site.ts`: recebe a lista e devolve a lista.
//
// Duas regras do contrato: foto sem `alt` (vazio ou só espaço) fica de fora — o site não publica
// imagem que leitor de tela não consiga descrever; e no máximo 6 aparecem, na ordem dada. As que
// passarem de 6 não entram. Lista vazia devolve vazia, e a faixa não renderiza.

export const MAXIMO_DE_FOTOS_NA_FAIXA = 6;

export type FotoDaFaixa = { readonly arquivo: string; readonly alt: string };

export function fotosDaFaixa(lista: readonly FotoDaFaixa[]): FotoDaFaixa[] {
  return lista
    .filter((foto) => foto.alt.trim().length > 0 && foto.arquivo.trim().length > 0)
    .slice(0, MAXIMO_DE_FOTOS_NA_FAIXA)
    .map((foto) => ({ arquivo: foto.arquivo.trim(), alt: foto.alt.trim() }));
}
