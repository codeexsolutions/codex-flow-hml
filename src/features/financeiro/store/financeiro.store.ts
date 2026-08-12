import { create } from "zustand";

import FinanceiroService from "@/features/financeiro/services/financeiro.service";
import type { MovimentacaoType, NotaFinanceiroType, NovaMovimentacaoType, ResumoFinanceiroType } from "@/shared/domain/financeiro";
import { unwrapList } from "@/shared/api/types";

interface FinanceiroState {
  resumo: ResumoFinanceiroType | null;
  notas: NotaFinanceiroType[];
  movimentacoes: MovimentacaoType[];
  loading: boolean;
  error: string | null;
  carregado: boolean;

  fetchFinanceiro: (force?: boolean) => Promise<void>;
  registrarPagamentoNota: (pedidoId: string, valor: number, formaPagamento: string) => Promise<void>;
  criarMovimentacao: (mov: NovaMovimentacaoType) => Promise<void>;
  excluirMovimentacao: (id: string) => Promise<void>;
}

const useFinanceiroStore = create<FinanceiroState>((set, get) => ({
  resumo: null,
  notas: [],
  movimentacoes: [],
  loading: false,
  error: null,
  carregado: false,

  async fetchFinanceiro(force = false) {
    if (get().loading) return;
    if (get().carregado && !force) return;

    set({ loading: true, error: null });
    try {
      const [resResumo, resNotas, resMovimentacoes] = await Promise.all([FinanceiroService.getResumo(), FinanceiroService.getNotas(), FinanceiroService.getMovimentacoes()]);

      set({
        resumo: unwrapList<ResumoFinanceiroType>(resResumo.data)[0] ?? null,
        notas: unwrapList<NotaFinanceiroType>(resNotas.data),
        movimentacoes: unwrapList<MovimentacaoType>(resMovimentacoes.data),
        carregado: true,
      });
    } catch {
      set({ error: "Não foi possível carregar os dados financeiros." });
    } finally {
      set({ loading: false });
    }
  },

  async registrarPagamentoNota(pedidoId, valor, formaPagamento) {
    await FinanceiroService.registrarPagamentoNota(pedidoId, valor, formaPagamento);
    await get().fetchFinanceiro(true);
  },

  async criarMovimentacao(mov) {
    await FinanceiroService.criarMovimentacao(mov);
    await get().fetchFinanceiro(true);
  },

  async excluirMovimentacao(id) {
    await FinanceiroService.excluirMovimentacao(id);
    await get().fetchFinanceiro(true);
  },
}));

export default useFinanceiroStore;
