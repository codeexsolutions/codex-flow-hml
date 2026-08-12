import { create } from "zustand";

import AssinaturaService from "@/features/assinatura/services/assinatura.service";
import type { Plano } from "@/features/assinatura/types/assinatura.types";

/**
 * O catálogo à venda, carregado uma vez para o app inteiro.
 *
 * Antes, quatro telas buscavam a mesma lista por conta própria — landing,
 * comparação de planos, cadastro e checkout —, cada uma com o seu spinner e o
 * seu `useEffect`. O resultado aparecia na tela do cadastro depois da primeira
 * pintura: a etapa do plano abria vazia e o cartão nascia meio segundo depois,
 * empurrando o layout.
 *
 * Aqui a lista é buscada no boot e no login, e fica pronta antes de a pessoa
 * chegar. A chamada é pública (não exige token), então dá para adiantá-la
 * mesmo em quem ainda não entrou — que é justamente quem vai ao cadastro.
 *
 * Quem decide o que está à venda é o backend (`shared/utilities/catalogo`).
 * O front mostra o que vier: repetir a regra aqui criaria duas verdades, e a
 * errada seria sempre a desta camada.
 */

type EstadoCatalogo = {
  planos: Plano[];
  carregando: boolean;
  /** `true` depois da primeira resposta — inclusive quando ela falhou. */
  carregado: boolean;
  erro: string;
  /**
   * Busca o catálogo. Chamadas simultâneas compartilham a mesma requisição:
   * boot e login disparam quase juntos, e duas idas à rede pela mesma lista
   * seriam desperdício visível no primeiro carregamento.
   */
  carregar: (recarregar?: boolean) => Promise<void>;
};

/** A requisição em voo, para o boot e o login não pedirem a lista duas vezes. */
let emVoo: Promise<void> | null = null;

const useCatalogo = create<EstadoCatalogo>((set, get) => ({
  planos: [],
  carregando: false,
  carregado: false,
  erro: "",

  carregar: (recarregar = false) => {
    const { carregado, planos } = get();

    // Catálogo já em mãos: quem pediu de novo (uma navegação, um remount)
    // recebe o que existe, sem piscar a tela.
    if (!recarregar && carregado && planos.length > 0) return Promise.resolve();

    if (emVoo) return emVoo;

    set({ carregando: true, erro: "" });

    emVoo = AssinaturaService.listarPlanos()
      .then((lista) => {
        set({ planos: lista, carregado: true, erro: "" });
      })
      .catch(() => {
        // Sem catálogo a tela mostra o aviso e o botão de tentar de novo; o
        // `carregado` fica ligado para a interface saber que houve resposta.
        set({ planos: [], carregado: true, erro: "Não foi possível carregar os planos. Tente novamente em instantes." });
      })
      .finally(() => {
        set({ carregando: false });
        emVoo = null;
      });

    return emVoo;
  },
}));

export default useCatalogo;

/**
 * O plano da vez.
 *
 * Enquanto o catálogo tem um item só, é ele que o cadastro já abre marcado —
 * escolher entre uma opção não é escolha, é um clique a mais. Se voltarem os
 * degraus, este atalho passa a valer como "o destaque", e as telas que
 * comparam continuam lendo `planos`.
 */
export const usePlanoPadrao = (): Plano | null =>
  useCatalogo((s) => s.planos.find((p) => p.destaque) ?? s.planos[0] ?? null);
