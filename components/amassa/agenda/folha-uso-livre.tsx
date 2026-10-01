"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";

import { corrigirChegada, encerrarUsoLivre, marcarChegada } from "@/lib/agenda/acoes";
import { esquemaEncerrarUsoLivre } from "@/lib/agenda/esquemas";
import type { UsoLivreCarregado, UsoLivreDaSemana } from "@/lib/agenda/consultas";
import { diaDaSemanaPorExtenso } from "@/lib/agenda/semana";
import {
  DICA_ENCERRAR,
  DICA_RESERVADO,
  FRASE_ERRO_CARREGAR_USO_LIVRE,
  FRASE_FALHA_AO_CORRIGIR_CHEGADA,
  FRASE_FALHA_AO_ENCERRAR,
  FRASE_FALHA_AO_MARCAR_CHEGADA,
  FRASE_HORA_DE_CHEGADA,
  FRASE_SEM_PRECO_DA_HORA,
  FRASE_USO_JA_ENCERRADO,
  LEGENDA_USO_LIVRE,
  linhaEncerrado,
  linhaHorasCheias,
  ROTULO_CHEGOU,
  ROTULO_CHEGOU_AS,
  ROTULO_CONTA_PESSOAS,
  ROTULO_ENCERRANDO,
  ROTULO_ENCERRAR_E_COBRAR,
  ROTULO_FECHAR,
  ROTULO_HORAS_CHEIAS,
  ROTULO_MARCANDO,
  ROTULO_MATERIAL_COBRADO,
  ROTULO_RECEBI_AGORA,
  ROTULO_SAIU_AS,
  ROTULO_TENTAR_DE_NOVO,
  ROTULO_VALOR,
  ROTULO_VOLTAR_A_AGENDA,
  subTituloDoUsoLivre,
  toastChegadaMarcada,
  toastUsoEncerrado,
  tituloDoUsoLivre,
} from "@/lib/agenda/textos";
import { horasCheias, materialCobradoDaLista, sugestaoDeSaida, valorDoUsoLivre } from "@/lib/agenda/uso-livre";
import { formatarReais } from "@/lib/financeiro/formato";
import { formatarDiaMes } from "@/lib/producao/calendario";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CLASSE_DA_FOLHA } from "@/components/amassa/estoque/folha-movimentacao";

import { TagDoUsoLivre } from "./cartao-evento";
import { CLASSE_DO_CAMPO_DA_AGENDA } from "./campos-turma";
import { ConfirmarCancelarReserva } from "./confirmar-cancelar-reserva";
import { FolhaRecebiAgora } from "./folha-recebi-agora";
import { MaterialDoUsoLivre } from "./material-do-uso-livre";

const LINHAS_DO_ESQUELETO = [0, 1, 2, 3] as const;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FolhaUsoLivreProps = {
  // O que o cartão já sabia no toque — o cabeçalho real aparece antes de o servidor responder. `null`
  // quando a folha abriu direto por link e o servidor ainda não respondeu (ou falhou).
  cabecalho: UsoLivreDaSemana | null;
  // O uso, quando o servidor já respondeu; `null` enquanto carrega ou quando a leitura falhou.
  carregado: UsoLivreCarregado | null;
  erroAoCarregar: boolean;
  // O agora de Brasília no servidor — o "Saiu às" de um uso de hoje (UI-D7).
  agora: { data: string; minutos: number };
  // Chamado antes de cancelar a reserva (a semana não deve avisar "não existe mais" do que a própria
  // folha removeu).
  aoComecarARemover: () => void;
  aoFechar: () => void;
};

// Uma linha da conta (`justify-between`, Corpo, divisória — 05-UI-SPEC.md §"Folha do uso livre").
function LinhaDaConta({
  rotulo,
  valor,
  testId,
  forte = false,
}: {
  rotulo: string;
  valor: string;
  testId?: string;
  // O "Valor" (600) — o foco visual da folha (05-UI-SPEC.md §"Foco Visual Principal").
  forte?: boolean;
}) {
  return (
    <div className="border-borda flex items-baseline justify-between gap-4 border-b py-2">
      <span className={forte ? "text-corpo text-tinta font-semibold" : "text-corpo text-tinta-media"}>{rotulo}</span>
      <span
        data-testid={testId}
        className={`text-corpo text-tinta text-right tabular-nums [overflow-wrap:anywhere] ${forte ? "font-semibold" : ""}`}
      >
        {valor}
      </span>
    </div>
  );
}

