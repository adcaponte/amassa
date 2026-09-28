import { notFound } from "next/navigation";

// Catch-all de MENOR precedência dentro do grupo protegido — qualquer segmento estático
// (`login`, `financeiro`, `api`, ...) sempre casa primeiro; só um caminho sob `/gestao` sem
// rota nenhuma cai aqui.
//
// Existe por um motivo estrutural, não estético: no App Router, uma URL que não casa com rota
// alguma do sistema NUNCA entra na árvore de layout de um grupo — ela cai direto no
// `app/not-found.tsx` da RAIZ, que a partir desta fase é público (GES-06). Sem este catch-all,
// `/gestao/inexistente` mostraria o 404 público (sem a casca, sem saber que existe sessão) em
// vez do 404 COM a casca — o `notFound()` chamado de DENTRO do grupo `(app)` é o que faz
// `app/gestao/(app)/not-found.tsx` renderizar dentro do layout protegido.
export default function NaoEncontradoDentroDeGestao(): never {
  notFound();
}
