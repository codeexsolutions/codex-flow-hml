import sysgrafix from "@/shared/api/sysgrafix";

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

export type ConfigPix = {
  chave: string;
  tipoChave: PixKeyType;
  beneficiario: string;
  cidade: string;
};

const VAZIA: ConfigPix = { chave: "", tipoChave: "cpf", beneficiario: "", cidade: "" };

/**
 * Chave Pix da empresa.
 *
 * Vinha do `localStorage`, o que estava errado de três formas: era por
 * navegador (cada vendedor com a sua), qualquer um editava pelo DevTools — e
 * trocar a chave é desviar o pagamento do cliente — e sumia ao limpar o cache,
 * deixando a nota sem QR sem explicação.
 *
 * Agora é da empresa, no banco. Gravar é recusado pela API para quem não é o
 * usuário master; a tela esconde o formulário, mas quem decide é o servidor.
 */
const PixService = {
  async consultar(): Promise<ConfigPix> {
    try {
      const r = await sysgrafix.get("/pix");
      const d = r.data?.data?.[0];

      return d ? { ...VAZIA, ...d } : VAZIA;
    } catch {
      /* Sem configuração a nota sai sem QR — que é melhor que não abrir. */
      return VAZIA;
    }
  },

  async salvar(dados: ConfigPix): Promise<void> {
    await sysgrafix.put("/pix", dados);
  },
};

export const pixConfigurado = (c: ConfigPix | null): boolean => Boolean(c?.chave && c?.beneficiario && c?.cidade);

export default PixService;
