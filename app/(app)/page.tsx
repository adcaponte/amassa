import { exigirUsuario } from "@/lib/auth/exigir-usuario";

// Rota protegida provisória: só existe para provar que uma sessão válida chega até aqui
// depois do login (critério 6 do ROADMAP). A Fase 2b substitui pelo painel inicial de
// verdade, com a casca de navegação (plano 03). `exigirUsuario()` na primeira linha do
// componente — é o padrão que toda página protegida futura segue. O botão de sair mudou de
// endereço (D-15): agora vive no menu do usuário da casca, não mais aqui — deixá-lo nos dois
// lugares faria getByRole("button", { name: "Sair" }) casar com dois elementos.
export default async function Painel() {
  const usuario = await exigirUsuario();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F6F3F0] px-6 text-center text-[#1D2221]">
      <div>
        <h1 className="text-4xl font-semibold">AMASSA</h1>
        <p className="mt-4 text-lg">Olá, {usuario.nome}. Você está autenticado.</p>
      </div>
    </main>
  );
}
