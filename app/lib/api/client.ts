// Single API client for the FastAPI backend. Server-only.
// Imported from server components / route handlers; the JWT is minted from
// the NextAuth session (lib/api/jwt.ts) and passed in explicitly so this file
// stays free of NextAuth coupling.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set — cannot reach the backend",
    )
  }
  return url.replace(/\/+$/, "")
}

export interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  jwt?: string | null
  headers?: Record<string, string>
  // Cache control for server-fetch. Default no-store for live data.
  // Pass { revalidate: N } to enable ISR.
  next?: { revalidate?: number; tags?: string[] }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { jwt, headers, next, cache, ...rest } = options
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }
  if (jwt) finalHeaders.Authorization = `Bearer ${jwt}`
  if (rest.body && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json"
  }

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    cache: cache ?? (next ? undefined : "no-store"),
    next,
  })

  if (!res.ok) {
    let body: unknown = undefined
    try {
      body = await res.json()
    } catch {
      try {
        body = await res.text()
      } catch {
        // ignore — body unreadable
      }
    }
    throw new ApiError(res.status, `${res.status} ${formatBackendDetail(body, res.statusText)}`, body)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// FastAPI returns 422 validation errors as `{detail: [{type, loc, msg, ...}]}`.
// A naive `String(detail)` produces `[object Object]`, which is what users
// have been seeing in toasts. This helper unwraps the array into a
// human-readable summary so the UI can show "universe_scope: Field required"
// instead of "[object Object]". HTTPException errors (401/403/400) usually
// have `detail` as a plain string — those pass through unchanged.
function formatBackendDetail(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback
  const rec = body as Record<string, unknown>
  // {error: "..."} — Next proxy routes
  if (typeof rec.error === "string" && rec.error.length > 0) return rec.error
  const detail = rec.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => {
        if (typeof d !== "object" || d === null) return null
        const item = d as Record<string, unknown>
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((p) => p !== "body").join(".")
          : ""
        const msg = typeof item.msg === "string" ? item.msg : "invalid"
        return loc ? `${loc}: ${msg}` : msg
      })
      .filter((m): m is string => Boolean(m))
    if (msgs.length > 0) return msgs.join("; ")
  }
  return fallback
}
