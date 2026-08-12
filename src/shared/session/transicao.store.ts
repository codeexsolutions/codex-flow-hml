import { create } from "zustand";

import { tocarEntrada, tocarSaida } from "@/shared/session/somSessao";

export type ModoTransicao = "entrada" | "saida";

type Estado = {
  modo: ModoTransicao | null;
  nome: string;
  /** Resolve quando a animação termina — é o que segura o fluxo. */
  resolver: (() => void) | null;

  /** Toca a transição e só resolve quando ela acabar. */
  tocar: (modo: ModoTransicao, nome: string) => Promise<void>;
  /** A animação terminou — libera quem estava esperando. NÃO tira o overlay. */
  encerrar: () => void;
  /** Tira o overlay, já com a tela nova montada atrás. */
  fechar: () => void;
};

/**
 * Estado da transição de sessão, fora das telas.
 *
 * Precisa viver acima do roteador: no logout, a tela que disparou a animação é
 * justamente a que o roteador desmonta ao perder a sessão. Se o overlay
 * morasse nela, o efeito sumiria no primeiro frame.
 */
const useTransicao = create<Estado>((set, get) => ({
  modo: null,
  nome: "",
  resolver: null,

  tocar: (modo, nome) =>
    new Promise<void>((resolver) => {
      /* Aqui e não na tela: `tocar` é o único ponto por onde as duas transições
         passam, então o som acompanha a animação sem depender de quem chamou. */
      if (modo === "entrada") tocarEntrada();
      else tocarSaida();

      set({ modo, nome, resolver });
    }),

  /*
   * Separar as duas coisas é o que evita o piscar: se o overlay saísse junto
   * com o fim da animação, a tela antiga reapareceria por um frame antes de
   * ser desmontada. Aqui ele fica no ar até a tela nova estar montada atrás.
   */
  encerrar: () => {
    get().resolver?.();
    set({ resolver: null });
  },

  fechar: () => set({ modo: null }),
}));

export default useTransicao;
