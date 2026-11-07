import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";

// Private IPv4 and IPv6 CIDR matchers
const PRIVATE_IPV4_REGEX = [
  /^127\./, // 127.0.0.0/8 Loopback
  /^10\./, // 10.0.0.0/8 Private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 Private
  /^192\.168\./, // 192.168.0.0/16 Private
  /^169\.254\./, // 169.254.0.0/16 Link-local / AWS/GCP metadata
  /^0\./, // 0.0.0.0/8 Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^(22[4-9]|23[0-9]|24[0-9]|25[0-5])\./, // Multicast & Reserved
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data",
  "ip6-localhost",
  "ip6-loopback",
]);

/**
 * Checks if an IP string is private, loopback, link-local, or special-use.
 */
export function isPrivateIp(ip: string): boolean {
  let cleanIp = ip.trim();

  // Strip IPv6 brackets if present
  if (cleanIp.startsWith("[") && cleanIp.endsWith("]")) {
    cleanIp = cleanIp.slice(1, -1);
  }

  // IPv4 check
  if (net.isIPv4(cleanIp)) {
    if (cleanIp === "0.0.0.0" || cleanIp === "255.255.255.255") return true;
    return PRIVATE_IPV4_REGEX.some((re) => re.test(cleanIp));
  }

  // IPv6 check
  if (net.isIPv6(cleanIp)) {
    const norm = cleanIp.toLowerCase();
    // ::1 loopback and :: unspecified
    if (norm === "::1" || norm === "0:0:0:0:0:0:0:1" || norm === "::" || norm === "0:0:0:0:0:0:0:0") {
      return true;
    }
    // fe80::/10 link-local
    if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) {
      return true;
    }
    // fc00::/7 unique local (fc00:: - fdff::)
    if (norm.startsWith("fc") || norm.startsWith("fd")) {
      return true;
    }
    // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (norm.includes("ffff:")) {
      const rest = norm.split("ffff:")[1];
      if (rest) {
        if (net.isIPv4(rest)) {
          return isPrivateIp(rest);
        }
        const hexParts = rest.split(":");
        if (hexParts.length === 2) {
          const seg1 = parseInt(hexParts[0], 16);
          const seg2 = parseInt(hexParts[1], 16);
          if (!isNaN(seg1) && !isNaN(seg2)) {
            const mappedIp = `${(seg1 >> 8) & 255}.${seg1 & 255}.${(seg2 >> 8) & 255}.${seg2 & 255}`;
            return isPrivateIp(mappedIp);
          }
        }
      }
    }
  }

  return false;
}

/**
 * Parses alternative representations of IPv4 (decimal, hex, octal).
 */
export function parseAlternativeIp(raw: string): string | null {
  const clean = raw.trim().toLowerCase();

  // 1. Single 32-bit integer (e.g. 2130706433 or 0x7f000001)
  if (/^\d+$/.test(clean)) {
    const num = Number(clean);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;
    }
  }
  if (/^0x[0-9a-f]+$/i.test(clean)) {
    const num = parseInt(clean, 16);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;
    }
  }

  // 2. Dotted notation with octal/hex parts (e.g. 0177.0.0.1 or 0x7f.0.0.1)
  const segments = clean.split(".");
  if (segments.length === 4) {
    const parsedSegments: number[] = [];
    for (const seg of segments) {
      let val: number;
      if (/^0x[0-9a-f]+$/i.test(seg)) {
        val = parseInt(seg, 16);
      } else if (/^0[0-7]+$/.test(seg)) {
        val = parseInt(seg, 8);
      } else if (/^\d+$/.test(seg)) {
        val = parseInt(seg, 10);
      } else {
        return null;
      }
      if (isNaN(val) || val < 0 || val > 255) return null;
      parsedSegments.push(val);
    }
    return parsedSegments.join(".");
  }

  return null;
}

/**
 * Checks if a hostname directly matches a blocked/private target.
 */
export function isBlockedHostname(hostname: string): boolean {
  let lower = hostname.toLowerCase().trim();
  if (lower.startsWith("[") && lower.endsWith("]")) {
    lower = lower.slice(1, -1);
  }

  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".lan") || lower.endsWith(".corp")) {
    return true;
  }

  // Check if hostname is an IP directly
  if (net.isIP(lower)) {
    return isPrivateIp(lower);
  }

  // Check alternative IP forms (decimal, hex, octal)
  const altIp = parseAlternativeIp(lower);
  if (altIp) {
    return isPrivateIp(altIp);
  }

  return false;
}

/**
 * Resolves DNS for hostname and checks if any resolved IP is private.
 * Returns the first validated public IP for DNS rebinding protection.
 */
