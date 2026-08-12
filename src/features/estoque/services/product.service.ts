import sysgrafix from "@/shared/api/sysgrafix";
import type { NovoProdutoDto, ProdutoUpdateDto } from "@/shared/domain/produto";

const ProductService = {
  getAll: async (params?: { name?: string; category?: string }) => await sysgrafix.get("/produtos", { params }),

  create: async (data: NovoProdutoDto) => await sysgrafix.post("/produtos/cadastrar", data),

  /**
   * ATENÇÃO: diferente de clientes e pedidos, este endpoint não recebe o `id`
   * na URL — ele vai no corpo. Comportamento preservado do código original por
   * não ser possível validar o contrato do backend daqui. Se a API na verdade
   * espera `/produtos/alterar/{id}`, esta é a linha a ajustar.
   */
  update: async (data: ProdutoUpdateDto) => await sysgrafix.patch(`/produtos/alterar/`, data),

  remove: async (id: string) => await sysgrafix.delete(`/produtos/${id}`),
};

export default ProductService;
