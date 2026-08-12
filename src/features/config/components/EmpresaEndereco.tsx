import { Controller } from "react-hook-form";
import { MapPin, Hash, Building2 } from "lucide-react";
import type { UseFormRegister, Control, FieldErrors } from "react-hook-form";
import Field from "@/shared/ui/inputs/Field";
import { fieldError } from "@/shared/validation/fieldError";
import { SelectField } from "@/features/config/components/ConfigUI";
import { UFS } from "@/shared/validation/masks";
import { maskCep } from "@/shared/validation/masks";
import type { EmpresaData, EmpresaInput } from "@/features/config/schema/company.schema";

type EmpresaEnderecoProps = {
  register: UseFormRegister<EmpresaInput>;
  /** Mesmo `control` do formulário da EmpresaPage — entrada e saída divergem por causa dos `.default("")` do schema. */
  control: Control<EmpresaInput, unknown, EmpresaData>;
  errors: FieldErrors<EmpresaInput>;
  onBuscarCep: () => void;
};

const EmpresaEndereco = ({ register, control, errors, onBuscarCep }: EmpresaEnderecoProps) => {
  const regCep = register("cep");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="CEP"
          icon={<MapPin size={15} />}
          placeholder="00000-000"
          error={fieldError(errors.cep)}
          {...regCep}
          onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
            ev.target.value = maskCep(ev.target.value);
            regCep.onChange(ev);
          }}
          onBlur={(ev: React.FocusEvent<HTMLInputElement>) => {
            regCep.onBlur(ev);
            onBuscarCep();
          }}
        />
        <Field label="Número" icon={<Hash size={15} />} placeholder="123" error={fieldError(errors.numero)} {...register("numero")} />
      </div>

      <Field label="Logradouro" icon={<MapPin size={15} />} placeholder="Rua, avenida..." error={fieldError(errors.logradouro)} {...register("logradouro")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Bairro" icon={<MapPin size={15} />} placeholder="Bairro" error={fieldError(errors.bairro)} {...register("bairro")} />
        <Field label="Complemento" icon={<Hash size={15} />} placeholder="Opcional" error={fieldError(errors.complemento)} {...register("complemento")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cidade" icon={<Building2 size={15} />} placeholder="Cidade" error={fieldError(errors.cidade)} {...register("cidade")} />
        <Controller
          control={control}
          name="uf"
          render={({ field }) => (
            <SelectField label="UF" icon={<MapPin size={15} />} value={field.value ?? ""} onChange={field.onChange}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </SelectField>
          )}
        />
      </div>
    </div>
  );
};

export default EmpresaEndereco;
