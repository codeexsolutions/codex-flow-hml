import sysgrafix from "@/shared/api/sysgrafix";
import type { CalcFreteDto, PrePostagemDto } from "@/features/correios/types/correios.types";

/**
 * Serviço de integração com os Correios.
 *
 * Todas as chamadas passam pelo backend (proxy) que detém as credenciais
 * de contrato e token CWS (Correios Web Services).
 */
const CorreiosService = {
  /* ─── Preços ─── */
  calcularFrete: (data: CalcFreteDto) => sysgrafix.post("/correios/calcular-frete", data),
  listarServicos: () => sysgrafix.get("/correios/servicos"),

  /* ─── Pré-Postagem ─── */
  solicitarPostagem: (data: PrePostagemDto) => sysgrafix.post("/correios/pre-postagem", data),
  listarPostagens: () => sysgrafix.get("/correios/postagens"),
  cancelarPostagem: (id: string) => sysgrafix.delete(`/correios/postagens/${id}`),
  emitirDAE: (postagemId: string) => sysgrafix.post(`/correios/postagens/${postagemId}/dae`, {}),
  reimprimirEtiqueta: (postagemId: string) => sysgrafix.get(`/correios/postagens/${postagemId}/etiqueta`),

  /* ─── Rastreio ─── */
  rastrear: (codigo: string) => sysgrafix.get(`/correios/rastro/${codigo}`),

  /* ─── Coleta ─── */
  solicitarColeta: (data: object) => sysgrafix.post("/correios/coleta", data),

  /* ─── Resumo ─── */
  obterResumo: () => sysgrafix.get("/correios/resumo"),
};

export default CorreiosService;
