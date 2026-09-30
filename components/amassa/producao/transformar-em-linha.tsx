"use client";

import type { CategoriaDeVenda } from "@/lib/precificacao/consultas";
import {
  DICA_PRECO_DE_VENDA,
  PLACEHOLDER_CATEGORIA_DE_VENDA,
  ROTULO_CATEGORIA_DE_VENDA,
  ROTULO_PRECO_DE_VENDA,
  TEXTO_TRANSFORMAR_EM_LINHA,
  TITULO_TRANSFORMAR_EM_LINHA,
} from "@/lib/producao/textos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TransformarEmLinhaProps = {
  pecaId: string;
  // O prefixo dos ids da seção da peça (`conclusao-{id}`) — os campos ganham `-categoria`/`-preco`.
  idBase: string;
  categoriasDeVenda: readonly CategoriaDeVenda[];
  categoriaVendaId: string;
  precoTexto: string;
  erros: { categoria?: string; preco?: string };
  desabilitado: boolean;
  aoMudar: (mudanca: { categoriaVendaId?: string; precoTexto?: string }) => void;
};

// O passo "Transformar em peça de linha" (D-12, UI-SPEC §"Folha de conclusão"): aparece na seção da
// peça EXCLUSIVA quando o destino das extras boas é "Entram no Estoque". Sub-bloco `superficie-2`,
// `rounded-md`, padding 16px: o título (Corpo 600), a frase que diz o que acontece, "Categoria de
// venda" (`Select`, já com "Peças prontas") e "Preço de venda" (R$, 16px, `inputMode="decimal"`, já
// com o preço praticado da ficha). Os erros ficam embaixo de cada campo. Ao concluir, o servidor
// promove a ficha pela MESMA função da Precificação (`promoverFichaParaLinha`).
export function TransformarEmLinha({
  pecaId,
  idBase,
  categoriasDeVenda,
  categoriaVendaId,
  precoTexto,
  erros,
  desabilitado,
  aoMudar,
}: TransformarEmLinhaProps) {
  const idCategoria = `${idBase}-categoria`;
  const idPreco = `${idBase}-preco`;

  return (
    <div
      data-testid={`conclusao-linha-${pecaId}`}
      className="bg-superficie-2 flex flex-col gap-3 rounded-md p-4"
    >
      <div className="flex flex-col gap-1">
        <p className="text-corpo text-tinta font-semibold">{TITULO_TRANSFORMAR_EM_LINHA}</p>
        <p className="text-apoio text-tinta-media">{TEXTO_TRANSFORMAR_EM_LINHA}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCategoria} className="text-corpo text-tinta font-semibold">
          {ROTULO_CATEGORIA_DE_VENDA}
        </label>
        <Select
          value={categoriaVendaId === "" ? undefined : categoriaVendaId}
          onValueChange={(valor) => aoMudar({ categoriaVendaId: valor })}
          disabled={desabilitado}
        >
          <SelectTrigger
            id={idCategoria}
            data-testid={`conclusao-categoria-${pecaId}`}
            aria-invalid={erros.categoria !== undefined}
            aria-describedby={erros.categoria ? `${idBase}-erro-categoria` : undefined}
            className="bg-superficie text-corpo min-h-[44px] w-full data-[size=default]:h-auto"
          >
            <SelectValue placeholder={PLACEHOLDER_CATEGORIA_DE_VENDA} />
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
            {categoriasDeVenda.map((categoria) => (
              <SelectItem
                key={categoria.id}
                value={categoria.id}
                className="text-corpo min-h-[44px] py-2 whitespace-normal [overflow-wrap:anywhere]"
              >
                {categoria.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erros.categoria ? (
          <p
            id={`${idBase}-erro-categoria`}
            role="alert"
            data-testid={`conclusao-erro-categoria-${pecaId}`}
            className="text-apoio text-erro"
          >
            {erros.categoria}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idPreco} className="text-corpo text-tinta font-semibold">
          {ROTULO_PRECO_DE_VENDA}
        </label>
        <p id={`${idBase}-preco-dica`} className="text-apoio text-tinta-fraca">
          {DICA_PRECO_DE_VENDA}
        </p>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-corpo text-tinta-media">
            R$
          </span>
          <input
            id={idPreco}
            data-testid={`conclusao-preco-${pecaId}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-required="true"
            aria-invalid={erros.preco !== undefined}
            aria-describedby={[`${idBase}-preco-dica`, erros.preco ? `${idBase}-erro-preco` : null]
              .filter(Boolean)
              .join(" ")}
            disabled={desabilitado}
            value={precoTexto}
            onChange={(evento) => aoMudar({ precoTexto: evento.target.value })}
            className="border-borda-forte bg-superficie text-tinta focus-visible:ring-ring h-11 w-36 rounded-md border px-2 text-base tabular-nums focus-visible:ring-2 focus-visible:outline-none aria-invalid:border-erro"
          />
        </div>
        {erros.preco ? (
          <p
            id={`${idBase}-erro-preco`}
            role="alert"
            data-testid={`conclusao-erro-preco-${pecaId}`}
            className="text-apoio text-erro"
          >
            {erros.preco}
          </p>
        ) : null}
      </div>
    </div>
  );
}
