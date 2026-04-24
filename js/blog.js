/* ==========================================================================
   blog.js — tiny markdown blog loader
   - Reads blog/posts/posts.json for the post index
   - Renders post lists on the home teaser and on blog/index.html
   - Renders a single post on blog/post.html?slug=<slug>
   - Uses marked.js via CDN if available; otherwise falls back to basic rendering
   ========================================================================== */

(() => {
  'use strict';

  // Resolve paths whether we're at / or /blog/
  function postsIndexUrl() {
    return isBlogArea() ? 'posts/posts.json' : 'blog/posts/posts.json';
  }
  function postFileUrl(file) {
    return isBlogArea() ? `posts/${file}` : `blog/posts/${file}`;
  }
  function isBlogArea() {
    return /\/blog\//.test(window.location.pathname);
  }
  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (_) { return iso; }
  }

  async function loadIndex() {
    // Prefer the preloaded script-tag data (works on file:// with no server).
    // Falls back to fetching posts.json when running on a proper server.
    let data;
    if (window.BLOG_POSTS && window.BLOG_POSTS.length) {
      data = window.BLOG_POSTS;
    } else {
      const res = await fetch(postsIndexUrl(), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      data = await res.json();
    }
    // Sort newest first
    data.sort((a, b) => new Date(b.date) - new Date(a.date));
    return data;
  }

  function postUrl(slug) {
    return isBlogArea() ? `post.html?slug=${encodeURIComponent(slug)}` : `blog/post.html?slug=${encodeURIComponent(slug)}`;
  }

  function renderPostList(container, posts, limit) {
    const items = (limit ? posts.slice(0, limit) : posts).map(p => `
      <a class="post-item" href="${postUrl(p.slug)}">
        <time datetime="${p.date}">${formatDate(p.date)}</time>
        <div>
          <h3>${escapeHTML(p.title)}</h3>
          ${p.summary ? `<p class="muted">${escapeHTML(p.summary)}</p>` : ''}
        </div>
        <span class="post-arrow" aria-hidden="true">→</span>
      </a>
    `).join('');
    container.innerHTML = items || '<p class="muted">No posts yet.</p>';
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ----- Minimal markdown fallback (used only if marked.js isn't loaded) ----- */
  function fallbackMarkdown(md) {
    // Strip front matter
    md = md.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const lines = md.split('\n');
    let html = '';
    let inList = false;
    let inCode = false;
    let codeBuf = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        if (inCode) {
          html += `<pre><code>${escapeHTML(codeBuf.join('\n'))}</code></pre>`;
          codeBuf = []; inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      if (/^#{1,6}\s/.test(line)) {
        const level = line.match(/^#+/)[0].length;
        const text = line.replace(/^#+\s/, '');
        html += `<h${level}>${inline(text)}</h${level}>`;
        continue;
      }
      if (/^\s*-\s+/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${inline(line.replace(/^\s*-\s+/, ''))}</li>`;
        continue;
      } else if (inList) {
        html += '</ul>'; inList = false;
      }
      if (/^>\s?/.test(line)) {
        html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`;
        continue;
      }
      if (line.trim() === '') { html += ''; continue; }
      html += `<p>${inline(line)}</p>`;
    }
    if (inList) html += '</ul>';
    return html;

    function inline(s) {
      let out = escapeHTML(s);
      out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
      out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
      return out;
    }
  }

  function parseFrontMatter(src) {
    const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
    const meta = {};
    if (!m) return { meta, body: src };
    m[1].split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      const k = line.slice(0, idx).trim();
      let v = line.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      meta[k] = v;
    });
    return { meta, body: src.slice(m[0].length) };
  }

  function renderMarkdown(md) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(md);
    }
    return fallbackMarkdown(md);
  }

  async function ensureMarked() {
    if (window.marked) return;
    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js';
      s.onload = resolve;
      s.onerror = resolve; // fall back silently
      document.head.appendChild(s);
    });
  }

  /* ---------- Home teaser ---------- */
  async function initHomeTeaser() {
    const el = document.getElementById('home-posts');
    if (!el) return;
    try {
      const posts = await loadIndex();
      renderPostList(el, posts, 3);
    } catch (err) {
      el.innerHTML = '<p class="muted">Posts will appear here once you add some markdown files to <code>blog/posts/</code>.</p>';
    }
  }

  /* ---------- Blog index ---------- */
  async function initBlogIndex() {
    const el = document.getElementById('blog-list');
    if (!el) return;
    try {
      const posts = await loadIndex();
      renderPostList(el, posts);
    } catch (err) {
      el.innerHTML = '<p class="muted">No posts yet.</p>';
    }
  }

  /* ---------- Single post ---------- */
  async function initPost() {
    const container = document.getElementById('post');
    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (!slug) {
      container.innerHTML = '<p class="muted">Missing post slug.</p>';
      return;
    }

    try {
      const posts = await loadIndex();
      const meta = posts.find(p => p.slug === slug);
      if (!meta) {
        container.innerHTML = '<p class="muted">Post not found. <a href="index.html">Back to blog</a>.</p>';
        return;
      }
      const res = await fetch(postFileUrl(meta.file), { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to load post');
      const raw = await res.text();
      const { meta: fm, body } = parseFrontMatter(raw);
      await ensureMarked();

      const title = fm.title || meta.title;
      const date = fm.date || meta.date;

      document.title = `${title} — Tord`;

      container.innerHTML = `
        <a class="back-link" href="index.html">← All posts</a>
        <h1>${escapeHTML(title)}</h1>
        <div class="post-meta">
          <time datetime="${date}">${formatDate(date)}</time>
          ${meta.readingTime ? `<span>${escapeHTML(meta.readingTime)}</span>` : ''}
        </div>
        <article class="prose">${renderMarkdown(body)}</article>
      `;
    } catch (err) {
      container.innerHTML = `<p class="muted">Could not load this post. ${escapeHTML(err.message || '')}</p>`;
    }
  }

  // Run all — harmless on pages where targets don't exist
  initHomeTeaser();
  initBlogIndex();
  initPost();
})();
