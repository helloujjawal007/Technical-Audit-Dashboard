/**
 * API utility for invoking Supabase edge functions with automatic
 * same-origin fallback if the remote function is not deployed or blocked by CORS.
 */

import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

interface InvokeOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  options: InvokeOptions = {}
): Promise<T> {
  const anonKey = supabaseAnonKey;
  const method = options.method || (options.body ? "POST" : "GET");

  const buildHeaders = (base?: Record<string, string>) => {
    const h: Record<string, string> = { ...base, ...options.headers };
    if (options.body && !h["Content-Type"]) {
      h["Content-Type"] = "application/json";
    }
    if (anonKey && !h["Authorization"]) {
      h["Authorization"] = `Bearer ${anonKey}`;
    }
    if (anonKey && !h["apikey"]) {
      h["apikey"] = anonKey;
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

      // If the function returned 404 (edge function not deployed yet to Supabase)
      // seamlessly fall back to same-origin handler
      if (res.status === 404) {
        console.warn(
          `[API] Supabase function "${functionName}" returned 404 (not deployed). Falling back to same-origin handler.`
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
      // If network error occurred (e.g. CORS preflight failed or function down),
      // seamlessly fall back to same-origin handler
      console.warn(
        `[API] Remote function "${functionName}" unreachable. Falling back to same-origin handler.`,
        err
      );
      return await callLocalEndpoint<T>(localEndpoint, method, options);
    }
  }

  // No remote endpoint configured — call same-origin directly
  return await callLocalEndpoint<T>(localEndpoint, method, options);
}

async function callLocalEndpoint<T>(
  endpoint: string,
  method: string,
  options: InvokeOptions
): Promise<T> {
  // Graceful fallback for get-ip if endpoint unreachable
  if (endpoint.includes("get-ip")) {
    try {
      const res = await fetch(endpoint, { method, headers: options.headers });
      if (res.ok) return (await res.json()) as T;
    } catch { /* fallback to random client id */ }
    return { ip: "guest-" + Math.floor(Math.random() * 1000000) } as T;
  }

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
      `Backend request to ${endpoint} failed (${res.status})`
    );
  }

  return (await res.json()) as T;
}
