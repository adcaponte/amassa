// Os grupos do seletor de pessoa (UI-D5) — módulo puro: nenhuma linha alcança React, o banco ou a
// rede. O mesmo seletor serve ao "Colocar alguém" da folha do evento e ao "Quem" do uso livre
// (plano 09).
//
// Backstop E8·overflow (a UI-SPEC não fixava o teto — decisão do plano 05): cada grupo mostra no
// máximo `LIMITE_DO_SELETOR` pessoas; havendo mais, a tela termina o grupo com "Há mais pessoas com
// esse nome — continue digitando.". A consulta pede um a mais (`LIMITE_DO_SELETOR + 1`) só para
// saber se há mais. Assim a lista nunca empurra a faixa de confirmação e o "Colocar na lista" para
// fora do alcance.
import { ROTULO_GRUPO_A_REPOR } from "./textos";

export const LIMITE_DO_SELETOR = 8;

export type PessoaDoSeletor = {
  id: string;
  nome: string;
  telefone: string | null;
};

export type ChaveDoGrupo = "a_repor" | "demais";

export type GrupoDoSeletor<P extends PessoaDoSeletor = PessoaDoSeletor> = {
  chave: ChaveDoGrupo;
  rotulo: string;
  pessoas: P[];
  // Havia mais do que o teto — a última linha do grupo pede para continuar digitando.
  temMais: boolean;
};

function cortar<P extends PessoaDoSeletor>(pessoas: readonly P[]): { pessoas: P[]; temMais: boolean } {
  return { pessoas: pessoas.slice(0, LIMITE_DO_SELETOR), temMais: pessoas.length > LIMITE_DO_SELETOR };
}

// Os grupos na ordem da UI-SPEC: "Tem aula a repor" (preenchido a partir do plano 08) e depois o
// grupo do contexto ("Inscrever" · "Aula experimental / avulsa" · "Pessoas"). Grupo vazio não
// aparece. Quem já está no grupo "a repor" não se repete no do contexto.
export function gruposDoSeletor<P extends PessoaDoSeletor>({
  aRepor,
  demais,
  rotuloDemais,
}: {
  aRepor: readonly P[];
  demais: readonly P[];
  rotuloDemais: string;
}): GrupoDoSeletor<P>[] {
  const grupos: GrupoDoSeletor<P>[] = [];
  if (aRepor.length > 0) {
    grupos.push({ chave: "a_repor", rotulo: ROTULO_GRUPO_A_REPOR, ...cortar(aRepor) });
  }
  const jaNoPrimeiro = new Set(aRepor.map((pessoa) => pessoa.id));
  const doContexto = demais.filter((pessoa) => !jaNoPrimeiro.has(pessoa.id));
  if (doContexto.length > 0) {
    grupos.push({ chave: "demais", rotulo: rotuloDemais, ...cortar(doContexto) });
  }
  return grupos;
}
