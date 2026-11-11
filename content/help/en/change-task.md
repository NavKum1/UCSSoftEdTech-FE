---
title: Add a change task
summary: Before the viva, ask for one small, timed change to the student's own code, checked by tests.
roles: [teacher, admin]
group: Assessments
features: [class-assessments]
order: 22
checked: 2026-11-11
---
A change task shows whether students can work with their own code: someone who didn't write it usually can't change it quickly. It's available for [ui: Project defense] and [ui: Coding task] assessments.

## Turn it on

In the assessment's [ui: Change task] section, tick [ui: Ask for a small change to their own code] and set the [ui: Minutes for the change] (between 10 and 60).

Turning it on adds a criterion for the change (15%) to the rubric and scales the others down to fit. You can edit it like any other criterion.

## What students get

After a student hands in their work, the AI writes a short change request for their code and checks that it can be done. When it's ready, the student starts it; the clock runs from then. They work in the coding workspace on a copy of their own code, with the AI assistant off, and hand in their change. Hidden tests check it.

## What you see

On the student's evidence page you see the request, how long they took, which tests passed, and exactly what they changed. If their change touched the tests themselves, you're told the results can't be trusted.

> If the student's language isn't supported, or the change can't be prepared, the change task is skipped and the student goes straight to the viva; its criterion then doesn't count for them.
