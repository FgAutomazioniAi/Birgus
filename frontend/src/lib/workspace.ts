const WORKSPACE_QUERY_PARAM = "workspaceId";

export function readCurrentWorkspaceId(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const fromBody = document.body?.dataset.workspaceId?.trim();
  if (fromBody) {
    return fromBody;
  }

  const fromRoot = document.documentElement?.dataset.workspaceId?.trim();
  return fromRoot || null;
}

export function appendWorkspaceId(url: string, workspaceId = readCurrentWorkspaceId()): string {
  const normalizedWorkspaceId = workspaceId?.trim();
  if (!normalizedWorkspaceId) {
    return url;
  }

  try {
    const baseOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(url, baseOrigin);
    if (!parsed.searchParams.has(WORKSPACE_QUERY_PARAM)) {
      parsed.searchParams.set(WORKSPACE_QUERY_PARAM, normalizedWorkspaceId);
    }

    if (url.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
