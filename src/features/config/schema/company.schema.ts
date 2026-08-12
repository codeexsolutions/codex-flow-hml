import { z } from "zod";
import { optionalCep, optionalPhone, optionalUrl, requiredEmail } from "@/shared/validation/fields";

/* Schema único da empresa --------------------------------------------- */

export const empresaSchema = z.object({
  // Identificação
  nomeFantasia: z.string().min(1, "Nome fantasia obrigatório"),
  nomeRepresentante: z.string().optional().default(""),
  cpfCnpj: z.string().optional().default(""), // somente leitura
  inscMunicipal: z.string().optional().default(""),
  urlLogo: optionalUrl,
  /** Imagem de fundo (wallpaper) que entra na nota de venda e no orçamento. */
  notaBackground: optionalUrl,

  // Contato
  email: requiredEmail,
  celular: optionalPhone,
  telefone: optionalPhone,
  whatsapp: optionalPhone,

  // Endereço
  cep: optionalCep,
  logradouro: z.string().optional().default(""),
  numero: z.string().optional().default(""),
  complemento: z.string().optional().default(""),
  bairro: z.string().optional().default(""),
  cidade: z.string().optional().default(""),
  uf: z.string().optional().default(""),
});

/**
 * `.default("")` faz entrada e saída divergirem: na entrada o campo é
 * opcional; na saída o zod garante a string. O formulário precisa dos dois —
 * `EmpresaInput` é o que o usuário digita, `EmpresaData` é o já validado.
 */
export type EmpresaInput = z.input<typeof empresaSchema>;
export type EmpresaData = z.output<typeof empresaSchema>;

/**
 * Só os campos da aba Identificação. Salvar essa aba não pode falhar por
 * causa de um campo obrigatório de outra aba (ex: e-mail vazio na aba
 * Contato) — cada aba salva e valida de forma independente.
 */
export const identificacaoSchema = empresaSchema.pick({
  nomeFantasia: true,
  nomeRepresentante: true,
  cpfCnpj: true,
  inscMunicipal: true,
  urlLogo: true,
  notaBackground: true,
});
