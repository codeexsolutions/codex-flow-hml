import sysgrafix from "@/shared/api/sysgrafix";

/** Usuário da sessão, montado pela API — o front não decodifica o JWT. */
export type UsuarioSessao = {
  id: string;
  nome?: string | null;
  email: string;
  cargo: string;
  permissao?: string | null;
  root?: boolean;
  codigoEmpresa: string;
  ativo: boolean;
};

/**
 * O que o login devolve: os tokens (guardados pelo cliente) junto do usuário.
 *
 * O access token é o que vai no header `Authorization` de toda requisição; o
 * refresh só é usado na rota de renovação.
 */
export type SessaoDoLogin = UsuarioSessao & {
  accessToken: string;
  refreshToken?: string;
};

/** A API responde sempre { statusCode, message, data: [...] }. */
type RetornoPadrao<T> = { statusCode: number; message: string; data: T[] };

const AuthService = {
  /** Login: devolve o par de tokens e o usuário. Quem grava é a store. */
  login: async (data: object | undefined): Promise<SessaoDoLogin> => {
    const res = await sysgrafix.post<RetornoPadrao<SessaoDoLogin>>("/login/token", data || {});

    const sessao = res.data?.data?.[0];

    if (!sessao?.accessToken) throw new Error(res.data?.message || "Resposta inválida da API.");

    return sessao;
  },

  /**
   * Quem sou eu — bootstrap da sessão.
   *
   * O token guardado poderia ser lido aqui no navegador, mas quem diz se ele
   * ainda vale (e se a empresa continua ativa) é a API: um JWT decodificado no
   * cliente é só um texto que ninguém conferiu.
   */
  me: async (): Promise<UsuarioSessao> => {
    const res = await sysgrafix.get<RetornoPadrao<UsuarioSessao>>("/usuarios/me");
    const usuario = res.data?.data?.[0];

    if (!usuario) throw new Error(res.data?.message || "Sessão inválida.");

    return usuario;
  },

  /**
   * Fim da sessão.
   *
   * Quem de fato encerra é o cliente, apagando o que guardou — a chamada
   * existe para a API registrar a saída e continuar sendo o ponto único de
   * "saí". Falhar aqui não pode travar o logout.
   */
  logout: async (): Promise<void> => {
    await sysgrafix.post("/auth/logout");
  },
};

export default AuthService;
