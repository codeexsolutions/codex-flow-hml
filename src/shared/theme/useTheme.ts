import { useEffect, useState } from "react";
import useThemeStore, { type ThemeMode, type MotionPref, type FxPref } from "@/shared/theme/theme.store";
import { detectFxLevel, type FxLevel } from "@/shared/theme/detectPerformance";
import { temaPorId } from "@/shared/theme/theme.catalog";

const applyMode = (mode: ThemeMode) => {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // "sistema" não é paleta: resolve para escuro/claro conforme o aparelho.
  const tema = mode === "sistema" ? (prefersDark ? "escuro" : "claro") : mode;
  const isDark = temaPorId(tema).dark;

  root.dataset.theme = tema;
  root.classList.toggle("dark", isDark);
  // Faz os controles nativos (scrollbar, inputs) acompanharem o tema.
  root.style.colorScheme = isDark ? "dark" : "light";

  // A barra do navegador (e a status bar do app instalado) segue a paleta:
  // um valor fixo no HTML deixava a moldura roxa mesmo no tema Sépia.
  const meta = document.querySelector('meta[name="theme-color"]');
  const canvas = getComputedStyle(root).getPropertyValue("--canvas").trim();

  if (meta && canvas) meta.setAttribute("content", `rgb(${canvas})`);
};

const applyMotion = (pref: MotionPref) => {
  const root = document.documentElement;
  const systemReduces = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shouldReduce = pref === "reduce" || (pref === "auto" && systemReduces);
  root.dataset.motion = shouldReduce ? "reduce" : "full";
};

const resolveFx = (pref: FxPref, detected: FxLevel): FxLevel => (pref === "auto" ? detected : pref);

const useTheme = () => {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const fontScale = useThemeStore((s) => s.fontScale);
  const motion = useThemeStore((s) => s.motion);
  const fx = useThemeStore((s) => s.fx);

  // Detecta uma única vez por sessão — as heurísticas não mudam em runtime.
  const [detected] = useState<FxLevel>(() => detectFxLevel());

  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
  }, [fontScale]);

  useEffect(() => {
    applyMotion(motion);
  }, [motion]);

  useEffect(() => {
    document.documentElement.dataset.fx = resolveFx(fx, detected);
  }, [fx, detected]);

  // Reage ao sistema quando estiver em "sistema"
  useEffect(() => {
    if (mode !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyMode("sistema");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // Reage ao sistema quando motion estiver em "auto"
  useEffect(() => {
    if (motion !== "auto") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => applyMotion("auto");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [motion]);

  return { detectedFx: detected, activeFx: resolveFx(fx, detected) };
};

export default useTheme;
