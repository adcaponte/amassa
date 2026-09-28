import { FRASE_NO_AR } from "@/app/frase-no-ar";
import { MENSAGEM_CREDENCIAIS_INVALIDAS } from "@/lib/auth/credenciais";
import { entrar } from "@/lib/auth/acoes";
import { Logo } from "@/components/amassa/logo";

import { BotaoEntrar } from "./botao-entrar";

// Tela reestilizada com a identidade do AMASSA (D-14, Fase 2b) — só a aparência muda; a
// mecânica (Server Action, mensagens de erro, `required`) é a mesma da Fase 2a. `Card` do
// shadcn ainda não está instalado nesta fase (só chega no plano 02); o cartão de login usa um
// `<div>` com `bg-card border-border rounded-xl`, que resolve para os mesmos tokens e a mesma
// prova de cor — o plano 02 pode trocar pelo componente depois sem mudar nada visualmente.
function mensagemDeErro(
  erro: string | undefined,
  minutos: string | undefined,
  sessao: string | undefined,
): string | null {
  if (erro === "bloqueado") {
    // Mensagem distinta da de credenciais inválidas — bloqueio não é senha errada, e esconder
    // o bloqueio faria a pessoa certa achar que esqueceu a própria senha (T-02a-12).
    // `minutos` vem direto da URL (`/login?erro=bloqueado&minutos=...`) — qualquer pessoa pode
    // editar o parâmetro na barra de endereço, então só um número inteiro positivo é aceito;
    // qualquer outra coisa cai no valor genérico "alguns".
    const numeroMinutos = Number(minutos);
    const quantidade =
      minutos !== undefined && Number.isInteger(numeroMinutos) && numeroMinutos > 0
        ? String(numeroMinutos)
        : "alguns";
    return `Muitas tentativas com este e-mail. Tente novamente em ${quantidade} minuto(s).`;
  }
  if (erro === "credenciais") {
    // Mesma constante usada em lib/auth/credenciais.ts — senha errada e e-mail sem conta
    // mostram exatamente o mesmo texto (T-02a-13).
    return MENSAGEM_CREDENCIAIS_INVALIDAS;
  }
  if (sessao === "encerrada") {
    // Mesma frase para sessão vencida (30 dias) e conta desativada (`ativo = false`) — as
    // duas passam por `exigirUsuario()` (lib/auth/exigir-usuario.ts). Distinguir os dois
    // motivos aqui confundiria quem só ficou fora 31 dias, e daria informação de graça para
    // quem está sondando contas alheias (T-02a-21).
    return "Sua sessão foi encerrada. Entre novamente.";
  }
  return null;
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; minutos?: string; sessao?: string }>;
}) {
  const { erro, minutos, sessao } = await searchParams;
  const mensagem = mensagemDeErro(erro, minutos, sessao);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <Logo como="h1" className="text-4xl" />
      <p className="text-corpo mt-2 mb-8">{FRASE_NO_AR}</p>

      <div className="bg-card border-border w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <form action={entrar} className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-apoio font-medium">E-mail</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="text-corpo border-input focus-visible:ring-ring min-h-[44px] rounded-md border bg-white px-4 text-foreground focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-apoio font-medium">Senha</span>
            <input
              type="password"
              name="senha"
              required
              autoComplete="current-password"
              className="text-corpo border-input focus-visible:ring-ring min-h-[44px] rounded-md border bg-white px-4 text-foreground focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          {mensagem && (
            <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
              {mensagem}
            </p>
          )}

          <BotaoEntrar />
        </form>
      </div>
    </main>
  );
}
