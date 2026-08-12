import { create } from "zustand";

import FuncionarioService, { type Equipe } from "@/features/funcionarios/services/funcionario.service";

type Estado = {
  equipe: Equipe | null;
  carregando: boolean;
  buscada: boolean;

  buscar: (forcar?: boolean) => Promise<void>;
  definir: (equipe: Equipe | null) => void;
};

/**
 * Estado da equipe, compartilhado.
 *
 * A sidebar precisa saber se o plano permite mais de um usuário para decidir se
 * mostra "Funcionários", e a tela de Funcionários precisa da lista inteira. Sem
 * um lugar comum, as duas fariam a mesma chamada — e a sidebar faria em toda
 * navegação.
 *
 * `buscada` evita repetir a consulta quando a resposta legítima é uma equipe
 * vazia: sem essa marca, `equipe === null` seria indistinguível de "ainda não
 * perguntei" e a sidebar ficaria pedindo de novo a cada render.
 */
const useEquipeStore = create<Estado>((set, get) => ({
  equipe: null,
  carregando: false,
  buscada: false,

  async buscar(forcar = false) {
    if (get().carregando) return;
    if (get().buscada && !forcar) return;

    set({ carregando: true });

    try {
      set({ equipe: await FuncionarioService.listar(), buscada: true });
    } catch {
      /* A API recusa para quem não é gestor. Não é erro de tela — é a regra.
         Marcamos como buscada para não insistir a cada navegação. */
      set({ equipe: null, buscada: true });
    } finally {
      set({ carregando: false });
    }
  },

  definir: (equipe) => set({ equipe, buscada: true }),
}));

/**
 * O plano comporta equipe?
 *
 * A regra sai do dado, não de uma lista de códigos de plano: quem só pode ter
 * um usuário não tem funcionários para gerenciar. Assim, plano novo entra sem
 * precisar mexer aqui — e "Ilimitado" (`null`) passa naturalmente.
 */
export const planoTemEquipe = (equipe: Equipe | null): boolean => equipe !== null && equipe.limiteUsuarios !== 1;

export default useEquipeStore;
