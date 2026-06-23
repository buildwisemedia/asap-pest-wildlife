/* BWM canonical analytics loader — ASAP Pest & Wildlife
 * One loader for every page. Delayed (post-load) so tags never block first paint.
 * - GA4  : G-8M705Z89TE (standard gtag; the stale-property routing is a Google-side
 *          connected-destination handled separately, not here)
 * - Clarity : w91h0ljsbn
 * - Meta Pixel : 26350078141329630
 * Reddit pixel stays inline per page. The inline bwm-ga-gate script (run before this)
 * sets window['ga-disable-G-8M705Z89TE'] on localhost / *.pages.dev previews so GA4
 * does not record on non-production hosts.
 * Idempotent: __bwmAnalyticsLoaded guards against double-fire; the form also calls
 * window.__bwmLoadAnalytics() on submit. */
(function () {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  window.__bwmLoadAnalytics = function () {
    if (window.__bwmAnalyticsLoaded) return;
    window.__bwmAnalyticsLoaded = true;

    // GA4 (standard gtag)
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-8M705Z89TE';
    document.head.appendChild(ga);
    window.gtag('js', new Date());
    window.gtag('config', 'G-8M705Z89TE');

    // Microsoft Clarity
    (function (c, l, a, r, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/w91h0ljsbn';
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script');

    // Meta Pixel
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', '26350078141329630');
    window.fbq('track', 'PageView', {}, { eventID: 'pv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) });
  };

  var start = function () { setTimeout(window.__bwmLoadAnalytics, 7000); };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
