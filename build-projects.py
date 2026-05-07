#!/usr/bin/env python3
"""
build-projects.py - Compile project .md files -> js/projects-data.js

Run this after adding or editing any file in projects/posts/
Files starting with _ (like _template.md) are automatically excluded.

USAGE
-----
  python build-projects.py

No dependencies required beyond Python 3.6+.
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

POSTS_DIR  = Path(__file__).parent / "projects" / "posts"
OUTPUT     = Path(__file__).parent / "js" / "projects-data.js"


def parse_frontmatter(text):
    m = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n?(.*)', text, re.DOTALL)
    if not m:
        return {}, text.strip()
    meta_raw, body = m.group(1), m.group(2).strip()
    meta = {}
    i = 0
    lines = meta_raw.splitlines()
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.strip().startswith('#'):
            i += 1
            continue
        km = re.match(r'^(\w+):\s*$', line)
        if km and i + 1 < len(lines) and lines[i+1].strip().startswith('-'):
            key = km.group(1)
            items = []
            i += 1
            while i < len(lines) and re.match(r'^\s+-', lines[i]):
                items.append(lines[i].strip().lstrip('- ').strip().strip('"\''))
                i += 1
            meta[key] = items
            continue
        kvm = re.match(r'^(\w+):\s*(.*)', line)
        if kvm:
            key, val = kvm.group(1), kvm.group(2).strip()
            if val.startswith('[') and val.endswith(']'):
                inner = val[1:-1]
                meta[key] = [v.strip().strip('"\'') for v in inner.split(',') if v.strip()]
            elif val.lower() == 'true':
                meta[key] = True
            elif val.lower() == 'false':
                meta[key] = False
            elif re.match(r'^\d+$', val):
                meta[key] = int(val)
            elif (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                meta[key] = val[1:-1]
            else:
                meta[key] = val
        i += 1
    return meta, body


def inline_md(s):
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'__(.+?)__', r'<strong>\1</strong>', s)
    s = re.sub(r'\*(.+?)\*', r'<em>\1</em>', s)
    s = re.sub(r'_(.+?)_', r'<em>\1</em>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    s = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', s)
    return s


def md_to_html(md):
    md = re.sub(r'<!--.*?-->', '', md, flags=re.DOTALL).strip()
    if not md:
        return ''
    blocks = re.split(r'\n{2,}', md)
    html_parts = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.splitlines()
        if lines[0].startswith('#'):
            hm = re.match(r'^(#{1,6})\s+(.*)', lines[0])
            if hm:
                level = len(hm.group(1))
                text  = inline_md(hm.group(2))
                html_parts.append('<h' + str(level) + '>' + text + '</h' + str(level) + '>')
                continue
        if all(l.startswith('>') for l in lines):
            inner = '\n'.join(l.lstrip('> ') for l in lines)
            html_parts.append('<blockquote><p>' + inline_md(inner) + '</p></blockquote>')
            continue
        if all(re.match(r'^[-*+]\s', l) or not l.strip() for l in lines):
            items = [re.sub(r'^[-*+]\s+', '', l) for l in lines if l.strip()]
            lis = ''.join('<li>' + inline_md(i) + '</li>' for i in items)
            html_parts.append('<ul>' + lis + '</ul>')
            continue
        if all(re.match(r'^\d+[.)]\s', l) or not l.strip() for l in lines):
            items = [re.sub(r'^\d+[.)]\s+', '', l) for l in lines if l.strip()]
            lis = ''.join('<li>' + inline_md(i) + '</li>' for i in items)
            html_parts.append('<ol>' + lis + '</ol>')
            continue
        para_lines = []
        for l in lines:
            if l.endswith('  '):
                para_lines.append(inline_md(l.rstrip()) + '<br>')
            else:
                para_lines.append(inline_md(l))
        html_parts.append('<p>' + ' '.join(para_lines) + '</p>')
    return '\n'.join(html_parts)


def extract_excerpt(md):
    md = re.sub(r'<!--.*?-->', '', md, flags=re.DOTALL).strip()
    for block in re.split(r'\n{2,}', md):
        block = block.strip()
        if not block:
            continue
        if block.startswith('#') or block.startswith('>'):
            continue
        if re.match(r'^[-*+\d]', block):
            continue
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', block)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'`(.+?)`', r'\1', text)
        text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text)
        text = ' '.join(text.split())
        if len(text) > 20:
            return text
    return ''


def slugify(name):
    s = name.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def build():
    if not POSTS_DIR.exists():
        print("ERROR:", POSTS_DIR, "does not exist.")
        sys.exit(1)
    md_files = sorted(
        [f for f in POSTS_DIR.glob('*.md') if not f.name.startswith('_')],
        key=lambda f: f.name
    )
    if not md_files:
        print("No .md files found in", POSTS_DIR)
        sys.exit(0)

    projects = []
    for path in md_files:
        text = path.read_text(encoding='utf-8')
        meta, body = parse_frontmatter(text)
        if not meta.get('title'):
            print("  SKIP", path.name, "- no title in frontmatter")
            continue
        if str(meta.get('title', '')).startswith('_'):
            print("  SKIP", path.name, "- archived (title starts with _)")
            continue
        slug = slugify(meta.get('title', path.stem))
        project = {
            'id':          meta.get('id', path.stem),
            'slug':        slug,
            'title':       meta.get('title', ''),
            'role':        meta.get('role', ''),
            'period':      str(meta.get('period', meta.get('year', ''))),
            'year':        int(meta.get('year', 0)) if str(meta.get('year', '')).isdigit() else 0,
            'featured':    bool(meta.get('featured', False)),
            'status':      meta.get('status', 'delivered'),
            'sort':        int(meta.get('sort', 0)) if str(meta.get('sort', '0')).lstrip('-').isdigit() else 0,
            'tags':        meta.get('tags', []),
            'keywords':    meta.get('keywords', []),
            'excerpt':     extract_excerpt(body),
            'contentHtml': md_to_html(body),
        }
        projects.append(project)
        print("  OK ", path.name, "->", project['title'])

    projects.sort(key=lambda p: (p['sort'], -p['year']))

    projects_json = json.dumps(projects, ensure_ascii=False, indent=2)
    generated_at  = datetime.now().strftime('%Y-%m-%d %H:%M')

    header_lines = [
        "// AUTO-GENERATED by build-projects.py - do not edit directly.",
        "// Source: projects/posts/*.md",
        "// Last built: " + generated_at,
        "//",
        "// To add or edit a project:",
        "//   1. Edit (or create) a .md file in projects/posts/",
        "//   2. Run: python build-projects.py",
        "//   3. Reload your browser",
        "//",
        "// Files starting with _ (e.g. _template.md) are excluded from the build.",
        "",
    ]
    output_content = "\n".join(header_lines) + "\nwindow.PROJECTS_DATA = " + projects_json + ";\n"

    OUTPUT.write_text(output_content, encoding='utf-8')
    print()
    print("  Wrote", len(projects), "project(s) ->", OUTPUT)


if __name__ == '__main__':
    build()
