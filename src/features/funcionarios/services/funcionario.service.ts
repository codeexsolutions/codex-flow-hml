import sysgrafix from "@/shared/api/sysgrafix";

export type PermissaoFuncionario = "ADMIN" | "USUARIO";
export type StatusFuncionario = "ATIVO" | "INATIVO";

export type Funcionario = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  permissao: PermissaoFuncionario;
  status: StatusFuncionario;
  /** Usuário master: não pode ser rebaixado nem desativado. */
  root: boolean;
};

export type Equipe = {
  funcionarios: Funcionario[];
  planoNome: string | null;
  /** `null` = ilimitado. */
  limiteUsuarios: number | null;
  usados: number;
  podeAdicionar: boolean;
};

export type NovoFuncionario = {
  nome: string;
  email: string;
  cargo?: string;
  senha: string;
  permissao?: PermissaoFuncionario;
};

type RetornoPadrao<T> = { statusCode: number; message: string; data: T[] };

/** A API devolve a mensagem real do erro; ela é boa o bastante para a tela. */
const erro = (e: unknown, padrao: string): Error => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return new Error(err?.response?.data?.message ?? err?.message ?? padrao);
};

const FuncionarioService = {
  listar: async (): Promise<Equipe> => {
    try {
      const res = await sysgrafix.get<RetornoPadrao<Equipe>>("/funcionarios");
      const equipe = res.data?.data?.[0];

      if (!equipe) throw new Error(res.data?.message || "Não foi possível carregar a equipe.");

      return equipe;
    } catch (e) {
      throw erro(e, "Não foi possível carregar a equipe.");
    }
  },

  cadastrar: async (dados: NovoFuncionario): Promise<Funcionario> => {
    try {
      const res = await sysgrafix.post<RetornoPadrao<Funcionario>>("/funcionarios", dados);
      return res.data.data[0];
    } catch (e) {
      throw erro(e, "Não foi possível cadastrar o funcionário.");
    }
  },

  alterar: async (id: string, dados: { nome?: string; cargo?: string; permissao?: PermissaoFuncionario }): Promise<Funcionario> => {
    try {
      const res = await sysgrafix.patch<RetornoPadrao<Funcionario>>(`/funcionarios/${id}`, dados);
      return res.data.data[0];
    } catch (e) {
      throw erro(e, "Não foi possível atualizar o funcionário.");
    }
  },

  alterarStatus: async (id: string, ativo: boolean): Promise<Funcionario> => {
    try {
      const res = await sysgrafix.patch<RetornoPadrao<Funcionario>>(`/funcionarios/${id}/status`, { ativo });
      return res.data.data[0];
    } catch (e) {
      throw erro(e, "Não foi possível alterar o status.");
    }
  },

  redefinirSenha: async (id: string, senha: string): Promise<void> => {
    try {
      await sysgrafix.post(`/funcionarios/${id}/senha`, { senha });
    } catch (e) {
      throw erro(e, "Não foi possível redefinir a senha.");
    }
  },
};

export default FuncionarioService;
