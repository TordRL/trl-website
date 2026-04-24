#!/usr/bin/env python3
"""
generate-cv.py — Tailored CV generator for Tord's website

Reads data/profile.json and projects/projects.json, scores your skills and
projects against a job listing, and outputs a clean PDF CV tailored to the role.

USAGE
-----
  # Basic (keyword matching):
  python generate-cv.py --job "Power Platform consultant role at Equinor, looking for..."

  # From a file:
  python generate-cv.py --job-file job.txt

  # With Claude API for smarter matching (set ANTHROPIC_API_KEY env var):
  ANTHROPIC_API_KEY=sk-... python generate-cv.py --job-file job.txt

  # Custom output path:
  python generate-cv.py --job-file job.txt --output "CV_Tord_Equinor.pdf"

INSTALL
-------
  pip install fpdf2
  pip install anthropic   # optional, for AI-powered matching

"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# Paths (relative to this script)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROFILE_PATH = SCRIPT_DIR / "data" / "profile.json"
PROJECTS_DATA_JS = SCRIPT_DIR / "js" / "projects-data.js"   # single source of truth


def load_projects() -> list:
    """Parse the project array from js/projects-data.js."""
    if not PROJECTS_DATA_JS.exists():
        print(f"ERROR: {PROJECTS_DATA_JS} not found.")
        sys.exit(1)
    content = PROJECTS_DATA_JS.read_text(encoding="utf-8")
    # Find the array assigned to window.PROJECTS_DATA
    m = re.search(r'window\.PROJECTS_DATA\s*=\s*(\[)', content)
    if not m:
        print("ERROR: could not find window.PROJECTS_DATA in projects-data.js")
        sys.exit(1)
    start = m.start(1)
    # Walk to the matching closing bracket
    depth = 0
    in_string = False
    escape_next = False
    for i, c in enumerate(content[start:]):
        if escape_next:
            escape_next = False
            continue
        if c == '\\' and in_string:
            escape_next = True
            continue
        if c == '"':
            in_string = not in_string
            continue
        if not in_string:
            if c in ('[', '{'):
                depth += 1
            elif c in (']', '}'):
                depth -= 1
                if depth == 0:
                    end = start + i + 1
                    break
    try:
        return json.loads(content[start:end])
    except json.JSONDecodeError as e:
        print(f"ERROR: could not parse projects-data.js as JSON: {e}")
        sys.exit(1)

# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def tokenise(text: str) -> set[str]:
    """Lower-case words and simple bigrams from a string."""
    text = text.lower()
    words = re.findall(r"[a-z0-9]+(?:[.\-'][a-z0-9]+)*", text)
    tokens = set(words)
    # bigrams
    for i in range(len(words) - 1):
        tokens.add(f"{words[i]} {words[i+1]}")
    return tokens


def score_against_job(keywords: list[str], job_tokens: set[str]) -> int:
    """Count how many of the item's keywords appear in the job listing tokens."""
    count = 0
    for kw in keywords:
        kw_tokens = tokenise(kw)
        if kw_tokens & job_tokens:
            count += 1
    return count


def rank_skills(profile: dict, job_tokens: set[str]) -> list[str]:
    """Return all skills sorted by relevance to the job listing."""
    skill_groups = profile.get("skills", {})
    scored = []
    for group_name, skills in skill_groups.items():
        if group_name.startswith("_"):
            continue
        for skill in skills:
            s = score_against_job([skill], job_tokens)
            scored.append((skill, s, group_name))

    # Sort: relevant first, then by group order (primary > platform > delivery > adjacent)
    group_order = {"primary": 0, "platform": 1, "delivery": 2, "adjacent": 3}
    scored.sort(key=lambda x: (-x[1], group_order.get(x[2], 9)))
    return [s[0] for s in scored]


def rank_projects(projects: list[dict], job_tokens: set[str]) -> list[dict]:
    """Return projects sorted by relevance. Always include featured ones."""
    scored = []
    for p in projects:
        kws = p.get("keywords", []) + p.get("tags", []) + [p.get("title", "")]
        s = score_against_job(kws, job_tokens)
        scored.append((s, p))
    scored.sort(key=lambda x: -x[0])
    return [item[1] for item in scored]


