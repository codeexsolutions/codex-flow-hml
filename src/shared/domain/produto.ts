/** PRODUTO controla estoque; SERVICO não tem o que estocar. */
export type TipoItem = "PRODUTO" | "SERVICO";

/** Conjunto de tamanhos. Vazio = o item não se vende por tamanho. */
export type GradeTamanho = "" | "ROUPA" | "CALCADO" | "VOLUME";

type ProductType = {
  id: string;
  nome: string;
  /**
   * No banco a coluna ainda se chama `valor_compra`, mas na interface é
   * "preço de custo": quem presta serviço não compra nada e mesmo assim tem
   * custo, e mesmo na revenda o custo real inclui frete e imposto, não só o
   * que saiu na nota do fornecedor.
   */
  valorCompra: number;
  valorVenda: number;
  imagem: string;
  descricao: string;
  quantidade: number;
  codigoEmpresa: string;
  tipo?: TipoItem;
  grade?: GradeTamanho;
  /** Valor dentro da grade: P, M, G, 42, 500ml... */
  tamanho?: string;
};

/**
 * Payload de criação: `id` e `codigoEmpresa` são gerados pelo backend
 * (o último derivado do token), então o formulário não os envia.
 * `descricao` e `imagem` são opcionais no formulário.
 */
export type NovoProdutoDto = Omit<ProductType, "id" | "codigoEmpresa" | "descricao" | "imagem"> & {
  descricao?: string;
  imagem?: string;
};

/** Payload de alteração: identifica pelo `id` e aceita campos parciais. */
export type ProdutoUpdateDto = Partial<Omit<ProductType, "id">> & {
  id: string;
};

export default ProductType;
