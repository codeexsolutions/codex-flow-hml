/**
 * Onde a API mora, do ponto de vista do navegador.
 *
 * Três telas resolviam isso por conta própria, repetindo a mesma expressão.
 * Pior: sem padrão. Num deploy, a Vercel não sobe arquivos `.env`, então
 * `VITE_API_PRODUCTION` chega `undefined`, a base vira string vazia e todas as
 * chamadas passam a bater no próprio domínio do site — o app abre, mas nada
 * carrega, e o erro não diz o motivo.
 *
 * O endereço de produção não é segredo (qualquer pessoa o vê no DevTools), então
 * ele fica aqui como último recurso. Variável de ambiente continua vencendo:
 * é assim que se aponta para outro servidor sem mexer no código.
 */

const PRODUCAO = "https://codex-flow-production.up.railway.app/v1";
const LOCAL = "http://localhost:3000/v1";

const doAmbiente = import.meta.env.PROD ? import.meta.env.VITE_API_PRODUCTION : import.meta.env.VITE_API_LOCAL;

/** Sem barra no fim: o axios concatena caminhos que já começam com "/". */
const normalizar = (url: string) => url.trim().replace(/\/+$/, "");

/** Base da API, com o prefixo `/v1`. */
export const API_URL = normalizar(String(doAmbiente || (import.meta.env.PROD ? PRODUCAO : LOCAL)));

/** Raiz do servidor, sem `/v1` — é onde o socket.io escuta. */
export const API_ORIGEM = API_URL.replace(/\/v1$/, "");
