"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

// Componente cliente minúsculo só para o estado de carregamento do botão — o mesmo idioma de
// `app/(auth)/login/botao-entrar.tsx` (`useFormStatus`, `disabled`, `aria-busy`, os dois
// rótulos). O resto do formulário continua Server Component. Este `disabled` também é a defesa
// contra o toque duplo acidental (ENC-12): não existe deduplicação no banco de propósito, então
// impedir um segundo envio enquanto o primeiro está em voo é o único freio.
export function BotaoSalvarEncomenda() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="default"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[44px] text-base font-medium"
    >
      {pending ? "Salvando…" : "Salvar"}
    </Button>
  );
}
