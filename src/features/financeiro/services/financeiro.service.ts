import sysgrafix from "@/shared/api/sysgrafix";
import { NovaMovimentacaoType } from "@/shared/domain/financeiro";

const FinanceiroService = {
  getResumo: () => sysgrafix.get("/financeiro/resumo"),

  getNotas: () => sysgrafix.get("/financeiro/notas"),
  registrarPagamentoNota: (pedidoId: string, valor: number, formaPagamento: string) =>
    sysgrafix.patch(`/financeiro/notas/${pedidoId}/pagar`, { valor, formaPagamento }),

  getMovimentacoes: () => sysgrafix.get("/financeiro/movimentacoes"),
  criarMovimentacao: (movimentacao: NovaMovimentacaoType) => sysgrafix.post("/financeiro/movimentacoes", movimentacao),
  excluirMovimentacao: (id: string) => sysgrafix.delete(`/financeiro/movimentacoes/${id}`),
};

export default FinanceiroService;
