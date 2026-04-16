// ASAP Pest & Wildlife — Main JS (v4.1 Visual Rework)

document.addEventListener('DOMContentLoaded', function() {

  // ============================================
  // Mobile Menu Toggle
  // ============================================
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = document.getElementById('menu-icon');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function() {
      mobileMenu.classList.toggle('hidden');
      const isOpen = !mobileMenu.classList.contains('hidden');
      if (isOpen) {
        menuIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      } else {
        menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
      }
    });
  }

  // ============================================
  // Contact Form Handler
  // ============================================
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      const successEl = document.getElementById('form-success');
      const errorEl = document.getElementById('form-error');
      const submitBtn = form.querySelector('button[type="submit"]');

      successEl.classList.add('hidden');
      errorEl.classList.add('hidden');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('https://leads.buildwisemedia.com/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          successEl.classList.remove('hidden');
          form.reset();
        } else {
          errorEl.classList.remove('hidden');
        }
      } catch (err) {
        errorEl.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    });
  }

  // ============================================
  // FAQ Accordion (About page)
  // ============================================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function(item) {
    const trigger = item.querySelector('.faq-trigger');
    if (trigger) {
      trigger.addEventListener('click', function() {
        // Close all other items
        faqItems.forEach(function(other) {
          if (other !== item) other.classList.remove('open');
        });
        // Toggle current
        item.classList.toggle('open');
      });
    }
  });

  // ============================================
  // Photo Gallery Slider (About page)
  // ============================================
  const sliderTrack = document.getElementById('about-slider');
  const sliderDots = document.querySelectorAll('.slider-dot');
  let currentSlide = 0;

  if (sliderTrack && sliderDots.length > 0) {
    function goToSlide(index) {
      currentSlide = index;
      sliderTrack.style.transform = 'translateX(-' + (index * 100) + '%)';
      sliderDots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === index);
      });
    }

    sliderDots.forEach(function(dot) {
      dot.addEventListener('click', function() {
        goToSlide(parseInt(dot.dataset.slide));
      });
    });

    // Auto-advance every 5s
    setInterval(function() {
      var next = (currentSlide + 1) % sliderDots.length;
      goToSlide(next);
    }, 5000);
  }

  // ============================================
  // Lightbox (Wildlife page photo gallery)
  // ============================================
  var lightboxOverlay = document.getElementById('lightbox-overlay');
  var lightboxImg = document.getElementById('lightbox-img');
  var lightboxTriggers = document.querySelectorAll('[data-lightbox]');

  if (lightboxOverlay && lightboxImg && lightboxTriggers.length > 0) {
    lightboxTriggers.forEach(function(trigger) {
      trigger.addEventListener('click', function() {
        lightboxImg.src = trigger.dataset.lightbox;
        lightboxOverlay.classList.add('active');
      });
    });

    lightboxOverlay.addEventListener('click', function(e) {
      if (e.target === lightboxOverlay || e.target.id === 'lightbox-close') {
        lightboxOverlay.classList.remove('active');
        lightboxImg.src = '';
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && lightboxOverlay.classList.contains('active')) {
        lightboxOverlay.classList.remove('active');
        lightboxImg.src = '';
      }
    });
  }

  // ============================================
  // "Other" type field toggle (form)
  // ============================================
  var issueSelect = document.getElementById('issue');
  var otherField = document.getElementById('other-type-wrapper');
  if (issueSelect && otherField) {
    issueSelect.addEventListener('change', function() {
      if (issueSelect.value === 'Other') {
        otherField.classList.remove('hidden');
      } else {
        otherField.classList.add('hidden');
      }
    });
  }

});
