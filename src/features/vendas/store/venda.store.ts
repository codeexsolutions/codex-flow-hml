import { create } from "zustand";

import NoteService from "@/features/vendas/services/note.service";
import { type PedidoClienteType, estaAberto, estaPendente, estaCancelado, estaFechado, isPedidoValido, totalDoPedido, valorPagoDoPedido, valorPendenteDoPedido } from "@/shared/domain/pedido";

import { isSameDay, isSameMonth } from "@/shared/utils/date";
import { unwrapList } from "@/shared/api/types";

export type ResumoVendas = {
  faturamento: number;
  recebido: number;
  pendente: number;
  ticketMedio: number;
  quantidade: number;
};

interface VendaState {
  vendas: PedidoClienteType[];
  loading: boolean;
  error: string | null;
  carregado: boolean;

  fetchVendas: (force?: boolean) => Promise<void>;
  removerVenda: (pedidoId: string) => Promise<void>;

  vendasDoDia: (ref?: Date) => PedidoClienteType[];
  vendasDoMes: (ref?: Date) => PedidoClienteType[];
  vendasDoCliente: (clienteId: string) => PedidoClienteType[];
  resumo: (lista?: PedidoClienteType[]) => ResumoVendas;
}

const calcularResumo = (lista: PedidoClienteType[]): ResumoVendas => {
  const ativas = lista.filter((v) => !estaCancelado(v));
  const faturamento = ativas.reduce((acc, v) => acc + totalDoPedido(v), 0);
  const recebido = ativas.reduce((acc, v) => acc + valorPagoDoPedido(v), 0);
  const pendente = ativas.reduce((acc, v) => acc + valorPendenteDoPedido(v), 0);

  return {
    faturamento,
    recebido,
    pendente,
    ticketMedio: ativas.length ? faturamento / ativas.length : 0,
    quantidade: ativas.length,
  };
};

const useVendaStore = create<VendaState>((set, get) => ({
  vendas: [],
  loading: false,
  error: null,
  carregado: false,

  async fetchVendas(force = false) {
    if (get().loading) return;
    if (get().carregado && !force) return;

    set({ loading: true, error: null });
    try {
      const { data } = await NoteService.getAll();
      set({ vendas: unwrapList<PedidoClienteType>(data).filter(isPedidoValido), carregado: true });
    } catch {
      // Diferente do commit remoto, uma resposta vazia zera a lista em vez de
      // manter dados antigos na tela.
      set({ vendas: [], error: "Não foi possível carregar as vendas." });
    } finally {
      set({ loading: false });
    }
  },

  async removerVenda(pedidoId) {
    // Cancela em vez de apagar: a venda sai da lista ativa e continua no
    // histórico. (O `delete` de antes batia numa rota inexistente e falhava
    // em silêncio — a venda simplesmente não saía.)
    await NoteService.cancelar(pedidoId);
    await get().fetchVendas(true);
  },

  vendasDoDia(ref = new Date()) {
    return get().vendas.filter((v) => isSameDay(v.pedido.dataPedido, ref));
  },

  vendasDoMes(ref = new Date()) {
    return get().vendas.filter((v) => isSameMonth(v.pedido.dataPedido, ref));
  },

  vendasDoCliente(clienteId) {
    return get().vendas.filter((v) => String(v.clienteId) === String(clienteId));
  },

  resumo(lista) {
    return calcularResumo(lista ?? get().vendas);
  },
}));

export { estaAberto, estaPendente, estaFechado, estaCancelado, totalDoPedido };
export default useVendaStore;
