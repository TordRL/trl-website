---
title: Modular ticket and case-management system
role: IT Consultant / Self-initiated project lead
period: 2025 — ongoing
tags: [SharePoint, Power Automate, Power Apps, Microsoft 365]
featured: true
year: 2025
status: in-progress
sort: 5
keywords: [sharepoint, power automate, power apps, microsoft forms, ticketing, case management, workflows, automation, modular, microsoft 365, governance, preboarding, offboarding, change request]
---

In 2025 I designed and built a modular ticket- and case-management system on top of SharePoint lists, Power Automate, and Power Apps/Forms as the frontend. Power Automate helper lists generate the underlying tasks for each incoming case, and the architecture is deliberately built for extension — new processes plug in as new modules.

This was a self-initiated project, triggered by a gap I uncovered during an internal stand-in: one employee had a firm grip on their own workload, but the processes were invisible to the rest of the organisation. Things ran in personal inboxes and Teams channels, and there was no shared view of what was in flight or what had been promised.

**Approach:**

- Mapped the recurring case types that were quietly running through email and Teams, and grouped them into modules
- Built the SharePoint list structure and the Power Automate flows that translate a single submission into the underlying tasks
- Used Power Apps and Forms as low-friction frontends so the system fits the way people already work
- Designed the modules to be added independently, so a new process is a new module rather than a rebuild

**Modules:**

- **Delivered:** preboarding, change requests
- **In development:** licence administration, offboarding, procurement

**Results:**

- Replaces personal inboxes and ad-hoc Teams posts with a shared, visible system of record
- Rolling out across the leadership group, the IT department, and departments with external roles that need follow-up
- Built to extend — new modules slot in without disturbing the ones already running
