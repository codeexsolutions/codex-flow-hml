import { create } from "zustand";

import ProductService from "@/features/estoque/services/product.service";
import ProductType, { type NovoProdutoDto, type ProdutoUpdateDto } from "@/shared/domain/produto";
import { unwrapList } from "@/shared/api/types";

export const LOW_STOCK = 5;

export type StockLevel = "disponivel" | "baixo" | "esgotado";

export const stockLevel = (qtd?: number): StockLevel => {
  const q = qtd ?? 0;
  if (q <= 0) return "esgotado";
  if (q <= LOW_STOCK) return "baixo";
  return "disponivel";
};

interface ProdutoState {
  produtos: ProductType[];
  loading: boolean;
  error: string | null;
  carregado: boolean;

  fetchProdutos: (force?: boolean) => Promise<void>;
  criarProduto: (data: NovoProdutoDto) => Promise<void>;
  atualizarProduto: (data: ProdutoUpdateDto) => Promise<void>;
  removerProduto: (id: string) => Promise<void>;
}

const useProdutoStore = create<ProdutoState>((set, get) => ({
  produtos: [],
  loading: false,
  error: null,
  carregado: false,

  async fetchProdutos(force = false) {
    if (get().loading) return;
    if (get().carregado && !force) return;

    set({ loading: true, error: null });
    try {
      const res = await ProductService.getAll();
      const lista = Array.isArray(res.data) ? (res.data as ProductType[]) : unwrapList<ProductType>(res.data);
      set({ produtos: lista, carregado: true });
    } catch {
      set({ error: "Não foi possível carregar os produtos." });
    } finally {
      set({ loading: false });
    }
  },

  async criarProduto(data) {
    await ProductService.create(data);
    await get().fetchProdutos(true);
  },

  async atualizarProduto(data) {
    await ProductService.update(data);
    await get().fetchProdutos(true);
  },

  async removerProduto(id) {
    await ProductService.remove(id);
    await get().fetchProdutos(true);
  },
}));

export default useProdutoStore;
