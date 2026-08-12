import { z } from "zod";

/**
 * As grades de tamanho e seus valores.
 *
 * Existe porque o lojista resolvia isso escrevendo no nome — "Camiseta preta
 * P", "Camiseta preta M", "Camiseta preta G" — e o mesmo produto virava três
 * cadastros que ninguém consegue somar depois. Com grade e tamanho separados,
 * o nome volta a ser o nome.
 *
 * A ordem dentro de cada lista É a ordem de exibição: P vem antes de M porque
 * está antes aqui, e não por ordem alfabética (que poria G antes de M e GG
 * antes de P).
 */
export const GRADES = {
  ROUPA: {
    label: "Roupa",
    tamanhos: ["PP", "P", "M", "G", "GG", "XG", "XGG"],
  },
  CALCADO: {
    label: "Calçado",
    tamanhos: ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
  },
  VOLUME: {
    label: "Volume / peso",
    tamanhos: ["50ml", "100ml", "250ml", "500ml", "1L", "2L", "100g", "250g", "500g", "1kg", "5kg"],
  },
} as const;

export type GradeId = keyof typeof GRADES;

export const productSchema = z
  .object({
    nome: z.string().min(3, "Informe o nome do produto"),

    /** PRODUTO controla estoque; SERVICO não tem o que estocar. */
    tipo: z.enum(["PRODUTO", "SERVICO"]).default("PRODUTO"),

    /**
     * A coluna do banco continua `valor_compra`; o rótulo na tela é "preço de
     * custo". Renomear o campo aqui obrigaria a traduzir de um lado para o
     * outro em service, store e API — trabalho que só o nome não justifica.
     */
    valorCompra: z.coerce.number().min(0, "Valor inválido"),

    valorVenda: z.coerce.number().min(0, "Valor inválido"),

    quantidade: z.coerce.number().min(0, "Quantidade inválida"),

    /** Vazio = o item não se vende por tamanho. */
    grade: z.enum(["", "ROUPA", "CALCADO", "VOLUME"]).default(""),

    tamanho: z.string().default(""),

    descricao: z.string().optional(),

    imagem: z.string().optional(),
  })
  /*
   * Escolher a grade e não escolher o tamanho deixa o cadastro pela metade: o
   * produto fica marcado como "de roupa" sem dizer qual. É erro de
   * preenchimento, não de digitação, então quem tem de pegar é o schema.
   */
  .refine((d) => !d.grade || Boolean(d.tamanho), {
    message: "Escolha o tamanho",
    path: ["tamanho"],
  });

/**
 * `z.coerce.number()` aceita string na entrada (o que o input HTML devolve) e
 * garante number na saída — por isso entrada e saída são tipos distintos.
 */
export type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormData = z.output<typeof productSchema>;

/**
 * Lucro e margem de uma venda.
 *
 * A margem é sobre a VENDA, não sobre o custo — é a conta que o comerciante
 * usa ("nessa camiseta eu ganho 40%") e a que aparece em qualquer relatório
 * de resultado. Sobre o custo, o mesmo caso daria 66%, e o número maior
 * enganaria justamente quem está formando preço.
 */
export const calcularGanho = (custo: number, venda: number) => {
  const lucro = venda - custo;

  return {
    lucro,
    // Sem preço de venda não há margem — e dividir por zero mostraria
    // "Infinity%" na tela, que é pior do que não mostrar nada.
    margem: venda > 0 ? (lucro / venda) * 100 : null,
  };
};
