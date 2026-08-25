import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import "leaflet/dist/leaflet.css";
import "@xyflow/react/dist/style.css";
import { LanguageProvider, ThemeProvider, ToasterProvider } from "@/components/organisms";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Project Manager FG",
  description: "Interfaccia frontend per la gestione progetti Birgus",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const themeInitScript = `(() => {
    try {
      const stored = localStorage.getItem("${THEME_STORAGE_KEY}") || "${DEFAULT_THEME}";
      document.documentElement.setAttribute("data-theme", stored);
    } catch {
      document.documentElement.setAttribute("data-theme", "${DEFAULT_THEME}");
    }
  })();`;

  return (
    <html lang="it" data-theme={DEFAULT_THEME} suppressHydrationWarning>
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
