"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AreaFinanceira } from "@/lib/financeiro/textos";
import { LIMITE_DO_HISTORICO } from "@/lib/estoque/abas";
import {
  lerFolhaDoMaterial,
  type FolhaDoMaterial,
  type MaterialCadastrado,
} from "@/lib/estoque/acoes";
import type {
  CategoriaDeCompraAtiva,
  EncomendaParaVinculo,
  SaldoDoItem,
} from "@/lib/estoque/consultas";
import {
  FRASE_ERRO_CARREGAR_MATERIAL,
  textoToastMaterialCadastrado,
} from "@/lib/estoque/textos";

import { FolhaEditarMaterial } from "./folha-editar-material";
import { FolhaMaterial, type PromessaDaFolhaDoMaterial } from "./folha-material";
import { FolhaMovimentacao } from "./folha-movimentacao";
import { FolhaNovoMaterial } from "./folha-novo-material";
import { SeletorMaterial } from "./seletor-material";

export type TipoDeMovimentacao = "entrada" | "saida" | "ajuste";

// O que a folha e o seletor precisam, carregado JUNTO com a lista de saldos (a mesma consulta da
// aba Saldos — `listarSaldosDaRequisicao`): as encomendas em andamento para "Qual encomenda?" e o
// custo por peça de cada peça pronta com ficha (`custosDasPecasProntas`), como objeto simples (o
// `Map` do servidor não atravessa a fronteira como `Map` em todo lugar; um objeto sempre).
export type DadosDoEstoque = {
  saldos: SaldoDoItem[];
  encomendas: EncomendaParaVinculo[];
  custosDasPecasProntas: Record<string, number>;
  // As opções de "Categoria da compra" do "+ Novo material" (plano 06-09).
  categoriasDeCompra: CategoriaDeCompraAtiva[];
};

// "carregando" até a seção de saldos resolver; "erro" quando a consulta falhou (o seletor mostra o
// `EstadoErro` com "Tentar de novo", nunca uma lista vazia que pareça "nenhum material").
export type ListaDoEstoque =
  | { estado: "carregando" }
  | { estado: "erro" }
  | ({ estado: "pronta" } & DadosDoEstoque);

export type PedidoDeFolha = {
  itemId: string;
  tipo: TipoDeMovimentacao;
  // O material recém-cadastrado (UI-D12): a folha de movimentação abre em Entrada para ele ANTES de
  // a lista da página voltar do `router.refresh()` — quando ela chega, vale a linha dela.
  material?: SaldoDoItem;
};

type ContextoDoEstoque = {
  lista: ListaDoEstoque;
  abrirSeletor: (tipo?: TipoDeMovimentacao) => void;
  abrirFolha: (pedido: PedidoDeFolha) => void;
  // A folha de um material (plano 06-09) — o "Histórico" do cartão e da tabela.
  abrirFolhaDoMaterial: (itemId: string) => void;
  // "+ Novo material" (cabeçalho, barra fixa, estado vazio — plano 06-09).
  abrirNovoMaterial: () => void;
  // "Ver só esses" do banner (plano 06-07): o banner mora ACIMA das abas, e a pílula "Acabando" é
  // estado da `AbaSaldos`. A aba registra aqui o que fazer; `verSoAcabando` devolve `false` quando
  // nenhuma aba Saldos está montada (Histórico, Para onde foi) — aí o banner navega para
  // `?aba=saldos&acabando=1`.
  registrarVerSoAcabando: (acao: (() => void) | null) => void;
  verSoAcabando: () => boolean;
};

const Contexto = createContext<ContextoDoEstoque | null>(null);
// O setter mora num contexto à parte: quem só ENTREGA a lista (`EntregaDoEstoque`) não precisa
// redesenhar a cada mudança de folha aberta.
const ContextoDaEntrega = createContext<((lista: ListaDoEstoque) => void) | null>(null);

export function useEstoque(): ContextoDoEstoque {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useEstoque precisa estar dentro de <ProvedorDoEstoque>.");
  }
  return contexto;
}

// Cada abertura ganha uma `chave` nova: a folha e o seletor são montados com ela e nascem limpos,
// sem efeito que zere estado à mão (o mesmo princípio do `key` do traçador).
type FolhaAberta = PedidoDeFolha & { chave: number };
type SeletorAberto = { tipo: TipoDeMovimentacao; chave: number };
type FolhaDoMaterialAberta = { itemId: string; chave: number; promessa: PromessaDaFolhaDoMaterial };
type EdicaoAberta = { dados: FolhaDoMaterial; chave: number };

