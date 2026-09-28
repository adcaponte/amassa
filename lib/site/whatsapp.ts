// A única porta para montar um link de WhatsApp no site público (D-17). O número é campo de
// conteúdo — mora em `conteudo/site.ts` (`CONTEUDO_SITE.zap`), nunca aqui; trocá-lo é editar
// aquele arquivo, num lugar só. Módulo puro, zero import de valor: nenhum React, nenhum acesso
// a banco — o mesmo padrão de `lib/precificacao/navegacao.ts`.
//
// `URLSearchParams` escapa o texto sozinho (acento, espaço, pontuação) — nenhuma concatenação
// crua de mensagem na URL.

export function hrefDoWhatsapp(numero: string, mensagem: string): string {
  const mensagemLimpa = mensagem.trim();

  if (mensagemLimpa.length === 0) {
    return `https://wa.me/${numero}`;
  }

  const parametros = new URLSearchParams({ text: mensagem });
  return `https://wa.me/${numero}?${parametros.toString()}`;
}
