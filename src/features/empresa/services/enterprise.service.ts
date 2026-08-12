import sysgrafix from "@/shared/api/sysgrafix";
import EnterpriseType from "@/shared/domain/empresa";

const EnterpriseService = {
  getById: (id: string) => sysgrafix.get(`/empresas/cpf-cnpj/${id}`),
  update: (id: string, data: Partial<EnterpriseType>) => sysgrafix.patch(`/empresas/alterar/${id}`, data),
};

export default EnterpriseService;
