/**
 * BWM Attribution Tracker
 * Captures UTM + click IDs from ad traffic, persists in a first-party
 * cookie, and injects into dataLayer, forms, and Cal.com embeds.
 * No external deps. No localStorage. Cookie-only (cross-subdomain).
 */
(function () {
  'use strict';

  var COOKIE = '_bwm_attribution';
  var PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

  function setCookie(data) {
    // Domain omitted — browser defaults to current host. Safe across all
    // BWM-built client sites without cross-origin cookie leaks.
    document.cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify(data)) +
      '; path=/; max-age=2592000; SameSite=Lax; Secure';
  }

  function getCookie() {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }

  function toQS(obj) {
    return Object.keys(obj).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]);
    }).join('&');
  }

  // --- Capture attribution params from URL ---
  var sp = new URLSearchParams(location.search);
  var attr = {};
  var found = false;
  PARAMS.forEach(function (p) {
    var v = sp.get(p);
    if (v) { attr[p] = v; found = true; }
  });

  if (found) {
    attr.landing_page = location.pathname;
    attr.landing_ts = new Date().toISOString();
    setCookie(attr);
  }

  // --- Form-mount timestamp + host-page URL (QLS Spam-Filter §4.3 + §4.5) ---
  // Stamped on every form regardless of attribution cookie presence. Enables
  // the form-handler to check (now - mount_ts) ≥3s for fill-time plausibility
  // and to match Referer header origin against the form's host page URL.
  function stampFormTiming(form) {
    if (!form.querySelector('input[name="_form_mount_at"]')) {
      var tsInp = document.createElement('input');
      tsInp.type = 'hidden';
      tsInp.name = '_form_mount_at';
      tsInp.value = String(Date.now());
      form.appendChild(tsInp);
    }
    if (!form.querySelector('input[name="_form_host_page"]')) {
      var urlInp = document.createElement('input');
      urlInp.type = 'hidden';
      urlInp.name = '_form_host_page';
      urlInp.value = window.location.href;
      form.appendChild(urlInp);
    }
  }
  document.querySelectorAll('form').forEach(stampFormTiming);

  // --- Meta Pixel cookies (_fbc click ID, _fbp browser ID) ---
  // Meta Pixel sets these first-party cookies; read raw and inject so the
  // server-side CAPI emit can dedup against browser Pixel events with the
  // highest-confidence match. No synthesis — Pixel owns the cookie lifecycle;
  // missing cookies mean Pixel isn't active and match falls back to em/ph/ip/ua.
  function getRawCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? m[1] : null;
  }
  var fbc = getRawCookie('_fbc');
  var fbp = getRawCookie('_fbp');
  function injectMetaCookies(form) {
    if (fbc && !form.querySelector('input[name="fbc"]')) {
      var i = document.createElement('input');
      i.type = 'hidden'; i.name = 'fbc'; i.value = fbc;
      form.appendChild(i);
    }
    if (fbp && !form.querySelector('input[name="fbp"]')) {
      var j = document.createElement('input');
      j.type = 'hidden'; j.name = 'fbp'; j.value = fbp;
      form.appendChild(j);
    }
  }
  document.querySelectorAll('form').forEach(injectMetaCookies);

  // --- Read cookie (just-set or pre-existing) ---
  var data = getCookie();
  if (!data) return;

  // --- Push to dataLayer for GTM ---
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'attribution_loaded', attribution: data });

  // --- Inject hidden inputs into all forms ---
  document.querySelectorAll('form').forEach(function (form) {
    Object.keys(data).forEach(function (key) {
      if (form.querySelector('input[name="' + key + '"]')) return;
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = key;
      inp.value = data[key];
      form.appendChild(inp);
    });
  });

  // --- Cal.com embed attribution injection ---
  var calEl = document.getElementById('cal-embed');
  if (!calEl) return;

  var qs = toQS(data);

  // Also tag the fallback direct-booking link
  var fbLink = document.querySelector('#cal-fallback a');
  if (fbLink && fbLink.href) {
    fbLink.href += (fbLink.href.indexOf('?') !== -1 ? '&' : '?') + qs;
  }

  // Strategy 1: Modify Cal queue before embed.js processes it.
  // The Cal loader pushes commands to Cal.q; embed.js drains the queue
  // on load. If embed.js hasn't loaded yet, we can patch calLink in-place.
  if (window.Cal && window.Cal.q) {
    for (var i = 0; i < window.Cal.q.length; i++) {
      var entry = window.Cal.q[i];
      if (entry[0] === 'inline' && entry[1] && entry[1].calLink) {
        entry[1].calLink += '?' + qs;
        return;
      }
    }
  }

  // Strategy 2: embed.js already ran — iframe exists
  var iframe = calEl.querySelector('iframe');
  if (iframe && iframe.src) {
    iframe.src += (iframe.src.indexOf('?') !== -1 ? '&' : '?') + qs;
    return;
  }

  // Strategy 3: embed.js ran but iframe not yet in DOM — observe
  var obs = new MutationObserver(function (muts) {
    for (var m = 0; m < muts.length; m++) {
      for (var n = 0; n < muts[m].addedNodes.length; n++) {
        var node = muts[m].addedNodes[n];
        if (node.tagName === 'IFRAME') {
          node.src += (node.src.indexOf('?') !== -1 ? '&' : '?') + qs;
          obs.disconnect();
          return;
        }
      }
    }
  });
  obs.observe(calEl, { childList: true, subtree: true });
})();

