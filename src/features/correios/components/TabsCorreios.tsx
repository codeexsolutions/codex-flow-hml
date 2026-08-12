import { Calculator, ClipboardList, Search } from "lucide-react";

export const TabsCorreios = [
  {
    label: "Calcular Frete",
    path: "/correios",
    icon: <Calculator size={15} />,
    end: true,
  },
  {
    label: "Pré-Postagem",
    path: "/correios/postagem",
    icon: <ClipboardList size={15} />,
  },
  {
    label: "Rastrear",
    path: "/correios/rastrear",
    icon: <Search size={15} />,
  },
];
