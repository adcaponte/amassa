// Só servidor (escreve no banco): a mensalidade do mês garantida UMA vez por requisição (D-21, Fase
// 06.5). D-02 manda a mensalidade do mês de quem já era aluno nascer ANTES de ler — ao abrir a Agenda,
// a ficha e o Início. A página da Agenda monta várias seções em paralelo (as abas com o contador, “A
// receber”, a lista de Pessoas, a ficha), e cada uma garantia o mês de novo: até quatro `insert … on
// conflict do nothing` iguais na mesma requisição. A escrita é idempotente (chave única — o porquê está
// em `garantirMensalidadesDoMes`, `lib/agenda/gravacao.ts`), então o resultado não muda; uma por
// requisição basta.
//
// `cache` do React, por mês: vale só DENTRO de uma renderização do servidor e nunca guarda nada entre
// requisições — a requisição seguinte garante de novo (é o que faz o mês virar sozinho no dia 1). Fora
// de uma renderização só repassa a chamada. Uma falha fica memorizada na mesma requisição: as seções
// que dependem dela recebem o mesmo erro, como receberiam ao tentar de novo com o banco fora.
//
// Só para LEITURA de tela. Quem garante dentro de uma transação (`editarTurma`, antes de gravar o
// valor novo — Pitfall 6) continua chamando `garantirMensalidadesDoMes(tx, …)` direto: a escrita
// precisa estar na `tx`, não numa promessa memorizada fora dela.
import { cache } from "react";

import { db } from "@/db";

import { garantirMensalidadesDoMes } from "./gravacao";

// `mes`: "AAAA-MM" (`mesDaData`). Devolve quantas mensalidades nasceram na PRIMEIRA chamada da
// requisição; as seguintes recebem o mesmo número.
export const garantirMensalidadesDoMesNaRequisicao = cache(
  (mes: string): Promise<number> => garantirMensalidadesDoMes(db, mes),
);
