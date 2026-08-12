import { create } from "zustand";

import EnterpriseService from "@/features/empresa/services/enterprise.service";
import useEnterpriseProps from "@/features/empresa/types/enterprise.types";

const useEnterprise = create<useEnterpriseProps>((set) => ({
  enterprise: null,

  clearEnterprise: () =>
    set({
      enterprise: null,
    }),

  fetchEnterprise: async (codigoEmpresa: string) => {
    try {
      const res = await EnterpriseService.getById(codigoEmpresa);

      set({
        enterprise: res.data.data[0],
      });
    } catch (err) {
      console.error("Erro ao buscar empresa:", err);
    }
  },

  updateEnterprise: async (id, data) => {
    try {
      await EnterpriseService.update(id, data);

      set((state) => ({
        enterprise: state.enterprise
          ? {
              ...state.enterprise,
              ...data,
            }
          : null,
      }));
    } catch (err) {
      console.error("Erro ao atualizar empresa:", err);
      throw err;
    }
  },
}));

export default useEnterprise;
