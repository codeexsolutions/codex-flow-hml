export type FxLevel = "full" | "balanced" | "lite";

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/**
 * Estima a capacidade do dispositivo para decidir quanto efeito visual aplicar.
 *
 * `backdrop-filter` é o item mais caro da interface: ele força o compositor a
 * re-renderizar tudo que está atrás do elemento a cada frame. Em máquinas
 * fracas isso derruba a rolagem, então preferimos errar para o lado leve.
 */
export function detectFxLevel(): FxLevel {
  if (typeof window === "undefined") return "balanced";

  const nav = navigator as NavigatorWithHints;

  // Respeita economia de dados e redução de movimento do sistema.
  if (nav.connection?.saveData) return "lite";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "lite";

  // Sem suporte a backdrop-filter, o vidro não renderiza de qualquer forma.
  const suportaBlur = CSS?.supports?.("backdrop-filter", "blur(1px)") || CSS?.supports?.("-webkit-backdrop-filter", "blur(1px)");
  if (!suportaBlur) return "lite";

  const cores = nav.hardwareConcurrency ?? 4;
  const memoria = nav.deviceMemory ?? 4;

  if (cores <= 4 || memoria <= 4) return "lite";
  if (cores <= 8 || memoria <= 8) return "balanced";

  return "full";
}

export const FX_LABEL: Record<FxLevel, string> = {
  full: "Completo",
  balanced: "Equilibrado",
  lite: "Leve",
};

export const FX_DESCRIPTION: Record<FxLevel, string> = {
  full: "Vidro, brilho e profundidade no máximo.",
  balanced: "Vidro mais leve, mantendo a estética.",
  lite: "Cores sólidas, sem desfoque. Máxima fluidez.",
};
