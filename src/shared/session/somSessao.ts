/**
 * Assinatura sonora da sessão.
 *
 * O som é **sintetizado na hora** com a Web Audio API, não é um arquivo. Três
 * razões: não pesa no bundle nem numa rede de loja ruim, não depende de cache
 * nem de CSP, e o volume é controlado por nós em vez de depender de como o mp3
 * foi masterizado.
 *
 * A ideia é a de um "power on": um acorde que nasce grave, abre em quinta e
 * oitava e some com um brilho por cima. Não é um alerta — é um sinal de que a
 * casa abriu. Por isso ataque lento e cauda longa, sem transiente seco.
 *
 * Duas regras de convivência:
 *
 * - **Só depois de um clique.** Navegador nenhum deixa tocar áudio sem gesto do
 *   usuário, e é uma boa regra: o som entra quando a pessoa aperta "Entrar",
 *   nunca sozinho. Se o contexto vier bloqueado, a função desiste em silêncio.
 * - **Quem pediu menos estímulo não ouve.** `prefers-reduced-motion` também
 *   costuma ser marcado por quem tem sensibilidade sensorial. E há a chave
 *   `codeex-flow-som` para desligar de vez.
 */

const CHAVE = "codeex-flow-som";

export const somLigado = (): boolean => localStorage.getItem(CHAVE) !== "0";

export const definirSom = (ligado: boolean): void => {
  localStorage.setItem(CHAVE, ligado ? "1" : "0");
};

const podeTocar = (): boolean => {
  if (!somLigado()) return false;
  if (typeof window === "undefined") return false;

  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/** Uma voz do acorde: senoide com envelope próprio. */
function voz(ctx: AudioContext, destino: AudioNode, hz: number, inicio: number, duracao: number, pico: number, tipo: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();

  osc.type = tipo;
  osc.frequency.setValueAtTime(hz, inicio);

  // Ataque suave e queda exponencial: é o que soa "aberto" em vez de "bipe".
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(pico, inicio + 0.18);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);

  osc.connect(ganho).connect(destino);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.05);
}

/**
 * Toca a entrada. Não espera o som acabar — a animação de login já tem o seu
 * próprio tempo, e prender uma na outra deixaria o sistema mais lento por causa
 * de um efeito.
 */
export function tocarEntrada(): void {
  if (!podeTocar()) return;

  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;

    const ctx = new Contexto();

    // Aberto por gesto do usuário; se ainda vier suspenso, retomamos.
    void ctx.resume?.();

    const mestre = ctx.createGain();
    mestre.gain.value = 0.16;

    // Tira a aspereza dos harmônicos altos — o som fica "de sala", não de fone.
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.setValueAtTime(1200, ctx.currentTime);
    filtro.frequency.exponentialRampToValueAtTime(4200, ctx.currentTime + 0.9);

    mestre.connect(filtro).connect(ctx.destination);

    const t = ctx.currentTime + 0.02;

    /* Lá menor com nona — grave, quinta, oitava e a nona no fim. Entram em
       escada, não juntos: é a escada que dá a sensação de algo ligando. */
    voz(ctx, mestre, 110.0, t, 2.6, 0.5); // A2 — fundação
    voz(ctx, mestre, 164.81, t + 0.1, 2.4, 0.34); // E3 — quinta
    voz(ctx, mestre, 220.0, t + 0.2, 2.3, 0.3); // A3 — oitava
    voz(ctx, mestre, 329.63, t + 0.34, 2.0, 0.2); // E4
    voz(ctx, mestre, 493.88, t + 0.5, 1.7, 0.12, "triangle"); // B4 — o brilho

    // Fecha o contexto sozinho: um AudioContext vivo por login vaza recurso.
    window.setTimeout(() => void ctx.close?.(), 3200);
  } catch {
    /* Áudio é enfeite: se o navegador recusar, o login segue igual. */
  }
}

/** Saída: os mesmos graus, na ordem inversa e mais curtos. */
export function tocarSaida(): void {
  if (!podeTocar()) return;

  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;

    const ctx = new Contexto();
    void ctx.resume?.();

    const mestre = ctx.createGain();
    mestre.gain.value = 0.12;
    mestre.connect(ctx.destination);

    const t = ctx.currentTime + 0.02;

    voz(ctx, mestre, 329.63, t, 1.1, 0.22);
    voz(ctx, mestre, 220.0, t + 0.09, 1.2, 0.28);
    voz(ctx, mestre, 110.0, t + 0.18, 1.4, 0.4);

    window.setTimeout(() => void ctx.close?.(), 1900);
  } catch {
    /* silêncio */
  }
}

/**
 * Toque de navegação — o "tec" de trocar de tela.
 *
 * Deliberadamente quase inaudível: isto acontece dezenas de vezes por
 * expediente, e som que se nota na décima vez vira tortura na centésima. Por
 * isso é curto (90ms) e filtrado. O volume ficou em 0.06 — audível numa loja
 * com movimento, ainda bem abaixo do som de entrada (0.16).
 *
 * O contexto é reaproveitado entre chamadas: criar um `AudioContext` por clique
 * estoura o limite do navegador (são ~6 por aba) e o som simplesmente para de
 * sair depois de algumas navegações.
 */
let ctxNavegacao: AudioContext | null = null;

export function tocarNavegacao(): void {
  if (!podeTocar()) return;

  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;

    if (!ctxNavegacao || ctxNavegacao.state === "closed") ctxNavegacao = new Contexto();

    const ctx = ctxNavegacao;
    void ctx.resume?.();

    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();

    // Passa-baixa tira o "bip" de despertador e deixa só o toque.
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 2600;

    osc.type = "sine";
    // Pequena queda de tom: soa como algo assentando, não como um alerta.
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.09);

    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.06, t + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(ganho).connect(filtro).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch {
    /* silêncio */
  }
}
