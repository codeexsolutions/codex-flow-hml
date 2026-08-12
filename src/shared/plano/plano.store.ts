import { create } from "zustand";

import AssinaturaService from "@/features/assinatura/services/assinatura.service";
import type { MeuPlano } from "@/features/assinatura/types/assinatura.types";

/**
 * O plano vigente, disponível para a interface inteira.
 *
 * Duas perguntas são respondidas daqui:
 *   - "mostro este menu?"        → `recurso("correios")`
 *   - "quanto falta para bater?" → `meu.uso`
 *
 * A resposta do front NÃO é controle de acesso: quem digita a rota na mão
 * passa por qualquer `if` desta store. O gate de verdade é o `planoMiddleware`
 * no backend, que responde 402. Aqui a função é outra — não mostrar porta que
 * não abre, porque menu que responde "seu plano não inclui" é pior que menu
 * ausente.
 */

type EstadoPlano = {
  meu: MeuPlano | null;
  carregando: boolean;
  carregar: () => Promise<void>;
  limpar: () => void;
  /** `true` se o plano libera o módulo. */
  recurso: (nome: string) => boolean;
};

const usePlano = create<EstadoPlano>((set, get) => ({
  meu: null,
  carregando: false,

  carregar: async () => {
    if (get().carregando) return;

    set({ carregando: true });

    try {
      set({ meu: await AssinaturaService.meuPlano() });
    } catch {
      // Falhar aqui não pode escurecer o sistema. Sem resposta, `recurso()`
      // devolve `true` e a interface fica inteira — o backend continua
      // barrando o que for pago, e o cliente vê uma mensagem clara em vez de
      // um menu que sumiu sem explicação.
      set({ meu: null });
    } finally {
      set({ carregando: false });
    }
  },

  limpar: () => set({ meu: null, carregando: false }),

  recurso: (nome: string) => {
    const meu = get().meu;

    // Enquanto o plano não chegou, nada é escondido: esconder primeiro e
    // mostrar depois faz o menu piscar a cada navegação.
    if (!meu) return true;

    return meu.recursos?.[nome] === true;
  },
}));

export default usePlano;

/** Atalho para quem só quer saber de uma flag. */
export const useRecurso = (nome: string): boolean => usePlano((s) => {
  if (!s.meu) return true;
  return s.meu.recursos?.[nome] === true;
});
