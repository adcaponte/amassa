"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";

import { editarTurma, marcarMaisSemanas } from "@/lib/agenda/acoes";
import type { TurmaCarregada } from "@/lib/agenda/consultas";
import { esquemaEditarTurma, esquemaMarcarMaisSemanas } from "@/lib/agenda/esquemas";
import { diaDaSemanaPorExtenso, mesVizinho, nomeDoMes } from "@/lib/agenda/semana";
import {
  DICA_DIA_DA_SEMANA_FIXO,
  DICA_MARCAR_MAIS,
  DICA_VENCIMENTO,
  dicaAoEditarTurma,
  FRASE_ERRO_CARREGAR_TURMA,
  FRASE_FALHA_AO_MARCAR_SEMANAS,
  FRASE_FALHA_AO_SALVAR_TURMA,
  FRASE_NENHUM_ALUNO,
  FRASE_NENHUMA_DATA_FUTURA,
  linhaDatasMarcadas,
  linhaDiaDaSemanaDaTurma,
  ROTULO_COMECA,
  ROTULO_FECHAR,
  ROTULO_MARCANDO,
  ROTULO_MARCAR_MAIS,
  ROTULO_MARCAR_MAIS_SEMANAS,
  ROTULO_MENSALIDADE,
  ROTULO_MOSTRAR_NO_SITE,
  ROTULO_NOME,
  ROTULO_SALVANDO,
  ROTULO_SALVAR_TURMA,
  ROTULO_SEMANAS_DO_MARCAR_MAIS,
  ROTULO_TENTAR_DE_NOVO,
  ROTULO_TERMINA,
  ROTULO_VAGAS,
  ROTULO_VENCIMENTO,
  ROTULO_VOLTAR,
  ROTULO_VOLTAR_A_DATA,
  SEMANAS_PADRAO,
  subTituloDaTurma,
  TITULO_DATAS_DA_TURMA,
  tagARepor,
  tituloAlunos,
  toastDatasNovas,
  TOAST_TURMA_SALVA,
} from "@/lib/agenda/textos";
import { NOMES_DOS_DIAS, rotuloDaTurmaNaGestao } from "@/lib/agenda/turma";
import { converterReaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Folha, FolhaCorpo, FolhaRodape } from "@/components/amassa/folha";

import { CampoDeTexto, capitalizar, CLASSE_DO_CAMPO_DA_AGENDA, type CampoControlado } from "./campos-turma";
import { ConfirmarDesativarTurma } from "./confirmar-desativar-turma";

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;

type CampoDaTurma = "nome" | "inicio" | "fim" | "vagas" | "mensalidade" | "diaVencimento";

const ORDEM_DOS_CAMPOS: readonly CampoDaTurma[] = ["nome", "inicio", "fim", "vagas", "mensalidade", "diaVencimento"];