def rank_experience(experience: list[dict], job_tokens: set[str]) -> list[dict]:
    """Sort experience entries by relevance (current always first)."""
    scored = []
    for exp in experience:
        kws = exp.get("keywords", []) + [exp.get("title", ""), exp.get("company", "")]
        s = score_against_job(kws, job_tokens)
        is_current = 1 if exp.get("current") else 0
        scored.append((is_current * 100 + s, exp))
    scored.sort(key=lambda x: -x[0])
    return [item[1] for item in scored]


# ---------------------------------------------------------------------------
# Claude API matching (optional, much smarter)
# ---------------------------------------------------------------------------

def claude_select(profile: dict, projects: list[dict], job_text: str) -> dict:
    """
    Use Claude claude-haiku-4-5-20251001 to intelligently select and reframe CV content.
    Returns a dict with selected_skills, selected_projects, summary_tweak.
    Falls back gracefully if anything goes wrong.
    """
    try:
        import anthropic
    except ImportError:
        print("  [info] anthropic package not installed — using keyword matching instead.")
        print("         Run: pip install anthropic")
        return {}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {}

    print("  [Claude API] Selecting best-fit content for this role…")
    client = anthropic.Anthropic(api_key=api_key)

    skills_flat = []
    for group, items in profile.get("skills", {}).items():
        if not group.startswith("_"):
            skills_flat.extend(items)

    proj_list = "\n".join(
        f"- {p['title']}: {p.get('summary','')}" for p in projects
    )

    prompt = f"""You are helping tailor a CV for a job application. Given the job listing and the candidate's data, return a JSON object with these keys:
- "selected_skills": array of skill strings (max 16), most relevant to the job first
- "selected_project_ids": array of project id strings (max 3), most relevant first
- "opening_line": one sentence (max 20 words) summarising why this candidate fits this role specifically

Candidate skills: {json.dumps(skills_flat)}
Candidate projects: {proj_list}
Job listing:
{job_text[:3000]}

Return ONLY valid JSON, no explanation."""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        # Extract JSON if wrapped in markdown code block
        m = re.search(r"```(?:json)?\s*([\s\S]+?)```", raw)
        if m:
            raw = m.group(1)
        return json.loads(raw)
    except Exception as e:
        print(f"  [Claude API] Warning: {e}. Falling back to keyword matching.")
        return {}


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

