/* ==========================================================================
   projects.js — projects index page
   Renders projects/posts/*.md data (compiled into js/projects-data.js)
   in a document-style list layout with tag filtering.
   ========================================================================== */

(() => {
  'use strict';

  const list      = document.getElementById('projects-list');
  const filterBar = document.getElementById('filter-bar');
  if (!list) return;

  let activeFilter = 'all';

  // ---------------------------------------------------------------------------
  // Render a single project entry (document style)
  // ---------------------------------------------------------------------------
  function renderEntry(p) {
    const tags     = (p.tags || []).map(t =>
      `<li><button class="filter-btn filter-tag" data-filter="${t.toLowerCase()}">${t}</button></li>`
    ).join('');
    const roleLine = [
      p.role   ? `<span><strong>Rolle:</strong> ${escHtml(p.role)}</span>`   : '',
      p.period ? `<span><strong>Periode:</strong> ${escHtml(p.period)}</span>` : ''
    ].filter(Boolean).join('<span class="project-meta-sep" aria-hidden="true"> · </span>');

    return `
      <article class="project-entry reveal" data-tags="${(p.tags || []).join(',').toLowerCase()}" data-id="${p.id}">
        <h2 class="project-entry-title">${escHtml(p.title)}</h2>
        ${roleLine ? `<p class="project-entry-meta">${roleLine}</p>` : ''}
        <div class="project-entry-body">${p.contentHtml || `<p>${escHtml(p.excerpt || '')}</p>`}</div>
        <!-- tags hidden for now -->
      </article>`;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------------------
  // Filter bar
  // ---------------------------------------------------------------------------
  function buildFilterBar(projects) {
    if (!filterBar) return;
    const tagCounts = {};
    projects.forEach(p => (p.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }));
    const sorted = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = `Alle (${projects.length})`;
    allBtn.dataset.filter = 'all';
    filterBar.appendChild(allBtn);

    sorted.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = tag;
      btn.dataset.filter = tag.toLowerCase();
      filterBar.appendChild(btn);
    });

    // Filter bar clicks
    filterBar.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setFilter(btn.dataset.filter);
    });
  }

  function setFilter(f) {
    activeFilter = f;
    // Also update filter bar active state when clicking inline tags
    filterBar && filterBar.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === f);
    });
    applyFilter();
    // Scroll to top of list smoothly
    list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyFilter() {
    let anyVisible = false;
    list.querySelectorAll('.project-entry[data-id]').forEach(el => {
      const tags = el.dataset.tags || '';
      const show = activeFilter === 'all' || tags.split(',').includes(activeFilter);
      el.dataset.hidden = show ? 'false' : 'true';
      if (show) anyVisible = true;
    });
    const empty = list.querySelector('.projects-empty');
    if (empty) empty.style.display = anyVisible ? 'none' : 'block';
  }

  // Inline tag buttons inside entries also trigger filtering
  list.addEventListener('click', e => {
    const tagBtn = e.target.closest('.filter-tag');
    if (!tagBtn) return;
    setFilter(tagBtn.dataset.filter);
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init(projects) {
    // Build separators between entries
    const entriesHtml = projects.map((p, i) => {
      const sep = i < projects.length - 1
        ? `<hr class="project-divider" aria-hidden="true">`
        : '';
      return renderEntry(p) + sep;
    }).join('');

    list.innerHTML = entriesHtml + '<p class="projects-empty muted" style="display:none">Ingen prosjekter matcher dette filteret.</p>';

    buildFilterBar(projects);

    // Scroll reveal
    const entries = list.querySelectorAll('.project-entry.reveal');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      entries.forEach(el => io.observe(el));
    } else {
      entries.forEach(el => el.classList.add('is-visible'));
    }
  }

  if (window.PROJECTS_DATA && window.PROJECTS_DATA.length) {
    init(window.PROJECTS_DATA);
  } else {
    list.innerHTML = '<p class="muted">Ingen prosjekter funnet — sjekk at js/projects-data.js er lastet.</p>';
  }

})();
