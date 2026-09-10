import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import "leaflet/dist/leaflet.css";
import "@xyflow/react/dist/style.css";
import { LanguageProvider, ThemeProvider, ToasterProvider } from "@/components/organisms";
import { CORNER_STYLE_STORAGE_KEY, DEFAULT_CORNER_STYLE, DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Birgus",
  description: "Interfaccia frontend per la gestione progetti Birgus",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const themeInitScript = `(() => {
    try {
      const stored = localStorage.getItem("${THEME_STORAGE_KEY}") || "${DEFAULT_THEME}";
      const corners = localStorage.getItem("${CORNER_STYLE_STORAGE_KEY}") || "${DEFAULT_CORNER_STYLE}";
      document.documentElement.setAttribute("data-theme", stored);
      document.documentElement.setAttribute("data-corners", corners);
    } catch {
      document.documentElement.setAttribute("data-theme", "${DEFAULT_THEME}");
      document.documentElement.setAttribute("data-corners", "${DEFAULT_CORNER_STYLE}");
    }
  })();`;

  return (
    <html lang="it" data-theme={DEFAULT_THEME} data-corners={DEFAULT_CORNER_STYLE} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <ToasterProvider>{children}</ToasterProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
