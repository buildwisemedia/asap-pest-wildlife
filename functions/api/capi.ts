/**
 * Cloudflare Pages Function — BWM CAPI v2 browser-mirror ingress.
 *
 * LOCKED design: projects/Project-CAPI-Server-Side-Worker.md § "v2 Design".
 * Shipped M86 (2026-04-24) in shadow mode (env.CAPI_V2_ENABLED !== "true"
 * short-circuits with 204). attribution.js also gates on window.__BWM_CAPI_V2
 * — defense in depth so server can be flipped live before any client traffic
 * without a race.
 *
 * Per-Pages-project env vars (set via CF dashboard → Pages → Settings):
 *   CAPI_V2_ENABLED   — "true" to activate; anything else → 204 shadow path.
 *   CLIENT_SLUG       — Supabase slug for this client (e.g. "design2sell").
 *   BWM_INTERNAL_KEY  — 64-char hex secret shared with bwm-capi-relay.
 *   CAPI_RELAY_URL    — optional; defaults to the canonical relay URL.
 *
 * Flow when enabled:
 *   Browser → POST /api/capi (same-origin, no CORS)
 *   Function validates payload, enriches with IP/UA, forwards to
 *   bwm-capi-relay with X-BWM-Internal-Key. Browser always gets 202.
 *   Relay handles Meta dispatch + capi_events persistence.
 */

interface Env {
  CAPI_V2_ENABLED?: string;
  CLIENT_SLUG?: string;
  BWM_INTERNAL_KEY?: string;
  CAPI_RELAY_URL?: string;
}

interface BrowserEvent {
  event_name: string;
  event_id: string;
  event_time?: number;
  user_data?: {
    em?: string;
    ph?: string;
    fbc?: string;
    fbp?: string;
    external_id?: string;
    client_ip_address?: string;
    client_user_agent?: string;
  };
  custom_data?: Record<string, unknown>;
  event_source_url?: string;
}

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'Schedule',
  'Scroll',
]);

const UUID_RE = /^[0-9a-f-]{36}$/i;
const DEFAULT_RELAY = 'https://bwm-capi-relay.robert-ba0.workers.dev';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Shadow-mode gate: server-side kill switch takes priority over any
  // client-side config. Browser receives 204 = "got it, nothing to do."
  if (env.CAPI_V2_ENABLED !== 'true') {
    return new Response(null, { status: 204 });
  }

  // Config sanity — if activated without slug + key, fail loud in logs
  // but still 202 to the browser (don't leak config state to callers).
  if (!env.CLIENT_SLUG || !env.BWM_INTERNAL_KEY) {
    console.log(JSON.stringify({
      fn: 'api/capi',
      error: 'config_missing',
      has_slug: Boolean(env.CLIENT_SLUG),
      has_key: Boolean(env.BWM_INTERNAL_KEY),
    }));
    return new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: BrowserEvent;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid_json', { status: 400 });
  }

  if (!body || !ALLOWED_EVENTS.has(body.event_name)) {
    return new Response('event_not_allowed', { status: 400 });
  }

  if (!body.event_id || !UUID_RE.test(body.event_id)) {
    return new Response('invalid_event_id', { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const ua = request.headers.get('User-Agent') ?? '';
  body.user_data = {
    ...(body.user_data ?? {}),
    client_ip_address: ip,
    client_user_agent: ua,
  };
  body.event_time = body.event_time ?? Math.floor(Date.now() / 1000);

  const relay = env.CAPI_RELAY_URL ?? DEFAULT_RELAY;
  try {
    await fetch(`${relay}/events/${env.CLIENT_SLUG}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BWM-Internal-Key': env.BWM_INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.log(JSON.stringify({
      fn: 'api/capi',
      slug: env.CLIENT_SLUG,
      event: body.event_name,
      event_id: body.event_id,
      error: String(e),
    }));
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
};
