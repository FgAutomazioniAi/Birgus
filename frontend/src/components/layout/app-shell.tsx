"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { AuthSessionGuard } from "@/components/auth/auth-session-guard";
import { Sidebar } from "@/components/organisms/sidebar";
import { TopNav } from "@/components/organisms/top-nav";

export interface AppShellProps {
  children: ReactNode;
  currentUser: {
    id: string;
    nome: string;
    ruolo: string;
    workspaceId: string;
    enabledModuleKeys: string[];
  };
}

export function AppShell({ children, currentUser }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-page" data-workspace-id={currentUser.workspaceId}>
      <AuthSessionGuard workspaceId={currentUser.workspaceId} />
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        enabledModuleKeys={currentUser.enabledModuleKeys}
        onClose={() => setSidebarOpen(false)}
      />

      <main
        className={[
          "flex min-w-0 flex-1 flex-col transition-all duration-300",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
        ].join(" ")}
      >
        <TopNav
          collapsed={sidebarCollapsed}
          currentUser={currentUser}
          onMenuClick={() => setSidebarOpen(true)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
        <div className="flex-1 overflow-auto p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
