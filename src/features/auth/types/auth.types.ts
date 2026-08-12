import UserType from "@/shared/domain/user";

interface AuthFormInput {
  email: string;
  senha: string;
  cpfCnpjEmpresa: string;
}

export default interface useAuthProps {
  user: UserType | null;
  isLogged: boolean;
  /**
   * `aoAutenticar` roda DEPOIS de o token chegar e ANTES de a sessão valer.
   * É a janela onde a tela de login toca a animação: assim que `isLogged`
   * vira true, o roteador troca de rota e desmontaria qualquer efeito.
   */
  login: (data: AuthFormInput, aoAutenticar?: (nome: string) => Promise<void> | void) => Promise<void>;
  initialize: () => void;
  logout: () => void;
}
