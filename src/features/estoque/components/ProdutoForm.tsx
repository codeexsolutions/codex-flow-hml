import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Hash, ShoppingBag, Image as ImageIcon, Tag, Ruler } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  GRADES, calcularGanho, productSchema,
  type GradeId, type ProductFormData, type ProductFormInput,
} from "@/features/estoque/schema/product.schema";
import { Form, FormGrid, TextField, SelectBox, TextArea, CurrencyField, FormActions } from "@/shared/ui/form/FormKit";
import { formatCurrency } from "@/shared/utils/currency";
import { useAlert } from "@/shared/ui/Alert";

type Props = {
  defaultValues?: Partial<ProductFormData>;
  onSubmit: (data: ProductFormData) => void;
  onCancel: () => void;
  /** Quando fornecido, exibe o botão de excluir (modo edição). */
  onDelete?: () => void;
  submitText: string;
  /** Cadastro em série: ao salvar, limpa os campos em vez de fechar o modal. */
  resetarAoSalvar?: boolean;
};

const VAZIO: ProductFormData = {
  nome: "",
  tipo: "PRODUTO",
  valorCompra: 0,
  valorVenda: 0,
  quantidade: 0,
  grade: "",
  tamanho: "",
  descricao: "",
  imagem: "",
};

/** Abre e fecha por altura — o campo empurra o resto do formulário em vez de
    aparecer por cima dele. */
const REVELA = {
  fechado: { opacity: 0, height: 0 },
  aberto: { opacity: 1, height: "auto" },
};

