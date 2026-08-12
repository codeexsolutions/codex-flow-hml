import { Mail, Smartphone, Phone, MessageCircle } from "lucide-react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import Field from "@/shared/ui/inputs/Field";
import { fieldError } from "@/shared/validation/fieldError";
import type { EmpresaInput } from "@/features/config/schema/company.schema";

type EmpresaContatoProps = {
  register: UseFormRegister<EmpresaInput>;
  errors: FieldErrors<EmpresaInput>;
};

/** Campos de telefone da empresa — os únicos que recebem máscara aqui. */
type CampoTelefone = "celular" | "telefone" | "whatsapp";

const phoneMasked = (register: UseFormRegister<EmpresaInput>, name: CampoTelefone) => {
  const reg = register(name);
  return {
    ...reg,
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.target.value = maskPhoneValue(ev.target.value);
      reg.onChange(ev);
    },
  };
};

function maskPhoneValue(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const EmpresaContato = ({ register, errors }: EmpresaContatoProps) => (
  <div className="flex flex-col gap-4">
    <Field label="E-mail" icon={<Mail size={15} />} type="email" placeholder="empresa@email.com" error={fieldError(errors.email)} {...register("email")} />
    <Field label="Celular" icon={<Smartphone size={15} />} placeholder="(00) 00000-0000" error={fieldError(errors.celular)} {...phoneMasked(register, "celular")} />
    <Field label="Telefone" icon={<Phone size={15} />} placeholder="(00) 0000-0000" error={fieldError(errors.telefone)} {...phoneMasked(register, "telefone")} />
    <Field label="WhatsApp" icon={<MessageCircle size={15} />} placeholder="(00) 00000-0000" error={fieldError(errors.whatsapp)} {...phoneMasked(register, "whatsapp")} />
  </div>
);

export default EmpresaContato;
