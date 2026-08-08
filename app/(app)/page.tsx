import { sair } from "@/lib/auth/acoes";
import { exigirUsuario } from "@/lib/auth/exigir-usuario";

// Rota protegida provisória: só existe para provar que uma sessão válida chega até aqui
// depois do login (critério 6 do ROADMAP). A Fase 2b substitui pelo painel inicial de
// verdade, com a casca de navegação. `exigirUsuario()` na primeira linha do componente —
// é o padrão que toda página protegida futura segue.
export default async function Painel() {
  const usuario = await exigirUsuario();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F6F3F0] px-6 text-center text-[#1D2221]">
      <div>
        <h1 className="text-4xl font-semibold">AMASSA</h1>
        <p className="mt-4 text-lg">Olá, {usuario.nome}. Você está autenticado.</p>
      </div>

      <form action={sair}>
        <button
          type="submit"
          className="min-h-[44px] rounded-md border border-[#D8D2CB] bg-white px-6 text-base text-[#1D2221]"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
