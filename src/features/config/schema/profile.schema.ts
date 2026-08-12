import { z } from "zod";
import { optionalPhone, requiredEmail } from "@/shared/validation/fields";

export const profileSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: requiredEmail,
  phone: optionalPhone,
  role: z.string().optional().default(""),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;

export const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual"),
    next: z.string().min(6, "Mínimo de 6 caracteres"),
    confirm: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.next === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem",
  });

export type PasswordData = z.infer<typeof passwordSchema>;
