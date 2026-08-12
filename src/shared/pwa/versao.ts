/// <reference types="vite/client" />

/**
 * Qual versão do app está rodando agora, e como sair de uma versão presa.
 *
 * O relato de "o PWA nunca atualiza" é difícil de investigar porque ninguém
 * consegue provar qual build está na tela. Aqui o build se identifica (data e
 * commit, carimbados pelo Vite) e existe um caminho manual de escape para o
 * caso raro em que o service worker fica preso numa versão antiga.
 */

declare const __BUILD_ID__: string;

/** "2026-08-08 03:14 · a1b2c3d" — o que aparece no rodapé do menu. */
export const BUILD_ID: string = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

/**
 * Força a próxima carga a vir do servidor.
 *
 * Apaga TODO cache do Workbox e remove os service workers registrados antes de
 * recarregar. É a saída de emergência: o caminho normal é o worker se atualizar
 * sozinho, e este botão existe para quando isso não acontece — em vez de o
 * cliente ter que descobrir sozinho como limpar dados do site no celular.
 *
 * Não mexe em `localStorage`: a sessão fica de pé, e quem clica não é
 * deslogado no meio do expediente.
 */
export async function forcarAtualizacao(): Promise<void> {
  try {
    if ("caches" in window) {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((nome) => caches.delete(nome)));
    }
  } catch {
    /* Navegador sem Cache Storage: segue para o resto. */
  }

  try {
    if ("serviceWorker" in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((r) => r.unregister()));
    }
  } catch {
    /* Sem service worker não há o que remover. */
  }

  /*
   * `reload()` sozinho pode ser servido pelo cache HTTP do próprio navegador.
   * Recarregar por `location.replace` com um parâmetro descartável obriga uma
   * requisição nova — e o parâmetro não fica no histórico.
   */
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString(36));

  window.location.replace(url.toString());
}
