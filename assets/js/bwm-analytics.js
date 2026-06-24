/* BWM canonical analytics loader - ASAP Pest & Wildlife
 * One loader for every page. Delayed after load so tags do not block first paint.
 * - GTM: GTM-K953HZ9R
 * - GA4: G-8M705Z89TE
 * - Clarity: w91h0ljsbn
 * - Meta Pixel: 26350078141329630
 * Reddit pixel stays inline on pages where the approved base already has it.
 * The inline bwm-ga-gate script runs before this loader and suppresses GA4 on
 * preview/staging + local dev hosts while production tracks normally.
 */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function loadAnalytics() {
    if (window.__bwmAnalyticsLoaded) return;
    window.__bwmAnalyticsLoaded = true;

    var hasGtmStarted = window.dataLayer.some(function (entry) {
      return entry && entry.event === 'gtm.js';
    });
    var hasGaConfig = window.dataLayer.some(function (entry) {
      return entry && entry[0] === 'config' && entry[1] === 'G-8M705Z89TE';
    });

    // Google Tag Manager
    if (!hasGtmStarted) {
      (function (w, d, s, l, i) {
        w[l] = w[l] || [];
        w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        var f = d.getElementsByTagName(s)[0];
        var j = d.createElement(s);
        var dl = l !== 'dataLayer' ? '&l=' + l : '';
        j.async = true;
        j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
        f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'dataLayer', 'GTM-K953HZ9R');
    }

    // GA4
    if (!hasGaConfig) {
      var ga = document.createElement('script');
      ga.async = true;
      ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-8M705Z89TE';
      document.head.appendChild(ga);
      window.gtag('js', new Date());
      window.gtag('config', 'G-8M705Z89TE');
    }

    // Microsoft Clarity
    (function (c, l, a, r, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/w91h0ljsbn';
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script');

    // Meta Pixel
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', '26350078141329630');
    window.fbq('track', 'PageView', {}, {
      eventID: 'pv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    });
  }

  try {
    Object.defineProperty(window, '__bwmLoadAnalytics', {
      value: loadAnalytics,
      writable: false,
      configurable: true
    });
  } catch (_) {
    window.__bwmLoadAnalytics = loadAnalytics;
  }

  var start = function () { setTimeout(loadAnalytics, 7000); };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
