export default interface UserType {
  id: string;
  email: string;
  cargo: string;
  permissao: string;
  /** Usuário master: gerencia funcionários e vê todas as vendas. */
  root?: boolean;
  codigoEmpresa: string;
  ativo: boolean;
  nome?: string;
  phone?: string;
  image?: string;
}
