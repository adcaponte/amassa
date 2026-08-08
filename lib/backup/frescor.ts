// Módulo puro: recebe dados, devolve dados. Nenhum import, nenhuma leitura do relógio por
// dentro (regra da pasta `lib/` em `01-ARQUITETURA.md` §3) — o instante atual entra sempre
// como argumento, o que é o que torna as duas fronteiras de 26 horas testáveis sem esperar
// um dia de verdade.
//
// Por que 26 horas, não 24: o dump roda uma vez por dia, de madrugada
// (`01-ARQUITETURA.md` §7 e §9). Uma janela de exatamente 24 horas transformaria qualquer
// atraso de poucos minutos do `cron` num alerta falso; 26 dá folga sem esconder um backup
// de verdade atrasado.
export const JANELA_EM_HORAS = 26;

export type ExecucaoBackup = {
  quando: Date;
  sucesso: boolean;
  destinoExternoOk: boolean;
  mensagem: string | null;
};

export type DecisaoFrescor =
  | {
      status: "ok";
      http: 200;
      motivo: string;
      ultimoBackupEm: string;
      idadeEmHoras: number;
    }
  | {
      status: "erro";
      http: 503;
      motivo: string;
      ultimoBackupEm: string | null;
      idadeEmHoras: number | null;
    };

// Recebe a última linha de `execucoes_backup` (ou null, se a tabela estiver vazia) e o
// instante atual, e devolve status, código HTTP e um motivo em português — o que o alerta
// por e-mail precisa dizer por si só, sem que ninguém tenha de investigar mais nada.
export function decidirFrescorDoBackup(
  ultimaExecucao: ExecucaoBackup | null,
  agora: Date,
): DecisaoFrescor {
  if (!ultimaExecucao) {
    return {
      status: "erro",
      http: 503,
      motivo: "Nenhum backup foi registrado ainda.",
      ultimoBackupEm: null,
      idadeEmHoras: null,
    };
  }

  const idadeEmHoras =
    (agora.getTime() - ultimaExecucao.quando.getTime()) / (60 * 60 * 1000);
  const ultimoBackupEm = ultimaExecucao.quando.toISOString();

  if (idadeEmHoras < 0) {
    return {
      status: "erro",
      http: 503,
      motivo:
        "O instante do último backup está no futuro — confira o relógio do servidor que " +
        "registrou essa execução.",
      ultimoBackupEm,
      idadeEmHoras,
    };
  }

  if (!ultimaExecucao.sucesso) {
    const motivoBase = "A última execução do backup falhou.";
    return {
      status: "erro",
      http: 503,
      motivo: ultimaExecucao.mensagem ? `${motivoBase} ${ultimaExecucao.mensagem}` : motivoBase,
      ultimoBackupEm,
      idadeEmHoras,
    };
  }

  if (!ultimaExecucao.destinoExternoOk) {
    return {
      status: "erro",
      http: 503,
      motivo:
        "O dump existe no servidor, mas não chegou ao armazenamento externo — um backup " +
        "que só existe no servidor não protege contra a perda do servidor.",
      ultimoBackupEm,
      idadeEmHoras,
    };
  }

  if (idadeEmHoras > JANELA_EM_HORAS) {
    return {
      status: "erro",
      http: 503,
      motivo:
        `O último backup foi há ${idadeEmHoras.toFixed(1)} horas — mais do que as ` +
        `${JANELA_EM_HORAS} horas toleradas.`,
      ultimoBackupEm,
      idadeEmHoras,
    };
  }

  return {
    status: "ok",
    http: 200,
    motivo: `Último backup há ${idadeEmHoras.toFixed(1)} horas, dentro da janela de ${JANELA_EM_HORAS} horas.`,
    ultimoBackupEm,
    idadeEmHoras,
  };
}
