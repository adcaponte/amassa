import Link from "next/link";

import { criarEncomenda } from "@/lib/encomendas/acoes";

import { BotaoSalvarEncomenda } from "./botao-salvar-encomenda";

const CLASSE_DO_CAMPO =
  "text-corpo border-input focus-visible:ring-ring min-h-[44px] rounded-md border bg-white px-4 text-foreground focus-visible:ring-2 focus-visible:outline-none";

// Server Component com `<form>` real — o contêiner é um `<section>` comum nesta fatia;
// `Dialog` (desktop) / `Sheet` (celular) é trabalho do plano 06 (D-03). Campos: nome, cliente,
// data de início, e UMA linha de item já em branco e pronta para digitar (decisão do dono,
// 03-UI-SPEC.md "Estado inicial da lista de itens" — toda encomenda tem ao menos um item, esse
// toque não deveria ser cobrado de ninguém). As 6 etapas NÃO aparecem aqui: nascem com os
// padrões pelo servidor (lib/encomendas/acoes.ts); o plano 06 traz os campos.
// `criarEncomenda` espera (estadoAnterior, formData) — o formato que `useActionState` usa,
// para o dia em que o formulário precisar mostrar o erro sem recarregar a página (plano 06).
// Hoje, ainda Server Component, `.bind(null, null)` fixa o primeiro argumento e devolve uma
// função de um argumento só, o contrato que `<form action>` exige em tempo de execução — o
// `as` abaixo só apaga o tipo de retorno (`ResultadoDeAcao<...>`) que o React descarta de
// qualquer forma num `<form>` sem `useActionState`; o valor devolvido nunca é lido aqui.
const acaoDoFormulario = criarEncomenda.bind(null, null) as unknown as (
  formData: FormData,
) => Promise<void>;

export function FormularioEncomenda() {
  return (
    <section
      aria-label="Nova encomenda"
      className="border-border bg-card mx-6 my-6 max-w-2xl rounded-xl border p-6 md:mx-8"
    >
      <h2 className="text-titulo text-foreground mb-4">Nova encomenda</h2>

      <form action={acaoDoFormulario} className="flex flex-col gap-4">
        <label htmlFor="nome" className="flex flex-col gap-1">
          <span className="text-apoio text-foreground font-medium">Nome da encomenda</span>
          <input id="nome" name="nome" type="text" required className={CLASSE_DO_CAMPO} />
        </label>

        <label htmlFor="clienteNome" className="flex flex-col gap-1">
          <span className="text-apoio text-foreground font-medium">Cliente</span>
          <input id="clienteNome" name="clienteNome" type="text" className={CLASSE_DO_CAMPO} />
        </label>

        <label htmlFor="dataInicio" className="flex flex-col gap-1">
          <span className="text-apoio text-foreground font-medium">Data de início</span>
          <input
            id="dataInicio"
            name="dataInicio"
            type="date"
            required
            className={CLASSE_DO_CAMPO}
          />
        </label>

        <div className="border-border flex flex-col gap-3 rounded-md border p-3">
          <span className="text-apoio text-foreground font-medium">Item</span>

          <label htmlFor="itemDescricao" className="flex flex-col gap-1">
            <span className="text-apoio text-muted-foreground">Descrição do item</span>
            <input
              id="itemDescricao"
              name="itemDescricao"
              type="text"
              required
              className={CLASSE_DO_CAMPO}
            />
          </label>

          <label htmlFor="itemQuantidade" className="flex flex-col gap-1">
            <span className="text-apoio text-muted-foreground">Quantidade</span>
            <input
              id="itemQuantidade"
              name="itemQuantidade"
              type="number"
              min={1}
              step={1}
              required
              className={CLASSE_DO_CAMPO}
            />
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/encomendas"
            className="text-corpo border-border hover:bg-muted flex min-h-[44px] items-center rounded-lg border px-4"
          >
            Cancelar
          </Link>
          <BotaoSalvarEncomenda />
        </div>
      </form>
    </section>
  );
}
