import { Outlet } from "react-router-dom";
import { Truck } from "lucide-react";

import { PageScreen } from "@/shared/ui/PageShell";
import { TabsCorreios } from "@/features/correios/components/TabsCorreios";

const CorreiosPage = () => {
  return (
    <PageScreen icon={<Truck className="h-5 w-5" />} title="Correios" subtitle="Preços, prazos, pré-postagem e rastreio" tabs={TabsCorreios}>
      <Outlet />
    </PageScreen>
  );
};

export default CorreiosPage;