// O saldo do material recém-cadastrado, antes de a lista da página trazê-lo: saldo zero, sem
// entrada com preço, ativo, e não é peça pronta (acabou de nascer — não tem ficha de precificação).
function saldoDoMaterialNovo(material: MaterialCadastrado): SaldoDoItem {
  return {
    id: material.id,
    nome: material.nome,
    unidade: material.unidade,
    ativo: true,
    estoqueMinimoMilesimos: material.estoqueMinimoMilesimos,
    saldoMilesimos: 0,
    valorCentavos: 0,
    area: material.area,
    categoriaCompraNome: material.categoriaCompraNome,
    ehPecaPronta: false,
    ultimaEntradaComPreco: null,
  };
}

// A leitura da folha do material, disparada no TOQUE (nunca num efeito): a folha a lê com `use()`.
// Nunca rejeita — a falha de rede vira a frase da UI-SPEC, mostrada dentro da folha.
function carregarFolhaDoMaterial(itemId: string, limite: number): PromessaDaFolhaDoMaterial {
  return lerFolhaDoMaterial({ itemId, limite }).catch((falha: unknown) => {
    console.error("Falha ao carregar a folha do material:", falha);
    return { ok: false as const, erro: FRASE_ERRO_CARREGAR_MATERIAL };
  });
}

