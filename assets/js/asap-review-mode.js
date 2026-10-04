/* All website previews are safe to try. Only the named live domains send leads. */
(function () {
  'use strict';
  if (['removeasap.com', 'www.removeasap.com'].includes(location.hostname)) return;
  window.__ASAP_WEBSITE_REVIEW = true;
  window['ga-disable-G-GQZJKG5JCK'] = true;
  // Capture before the older form handlers, so testing any page sends nothing.
  document.addEventListener('submit', function (event) {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var form = event.target;
    var status = form.querySelector('[data-form-status]');
    if (!status) {
      status = document.createElement('p');
      status.setAttribute('data-form-status', '');
      status.setAttribute('role', 'status');
      status.setAttribute('tabindex', '-1');
      form.appendChild(status);
    }
    status.textContent = 'Form check complete. No request was sent and no customer record was created.';
    form.dataset.fixtureResult = 'passed-no-send';
    status.focus();
  }, true);
  document.addEventListener('DOMContentLoaded', function () {
    var note = document.createElement('aside');
    note.className = 'asap-preview-note';
    note.setAttribute('aria-label', 'Website review');
    var link = document.createElement('a');
    link.href = '/website-review/';
    link.textContent = 'Full website review';
    note.append(link, document.createTextNode(' · Preview forms send nothing.'));
    document.body.prepend(note);
    document.documentElement.classList.add('asap-reviewing');
    var sizeNotice = function () {
      document.documentElement.style.setProperty('--asap-review-notice-height', note.offsetHeight + 'px');
      var header = document.querySelector('.site-header,.w-nav');
      var sticky = header && ['fixed', 'sticky'].includes(getComputedStyle(header).position);
      document.documentElement.style.setProperty('--asap-review-header-height', (sticky ? header.offsetHeight : 0) + 'px');
    };
    sizeNotice();
    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(sizeNotice);
      observer.observe(note);
      var header = document.querySelector('.site-header,.w-nav');
      if (header) observer.observe(header);
    }
    else window.addEventListener('resize', sizeNotice);
    document.querySelectorAll('form [type="submit"]').forEach(function (button) {
      if (button.closest('[data-no-bwm-lead-flow]')) return;
      if (button.hasAttribute('data-review-disable')) button.disabled = false;
      if (button.tagName === 'INPUT') button.value = 'Check form';
      else button.textContent = 'Check form';
    });
  });
})();
