// Browser-side Web Push helpers: service worker registration, permission,
// and PushManager subscribe/unsubscribe synced to the backend via the BFF
// routes under /api/push/. Client-only — never import from server code.

export type PushState =
  | "unsupported" // browser lacks SW/Push APIs, or backend has no VAPID key
  | "denied" // user blocked notifications in browser settings
  | "subscribed" // permission granted and an active subscription exists
  | "available"; // supported but not subscribed yet

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}

async function fetchVapidKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/public-key", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { key: string | null };
    return body.key;
  } catch {
    return null;
  }
}

// PushManager.subscribe wants the VAPID key as a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const key = await fetchVapidKey();
  if (!key) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") return "subscribed";
  } catch {
    // fall through to "available"
  }
  return "available";
}

export async function subscribeToPush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";

  const key = await fetchVapidKey();
  if (!key) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "available"; // dismissed the prompt

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription");
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
  if (!res.ok) {
    // Roll back the browser-side subscription so state stays consistent.
    await sub.unsubscribe().catch(() => undefined);
    throw new Error(`Subscription sync failed (HTTP ${res.status})`);
  }
  return "subscribed";
}

export async function unsubscribeFromPush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => undefined);
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => undefined); // backend prunes dead endpoints anyway
    }
  } catch {
    // Best-effort — worst case the backend prunes on next send.
  }
  return "available";
}
