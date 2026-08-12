import type { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";

/**
 * Erro de um campo como o react-hook-form entrega em `formState.errors`.
 * Para campos aninhados o `message` pode ser um objeto, e não uma string.
 */
type RawFieldError = FieldError | Merge<FieldError, FieldErrorsImpl<Record<string, unknown>>> | undefined;

/**
 * Extrai a mensagem de erro de um campo como string.
 *
 * Passar `errors.campo?.message` direto no prop `error` dos campos do FormKit
 * não compila: o tipo do `message` inclui objetos de erro aninhados. Todos os
 * formulários devem usar este helper.
 */
export const fieldError = (error?: RawFieldError): string | undefined => (typeof error?.message === "string" ? error.message : undefined);
