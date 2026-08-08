// Módulo puro, sem nenhum import: a regra que decide se um caminho pode ser acessado sem
// sessão. É o único módulo que `lib/auth/auth.config.ts` consulta para proteger rotas —
// mantê-lo puro é o que permite testar a regra sem subir middleware nem servidor
// (`tests/unit/rotas-publicas.test.ts`).
export const ROTAS_PUBLICAS = ["/login", "/api/health"];

export function ehRotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some(
    (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
  );
}
