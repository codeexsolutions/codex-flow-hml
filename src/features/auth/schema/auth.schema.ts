import { z } from "zod";
import { onlyDigits } from "@/shared/utils/format";

export const authSchema = z.object({
  cpfCnpjEmpresa: z
    .string()
    .min(1, "CPF ou CNPJ da empresa obrigatório")
    .refine((v) => {
      const len = onlyDigits(v).length;
      return len === 11 || len === 14;
    }, "CPF ou CNPJ incompleto"),
  email: z.string().min(1, "Email obrigatório").email("Insira um email válido"),
  senha: z.string().min(1, "Senha obrigatória").min(4, "Mínimo de 4 caracteres"),
});

type AuthFormInputs = z.infer<typeof authSchema>;

export default AuthFormInputs;
