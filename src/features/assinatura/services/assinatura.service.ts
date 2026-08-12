import sysgrafix from "@/shared/api/sysgrafix";
import { salvarSessao } from "@/shared/api/sessao";
import type {
  CobrancaPix, LeadRegistrado, MeuPlano, MinhaAssinatura, Plano, Recomendacao,
  RespostasDiagnostico, RetornoCadastro,
} from "../types/assinatura.types";

/** A API responde sempre no formato { statusCode, message, data: [...] }. */
type RetornoPadrao<T> = { statusCode: number; message: string; data: T[] };

const AssinaturaService = {
  /**
   * Público — não exige token.
   *
   * Por padrão traz só os planos da vitrine. `todos` é o que a comparação
   * completa pede quando a pessoa clica em "ver outras opções" — a venda
   * normal acontece com UM plano na tela, vindo de `recomendar`.
   */
  listarPlanos: async (todos = false): Promise<Plano[]> => {
    const res = await sysgrafix.get<RetornoPadrao<Plano>>(`/assinatura/planos${todos ? "?todos=1" : ""}`);
    return res.data?.data ?? [];
  },

  /** Três respostas entram, um plano sai. Público. */
  recomendar: async (respostas: RespostasDiagnostico): Promise<Recomendacao> => {
    const res = await sysgrafix.post<RetornoPadrao<Recomendacao>>("/assinatura/recomendar", respostas);
    const recomendacao = res.data?.data?.[0];

    if (!recomendacao?.plano) throw new Error(res.data?.message || "Não foi possível recomendar um plano.");

    return recomendacao;
  },

  /**
   * Grava o contato e devolve para onde mandar a pessoa. Público de
   * propósito: o lead nasce antes de existir conta.
   */
  registrarLead: async (dados: {
    nome: string;
    empresa?: string | null;
    email?: string | null;
    telefone?: string | null;
    cpfCnpj?: string | null;
    codigoEmpresa?: string | null;
    planoRecomendado?: string | null;
    planoAlternativo?: string | null;
    respostas?: RespostasDiagnostico;
    origem?: string;
  }): Promise<LeadRegistrado> => {
    const res = await sysgrafix.post<RetornoPadrao<LeadRegistrado>>("/assinatura/lead", dados);
    const lead = res.data?.data?.[0];

    if (!lead) throw new Error(res.data?.message || "Não foi possível registrar o contato.");

    return lead;
  },

  /** Plano vigente, uso dos limites e avisos — alimenta os gates da interface. */
  meuPlano: async (): Promise<MeuPlano> => {
    const res = await sysgrafix.get<RetornoPadrao<MeuPlano>>("/assinatura/meu-plano");
    const meu = res.data?.data?.[0];

    if (!meu) throw new Error(res.data?.message || "Não foi possível carregar seu plano.");

    return meu;
  },

  minha: async (): Promise<MinhaAssinatura> => {
    const res = await sysgrafix.get<RetornoPadrao<MinhaAssinatura>>("/assinatura/minha");
    const assinatura = res.data?.data?.[0];

    if (!assinatura) throw new Error(res.data?.message || "Não foi possível carregar sua assinatura.");

    return assinatura;
  },

  /**
   * Reemite o token com o status atual da empresa — é o que destrava o sistema
   * assim que o pagamento é confirmado.
   *
   * O token novo é guardado aqui mesmo: quem chamou quer saber do `ativo`, e
   * esquecer de trocar o token deixaria a sessão presa no `ativo: false`
   * antigo até o próximo login.
   */
  revalidar: async (): Promise<{ ativo: boolean }> => {
    const res = await sysgrafix.post<RetornoPadrao<{ ativo: boolean; accessToken?: string }>>("/assinatura/revalidar", {});
    const dados = res.data?.data?.[0];

    if (!dados) throw new Error(res.data?.message || "Não foi possível revalidar a sessão.");

    if (dados.accessToken) salvarSessao(dados.accessToken);

    return { ativo: dados.ativo };
  },

  trocarPlano: async (planoCodigo: string): Promise<MinhaAssinatura> => {
    const res = await sysgrafix.post<RetornoPadrao<MinhaAssinatura>>("/assinatura/plano", { planoCodigo });
    const assinatura = res.data?.data?.[0];

    if (!assinatura) throw new Error(res.data?.message || "Não foi possível trocar o plano.");

    return assinatura;
  },

  /** Marca a fatura como "aguardando confirmação" na fila do painel do dono. */
  enviarComprovante: async (faturaId: string): Promise<MinhaAssinatura> => {
    const res = await sysgrafix.post<RetornoPadrao<MinhaAssinatura>>(`/assinatura/faturas/${faturaId}/comprovante`, {});
    const assinatura = res.data?.data?.[0];

    if (!assinatura) throw new Error(res.data?.message || "Não foi possível registrar o comprovante.");

    return assinatura;
  },

  cadastrar: async (payload: unknown): Promise<RetornoCadastro> => {
    const res = await sysgrafix.post<RetornoPadrao<RetornoCadastro>>("/empresas/cadastrar", payload);
    const cadastro = res.data?.data?.[0];

    if (res.status !== 201 || !cadastro) {
      throw new Error(res.data?.message || "Não foi possível concluir o cadastro.");
    }

    return cadastro;
  },

  /**
   * Gera (ou reaproveita) a cobrança Pix da fatura no Mercado Pago.
   *
   * Diferente do Pix estático de antes, esta cobrança é identificada: quando o
   * dinheiro cai, o MP avisa por webhook e a fatura quita sozinha. O cliente
   * não precisa mandar comprovante nem esperar alguém conferir.
   */
  cobrancaPix: async (faturaId: string): Promise<CobrancaPix> => {
    const res = await sysgrafix.post<RetornoPadrao<CobrancaPix>>(`/mercadopago/faturas/${faturaId}/pix`, {});
    const cobranca = res.data?.data?.[0];

    if (!cobranca?.qrCode) throw new Error(res.data?.message || "Não foi possível gerar a cobrança Pix.");

    return cobranca;
  },

  /**
   * Ativa a cobrança automática e devolve o link de autorização do Mercado Pago.
   *
   * A conclusão acontece FORA daqui: o cliente autoriza no site do MP e o
   * webhook é quem confirma. Esta chamada só abre a porta — tratar o retorno
   * dela como "assinado" mostraria pago o que ainda não foi autorizado.
   */
  ativarPagamentoAutomatico: async (): Promise<string> => {
    const res = await sysgrafix.post<RetornoPadrao<{ preapprovalId: string; initPoint: string }>>("/mercadopago/assinar", {});
    const dados = res.data?.data?.[0];

    if (!dados?.initPoint) throw new Error(res.data?.message || "Não foi possível iniciar o pagamento automático.");

    return dados.initPoint;
  },

  cancelarPagamentoAutomatico: async (): Promise<void> => {
    await sysgrafix.post("/mercadopago/cancelar", {});
  },
};

export default AssinaturaService;
