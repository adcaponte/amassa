// Módulo puro: recebe dados, devolve dados. Não importa React nem o cliente do banco
// (regra da pasta `lib/` em `01-ARQUITETURA.md` §3).
type SaudeDoBanco =
  | { status: "ok"; banco: "ok"; http: 200 }
  | { status: "erro"; banco: "erro"; http: 503 };

export function interpretarSaudeDoBanco(consultaFuncionou: boolean): SaudeDoBanco {
  if (consultaFuncionou) {
    return { status: "ok", banco: "ok", http: 200 };
  }
  return { status: "erro", banco: "erro", http: 503 };
}
