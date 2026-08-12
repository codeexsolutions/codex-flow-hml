import { z } from "zod";
import { eSexo, eStatus } from "@/shared/domain/cliente";
import { optionalCep, optionalDigits, optionalEmail } from "@/shared/validation/fields";
import { onlyDigits } from "@/shared/utils/format";

/** Texto do endereço: vazio vai como "" para poder apagar o que havia. */
const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => v ?? "");

/**
 * Data pura "AAAA-MM-DD" vinda de `<input type="date">`.
 *
 * O limite superior é hoje: nascimento no futuro é erro de digitação, e o
 * limite inferior de 1900 pega o caso clássico de digitar o ano com dois
 * dígitos e o navegador completar com "0025".
 */
const nascimentoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => {
    if (!v) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

    const hoje = new Date().toISOString().slice(0, 10);
    return v >= "1900-01-01" && v <= hoje;
  }, "Data de nascimento inválida");

/*
 * Campo apagado vira `null`, nunca `undefined`.
 *
 * `undefined` some no `JSON.stringify`, e a API só sobrescreve o que chega:
 * limpar um CPF digitado errado não apagaria nada, e o valor antigo voltaria na
 * próxima carga da tela. `null` chega ao servidor e apaga de verdade.
 */
const vazioViraNulo = <T>(v: T | undefined | "") => (v === undefined || v === "" ? null : v);

export const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do cliente"),

  /*
   * Único campo obrigatório é o nome.
   *
   * O documento continua validado — mas só quando existe. Aceitar 4 dígitos
   * "porque é opcional" seria trocar um campo vazio por um campo errado.
   */
  cpfCnpj: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      const d = onlyDigits(v);
      return d.length ? d : null;
    })
    .refine((v) => v === null || v.length === 11 || v.length === 14, "CPF ou CNPJ inválido"),

  status: z.nativeEnum(eStatus),

  dataNascimento: nascimentoOpcional,

  /* `""` é o valor da opção "não informado" do select. */
  sexo: z
    .union([z.nativeEnum(eSexo), z.literal("")])
    .optional()
    .transform(vazioViraNulo),

  contato: z
    .object({
      telefone: optionalDigits,
      celular: optionalDigits,
      whatsapp: optionalDigits,
      email: optionalEmail,
    })
    .optional(),

  /*
   * Endereço sai sempre completo, com `""` no que estiver vazio — e não com o
   * campo ausente. Uma rua apagada precisa chegar ao servidor para ser apagada;
   * omitida, ela voltaria na próxima carga.
   */
  endereco: z
    .object({
      cep: optionalCep.transform((v) => onlyDigits(v)),
      logradouro: textoOpcional,
      numero: textoOpcional,
      complemento: textoOpcional,
      bairro: textoOpcional,
      cidade: textoOpcional,
      uf: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ?? "").toUpperCase()),
    })
    .optional(),
});

export type ClienteFormInput = z.input<typeof clienteSchema>;
export type ClienteFormData = z.output<typeof clienteSchema>;