// O ÚNICO lugar que abre a folha de movimentação e o seletor "Qual material?" (key link do plano
// 06-06): o "Dar baixa" do cartão, a barra fixa do celular, o botão do cabeçalho e (plano 06-09) a
// folha do material e "Cadastrar material" chamam `abrirFolha`/`abrirSeletor` — nunca uma segunda
// folha. Também guarda a área escolhida no seletor enquanto a página está aberta (herdado de
// `escolhaFrente` do protótipo).
//
// A lista chega pela `EntregaDoEstoque`, que a seção de saldos desenha quando resolve. A barra fixa
// e o botão do cabeçalho não dependem dela: renderizam na primeira pintura; se forem tocados antes
// de a lista chegar, o seletor mostra o esqueleto.
export function ProvedorDoEstoque({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<ListaDoEstoque>({ estado: "carregando" });
  const [areaDoSeletor, setAreaDoSeletor] = useState<AreaFinanceira | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const [seletor, setSeletor] = useState<SeletorAberto | null>(null);
  const [folhaDoMaterial, setFolhaDoMaterial] = useState<FolhaDoMaterialAberta | null>(null);
  const [edicao, setEdicao] = useState<EdicaoAberta | null>(null);
  const [novoMaterial, setNovoMaterial] = useState<{ chave: number } | null>(null);
  const router = useRouter();
  // Só um contador para as chaves de montagem — nunca desenha nada, por isso é referência.
  const ultimaChave = useRef(0);

  // Uma folha por vez: abrir qualquer uma fecha as outras.
  const fecharTudo = useCallback(() => {
    setFolha(null);
    setSeletor(null);
    setFolhaDoMaterial(null);
    setEdicao(null);
    setNovoMaterial(null);
  }, []);

  const abrirSeletor = useCallback(
    (tipo: TipoDeMovimentacao = "saida") => {
      ultimaChave.current += 1;
      fecharTudo();
      setSeletor({ tipo, chave: ultimaChave.current });
    },
    [fecharTudo],
  );

  const abrirFolha = useCallback(
    (pedido: PedidoDeFolha) => {
      ultimaChave.current += 1;
      fecharTudo();
      setFolha({ ...pedido, chave: ultimaChave.current });
    },
    [fecharTudo],
  );

  const abrirFolhaDoMaterial = useCallback(
    (itemId: string) => {
      ultimaChave.current += 1;
      fecharTudo();
      setFolhaDoMaterial({
        itemId,
        chave: ultimaChave.current,
        promessa: carregarFolhaDoMaterial(itemId, LIMITE_DO_HISTORICO),
      });
    },
    [fecharTudo],
  );

  const abrirNovoMaterial = useCallback(() => {
    ultimaChave.current += 1;
    fecharTudo();
    setNovoMaterial({ chave: ultimaChave.current });
  }, [fecharTudo]);

  const abrirEdicao = useCallback(
    (dados: FolhaDoMaterial) => {
      ultimaChave.current += 1;
      fecharTudo();
      setEdicao({ dados, chave: ultimaChave.current });
    },
    [fecharTudo],
  );

  // "Cadastrar material" deu certo (UI-D12): o toast herdado manda registrar a entrada, e a folha de
  // movimentação já abre em Entrada para o material novo — a MESMA folha, pelo mesmo `abrirFolha`.
  const aoCadastrarMaterial = useCallback(
    (material: MaterialCadastrado) => {
      toast.success(textoToastMaterialCadastrado(material.nome));
      abrirFolha({ itemId: material.id, tipo: "entrada", material: saldoDoMaterialNovo(material) });
      router.refresh();
    },
    [abrirFolha, router],
  );

  // A ação "Ver só esses" da aba Saldos montada — referência, não estado: registrar não redesenha.
  const acaoDoAcabando = useRef<(() => void) | null>(null);
  const registrarVerSoAcabando = useCallback((acao: (() => void) | null) => {
    acaoDoAcabando.current = acao;
  }, []);
  const verSoAcabando = useCallback(() => {
    const acao = acaoDoAcabando.current;
    if (acao === null) {
      return false;
    }
    acao();
    return true;
  }, []);

  const valor = useMemo<ContextoDoEstoque>(
    () => ({
      lista,
      abrirSeletor,
      abrirFolha,
      abrirFolhaDoMaterial,
      abrirNovoMaterial,
      registrarVerSoAcabando,
      verSoAcabando,
    }),
    [
      lista,
      abrirSeletor,
      abrirFolha,
      abrirFolhaDoMaterial,
      abrirNovoMaterial,
      registrarVerSoAcabando,
      verSoAcabando,
    ],
  );

  const saldoDaFolhaDoMaterial =
    folhaDoMaterial && lista.estado === "pronta"
      ? (lista.saldos.find((saldo) => saldo.id === folhaDoMaterial.itemId) ?? null)
      : null;

  // A linha da lista, quando ela já tem o material; senão, o material recém-cadastrado.
  const saldoDaFolha =
    folha && lista.estado === "pronta"
      ? (lista.saldos.find((saldo) => saldo.id === folha.itemId) ?? folha.material ?? null)
      : null;

  return (
    <ContextoDaEntrega.Provider value={setLista}>
      <Contexto.Provider value={valor}>
        {children}

        {seletor ? (
          <SeletorMaterial
            key={seletor.chave}
            lista={lista}
            area={areaDoSeletor}
            aoMudarArea={setAreaDoSeletor}
            aoEscolher={(itemId) => abrirFolha({ itemId, tipo: seletor.tipo })}
            aoFechar={() => setSeletor(null)}
          />
        ) : null}

        {folha && saldoDaFolha && lista.estado === "pronta" ? (
          <FolhaMovimentacao
            key={folha.chave}
            saldo={saldoDaFolha}
            tipoInicial={folha.tipo}
            encomendas={lista.encomendas}
            custoPorPecaCentavos={lista.custosDasPecasProntas[saldoDaFolha.id] ?? null}
            aoTrocarMaterial={(tipo) => abrirSeletor(tipo)}
            aoFechar={() => setFolha(null)}
          />
        ) : null}

        {folhaDoMaterial ? (
          <FolhaMaterial
            key={folhaDoMaterial.chave}
            itemId={folhaDoMaterial.itemId}
            saldo={saldoDaFolhaDoMaterial}
            promessaInicial={folhaDoMaterial.promessa}
            carregar={(limite) => carregarFolhaDoMaterial(folhaDoMaterial.itemId, limite)}
            aoRegistrarMovimentacao={(itemId) => abrirFolha({ itemId, tipo: "saida" })}
            aoEditar={abrirEdicao}
            aoFechar={() => setFolhaDoMaterial(null)}
          />
        ) : null}

        {novoMaterial ? (
          <FolhaNovoMaterial
            key={novoMaterial.chave}
            lista={lista}
            aoCadastrar={aoCadastrarMaterial}
            aoFechar={() => setNovoMaterial(null)}
          />
        ) : null}

        {edicao ? (
          <FolhaEditarMaterial
            key={edicao.chave}
            resumo={edicao.dados.resumo}
            aoFechar={() => setEdicao(null)}
          />
        ) : null}
      </Contexto.Provider>
    </ContextoDaEntrega.Provider>
  );
}

// O componente cliente pequeno que a seção de saldos (Server Component) desenha para ENTREGAR a
// lista — ou o erro — ao provedor. Não desenha nada. Cada `router.refresh()` traz props novas e o
// efeito entrega a lista nova (o saldo da folha e do seletor acompanha o que foi gravado).
export function EntregaDoEstoque({ lista }: { lista: ListaDoEstoque }) {
  const entregar = useContext(ContextoDaEntrega);
  useEffect(() => {
    entregar?.(lista);
  }, [entregar, lista]);
  return null;
}
