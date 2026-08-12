/**
 * Catálogo de temas — a fonte única de verdade sobre quais paletas existem.
 *
 * Um tema troca a paleta INTEIRA (fundo, superfícies, texto, vidro, aurora).
 * A "cor de destaque" é outra coisa: ela pinta só o accent por cima de
 * qualquer tema. As duas dimensões são independentes de propósito — 6 temas
 * × 9 destaques sem escrever 54 paletas.
 *
 * `dark: true` faz o `useTheme` ligar a classe `.dark`, de onde saem os
 * tokens base do escuro; o bloco `[data-theme]` no index.css sobrescreve só
 * o que muda naquela paleta.
 */

export type ThemeId = "escuro" | "claro" | "meia-noite" | "floresta" | "sepia" | "ardosia" | "onix" | "sistema";

export type ThemeInfo = {
    id: ThemeId;
    label: string;
    desc: string;
    /** Se a paleta é escura — "sistema" resolve em runtime. */
    dark: boolean;
    /** Cores da miniatura na tela de Aparência (não são tokens). */
    preview: { bg: string; panel: string; line: string; soft: string };
};

export const THEMES: ThemeInfo[] = [
    {
        id: "escuro",
        label: "Roxo noite",
        desc: "O padrão do Flow",
        dark: true,
        preview: { bg: "#0c0b18", panel: "#16142a", line: "#2a2740", soft: "#221f37" },
    },
    {
        id: "claro",
        label: "Claro",
        desc: "Fundo branco",
        dark: false,
        preview: { bg: "#f5f4fa", panel: "#ffffff", line: "#dcdae8", soft: "#e7e5f2" },
    },
    {
        id: "meia-noite",
        label: "Meia-noite",
        desc: "Azul profundo",
        dark: true,
        preview: { bg: "#080e1e", panel: "#101830", line: "#22315c", soft: "#1a2647" },
    },
    {
        id: "floresta",
        label: "Floresta",
        desc: "Verde escuro",
        dark: true,
        preview: { bg: "#0a1410", panel: "#10201a", line: "#1e3d31", soft: "#172e26" },
    },
    {
        id: "sepia",
        label: "Sépia",
        desc: "Claro e quente",
        dark: false,
        preview: { bg: "#f5f0e8", panel: "#fffbf5", line: "#e0d5c2", soft: "#ece3d4" },
    },
    {
        id: "ardosia",
        label: "Ardósia",
        desc: "Grafite neutro",
        dark: true,
        preview: { bg: "#111318", panel: "#1a1d24", line: "#333845", soft: "#252932" },
    },
    {
        id: "onix",
        label: "Ônix",
        desc: "Preto absoluto",
        dark: true,
        preview: { bg: "#000000", panel: "#0a0a0b", line: "#242427", soft: "#161618" },
    },
    {
        id: "sistema",
        label: "Sistema",
        desc: "Segue o aparelho",
        dark: true,
        preview: { bg: "#0c0b18", panel: "#16142a", line: "#2a2740", soft: "#221f37" },
    },
];

/** Só as paletas — "sistema" é uma preferência, não uma cor. */
export const PALETAS = THEMES.filter((t) => t.id !== "sistema");

export const temaPorId = (id: ThemeId): ThemeInfo => THEMES.find((t) => t.id === id) ?? THEMES[0];
