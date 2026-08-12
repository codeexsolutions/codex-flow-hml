import EnterpriseType from "@/shared/domain/empresa";

interface UseEnterpriseProps {
  enterprise: EnterpriseType | null;

  fetchEnterprise: (codigoEmpresa: string) => Promise<void>;
  updateEnterprise: (codigoEmpresa: string, data: Partial<EnterpriseType>) => Promise<void>;

  clearEnterprise: () => void;
}

export default UseEnterpriseProps;
