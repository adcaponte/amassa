import { FRASE_NO_AR } from "./frase-no-ar";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F6F3F0] px-6 text-center text-[#1D2221]">
      <h1 className="text-4xl font-semibold">AMASSA</h1>
      <p className="mt-4 text-lg">{FRASE_NO_AR}</p>
    </main>
  );
}