export async function resolvesToPrivateIp(hostname: string): Promise<{ isPrivate: boolean; validatedIp?: string }> {
  if (isBlockedHostname(hostname)) return { isPrivate: true };

  try {
    const results = await dns.lookup(hostname, { all: true });
    if (!results || results.length === 0) {
      return { isPrivate: false };
    }

    for (const record of results) {
      if (isPrivateIp(record.address)) {
        return { isPrivate: true };
      }
    }

    return { isPrivate: false, validatedIp: results[0].address };
  } catch {
    // If DNS resolution fails, it is not a reachable private host; let crawler handle DNS failure
    return { isPrivate: false };
  }
}

/**
 * Redacts secrets, tokens, and credentials from a URL for safe logging, persistence, and UI display.
 */
export function redactUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const u = new URL(rawUrl);
    if (u.username || u.password) {
      u.username = u.username ? "REDACTED" : "";
      u.password = u.password ? "REDACTED" : "";
    }
    for (const param of Array.from(u.searchParams.keys())) {
      if (/secret|token|key|auth|api_key|password|signature|pass|pwd|credential/i.test(param)) {
        u.searchParams.set(param, "REDACTED");
      }
    }
    return u.toString();
  } catch {
    return rawUrl.replace(/([?&](secret|token|key|auth|api_key|password|signature|pass|pwd|credential)=)[^&]*/gi, "$1REDACTED");
  }
}

/**
 * Validates target website URL against SSRF rules.
 */
export async function validateWebsiteUrl(urlStr: string): Promise<{ valid: boolean; error?: string; normalizedUrl?: string; validatedIp?: string }> {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "Website URL is required." };
  }

  let clean = urlStr.trim();
  if (clean.includes("://")) {
    let testParsed: URL;
    try {
      testParsed = new URL(clean);
    } catch {
      return { valid: false, error: "Invalid website URL format." };
    }
    if (testParsed.protocol !== "http:" && testParsed.protocol !== "https:") {
      return { valid: false, error: "Unsupported URL protocol. Only http: and https: are allowed." };
    }
  } else {
    clean = "https://" + clean;
  }

  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    return { valid: false, error: "Invalid website URL format." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Unsupported URL protocol. Only http: and https: are allowed." };
  }

  // Reject credentials in URLs
  if (parsed.username || parsed.password) {
    return { valid: false, error: "SSRF Protection: User credentials in URLs are not permitted." };
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname)) {
    return { valid: false, error: "SSRF Protection: Requests to localhost, private networks, or metadata endpoints are strictly forbidden." };
  }

  const { isPrivate, validatedIp } = await resolvesToPrivateIp(hostname);
  if (isPrivate) {
    return { valid: false, error: "SSRF Protection: Target domain resolves to a private or loopback IP address." };
  }

  return { valid: true, normalizedUrl: parsed.href, validatedIp };
}

/**
 * Validates callback URL against allowed OD endpoints.
 */
export function validateCallbackUrl(urlStr: string): { valid: boolean; error?: string; normalizedUrl?: string } {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, error: "Callback URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: "Invalid callback URL format." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Callback URL must use http: or https: protocol." };
  }

  // Reject credentials in callback URLs
  if (parsed.username || parsed.password) {
    return { valid: false, error: "SSRF Protection: User credentials in callback URL are not permitted." };
  }

  // Pin exact allowed callback URLs from server configuration (exact protocol, host, port, and path)
  const defaultAllowedEndpoints = [
    "http://localhost:5001/api/audit-callback",
    "http://127.0.0.1:5001/api/audit-callback",
    "http://localhost:5174/api/od/test-callback",
    "http://127.0.0.1:5174/api/od/test-callback",
  ];

  const envAllowed = (process.env.OD_CALLBACK_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\/+$/, ""))
    .filter(Boolean);

  const fullAllowlist = new Set([...defaultAllowedEndpoints.map((u) => u.toLowerCase().replace(/\/+$/, "")), ...envAllowed]);

  // Strip query parameters and trailing slash to evaluate canonical destination path
  const canonicalUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();

  if (!fullAllowlist.has(canonicalUrl)) {
    return {
      valid: false,
      error: `SSRF Security Violation: Callback URL path '${parsed.pathname}' on host '${parsed.host}' is not permitted by server configuration allowlist. Only exact pre-approved endpoints are allowed.`,
    };
  }

  // Return redacted URL without any confidential query params
  return { valid: true, normalizedUrl: redactUrl(parsed.href) };
}

