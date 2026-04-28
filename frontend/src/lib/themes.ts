export const THEME_STORAGE_KEY = "vl_theme";

export const THEME_OPTIONS = [
  {
    id: "predefinito",
    label: "Predefinito",
    description: "Palette predefinita.",
    swatches: ["#1e3a8a", "#f97316", "#f8fafc"],
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
