import { Building2, Palette, Receipt, User } from "lucide-react";

import type UserType from "@/shared/domain/user";
import { ehGestor } from "@/features/vendas/components/TabsVendas";

const PERFIL = {
  label: "Perfil",
  path: "/configuracoes/perfil",
  icon: <User size={15} />,
};

const EMPRESA = {
  label: "Empresa",
  path: "/configuracoes/empresa",
  icon: <Building2 size={15} />,
};

const FATURAS = {
  label: "Faturas",
  path: "/configuracoes/faturas",
  icon: <Receipt size={15} />,
};

const APARENCIA = {
  label: "Aparência",
  path: "/configuracoes/aparencia",
  icon: <Palette size={15} />,
};

export const TabsConfig = [PERFIL, EMPRESA, FATURAS, APARENCIA];

/**
 * Perfil e Aparência são de quem está logado — todo mundo tem. Empresa e
 * Faturas mexem no cadastro e na assinatura da loja: são do dono.
 *
 * Esconder é conveniência; a rota também barra, e a API é quem decide de
 * verdade. Aqui é só para o funcionário não bater numa porta fechada.
 */
export const tabsConfig = (user: UserType | null) => (ehGestor(user) ? TabsConfig : [PERFIL, APARENCIA]);
