---
title: Send an assessment to a candidate
summary: Send a candidate a link to a written exam, a coding task and a voice defense, look after the link, check a résumé against the job, and make a work trial from your own code.
roles: [recruiter]
group: Assessments
features: [recruiter-assessments, work-trials, coding-challenges]
order: 10
checked: 2026-11-12
short:
  - On Candidates, select Send an assessment, fill in the candidate and the three stages, and select Create and get link.
  - The full link is shown only once. Copy it, or let Edulexa e-mail it to the candidate.
  - E-mail again or New link replaces a lost link. Revoke stops it working.
---
An assessment has three stages, taken in order: a written exam, a coding task, and a voice defense, where the candidate explains and defends their work out loud to an AI interviewer.

## Send an assessment

1. On [ui: Candidates], select [ui: Send an assessment].
2. Fill in the [ui: Candidate name], [ui: Candidate email], [ui: Role] and [ui: Company or team].
3. Choose the [ui: Stage 1: written exam] and the [ui: Stage 2: coding language].
4. Under [ui: Stage 3: voice defense topic], write what the candidate should explain and defend.
5. Leave [ui: E-mail the link to the candidate] ticked if you want Edulexa to send it. It goes out in your company's name, and the candidate's replies come to you.
6. Select [ui: Create and get link].

The candidate's link appears once. For security, the full link isn't shown again, so select [ui: Copy] now if you want to send it yourself. [ui: Preview as the candidate] shows you what the candidate will see.

## Look after the link

Each candidate's row shows the stage they're on, when their link expires, whether the e-mail arrived and when they opened it. If it says the e-mail bounced, check the address.

- [ui: E-mail again] e-mails the candidate a new link.
- [ui: New link] makes a new link for you to copy and send yourself.
- [ui: Revoke] withdraws the link, so the candidate can't open it any more.

A new link always replaces the old one, which stops working. You can e-mail a link again only once a minute, and only a few times in all.

## Check a résumé against the job

1. Select [ui: More actions], then [ui: Check a résumé].
2. Under [ui: Requirements], write one requirement per line. For alternatives, write "or", for example "RN or LPN".
3. Paste the [ui: Résumé text] and select [ui: Check résumé].

You see which requirements the résumé mentions, and the lines that mention them. There's no score, nothing is sent to an AI, and the résumé isn't saved. A mention isn't proof, so ask about each requirement in the interview.

## Coding challenges

[ui: New coding challenge], under [ui: More actions], makes a private coding task for your company. Give it a [ui: Challenge title], a [ui: Language] and a [ui: Problem description], then select [ui: Create challenge]. Edulexa shows its invite code for a moment. Candidates need this code to start a private challenge, and their work shows on the [ui: Coding challenge submissions] tab.

> To send a candidate a link they can open straight away, use [ui: Send an assessment] or a work trial.

## Work trials from your own code

A work trial is a private task made from a small part of your own code, with planted defects (bugs put there on purpose) and hidden tests. Open [ui: Work trials] under [ui: Review]. It's marked [ui: Beta].

1. Select [ui: New work trial]. Choose the code from a [ui: GitHub repository], or [ui: Paste or upload files].
2. Fill in the [ui: Role title] and the [ui: AI policy for candidates].
3. Read [ui: How your code is handled]. Edulexa removes secrets and personal details before any code leaves Edulexa, then shows you everything it removed. Tick the agreement and select [ui: Fetch and clean the code].
4. Select [ui: Generate]. The AI chooses a small part of the code and plants the defects. This can take a minute or two.
5. Select [ui: Validate in sandbox]. This checks that the hidden tests pass on your original code and catch each planted defect.
6. Review what the AI made, then select [ui: Publish]. Share the [ui: Candidate link] or the [ui: Invite code] with candidates.

A draft that isn't published is deleted after 30 days. Candidates' work arrives in [ui: Evidence packs], where a person reviews it and decides. See [Review an evidence pack and decide](/help/recruiter-evidence-packs).
