"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Link2, Search } from "lucide-react";

import { situacaoDoVinculo, sugestoesDoCampo, type FornecedorDoCampo } from "@/lib/fornecedores/campo";
import {
  FRASE_VINCULO_LIGADO,
  FRASE_VINCULO_SO_O_NOME,
  PLACEHOLDER_CAMPO_FORNECEDOR,
} from "@/lib/financeiro/textos";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// O valor do campo: o texto escrito e, quando a pessoa ESCOLHEU na lista, o id do fornecedor. Quem
// guarda é o painel da Despesa (o "Limpar" zera os dois).
export type ValorDoCampoFornecedor = { texto: string; fornecedorId: string | null };

export type CampoFornecedorProps = {
  // "Fornecedor (opcional)" — `ROTULO_FORNECEDOR_OPCIONAL`, sem mudança (o e2e
  // `financeiro-despesa.spec.ts` faz `getByLabel` nele).
  rotulo: string;
  // Os fornecedores ATIVOS, carregados com a página do Financeiro. `null`: a leitura falhou — o campo
  // funciona como texto livre (a frase de erro é do plano 12).
  fornecedores: readonly FornecedorDoCampo[] | null;
  valor: ValorDoCampoFornecedor;
  aoMudar: (valor: ValorDoCampoFornecedor) => void;
  desabilitado?: boolean;
};