/**
 * Performs a safe fetch with DNS rebinding protection, response-size cap (5MB), and redirect hop inspection.
 * Resolves DNS once, checks against private CIDRs, and connects directly to the validated IP.
 */
export const MAX_SAFE_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB cap (C12, Item 9)

export async function safeFetchWithSsrfCheck(
  targetUrl: string,
  options: RequestInit & { maxRedirects?: number; maxSizeBytes?: number; allowLocalhostForTesting?: boolean } = {}
): Promise<{ response: Response; finalUrl: string; redirectChain: string[] }> {
  const maxRedirects = options.maxRedirects ?? 5;
  const maxSizeBytes = options.maxSizeBytes ?? MAX_SAFE_RESPONSE_BYTES;
  let currentUrl = targetUrl;
  const redirectChain: string[] = [currentUrl];
  const visited = new Set<string>([currentUrl]);

  for (let i = 0; i <= maxRedirects; i++) {
    // 1. Validate URL and get pre-validated IP (DNS rebinding defense)
    let check = await validateWebsiteUrl(currentUrl);
    if (!check.valid) {
      if (options.allowLocalhostForTesting && (currentUrl.includes("localhost") || currentUrl.includes("127.0.0.1"))) {
        check = { valid: true, normalizedUrl: currentUrl, validatedIp: "127.0.0.1" };
      } else {
        throw new Error(check.error || "SSRF Protection: Invalid URL in redirect chain.");
      }
    }

    const parsed = new URL(currentUrl);
    const targetIp = check.validatedIp || parsed.hostname;

    // 2. Fetch using validated IP with manual redirect inspection
    // Enforce single-resolution binding and strict response size cap (5MB)
    let res: Response;
    if (check.validatedIp && net.isIP(check.validatedIp)) {
      // Connect to validated IP directly using node:https / node:http to enforce single-resolution binding
      res = await new Promise<Response>((resolve, reject) => {
        const isHttps = parsed.protocol === "https:";
        const transport = isHttps ? https : http;
        const port = parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80);

        const headers = { ...((options.headers as Record<string, string>) || {}) };
        if (!headers["Host"] && !headers["host"]) {
          headers["Host"] = parsed.host;
        }

        const req = transport.request(
          {
            hostname: targetIp,
            port,
            path: parsed.pathname + parsed.search,
            method: options.method || "GET",
            headers,
            servername: isHttps ? parsed.hostname : undefined, // SNI for TLS verification
            signal: options.signal as AbortSignal | undefined,
          },
          (nodeRes) => {
            const chunks: Buffer[] = [];
            let totalBytes = 0;

            nodeRes.on("data", (chunk) => {
              totalBytes += chunk.length;
              if (totalBytes <= maxSizeBytes) {
                chunks.push(Buffer.from(chunk));
              } else {
                // Response exceeded size cap: truncate and stop reading
                const remaining = maxSizeBytes - (totalBytes - chunk.length);
                if (remaining > 0) {
                  chunks.push(Buffer.from(chunk).subarray(0, remaining));
                }
                nodeRes.destroy();
              }
            });

            let isResolved = false;
            const finish = () => {
              if (isResolved) return;
              isResolved = true;
              const bodyBuffer = Buffer.concat(chunks);
              const headerMap = new Headers();
              for (const [k, v] of Object.entries(nodeRes.headers)) {
                if (Array.isArray(v)) {
                  v.forEach((val) => headerMap.append(k, val));
                } else if (v) {
                  headerMap.set(k, v);
                }
              }
              const webResponse = new Response(bodyBuffer, {
                status: nodeRes.statusCode || 200,
                statusText: nodeRes.statusMessage || "OK",
                headers: headerMap,
              });
              resolve(webResponse);
            };

            nodeRes.on("end", finish);
            nodeRes.on("close", finish);
          }
        );

        req.on("error", (err) => reject(err));
        if (options.body) {
          req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
        }
        req.end();
      });
    } else {
      res = await fetch(currentUrl, {
        ...options,
        redirect: "manual",
      });
    }

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");

    if (isRedirect && location) {
      if (i >= maxRedirects) {
        throw new Error(`Redirect loop detected: Exceeded maximum of ${maxRedirects} redirects.`);
      }

      const nextUrl = new URL(location, currentUrl).href;
      if (visited.has(nextUrl)) {
        throw new Error(`Redirect loop detected: Circular redirect back to ${nextUrl}.`);
      }

      visited.add(nextUrl);
      redirectChain.push(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    return { response: res, finalUrl: currentUrl, redirectChain };
  }

  throw new Error(`Exceeded maximum of ${maxRedirects} redirects.`);
}
