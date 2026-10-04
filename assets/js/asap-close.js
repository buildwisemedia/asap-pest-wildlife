(function () {
  "use strict";

  const root = document.documentElement;
  const liveHost = ["removeasap.com", "www.removeasap.com"].includes(window.location.hostname);
  const reviewOnly = !liveHost || root.dataset.buildState === "local-review";

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (char) {
      const value = Math.random() * 16 | 0;
      const next = char === "x" ? value : (value & 0x3 | 0x8);
      return next.toString(16);
    });
  }

  function queryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function setField(form, name, value) {
    const field = form.elements.namedItem(name);
    if (field && !field.value) field.value = value;
  }

  function contextFor(form) {
    return {
      event_name: "lead_intent",
      event_id: form.elements.namedItem("lead_id").value,
      source_page: form.dataset.sourcePage,
      page_type: form.dataset.pageType,
      service: form.dataset.service || "",
      city: form.dataset.city || "",
      integration_state: form.dataset.integrationState,
      consent_sms: Boolean(form.elements.namedItem("sms_consent").checked)
    };
  }

  document.querySelectorAll("[data-asap-lead-form]").forEach(function (form) {
    const submit = form.querySelector("[data-fixture-submit]");
    const fixtureOnly = form.dataset.integrationState === "fixture-only";
    const liveForm = form.dataset.integrationState === "live" && liveHost && !reviewOnly;
    if (!(reviewOnly && fixtureOnly) && !liveForm) {
      if (submit) submit.disabled = true;
      return;
    }
    if (submit) submit.disabled = false;
    setField(form, "lead_id", uuid());
    setField(form, "source_page", form.dataset.sourcePage);
    setField(form, "utm_source", queryValue("utm_source"));
    setField(form, "utm_medium", queryValue("utm_medium"));
    setField(form, "utm_campaign", queryValue("utm_campaign"));
    setField(form, "gclid", queryValue("gclid"));
    setField(form, "fbclid", queryValue("fbclid"));

    form.addEventListener("focusin", function () {
      if (form.dataset.started === "true") return;
      form.dataset.started = "true";
      const detail = { ...contextFor(form), event_name: "form_start" };
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(detail);
      window.dispatchEvent(new CustomEvent("asap:form-start", { detail }));
    });

    form.addEventListener("invalid", function () {
      if (!reviewOnly) return;
      const status = form.querySelector("[data-form-status]");
      if (status) status.textContent = "Please complete the required fields. Nothing has been sent.";
      form.dataset.fixtureResult = "validation-error-no-send";
    }, true);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (form.dataset.sending === "true") return;
      const status = form.querySelector("[data-form-status]");
      if (!form.checkValidity()) {
        form.reportValidity();
        if (status) status.textContent = "Please complete the required fields. Nothing has been sent.";
        form.dataset.fixtureResult = "validation-error-no-send";
        return;
      }

      if (liveForm) {
        const payload = Object.fromEntries(new FormData(form));
        payload.client_slug = "asap-pest-wildlife";
        payload.formType = "contact";
        payload.formSource = "asap-website";
        payload.source_page = form.dataset.sourcePage;
        payload.source_form_type = form.dataset.sourcePage;
        payload.page_url = window.location.href;
        payload.submission_page = window.location.pathname;
        payload.referrer = document.referrer || "";
        payload.service = form.dataset.service;
        payload.city = form.dataset.city;
        payload.Issue = payload.issue;
        payload.message = payload.details;
        payload.sms_consent = Boolean(form.elements.namedItem("sms_consent").checked);
        form.dataset.sending = "true";
        submit.disabled = true;
        status.textContent = "Sending your request…";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch("https://bwm-form-handler.robert-ba0.workers.dev/submit", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload), signal: controller.signal
          });
          const result = await response.json();
          if (!response.ok || result.ok !== true || result.filtered || result.test_mode) throw new Error("Request not accepted");
          status.textContent = "Thank you. Your request has been received. The ASAP team will contact you about the next step.";
          form.reset();
          setField(form, "lead_id", uuid());
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: "lead_form_submit", client_slug: payload.client_slug,
            source_page: payload.source_page, page_type: form.dataset.pageType,
            service: payload.service, city: payload.city, event_id: result.capi_event_id || payload.lead_id });
          if (typeof window.fbq === "function" && result.capi_event_id) {
            window.fbq("track", "Lead", { client_slug: payload.client_slug }, { eventID: result.capi_event_id });
          }
        } catch (_) {
          status.textContent = "We could not confirm your request. Your details are still here. Try again, or call 770-691-3636.";
        } finally {
          clearTimeout(timeout);
          form.dataset.sending = "false";
          submit.disabled = false;
          status.focus();
        }
        return;
      }
      const detail = contextFor(form);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(detail);
      window.__ASAP_LAST_LEAD_FIXTURE = detail;
      window.dispatchEvent(new CustomEvent("asap:lead-intent", { detail }));
      if (status) {
        status.textContent = "Form check complete. No request was sent and no customer record was created.";
        status.focus();
      }
      form.dataset.fixtureResult = "passed-no-send";
    });
  });

  document.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
    link.addEventListener("click", function () {
      const detail = {
        event_name: "phone_click",
        source_page: window.location.pathname,
        phone: "+17706913636",
        build_state: reviewOnly ? "local-review" : "production"
      };
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(detail);
      window.dispatchEvent(new CustomEvent("asap:phone-click", { detail }));
    });
  });
})();


// Close the shared animal/article menu before following an in-page destination.
(function () {
  "use strict";
  const routes = new Set([
    "/rodent-removal/",
    "/wildlife/mouse-rat/",
    "/wildlife/gray-squirrel/",
    "/wildlife/raccoon/",
    "/wildlife/bats/"
  ]);
  const path = window.location.pathname.replace(/\/index\.html$/, "/");
  if (!routes.has(path) && !path.startsWith("/blog/") && path !== "/website-review/") return;
  const menu = document.querySelector(".site-header details.mobile-nav");
  if (!menu) return;

  document.addEventListener("click", function (event) {
    if (!menu.open || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") ||
        (link.target && link.target !== "_self")) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin ||
        destination.pathname !== window.location.pathname ||
        destination.search !== window.location.search || !destination.hash) return;
    let id;
    try {
      id = decodeURIComponent(destination.hash.slice(1));
    } catch (_) {
      return;
    }
    if (!document.getElementById(id)) return;
    // Close before native fragment navigation calculates the scroll position.
    // Preserve the link's normal hash, browser history, and keyboard behavior.
    menu.open = false;
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !menu.open || event.defaultPrevented) return;
    menu.open = false;
    menu.querySelector("summary").focus();
    event.preventDefault();
  });
})();