// O campo "Fornecedor" da Despesa (Fase 06.2, plano 10 — D-04; 06.2-UI-SPEC.md, "Despesa do Financeiro
// — o campo Fornecedor"). Um campo só: escreve-se o nome como sempre, ou escolhe-se um fornecedor do
// cadastro na lista de sugestões — e só ESCOLHER liga (UI-D4); digitar qualquer coisa depois desliga.
//
// Molde ARIA 1.2 de `components/amassa/agenda/seletor-pessoa.tsx` (`role=combobox` + `role=listbox`),
// sem pacote novo, com duas diferenças: a lista é LOCAL (sem espera ao digitar; filtra por nome e
// "vende", UI-D5) e o painel é SOBREPOSTO (UI-D3) — embutido, cada tecla empurraria as linhas da compra
// e o Total. O `listbox` tem nome próprio, "Fornecedores do cadastro" — nunca o rótulo do campo, senão
// `getByLabel("Fornecedor (opcional)")` casaria com dois elementos.
//
// Teclado: ↓/↑ abrem a lista e percorrem (circular); Enter com a lista aberta escolhe a destacada ou a
// única que há, senão não faz nada (nunca lança); Esc fecha só a lista; Tab fecha e segue. Foco no
// campo abre; tocar numa opção não tira o foco do campo.
export function CampoFornecedor({
  rotulo,
  fornecedores,
  valor,
  aoMudar,
  desabilitado = false,
}: CampoFornecedorProps) {
  const idBase = useId();
  const idDoCampo = `${idBase}-campo`;
  const idDaLista = `${idBase}-lista`;
  const idDoVinculo = `${idBase}-vinculo`;

  const [expandido, setExpandido] = useState(false);
  const [ativa, setAtiva] = useState(-1);

  const opcoes = fornecedores !== null ? sugestoesDoCampo(fornecedores, valor.texto).opcoes : [];
  const listaVisivel = expandido && opcoes.length > 0;
  const situacao = situacaoDoVinculo(valor);
  const haAtivos = fornecedores !== null && fornecedores.length > 0;

  function idDaOpcao(indice: number): string {
    return `${idBase}-opcao-${indice}`;
  }

  function fecharLista() {
    setExpandido(false);
    setAtiva(-1);
  }

  function escolher(fornecedor: FornecedorDoCampo) {
    aoMudar({ texto: fornecedor.nome, fornecedorId: fornecedor.id });
    fecharLista();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      if (expandido) {
        evento.preventDefault();
        fecharLista();
      }
      return;
    }
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (!expandido) {
        setExpandido(true);
        return;
      }
      if (opcoes.length === 0) {
        return;
      }
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setAtiva((atual) =>
        atual === -1 ? (passo === 1 ? 0 : opcoes.length - 1) : (atual + passo + opcoes.length) % opcoes.length,
      );
      return;
    }
    // Enter com a lista aberta é da LISTA: escolhe a destacada, ou a única que há; senão não faz nada.
    // Nunca lança a despesa (o painel não é um `<form>`, e o Enter não chega a nenhum botão).
    if (evento.key === "Enter" && listaVisivel) {
      evento.preventDefault();
      if (ativa >= 0 && ativa < opcoes.length) {
        escolher(opcoes[ativa]);
      } else if (opcoes.length === 1) {
        escolher(opcoes[0]);
      }
      return;
    }
    if (evento.key === "Tab") {
      fecharLista();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idDoCampo} className="text-apoio text-muted-foreground">
        {rotulo}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <Input
          id={idDoCampo}
          type="text"
          role="combobox"
          aria-expanded={listaVisivel}
          aria-controls={idDaLista}
          aria-autocomplete="list"
          aria-activedescendant={listaVisivel && ativa >= 0 ? idDaOpcao(ativa) : undefined}
          aria-describedby={idDoVinculo}
          autoComplete="off"
          placeholder={PLACEHOLDER_CAMPO_FORNECEDOR}
          disabled={desabilitado}
          value={valor.texto}
          onChange={(evento) => {
            // Digitar qualquer coisa DESLIGA: o texto volta a ser só o nome escrito (D-04).
            aoMudar({ texto: evento.target.value, fornecedorId: null });
            setExpandido(true);
            setAtiva(-1);
          }}
          onFocus={() => setExpandido(true)}
          onClick={() => setExpandido(true)}
          onBlur={fecharLista}
          onKeyDown={aoTeclar}
          data-testid="despesa-fornecedor-campo"
          className="text-corpo md:text-corpo min-h-[44px] pl-10"
        />

        <div
          className={cn(
            "border-borda bg-superficie absolute top-full z-20 mt-1 max-h-[320px] w-full overflow-y-auto rounded-md border p-1 shadow-md",
            listaVisivel ? "block" : "hidden",
          )}
          data-testid="despesa-fornecedor-painel"
        >
          <div id={idDaLista} role="listbox" aria-label="Fornecedores do cadastro" className="flex flex-col">
            {listaVisivel
              ? opcoes.map((fornecedor, indice) => {
                  const detalhe = [fornecedor.vende, fornecedor.cidadeEntrega]
                    .filter((parte): parte is string => parte !== null && parte.trim() !== "")
                    .join(" · ");
                  return (
                    <div
                      key={fornecedor.id}
                      id={idDaOpcao(indice)}
                      role="option"
                      aria-selected={ativa === indice}
                      tabIndex={-1}
                      onMouseDown={(evento) => evento.preventDefault()}
                      onClick={() => escolher(fornecedor)}
                      onMouseEnter={() => setAtiva(indice)}
                      data-testid="despesa-fornecedor-opcao"
                      data-fornecedor-id={fornecedor.id}
                      className={cn(
                        "flex min-h-[44px] cursor-pointer flex-col justify-center rounded-md px-3 py-2",
                        ativa === indice ? "bg-superficie-2" : "hover:bg-superficie-2",
                      )}
                    >
                      <span className="text-corpo text-tinta font-semibold [overflow-wrap:anywhere]">
                        {fornecedor.nome}
                      </span>
                      {detalhe !== "" ? (
                        <span className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">{detalhe}</span>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </div>

      {/* A linha de vínculo: existe sempre (o `aria-describedby` e o `aria-live` apontam para ela), vazia
          quando não há o que dizer. */}
      <p
        id={idDoVinculo}
        aria-live="polite"
        data-testid="despesa-fornecedor-vinculo"
        className={cn(
          "text-apoio flex items-start gap-1",
          situacao === "ligado" ? "text-tinta-media" : "text-tinta-fraca",
        )}
      >
        {situacao === "ligado" ? (
          <>
            <Link2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{FRASE_VINCULO_LIGADO}</span>
          </>
        ) : situacao === "texto-livre" && haAtivos ? (
          <span>{FRASE_VINCULO_SO_O_NOME}</span>
        ) : null}
      </p>
    </div>
  );
}
