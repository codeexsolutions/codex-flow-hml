/**
 * Utilitário padronizado de tratamento de erros.
 *
 * Extrai a mensagem mais semântica possível de um erro da API,
 * levando em conta diferentes formatos de resposta do backend.
 */

import type { AxiosError } from "axios";

type ApiErrorResponse = {
  message?: string;
  error?: string;
  statusCode?: number;
  details?: string[];
};

/**
 * Extrai a mensagem de erro mais legível possível a partir de
 * uma resposta de API rejeitada pelo axios.
 *
 * Percorre várias fontes possíveis:
 * 1. `error.response.data.message` — mensagem explícita do backend
 * 2. `error.response.data.error` — fallback comum em APIs REST
 * 3. `error.message` — mensagem genérica do axios (rede, timeout, etc.)
 * 4. Texto fixo para casos específicos (401, 403, 404, 500, timeout)
 */
export function extractErrorMessage(error: unknown, fallback = "Ocorreu um erro inesperado."): string {
  // Erro do axios (resposta HTTP)
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as ApiErrorResponse | undefined;

    // Mensagem explícita do backend
    if (data?.message) return data.message;
    if (data?.error) return data.error;

    // Erros conhecidos por status
    if (status === 400) return "Dados inválidos. Verifique as informações e tente novamente.";
    if (status === 401) return "Sessão expirada. Faça login novamente.";
    if (status === 403) return "Você não tem permissão para realizar esta ação.";
    if (status === 404) return "Registro não encontrado.";
    if (status === 409) return "Já existe um registro com esses dados.";
    if (status === 422) return "Dados inválidos. Revise os campos e tente novamente.";
    if (status === 429) return "Muitas requisições. Aguarde um momento e tente novamente.";
    if (status && status >= 500) return "Erro interno do servidor. Tente novamente mais tarde.";

    // Timeout
    if (error.code === "ECONNABORTED") return "A requisição excedeu o tempo limite. Verifique sua conexão.";
    if (error.code === "ERR_NETWORK") return "Sem conexão com o servidor. Verifique sua internet.";
  }

  // Erro comum do JavaScript
  if (error instanceof Error) {
    // Ignora erros de "cancelada" (abort controller)
    if (error.name === "CanceledError") return "";
    return error.message || fallback;
  }

  return fallback;
}

/**
 * Tenta extrair detalhes do backend (lista de erros por campo).
 * Retorna array vazio se não houver.
 */
export function extractErrorDetails(error: unknown): string[] {
  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.details && Array.isArray(data.details)) return data.details;
    if (Array.isArray(data)) return data as unknown as string[];
  }
  return [];
}

function isAxiosError(error: unknown): error is AxiosError {
  return !!(error as AxiosError)?.isAxiosError;
}

/**
 * Determina o título semântico para o alerta com base no status HTTP.
 */
export function getErrorTitle(error: unknown): string {
  if (!isAxiosError(error)) return "Erro";
  const status = error.response?.status;

  if (status === 400) return "Dados inválidos";
  if (status === 401) return "Não autenticado";
  if (status === 403) return "Acesso negado";
  if (status === 404) return "Não encontrado";
  if (status === 409) return "Conflito";
  if (status && status >= 500) return "Erro no servidor";
  if (error.code === "ECONNABORTED") return "Tempo excedido";
  if (error.code === "ERR_NETWORK") return "Sem conexão";

  return "Erro";
}
