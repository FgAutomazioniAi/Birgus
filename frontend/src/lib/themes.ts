export const THEME_STORAGE_KEY = "vl_theme";
export const CORNER_STYLE_STORAGE_KEY = "vl_corner_style";

export const CORNER_STYLE_OPTIONS = [
  { id: "rounded", label: "Arrotondati" },
  { id: "square", label: "Squadrati" },
] as const;

export type CornerStyle = (typeof CORNER_STYLE_OPTIONS)[number]["id"];

export const DEFAULT_CORNER_STYLE: CornerStyle = "rounded";

export const isCornerStyle = (value: string): value is CornerStyle =>
  CORNER_STYLE_OPTIONS.some((option) => option.id === value);

export const THEME_OPTIONS = [
  {
    id: "predefinito",
    label: "Light",
    description: "Interfaccia chiara predefinita.",
    swatches: ["#1e3a8a", "#f97316", "#f8fafc"],
  },
  {
    id: "dark",
    label: "Dark",
    description: "Interfaccia scura ad alto contrasto.",
    swatches: ["#111827", "#60a5fa", "#e5e7eb"],
  },
  {
    id: "grafite",
    label: "Grafite",
    description: "Palette con colori neutri.",
    swatches: ["#232323", "#656565", "#f5f5f5"],
  },
  {
    id: "lavanda",
    label: "Lavanda",
    description: "Palette indigo & pervinca.",
    swatches: ["#161443", "#9aadd7", "#eef1fa"],
  },
  {
    id: "oceano",
    label: "Oceano",
    description: "Palette blu acceso & azzurro.",
    swatches: ["#23549a", "#9aadd7", "#edf3fb"],
  },
  {
    id: "ambra",
    label: "Ambra",
    description: "Palette arancio & blu notte.",
    swatches: ["#161443", "#f68621", "#fff4e9"],
  },
] as const;

export type ThemeId = (typeof THEME_OPTIONS)[number]["id"];

export const DEFAULT_THEME: ThemeId = "predefinito";

export const isThemeId = (value: string): value is ThemeId =>
  THEME_OPTIONS.some((theme) => theme.id === value);