def generate_pdf(
    profile: dict,
    projects: list[dict],
    job_tokens: set[str],
    job_text: str,
    output_path: Path,
    claude_result: dict | None = None,
):
    try:
        from fpdf import FPDF, XPos, YPos
    except ImportError:
        print("\n  ERROR: fpdf2 is not installed.")
        print("  Run:  pip install fpdf2\n")
        sys.exit(1)

    personal = profile.get("personal", {})
    bio = profile.get("bio", {})

    # --- Select content ---
    if claude_result and claude_result.get("selected_skills"):
        skills = claude_result["selected_skills"][:16]
    else:
        skills = rank_skills(profile, job_tokens)[:14]

    if claude_result and claude_result.get("selected_project_ids"):
        ids = claude_result["selected_project_ids"]
        proj_order = {pid: i for i, pid in enumerate(ids)}
        top_projects = sorted(
            [p for p in projects if p.get("id") in proj_order],
            key=lambda p: proj_order.get(p.get("id"), 99)
        )[:3]
        if not top_projects:  # fallback
            top_projects = rank_projects(projects, job_tokens)[:3]
    else:
        top_projects = rank_projects(projects, job_tokens)[:3]

    ranked_exp = rank_experience(profile.get("experience", []), job_tokens)

    opening_line = (
        claude_result.get("opening_line", "") if claude_result
        else bio.get("short", "")
    )
    if not opening_line:
        opening_line = bio.get("short", "")

    # --- PDF setup ---
    class CV(FPDF):
        ACCENT = (37, 99, 235)   # blue
        TEXT = (15, 15, 20)
        MUTED = (85, 90, 100)
        LIGHT = (220, 222, 226)
        BG_ALT = (248, 249, 250)

        MARGIN_L = 18
        MARGIN_R = 18
        MARGIN_T = 18
        COL_W = 62   # left sidebar width
        GAP = 6
        PAGE_W = 210

        def setup(self):
            self.set_margins(self.MARGIN_L, self.MARGIN_T, self.MARGIN_R)
            self.set_auto_page_break(auto=True, margin=16)
            self.add_page()

        @property
        def content_w(self):
            return self.PAGE_W - self.MARGIN_L - self.MARGIN_R

        @property
        def main_col_w(self):
            return self.content_w - self.COL_W - self.GAP

        def rule(self, color=None):
            c = color or self.LIGHT
            self.set_draw_color(*c)
            self.set_line_width(0.3)
            x = self.get_x()
            y = self.get_y()
            self.line(self.MARGIN_L, y, self.PAGE_W - self.MARGIN_R, y)
            self.ln(3)

        def section_heading(self, label: str):
            self.ln(4)
            self.set_font("Helvetica", "B", 7.5)
            self.set_text_color(*self.ACCENT)
            r, g, b = self.ACCENT
            # Small coloured bar
            self.set_fill_color(r, g, b)
            self.rect(self.MARGIN_L, self.get_y(), 2.5, 4.5, "F")
            self.set_x(self.MARGIN_L + 4)
            self.cell(0, 4.5, label.upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_text_color(*self.TEXT)
            self.rule(self.LIGHT)

        def sidebar_heading(self, label: str):
            self.ln(4)
            self.set_font("Helvetica", "B", 7)
            self.set_text_color(*self.MUTED)
            self.set_x(self.MARGIN_L)
            self.cell(self.COL_W, 4, label.upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_text_color(*self.TEXT)
            self.ln(1)

    pdf = CV()
    pdf.setup()

    W = pdf.PAGE_W - pdf.MARGIN_L - pdf.MARGIN_R
    X0 = pdf.MARGIN_L

    # ========================
    # HEADER BLOCK
    # ========================
    name = personal.get("name", "Tord")
    title = personal.get("title", "Microsoft Power Platform Consultant")
    email = personal.get("email", "")
    location = personal.get("location", "")
    linkedin = personal.get("linkedin", "")
    github = personal.get("github", "")
    avail = personal.get("availability", "")

    pdf.set_fill_color(15, 15, 20)
    pdf.rect(0, 0, 210, 38, "F")

    pdf.set_xy(X0, 8)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(244, 244, 245)
    pdf.cell(0, 10, name, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_x(X0)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(155, 161, 171)
    pdf.cell(0, 6, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # Contact line
    contact_parts = [p for p in [email, location, linkedin, github] if p]
    pdf.set_x(X0)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(155, 161, 171)
    pdf.cell(0, 5, "  ·  ".join(contact_parts), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if avail == "open-to-work":
        pdf.set_xy(pdf.PAGE_W - pdf.MARGIN_R - 42, 14)
        pdf.set_fill_color(16, 185, 129)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 7)
        pdf.cell(40, 6, "  Open to new roles", border=0, fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")

    pdf.set_text_color(*pdf.TEXT)
    pdf.set_y(42)

    # ========================
    # OPENING SUMMARY
    # ========================
    pdf.set_x(X0)
    pdf.set_font("Helvetica", "I", 9.5)
    pdf.set_text_color(*pdf.MUTED)
    pdf.multi_cell(W, 5, opening_line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*pdf.TEXT)
    pdf.ln(1)
    pdf.rule()

    # ========================
    # TWO COLUMN LAYOUT
    # ========================
    # We draw sidebar content first (left), then main (right)
    # Use manual X positioning

    LEFT_X = X0
    RIGHT_X = X0 + pdf.COL_W + pdf.GAP
    RIGHT_W = W - pdf.COL_W - pdf.GAP
    SIDEBAR_W = pdf.COL_W

    col_start_y = pdf.get_y()

    # ---------- SIDEBAR ----------
    sidebar_y = col_start_y

    def sidebar_text(label, value, sidebar_y_ref):
        pdf.set_xy(LEFT_X, sidebar_y_ref)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(*pdf.MUTED)
        pdf.cell(SIDEBAR_W, 4, label, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_x(LEFT_X)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*pdf.TEXT)
        pdf.multi_cell(SIDEBAR_W, 4.5, value, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*pdf.TEXT)
        return pdf.get_y() + 2

    # Skills sidebar heading
    pdf.set_xy(LEFT_X, sidebar_y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*pdf.MUTED)
    pdf.cell(SIDEBAR_W, 4, "SKILLS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*pdf.TEXT)
    sidebar_y = pdf.get_y() + 1

    for skill in skills:
        pdf.set_xy(LEFT_X, sidebar_y)
        pdf.set_font("Helvetica", "", 8.5)
        in_job = score_against_job([skill], job_tokens) > 0
        if in_job:
            pdf.set_text_color(*pdf.ACCENT)
        else:
            pdf.set_text_color(*pdf.TEXT)
        pdf.cell(SIDEBAR_W - 2, 4.5, f"• {skill}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        sidebar_y = pdf.get_y()
    pdf.set_text_color(*pdf.TEXT)

    sidebar_y += 3
    pdf.set_xy(LEFT_X, sidebar_y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*pdf.MUTED)
    pdf.cell(SIDEBAR_W, 4, "CERTIFICATIONS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*pdf.TEXT)
    sidebar_y = pdf.get_y() + 1

    for cert in profile.get("certifications", []):
        pdf.set_xy(LEFT_X, sidebar_y)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(SIDEBAR_W, 4, cert.get("code", ""), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_x(LEFT_X)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(*pdf.MUTED)
        pdf.multi_cell(SIDEBAR_W, 4, cert.get("name", ""), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*pdf.TEXT)
        sidebar_y = pdf.get_y() + 1

    sidebar_y += 2
    pdf.set_xy(LEFT_X, sidebar_y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*pdf.MUTED)
    pdf.cell(SIDEBAR_W, 4, "LANGUAGES", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*pdf.TEXT)
    sidebar_y = pdf.get_y() + 1
    for lang in profile.get("languages", []):
        pdf.set_xy(LEFT_X, sidebar_y)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.cell(SIDEBAR_W, 4.5, f"{lang['language']} — {lang['level']}",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        sidebar_y = pdf.get_y()

    sidebar_bottom = sidebar_y

    # ---------- MAIN COLUMN ----------
    def set_main_x():
        pdf.set_x(RIGHT_X)

    main_y = col_start_y

    # --- EXPERIENCE ---
    pdf.set_xy(RIGHT_X, main_y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*pdf.MUTED)
    pdf.cell(RIGHT_W, 4, "EXPERIENCE", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*pdf.TEXT)
    main_y = pdf.get_y() + 1

    for exp in ranked_exp:
        pdf.set_xy(RIGHT_X, main_y)
        # Date range
        from_str = exp.get("from", "")[:4] if exp.get("from") else ""
        to_str = "Present" if exp.get("current") else (exp.get("to", "")[:4] if exp.get("to") else "")
        date_str = f"{from_str} — {to_str}" if from_str else ""

        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(RIGHT_W, 5, exp.get("title", ""), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        main_y = pdf.get_y()

        pdf.set_xy(RIGHT_X, main_y)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*pdf.MUTED)
        company_line = exp.get("company", "")
        if date_str:
            company_line += f"  ·  {date_str}"
        pdf.cell(RIGHT_W, 4, company_line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*pdf.TEXT)
        main_y = pdf.get_y() + 1

        highlights = exp.get("highlights", [])
        for hl in highlights[:3]:
            pdf.set_xy(RIGHT_X + 2, main_y)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.multi_cell(RIGHT_W - 4, 4.5, f"• {hl}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            main_y = pdf.get_y()

        main_y += 3

    # --- SELECTED PROJECTS ---
    pdf.set_xy(RIGHT_X, main_y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*pdf.MUTED)
    pdf.cell(RIGHT_W, 4,
             "SELECTED PROJECTS" + (" (tailored to this role)" if job_tokens else ""),
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*pdf.TEXT)
    main_y = pdf.get_y() + 1

    for proj in top_projects:
        pdf.set_xy(RIGHT_X, main_y)
        pdf.set_font("Helvetica", "B", 9)
        title_str = proj.get("title", "")
        year = proj.get("year", "")
        pdf.cell(RIGHT_W - 20, 5, title_str, new_x=XPos.RIGHT, new_y=YPos.TOP)
        if year:
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*pdf.MUTED)
            pdf.cell(18, 5, str(year), align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*pdf.TEXT)
        else:
            pdf.ln(5)
        main_y = pdf.get_y()

        pdf.set_xy(RIGHT_X, main_y)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*pdf.MUTED)
        role_line = proj.get("role", "")
        if role_line:
            pdf.cell(RIGHT_W, 4, role_line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            main_y = pdf.get_y()
        pdf.set_text_color(*pdf.TEXT)

        pdf.set_xy(RIGHT_X, main_y)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.multi_cell(RIGHT_W, 4.5, proj.get("summary", ""), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        main_y = pdf.get_y() + 1

        # Impact bullets (top 2)
        for imp in proj.get("impact", [])[:2]:
            pdf.set_xy(RIGHT_X + 2, main_y)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*pdf.ACCENT)
            pdf.multi_cell(RIGHT_W - 4, 4.5, f"✓ {imp}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*pdf.TEXT)
            main_y = pdf.get_y()

        # Tech tags
        tags = proj.get("tags", [])[:5]
        if tags:
            pdf.set_xy(RIGHT_X, main_y)
            pdf.set_font("Helvetica", "I", 7.5)
            pdf.set_text_color(*pdf.MUTED)
            pdf.cell(RIGHT_W, 4, "  ".join(tags), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*pdf.TEXT)
            main_y = pdf.get_y()

        main_y += 4

    # Draw a thin left border on the sidebar column
    pdf.set_draw_color(*pdf.LIGHT)
    pdf.set_line_width(0.3)
    border_bottom = max(main_y, sidebar_bottom) + 2
    pdf.line(RIGHT_X - pdf.GAP / 2, col_start_y - 2, RIGHT_X - pdf.GAP / 2, border_bottom)

    # ========================
    # FOOTER
    # ========================
    pdf.set_y(-14)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*pdf.MUTED)
    generated = datetime.now().strftime("%B %Y")
    pdf.cell(0, 5, f"Generated {generated} · {personal.get('email', '')} · {personal.get('website', '')}", align="C")

    pdf.output(str(output_path))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate a tailored PDF CV from your website data."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--job", metavar="TEXT", help="Job listing text (paste inline)")
    group.add_argument("--job-file", metavar="FILE", help="Path to a text file containing the job listing")
    parser.add_argument("--output", metavar="FILE", default="", help="Output PDF path (default: CV_Tord_YYYY-MM.pdf)")
    args = parser.parse_args()

    # Read job listing
    if args.job:
        job_text = args.job
    else:
        job_file = Path(args.job_file)
        if not job_file.exists():
            print(f"ERROR: Job file not found: {job_file}")
            sys.exit(1)
        job_text = job_file.read_text(encoding="utf-8")

    print(f"\n  Job listing loaded ({len(job_text)} chars)")

    # Load data
    if not PROFILE_PATH.exists():
        print(f"ERROR: {PROFILE_PATH} not found. Run from the website root directory.")
        sys.exit(1)

    profile = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    projects = load_projects()

    print(f"  Profile loaded · {len(projects)} projects found")

    # Tokenise job listing
    job_tokens = tokenise(job_text)

    # Optional: Claude API for smarter selection
    claude_result = {}
    if os.environ.get("ANTHROPIC_API_KEY"):
        claude_result = claude_select(profile, projects, job_text)
        if claude_result:
            print(f"  Claude API: selected {len(claude_result.get('selected_skills', []))} skills, "
                  f"{len(claude_result.get('selected_project_ids', []))} projects")
    else:
        print("  Using keyword matching (set ANTHROPIC_API_KEY for smarter AI selection)")

    # Output path
    if args.output:
        output_path = Path(args.output)
    else:
        month = datetime.now().strftime("%Y-%m")
        output_path = SCRIPT_DIR / f"CV_Tord_{month}.pdf"

    print(f"\n  Generating PDF → {output_path}")
    generate_pdf(profile, projects, job_tokens, job_text, output_path, claude_result or None)
    print(f"  ✓ Done: {output_path}\n")


if __name__ == "__main__":
    main()