// A folha do uso livre (05-UI-SPEC.md §"Folha do uso livre (diálogo)"), aberta por `?uso={id}`: ponto
// `area-loja` + "Uso livre · {nome}", o sub-título com o dia e o horário e a tag de estado, a conta e,
// por estado, o que se faz: reservado → "Chegou às" (a hora da reserva, editável) + "Cancelar reserva" ·
// "Chegou"; no espaço → a conta, "Chegou às" editável, "Saiu às" e "Encerrar e cobrar"; encerrado → a
// conta congelada. Toda gravação decide no servidor, condicionada ao estado (dois celulares nunca gravam
// por cima um do outro).
export function FolhaUsoLivre({
  cabecalho,
  carregado,
  erroAoCarregar,
  agora,
  aoComecarARemover,
  aoFechar,
}: FolhaUsoLivreProps) {
  const router = useRouter();
  const uso = carregado ?? cabecalho;

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) {
          aoFechar();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="folha-uso-livre"
        data-uso-id={uso?.id}
        data-estado={carregado?.estado}
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        className={CLASSE_DA_FOLHA}
      >
        <DialogHeader className="border-border flex flex-row items-start justify-between gap-4 border-b px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-titulo text-tinta flex items-start gap-2 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="bg-area-loja mt-[10px] inline-block size-2 shrink-0 rounded-full" />
              <span className="min-w-0">{uso ? tituloDoUsoLivre(uso.titulo) : LEGENDA_USO_LIVRE}</span>
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-apoio text-tinta-fraca flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
                {uso ? (
                  <>
                    <span>
                      {subTituloDoUsoLivre(diaDaSemanaPorExtenso(uso.data), formatarDiaMes(uso.data), uso.inicio, uso.fim)}
                    </span>
                    <TagDoUsoLivre uso={uso} comEncerrado />
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label={ROTULO_FECHAR}
            data-testid="folha-uso-livre-fechar"
            onClick={aoFechar}
            className="hover:bg-muted text-tinta flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" />
          </button>
        </DialogHeader>

        {carregado === null ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
              {erroAoCarregar ? (
                <div className="flex flex-col items-start gap-3" data-testid="folha-uso-livre-erro">
                  <p role="alert" className="text-corpo text-erro">
                    {FRASE_ERRO_CARREGAR_USO_LIVRE}
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
                <div aria-busy="true" className="flex flex-col gap-3" data-testid="folha-uso-livre-carregando">
                  {LINHAS_DO_ESQUELETO.map((linha) => (
                    <Skeleton key={linha} className="h-11 w-full" />
                  ))}
                </div>
              )}
            </div>
            <div className="border-border bg-popover flex flex-wrap justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={aoFechar}
                className="text-corpo h-auto min-h-[44px] px-4 font-semibold"
              >
                {ROTULO_VOLTAR_A_AGENDA}
              </Button>
            </div>
          </>
        ) : carregado.estado === "reservado" ? (
          <Reservado
            key={`${carregado.id}-reservado`}
            uso={carregado}
            aoComecarARemover={aoComecarARemover}
            aoFechar={aoFechar}
          />
        ) : (
          <UsoIniciado key={`${carregado.id}-${carregado.estado}`} uso={carregado} agora={agora} aoFechar={aoFechar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type CampoDeHoraProps = {
  id: string;
  testId: string;
  rotulo: string;
  valor: string;
  erro: string | null;
  desabilitado?: boolean;
  aoMudar: (valor: string) => void;
  aoSair?: () => void;
};

function CampoDeHora({ id, testId, rotulo, valor, erro, desabilitado = false, aoMudar, aoSair }: CampoDeHoraProps) {
  const idDoErro = `${id}-erro`;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-apoio text-tinta font-semibold">
        {rotulo}
      </label>
      <Input
        id={id}
        type="time"
        step={60}
        data-testid={testId}
        disabled={desabilitado}
        aria-invalid={erro !== null}
        aria-describedby={erro === null ? undefined : idDoErro}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        onBlur={aoSair}
        className={`${CLASSE_DO_CAMPO_DA_AGENDA} w-40 tabular-nums`}
      />
      {erro === null ? null : (
        <p id={idDoErro} role="alert" data-testid={`${testId}-erro`} className="text-apoio text-erro">
          {erro}
        </p>
      )}
    </div>
  );
}

// Reservado (AGE-13): "Chegou às" já com a hora da reserva (editável) e a dica; rodapé "Cancelar
// reserva" (`outline` de erro, com confirmação) · "Chegou" (primário, "Marcando…").
function Reservado({
  uso,
  aoComecarARemover,
  aoFechar,
}: {
  uso: UsoLivreCarregado;
  aoComecarARemover: () => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const emVoo = useRef(false);
  const [chegada, setChegada] = useState(uso.chegadaPrevista);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function marcar() {
    if (emVoo.current) {
      return;
    }
    if (!FORMATO_HORA.test(chegada)) {
      setErro(FRASE_HORA_DE_CHEGADA);
      return;
    }
    emVoo.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await marcarChegada({ usoLivreId: uso.id, chegada });
      if (!resposta.ok) {
        setErro(resposta.erro);
        router.refresh();
        return;
      }
      toast.success(toastChegadaMarcada(resposta.dados.chegada));
      // A ação revalidou a Agenda: a folha chega com o estado "no espaço" (a chave muda e este bloco sai).
    } catch {
      setErro(FRASE_FALHA_AO_MARCAR_CHEGADA);
    } finally {
      emVoo.current = false;
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="flex flex-col" data-testid="uso-conta">
          <LinhaDaConta rotulo={ROTULO_CONTA_PESSOAS} valor={String(uso.pessoas)} />
        </div>
        <CampoDeHora
          id="uso-chegou-as"
          testId="uso-chegou-as"
          rotulo={ROTULO_CHEGOU_AS}
          valor={chegada}
          erro={erro}
          desabilitado={enviando}
          aoMudar={(valor) => {
            setChegada(valor);
            setErro(null);
          }}
        />
        <p className="text-apoio text-tinta-fraca">{DICA_RESERVADO}</p>
      </div>
      <div className="border-border bg-popover flex flex-wrap items-start justify-between gap-2 border-t px-6 py-4">
        <ConfirmarCancelarReserva
          usoLivreId={uso.id}
          nome={uso.titulo}
          data={uso.data}
          desabilitado={enviando}
          aoComecar={aoComecarARemover}
          aoCancelar={aoFechar}
          aoFecharDepoisDaRecusa={() => router.refresh()}
        />
        <Button
          type="button"
          data-testid="uso-chegou"
          disabled={enviando}
          aria-busy={enviando ? "true" : undefined}
          onClick={() => void marcar()}
          className="text-corpo h-auto min-h-[52px] px-6 font-semibold"
        >
          {enviando ? ROTULO_MARCANDO : ROTULO_CHEGOU}
        </Button>
      </div>
    </>
  );
}

// No espaço — e o dia passado esquecido (D-18), que é o mesmo fluxo — e encerrado. No espaço: a conta
// (Pessoas · Horas cheias · Valor, recalculada a cada mudança de "Saiu às", `aria-live`), "Chegou às"
// editável até encerrar (corrigido ao sair do campo, `corrigirChegada`), "Saiu às" já com a hora de AGORA
// num uso de hoje e com a saída prevista num de outro dia (UI-D7), a dica da hora cheia e "Encerrar e
// cobrar". Sem o preço da hora no Catálogo, a caixa âmbar diz onde cadastrar e o botão fica desabilitado
// com a frase como `aria-describedby` (AGE-17) — o servidor recusa do mesmo jeito. Encerrado: a conta
// CONGELADA e "Encerrado · {h} h"; a receber, "Recebi agora" (plano 11) no rodapé — "Lançar na Venda" é
// do plano 12.
function UsoIniciado({
  uso,
  agora,
  aoFechar,
}: {
  uso: UsoLivreCarregado;
  agora: { data: string; minutos: number };
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [chegada, setChegada] = useState(uso.chegada ?? uso.chegadaPrevista);
  const gravada = useRef(uso.chegada ?? uso.chegadaPrevista);
  const [erroDaChegada, setErroDaChegada] = useState<string | null>(null);
  const [saida, setSaida] = useState(() => sugestaoDeSaida(uso, agora));
  const [erroDaSaida, setErroDaSaida] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const emVoo = useRef(false);
  const [encerrando, setEncerrando] = useState(false);
  // A folha "Recebi agora" aberta por cima (plano 11), no uso encerrado e ainda a receber.
  const [recebendo, setRecebendo] = useState(false);

  async function corrigir() {
    if (chegada === gravada.current) {
      return;
    }
    if (!FORMATO_HORA.test(chegada)) {
      setErroDaChegada(FRASE_HORA_DE_CHEGADA);
      return;
    }
    const pedida = chegada;
    try {
      const resposta = await corrigirChegada({ usoLivreId: uso.id, chegada: pedida });
      if (!resposta.ok) {
        setErroDaChegada(resposta.erro);
        router.refresh();
        return;
      }
      gravada.current = resposta.dados.chegada;
      setErroDaChegada(null);
    } catch {
      setErroDaChegada(FRASE_FALHA_AO_CORRIGIR_CHEGADA);
    }
  }

  async function encerrar() {
    if (emVoo.current) {
      return;
    }
    setErroGeral(null);
    // A mesma regra do servidor, antes de gravar — o servidor confere de novo (a única que vale).
    const entrada = { usoLivreId: uso.id, chegada, saida };
    const conferido = esquemaEncerrarUsoLivre.safeParse(entrada);
    if (!conferido.success) {
      for (const problema of conferido.error.issues) {
        if (problema.path[0] === "chegada") {
          setErroDaChegada(problema.message);
        } else if (problema.path[0] === "saida") {
          setErroDaSaida(problema.message);
        } else {
          setErroGeral(problema.message);
        }
      }
      return;
    }
    emVoo.current = true;
    setEncerrando(true);
    try {
      const resposta = await encerrarUsoLivre(entrada);
      if (!resposta.ok) {
        if (resposta.campos?.saida) {
          setErroDaSaida(resposta.campos.saida);
        } else if (resposta.campos?.chegada) {
          setErroDaChegada(resposta.campos.chegada);
        } else if (resposta.erro === FRASE_USO_JA_ENCERRADO) {
          // Encerrado em outro celular: a ação já revalidou a Agenda — a folha chega no estado novo
          // (e este bloco sai), então a frase vai num toast.
          toast.error(resposta.erro);
        } else {
          setErroGeral(resposta.erro);
        }
        return;
      }
      toast.success(
        toastUsoEncerrado(resposta.dados.horasCheias, formatarReais(resposta.dados.valorCentavos), {
          cobrado: resposta.dados.materialCobradoCentavos > 0,
          baixado: resposta.dados.materiaisBaixados > 0,
        }),
      );
      // A ação revalidou a Agenda: a folha chega "encerrado" (a chave muda e este bloco sai).
    } catch {
      // A folha continua aberta e preenchida.
      setErroGeral(FRASE_FALHA_AO_ENCERRAR);
    } finally {
      emVoo.current = false;
      setEncerrando(false);
    }
  }

  // O material cobrado da lista: o congelado no encerrado; antes, a prévia com o preço de agora.
  const materialCobrado = materialCobradoDaLista(uso.materiais);

  if (uso.estado === "encerrado") {
    const horas = uso.horasCheias ?? 0;
    const preco = uso.precoHoraCongeladoCentavos ?? 0;
    const valor = uso.valorCentavos ?? 0;
    // O "= {R$}" da linha das horas é só a parte das horas; o "Valor" é o gravado (horas + material).
    const valorDasHoras = valor - materialCobrado;
    const baixados = uso.materiais.filter((linha) => linha.baixado).length;
    // "A receber" = sem venda ativa (ou com a venda cancelada no Caixa, D-08) e com valor — a situação
    // vem do Financeiro, derivada no servidor. Lançado ou pago: só "Voltar à agenda".
    const cobranca = uso.cobranca;
    const aReceber =
      cobranca !== null &&
      valor > 0 &&
      (cobranca.situacao === "a_receber" || cobranca.situacao === "venda_cancelada");
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-col" data-testid="uso-conta">
            <LinhaDaConta rotulo={ROTULO_CONTA_PESSOAS} valor={String(uso.pessoas)} />
            <LinhaDaConta
              rotulo={ROTULO_HORAS_CHEIAS}
              valor={linhaHorasCheias(horas, uso.pessoas, formatarReais(preco), formatarReais(valorDasHoras))}
              testId="uso-conta-horas"
            />
            {materialCobrado > 0 ? (
              <LinhaDaConta rotulo={ROTULO_MATERIAL_COBRADO} valor={formatarReais(materialCobrado)} testId="uso-conta-material" />
            ) : null}
            <LinhaDaConta rotulo={ROTULO_VALOR} valor={formatarReais(valor)} testId="uso-conta-valor" forte />
          </div>
          <p data-testid="uso-encerrado" className="text-corpo text-tinta-media">
            {linhaEncerrado(horas, baixados)}
          </p>
          <MaterialDoUsoLivre
            usoLivreId={uso.id}
            materiais={uso.materiais}
            precosDeVenda={uso.precosDeVenda}
            editavel={false}
            desabilitado
          />
        </div>
        <div className="border-border bg-popover flex flex-wrap justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            data-testid="uso-voltar"
            onClick={aoFechar}
            className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
          >
            {ROTULO_VOLTAR_A_AGENDA}
          </Button>
          {aReceber && cobranca !== null ? (
            <Button
              type="button"
              variant="outline"
              data-testid="recebi-agora"
              onClick={() => setRecebendo(true)}
              className="text-corpo h-auto min-h-[44px] px-4 font-semibold max-[359px]:w-full"
            >
              {ROTULO_RECEBI_AGORA}
            </Button>
          ) : null}
        </div>
        {recebendo && cobranca !== null ? (
          <FolhaRecebiAgora
            cobranca={{
              tipo: "uso_livre",
              id: uso.id,
              nome: uso.titulo,
              descricao: cobranca.descricao,
              valorCentavos: valor,
            }}
            taxaCartaoPontosBase={cobranca.taxaCartaoPontosBase}
            aoFechar={() => setRecebendo(false)}
          />
        ) : null}
      </>
    );
  }

  // A conta de agora, das horas do campo — o servidor refaz a mesma conta sob a trava ao encerrar.
  const preco = uso.precoHoraAtualCentavos;
  let horas: number | null = null;
  if (FORMATO_HORA.test(chegada) && FORMATO_HORA.test(saida)) {
    try {
      horas = horasCheias(chegada, saida);
    } catch {
      horas = null;
    }
  }
  const valorDasHoras =
    horas !== null && preco !== null
      ? valorDoUsoLivre({ horas, pessoas: uso.pessoas, precoHoraCentavos: preco, materialCobradoCentavos: 0 })
      : null;
  const valor =
    horas !== null && preco !== null
      ? valorDoUsoLivre({ horas, pessoas: uso.pessoas, precoHoraCentavos: preco, materialCobradoCentavos: materialCobrado })
      : null;
  const semPreco = preco === null;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        <div className="flex flex-col" data-testid="uso-conta" aria-live="polite">
          <LinhaDaConta rotulo={ROTULO_CONTA_PESSOAS} valor={String(uso.pessoas)} />
          <LinhaDaConta
            rotulo={ROTULO_HORAS_CHEIAS}
            valor={
              horas === null
                ? "—"
                : preco === null || valorDasHoras === null
                  ? `${horas} h`
                  : linhaHorasCheias(horas, uso.pessoas, formatarReais(preco), formatarReais(valorDasHoras))
            }
            testId="uso-conta-horas"
          />
          {materialCobrado > 0 ? (
            <LinhaDaConta rotulo={ROTULO_MATERIAL_COBRADO} valor={formatarReais(materialCobrado)} testId="uso-conta-material" />
          ) : null}
          <LinhaDaConta
            rotulo={ROTULO_VALOR}
            valor={valor === null ? "—" : formatarReais(valor)}
            testId="uso-conta-valor"
            forte
          />
        </div>
        <CampoDeHora
          id="uso-chegou-as"
          testId="uso-chegou-as"
          rotulo={ROTULO_CHEGOU_AS}
          valor={chegada}
          erro={erroDaChegada}
          desabilitado={encerrando}
          aoMudar={(novo) => {
            setChegada(novo);
            setErroDaChegada(null);
            setErroDaSaida(null);
          }}
          aoSair={() => void corrigir()}
        />
        <MaterialDoUsoLivre
          usoLivreId={uso.id}
          materiais={uso.materiais}
          precosDeVenda={uso.precosDeVenda}
          editavel
          desabilitado={encerrando}
        />
        <CampoDeHora
          id="uso-saiu-as"
          testId="uso-saiu-as"
          rotulo={ROTULO_SAIU_AS}
          valor={saida}
          erro={erroDaSaida}
          desabilitado={encerrando}
          aoMudar={(novo) => {
            setSaida(novo);
            setErroDaSaida(null);
          }}
        />
        <p className="text-apoio text-tinta-fraca">{DICA_ENCERRAR}</p>
        {semPreco ? (
          <div
            id="aviso-sem-preco-hora"
            data-testid="aviso-sem-preco-hora"
            role="status"
            className="bg-atencao-fundo text-atencao text-apoio flex items-start gap-2 rounded-md p-4 font-semibold"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{FRASE_SEM_PRECO_DA_HORA}</span>
          </div>
        ) : null}
      </div>
      <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
        {erroGeral ? (
          <p role="alert" data-testid="uso-erro" className="text-apoio text-erro">
            {erroGeral}
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Button
            type="button"
            data-testid="uso-encerrar"
            disabled={semPreco || encerrando}
            aria-describedby={semPreco ? "aviso-sem-preco-hora" : undefined}
            aria-busy={encerrando ? "true" : undefined}
            onClick={() => void encerrar()}
            className="text-corpo h-auto min-h-[52px] px-6 font-semibold whitespace-normal"
          >
            {encerrando ? ROTULO_ENCERRANDO : ROTULO_ENCERRAR_E_COBRAR}
          </Button>
        </div>
      </div>
    </>
  );
}
