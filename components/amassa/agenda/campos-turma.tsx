"use client";

import type { ReactNode } from "react";

import {
  DICA_VENCIMENTO,
  PLACEHOLDER_NOME_TURMA,
  ROTULO_COMECA,
  ROTULO_DIA_DA_SEMANA,
  ROTULO_MENSALIDADE,
  ROTULO_MOSTRAR_NO_SITE,
  ROTULO_NOME,
  ROTULO_PRIMEIRA_AULA,
  ROTULO_SEMANAS,
  ROTULO_TERMINA,
  ROTULO_VAGAS,
  ROTULO_VENCIMENTO,
} from "@/lib/agenda/textos";
import { NOMES_DOS_DIAS, ORDEM_DOS_DIAS_NA_TELA } from "@/lib/agenda/turma";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Campo nunca menor que 16px (o iOS dá zoom sozinho ao focar) e alvo de 44px.
export const CLASSE_DO_CAMPO_DA_AGENDA = "text-corpo md:text-corpo min-h-[44px]";

// O que cada campo recebe de quem guarda o estado (a folha "Lançar na agenda" — trocar de pílula
// mantém o que foi digitado, porque o estado é dela, não deste componente).
export type CampoControlado = {
  valor: string;
  aoMudar: (valor: string) => void;
  erro?: string;
  registrar: (elemento: HTMLElement | null) => void;
};

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function juntarIds(...ids: (string | undefined)[]): string | undefined {
  const juntos = ids.filter(Boolean).join(" ");
  return juntos === "" ? undefined : juntos;
}

function ErroDoCampo({ campo, mensagem }: { campo: string; mensagem?: string }) {
  if (mensagem === undefined) {
    return null;
  }
  return (
    <p id={`lancar-erro-${campo}`} role="alert" data-testid={`lancar-erro-${campo}`} className="text-apoio text-erro">
      {mensagem}
    </p>
  );
}

type CampoDeTextoProps = {
  // A chave do campo no formulário: dá o id do erro (`lancar-erro-{chave}`).
  chave: string;
  id: string;
  testId: string;
  rotulo: string;
  campo: CampoControlado;
  tipo?: "text" | "date" | "time";
  modoDeEntrada?: "numeric" | "decimal";
  placeholder?: string;
  dica?: string;
  larguraTotal?: boolean;
  numerico?: boolean;
};

// Um campo de texto da folha: rótulo (Apoio 600) em cima, o campo, a dica e o erro embaixo — o rótulo
// quebra em quantas linhas precisar sem espremer o campo (UI E5·long-text).
export function CampoDeTexto({
  chave,
  id,
  testId,
  rotulo,
  campo,
  tipo = "text",
  modoDeEntrada,
  placeholder,
  dica,
  larguraTotal = false,
  numerico = false,
}: CampoDeTextoProps) {
  const idDaDica = dica === undefined ? undefined : `${id}-dica`;
  const idDoErro = campo.erro === undefined ? undefined : `lancar-erro-${chave}`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", larguraTotal ? "w-full" : "grow basis-40")}>
      <label htmlFor={id} className="text-apoio text-tinta font-semibold break-words">
        {rotulo}
      </label>
      <Input
        id={id}
        ref={campo.registrar}
        type={tipo}
        step={tipo === "time" ? 300 : undefined}
        inputMode={modoDeEntrada}
        data-testid={testId}
        autoComplete="off"
        placeholder={placeholder}
        aria-describedby={juntarIds(idDaDica, idDoErro)}
        aria-invalid={campo.erro !== undefined}
        value={campo.valor}
        onChange={(evento) => campo.aoMudar(evento.target.value)}
        className={cn(CLASSE_DO_CAMPO_DA_AGENDA, (numerico || tipo !== "text") && "tabular-nums")}
      />
      {dica === undefined ? null : (
        <p id={idDaDica} className="text-apoio text-tinta-fraca">
          {dica}
        </p>
      )}
      <ErroDoCampo campo={chave} mensagem={campo.erro} />
    </div>
  );
}

export type CamposTurmaProps = {
  nome: CampoControlado;
  diaSemana: CampoControlado;
  aPartirDe: CampoControlado;
  inicio: CampoControlado;
  fim: CampoControlado;
  vagas: CampoControlado;
  mensalidade: CampoControlado;
  semanas: CampoControlado;
  diaVencimento: CampoControlado;
  publica: { valor: boolean; aoMudar: (valor: boolean) => void };
};

