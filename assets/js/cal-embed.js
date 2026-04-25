(function () {
  var calContainer = document.getElementById('cal-embed');
  if (!calContainer) return;
  var calNamespace = calContainer.dataset.calNamespace || 'consultation';
  var calLink = calContainer.dataset.calLink || 'asap-pest-wildlife/consultation';
  var calOrigin = calContainer.dataset.calOrigin || 'https://cal-asap.buildwisemedia.com';

  (function (C, A, L) {
    var p = function (a, ar) { a.q.push(ar); };
    var d = C.document;
    C.Cal = C.Cal || function () {
      var cal = C.Cal, ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement("script")).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        var api = function () { p(api, arguments); };
        var namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else {
          p(cal, ar);
        }
        return;
      }
      p(cal, ar);
    };
  })(window, "https://app.cal.com/embed/embed.js", "Cal");

  window.Cal("init", calNamespace, { origin: calOrigin });
  window.Cal.ns[calNamespace]("inline", {
    elementOrSelector: "#cal-embed",
    config: { layout: "month_view" },
    calLink: calLink,
  });
  window.Cal.ns[calNamespace]("ui", {
    cssVarsPerTheme: { light: { "cal-brand": "#B77537" } },
    hideEventTypeDetails: false,
    layout: "month_view"
  });

  var skeleton = calContainer.querySelector('.animate-pulse');
  if (skeleton) {
    var iframeObserver = new MutationObserver(function () {
      if (calContainer.querySelector('iframe')) {
        var skeletonWrap = calContainer.querySelector('.p-8');
        if (skeletonWrap) skeletonWrap.remove();
        iframeObserver.disconnect();
      }
    });
    iframeObserver.observe(calContainer, { childList: true, subtree: true });
    setTimeout(function () {
      var skeletonWrap = calContainer.querySelector('.p-8');
      if (skeletonWrap && skeletonWrap.parentNode) skeletonWrap.remove();
      iframeObserver.disconnect();
    }, 8000);
  }
})();
