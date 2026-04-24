# Tord — personal site

Plain HTML, CSS, and JS. No build step, no dependencies (except the Google fonts link and `marked.js` loaded from a CDN for Markdown rendering).

## Structure

```
.
├── index.html                # single-page home: Home, About, Projects, CV, Blog teaser, Contact
├── css/
│   └── styles.css            # all styles, light + dark themes
├── js/
│   ├── main.js               # theme toggle, nav, reveal animations, contact form
│   └── blog.js               # markdown blog loader
├── blog/
│   ├── index.html            # full blog listing
│   ├── post.html             # reads ?slug=<slug> and renders a post
│   └── posts/
│       ├── posts.json        # index of posts (edit this when you add one)
│       ├── hello-world.md
│       └── on-building-small.md
└── projects/
    └── sample-project.html   # case study template
```

## Running it locally

Because the blog loader uses `fetch()` to read Markdown files, you need to serve the site from a real HTTP server (not just open `index.html` directly). The easiest options:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open http://localhost:8000.

## Editing content

- **Name, bio, links, CV entries**: edit `index.html` directly. Everything is marked with placeholder copy.
- **Projects**: duplicate `projects/sample-project.html` for each new case study, and update the cards in `index.html`.
- **Blog**: add a new `.md` file to `blog/posts/` with optional front matter:

  ```markdown
  ---
  title: My new post
  date: 2026-05-01
  ---

  Post body here in Markdown.
  ```

  Then add an entry to `blog/posts/posts.json`:

  ```json
  {
    "slug": "my-new-post",
    "title": "My new post",
    "date": "2026-05-01",
    "summary": "A one-line summary.",
    "file": "my-new-post.md",
    "readingTime": "3 min read"
  }
  ```

- **Contact form**: currently uses a `mailto:` fallback that opens the user's email client. To send real submissions, replace the handler in `js/main.js` with a `fetch()` to an endpoint like [Formspree](https://formspree.io/), [Basin](https://usebasin.com/), or your own backend.

## Theme

The site defaults to dark and remembers the user's preference in `localStorage`. The initial theme honors `prefers-color-scheme` if nothing is saved. Toggle via the icon in the top-right nav.

## Deploying

Any static host works:

- **GitHub Pages**: push to a repo, enable Pages, point it at `main`.
- **Netlify / Vercel / Cloudflare Pages**: drag the folder, or connect the repo.
- **Your own server**: copy the files into a web root.
