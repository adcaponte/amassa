import { exigirUsuario } from "@/lib/auth/exigir-usuario";
import { CartaoPainel } from "@/components/amassa/cartao-painel";

// Painel inicial (D-02, D-16): substitui a rota provisória da Fase 2a. `exigirUsuario()`
// continua na primeira linha — é o padrão de toda página protegida, não uma exceção desta
// tela. Os quatro cartões nascem vazios; cada um ganha dado real quando a fase do módulo
// correspondente entrar (Encomendas: Fase 3, Aulas: Fase 5, Fornos: Fase 4, Estoque: Fase 6).
// O painel de verdade, respondendo "o que preciso fazer hoje?", é a Fase 7 (PNL-01). Esta tela
// não usa `CabecalhoPagina` — a saudação já faz esse papel (D-02).
export default async function Painel() {
  const usuario = await exigirUsuario();

  return (
    <div className="flex flex-col gap-8 px-6 py-8 md:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-foreground">Olá, {usuario.nome}.</h1>
        <p className="text-micro uppercase text-muted-foreground">SEU DIA HOJE</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CartaoPainel titulo="Encomendas por etapa" vazio="Nenhuma encomenda em andamento." />
        <CartaoPainel titulo="Aulas de hoje" vazio="Nenhuma aula hoje." />
        <CartaoPainel titulo="Fornos em atenção" vazio="Nenhum forno em atenção." />
        <CartaoPainel titulo="Estoque baixo" vazio="Nenhum material em alerta." />
      </div>
    </div>
  );
}
