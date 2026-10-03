// Módulo puro de Fornecedores — a BUSCA da lista (Fase 06.2, plano 03; FRN-04). Só um import, de tipo e
// da ordem das áreas (`./esquemas`, que lê só o Zod); nenhuma linha alcança React, Next, drizzle-orm,
// pg ou `@/db` (grep de aceite do plano 06.2-03). É a ÚNICA regra de normalização da busca: a lista
// de Cadastros → Fornecedores só chama, e o campo "Fornecedor" da Despesa (plano 10) reaproveita
// `normalizar`.
//
// A lista é pequena (dezenas): vem inteira do servidor (`listarFornecedores`) e é filtrada aqui,
// enquanto a pessoa digita (06.2-RESEARCH.md, Pattern 5). Se um dia passar de centenas, a busca vai
// para o servidor no molde de `listarClientes` — não agora.
import { AREAS_DO_FORNECEDOR, type AreaDoFornecedor } from "./esquemas";

// O que a busca precisa de cada fornecedor. Quem chama pode passar mais campos (a contagem de
// anexos, por exemplo): as funções devolvem o MESMO objeto, com tudo o que ele trazia.
export type FornecedorParaBusca = {
  id: string;
  nome: string;
  vende: string | null;
  area: AreaDoFornecedor;
  cidadeEntrega: string | null;
  ativo: boolean;
};

// O estado dos filtros da lista — estado do cliente: sobrevive à troca de ficha, não a recarregar
// (06.2-UI-SPEC.md, UI-D15).
export type FiltrosDaLista = {
  termo: string;
  area: AreaDoFornecedor | "tudo";
  mostrarDesativados: boolean;
};

export type EstadoDaLista = "vazio-total" | "so-desativados" | "sem-resultado" | "com-itens";

// A mesma regra de `nome_normalizado()` do banco, em JS: decompõe (NFD), tira as marcas combinantes
// (acentos, cedilha, mácron), minúsculas, colapsa espaços e apara. Vale para o termo E para o texto
// em que se procura — "ÇÃO" casa "cao".
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Ordem da tela: alfabética em pt-BR sem diferença de caixa nem de acento, desempate pelo id — dois
// nomes iguais (um ativo e um desativado) saem sempre na mesma ordem. A mesma regra de
// `listarFornecedores` no servidor; aqui ela garante a ordem do que o filtro devolve.
function compararFornecedores(a: FornecedorParaBusca, b: FornecedorParaBusca): number {
  const porNome = a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  if (porNome !== 0) {
    return porNome;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function ordenarFornecedores<T extends FornecedorParaBusca>(lista: readonly T[]): T[] {
  return [...lista].sort(compararFornecedores);
}

function casaComOTermo(fornecedor: FornecedorParaBusca, termoNormalizado: string): boolean {
  if (termoNormalizado === "") {
    return true;
  }
  return [fornecedor.nome, fornecedor.vende ?? "", fornecedor.cidadeEntrega ?? ""].some((campo) =>
    normalizar(campo).includes(termoNormalizado),
  );
}

// O que a lista mostra: o termo (normalizado) contido no nome, no "vende" OU na cidade; a área
// escolhida; os desativados só com o filtro ligado. Cada fornecedor aparece uma vez, por mais campos
// que case — o filtro percorre a lista, não os campos.
export function filtrarFornecedores<T extends FornecedorParaBusca>(lista: readonly T[], filtros: FiltrosDaLista): T[] {
  const termo = normalizar(filtros.termo);
  return ordenarFornecedores(
    lista.filter(
      (fornecedor) =>
        (filtros.mostrarDesativados || fornecedor.ativo) &&
        (filtros.area === "tudo" || fornecedor.area === filtros.area) &&
        casaComOTermo(fornecedor, termo),
    ),
  );
}

// As pílulas de área: as áreas que têm fornecedor ATIVO (com os desativados à mostra, também as
// deles), na ordem do protótipo (Peças · Cafeteria · Loja · Espaço · Geral). Com uma área só (ou
// nenhuma) não há o que filtrar: lista vazia, e as pílulas não aparecem.
export function areasDoFiltro(lista: readonly FornecedorParaBusca[], mostrarDesativados: boolean): AreaDoFornecedor[] {
  const presentes = new Set(
    lista.filter((fornecedor) => mostrarDesativados || fornecedor.ativo).map((fornecedor) => fornecedor.area),
  );
  const areas = AREAS_DO_FORNECEDOR.filter((area) => presentes.has(area));
  return areas.length > 1 ? areas : [];
}

export function contarDesativados(lista: readonly FornecedorParaBusca[]): number {
  return lista.filter((fornecedor) => !fornecedor.ativo).length;
}

// Qual estado a lista desenha:
//   - "vazio-total": nenhum fornecedor, nem ativo nem desativado (o `EstadoVazio`);
//   - "so-desativados": nenhum ativo e os desativados escondidos ("Nenhum fornecedor ativo.");
//   - "sem-resultado": a busca/o filtro não acha ninguém ("Nenhum fornecedor com “…”.");
//   - "com-itens": há linhas a mostrar.
export function estadoDaLista(lista: readonly FornecedorParaBusca[], filtros: FiltrosDaLista): EstadoDaLista {
  if (lista.length === 0) {
    return "vazio-total";
  }
  if (!filtros.mostrarDesativados && lista.every((fornecedor) => !fornecedor.ativo)) {
    return "so-desativados";
  }
  return filtrarFornecedores(lista, filtros).length > 0 ? "com-itens" : "sem-resultado";
}

// As etiquetas de "vende" na ficha: separado por vírgula, cada item aparado, sem itens vazios
// ("argila, , esmalte," → ["argila", "esmalte"]).
export function itensDeVende(vende: string | null | undefined): string[] {
  if (!vende) {
    return [];
  }
  return vende
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
