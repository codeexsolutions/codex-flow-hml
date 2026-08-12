import { useEffect, useState } from "react";
import useThemeStore from "@/shared/theme/theme.store";

export type ChartColors = {
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  grid: string;
  tick: string;
  surface: string;
  ink: string;
  mist: string;
};

const read = (name: string, alpha?: number) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return "transparent";
  return alpha === undefined ? `rgb(${raw})` : `rgb(${raw} / ${alpha})`;
};

const snapshot = (): ChartColors => ({
  accent: read("--accent"),
  accentSoft: read("--accent-soft"),
  success: read("--success"),
  warning: read("--warning"),
  danger: read("--danger"),
  grid: read("--fg", 0.08),
  tick: read("--faint"),
  surface: read("--surface"),
  ink: read("--ink"),
  mist: read("--mist"),
});

/**
 * Recharts recebe cor como prop JS, então não dá para usar classe do Tailwind.
 * Este hook lê os tokens do CSS e reavalia quando tema ou accent mudam — assim
 * os gráficos acompanham claro/escuro em vez de ficarem presos ao escuro.
 */
export function useChartColors(): ChartColors {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const [colors, setColors] = useState<ChartColors>(() => (typeof window === "undefined" ? ({} as ChartColors) : snapshot()));

  useEffect(() => {
    // rAF: espera a classe .dark / data-accent já estarem aplicadas no <html>
    const id = requestAnimationFrame(() => setColors(snapshot()));
    return () => cancelAnimationFrame(id);
  }, [mode, accent]);

  return colors;
}
