/**
 * Ajusta o comportamento de zoom conforme o app está instalado ou no navegador.
 *
 * O porquê de não ser um valor fixo no `index.html`:
 *
 * - **Instalado** (tela de início, standalone): dar pinça e sair com a tela
 *   torta não é comportamento de aplicativo. Aqui o zoom é travado.
 * - **No navegador**: travar o zoom é barreira de acessibilidade séria — quem
 *   enxerga pouco depende dele, e o próprio Safari ignora `user-scalable=no`
 *   desde o iOS 10 justamente por isso. Ali o zoom continua livre.
 *
 * Vale lembrar: parte do "as pessoas dão zoom" vem de a tipografia estar em
 * pixel fixo, e não do zoom estar disponível. Travar esconde o sintoma; a
 * correção de verdade é a escala em `rem`, que ainda está na fila.
 */

const VIEWPORT_APP = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
const VIEWPORT_WEB = "width=device-width, initial-scale=1, viewport-fit=cover";

/** `standalone` cobre Android/desktop; `navigator.standalone` é o iOS. */
export const appInstalado = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function aplicarModoApp(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  const instalado = appInstalado();

  meta.setAttribute("content", instalado ? VIEWPORT_APP : VIEWPORT_WEB);
  document.documentElement.dataset.modo = instalado ? "app" : "web";

  // Duplo-toque para dar zoom é outro caminho, separado do viewport: só o
  // `touch-action` do CSS resolve. Ver `[data-modo="app"]` no index.css.
}

/** Reavalia quando o usuário instala o app com a aba aberta. */
export function observarModoApp(): () => void {
  const mq = window.matchMedia("(display-mode: standalone)");
  const aoMudar = () => aplicarModoApp();

  mq.addEventListener("change", aoMudar);

  return () => mq.removeEventListener("change", aoMudar);
}