export function ProdutoForm({ defaultValues, onSubmit, onCancel, onDelete, submitText, resetarAoSalvar }: Props) {
  const alert = useAlert();
  const reduzir = useReducedMotion();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { ...VAZIO, ...defaultValues },
  });

  const tipo = watch("tipo");
  const grade = watch("grade");
  const custo = Number(watch("valorCompra")) || 0;
  const venda = Number(watch("valorVenda")) || 0;

  const ehServico = tipo === "SERVICO";
  const { lucro, margem } = calcularGanho(custo, venda);

  /* Trocar a grade zera o tamanho: senão "M" ficaria preso num select que só
     oferece números, e o formulário enviaria tamanho fora da grade. */
  useEffect(() => {
    setValue("tamanho", "", { shouldValidate: false });
  }, [grade, setValue]);

  /* Serviço não tem estoque nem tamanho — somem da tela e do dado. */
  useEffect(() => {
    if (!ehServico) return;

    setValue("quantidade", 0);
    setValue("grade", "");
    setValue("tamanho", "");
  }, [ehServico, setValue]);

  const handleValid = async (data: ProductFormData) => {
    const { confirmed } = await alert.confirm(
      ehServico ? "Salvar serviço?" : "Salvar produto?",
      "Confirme os dados antes de salvar.",
    );
    if (!confirmed) return;

    onSubmit(data);

    if (!resetarAoSalvar) return;

    /* Tipo e grade sobrevivem à limpeza: quem cadastra camisetas cadastra a
       próxima camiseta. Nome, preços e quantidade zeram — herdar o preço do
       item anterior é como um erro entra no estoque sem ninguém ver. */
    reset({ ...VAZIO, tipo: data.tipo, grade: data.grade });
    setFocus("nome");
  };

  const handleInvalid = () => {
    alert.error("Campos inválidos", "Revise os campos destacados e tente novamente.");
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const { confirmed } = await alert.confirm("Excluir produto?", "Essa ação não pode ser desfeita.", {
      type: "warning",
      confirmText: "Excluir",
    });
    if (!confirmed) return;
    onDelete();
  };

  return (
    <Form onSubmit={handleSubmit(handleValid, handleInvalid)} className="!gap-2">
      <FormGrid cols={2}>
        <SelectBox label="Tipo" icon={<Tag className="h-3.5 w-3.5" />} error={errors.tipo?.message} {...register("tipo")}>
          <option value="PRODUTO">Produto</option>
          <option value="SERVICO">Serviço</option>
        </SelectBox>

        <TextField
          label="Nome"
          icon={<ShoppingBag className="h-3.5 w-3.5" />}
          placeholder={ehServico ? "Instalação de ar-condicionado" : "Camiseta básica preta"}
          error={errors.nome?.message}
          {...register("nome")}
        />
      </FormGrid>

      <FormGrid cols={2}>
        <Controller
          control={control}
          name="valorCompra"
          render={({ field }) => (
            <CurrencyField label="Custo" value={Number(field.value) || 0} onValueChange={field.onChange} error={errors.valorCompra?.message} />
          )}
        />

        <Controller
          control={control}
          name="valorVenda"
          render={({ field }) => (
            <CurrencyField label="Venda" value={Number(field.value) || 0} onValueChange={field.onChange} error={errors.valorVenda?.message} />
          )}
        />
      </FormGrid>

      {/* O ganho aparece sozinho quando há preço de venda — é a resposta que
          antes se buscava na calculadora do celular. */}
      <AnimatePresence initial={false}>
        {venda > 0 && (
          <motion.div
            variants={reduzir ? undefined : REVELA}
            initial="fechado"
            animate="aberto"
            exit="fechado"
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className={`mb-1 flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                lucro < 0 ? "bg-danger/[0.08]" : lucro === 0 ? "bg-fg/[0.03]" : "bg-success/[0.08]"
              }`}
            >
              <span className="text-[11px] uppercase tracking-[0.08em] text-faint">{lucro < 0 ? "Prejuízo" : "Lucro"}</span>
              <span className="flex items-baseline gap-2 tabular-nums">
                <motion.span
                  key={lucro}
                  initial={reduzir ? false : { opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14 }}
                  className={`text-[15px] leading-none ${lucro < 0 ? "text-danger" : lucro === 0 ? "text-mist" : "text-success"}`}
                >
                  {formatCurrency(lucro)}
                </motion.span>
                {margem !== null && <span className="text-[11.5px] text-mist">{margem.toFixed(0)}%</span>}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tamanho e estoque não existem em serviço: o bloco inteiro sai. */}
      <AnimatePresence initial={false}>
        {!ehServico && (
          <motion.div
            variants={reduzir ? undefined : REVELA}
            initial="fechado"
            animate="aberto"
            exit="fechado"
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <FormGrid cols={2}>
              <SelectBox label="Tamanho" icon={<Ruler className="h-3.5 w-3.5" />} error={errors.grade?.message} {...register("grade")}>
                <option value="">Único</option>
                {(Object.keys(GRADES) as GradeId[]).map((id) => (
                  <option key={id} value={id}>
                    {GRADES[id].label}
                  </option>
                ))}
              </SelectBox>

              {/* O segundo select nasce só depois do primeiro. Deixá-lo na
                  tela desabilitado seria ocupar a metade da linha para não
                  fazer nada; vazio, a quantidade sobe e ocupa o lugar. */}
              {grade ? (
                <motion.div
                  initial={reduzir ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <SelectBox label="Qual" icon={<Ruler className="h-3.5 w-3.5" />} error={errors.tamanho?.message} {...register("tamanho")}>
                    <option value="">Selecione</option>
                    {GRADES[grade as GradeId].tamanhos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </SelectBox>
                </motion.div>
              ) : (
                <TextField
                  label="Quantidade"
                  type="number"
                  min="0"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  error={errors.quantidade?.message}
                  {...register("quantidade", { valueAsNumber: true })}
                />
              )}
            </FormGrid>
          </motion.div>
        )}
      </AnimatePresence>

      <FormGrid cols={2}>
        {/* Com grade escolhida a quantidade perdeu o lugar lá em cima e volta
            aqui: ela é por tamanho, então pertence à linha de baixo. */}
        {!ehServico && grade && (
          <TextField
            label="Quantidade"
            type="number"
            min="0"
            icon={<Hash className="h-3.5 w-3.5" />}
            error={errors.quantidade?.message}
            {...register("quantidade", { valueAsNumber: true })}
          />
        )}

        <TextField label="Imagem" icon={<ImageIcon className="h-3.5 w-3.5" />} placeholder="URL (opcional)" error={errors.imagem?.message} {...register("imagem")} />
      </FormGrid>

      <TextArea label="Descrição" rows={2} placeholder="Opcional" error={errors.descricao?.message} {...register("descricao")} />

      <FormActions onCancel={onCancel} onDelete={onDelete ? handleDelete : undefined} saving={isSubmitting} submitText={submitText} />
    </Form>
  );
}
