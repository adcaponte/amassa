import type { ReactNode } from "react";

import type { FichaDoFornecedor } from "@/lib/fornecedores/consultas";
import { linkDoWhatsApp, urlDoSite } from "@/lib/fornecedores/contato";
import {
  ariaAbrirSite,
  ariaAbrirWhatsapp,
  ariaCopiarEmail,
  ariaCopiarWhatsapp,
  ROTULO_ABRIR,
  ROTULO_ABRIR_WHATSAPP,
  ROTULO_CARTAO_CIDADE,
  ROTULO_CARTAO_CONTATO,
  ROTULO_CARTAO_EMAIL,
  ROTULO_CARTAO_PAGAMENTO,
  ROTULO_CARTAO_SITE,
  ROTULO_CARTAO_WHATSAPP,
} from "@/lib/fornecedores/textos";
import { cn } from "@/lib/utils";

import { BotaoCopiar } from "./botao-copiar";

// As ações dos cartões (06.2-UI-SPEC.md §Color, item 5): texto `acento` sobre `acento-fundo`
// (6,41:1), `rounded-full`, 44 px — a mesma classe no "copiar" (botão) e nos "abrir" (âncoras).
const CLASSE_DA_ACAO = cn(
  "text-corpo bg-acento-fundo text-acento inline-flex min-h-[44px] items-center rounded-full px-4 font-semibold",
  "hover:underline focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
);

type ChaveDoCartao = "whatsapp" | "contato" | "email" | "site" | "pagamento" | "cidade";

type Cartao = { chave: ChaveDoCartao; rotulo: string; valor: string; acoes: ReactNode };

function preenchido(texto: string | null): string | null {
  const aparado = texto?.trim() ?? "";
  return aparado === "" ? null : aparado;
}

// A grade de contatos da ficha (06.2-UI-SPEC.md, Bloco Ficha item 4; FRN-05). Cartões na ordem
// WhatsApp · Contato · E-mail · Site · Pagamento e prazo · Cidade / entrega, cada um só se preenchido;
// nenhum preenchido → a grade inteira some (`null`). Os links vêm SÓ de `lib/fornecedores/contato.ts`:
// WhatsApp que não vira `wa.me` válido fica só com "copiar"; site que não é http(s) aparece como texto,
// sem botão (T-06.2-09). Todo `target="_blank"` leva `rel="noopener noreferrer"` (T-06.2-10).
export function ContatosFornecedor({ fornecedor }: { fornecedor: FichaDoFornecedor }) {
  const nome = fornecedor.nome;
  const cartoes: Cartao[] = [];

  const whatsapp = preenchido(fornecedor.whatsapp);
  if (whatsapp !== null) {
    const link = linkDoWhatsApp(whatsapp);
    cartoes.push({
      chave: "whatsapp",
      rotulo: ROTULO_CARTAO_WHATSAPP,
      valor: whatsapp,
      acoes: (
        <>
          <BotaoCopiar valor={whatsapp} rotuloAcessivel={ariaCopiarWhatsapp(nome)} className={CLASSE_DA_ACAO} />
          {link !== null ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={ariaAbrirWhatsapp(nome)}
              className={CLASSE_DA_ACAO}
            >
              {ROTULO_ABRIR_WHATSAPP}
            </a>
          ) : null}
        </>
      ),
    });
  }

  const pessoa = preenchido(fornecedor.pessoaContato);
  if (pessoa !== null) {
    cartoes.push({ chave: "contato", rotulo: ROTULO_CARTAO_CONTATO, valor: pessoa, acoes: null });
  }

  const email = preenchido(fornecedor.email);
  if (email !== null) {
    cartoes.push({
      chave: "email",
      rotulo: ROTULO_CARTAO_EMAIL,
      valor: email,
      acoes: <BotaoCopiar valor={email} rotuloAcessivel={ariaCopiarEmail(nome)} className={CLASSE_DA_ACAO} />,
    });
  }

  const site = preenchido(fornecedor.site);
  if (site !== null) {
    const url = urlDoSite(site);
    cartoes.push({
      chave: "site",
      rotulo: ROTULO_CARTAO_SITE,
      valor: site,
      acoes:
        url !== null ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ariaAbrirSite(nome)}
            className={CLASSE_DA_ACAO}
          >
            {ROTULO_ABRIR}
          </a>
        ) : null,
    });
  }

  const pagamento = preenchido(fornecedor.pagamentoPrazo);
  if (pagamento !== null) {
    cartoes.push({ chave: "pagamento", rotulo: ROTULO_CARTAO_PAGAMENTO, valor: pagamento, acoes: null });
  }

  const cidade = preenchido(fornecedor.cidadeEntrega);
  if (cidade !== null) {
    cartoes.push({ chave: "cidade", rotulo: ROTULO_CARTAO_CIDADE, valor: cidade, acoes: null });
  }

  if (cartoes.length === 0) {
    return null;
  }

  return (
    <ul
      data-testid="fornecedor-contatos"
      className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-2"
    >
      {cartoes.map((cartao) => (
        <li
          key={cartao.chave}
          data-testid={`fornecedor-contato-${cartao.chave}`}
          className="border-borda bg-superficie flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2"
        >
          <span className="text-apoio text-tinta-fraca font-semibold tracking-[0.06em] uppercase">
            {cartao.rotulo}
          </span>
          <span className="text-corpo text-tinta [overflow-wrap:anywhere] whitespace-pre-wrap">{cartao.valor}</span>
          {cartao.acoes !== null ? <div className="mt-1 flex flex-wrap gap-2">{cartao.acoes}</div> : null}
        </li>
      ))}
    </ul>
  );
}
