import sysgrafix from "@/shared/api/sysgrafix";

export type Etapa = {
  id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  conclui: boolean;
};

export type ItemProducao = {
  id: string;
  codigo: number;
  titulo: string;
  descricao: string | null;
  cliente_nome: string | null;
  etapa_fk: string | null;
  etapa_nome: string | null;
  etapa_conclui: boolean | null;
  posicao: number;
  responsavel_fk: string | null;
  responsavel_nome: string | null;
  periodo: "DIARIO" | "SEMANAL" | "MENSAL";
  prazo: string | null;
  prioridade: "BAIXA" | "NORMAL" | "ALTA";
  quantidade: number;
  concluido_em: string | null;
  criado_em: string;
  /** Quando entrou na coluna atual — é o que responde "parado desde quando". */
  entrou_na_etapa: string | null;
};

export type Movimento = {
  etapa_de_nome: string | null;
  etapa_para_nome: string | null;
  usuario_nome: string | null;
  criado_em: string;
};

const dados = <T>(r: { data?: { data?: T[] } }): T[] => r.data?.data ?? [];

const ProducaoService = {
  async etapas() {
    return dados<Etapa>(await sysgrafix.get("/producao/etapas"));
  },

  async criarEtapa(nome: string, conclui = false) {
    await sysgrafix.post("/producao/etapas", { nome, conclui });
  },

  async removerEtapa(id: string) {
    await sysgrafix.delete(`/producao/etapas/${id}`);
  },

  async itens(filtros: { periodo?: string; responsavel?: string } = {}) {
    return dados<ItemProducao>(await sysgrafix.get("/producao/itens", { params: filtros }));
  },

  async criarItem(item: Record<string, unknown>) {
    await sysgrafix.post("/producao/itens", item);
  },

  async mover(id: string, etapaId: string, contexto: { titulo?: string; etapaNome?: string } = {}) {
    await sysgrafix.patch(`/producao/itens/${id}/mover`, { etapaId, ...contexto });
  },

  async historico(id: string) {
    return dados<Movimento>(await sysgrafix.get(`/producao/itens/${id}/historico`));
  },

  /** Reatribui pessoa e dia — é o que a planilha faz ao arrastar a célula. */
  async reatribuir(id: string, responsavelId: string | null, prazo: string) {
    await sysgrafix.patch(`/producao/itens/${id}`, { responsavelId, prazo });
  },

  async excluir(id: string) {
    await sysgrafix.delete(`/producao/itens/${id}`);
  },
};

export default ProducaoService;
