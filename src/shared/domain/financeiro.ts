export type NotaFinanceiroType = {
  pedido_id: string;
  codigo_pedido: string;
  total: number;
  status: string;
  data_pedido: string;
  valor_pago: number;
  status_pagamento: "PENDENTE" | "PAGO";
  forma_pagamento: string | null;
  data_pagamento: string | null;
  cliente_id: string;
  cliente_nome: string;
};

export type MovimentacaoType = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string | null;
  descricao: string;
  valor: number;
  data_movimentacao: string;
};

export type NovaMovimentacaoType = {
  tipo: "ENTRADA" | "SAIDA";
  categoria?: string;
  descricao: string;
  valor: number;
  dataMovimentacao: string;
};

export type ResumoFinanceiroType = {
  totalAReceber: number;
  totalRecebido: number;
  totalAtrasado: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoCaixa: number;
  recebidoPorFormaPagamento: { formaPagamento: string; valor: number }[];
};
