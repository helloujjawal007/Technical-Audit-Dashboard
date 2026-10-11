/**
 * API utility for invoking Supabase edge functions with automatic
 * local development fallback if the remote function is not deployed (HTTP 404).
 */

interface InvokeOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const method = options.method || (options.body ? "POST" : "GET");

  const buildHeaders = (base?: Record<string, string>) => {
    const h: Record<string, string> = { ...base, ...options.headers };
    if (options.body && !h["Content-Type"]) {
      h["Content-Type"] = "application/json";
    }
    if (anonKey && !h["Authorization"]) {
      h["Authorization"] = `Bearer ${anonKey}`;
    }
    return h;
  };

  const remoteEndpoint = supabaseUrl
    ? `${supabaseUrl}/functions/v1/${functionName}`
    : null;
  const localEndpoint = `/functions/v1/${functionName}`;

  // If a remote Supabase URL is configured, try calling it first
  if (remoteEndpoint) {
    try {
      const res = await fetch(remoteEndpoint, {
        method,
        headers: buildHeaders(),
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      // If the function returned 404 (edge function not deployed yet)
      // and we are running in local dev / browser on the same host, fall back to local dev server
      if (res.status === 404 && (import.meta.env.DEV || window.location.hostname === "localhost")) {
        console.warn(
          `[API] Supabase function "${functionName}" returned 404 (not deployed to Supabase). Falling back to local backend handler.`
        );
        return await callLocalEndpoint<T>(localEndpoint, method, options);
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error ||
          errBody.message ||
          `Request to ${functionName} failed with status ${res.status}`
        );
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      // If network error occurred (e.g. CORS or offline) and we're in local dev, try local
      if (
        (import.meta.env.DEV || window.location.hostname === "localhost") &&
        err instanceof TypeError
      ) {
        console.warn(
          `[API] Network error reaching "${remoteEndpoint}". Falling back to local backend handler.`
        );
        return await callLocalEndpoint<T>(localEndpoint, method, options);
      }
      throw err;
    }
  }

  // No remote endpoint configured — call local directly
  return await callLocalEndpoint<T>(localEndpoint, method, options);
}

async function callLocalEndpoint<T>(
  endpoint: string,
  method: string,
  options: InvokeOptions
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(endpoint, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.error ||
      errBody.message ||
      `Local backend request to ${endpoint} failed (${res.status})`
    );
  }

  return (await res.json()) as T;
}
