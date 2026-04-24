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
  const textSpan = rotator ? rotator.querySelector('.rotator-text') : null;
  if (rotator && textSpan) {
    const phrases = [
      'Microsoft 365',
      'Power Platform',
      'tools that solve real problems',
      'IT that actually ships'
    ];
    let i = 0;

    // Lock width to the widest phrase so the page never shifts on swap.
    const ghost = document.createElement('span');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = 'visibility:hidden;position:absolute;white-space:nowrap;font:inherit;letter-spacing:inherit;pointer-events:none';
    rotator.appendChild(ghost);
    const maxW = Math.max(...phrases.map(p => { ghost.textContent = p; return ghost.offsetWidth; }));
    rotator.removeChild(ghost);
    rotator.style.minWidth = maxW + 'px';

    setInterval(() => {
      i = (i + 1) % phrases.length;

      // Slide up + fade out
      textSpan.style.opacity = '0';
      textSpan.style.transform = 'translateY(-7px)';

      setTimeout(() => {
        textSpan.textContent = phrases[i];
        // Snap to below, invisible — no transition
        textSpan.style.transition = 'none';
        textSpan.style.transform = 'translateY(7px)';
        textSpan.style.opacity = '0';
        // Force reflow so the snap registers before we re-enable transition
        textSpan.offsetHeight;
        // Slide up into place + fade in
        textSpan.style.transition = 'opacity 180ms ease, transform 180ms ease';
        textSpan.style.opacity = '1';
        textSpan.style.transform = 'translateY(0)';
      }, 200);
    }, 3000);
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Project Carousel (home page) ---------- */
  // Renders project cards from projects.json into a sliding carousel
  const carouselEl = document.getElementById('projects-carousel');
  if (carouselEl) {
    const track = carouselEl.querySelector('.carousel-track');
    const dotsEl = carouselEl.querySelector('.carousel-dots');
    const btnPrev = carouselEl.querySelector('.carousel-btn-prev');
    const btnNext = carouselEl.querySelector('.carousel-btn-next');

    let projects = [];
    let currentIndex = 0;
    let autoPlayTimer = null;
    let visibleCount = 3;

    function getVisibleCount() {
      if (window.innerWidth <= 560) return 1;
      if (window.innerWidth <= 900) return 2;
      return 3;
    }

    function buildSvgThumb(index) {
      const svgs = [
        `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="80" fill="currentColor" opacity="0.06"/><rect x="20" y="14" width="36" height="52" rx="4" fill="currentColor" opacity="0.25"/><rect x="26" y="22" width="24" height="4" fill="currentColor" opacity="0.4"/><rect x="26" y="32" width="16" height="4" fill="currentColor" opacity="0.3"/><rect x="26" y="42" width="20" height="4" fill="currentColor" opacity="0.3"/><rect x="70" y="20" width="36" height="8" fill="currentColor" opacity="0.2"/><rect x="70" y="34" width="36" height="8" fill="currentColor" opacity="0.15"/><rect x="70" y="48" width="24" height="8" fill="currentColor" opacity="0.1"/></svg>`,
        `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="80" fill="currentColor" opacity="0.06"/><circle cx="24" cy="24" r="7" fill="currentColor" opacity="0.35"/><circle cx="60" cy="24" r="7" fill="currentColor" opacity="0.35"/><circle cx="96" cy="24" r="7" fill="currentColor" opacity="0.35"/><circle cx="42" cy="56" r="7" fill="currentColor" opacity="0.35"/><circle cx="78" cy="56" r="7" fill="currentColor" opacity="0.35"/><path d="M31 24 L53 24 M67 24 L89 24 M27 30 L38 50 M49 56 L71 56 M83 50 L92 30 M65 30 L45 50" stroke="currentColor" stroke-width="1.5" opacity="0.3"/></svg>`,
        `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="80" fill="currentColor" opacity="0.06"/><rect x="14" y="20" width="40" height="12" rx="6" fill="currentColor" opacity="0.2"/><rect x="66" y="36" width="40" height="12" rx="6" fill="currentColor" opacity="0.3"/><rect x="14" y="52" width="50" height="12" rx="6" fill="currentColor" opacity="0.2"/><circle cx="100" cy="22" r="6" fill="currentColor" opacity="0.4"/></svg>`,
        `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="80" fill="currentColor" opacity="0.06"/><rect x="10" y="30" width="20" height="40" rx="3" fill="currentColor" opacity="0.3"/><rect x="36" y="18" width="20" height="52" rx="3" fill="currentColor" opacity="0.25"/><rect x="62" y="24" width="20" height="46" rx="3" fill="currentColor" opacity="0.2"/><rect x="88" y="10" width="20" height="60" rx="3" fill="currentColor" opacity="0.35"/></svg>`
      ];
      return svgs[index % svgs.length];
    }

    function renderCard(p, idx) {
      const tags = (p.tags || []).slice(0, 4).map(t => `<li>${t}</li>`).join('');
      const meta = [p.role, p.period].filter(Boolean).join('  ·  ');
      const excerpt = p.excerpt || p.summary || '';
      return `
        <article class="project-card reveal">
          <div class="project-thumb" aria-hidden="true">${buildSvgThumb(idx)}</div>
          <div class="project-body">
            <h3>${p.title}</h3>
            ${meta ? `<p class="project-card-meta">${meta}</p>` : ''}
            <p>${excerpt}</p>
            <ul class="tag-list small">${tags}</ul>
            <div class="project-links">
              <a href="projects/index.html">Se alle prosjekter →</a>
            </div>
          </div>
        </article>`;
    }

    function renderDots() {
      if (!dotsEl) return;
      const total = projects.length;
      const steps = Math.max(1, total - visibleCount + 1);
      dotsEl.innerHTML = '';
      for (let i = 0; i < steps; i++) {
        const btn = document.createElement('button');
        btn.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
        btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
        btn.addEventListener('click', () => goTo(i));
        dotsEl.appendChild(btn);
      }
    }

    function updateDots() {
      dotsEl && dotsEl.querySelectorAll('.carousel-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentIndex);
      });
    }

    function updateButtons() {
      const maxIndex = Math.max(0, projects.length - visibleCount);
      if (btnPrev) btnPrev.disabled = currentIndex === 0;
      if (btnNext) btnNext.disabled = currentIndex >= maxIndex;
    }

    function goTo(idx) {
      const maxIndex = Math.max(0, projects.length - visibleCount);
      currentIndex = Math.max(0, Math.min(idx, maxIndex));
      const cardW = track.querySelector('.project-card');
      if (!cardW) return;
      const gap = 20; // 1.25rem ≈ 20px
      const cardWidth = cardW.offsetWidth + gap;
      track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
      updateDots();
      updateButtons();
    }

    function startAutoPlay() {
      stopAutoPlay();
      autoPlayTimer = setInterval(() => {
        const maxIndex = Math.max(0, projects.length - visibleCount);
        goTo(currentIndex >= maxIndex ? 0 : currentIndex + 1);
      }, 5000);
    }
    function stopAutoPlay() {
      if (autoPlayTimer) clearInterval(autoPlayTimer);
    }

    function init(data) {
      projects = data;
      visibleCount = getVisibleCount();
      track.innerHTML = data.map((p, i) => renderCard(p, i)).join('');

      // kick off scroll reveal for newly injected cards
      const newCards = track.querySelectorAll('.project-card.reveal');
      if ('IntersectionObserver' in window) {
        const io2 = new IntersectionObserver((entries) => {
          entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io2.unobserve(e.target); } });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
        newCards.forEach(el => io2.observe(el));
      } else {
        newCards.forEach(el => el.classList.add('is-visible'));
      }

      renderDots();
      updateButtons();
      goTo(0);
      startAutoPlay();

      carouselEl.addEventListener('mouseenter', stopAutoPlay);
      carouselEl.addEventListener('mouseleave', startAutoPlay);
      carouselEl.addEventListener('focusin', stopAutoPlay);
      carouselEl.addEventListener('focusout', startAutoPlay);

      if (btnPrev) btnPrev.addEventListener('click', () => { goTo(currentIndex - 1); startAutoPlay(); });
      if (btnNext) btnNext.addEventListener('click', () => { goTo(currentIndex + 1); startAutoPlay(); });

      window.addEventListener('resize', () => {
        const newVisible = getVisibleCount();
        if (newVisible !== visibleCount) {
          visibleCount = newVisible;
          renderDots();
          goTo(Math.min(currentIndex, Math.max(0, projects.length - visibleCount)));
        } else {
          goTo(currentIndex); // recalc pixel offset
        }
      });
    }

    // Data is loaded via <script src="js/projects-data.js"> — no fetch needed,
    // works with file:// and any server without CORS issues.
    if (window.PROJECTS_DATA && window.PROJECTS_DATA.length) {
      init(window.PROJECTS_DATA);
    } else {
      track.innerHTML = '<p class="muted" style="padding:1rem">No projects found — check js/projects-data.js is loaded.</p>';
    }
  }

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
