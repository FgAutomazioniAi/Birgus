"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const ModuleAccessContext = createContext<string[]>([]);

export function ModuleAccessProvider({
  children,
  enabledModuleKeys,
}: {
  children: ReactNode;
  enabledModuleKeys: string[];
}) {
  return (
    <ModuleAccessContext.Provider value={enabledModuleKeys}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

export function useModuleAccess() {
  const enabledModuleKeys = useContext(ModuleAccessContext);
  const hasModule = (moduleKey: string) => enabledModuleKeys.includes(moduleKey);
  return { enabledModuleKeys, hasModule };
}
