// "Uma vez por envio" para os lançamentos da Agenda (WR-06 da revisão B da Fase 5).
//
// `lancarTurma`, `lancarAvulsa`, `reservarUsoLivre` e `fecharDia` são `insert`s sem chave natural: dois
// lançamentos iguais são, de propósito, dois registros (briefing §2.8). O risco é a RESPOSTA PERDIDA no
// celular: o servidor gravou, a tela recebeu erro de rede, o gestor toca de novo e nasce a segunda turma
// (com N datas repetidas e, se pública, um segundo cartão no site). A folha "Lançar na agenda" gera uma
// `chaveDeEnvio` ao abrir e a manda em toda tentativa; aqui, a mesma chave — da mesma pessoa, na mesma ação
// e com os mesmos dados — devolve o MESMO resultado em vez de gravar de novo. Uma segunda tentativa que
// chegue com a primeira ainda no ar espera por ela (a promessa é guardada antes de começar).
//
// Só o SUCESSO fica guardado: recusa ou falha libera a chave, para "tentar de novo" de fato tentar.
//
// Limite consciente (sem migração — o código vai ao ar antes de qualquer `db:migrate`): o registro vive na
// memória do processo do app (o servidor roda UM processo Node). Reiniciar o app no exato intervalo entre
// a resposta perdida e o novo toque esquece a chave. A validade é de 10 minutos.
//
// SEM a diretiva de Server Action: este módulo nunca é chamado do navegador, só pelas ações de
// `lib/agenda/acoes.ts`, depois de `exigirUsuario()`.
import { z } from "zod";

const VALIDADE_MS = 10 * 60 * 1000;

type Registro = { expiraEm: number; resultado: Promise<{ ok: boolean }> };

// Em `globalThis`: o mesmo mapa mesmo que o empacotador do Next carregue este módulo mais de uma vez.
const raiz = globalThis as typeof globalThis & { __amassaEnviosDaAgenda?: Map<string, Registro> };
const registros: Map<string, Registro> = (raiz.__amassaEnviosDaAgenda ??= new Map());

const esquemaDaChave = z.object({ chaveDeEnvio: z.uuid() });

// A chave do envio, ou `null` quando a tela não mandou uma válida (aí cada chamada grava, como antes).
export function chaveDoEnvio(usuarioId: string, acao: string, entradaBruta: unknown, dados: unknown): string | null {
  const lida = esquemaDaChave.safeParse(entradaBruta);
  if (!lida.success) {
    return null;
  }
  return `${usuarioId}|${acao}|${lida.data.chaveDeEnvio}|${JSON.stringify(dados)}`;
}

function esquecerVencidos(agora: number): void {
  for (const [chave, registro] of registros) {
    if (registro.expiraEm <= agora) {
      registros.delete(chave);
    }
  }
}

export function umaVezPorEnvio<T extends { ok: boolean }>(chave: string | null, gravar: () => Promise<T>): Promise<T> {
  if (chave === null) {
    return gravar();
  }
  const agora = Date.now();
  esquecerVencidos(agora);
  const existente = registros.get(chave);
  if (existente) {
    return existente.resultado as Promise<T>;
  }
  const resultado = gravar();
  registros.set(chave, { expiraEm: agora + VALIDADE_MS, resultado });
  resultado.then(
    (resposta) => {
      if (!resposta.ok) {
        registros.delete(chave);
      }
    },
    () => {
      registros.delete(chave);
    },
  );
  return resultado;
}
