import type { FornoMedido } from "@/lib/queimas/consultas";

import { CartaoForno } from "./cartao-forno";

export type ListaFornosProps = {
  fornos: FornoMedido[];
};

// Grade no desktop, cartões empilhados em largura total no celular (`04-DESIGN-SYSTEM.md` §6,
// molde de `lista-encomendas.tsx`). Um único forno ocupa a largura toda em vez de deixar
// meia-grade órfã no desktop (E1/zero-one-many).
export function ListaFornos({ fornos }: ListaFornosProps) {
  const umUnicoForno = fornos.length === 1;

  return (
    <div
      className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 md:px-8"
      data-testid="lista-fornos"
    >
      {fornos.map((forno) => (
        <div key={forno.id} className={umUnicoForno ? "md:col-span-2" : undefined}>
          <CartaoForno forno={forno} />
        </div>
      ))}
    </div>
  );
}
