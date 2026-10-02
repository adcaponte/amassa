// As gravações de presença e do direito a repor ainda no ar (só no navegador).
//
// Por quê: no Valor central o gestor toca "Veio"/"Faltou" de cada pessoa SEM esperar e já toca
// "Pronto". Se a folha trocasse a URL (tirar `?evento=`) com gravações no ar, a semana de baixo seria
// lida de novo ANTES das últimas gravações — e a tag "marcar presença" ficaria no cartão até o próximo
// recarregamento (achado no e2e `agenda presenca` (a), no celular). A folha fecha NA HORA; só a troca da
// URL espera as gravações terminarem — e nunca mais do que `ESPERA_MAXIMA_MS`.

const ESPERA_MAXIMA_MS = 8000;

let pendentes = 0;
const aoTerminar = new Set<() => void>();

function avisarSeTerminou(): void {
  if (pendentes > 0) {
    return;
  }
  const ouvintes = [...aoTerminar];
  aoTerminar.clear();
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

// Conta a gravação enquanto ela está no ar e devolve a mesma promessa.
export function registrarGravacao<T>(gravacao: Promise<T>): Promise<T> {
  pendentes += 1;
  return gravacao.finally(() => {
    pendentes -= 1;
    avisarSeTerminou();
  });
}

// Roda `acao` quando não houver gravação no ar (na hora, se já não há) — uma vez só.
export function depoisDasGravacoes(acao: () => void): void {
  if (pendentes === 0) {
    acao();
    return;
  }
  let feita = false;
  const umaVez = () => {
    if (!feita) {
      feita = true;
      aoTerminar.delete(umaVez);
      acao();
    }
  };
  aoTerminar.add(umaVez);
  window.setTimeout(umaVez, ESPERA_MAXIMA_MS);
}
