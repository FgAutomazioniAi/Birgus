"use client";

import { Palette } from "lucide-react";

import { Card, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { useTheme } from "@/components/organisms/theme-provider";
import type { ThemeId } from "@/lib/themes";

export function SettingsPanel() {
  const { options, theme, setTheme } = useTheme();
  const selectedTheme = options.find((option) => option.id === theme) ?? options[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            Impostazioni
          </Text>
          <PageHelpHint text="Modifica le preferenze visive dell'app." />
        </div>
        <Text variant="muted">Personalizza le tue preferenze</Text>
      </div>

      <Card className="space-y-4 p-4 lg:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-bold text-text-primary" htmlFor="theme-selector">
            <Palette size={16} className="text-brand-primary" />
            Palette colore
          </label>
          <SelectDropdown
            id="theme-selector"
            className="w-full sm:w-72"
            value={theme}
            onChange={(value) => setTheme(value as ThemeId)}
            options={options.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
          <span className="text-xs font-bold text-text-secondary">{selectedTheme.label}</span>
          <span className="text-xs text-text-muted">{selectedTheme.description}</span>
          <div className="ml-auto flex items-center gap-2">
            {selectedTheme.swatches.map((swatch) => (
              <span
                key={`${selectedTheme.id}-${swatch}`}
                className="h-4 w-4 rounded-full border border-border-default"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
