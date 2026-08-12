"use client";

import { useEffect } from "react";

import { APP_ROUTES } from "@/lib/routes";

const AUTH_ERROR_CODES = new Set([
  "AUTH_SESSION_INVALID",
  "AUTH_TOKEN_REQUIRED",
  "AUTH_BEARER_INVALID",
]);

const isProtectedApiRequest = (input: RequestInfo | URL): boolean => {
  const requestUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return requestUrl.startsWith("/api/") || requestUrl.startsWith(`${window.location.origin}/api/`);
};

const withWorkspaceHeader = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  workspaceId: string,
): { input: RequestInfo | URL; init: RequestInit | undefined } => {
  if (!workspaceId.trim()) {
    return { input, init };
  }

  if (input instanceof Request) {
    if (input.headers.has("x-workspace-id")) {
      return { input, init };
    }

    const headers = new Headers(input.headers);
    headers.set("x-workspace-id", workspaceId);

    return {
      input: new Request(input, { headers }),
      init,
    };
  }

  const headers = new Headers(init?.headers);
  if (headers.has("x-workspace-id")) {
    return { input, init };
  }

  headers.set("x-workspace-id", workspaceId);

  return {
    input,
    init: {
      ...init,
      headers,
    },
  };
};

const redirectToLogin = () => {
  if (window.location.pathname !== APP_ROUTES.login) {
    window.location.replace(APP_ROUTES.login);
  }
};

const inspectUnauthorizedResponse = async (response: Response): Promise<void> => {
  if (response.status !== 401) {
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    redirectToLogin();
    return;
  }

  try {
    const payload = (await response.clone().json()) as { code?: string };
    if (!payload.code || AUTH_ERROR_CODES.has(payload.code)) {
      redirectToLogin();
    }
  } catch {
    redirectToLogin();
  }
};

export function AuthSessionGuard({ workspaceId }: { workspaceId: string }) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestWithWorkspace = isProtectedApiRequest(input)
        ? withWorkspaceHeader(input, init, workspaceId)
        : { input, init };
      const response = await originalFetch(requestWithWorkspace.input, requestWithWorkspace.init);

      if (isProtectedApiRequest(input)) {
        void inspectUnauthorizedResponse(response);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [workspaceId]);

  return null;
}
