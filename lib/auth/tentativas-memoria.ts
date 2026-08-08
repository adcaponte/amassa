// Casca impura que envolve o módulo puro `tentativas.ts`: guarda o estado num mapa no escopo
// deste módulo e expõe funções de conveniência que leem o relógio real e delegam a decisão
// para lá. O contador em memória basta porque a aplicação roda numa **instância só**
// (`01-ARQUITETURA.md` §4) — reiniciar o processo zera os bloqueios em curso, o que é aceito
// por escrito.
import {
  avaliarPedido,
  ESTADO_VAZIO,
  JANELA_EM_MINUTOS,
  registrarAcerto,
  registrarErro,
  type DecisaoPedido,
  type EstadoTentativas,
} from "./tentativas";

let estado: EstadoTentativas = ESTADO_VAZIO;

const JANELA_MS = JANELA_EM_MINUTOS * 60_000;

// Limpeza preguiçosa: a cada leitura ou escrita, descarta do mapa os e-mails cujo último erro
// já saiu da janela. Sem isso, sondagem com e-mails inventados faria o mapa crescer sem fim —
// mitigação aceita para T-02a-15 (o risco em si é aceito: instância única, atrás de proxy,
// com 3 a 5 usuários reais).
function limparEntradasVencidas(agora: number): void {
  const novoEstado: Record<string, readonly number[]> = {};
  for (const [email, erros] of Object.entries(estado)) {
    const relevantes = erros.filter((instante) => agora - instante < JANELA_MS);
    if (relevantes.length > 0) novoEstado[email] = relevantes;
  }
  estado = novoEstado;
}

/** Decide se um pedido de login para `email`, agora, pode prosseguir. */
export function avaliarPedidoAgora(email: string): DecisaoPedido {
  const agora = Date.now();
  limparEntradasVencidas(agora);
  return avaliarPedido(estado, email, agora);
}

/** Registra um erro de senha para `email` no instante atual. */
export function registrarErroAgora(email: string): void {
  const agora = Date.now();
  estado = registrarErro(estado, email, agora);
  limparEntradasVencidas(agora);
}

/** Um acerto zera o contador daquele e-mail imediatamente. */
export function registrarAcertoAgora(email: string): void {
  estado = registrarAcerto(estado, email);
}
