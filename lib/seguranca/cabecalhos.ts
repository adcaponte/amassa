// Módulo puro, sem nenhum import: os cabeçalhos de segurança que TODA resposta do Next leva — o
// site público, a plataforma em `/gestao`, as rotas de API e as de saúde (D-19, Fase 06.5). Vive à
// parte de `next.config.ts` pelo mesmo motivo de `lib/rotas/redirecionamentos-antigos.ts`: poder
// ser testado sem subir o Next (`tests/unit/seguranca-cabecalhos.test.ts`); o `next.config.ts` só
// espalha a lista em `headers()`.
//
// Por que pelo Next e não pelo Caddy: o `docker/Caddyfile` NÃO é ressincronizado pelo job
// `implantar` (só o `compose.yml` é) — um cabeçalho posto lá dependeria de alguém editar o servidor
// à mão e envelheceria em silêncio. Aqui ele chega ao servidor junto com a imagem, e o Caddy
// (`reverse_proxy`) só repassa.
//
// Por que a CSP é só `Report-Only`: o Next injeta `<script>` em linha (o payload do RSC, a
// hidratação) e estilos em linha; uma CSP que bloqueia, escrita sem medir, quebraria a página em
// produção sem nenhum teste perceber. Em report-only o navegador NÃO bloqueia nada — só registra no
// console o que bloquearia. Travar de verdade é uma decisão futura, com essa medição em mãos. Sem
// `report-uri` de propósito: um endpoint de relatório seria superfície nova sem ninguém para ler.
// O `frame-ancestors 'none'` da CSP fica como registro; quem barra o enquadramento hoje é o
// `X-Frame-Options: DENY` (o projeto não usa `iframe`).
//
// HSTS de um ano com `includeSubDomains` (todo subdomínio passa pelo Caddy com HTTPS automático) e
// SEM `preload`: entrar na lista de pré-carga dos navegadores é difícil de desfazer.
export const POLITICA_DE_CONTEUDO = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const CABECALHOS_DE_SEGURANCA: readonly { key: string; value: string }[] = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Fecha o que o sistema não usa. A câmera NÃO é usada por API do navegador: a foto do orçamento e o
  // anexo de fornecedor vêm de `<input type="file">`, que abre a câmera do celular pelo sistema
  // operacional e não depende desta política.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy-Report-Only", value: POLITICA_DE_CONTEUDO },
];
