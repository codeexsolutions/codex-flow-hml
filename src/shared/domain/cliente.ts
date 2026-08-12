export enum eStatus {
  ATIVO = "ATIVO",
  INATIVO = "INATIVO",
}

/**
 * Sexo é opcional em toda a ficha: a ausência é "não informado", e não uma
 * quarta opção. Uma opção "não informado" na lista faria a pessoa escolher
 * entre não responder e responder que não quer responder.
 */
export enum eSexo {
  FEMININO = "FEMININO",
  MASCULINO = "MASCULINO",
  OUTRO = "OUTRO",
}

export const SEXO_LABEL: Record<eSexo, string> = {
  [eSexo.FEMININO]: "Feminino",
  [eSexo.MASCULINO]: "Masculino",
  [eSexo.OUTRO]: "Outro",
};

export type ContactType = {
  telefone?: string;
  celular?: string;
  whatsapp?: string;
  email?: string;
};

export type AddressType = {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

type ClientType = {
  id?: string;
  nome: string;
  /**
   * Opcional desde a migration 027 da API.
   *
   * Quem cadastra no balcão faz isso com o cliente esperando: exigir CPF ali
   * produzia documento inventado só para o formulário passar. Só o nome é
   * obrigatório — o resto é o que se descobre sobre o cliente com o tempo.
   */
  cpfCnpj?: string | null;
  status: eStatus;
  /** ISO "AAAA-MM-DD" — data pura, sem hora. */
  dataNascimento?: string | null;
  sexo?: eSexo | null;
  contato?: ContactType;
  endereco?: AddressType;
  created_at?: Date;
};

/** Campos da ficha que valem para relacionamento — a régua de "cadastro completo". */
export const camposDeLead = (c: ClientType) => [
  { chave: "documento", label: "Documento", ok: Boolean(c.cpfCnpj) },
  { chave: "contato", label: "Contato", ok: Boolean(c.contato?.whatsapp || c.contato?.celular || c.contato?.telefone) },
  { chave: "email", label: "E-mail", ok: Boolean(c.contato?.email) },
  { chave: "nascimento", label: "Nascimento", ok: Boolean(c.dataNascimento) },
  { chave: "endereco", label: "Endereço", ok: Boolean(c.endereco?.cidade || c.endereco?.logradouro || c.endereco?.cep) },
];

/** 0–100: quanto da ficha de lead está preenchida. */
export const completudeCliente = (c: ClientType): number => {
  const campos = camposDeLead(c);
  return Math.round((campos.filter((f) => f.ok).length / campos.length) * 100);
};

export default ClientType;
