# Writing help articles

The help center (`/help`, and the side panel opened from any page) is built from the files in this folder by
`scripts/help-build.ts`. Run `npx tsx scripts/help-build.ts` after a change; the push stops when an article no longer matches
the app (`--check`).

## Who reads them

Teachers, students, school staff, recruiters, employers and individual learners. Not developers. So:

- **Everyday words.** Never use technical or developer words: API, server, token, database, sync, JSON, webhook, URL,
  browser storage, cache, error codes, IDs. Say what the person sees and does ("the link", "your sign-in", "the list of
  students"). If the screen itself uses a technical word, the screen is wrong: fix the screen's text, then the article.
- **US English**, short sentences, "you", the person's own words (hand in, sign in, marks/score).
- **Only what the app really does.** Every step must be checked against the app's code or the running app. Never invent a
  button, a number, a time limit or a feature.

## A file

`content/help/en/<slug>.md`, the slug in lower-case words joined by hyphens.

```
---
title: Book an appointment
summary: One sentence: what the reader can do with this article.
roles: [student, alumni]
group: Career help
features: [appointments]
order: 10
checked: 2026-11-11
short:
  - Up to three short lines: the whole answer for someone in a hurry.
  - Required for articles over 250 words.
---
Body text.
```

- **roles:** who it's for: `admin` (school admins), `teacher`, `staff` (career staff), `student`, `alumni`, `member`
  (individual learners with no school), `recruiter`, `employer`, `admissions` (guidance institutes' admins and
  counselors), `mentor`, or `everyone`.
- **group:** one of the groups listed for each of those audiences in `audiences.yml` (the order there is the order of the
  work).
- **features:** the features it covers, by their id in `docs/feature_register.json`.
- **order:** where it comes in its group.
- **checked:** the day it was last checked against the app.

## The body

- `## Heading` and `### Smaller heading`
- Paragraphs; lists with `- ` or `1. `; a note with `> `
- `**bold**` for a word that matters
- `[ui: Save decision]`: a button, tab or label exactly as the app shows it. The build checks that the app shows this text.
- `[the viva](/help/the-viva)` links to an article; `[your wallet](/wallet)` to a page (it must be a page in the register).
- `[shot: hand-in-start]` on a line of its own: a screenshot, described in `shots.yml` and taken by `scripts/help-shots.mjs`.

Terms listed in `en/glossary.yml` are explained automatically where an article first uses them. Words people search with are
in `en/words.yml`.
