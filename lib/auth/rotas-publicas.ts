// Módulo puro, sem nenhum import: a regra que decide se um caminho pode ser acessado sem
// sessão. É o único módulo que `lib/auth/auth.config.ts` consulta para proteger rotas —
// mantê-lo puro é o que permite testar a regra sem subir middleware nem servidor
// (`tests/unit/rotas-publicas.test.ts`).
//
// Fase 04.6 (D-03): o proxy passou a proteger SÓ `/gestao` — `config.matcher` de
// `middleware.ts` já não alcança rota fora desse prefixo, então esta lista, por si só, já não é
// a única cerca. `/api/health` fica aqui de propósito, como SEGUNDA camada: com o matcher
// estreito ela nunca chega a ser consultada, mas se algum dia alguém alargar o matcher de volta,
// a rota de saúde não pode virar protegida em silêncio — a entrada nesta lista é o que garante
// isso. `/login` (sem prefixo) não existe mais: a tela vive em `/gestao/login`.
export const ROTAS_PUBLICAS = ["/gestao/login", "/api/health"];

export function ehRotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some(
    (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
  );
}
