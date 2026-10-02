"use client";

// O endereço atual da Agenda com alguns parâmetros trocados (`null` tira o parâmetro) — lido de
// `window.location` no momento do toque, nunca de um `useSearchParams` de render anterior. Usado
// para abrir e fechar as folhas que não precisam de dado do servidor por `pushState`
// (`irParaSemNavegar`, molde de `?nova=1` da Produção — UI-D8): o "voltar" do Android fecha a
// folha. O `#` (a rolagem até um dia) nunca é levado adiante.
export function enderecoDaAgendaCom(mudancas: Record<string, string | null>): string {
  const parametros = new URLSearchParams(window.location.search);
  for (const [nome, valor] of Object.entries(mudancas)) {
    if (valor === null) {
      parametros.delete(nome);
    } else {
      parametros.set(nome, valor);
    }
  }
  const consulta = parametros.toString();
  return consulta === "" ? window.location.pathname : `${window.location.pathname}?${consulta}`;
}
