"use client";

import { useEffect, useRef, useState } from "react";

// A espera da busca enquanto se digita (05-UI-SPEC.md §"Aba Pessoas": 300 ms).
const ESPERA_DA_BUSCA_MS = 300;

// O campo de busca das duas telas do cadastro de pessoas (Cadastros → Clientes e Agenda → Pessoas):
// a URL manda (`?busca=`) e a busca é do servidor. O campo espera 300 ms depois do último toque e só
// então vai para a URL nova (`irPara`). Quando a URL muda por outro caminho (o voltar do navegador,
// "Usar … que já existe"), o campo acompanha; quando a mudança é o eco do que se digitou, ele não
// pisa no que a pessoa continuou digitando.
export function useBuscaNaUrl(busca: string, irPara: (termo: string) => void) {
  const [texto, setTexto] = useState(busca);
  const ultimaEnviada = useRef(busca);
  const irParaAtual = useRef(irPara);

  useEffect(() => {
    irParaAtual.current = irPara;
  });

  useEffect(() => {
    if (busca !== ultimaEnviada.current) {
      ultimaEnviada.current = busca;
      setTexto(busca);
    }
  }, [busca]);

  useEffect(() => {
    const termo = texto.trim();
    if (termo === ultimaEnviada.current) {
      return;
    }
    const espera = window.setTimeout(() => {
      ultimaEnviada.current = termo;
      irParaAtual.current(termo);
    }, ESPERA_DA_BUSCA_MS);
    return () => window.clearTimeout(espera);
  }, [texto]);

  // Buscar já, sem esperar (ex.: "Usar … que já existe" filtra a lista pelo nome).
  function buscarJa(termo: string) {
    ultimaEnviada.current = termo;
    setTexto(termo);
    irParaAtual.current(termo);
  }

  return { texto, setTexto, buscarJa };
}
