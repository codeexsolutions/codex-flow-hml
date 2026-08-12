/**
 * Modelo de domínio de Pedido/Venda.
 *
 * Nomenclatura: `PedidoClienteType` é a *venda* (o cliente junto com o pedido),
 * enquanto `PedidoType` é apenas o pedido. Os nomes antigos (`clientePedido` e
 * `pedidoCliente`) eram quase anagramas um do outro e significavam coisas
 * opostas — origem recorrente de confusão.
 */

export const PEDIDO_STATUS = {
  ABERTO: "ABERTO",
  PENDENTE: "PENDENTE",
  FECHADO: "FECHADO",
  PAGO: "PAGO",
  CANCELADO: "CANCELADO",
} as const;

export type PedidoStatus = (typeof PEDIDO_STATUS)[keyof typeof PEDIDO_STATUS];

export type ProdutoPedidoType = {
  produtoId: string;
  nomeProduto: string;
  valorProduto: number;
};

export type ItemPedidoType = {
  itemPedidoId: string;
  quantidadeItem: number;
  valorVendaItem: number;
  subtotalItens?: number;
  produto: ProdutoPedidoType;
};

export type PedidoType = {
  pedidoId: string;
  totalPedido: number;
  dataPedido: Date;
  pedidoStatus: string;
  /** Quanto já foi pago da nota (pagamento parcial acumulado). Vem do backend. */
  valorPago?: number;
  /** Forma do último pagamento registrado. Vem do backend. */
  formaPagamento?: string | null;
  itensPedido: ItemPedidoType[];
};

/** Uma venda: o cliente e o pedido dele. */
export type PedidoClienteType = {
  clienteId: string;
  nomeCliente: string;
  statusCliente: string;
  pedido: PedidoType;
  codigoEmpresa: string;
  /** Quem fez a venda. Nulo em pedido anterior ao registro de vendedor. */
  vendedorId?: string | null;
  nomeVendedor?: string | null;
};

/** Item enviado ao backend ao criar ou alterar um pedido. */
export type ItemPedidoDto = {
  produtoId: string;
  quantidade: number;
  valorVenda: number;
};

/** POST /pedidos/novo-pedido — o controller lê `itensPedido`. */
export type NovoPedidoDto = {
  clienteId: string | undefined;
  itensPedido: ItemPedidoDto[];
};

/**
 * PATCH /pedidos/alterar/:id — atenção: esse endpoint lê `produtosPedido`,
 * não `itensPedido` (nome diferente do de criar o pedido). Pagamento NÃO
 * passa por aqui — isso é feito à parte, em PATCH /financeiro/notas/:id/pagar.
 */
export type PedidoUpdateDto = {
  clienteId: string | undefined;
  produtosPedido: ItemPedidoDto[];
};

/* ─────────────────────────── Regras de negócio ─────────────────────────── */

export const estaAberto = (v: PedidoClienteType): boolean => v.pedido.pedidoStatus === PEDIDO_STATUS.ABERTO;

export const estaPendente = (v: PedidoClienteType): boolean => v.pedido.pedidoStatus === PEDIDO_STATUS.PENDENTE;

export const estaFechado = (v: PedidoClienteType): boolean => v.pedido.pedidoStatus === PEDIDO_STATUS.FECHADO;

export const estaPago = (v: PedidoClienteType): boolean => v.pedido.pedidoStatus === PEDIDO_STATUS.PAGO;

export const estaCancelado = (v: PedidoClienteType): boolean => v.pedido.pedidoStatus === PEDIDO_STATUS.CANCELADO;

/**
 * Total da venda. Usa `totalPedido` quando o backend o envia; se vier 0/ausente,
 * recalcula somando os itens.
 */
export const totalDoPedido = (v: PedidoClienteType): number => Number(v.pedido.totalPedido) || (v.pedido.itensPedido ?? []).reduce((acc: number, item: ItemPedidoType) => acc + Number(item.valorVendaItem || 0) * Number(item.quantidadeItem || 0), 0);

/** Quanto já foi pago nesta venda (pagamentos parciais acumulados). */
export const valorPagoDoPedido = (v: PedidoClienteType): number =>
  Number(v.pedido.valorPago ?? 0);

/**
 * Valor ainda pendente.
 * Pedidos cancelados ou totalmente pagos/fechados ficam zerados.
 */
export const valorPendenteDoPedido = (v: PedidoClienteType): number => {
  if (estaCancelado(v) || estaFechado(v) || estaPago(v)) return 0;
  return Math.max(totalDoPedido(v) - valorPagoDoPedido(v), 0);
};

/** Type guard para respostas da API que podem trazer registros incompletos. */
export const isPedidoValido = (v: unknown): v is PedidoClienteType => !!v && !!(v as PedidoClienteType).pedido;
