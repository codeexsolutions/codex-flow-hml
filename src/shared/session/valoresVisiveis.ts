import { create } from "zustand";

import { formatCurrency } from "@/shared/utils/currency";

/**
 * Mostrar ou esconder os valores em dinheiro.
 *
 * Cinco telas do celular tinham esse interruptor, cada uma com o seu `useState`
 * e a sua cópia do formatador. Fora a duplicação, o comportamento era errado:
 * a pessoa escondia os valores no Dashboard justamente porque alguém estava
 * olhando a tela — e ao trocar para Vendas os números apareciam de novo.
 *
 * A preferência é uma só, do aparelho, e sobrevive ao fechamento do app: quem
 * trabalha em balcão movimentado não quer reativar isso toda manhã.
 */

const CHAVE = "codex-flow-valores-ocultos";

const OCULTO = "•••••";

const lerPreferencia = (): boolean => {
  try {
    return localStorage.getItem(CHAVE) !== "1";
  } catch {
    return true;
  }
};

const gravarPreferencia = (mostrar: boolean) => {
  try {
    if (mostrar) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, "1");
  } catch {
    /* Sem armazenamento a escolha vale só nesta sessão. */
  }
};

type ValoresVisiveis = {
  mostrar: boolean;
  alternar: () => void;
};

const useValoresVisiveis = create<ValoresVisiveis>((set, get) => ({
  mostrar: lerPreferencia(),

  alternar() {
    const proximo = !get().mostrar;

    gravarPreferencia(proximo);
    set({ mostrar: proximo });
  },
}));

/**
 * O dinheiro como a tela deve mostrar: formatado, ou mascarado quando a
 * pessoa escolheu esconder.
 */
export function useDinheiroVisivel() {
  const mostrar = useValoresVisiveis((s) => s.mostrar);
  const alternar = useValoresVisiveis((s) => s.alternar);

  return {
    mostrar,
    alternar,
    dinheiro: (valor: number) => (mostrar ? formatCurrency(valor) : OCULTO),
    OCULTO,
  };
}

export default useValoresVisiveis;
