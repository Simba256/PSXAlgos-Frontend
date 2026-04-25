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
    const detail =
      typeof body === "object" && body && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : res.statusText
    throw new ApiError(res.status, `${res.status} ${detail}`, body)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
