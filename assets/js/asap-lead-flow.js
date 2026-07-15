/**
 * ASAP lead-flow fallback handler.
 *
 * The Webflow-source pages mostly bind their own BWM submit handler. This file
 * catches any remaining Webflow-style forms so every ASAP form uses the same
 * supported bwm-form-handler contract: client_slug=asap-pest-wildlife and
 * formType=contact.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://bwm-form-handler.robert-ba0.workers.dev/submit';
  var CLIENT_SLUG = 'asap-pest-wildlife';

  function serialize(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements || [], function (el) {
      if (!el.name || el.disabled) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function closestFormWrap(form) {
    return typeof form.closest === 'function' ? form.closest('.w-form') : form.parentElement;
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.style.display = visible ? 'block' : 'none';
  }

  function fireLeadEvents(result, sourceFormType) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'lead_form_submit',
      client_slug: CLIENT_SLUG,
      formType: 'contact',
      source_form_type: sourceFormType
    });

    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', 'generate_lead', {
          event_category: 'lead',
          event_label: sourceFormType || 'contact_form'
        });
      } catch (_) {}
    }

    if (typeof window.__bwmLoadAnalytics === 'function') {
      try { window.__bwmLoadAnalytics(); } catch (_) {}
    }

    if (typeof window.fbq === 'function') {
      try {
        var options = result && result.capi_event_id ? { eventID: result.capi_event_id } : undefined;
        window.fbq('track', 'Lead', {
          content_name: sourceFormType || 'contact_form',
          client_slug: CLIENT_SLUG
        }, options);
      } catch (_) {}
    }
  }

  function bindForm(form) {
    if (!form || form.__bwmBound || form.__asapLeadFlowBound) return;
    if (form.hasAttribute('data-no-bwm-lead-flow')) return;
    form.__asapLeadFlowBound = true;

    form.addEventListener('submit', async function (event) {
      // preventDefault only — Webflow's own submit handler must still run so
      // the lead also lands in the client's Webflow submissions (their
      // automation chain hangs off it). Same contract as the per-page
      // homepage-reference scripts.
      event.preventDefault();

      var submit = form.querySelector('[type="submit"]');
      var wrap = closestFormWrap(form);
      var done = wrap && wrap.querySelector('.w-form-done');
      var fail = wrap && wrap.querySelector('.w-form-fail');

      setVisible(done, false);
      setVisible(fail, false);
      if (submit) submit.disabled = true;

      var payload = serialize(form);
      if (payload.website || payload.company_url) {
        form.reset();
        if (submit) submit.disabled = false;
        return;
      }

      var sourceFormType = payload.formType || form.getAttribute('data-bwm-source-form-type') || location.pathname;
      payload.client_slug = CLIENT_SLUG;
      payload.source_form_type = sourceFormType;
      payload.formType = 'contact';
      payload.formSource = 'asap-lead-flow-fallback';
      payload.referrer = payload.referrer || document.referrer || '';
      payload.landing_page = payload.landing_page || location.href;

      try {
        var response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var result = {};
        try { result = await response.json(); } catch (_) {}

        if (!response.ok) throw new Error('Form submit failed');
        fireLeadEvents(result, sourceFormType);
        setVisible(done, true);
        form.reset();
      } catch (_) {
        setVisible(fail, true);
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  // Homepage hides the "Type other" input until the Issue dropdown is set to
  // "Other" (a homepage-only Webflow interaction). Replicate that behavior on
  // every page so all forms look and act like the homepage form.
  function bindOthersToggle(form) {
    var sel = form.querySelector('select[name="Issue"]');
    var other = form.querySelector('input[name="Others_Input"]');
    if (!sel || !other || form.__bwmOthersBound) return;
    form.__bwmOthersBound = true;
    var sync = function () {
      other.style.display = /^other$/i.test(sel.value) ? 'block' : 'none';
    };
    sel.addEventListener('change', sync);
    sync();
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('form'), function (form) {
      bindForm(form);
      bindOthersToggle(form);
    });
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