/**
 * BWM CAPI v2 — Browser-Mirror (M86 shadow-mode ship, 2026-04-24).
 * LOCKED design: projects/Project-CAPI-Server-Side-Worker.md § "v2 Design".
 *
 * Shadow mode: window.__BWM_CAPI_V2.enabled === false → all capiMirror()
 * calls no-op. Pages Function (/api/capi) also returns 204 unconditionally
 * until env.CAPI_V2_ENABLED flips. Two gates = flip server first, then
 * client, without a race.
 *
 * When enabled: generates crypto.randomUUID() eventID, tells Pixel via
 * fbq('track', name, data, {eventID}), mirrors same event_id to /api/capi
 * for server dispatch through bwm-capi-relay → Meta. Same event_id across
 * both paths lets Meta dedup within its 48h window.
 *
 * Exposes window.bwmCapiMirror(eventName, customData) for Lead/Schedule
 * dedup anchor use (form-handler returns capi_event_id in success JSON;
 * browser fires Pixel Lead with that ID, not a fresh UUID).
 */
(function () {
  'use strict';

  var cfg = window.__BWM_CAPI_V2 || { enabled: false };
  if (!cfg.enabled) return;  // shadow mode: exit silently

  var events = cfg.events || {};

  function getRawCookieV2(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? m[1] : null;
  }

  function capiMirror(eventName, customData, forcedEventID) {
    customData = customData || {};
    if (!events[eventName]) return null;  // event not enabled for this client

    var eventID = forcedEventID || (window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : (Date.now() + '-' + Math.random().toString(36).slice(2)));

    // 1. Tell Pixel (if loaded) — shared eventID is the dedup anchor
    if (typeof window.fbq === 'function') {
      try { window.fbq('track', eventName, customData, { eventID: eventID }); } catch (_) {}
    }

    // 2. Mirror to server — same-origin, fire-and-forget, keepalive for unload safety
    var payload = {
      event_name: eventName,
      event_id: eventID,
      event_time: Math.floor(Date.now() / 1000),
      user_data: {
        fbc: getRawCookieV2('_fbc') || undefined,
        fbp: getRawCookieV2('_fbp') || undefined
      },
      custom_data: customData,
      event_source_url: window.location.href
    };
    try {
      fetch('/api/capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify(payload)
      }).catch(function () { /* best-effort */ });
    } catch (_) { /* best-effort */ }

    return eventID;
  }

  window.bwmCapiMirror = capiMirror;

  // Auto-fire PageView on DOMContentLoaded if configured.
  if (events.PageView) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { capiMirror('PageView'); });
    } else {
      capiMirror('PageView');
    }
  }

  // Auto-fire Scroll at 75% depth if configured (debounced, fires once).
  if (events.Scroll) {
    var fired = false;
    window.addEventListener('scroll', function () {
      if (fired) return;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && (scrollTop / docHeight) >= 0.75) {
        fired = true;
        capiMirror('Scroll', { scroll_depth_pct: 75 });
      }
    }, { passive: true });
  }
})();
