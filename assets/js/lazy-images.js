/* Load below-the-fold images only when visitors are close to seeing them. */
(function () {
  'use strict';

  var images = Array.prototype.slice.call(
    document.querySelectorAll('img[data-bwm-lazy-src], source[data-bwm-lazy-srcset]')
  );
  var interactionDeferredSelector = [
    '.home-pests-image',
    '.home-rodent-image',
    '.home-rodent-image-2',
    '.home-beaver-image',
    '.home-bee-image',
    '.home-bee-image-2',
    '.home-more-image',
    '.home-more-image-2'
  ].join(',');
  var interactionImages = [];

  function restore(node) {
    if (node.dataset.bwmLazySrc) {
      node.src = node.dataset.bwmLazySrc;
      delete node.dataset.bwmLazySrc;
    }
    if (node.dataset.bwmLazySrcset) {
      node.srcset = node.dataset.bwmLazySrcset;
      delete node.dataset.bwmLazySrcset;
    }
    if (node.dataset.bwmLazySizes) {
      node.sizes = node.dataset.bwmLazySizes;
      delete node.dataset.bwmLazySizes;
    }
  }

  function loadPicture(node) {
    var picture = node.closest && node.closest('picture');
    if (picture) {
      Array.prototype.forEach.call(
        picture.querySelectorAll('source[data-bwm-lazy-srcset]'),
        restore
      );
    }
    restore(node);
  }

  if (!('IntersectionObserver' in window)) {
    images.forEach(loadPicture);
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      loadPicture(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px' });

  images.forEach(function (node) {
    if (node.tagName === 'SOURCE') return;
    if (node.matches(interactionDeferredSelector)) {
      interactionImages.push(node);
      return;
    }
    observer.observe(node);
  });

  function loadInteractionImages() {
    interactionImages.forEach(loadPicture);
    interactionImages = [];
  }

  ['pointerdown', 'touchstart', 'keydown'].forEach(function (eventName) {
    window.addEventListener(eventName, loadInteractionImages, {
      once: true,
      passive: true
    });
  });
  window.addEventListener('load', function () {
    setTimeout(loadInteractionImages, 6000);
  }, { once: true });
  Array.prototype.forEach.call(
    document.querySelectorAll('.home-animals-tab-link-2'),
    function (link) {
      link.addEventListener('mouseenter', loadInteractionImages, { once: true });
    }
  );

  var backgrounds = document.querySelectorAll('[data-bwm-lazy-background]');
  var backgroundObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('bwm-background-ready');
      backgroundObserver.unobserve(entry.target);
    });
  }, { rootMargin: '200px 0px' });

  Array.prototype.forEach.call(backgrounds, function (node) {
    backgroundObserver.observe(node);
  });
})();
