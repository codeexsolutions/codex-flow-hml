import { Building2, User, FileText, Hash } from "lucide-react";
import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import Field from "@/shared/ui/inputs/Field";
import UploadImagem from "@/shared/ui/UploadImagem";
import { fieldError } from "@/shared/validation/fieldError";
import type { EmpresaInput } from "@/features/config/schema/company.schema";

type EmpresaIdentificacaoProps = {
  register: UseFormRegister<EmpresaInput>;
  errors: FieldErrors<EmpresaInput>;
  setValue: UseFormSetValue<EmpresaInput>;
  watch: UseFormWatch<EmpresaInput>;
};

/**
 * As três imagens da empresa eram campos de "cole a URL aqui".
 *
 * O que isso produziu em produção foi link de CDN do WhatsApp, que expira: a
 * logo some da nota sozinha, e o dono descobre pelo PDF que já mandou pro
 * cliente. Agora escolhe-se o arquivo, ele vira WebP e fica no nosso storage.
 *
 * `shouldDirty` é o que faz o botão Salvar acordar — sem ele a pessoa envia a
 * imagem, vê a prévia trocar, sai da tela e perde tudo.
 */
const EmpresaIdentificacao = ({ register, errors, setValue, watch }: EmpresaIdentificacaoProps) => {
  const definir = (campo: "urlLogo" | "notaBackground") => (url: string | null) =>
    setValue(campo, url ?? "", { shouldDirty: true });

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome fantasia" icon={<Building2 size={15} />} placeholder="Nome da empresa" error={fieldError(errors.nomeFantasia)} {...register("nomeFantasia")} />
      <Field label="Representante" icon={<User size={15} />} placeholder="Nome do responsável" error={fieldError(errors.nomeRepresentante)} {...register("nomeRepresentante")} />
      <Field label="CPF ou CNPJ" icon={<FileText size={15} />} hint="Não editável" disabled readOnly {...register("cpfCnpj")} />
      <Field label="Inscrição municipal" icon={<Hash size={15} />} placeholder="Opcional" error={fieldError(errors.inscMunicipal)} {...register("inscMunicipal")} />

      {/* Uma imagem só. Havia uma segunda caixa, "Imagem da empresa", que
          não aparecia em lugar nenhum além de servir de reserva para a
          própria logo — duas caixas iguais lado a lado, e a pergunta
          inevitável de qual das duas é a que sai na nota. */}
      <UploadImagem tipo="logo" rotulo="Logo" valor={watch("urlLogo")} onChange={definir("urlLogo")} />

      <div className="flex flex-col gap-1.5">
        <UploadImagem
          tipo="wallpaper"
          rotulo="Fundo da nota (wallpaper)"
          formato="largo"
          valor={watch("notaBackground")}
          onChange={definir("notaBackground")}
        />
        <p className="text-[11px] text-faint">
          Aparece suave atrás da nota de venda e do orçamento, com o conteúdo por cima.
        </p>
      </div>
    </div>
  );
};

export default EmpresaIdentificacao;
