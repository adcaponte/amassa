import type { ReactNode } from "react";

// Componente compartilhado de estado de erro em linguagem humana (UI-07) — usado pelo boundary
// de erro do grupo protegido (`app/(app)/error.tsx`) e pelo 404 (`app/(app)/not-found.tsx`,
// `app/not-found.tsx`). Server Component puro: não decide se a ação é de cliente (reset()) ou
// de servidor (link) — quem usa o componente passa o que precisar em `acao`, porque só quem
// chama sabe qual dos dois é o caso.
//
// `role="alert"` no contêiner faz o leitor de tela anunciar o conteúdo sem exigir foco manual
// (mesmo papel já usado em app/(auth)/login/page.tsx para as mensagens de erro do formulário).
// Se um dia esta tela ganhar um selo ou marca visual, o fundo dele é `bg-erro-fundo`
// (`--color-erro-fundo`) — nunca o vermelho de alerta genérico do navegador; nenhum selo existe
// nesta versão, então nenhuma classe de cor de fundo é necessária aqui ainda.
export type EstadoErroProps = {
  titulo: string;
  corpo: string;
  acao?: ReactNode;
};

export function EstadoErro({ titulo, corpo, acao }: EstadoErroProps) {
  return (
    <div role="alert" className="flex flex-1 items-center justify-center px-6 py-16">
      {/* max-w-prose: mesma largura máxima de leitura do EstadoVazio — o texto quebra em
          linhas, nunca exige rolagem horizontal (UI-06). */}
      <div className="flex max-w-prose flex-col items-center gap-3 text-center">
        <h2 className="text-titulo text-foreground">{titulo}</h2>
        <p className="text-corpo text-muted-foreground">{corpo}</p>
        {acao && <div className="mt-3">{acao}</div>}
      </div>
    </div>
  );
}
