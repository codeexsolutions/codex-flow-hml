/**
 * Notificação do próprio aparelho (a que aparece na bandeja do celular).
 *
 * Alcance honesto do que está aqui: funciona com o app **aberto ou em segundo
 * plano** — que é o caso do vendedor que troca de aba ou minimiza. Com o app
 * totalmente fechado, o navegador não mantém o socket vivo; para isso é preciso
 * Web Push com chaves VAPID e assinatura guardada no servidor, que é uma etapa
 * à parte.
 *
 * A permissão nunca é pedida na primeira tela: navegador nenhum gosta disso e o
 * usuário nega por reflexo. Ela é pedida quando a pessoa liga o recurso.
 */

const CHAVE_PREFERENCIA = "codeex-flow-notificacoes-dispositivo";

export const suportaNotificacao = (): boolean => typeof window !== "undefined" && "Notification" in window;

export const permissaoAtual = (): NotificationPermission => (suportaNotificacao() ? Notification.permission : "denied");

/** O usuário ligou o recurso nas preferências (independe da permissão do SO). */
export const notificacoesLigadas = (): boolean => localStorage.getItem(CHAVE_PREFERENCIA) === "1";

export function definirPreferencia(ligado: boolean): void {
  localStorage.setItem(CHAVE_PREFERENCIA, ligado ? "1" : "0");
}

/** Pede a permissão ao sistema. Devolve `true` se ficou liberado. */
export async function pedirPermissao(): Promise<boolean> {
  if (!suportaNotificacao()) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const resposta = await Notification.requestPermission();

  return resposta === "granted";
}

/**
 * Dispara a notificação.
 *
 * Vai pelo service worker quando ele existe: no Android, notificação criada
 * pelo SW é a única que sobrevive ao app em segundo plano e a que abre o app ao
 * ser tocada. O `new Notification()` é só o plano B do desktop.
 */
export async function notificarNoAparelho(titulo: string, corpo?: string | null, dados?: { rota?: string | null }): Promise<void> {
  if (!suportaNotificacao() || permissaoAtual() !== "granted" || !notificacoesLigadas()) return;

  // Com a aba em foco a faixa do sistema é ruído: o sino já mostrou.
  if (document.visibilityState === "visible") return;

  const opcoes: NotificationOptions = {
    body: corpo ?? undefined,
    icon: "/pwa-192.png",
    badge: "/favicon-32.png",
    // `tag` + `renotify` evita empilhar dez faixas quando a equipe está ativa.
    tag: "codeex-flow-atividade",
    data: { rota: dados?.rota ?? "/" },
  };

  try {
    const registro = await navigator.serviceWorker?.getRegistration();

    if (registro) {
      await registro.showNotification(titulo, opcoes);
      return;
    }

    new Notification(titulo, opcoes);

  } catch {
    /* Sem notificação o mural continua funcionando — nunca quebrar por isso. */
  }
}
