"use client";

import { useEffect, useState, type BaseSyntheticEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import {
  DIAS_PADRAO,
  ETAPAS_MARCO,
  ORDEM_DAS_ETAPAS,
  type Etapa,
} from "@/lib/encomendas/cronograma";
import { atualizarEncomenda, criarEncomenda } from "@/lib/encomendas/acoes";
import { esquemaEncomenda, esquemaEtapas, esquemaItem } from "@/lib/encomendas/esquemas";
import type { EncomendaComFilhos } from "@/lib/encomendas/consultas";
import { ROTULO_ETAPA, textoDoEstadoDoMarco } from "@/lib/encomendas/textos";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { ListaItens } from "./lista-itens";
import { RodapeFormulario } from "./rodape-formulario";

// Segundo caminho de escrita de D-15: o `zodResolver` no navegador é conveniência, nunca a
// verdade (CLAUDE.md §Validação) — `criarEncomenda`/`atualizarEncomenda` revalidam no servidor
// com `esquemaEncomenda`/`esquemaEtapas`, os MESMOS módulos importados aqui. `idDoBanco`
// (em vez de `id`) evita colidir com a chave `id` que `useFieldArray` já reserva para si mesmo
// em cada linha (react-hook-form usa esse nome internamente para o `key` de renderização).
const esquemaItemDoFormulario = esquemaItem.extend({ idDoBanco: z.string().optional() });

// Reaproveita `nome`/`dataInicio` (mesma regra do servidor, via `.shape`) e as 6 etapas
// (`esquemaEtapas`, o mesmo módulo que `criarEncomenda`/`atualizarEncomenda`/
// `ajustarEtapaEncomenda` usam) — nunca uma segunda cópia da regra. `clienteNome` aqui fica
// como texto simples (o `transform` para `null` que `esquemaEncomenda` faz só importa no
// momento de gravar, no servidor); o limite de 120 caracteres é o mesmo dos dois lados.
const esquemaFormulario = z.object({
  nome: esquemaEncomenda.shape.nome,
  clienteNome: z.string().max(120, "Nome do cliente muito longo — no máximo 120 caracteres."),
  dataInicio: esquemaEncomenda.shape.dataInicio,
  itens: z
    .array(esquemaItemDoFormulario)
    .min(1, "A encomenda precisa de ao menos 1 item.")
    .max(50, "No máximo 50 itens por encomenda."),
  etapas: esquemaEtapas,
});

export type ValoresDoFormulario = z.infer<typeof esquemaFormulario>;

function valoresIniciais(encomendaParaEditar: EncomendaComFilhos | null): ValoresDoFormulario {
  if (encomendaParaEditar) {
    return {
      nome: encomendaParaEditar.nome,
      clienteNome: encomendaParaEditar.clienteNome ?? "",
      dataInicio: encomendaParaEditar.dataInicio,
      itens: encomendaParaEditar.itens.map((item) => ({
        idDoBanco: item.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
      })),
      etapas: ORDEM_DAS_ETAPAS.map((etapa) => {
        const linha = encomendaParaEditar.etapas.find((e) => e.etapa === etapa);
        return { etapa, dias: linha ? linha.dias : 0 };
      }),
    };
  }

  // Criação: a lista de itens nasce com UMA linha em branco pronta para digitar (decisão do
  // dono, 03-UI-SPEC.md "Estado inicial da lista de itens") — e as 6 etapas nascem com
  // `DIAS_PADRAO`, a mesma constante que o servidor usava como padrão antes deste plano.
  return {
    nome: "",
    clienteNome: "",
    dataInicio: "",
    itens: [{ descricao: "", quantidade: 1 }],
    etapas: DIAS_PADRAO.map((duracao) => ({ etapa: duracao.etapa, dias: duracao.dias })),
  };
}

// `components/ui/input.tsx` tem `md:text-sm` embutido (14px) — um seletor com o mesmo escopo de
// variante que qualquer `md:text-corpo` nosso, mas que vence por aparecer depois no CSS gerado
// se não repetirmos o papel EXPLICITAMENTE no breakpoint `md`. Sem isso, o campo mede 16px no
// celular e 14px no desktop — abaixo do mínimo de 16px do projeto (CLAUDE.md §Acessibilidade).
const CLASSE_DO_CAMPO = "text-corpo md:text-corpo min-h-[44px]";

export type FormularioEncomendaProps = {
  // `null`/ausente: formulário de criação. Presente: edição — buscada no SERVIDOR por
  // `buscarEncomenda` em `page.tsx` (edição por URL direta não depende de o índice já ter
  // carregado).
  encomendaParaEditar?: EncomendaComFilhos | null;
};

// Contêiner responsivo: um ÚNICO `Dialog` (Radix) por trás, com o conteúdo estilizado por CSS —
// folha ocupando a tela toda vindo de baixo no celular, modal centralizado no desktop (D-03),
// sem nenhuma detecção de dispositivo por JavaScript no estilo do hook de largura de tela que
// veio com o Sidebar do shadcn (existe no projeto, seria o erro fácil de cometer aqui) — mesma
// razão de D-02: aquele hook nasce com um `useState` indefinido e só corrige depois de montar,
// piscando o conteúdo errado antes de hidratar.
//
// **Correção de execução, registrada aqui porque diverge do texto literal do plano:** a
// primeira versão deste componente montava `Dialog` e `Sheet` — DOIS `Root` do Radix — ao mesmo
// tempo, cada um escondido por CSS num breakpoint (a leitura literal de "hidden md:contents").
// Provado por teste real (ver 03-06-SUMMARY.md): os dois `Portal` do Radix anexam o conteúdo em
// `document.body`, então a classe `hidden` de um ancestral NUNCA os esconde (o portal escapa do
// ancestral) — e pior, com dois `Root` modais abertos ao mesmo tempo, o próprio Radix marca AMBOS
// com `aria-hidden="true"` (o mecanismo de camadas que normalmente esconde o conteúdo de TRÁS de
// um diálogo agora esconde os dois diálogos um do outro), o que apagou o formulário inteiro da
// árvore de acessibilidade nos dois tamanhos de tela — quebra pior do que a que a proibição do
// hook de detecção evita. A correção é um único `Dialog`, com a classe do `DialogContent`
// respondendo ao breakpoint (mobile-first: folha de baixo; `md:`: modal centralizado) — mesma
// aparência dos dois contratos, um só `Root`, um só `FocusScope`, zero `aria-hidden` espúrio.
//
// Abertura derivada da URL via `useSearchParams()` (`nova` presente, ou `editar` com id) — nunca
// um `useState` de abertura em paralelo, que divergiria da URL e faria o botão voltar do celular
// sair da tela inteira em vez de fechar a folha.
export function FormularioEncomenda({ encomendaParaEditar = null }: FormularioEncomendaProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const novaPresente = searchParams.has("nova");
  const editarId = searchParams.get("editar");
  const aberto = novaPresente || editarId !== null;
  const modoEdicao = editarId !== null;

  // `editar={id}` na URL mas os dados daquela encomenda ainda não chegaram — navegação direta
  // por URL antes de a lista já ter carregado: esqueleto no formato do formulário, nunca campos
  // vazios (03-UI-SPEC.md "Estado de carregamento do formulário").
  const carregando = editarId !== null && encomendaParaEditar?.id !== editarId;

  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<ValoresDoFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: valoresIniciais(encomendaParaEditar),
  });

  // Reseta o formulário quando a encomenda a editar muda (ou os dados chegam) — sem isso
  // `useForm` manteria os valores da abertura anterior.
  useEffect(() => {
    if (!carregando) {
      form.reset(valoresIniciais(encomendaParaEditar));
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encomendaParaEditar?.id, novaPresente, carregando]);

  function fechar() {
    setErro(null);
    router.push("/encomendas");
  }

  async function aoSubmeter(valores: ValoresDoFormulario) {
    setErro(null);

    const resposta =
      modoEdicao && encomendaParaEditar
        ? await atualizarEncomenda({
            id: encomendaParaEditar.id,
            nome: valores.nome,
            clienteNome: valores.clienteNome,
            dataInicio: valores.dataInicio,
            itens: valores.itens.map((item) => ({
              id: item.idDoBanco,
              descricao: item.descricao,
              quantidade: item.quantidade,
            })),
            etapas: valores.etapas,
          })
        : await criarEncomenda({
            nome: valores.nome,
            clienteNome: valores.clienteNome,
            dataInicio: valores.dataInicio,
            itens: valores.itens.map((item) => ({
              descricao: item.descricao,
              quantidade: item.quantidade,
            })),
            etapas: valores.etapas,
          });

    if (!resposta.ok) {
      // Banner inline, formulário continua aberto — nada do que foi digitado se perde
      // (03-UI-SPEC.md "Formulário — Erro").
      setErro(resposta.erro);
      return;
    }

    toast.success(modoEdicao ? "Encomenda salva." : "Encomenda criada.");
    router.push("/encomendas");
    router.refresh();
  }

  const titulo = modoEdicao ? "Editar encomenda" : "Nova encomenda";
  const aoSubmeterForm = form.handleSubmit(aoSubmeter);

  return (
    <FormProvider {...form}>
      <Dialog open={aberto} onOpenChange={(novoValor) => !novoValor && fechar()}>
        <DialogContent
          showCloseButton
          aria-label={titulo}
          className={cn(
            // Celular (base, mobile-first): folha de baixo (`Sheet`), tela toda — mesmo
            // visual de `components/ui/sheet.tsx` `side="bottom"`, sem instanciar um segundo
            // `Root` do Radix.
            "inset-x-0 top-auto bottom-0 left-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none rounded-t-none border-0 border-t p-0 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:slide-out-to-bottom-10 data-closed:zoom-out-100",
            // Desktop (`md:`): modal centralizado (`Dialog`).
            "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-auto md:max-h-[85svh] md:w-full md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
          )}
        >
          <DialogHeader className="border-border border-b px-6 py-4">
            <DialogTitle className="text-display">{titulo}</DialogTitle>
          </DialogHeader>
          <CorpoDoFormulario
            carregando={carregando}
            modoEdicao={modoEdicao}
            erro={erro}
            onFechar={fechar}
            onSubmit={aoSubmeterForm}
          />
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}

export type CorpoDoFormularioProps = {
  carregando: boolean;
  modoEdicao: boolean;
  erro: string | null;
  onFechar: () => void;
  onSubmit: (evento?: BaseSyntheticEvent) => Promise<void>;
};

// Extraído como irmão para que `Dialog` e `Sheet` renderizem exatamente o mesmo conteúdo — nunca
// uma segunda versão dos campos escrita à mão duas vezes.
export function CorpoDoFormulario({
  carregando,
  modoEdicao,
  erro,
  onFechar,
  onSubmit,
}: CorpoDoFormularioProps) {
  const { register, control, formState } = useFormContext<ValoresDoFormulario>();

  if (carregando) {
    return <EsqueletoDoFormulario />;
  }

  return (
    <form
      onSubmit={(evento) => {
        void onSubmit(evento);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
        {erro && (
          <p role="alert" aria-live="assertive" className="text-apoio text-destructive">
            {erro}
          </p>
        )}

        <Field data-invalid={!!formState.errors.nome}>
          <FieldLabel htmlFor="nome">Nome da encomenda</FieldLabel>
          <Input id="nome" className={CLASSE_DO_CAMPO} {...register("nome")} />
          <FieldError errors={formState.errors.nome ? [formState.errors.nome] : undefined} />
        </Field>

        <Field data-invalid={!!formState.errors.clienteNome}>
          <FieldLabel htmlFor="clienteNome">Cliente</FieldLabel>
          <Input id="clienteNome" className={CLASSE_DO_CAMPO} {...register("clienteNome")} />
          <FieldError
            errors={formState.errors.clienteNome ? [formState.errors.clienteNome] : undefined}
          />
        </Field>

        <Field data-invalid={!!formState.errors.dataInicio}>
          <FieldLabel htmlFor="dataInicio">Data de início</FieldLabel>
          <Input
            id="dataInicio"
            type="date"
            className={CLASSE_DO_CAMPO}
            {...register("dataInicio")}
          />
          <FieldError
            errors={formState.errors.dataInicio ? [formState.errors.dataInicio] : undefined}
          />
        </Field>

        <ListaItens modoEdicao={modoEdicao} />

        <div className="flex flex-col gap-3">
          <span className="text-micro text-tinta-media uppercase tracking-wide">Etapas</span>
          {ORDEM_DAS_ETAPAS.map((etapa, indice) => (
            <EtapaDoFormulario key={etapa} etapa={etapa} indice={indice} />
          ))}
        </div>
      </div>

      {/* Rodapé ao pé do diálogo por FLEX, nunca por `position: sticky` (G-03-1).
          A versão anterior era `sticky bottom-0`, o que quebrava o desktop e passava batido no
          celular. Medido em 6 viewports com o app rodando (ver .planning/debug/resolved/
          rodape-formulario-desktop.md): este `div` é IRMÃO da área de campos, não filho dela —
          então não existe NENHUM contêiner de rolagem entre ele e o documento (a cadeia é
          form:visible > dialog-content:visible > body:hidden). Sem scrollport próprio, o
          `bottom: 0` do `sticky` se ancora no pé da JANELA, e faz essa conta nas coordenadas de
          LEIAUTE do diálogo — antes do `md:-translate-y-1/2` que o centraliza. Resultado no
          desktop: o rodapé subia exatamente `(md:top-1/2 + altura) − altura da janela` (357px a
          1280x1024, 279px a 1280x800, 209px a 1280x600 — modelo exato, ±1px da borda), parando
          no meio da janela, com campos passando por baixo dele. No celular o mesmo cálculo dá
          zero, porque `translate` é zero e a caixa de leiaute do diálogo já termina no pé da
          janela — o `sticky` sempre foi inócuo ali, e foi essa coincidência geométrica que
          escondeu o defeito.
          O `<form>` é `flex-1 flex-col` e a área de campos acima é `flex-1 min-h-0
          overflow-y-auto`: o flex sozinho já prende este rodapé ao pé do diálogo nos dois
          tamanhos de tela, com a área de campos rolando por baixo. `sticky` aqui não acrescenta
          nada — só tinha o que quebrar. */}
      <div className="border-border bg-popover flex flex-col gap-3 border-t px-6 py-4">
        <RodapeFormulario control={control} />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="border-border hover:bg-muted text-corpo flex min-h-[44px] items-center rounded-md border px-4"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            aria-busy={formState.isSubmitting}
            className="bg-primary text-primary-foreground hover:bg-primary/80 text-corpo flex min-h-[44px] items-center rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formState.isSubmitting ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </form>
  );
}

// Campo numérico para etapas de intervalo (`producao`/`secagem`/`esmaltacao`), `Switch` para
// marcos (`queima1`/`queima2`/`entrega`) — a decisão vem de `ETAPAS_MARCO`, nunca de uma lista
// escrita à mão aqui: é o que impede alguém de esquecer um caso ao adicionar uma etapa nova
// (ENC-03). Um campo numérico num marco contraria ENC-03 pela fonte ("nunca um campo numérico").
function EtapaDoFormulario({ etapa, indice }: { etapa: Etapa; indice: number }) {
  const { register, control } = useFormContext<ValoresDoFormulario>();
  const marco = ETAPAS_MARCO.includes(etapa);
  const rotulo = ROTULO_ETAPA[etapa];

  if (marco) {
    return (
      <Controller
        control={control}
        name={`etapas.${indice}.dias`}
        render={({ field }) => {
          const ligado = field.value === 1;
          return (
            <div
              className="border-border bg-background flex min-h-[44px] items-center justify-between gap-3 rounded-md border px-3 py-2"
              data-testid={`linha-marco-${etapa}`}
            >
              <Label htmlFor={`etapa-${etapa}`} className="text-corpo cursor-pointer">
                {rotulo}
              </Label>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`etapa-${etapa}`}
                  className="text-apoio text-muted-foreground cursor-pointer"
                  data-testid={`estado-marco-${etapa}`}
                >
                  {textoDoEstadoDoMarco(ligado)}
                </Label>
                <Switch
                  id={`etapa-${etapa}`}
                  checked={ligado}
                  onCheckedChange={(novoValor) => field.onChange(novoValor ? 1 : 0)}
                  aria-label={ligado ? `Desativar ${rotulo}` : `Ativar ${rotulo}`}
                  className="rounded-full [background-clip:content-box]"
                  style={{ width: 44, height: 44, paddingInline: 6, paddingBlock: 12.8 }}
                />
              </div>
            </div>
          );
        }}
      />
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={`etapa-${etapa}`}>{rotulo}</FieldLabel>
      <Input
        id={`etapa-${etapa}`}
        type="number"
        min={0}
        step={1}
        className={CLASSE_DO_CAMPO}
        {...register(`etapas.${indice}.dias`, { valueAsNumber: true })}
      />
    </Field>
  );
}

function EsqueletoDoFormulario() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4"
      data-testid="formulario-esqueleto"
    >
      {Array.from({ length: 5 }).map((_, indice) => (
        <div key={indice} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
