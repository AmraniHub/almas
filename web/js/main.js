/* ============================================================
   AEON CONCIERGE — main.js
   ============================================================ */

(function () {
  'use strict';

  /* ---- NAVBAR SCROLL ---- */
  const navbar = document.getElementById('navbar');

  function onScroll() {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- REVEAL ON SCROLL ---- */
  const revealEls = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger siblings in the same parent
          const siblings = Array.from(
            entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')
          );
          const idx = siblings.indexOf(entry.target);
          const delay = Math.min(idx * 80, 400);

          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);

          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  revealEls.forEach((el) => revealObserver.observe(el));

  /* ---- AI BAR FILL ANIMATION ---- */
  const barFills = document.querySelectorAll('.match-fill');

  const barObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animation = 'barFill 1.4s cubic-bezier(0.22,1,0.36,1) forwards';
          barObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  barFills.forEach((el) => {
    el.style.animation = 'none';
    el.style.transform = 'scaleX(0)';
    barObserver.observe(el);
  });

  /* ---- MOBILE NAV TOGGLE ---- */
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks  = document.querySelector('.nav-links');
  const navCta    = document.querySelector('.nav-cta');

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('mobile-open');
      navCta && navCta.classList.toggle('mobile-open');

      const spans = navToggle.querySelectorAll('span');
      if (isOpen) {
        spans[0].style.transform = 'rotate(45deg) translate(4px, 4px)';
        spans[1].style.transform = 'rotate(-45deg) translate(4px, -4px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.transform = '';
      }
    });

    // Close on link click
    document.querySelectorAll('.nav-links a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        navCta && navCta.classList.remove('mobile-open');
        const spans = navToggle.querySelectorAll('span');
        spans[0].style.transform = '';
        spans[1].style.transform = '';
      });
    });
  }

  /* ---- INQUIRY FORM ---- */
  const form        = document.getElementById('inquiryForm');
  const formSuccess = document.getElementById('formSuccess');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const btn = form.querySelector('.form-btn');
      btn.textContent = 'Sending…';
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';

      // Save inquiry to localStorage → picked up by CRM
      const data = Object.fromEntries(new FormData(form));
      localStorage.setItem('aeon_new_inquiry', JSON.stringify(data));

      setTimeout(() => {
        form.classList.add('hidden');
        formSuccess.classList.add('active');
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1200);
    });
  }

  /* ---- SMOOTH ACTIVE NAV HIGHLIGHTING ---- */
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navAnchors.forEach((a) => {
            a.style.color =
              a.getAttribute('href') === `#${id}`
                ? 'var(--gold)'
                : '';
          });
        }
      });
    },
    { threshold: 0.4 }
  );

  sections.forEach((s) => sectionObserver.observe(s));

  /* ---- MOBILE NAV STYLES INJECTION ---- */
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      .nav-links.mobile-open {
        display: flex !important;
        flex-direction: column;
        position: fixed;
        top: 60px;
        left: 0;
        right: 0;
        background: rgba(10,10,14,0.98);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 2rem;
        gap: 1.5rem;
        border-bottom: 1px solid var(--border);
        z-index: 999;
      }
      .nav-cta.mobile-open {
        display: inline-flex !important;
        position: fixed;
        top: auto;
        left: 2rem;
        right: 2rem;
        bottom: 2rem;
        justify-content: center;
        z-index: 1001;
      }
    }
  `;
  document.head.appendChild(style);

  /* ---- CURSOR SUBTLE PARALLAX ON HERO ---- */
  const hero = document.getElementById('hero');
  const heroGradient = hero && hero.querySelector('.hero-gradient');

  if (heroGradient && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('mousemove', (e) => {
      const rx = (e.clientX / window.innerWidth  - 0.5) * 20;
      const ry = (e.clientY / window.innerHeight - 0.5) * 20;
      heroGradient.style.transform = `translate(${rx * 0.4}px, ${ry * 0.3}px)`;
    });
    hero.addEventListener('mouseleave', () => {
      heroGradient.style.transform = '';
    });
  }

})();
