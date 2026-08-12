import { Settings } from "lucide-react";
import { Outlet } from "react-router-dom";

import { PageScreen } from "@/shared/ui/PageShell";
import { tabsConfig } from "@/features/config/components/TabsConfig";
import { ehGestor } from "@/features/vendas/components/TabsVendas";
import useAuth from "@/features/auth/store/auth.store";

const ConfiguracoesPage = () => {
  const { user } = useAuth();
  const gestor = ehGestor(user);

  return (
    <PageScreen
      title="Configurações"
      /* O subtítulo lista o que a pessoa realmente tem à frente. */
      subtitle={gestor ? "Perfil, empresa, faturas e aparência" : "Perfil e aparência"}
      icon={<Settings className="h-5 w-5" />}
      tabs={tabsConfig(user)}
    >
      <Outlet />
    </PageScreen>
  );
};

export default ConfiguracoesPage;
