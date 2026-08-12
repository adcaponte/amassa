"use client";

import { useState, type FormEvent } from "react";

import { trocarSenha } from "@/lib/auth/acoes-senha";
import { Button } from "@/components/ui/button";

// Três campos não pedem `react-hook-form` — um `useState` simples de pendência basta, mesmo
// padrão de `registrar-queima.tsx`/`ajuste-rapido-etapa.tsx`. Validação no cliente é
// conveniência, não segurança: a decisão é sempre a do servidor (`trocarSenha`), e o `erro`
// exibido aqui é sempre o que o servidor devolveu.
export function FormularioTrocaDeSenha() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [pendente, setPendente] = useState(false);

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPendente(true);
    setErro(null);
    setSucesso(false);

    const resposta = await trocarSenha({ senhaAtual, senhaNova, confirmacao });

    setPendente(false);

    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }

    setSucesso(true);
    setSenhaAtual("");
    setSenhaNova("");
    setConfirmacao("");
  }

  return (
    <div className="bg-card border-border w-full max-w-sm rounded-xl border p-6 shadow-sm">
      <form onSubmit={aoSubmeter} className="flex flex-col gap-4 text-left">
        <label className="flex flex-col gap-1">
          <span className="text-apoio font-medium">Senha atual</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(evento) => setSenhaAtual(evento.target.value)}
            className="text-corpo border-input focus-visible:ring-ring min-h-[44px] rounded-md border bg-white px-4 text-foreground focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-apoio font-medium">Senha nova</span>
          {/* Dica FORA do <label>, ligada por `aria-describedby`: um <span> dentro do <label>
              entraria no nome acessível do campo ("Senha nova Pelo menos 12 caracteres…"), o
              que faz `getByLabel("Senha nova")` colidir por substring com "Confirme a senha
              nova" (as duas contêm "senha nova"). `aria-describedby` mantém a dica lida por
              leitor de tela sem inflar o nome acessível. */}
          <input
            type="password"
            required
            autoComplete="new-password"
            aria-describedby="dica-senha-nova"
            value={senhaNova}
            onChange={(evento) => setSenhaNova(evento.target.value)}
            className="text-corpo border-input focus-visible:ring-ring min-h-[44px] rounded-md border bg-white px-4 text-foreground focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <span id="dica-senha-nova" className="text-micro text-muted-foreground -mt-3">
          Pelo menos 12 caracteres. Uma frase de quatro palavras funciona bem:
          panela-barro-forno-quente.
        </span>

        <label className="flex flex-col gap-1">
          <span className="text-apoio font-medium">Confirme a senha nova</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value)}
            className="text-corpo border-input focus-visible:ring-ring min-h-[44px] rounded-md border bg-white px-4 text-foreground focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>

        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}

        {sucesso && (
          <p role="status" className="text-apoio text-foreground">
            Senha trocada com sucesso.
          </p>
        )}

        <Button
          type="submit"
          variant="default"
          disabled={pendente}
          aria-busy={pendente}
          className="min-h-[44px] w-full text-base font-medium"
        >
          {pendente ? "Trocando…" : "Trocar senha"}
        </Button>
      </form>
    </div>
  );
}
