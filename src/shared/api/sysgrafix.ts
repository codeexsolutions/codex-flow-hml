import axios, { type AxiosRequestConfig } from "axios";

import { API_URL } from "@/shared/api/apiUrl";
import { lerRefreshToken, lerToken, limparSessao, salvarSessao } from "@/shared/api/sessao";

const sysgrafix = axios.create({
  baseURL: API_URL,
});

/*
 * O token vai no header, em toda requisição.
 *
 * Lido do `localStorage` a cada chamada, e não guardado numa variável do
 * módulo: assim uma renovação (ou um logout em outra aba) passa a valer na
 * requisição seguinte, sem ninguém precisar reconstruir o cliente HTTP.
 */
sysgrafix.interceptors.request.use((config) => {
  const token = lerToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/*
 * Renovação de sessão.
 *
 * O access token dura 12h; antes disso existia só ele, então quem passava do
 * expediente tomava 401 e o app quebrava calado. Agora o 401 dispara uma
 * renovação com o refresh token guardado e a requisição original é repetida —
 * a troca é invisível para quem está usando.
 *
 * A store de sessão registra os callbacks aqui em vez de ser importada: este
 * módulo é importado por todos os serviços, e importar a store criaria ciclo
 * (store → service → sysgrafix → store).
 */
type GanchosDeSessao = {
  aoRenovar: (usuario: unknown) => void;
  aoExpirar: () => void;
};

let ganchos: GanchosDeSessao | null = null;

export function registrarGanchosDeSessao(g: GanchosDeSessao) {
  ganchos = g;
}

/*
 * Uma renovação por vez. Sem isto, uma tela que dispara seis requisições ao
 * abrir mandaria seis refreshes concorrentes — e como cada um rotaciona o
 * refresh token, os últimos chegariam com um token que os primeiros já
 * invalidaram.
 */
let renovacaoEmCurso: Promise<unknown> | null = null;

function renovarSessao() {
  if (!renovacaoEmCurso) {
    const refreshToken = lerRefreshToken();

    if (!refreshToken) return Promise.reject(new Error("Sessão expirada."));

    renovacaoEmCurso = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const sessao = res.data?.data?.[0];

        if (!sessao?.accessToken) throw new Error("Sessão expirada.");

        // O par novo entra antes do aviso à store: a requisição repetida logo
        // abaixo já lê o token atualizado do `localStorage`.
        salvarSessao(sessao.accessToken, sessao.refreshToken ?? undefined);

        ganchos?.aoRenovar(sessao);

        return sessao;
      })
      .finally(() => {
        renovacaoEmCurso = null;
      });
  }

  return renovacaoEmCurso;
}

/** Rotas onde 401 é a resposta esperada — renovar aqui não faz sentido. */
const SEM_RENOVACAO = ["/auth/refresh", "/auth/logout", "/login/token"];

sysgrafix.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as (AxiosRequestConfig & { _jaRenovou?: boolean }) | undefined;
    const url = config?.url ?? "";

    const podeRenovar =
      error.response?.status === 401 &&
      config &&
      !config._jaRenovou &&
      !SEM_RENOVACAO.some((rota) => url.includes(rota));

    if (podeRenovar) {
      // Marca ANTES de tentar: se a requisição repetida tomar 401 de novo, ela
      // não entra aqui outra vez e o erro sobe — em vez de renovar em laço.
      config._jaRenovou = true;

      try {
        await renovarSessao();

        return sysgrafix(config);
      } catch {
        // Refresh também morreu: a sessão acabou de verdade.
        limparSessao();
        ganchos?.aoExpirar();
      }
    }

    return Promise.reject(error);
  },
);

export default sysgrafix;
