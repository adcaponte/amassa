// Módulo puro, sem nenhum import — mesmo molde de `lib/auth/rotas-publicas.ts`. Nasce aqui, na
// Agenda, e não em `lib/inicio/`, porque `LUGARES_DO_ESPACO` é uma regra do módulo da Agenda
// (GES-09): quando a Agenda existir de verdade, é este arquivo que ganha a consulta de
// ocupação real, e o Início continua só chamando `ocupacaoDoEspaco`.
//
// 🔴 O valor 10 veio do protótipo aprovado ("3 de 10 lugares", `prototipo-gestao.html`), NÃO de
// uma medição do espaço físico — sinalizado no SUMMARY deste plano para o dono confirmar.
// Trocar a capacidade depois é editar esta linha, nunca uma migração.
export const LUGARES_DO_ESPACO = 10;

// "N de M lugares" — a linha permanente do bloco da Agenda (D-07): aparece mesmo em dia vazio
// ("0 de 10 lugares"), porque é a única informação que dá o número de relance.
export function ocupacaoDoEspaco(ocupados: number): string {
  return `${ocupados} de ${LUGARES_DO_ESPACO} lugares`;
}