// Os campos da pílula "Turma fixa" (05-UI-SPEC.md §"Rótulos e dicas de campo", AGE-03, UI-D10):
// Nome · Dia da semana (`Select`, segunda → domingo) · Primeira aula a partir de · Começa · Termina ·
// Vagas · Mensalidade (R$) (vazia — nenhum preço no código) · Marcar quantas semanas · Mensalidade
// vence dia · a caixa do site. Nome, data, horário, vagas e o site são os MESMOS estados da aula
// avulsa: trocar de pílula não apaga nada (UI E5·partial).
export function CamposTurma(props: CamposTurmaProps): ReactNode {
  const idDoErroDoDia = props.diaSemana.erro === undefined ? undefined : "lancar-erro-diaSemana";
  return (
    <div className="flex flex-wrap gap-4" data-testid="campos-turma">
      <CampoDeTexto
        chave="titulo"
        id="lancar-nome"
        testId="lancar-nome"
        rotulo={ROTULO_NOME}
        campo={props.nome}
        placeholder={PLACEHOLDER_NOME_TURMA}
        larguraTotal
      />
      <div className="flex min-w-0 grow basis-40 flex-col gap-2">
        <label htmlFor="lancar-dia-semana" className="text-apoio text-tinta font-semibold break-words">
          {ROTULO_DIA_DA_SEMANA}
        </label>
        <Select value={props.diaSemana.valor} onValueChange={props.diaSemana.aoMudar}>
          <SelectTrigger
            id="lancar-dia-semana"
            ref={props.diaSemana.registrar}
            data-testid="lancar-dia-semana"
            aria-describedby={idDoErroDoDia}
            aria-invalid={props.diaSemana.erro !== undefined}
            className={cn(CLASSE_DO_CAMPO_DA_AGENDA, "w-full data-[size=default]:h-auto")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDEM_DOS_DIAS_NA_TELA.map((dia) => (
              <SelectItem key={dia} value={String(dia)} className="text-corpo min-h-[44px]">
                {capitalizar(NOMES_DOS_DIAS[dia])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ErroDoCampo campo="diaSemana" mensagem={props.diaSemana.erro} />
      </div>
      <CampoDeTexto
        chave="data"
        id="lancar-data"
        testId="lancar-data"
        rotulo={ROTULO_PRIMEIRA_AULA}
        campo={props.aPartirDe}
        tipo="date"
      />
      <CampoDeTexto chave="inicio" id="lancar-inicio" testId="lancar-inicio" rotulo={ROTULO_COMECA} campo={props.inicio} tipo="time" />
      <CampoDeTexto chave="fim" id="lancar-fim" testId="lancar-fim" rotulo={ROTULO_TERMINA} campo={props.fim} tipo="time" />
      <CampoDeTexto
        chave="vagas"
        id="lancar-vagas"
        testId="lancar-vagas"
        rotulo={ROTULO_VAGAS}
        campo={props.vagas}
        modoDeEntrada="numeric"
        numerico
      />
      <CampoDeTexto
        chave="mensalidade"
        id="lancar-mensalidade"
        testId="lancar-mensalidade"
        rotulo={ROTULO_MENSALIDADE}
        campo={props.mensalidade}
        modoDeEntrada="decimal"
        numerico
      />
      <CampoDeTexto
        chave="semanas"
        id="lancar-semanas"
        testId="lancar-semanas"
        rotulo={ROTULO_SEMANAS}
        campo={props.semanas}
        modoDeEntrada="numeric"
        numerico
      />
      <CampoDeTexto
        chave="diaVencimento"
        id="lancar-vencimento"
        testId="lancar-vencimento"
        rotulo={ROTULO_VENCIMENTO}
        campo={props.diaVencimento}
        modoDeEntrada="numeric"
        dica={DICA_VENCIMENTO}
        numerico
      />
      <label className="text-corpo text-tinta flex min-h-[44px] w-full items-center gap-3">
        <Checkbox
          data-testid="lancar-publico"
          checked={props.publica.valor}
          onCheckedChange={(valor) => props.publica.aoMudar(valor === true)}
          className="size-5"
        />
        {ROTULO_MOSTRAR_NO_SITE}
      </label>
    </div>
  );
}
