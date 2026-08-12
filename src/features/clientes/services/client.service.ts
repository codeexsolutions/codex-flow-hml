import ClientType from "@/shared/domain/cliente";
import sysgrafix from "@/shared/api/sysgrafix";

const ClientService = {
  create: (params: ClientType) => sysgrafix.post("/clientes/cadastrar", params),

  getAll: () => sysgrafix.get("/clientes"),
  getById: (id: string) => sysgrafix.get(`/clientes/id/${id}`),

  update: (id: string, params: ClientType) => sysgrafix.patch(`/clientes/alterar/${id}`, params),
  remove: (id: string) => sysgrafix.delete(`/clientes/${id}`),
};

export default ClientService;
