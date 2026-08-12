/**
 * Onde a sessão é guardada: `localStorage`.
 *
 * O token de acesso e o de renovação vivem aqui, e é daqui que o cliente HTTP
 * e os sockets os leem. Fica num módulo próprio — e não dentro da store — de
 * propósito: `sysgrafix` precisa do token em toda requisição e importar a store
 * de dentro dele fecharia um ciclo (store → service → sysgrafix → store).
 *
 * `localStorage` e não `sessionStorage`: a sessão precisa sobreviver a fechar o
 * navegador, senão quem trabalha o dia inteiro no balcão relogaria a cada aba
 * nova. E não `memória`, senão um F5 já derrubaria a sessão.
 *
 * Lembre que qualquer script que rode nesta página lê o que está aqui — é o
 * preço desta escolha em relação ao cookie httpOnly.
 */

const CHAVE_TOKEN = "codex_token";
const CHAVE_REFRESH = "codex_refresh";

/**
 * Leitura à prova de navegador travado.
 *
 * Em aba anônima de alguns navegadores, e com cookies de terceiro bloqueados
 * dentro de iframe, o simples acesso a `localStorage` **lança**. Sem o `try` o
 * app inteiro morreria na primeira leitura, antes de pintar qualquer tela.
 */
const ler = (chave: string): string | null => {
  try {
    const valor = localStorage.getItem(chave);
    return valor && valor !== "undefined" && valor !== "null" ? valor : null;
  } catch {
    return null;
  }
};

const gravar = (chave: string, valor?: string | null) => {
  try {
    if (valor) localStorage.setItem(chave, valor);
    else localStorage.removeItem(chave);
  } catch {
    /* Sem armazenamento a sessão vale só enquanto a aba viver. */
  }
};

export const lerToken = (): string | null => ler(CHAVE_TOKEN);

export const lerRefreshToken = (): string | null => ler(CHAVE_REFRESH);

/** Grava o par da sessão. `refreshToken` ausente preserva o que já existia. */
export const salvarSessao = (accessToken?: string | null, refreshToken?: string | null) => {
  gravar(CHAVE_TOKEN, accessToken);

  if (refreshToken !== undefined) gravar(CHAVE_REFRESH, refreshToken);
};

export const limparSessao = () => {
  gravar(CHAVE_TOKEN, null);
  gravar(CHAVE_REFRESH, null);
};
