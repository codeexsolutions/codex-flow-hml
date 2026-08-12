interface EnterpriseType {
  id: string;
  codigoEmpresa: string;
  nomeRepresentante: string;
  nomeFantasia: string;
  cpfCnpj: string;
  inscMunicipal?: string;
  urlLogo?: string;
  /** Imagem de fundo (wallpaper) da nota de venda e do orçamento. */
  notaBackground?: string;
  ativo: boolean;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  contato?: {
    telefone?: string;
    celular?: string;
    whatsapp?: string;
    email?: string;
  };
}

export type EnterpriseLike = {
  nomeFantasia?: string;
  name?: string;
  cpfCnpj?: string;
  urlLogo?: string;
};

const CODIGO_EMPRESA_SUFFIX_LENGTH = 2;

export const toCodigoEmpresaBase = (codigoEmpresa: string): string => codigoEmpresa.slice(0, -CODIGO_EMPRESA_SUFFIX_LENGTH);

export default EnterpriseType;
