import { create } from "zustand";

import ClientService from "@/features/clientes/services/client.service";
import ClientType from "@/shared/domain/cliente";
import { unwrapList } from "@/shared/api/types";

interface ClienteState {
  clientes: ClientType[];
  loading: boolean;
  error: string | null;
  /** Evita refetch redundante quando várias telas montam juntas. */
  carregado: boolean;

  fetchClientes: (force?: boolean) => Promise<void>;
  criarCliente: (data: ClientType) => Promise<void>;
  atualizarCliente: (id: string, data: ClientType) => Promise<void>;
  removerCliente: (id: string) => Promise<void>;
  getClienteById: (id: string) => ClientType | undefined;
}

const useClienteStore = create<ClienteState>((set, get) => ({
  clientes: [],
  loading: false,
  error: null,
  carregado: false,

  async fetchClientes(force = false) {
    if (get().loading) return;
    if (get().carregado && !force) return;

    set({ loading: true, error: null });
    try {
      const res = await ClientService.getAll();
      const lista = Array.isArray(res.data) ? (res.data as ClientType[]) : unwrapList<ClientType>(res.data);
      set({ clientes: lista, carregado: true });
    } catch {
      set({ error: "Não foi possível carregar os clientes." });
    } finally {
      set({ loading: false });
    }
  },

  async criarCliente(data) {
    await ClientService.create(data);
    await get().fetchClientes(true);
  },

  async atualizarCliente(id, data) {
    await ClientService.update(id, data);
    await get().fetchClientes(true);
  },

  async removerCliente(id) {
    await ClientService.remove(id);
    await get().fetchClientes(true);
  },

  getClienteById(id) {
    return get().clientes.find((c) => String(c.id) === String(id));
  },
}));

export default useClienteStore;
