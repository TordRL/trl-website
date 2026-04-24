/* ==========================================================================
   main.js — theme, nav, reveal on scroll, hero rotator, contact form
   ========================================================================== */

(() => {
  'use strict';

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const STORAGE_KEY = 'tord-theme';

  function getInitialTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) { /* ignore */ }
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) { /* ignore */ }
  }

  applyTheme(getInitialTheme());

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  /* ---------- Mobile nav ---------- */
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const open = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    navMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navMenu.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  const header = document.getElementById('site-header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Reveal on scroll ---------- */
  const revealTargets = document.querySelectorAll('.section, .hero-inner, .project-card, .post-item');
  revealTargets.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------- Hero rotator ---------- */
  const rotator = document.querySelector('.rotator');
  if (rotator) {
    const phrases = [
      'Power Platform solutions',
      'apps people actually use',
      'automations that save real hours',
      'Copilot Studio agents'
    ];
    let i = 0;
    const span = rotator.querySelector('span') || rotator;
    setInterval(() => {
      i = (i + 1) % phrases.length;
      span.style.opacity = '0';
      setTimeout(() => {
        span.textContent = phrases[i];
        span.style.opacity = '1';
      }, 200);
    }, 2600);
    span.style.transition = 'opacity 200ms ease';
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Contact form ---------- */
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  function setError(field, message) {
    const wrap = field.closest('.field');
    if (!wrap) return;
    wrap.classList.add('has-error');
    let err = wrap.querySelector('.error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'error';
      wrap.appendChild(err);
    }
    err.textContent = message;
  }
  function clearError(field) {
    const wrap = field.closest('.field');
    if (!wrap) return;
    wrap.classList.remove('has-error');
    const err = wrap.querySelector('.error');
    if (err) err.remove();
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  if (form && status) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.textContent = '';
      status.className = 'form-status';

      const name = form.elements.namedItem('name');
      const email = form.elements.namedItem('email');
      const message = form.elements.namedItem('message');
      const honeypot = form.elements.namedItem('website');

      let valid = true;
      [name, email, message].forEach(el => clearError(el));

      if (!name.value.trim()) { setError(name, 'Please enter your name.'); valid = false; }
      if (!email.value.trim() || !isValidEmail(email.value.trim())) {
        setError(email, 'Please enter a valid email.'); valid = false;
      }
      if (!message.value.trim() || message.value.trim().length < 5) {
        setError(message, 'Message is a bit short.'); valid = false;
      }

      if (honeypot && honeypot.value) {
        status.textContent = 'Thanks — your message has been sent.';
        status.classList.add('ok');
        form.reset();
        return;
      }

      if (!valid) {
        status.textContent = 'Please fix the highlighted fields.';
        status.classList.add('err');
        return;
      }

      const subject = encodeURIComponent('Contact from ' + name.value.trim());
      const body = encodeURIComponent(message.value.trim() + '\n\n— ' + name.value.trim() + ' (' + email.value.trim() + ')');
      window.location.href = 'mailto:tordrl@proton.me?subject=' + subject + '&body=' + body;

      status.textContent = 'Opening your email client…';
      status.classList.add('ok');
    });
  }

})();
