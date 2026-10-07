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

// D-28 / UI-D19 (Fase 06.5): o telefone EXIBIDO no site é derivado do mesmo `zap` do link — um
// número só no projeto, nenhum rótulo escrito à mão que possa divergir do número que o botão abre.
// Desenho "({DD}) 9 {XXXX}-{XXXX}": tira o 55, separa o DDD e o celular de 9 dígitos. Um `zap` fora
// desse formato (fixo de 8 dígitos, sem 55, com letra) devolve texto vazio — e campo vazio não
// renderiza no site, em vez de mostrar um número mal formatado.
const FORMATO_DO_ZAP = /^55(\d{2})9(\d{4})(\d{4})$/;

export function rotuloTelefoneDoZap(zap: string): string {
  const partes = FORMATO_DO_ZAP.exec(zap);
  if (!partes) return "";

  const [, ddd, primeiraMetade, segundaMetade] = partes;
  return `(${ddd}) 9 ${primeiraMetade}-${segundaMetade}`;
}
