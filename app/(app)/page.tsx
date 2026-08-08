import { auth } from "@/lib/auth/auth";

// Rota protegida provisória: só existe para provar que uma sessão válida chega até aqui
// depois do login (critério 6 do ROADMAP). A Fase 2b substitui pelo painel inicial de
// verdade, com a casca de navegação.
export default async function Painel() {
  const sessao = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F6F3F0] px-6 text-center text-[#1D2221]">
      <h1 className="text-4xl font-semibold">AMASSA</h1>
      <p className="mt-4 text-lg">Olá, {sessao?.user?.name ?? "gestor"}. Você está autenticado.</p>
    </main>
  );
}