// 32050 → "320,50" — inteiro, sem ponto flutuante.
function centavosParaCampo(centavos: number): string {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`;
}

type Valores = {
  nome: string;
  inicio: string;
  fim: string;
  vagas: string;
  mensalidade: string;
  diaVencimento: string;
  publica: boolean;
};

function valoresDaTurma(turma: TurmaCarregada): Valores {
  return {
    nome: turma.nome,
    inicio: turma.inicio,
    fim: turma.fim,
    vagas: String(turma.vagas),
    mensalidade: centavosParaCampo(turma.mensalidadeCentavos),
    diaVencimento: String(turma.diaVencimento),
    publica: turma.publica,
  };
}

// "Salvar turma" só acende quando algo mudou de verdade: "320" e "320,00" são a mesma mensalidade.
function mudou(atuais: Valores, originais: Valores): boolean {
  const mensalidadeAtual = converterReaisParaCentavos(atuais.mensalidade);
  const mensalidadeOriginal = converterReaisParaCentavos(originais.mensalidade);
  const mesmaMensalidade =
    mensalidadeAtual.ok && mensalidadeOriginal.ok
      ? mensalidadeAtual.centavos === mensalidadeOriginal.centavos
      : atuais.mensalidade === originais.mensalidade;
  return (
    atuais.nome !== originais.nome ||
    atuais.inicio !== originais.inicio ||
    atuais.fim !== originais.fim ||
    atuais.vagas.trim() !== originais.vagas ||
    !mesmaMensalidade ||
    atuais.diaVencimento.trim() !== originais.diaVencimento ||
    atuais.publica !== originais.publica
  );
}

export type FolhaTurmaProps = {
  // O que já se sabia no toque ("Abrir a turma": o nome) — o cabeçalho real aparece antes de o
  // servidor responder.
  cabecalho: { id: string; nome: string };
  // A turma lida pelo servidor; `null` enquanto carrega.
  carregada: TurmaCarregada | null;
  // A leitura falhou: o erro aparece DENTRO da folha, com "Tentar de novo".
  erroAoCarregar: boolean;
  hoje: string;
  // Aberta a partir de uma data (UI-D25): o cabeçalho tem "Voltar à data".
  aoVoltarAData: (() => void) | null;
  aoFechar: () => void;
};

// A folha da turma (D-03; 05-UI-SPEC.md §"Folha da turma (diálogo — D-03)"), aberta por `?turma={id}`
// NO LUGAR da folha da data (um diálogo por vez). Edita para frente, marca mais semanas com os alunos
// dentro e desativa sem apagar o passado. A turma desativada abre só para leitura, com "desativada em
// {dd/mm}".
export function FolhaTurma({ cabecalho, carregada, erroAoCarregar, hoje, aoVoltarAData, aoFechar }: FolhaTurmaProps) {
  const router = useRouter();
  const nome = carregada?.nome ?? cabecalho.nome;
  const [enviando, setEnviando] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !enviando) {
          aoFechar();
        }
      }}
    >
      <Folha
        data-testid="folha-turma"
        data-turma-id={cabecalho.id}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            {aoVoltarAData !== null ? (
              <button
                type="button"
                data-testid="voltar-a-data"
                onClick={aoVoltarAData}
                disabled={enviando}
                className="text-apoio text-tinta-media inline-flex min-h-[44px] items-center gap-1 self-start rounded-md underline underline-offset-4 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {ROTULO_VOLTAR_A_DATA}
              </button>
            ) : null}
            <DialogTitle className="text-titulo text-tinta flex items-center gap-2 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="bg-area-espaco inline-block size-2 shrink-0 rounded-full" />
              {nome}
            </DialogTitle>
            <DialogDescription data-testid="folha-turma-subtitulo" className="text-apoio text-tinta-fraca [overflow-wrap:anywhere]">
              {carregada === null
                ? null
                : subTituloDaTurma({
                    quando: rotuloDaTurmaNaGestao(carregada),
                    alunos: carregada.alunos.length,
                    vagas: carregada.vagas,
                    publica: carregada.publica,
                    desativadaEm: carregada.ativa ? null : carregada.desativadaEm,
                  })}
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-turma-fechar"
            disabled={enviando}
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        {carregada !== null ? (
          // `key`: a turma salva (ou outra turma) recomeça o formulário com o que está no banco.
          <ConteudoDaTurma
            key={`${carregada.id}-${carregada.nome}-${carregada.inicio}-${carregada.fim}-${carregada.vagas}-${carregada.mensalidadeCentavos}-${carregada.diaVencimento}-${carregada.publica}-${carregada.ativa}`}
            turma={carregada}
            hoje={hoje}
            aoMudarEnvio={setEnviando}
            aoVoltar={aoVoltarAData ?? aoFechar}
          />
        ) : (
          <>
            <FolhaCorpo>
              {erroAoCarregar ? (
                <div className="flex flex-col items-start gap-3" data-testid="folha-turma-erro">
                  <p role="alert" className="text-corpo text-erro">
                    {FRASE_ERRO_CARREGAR_TURMA}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.refresh()}
                    className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
                  >
                    {ROTULO_TENTAR_DE_NOVO}
                  </Button>
                </div>
              ) : (
                <div aria-busy="true" className="flex flex-col gap-3" data-testid="folha-turma-carregando">
                  <Skeleton className="h-4 w-40" />
                  {LINHAS_DO_ESQUELETO.map((linha) => (
                    <Skeleton key={linha} className="h-11 w-full" />
                  ))}
                </div>
              )}
            </FolhaCorpo>
            <FolhaRodape className="flex-row flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={aoVoltarAData ?? aoFechar}
                className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
              >
                {ROTULO_VOLTAR}
              </Button>
            </FolhaRodape>
          </>
        )}
      </Folha>
    </Dialog>
  );
}

type ConteudoDaTurmaProps = {
  turma: TurmaCarregada;
  hoje: string;
  aoMudarEnvio: (enviando: boolean) => void;
  aoVoltar: () => void;
};

function ConteudoDaTurma({ turma, hoje, aoMudarEnvio, aoVoltar }: ConteudoDaTurmaProps) {
  const router = useRouter();
  const originais = valoresDaTurma(turma);
  const [valores, setValores] = useState<Valores>(originais);
  const [erros, setErros] = useState<Partial<Record<CampoDaTurma, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [semanas, setSemanas] = useState(SEMANAS_PADRAO);
  const [erroSemanas, setErroSemanas] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);

  // Guardas síncronas contra o toque duplo.
  const salvandoAgora = useRef(false);
  const marcandoAgora = useRef(false);
  const campos = useRef<Partial<Record<CampoDaTurma, HTMLElement | null>>>({});
  const campoSemanas = useRef<HTMLInputElement | null>(null);

  const ativa = turma.ativa;
  const houveMudanca = mudou(valores, originais);
  const mesAtual = hoje.slice(0, 7);

  function controlado(campo: CampoDaTurma): CampoControlado {
    return {
      valor: valores[campo],
      erro: erros[campo],
      registrar: (elemento) => {
        campos.current[campo] = elemento;
      },
      aoMudar: (novo) => {
        setValores((atuais) => ({ ...atuais, [campo]: novo }));
        setErros((atuais) => {
          const resto = { ...atuais };
          delete resto[campo];
          if (campo === "inicio" || campo === "fim") {
            delete resto.inicio;
            delete resto.fim;
          }
          return resto;
        });
      },
    };
  }

  function mostrarErros(problemas: readonly { path: PropertyKey[]; message: string }[]) {
    const novos: Partial<Record<CampoDaTurma, string>> = {};
    for (const problema of problemas) {
      const campo = String(problema.path[0] ?? "") as CampoDaTurma;
      if (ORDEM_DOS_CAMPOS.includes(campo) && novos[campo] === undefined) {
        novos[campo] = problema.message;
      }
    }
    setErros(novos);
    const primeiro = ORDEM_DOS_CAMPOS.find((campo) => novos[campo] !== undefined);
    if (primeiro) {
      window.requestAnimationFrame(() => campos.current[primeiro]?.focus());
    }
    return Object.keys(novos).length > 0;
  }

  async function salvar() {
    if (salvandoAgora.current || !houveMudanca) {
      return;
    }
    setErroGeral(null);
    const entrada = { turmaId: turma.id, ...valores };
    const conferido = esquemaEditarTurma.safeParse(entrada);
    if (!conferido.success) {
      mostrarErros(conferido.error.issues);
      return;
    }
    setErros({});
    salvandoAgora.current = true;
    setSalvando(true);
    aoMudarEnvio(true);
    try {
      const resposta = await editarTurma(entrada);
      if (!resposta.ok) {
        const porCampo = Object.entries(resposta.campos ?? {}).map(([campo, message]) => ({ path: [campo], message }));
        if (!mostrarErros(porCampo)) {
          setErroGeral(resposta.erro);
        }
        return;
      }
      toast.success(TOAST_TURMA_SALVA);
      router.refresh();
    } catch {
      setErroGeral(FRASE_FALHA_AO_SALVAR_TURMA);
    } finally {
      salvandoAgora.current = false;
      setSalvando(false);
      aoMudarEnvio(false);
    }
  }

  async function marcarMais() {
    if (marcandoAgora.current) {
      return;
    }
    setErroSemanas(null);
    const entrada = { turmaId: turma.id, semanas };
    const conferido = esquemaMarcarMaisSemanas.safeParse(entrada);
    if (!conferido.success) {
      setErroSemanas(conferido.error.issues[0]?.message ?? FRASE_FALHA_AO_MARCAR_SEMANAS);
      campoSemanas.current?.focus();
      return;
    }
    marcandoAgora.current = true;
    setMarcando(true);
    aoMudarEnvio(true);
    try {
      const resposta = await marcarMaisSemanas(entrada);
      if (!resposta.ok) {
        setErroSemanas(resposta.erro);
        return;
      }
      if (resposta.dados.ate !== null) {
        toast.success(toastDatasNovas(resposta.dados.datas, formatarDiaMes(resposta.dados.ate)));
      }
      router.refresh();
    } catch {
      setErroSemanas(FRASE_FALHA_AO_MARCAR_SEMANAS);
    } finally {
      marcandoAgora.current = false;
      setMarcando(false);
      aoMudarEnvio(false);
    }
  }

  const ocupado = salvando || marcando;
  const linhaDasDatas =
    turma.ultimaData !== null && turma.datasFuturas > 0
      ? linhaDatasMarcadas(diaDaSemanaPorExtenso(turma.ultimaData), formatarDiaMes(turma.ultimaData), turma.datasFuturas)
      : FRASE_NENHUMA_DATA_FUTURA;

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        // Um formulário de dentro (diálogo pelo portal) não é este — CR-01 da revisão B.
        if (evento.target !== evento.currentTarget) {
          return;
        }
        void salvar();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FolhaCorpo>
        {ativa ? (
          <div className="flex flex-wrap gap-4">
            <CampoDeTexto chave="nome" id="turma-nome" testId="turma-nome" rotulo={ROTULO_NOME} campo={controlado("nome")} larguraTotal />
            <div className="flex w-full flex-col gap-1">
              <p className="text-corpo text-tinta" data-testid="turma-dia-da-semana">
                {linhaDiaDaSemanaDaTurma(capitalizar(NOMES_DOS_DIAS[turma.diaSemana]))}
              </p>
              <p className="text-apoio text-tinta-fraca">{DICA_DIA_DA_SEMANA_FIXO}</p>
            </div>
            <CampoDeTexto chave="inicio" id="turma-inicio" testId="turma-inicio" rotulo={ROTULO_COMECA} campo={controlado("inicio")} tipo="time" />
            <CampoDeTexto chave="fim" id="turma-fim" testId="turma-fim" rotulo={ROTULO_TERMINA} campo={controlado("fim")} tipo="time" />
            <CampoDeTexto
              chave="vagas"
              id="turma-vagas"
              testId="turma-vagas"
              rotulo={ROTULO_VAGAS}
              campo={controlado("vagas")}
              modoDeEntrada="numeric"
              numerico
            />
            <CampoDeTexto
              chave="mensalidade"
              id="turma-mensalidade"
              testId="turma-mensalidade"
              rotulo={ROTULO_MENSALIDADE}
              campo={controlado("mensalidade")}
              modoDeEntrada="decimal"
              numerico
            />
            <CampoDeTexto
              chave="diaVencimento"
              id="turma-vencimento"
              testId="turma-vencimento"
              rotulo={ROTULO_VENCIMENTO}
              campo={controlado("diaVencimento")}
              modoDeEntrada="numeric"
              dica={DICA_VENCIMENTO}
              numerico
            />
            <label className="text-corpo text-tinta flex min-h-[44px] w-full items-center gap-3">
              <Checkbox
                data-testid="turma-publica"
                checked={valores.publica}
                onCheckedChange={(valor) => setValores((atuais) => ({ ...atuais, publica: valor === true }))}
                className="size-5"
              />
              {ROTULO_MOSTRAR_NO_SITE}
            </label>
            <p className="text-apoio text-tinta-fraca w-full">
              {dicaAoEditarTurma(nomeDoMes(mesVizinho(mesAtual, 1)), nomeDoMes(mesAtual))}
            </p>
          </div>
        ) : null}

        <section className="flex flex-col gap-2" aria-labelledby="turma-datas-titulo">
          <h3
            id="turma-datas-titulo"
            className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
          >
            {TITULO_DATAS_DA_TURMA}
          </h3>
          <p className="text-corpo text-tinta" data-testid="turma-datas-marcadas">
            {linhaDasDatas}
          </p>
          {ativa ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="turma-marcar-mais" className="text-corpo text-tinta">
                  {ROTULO_MARCAR_MAIS}
                </label>
                <Input
                  id="turma-marcar-mais"
                  ref={campoSemanas}
                  inputMode="numeric"
                  data-testid="turma-marcar-mais-semanas"
                  autoComplete="off"
                  aria-describedby={erroSemanas === null ? "turma-marcar-mais-dica" : "turma-marcar-mais-dica turma-marcar-mais-erro"}
                  aria-invalid={erroSemanas !== null}
                  value={semanas}
                  onChange={(evento) => {
                    setSemanas(evento.target.value);
                    setErroSemanas(null);
                  }}
                  // IN-02 da revisão B: o campo está dentro do formulário da turma — Enter aqui é "Marcar
                  // mais", nunca "Salvar turma" com o que mais estiver editado.
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter") {
                      evento.preventDefault();
                      if (!ocupado) {
                        void marcarMais();
                      }
                    }
                  }}
                  className={`${CLASSE_DO_CAMPO_DA_AGENDA} w-20 tabular-nums`}
                />
                <span className="text-corpo text-tinta">{ROTULO_SEMANAS_DO_MARCAR_MAIS}</span>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="marcar-mais-semanas"
                  disabled={ocupado}
                  aria-busy={marcando ? "true" : undefined}
                  onClick={() => void marcarMais()}
                  className="text-corpo h-auto min-h-[44px] px-4 font-semibold whitespace-normal"
                >
                  {marcando ? ROTULO_MARCANDO : ROTULO_MARCAR_MAIS_SEMANAS}
                </Button>
              </div>
              <p id="turma-marcar-mais-dica" className="text-apoio text-tinta-fraca">
                {DICA_MARCAR_MAIS}
              </p>
              {erroSemanas !== null ? (
                <p id="turma-marcar-mais-erro" role="alert" data-testid="turma-marcar-mais-erro" className="text-apoio text-erro">
                  {erroSemanas}
                </p>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="flex flex-col gap-2" aria-labelledby="turma-alunos-titulo">
          <h3
            id="turma-alunos-titulo"
            data-testid="turma-alunos-titulo"
            className="text-apoio text-tinta-media font-semibold tracking-[0.06em] uppercase"
          >
            {tituloAlunos(turma.alunos.length)}
          </h3>
          {turma.alunos.length === 0 ? (
            <p className="text-corpo text-tinta-fraca" data-testid="turma-sem-alunos">
              {FRASE_NENHUM_ALUNO}
            </p>
          ) : (
            <ul className="flex flex-col" data-testid="turma-alunos">
              {turma.alunos.map((aluno) => (
                <li
                  key={aluno.clienteId}
                  data-testid="turma-aluno"
                  className="border-borda text-corpo text-tinta flex flex-wrap items-center gap-x-2 gap-y-1 border-b py-2 font-semibold [overflow-wrap:anywhere] last:border-b-0"
                >
                  <span className="min-w-0">{aluno.nome}</span>
                  {aluno.aRepor > 0 ? (
                    <span
                      data-testid="turma-aluno-a-repor"
                      className="text-apoio bg-atencao-fundo text-atencao rounded-sm px-2 font-semibold whitespace-nowrap"
                    >
                      {tagARepor(aluno.aRepor)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {ativa ? (
          <ConfirmarDesativarTurma
            turmaId={turma.id}
            nome={turma.nome}
            perdas={turma.perdasAoDesativar}
            aoDesativar={() => router.refresh()}
          />
        ) : null}
      </FolhaCorpo>

      <FolhaRodape erro={erroGeral} dataTestIdErro="turma-erro-geral">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            data-testid="folha-turma-voltar"
            disabled={ocupado}
            onClick={aoVoltar}
            className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
          >
            {ROTULO_VOLTAR}
          </Button>
          {ativa ? (
            <Button
              type="submit"
              data-testid="salvar-turma"
              disabled={!houveMudanca || ocupado}
              aria-busy={salvando ? "true" : undefined}
              className="text-corpo h-auto min-h-[52px] flex-1 px-6 font-semibold whitespace-normal"
            >
              {salvando ? ROTULO_SALVANDO : ROTULO_SALVAR_TURMA}
            </Button>
          ) : null}
        </div>
      </FolhaRodape>
    </form>
  );
}
