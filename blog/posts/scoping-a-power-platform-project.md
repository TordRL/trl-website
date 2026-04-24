---
title: Scoping a Power Platform project — what I ask first
date: 2026-04-22
---

Most Power Platform projects that go wrong, go wrong at scoping. Not because someone picked the wrong connector or got the Dataverse schema slightly off — those are fixable. They go wrong because the team agreed to build the wrong thing, or the right thing for the wrong owner.

Here's the short list of questions I work through with every new client before a single app screen gets sketched.

## Who owns this after I leave?

The answer shapes everything else. An IT-owned Center of Excellence needs a very different artifact than a business unit that's going to maintain it themselves with a single citizen developer. I'd rather build something slightly less clever that the client can confidently change, than something beautiful that turns into a black box.

## Is this the right layer of the stack?

Not everything belongs in Power Platform. If the real problem is a broken source system, no canvas app is going to fix it — you'll just put lipstick on it. A few quick gut-checks:

- **SharePoint list or Dataverse?** If you need relationships, role-based security, or more than a few thousand rows of anything, Dataverse.
- **Model-driven or canvas?** Canvas for task-focused tools on mobile. Model-driven when the data model is the app.
- **Power Automate or Logic Apps?** If there's no human in the loop and it runs at volume, Logic Apps often wins on cost and ALM.

## What does "done" look like?

I push clients to write this down in one sentence per persona, before we start. "A field technician can complete an inspection in under 5 minutes on their phone, including photos, without internet." That sentence becomes the scope gate for every feature request that shows up later.

## How will this move from Dev → Prod?

If the answer is "we'll figure that out later," it's already gone wrong. Solutions, environment strategy, and a pipeline (even a simple one) get decided up front. Retrofitting ALM onto an unmanaged solution is one of the most expensive exercises in consulting.

## What's the licensing picture?

Per-app, per-user, pay-as-you-go, premium connectors, Dataverse capacity — licensing drives architecture more than people expect. A quick conversation with the client's licensing admin in week one has saved me many painful redesigns.

---

That's my opening checklist. Replace this post with your own — the point of a field-notes blog is to turn lessons into reusable assets, both for your clients and for your future self.
