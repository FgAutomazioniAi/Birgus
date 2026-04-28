import { NextResponse } from "next/server";

const DEFAULT_DDT_READER_API_BASE_URL = "http://ddt_reader_api:8000/api";

const getDdtReaderApiBaseUrl = () =>
  (process.env.DDT_READER_API_BASE_URL ?? DEFAULT_DDT_READER_API_BASE_URL).replace(/\/$/, "");

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const readBackendPayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
};

export interface ProxyDdtReaderRequestOptions {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: "GET" | "POST" | "DELETE";
  path: string;
  timeoutMs?: number;
}

export async function proxyDdtReaderRequest({
  body = null,
  headers,
  method = "GET",
  path,
  timeoutMs = 60000,
}: ProxyDdtReaderRequestOptions): Promise<NextResponse> {
  const backendUrl = `${getDdtReaderApiBaseUrl()}${normalizePath(path)}`;

  try {
    const response = await fetch(backendUrl, {
      method,
      body,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const payload = await readBackendPayload(response);

    if (payload === null) {
      return new NextResponse(null, { status: response.status });
    }

    if (typeof payload === "string") {
      return new NextResponse(payload, {
        status: response.status,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        message:
          "Servizio DDT Reader non raggiungibile. Verifica il backend in ascolto su DDT_READER_API_BASE_URL.",
      },
      { status: 502 },
    );
  }
}
