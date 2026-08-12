import sysgrafix from "@/shared/api/sysgrafix";

export type TipoNotificacao =
  | "PRODUTO_CRIADO"
  | "PRODUTO_ALTERADO"
  | "PRODUTO_EXCLUIDO"
  | "VENDA_REGISTRADA"
  | "VENDA_ALTERADA"
  | "CLIENTE_CADASTRADO"
  | "PAGAMENTO_RECEBIDO"
  | "CAIXA_LANCAMENTO"
  | "CONTA_CRIADA"
  | "CAIXA_EXCLUSAO"
  | "FUNCIONARIO_CADASTRADO"
  | "FUNCIONARIO_ALTERADO";

export type Notificacao = {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  descricao: string | null;
  usuarioNome: string | null;
  rota: string | null;
  entidadeId: string | null;
  criadoEm: string;
  lida: boolean;
};

export type Mural = {
  notificacoes: Notificacao[];
  naoLidas: number;
};

type RetornoPadrao<T> = { statusCode: number; message: string; data: T[] };

const NotificacaoService = {
  listar: async (): Promise<Mural> => {
    const res = await sysgrafix.get<RetornoPadrao<Mural>>("/notificacoes");
    return res.data?.data?.[0] ?? { notificacoes: [], naoLidas: 0 };
  },

  marcarLida: (id: string) => sysgrafix.post(`/notificacoes/${id}/lida`, {}),

  marcarTodasLidas: () => sysgrafix.post("/notificacoes/lidas", {}),
};

export default NotificacaoService;
