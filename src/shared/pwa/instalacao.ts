import { useEffect, useState } from "react";

/**
 * Instalar o CodeEx Flow na máquina ou no celular.
 *
 * Não existe "baixar o .exe" aqui: um PWA é instalado pelo próprio navegador,
 * que já tem o app baixado em cache. O que existe é uma permissão — o Chrome
 * avisa quando o site pode virar aplicativo, e esse aviso só pode ser usado
 * UMA vez. Por isso o evento é capturado num lugar só, neste módulo, e quem
 * precisa dele se inscreve: dois componentes ouvindo por conta própria
 * chamariam `prompt()` no mesmo evento e o segundo estouraria.
 *
 * O iPhone não emite esse evento em nenhuma versão do Safari. Lá o caminho é
 * manual (Compartilhar → Adicionar à Tela de Início), e a interface precisa
 * dizer isso em vez de esconder o botão — senão o usuário de iPhone conclui
 * que não dá para instalar.
 */

type EventoDeInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let evento: EventoDeInstalacao | null = null;
let instalado = false;

const inscritos = new Set<() => void>();

const avisar = () => inscritos.forEach((f) => f());

/** O app já está rodando instalado (janela própria, sem barra do navegador)? */
const emModoApp = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS não implementa `display-mode`; expõe isto no `navigator`.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

export const ehIos = (): boolean =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

if (typeof window !== "undefined") {
  instalado = emModoApp();

  window.addEventListener("beforeinstallprompt", (e) => {
    // Sem o preventDefault o Chrome mostra a barra dele, na hora dele.
    e.preventDefault();
    evento = e as EventoDeInstalacao;
    avisar();
  });

  window.addEventListener("appinstalled", () => {
    evento = null;
    instalado = true;
    avisar();
  });
}

/**
 * Dispara a instalação. Devolve o que a pessoa respondeu, ou `"indisponivel"`
 * quando o navegador não ofereceu o convite (iPhone, ou já instalado).
 */
export async function instalarApp(): Promise<"accepted" | "dismissed" | "indisponivel"> {
  if (!evento) return "indisponivel";

  const atual = evento;

  // O convite morre depois de usado: guardar a referência levaria a um
  // segundo `prompt()` que o navegador recusa com erro.
  evento = null;
  avisar();

  await atual.prompt();

  const { outcome } = await atual.userChoice;

  return outcome;
}

export function useInstalacaoPwa() {
  const [, forcar] = useState(0);

  useEffect(() => {
    const aoMudar = () => forcar((n) => n + 1);

    inscritos.add(aoMudar);
    return () => void inscritos.delete(aoMudar);
  }, []);

  return {
    /** O navegador ofereceu o convite — dá para instalar com um clique. */
    podeInstalar: evento !== null,
    /** Já está rodando como app instalado. */
    instalado,
    /** iPhone/iPad: instala pelo menu de compartilhar, não por botão. */
    ehIos: ehIos(),
    instalar: instalarApp,
  };
}
