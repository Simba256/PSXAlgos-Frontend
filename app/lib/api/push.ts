// Backend /push wrappers + types. Mirrors backend/app/schemas/push.py.
// Server-only — invoked from Next.js route handlers under app/api/push/.

import { apiFetch } from "./client";

export interface PushPublicKeyResponse {
  key: string | null;
}

export interface PushSubscribePayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
}

export async function getPushPublicKey(
  jwt: string,
): Promise<PushPublicKeyResponse> {
  return apiFetch<PushPublicKeyResponse>(`/push/public-key`, { jwt });
}

export async function subscribePush(
  jwt: string,
  payload: PushSubscribePayload,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/push/subscribe`, {
    jwt,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unsubscribePush(
  jwt: string,
  endpoint: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/push/unsubscribe`, {
    jwt,
    method: "POST",
    body: JSON.stringify({ endpoint }),
  });
}
