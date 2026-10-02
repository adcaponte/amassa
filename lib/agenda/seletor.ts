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
  // Só no grupo "Tem aula a repor": quantas aulas a pessoa tem a repor (sempre > 0). Escolhida nesse
  // grupo, ela entra como REPOSIÇÃO; em qualquer outro grupo o campo não existe.
  aRepor?: number;
};

// Quem tem aula a repor, com o saldo já calculado no servidor (`creditosPorCliente`) — o cliente nunca
// decide quem tem crédito.
export type PessoaComSaldo<P extends PessoaDoSeletor = PessoaDoSeletor> = {
  cliente: P;
  saldo: number;
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

// Os grupos na ordem da UI-SPEC: "Tem aula a repor" PRIMEIRO (AGE-10 · ordering) e depois o grupo do
// contexto ("Inscrever" · "Aula experimental / avulsa" · "Pessoas"). Grupo vazio não aparece (AGE-10 ·
// empty). Saldo 0 não entra no primeiro grupo (AGE-09 · boundary). Quem tem aula a repor aparece nos DOIS
// grupos (BRIEFING §4: "a lista oferece primeiro quem tem aula a repor … e DEPOIS QUALQUER PESSOA";
// protótipo l.309): escolhida no primeiro, entra como reposição; no do contexto, segue o caminho normal da
// data (oficina → inscrição paga; turma → experimental) — por isso a pessoa do contexto nunca leva `aRepor`.
export function gruposDoSeletor<P extends PessoaDoSeletor>({
  aRepor,
  demais,
  rotuloDemais,
}: {
  aRepor: readonly PessoaComSaldo<P>[];
  demais: readonly P[];
  rotuloDemais: string;
}): GrupoDoSeletor<P>[] {
  const grupos: GrupoDoSeletor<P>[] = [];
  const comSaldo = aRepor
    .filter((item) => item.saldo > 0)
    .map((item): P => ({ ...item.cliente, aRepor: item.saldo }));
  if (comSaldo.length > 0) {
    grupos.push({ chave: "a_repor", rotulo: ROTULO_GRUPO_A_REPOR, ...cortar(comSaldo) });
  }
  const doContexto = demais.map((pessoa): P => (pessoa.aRepor === undefined ? pessoa : { ...pessoa, aRepor: undefined }));
  if (doContexto.length > 0) {
    grupos.push({ chave: "demais", rotulo: rotuloDemais, ...cortar(doContexto) });
  }
  return grupos;
}
