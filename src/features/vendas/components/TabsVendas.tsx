import { ShoppingCart, TrendingUp, Wallet } from "lucide-react";

import type UserType from "@/shared/domain/user";

export const TabsVendas = [
  {
    label: "Visão Geral",
    path: "/vendas",
    icon: <TrendingUp size={15} />,
  },
  {
    label: "Vendas",
    path: "/vendas/lista",
    icon: <ShoppingCart size={15} />,
  },
];

/**
 * Financeiro virou aba daqui.
 *
 * Vender e receber são o mesmo assunto visto de dois lados: a nota que sai em
 * Vendas é a mesma que aparece em "a receber". Eram duas telas separadas no
 * menu, com os mesmos números somados de jeitos diferentes — quem conferia o
 * dia ia e voltava. Como aba, a troca é um clique e o contexto não se perde.
 */
const FINANCEIRO = {
  label: "Financeiro",
  path: "/vendas/financeiro",
  icon: <Wallet size={15} />,
};

/* Orçamentos saiu daqui: tem item próprio na barra lateral. Aparecer nos dois
   lugares dava dois caminhos para a mesma tela e dois itens acesos ao mesmo
   tempo — a rota continua sendo /vendas/orcamentos. */

/** Gestor = usuário master ou quem ele promoveu a administrador. */
export const ehGestor = (user: UserType | null): boolean => Boolean(user?.root) || user?.permissao === "ADMIN";

/** Para o vendedor, a lista é "as minhas" — o rótulo diz isso. */
const MINHAS_VENDAS = { ...TabsVendas[1], label: "Minhas vendas" };

/**
 * O vendedor fica só com as próprias vendas: sem visão geral da loja e sem
 * financeiro — caixa e contas a receber são do dono. Com uma aba só, a barra
 * de abas some, o que é correto: aba única é ruído.
 *
 * Esconder é conveniência; a rota também barra e a API é quem decide de verdade.
 */
export const tabsVendas = (user: UserType | null) =>
  ehGestor(user) ? [...TabsVendas, FINANCEIRO] : [MINHAS_VENDAS];
