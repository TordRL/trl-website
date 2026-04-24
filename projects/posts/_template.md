---
title: (Project title)
role: (Prosjektleder, Konsulent, IT-koordinator)
period: (Jan 2024 – Jun 2024)
tags: []
featured: false
year: <% tp.date.now("YYYY") %>
status: delivered
sort: 0
keywords: []
---

<!--
FIELD GUIDE
───────────
title    : Displayed as the project heading on the website
role     : Your role on the project
period   : Free-text date range — shown next to role ("Rolle / Periode")
tags     : Shown as filter chips — e.g. [Power Apps, SharePoint, Teams]
featured : true = included in homepage carousel rotation
year     : Used for sorting when sort is equal
status   : delivered | in-progress | concept
sort     : Lower number = appears earlier in the list (0 = top)
keywords : Used by generate-cv.py to match this project to job listings

FILES STARTING WITH _ ARE EXCLUDED FROM THE WEBSITE.
This template is never published. Copy it for a new project.

WORKFLOW
────────
1. Duplicate this file, rename it (e.g. my-project.md)
2. Fill in the frontmatter above
3. Write your project description below the --- divider
4. Run: python build-projects.py
5. Open index.html — your project appears automatically
-->

<% tp.file.cursor() %>

<!-- Optional structured sections you can use:

**Problembeskrivelse:** What was the situation before?

**Tilnærming:** How did you approach it?

**Resultater:**
- Key outcome with number
- Another measurable result

-->
