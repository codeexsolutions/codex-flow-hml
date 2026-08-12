import { ShoppingCart } from "lucide-react";
import { Outlet } from "react-router-dom";

import { PageScreen } from "@/shared/ui/PageShell";
import { tabsVendas, ehGestor } from "@/features/vendas/components/TabsVendas";
import useAuth from "@/features/auth/store/auth.store";

const SalesPage = () => {
  const { user } = useAuth();
  const gestor = ehGestor(user);

  return (
    <PageScreen
      title={gestor ? "Vendas" : "Minhas vendas"}
      /* O texto acompanha o que a pessoa tem à frente: prometer "financeiro"
         para quem não tem a aba é pior do que não dizer nada. */
      subtitle={gestor ? "Vendas, notas e o financeiro da loja" : "As vendas que você fez"}
      icon={<ShoppingCart className="h-5 w-5" />}
      tabs={tabsVendas(user)}
    >
      <Outlet />
    </PageScreen>
  );
};

export default SalesPage;
